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
from ..kg_schema import NODE_TYPES, EXTRACTION_PROMPT_TEMPLATE

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

class KnowledgeExtractor:
    """Main class for extracting knowledge from text chunks."""
    
    def __init__(self, model_name: str = "gpt-4o", temperature: float = 0.0):
        """Initialize the knowledge extractor with specified LLM.
        
        Args:
            model_name: Name of the language model to use for general extraction
            temperature: Temperature setting for the language model
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
            model_name="gpt-4-turbo",  # Using gpt-4-turbo for more advanced reasoning
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
        
        # Initialize results with empty lists
        result = {
            "entities": [], "events": [], "concepts": [], "attributes": [],
            "propositions": [], "emotions": [], "agents": [], "thoughts": [],
            "scientificInsights": [], "laws": [], "reasoningChains": [],
            "reasoningSteps": [], "locations": [], "relationships": [],
            "personDetails": {}, "locationDetails": {}, "personObservations": {}
        }
        
        try:
            # Group 1 extraction: Entities, Attributes, Events, Emotions
            logging.info("Extracting Group 1: Entities, Attributes, Events, Emotions, Locations")
            group1_result = await self._extract_group1(text)
            
            # Group 2 extraction: Concepts, Propositions, Reasoning Chains, Reasoning Steps
            logging.info("Extracting Group 2: Concepts, Propositions, Reasoning Chains, Reasoning Steps, etc.")
            group2_result = await self._extract_group2(text)
            
            # Merge group results
            for key, items in group1_result.items():
                result[key] = items
                
            for key, items in group2_result.items():
                result[key] = items
            
            # Extract relationships WITH NODE CONTEXT
            logging.info("Extracting relationships with node context")
            result["relationships"] = await self._extract_relationships_with_context(text, result)
            
            # Find person entities for observations
            person_entities = [e for e in result["entities"] if isinstance(e, dict) and e.get("subType") == "Person"]
            
            # Extract person observations
            if person_entities:
                person_names = [e.get("name") for e in person_entities if e.get("name")]
                if person_names:
                    logging.info(f"Extracting observations for {len(person_names)} persons")
                    person_observations = await self._extract_person_observations(text, person_names)
                    
                    # Store person observations in the result
                    if person_observations:
                        result["personObservations"] = person_observations
                        # Also store these observations as personDetails for backward compatibility
                        result["personDetails"] = person_observations
            
            # Extract location details if location entities are found
            location_entities = [e for e in result["entities"] if isinstance(e, dict) and e.get("subType") == "Location"]
            if location_entities:
                logging.info(f"Extracting details for {len(location_entities)} location entities")
                location_details = await self._extract_location_details(location_entities)
                
                # Store location details in the result
                if location_details:
                    result["locationDetails"] = location_details
        
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
        
        Uses the advanced model (gpt-4-turbo) for better psychological, social and 
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
            
            # Log the use of the advanced model
            logging.info(f"Using advanced model (gpt-4-turbo) for extracting psychological observations")
            
            # Use the entity extractor's method but with our advanced model
            return await person_extractor.extract_person_observations(text, person_names)
        except Exception as e:
            logging.error(f"Error extracting person observations: {str(e)}")
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
        
        # Skip if too few nodes to form relationships
        if len(entities) + len(concepts) + len(events) + len(locations) + len(props) < 2:
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
            "reasoningChains": [{"name": r.get("name")} for r in reasoning_chains]
        }
        
        # Get relationship template from the relationship extractor
        relationship_template = self.relationship_extractor._get_template()
        
        # Create prompt for context-aware relationship extraction
        prompt = f"""
        Analyze the following text and identify relationships ONLY between the nodes that have been extracted.
        
        Text:
        {text}
        
        Extracted Nodes:
        {json.dumps(simplified_nodes, indent=2)}
        
        Relationship Template:
        {relationship_template}
        
        Instructions:
        1. Only identify relationships between the nodes listed above.
        2. Do not create relationships involving nodes that aren't in the extracted node lists.
        3. For each relationship, follow the template format exactly.
        4. Ensure the subject and object of each relationship correctly match node names from the extracted nodes.
        5. Specify the relationship type according to the schema's defined relationship types.
        6. Add any relevant properties to the relationship when appropriate.
        7. Return a list of relationship objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """
        
        try:
            # Get response from the model
            response = await self.model.ainvoke(prompt)
            content = response.content
            
            try:
                # Extract and parse relationships from the response
                relationships = []
                
                # Find JSON arrays in the response
                json_pattern = r'\[.*?\]'
                json_matches = re.findall(json_pattern, content, re.DOTALL)
                
                for match in json_matches:
                    try:
                        parsed = json.loads(match)
                        if isinstance(parsed, list) and all(isinstance(item, dict) for item in parsed):
                            relationships.extend(parsed)
                            break  # Stop after finding the first valid array
                    except json.JSONDecodeError:
                        continue
                
                # If no JSON array was found, try to parse the entire content
                if not relationships:
                    try:
                        parsed = json.loads(content)
                        if isinstance(parsed, list):
                            relationships = parsed
                        elif isinstance(parsed, dict) and "relationships" in parsed:
                            relationships = parsed["relationships"]
                    except json.JSONDecodeError:
                        # Fallback to regex extraction if JSON parsing fails
                        extracted_json = self.relationship_extractor._extract_json_from_text(content)
                        if extracted_json:
                            try:
                                parsed = json.loads(extracted_json)
                                if isinstance(parsed, list):
                                    relationships = parsed
                            except json.JSONDecodeError:
                                pass
                
                # Validate relationships - only include those between extracted nodes
                valid_relationships = []
                all_node_names = set()
                for node_list in simplified_nodes.values():
                    all_node_names.update(node.get("name") for node in node_list)
                
                for rel in relationships:
                    if isinstance(rel, dict) and "from" in rel and "to" in rel:
                        subject = rel.get("from")
                        object_ = rel.get("to")
                        if subject in all_node_names and object_ in all_node_names:
                            valid_relationships.append(rel)
                
                logging.info(f"Extracted {len(valid_relationships)} valid relationships")
                return valid_relationships
                
            except Exception as e:
                logging.error(f"Error parsing relationships: {str(e)}")
                return []
        
        except Exception as e:
            logging.error(f"Error during relationship extraction: {str(e)}")
            return []

async def process_chunks(chunks, batch_size=5, checkpoint_frequency=5, model_name="gpt-4o", temperature=0.0, advanced_model_name="gpt-4-turbo"):
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
    
    extractor = KnowledgeExtractor(model_name=model_name, temperature=temperature)
    results = []
    total_chunks = len(chunks)
    
    for i in tqdm(range(0, total_chunks, batch_size), desc="Processing batches"):
        batch = chunks[i:i+batch_size]
        try:
            # Process batch in parallel
            batch_tasks = [extractor.extract_from_chunk(chunk) for chunk in batch]
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            # Process batch results
            valid_results = []
            for j, res in enumerate(batch_results):
                if isinstance(res, Exception):
                    logging.error(f"Error processing chunk {i+j}: {str(res)}")
                    # Add empty result for failed chunk
                    valid_results.append({
                        "entities": [], "events": [], "concepts": [], "attributes": [],
                        "propositions": [], "emotions": [], "agents": [], "thoughts": [],
                        "scientificInsights": [], "laws": [], "reasoningChains": [],
                        "reasoningSteps": [], "locations": [], "relationships": [],
                        "personDetails": {}, "locationDetails": {}, "personObservations": {}
                    })
                else:
                    valid_results.append(res)
            
            results.extend(valid_results)
            
            # Log batch processing details
            logging.info(f"Processed batch {i//batch_size + 1}/{(total_chunks + batch_size - 1)//batch_size}: {len(batch)} chunks")
            
            # Save checkpoint
            if (i + batch_size) % (batch_size * checkpoint_frequency) == 0 or (i + batch_size) >= total_chunks:
                try:
                    checkpoint_file = f'checkpoint_latest.json'
                    with open(checkpoint_file, 'w') as f:
                        json.dump(results, f)
                    logging.info(f"Saved checkpoint at batch {i//batch_size + 1}")
                except Exception as e:
                    logging.warning(f"Failed to save checkpoint: {str(e)}")
        except Exception as e:
            logging.error(f"Error processing batch starting at index {i}: {str(e)}")
            # Continue with next batch instead of failing the entire process
            continue
    
    # Save final results
    try:
        with open('extraction_results.json', 'w') as f:
            json.dump(results, f)
        logging.info("Saved final extraction results")
    except Exception as e:
        logging.error(f"Failed to save final results: {str(e)}")
    
    return results 