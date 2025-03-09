"""Text extraction and processing for knowledge graph."""

import re
import asyncio
import json
import logging
import os
from datetime import datetime
from tqdm import tqdm
from langchain.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from kg_schema import EXTRACTION_PROMPT_TEMPLATE, RELATIONSHIP_TYPES, RELATIONSHIP_CATEGORIES
from kg_utils import standardize_entity
import time
from typing import List, Dict, Any, Tuple, Optional

from langchain.text_splitter import RecursiveCharacterTextSplitter

def clean_json_content(json_content):
    """Clean and normalize JSON content to fix common formatting issues"""
    # Replace single quotes with double quotes
    cleaned = json_content.replace("'", '"')
    
    # Quote unquoted keys
    cleaned = re.sub(r'([{,])\s*(\w+):', r'\1"\2":', cleaned)
    
    # Remove trailing commas (common in LLM-generated JSON)
    cleaned = re.sub(r',\s*}', '}', cleaned)
    cleaned = re.sub(r',\s*]', ']', cleaned)
    
    # Handle multi-line strings and normalize whitespace in string values
    cleaned = re.sub(r'"\s*\n\s*([^"]*)\s*\n\s*"', r'"\1"', cleaned)
    
    # Remove any non-standard JSON comments
    cleaned = re.sub(r'//.*?(\n|$)', r'\1', cleaned)
    cleaned = re.sub(r'/\*.*?\*/', '', cleaned, flags=re.DOTALL)
    
    # Fix boolean and null values that might be unquoted
    cleaned = re.sub(r':\s*True', r': true', cleaned)
    cleaned = re.sub(r':\s*False', r': false', cleaned)
    cleaned = re.sub(r':\s*None', r': null', cleaned)
    
    # Fix common errors with properties that cause parse failures
    cleaned = re.sub(r':\s*"([^"]*),([^"]*)"', r': "\1, \2"', cleaned)  # Fix commas inside string values
    cleaned = re.sub(r'"(\w+)":\s*,', r'"\1": null,', cleaned)  # Handle missing values
    cleaned = re.sub(r',\s*"(\w+)":\s*}', r'}', cleaned)  # Handle trailing property with missing value
    
    # Fix quote escaping issues
    cleaned = re.sub(r'(?<!\\)"(?=\w+":)', r'\\"', cleaned)  # Fix unescaped quotes in keys
    cleaned = re.sub(r'(?<!\\\s)"\s*$', r'\\"', cleaned, flags=re.MULTILINE)  # Fix unescaped quotes at end of lines
    
    return cleaned

def validate_relationship_type(rel_type):
    """Validate and normalize relationship type against the schema
    
    Args:
        rel_type: The relationship type to validate
        
    Returns:
        Tuple of (valid_rel_type, relationship_category)
    """
    # Convert to uppercase for consistent comparison
    normalized_type = rel_type.upper()
    
    # Check if the relationship type is in the schema
    if normalized_type in RELATIONSHIP_TYPES:
        # Find the corresponding category
        category = None
        
        # Determine the category based on the relationship type
        if normalized_type in ["IS_A", "INSTANCE_OF", "SUB_CLASS_OF", "SUPER_CLASS_OF"]:
            category = "hierarchical"
        elif normalized_type in ["HAS_PART", "PART_OF"]:
            category = "compositional"
        elif normalized_type in ["LOCATED_IN", "HAS_LOCATION", "CONTAINED_IN", "CONTAINS", "OCCURRED_AT"]:
            category = "compositional"  # spatial relationships are compositional
        elif normalized_type in ["HAS_TIME", "OCCURS_ON", "BEFORE", "AFTER", "DURING", "NEXT", "PREVIOUS"]:
            category = "temporal"
        elif normalized_type in ["CAUSES", "CAUSED_BY", "INFLUENCES", "INFLUENCED_BY"]:
            category = "causal"
        elif normalized_type in ["HAS_PROPERTY", "PROPERTY_OF"]:
            category = "attributive"
        elif normalized_type in ["KNOWS", "FRIEND_OF", "MEMBER_OF"]:
            category = "lateral"  # social relationships
        elif normalized_type in ["RELATED_TO", "ASSOCIATED_WITH"]:
            category = "lateral"  # general relationships
        elif normalized_type in ["EXPRESSES_EMOTION", "FEELS", "EVOKES_EMOTION"]:
            category = "attributive"  # emotional relationships
        elif normalized_type in ["BELIEVES", "SUPPORTS", "CONTRADICTS"]:
            category = "attributive"  # belief relationships
        elif normalized_type in ["DERIVED_FROM", "CITES", "SOURCE"]:
            category = "lateral"  # source relationships
        elif normalized_type in ["MENTORS", "MENTORED_BY", "ADMIRES", "ADMIRED_BY", "OPPOSES", "OPPOSED_BY",
                                "SHAPED_BY", "TRANSFORMED", "EXHIBITS_TRAIT", "HAS_PERSONALITY", 
                                "HAS_COGNITIVE_STYLE", "STRUGGLES_WITH", "VALUES", "ADHERES_TO", 
                                "REJECTS", "HAS_ETHICAL_FRAMEWORK", "LOYAL_TO"]:
            category = "attributive"  # person-specific relationships
        elif normalized_type in ["PARTICIPANT", "HAS_PARTICIPANT", "AGENT", "HAS_AGENT", "PATIENT", "HAS_PATIENT"]:
            category = "causal"  # participation relationships are related to causal relationships
        else:
            # Default for other relationship types
            category = "lateral"
        
        return normalized_type, category
    else:
        logging.warning(f"Non-standard relationship type: {rel_type}")
        # Default to RELATED_TO for invalid relationship types
        return "RELATED_TO", "lateral"

def parse_gpt4_response(response, use_validation=False):
    """Parse the GPT-4 response into structured data
    
    Args:
        response (str): The LLM response text to parse
        use_validation (bool): If True, validate and add required attributes for each node type.
                              If False, don't add missing attributes (useful for initial parsing).
    """
    # For completely empty responses
    if not response or response.strip() == "":
        logging.warning("Received empty response from LLM")
        return {}
        
    # First, try to detect if the entire response contains structured JSON 
    # regardless of surrounding text or markdown
    try:
        # Check if the response is already a JSON object
        response_str = response.strip()
        
        # Case 1: Direct JSON object - looks for entire response being valid JSON
        if response_str.startswith('{') and response_str.endswith('}'):
            logging.info("Response appears to be a complete JSON object, attempting direct parsing")
            try:
                # First, clean the JSON to handle common formatting issues
                cleaned_json = clean_json_content(response_str)
                result = json.loads(cleaned_json)
                
                # Ensure we have the expected structure
                for key in ["entities", "events", "concepts", "propositions", "attributes", 
                           "emotions", "agents", "thoughts", "scientificInsights", "laws", 
                           "reasoningChains", "reasoningSteps", "relationships", 
                           "personDetails", "locationDetails"]:
                    if key not in result:
                        result[key] = []
                
                # Normalize structure for relationships and entities if requested
                if use_validation:
                    # For entities
                    for entity in result.get("entities", []):
                        ensure_required_attributes(entity, "Entity", include_optional=True)
                        
                    # For relationships - fix any inconsistencies in structure
                    for relationship in result.get("relationships", []):
                        # Ensure source has proper structure
                        if "source" in relationship and isinstance(relationship["source"], str):
                            relationship["source"] = {"name": relationship["source"], "type": "Entity"}
                        
                        # Ensure target has proper structure    
                        if "target" in relationship and isinstance(relationship["target"], str):
                            relationship["target"] = {"name": relationship["target"], "type": "Entity"}
                        
                        # Ensure relationship type is valid and normalized
                        if "relationshipType" in relationship and "type" not in relationship:
                            relationship["type"] = relationship["relationshipType"]
                            
                        # Ensure we have a relationship category    
                        if "relationshipCategory" not in relationship and "type" in relationship:
                            rel_type, rel_category = validate_relationship_type(relationship["type"])
                            relationship["relationshipCategory"] = rel_category
                
                return result
            except json.JSONDecodeError as e:
                logging.warning(f"Failed to parse direct JSON: {str(e)}")
                # Continue with other parsing methods
            
        # Case 2: JSON block inside markdown code blocks - most common from LLMs
        code_block_matches = re.findall(r'```(?:json)?\s*\n([\s\S]*?)\n```', response_str)
        if code_block_matches:
            logging.info(f"Found {len(code_block_matches)} code blocks in response, checking for valid JSON")
            for block in code_block_matches:
                try:
                    # Clean up potential issues before parsing
                    json_content = clean_json_content(block.strip())
                    
                    # Try to parse as JSON
                    if json_content.startswith('{') and json_content.endswith('}'):
                        result = json.loads(json_content)
                        logging.info("Successfully parsed JSON from code block")
                        
                        # Ensure we have the expected structure
                        for key in ["entities", "events", "concepts", "propositions", "attributes", 
                                   "emotions", "agents", "thoughts", "scientificInsights", "laws", 
                                   "reasoningChains", "reasoningSteps", "relationships", 
                                   "personDetails", "locationDetails"]:
                            if key not in result:
                                result[key] = []
                                
                        # Normalize structure if requested
                        if use_validation:
                            # For entities
                            for entity in result.get("entities", []):
                                ensure_required_attributes(entity, "Entity", include_optional=True)
                                
                            # For relationships - normalize structure
                            for relationship in result.get("relationships", []):
                                # Ensure source has proper structure
                                if "source" in relationship and isinstance(relationship["source"], str):
                                    relationship["source"] = {"name": relationship["source"], "type": "Entity"}
                                
                                # Ensure target has proper structure    
                                if "target" in relationship and isinstance(relationship["target"], str):
                                    relationship["target"] = {"name": relationship["target"], "type": "Entity"}
                                
                                # Ensure relationship type is valid and normalized
                                if "relationshipType" in relationship and "type" not in relationship:
                                    relationship["type"] = relationship["relationshipType"]
                                    
                                # Ensure we have a relationship category    
                                if "relationshipCategory" not in relationship and "type" in relationship:
                                    rel_type, rel_category = validate_relationship_type(relationship["type"])
                                    relationship["relationshipCategory"] = rel_category
                        
                        return result
                except json.JSONDecodeError as e:
                    logging.warning(f"Failed to parse potential JSON code block: {str(e)}")
                    # Continue checking other blocks
        
        # Case 3: Look for JSON object anywhere in the text
        json_regex = r'({(?:[^{}]|(?R))*})'
        matches = re.finditer(json_regex, response_str, re.DOTALL)
        for match in matches:
            try:
                potential_json = match.group(0)
                # Clean up common issues
                potential_json = potential_json.replace("'", '"')  # Replace single quotes
                potential_json = re.sub(r'([{,])\s*(\w+):', r'\1"\2":', potential_json)  # Quote keys
                potential_json = re.sub(r',\s*}', '}', potential_json)  # Remove trailing commas
                
                # Check if it looks like our expected structure
                result = json.loads(potential_json)
                if any(key in result for key in ["entities", "events", "concepts", "propositions", 
                                              "attributes", "emotions", "agents", "thoughts"]):
                    logging.info("Found and parsed JSON object embedded in text")
                    # Ensure we have the expected structure
                    for key in ["entities", "events", "concepts", "propositions", "attributes", 
                               "emotions", "agents", "thoughts", "scientificInsights", "laws", 
                               "reasoningChains", "reasoningSteps", "relationships", 
                               "personDetails", "locationDetails"]:
                        if key not in result:
                            result[key] = []
                    return result
            except (json.JSONDecodeError, re.error) as e:
                logging.warning(f"Failed to parse potential JSON within text: {str(e)}")
                # Continue checking
    except Exception as e:
        logging.warning(f"Error during initial JSON detection: {str(e)}")
        # Continue with regular parsing
    
    # Default structure for results
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
    # Enhanced to catch more markdown and heading variations
    entity_headers = [r"(?:##?\s*)?(?:Entities?|Named Entities?)(?::|\.|\s+|$)", r"\*\*Entities?\*\*(?::|\.|\s+|$)"]
    event_headers = [r"(?:##?\s*)?Events?(?::|\.|\s+|$)", r"\*\*Events?\*\*(?::|\.|\s+|$)"]
    concept_headers = [r"(?:##?\s*)?Concepts?(?::|\.|\s+|$)", r"\*\*Concepts?\*\*(?::|\.|\s+|$)"]
    proposition_headers = [r"(?:##?\s*)?Propositions?(?::|\.|\s+|$)", r"\*\*Propositions?\*\*(?::|\.|\s+|$)"]
    attribute_headers = [r"(?:##?\s*)?Attributes?(?::|\.|\s+|$)", r"\*\*Attributes?\*\*(?::|\.|\s+|$)"]
    emotion_headers = [r"(?:##?\s*)?Emotions?(?::|\.|\s+|$)", r"\*\*Emotions?\*\*(?::|\.|\s+|$)"]
    agent_headers = [r"(?:##?\s*)?Agents?(?::|\.|\s+|$)", r"\*\*Agents?\*\*(?::|\.|\s+|$)"]
    thought_headers = [r"(?:##?\s*)?Thoughts?(?::|\.|\s+|$)", r"\*\*Thoughts?\*\*(?::|\.|\s+|$)"]
    scientific_insight_headers = [r"(?:##?\s*)?Scientific Insights?(?::|\.|\s+|$)", r"\*\*Scientific Insights?\*\*(?::|\.|\s+|$)"]
    law_headers = [r"(?:##?\s*)?Laws?(?::|\.|\s+|$)", r"\*\*Laws?\*\*(?::|\.|\s+|$)"]
    reasoning_chain_headers = [r"(?:##?\s*)?Reasoning Chains?(?::|\.|\s+|$)", r"\*\*Reasoning Chains?\*\*(?::|\.|\s+|$)"]
    reasoning_step_headers = [r"(?:##?\s*)?Reasoning Steps?(?::|\.|\s+|$)", r"\*\*Reasoning Steps?\*\*(?::|\.|\s+|$)"]
    relationship_headers = [r"(?:##?\s*)?Relationships?(?::|\.|\s+|$)", r"\*\*Relationships?\*\*(?::|\.|\s+|$)"]
    person_details_headers = [r"(?:##?\s*)?Person Details for (.+?)(?::|\.|\s+|$)", r"\*\*Person Details for (.+?)\*\*(?::|\.|\s+|$)"]
    location_details_headers = [r"(?:##?\s*)?Location Details for (.+?)(?::|\.|\s+|$)", r"\*\*Location Details for (.+?)\*\*(?::|\.|\s+|$)"]
    
    # Helper function to handle JSON blocks
    def extract_json_block(start_idx):
        """Extract a JSON block starting from the given index"""
        # Try to find JSON enclosed in code blocks first
        json_start = None
        json_end = None
        
        # Log the current section being processed
        if start_idx < len(lines):
            logging.debug(f"Looking for JSON block starting at line: '{lines[start_idx][:50]}...'")
        
        # Case 1: Look for ```json code blocks - most common in LLM responses
        for j in range(start_idx, min(len(lines), start_idx + 20)):  # Limit search range to avoid search entire doc
            # Match various markdown code block formats
            if any(marker in lines[j].lower() for marker in ["```json", "``` json", "```\njson", "```"]):
                if "```" in lines[j] and j + 1 < len(lines):
                    json_start = j + 1
                    logging.debug(f"Found JSON code block start at line {j+1}")
                    break
        
        if json_start is not None:
            # Search for the end marker
            for j in range(json_start, min(len(lines), json_start + 200)):  # Reasonable limit for JSON block size
                if "```" in lines[j]:
                    json_end = j
                    logging.debug(f"Found JSON code block end at line {j+1}")
                    break
            
            if json_end is not None:
                json_content = "\n".join(lines[json_start:json_end]).strip()
                try:
                    # Attempt to fix common JSON formatting issues
                    cleaned_json = clean_json_content(json_content)
                    
                    json_obj = json.loads(cleaned_json)
                    logging.debug(f"Successfully parsed JSON from code block: {len(cleaned_json)} chars")
                    return json_obj, json_end + 1
                except json.JSONDecodeError as e:
                    logging.warning(f"Failed to parse JSON in code block: {str(e)}\nContent: {json_content[:100]}...")
                    # Continue to other methods if this fails
        
        # Case 2: Look for JSON directly in the text (no markdown)
        logging.debug(f"No valid JSON code block found, trying to extract JSON directly from text")
        
        # First, try to detect the simplest case - a complete JSON object on single or multiple lines
        full_text = "\n".join(lines[start_idx:min(len(lines), start_idx + 100)])
        # Get rid of leading/trailing markdown or text noise
        full_text = re.sub(r'^.*?({)', r'\1', full_text, flags=re.DOTALL)
        try:
            # Look for balanced braces to extract the complete JSON
            brace_level = 0
            start_pos = -1
            for i, char in enumerate(full_text):
                if char == '{':
                    if brace_level == 0:
                        start_pos = i
                    brace_level += 1
                elif char == '}':
                    brace_level -= 1
                    if brace_level == 0 and start_pos != -1:
                        potential_json = full_text[start_pos:i+1]
                        try:
                            # Clean and parse the potential JSON
                            cleaned_json = clean_json_content(potential_json)
                            json_obj = json.loads(cleaned_json)
                            logging.debug(f"Extracted valid JSON object using brace matching")
                            
                            # Calculate the ending line number for parser to continue
                            preceding_text = full_text[:start_pos]
                            line_count = preceding_text.count('\n')
                            return json_obj, start_idx + line_count + potential_json.count('\n') + 1
                        except json.JSONDecodeError:
                            # Continue searching if this particular object fails
                            pass
        except Exception as e:
            logging.warning(f"Error in brace matching JSON extraction: {str(e)}")
        
        # If all previous methods failed, try regex as a last resort
        try:
            # Pattern for matching JSON objects (will handle basic nested structure)
            # Much more reliable than the recursive regex that can cause stack overflows
            pattern = r'(\{(?:[^{}]|(?:\{[^{}]*\}))*\})'
            matches = re.finditer(pattern, full_text)
            
            for match in matches:
                potential_json = match.group(0)
                try:
                    # Clean and try to parse
                    cleaned_json = clean_json_content(potential_json)
                    json_obj = json.loads(cleaned_json)
                    logging.debug(f"Extracted valid JSON object using regex pattern matching")
                    
                    # Calculate the ending line number
                    preceding_text = full_text[:match.start()]
                    line_count = preceding_text.count('\n')
                    return json_obj, start_idx + line_count + potential_json.count('\n') + 1
                except json.JSONDecodeError:
                    continue
        except Exception as e:
            logging.warning(f"Error in regex JSON extraction: {str(e)}")
        
        # If we got here, we couldn't find a valid JSON object
        logging.warning(f"No valid JSON object found in response")
        return None, start_idx
    
    # Helper function to extract required attributes
    def ensure_required_attributes(node_dict, node_type, include_optional=False):
        """Ensure the node has all required attributes for its type based on GraphSchema.md
        
        Args:
            node_dict: The node dictionary to validate/enhance
            node_type: The type of node being processed
            include_optional: If True, include all optional fields with defaults.
                             If False, only include required fields.
        """
        if not isinstance(node_dict, dict):
            logging.warning(f"Node is not a dictionary: {type(node_dict)}")
            # Create a minimal valid dict for this node type
            node_dict = {"name": f"Auto-generated {node_type}", "nodeType": node_type}
            
        # Add nodeType if missing
        if 'nodeType' not in node_dict:
            node_dict['nodeType'] = node_type
        
        # Add name if missing (critical for Neo4j)
        if 'name' not in node_dict or not node_dict['name']:
            node_dict['name'] = f"Unnamed {node_type} {datetime.now().strftime('%Y%m%d%H%M%S')}"
            
        # Ensure required attributes based on node type
        if node_type == 'Entity':
            # Required fields from GraphSchema.md
            if 'observations' not in node_dict:
                node_dict['observations'] = []
            
            # Optional fields only added when requested
            if include_optional:
                if 'subType' not in node_dict:
                    node_dict['subType'] = None
                if 'confidence' not in node_dict:
                    node_dict['confidence'] = 0.5
                if 'source' not in node_dict:
                    node_dict['source'] = None
                if 'description' not in node_dict:
                    node_dict['description'] = None
                if 'biography' not in node_dict:
                    node_dict['biography'] = None
                if 'keyContributions' not in node_dict:
                    node_dict['keyContributions'] = []
                if 'emotionalValence' not in node_dict:
                    node_dict['emotionalValence'] = 0.0
                if 'emotionalArousal' not in node_dict:
                    node_dict['emotionalArousal'] = 0.0
                
                # Person details handling
                if node_dict.get('subType') == 'Person' and 'personDetails' not in node_dict:
                    node_dict['personDetails'] = {}
                
        elif node_type == 'Event':
            # Required fields
            if 'participants' not in node_dict:
                node_dict['participants'] = []
            if 'outcome' not in node_dict:
                node_dict['outcome'] = None
                
            # Optional fields only added when requested
            if include_optional:
                if 'startDate' not in node_dict:
                    node_dict['startDate'] = None
                if 'endDate' not in node_dict:
                    node_dict['endDate'] = None
                if 'status' not in node_dict:
                    node_dict['status'] = None
                if 'timestamp' not in node_dict:
                    node_dict['timestamp'] = None
                if 'duration' not in node_dict:
                    node_dict['duration'] = None
                if 'location' not in node_dict:
                    node_dict['location'] = None
                if 'significance' not in node_dict:
                    node_dict['significance'] = None
                if 'emotionalValence' not in node_dict:
                    node_dict['emotionalValence'] = 0.0
                if 'emotionalArousal' not in node_dict:
                    node_dict['emotionalArousal'] = 0.0
                if 'causalPredecessors' not in node_dict:
                    node_dict['causalPredecessors'] = []
                if 'causalSuccessors' not in node_dict:
                    node_dict['causalSuccessors'] = []
                if 'subType' not in node_dict:
                    node_dict['subType'] = None
                
        elif node_type == 'Concept':
            # Required fields
            if 'definition' not in node_dict:
                node_dict['definition'] = ""
            if 'examples' not in node_dict:
                node_dict['examples'] = []
            if 'relatedConcepts' not in node_dict:
                node_dict['relatedConcepts'] = []
            if 'domain' not in node_dict:
                node_dict['domain'] = ""
                
            # Optional fields only added when requested
            if include_optional:
                if 'description' not in node_dict:
                    node_dict['description'] = None
                if 'significance' not in node_dict:
                    node_dict['significance'] = None
                if 'perspectives' not in node_dict:
                    node_dict['perspectives'] = []
                if 'historicalDevelopment' not in node_dict:
                    node_dict['historicalDevelopment'] = []
                if 'emotionalValence' not in node_dict:
                    node_dict['emotionalValence'] = 0.0
                if 'emotionalArousal' not in node_dict:
                    node_dict['emotionalArousal'] = 0.0
                if 'abstractionLevel' not in node_dict:
                    node_dict['abstractionLevel'] = 0.5  # Middle of scale
                if 'metaphoricalMappings' not in node_dict:
                    node_dict['metaphoricalMappings'] = []
                
        elif node_type == 'Proposition':
            # Required fields
            if 'statement' not in node_dict:
                node_dict['statement'] = ""
            if 'status' not in node_dict:
                node_dict['status'] = "claim"
            if 'confidence' not in node_dict:
                node_dict['confidence'] = 0.5
                
            # Optional fields only added when requested
            if include_optional:
                if 'truthValue' not in node_dict:
                    node_dict['truthValue'] = None
                if 'sources' not in node_dict:
                    node_dict['sources'] = []
                if 'domain' not in node_dict:
                    node_dict['domain'] = None
                if 'emotionalValence' not in node_dict:
                    node_dict['emotionalValence'] = 0.0
                if 'emotionalArousal' not in node_dict:
                    node_dict['emotionalArousal'] = 0.0
                if 'evidenceStrength' not in node_dict:
                    node_dict['evidenceStrength'] = 0.0
                if 'counterEvidence' not in node_dict:
                    node_dict['counterEvidence'] = []
                
        # Only include minimal required fields for other node types unless specifically requested
        # This drastically reduces data bloat while ensuring valid nodes
        
        elif node_type == 'Attribute':
            # Required fields
            if 'value' not in node_dict:
                node_dict['value'] = ""
            if 'valueType' not in node_dict:
                # Try to infer value type
                if isinstance(node_dict.get('value'), (int, float)):
                    node_dict['valueType'] = "numeric"
                elif isinstance(node_dict.get('value'), bool):
                    node_dict['valueType'] = "boolean"
                else:
                    node_dict['valueType'] = "text"
                
            # Optional fields only added when requested
            if include_optional:
                if 'unit' not in node_dict:
                    node_dict['unit'] = None
                if 'possibleValues' not in node_dict:
                    node_dict['possibleValues'] = []
                if 'description' not in node_dict:
                    node_dict['description'] = None
                
        elif node_type == 'Emotion':
            # Required fields
            if 'intensity' not in node_dict:
                node_dict['intensity'] = 0.5
            if 'valence' not in node_dict:
                node_dict['valence'] = 0.0
            if 'category' not in node_dict:
                node_dict['category'] = ""
                
            # Optional fields only added when requested
            if include_optional:
                if 'subcategory' not in node_dict:
                    node_dict['subcategory'] = None
                if 'description' not in node_dict:
                    node_dict['description'] = None
                
        elif node_type == 'Agent':
            # Required fields
            if 'agentType' not in node_dict:
                node_dict['agentType'] = "human"
            if 'capabilities' not in node_dict:
                node_dict['capabilities'] = []
                
            # Optional fields only added when requested
            if include_optional:
                if 'description' not in node_dict:
                    node_dict['description'] = None
                if 'beliefs' not in node_dict:
                    node_dict['beliefs'] = []
                if 'knowledge' not in node_dict:
                    node_dict['knowledge'] = []
                if 'preferences' not in node_dict:
                    node_dict['preferences'] = []
                if 'emotionalState' not in node_dict:
                    node_dict['emotionalState'] = None
                
                # AI-specific attributes for AI agents
                if node_dict.get('agentType') == "ai":
                    if 'modelName' not in node_dict:
                        node_dict['modelName'] = None
                    if 'provider' not in node_dict:
                        node_dict['provider'] = None
                    if 'apiEndpoint' not in node_dict:
                        node_dict['apiEndpoint'] = None
                    if 'trainingData' not in node_dict:
                        node_dict['trainingData'] = []
                    if 'operationalConstraints' not in node_dict:
                        node_dict['operationalConstraints'] = []
                    if 'performanceMetrics' not in node_dict:
                        node_dict['performanceMetrics'] = {}
                    if 'version' not in node_dict:
                        node_dict['version'] = None
                    if 'operationalStatus' not in node_dict:
                        node_dict['operationalStatus'] = "active"
                    if 'ownership' not in node_dict:
                        node_dict['ownership'] = None
                    if 'interactionHistory' not in node_dict:
                        node_dict['interactionHistory'] = []
                
        elif node_type == 'Thought':
            # Required fields
            if 'thoughtContent' not in node_dict:
                node_dict['thoughtContent'] = ""
            if 'references' not in node_dict:
                node_dict['references'] = []
                
            # Optional fields only added when requested
            if include_optional:
                if 'confidence' not in node_dict:
                    node_dict['confidence'] = 0.5
                if 'source' not in node_dict:
                    node_dict['source'] = None
                if 'createdBy' not in node_dict:
                    node_dict['createdBy'] = None
                if 'tags' not in node_dict:
                    node_dict['tags'] = []
                if 'impact' not in node_dict:
                    node_dict['impact'] = None
                if 'emotionalValence' not in node_dict:
                    node_dict['emotionalValence'] = 0.0
                if 'emotionalArousal' not in node_dict:
                    node_dict['emotionalArousal'] = 0.0
                if 'evidentialBasis' not in node_dict:
                    node_dict['evidentialBasis'] = []
                if 'thoughtCounterarguments' not in node_dict:
                    node_dict['thoughtCounterarguments'] = []
                if 'implications' not in node_dict:
                    node_dict['implications'] = []
                if 'thoughtConfidenceScore' not in node_dict:
                    node_dict['thoughtConfidenceScore'] = 0.0
                if 'reasoningChains' not in node_dict:
                    node_dict['reasoningChains'] = []
                
        elif node_type == 'ScientificInsight':
            # Required fields
            if 'hypothesis' not in node_dict:
                node_dict['hypothesis'] = ""
            if 'evidence' not in node_dict:
                node_dict['evidence'] = []
            if 'confidence' not in node_dict:
                node_dict['confidence'] = 0.5
            if 'field' not in node_dict:
                node_dict['field'] = ""
                
            # Optional fields only added when requested
            if include_optional:
                if 'methodology' not in node_dict:
                    node_dict['methodology'] = None
                if 'publications' not in node_dict:
                    node_dict['publications'] = []
                if 'emotionalValence' not in node_dict:
                    node_dict['emotionalValence'] = 0.0
                if 'emotionalArousal' not in node_dict:
                    node_dict['emotionalArousal'] = 0.0
                if 'evidenceStrength' not in node_dict:
                    node_dict['evidenceStrength'] = 0.0
                if 'scientificCounterarguments' not in node_dict:
                    node_dict['scientificCounterarguments'] = []
                if 'applicationDomains' not in node_dict:
                    node_dict['applicationDomains'] = []
                if 'replicationStatus' not in node_dict:
                    node_dict['replicationStatus'] = None
                if 'surpriseValue' not in node_dict:
                    node_dict['surpriseValue'] = 0.0
                
        elif node_type == 'Law':
            # Required fields
            if 'statement' not in node_dict:
                node_dict['statement'] = ""
            if 'conditions' not in node_dict:
                node_dict['conditions'] = []
            if 'exceptions' not in node_dict:
                node_dict['exceptions'] = []
            if 'domain' not in node_dict:
                node_dict['domain'] = ""
                
            # Optional fields only added when requested
            if include_optional:
                if 'proofs' not in node_dict:
                    node_dict['proofs'] = []
                if 'emotionalValence' not in node_dict:
                    node_dict['emotionalValence'] = 0.0
                if 'emotionalArousal' not in node_dict:
                    node_dict['emotionalArousal'] = 0.0
                if 'domainConstraints' not in node_dict:
                    node_dict['domainConstraints'] = []
                if 'historicalPrecedents' not in node_dict:
                    node_dict['historicalPrecedents'] = []
                if 'counterexamples' not in node_dict:
                    node_dict['counterexamples'] = []
                if 'formalRepresentation' not in node_dict:
                    node_dict['formalRepresentation'] = None
                
        elif node_type == 'ReasoningChain':
            # Required fields
            if 'description' not in node_dict:
                node_dict['description'] = ""
            if 'conclusion' not in node_dict:
                node_dict['conclusion'] = ""
            if 'confidenceScore' not in node_dict:
                node_dict['confidenceScore'] = 0.5
            if 'creator' not in node_dict:
                node_dict['creator'] = ""
            if 'methodology' not in node_dict:
                node_dict['methodology'] = "mixed"
                
            # Optional fields only added when requested
            if include_optional:
                if 'domain' not in node_dict:
                    node_dict['domain'] = None
                if 'tags' not in node_dict:
                    node_dict['tags'] = []
                if 'sourceThought' not in node_dict:
                    node_dict['sourceThought'] = None
                if 'numberOfSteps' not in node_dict:
                    node_dict['numberOfSteps'] = 0
                if 'alternativeConclusionsConsidered' not in node_dict:
                    node_dict['alternativeConclusionsConsidered'] = []
                if 'relatedPropositions' not in node_dict:
                    node_dict['relatedPropositions'] = []
                
        elif node_type == 'ReasoningStep':
            # Required fields
            if 'content' not in node_dict:
                node_dict['content'] = ""
            if 'stepType' not in node_dict:
                node_dict['stepType'] = "inference"
            if 'confidence' not in node_dict:
                node_dict['confidence'] = 0.5
                
            # Optional fields only added when requested
            if include_optional:
                if 'evidenceType' not in node_dict:
                    node_dict['evidenceType'] = None
                if 'supportingReferences' not in node_dict:
                    node_dict['supportingReferences'] = []
                if 'alternatives' not in node_dict:
                    node_dict['alternatives'] = []
                if 'counterarguments' not in node_dict:
                    node_dict['counterarguments'] = []
                if 'assumptions' not in node_dict:
                    node_dict['assumptions'] = []
                if 'formalNotation' not in node_dict:
                    node_dict['formalNotation'] = None
                if 'propositions' not in node_dict:
                    node_dict['propositions'] = []
                if 'chainName' not in node_dict:
                    node_dict['chainName'] = None
                if 'order' not in node_dict:
                    node_dict['order'] = 0
                
        elif node_type == 'Location':
            # Required fields
            if 'locationType' not in node_dict:
                node_dict['locationType'] = "Place"
            if 'description' not in node_dict:
                node_dict['description'] = ""
                
            # Optional fields only added when requested
            if include_optional:
                if 'coordinates' not in node_dict:
                    node_dict['coordinates'] = {"latitude": 0.0, "longitude": 0.0}
                if 'locationSignificance' not in node_dict:
                    node_dict['locationSignificance'] = None
                
        # Check for invalid node types
        else:
            logging.warning(f"Unknown node type: {node_type}")
                
        return node_dict
    
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        
        # Check for section headers
        if any(re.match(pattern, line) for pattern in entity_headers):
            current_section = "entities"
            i += 1  # Move to next line after entity header
            
            # Process entity lines - format expected: "- Entity Name (Type) - Description"
            while i < len(lines):
                line = lines[i].strip()
                
                # If we hit another section header, break out
                if any(re.match(pattern, line) for pattern in event_headers + concept_headers + 
                      proposition_headers + attribute_headers + emotion_headers + 
                      agent_headers + thought_headers + scientific_insight_headers + 
                      law_headers + reasoning_chain_headers + reasoning_step_headers + 
                      relationship_headers + person_details_headers + location_details_headers):
                    break
                
                # Skip empty lines or non-entity lines
                if not line or not line.startswith('-'):
                    i += 1
                    continue
                    
                # Extract entity from line format: "- Entity Name (Type) - Description"
                # Remove the leading dash and space
                entity_line = line[2:].strip()
                
                # Try to match the expected format
                entity_match = re.match(r'([^(]+)\s*\(([^)]+)\)\s*-\s*(.+)', entity_line)
                if entity_match:
                    name = entity_match.group(1).strip()
                    entity_type = entity_match.group(2).strip()
                    description = entity_match.group(3).strip()
                    
                    # Create entity object with required attributes
                    entity = {
                        "name": name,
                        "nodeType": "Entity",
                        "entityType": entity_type,
                        "description": description,
                        "observations": []  # Ensure required attributes
                    }
                    
                    logging.debug(f"Extracted entity: {name} ({entity_type})")
                    result["entities"].append(entity)
                else:
                    logging.warning(f"Could not parse entity from line: {line}")
                i += 1
        
        # Check if this is the start of JSON block for entities
        elif current_section == "entities" and ("```json" in line or ("```" in line and "json" in line)):
            entity_json, i = extract_json_block(i)
            if entity_json:
                # Only validate if specified
                if use_validation:
                    entity_json = ensure_required_attributes(entity_json, "Entity", include_optional=False)
                result["entities"].append(entity_json)
            continue
            
        elif any(re.match(pattern, line) for pattern in event_headers):
            current_section = "events"
            # After identifying events section, look for JSON blocks
            while i < len(lines) - 1:
                i += 1
                if "```json" in lines[i] or ("```" in lines[i] and "json" in lines[i]):
                    event_json, i = extract_json_block(i)
                    if event_json:
                        # Only validate if specified
                        if use_validation:
                            event_json = ensure_required_attributes(event_json, "Event", include_optional=False)
                        result["events"].append(event_json)
                    i -= 1  # Adjust for the increment at the end of the loop
                    break
                elif any(re.match(pattern, lines[i]) for pattern in concept_headers + proposition_headers + 
                                     attribute_headers + emotion_headers + agent_headers + thought_headers + 
                                     scientific_insight_headers + law_headers + reasoning_chain_headers + 
                                     reasoning_step_headers + relationship_headers + person_details_headers + 
                                     location_details_headers):
                    i -= 1  # Go back to the header line
                    break
                elif lines[i].startswith("- "):
                    # We found a line-by-line entry, go back and process as normal
                    i -= 1
                    break
                    
        elif any(re.match(pattern, line) for pattern in concept_headers):
            current_section = "concepts"
            # Look for JSON blocks
            while i < len(lines) - 1:
                i += 1
                if "```json" in lines[i] or ("```" in lines[i] and "json" in lines[i]):
                    concept_json, i = extract_json_block(i)
                    if concept_json:
                        # Only validate if specified
                        if use_validation:
                            concept_json = ensure_required_attributes(concept_json, "Concept", include_optional=False)
                        result["concepts"].append(concept_json)
                    i -= 1  # Adjust for the increment at the end of the loop
                    break
                elif any(re.match(pattern, lines[i]) for pattern in proposition_headers + 
                                     attribute_headers + emotion_headers + agent_headers + thought_headers + 
                                     scientific_insight_headers + law_headers + reasoning_chain_headers + 
                                     reasoning_step_headers + relationship_headers + person_details_headers + 
                                     location_details_headers):
                    i -= 1  # Go back to the header line
                    break
                elif lines[i].startswith("- "):
                    # We found a line-by-line entry, go back and process as normal
                    i -= 1
                    break
                    
        elif any(re.match(pattern, line) for pattern in proposition_headers):
            current_section = "propositions"
            # Look for JSON blocks
            while i < len(lines) - 1:
                i += 1
                if "```json" in lines[i] or ("```" in lines[i] and "json" in lines[i]):
                    proposition_json, i = extract_json_block(i)
                    if proposition_json:
                        # Only validate if specified
                        if use_validation:
                            proposition_json = ensure_required_attributes(proposition_json, "Proposition", include_optional=False)
                        result["propositions"].append(proposition_json)
                    i -= 1  # Adjust for the increment at the end of the loop
                    break
                elif any(re.match(pattern, lines[i]) for pattern in attribute_headers + 
                                     emotion_headers + agent_headers + thought_headers + 
                                     scientific_insight_headers + law_headers + reasoning_chain_headers + 
                                     reasoning_step_headers + relationship_headers + person_details_headers + 
                                     location_details_headers):
                    i -= 1  # Go back to the header line
                    break
                elif lines[i].startswith("- "):
                    # We found a line-by-line entry, go back and process as normal
                    i -= 1
                    break
                    
        elif any(re.match(pattern, line) for pattern in attribute_headers):
            current_section = "attributes"
            # Look for JSON blocks
            while i < len(lines) - 1:
                i += 1
                if "```json" in lines[i] or ("```" in lines[i] and "json" in lines[i]):
                    attribute_json, i = extract_json_block(i)
                    if attribute_json:
                        # Only validate if specified
                        if use_validation:
                            attribute_json = ensure_required_attributes(attribute_json, "Attribute", include_optional=False)
                        result["attributes"].append(attribute_json)
                    i -= 1  # Adjust for the increment at the end of the loop
                    break
                elif any(re.match(pattern, lines[i]) for pattern in emotion_headers + 
                                     agent_headers + thought_headers + scientific_insight_headers + 
                                     law_headers + reasoning_chain_headers + reasoning_step_headers + 
                                     relationship_headers + person_details_headers + location_details_headers):
                    i -= 1  # Go back to the header line
                    break
                elif lines[i].startswith("- "):
                    # We found a line-by-line entry, go back and process as normal
                    i -= 1
                    break
                    
        elif any(re.match(pattern, line) for pattern in emotion_headers):
            current_section = "emotions"
            # Look for JSON blocks
            while i < len(lines) - 1:
                i += 1
                if "```json" in lines[i] or ("```" in lines[i] and "json" in lines[i]):
                    emotion_json, i = extract_json_block(i)
                    if emotion_json:
                        # Only validate if specified
                        if use_validation:
                            emotion_json = ensure_required_attributes(emotion_json, "Emotion", include_optional=False)
                        result["emotions"].append(emotion_json)
                    i -= 1  # Adjust for the increment at the end of the loop
                    break
                elif any(re.match(pattern, lines[i]) for pattern in agent_headers + 
                                     thought_headers + scientific_insight_headers + law_headers + 
                                     reasoning_chain_headers + reasoning_step_headers + relationship_headers + 
                                     person_details_headers + location_details_headers):
                    i -= 1  # Go back to the header line
                    break
                elif lines[i].startswith("- "):
                    # We found a line-by-line entry, go back and process as normal
                    i -= 1
                    break
                    
        elif any(re.match(pattern, line) for pattern in agent_headers):
            current_section = "agents"
            # Look for JSON blocks
            while i < len(lines) - 1:
                i += 1
                if "```json" in lines[i] or ("```" in lines[i] and "json" in lines[i]):
                    agent_json, i = extract_json_block(i)
                    if agent_json:
                        # Only validate if specified
                        if use_validation:
                            agent_json = ensure_required_attributes(agent_json, "Agent", include_optional=False)
                        result["agents"].append(agent_json)
                    i -= 1  # Adjust for the increment at the end of the loop
                    break
                elif any(re.match(pattern, lines[i]) for pattern in thought_headers + 
                                     scientific_insight_headers + law_headers + reasoning_chain_headers + 
                                     reasoning_step_headers + relationship_headers + person_details_headers + 
                                     location_details_headers):
                    i -= 1  # Go back to the header line
                    break
                elif lines[i].startswith("- "):
                    # We found a line-by-line entry, go back and process as normal
                    i -= 1
                    break
                    
        elif any(re.match(pattern, line) for pattern in thought_headers):
            current_section = "thoughts"
            # Look for JSON blocks
            while i < len(lines) - 1:
                i += 1
                if "```json" in lines[i] or ("```" in lines[i] and "json" in lines[i]):
                    thought_json, i = extract_json_block(i)
                    if thought_json:
                        # Only validate if specified
                        if use_validation:
                            thought_json = ensure_required_attributes(thought_json, "Thought", include_optional=False)
                        result["thoughts"].append(thought_json)
                    i -= 1  # Adjust for the increment at the end of the loop
                    break
                elif any(re.match(pattern, lines[i]) for pattern in scientific_insight_headers + 
                                     law_headers + reasoning_chain_headers + reasoning_step_headers + 
                                     relationship_headers + person_details_headers + location_details_headers):
                    i -= 1  # Go back to the header line
                    break
                elif lines[i].startswith("- "):
                    # We found a line-by-line entry, go back and process as normal
                    i -= 1
                    break
                    
        elif any(re.match(pattern, line) for pattern in scientific_insight_headers):
            current_section = "scientificInsights"
            # Look for JSON blocks
            while i < len(lines) - 1:
                i += 1
                if "```json" in lines[i] or ("```" in lines[i] and "json" in lines[i]):
                    insight_json, i = extract_json_block(i)
                    if insight_json:
                        # Only validate if specified
                        if use_validation:
                            insight_json = ensure_required_attributes(insight_json, "ScientificInsight", include_optional=False)
                        result["scientificInsights"].append(insight_json)
                    i -= 1  # Adjust for the increment at the end of the loop
                    break
                elif any(re.match(pattern, lines[i]) for pattern in law_headers + 
                                     reasoning_chain_headers + reasoning_step_headers + relationship_headers + 
                                     person_details_headers + location_details_headers):
                    i -= 1  # Go back to the header line
                    break
                elif lines[i].startswith("- "):
                    # We found a line-by-line entry, go back and process as normal
                    i -= 1
                    break
                    
        elif any(re.match(pattern, line) for pattern in law_headers):
            current_section = "laws"
            # Look for JSON blocks
            while i < len(lines) - 1:
                i += 1
                if "```json" in lines[i] or ("```" in lines[i] and "json" in lines[i]):
                    law_json, i = extract_json_block(i)
                    if law_json:
                        # Only validate if specified
                        if use_validation:
                            law_json = ensure_required_attributes(law_json, "Law", include_optional=False)
                        result["laws"].append(law_json)
                    i -= 1  # Adjust for the increment at the end of the loop
                    break
                elif any(re.match(pattern, lines[i]) for pattern in reasoning_chain_headers + 
                                     reasoning_step_headers + relationship_headers + person_details_headers + 
                                     location_details_headers):
                    i -= 1  # Go back to the header line
                    break
                elif lines[i].startswith("- "):
                    # We found a line-by-line entry, go back and process as normal
                    i -= 1
                    break
                    
        elif any(re.match(pattern, line) for pattern in reasoning_chain_headers):
            current_section = "reasoningChains"
            # Look for JSON blocks
            while i < len(lines) - 1:
                i += 1
                if "```json" in lines[i] or ("```" in lines[i] and "json" in lines[i]):
                    chain_json, i = extract_json_block(i)
                    if chain_json:
                        # Only validate if specified
                        if use_validation:
                            chain_json = ensure_required_attributes(chain_json, "ReasoningChain", include_optional=False)
                        result["reasoningChains"].append(chain_json)
                    i -= 1  # Adjust for the increment at the end of the loop
                    break
                elif any(re.match(pattern, lines[i]) for pattern in reasoning_step_headers + 
                                     relationship_headers + person_details_headers + location_details_headers):
                    i -= 1  # Go back to the header line
                    break
                elif lines[i].startswith("- "):
                    # We found a line-by-line entry, go back and process as normal
                    i -= 1
                    break
                    
        elif any(re.match(pattern, line) for pattern in reasoning_step_headers):
            current_section = "reasoningSteps"
            # Look for JSON blocks
            while i < len(lines) - 1:
                i += 1
                if "```json" in lines[i] or ("```" in lines[i] and "json" in lines[i]):
                    step_json, i = extract_json_block(i)
                    if step_json:
                        # Only validate if specified
                        if use_validation:
                            step_json = ensure_required_attributes(step_json, "ReasoningStep", include_optional=False)
                        result["reasoningSteps"].append(step_json)
                    i -= 1  # Adjust for the increment at the end of the loop
                    break
                elif any(re.match(pattern, lines[i]) for pattern in relationship_headers + 
                                     person_details_headers + location_details_headers):
                    i -= 1  # Go back to the header line
                    break
                elif lines[i].startswith("- "):
                    # We found a line-by-line entry, go back and process as normal
                    i -= 1
                    break
                    
        elif any(re.match(pattern, line) for pattern in relationship_headers):
            current_section = "relationships"
        elif any(re.match(pattern, line) for pattern in person_details_headers):
            current_section = "person_details"
            # Extract person name
            person_match = None
            for pattern in person_details_headers:
                match = re.match(pattern, line)
                if match and match.groups():
                    person_match = match
                    break
                    
            if person_match:
                current_person = person_match.group(1).strip()
                person_details[current_person] = {}
                
                # Look for JSON block after person details header
                while i < len(lines) - 1:
                    i += 1
                    if "```json" in lines[i] or ("```" in lines[i] and "json" in lines[i]):
                        person_json, i = extract_json_block(i)
                        if person_json:
                            person_details[current_person] = person_json
                        i -= 1  # Adjust for the increment at the end of the loop
                        break
                    elif lines[i].startswith("- "):
                        # We found a line-by-line entry, go back and process as normal
                        i -= 1
                        break
            
        elif any(re.match(pattern, line) for pattern in location_details_headers):
            current_section = "location_details"
            # Extract location name
            location_match = None
            for pattern in location_details_headers:
                match = re.match(pattern, line)
                if match and match.groups():
                    location_match = match
                    break
                    
            if location_match:
                current_location = location_match.group(1).strip()
                location_details[current_location] = {}
                
                # Look for JSON block after location details header
                while i < len(lines) - 1:
                    i += 1
                    if "```json" in lines[i] or ("```" in lines[i] and "json" in lines[i]):
                        location_json, i = extract_json_block(i)
                        if location_json:
                            location_details[current_location] = location_json
                        i -= 1  # Adjust for the increment at the end of the loop
                        break
                    elif lines[i].startswith("- "):
                        # We found a line-by-line entry, go back and process as normal
                        i -= 1
                        break

        # Process content based on current section
        elif line.startswith("- "):
            content = line[2:].strip()
            if current_section == "entities":
                # Parse entity data with comprehensive attributes
                entity_data = {
                    "nodeType": "Entity",
                    "observations": [],
                    "confidence": 0.0,
                }

                
                # In JSON response mode, we don't need to look ahead for additional details
                # as all data should be contained in the JSON structure
                # The validation step will ensure required fields are present
                
                # Add the entity to the result
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
                
                # In JSON response mode, we don't need to look ahead for additional details
                # as all data should be contained in the JSON structure
                # The validation step will ensure required fields are present
                
                # Add the event to the result
                result["events"].append(event_data)
            elif current_section == "concepts":
                # In JSON response mode, concepts should already have all their attributes
                # from the structured JSON output
                concept_data = {
                    "name": content,
                    "nodeType": "Concept",
                    "examples": [],
                    "relatedConcepts": [],
                    "definition": ""
                }
                
                # Extract concept name and definition only if not in JSON format
                # This is kept for backward compatibility with older formats
                if " - " in content:
                    name_part, definition_part = content.split(" - ", 1)
                    concept_data["name"] = name_part.strip()
                    concept_data["definition"] = definition_part.strip()
                
                # Add the concept to the result - validation will ensure required fields
                result["concepts"].append(concept_data)
            elif current_section == "propositions":
                # In JSON response mode, propositions should already have all their attributes
                # from the structured JSON output
                prop_data = {
                    "nodeType": "Proposition",
                    "statement": content,
                    "sources": [],
                    "counterEvidence": []
                }
                
                # Extract label and statement if format is "Label - Statement"
                # This is kept for backward compatibility with older formats
                if " - " in content:
                    label, statement = content.split(" - ", 1)
                    prop_data["name"] = label.strip()
                    prop_data["statement"] = statement.strip()
                else:
                    prop_data["name"] = content
                
                # Add the proposition to the result - validation will ensure required fields
                result["propositions"].append(prop_data)
            elif current_section == "attributes":
                # Parse attribute data with comprehensive attributes
                attr_data = {
                    "name": content,
                    "nodeType": "Attribute"
                }
            
                
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
                
                # Add the agent to the result - validation will ensure required fields
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
                # Parse relationship data with proper structure for Neo4j
                relationship_data = {"description": content}
                
                # Try different relationship formats
                # Format 1: [Entity1] --RELATIONSHIP_TYPE--> [Entity2]
                rel_match = re.match(r'\[(.+?)\]\s*--(.+?)-->\s*\[(.+?)\]', content)
                
                # Format 2: SourceEntity(EntityType) -> [RELATIONSHIP_TYPE] TargetEntity(EntityType)
                if not rel_match:
                    rel_match = re.match(r'(.+?)\(\s*(.+?)\s*\)\s*->\s*\[(.+?)\]\s*(.+?)\(\s*(.+?)\s*\)', content)
                    if rel_match:
                        source_name = rel_match.group(1).strip()
                        source_type = rel_match.group(2).strip()
                        rel_type = rel_match.group(3).strip()
                        target_name = rel_match.group(4).strip()
                        target_type = rel_match.group(5).strip()
                        
                        # Create structured relationship
                        # Validate relationship type
                        validated_rel_type, rel_category = validate_relationship_type(rel_type)
                        structured_rel = {
                            "source": {"name": standardize_entity(source_name), "type": source_type},
                            "target": {"name": standardize_entity(target_name), "type": target_type},
                            "type": validated_rel_type,
                            "relationshipCategory": rel_category,
                            "description": content
                        }
                        
                        relationship_data["relationship"] = structured_rel
                        relationship_data["relationshipCategory"] = rel_category
                        
                        # Extract properties if they exist
                        if "{" in content and "}" in content:
                            props_str = content.split("{", 1)[1].split("}", 1)[0]
                            props = {}
                            for prop in props_str.split(","):
                                if ":" in prop:
                                    key, value = prop.split(":", 1)
                                    props[key.strip()] = value.strip()
                            relationship_data["properties"] = props
                        
                        result["relationships"].append(relationship_data)
                        
                # Original format parsing
                elif rel_match:
                    source_part = rel_match.group(1).strip()
                    rel_type = rel_match.group(2).strip()
                    target_part = rel_match.group(3).strip()
                    
                    # Extract source entity
                    relationship_data["source"] = {"name": source_part, "type": "Entity"}
                    
                    # Validate and set relationship type and category
                    rel_type, rel_category = validate_relationship_type(rel_type)
                    relationship_data["type"] = rel_type
                    relationship_data["relationshipCategory"] = rel_category
                    
                    # Extract target entity
                    relationship_data["target"] = {"name": target_part, "type": "Entity"}
                    
                    # Extract context if available
                    if "(" in content and ")" in content and "Context:" in content:
                        context_match = re.search(r'\(Context: (.+?)\)', content)
                        if context_match:
                            context = context_match.group(1).strip()
                            if "properties" not in relationship_data:
                                relationship_data["properties"] = {}
                            relationship_data["properties"]["context"] = context
                    
                    # Validate relationship type
                    validated_rel_type, rel_category = validate_relationship_type(rel_type)
                    structured_rel = {
                        "source": {"name": standardize_entity(source_part), "type": source_type},
                        "target": {"name": standardize_entity(target_part), "type": target_type},
                        "type": validated_rel_type,
                        "relationshipCategory": rel_category,
                        "description": content
                    }
                    relationship_data["relationship"] = structured_rel
                    relationship_data["relationshipCategory"] = rel_category
                    
                    result["relationships"].append(relationship_data)
                
                # Another common format: SourceEntity -> RELATIONSHIP_TYPE -> TargetEntity
                elif " -> " in content:
                    parts = content.split(" -> ")
                    if len(parts) == 3:  # SourceEntity -> REL_TYPE -> TargetEntity
                        source = parts[0].strip()
                        rel_type = parts[1].strip()
                        target = parts[2].strip()
                        
                        # Extract source type if available
                        source_type = "Entity"
                        if "(" in source and ")" in source:
                            source_type_match = re.search(r'\(([^)]+)\)', source)
                            if source_type_match:
                                source_type = source_type_match.group(1).strip()
                                source = re.sub(r'\s*\([^)]+\)', '', source).strip()
                        
                        # Extract target type if available
                        target_type = "Entity"
                        if "(" in target and ")" in target:
                            target_type_match = re.search(r'\(([^)]+)\)', target)
                            if target_type_match:
                                target_type = target_type_match.group(1).strip()
                                target = re.sub(r'\s*\([^)]+\)', '', target).strip()
                        
                        # Create structured relationship
                        # Validate relationship type
                        validated_rel_type, rel_category = validate_relationship_type(rel_type)
                        structured_rel = {
                            "source": {"name": standardize_entity(source), "type": source_type},
                            "target": {"name": standardize_entity(target), "type": target_type},
                            "type": validated_rel_type,
                            "relationshipCategory": rel_category,
                            "description": content
                        }
                        
                        relationship_data["relationship"] = structured_rel
                        relationship_data["relationshipCategory"] = rel_category
                        
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
            result["entities"][i] = ensure_required_attributes(result["entities"][i], "Entity", include_optional=False)
    
    for i in range(len(result["events"])):
        if isinstance(result["events"][i], dict):
            result["events"][i] = ensure_required_attributes(result["events"][i], "Event", include_optional=False)
    
    for i in range(len(result["concepts"])):
        if isinstance(result["concepts"][i], dict):
            result["concepts"][i] = ensure_required_attributes(result["concepts"][i], "Concept", include_optional=False)
            
    for i in range(len(result["propositions"])):
        if isinstance(result["propositions"][i], dict):
            result["propositions"][i] = ensure_required_attributes(result["propositions"][i], "Proposition", include_optional=False)
            
    for i in range(len(result["attributes"])):
        if isinstance(result["attributes"][i], dict):
            result["attributes"][i] = ensure_required_attributes(result["attributes"][i], "Attribute", include_optional=False)
            
    for i in range(len(result["emotions"])):
        if isinstance(result["emotions"][i], dict):
            result["emotions"][i] = ensure_required_attributes(result["emotions"][i], "Emotion", include_optional=False)
            
    for i in range(len(result["agents"])):
        if isinstance(result["agents"][i], dict):
            result["agents"][i] = ensure_required_attributes(result["agents"][i], "Agent", include_optional=False)
            
    for i in range(len(result["thoughts"])):
        if isinstance(result["thoughts"][i], dict):
            result["thoughts"][i] = ensure_required_attributes(result["thoughts"][i], "Thought", include_optional=False)
            
    for i in range(len(result["scientificInsights"])):
        if isinstance(result["scientificInsights"][i], dict):
            result["scientificInsights"][i] = ensure_required_attributes(result["scientificInsights"][i], "ScientificInsight", include_optional=False)
            
    for i in range(len(result["laws"])):
        if isinstance(result["laws"][i], dict):
            result["laws"][i] = ensure_required_attributes(result["laws"][i], "Law", include_optional=False)
            
    for i in range(len(result["reasoningChains"])):
        if isinstance(result["reasoningChains"][i], dict):
            result["reasoningChains"][i] = ensure_required_attributes(result["reasoningChains"][i], "ReasoningChain", include_optional=False)
            
    for i in range(len(result["reasoningSteps"])):
        if isinstance(result["reasoningSteps"][i], dict):
            result["reasoningSteps"][i] = ensure_required_attributes(result["reasoningSteps"][i], "ReasoningStep", include_optional=False)
    
    # Normalize relationships to have consistent structure
    for i in range(len(result.get("relationships", []))):
        if isinstance(result["relationships"][i], dict):
            # If we have a nested 'relationship' structure, move it up
            if "relationship" in result["relationships"][i]:
                result["relationships"][i] = result["relationships"][i]["relationship"]
            
            # Ensure each relationship has a relationshipCategory if not already present
            if "relationshipCategory" not in result["relationships"][i] and "type" in result["relationships"][i]:
                rel_type = result["relationships"][i]["type"]
                _, rel_category = validate_relationship_type(rel_type)
                result["relationships"][i]["relationshipCategory"] = rel_category
    
    return result

async def extract_knowledge(text_chunk):
    """Extract knowledge entities from text using GPT-4 with retries"""
    # Log first 100 chars of the chunk to check its content
    logging.info(f"Processing chunk of length {len(text_chunk.page_content)} characters")
    logging.info(f"Chunk preview: {text_chunk.page_content[:100]}...")
    
    # Update the prompt to require JSON response format
    json_format_guidance = """
    IMPORTANT: Return your ENTIRE response as a single valid JSON object with the following structure:
    
    {
      "entities": [
        { "nodeType": "Entity", "name": "Entity Name", "subType": "Person", "description": "Description" }
      ],
      "events": [
        { "nodeType": "Event", "name": "Event Name", "description": "Description" }
      ],
      "concepts": [
        { "nodeType": "Concept", "name": "Concept Name", "definition": "Definition" }
      ],
      "relationships": [
        { "source": {"name": "Source Entity", "type": "Entity"}, 
          "target": {"name": "Target Entity", "type": "Entity"}, 
          "type": "RELATIONSHIP_TYPE", 
          "relationshipCategory": "causal" }
      ]
    }
    
    DO NOT include markdown headers, explanatory text, or any other content outside the JSON structure.
    MAKE SURE that your entire response is valid JSON that can be directly parsed.
    DOUBLE CHECK that your JSON is valid before returning it.
    """
    
    # Append JSON guidance to the extraction prompt
    enhanced_prompt_template = EXTRACTION_PROMPT_TEMPLATE + json_format_guidance
    
    # Log prompt length to verify it's not too large
    logging.info(f"Prompt template length: {len(enhanced_prompt_template)} characters")
    
    # Make sure the text is explicitly part of the template
    final_template = enhanced_prompt_template + "\n\nHere is the text to analyze:\n\n{text}\n\n"
    
    # Escape curly braces in the template to prevent LangChain from interpreting them as variables
    escaped_template = final_template.replace("{", "{{").replace("}", "}}")
    # But keep the {text} variable unescaped
    escaped_template = escaped_template.replace("{{text}}", "{text}")
    
    prompt = ChatPromptTemplate.from_template(escaped_template)
    
    # For debugging - show how much of the text is included in the prompt
    sample_text = text_chunk.page_content[:100] + "..." if len(text_chunk.page_content) > 100 else text_chunk.page_content
    logging.debug(f"Using text chunk sample in prompt: {sample_text}")
    
    # Initialize GPT-4 model with retries
    gpt4_model = ChatOpenAI(
        model_name="gpt-4o", 
        temperature=0,
        # Explicitly request JSON format from the model
        model_kwargs={
            "response_format": {"type": "json_object"}
        }
    )
    
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            # Extract knowledge using the LLM
            chain = prompt | gpt4_model
            logging.info(f"Sending request to OpenAI API...")
            start_time = time.time()
            result = await chain.ainvoke({"text": text_chunk.page_content})
            end_time = time.time()
            
            # Log the time taken and result length
            time_taken = end_time - start_time
            logging.info(f"Received response from OpenAI API in {time_taken:.2f} seconds")
            logging.info(f"Response length: {len(result.content)} characters")
            logging.info(f"Response preview: {result.content[:100]}...")
            
            # Parse the response - direct JSON parsing
            try:
                # First clean the response to handle any minor JSON issues
                cleaned_content = clean_json_content(result.content)
                parsed_result = json.loads(cleaned_content)
                
                # Initialize missing fields with empty collections
                for key in ["entities", "events", "concepts", "propositions", "attributes", 
                           "emotions", "agents", "thoughts", "scientificInsights", "laws", 
                           "reasoningChains", "reasoningSteps", "relationships", 
                           "personDetails", "locationDetails"]:
                    if key not in parsed_result:
                        parsed_result[key] = []
                
                # Normalize expected fields for each entity type in the results
                # For entities
                for entity in parsed_result.get("entities", []):
                    ensure_required_attributes(entity, "Entity", include_optional=True)
                    
                # For relationships - fix any inconsistencies in structure
                for relationship in parsed_result.get("relationships", []):
                    # Ensure source has proper structure
                    if "source" in relationship and isinstance(relationship["source"], str):
                        relationship["source"] = {"name": relationship["source"], "type": "Entity"}
                    
                    # Ensure target has proper structure    
                    if "target" in relationship and isinstance(relationship["target"], str):
                        relationship["target"] = {"name": relationship["target"], "type": "Entity"}
                    
                    # Ensure relationship type is valid and normalized
                    if "relationshipType" in relationship and "type" not in relationship:
                        relationship["type"] = relationship["relationshipType"]
                        
                    # Ensure we have a relationship category    
                    if "relationshipCategory" not in relationship and "type" in relationship:
                        rel_type, rel_category = validate_relationship_type(relationship["type"])
                        relationship["relationshipCategory"] = rel_category
                
                # Log what was found
                entity_count = len(parsed_result.get("entities", []))
                relationship_count = len(parsed_result.get("relationships", []))
                logging.info(f"Extracted {entity_count} entities and {relationship_count} relationships from chunk")
                
                # Log the first few entities for debugging
                if entity_count > 0:
                    for i, entity in enumerate(parsed_result.get("entities", [])[:3]):  # Show up to first 3
                        logging.info(f"  Entity {i+1}: {entity.get('name', 'Unknown')} ({entity.get('subType', 'Unknown')}) - {entity.get('description', 'No description')}")
                    if entity_count > 3:
                        logging.info(f"  ...and {entity_count - 3} more entities")
                
                return parsed_result
            except json.JSONDecodeError as e:
                # Fall back to the more extensive parsing only if JSON parsing fails
                logging.warning(f"Could not parse response directly as JSON: {str(e)}")
                logging.warning("Falling back to parse_gpt4_response for more extensive parsing")
                # Pass use_validation=False to avoid adding all attributes during initial parsing
                # Also pass include_optional=False to minimize data bloat
                parsed_result = parse_gpt4_response(result.content, use_validation=False)
                return parsed_result
            
        except Exception as e:
            retry_count += 1
            if retry_count < max_retries:
                logging.warning(f"Error extracting knowledge: {str(e)}")
                logging.warning(f"Error type: {type(e).__name__}")
                logging.warning(f"Error details: {repr(e)}")
                await asyncio.sleep(2)  # Wait before retrying
            else:
                logging.error(f"Failed to extract knowledge after {max_retries} retries: {str(e)}")
                logging.error(f"Last error type: {type(e).__name__}")
                # Return an empty result structure
                return {
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

async def process_chunks(chunks, batch_size=5, checkpoint_frequency=10, validate_nodes=False, include_optional_fields=False):
    """Process text chunks in batches with checkpointing
    
    Args:
        chunks: List of text chunks to process
        batch_size: Number of chunks to process in parallel
        checkpoint_frequency: How often to save checkpoints (in batches)
        validate_nodes: Whether to validate and add required fields to all nodes.
                       Set to False for faster processing and smaller output.
        include_optional_fields: Whether to include optional fields with defaults.
                                Set to False to minimize data bloat.
    """
    results = []
    total_chunks = len(chunks)
    
    for i in tqdm(range(0, total_chunks, batch_size), desc="Processing batches"):
        batch = chunks[i:i+batch_size]
        try:
            batch_results = await asyncio.gather(*[extract_knowledge(chunk) for chunk in batch])
            valid_results = [r for r in batch_results if r]
    
            
            results.extend(valid_results)
            
            # Log batch processing details
            logging.info(f"Processed batch {i//batch_size}: {len(batch)} chunks, {len(valid_results)} valid results")
            
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