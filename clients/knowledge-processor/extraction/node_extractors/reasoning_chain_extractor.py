"""Reasoning Chain extractor for knowledge graph."""

from typing import Dict, List, Any, Optional
from ..base_extractor import BaseExtractor
from ...kg_schema import REASONING_CHAIN_TEMPLATE

class ReasoningChainExtractor(BaseExtractor):
    """Extractor for ReasoningChain nodes."""
    
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles."""
        return "ReasoningChain"
    
    def _get_template(self) -> str:
        """Return the extraction template for this node type."""
        return REASONING_CHAIN_TEMPLATE
    
    def _get_extraction_prompt(self) -> str:
        """Return the prompt for extracting reasoning chains."""
        return """
        Analyze the following text and identify all reasoning chains, arguments, or logical sequences.
        For each reasoning chain, extract relevant information using the provided JSON template.
        
        Text:
        {text}
        
        Template:
        {template}
        
        Instructions:
        1. Identify all reasoning chains, arguments, or logical sequences in the text.
        2. For each reasoning chain, fill out the JSON template with all available information.
        3. Provide a clear description of what the reasoning accomplishes.
        4. State the conclusion reached through the reasoning.
        5. Assess the confidence score or strength of the reasoning.
        6. Identify the creator or source of the reasoning.
        7. Specify the methodology (deductive, inductive, abductive, etc.).
        8. Note the domain or field to which the reasoning belongs.
        9. Count the number of steps in the reasoning chain.
        10. Return a list of reasoning chain objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """ 