"""Attribute extractor for knowledge graph."""

from typing import Dict, List, Any
from ..base_extractor import BaseExtractor
from ...kg_schema import ATTRIBUTE_TEMPLATE

class AttributeExtractor(BaseExtractor):
    """Extractor for Attribute nodes."""
    
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles."""
        return "Attribute"
    
    def _get_template(self) -> str:
        """Return the extraction template for this node type."""
        return ATTRIBUTE_TEMPLATE
    
    def _get_extraction_prompt(self) -> str:
        """Return the prompt for extracting attributes."""
        return """
        Analyze the following text and identify all important attributes or properties of entities.
        For each attribute, extract relevant information using the provided JSON template.
        
        Text:
        {text}
        
        Template:
        {template}
        
        Instructions:
        1. Identify all significant attributes or properties mentioned in the text.
        2. For each attribute, fill out the JSON template with all available information.
        3. Specify the attribute name and its value.
        4. Include units of measurement if applicable.
        5. Specify the value type (numeric, categorical, boolean, text).
        6. List possible values for categorical attributes.
        7. Provide a description of what the attribute represents.
        8. Return a list of attribute objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """ 