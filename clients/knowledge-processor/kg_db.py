"""Neo4j database operations for knowledge graph."""

import os
import logging
from neo4j import GraphDatabase
from kg_schema import RELATIONSHIP_TYPES, RELATIONSHIP_CATEGORIES
from kg_utils import standardize_entity

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
    query = """
    MERGE (e:Entity {name: $name})
    SET e.nodeType = $nodeType,
        e.subType = $subType,
        e.description = $description,
        e.confidence = $confidence
    RETURN e
    """
    
    result = tx.run(query,
           name=entity_data.get("name", ""),
           nodeType=entity_data.get("nodeType", "Entity"),
           subType=entity_data.get("subType", ""),
           description=entity_data.get("description", ""),
           confidence=entity_data.get("confidence", 0.7))
    
    # Actually process the result to force execution
    summary = result.consume()
    return summary.counters.nodes_created > 0 or summary.counters.properties_set > 0

def process_person_entity(tx, person_data):
    """Process a person entity with extended attributes"""
    # First add the basic entity
    entity_data = {
        "name": person_data.get("name", ""),
        "nodeType": "Entity",
        "subType": "Person",
        "description": person_data.get("biography", "")
    }
    add_entity_to_neo4j(tx, entity_data)
    
    # Then add person-specific attributes as properties
    query = """
    MATCH (p:Entity {name: $name})
    SET p.biography = $biography,
        p.personalityTraits = $personalityTraits,
        p.cognitiveStyle = $cognitiveStyle,
        p.emotionalDisposition = $emotionalDisposition,
        p.interpersonalStyle = $interpersonalStyle,
        p.coreValues = $coreValues
    """
    
    tx.run(query,
           name=person_data.get("name", ""),
           biography=person_data.get("biography", ""),
           personalityTraits=person_data.get("Personality", ""),
           cognitiveStyle=person_data.get("Cognitive Style", ""),
           emotionalDisposition=person_data.get("Emotional", ""),
           interpersonalStyle=person_data.get("Relationships", ""),
           coreValues=person_data.get("Values", ""))

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
        """, location=location_data["name"], container=container_name)

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
    query = """
    MERGE (a:Attribute {name: $name})
    SET a.nodeType = 'Attribute',
        a.value = $value,
        a.unit = $unit,
        a.valueType = $valueType,
        a.possibleValues = $possibleValues,
        a.description = $description
    RETURN a
    """
    
    result = tx.run(query,
           name=attribute_data.get("name", ""),
           value=attribute_data.get("value", ""),
           unit=attribute_data.get("unit", ""),
           valueType=attribute_data.get("valueType", ""),
           possibleValues=attribute_data.get("possibleValues", []),
           description=attribute_data.get("description", ""))
    
    summary = result.consume()
    return summary.counters.nodes_created > 0 or summary.counters.properties_set > 0

def add_proposition_to_neo4j(tx, proposition_data):
    """Add a proposition node to Neo4j"""
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
    
    summary = result.consume()
    return summary.counters.nodes_created > 0 or summary.counters.properties_set > 0

def add_emotion_to_neo4j(tx, emotion_data):
    """Add an emotion node to Neo4j"""
    query = """
    MERGE (e:Emotion {name: $name})
    SET e.nodeType = 'Emotion',
        e.intensity = $intensity,
        e.valence = $valence,
        e.category = $category,
        e.subcategory = $subcategory,
        e.description = $description
    RETURN e
    """
    
    result = tx.run(query,
           name=emotion_data.get("name", ""),
           intensity=emotion_data.get("intensity", 0.0),
           valence=emotion_data.get("valence", 0.0),
           category=emotion_data.get("category", ""),
           subcategory=emotion_data.get("subcategory", ""),
           description=emotion_data.get("description", ""))
    
    summary = result.consume()
    return summary.counters.nodes_created > 0 or summary.counters.properties_set > 0

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
    
    summary = result.consume()
    return summary.counters.nodes_created > 0 or summary.counters.properties_set > 0

def add_scientific_insight_to_neo4j(tx, insight_data):
    """Add a scientific insight node to Neo4j"""
    query = """
    MERGE (s:ScientificInsight {name: $name})
    SET s.nodeType = 'ScientificInsight',
        s.hypothesis = $hypothesis,
        s.evidence = $evidence,
        s.methodology = $methodology,
        s.confidence = $confidence,
        s.field = $field,
        s.publications = $publications,
        s.emotionalValence = $emotionalValence,
        s.emotionalArousal = $emotionalArousal,
        s.evidenceStrength = $evidenceStrength,
        s.scientificCounterarguments = $scientificCounterarguments,
        s.applicationDomains = $applicationDomains,
        s.replicationStatus = $replicationStatus,
        s.surpriseValue = $surpriseValue
    RETURN s
    """
    
    result = tx.run(query,
           name=insight_data.get("name", ""),
           hypothesis=insight_data.get("hypothesis", ""),
           evidence=insight_data.get("evidence", []),
           methodology=insight_data.get("methodology", ""),
           confidence=insight_data.get("confidence", 0.0),
           field=insight_data.get("field", ""),
           publications=insight_data.get("publications", []),
           emotionalValence=insight_data.get("emotionalValence", 0.0),
           emotionalArousal=insight_data.get("emotionalArousal", 0.0),
           evidenceStrength=insight_data.get("evidenceStrength", 0.0),
           scientificCounterarguments=insight_data.get("scientificCounterarguments", []),
           applicationDomains=insight_data.get("applicationDomains", []),
           replicationStatus=insight_data.get("replicationStatus", ""),
           surpriseValue=insight_data.get("surpriseValue", 0.0))
    
    summary = result.consume()
    return summary.counters.nodes_created > 0 or summary.counters.properties_set > 0

def add_law_to_neo4j(tx, law_data):
    """Add a law node to Neo4j"""
    query = """
    MERGE (l:Law {name: $name})
    SET l.nodeType = 'Law',
        l.statement = $statement,
        l.conditions = $conditions,
        l.exceptions = $exceptions,
        l.domain = $domain,
        l.proofs = $proofs,
        l.emotionalValence = $emotionalValence,
        l.emotionalArousal = $emotionalArousal,
        l.domainConstraints = $domainConstraints,
        l.historicalPrecedents = $historicalPrecedents,
        l.counterexamples = $counterexamples,
        l.formalRepresentation = $formalRepresentation
    RETURN l
    """
    
    result = tx.run(query,
           name=law_data.get("name", ""),
           statement=law_data.get("statement", ""),
           conditions=law_data.get("conditions", []),
           exceptions=law_data.get("exceptions", []),
           domain=law_data.get("domain", ""),
           proofs=law_data.get("proofs", []),
           emotionalValence=law_data.get("emotionalValence", 0.0),
           emotionalArousal=law_data.get("emotionalArousal", 0.0),
           domainConstraints=law_data.get("domainConstraints", []),
           historicalPrecedents=law_data.get("historicalPrecedents", []),
           counterexamples=law_data.get("counterexamples", []),
           formalRepresentation=law_data.get("formalRepresentation", ""))
    
    summary = result.consume()
    return summary.counters.nodes_created > 0 or summary.counters.properties_set > 0

def add_reasoning_chain_to_neo4j(tx, chain_data):
    """Add a reasoning chain node to Neo4j"""
    query = """
    MERGE (r:ReasoningChain {name: $name})
    SET r.nodeType = 'ReasoningChain',
        r.description = $description,
        r.conclusion = $conclusion,
        r.confidenceScore = $confidenceScore,
        r.creator = $creator,
        r.methodology = $methodology,
        r.domain = $domain,
        r.tags = $tags,
        r.sourceThought = $sourceThought,
        r.numberOfSteps = $numberOfSteps,
        r.alternativeConclusionsConsidered = $alternativeConclusionsConsidered,
        r.relatedPropositions = $relatedPropositions
    RETURN r
    """
    
    result = tx.run(query,
           name=chain_data.get("name", ""),
           description=chain_data.get("description", ""),
           conclusion=chain_data.get("conclusion", ""),
           confidenceScore=chain_data.get("confidenceScore", 0.0),
           creator=chain_data.get("creator", ""),
           methodology=chain_data.get("methodology", ""),
           domain=chain_data.get("domain", ""),
           tags=chain_data.get("tags", []),
           sourceThought=chain_data.get("sourceThought", ""),
           numberOfSteps=chain_data.get("numberOfSteps", 0),
           alternativeConclusionsConsidered=chain_data.get("alternativeConclusionsConsidered", []),
           relatedPropositions=chain_data.get("relatedPropositions", []))
    
    summary = result.consume()
    return summary.counters.nodes_created > 0 or summary.counters.properties_set > 0

def add_reasoning_step_to_neo4j(tx, step_data):
    """Add a reasoning step node to Neo4j"""
    query = """
    MERGE (s:ReasoningStep {name: $name})
    SET s.nodeType = 'ReasoningStep',
        s.content = $content,
        s.stepType = $stepType,
        s.evidenceType = $evidenceType,
        s.supportingReferences = $supportingReferences,
        s.confidence = $confidence,
        s.alternatives = $alternatives,
        s.counterarguments = $counterarguments,
        s.assumptions = $assumptions,
        s.formalNotation = $formalNotation,
        s.propositions = $propositions
    RETURN s
    """
    
    result = tx.run(query,
           name=step_data.get("name", ""),
           content=step_data.get("content", ""),
           stepType=step_data.get("stepType", ""),
           evidenceType=step_data.get("evidenceType", ""),
           supportingReferences=step_data.get("supportingReferences", []),
           confidence=step_data.get("confidence", 0.0),
           alternatives=step_data.get("alternatives", []),
           counterarguments=step_data.get("counterarguments", []),
           assumptions=step_data.get("assumptions", []),
           formalNotation=step_data.get("formalNotation", ""),
           propositions=step_data.get("propositions", []))
    
    summary = result.consume()
    return summary.counters.nodes_created > 0 or summary.counters.properties_set > 0

def add_relationship_to_neo4j(tx, relationship_data):
    """Add a structured relationship to Neo4j following best practices"""
    # Skip if relationship data is incomplete
    if not isinstance(relationship_data, dict) or 'needsProcessing' in relationship_data:
        logging.warning("Skipping relationship that needs processing")
        return False
    
    # Extract source, target, and relationship type
    source_data = relationship_data.get('source', {})
    target_data = relationship_data.get('target', {})
    rel_type = relationship_data.get('type', 'RELATED_TO')
    
    # Skip if missing critical data
    if not source_data or not target_data:
        logging.warning(f"Incomplete relationship data: {relationship_data}")
        return False
    
    source_name = source_data.get('name', '')
    source_type = source_data.get('type', 'Entity')
    target_name = target_data.get('name', '')
    target_type = target_data.get('type', 'Entity')
    
    # Skip if missing names
    if not source_name or not target_name:
        logging.warning(f"Missing source or target name in relationship: {relationship_data}")
        return False
    
    # Validate relationship type against schema
    if rel_type not in RELATIONSHIP_TYPES:
        logging.warning(f"Unknown relationship type: {rel_type}, defaulting to RELATED_TO")
        rel_type = "RELATED_TO"
    
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
    elif rel_type in ["HAS_PART", "PART_OF"]:
        rel_category = "compositional"
    elif rel_type in ["CAUSES", "CAUSED_BY", "INFLUENCES", "INFLUENCED_BY"]:
        rel_category = "causal"
    elif rel_type in ["HAS_PROPERTY", "PROPERTY_OF"]:
        rel_category = "attributive"
    else:
        rel_category = "lateral"
    
    properties['relationshipCategory'] = rel_category
    
    # Create source and target nodes if they don't exist
    create_source_query = f"""
    MERGE (s:{source_type} {{name: $source_name}})
    """
    
    create_target_query = f"""
    MERGE (t:{target_type} {{name: $target_name}})
    """
    
    tx.run(create_source_query, source_name=source_name)
    tx.run(create_target_query, target_name=target_name)
    
    # Build property string for relationship
    property_clauses = []
    for key, value in properties.items():
        property_clauses.append(f"r.{key} = ${key}")
    
    property_string = ", ".join(property_clauses) if property_clauses else "r.created = timestamp()"
    
    # Create relationship with properties
    relationship_query = f"""
    MATCH (s:{source_type} {{name: $source_name}})
    MATCH (t:{target_type} {{name: $target_name}})
    MERGE (s)-[r:{rel_type}]->(t)
    SET {property_string}
    RETURN r
    """
    
    # Add source and target to properties for query
    params = properties.copy()
    params['source_name'] = source_name
    params['target_name'] = target_name
    
    # Execute query
    result = tx.run(relationship_query, **params)
    summary = result.consume()
    
    return summary.counters.relationships_created > 0 or summary.counters.properties_set > 0

def process_relationships(session, relationships):
    """Process a list of relationships and add them to Neo4j"""
    success_count = 0
    
    for relationship in relationships:
        try:
            with session.begin_transaction() as tx:
                if add_relationship_to_neo4j(tx, relationship):
                    success_count += 1
        except Exception as e:
            logging.error(f"Error adding relationship to Neo4j: {str(e)}")
    
    logging.info(f"Added {success_count} relationships to Neo4j")
    return success_count

# Update the existing add_relationship_to_neo4j function to use the new one
def add_relationship_to_neo4j_legacy(tx, subject, predicate, object_, props=None):
    """Legacy function for backward compatibility"""
    props = props or {}
    
    # Convert to new format
    relationship_data = {
        'source': {'name': subject, 'type': 'Entity'},
        'target': {'name': object_, 'type': 'Entity'},
        'type': predicate,
        'properties': props
    }
    
    return add_relationship_to_neo4j(tx, relationship_data) 