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
        
        # Process person details
        for person_name, details in data.get('personDetails', {}).items():
            # Merge details into existing person data
            person_std = standardize_entity(person_name)
            for key, value in details.items():
                if key not in self.persons[person_std]:
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
        
        # Track relationships
        for rel in data.get('relationships', []):
            self.relationships.append(rel)
    
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
            'reasoningSteps': []
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