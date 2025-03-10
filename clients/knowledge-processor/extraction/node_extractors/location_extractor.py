"""Location extractor for knowledge graph."""

from typing import Dict, List, Any, Optional
import json
import re
from ..base_extractor import BaseExtractor
from ...kg_schema import LOCATION_TEMPLATE

class LocationExtractor(BaseExtractor):
    """Extractor for Location nodes."""
    
    def _get_node_type(self) -> str:
        """Return the node type this extractor handles."""
        return "Location"
    
    def _get_template(self) -> str:
        """Return the extraction template for this node type."""
        return LOCATION_TEMPLATE
    
    def _get_extraction_prompt(self) -> str:
        """Return the prompt for extracting locations."""
        return """
        Analyze the following text and identify all locations (physical places, geographical areas, buildings, virtual spaces).
        For each location, extract relevant information using the provided JSON template.
        
        Text:
        {text}
        
        Template:
        {template}
        
        Instructions:
        1. Identify all locations in the text.
        2. For each location, fill out the JSON template with all available information.
        3. Specify the location name and type.
        4. Include coordinates if available.
        5. Provide a description of the location.
        6. Note the significance or importance of the location.
        7. Return a list of location objects in JSON format.
        
        Return your response as a list of JSON objects, each following the template format.
        """
    
    async def extract_location_details(self, location_name: str, location_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract detailed location information."""
        prompt = f"""
        Based on the following location information, extract detailed location information for {location_name}.
        
        Location Information:
        {json.dumps(location_data, indent=2)}
        
        Instructions:
        1. Extract detailed location information.
        2. Include geographical details, historical significance, and other relevant information.
        3. Only include information that is explicitly stated or strongly implied in the location data.
        4. Return a single JSON object with the following structure:
        
        ```json
        {{
          "name": "{location_name}",
          "coordinates": {{"latitude": 0.0, "longitude": 0.0}},
          "locationType": "City/Country/Building/Virtual/etc.",
          "population": 0,
          "area": {{"value": 0.0, "unit": "sq km"}},
          "climate": "Description of climate",
          "historicalSignificance": "Historical importance",
          "landmarks": ["Landmark 1", "Landmark 2"],
          "description": "Detailed description"
        }}
        ```
        """
        
        # Get response from the model
        response = await self.model.ainvoke(prompt)
        content = response.content
        
        # Extract JSON object from the response
        json_pattern = r'```(?:json)?\s*([\s\S]*?)\s*```'
        json_matches = re.findall(json_pattern, content)
        
        if json_matches:
            try:
                # Clean the JSON string
                cleaned_json = self._clean_json_content(json_matches[0])
                
                # Parse the JSON
                return json.loads(cleaned_json)
            except json.JSONDecodeError:
                pass
        
        # Try to extract JSON from the entire response
        try:
            potential_json = self._extract_json_from_text(content)
            if potential_json:
                return json.loads(potential_json)
        except json.JSONDecodeError:
            pass
        
        return {} 