"""Main entry point for knowledge graph processing."""

import os
import json
import asyncio
import logging
from tqdm import tqdm
from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import ChatOpenAI
import sys
import re

from kg_db import Neo4jConnection, setup_neo4j_constraints, add_to_neo4j, add_relationship_to_neo4j
from extraction import process_chunks
from kg_aggregation import EntityAggregator
from kg_utils import standardize_entity, cleanup_temp_files

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# Suppress OpenAI HTTP request logs for successful calls
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)

async def main():
    """Main execution function"""
    try:
        # Check for diagnostic mode
        diagnostic_mode = "--diagnostic" in sys.argv

        # Check if OpenAI API key is set
        OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
        if not OPENAI_API_KEY:
            raise ValueError("Please set the OPENAI_API_KEY environment variable.")
            
        # Setup Neo4j connection
        neo4j_conn = Neo4jConnection.get_instance()
        driver = neo4j_conn.get_driver()
        
        # Test Neo4j connection
        if not neo4j_conn.test_connection():
            raise ConnectionError("Cannot connect to Neo4j database. Please check connection details.")
        logging.info("Successfully connected to Neo4j database")
        
        # Setup Neo4j schema constraints
        with driver.session() as session:
            setup_neo4j_constraints(session)
        
        # After setting up Neo4j connection
        if diagnostic_mode:
            logging.info("Running in diagnostic mode - testing Neo4j connection...")
            with driver.session() as session:
                try:
                    # Test write permission
                    session.execute_write(lambda tx: tx.run("""
                        CREATE (n:TestNode {name: 'test'}) 
                        DELETE n
                    """))
                    logging.info("Write permission test successful")
                except Exception as e:
                    logging.error(f"Neo4j write permission test failed: {str(e)}")
                    raise
        
        # Stage 1: Load and process documents
        logging.info("Stage 1: Loading and processing documents")
        
        # Load documents from the specified directory
        loader = DirectoryLoader("./data", glob="**/*.txt", loader_cls=TextLoader)
        documents = loader.load()
        logging.info(f"Loaded {len(documents)} documents")
        
        # Split documents into chunks
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=3000, chunk_overlap=300)
        chunks = text_splitter.split_documents(documents)
        logging.info(f"Split into {len(chunks)} chunks")
        
        # Check for existing checkpoint to resume processing
        if os.path.exists('checkpoint_latest.json'):
            with open('checkpoint_latest.json', 'r') as f:
                extracted_data = json.load(f)
                logging.info(f"Loaded {len(extracted_data)} previously extracted items from checkpoint")
        else:
            # Get model parameters from environment variables or use defaults
            extraction_model = os.getenv("EXTRACTION_MODEL", "gpt-4o")
            extraction_temperature = float(os.getenv("EXTRACTION_TEMPERATURE", "0.0"))
            advanced_extraction_model = os.getenv("ADVANCED_EXTRACTION_MODEL", "gpt-4.5-preview-2025-02-27")
            
            # Process chunks and extract knowledge
            extracted_data = await process_chunks(
                chunks, 
                batch_size=5, 
                checkpoint_frequency=5,
                model_name=extraction_model,
                temperature=extraction_temperature,
                advanced_model_name=advanced_extraction_model
            )
            
            # Save final results
            with open('extracted_data.json', 'w') as f:
                json.dump(extracted_data, f)
            logging.info(f"Saved {len(extracted_data)} extracted items")
        
        # Stage 2: Aggregate and generate comprehensive profiles
        logging.info("Stage 2: Starting profile aggregation and generation")
        
        # Create the entity aggregator
        aggregator = EntityAggregator()
        
        # Add all extracted data to the aggregator
        for data in tqdm(extracted_data, desc="Aggregating extracted data"):
            aggregator.add_extraction_result(data)
        
        # After aggregating data
        entity_count = len(aggregator.entities)
        person_count = len(aggregator.persons)
        location_count = len(aggregator.locations)
        concept_count = len(aggregator.concepts)
        event_count = len(aggregator.events)
        attribute_count = len(aggregator.attributes)
        proposition_count = len(aggregator.propositions)
        emotion_count = len(aggregator.emotions)
        agent_count = len(aggregator.agents)
        thought_count = len(aggregator.thoughts)
        scientific_insight_count = len(aggregator.scientific_insights)
        law_count = len(aggregator.laws)
        reasoning_chain_count = len(aggregator.reasoning_chains)
        reasoning_step_count = len(aggregator.reasoning_steps)
        relationship_count = len(aggregator.relationships)
        
        logging.info(f"Found {entity_count} entities, {person_count} persons, and {location_count} locations")
        logging.info(f"Found {concept_count} concepts, {event_count} events, and {attribute_count} attributes")
        logging.info(f"Found {proposition_count} propositions, {emotion_count} emotions, and {agent_count} agents")
        logging.info(f"Found {thought_count} thoughts, {scientific_insight_count} scientific insights, and {law_count} laws")
        logging.info(f"Found {reasoning_chain_count} reasoning chains and {reasoning_step_count} reasoning steps")
        logging.info(f"Found {relationship_count} relationships to store")
        
        # Before starting Stage 3
        if entity_count == 0 and person_count == 0:
            logging.warning("No entities or persons were found to store in the database")
        
        # Generate comprehensive profiles
        # Use the advanced model for profile generation to capture psychological nuances better
        advanced_model_name = os.getenv("ADVANCED_EXTRACTION_MODEL", "gpt-4.5-preview-2025-02-27")
        logging.info(f"Using advanced model ({advanced_model_name}) for comprehensive profile generation")
        comprehensive_model = ChatOpenAI(model_name=advanced_model_name, temperature=0.2)
        comprehensive_profiles = await aggregator.generate_comprehensive_profiles(comprehensive_model)
        
        # Save comprehensive profiles
        with open('comprehensive_profiles.json', 'w') as f:
            json.dump(comprehensive_profiles, f)
        logging.info("Saved comprehensive profiles")
        
        # Stage 3: Store data in Neo4j
        logging.info("Stage 3: Storing data in Neo4j")
        with driver.session() as session:
            # First, store raw extraction data
            logging.info("Storing extracted entities and relationships")
            stored_entities = set()
            
            # Process entities first to establish nodes
            for data in tqdm(extracted_data, desc="Storing entities"):
                for entity in data.get('entities', []):
                    try:
                        if isinstance(entity, str):
                            # Basic entity parsing (older format)
                            # Format: Winston Churchill (Person) - Prime Minister of UK
                            if " - " in entity:
                                entity_parts = entity.split(" - ", 1)
                                entity_with_type = entity_parts[0].strip()
                                description = entity_parts[1].strip() if len(entity_parts) > 1 else ""
                                
                                # Extract name and type if format matches
                                if "(" in entity_with_type and ")" in entity_with_type:
                                    name_parts = entity_with_type.split("(", 1)
                                    entity_name = standardize_entity(name_parts[0].strip())
                                    entity_type = name_parts[1].rstrip(")").strip()
                                else:
                                    # Just use the whole thing as name if can't parse
                                    entity_name = standardize_entity(entity_with_type)
                                    entity_type = "General"
                            else:
                                # Fall back to treating the whole string as name if no description
                                entity_name = standardize_entity(entity)
                                entity_type = "General"
                                description = ""
                            
                            # Skip if name appears to be an attribute
                            if entity_name.lower().startswith("observations:") or entity_name.lower().startswith("keycontributions:"):
                                logging.warning(f"Skipping entity that appears to be an attribute: {entity_name}")
                                continue
                                
                            # Skip if already processed
                            if entity_name in stored_entities:
                                continue
                            
                            # Basic entity data
                            entity_data = {
                                "name": entity_name,
                                "nodeType": "Entity",
                                "subType": entity_type,
                                "observations": [description] if description else []
                            }
                            
                            # Store entity
                            result = session.execute_write(lambda tx: add_to_neo4j(tx, {"entity": entity_data}))
                            if result:
                                stored_entities.add(entity_name)
                                logging.info(f"Stored entity: {entity_name}")
                        elif isinstance(entity, dict) and 'name' in entity:
                            # Handle dictionary format
                            entity_name = standardize_entity(entity['name'])
                            
                            # Skip if name appears to be an attribute
                            if entity_name.lower().startswith("observations:") or entity_name.lower().startswith("keycontributions:"):
                                logging.warning(f"Skipping entity that appears to be an attribute: {entity_name}")
                                continue
                            
                            # Skip if already processed - but merge observations if they exist
                            if entity_name in stored_entities:
                                # Check if we have observations to add to existing entity
                                if 'observations' in entity and entity['observations']:
                                    # Merge with existing entity - not implemented yet but could be added
                                    pass
                                continue
                                
                            # Store full entity data
                            result = session.execute_write(lambda tx: add_to_neo4j(tx, {"entity": entity}))
                            if result:
                                stored_entities.add(entity_name)
                                logging.info(f"Stored entity: {entity_name}")
                    except Exception as e:
                        entity_name = entity.get('name', 'unknown') if isinstance(entity, dict) else 'unknown'
                        logging.error(f"Error storing entity {entity_name}: {str(e)}")
            
            # Process events
            for data in tqdm(extracted_data, desc="Storing events"):
                for event in data.get('events', []):
                    try:
                        if isinstance(event, dict) and 'name' in event:
                            event_name = standardize_entity(event['name'])
                            session.execute_write(lambda tx: add_to_neo4j(tx, {"event": event}))
                    except Exception as e:
                        logging.error(f"Error storing event: {str(e)}")
            
            # Process concepts
            for data in tqdm(extracted_data, desc="Storing concepts"):
                for concept in data.get('concepts', []):
                    try:
                        if isinstance(concept, str):
                            # Handle string format
                            concept_parts = concept.split(':', 1)
                            if len(concept_parts) == 2:
                                concept_name = standardize_entity(concept_parts[1].strip().split(' - ')[0])
                                concept_data = {
                                    "name": concept_name,
                                    "definition": concept.split(' - ', 1)[1] if ' - ' in concept else ""
                                }
                                session.execute_write(lambda tx: add_to_neo4j(tx, {"concept": concept_data}))
                        elif isinstance(concept, dict) and 'name' in concept:
                            # Handle dictionary format
                            concept_name = standardize_entity(concept['name'])
                            # Store full concept data
                            session.execute_write(lambda tx: add_to_neo4j(tx, {"concept": concept}))
                    except Exception as e:
                        concept_name = concept.get('name', 'unknown') if isinstance(concept, dict) else 'unknown'
                        logging.error(f"Error storing concept {concept_name}: {str(e)}")
            
            # Log relationship count and sample before storing
            relationship_count = sum(len(data.get('relationships', [])) for data in extracted_data)
            logging.info(f"Found {relationship_count} relationships to store")
            
            # Log samples of the first few relationships for debugging
            if relationship_count > 0:
                for data in extracted_data[:2]:  # Just check first two data items
                    for rel in data.get('relationships', [])[:3]:  # Log up to 3 relationships
                        logging.info(f"Sample relationship: {json.dumps(rel, indent=2)}")
            else:
                logging.warning("No relationships found in extracted data. Check the extraction prompt and output.")

            # Track relationship processing success
            successful_relationships = 0
            failed_relationships = 0
            
            # Log the unique types of relationships found
            relationship_types = set()
            for data in extracted_data:
                for rel in data.get('relationships', []):
                    if isinstance(rel, dict) and 'type' in rel:
                        relationship_types.add(rel['type'])
            
            if relationship_types:
                logging.info(f"Found these relationship types: {', '.join(sorted(relationship_types))}")
            
            # Store relationships after all entities exist
            for data_idx, data in enumerate(tqdm(extracted_data, desc="Storing relationships")):
                for rel_idx, rel in enumerate(data.get('relationships', [])):
                    try:
                        if isinstance(rel, str):
                            # Parse relationship format: [Entity1] --RELATIONSHIP_TYPE--> [Entity2]
                            rel_match = re.match(r'\[(.+?)\]\s*--(.+?)-->\s*\[(.+?)\]', rel)
                            if rel_match:
                                source = standardize_entity(rel_match.group(1))
                                rel_type = rel_match.group(2).strip()
                                target = standardize_entity(rel_match.group(3))
                                
                                # Extract context if available
                                context = ""
                                context_match = re.search(r'\(Context: (.+?)\)', rel)
                                if context_match:
                                    context = context_match.group(1).strip()
                                
                                # Create relationship data structure
                                rel_data = {
                                    'source': {'name': source, 'type': 'Entity'},
                                    'target': {'name': target, 'type': 'Entity'},
                                    'type': rel_type,
                                    'properties': {"context": context, "confidenceScore": 0.8}
                                }
                                
                                # Add relationship
                                session.execute_write(
                                    lambda tx: add_relationship_to_neo4j(tx, rel_data)
                                )
                                successful_relationships += 1
                                if successful_relationships % 10 == 0:  # Log every 10th relationship
                                    logging.info(f"Added relationship: {source} --{rel_type}--> {target}")
                            
                            # Try alternate format: SourceEntity(Type) -> [RELATIONSHIP_TYPE] TargetEntity(Type)
                            else:
                                rel_match = re.match(r'(.+?)\(\s*(.+?)\s*\)\s*->\s*\[(.+?)\]\s*(.+?)\(\s*(.+?)\s*\)', rel)
                                if rel_match:
                                    source_name = standardize_entity(rel_match.group(1).strip())
                                    source_type = rel_match.group(2).strip()
                                    rel_type = rel_match.group(3).strip()
                                    target_name = standardize_entity(rel_match.group(4).strip())
                                    target_type = rel_match.group(5).strip()
                                    
                                    # Extract properties if available
                                    properties = {"confidenceScore": 0.8}
                                    if "{" in rel and "}" in rel:
                                        props_text = re.search(r'\{(.+?)\}', rel)
                                        if props_text:
                                            props_str = props_text.group(1)
                                            try:
                                                # First try parsing as JSON
                                                properties = json.loads("{" + props_str + "}")
                                            except json.JSONDecodeError:
                                                # Fall back to simple key-value parsing
                                                for prop in props_str.split(","):
                                                    if ":" in prop:
                                                        key, value = prop.split(":", 1)
                                                        properties[key.strip()] = value.strip().strip('"\'')
                                    
                                    # Create relationship data structure
                                    rel_data = {
                                        'source': {'name': source_name, 'type': source_type},
                                        'target': {'name': target_name, 'type': target_type},
                                        'type': rel_type,
                                        'properties': properties
                                    }
                                    
                                    # Add relationship
                                    session.execute_write(
                                        lambda tx: add_relationship_to_neo4j(tx, rel_data)
                                    )
                                    successful_relationships += 1
                                    if successful_relationships % 10 == 0:  # Log every 10th relationship
                                        logging.info(f"Added relationship: {source_name} --{rel_type}--> {target_name}")
                                else:
                                    logging.warning(f"Could not parse relationship string: {rel}")
                                    failed_relationships += 1
                                    
                        elif isinstance(rel, dict) and 'source' in rel and 'target' in rel and 'type' in rel:
                            # Handle dictionary format relationship
                            # Validate source and target
                            if not isinstance(rel['source'], dict) or 'name' not in rel['source']:
                                logging.warning(f"Invalid source in relationship at index {data_idx}:{rel_idx}: {rel.get('source')}")
                                failed_relationships += 1
                                continue
                                
                            if not isinstance(rel['target'], dict) or 'name' not in rel['target']:
                                logging.warning(f"Invalid target in relationship at index {data_idx}:{rel_idx}: {rel.get('target')}")
                                failed_relationships += 1
                                continue
                                
                            source = rel['source']['name']
                            target = rel['target']['name']
                            rel_type = rel['type']
                            
                            # Skip if source or target is empty
                            if not source or not target:
                                logging.warning(f"Empty source or target in relationship: {source} -> {target}")
                                failed_relationships += 1
                                continue
                            
                            # Extract properties if available
                            rel_props = rel.get('properties', {})
                            if not isinstance(rel_props, dict):
                                logging.warning(f"Properties is not a dict: {rel_props}, setting to empty dict")
                                rel_props = {}
                                
                            if 'confidenceScore' not in rel_props:
                                rel_props['confidenceScore'] = 0.8
                            
                            # Create relationship data structure
                            rel_data = {
                                'source': {
                                    'name': source, 
                                    'type': rel['source'].get('type', 'Entity')
                                },
                                'target': {
                                    'name': target, 
                                    'type': rel['target'].get('type', 'Entity')
                                },
                                'type': rel_type,
                                'properties': rel_props
                            }
                            
                            try:
                                # Add relationship
                                session.execute_write(
                                    lambda tx: add_relationship_to_neo4j(tx, rel_data)
                                )
                                successful_relationships += 1
                                if successful_relationships % 10 == 0:  # Log every 10th relationship
                                    logging.info(f"Added relationship: {source} --{rel_type}--> {target}")
                            except Exception as e:
                                logging.error(f"Neo4j error adding relationship {source} --{rel_type}--> {target}: {str(e)}")
                                failed_relationships += 1
                        else:
                            logging.warning(f"Invalid relationship format at index {data_idx}:{rel_idx}: {rel}")
                            failed_relationships += 1
                    except Exception as e:
                        rel_description = rel.get('description', 'unknown') if isinstance(rel, dict) else rel
                        logging.error(f"Error storing relationship {rel_description}: {str(e)}")
                        logging.error(f"Relationship data: {json.dumps(rel)[:500]}")
                        failed_relationships += 1
            
            # Log relationship processing summary
            logging.info(f"Successfully stored {successful_relationships} relationships out of {relationship_count} found")
            logging.info(f"Failed to store {failed_relationships} relationships")
            if successful_relationships == 0 and relationship_count > 0:
                logging.warning("No relationships were successfully stored. Check formats and database constraints.")
                # Dump a sample of relationships that failed to help debugging
                sample_count = 0
                for data in extracted_data:
                    for rel in data.get('relationships', [])[:5]:  # Look at up to 5 per chunk
                        if sample_count >= 10:  # Maximum 10 samples
                            break
                        logging.warning(f"Sample failed relationship: {json.dumps(rel, indent=2)}")
                        sample_count += 1
            
            # Store comprehensive person profiles
            if comprehensive_profiles.get('persons'):
                logging.info(f"Storing {len(comprehensive_profiles['persons'])} person profiles")
                for person in tqdm(comprehensive_profiles['persons'], desc="Storing person profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"person": person}))
                    except Exception as e:
                        logging.error(f"Error storing person profile for {person.get('name')}: {str(e)}")
            
            # Store comprehensive location profiles
            if comprehensive_profiles.get('locations'):
                logging.info(f"Storing {len(comprehensive_profiles['locations'])} location profiles")
                for location in tqdm(comprehensive_profiles['locations'], desc="Storing location profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"location": location}))
                    except Exception as e:
                        logging.error(f"Error storing location profile for {location.get('name')}: {str(e)}")
                        
            # Store comprehensive concept profiles
            if comprehensive_profiles.get('concepts'):
                logging.info(f"Storing {len(comprehensive_profiles['concepts'])} concept profiles")
                for concept in tqdm(comprehensive_profiles['concepts'], desc="Storing concept profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"concept": concept}))
                    except Exception as e:
                        logging.error(f"Error storing concept profile for {concept.get('name')}: {str(e)}")
                        
            # Store comprehensive event profiles
            if comprehensive_profiles.get('events'):
                logging.info(f"Storing {len(comprehensive_profiles['events'])} event profiles")
                for event in tqdm(comprehensive_profiles['events'], desc="Storing event profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"event": event}))
                    except Exception as e:
                        logging.error(f"Error storing event profile for {event.get('name')}: {str(e)}")

            # Store propositions
            if comprehensive_profiles.get('propositions'):
                logging.info(f"Storing {len(comprehensive_profiles['propositions'])} proposition profiles")
                for proposition in tqdm(comprehensive_profiles['propositions'], desc="Storing proposition profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"proposition": proposition}))
                    except Exception as e:
                        logging.error(f"Error storing proposition profile for {proposition.get('name')}: {str(e)}")

            # Store attributes
            if comprehensive_profiles.get('attributes'):
                logging.info(f"Storing {len(comprehensive_profiles['attributes'])} attribute profiles")
                for attribute in tqdm(comprehensive_profiles['attributes'], desc="Storing attribute profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"attribute": attribute}))
                    except Exception as e:
                        logging.error(f"Error storing attribute profile for {attribute.get('name')}: {str(e)}")

            # Store emotions
            if comprehensive_profiles.get('emotions'):
                logging.info(f"Storing {len(comprehensive_profiles['emotions'])} emotion profiles")
                for emotion in tqdm(comprehensive_profiles['emotions'], desc="Storing emotion profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"emotion": emotion}))
                    except Exception as e:
                        logging.error(f"Error storing emotion profile for {emotion.get('name')}: {str(e)}")

            # Store agents
            if comprehensive_profiles.get('agents'):
                logging.info(f"Storing {len(comprehensive_profiles['agents'])} agent profiles")
                for agent in tqdm(comprehensive_profiles['agents'], desc="Storing agent profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"agent": agent}))
                    except Exception as e:
                        logging.error(f"Error storing agent profile for {agent.get('name')}: {str(e)}")

            # Store thoughts
            if comprehensive_profiles.get('thoughts'):
                logging.info(f"Storing {len(comprehensive_profiles['thoughts'])} thought profiles")
                for thought in tqdm(comprehensive_profiles['thoughts'], desc="Storing thought profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"thought": thought}))
                    except Exception as e:
                        logging.error(f"Error storing thought profile for {thought.get('name')}: {str(e)}")

            # Store scientific insights
            if comprehensive_profiles.get('scientificInsights'):
                logging.info(f"Storing {len(comprehensive_profiles['scientificInsights'])} scientific insight profiles")
                for insight in tqdm(comprehensive_profiles['scientificInsights'], desc="Storing scientific insight profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"scientificInsight": insight}))
                    except Exception as e:
                        logging.error(f"Error storing scientific insight profile for {insight.get('name')}: {str(e)}")

            # Store laws
            if comprehensive_profiles.get('laws'):
                logging.info(f"Storing {len(comprehensive_profiles['laws'])} law profiles")
                for law in tqdm(comprehensive_profiles['laws'], desc="Storing law profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"law": law}))
                    except Exception as e:
                        logging.error(f"Error storing law profile for {law.get('name')}: {str(e)}")

            # Store reasoning chains
            if comprehensive_profiles.get('reasoningChains'):
                logging.info(f"Storing {len(comprehensive_profiles['reasoningChains'])} reasoning chain profiles")
                for chain in tqdm(comprehensive_profiles['reasoningChains'], desc="Storing reasoning chain profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"reasoningChain": chain}))
                    except Exception as e:
                        logging.error(f"Error storing reasoning chain profile for {chain.get('name')}: {str(e)}")

            # Store reasoning steps
            if comprehensive_profiles.get('reasoningSteps'):
                logging.info(f"Storing {len(comprehensive_profiles['reasoningSteps'])} reasoning step profiles")
                for step in tqdm(comprehensive_profiles['reasoningSteps'], desc="Storing reasoning step profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"reasoningStep": step}))
                    except Exception as e:
                        logging.error(f"Error storing reasoning step profile for {step.get('name')}: {str(e)}")
        
        # Close connection at the end
        neo4j_conn.close()
        
        # Clean up temporary files
        cleanup_temp_files()
        
        logging.info("Knowledge graph processing complete")
        
    except Exception as e:
        logging.error(f"Error in main processing: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        raise

if __name__ == "__main__":
    asyncio.run(main()) 