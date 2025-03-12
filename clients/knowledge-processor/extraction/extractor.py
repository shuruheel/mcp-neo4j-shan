"""Main extraction module for knowledge graph processing."""

import logging
import json
import asyncio
import time
import re
from typing import Dict, List, Any, Optional, Union
from tqdm import tqdm
from langchain_openai import ChatOpenAI

from .node_extractors import (
    EntityExtractor, EventExtractor, ConceptExtractor, AttributeExtractor,
    PropositionExtractor, EmotionExtractor, AgentExtractor, ThoughtExtractor,
    ScientificInsightExtractor, LawExtractor, ReasoningChainExtractor, 
    ReasoningStepExtractor, LocationExtractor
)
from .relationship_extractor import RelationshipExtractor
from kg_schema import NODE_TYPES, EXTRACTION_PROMPT_TEMPLATE

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class KnowledgeExtractor:
    """Main class for extracting knowledge from text chunks."""
    
    def __init__(self, model_name: str = "gpt-4o", temperature: float = 0.0, advanced_model_name: str = "gpt-4.5-preview-2025-02-27"):
        """Initialize the knowledge extractor with specified LLM.
        
        Args:
            model_name: Name of the language model to use for general extraction
            temperature: Temperature setting for the language model
            advanced_model_name: Name of the advanced model for person observations
        """
        # Initialize the primary model for general extraction
        self.model = ChatOpenAI(
            model_name=model_name, 
            temperature=temperature,
            model_kwargs={
                "response_format": {"type": "json_object"}
            }
        )
        
        # Initialize a more advanced model specifically for person observations
        # This captures psychological, social, and emotional traits better
        self.advanced_model = ChatOpenAI(
            model_name=advanced_model_name,  # Using the specified advanced model
            temperature=temperature,
            model_kwargs={
                "response_format": {"type": "json_object"}
            }
        )
        
        # Initialize all node type extractors with the primary model
        self.extractors = {
            "Entity": EntityExtractor(self.model),
            "Event": EventExtractor(self.model),
            "Concept": ConceptExtractor(self.model),
            "Attribute": AttributeExtractor(self.model),
            "Proposition": PropositionExtractor(self.model),
            "Emotion": EmotionExtractor(self.model),
            "Agent": AgentExtractor(self.model),
            "Thought": ThoughtExtractor(self.model),
            "ScientificInsight": ScientificInsightExtractor(self.model),
            "Law": LawExtractor(self.model),
            "ReasoningChain": ReasoningChainExtractor(self.model),
            "ReasoningStep": ReasoningStepExtractor(self.model),
            "Location": LocationExtractor(self.model)
        }
        
        # Initialize relationship extractor with the primary model
        self.relationship_extractor = RelationshipExtractor(self.model)
    
    async def extract_from_chunk(self, text_chunk) -> Dict[str, List[Any]]:
        """Extract knowledge elements from a text chunk using the group-based approach."""
        # Extract text from the chunk
        text = text_chunk.page_content if hasattr(text_chunk, 'page_content') else text_chunk
        
        # Log chunk size
        text_length = len(text)
        logging.info(f"Processing text chunk of {text_length} characters")
        
        # Initialize results with empty lists
        result = {
            "entities": [], "events": [], "concepts": [], "attributes": [],
            "propositions": [], "emotions": [], "agents": [], "thoughts": [],
            "scientificInsights": [], "laws": [], "reasoningChains": [],
            "reasoningSteps": [], "locations": [], "relationships": [],
            "personObservations": {}
        }
        
        try:
            # Run Group 1 and Group 2 extractions in parallel
            logging.info("Starting parallel extraction of Group 1 and Group 2")
            group1_task = self._extract_group1(text)
            group2_task = self._extract_group2(text)
            group1_result, group2_result = await asyncio.gather(group1_task, group2_task)
            
            # Merge group results
            for key, items in group1_result.items():
                result[key] = items
                
            for key, items in group2_result.items():
                result[key] = items
            
            # Post-process entities to normalize person names
            result["entities"] = self._normalize_person_names(result["entities"])
            
            # Extract relationships WITH NODE CONTEXT
            result["relationships"] = await self._extract_relationships_with_context(text, result)
            
            # Find person entities for observations
            person_entities = [e for e in result["entities"] if isinstance(e, dict) and e.get("subType") == "Person"]
            
            # Extract person observations
            if person_entities:
                person_names = [e.get("name") for e in person_entities if e.get("name")]
                if person_names:
                    logging.info(f"Starting extraction of observations for {len(person_names)} persons using advanced model (gpt-4.5-preview-2025-02-27)")
                    person_observations = await self._extract_person_observations(text, person_names)
                    
                    # Store person observations in the result
                    if person_observations:
                        result["personObservations"] = person_observations
                        logging.info(f"Person observations extraction complete for {len(person_observations)} persons")
            
            # Extract location details if location entities are found
            location_entities = [e for e in result["entities"] if isinstance(e, dict) and e.get("subType") == "Location"]
            if location_entities:
                logging.info(f"Starting extraction of details for {len(location_entities)} locations")
                location_details = await self._extract_location_details(location_entities)
                
                # Store location details in the result
                if location_details:
                    result["locationDetails"] = location_details
                    logging.info(f"Location details extraction complete for {len(location_details)} locations")
            
            # Log final extraction summary
            total_nodes = sum(len(result[key]) for key in ["entities", "events", "concepts", "attributes", 
                                                        "propositions", "emotions", "thoughts", 
                                                        "scientificInsights", "laws", "reasoningChains", 
                                                        "reasoningSteps", "locations"])
            logging.info(f"Extraction complete: {total_nodes} nodes and {len(result['relationships'])} relationships extracted")
        
        except Exception as e:
            logging.error(f"Error in extract_from_chunk: {str(e)}")
            
        return result
    
    async def _extract_group1(self, text: str) -> Dict[str, List[Any]]:
        """Extract Group 1 knowledge elements: Entities, Attributes, Events, Emotions."""
        # Build the combined template for Group 1
        templates = {
            "entities": self.extractors["Entity"]._get_template(),
            "attributes": self.extractors["Attribute"]._get_template(),
            "events": self.extractors["Event"]._get_template(),
            "emotions": self.extractors["Emotion"]._get_template(),
            "locations": self.extractors["Location"]._get_template()
        }
        
        # Create the prompt
        prompt = f"""
        Analyze the following text and extract these types of information:
        1. Entities (people, organizations, locations, artifacts, etc.)
        2. Attributes (properties or characteristics)
        3. Events (occurrences, happenings, actions)
        4. Emotions (feelings, emotional states)
        5. Locations (physical places, areas, regions)
        
        For each type, use the corresponding JSON template.
        
        IMPORTANT INSTRUCTION FOR PERSON ENTITIES:
        When extracting people, ALWAYS use their full name (first and last name) if available in the text.
        Never use only last names like "Adenauer" - always use complete names like "Konrad Adenauer".
        If the text only mentions a last name but you know or can infer the full name, use the complete name.
        
        Text:
        {text}
        
        Entity Template:
        {templates["entities"]}
        
        Attribute Template:
        {templates["attributes"]}
        
        Event Template:
        {templates["events"]}
        
        Emotion Template:
        {templates["emotions"]}
        
        Location Template:
        {templates["locations"]}
        
        Instructions:
        1. Extract ALL instances of each type found in the text.
        2. Follow the templates exactly.
        3. Return your response as a JSON object with these keys: "entities", "attributes", "events", "emotions", "locations".
        4. Each key should contain an array of objects following the corresponding template.
        5. If none of a particular type is found, return an empty array for that key.
        """
        
        try:
            # Get response from the model
            response = await self.model.ainvoke(prompt)
            content = response.content
            
            # Parse the JSON response
            try:
                result = json.loads(content)
                
                # Ensure all required keys are present
                for key in ["entities", "attributes", "events", "emotions", "locations"]:
                    if key not in result:
                        result[key] = []
                
                # Initialize empty agents list (since we're skipping extraction for agents)
                result["agents"] = []
                
                # Log extraction results
                logging.info(f"Group 1 extraction complete: "
                            f"{len(result.get('entities', []))} entities, "
                            f"{len(result.get('attributes', []))} attributes, "
                            f"{len(result.get('events', []))} events, "
                            f"{len(result.get('emotions', []))} emotions, "
                            f"{len(result.get('locations', []))} locations extracted")
                
                return result
            except json.JSONDecodeError as e:
                logging.error(f"Error parsing Group 1 extraction response: {str(e)}")
                return {"entities": [], "attributes": [], "events": [], "emotions": [], "locations": [], "agents": []}
        except Exception as e:
            logging.error(f"Error during Group 1 extraction: {str(e)}")
            return {"entities": [], "attributes": [], "events": [], "emotions": [], "locations": [], "agents": []}
    
    async def _extract_group2(self, text: str) -> Dict[str, List[Any]]:
        """Extract Group 2 knowledge elements: Concepts, Propositions, Reasoning Chains, Reasoning Steps."""
        # Build the combined template for Group 2
        templates = {
            "concepts": self.extractors["Concept"]._get_template(),
            "propositions": self.extractors["Proposition"]._get_template(),
            "reasoningChains": self.extractors["ReasoningChain"]._get_template(),
            "reasoningSteps": self.extractors["ReasoningStep"]._get_template(),
            "thoughts": self.extractors["Thought"]._get_template(),
            "scientificInsights": self.extractors["ScientificInsight"]._get_template(),
            "laws": self.extractors["Law"]._get_template()
        }
        
        # Create the prompt
        prompt = f"""
        Analyze the following text and extract these types of information:
        1. Concepts (abstract ideas, mental constructs)
        2. Propositions (statements, claims, assertions)
        3. Reasoning Chains (logical sequences of reasoning)
        4. Reasoning Steps (individual components of reasoning)
        5. Thoughts (mental processes, cognitive activities)
        6. Scientific Insights (discoveries, findings, principles)
        7. Laws (principles, rules, guidelines)
        
        For each type, use the corresponding JSON template.
        
        Text:
        {text}
        
        Concept Template:
        {templates["concepts"]}
        
        Proposition Template:
        {templates["propositions"]}
        
        Reasoning Chain Template:
        {templates["reasoningChains"]}
        
        Reasoning Step Template:
        {templates["reasoningSteps"]}
        
        Thought Template:
        {templates["thoughts"]}
        
        Scientific Insight Template:
        {templates["scientificInsights"]}
        
        Law Template:
        {templates["laws"]}
        
        Instructions:
        1. Extract ALL instances of each type found in the text.
        2. Follow the templates exactly.
        3. Return your response as a JSON object with these keys: "concepts", "propositions", "reasoningChains", "reasoningSteps", "thoughts", "scientificInsights", "laws".
        4. Each key should contain an array of objects following the corresponding template.
        5. If none of a particular type is found, return an empty array for that key.
        6. IMPORTANT: Connect reasoning steps to their parent chains by setting the chainName field.
        """
        
        try:
            # Get response from the model
            response = await self.model.ainvoke(prompt)
            content = response.content
            
            # Parse the JSON response
            try:
                result = json.loads(content)
                
                # Ensure all required keys are present
                for key in ["concepts", "propositions", "reasoningChains", "reasoningSteps", "thoughts", "scientificInsights", "laws"]:
                    if key not in result:
                        result[key] = []
                
                # Log extraction results
                logging.info(f"Group 2 extraction complete: "
                            f"{len(result.get('concepts', []))} concepts, "
                            f"{len(result.get('propositions', []))} propositions, "
                            f"{len(result.get('reasoningChains', []))} reasoning chains, "
                            f"{len(result.get('reasoningSteps', []))} reasoning steps, "
                            f"{len(result.get('thoughts', []))} thoughts, "
                            f"{len(result.get('scientificInsights', []))} scientific insights, "
                            f"{len(result.get('laws', []))} laws extracted")
                
                return result
            except json.JSONDecodeError as e:
                logging.error(f"Error parsing Group 2 extraction response: {str(e)}")
                return {"concepts": [], "propositions": [], "reasoningChains": [], "reasoningSteps": [], "thoughts": [], "scientificInsights": [], "laws": []}
        except Exception as e:
            logging.error(f"Error during Group 2 extraction: {str(e)}")
            return {"concepts": [], "propositions": [], "reasoningChains": [], "reasoningSteps": [], "thoughts": [], "scientificInsights": [], "laws": []}
    
    async def _extract_node_type(self, extractor, text: str, result_key: str) -> List[Dict[str, Any]]:
        """Extract nodes of a specific type from the text."""
        try:
            return await extractor.extract(text)
        except Exception as e:
            logging.error(f"Error extracting {result_key}: {str(e)}")
            return []
    
    async def _extract_location_details(self, locations: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
        """Extract detailed location information."""
        location_details = {}
        for location in locations:
            location_name = location.get("name")
            if location_name:
                try:
                    details = await self.extractors["Location"].extract_location_details(location_name, location)
                    if details:
                        location_details[location_name] = details
                except Exception as e:
                    logging.error(f"Error extracting location details for {location_name}: {str(e)}")
        return location_details

    async def _extract_person_observations(self, text: str, person_names: List[str]) -> Dict[str, List[Dict[str, Any]]]:
        """Extract psychological observations for person entities from text.
        
        Uses the advanced model for better psychological, social and 
        emotional trait detection.
        
        Args:
            text: The text to analyze
            person_names: List of person names to extract observations for
            
        Returns:
            Dictionary mapping person names to their observations
        """
        try:
            # Get the person extractor but use our advanced model for the extraction
            person_extractor = EntityExtractor(self.advanced_model)
            
            # Log which model we're using
            logging.info(f"Using advanced model ({self.advanced_model.model_name}) for person observations extraction")
            
            # Use the entity extractor's method but with our advanced model
            result = await person_extractor.extract_person_observations(text, person_names)
            
            # Check if we got valid results
            if not result or not isinstance(result, dict):
                logging.warning(f"Advanced model returned invalid person observations: {result}")
                return {}
            
            # Log counts of observations for each person
            for person, observations in result.items():
                if observations and isinstance(observations, list):
                    logging.info(f"  - {person}: {len(observations)} observations")
            
            return result
        except Exception as e:
            logging.error(f"Error extracting person observations with advanced model: {str(e)}")
            return {}

    async def _extract_relationships_with_context(self, text: str, extracted_nodes: Dict[str, List[Any]]) -> List[Dict[str, Any]]:
        """Extract relationships with context of the extracted nodes.
        
        Args:
            text: The original text
            extracted_nodes: Dictionary containing all extracted nodes by type
            
        Returns:
            List of extracted relationships
        """
        # Create lists of nodes by type, filtering out empty/invalid nodes
        entities = [e for e in extracted_nodes.get("entities", []) if isinstance(e, dict) and "name" in e]
        concepts = [c for c in extracted_nodes.get("concepts", []) if isinstance(c, dict) and "name" in c]
        events = [e for e in extracted_nodes.get("events", []) if isinstance(e, dict) and "name" in e]
        locations = [l for l in extracted_nodes.get("locations", []) if isinstance(l, dict) and "name" in l]
        props = [p for p in extracted_nodes.get("propositions", []) if isinstance(p, dict) and "name" in p]
        thoughts = [t for t in extracted_nodes.get("thoughts", []) if isinstance(t, dict) and "name" in t]
        reasoning_chains = [r for r in extracted_nodes.get("reasoningChains", []) if isinstance(r, dict) and "name" in r]
        reasoning_steps = [s for s in extracted_nodes.get("reasoningSteps", []) if isinstance(s, dict) and "name" in s]  # Added reasoning steps
        
        # Skip if too few nodes to form relationships
        if len(entities) + len(concepts) + len(events) + len(locations) + len(props) + len(reasoning_chains) + len(reasoning_steps) < 2:
            logging.info("Too few nodes extracted to form meaningful relationships")
            return []
        
        # Prepare simplified node lists for the prompt (just names and types to keep prompt size manageable)
        simplified_nodes = {
            "entities": [{"name": e.get("name"), "subType": e.get("subType", "General")} for e in entities],
            "concepts": [{"name": c.get("name")} for c in concepts],
            "events": [{"name": e.get("name")} for e in events],
            "locations": [{"name": l.get("name")} for l in locations],
            "propositions": [{"name": p.get("name")} for p in props],
            "thoughts": [{"name": t.get("name")} for t in thoughts],
            "reasoningChains": [{"name": r.get("name")} for r in reasoning_chains],
            "reasoningSteps": [{"name": s.get("name")} for s in reasoning_steps]  # Added reasoning steps
        }
        
        # Get relationship template from the relationship extractor
        relationship_template = self.relationship_extractor._get_template()
        
        # Count total available nodes
        total_node_count = sum(len(nodes) for nodes in simplified_nodes.values())
        logging.info(f"Starting relationship extraction with {total_node_count} available nodes")
        
        try:
            # Create a more concise prompt for relationship extraction
            prompt = f"""
            Extract relationships ONLY between these extracted nodes based on the text context.

            {{
              "task": "Extract relationships between nodes",
              "nodes": {json.dumps(simplified_nodes, indent=2)}
            }}

            Text context:
            {text}

            RELATIONSHIP TYPES:
            - IS_A, INSTANCE_OF: Entity to Concept
            - HAS_PART, PART_OF: Part-whole relationships
            - LOCATED_IN, OCCURRED_AT: Spatial relationships
            - BEFORE, AFTER, DURING: Temporal ordering
            - CAUSES, INFLUENCED_BY: Causal relationships
            - HAS_PROPERTY: Entity to Attribute connections
            - BELIEVES, VALUES: Person relationships to concepts/propositions
            - RELATED_TO, ASSOCIATED_WITH: General connections
            - PART_OF_CHAIN: ReasoningStep to ReasoningChain
            - SUPPORTS, CONTRADICTS: ReasoningStep to Proposition/Concept
            - REFERENCES: ReasoningStep to Entity/Event
            - NEXT, PREVIOUS: Sequential ReasoningSteps

            INSTRUCTIONS:
            1. Only create relationships between the exact nodes listed above
            2. Extract all meaningful relationships supported by the text, prioritizing high-confidence relationships (confidence > 0.7)
            3. For each relationship, include a confidence score (0.0-1.0) based on how clearly it's supported by the text
            4. Return your response as a JSON object with a "relationships" array
            5. Each relationship must include source, target, type, and properties

            RESPONSE FORMAT:
            {{
              "relationships": [
                {relationship_template}
              ]
            }}
            """
            
            try:
                # Call the LLM with added max_tokens constraint and reduced temperature
                logging.debug("Calling LLM for relationship extraction")
                start_time = time.time()
                
                # Create a model specifically for relationship extraction with limits to prevent timeouts
                rel_model = ChatOpenAI(
                    model_name=self.model.model_name,
                    temperature=0.0,  # Use lower temperature for more deterministic output
                    max_tokens=10000,  # Increased from 1000 to allow for more relationships
                    timeout=300,      # Increased from 120 to 180 seconds (3 minutes)
                    model_kwargs={
                        "response_format": {"type": "json_object"}
                    }
                )
                
                response = await rel_model.ainvoke(prompt)

                # Process the response
                content = response.content
                elapsed = time.time() - start_time
                logging.debug(f"LLM response received in {elapsed:.2f} seconds")
                
                try:
                    # Parse the JSON response
                    result = json.loads(content)
                    relationships = result.get("relationships", [])
                    
                    logging.info(f"Extracted {len(relationships)} relationships in {elapsed:.2f} seconds")
                    return relationships
                except json.JSONDecodeError as e:
                    logging.error(f"Error parsing relationship extraction response: {str(e)}")
                    return []
            except Exception as e:
                logging.error(f"Error during relationship LLM call: {str(e)}")
                return []
        except Exception as e:
            logging.error(f"Error in relationship extraction: {str(e)}")
            return []

    def _normalize_person_names(self, entities: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Normalize person entity names to ensure full names are used consistently.
        
        This helps with cases where the same person appears as both "Last Name" and "First Last".
        
        Args:
            entities: List of entity dictionaries
            
        Returns:
            List of normalized entity dictionaries
        """
        # First, build a map of last names to full names
        last_name_to_full_name = {}
        
        # Find all Person entities with full names
        for entity in entities:
            if entity.get("subType") == "Person":
                name = entity.get("name", "")
                name_parts = name.split()
                
                # If it has at least two parts (first name and last name)
                if len(name_parts) >= 2:
                    # Add the last name -> full name mapping
                    last_name = name_parts[-1]
                    last_name_to_full_name[last_name] = name
        
        # Now normalize entities with just last names
        normalized_entities = []
        for entity in entities:
            # Process only Person entities
            if entity.get("subType") == "Person":
                name = entity.get("name", "")
                name_parts = name.split()
                
                # If it's just a single word name (likely just last name)
                if len(name_parts) == 1 and name_parts[0] in last_name_to_full_name:
                    # Update to full name
                    full_name = last_name_to_full_name[name_parts[0]]
                    
                    # Log the normalization
                    logging.info(f"Normalizing Person entity: {name} -> {full_name}")
                    
                    # Add a note about the normalization
                    if "observations" not in entity or not isinstance(entity["observations"], list):
                        entity["observations"] = []
                    entity["observations"].append(f"Originally referred to as '{name}' in the text")
                    
                    # Update the name
                    entity["name"] = full_name
                    
                normalized_entities.append(entity)
            else:
                # Keep non-Person entities as is
                normalized_entities.append(entity)
        
        return normalized_entities

async def process_chunks(chunks, batch_size=5, checkpoint_frequency=5, model_name="gpt-4o", temperature=0.0, advanced_model_name="gpt-4.5-preview-2025-02-27"):
    """Process text chunks in batches with checkpointing.
    
    Args:
        chunks: List of text chunks to process
        batch_size: Number of chunks to process in parallel
        checkpoint_frequency: How often to save checkpoints (in batches)
        model_name: Name of the language model to use for general extraction
        temperature: Temperature setting for the language model
        advanced_model_name: Name of the advanced model to use for person observations
        
    Returns:
        List of extraction results
    """
    logging.info(f"Initializing knowledge processor with tiered model approach:")
    logging.info(f"  - Primary model for general extraction: {model_name}")
    logging.info(f"  - Advanced model for psychological observations: {advanced_model_name}")
    logging.info("Using optimized group-based extraction approach")
    
    # Setup signal handlers to save checkpoint on termination
    import signal
    import os
    
    # Store results in a container that can be accessed by the signal handler
    result_container = {"results": []}
    
    # Define signal handler function
    def signal_handler(sig, frame):
        logging.warning(f"Received termination signal ({sig}). Saving checkpoint before exiting...")
        try:
            checkpoint_file = 'checkpoint_latest.json'
            with open(checkpoint_file, 'w') as f:
                json.dump(result_container["results"], f)
            logging.info(f"Saved emergency checkpoint with {len(result_container['results'])} processed chunks")
        except Exception as e:
            logging.error(f"Failed to save emergency checkpoint: {str(e)}")
        finally:
            # Exit with non-zero code to indicate abnormal termination
            os._exit(1)
    
    # Register signal handlers for common termination signals
    signal.signal(signal.SIGINT, signal_handler)  # Handle Ctrl+C
    signal.signal(signal.SIGTERM, signal_handler)  # Handle termination request
    
    extractor = KnowledgeExtractor(model_name=model_name, temperature=temperature, advanced_model_name=advanced_model_name)
    results = result_container["results"]  # Use the container's results list
    total_chunks = len(chunks)
    
    # Set a timeout for individual extract tasks
    task_timeout = 300  # 3 minutes (increased from 5 minutes to reflect the more efficient relationship extraction)
    
    for i in tqdm(range(0, total_chunks, batch_size), desc="Processing batches"):
        batch = chunks[i:i+batch_size]
        try:
            # Create tasks with timeout protection for each chunk
            batch_tasks = []
            for chunk in batch:
                task = asyncio.create_task(asyncio.wait_for(extractor.extract_from_chunk(chunk), timeout=task_timeout))
                batch_tasks.append(task)
            
            # Process all tasks in parallel with asyncio.gather
            # gather() will wait for all tasks to complete
            # return_exceptions=True makes gather() return exceptions rather than raising them
            logging.info(f"Processing batch {i//batch_size + 1}/{(total_chunks + batch_size - 1)//batch_size} with {len(batch_tasks)} chunks in parallel")
            batch_results_or_exceptions = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            # Process results and handle exceptions
            batch_results = []
            for j, result_or_exception in enumerate(batch_results_or_exceptions):
                chunk_index = i + j
                if isinstance(result_or_exception, Exception):
                    # Handle exception for this chunk
                    if isinstance(result_or_exception, asyncio.TimeoutError):
                        logging.error(f"Task for chunk {chunk_index} timed out after {task_timeout} seconds")
                    else:
                        logging.error(f"Error processing chunk {chunk_index}: {str(result_or_exception)}")
                    
                    # Add empty result for failed chunk
                    batch_results.append({
                        "entities": [], "events": [], "concepts": [], "attributes": [],
                        "propositions": [], "emotions": [], "agents": [], "thoughts": [],
                        "scientificInsights": [], "laws": [], "reasoningChains": [],
                        "reasoningSteps": [], "locations": [], "relationships": [],
                        "personDetails": {}, "locationDetails": {}, "personObservations": {}
                    })
                else:
                    # Successfully processed chunk
                    batch_results.append(result_or_exception)
            
            results.extend(batch_results)
            
            # Calculate and log batch statistics
            batch_nodes = sum(sum(len(res.get(k, [])) for k in ["entities", "events", "concepts", "attributes", 
                                                         "propositions", "emotions", "agents", "thoughts", 
                                                         "scientificInsights", "laws", "reasoningChains", 
                                                         "reasoningSteps", "locations"]) for res in batch_results)
            batch_relationships = sum(len(res.get("relationships", [])) for res in batch_results)
            
            # Log batch processing details
            logging.info(f"Processed batch {i//batch_size + 1}/{(total_chunks + batch_size - 1)//batch_size}: "
                         f"{len(batch)} chunks, {batch_nodes} nodes, {batch_relationships} relationships")
            
            # Save checkpoint after each batch, not just at checkpoint_frequency intervals
            # This ensures we always have the most recent data
            try:
                checkpoint_file = f'checkpoint_latest.json'
                with open(checkpoint_file, 'w') as f:
                    json.dump(results, f)
                logging.info(f"Saved checkpoint after batch {i//batch_size + 1}")
                
                # Also save numbered checkpoint at regular intervals
                if (i + batch_size) % (batch_size * checkpoint_frequency) == 0 or (i + batch_size) >= total_chunks:
                    numbered_checkpoint = f'checkpoint_{i//batch_size + 1}.json'
                    with open(numbered_checkpoint, 'w') as f:
                        json.dump(results, f)
                    logging.info(f"Saved numbered checkpoint: {numbered_checkpoint}")
            except Exception as e:
                logging.warning(f"Failed to save checkpoint: {str(e)}")
        except Exception as e:
            logging.error(f"Error processing batch starting at index {i}: {str(e)}")
            logging.error(f"Details: {type(e).__name__}")
            import traceback
            logging.error(traceback.format_exc())
            
            # Try to save checkpoint even when batch fails
            try:
                checkpoint_file = f'checkpoint_latest.json'
                with open(checkpoint_file, 'w') as f:
                    json.dump(results, f)
                logging.info(f"Saved checkpoint after batch error at index {i}")
            except Exception as checkpoint_err:
                logging.error(f"Failed to save checkpoint after batch error: {str(checkpoint_err)}")
                
            # Continue with next batch instead of failing the entire process
            continue
    
    # Save final results
    try:
        with open('extraction_results.json', 'w') as f:
            json.dump(results, f)
        logging.info("Saved final extraction results")
    except Exception as e:
        logging.error(f"Failed to save final results: {str(e)}")
    
    # Calculate overall statistics
    total_nodes = sum(sum(len(res.get(k, [])) for k in ["entities", "events", "concepts", "attributes", 
                                                   "propositions", "emotions", "agents", "thoughts", 
                                                   "scientificInsights", "laws", "reasoningChains", 
                                                   "reasoningSteps", "locations"]) for res in results)
    total_relationships = sum(len(res.get("relationships", [])) for res in results)
    
    logging.info(f"Completed processing {len(results)} chunks with {total_nodes} nodes and {total_relationships} relationships")
    
    # Unregister signal handlers before returning
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    signal.signal(signal.SIGTERM, signal.SIG_DFL)
    
    return results 