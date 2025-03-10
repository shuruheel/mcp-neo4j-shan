"""Emotion extractor for knowledge graph."""

from typing import Dict, List, Any
from ..base_extractor import BaseExtractor
from kg_schema import EMOTION_TEMPLATE

class EmotionExtractor(BaseExtractor):
    """Extractor for Emotion nodes."""
    
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles."""
        return "Emotion"
    
    def _get_template(self) -> str:
        """Return the extraction template for this node type."""
        return EMOTION_TEMPLATE
    
    def _get_extraction_prompt(self) -> str:
        """Return the prompt for extracting emotions."""
        return """
        Analyze the following text and identify all emotions or emotional states mentioned or expressed.
        For each emotion, extract relevant information using the provided JSON template.
        
        Text:
        {text}
        
        Template:
        {template}
        
        Instructions:
        1. Identify all significant emotions mentioned or expressed in the text.
        2. For each emotion, fill out the JSON template with all available information.
        3. Specify the emotion name and intensity.
        4. Rate the valence (positive/negative) of the emotion.
        5. Categorize the emotion (Joy, Sadness, Anger, etc.).
        6. Provide a subcategory for more specificity if applicable.
        7. Include a description of the emotional experience.
        8. Return a list of emotion objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """ 