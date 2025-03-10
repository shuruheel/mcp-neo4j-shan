"""Relationship extractor for knowledge graph."""

import json
import re
import logging
from typing import Dict, List, Any, Optional
from langchain_openai import ChatOpenAI
from ..kg_schema import RELATIONSHIP_TYPES, RELATIONSHIP_CATEGORIES

class RelationshipExtractor:
    """Extractor for relationships between knowledge graph nodes."""
    
    def __init__(self, model: ChatOpenAI):
        """Initialize the relationship extractor with a language model.
        
        Args:
            model: The language model to use for extraction
        """
        self.model = model
    
    async def extract(self, text: str) -> List[Dict[str, Any]]:
        """Extract relationships from text.
        
        Args:
            text: The text to extract relationships from
            
        Returns:
            List[Dict[str, Any]]: List of extracted relationships as dictionaries
        """
        # Create the extraction prompt
        prompt = self._get_extraction_prompt(text)
        
        try:
            # Get response from the model
            response = await self.model.ainvoke(prompt)
            content = response.content
            
            # Extract JSON objects from the response
            return self._extract_relationships_from_response(content)
        except Exception as e:
            logging.error(f"Error in relationship extraction: {str(e)}")
            return []
    
    def _get_extraction_prompt(self, text: str) -> str:
        """Create the prompt for relationship extraction.
        
        Args:
            text: The text to extract relationships from
            
        Returns:
            str: The formatted prompt
        """
        return f"""
        Analyze the following text and identify relationships between entities, concepts, events, or other elements.
        For each relationship, specify the source entity, target entity, and the type of relationship.
        
        Text:
        {text}
        
        Valid relationship types are:
        {', '.join(RELATIONSHIP_TYPES)}
        
        Relationship categories are:
        {', '.join(RELATIONSHIP_CATEGORIES)}
        
        Instructions:
        1. Identify all meaningful relationships in the text.
        2. For each relationship, specify:
           - fromNode: The source entity/concept/event name
           - relationshipType: One of the valid relationship types
           - toNode: The target entity/concept/event name
           - context: A brief explanation of the relationship
           - confidenceScore: A number between 0.0 and 1.0 indicating confidence
           - relationshipCategory: One of the relationship categories
        3. Return a list of relationships in JSON format.
        
        Response format:
        ```json
        [
          {{
            "fromNode": "Entity/Concept/Event Name",
            "relationshipType": "RELATIONSHIP_TYPE",
            "toNode": "Entity/Concept/Event Name",
            "context": "Explanatory context for the relationship",
            "confidenceScore": 0.8,
            "weight": 0.75,
            "relationshipCategory": "category"
          }},
          ...
        ]
        ```
        
        Only include relationships that are explicitly mentioned or strongly implied in the text.
        """
    
    def _extract_relationships_from_response(self, content: str) -> List[Dict[str, Any]]:
        """Extract relationship objects from the LLM response.
        
        Args:
            content: The response content from the LLM
            
        Returns:
            List[Dict[str, Any]]: List of extracted relationship objects
        """
        # Try to extract JSON array from code blocks first
        json_pattern = r'```(?:json)?\s*(.*?)\s*```'
        json_matches = re.findall(json_pattern, content, re.DOTALL)
        
        relationships = []
        for match in json_matches:
            try:
                # Clean the JSON string
                cleaned_json = self._clean_json_content(match)
                
                # Parse the JSON
                parsed = json.loads(cleaned_json)
                
                if isinstance(parsed, list):
                    relationships.extend(parsed)
                elif isinstance(parsed, dict):
                    relationships.append(parsed)
            except json.JSONDecodeError:
                continue
        
        # If no relationships found via code blocks, try to extract from the entire response
        if not relationships:
            try:
                potential_json = self._extract_json_from_text(content)
                if potential_json:
                    parsed = json.loads(potential_json)
                    if isinstance(parsed, list):
                        relationships.extend(parsed)
                    elif isinstance(parsed, dict):
                        relationships.append(parsed)
            except json.JSONDecodeError:
                pass
        
        # Validate and normalize relationships
        valid_relationships = []
        for rel in relationships:
            if self._is_valid_relationship(rel):
                # Ensure all required fields are present
                normalized_rel = self._normalize_relationship(rel)
                valid_relationships.append(normalized_rel)
        
        return valid_relationships
    
    def _is_valid_relationship(self, relationship: Dict[str, Any]) -> bool:
        """Check if a relationship is valid.
        
        Args:
            relationship: The relationship to validate
            
        Returns:
            bool: True if the relationship is valid
        """
        required_fields = ["fromNode", "relationshipType", "toNode"]
        return all(field in relationship for field in required_fields)
    
    def _normalize_relationship(self, relationship: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize a relationship by ensuring all fields are present.
        
        Args:
            relationship: The relationship to normalize
            
        Returns:
            Dict[str, Any]: The normalized relationship
        """
        # Create a normalized relationship with default values
        normalized = {
            "fromNode": relationship.get("fromNode", ""),
            "relationshipType": relationship.get("relationshipType", "RELATED_TO"),
            "toNode": relationship.get("toNode", ""),
            "context": relationship.get("context", ""),
            "confidenceScore": relationship.get("confidenceScore", 0.5),
            "weight": relationship.get("weight", 0.5),
            "relationshipCategory": relationship.get("relationshipCategory", "associative")
        }
        
        # Ensure relationship type is valid
        if normalized["relationshipType"] not in RELATIONSHIP_TYPES:
            normalized["relationshipType"] = "RELATED_TO"
        
        # Ensure relationship category is valid
        if normalized["relationshipCategory"] not in RELATIONSHIP_CATEGORIES:
            normalized["relationshipCategory"] = "lateral"
        
        return normalized
    
    def _clean_json_content(self, content: str) -> str:
        """Clean JSON content for parsing.
        
        Args:
            content: JSON content string
            
        Returns:
            str: Cleaned JSON string
        """
        # Replace \n, \t, etc. with actual characters
        content = content.replace('\\n', '\n').replace('\\t', '\t')
        
        # Remove trailing commas
        content = re.sub(r',\s*}', '}', content)
        content = re.sub(r',\s*]', ']', content)
        
        return content
    
    def _extract_json_from_text(self, text: str) -> Optional[str]:
        """Extract JSON content from mixed text.
        
        Args:
            text: Text that may contain JSON
            
        Returns:
            Optional[str]: Extracted JSON string or None
        """
        # Try to find a JSON array
        json_start_pattern = r'\['
        json_start_match = re.search(json_start_pattern, text)
        
        if json_start_match:
            start_pos = json_start_match.start()
            
            # Track brackets to find the matching closing bracket
            bracket_count = 0
            for i in range(start_pos, len(text)):
                if text[i] == '[':
                    bracket_count += 1
                elif text[i] == ']':
                    bracket_count -= 1
                    if bracket_count == 0:
                        return text[start_pos:i+1]
        
        # If no array found, try to find a JSON object
        json_start_pattern = r'{'
        json_start_match = re.search(json_start_pattern, text)
        
        if json_start_match:
            start_pos = json_start_match.start()
            
            # Track brackets to find the matching closing bracket
            bracket_count = 0
            for i in range(start_pos, len(text)):
                if text[i] == '{':
                    bracket_count += 1
                elif text[i] == '}':
                    bracket_count -= 1
                    if bracket_count == 0:
                        return text[start_pos:i+1]
        
        return None 