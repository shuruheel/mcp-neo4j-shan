"""Concept extractor for knowledge graph."""

from typing import Dict, List, Any
from ..base_extractor import BaseExtractor
from kg_schema import CONCEPT_TEMPLATE

class ConceptExtractor(BaseExtractor):
    """Extractor for Concept nodes."""
    
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles."""
        return "Concept"
    
    def _get_template(self) -> str:
        """Return the extraction template for this node type."""
        return CONCEPT_TEMPLATE
    
    def _get_extraction_prompt(self) -> str:
        """Return the prompt for extracting concepts."""
        return """
        Analyze the following text and identify all important abstract concepts, theories, or ideas.
        For each concept, extract relevant information using the provided JSON template.
        
        Text:
        {text}
        
        Template:
        {template}
        
        Instructions:
        1. Identify all significant concepts, theories, or abstract ideas in the text.
        2. For each concept, fill out the JSON template with all available information.
        3. Provide a concise definition and more detailed description.
        4. Include examples, related concepts, and domain information.
        5. Note the significance and different perspectives if applicable.
        6. Include historical development and emotional aspects if relevant.
        7. Rate the abstraction level and identify metaphorical mappings if present.
        8. Return a list of concept objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """ 