"""Text extraction and processing for knowledge graph."""

import re
import asyncio
import json
import logging
from tqdm import tqdm
from langchain.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from kg_schema import EXTRACTION_PROMPT_TEMPLATE

def parse_gpt4_response(response):
    """Parse the GPT-4 response into structured data"""
    result = {
        "entities": [],
        "events": [],
        "concepts": [],
        "propositions": [],
        "attributes": [],
        "emotions": [],
        "agents": [],
        "thoughts": [],
        "scientificInsights": [],
        "laws": [],
        "reasoningChains": [],
        "reasoningSteps": [],
        "relationships": [],
        "personDetails": {},
        "locationDetails": {},
    }
    
    lines = response.strip().split('\n')
    i = 0
    current_section = None
    current_person = None
    current_location = None
    person_details = {}
    location_details = {}
    
    # Define pattern matchers for section headers
    entity_headers = [r"Entities?:", r"Named Entities?:"]
    event_headers = [r"Events?:"]
    concept_headers = [r"Concepts?:"]
    proposition_headers = [r"Propositions?:"]
    attribute_headers = [r"Attributes?:"]
    emotion_headers = [r"Emotions?:"]
    agent_headers = [r"Agents?:"]
    thought_headers = [r"Thoughts?:"]
    scientific_insight_headers = [r"Scientific Insights?:"]
    law_headers = [r"Laws?:"]
    reasoning_chain_headers = [r"Reasoning Chains?:"]
    reasoning_step_headers = [r"Reasoning Steps?:"]
    relationship_headers = [r"Relationships?:"]
    person_details_headers = [r"Person Details for "]
    location_details_headers = [r"Location Details for "]
    
    # Helper function to extract required attributes
    def ensure_required_attributes(node_dict, node_type):
        """Ensure the node has all required attributes for its type"""
        if not isinstance(node_dict, dict):
            return node_dict
            
        # Add nodeType if missing
        if 'nodeType' not in node_dict:
            node_dict['nodeType'] = node_type
            
        # Ensure required attributes based on node type
        if node_type == 'Entity':
            if 'observations' not in node_dict:
                node_dict['observations'] = []
                
        elif node_type == 'Event':
            if 'participants' not in node_dict:
                node_dict['participants'] = []
            if 'outcome' not in node_dict:
                node_dict['outcome'] = ""
                
        elif node_type == 'Concept':
            if 'definition' not in node_dict:
                node_dict['definition'] = ""
            if 'examples' not in node_dict:
                node_dict['examples'] = []
            if 'relatedConcepts' not in node_dict:
                node_dict['relatedConcepts'] = []
            if 'domain' not in node_dict:
                node_dict['domain'] = ""
                
        elif node_type == 'Proposition':
            if 'statement' not in node_dict:
                node_dict['statement'] = ""
            if 'status' not in node_dict:
                node_dict['status'] = "claim"
            if 'confidence' not in node_dict:
                node_dict['confidence'] = 0.5
                
        elif node_type == 'Attribute':
            if 'value' not in node_dict:
                node_dict['value'] = ""
            if 'valueType' not in node_dict:
                node_dict['valueType'] = "text"
                
        elif node_type == 'Emotion':
            if 'intensity' not in node_dict:
                node_dict['intensity'] = 0.5
            if 'valence' not in node_dict:
                node_dict['valence'] = 0.0
            if 'category' not in node_dict:
                node_dict['category'] = ""
                
        elif node_type == 'Agent':
            if 'agentType' not in node_dict:
                node_dict['agentType'] = "human"
            if 'capabilities' not in node_dict:
                node_dict['capabilities'] = []
                
        elif node_type == 'Thought':
            if 'thoughtContent' not in node_dict:
                node_dict['thoughtContent'] = ""
            if 'references' not in node_dict:
                node_dict['references'] = []
                
        elif node_type == 'ScientificInsight':
            if 'hypothesis' not in node_dict:
                node_dict['hypothesis'] = ""
            if 'evidence' not in node_dict:
                node_dict['evidence'] = []
            if 'confidence' not in node_dict:
                node_dict['confidence'] = 0.5
            if 'field' not in node_dict:
                node_dict['field'] = ""
                
        elif node_type == 'Law':
            if 'statement' not in node_dict:
                node_dict['statement'] = ""
            if 'conditions' not in node_dict:
                node_dict['conditions'] = []
            if 'exceptions' not in node_dict:
                node_dict['exceptions'] = []
            if 'domain' not in node_dict:
                node_dict['domain'] = ""
                
        elif node_type == 'ReasoningChain':
            if 'description' not in node_dict:
                node_dict['description'] = ""
            if 'conclusion' not in node_dict:
                node_dict['conclusion'] = ""
            if 'confidenceScore' not in node_dict:
                node_dict['confidenceScore'] = 0.5
            if 'creator' not in node_dict:
                node_dict['creator'] = "AI System"
            if 'methodology' not in node_dict:
                node_dict['methodology'] = "mixed"
                
        elif node_type == 'ReasoningStep':
            if 'content' not in node_dict:
                node_dict['content'] = ""
            if 'stepType' not in node_dict:
                node_dict['stepType'] = "inference"
            if 'confidence' not in node_dict:
                node_dict['confidence'] = 0.5
                
        elif node_type == 'Location':
            if 'locationType' not in node_dict:
                node_dict['locationType'] = "Place"
            if 'description' not in node_dict:
                node_dict['description'] = ""
                
        return node_dict
    
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        
        # Check for section headers
        if any(re.match(pattern, line) for pattern in entity_headers):
            current_section = "entities"
        elif any(re.match(pattern, line) for pattern in event_headers):
            current_section = "events"
        elif any(re.match(pattern, line) for pattern in concept_headers):
            current_section = "concepts"
        elif any(re.match(pattern, line) for pattern in proposition_headers):
            current_section = "propositions"
        elif any(re.match(pattern, line) for pattern in attribute_headers):
            current_section = "attributes"
        elif any(re.match(pattern, line) for pattern in emotion_headers):
            current_section = "emotions"
        elif any(re.match(pattern, line) for pattern in agent_headers):
            current_section = "agents"
        elif any(re.match(pattern, line) for pattern in thought_headers):
            current_section = "thoughts"
        elif any(re.match(pattern, line) for pattern in scientific_insight_headers):
            current_section = "scientificInsights"
        elif any(re.match(pattern, line) for pattern in law_headers):
            current_section = "laws"
        elif any(re.match(pattern, line) for pattern in reasoning_chain_headers):
            current_section = "reasoningChains"
        elif any(re.match(pattern, line) for pattern in reasoning_step_headers):
            current_section = "reasoningSteps"
        elif any(re.match(pattern, line) for pattern in relationship_headers):
            current_section = "relationships"
        elif any(re.match(pattern, line) for pattern in person_details_headers):
            current_section = "person_details"
            # Extract person name
            for pattern in person_details_headers:
                match = re.match(pattern, line)
                if match and len(match.groups()) > 0:
                    current_person = match.group(1).strip()
                    person_details[current_person] = {}
                    break
        elif any(re.match(pattern, line) for pattern in location_details_headers):
            current_section = "location_details"
            # Extract location name
            for pattern in location_details_headers:
                match = re.match(pattern, line)
                if match and len(match.groups()) > 0:
                    current_location = match.group(1).strip()
                    location_details[current_location] = {}
                    break
        
        # Process content based on current section
        elif line.startswith("- "):
            content = line[2:].strip()
            if current_section == "entities":
                # Parse entity data with comprehensive attributes
                entity_data = {
                    "name": content,
                    "nodeType": "Entity",
                    "observations": [],
                    "confidence": 0.0,
                }
                
                # Extract entity name and type
                if "[Type:" in content:
                    entity_parts = content.split("[Type:", 1)
                    entity_name = entity_parts[0].strip()
                    entity_type = entity_parts[1].strip().rstrip("]")
                    entity_data["name"] = entity_name
                    entity_data["subType"] = entity_type
                
                # Look ahead for additional entity details in subsequent lines
                j = i + 1
                while j < len(lines) and (
                    lines[j].strip().startswith("Description:") or
                    lines[j].strip().startswith("Observations:") or
                    lines[j].strip().startswith("Source:") or
                    lines[j].strip().startswith("Confidence:") or
                    lines[j].strip().startswith("Biography:") or
                    lines[j].strip().startswith("Key Contributions:") or
                    lines[j].strip().startswith("Emotional Valence:") or
                    lines[j].strip().startswith("Emotional Arousal:") or
                    lines[j].strip() == ""):
                    
                    detail_line = lines[j].strip()
                    
                    if detail_line.startswith("Description:"):
                        entity_data["description"] = detail_line[len("Description:"):].strip()
                    elif detail_line.startswith("Observations:"):
                        observations = detail_line[len("Observations:"):].strip()
                        entity_data["observations"] = [obs.strip() for obs in observations.split(";")]
                    elif detail_line.startswith("Source:"):
                        entity_data["source"] = detail_line[len("Source:"):].strip()
                    elif detail_line.startswith("Confidence:"):
                        confidence_text = detail_line[len("Confidence:"):].strip()
                        # Convert text confidence to numeric
                        if confidence_text.lower() == "high":
                            entity_data["confidence"] = 0.9
                        elif confidence_text.lower() == "medium":
                            entity_data["confidence"] = 0.6
                        elif confidence_text.lower() == "low":
                            entity_data["confidence"] = 0.3
                    elif detail_line.startswith("Biography:"):
                        entity_data["biography"] = detail_line[len("Biography:"):].strip()
                    elif detail_line.startswith("Key Contributions:"):
                        contributions = detail_line[len("Key Contributions:"):].strip()
                        entity_data["keyContributions"] = [contrib.strip() for contrib in contributions.split(";")]
                    elif detail_line.startswith("Emotional Valence:"):
                        try:
                            entity_data["emotionalValence"] = float(detail_line[len("Emotional Valence:"):].strip())
                        except ValueError:
                            entity_data["emotionalValence"] = 0.0
                    elif detail_line.startswith("Emotional Arousal:"):
                        try:
                            entity_data["emotionalArousal"] = float(detail_line[len("Emotional Arousal:"):].strip())
                        except ValueError:
                            entity_data["emotionalArousal"] = 0.0
                    
                    j += 1
                
                # Skip the detail lines that we've already processed
                if j > i + 1:
                    i = j - 1  # -1 because we'll increment i at the end of the loop
                
                result["entities"].append(entity_data)
            elif current_section == "events":
                # Parse event data with comprehensive attributes
                event_data = {
                    "name": content,
                    "nodeType": "Event",
                    "participants": [],
                    "causalPredecessors": [],
                    "causalSuccessors": []
                }
                
                if "(" in content and ")" in content:
                    base_content = content.split("(", 1)[0].strip()
                    details = content.split("(", 1)[1].rstrip(")")
                    event_data["name"] = base_content
                    
                    # Parse date, location, and other metadata if present
                    if "Date:" in details:
                        date_match = re.search(r"Date: ([^,]+)", details)
                        if date_match:
                            event_data["startDate"] = date_match.group(1).strip()
                    
                    if "End Date:" in details:
                        date_match = re.search(r"End Date: ([^,]+)", details)
                        if date_match:
                            event_data["endDate"] = date_match.group(1).strip()
                    
                    if "Location:" in details:
                        loc_match = re.search(r"Location: ([^,)]+)", details)
                        if loc_match:
                            event_data["location"] = loc_match.group(1).strip()
                    
                    if "Status:" in details:
                        status_match = re.search(r"Status: ([^,)]+)", details)
                        if status_match:
                            event_data["status"] = status_match.group(1).strip()
                    
                    if "Duration:" in details:
                        duration_match = re.search(r"Duration: ([^,)]+)", details)
                        if duration_match:
                            event_data["duration"] = duration_match.group(1).strip()
                
                # Look ahead for additional event details in subsequent lines
                j = i + 1
                while j < len(lines) and (
                    lines[j].strip().startswith("Participants:") or
                    lines[j].strip().startswith("Outcome:") or
                    lines[j].strip().startswith("Significance:") or
                    lines[j].strip().startswith("Emotional Valence:") or
                    lines[j].strip().startswith("Emotional Arousal:") or
                    lines[j].strip().startswith("Causal Predecessors:") or
                    lines[j].strip().startswith("Causal Successors:") or
                    lines[j].strip().startswith("Description:") or
                    lines[j].strip() == ""):
                    
                    detail_line = lines[j].strip()
                    
                    if detail_line.startswith("Participants:"):
                        participants = detail_line[len("Participants:"):].strip()
                        event_data["participants"] = [p.strip() for p in participants.split(",")]
                    elif detail_line.startswith("Outcome:"):
                        event_data["outcome"] = detail_line[len("Outcome:"):].strip()
                    elif detail_line.startswith("Significance:"):
                        event_data["significance"] = detail_line[len("Significance:"):].strip()
                    elif detail_line.startswith("Emotional Valence:"):
                        try:
                            event_data["emotionalValence"] = float(detail_line[len("Emotional Valence:"):].strip())
                        except ValueError:
                            event_data["emotionalValence"] = 0.0
                    elif detail_line.startswith("Emotional Arousal:"):
                        try:
                            event_data["emotionalArousal"] = float(detail_line[len("Emotional Arousal:"):].strip())
                        except ValueError:
                            event_data["emotionalArousal"] = 0.0
                    elif detail_line.startswith("Causal Predecessors:"):
                        predecessors = detail_line[len("Causal Predecessors:"):].strip()
                        event_data["causalPredecessors"] = [p.strip() for p in predecessors.split(",")]
                    elif detail_line.startswith("Causal Successors:"):
                        successors = detail_line[len("Causal Successors:"):].strip()
                        event_data["causalSuccessors"] = [s.strip() for s in successors.split(",")]
                    elif detail_line.startswith("Description:"):
                        event_data["description"] = detail_line[len("Description:"):].strip()
                    
                    j += 1
                
                # Skip the detail lines that we've already processed
                if j > i + 1:
                    i = j - 1  # -1 because we'll increment i at the end of the loop
                
                result["events"].append(event_data)
            elif current_section == "concepts":
                # Parse concept data with comprehensive attributes
                concept_data = {
                    "name": content,
                    "nodeType": "Concept",
                    "examples": [],
                    "relatedConcepts": []
                }
                
                # Extract concept name and definition
                if " - " in content:
                    name_part, definition_part = content.split(" - ", 1)
                    concept_data["name"] = name_part.strip()
                    concept_data["definition"] = definition_part.strip()
                
                # Look ahead for additional concept details in subsequent lines
                j = i + 1
                while j < len(lines) and (
                    lines[j].strip().startswith("Description:") or
                    lines[j].strip().startswith("Examples:") or
                    lines[j].strip().startswith("Domain:") or
                    lines[j].strip().startswith("Significance:") or
                    lines[j].strip().startswith("Related Concepts:") or
                    lines[j].strip().startswith("Perspectives:") or
                    lines[j].strip().startswith("Historical Development:") or
                    lines[j].strip().startswith("Abstraction Level:") or
                    lines[j].strip().startswith("Metaphorical Mappings:") or
                    lines[j].strip().startswith("Emotional Valence:") or
                    lines[j].strip().startswith("Emotional Arousal:") or
                    lines[j].strip() == ""):
                    
                    detail_line = lines[j].strip()
                    
                    if detail_line.startswith("Description:"):
                        concept_data["description"] = detail_line[len("Description:"):].strip()
                    elif detail_line.startswith("Examples:"):
                        examples = detail_line[len("Examples:"):].strip()
                        concept_data["examples"] = [ex.strip() for ex in examples.split(";")]
                    elif detail_line.startswith("Domain:"):
                        concept_data["domain"] = detail_line[len("Domain:"):].strip()
                    elif detail_line.startswith("Significance:"):
                        concept_data["significance"] = detail_line[len("Significance:"):].strip()
                    elif detail_line.startswith("Related Concepts:"):
                        related = detail_line[len("Related Concepts:"):].strip()
                        concept_data["relatedConcepts"] = [rc.strip() for rc in related.split(",")]
                    elif detail_line.startswith("Perspectives:"):
                        perspectives = detail_line[len("Perspectives:"):].strip()
                        concept_data["perspectives"] = [p.strip() for p in perspectives.split(";")]
                    elif detail_line.startswith("Historical Development:"):
                        # This could be complex - either flatten or create structured object
                        concept_data["historicalDevelopment"] = detail_line[len("Historical Development:"):].strip()
                    elif detail_line.startswith("Abstraction Level:"):
                        try:
                            concept_data["abstractionLevel"] = float(detail_line[len("Abstraction Level:"):].strip())
                        except ValueError:
                            concept_data["abstractionLevel"] = 0.5  # Default mid-point
                    elif detail_line.startswith("Metaphorical Mappings:"):
                        mappings = detail_line[len("Metaphorical Mappings:"):].strip()
                        concept_data["metaphoricalMappings"] = [m.strip() for m in mappings.split(";")]
                    elif detail_line.startswith("Emotional Valence:"):
                        try:
                            concept_data["emotionalValence"] = float(detail_line[len("Emotional Valence:"):].strip())
                        except ValueError:
                            concept_data["emotionalValence"] = 0.0
                    elif detail_line.startswith("Emotional Arousal:"):
                        try:
                            concept_data["emotionalArousal"] = float(detail_line[len("Emotional Arousal:"):].strip())
                        except ValueError:
                            concept_data["emotionalArousal"] = 0.0
                    
                    j += 1
                
                # Skip the detail lines that we've already processed
                if j > i + 1:
                    i = j - 1
                
                result["concepts"].append(concept_data)
            elif current_section == "propositions":
                # Parse proposition with comprehensive attributes
                prop_data = {
                    "statement": content,
                    "nodeType": "Proposition",
                    "sources": [],
                    "counterEvidence": []
                }
                
                # Extract label and statement if format is "Label - Statement"
                if " - " in content:
                    label, statement = content.split(" - ", 1)
                    prop_data["name"] = label.strip()
                    prop_data["statement"] = statement.strip()
                else:
                    prop_data["name"] = content
                
                # Extract metadata if present in parentheses
                if "(" in content and ")" in content:
                    metadata = content.split("(", 1)[1].rstrip(")")
                    
                    # Extract confidence
                    if "Confidence:" in metadata:
                        conf_match = re.search(r"Confidence: ([^,]+)", metadata)
                        if conf_match:
                            confidence_text = conf_match.group(1).strip()
                            # Convert text confidence to numeric
                            if confidence_text.lower() == "high":
                                prop_data["confidence"] = 0.9
                            elif confidence_text.lower() == "medium":
                                prop_data["confidence"] = 0.6
                            elif confidence_text.lower() == "low":
                                prop_data["confidence"] = 0.3
                    
                    # Extract domain
                    if "Domain:" in metadata:
                        domain_match = re.search(r"Domain: ([^,)]+)", metadata)
                        if domain_match:
                            prop_data["domain"] = domain_match.group(1).strip()
                    
                    # Extract status
                    if "Status:" in metadata:
                        status_match = re.search(r"Status: ([^,)]+)", metadata)
                        if status_match:
                            prop_data["status"] = status_match.group(1).strip()
                
                # Look ahead for additional proposition details
                j = i + 1
                while j < len(lines) and (
                    lines[j].strip().startswith("Truth Value:") or
                    lines[j].strip().startswith("Sources:") or
                    lines[j].strip().startswith("Evidence Strength:") or
                    lines[j].strip().startswith("Counter Evidence:") or
                    lines[j].strip().startswith("Emotional Valence:") or
                    lines[j].strip().startswith("Emotional Arousal:") or
                    lines[j].strip() == ""):
                    
                    detail_line = lines[j].strip()
                    
                    if detail_line.startswith("Truth Value:"):
                        truth_value = detail_line[len("Truth Value:"):].strip().lower()
                        if truth_value in ["true", "yes", "1"]:
                            prop_data["truthValue"] = True
                        elif truth_value in ["false", "no", "0"]:
                            prop_data["truthValue"] = False
                    elif detail_line.startswith("Sources:"):
                        sources = detail_line[len("Sources:"):].strip()
                        prop_data["sources"] = [s.strip() for s in sources.split(";")]
                    elif detail_line.startswith("Evidence Strength:"):
                        try:
                            prop_data["evidenceStrength"] = float(detail_line[len("Evidence Strength:"):].strip())
                        except ValueError:
                            # Try to interpret textual values
                            evidence_text = detail_line[len("Evidence Strength:"):].strip().lower()
                            if evidence_text == "high":
                                prop_data["evidenceStrength"] = 0.9
                            elif evidence_text == "medium":
                                prop_data["evidenceStrength"] = 0.6
                            elif evidence_text == "low":
                                prop_data["evidenceStrength"] = 0.3
                    elif detail_line.startswith("Counter Evidence:"):
                        counter_evidence = detail_line[len("Counter Evidence:"):].strip()
                        prop_data["counterEvidence"] = [ce.strip() for ce in counter_evidence.split(";")]
                    elif detail_line.startswith("Emotional Valence:"):
                        try:
                            prop_data["emotionalValence"] = float(detail_line[len("Emotional Valence:"):].strip())
                        except ValueError:
                            prop_data["emotionalValence"] = 0.0
                    elif detail_line.startswith("Emotional Arousal:"):
                        try:
                            prop_data["emotionalArousal"] = float(detail_line[len("Emotional Arousal:"):].strip())
                        except ValueError:
                            prop_data["emotionalArousal"] = 0.0
                    
                    j += 1
                
                # Skip the detail lines that we've already processed
                if j > i + 1:
                    i = j - 1
                
                result["propositions"].append(prop_data)
            elif current_section == "attributes":
                # Parse attribute data with comprehensive attributes
                attr_data = {
                    "name": content,
                    "nodeType": "Attribute"
                }
                
                # Extract name and basic value
                if " - " in content:
                    name_part, value_part = content.split(" - ", 1)
                    attr_data["name"] = name_part.replace("Attribute:", "").strip()
                    
                    # Parse value and type
                    if "Value:" in value_part:
                        value_match = re.search(r"Value: ([^,]+)", value_part)
                        if value_match:
                            value_str = value_match.group(1).strip()
                            # Try to convert to appropriate type
                            try:
                                # Try as number first
                                attr_data["value"] = float(value_str)
                                # If it's a whole number, convert to int
                                if attr_data["value"].is_integer():
                                    attr_data["value"] = int(attr_data["value"])
                            except ValueError:
                                # Keep as string if not numeric
                                attr_data["value"] = value_str
                    
                    if "Type:" in value_part:
                        type_match = re.search(r"Type: ([^,)]+)", value_part)
                        if type_match:
                            attr_data["valueType"] = type_match.group(1).strip()
                
                # Look ahead for additional attribute details
                j = i + 1
                while j < len(lines) and (
                    lines[j].strip().startswith("Unit:") or
                    lines[j].strip().startswith("Possible Values:") or
                    lines[j].strip().startswith("Description:") or
                    lines[j].strip().startswith("Value:") or
                    lines[j].strip().startswith("Value Type:") or
                    lines[j].strip() == ""):
                    
                    detail_line = lines[j].strip()
                    
                    if detail_line.startswith("Unit:"):
                        attr_data["unit"] = detail_line[len("Unit:"):].strip()
                    elif detail_line.startswith("Possible Values:"):
                        possible_values = detail_line[len("Possible Values:"):].strip()
                        attr_data["possibleValues"] = [v.strip() for v in possible_values.split(";")]
                    elif detail_line.startswith("Description:"):
                        attr_data["description"] = detail_line[len("Description:"):].strip()
                    elif detail_line.startswith("Value:"):
                        value_str = detail_line[len("Value:"):].strip()
                        # Try to convert to appropriate type
                        try:
                            # Try as number first
                            attr_data["value"] = float(value_str)
                            # If it's a whole number, convert to int
                            if attr_data["value"].is_integer():
                                attr_data["value"] = int(attr_data["value"])
                        except ValueError:
                            # Keep as string if not numeric
                            attr_data["value"] = value_str
                    elif detail_line.startswith("Value Type:"):
                        attr_data["valueType"] = detail_line[len("Value Type:"):].strip()
                    
                    j += 1
                
                # Skip the detail lines that we've already processed
                if j > i + 1:
                    i = j - 1
                
                # Ensure required fields are present
                if "value" not in attr_data:
                    attr_data["value"] = ""
                if "valueType" not in attr_data:
                    # Try to infer valueType from value
                    if isinstance(attr_data["value"], (int, float)):
                        attr_data["valueType"] = "numeric"
                    elif isinstance(attr_data["value"], bool):
                        attr_data["valueType"] = "boolean"
                    else:
                        attr_data["valueType"] = "text"
                
                result["attributes"].append(attr_data)
            elif current_section == "emotions":
                # Parse emotion data with comprehensive attributes
                emotion_data = {
                    "name": content,
                    "nodeType": "Emotion",
                    "intensity": 0.5,  # Default mid-intensity
                    "valence": 0.0     # Default neutral valence
                }
                
                # Extract name and details
                if " - " in content:
                    name_part, description_part = content.split(" - ", 1)
                    emotion_data["name"] = name_part.strip()
                    emotion_data["description"] = description_part.strip()
                
                # Extract metadata if in parentheses
                if "(" in content and ")" in content:
                    metadata_part = content.split("(", 1)[1].rstrip(")")
                    
                    # Extract category
                    if "Category:" in metadata_part:
                        category_match = re.search(r"Category: ([^,)]+)", metadata_part)
                        if category_match:
                            emotion_data["category"] = category_match.group(1).strip()
                    
                    # Extract intensity
                    if "Intensity:" in metadata_part:
                        intensity_match = re.search(r"Intensity: ([^,)]+)", metadata_part)
                        if intensity_match:
                            intensity_text = intensity_match.group(1).strip()
                            try:
                                emotion_data["intensity"] = float(intensity_text)
                            except ValueError:
                                # Convert text to numeric
                                if intensity_text.lower() == "high":
                                    emotion_data["intensity"] = 0.9
                                elif intensity_text.lower() == "medium":
                                    emotion_data["intensity"] = 0.6
                                elif intensity_text.lower() == "low":
                                    emotion_data["intensity"] = 0.3
                    
                    # Extract valence
                    if "Valence:" in metadata_part:
                        valence_match = re.search(r"Valence: ([^,)]+)", metadata_part)
                        if valence_match:
                            valence_text = valence_match.group(1).strip()
                            try:
                                emotion_data["valence"] = float(valence_text)
                            except ValueError:
                                # Convert text to numeric
                                if valence_text.lower() in ["positive", "high"]:
                                    emotion_data["valence"] = 0.7
                                elif valence_text.lower() in ["negative", "low"]:
                                    emotion_data["valence"] = -0.7
                                elif valence_text.lower() in ["neutral", "medium"]:
                                    emotion_data["valence"] = 0.0
                
                # Look ahead for additional emotion details
                j = i + 1
                while j < len(lines) and (
                    lines[j].strip().startswith("Subcategory:") or
                    lines[j].strip().startswith("Description:") or
                    lines[j].strip().startswith("Intensity:") or
                    lines[j].strip().startswith("Valence:") or
                    lines[j].strip().startswith("Category:") or
                    lines[j].strip() == ""):
                    
                    detail_line = lines[j].strip()
                    
                    if detail_line.startswith("Subcategory:"):
                        emotion_data["subcategory"] = detail_line[len("Subcategory:"):].strip()
                    elif detail_line.startswith("Description:"):
                        emotion_data["description"] = detail_line[len("Description:"):].strip()
                    elif detail_line.startswith("Intensity:"):
                        intensity_text = detail_line[len("Intensity:"):].strip()
                        try:
                            emotion_data["intensity"] = float(intensity_text)
                        except ValueError:
                            # Convert text to numeric
                            if intensity_text.lower() == "high":
                                emotion_data["intensity"] = 0.9
                            elif intensity_text.lower() == "medium":
                                emotion_data["intensity"] = 0.6
                            elif intensity_text.lower() == "low":
                                emotion_data["intensity"] = 0.3
                    elif detail_line.startswith("Valence:"):
                        valence_text = detail_line[len("Valence:"):].strip()
                        try:
                            emotion_data["valence"] = float(valence_text)
                        except ValueError:
                            # Convert text to numeric
                            if valence_text.lower() in ["positive", "high"]:
                                emotion_data["valence"] = 0.7
                            elif valence_text.lower() in ["negative", "low"]:
                                emotion_data["valence"] = -0.7
                            elif valence_text.lower() in ["neutral", "medium"]:
                                emotion_data["valence"] = 0.0
                    elif detail_line.startswith("Category:"):
                        emotion_data["category"] = detail_line[len("Category:"):].strip()
                    
                    j += 1
                
                # Skip the detail lines that we've already processed
                if j > i + 1:
                    i = j - 1
                
                result["emotions"].append(emotion_data)
            elif current_section == "agents":
                # Parse agent data with comprehensive attributes
                agent_data = {
                    "name": content,
                    "nodeType": "Agent",
                    "agentType": "human",  # Default
                    "capabilities": [],
                    "beliefs": [],
                    "knowledge": [],
                    "preferences": []
                }
                
                # Extract name and description
                if " - " in content:
                    name_part, description_part = content.split(" - ", 1)
                    agent_data["name"] = name_part.strip()
                    agent_data["description"] = description_part.strip()
                
                # Extract metadata if in parentheses
                if "(" in content and ")" in content:
                    metadata_part = content.split("(", 1)[1].rstrip(")")
                    
                    # Extract agent type
                    if "Type:" in metadata_part:
                        type_match = re.search(r"Type: ([^,)]+)", metadata_part)
                        if type_match:
                            agent_type = type_match.group(1).strip().lower()
                            if agent_type in ["human", "ai", "organization", "other"]:
                                agent_data["agentType"] = agent_type
                
                # Look ahead for additional agent details
                j = i + 1
                while j < len(lines) and (
                    lines[j].strip().startswith("Capabilities:") or
                    lines[j].strip().startswith("Description:") or
                    lines[j].strip().startswith("Beliefs:") or
                    lines[j].strip().startswith("Knowledge:") or
                    lines[j].strip().startswith("Preferences:") or
                    lines[j].strip().startswith("Emotional State:") or
                    # AI-specific attributes
                    lines[j].strip().startswith("Model Name:") or
                    lines[j].strip().startswith("Provider:") or
                    lines[j].strip().startswith("API Endpoint:") or
                    lines[j].strip().startswith("Training Data:") or
                    lines[j].strip().startswith("Operational Constraints:") or
                    lines[j].strip().startswith("Performance Metrics:") or
                    lines[j].strip().startswith("Version:") or
                    lines[j].strip().startswith("Operational Status:") or
                    lines[j].strip().startswith("Ownership:") or
                    lines[j].strip().startswith("Interaction History:") or
                    lines[j].strip() == ""):
                    
                    detail_line = lines[j].strip()
                    
                    if detail_line.startswith("Capabilities:"):
                        capabilities = detail_line[len("Capabilities:"):].strip()
                        agent_data["capabilities"] = [cap.strip() for cap in capabilities.split(";")]
                    elif detail_line.startswith("Description:"):
                        agent_data["description"] = detail_line[len("Description:"):].strip()
                    elif detail_line.startswith("Beliefs:"):
                        beliefs = detail_line[len("Beliefs:"):].strip()
                        agent_data["beliefs"] = [belief.strip() for belief in beliefs.split(";")]
                    elif detail_line.startswith("Knowledge:"):
                        knowledge = detail_line[len("Knowledge:"):].strip()
                        agent_data["knowledge"] = [k.strip() for k in knowledge.split(";")]
                    elif detail_line.startswith("Preferences:"):
                        preferences = detail_line[len("Preferences:"):].strip()
                        agent_data["preferences"] = [pref.strip() for pref in preferences.split(";")]
                    elif detail_line.startswith("Emotional State:"):
                        agent_data["emotionalState"] = detail_line[len("Emotional State:"):].strip()
                    
                    # AI-specific attributes
                    elif detail_line.startswith("Model Name:"):
                        agent_data["modelName"] = detail_line[len("Model Name:"):].strip()
                    elif detail_line.startswith("Provider:"):
                        agent_data["provider"] = detail_line[len("Provider:"):].strip()
                    elif detail_line.startswith("API Endpoint:"):
                        agent_data["apiEndpoint"] = detail_line[len("API Endpoint:"):].strip()
                    elif detail_line.startswith("Training Data:"):
                        training_data = detail_line[len("Training Data:"):].strip()
                        agent_data["trainingData"] = [td.strip() for td in training_data.split(";")]
                    elif detail_line.startswith("Operational Constraints:"):
                        constraints = detail_line[len("Operational Constraints:"):].strip()
                        agent_data["operationalConstraints"] = [c.strip() for c in constraints.split(";")]
                    elif detail_line.startswith("Performance Metrics:"):
                        # This could be complex - either flatten or create structured object
                        agent_data["performanceMetrics"] = detail_line[len("Performance Metrics:"):].strip()
                    elif detail_line.startswith("Version:"):
                        agent_data["version"] = detail_line[len("Version:"):].strip()
                    elif detail_line.startswith("Operational Status:"):
                        agent_data["operationalStatus"] = detail_line[len("Operational Status:"):].strip()
                    elif detail_line.startswith("Ownership:"):
                        agent_data["ownership"] = detail_line[len("Ownership:"):].strip()
                    elif detail_line.startswith("Interaction History:"):
                        history = detail_line[len("Interaction History:"):].strip()
                        agent_data["interactionHistory"] = [h.strip() for h in history.split(";")]
                    
                    j += 1
                
                # Skip the detail lines that we've already processed
                if j > i + 1:
                    i = j - 1
                
                result["agents"].append(agent_data)
            elif current_section == "thoughts":
                # Parse thought data
                thought_data = {"name": content}
                
                if " - " in content:
                    name_part, content_part = content.split(" - ", 1)
                    thought_data["name"] = name_part.replace("Thought:", "").strip()
                    
                    # Extract content and metadata if present
                    if "(" in content_part and ")" in content_part:
                        main_content = content_part.split("(", 1)[0].strip()
                        metadata = content_part.split("(", 1)[1].rstrip(")")
                        
                        thought_data["thoughtContent"] = main_content
                        
                        # Parse source and confidence
                        if "Source:" in metadata:
                            source_match = re.search(r"Source: ([^,]+)", metadata)
                            if source_match:
                                thought_data["source"] = source_match.group(1).strip()
                        
                        if "Confidence:" in metadata:
                            conf_match = re.search(r"Confidence: ([^,)]+)", metadata)
                            if conf_match:
                                confidence_text = conf_match.group(1).strip()
                                if confidence_text.lower() == "high":
                                    thought_data["thoughtConfidenceScore"] = 0.9
                                elif confidence_text.lower() == "medium":
                                    thought_data["thoughtConfidenceScore"] = 0.6
                                elif confidence_text.lower() == "low":
                                    thought_data["thoughtConfidenceScore"] = 0.3
                    else:
                        thought_data["thoughtContent"] = content_part.strip()
                
                result["thoughts"].append(thought_data)
            elif current_section == "scientificInsights":
                # Parse scientific insight data
                insight_data = {"name": content}
                
                if " - " in content:
                    name_part, hypothesis_part = content.split(" - ", 1)
                    insight_data["name"] = name_part.replace("Scientific Insight:", "").strip()
                    
                    # Extract hypothesis and metadata
                    if "(" in hypothesis_part and ")" in hypothesis_part:
                        hypothesis = hypothesis_part.split("(", 1)[0].strip()
                        metadata = hypothesis_part.split("(", 1)[1].rstrip(")")
                        
                        insight_data["hypothesis"] = hypothesis
                        
                        # Parse field and evidence
                        if "Field:" in metadata:
                            field_match = re.search(r"Field: ([^,]+)", metadata)
                            if field_match:
                                insight_data["field"] = field_match.group(1).strip()
                        
                        if "Evidence:" in metadata:
                            evidence_match = re.search(r"Evidence: ([^,)]+)", metadata)
                            if evidence_match:
                                insight_data["evidence"] = [evidence_match.group(1).strip()]
                    else:
                        insight_data["hypothesis"] = hypothesis_part.strip()
                
                result["scientificInsights"].append(insight_data)
            elif current_section == "laws":
                # Parse law data
                law_data = {"name": content}
                
                if " - " in content:
                    name_part, statement_part = content.split(" - ", 1)
                    law_data["name"] = name_part.replace("Law:", "").strip()
                    
                    # Extract statement and metadata
                    if "(" in statement_part and ")" in statement_part:
                        statement = statement_part.split("(", 1)[0].strip()
                        metadata = statement_part.split("(", 1)[1].rstrip(")")
                        
                        law_data["statement"] = statement
                        
                        # Parse domain and conditions
                        if "Domain:" in metadata:
                            domain_match = re.search(r"Domain: ([^,]+)", metadata)
                            if domain_match:
                                law_data["domain"] = domain_match.group(1).strip()
                        
                        if "Conditions:" in metadata:
                            conditions_part = metadata.split("Conditions:", 1)[1].strip()
                            conditions = [c.strip() for c in conditions_part.split(",")]
                            law_data["conditions"] = conditions
                    else:
                        law_data["statement"] = statement_part.strip()
                
                result["laws"].append(law_data)
            elif current_section == "reasoningChains":
                # Parse reasoning chain data
                chain_data = {"name": content}
                
                if " - " in content:
                    name_part, conclusion_part = content.split(" - ", 1)
                    chain_data["name"] = name_part.replace("Reasoning Chain:", "").strip()
                    
                    # Extract conclusion and metadata
                    if "(" in conclusion_part and ")" in conclusion_part:
                        conclusion = conclusion_part.split("(", 1)[0].strip()
                        metadata = conclusion_part.split("(", 1)[1].rstrip(")")
                        
                        chain_data["conclusion"] = conclusion
                        
                        # Parse methodology
                        if "Methodology:" in metadata:
                            method_match = re.search(r"Methodology: ([^,)]+)", metadata)
                            if method_match:
                                chain_data["methodology"] = method_match.group(1).strip()
                    else:
                        chain_data["conclusion"] = conclusion_part.strip()
                
                result["reasoningChains"].append(chain_data)
            elif current_section == "reasoningSteps":
                # Parse reasoning step data
                step_data = {"name": content}
                
                if " - " in content:
                    name_part, content_part = content.split(" - ", 1)
                    step_data["name"] = name_part.replace("Reasoning Step:", "").strip()
                    
                    # Extract content and metadata
                    if "(" in content_part and ")" in content_part:
                        step_content = content_part.split("(", 1)[0].strip()
                        metadata = content_part.split("(", 1)[1].rstrip(")")
                        
                        step_data["content"] = step_content
                        
                        # Parse chain association
                        if "Chain:" in metadata:
                            chain_match = re.search(r"Chain: ([^,)]+)", metadata)
                            if chain_match:
                                step_data["chainName"] = chain_match.group(1).strip()
                        
                        # Parse step type
                        if "StepType:" in metadata:
                            type_match = re.search(r"StepType: ([^,)]+)", metadata)
                            if type_match:
                                step_data["stepType"] = type_match.group(1).strip()
                                
                                # Infer order from step type if possible
                                if step_data["stepType"].lower() == "premise":
                                    # Try to extract a number from the name (e.g., "Premise 1")
                                    number_match = re.search(r'\d+', step_data["name"])
                                    if number_match:
                                        step_data["order"] = int(number_match.group(0))
                                    else:
                                        step_data["order"] = 1  # Default for premises
                                elif step_data["stepType"].lower() == "inference":
                                    step_data["order"] = 50  # Middle position
                                elif step_data["stepType"].lower() == "conclusion":
                                    step_data["order"] = 100  # Last position
                        
                        # Parse explicit order if provided
                        if "Order:" in metadata:
                            order_match = re.search(r"Order: (\d+)", metadata)
                            if order_match:
                                step_data["order"] = int(order_match.group(1))
                        
                        # Parse confidence
                        if "Confidence:" in metadata:
                            conf_match = re.search(r"Confidence: ([^,)]+)", metadata)
                            if conf_match:
                                confidence_text = conf_match.group(1).strip()
                                if confidence_text.lower() == "high":
                                    step_data["confidence"] = 0.9
                                elif confidence_text.lower() == "medium":
                                    step_data["confidence"] = 0.6
                                elif confidence_text.lower() == "low":
                                    step_data["confidence"] = 0.3
                    else:
                        step_data["content"] = content_part.strip()
                
                result["reasoningSteps"].append(step_data)
            elif current_section == "relationships":
                # Parse relationship data with comprehensive properties
                relationship_data = {
                    "description": content,
                    "contextType": "associative",  # Default type
                    "memoryAids": []
                }
                
                # Extract source, target, and relationship type
                if " -> " in content:
                    source_part, target_part = content.split(" -> ", 1)
                    
                    # Extract source entity
                    source_entity = source_part.strip()
                    if "(" in source_entity and ")" in source_entity:
                        source_name = source_entity.split("(", 1)[0].strip()
                        source_type = source_entity.split("(", 1)[1].rstrip(")").strip()
                        relationship_data["source"] = {"name": source_name, "type": source_type}
                    else:
                        relationship_data["source"] = {"name": source_entity, "type": "Entity"}
                    
                    # Extract target and relationship type
                    if " [" in target_part and "]" in target_part:
                        rel_parts = target_part.split(" [", 1)
                        rel_type = rel_parts[1].split("]", 1)[0].strip()
                        target_entity = rel_parts[1].split("]", 1)[1].strip()
                        
                        relationship_data["type"] = rel_type
                        
                        # Extract target entity details
                        if "(" in target_entity and ")" in target_entity:
                            target_name = target_entity.split("(", 1)[0].strip()
                            target_type = target_entity.split("(", 1)[1].rstrip(")").strip()
                            relationship_data["target"] = {"name": target_name, "type": target_type}
                        else:
                            relationship_data["target"] = {"name": target_entity, "type": "Entity"}
                    else:
                        # Handle case where relationship type isn't explicitly marked
                        relationship_data["target"] = {"name": target_part.strip(), "type": "Entity"}
                        relationship_data["type"] = "RELATED_TO"  # Default relationship type
                    
                    # Add properties if they exist
                    if "{" in content and "}" in content:
                        props_str = content.split("{", 1)[1].split("}", 1)[0]
                        props = {}
                        for prop in props_str.split(","):
                            if ":" in prop:
                                key, value = prop.split(":", 1)
                                props[key.strip()] = value.strip()
                        relationship_data["properties"] = props

                    # Look ahead for additional relationship details
                    j = i + 1
                    while j < len(lines) and (
                        lines[j].strip().startswith("Context:") or
                        lines[j].strip().startswith("Confidence:") or
                        lines[j].strip().startswith("Sources:") or
                        lines[j].strip().startswith("Weight:") or
                        lines[j].strip().startswith("Context Type:") or
                        lines[j].strip().startswith("Context Strength:") or
                        lines[j].strip().startswith("Memory Aids:") or
                        lines[j].strip().startswith("Relationship Category:") or
                        lines[j].strip() == ""):
                        
                        detail_line = lines[j].strip()
                        
                        if detail_line.startswith("Context:"):
                            relationship_data["context"] = detail_line[len("Context:"):].strip()
                        elif detail_line.startswith("Confidence:"):
                            confidence_text = detail_line[len("Confidence:"):].strip()
                            try:
                                relationship_data["confidenceScore"] = float(confidence_text)
                            except ValueError:
                                # Convert text confidence to numeric
                                if confidence_text.lower() == "high":
                                    relationship_data["confidenceScore"] = 0.9
                                elif confidence_text.lower() == "medium":
                                    relationship_data["confidenceScore"] = 0.6
                                elif confidence_text.lower() == "low":
                                    relationship_data["confidenceScore"] = 0.3
                        elif detail_line.startswith("Sources:"):
                            sources = detail_line[len("Sources:"):].strip()
                            relationship_data["sources"] = [s.strip() for s in sources.split(";")]
                        elif detail_line.startswith("Weight:"):
                            try:
                                relationship_data["weight"] = float(detail_line[len("Weight:"):].strip())
                            except ValueError:
                                relationship_data["weight"] = 0.5  # Default
                        elif detail_line.startswith("Context Type:"):
                            context_type = detail_line[len("Context Type:"):].strip().lower()
                            if context_type in ["hierarchical", "associative", "causal", "temporal", "analogical", "attributive"]:
                                relationship_data["contextType"] = context_type
                        elif detail_line.startswith("Context Strength:"):
                            try:
                                relationship_data["contextStrength"] = float(detail_line[len("Context Strength:"):].strip())
                            except ValueError:
                                relationship_data["contextStrength"] = 0.5  # Default
                        elif detail_line.startswith("Memory Aids:"):
                            memory_aids = detail_line[len("Memory Aids:"):].strip()
                            relationship_data["memoryAids"] = [ma.strip() for ma in memory_aids.split(";")]
                        elif detail_line.startswith("Relationship Category:"):
                            relationship_data["relationshipCategory"] = detail_line[len("Relationship Category:"):].strip()
                        
                        j += 1
                    
                    # Skip the detail lines that we've already processed
                    if j > i + 1:
                        i = j - 1
                    
                    result["relationships"].append(relationship_data)
                else:
                    # Handle unstructured relationship descriptions
                    logging.warning(f"Relationship not in expected format: {content}")
                    # Still store it but mark it as needing processing
                    result["relationships"].append({
                        "description": content,
                        "needsProcessing": True
                    })
        
        # Process person and location details
        elif current_section == "person_details" and current_person:
            if ":" in line:
                key, value = line.split(":", 1)
                key = key.strip()
                value = value.strip()
                
                # Process structured JSON format
                if key == "Personality Traits" or key == "Cognitive Style" or key == "Emotional Profile" or \
                   key == "Relational Dynamics" or key == "Value System" or key == "Psychological Development" or \
                   key == "Meta Attributes":
                    try:
                        # Lines that start with JSON array or object syntax
                        if value.startswith("[") or value.startswith("{"):
                            # This might be a multi-line JSON structure
                            json_str = value
                            j = i + 1
                            # Collect lines until we have a complete JSON object/array
                            while j < len(lines) and not (lines[j].strip().startswith("-") and ":" in lines[j]):
                                json_str += lines[j].strip()
                                j += 1
                            
                            # Try to parse the collected JSON
                            try:
                                # Replace single quotes with double quotes for JSON parsing
                                json_str = json_str.replace("'", "\"")
                                parsed_json = json.loads(json_str)
                                person_details[current_person][key] = parsed_json
                                # Skip the lines we've already processed
                                i = j - 1  # -1 because we'll increment i at the end of the loop
                                continue
                            except json.JSONDecodeError:
                                # If parsing fails, store as string (fallback)
                                person_details[current_person][key] = json_str
                    except Exception as e:
                        logging.warning(f"Error parsing JSON for person details: {str(e)}")
                        person_details[current_person][key] = value
                else:
                    # For simple string fields
                    person_details[current_person][key] = value
        
        elif current_section == "location_details" and current_location:
            # Split up details for a location entry
            detail_line = line.strip()
            if ":" in detail_line:
                key, value = detail_line.split(":", 1)
                key = key.strip()
                value = value.strip()
                
                # Map to schema fields
                if key == "Type":
                    location_details[current_location]["locationType"] = value
                elif key == "Coordinates":
                    # Parse latitude and longitude
                    try:
                        # Try to extract lat and long if in format "lat: X, long: Y"
                        lat_match = re.search(r"lat(?:itude)?:?\s*([-+]?\d+\.?\d*)", value, re.IGNORECASE)
                        long_match = re.search(r"long(?:itude)?:?\s*([-+]?\d+\.?\d*)", value, re.IGNORECASE)
                        
                        coordinates = {}
                        if lat_match:
                            coordinates["latitude"] = float(lat_match.group(1))
                        if long_match:
                            coordinates["longitude"] = float(long_match.group(1))
                        
                        # If we couldn't parse in the previous format, try comma-separated
                        if not coordinates and "," in value:
                            parts = value.split(",")
                            if len(parts) >= 2:
                                try:
                                    coordinates["latitude"] = float(parts[0].strip())
                                    coordinates["longitude"] = float(parts[1].strip())
                                except ValueError:
                                    pass
                        
                        if coordinates:
                            location_details[current_location]["coordinates"] = coordinates
                    except Exception as e:
                        logging.warning(f"Error parsing coordinates: {e}")
                elif key == "Description":
                    location_details[current_location]["description"] = value
                elif key == "Significance":
                    location_details[current_location]["locationSignificance"] = value
                else:
                    # Store other fields as is
                    location_details[current_location][key.lower()] = value
            
            # At the end of the parsing, make sure to store this in the result
            if current_location and current_location not in result["locationDetails"]:
                location_data = location_details[current_location].copy()
                location_data["name"] = current_location
                location_data["nodeType"] = "Location"
                result["locationDetails"][current_location] = location_data
        
        i += 1
    
    # Add the parsed details to the result
    result["personDetails"] = person_details
    result["locationDetails"] = location_details
    
    # When adding to result collections, ensure required attributes are present
    for i in range(len(result["entities"])):
        if isinstance(result["entities"][i], dict):
            result["entities"][i] = ensure_required_attributes(result["entities"][i], "Entity")
    
    for i in range(len(result["events"])):
        if isinstance(result["events"][i], dict):
            result["events"][i] = ensure_required_attributes(result["events"][i], "Event")
    
    for i in range(len(result["concepts"])):
        if isinstance(result["concepts"][i], dict):
            result["concepts"][i] = ensure_required_attributes(result["concepts"][i], "Concept")
            
    for i in range(len(result["propositions"])):
        if isinstance(result["propositions"][i], dict):
            result["propositions"][i] = ensure_required_attributes(result["propositions"][i], "Proposition")
            
    for i in range(len(result["attributes"])):
        if isinstance(result["attributes"][i], dict):
            result["attributes"][i] = ensure_required_attributes(result["attributes"][i], "Attribute")
            
    for i in range(len(result["emotions"])):
        if isinstance(result["emotions"][i], dict):
            result["emotions"][i] = ensure_required_attributes(result["emotions"][i], "Emotion")
            
    for i in range(len(result["agents"])):
        if isinstance(result["agents"][i], dict):
            result["agents"][i] = ensure_required_attributes(result["agents"][i], "Agent")
            
    for i in range(len(result["thoughts"])):
        if isinstance(result["thoughts"][i], dict):
            result["thoughts"][i] = ensure_required_attributes(result["thoughts"][i], "Thought")
            
    for i in range(len(result["scientificInsights"])):
        if isinstance(result["scientificInsights"][i], dict):
            result["scientificInsights"][i] = ensure_required_attributes(result["scientificInsights"][i], "ScientificInsight")
            
    for i in range(len(result["laws"])):
        if isinstance(result["laws"][i], dict):
            result["laws"][i] = ensure_required_attributes(result["laws"][i], "Law")
            
    for i in range(len(result["reasoningChains"])):
        if isinstance(result["reasoningChains"][i], dict):
            result["reasoningChains"][i] = ensure_required_attributes(result["reasoningChains"][i], "ReasoningChain")
            
    for i in range(len(result["reasoningSteps"])):
        if isinstance(result["reasoningSteps"][i], dict):
            result["reasoningSteps"][i] = ensure_required_attributes(result["reasoningSteps"][i], "ReasoningStep")
    
    return result

async def extract_knowledge(text_chunk):
    """Extract knowledge entities from text using GPT-4 with retries"""
    # Update the prompt to include guidance on relationship formatting
    relationship_guidance = """
    For relationships, please format them following Neo4j best practices:
    - SourceEntity(EntityType) -> [RELATIONSHIP_TYPE] TargetEntity(EntityType) {{property1: value1, property2: value2}}
    
    Use specific, descriptive relationship types (verbs in UPPERCASE_WITH_UNDERSCORES).
    Choose relationship direction based on the most natural query direction.
    Examples:
    - John Smith(Person) -> [WORKS_FOR] Acme Inc(Organization) {{since: "2020", position: "Senior Developer"}}
    - Climate Change(Concept) -> [IMPACTS] Polar Ice Caps(Location) {{severity: "high", timeframe: "ongoing"}}
    - Einstein(Person) -> [DEVELOPED] Theory of Relativity(Concept) {{year: "1915"}}
    """
    
    # Add guidance for structured person details
    person_details_guidance = """
    IMPORTANT: When extracting Person Details, return structured data in valid JSON format.
    Use proper nesting of objects and arrays, and make sure all JSON is well-formed.
    
    For Person Details, be sure to include:
    1. All sections: Personality Traits, Cognitive Style, Emotional Profile, Relational Dynamics, 
       Value System, Psychological Development, and Meta Attributes.
    2. Format arrays as valid JSON arrays with objects: [{{"key": "value"}}, {{"key": "value"}}]
    3. Format objects as valid JSON objects: {{"key1": "value1", "key2": {{"nestedKey": "nestedValue"}}}}
    4. Ensure all strings are properly quoted and all objects/arrays properly closed.
    
    Example of well-structured Person Details format:
    Person Details for John Doe:
    - Biography: Accomplished scientist and philanthropist.
    - Personality Traits: [
        {{"trait": "Analytical", "evidence": ["decision-making pattern", "problem-solving approach"], "confidence": 0.9}},
        {{"trait": "Compassionate", "evidence": ["philanthropic activities"], "confidence": 0.8}}
      ]
    - Cognitive Style: {{
        "decisionMaking": "Data-driven", 
        "problemSolving": "Systematic",
        "worldview": "Scientific realism",
        "biases": ["confirmation bias"]
      }}
    """
    
    # Append both guidance sections to the extraction prompt
    enhanced_prompt_template = EXTRACTION_PROMPT_TEMPLATE + relationship_guidance + person_details_guidance
    prompt = ChatPromptTemplate.from_template(enhanced_prompt_template)
    
    # Initialize GPT-4 model with retries
    gpt4_model = ChatOpenAI(model_name="gpt-4.5-preview-2025-02-27", temperature=0)
    
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            # Extract knowledge using the LLM
            chain = prompt | gpt4_model
            result = await chain.ainvoke({"text": text_chunk.page_content})
            
            # Parse the response
            parsed_result = parse_gpt4_response(result.content)
            return parsed_result
        
        except Exception as e:
            retry_count += 1
            if retry_count < max_retries:
                logging.warning(f"Error extracting knowledge: {str(e)}. Retrying ({retry_count}/{max_retries})...")
                await asyncio.sleep(2)  # Wait before retrying
            else:
                logging.error(f"Failed to extract knowledge after {max_retries} attempts: {str(e)}")
                return None

async def process_chunks(chunks, batch_size=5, checkpoint_frequency=10):
    """Process text chunks in batches with checkpointing"""
    results = []
    total_chunks = len(chunks)
    
    for i in tqdm(range(0, total_chunks, batch_size), desc="Processing batches"):
        batch = chunks[i:i+batch_size]
        try:
            batch_results = await asyncio.gather(*[extract_knowledge(chunk) for chunk in batch])
            valid_results = [r for r in batch_results if r]
            results.extend(valid_results)
            
            # More efficient checkpointing - only save at intervals and rotate files
            if i % (batch_size * checkpoint_frequency) == 0:
                try:
                    checkpoint_file = f'checkpoint_latest.json'
                    with open(checkpoint_file, 'w') as f:
                        json.dump(results, f)
                    logging.info(f"Saved checkpoint at batch {i//batch_size}")
                except Exception as e:
                    logging.warning(f"Failed to save checkpoint: {str(e)}")
        except Exception as e:
            logging.error(f"Error processing batch starting at index {i}: {str(e)}")
            # Continue with next batch instead of failing the entire process
            continue
        
    return results 