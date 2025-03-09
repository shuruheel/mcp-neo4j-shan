"""Entity aggregation and profile generation for knowledge graph."""

import logging
from collections import defaultdict
import re
from kg_utils import standardize_entity

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
    
    def add_extraction_result(self, data):
        """Add an extraction result to the aggregator"""
        if not data:
            return
            
        # Process entities
        for entity in data.get('entities', []):
            entity_parts = entity.split('[Type:', 1)
            if len(entity_parts) == 2:
                entity_name = standardize_entity(entity_parts[0].strip())
                entity_type = entity_parts[1].strip().rstrip(']')
                
                # Store entity information
                if entity_name not in self.entities:
                    self.entities[entity_name] = {'type': entity_type, 'mentions': 1}
                else:
                    self.entities[entity_name]['mentions'] = self.entities[entity_name].get('mentions', 0) + 1
        
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
            concept_parts = concept.split(':', 1)
            if len(concept_parts) == 2:
                concept_name = standardize_entity(concept_parts[1].strip())
                if concept_name not in self.concepts:
                    self.concepts[concept_name] = {'mentions': 1}
                else:
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
        
        # Process person details
        for person_name, details in data.get('personDetails', {}).items():
            # Merge details into existing person data
            person_std = standardize_entity(person_name)
            
            # Handle complex structures properly
            for key, value in details.items():
                # Handle string fields
                if isinstance(value, str) or (key != "Personality Traits" and 
                                            key != "Emotional Profile" and 
                                            key != "Relational Dynamics" and 
                                            key != "Value System" and 
                                            key != "Psychological Development" and 
                                            key != "Meta Attributes" and
                                            key != "Cognitive Style"):
                    if key not in self.persons[person_std]:
                        self.persons[person_std][key] = value
                
                # Handle array fields
                elif isinstance(value, list):
                    # For array fields like Personality Traits
                    if key not in self.persons[person_std]:
                        self.persons[person_std][key] = value
                    else:
                        # If exists, extend the array, avoiding duplicates
                        existing_items = self.persons[person_std][key]
                        if isinstance(existing_items, list):
                            # For personality traits, merge by trait name
                            if key == "Personality Traits":
                                # Extract existing trait names
                                existing_trait_names = [item.get('trait') for item in existing_items 
                                                      if isinstance(item, dict) and 'trait' in item]
                                # Add only new traits
                                for trait in value:
                                    if isinstance(trait, dict) and 'trait' in trait:
                                        if trait['trait'] not in existing_trait_names:
                                            existing_items.append(trait)
                            # For emotional triggers and other arrays of objects
                            elif key == "Emotional Profile" and "emotionalTriggers" in value:
                                if "emotionalTriggers" not in self.persons[person_std].get(key, {}):
                                    if key not in self.persons[person_std]:
                                        self.persons[person_std][key] = {}
                                    self.persons[person_std][key]["emotionalTriggers"] = value["emotionalTriggers"]
                                else:
                                    existing_triggers = self.persons[person_std][key]["emotionalTriggers"]
                                    existing_trigger_names = [t.get('trigger') for t in existing_triggers 
                                                           if isinstance(t, dict) and 'trigger' in t]
                                    for trigger in value.get("emotionalTriggers", []):
                                        if isinstance(trigger, dict) and 'trigger' in trigger:
                                            if trigger['trigger'] not in existing_trigger_names:
                                                existing_triggers.append(trigger)
                            # For psychological development array
                            elif key == "Psychological Development":
                                # Just append new periods that don't exist yet
                                existing_periods = [item.get('period') for item in existing_items
                                                  if isinstance(item, dict) and 'period' in item]
                                for period_item in value:
                                    if isinstance(period_item, dict) and 'period' in period_item:
                                        if period_item['period'] not in existing_periods:
                                            existing_items.append(period_item)
                            # For other array types, just extend
                            else:
                                for item in value:
                                    if item not in existing_items:
                                        existing_items.append(item)
                        else:
                            # If existing value is not a list, replace it
                            self.persons[person_std][key] = value
                
                # Handle object fields (nested dictionaries)
                elif isinstance(value, dict):
                    # For object fields like Cognitive Style
                    if key not in self.persons[person_std]:
                        self.persons[person_std][key] = value
                    else:
                        # Merge dictionaries, favoring new values for simple keys
                        existing_obj = self.persons[person_std][key]
                        if isinstance(existing_obj, dict):
                            # Deep merge of nested objects
                            for obj_key, obj_value in value.items():
                                # If nested object exists, merge it
                                if obj_key in existing_obj and isinstance(obj_value, dict) and isinstance(existing_obj[obj_key], dict):
                                    for inner_key, inner_value in obj_value.items():
                                        if inner_key not in existing_obj[obj_key]:
                                            existing_obj[obj_key][inner_key] = inner_value
                                # If field doesn't exist or is not an object, replace/add it
                                else:
                                    existing_obj[obj_key] = obj_value
                        else:
                            # If existing value is not a dictionary, replace it
                            self.persons[person_std][key] = value
            
            # Increment mentions counter
            self.persons[person_std]['mentions'] = self.persons[person_std].get('mentions', 0) + 1
        
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
        
        # Process persons with multiple mentions
        for name, person in self.persons.items():
            if person.get('mentions', 0) > 1:  # Only process persons with multiple mentions
                person['name'] = name
                profiles['persons'].append(person)
        
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