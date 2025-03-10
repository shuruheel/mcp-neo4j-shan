"""Scientific Insight extractor for knowledge graph."""

from typing import Dict, List, Any, Optional
from ..base_extractor import BaseExtractor
from ...kg_schema import SCIENTIFIC_INSIGHT_TEMPLATE

class ScientificInsightExtractor(BaseExtractor):
    """Extractor for ScientificInsight nodes."""
    
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles."""
        return "ScientificInsight"
    
    def _get_template(self) -> str:
        """Return the extraction template for this node type."""
        return SCIENTIFIC_INSIGHT_TEMPLATE
    
    def _get_extraction_prompt(self) -> str:
        """Return the prompt for extracting scientific insights."""
        return """
        Analyze the following text and identify all scientific insights, findings, discoveries, or research results.
        For each scientific insight, extract relevant information using the provided JSON template.
        
        Text:
        {text}
        
        Template:
        {template}
        
        Instructions:
        1. Identify all scientific insights, findings, discoveries, or research results in the text.
        2. For each scientific insight, fill out the JSON template with all available information.
        3. Clearly state the hypothesis or research question.
        4. List the evidence supporting the insight.
        5. Describe the methodology used to obtain the insight.
        6. Assess the confidence level or statistical significance.
        7. Specify the scientific field or discipline.
        8. Note any publications or sources mentioned.
        9. Identify any counterarguments or limitations mentioned.
        10. Return a list of scientific insight objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """ 