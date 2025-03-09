"""Knowledge graph schema definitions."""

# Define relationship categories
RELATIONSHIP_CATEGORIES = [
    "hierarchical",  # parent-child, category-instance
    "lateral",       # similarity, contrast, analogy
    "temporal",      # before-after, causes-results
    "compositional", # part-whole, component-system
    "causal",        # causes-effect relationships
    "attributive"    # entity-property relationships
]

# Define relationship types
RELATIONSHIP_TYPES = [
    # Hierarchical relationships
    "IS_A", "INSTANCE_OF", "SUB_CLASS_OF", "SUPER_CLASS_OF",
    
    # Compositional relationships
    "HAS_PART", "PART_OF",
    
    # Spatial relationships
    "LOCATED_IN", "HAS_LOCATION", "CONTAINED_IN", "CONTAINS", "OCCURRED_AT",
    
    # Temporal relationships
    "HAS_TIME", "OCCURS_ON", "BEFORE", "AFTER", "DURING",
    
    # Participation relationships
    "PARTICIPANT", "HAS_PARTICIPANT", "AGENT", "HAS_AGENT", "PATIENT", "HAS_PATIENT",
    
    # Causal relationships
    "CAUSES", "CAUSED_BY", "INFLUENCES", "INFLUENCED_BY",
    
    # Sequential relationships
    "NEXT", "PREVIOUS",
    
    # Social relationships
    "KNOWS", "FRIEND_OF", "MEMBER_OF",
    
    # Property relationships
    "HAS_PROPERTY", "PROPERTY_OF",
    
    # General relationships
    "RELATED_TO", "ASSOCIATED_WITH",
    
    # Emotional relationships
    "EXPRESSES_EMOTION", "FEELS", "EVOKES_EMOTION",
    
    # Belief relationships
    "BELIEVES", "SUPPORTS", "CONTRADICTS",
    
    # Source relationships
    "DERIVED_FROM", "CITES", "SOURCE",
    
    # Person-specific relationships
    "MENTORS", "MENTORED_BY", "ADMIRES", "ADMIRED_BY", "OPPOSES", "OPPOSED_BY",
    "SHAPED_BY", "TRANSFORMED", "EXHIBITS_TRAIT", "HAS_PERSONALITY", 
    "HAS_COGNITIVE_STYLE", "STRUGGLES_WITH", "VALUES", "ADHERES_TO", 
    "REJECTS", "HAS_ETHICAL_FRAMEWORK", "LOYAL_TO"
]

# Node type definitions
NODE_TYPES = [
    "Entity", "Event", "Concept", "Attribute", "Proposition", 
    "Emotion", "Agent", "Thought", "ScientificInsight", "Law",
    "ReasoningChain", "ReasoningStep", "Location"
]

# Define the JSON template for the cognitive schema
SCHEMA_TEMPLATE = {
    "nodes": [
        {
            "nodeType": "Entity",
            "name": "",
            "subType": "",  # Person, Organization, Location, Artifact
            "observations": [],
            "confidence": 0.0,
            "source": "",
            "description": "",
            "biography": "",
            "keyContributions": [],
            "emotionalValence": 0.0,
            "emotionalArousal": 0.0
        },
        # ... Include all other node types from the original schema_template
    ],
    "relationships": [
        {
            "fromNode": "",  # name of the source node
            "relationshipType": "",  # one of the RELATIONSHIP_TYPES
            "toNode": "",  # name of the target node
            "context": "",  # explanatory context
            "confidenceScore": 0.0,
            "sources": [],
            "weight": 0.0,  # 0.0-1.0
            "contextType": "",  # "hierarchical", "associative", "causal", "temporal", "analogical", "attributive"
            "contextStrength": 0.0,  # 0.0-1.0
            "memoryAids": [],
            "relationshipCategory": ""  # one of the RELATIONSHIP_CATEGORIES
        }
    ]
}

# Define GPT prompt templates
EXTRACTION_PROMPT_TEMPLATE = """
Analyze the following text and extract structured information according to the knowledge graph schema below:

TEXT:
{text}

EXTRACTION GUIDELINES:

1. ENTITIES: Extract all named entities (people, organizations, locations, artifacts)
   - Format as: Entity Name [Type: Person/Organization/Location/Artifact]
   - Include only significant entities
   - Required attributes: name, nodeType, observations
   - Optional attributes: subType, confidence, source, description, biography, keyContributions

2. EVENTS: Extract important events
   - Required attributes: name, nodeType, participants, outcome
   - Optional attributes: startDate, endDate, status, timestamp, duration, location, significance, causalPredecessors, causalSuccessors, subType
   - Format as: Event: [Event Name]
   - Details should include dates, participants, locations, outcomes

3. CONCEPTS: Extract abstract ideas and categories
   - Required attributes: name, nodeType, definition, examples, relatedConcepts, domain
   - Optional attributes: description, significance, perspectives, historicalDevelopment, abstractionLevel
   - Format as: Concept: [Concept Name]

4. PROPOSITIONS: Extract objectively verifiable assertions
   - Required attributes: name, nodeType, statement, status, confidence
   - Optional attributes: truthValue, sources, domain, evidenceStrength, counterEvidence
   - Format as: Proposition: [Brief Label] - [Statement text]
   - Rate confidence as a numeric value from 0.0-1.0

5. ATTRIBUTES: Extract qualities or properties of entities
   - Required attributes: name, nodeType, value, valueType
   - Optional attributes: unit, possibleValues, description
   - Format as: Attribute: [Name] - Value: [Value], Type: [ValueType]

6. EMOTIONS: Extract emotional states mentioned
   - Required attributes: name, nodeType, intensity, valence, category
   - Optional attributes: subcategory, description
   - Format as: Emotion: [Name] - Category: [Category], Intensity: [Level]

7. AGENTS: Extract cognitive entities capable of action or belief
   - Required attributes: name, nodeType, agentType, capabilities
   - Optional attributes: description, beliefs, knowledge, preferences, emotionalState
   - Format special AI-specific attributes when agentType is "ai"
   - Format as: Agent: [Name] - Type: [AgentType]

8. THOUGHTS: Extract subjective analyses or interpretations
   - Required attributes: name, nodeType, thoughtContent, references
   - Optional attributes: confidence, source, createdBy, tags, impact, evidentialBasis, thoughtCounterarguments, implications
   - Format as: Thought: [Brief Label] - [Content text]

9. SCIENTIFIC INSIGHTS: Extract research findings or experimental results
   - Required attributes: name, nodeType, hypothesis, evidence, confidence, field
   - Optional attributes: methodology, publications, evidenceStrength, scientificCounterarguments, applicationDomains, replicationStatus
   - Format as: Scientific Insight: [Brief Label] - [Hypothesis]

10. LAWS: Extract established principles or rules
   - Required attributes: name, nodeType, statement, conditions, exceptions, domain
   - Optional attributes: proofs, domainConstraints, historicalPrecedents, counterexamples, formalRepresentation
   - Format as: Law: [Brief Label] - [Statement]

11. LOCATION: Extract physical or virtual places
   - Required attributes: name, nodeType
   - Optional attributes: locationType, coordinates, description, locationSignificance
   - Format as: Location: [Name] - Type: [LocationType]

12. REASONING CHAIN: Extract structured logical reasoning
   - Required attributes: name, nodeType, description, conclusion, confidenceScore, creator, methodology
   - Optional attributes: domain, tags, sourceThought, numberOfSteps, alternativeConclusionsConsidered
   - Format as: Reasoning Chain: [Name] - Methodology: [Type], Conclusion: [Summary]

13. REASONING STEP: Extract individual steps within reasoning chains
   - Required attributes: name, nodeType, content, stepType, confidence
   - Optional attributes: evidenceType, supportingReferences, alternatives, counterarguments, assumptions, formalNotation
   - Format as: Reasoning Step: [Name] - Type: [StepType], Chain: [ChainName], Order: [Number]

14. PERSON (SPECIAL ENTITY): Extract detailed person information
   - Include all Entity attributes plus specialized psychological profile information
   - Structure as nested objects for personality traits, cognitive style, emotional profile, etc.
   - Format as detailed in the Person Schema guidelines

15. RELATIONSHIPS: Extract relationships between entities
   - Format as: SourceEntity(EntityType) -> [RELATIONSHIP_TYPE] TargetEntity(EntityType) {property1: value1, property2: value2}
   - Include required relationship properties: context, confidenceScore
   - Optional properties: sources, weight, relationshipCategory, contextType, contextStrength

Note for AI-specific Agent attributes:
When extracting AI agents, include these specialized attributes when available:
modelName, provider, apiEndpoint, trainingData, operationalConstraints, performanceMetrics, version, operationalStatus, ownership
""" 