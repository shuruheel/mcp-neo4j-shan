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
from kg_extraction import process_chunks
from kg_aggregation import EntityAggregator
from kg_utils import standardize_entity, cleanup_temp_files

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

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
        text_splitter = RecursiveCharacterTextSplitter(chunk_size=10000, chunk_overlap=500)
        chunks = text_splitter.split_documents(documents)
        logging.info(f"Split into {len(chunks)} chunks")
        
        # Check for existing checkpoint to resume processing
        if os.path.exists('checkpoint_latest.json'):
            with open('checkpoint_latest.json', 'r') as f:
                extracted_data = json.load(f)
                logging.info(f"Loaded {len(extracted_data)} previously extracted items from checkpoint")
        else:
            # Process chunks and extract knowledge
            extracted_data = await process_chunks(chunks, batch_size=5, checkpoint_frequency=5)
            
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
        relationship_count = len(aggregator.relationships)
        logging.info(f"Found {entity_count} entities, {person_count} persons, and {relationship_count} relationships to store")
        
        # Before starting Stage 3
        if entity_count == 0 and person_count == 0:
            logging.warning("No entities or persons were found to store in the database")
        
        # Generate comprehensive profiles
        comprehensive_model = ChatOpenAI(model_name="gpt-4o", temperature=0.2)
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
            
            # Process entities first
            for data in tqdm(extracted_data, desc="Storing base entities"):
                # Store entities
                for entity in data.get('entities', []):
                    entity_parts = entity.split('[Type:', 1)
                    if len(entity_parts) == 2:
                        entity_name = standardize_entity(entity_parts[0].strip())
                        entity_type = entity_parts[1].strip().rstrip(']')
                        
                        # Skip if already processed
                        if entity_name in stored_entities:
                            continue
                        
                        # Basic entity data
                        entity_data = {
                            "name": entity_name,
                            "nodeType": "Entity",
                            "subType": entity_type
                        }
                        
                        # Store entity
                        try:
                            result = session.execute_write(lambda tx: add_to_neo4j(tx, {"entity": entity_data}))
                            if result:
                                stored_entities.add(entity_name)
                                logging.info(f"Stored entity: {entity_name}")
                        except Exception as e:
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
                        concept_parts = concept.split(':', 1)
                        if len(concept_parts) == 2:
                            concept_name = standardize_entity(concept_parts[1].strip().split(' - ')[0])
                            concept_data = {
                                "name": concept_name,
                                "definition": concept.split(' - ', 1)[1] if ' - ' in concept else ""
                            }
                            session.execute_write(lambda tx: add_to_neo4j(tx, {"concept": concept_data}))
                    except Exception as e:
                        logging.error(f"Error storing concept: {str(e)}")
            
            # Store relationships after all entities exist
            for data in tqdm(extracted_data, desc="Storing relationships"):
                for rel in data.get('relationships', []):
                    try:
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
                            
                            # Add relationship
                            rel_props = {"context": context, "confidenceScore": 0.8}
                            session.execute_write(
                                lambda tx: add_relationship_to_neo4j(tx, source, rel_type, target, rel_props)
                            )
                    except Exception as e:
                        logging.error(f"Error storing relationship {rel}: {str(e)}")
            
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