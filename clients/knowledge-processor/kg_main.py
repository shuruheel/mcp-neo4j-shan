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

from kg_db import Neo4jConnection, setup_neo4j_constraints, add_to_neo4j, add_relationship_to_neo4j, process_relationships
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
        # Check for command-line flags
        diagnostic_mode = "--diagnostic" in sys.argv
        skip_extraction = "-skip-extraction" in sys.argv or "--skip-extraction" in sys.argv
        skip_generation = "-skip-generation" in sys.argv or "--skip-generation" in sys.argv
        
        # If skip-generation is specified, also skip extraction
        if skip_generation:
            skip_extraction = True
        
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
        
        # Stage 1: Extract knowledge from data
        logging.info("Stage 1: Starting knowledge extraction")
        
        # Skip extraction if requested
        if skip_extraction:
            logging.info("Skipping extraction and using existing extracted_data.json file")
            if not os.path.exists('extracted_data.json'):
                raise FileNotFoundError("extracted_data.json file not found. Cannot skip extraction.")
            
            with open('extracted_data.json', 'r') as f:
                extracted_data = json.load(f)
            logging.info(f"Loaded {len(extracted_data)} previously extracted items")
        else:
            # Normal extraction flow
            # Load text files from the data directory
            logging.info("Loading document files from data directory")
            loader = DirectoryLoader(
                "./data", 
                glob="**/*.txt", 
                loader_cls=TextLoader,
                show_progress=True
            )
            documents = loader.load()
            logging.info(f"Loaded {len(documents)} documents")
            
            # Split documents into chunks
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=10000,
                chunk_overlap=1000,
                length_function=len,
                is_separator_regex=False,
            )
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
        
        # Skip profile generation if requested
        if skip_generation:
            logging.info("Skipping profile generation and using existing comprehensive_profiles.json file")
            if not os.path.exists('comprehensive_profiles.json'):
                raise FileNotFoundError("comprehensive_profiles.json file not found. Cannot skip profile generation.")
            
            with open('comprehensive_profiles.json', 'r') as f:
                comprehensive_profiles = json.load(f)
            logging.info(f"Loaded comprehensive profiles from file")
        else:
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
            # First, store all nodes before any relationships
            # Store persons
            if comprehensive_profiles.get('persons'):
                logging.info(f"Storing {len(comprehensive_profiles['persons'])} person profiles")
                for person in tqdm(comprehensive_profiles['persons'], desc="Storing person profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"person": person}))
                    except Exception as e:
                        logging.error(f"Error storing person profile for {person.get('name')}: {str(e)}")

            # Store locations
            if comprehensive_profiles.get('locations'):
                logging.info(f"Storing {len(comprehensive_profiles['locations'])} location profiles")
                for location in tqdm(comprehensive_profiles['locations'], desc="Storing location profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"location": location}))
                    except Exception as e:
                        logging.error(f"Error storing location profile for {location.get('name')}: {str(e)}")

            # Store concepts
            if comprehensive_profiles.get('concepts'):
                logging.info(f"Storing {len(comprehensive_profiles['concepts'])} concept profiles")
                for concept in tqdm(comprehensive_profiles['concepts'], desc="Storing concept profiles"):
                    try:
                        session.execute_write(lambda tx: add_to_neo4j(tx, {"concept": concept}))
                    except Exception as e:
                        logging.error(f"Error storing concept profile for {concept.get('name')}: {str(e)}")

            # Store events
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
            
            # AFTER all nodes are created, now process relationships from the extraction data
            successful_relationships = 0
            failed_relationships = 0
            
            # First, explicitly create PART_OF_CHAIN relationships between ReasoningSteps and ReasoningChains
            logging.info("Creating relationships between ReasoningSteps and ReasoningChains")
            if comprehensive_profiles.get('reasoningSteps'):
                chain_step_relations = 0
                for step in tqdm(comprehensive_profiles['reasoningSteps'], desc="Creating step-chain relationships"):
                    if 'chain' in step or 'chainName' in step:
                        chain_name = step.get('chain', '') or step.get('chainName', '')
                        if chain_name:
                            try:
                                # Create PART_OF_CHAIN relationship
                                session.execute_write(
                                    lambda tx: add_relationship_to_neo4j(
                                        tx, 
                                        {
                                            'source': {'name': step['name'], 'type': 'ReasoningStep'},
                                            'target': {'name': chain_name, 'type': 'ReasoningChain'},
                                            'type': 'PART_OF_CHAIN',
                                            'properties': {'confidenceScore': 0.9}
                                        }
                                    )
                                )
                                
                                # Also create CONTAINS relationship (in the opposite direction)
                                session.execute_write(
                                    lambda tx: add_relationship_to_neo4j(
                                        tx, 
                                        {
                                            'source': {'name': chain_name, 'type': 'ReasoningChain'},
                                            'target': {'name': step['name'], 'type': 'ReasoningStep'},
                                            'type': 'CONTAINS',
                                            'properties': {'confidenceScore': 0.9}
                                        }
                                    )
                                )
                                chain_step_relations += 1
                            except Exception as e:
                                logging.error(f"Error creating step-chain relationship for {step['name']}: {str(e)}")
                
                logging.info(f"Created {chain_step_relations} relationships between steps and chains")
            
            # Now process other relationships from extraction data
            # Extract all distinct relationship types for logging
            relationship_types = set()
            for data in extracted_data:
                for rel in data.get('relationships', []):
                    if isinstance(rel, dict) and 'type' in rel:
                        relationship_types.add(rel['type'])
            
            if relationship_types:
                logging.info(f"Found these relationship types: {', '.join(sorted(relationship_types))}")
            
            # Now store relationships AFTER all nodes exist
            logging.info("Now processing relationships after all nodes have been created")
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
            total_processed = successful_relationships + failed_relationships
            if total_processed > 0:
                success_percentage = (successful_relationships / total_processed) * 100
                logging.info(f"Successfully stored {successful_relationships} out of {total_processed} relationships ({success_percentage:.1f}%)")
            else:
                logging.warning("No relationships were successfully stored. Check formats and database constraints.")

            # Process comprehensive profile relationships (if any)
            if comprehensive_profiles and 'relationships' in comprehensive_profiles:
                logging.info(f"Processing {len(comprehensive_profiles['relationships'])} relationships from comprehensive profiles")
                process_relationships(session, comprehensive_profiles['relationships'])
        
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
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.warning("Process interrupted. The latest checkpoint will be available for resuming.")
        print("\nProcess terminated. You can resume from the latest checkpoint next time you run the script.")
    except Exception as e:
        logging.error(f"Unhandled exception: {str(e)}")
        import traceback
        logging.error(traceback.format_exc())
        sys.exit(1) 