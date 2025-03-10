"""Entity extractor for knowledge graph."""

import json
import re
import logging
from typing import Dict, List, Any, Optional
from ..base_extractor import BaseExtractor
from ...kg_schema import ENTITY_TEMPLATE, PERSON_TEMPLATE

class EntityExtractor(BaseExtractor):
    """Extractor for Entity nodes."""
    
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles."""
        return "Entity"
    
    def _get_template(self) -> str:
        """Return the extraction template for this node type."""
        return ENTITY_TEMPLATE
    
    def _get_extraction_prompt(self) -> str:
        """Return the prompt for extracting entities."""
        return """
        Analyze the following text and identify all important entities (people, organizations, locations, concepts, etc.).
        For each entity, extract relevant information using the provided JSON template.
        
        Text:
        {text}
        
        Template:
        {template}
        
        Instructions:
        1. Identify all significant entities in the text.
        2. For each entity, fill out the JSON template with all available information.
        3. Specify the entity name and subType (Person, Organization, Location, Artifact, Animal, Concept).
        4. Include factual observations about the entity.
        5. Provide a description and, if applicable, biographical information.
        6. Note any key contributions or significance.
        7. Return a list of entity objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """
    
    async def extract_person_details(self, person_name: str, entity_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract detailed psychological profile for a person entity.
        
        Args:
            person_name: The name of the person
            entity_data: Basic entity data already extracted
            
        Returns:
            Dict[str, Any]: Detailed person profile
        """
        # Create the prompt for extracting person details
        prompt = f"""
        Based on the following entity information, extract a detailed psychological profile for {person_name}.
        
        Entity Information:
        {json.dumps(entity_data, indent=2)}
        
        Instructions:
        1. Extract a comprehensive psychological profile for {person_name}.
        2. Include personality traits, cognitive style, emotional profile, relational dynamics, and value system.
        3. Only include information that is explicitly stated or strongly implied in the entity data.
        4. Use the following template for the psychological profile:
        
        {PERSON_TEMPLATE}
        
        Only extract information that can be reasonably inferred from the provided entity data.
        Do not invent or assume details that are not supported by the information provided.
        """
        
        try:
            # Get response from the model
            response = await self.model.ainvoke(prompt)
            content = response.content
            
            # Extract JSON object from the response
            json_pattern = r'```(?:json)?\s*(.*?)\s*```'
            json_matches = re.findall(json_pattern, content, re.DOTALL)
            
            if json_matches:
                try:
                    # Clean the JSON string
                    cleaned_json = self._clean_json_content(json_matches[0])
                    
                    # Parse the JSON
                    return json.loads(cleaned_json)
                except json.JSONDecodeError:
                    pass
            
            # Try to extract JSON from the entire response
            try:
                potential_json = self._extract_json_from_text(content)
                if potential_json:
                    return json.loads(potential_json)
            except json.JSONDecodeError:
                pass
            
            return {}
        except Exception as e:
            logging.error(f"Error extracting person details for {person_name}: {str(e)}")
            return {}

    async def extract_person_observations(self, text: str, person_names: List[str]) -> Dict[str, List[Dict[str, Any]]]:
        """Extract psychological and behavioral observations about persons from a text chunk.
        
        Args:
            text: The text chunk to analyze
            person_names: List of person names to extract observations for
            
        Returns:
            Dict mapping person names to lists of psychological observations
        """
        if not person_names:
            return {}
        
        prompt = f"""
        Analyze the following text and extract psychological observations about these people: {', '.join(person_names)}
        
        Text:
        {text}
        
        Instructions:
        1. For each person mentioned in the list, identify factual observations that reveal their psychological traits, cognitive style, 
           emotional patterns, relational dynamics, or value system.
        2. Focus on extracting raw observations, not interpretations or complete profiles.
        3. Each observation should include:
           - The exact text evidence from the passage (quote)
           - The psychological dimension it relates to (personality, cognition, emotion, relationships, values)
           - A brief objective description of what this reveals
        4. Only include observations with clear textual evidence.
        
        Return the observations for each person in JSON format:
        {{
          "personName1": [
            {{
              "observation": "Brief description of observation",
              "dimension": "personality/cognition/emotion/relationships/values",
              "evidence": "Exact quote from text",
              "confidence": 0.0-1.0
            }},
            // more observations...
          ],
          "personName2": [
            // observations for second person...
          ]
        }}
        
        Return only observations that are explicitly supported by the text.
        """
        
        try:
            # Get response from the model
            response = await self.model.ainvoke(prompt)
            content = response.content
            
            # Extract JSON object from the response
            json_pattern = r'```(?:json)?\s*(.*?)\s*```'
            json_matches = re.findall(json_pattern, content, re.DOTALL)
            
            if json_matches:
                try:
                    # Clean the JSON string
                    cleaned_json = self._clean_json_content(json_matches[0])
                    
                    # Parse the JSON
                    return json.loads(cleaned_json)
                except json.JSONDecodeError:
                    pass
            
            # Try to extract JSON from the entire response
            try:
                potential_json = self._extract_json_from_text(content)
                if potential_json:
                    return json.loads(potential_json)
            except json.JSONDecodeError:
                logging.error(f"Failed to parse JSON from person observations: {content}")
                pass
            
            return {}
        except Exception as e:
            logging.error(f"Error extracting person observations: {str(e)}")
            return {} 