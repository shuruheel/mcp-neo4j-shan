"""Law extractor for knowledge graph."""

from typing import Dict, List, Any, Optional
from ..base_extractor import BaseExtractor
from kg_schema import LAW_TEMPLATE

class LawExtractor(BaseExtractor):
    """Extractor for Law nodes."""
    
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles."""
        return "Law"
    
    def _get_template(self) -> str:
        """Return the extraction template for this node type."""
        return LAW_TEMPLATE
    
    def _get_extraction_prompt(self) -> str:
        """Return the prompt for extracting laws."""
        return """
        Analyze the following text and identify all laws, principles, rules, or fundamental regularities.
        For each law, extract relevant information using the provided JSON template.
        
        Text:
        {text}
        
        Template:
        {template}
        
        Instructions:
        1. Identify all laws, principles, rules, or fundamental regularities in the text.
        2. For each law, fill out the JSON template with all available information.
        3. Clearly state the law or principle.
        4. Specify the conditions under which the law applies.
        5. Note any exceptions to the law.
        6. Identify the domain or field where the law is applicable.
        7. List any proofs or evidence supporting the law.
        8. Note any formal mathematical or logical representation.
        9. Return a list of law objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """ 