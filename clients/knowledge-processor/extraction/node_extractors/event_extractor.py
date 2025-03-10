"""Event extractor for knowledge graph."""

from typing import Dict, List, Any
from ..base_extractor import BaseExtractor
from ...kg_schema import EVENT_TEMPLATE

class EventExtractor(BaseExtractor):
    """Extractor for Event nodes."""
    
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles."""
        return "Event"
    
    def _get_template(self) -> str:
        """Return the extraction template for this node type."""
        return EVENT_TEMPLATE
    
    def _get_extraction_prompt(self) -> str:
        """Return the prompt for extracting events."""
        return """
        Analyze the following text and identify all significant events (actions, occurrences, happenings).
        For each event, extract relevant information using the provided JSON template.
        
        Text:
        {text}
        
        Template:
        {template}
        
        Instructions:
        1. Identify all significant events in the text.
        2. For each event, fill out the JSON template with all available information.
        3. Specify the event name, dates/times, and status.
        4. Include location, participants, and outcomes if available.
        5. Note the significance and any emotional aspects.
        6. Identify causal predecessors and successors if mentioned.
        7. Return a list of event objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """ 