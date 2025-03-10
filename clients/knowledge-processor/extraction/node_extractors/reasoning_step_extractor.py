"""Reasoning Step extractor for knowledge graph."""

from typing import Dict, List, Any, Optional
from ..base_extractor import BaseExtractor
from ...kg_schema import REASONING_STEP_TEMPLATE

class ReasoningStepExtractor(BaseExtractor):
    """Extractor for ReasoningStep nodes."""
    
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles."""
        return "ReasoningStep"
    
    def _get_template(self) -> str:
        """Return the extraction template for this node type."""
        return REASONING_STEP_TEMPLATE
    
    def _get_extraction_prompt(self) -> str:
        """Return the prompt for extracting reasoning steps."""
        return """
        Analyze the following text and identify all reasoning steps, logical moves, or components of arguments.
        For each reasoning step, extract relevant information using the provided JSON template.
        
        Text:
        {text}
        
        Template:
        {template}
        
        Instructions:
        1. Identify all reasoning steps, logical moves, or components of arguments in the text.
        2. For each reasoning step, fill out the JSON template with all available information.
        3. Clearly state the content of the reasoning step.
        4. Specify the step type (premise, inference, evidence, counterargument, rebuttal, conclusion).
        5. Identify the evidence type if applicable.
        6. List any supporting references or sources.
        7. Assess the confidence level of the step.
        8. Note any alternatives or counterarguments mentioned.
        9. Identify the parent reasoning chain if mentioned.
        10. Return a list of reasoning step objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """ 