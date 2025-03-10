"""Agent extractor for knowledge graph."""

from typing import Dict, List, Any
from ..base_extractor import BaseExtractor
from ...kg_schema import AGENT_TEMPLATE

class AgentExtractor(BaseExtractor):
    """Extractor for Agent nodes."""
    
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles."""
        return "Agent"
    
    def _get_template(self) -> str:
        """Return the extraction template for this node type."""
        return AGENT_TEMPLATE
    
    def _get_extraction_prompt(self) -> str:
        """Return the prompt for extracting agents."""
        return """
        Analyze the following text and identify all cognitive agents (humans, AI systems, organizations) capable of belief or action.
        For each agent, extract relevant information using the provided JSON template.
        
        Text:
        {text}
        
        Template:
        {template}
        
        Instructions:
        1. Identify all significant agents mentioned in the text.
        2. For each agent, fill out the JSON template with all available information.
        3. Specify the agent name and type (human, ai, organization, other).
        4. Include a description of the agent.
        5. List capabilities, beliefs, knowledge, and preferences if mentioned.
        6. Note the emotional state if applicable.
        7. For AI agents, include specialized attributes like model name, provider, API endpoint, etc.
        8. Return a list of agent objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """ 