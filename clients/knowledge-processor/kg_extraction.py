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
    person_detail_headers = [r"Person Details for (.+):", r"Details for Person (.+):"]
    location_detail_headers = [r"Location Details for (.+):", r"Details for Location (.+):"]
    
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
        elif any(re.match(pattern, line) for pattern in person_detail_headers):
            current_section = "person_details"
            # Extract person name
            for pattern in person_detail_headers:
                match = re.match(pattern, line)
                if match and len(match.groups()) > 0:
                    current_person = match.group(1).strip()
                    person_details[current_person] = {}
                    break
        elif any(re.match(pattern, line) for pattern in location_detail_headers):
            current_section = "location_details"
            # Extract location name
            for pattern in location_detail_headers:
                match = re.match(pattern, line)
                if match and len(match.groups()) > 0:
                    current_location = match.group(1).strip()
                    location_details[current_location] = {}
                    break
        
        # Process content based on current section
        elif line.startswith("- "):
            content = line[2:].strip()
            if current_section == "entities":
                result["entities"].append(content)
            elif current_section == "events":
                # Parse event data
                event_data = {"name": content}
                if "(" in content and ")" in content:
                    base_content = content.split("(", 1)[0].strip()
                    details = content.split("(", 1)[1].rstrip(")")
                    event_data["name"] = base_content
                    
                    # Parse date and location if present
                    if "Date:" in details:
                        date_match = re.search(r"Date: ([^,]+)", details)
                        if date_match:
                            event_data["startDate"] = date_match.group(1).strip()
                    
                    if "Location:" in details:
                        loc_match = re.search(r"Location: ([^,)]+)", details)
                        if loc_match:
                            event_data["location"] = loc_match.group(1).strip()
                
                # Look ahead for additional event details in subsequent lines
                j = i + 1
                while j < len(lines) and (lines[j].strip().startswith("Participants:") or 
                                        lines[j].strip().startswith("Outcome:") or
                                        lines[j].strip() == ""):
                    detail_line = lines[j].strip()
                    if detail_line.startswith("Participants:"):
                        participants = detail_line[len("Participants:"):].strip()
                        event_data["participants"] = [p.strip() for p in participants.split(",")]
                    elif detail_line.startswith("Outcome:"):
                        outcome = detail_line[len("Outcome:"):].strip()
                        event_data["outcome"] = outcome
                    j += 1
                
                # Skip the detail lines that we've already processed
                if j > i + 1:
                    i = j - 1  # -1 because we'll increment i at the end of the loop
                
                result["events"].append(event_data)
            elif current_section == "concepts":
                result["concepts"].append(content)
            elif current_section == "propositions":
                # Parse proposition with confidence and domain
                prop_data = {"statement": content}
                if "(" in content and ")" in content:
                    main_part = content.split("(", 1)[0].strip()
                    metadata = content.split("(", 1)[1].rstrip(")")
                    
                    # Extract label and statement if format is "Label - Statement"
                    if " - " in main_part:
                        label, statement = main_part.split(" - ", 1)
                        prop_data["name"] = label.strip()
                        prop_data["statement"] = statement.strip()
                    else:
                        prop_data["name"] = main_part
                    
                    # Extract confidence and domain
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
                    
                    if "Domain:" in metadata:
                        domain_match = re.search(r"Domain: ([^,)]+)", metadata)
                        if domain_match:
                            prop_data["domain"] = domain_match.group(1).strip()
                
                result["propositions"].append(prop_data)
            elif current_section == "attributes":
                # Parse attribute data
                attr_data = {"name": content}
                
                # Extract name, value, and type
                if " - " in content:
                    name_part, value_part = content.split(" - ", 1)
                    attr_data["name"] = name_part.replace("Attribute:", "").strip()
                    
                    # Parse value and type
                    if "Value:" in value_part:
                        value_match = re.search(r"Value: ([^,]+)", value_part)
                        if value_match:
                            attr_data["value"] = value_match.group(1).strip()
                    
                    if "Type:" in value_part:
                        type_match = re.search(r"Type: ([^,)]+)", value_part)
                        if type_match:
                            attr_data["valueType"] = type_match.group(1).strip()
                
                result["attributes"].append(attr_data)
            elif current_section == "emotions":
                # Parse emotion data
                emotion_data = {"name": content}
                
                if " - " in content:
                    name_part, details_part = content.split(" - ", 1)
                    emotion_data["name"] = name_part.replace("Emotion:", "").strip()
                    
                    # Parse category, intensity, and valence
                    if "Category:" in details_part:
                        cat_match = re.search(r"Category: ([^,]+)", details_part)
                        if cat_match:
                            emotion_data["category"] = cat_match.group(1).strip()
                    
                    if "Intensity:" in details_part:
                        int_match = re.search(r"Intensity: ([^,]+)", details_part)
                        if int_match:
                            intensity_text = int_match.group(1).strip()
                            # Convert text intensity to numeric if needed
                            try:
                                emotion_data["intensity"] = float(intensity_text)
                            except ValueError:
                                if intensity_text.lower() == "high":
                                    emotion_data["intensity"] = 0.9
                                elif intensity_text.lower() == "medium":
                                    emotion_data["intensity"] = 0.6
                                elif intensity_text.lower() == "low":
                                    emotion_data["intensity"] = 0.3
                    
                    if "Valence:" in details_part:
                        val_match = re.search(r"Valence: ([^,)]+)", details_part)
                        if val_match:
                            try:
                                emotion_data["valence"] = float(val_match.group(1).strip())
                            except ValueError:
                                emotion_data["valence"] = 0.0
                
                result["emotions"].append(emotion_data)
            elif current_section == "agents":
                # Parse agent data
                agent_data = {"name": content}
                
                if " - " in content:
                    name_part, details_part = content.split(" - ", 1)
                    agent_data["name"] = name_part.replace("Agent:", "").strip()
                    
                    # Parse agent type and capabilities
                    if "Type:" in details_part:
                        type_match = re.search(r"Type: ([^,]+)", details_part)
                        if type_match:
                            agent_data["agentType"] = type_match.group(1).strip()
                    
                    if "Capabilities:" in details_part:
                        cap_part = details_part.split("Capabilities:", 1)[1].strip()
                        capabilities = [cap.strip() for cap in cap_part.split(",")]
                        agent_data["capabilities"] = capabilities
                
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
            elif current_section == "relationships":
                # Parse relationship data with proper structure for Neo4j
                relationship_data = {"description": content}
                
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
                person_details[current_person][key] = value
        
        elif current_section == "location_details" and current_location:
            if ":" in line:
                key, value = line.split(":", 1)
                key = key.strip()
                value = value.strip()
                location_details[current_location][key] = value
        
        i += 1
    
    # Add the parsed details to the result
    result["personDetails"] = person_details
    result["locationDetails"] = location_details
    
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
    
    # Append relationship guidance to the extraction prompt
    enhanced_prompt_template = EXTRACTION_PROMPT_TEMPLATE + relationship_guidance
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