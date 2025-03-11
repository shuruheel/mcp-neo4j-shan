"""Neo4j database operations for knowledge graph."""

import os
import logging
import json
from neo4j import GraphDatabase
from kg_schema import RELATIONSHIP_TYPES, RELATIONSHIP_CATEGORIES
from kg_utils import standardize_entity, list_to_string, extract_safely

class Neo4jConnection:
    """Singleton class for managing Neo4j connections"""
    _instance = None
    _driver = None
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = Neo4jConnection()
        return cls._instance
    
    def __init__(self):
        if Neo4jConnection._instance is not None:
            raise Exception("This class is a singleton. Use get_instance() instead.")
        
        Neo4jConnection._instance = self
        self._initialize_driver()
    
    def _initialize_driver(self):
        """Initialize the Neo4j driver with environment variables"""
        uri = os.getenv("NEO4J_URI")
        username = os.getenv("NEO4J_USERNAME")
        password = os.getenv("NEO4J_PASSWORD")
        
        if not all([uri, username, password]):
            raise ValueError("Neo4j connection details not found in environment variables")
        
        self._driver = GraphDatabase.driver(uri, auth=(username, password))
    
    def get_driver(self):
        """Get the Neo4j driver instance"""
        return self._driver
    
    def close(self):
        """Close the Neo4j driver connection"""
        if self._driver:
            self._driver.close()
            self._driver = None

    def test_connection(self):
        """Test the Neo4j connection and return True if successful"""
        try:
            with self._driver.session() as session:
                result = session.run("RETURN 1 AS num")
                return result.single()["num"] == 1
        except Exception as e:
            logging.error(f"Neo4j connection error: {str(e)}")
            return False

def setup_neo4j_constraints(session):
    """Set up Neo4j schema constraints for data integrity"""
    try:
        # Create constraints for basic node types
        session.run("""
        CREATE CONSTRAINT entity_name_unique IF NOT EXISTS 
        FOR (e:Entity) REQUIRE e.name IS UNIQUE
        """)
        
        session.run("""
        CREATE CONSTRAINT location_name_unique IF NOT EXISTS 
        FOR (l:Location) REQUIRE l.name IS UNIQUE
        """)
        
        session.run("""
        CREATE CONSTRAINT concept_name_unique IF NOT EXISTS 
        FOR (c:Concept) REQUIRE c.name IS UNIQUE
        """)
        
        # Create constraints for additional node types
        session.run("""
        CREATE CONSTRAINT attribute_name_unique IF NOT EXISTS 
        FOR (a:Attribute) REQUIRE a.name IS UNIQUE
        """)
        
        session.run("""
        CREATE CONSTRAINT proposition_name_unique IF NOT EXISTS 
        FOR (p:Proposition) REQUIRE p.name IS UNIQUE
        """)
        
        session.run("""
        CREATE CONSTRAINT emotion_name_unique IF NOT EXISTS 
        FOR (e:Emotion) REQUIRE e.name IS UNIQUE
        """)
        
        session.run("""
        CREATE CONSTRAINT agent_name_unique IF NOT EXISTS 
        FOR (a:Agent) REQUIRE a.name IS UNIQUE
        """)
        
        session.run("""
        CREATE CONSTRAINT thought_name_unique IF NOT EXISTS 
        FOR (t:Thought) REQUIRE t.name IS UNIQUE
        """)
        
        session.run("""
        CREATE CONSTRAINT scientific_insight_name_unique IF NOT EXISTS 
        FOR (s:ScientificInsight) REQUIRE s.name IS UNIQUE
        """)
        
        session.run("""
        CREATE CONSTRAINT law_name_unique IF NOT EXISTS 
        FOR (l:Law) REQUIRE l.name IS UNIQUE
        """)
        
        session.run("""
        CREATE CONSTRAINT reasoning_chain_name_unique IF NOT EXISTS 
        FOR (r:ReasoningChain) REQUIRE r.name IS UNIQUE
        """)
        
        session.run("""
        CREATE CONSTRAINT reasoning_step_name_unique IF NOT EXISTS 
        FOR (s:ReasoningStep) REQUIRE s.name IS UNIQUE
        """)
        
        logging.info("Neo4j schema constraints created successfully")
    except Exception as e:
        logging.error(f"Failed to create Neo4j constraints: {str(e)}")
        # Continue execution rather than failing

def add_node_to_neo4j(tx, node_data, node_type, label_field="name", special_handling=None):
    """Generic function to add any node type to Neo4j
    
    Args:
        tx: Neo4j transaction
        node_data: Dict containing node data
        node_type: Type of node (Entity, Location, etc.)
        label_field: Field to use as the unique identifier (default: name)
        special_handling: Optional function for custom field processing
        
    Returns:
        bool: Success status
    """
    # Skip if there's no identifier
    if not node_data.get(label_field):
        logging.warning(f"Skipping {node_type} with no {label_field}: {node_data}")
        return False
    
    # Skip if the name appears to be an attribute (specific to Entity nodes)
    if node_type == "Entity":
        name = node_data.get(label_field, "")
        if name.lower().startswith("observations:") or name.lower().startswith("keycontributions:"):
            logging.warning(f"Skipping entity that appears to be an attribute: {name}")
            return False
    
    # Process data with special handling if provided
    processed_data = node_data.copy()
    if special_handling:
        processed_data = special_handling(processed_data)
    
    # Process list fields to strings
    for key, value in processed_data.items():
        if isinstance(value, list) and not key.endswith("_json"):
            processed_data[key] = list_to_string(value)
    
    # Start building the query
    query = f"""
    MERGE (n:{node_type} {{{label_field}: ${label_field}}})
    SET n.nodeType = '{node_type}'
    """
    
    # Add all properties from processed_data
    for key in processed_data:
        if key != label_field:  # Skip the label field as it's already in the MERGE clause
            query += f", n.{key} = ${key}\n"
    
    query += "RETURN n"
    
    # Run the query
    result = tx.run(query, **processed_data)
    summary = result.consume()
    return summary.counters.nodes_created > 0 or summary.counters.properties_set > 0

def add_to_neo4j(tx, data):
    """Add an entity to Neo4j based on type"""
    if "entity" in data:
        return add_entity_to_neo4j(tx, data["entity"])
    elif "person" in data:
        return process_person_entity(tx, data["person"])
    elif "location" in data:
        return add_location_to_neo4j(tx, data["location"])
    elif "event" in data:
        return add_event_to_neo4j(tx, data["event"])
    elif "concept" in data:
        return add_concept_to_neo4j(tx, data["concept"])
    elif "attribute" in data:
        return add_attribute_to_neo4j(tx, data["attribute"])
    elif "proposition" in data:
        return add_proposition_to_neo4j(tx, data["proposition"])
    elif "emotion" in data:
        return add_emotion_to_neo4j(tx, data["emotion"])
    elif "agent" in data:
        return add_agent_to_neo4j(tx, data["agent"])
    elif "thought" in data:
        return add_thought_to_neo4j(tx, data["thought"])
    elif "scientificInsight" in data:
        return add_scientific_insight_to_neo4j(tx, data["scientificInsight"])
    elif "law" in data:
        return add_law_to_neo4j(tx, data["law"])
    elif "reasoningChain" in data:
        return add_reasoning_chain_to_neo4j(tx, data["reasoningChain"])
    elif "reasoningStep" in data:
        return add_reasoning_step_to_neo4j(tx, data["reasoningStep"])
    # Return False if no matching type
    return False

def add_entity_to_neo4j(tx, entity_data):
    """Add a basic entity to Neo4j"""
    # Use the generic node function with entity-specific processing
    def process_entity_data(data):
        processed = data.copy()
        processed["nodeType"] = data.get("nodeType", "Entity")
        processed["subType"] = data.get("subType", "")
        processed["description"] = data.get("description", "")
        processed["confidence"] = data.get("confidence", 0.0)
        processed["source"] = data.get("source", "")
        processed["biography"] = data.get("biography", "")
        processed["emotionalValence"] = data.get("emotionalValence", 0.0)
        processed["emotionalArousal"] = data.get("emotionalArousal", 0.0)
        return processed
    
    return add_node_to_neo4j(tx, entity_data, "Entity", "name", process_entity_data)

def process_person_entity(tx, person_data):
    """Process a person entity with extended psychological and emotional attributes"""
    if not person_data.get("name"):
        logging.warning(f"Skipping person with no name: {person_data}")
        return False
        
    # Extract person name and basic properties
    name = person_data.get("name", "")
    
    # Extract key psychological and emotional attributes
    personality_traits = []
    try:
        if "personalityTraits" in person_data and isinstance(person_data["personalityTraits"], list):
            personality_traits = person_data["personalityTraits"]
    except Exception as e:
        logging.warning(f"Error processing personality traits for {name}: {str(e)}")
    
    # Extract cognitive style
    cognitive_style = {}
    try:
        if "cognitiveStyle" in person_data and isinstance(person_data["cognitiveStyle"], dict):
            cognitive_style = person_data["cognitiveStyle"]
    except Exception as e:
        logging.warning(f"Error processing cognitive style for {name}: {str(e)}")
    
    # Extract emotional profile
    emotional_profile = {}
    try:
        if "emotionalProfile" in person_data and isinstance(person_data["emotionalProfile"], dict):
            emotional_profile = person_data["emotionalProfile"]
    except Exception as e:
        logging.warning(f"Error processing emotional profile for {name}: {str(e)}")
    
    # Extract relational dynamics
    relational_dynamics = {}
    try:
        if "relationalDynamics" in person_data and isinstance(person_data["relationalDynamics"], dict):
            relational_dynamics = person_data["relationalDynamics"]
    except Exception as e:
        logging.warning(f"Error processing relational dynamics for {name}: {str(e)}")
    
    # Extract value system
    value_system = {}
    try:
        if "valueSystem" in person_data and isinstance(person_data["valueSystem"], dict):
            value_system = person_data["valueSystem"]
    except Exception as e:
        logging.warning(f"Error processing value system for {name}: {str(e)}")
    
    # Extract psychological development
    psychological_development = []
    try:
        if "psychologicalDevelopment" in person_data and isinstance(person_data["psychologicalDevelopment"], list):
            psychological_development = person_data["psychologicalDevelopment"]
    except Exception as e:
        logging.warning(f"Error processing psychological development for {name}: {str(e)}")
    
    # Create comprehensive person details
    person_details = {
        "biography": person_data.get("biography", ""),
        "aliases": person_data.get("aliases", []),
        "personalityTraits": personality_traits,
        "cognitiveStyle": cognitive_style,
        "emotionalProfile": emotional_profile,
        "relationalDynamics": relational_dynamics,
        "valueSystem": value_system,
        "psychologicalDevelopment": psychological_development,
        "metaAttributes": person_data.get("metaAttributes", {}),
        "modelConfidence": person_data.get("modelConfidence", 0.0),
        "evidenceStrength": person_data.get("evidenceStrength", 0.0)
    }
    
    # Convert specific nested objects to JSON strings for storage
    personality_traits_json = json.dumps(personality_traits)
    cognitive_style_json = json.dumps(cognitive_style)
    emotional_profile_json = json.dumps(emotional_profile)
    relational_dynamics_json = json.dumps(relational_dynamics)
    value_system_json = json.dumps(value_system)
    psychological_development_json = json.dumps(psychological_development)
    
    # Extract emotional disposition and interpersonal style for direct properties
    emotional_disposition = ""
    if emotional_profile and "emotionalDisposition" in emotional_profile:
        emotional_disposition = emotional_profile["emotionalDisposition"]
    
    interpersonal_style = ""
    if relational_dynamics and "interpersonalStyle" in relational_dynamics:
        interpersonal_style = relational_dynamics["interpersonalStyle"]
    
    # Extract decision making style for direct property
    decision_making = ""
    if cognitive_style and "decisionMaking" in cognitive_style:
        decision_making = cognitive_style["decisionMaking"]
    
    # Extract ethical framework for direct property
    ethical_framework = ""
    if value_system and "ethicalFramework" in value_system:
        ethical_framework = value_system["ethicalFramework"]
    
    # Get a list of traits for summary
    trait_names = []
    if personality_traits:
        for trait_data in personality_traits:
            if isinstance(trait_data, dict) and "trait" in trait_data:
                trait_names.append(trait_data["trait"])
    
    # Combine traits into a summary string
    personality_summary = "; ".join(trait_names)
    
    # Convert observations to comma-separated string if it's a list
    observations = person_data.get("observations", [])
    if isinstance(observations, list):
        observations_str = "; ".join(observations)
    else:
        observations_str = str(observations)
        
    # Same for key contributions
    key_contributions = person_data.get("keyContributions", [])
    if isinstance(key_contributions, list):
        key_contributions_str = "; ".join(key_contributions)
    else:
        key_contributions_str = str(key_contributions)
    
    # Create or update the Person entity with all properties
    query = """
    MERGE (p:Entity {name: $name})
    SET p.nodeType = 'Entity',
        p.subType = 'Person',
        p.description = $description,
        p.biography = $biography,
        p.keyContributions = $keyContributions,
        p.observations = $observations,
        p.emotionalValence = $emotionalValence,
        p.emotionalArousal = $emotionalArousal,
        p.personalityTraits = $personalityTraits,
        p.personalitySummary = $personalitySummary,
        p.cognitiveStyle = $cognitiveStyle,
        p.decisionMaking = $decisionMaking,
        p.emotionalProfile = $emotionalProfile,
        p.emotionalDisposition = $emotionalDisposition,
        p.relationalDynamics = $relationalDynamics,
        p.interpersonalStyle = $interpersonalStyle,
        p.valueSystem = $valueSystem,
        p.ethicalFramework = $ethicalFramework,
        p.psychologicalDevelopment = $psychologicalDevelopment,
        p.source = $source,
        p.confidence = $confidence
    RETURN p
    """
    
    result = tx.run(query,
           name=name,
           description=person_data.get("description", person_data.get("biography", "")),
           biography=person_data.get("biography", ""),
           keyContributions=key_contributions_str,
           observations=observations_str,
           emotionalValence=person_data.get("emotionalValence", 0.5),
           emotionalArousal=person_data.get("emotionalArousal", 0.5),
           personalityTraits=personality_traits_json,
           personalitySummary=personality_summary,
           cognitiveStyle=cognitive_style_json,
           decisionMaking=decision_making,
           emotionalProfile=emotional_profile_json,
           emotionalDisposition=emotional_disposition,
           relationalDynamics=relational_dynamics_json,
           interpersonalStyle=interpersonal_style,
           valueSystem=value_system_json,
           ethicalFramework=ethical_framework,
           psychologicalDevelopment=psychological_development_json,
           source=person_data.get("source", ""),
           confidence=person_data.get("confidence", 0.8))
    
    summary = result.consume()
    
    # Create individual personality trait nodes and connect them
    if personality_traits:
        for trait_data in personality_traits:
            if isinstance(trait_data, dict) and "trait" in trait_data:
                trait_name = trait_data["trait"]
                # Create an Attribute node if it doesn't exist
                attribute_query = """
                MERGE (a:Attribute {name: $traitName})
                ON CREATE SET a.nodeType = 'Attribute',
                             a.valueType = 'trait',
                             a.description = 'Personality trait'
                """
                tx.run(attribute_query, traitName=trait_name)
                
                # Connect the person to the attribute with confidence if available
                confidence = trait_data.get("confidence", 0.8)
                rel_query = """
                MATCH (p:Entity {name: $personName})
                MATCH (a:Attribute {name: $traitName})
                MERGE (p)-[r:HAS_ATTRIBUTE]->(a)
                SET r.confidence = $confidence
                """
                tx.run(rel_query, personName=name, traitName=trait_name, confidence=confidence)
    
    return True

def add_location_to_neo4j(tx, location_data):
    """Add a location entity to Neo4j"""
    query = """
    MERGE (l:Location {name: $name})
    SET l.nodeType = 'Location',
        l.locationType = $locationType,
        l.description = $description,
        l.locationSignificance = $significance
    """
    
    params = {
        "name": location_data.get("name", ""),
        "locationType": location_data.get("Type", location_data.get("locationType", "")),
        "description": location_data.get("description", ""),
        "significance": location_data.get("Significance", location_data.get("locationSignificance", ""))
    }
    
    # Add coordinates if present
    if "coordinates" in location_data and location_data["coordinates"]:
        if "latitude" in location_data["coordinates"] and "longitude" in location_data["coordinates"]:
            query += ", l.latitude = $latitude, l.longitude = $longitude"
            params["latitude"] = location_data["coordinates"]["latitude"]
            params["longitude"] = location_data["coordinates"]["longitude"]
    
    tx.run(query, **params)
    
    # Process location containment relationship if present
    contained_in = location_data.get("Contained in", location_data.get("containedIn", ""))
    if contained_in:
        container_name = contained_in
        # Create the container location if it doesn't exist
        tx.run("""
        MERGE (c:Location {name: $container})
        """, container=container_name)
        
        # Create the CONTAINED_IN relationship
        tx.run("""
        MATCH (l:Location {name: $location})
        MATCH (c:Location {name: $container})
        MERGE (l)-[:CONTAINED_IN]->(c)
        """, location=location_data.get("name", ""), container=container_name)
    
    return True

def add_event_to_neo4j(tx, event_data):
    """Add an event entity to Neo4j"""
    query = """
    MERGE (e:Event {name: $name})
    SET e.nodeType = 'Event',
        e.startDate = $startDate,
        e.endDate = $endDate,
        e.status = $status,
        e.location = $location,
        e.outcome = $outcome,
        e.significance = $significance
    """
    
    tx.run(query,
           name=event_data.get("name", ""),
           startDate=event_data.get("startDate", ""),
           endDate=event_data.get("endDate", ""),
           status=event_data.get("status", ""),
           location=event_data.get("location", ""),
           outcome=event_data.get("outcome", ""),
           significance=event_data.get("significance", ""))
    
    # Create relationships for participants if available
    participants = event_data.get("participants", [])
    for participant in participants:
        participant_name = standardize_entity(participant)
        # Create entity if it doesn't exist
        tx.run("""
        MERGE (p:Entity {name: $name})
        """, name=participant_name)
        
        # Create PARTICIPANT relationship
        tx.run("""
        MATCH (e:Event {name: $event})
        MATCH (p:Entity {name: $participant})
        MERGE (p)-[:PARTICIPANT]->(e)
        """, event=event_data["name"], participant=participant_name)

def add_concept_to_neo4j(tx, concept_data):
    """Add a concept entity to Neo4j"""
    query = """
    MERGE (c:Concept {name: $name})
    SET c.nodeType = 'Concept',
        c.definition = $definition,
        c.description = $description,
        c.domain = $domain,
        c.significance = $significance
    """
    
    tx.run(query,
           name=concept_data.get("name", ""),
           definition=concept_data.get("definition", ""),
           description=concept_data.get("description", ""),
           domain=concept_data.get("domain", ""),
           significance=concept_data.get("significance", ""))
    
    # Create relationships for examples if available
    examples = concept_data.get("examples", [])
    for example in examples:
        example_name = standardize_entity(example)
        # Create entity if it doesn't exist
        tx.run("""
        MERGE (e:Entity {name: $name})
        """, name=example_name)
        
        # Create INSTANCE_OF relationship
        tx.run("""
        MATCH (c:Concept {name: $concept})
        MATCH (e:Entity {name: $example})
        MERGE (e)-[:INSTANCE_OF]->(c)
        """, concept=concept_data["name"], example=example_name)

def add_attribute_to_neo4j(tx, attribute_data):
    """Add an attribute node to Neo4j"""
    def process_attribute_data(data):
        processed = data.copy()
        processed["value"] = data.get("value", "")
        processed["unit"] = data.get("unit", "")
        processed["valueType"] = data.get("valueType", "")
        processed["description"] = data.get("description", "")
        return processed
    
    return add_node_to_neo4j(tx, attribute_data, "Attribute", "name", process_attribute_data)

def add_proposition_to_neo4j(tx, proposition_data):
    """Add a proposition node to Neo4j"""
    # Create the proposition node
    query = """
    MERGE (p:Proposition {name: $name})
    SET p.nodeType = 'Proposition',
        p.statement = $statement,
        p.status = $status,
        p.confidence = $confidence,
        p.truthValue = $truthValue,
        p.sources = $sources,
        p.domain = $domain,
        p.emotionalValence = $emotionalValence,
        p.emotionalArousal = $emotionalArousal,
        p.evidenceStrength = $evidenceStrength,
        p.counterEvidence = $counterEvidence
    RETURN p
    """
    
    result = tx.run(query,
           name=proposition_data.get("name", ""),
           statement=proposition_data.get("statement", ""),
           status=proposition_data.get("status", ""),
           confidence=proposition_data.get("confidence", 0.0),
           truthValue=proposition_data.get("truthValue", None),
           sources=proposition_data.get("sources", []),
           domain=proposition_data.get("domain", ""),
           emotionalValence=proposition_data.get("emotionalValence", 0.0),
           emotionalArousal=proposition_data.get("emotionalArousal", 0.0),
           evidenceStrength=proposition_data.get("evidenceStrength", 0.0),
           counterEvidence=proposition_data.get("counterEvidence", []))
    
    # Create relationships to sources if present
    if "sources" in proposition_data and isinstance(proposition_data["sources"], list):
        for source in proposition_data["sources"]:
            if source:  # Skip empty values
                # Create relationship between proposition and source entity
                source_rel_query = """
                MATCH (p:Proposition {name: $propName})
                MATCH (e:Entity {name: $sourceName})
                MERGE (p)-[rel:DERIVED_FROM]->(e)
                RETURN rel
                """
                
                tx.run(source_rel_query, propName=proposition_data.get("name", ""), sourceName=source)
    
    summary = result.consume()
    return summary.counters.nodes_created > 0 or summary.counters.properties_set > 0

def add_emotion_to_neo4j(tx, emotion_data):
    """Add an emotion node to Neo4j"""
    def process_emotion_data(data):
        processed = data.copy()
        processed["intensity"] = data.get("intensity", 0.0)
        processed["valence"] = data.get("valence", 0.0)
        processed["category"] = data.get("category", "")
        processed["subcategory"] = data.get("subcategory", "")
        processed["description"] = data.get("description", "")
        return processed
    
    return add_node_to_neo4j(tx, emotion_data, "Emotion", "name", process_emotion_data)

def add_agent_to_neo4j(tx, agent_data):
    """Add an agent node to Neo4j"""
    query = """
    MERGE (a:Agent {name: $name})
    SET a.nodeType = 'Agent',
        a.agentType = $agentType,
        a.description = $description,
        a.capabilities = $capabilities
    """
    
    # Add AI-specific attributes if agentType is "ai"
    if agent_data.get("agentType", "").lower() == "ai":
        query += """
        , a.modelName = $modelName,
        a.provider = $provider,
        a.apiEndpoint = $apiEndpoint,
        a.trainingData = $trainingData,
        a.operationalConstraints = $operationalConstraints,
        a.performanceMetrics = $performanceMetrics,
        a.version = $version,
        a.operationalStatus = $operationalStatus,
        a.ownership = $ownership,
        a.interactionHistory = $interactionHistory
        """
    
    # Add general agent attributes
    query += """
    , a.beliefs = $beliefs,
        a.knowledge = $knowledge,
        a.preferences = $preferences,
        a.emotionalState = $emotionalState
    RETURN a
    """
    
    params = {
        "name": agent_data.get("name", ""),
        "agentType": agent_data.get("agentType", ""),
        "description": agent_data.get("description", ""),
        "capabilities": agent_data.get("capabilities", []),
        "beliefs": agent_data.get("beliefs", []),
        "knowledge": agent_data.get("knowledge", []),
        "preferences": agent_data.get("preferences", []),
        "emotionalState": agent_data.get("emotionalState", "")
    }
    
    # Add AI-specific parameters if needed
    if agent_data.get("agentType", "").lower() == "ai":
        ai_params = {
            "modelName": agent_data.get("modelName", ""),
            "provider": agent_data.get("provider", ""),
            "apiEndpoint": agent_data.get("apiEndpoint", ""),
            "trainingData": agent_data.get("trainingData", []),
            "operationalConstraints": agent_data.get("operationalConstraints", []),
            "performanceMetrics": agent_data.get("performanceMetrics", {}),
            "version": agent_data.get("version", ""),
            "operationalStatus": agent_data.get("operationalStatus", ""),
            "ownership": agent_data.get("ownership", ""),
            "interactionHistory": agent_data.get("interactionHistory", [])
        }
        params.update(ai_params)
    
    result = tx.run(query, **params)
    
    summary = result.consume()
    return summary.counters.nodes_created > 0 or summary.counters.properties_set > 0

def add_thought_to_neo4j(tx, thought_data):
    """Add a thought node to Neo4j"""
    # Create the thought node
    query = """
    MERGE (t:Thought {name: $name})
    SET t.nodeType = 'Thought',
        t.thoughtContent = $thoughtContent,
        t.references = $references,
        t.confidence = $confidence,
        t.source = $source,
        t.createdBy = $createdBy,
        t.tags = $tags,
        t.impact = $impact,
        t.emotionalValence = $emotionalValence,
        t.emotionalArousal = $emotionalArousal,
        t.evidentialBasis = $evidentialBasis,
        t.thoughtCounterarguments = $thoughtCounterarguments,
        t.implications = $implications,
        t.thoughtConfidenceScore = $thoughtConfidenceScore,
        t.reasoningChains = $reasoningChains
    RETURN t
    """
    
    result = tx.run(query,
           name=thought_data.get("name", ""),
           thoughtContent=thought_data.get("thoughtContent", ""),
           references=thought_data.get("references", []),
           confidence=thought_data.get("confidence", 0.0),
           source=thought_data.get("source", ""),
           createdBy=thought_data.get("createdBy", ""),
           tags=thought_data.get("tags", []),
           impact=thought_data.get("impact", ""),
           emotionalValence=thought_data.get("emotionalValence", 0.0),
           emotionalArousal=thought_data.get("emotionalArousal", 0.0),
           evidentialBasis=thought_data.get("evidentialBasis", []),
           thoughtCounterarguments=thought_data.get("thoughtCounterarguments", []),
           implications=thought_data.get("implications", []),
           thoughtConfidenceScore=thought_data.get("thoughtConfidenceScore", 0.0),
           reasoningChains=thought_data.get("reasoningChains", []))
    
    # Create relationships to reasoning chains
    if "reasoningChains" in thought_data and isinstance(thought_data["reasoningChains"], list):
        for chain in thought_data["reasoningChains"]:
            if chain:  # Skip empty values
                # Create relationship between thought and reasoning chain
                chain_rel_query = """
                MATCH (t:Thought {name: $thoughtName})
                MATCH (r:ReasoningChain {name: $chainName})
                MERGE (t)-[rel:PROPOSED]->(r)
                RETURN rel
                """
                
                tx.run(chain_rel_query, thoughtName=thought_data.get("name", ""), chainName=chain)
    
    # Create relationships to referenced entities
    if "references" in thought_data and isinstance(thought_data["references"], list):
        for ref in thought_data["references"]:
            if ref:  # Skip empty values
                # Create relationship between thought and referenced entity
                ref_rel_query = """
                MATCH (t:Thought {name: $thoughtName})
                MATCH (e:Entity {name: $refName})
                MERGE (t)-[rel:REFERS_TO]->(e)
                RETURN rel
                """
                
                tx.run(ref_rel_query, thoughtName=thought_data.get("name", ""), refName=ref)
    
    # Create relationship to creator if present
    creator = thought_data.get("createdBy", "")
    if creator:
        creator_rel_query = """
        MATCH (t:Thought {name: $thoughtName})
        MATCH (e:Entity {name: $creatorName})
        MERGE (e)-[rel:CREATED]->(t)
        RETURN rel
        """
        
        tx.run(creator_rel_query, thoughtName=thought_data.get("name", ""), creatorName=creator)
    
    summary = result.consume()
    return summary.counters.nodes_created > 0 or summary.counters.properties_set > 0

def add_scientific_insight_to_neo4j(tx, insight_data):
    """Add a scientific insight node to Neo4j"""
    def process_insight_data(data):
        processed = data.copy()
        processed["hypothesis"] = data.get("hypothesis", "")
        processed["methodology"] = data.get("methodology", "")
        processed["confidence"] = data.get("confidence", 0.0)
        processed["field"] = data.get("field", "")
        processed["emotionalValence"] = data.get("emotionalValence", 0.0)
        processed["emotionalArousal"] = data.get("emotionalArousal", 0.0)
        processed["evidenceStrength"] = data.get("evidenceStrength", 0.0)
        processed["replicationStatus"] = data.get("replicationStatus", "")
        processed["surpriseValue"] = data.get("surpriseValue", 0.0)
        return processed
    
    return add_node_to_neo4j(tx, insight_data, "ScientificInsight", "name", process_insight_data)

def add_law_to_neo4j(tx, law_data):
    """Add a law node to Neo4j"""
    def process_law_data(data):
        processed = data.copy()
        processed["statement"] = data.get("statement", "")
        processed["domain"] = data.get("domain", "")
        processed["emotionalValence"] = data.get("emotionalValence", 0.0)
        processed["emotionalArousal"] = data.get("emotionalArousal", 0.0)
        processed["formalRepresentation"] = data.get("formalRepresentation", "")
        return processed
    
    return add_node_to_neo4j(tx, law_data, "Law", "name", process_law_data)

def add_reasoning_chain_to_neo4j(tx, chain_data):
    """Add a reasoning chain node to Neo4j"""
    chain_name = chain_data.get("name", "")
    logging.info(f"Creating ReasoningChain node: {chain_name}")
    
    def process_chain_data(data):
        processed = data.copy()
        processed["description"] = data.get("description", "")
        processed["conclusion"] = data.get("conclusion", "")
        processed["confidenceScore"] = data.get("confidenceScore", 0.0)
        processed["creator"] = data.get("creator", "")
        processed["methodology"] = data.get("methodology", "")
        processed["domain"] = data.get("domain", "")
        processed["sourceThought"] = data.get("sourceThought", "")
        processed["numberOfSteps"] = data.get("numberOfSteps", 0)
        return processed
    
    # DO NOT create relationships to steps - this will be done in the relationship phase
    # DO NOT create relationships to related propositions - this will be done in the relationship phase
    # DO NOT create relationship to source thought - this will be done in the relationship phase
    
    return add_node_to_neo4j(tx, chain_data, "ReasoningChain", "name", process_chain_data)

def add_reasoning_step_to_neo4j(tx, step_data):
    """Add a reasoning step node to Neo4j"""
    step_name = step_data.get("name", "")
    chain_name = step_data.get("chain", "") or step_data.get("chainName", "")
        
    def process_step_data(data):
        processed = data.copy()
        processed["content"] = data.get("content", "")
        processed["stepType"] = data.get("stepType", "")
        processed["evidenceType"] = data.get("evidenceType", "")
        processed["confidence"] = data.get("confidence", 0.0)
        processed["formalNotation"] = data.get("formalNotation", "")
        processed["chainName"] = chain_name
        return processed
    
    # Create the step node
    result = add_node_to_neo4j(tx, step_data, "ReasoningStep", "name", process_step_data)
    
    # Create relationships to propositions
    if "propositions" in step_data and isinstance(step_data["propositions"], list):
        for prop in step_data["propositions"]:
            if prop:  # Skip empty values
                # Create relationship between step and proposition
                prop_rel_query = """
                MATCH (s:ReasoningStep {name: $stepName})
                MATCH (p:Proposition {name: $propName})
                MERGE (s)-[rel:USES]->(p)
                RETURN rel
                """
                
                prop_result = tx.run(prop_rel_query, stepName=step_name, propName=prop)
                prop_summary = prop_result.consume()
                
                if prop_summary.counters.relationships_created > 0:
                    # logging.info(f"Created USES relationship: {step_name} -[USES]-> {prop}")
                    pass
    
    # DO NOT create relationships to chain or check if chain exists - this will be done in the relationship phase
    
    return result

def add_relationship_to_neo4j(tx, relationship_data):
    """Add a structured relationship to Neo4j following best practices"""
    # Skip if relationship data is incomplete
    if not isinstance(relationship_data, dict) or 'needsProcessing' in relationship_data:
        logging.warning("Skipping relationship that needs processing")
        return False
    
    # Extract source, target, and relationship type
    source_data = relationship_data.get('source', {})
    target_data = relationship_data.get('target', {})
    rel_type = relationship_data.get('type')
    
    # Skip if missing critical data
    if not source_data or not target_data or not rel_type:
        logging.warning(f"Incomplete relationship data (missing source, target, or relationship type): {relationship_data}")
        return False
    
    source_name = source_data.get('name', '')
    source_type = source_data.get('type', 'Entity')
    target_name = target_data.get('name', '')
    target_type = target_data.get('type', 'Entity')
    
    # Skip if missing names
    if not source_name or not target_name:
        logging.warning(f"Missing source or target name in relationship: {relationship_data}")
        return False
    
    # Map for known label casing issues
    # This maps lowercase labels to their proper cased version in the database
    LABEL_CASE_MAP = {
        "person": "Person",
        "organization": "Organization",
        "location": "Location",
        "event": "Event",
        "concept": "Concept",
        "entity": "Entity",
        "proposition": "Proposition",
        "thought": "Thought",
        "reasoningstep": "ReasoningStep",
        "reasoningchain": "ReasoningChain",
        "attribute": "Attribute",
        "emotion": "Emotion",
        "agent": "Agent",
        "scientificinsight": "ScientificInsight",
        "law": "Law"
    }
    
    # Normalize source and target types for case-sensitivity
    source_type_normalized = LABEL_CASE_MAP.get(source_type.lower(), source_type)
    target_type_normalized = LABEL_CASE_MAP.get(target_type.lower(), target_type)
    
    # Log non-standard relationship types but still allow them
    if rel_type not in RELATIONSHIP_TYPES:
        logging.info(f"Creating non-standard relationship type: {rel_type} between {source_name} and {target_name}")
    
    # Extract properties
    properties = relationship_data.get('properties', {})
    
    # Add default confidence if not present
    if 'confidenceScore' not in properties:
        properties['confidenceScore'] = 0.7
    
    # Determine relationship category
    if rel_type in ["IS_A", "INSTANCE_OF", "SUB_CLASS_OF", "SUPER_CLASS_OF"]:
        rel_category = "hierarchical"
    elif rel_type in ["BEFORE", "AFTER", "DURING"]:
        rel_category = "temporal"
    elif rel_type in ["HAS_PART", "PART_OF", "PART_OF_CHAIN"]:
        rel_category = "compositional"
    elif rel_type in ["CAUSES", "CAUSED_BY", "INFLUENCES", "INFLUENCED_BY"]:
        rel_category = "causal"
    elif rel_type in ["HAS_PROPERTY", "PROPERTY_OF"]:
        rel_category = "attributive"
    else:
        rel_category = "lateral"
    
    properties['relationshipCategory'] = rel_category
    properties['source_type'] = source_type_normalized 
    properties['target_type'] = target_type_normalized
    
    # Build property string for relationship
    property_clauses = []
    for key, value in properties.items():
        property_clauses.append(f"r.{key} = ${key}")
    
    property_string = ", ".join(property_clauses) if property_clauses else "r.created = timestamp()"
    
    # Add source and target to properties for query
    params = properties.copy()
    params['source_name'] = source_name
    params['target_name'] = target_name
    
    # Define known entity subtypes that should be handled as Entity nodes
    ENTITY_SUBTYPES = ["Person", "Organization", "Location", "Artifact", "Animal"]
    
    # Case-insensitive check for entity subtypes
    source_is_entity_subtype = source_type_normalized in ENTITY_SUBTYPES or source_type_normalized.lower() in [x.lower() for x in ENTITY_SUBTYPES]
    target_is_entity_subtype = target_type_normalized in ENTITY_SUBTYPES or target_type_normalized.lower() in [x.lower() for x in ENTITY_SUBTYPES]
    
    # First, check if the nodes exist with a case-insensitive approach
    # For source node
    if source_is_entity_subtype:
        # Try to find the entity with the right subType (case insensitive)
        find_source_query = """
        MATCH (source:Entity)
        WHERE source.name = $source_name 
          AND toLower(source.subType) = toLower($subType)
        RETURN true as source_exists, 'Entity' as label
        """
        source_params = {'source_name': source_name, 'subType': source_type_normalized}
    else:
        # Try to find the node with the label using custom casing check
        find_source_query = """
        CALL apoc.meta.nodeTypeProperties() YIELD nodeType
        WITH collect(nodeType) AS nodeTypes
        UNWIND nodeTypes AS type
        WITH type WHERE toLower(type) = toLower($nodeType)
        CALL apoc.cypher.run('MATCH (source:' + type + ' {name: $name}) RETURN true as exists', {name: $name}) YIELD value
        RETURN value.exists as source_exists, type as label
        """
        source_params = {'nodeType': source_type_normalized, 'name': source_name}
    
    # For target node
    if target_is_entity_subtype:
        # Try to find the entity with the right subType (case insensitive)
        find_target_query = """
        MATCH (target:Entity)
        WHERE target.name = $target_name 
          AND toLower(target.subType) = toLower($subType)
        RETURN true as target_exists, 'Entity' as label
        """
        target_params = {'target_name': target_name, 'subType': target_type_normalized}
    else:
        # Try to find the node with the label using custom casing check
        find_target_query = """
        CALL apoc.meta.nodeTypeProperties() YIELD nodeType
        WITH collect(nodeType) AS nodeTypes
        UNWIND nodeTypes AS type
        WITH type WHERE toLower(type) = toLower($nodeType)
        CALL apoc.cypher.run('MATCH (target:' + type + ' {name: $name}) RETURN true as exists', {name: $name}) YIELD value
        RETURN value.exists as target_exists, type as label
        """
        target_params = {'nodeType': target_type_normalized, 'name': target_name}
    
    # Execute actual queries to check if nodes exist
    try:
        # Try to find the source node
        source_result = tx.run(find_source_query, **source_params).single()
        source_exists = source_result and source_result["source_exists"]
        source_label = source_result and source_result["label"]
        
        # If the source node doesn't exist with the expected type, try to find it with any label
        if not source_exists:
            find_any_source_query = """
            MATCH (source)
            WHERE toLower(source.name) = toLower($source_name)
            RETURN labels(source)[0] as label
            """
            any_source_result = tx.run(find_any_source_query, source_name=source_name).single()
            if any_source_result:
                source_exists = True
                source_label = any_source_result["label"]
                # Only log if the label is actually different (case-insensitive comparison)
                if source_label.lower() != source_type_normalized.lower():
                    logging.info(f"Found source node '{source_name}' with different label: {source_label} (expected: {source_type_normalized})")
                    # Log the actual node name to help identify case mismatches
                    actual_name_query = """
                    MATCH (n)
                    WHERE toLower(n.name) = toLower($name)
                    RETURN n.name as actual_name
                    LIMIT 1
                    """
                    actual_name_result = tx.run(actual_name_query, name=source_name).single()
                    if actual_name_result and actual_name_result["actual_name"] != source_name:
                        logging.info(f"Case mismatch - Actual node name: '{actual_name_result['actual_name']}', Requested: '{source_name}'")
        
        # Try to find the target node
        target_result = tx.run(find_target_query, **target_params).single()
        target_exists = target_result and target_result["target_exists"]
        target_label = target_result and target_result["label"]
        
        # If the target node doesn't exist with the expected type, try to find it with any label
        if not target_exists:
            find_any_target_query = """
            MATCH (target)
            WHERE toLower(target.name) = toLower($target_name)
            RETURN labels(target)[0] as label
            """
            any_target_result = tx.run(find_any_target_query, target_name=target_name).single()
            if any_target_result:
                target_exists = True
                target_label = any_target_result["label"]
                # Only log if the label is actually different (case-insensitive comparison)
                if target_label.lower() != target_type_normalized.lower():
                    logging.info(f"Found target node '{target_name}' with different label: {target_label} (expected: {target_type_normalized})")
                    # Log the actual node name to help identify case mismatches
                    actual_name_query = """
                    MATCH (n)
                    WHERE toLower(n.name) = toLower($name)
                    RETURN n.name as actual_name
                    LIMIT 1
                    """
                    actual_name_result = tx.run(actual_name_query, name=target_name).single()
                    if actual_name_result and actual_name_result["actual_name"] != target_name:
                        logging.info(f"Case mismatch - Actual node name: '{actual_name_result['actual_name']}', Requested: '{target_name}'")
    except Exception as e:
        logging.warning(f"Error checking node existence: {str(e)}")
        # If query fails due to non-existent label, try with the original type
        # This is often due to the label not existing in the database yet
        source_exists = False
        target_exists = False
    
    # If either node doesn't exist, log the error and skip creating this relationship
    if not source_exists or not target_exists:
        # Record missing nodes for later reporting
        
        # Add to global missing nodes counter (these will be reported at the end)
        global missing_source_nodes, missing_target_nodes
        if not source_exists:
            if 'missing_source_nodes' not in globals():
                global missing_source_nodes
                missing_source_nodes = set()
            missing_source_nodes.add((source_name, source_type_normalized))
        
        if not target_exists:
            if 'missing_target_nodes' not in globals():
                global missing_target_nodes
                missing_target_nodes = set()
            missing_target_nodes.add((target_name, target_type_normalized))
        
        return False
    
    # Create the relationship using the actual labels of the nodes
    relationship_query = f"""
    MATCH (s:{source_label})
    WHERE toLower(s.name) = toLower($source_name)
    MATCH (t:{target_label})
    WHERE toLower(t.name) = toLower($target_name)
    MERGE (s)-[r:{rel_type}]->(t)
    SET {property_string}
    RETURN r
    """
    
    try:
        result = tx.run(relationship_query, **params)
        summary = result.consume()
        
        if summary.counters.relationships_created > 0:
            logging.info(f"Created relationship: {source_name} -[{rel_type}]-> {target_name}")
            return True
        elif summary.counters.properties_set > 0:
            logging.info(f"Updated relationship properties: {source_name} -[{rel_type}]-> {target_name}")
            return True
        else:
            logging.warning(f"No relationship created or updated: {source_name} -[{rel_type}]-> {target_name}")
            return False
    except Exception as e:
        logging.error(f"Error creating relationship {source_name} -[{rel_type}]-> {target_name}: {str(e)}")
        
        # If there's still an error, try one last approach - create without specifying labels
        try:
            fallback_query = f"""
            MATCH (s)
            WHERE toLower(s.name) = toLower($source_name)
            MATCH (t)
            WHERE toLower(t.name) = toLower($target_name)
            MERGE (s)-[r:{rel_type}]->(t)
            SET {property_string}
            RETURN r
            """
            result = tx.run(fallback_query, **params)
            summary = result.consume()
            
            if summary.counters.relationships_created > 0 or summary.counters.properties_set > 0:
                logging.info(f"Added relationship using fallback: {source_name} --{rel_type}--> {target_name}")
                return True
        except Exception as e2:
            logging.error(f"Fallback also failed: {str(e2)}")
        
        return False

def process_relationships(session, relationships):
    """Process a list of relationships and add them to Neo4j"""
    success_count = 0
    skipped_count = 0
    
    # Initialize global tracking of missing nodes
    global missing_source_nodes, missing_target_nodes
    if 'missing_source_nodes' not in globals():
        missing_source_nodes = set()
    if 'missing_target_nodes' not in globals():
        missing_target_nodes = set()
    
    for relationship in relationships:
        try:
            with session.begin_transaction() as tx:
                if add_relationship_to_neo4j(tx, relationship):
                    success_count += 1
                else:
                    skipped_count += 1
        except Exception as e:
            logging.error(f"Error adding relationship to Neo4j: {str(e)}")
            skipped_count += 1
    
    # Log relationship statistics
    logging.info(f"Added {success_count} relationships to Neo4j")
    logging.info(f"Skipped {skipped_count} relationships due to errors or missing nodes")
    
    # Report missing nodes
    if missing_source_nodes:
        logging.warning(f"Missing source nodes prevented {len(missing_source_nodes)} relationships")
        for name, node_type in sorted(missing_source_nodes):
            logging.warning(f"  Missing source: {name} (type: {node_type})")
    
    if missing_target_nodes:
        logging.warning(f"Missing target nodes prevented {len(missing_target_nodes)} relationships")
        for name, node_type in sorted(missing_target_nodes):
            logging.warning(f"  Missing target: {name} (type: {node_type})")
    
    return success_count


def create_placeholder_node(tx, name, node_type):
    """Create a minimal placeholder node of the specified type with just a name
    
    Args:
        tx: Neo4j transaction
        name: Name of the node to create
        node_type: Type/label of the node (Entity, Person, Location, etc.)
    
    Returns:
        bool: True if node was created, False otherwise
    """
    # Skip if name is empty
    if not name:
        return False
    
    # Define known entity subtypes that should be created as Entity nodes with subType
    ENTITY_SUBTYPES = ["Person", "Organization", "Location", "Artifact", "Animal"]
    
    # Map for known label casing issues
    # This maps lowercase labels to their proper cased version in the database
    LABEL_CASE_MAP = {
        "person": "Person",
        "organization": "Organization",
        "location": "Location",
        "event": "Event",
        "concept": "Concept",
        "entity": "Entity",
        "proposition": "Proposition",
        "thought": "Thought",
        "reasoningstep": "ReasoningStep",
        "reasoningchain": "ReasoningChain",
        "attribute": "Attribute",
        "emotion": "Emotion",
        "agent": "Agent",
        "scientificinsight": "ScientificInsight",
        "law": "Law"
    }
    
    # Normalize the node type for case-sensitivity
    node_type_normalized = LABEL_CASE_MAP.get(node_type.lower(), node_type)
    
    try:
        if node_type_normalized in ENTITY_SUBTYPES:
            # For entity subtypes, create an Entity node with appropriate subType
            query = """
            CREATE (e:Entity {name: $name, nodeType: 'Entity', subType: $subType, 
                description: 'Placeholder node', 
                source: 'Auto-created for relationship', 
                isPlaceholder: true})
            RETURN e
            """
            result = tx.run(query, name=name, subType=node_type_normalized)
        else:
            # For other node types, create with the specific label
            query = f"""
            CREATE (e:{node_type_normalized} {{name: $name, nodeType: $node_type, 
                description: 'Placeholder node', 
                source: 'Auto-created for relationship',
                isPlaceholder: true}})
            RETURN e
            """
            result = tx.run(query, name=name, node_type=node_type_normalized)
        
        summary = result.consume()
        if summary.counters.nodes_created > 0:
            logging.info(f"Created placeholder {node_type_normalized} node: '{name}'")
            return True
        return False
    except Exception as e:
        logging.error(f"Error creating placeholder node '{name}' of type {node_type_normalized}: {str(e)}")
        return False 