"""Entity aggregation and profile generation for knowledge graph."""

import logging
from collections import defaultdict
import re
from kg_utils import standardize_entity
import json
from typing import List, Dict, Any
from copy import deepcopy
from kg_schema import PERSON_TEMPLATE

class EntityAggregator:
    """Aggregates entity information from extraction results"""
    
    def __init__(self):
        self.entities = defaultdict(dict)
        self.relationships = []
        self.persons = defaultdict(dict)
        self.locations = defaultdict(dict)
        self.concepts = defaultdict(dict)
        self.events = defaultdict(dict)
        # Add new collections for additional node types
        self.attributes = defaultdict(dict)
        self.propositions = defaultdict(dict)
        self.emotions = defaultdict(dict)
        self.agents = defaultdict(dict)
        self.thoughts = defaultdict(dict)
        self.scientific_insights = defaultdict(dict)
        self.laws = defaultdict(dict)
        self.reasoning_chains = defaultdict(dict)
        self.reasoning_steps = defaultdict(dict)
        # Add collection for person observations
        self.person_observations = defaultdict(list)
    
    def add_extraction_result(self, data):
        """Add an extraction result to the aggregator"""
        if not data:
            return
            
        # Process entities
        for entity in data.get('entities', []):
            if isinstance(entity, str):
                # Handle string format
                entity_parts = entity.split('[Type:', 1)
                if len(entity_parts) == 2:
                    entity_name = standardize_entity(entity_parts[0].strip())
                    entity_type = entity_parts[1].strip().rstrip(']')
                    
                    # Store entity information
                    if entity_name not in self.entities:
                        self.entities[entity_name] = {'type': entity_type, 'mentions': 1}
                    else:
                        self.entities[entity_name]['mentions'] = self.entities[entity_name].get('mentions', 0) + 1
            elif isinstance(entity, dict) and 'name' in entity:
                # Handle dictionary format
                entity_name = standardize_entity(entity['name'])
                for key, value in entity.items():
                    if key != 'name':
                        self.entities[entity_name][key] = value
                if 'mentions' not in self.entities[entity_name]:
                    self.entities[entity_name]['mentions'] = 1
                else:
                    self.entities[entity_name]['mentions'] += 1
        
        # Process events
        for event in data.get('events', []):
            if isinstance(event, str):
                # Simple string event
                event_parts = event.split(':', 1)
                if len(event_parts) == 2:
                    event_name = standardize_entity(event_parts[1].strip())
                    self.events[event_name]['mentions'] = self.events[event_name].get('mentions', 0) + 1
            elif isinstance(event, dict) and 'name' in event:
                # Event dictionary with details
                event_name = standardize_entity(event['name'])
                for key, value in event.items():
                    if key != 'name':
                        self.events[event_name][key] = value
                self.events[event_name]['mentions'] = self.events[event_name].get('mentions', 0) + 1
                
        # Process concepts
        for concept in data.get('concepts', []):
            if isinstance(concept, str):
                # Handle string format
                concept_parts = concept.split(':', 1)
                if len(concept_parts) == 2:
                    concept_name = standardize_entity(concept_parts[1].strip())
                    if concept_name not in self.concepts:
                        self.concepts[concept_name] = {'mentions': 1}
                    else:
                        self.concepts[concept_name]['mentions'] = self.concepts[concept_name].get('mentions', 0) + 1
            elif isinstance(concept, dict) and 'name' in concept:
                # Handle dictionary format
                concept_name = standardize_entity(concept['name'])
                for key, value in concept.items():
                    if key != 'name':
                        self.concepts[concept_name][key] = value
                self.concepts[concept_name]['mentions'] = self.concepts[concept_name].get('mentions', 0) + 1
        
        # Process propositions
        for proposition in data.get('propositions', []):
            if isinstance(proposition, str):
                # Handle string format
                prop_name = standardize_entity(proposition.split(' - ', 1)[0]) if ' - ' in proposition else standardize_entity(proposition)
                self.propositions[prop_name]['mentions'] = self.propositions[prop_name].get('mentions', 0) + 1
            elif isinstance(proposition, dict) and 'name' in proposition:
                # Handle dictionary format
                prop_name = standardize_entity(proposition['name'])
                for key, value in proposition.items():
                    if key != 'name':
                        self.propositions[prop_name][key] = value
                self.propositions[prop_name]['mentions'] = self.propositions[prop_name].get('mentions', 0) + 1
        
        # Process attributes
        for attribute in data.get('attributes', []):
            if isinstance(attribute, str):
                # Handle string format
                attr_name = standardize_entity(attribute.split(' - ', 1)[0]) if ' - ' in attribute else standardize_entity(attribute)
                self.attributes[attr_name]['mentions'] = self.attributes[attr_name].get('mentions', 0) + 1
            elif isinstance(attribute, dict) and 'name' in attribute:
                # Handle dictionary format
                attr_name = standardize_entity(attribute['name'])
                for key, value in attribute.items():
                    if key != 'name':
                        self.attributes[attr_name][key] = value
                self.attributes[attr_name]['mentions'] = self.attributes[attr_name].get('mentions', 0) + 1
        
        # Process emotions
        for emotion in data.get('emotions', []):
            if isinstance(emotion, str):
                # Handle string format
                emotion_name = standardize_entity(emotion.split(' - ', 1)[0]) if ' - ' in emotion else standardize_entity(emotion)
                self.emotions[emotion_name]['mentions'] = self.emotions[emotion_name].get('mentions', 0) + 1
            elif isinstance(emotion, dict) and 'name' in emotion:
                # Handle dictionary format
                emotion_name = standardize_entity(emotion['name'])
                for key, value in emotion.items():
                    if key != 'name':
                        self.emotions[emotion_name][key] = value
                self.emotions[emotion_name]['mentions'] = self.emotions[emotion_name].get('mentions', 0) + 1
        
        # Process agents
        for agent in data.get('agents', []):
            if isinstance(agent, str):
                # Handle string format
                agent_name = standardize_entity(agent.split(' - ', 1)[0]) if ' - ' in agent else standardize_entity(agent)
                self.agents[agent_name]['mentions'] = self.agents[agent_name].get('mentions', 0) + 1
            elif isinstance(agent, dict) and 'name' in agent:
                # Handle dictionary format
                agent_name = standardize_entity(agent['name'])
                for key, value in agent.items():
                    if key != 'name':
                        self.agents[agent_name][key] = value
                self.agents[agent_name]['mentions'] = self.agents[agent_name].get('mentions', 0) + 1
        
        # Process thoughts
        for thought in data.get('thoughts', []):
            if isinstance(thought, str):
                # Handle string format
                thought_name = standardize_entity(thought.split(' - ', 1)[0]) if ' - ' in thought else standardize_entity(thought)
                self.thoughts[thought_name]['mentions'] = self.thoughts[thought_name].get('mentions', 0) + 1
            elif isinstance(thought, dict) and 'name' in thought:
                # Handle dictionary format
                thought_name = standardize_entity(thought['name'])
                for key, value in thought.items():
                    if key != 'name':
                        self.thoughts[thought_name][key] = value
                self.thoughts[thought_name]['mentions'] = self.thoughts[thought_name].get('mentions', 0) + 1
        
        # Process scientific insights
        for insight in data.get('scientificInsights', []):
            if isinstance(insight, str):
                # Handle string format
                insight_name = standardize_entity(insight.split(' - ', 1)[0]) if ' - ' in insight else standardize_entity(insight)
                self.scientific_insights[insight_name]['mentions'] = self.scientific_insights[insight_name].get('mentions', 0) + 1
            elif isinstance(insight, dict) and 'name' in insight:
                # Handle dictionary format
                insight_name = standardize_entity(insight['name'])
                for key, value in insight.items():
                    if key != 'name':
                        self.scientific_insights[insight_name][key] = value
                self.scientific_insights[insight_name]['mentions'] = self.scientific_insights[insight_name].get('mentions', 0) + 1
        
        # Process laws
        for law in data.get('laws', []):
            if isinstance(law, str):
                # Handle string format
                law_name = standardize_entity(law.split(' - ', 1)[0]) if ' - ' in law else standardize_entity(law)
                self.laws[law_name]['mentions'] = self.laws[law_name].get('mentions', 0) + 1
            elif isinstance(law, dict) and 'name' in law:
                # Handle dictionary format
                law_name = standardize_entity(law['name'])
                for key, value in law.items():
                    if key != 'name':
                        self.laws[law_name][key] = value
                self.laws[law_name]['mentions'] = self.laws[law_name].get('mentions', 0) + 1
        
        # Process reasoning chains
        for chain in data.get('reasoningChains', []):
            if isinstance(chain, str):
                # Handle string format
                chain_name = standardize_entity(chain.split(' - ', 1)[0]) if ' - ' in chain else standardize_entity(chain)
                self.reasoning_chains[chain_name]['mentions'] = self.reasoning_chains[chain_name].get('mentions', 0) + 1
            elif isinstance(chain, dict) and 'name' in chain:
                # Handle dictionary format
                chain_name = standardize_entity(chain['name'])
                for key, value in chain.items():
                    if key != 'name':
                        self.reasoning_chains[chain_name][key] = value
                self.reasoning_chains[chain_name]['mentions'] = self.reasoning_chains[chain_name].get('mentions', 0) + 1
                
                # Initialize steps collection for this chain if it doesn't exist
                if 'steps' not in self.reasoning_chains[chain_name]:
                    self.reasoning_chains[chain_name]['steps'] = []
        
        # Process reasoning steps
        for step in data.get('reasoningSteps', []):
            if isinstance(step, str):
                # Handle string format
                step_name = standardize_entity(step.split(' - ', 1)[0]) if ' - ' in step else standardize_entity(step)
                self.reasoning_steps[step_name]['mentions'] = self.reasoning_steps[step_name].get('mentions', 0) + 1
            elif isinstance(step, dict) and 'name' in step:
                # Handle dictionary format
                step_name = standardize_entity(step['name'])
                for key, value in step.items():
                    if key != 'name':
                        self.reasoning_steps[step_name][key] = value
                self.reasoning_steps[step_name]['mentions'] = self.reasoning_steps[step_name].get('mentions', 0) + 1
                
                # If step has a chain association, add it to the chain's steps collection
                if 'chainName' in step:
                    chain_name = standardize_entity(step['chainName'])
                    # Ensure chain exists
                    if chain_name not in self.reasoning_chains:
                        self.reasoning_chains[chain_name] = {'mentions': 1}
                    
                    # Add step reference to chain
                    if 'steps' not in self.reasoning_chains[chain_name]:
                        self.reasoning_chains[chain_name]['steps'] = []
                    
                    # Add step to chain if not already present
                    if step_name not in self.reasoning_chains[chain_name]['steps']:
                        self.reasoning_chains[chain_name]['steps'].append(step_name)
        
        # Process person observations
        person_observations = data.get('personObservations', {})
        for person_name, observations in person_observations.items():
            person_std = standardize_entity(person_name)
            if observations and isinstance(observations, list):
                self.person_observations[person_std].extend(observations)
                
            # Ensure person exists in the persons dictionary with proper structure
            if person_std not in self.persons:
                self.persons[person_std] = {
                    'mentions': 1, 
                    'name': person_std, 
                    'nodeType': 'Entity',
                    'subType': 'Person',
                    'personalityTraits': [],
                    'cognitiveStyle': {},
                    'emotionalProfile': {},
                    'relationalDynamics': {},
                    'valueSystem': {},
                    'psychologicalDevelopment': [],
                    'metaAttributes': {},
                    'aliases': []
                }
            else:
                # Increment mentions counter for existing person
                self.persons[person_std]['mentions'] = self.persons[person_std].get('mentions', 0) + 1
                
                # Ensure all required fields exist
                for field in ["personalityTraits", "cognitiveStyle", "emotionalProfile", 
                             "relationalDynamics", "valueSystem", "psychologicalDevelopment", 
                             "metaAttributes", "aliases"]:
                    if field not in self.persons[person_std]:
                        if field in ["personalityTraits", "psychologicalDevelopment", "aliases"]:
                            self.persons[person_std][field] = []
                        else:
                            self.persons[person_std][field] = {}
                
                # Ensure nodeType and subType are properly set
                self.persons[person_std]['nodeType'] = 'Entity'
                self.persons[person_std]['subType'] = 'Person'
        
        # Process location details
        for loc_name, details in data.get('locationDetails', {}).items():
            # Merge details into existing location data
            loc_std = standardize_entity(loc_name)
            for key, value in details.items():
                if key not in self.locations[loc_std]:
                    self.locations[loc_std][key] = value
            
            # Increment mentions counter
            self.locations[loc_std]['mentions'] = self.locations[loc_std].get('mentions', 0) + 1
        
        # Process relationships with improved structure
        for rel in data.get('relationships', []):
            if isinstance(rel, dict):
                # For structured relationships from the new format
                self.relationships.append(rel)
            elif isinstance(rel, str):
                # Try to parse unstructured relationship strings
                try:
                    # Look for patterns like "Entity1 -> [RELATIONSHIP] Entity2"
                    if " -> " in rel and "[" in rel and "]" in rel:
                        parts = rel.split(" -> ", 1)
                        source = parts[0].strip()
                        target_parts = parts[1].split("]", 1)
                        
                        if len(target_parts) > 1:
                            rel_type = target_parts[0].split("[", 1)[1].strip()
                            target = target_parts[1].strip()
                            
                            # Extract source type if available
                            source_name = source
                            source_type = "Entity"
                            if "(" in source and ")" in source:
                                source_name = source.split("(", 1)[0].strip()
                                source_type = source.split("(", 1)[1].rstrip(")").strip()
                            
                            # Extract target type if available
                            target_name = target
                            target_type = "Entity"
                            if "(" in target and ")" in target:
                                target_name = target.split("(", 1)[0].strip()
                                target_type = target.split("(", 1)[1].rstrip(")").strip()
                            
                            # Extract properties if available
                            properties = {}
                            if "{" in rel and "}" in rel:
                                props_str = rel.split("{", 1)[1].split("}", 1)[0]
                                for prop in props_str.split(","):
                                    if ":" in prop:
                                        key, value = prop.split(":", 1)
                                        properties[key.strip()] = value.strip()
                            
                            # Create structured relationship
                            structured_rel = {
                                "source": {"name": standardize_entity(source_name), "type": source_type},
                                "target": {"name": standardize_entity(target_name), "type": target_type},
                                "type": rel_type,
                                "description": rel
                            }
                            
                            if properties:
                                structured_rel["properties"] = properties
                            
                            self.relationships.append(structured_rel)
                        else:
                            # Couldn't parse properly, store as needing processing
                            self.relationships.append({
                                "description": rel,
                                "needsProcessing": True
                            })
                    else:
                        # Couldn't parse properly, store as needing processing
                        self.relationships.append({
                            "description": rel,
                            "needsProcessing": True
                        })
                except Exception as e:
                    logging.warning(f"Error parsing relationship string: {str(e)}")
                    # Store as needing processing
                    self.relationships.append({
                        "description": rel,
                        "needsProcessing": True
                    })
    
    async def generate_comprehensive_profiles(self, model):
        """Generate comprehensive profiles for entities with sufficient data"""
        profiles = {
            'persons': [], 
            'entities': [], 
            'locations': [], 
            'concepts': [], 
            'events': [],
            'attributes': [],
            'propositions': [],
            'emotions': [],
            'agents': [],
            'thoughts': [],
            'scientificInsights': [],
            'laws': [],
            'reasoningChains': [],
            'reasoningSteps': [],
            'relationships': self.relationships  # Add relationships to profiles
        }
        
        # Count eligible persons for psychological profiling (those with 3+ observations)
        eligible_persons = [name for name, person in self.persons.items() 
                          if person.get('mentions', 0) > 1 and 
                          name in self.person_observations and 
                          len(self.person_observations[name]) >= 3]
        
        logging.info(f"Generating psychological profiles for {len(eligible_persons)} persons with sufficient observations")
        
        # Process persons with multiple mentions
        person_count = 0
        total_eligible = len(eligible_persons)
        
        for name, person in self.persons.items():
            if person.get('mentions', 0) > 1:  # Only process persons with multiple mentions
                # If we have observations for this person, use them to generate a comprehensive profile
                if name in self.person_observations and len(self.person_observations[name]) >= 3:
                    try:
                        person_count += 1
                        logging.info(f"Generating psychological profile for {name} ({person_count}/{total_eligible})")
                        
                        synthesized_profile = await self.synthesize_psychological_profile(name, self.person_observations[name], model)
                        if synthesized_profile:
                            # Merge the synthesized profile with existing data
                            merged_person = self.merge_person_data(person, synthesized_profile)
                            merged_person['name'] = name
                            profiles['persons'].append(merged_person)
                            logging.info(f"✓ Successfully generated psychological profile for {name}")
                            continue
                    except Exception as e:
                        logging.error(f"Error synthesizing profile for {name}: {str(e)}")
                
                # Fall back to existing data if synthesis fails
                person['name'] = name
                profiles['persons'].append(person)
        
        logging.info(f"Completed generation of {person_count} psychological profiles")
        
        # Process locations with multiple mentions
        for name, location in self.locations.items():
            if location.get('mentions', 0) > 1:  # Only process locations with multiple mentions
                location['name'] = name
                profiles['locations'].append(location)
        
        # Process important concepts
        for name, concept in self.concepts.items():
            if concept.get('mentions', 0) > 1:  # Only process concepts with multiple mentions
                concept['name'] = name
                profiles['concepts'].append(concept)
        
        # Process important events
        for name, event in self.events.items():
            if event.get('mentions', 0) > 1:  # Only process events with multiple mentions
                event['name'] = name
                profiles['events'].append(event)
        
        # Process important attributes
        for name, attribute in self.attributes.items():
            if attribute.get('mentions', 0) > 1:  # Only process attributes with multiple mentions
                attribute['name'] = name
                profiles['attributes'].append(attribute)
        
        # Process important propositions
        for name, proposition in self.propositions.items():
            if proposition.get('mentions', 0) > 1:  # Only process propositions with multiple mentions
                proposition['name'] = name
                profiles['propositions'].append(proposition)
        
        # Process important emotions
        for name, emotion in self.emotions.items():
            if emotion.get('mentions', 0) > 1:  # Only process emotions with multiple mentions
                emotion['name'] = name
                profiles['emotions'].append(emotion)
        
        # Process important agents
        for name, agent in self.agents.items():
            if agent.get('mentions', 0) > 1:  # Only process agents with multiple mentions
                agent['name'] = name
                profiles['agents'].append(agent)
        
        # Process important thoughts
        for name, thought in self.thoughts.items():
            if thought.get('mentions', 0) > 1:  # Only process thoughts with multiple mentions
                thought['name'] = name
                profiles['thoughts'].append(thought)
        
        # Process important scientific insights
        for name, insight in self.scientific_insights.items():
            if insight.get('mentions', 0) > 1:  # Only process insights with multiple mentions
                insight['name'] = name
                profiles['scientificInsights'].append(insight)
        
        # Process important laws
        for name, law in self.laws.items():
            if law.get('mentions', 0) > 1:  # Only process laws with multiple mentions
                law['name'] = name
                profiles['laws'].append(law)
        
        # Process important reasoning chains
        for name, chain in self.reasoning_chains.items():
            if chain.get('mentions', 0) > 1:  # Only process chains with multiple mentions
                chain['name'] = name
                
                # Include steps information if available
                if 'steps' in chain and chain['steps']:
                    # Collect step details
                    step_details = []
                    for step_name in chain['steps']:
                        if step_name in self.reasoning_steps:
                            step_info = self.reasoning_steps[step_name].copy()
                            step_info['name'] = step_name
                            
                            # Ensure step has a link back to its chain
                            step_info['chain'] = name
                            
                            # Ensure step has required attributes according to schema
                            if 'content' not in step_info:
                                step_info['content'] = f"Step in {name}"
                            if 'stepType' not in step_info:
                                step_info['stepType'] = "inference"
                            if 'confidence' not in step_info:
                                step_info['confidence'] = 0.7
                                
                            step_details.append(step_info)
                    
                    # Sort steps if they have order information
                    step_details.sort(key=lambda x: x.get('order', 0))
                    
                    # Add steps to chain profile
                    chain['stepDetails'] = step_details
                    
                    # Update numberOfSteps attribute
                    chain['numberOfSteps'] = len(step_details)
                
                # Ensure chain has all required attributes according to schema
                if 'description' not in chain or not chain['description']:
                    chain['description'] = f"Reasoning process about {name}"
                if 'conclusion' not in chain or not chain['conclusion']:
                    chain['conclusion'] = "Unknown conclusion"  
                if 'confidenceScore' not in chain:
                    chain['confidenceScore'] = 0.7
                if 'creator' not in chain:
                    chain['creator'] = "AI System"
                if 'methodology' not in chain:
                    chain['methodology'] = "mixed"
                    
                profiles['reasoningChains'].append(chain)
        
        # Process important reasoning steps
        for name, step in self.reasoning_steps.items():
            if step.get('mentions', 0) > 1:  # Only process steps with multiple mentions
                step['name'] = name
                profiles['reasoningSteps'].append(step)
        
        # Process generic entities (that aren't persons or locations)
        for name, entity in self.entities.items():
            if (name not in self.persons and name not in self.locations and 
                entity.get('mentions', 0) > 1):
                entity['name'] = name
                profiles['entities'].append(entity)
        
        return profiles 

    async def synthesize_psychological_profile(self, person_name: str, observations: List[Dict[str, Any]], model) -> Dict[str, Any]:
        """Synthesize a comprehensive psychological profile from observations."""
        if not observations:
            return {}
        
        logging.info(f"Starting psychological profile synthesis for {person_name} with {len(observations)} observations")
        
        # Create the prompt for synthesizing a psychological profile
        prompt = f"""
        Synthesize a comprehensive psychological profile for {person_name} based on these observations:
        
        Observations:
        {json.dumps(observations, indent=2)}
        
        Instructions:
        1. Analyze all observations and synthesize a coherent psychological profile
        2. Only include conclusions that are reasonably supported by the observations
        3. Indicate confidence levels for different aspects of the profile
        4. Note any contradictions or inconsistencies in the observations
        5. Structure the profile according to this template:
        
        {PERSON_TEMPLATE}
        
        Do not invent details not supported by the observations. If there's insufficient data
        for any section of the template, include placeholder text indicating "Insufficient data"
        rather than making up information.
        """
        
        try:
            # Get response from the model
            logging.info(f"Sending prompt to model for {person_name}'s psychological profile")
            response = await model.ainvoke(prompt)
            content = response.content
            logging.info(f"Received response from model for {person_name}'s profile, parsing JSON...")
            
            # Extract JSON object from the response
            json_pattern = r'```(?:json)?\s*(.*?)\s*```'
            json_matches = re.findall(json_pattern, content, re.DOTALL)
            
            if json_matches:
                try:
                    # Parse the JSON
                    profile_data = json.loads(json_matches[0])
                    traits_count = len(profile_data.get('personalityTraits', []))
                    logging.info(f"Successfully parsed JSON for {person_name} - found {traits_count} personality traits")
                    return profile_data
                except json.JSONDecodeError as e:
                    logging.warning(f"JSON parsing error for {person_name}: {str(e)}")
            
            # Try to extract JSON from the entire response
            try:
                logging.info(f"Attempting alternative JSON extraction for {person_name}")
                potential_json = self._extract_json_from_text(content)
                if potential_json:
                    profile_data = json.loads(potential_json)
                    traits_count = len(profile_data.get('personalityTraits', []))
                    logging.info(f"Successfully parsed JSON with alternative method for {person_name} - found {traits_count} personality traits")
                    return profile_data
            except json.JSONDecodeError as e:
                logging.warning(f"Alternative JSON parsing error for {person_name}: {str(e)}")
            
            logging.error(f"Failed to parse JSON response for psychological profile of {person_name}")
            return {}
        except Exception as e:
            logging.error(f"Error synthesizing psychological profile for {person_name}: {str(e)}")
            return {}
            
    def merge_person_data(self, existing_data: Dict[str, Any], new_profile: Dict[str, Any]) -> Dict[str, Any]:
        """Merge existing person data with a newly synthesized psychological profile.
        
        Args:
            existing_data: Existing person data
            new_profile: Newly synthesized psychological profile
            
        Returns:
            Dict containing the merged data
        """
        result = deepcopy(existing_data)
        
        # If new_profile includes personDetails, ensure it's properly integrated
        if 'personDetails' in new_profile:
            for key, value in new_profile['personDetails'].items():
                if key not in result:
                    result[key] = value
                elif isinstance(value, list) and isinstance(result[key], list):
                    # Merge lists (e.g., personalityTraits)
                    existing_items = set(str(item) for item in result[key])
                    for item in value:
                        if str(item) not in existing_items:
                            result[key].append(item)
                            existing_items.add(str(item))
                elif isinstance(value, dict) and isinstance(result[key], dict):
                    # Recursively merge nested dicts
                    result[key] = self._merge_dicts(result[key], value)
                else:
                    # For scalar values, prefer new profile if existing is empty/None
                    if not result[key] and value:
                        result[key] = value
            return result
            
        # Direct merge for profiles without personDetails wrapper
        for key, value in new_profile.items():
            if key == 'name':
                continue
                
            if key not in result:
                result[key] = value
            elif isinstance(value, list) and isinstance(result[key], list):
                # Merge lists
                existing_items = set(str(item) for item in result[key])
                for item in value:
                    if str(item) not in existing_items:
                        result[key].append(item)
                        existing_items.add(str(item))
            elif isinstance(value, dict) and isinstance(result[key], dict):
                # Recursively merge nested dicts
                result[key] = self._merge_dicts(result[key], value)
            else:
                # For scalar values, prefer new profile if existing is empty/None
                if not result[key] and value:
                    result[key] = value
                    
        return result
        
    def _merge_dicts(self, dict1: Dict[str, Any], dict2: Dict[str, Any]) -> Dict[str, Any]:
        """Recursively merge two dictionaries.
        
        Args:
            dict1: First dictionary
            dict2: Second dictionary
            
        Returns:
            Dict containing the merged data
        """
        result = deepcopy(dict1)
        for key, value in dict2.items():
            if key not in result:
                result[key] = value
            elif isinstance(value, list) and isinstance(result[key], list):
                # Merge lists
                existing_items = set(str(item) for item in result[key])
                for item in value:
                    if str(item) not in existing_items:
                        result[key].append(item)
                        existing_items.add(str(item))
            elif isinstance(value, dict) and isinstance(result[key], dict):
                # Recursively merge nested dicts
                result[key] = self._merge_dicts(result[key], value)
            else:
                # For scalar values, prefer dict2 if dict1 is empty/None
                if not result[key] and value:
                    result[key] = value
        return result
        
    def _extract_json_from_text(self, text: str) -> str:
        """Extract a JSON object from text.
        
        Args:
            text: Text containing a JSON object
            
        Returns:
            String containing the JSON object
        """
        # First, try to find JSON within code blocks
        json_pattern = r'```(?:json)?\s*(.*?)\s*```'
        json_matches = re.findall(json_pattern, text, re.DOTALL)
        if json_matches:
            return json_matches[0]
            
        # Next, try to find JSON within curly braces
        brace_pattern = r'\{.*\}'
        brace_matches = re.findall(brace_pattern, text, re.DOTALL)
        if brace_matches:
            return brace_matches[0]
            
        return "" 