"""Base extractor for knowledge graph elements."""

import json
import re
import logging
from typing import Dict, List, Any, Optional
from abc import ABC, abstractmethod
from langchain_openai import ChatOpenAI
from ..kg_schema import EXTRACTION_PROMPT_TEMPLATE

class BaseExtractor(ABC):
    """Base class for all knowledge element extractors."""
    
    def __init__(self, model: ChatOpenAI):
        """Initialize the extractor with a language model.
        
        Args:
            model: The language model to use for extraction
        """
        self.model = model
        
    @abstractmethod
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles.
        
        Returns:
            str: The node type (Entity, Event, Concept, etc.)
        """
        pass
    
    @abstractmethod
    def _get_template(self) -> str:
        """Return the extraction template for this node type.
        
        Returns:
            str: The JSON template for the node type from kg_schema
        """
        pass
    
    @abstractmethod
    def _get_extraction_prompt(self) -> str:
        """Return the prompt template for extraction.
        
        Returns:
            str: The prompt template with {text} and {template} placeholders
        """
        pass
    
    async def extract(self, text: str) -> List[Dict[str, Any]]:
        """Extract knowledge elements from text.
        
        Args:
            text: The text to extract from
            
        Returns:
            List[Dict[str, Any]]: List of extracted elements as dictionaries
        """
        # Get the template and prepare the prompt
        template = self._get_template()
        prompt_template = self._get_extraction_prompt()
        prompt = prompt_template.format(text=text, template=template)
        
        try:
            # Get response from the model
            response = await self.model.ainvoke(prompt)
            content = response.content
            
            # Extract JSON objects from the response
            return self._extract_objects_from_response(content)
        except Exception as e:
            logging.error(f"Error in {self._get_node_type()} extraction: {str(e)}")
            return []
    
    def _extract_objects_from_response(self, content: str) -> List[Dict[str, Any]]:
        """Extract JSON objects from the LLM response.
        
        Args:
            content: The response content from the LLM
            
        Returns:
            List[Dict[str, Any]]: List of extracted JSON objects
        """
        # Try to extract JSON array directly
        try:
            # Look for a JSON array in the response
            array_pattern = r'\[\s*{.*}\s*\]'
            array_match = re.search(array_pattern, content, re.DOTALL)
            if array_match:
                array_str = array_match.group(0)
                return json.loads(array_str)
        except (json.JSONDecodeError, re.error):
            pass
        
        # Try to extract JSON objects using regex
        json_pattern = r'```(?:json)?\s*(.*?)\s*```'
        json_matches = re.findall(json_pattern, content, re.DOTALL)
        
        objects = []
        for match in json_matches:
            try:
                # Try to parse as a JSON array
                cleaned_json = self._clean_json_content(match)
                parsed = json.loads(cleaned_json)
                
                if isinstance(parsed, list):
                    objects.extend(parsed)
                elif isinstance(parsed, dict):
                    objects.append(parsed)
            except json.JSONDecodeError:
                pass
        
        # If no objects found, try to extract JSON from the entire content
        if not objects:
            try:
                potential_json = self._extract_json_from_text(content)
                if potential_json:
                    parsed = json.loads(potential_json)
                    if isinstance(parsed, list):
                        objects.extend(parsed)
                    elif isinstance(parsed, dict):
                        objects.append(parsed)
            except json.JSONDecodeError:
                pass
        
        # Add nodeType if missing
        node_type = self._get_node_type()
        for obj in objects:
            if "nodeType" not in obj:
                obj["nodeType"] = node_type
        
        return objects
    
    def _clean_json_content(self, content: str) -> str:
        """Clean JSON content for parsing.
        
        Args:
            content: JSON content string
            
        Returns:
            str: Cleaned JSON string
        """
        # Replace \n, \t, etc. with actual characters
        content = content.replace('\\n', '\n').replace('\\t', '\t')
        
        # Remove non-JSON trailing characters
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
        # Try to find JSON object or array
        json_start_pattern = r'[{\[]'
        json_start_match = re.search(json_start_pattern, text)
        
        if json_start_match:
            start_pos = json_start_match.start()
            
            # Check if it's an object or array
            if text[start_pos] == '{':
                # Track brackets to find the matching closing bracket
                bracket_count = 0
                for i in range(start_pos, len(text)):
                    if text[i] == '{':
                        bracket_count += 1
                    elif text[i] == '}':
                        bracket_count -= 1
                        if bracket_count == 0:
                            return text[start_pos:i+1]
            elif text[start_pos] == '[':
                # Track brackets to find the matching closing bracket
                bracket_count = 0
                for i in range(start_pos, len(text)):
                    if text[i] == '[':
                        bracket_count += 1
                    elif text[i] == ']':
                        bracket_count -= 1
                        if bracket_count == 0:
                            return text[start_pos:i+1]
        
        return None 