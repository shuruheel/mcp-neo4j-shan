"""Proposition extractor for knowledge graph."""

from typing import Dict, List, Any
from ..base_extractor import BaseExtractor
from ...kg_schema import PROPOSITION_TEMPLATE

class PropositionExtractor(BaseExtractor):
    """Extractor for Proposition nodes."""
    
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles."""
        return "Proposition"
    
    def _get_template(self) -> str:
        """Return the extraction template for this node type."""
        return PROPOSITION_TEMPLATE
    
    def _get_extraction_prompt(self) -> str:
        """Return the prompt for extracting propositions."""
        return """
        Analyze the following text and identify all objectively verifiable assertions or claims.
        For each proposition, extract relevant information using the provided JSON template.
        
        Text:
        {text}
        
        Template:
        {template}
        
        Instructions:
        1. Identify all significant assertions, claims, or statements in the text.
        2. For each proposition, fill out the JSON template with all available information.
        3. Provide a short label and the full statement.
        4. Specify the status (fact, hypothesis, law, rule, claim).
        5. Rate the confidence and evidence strength.
        6. List sources and any counter-evidence.
        7. Include domain information and emotional aspects if relevant.
        8. Return a list of proposition objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """ 