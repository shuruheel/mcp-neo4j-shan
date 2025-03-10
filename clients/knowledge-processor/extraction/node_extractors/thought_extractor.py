"""Thought extractor for knowledge graph."""

from typing import Dict, List, Any
from ..base_extractor import BaseExtractor
from ...kg_schema import THOUGHT_TEMPLATE

class ThoughtExtractor(BaseExtractor):
    """Extractor for Thought nodes."""
    
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles."""
        return "Thought"
    
    def _get_template(self) -> str:
        """Return the extraction template for this node type."""
        return THOUGHT_TEMPLATE
    
    def _get_extraction_prompt(self) -> str:
        """Return the prompt for extracting thoughts."""
        return """
        Analyze the following text and identify all subjective analyses, interpretations, or thought processes.
        For each thought, extract relevant information using the provided JSON template.
        
        Text:
        {text}
        
        Template:
        {template}
        
        Instructions:
        1. Identify all significant subjective thoughts, analyses, or interpretations in the text.
        2. For each thought, fill out the JSON template with all available information.
        3. Provide a label and the full thought content.
        4. Include references to entities or concepts mentioned.
        5. Note the confidence level and source of the thought.
        6. List tags, impact, emotional aspects, and evidential basis if relevant.
        7. Include counterarguments, implications, and reasoning chains if mentioned.
        8. Return a list of thought objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """ 