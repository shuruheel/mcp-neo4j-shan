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

2. EVENTS: Extract important events
   - Include: name, startDate, endDate, participants, location, outcome
   - Format as: Event: [Event Name]
   - Details should include dates, participants, locations, outcomes

3. CONCEPTS: Extract abstract ideas and categories
   - Include: name, definition, domain, examples
   - Format as: Concept: [Concept Name]

4. PROPOSITIONS: Extract objectively verifiable assertions
   - Include: statement, confidence, domain, truthValue
   - Format as: Proposition: [Brief Label] - [Statement text]
   - Rate confidence as High/Medium/Low

5. ATTRIBUTES: Extract qualities or properties of entities
   - Include: name, value, valueType (numeric/categorical/boolean/text)
   - Format as: Attribute: [Name] - Value: [Value], Type: [ValueType]

6. EMOTIONS: Extract emotional states mentioned
   - Include: name, intensity (0-1), valence (-1 to 1), category
   - Format as: Emotion: [Name] - Category: [Category], Intensity: [Level]

7. AGENTS: Extract cognitive entities capable of action or belief
   - Include: name, agentType (human/ai/organization), capabilities
   - Format as: Agent: [Name] - Type: [AgentType]

8. THOUGHTS: Extract subjective analyses or interpretations
   - Include: name, thoughtContent, confidence, source
   - Format as: Thought: [Brief Label] - [Content text]

9. SCIENTIFIC INSIGHTS: Extract research findings or experimental results
   - Include: name, hypothesis, evidence, field
   - Format as: Scientific Insight: [Brief Label] - [Hypothesis]

10. LAWS: Extract established principles or rules
    - Include: name, statement, conditions, exceptions, domain
    - Format as: Law: [Name] - [Statement]

11. REASONING CHAINS: Extract structured logical reasoning
    - Include: name, description, conclusion, methodology
    - Format as: Reasoning Chain: [Name] - [Conclusion]

12. RELATIONSHIPS: Extract relationships between entities
    - Format as: [Entity1] --RELATIONSHIP_TYPE--> [Entity2]
    - Use relationship types from this list only:
      IS_A, INSTANCE_OF, HAS_PART, PART_OF, LOCATED_IN, CONTAINS, OCCURRED_AT,
      BEFORE, AFTER, DURING, CAUSES, INFLUENCES, KNOWS, MEMBER_OF, RELATED_TO

13. PERSON DETAILS: For important people, extract psychological information:
    - Personality traits with evidence
    - Cognitive style and decision-making approach
    - Emotional disposition
    - Interpersonal style and relationships
    - Core values and ethical framework

14. LOCATION DETAILS: For important locations, extract:
    - Type of location
    - Significance
    - Contained within (if applicable)

RESPONSE FORMAT:
Entities:
- Entity1 [Type: Person/Organization/Location/Artifact]
- Entity2 [Type: Person/Organization/Location/Artifact]

Events:
- Event: [Event Name] (Date: YYYY-MM-DD, Location: [Location])
  Participants: [Participant1], [Participant2]
  Outcome: [Brief outcome description]

Concepts:
- Concept: [Concept Name] - [Brief definition]
  Domain: [Domain]
  Examples: [Example1], [Example2]

Propositions:
- Proposition: [Label] - [Statement text] (Confidence: High/Medium/Low, Domain: [Domain])

Attributes:
- Attribute: [Name] - Value: [Value], Type: [ValueType]

Emotions:
- Emotion: [Name] - Category: [Category], Intensity: [Level], Valence: [Value]

Agents:
- Agent: [Name] - Type: [AgentType], Capabilities: [Capability1], [Capability2]

Thoughts:
- Thought: [Label] - [Content] (Source: [Source], Confidence: High/Medium/Low)

Scientific Insights:
- Scientific Insight: [Label] - [Hypothesis] (Field: [Field], Evidence: [Evidence])

Laws:
- Law: [Name] - [Statement] (Domain: [Domain], Conditions: [Condition1], [Condition2])

Reasoning Chains:
- Reasoning Chain: [Name] - [Conclusion] (Methodology: [Methodology])

Relationships:
- [Entity1] --RELATIONSHIP_TYPE--> [Entity2] (Context: brief explanation)

Person Details for [Person Name]:
- Personality: [Key personality traits]
- Cognitive Style: [Thinking and decision-making patterns]
- Values: [Core values and ethical principles]
- Relationships: [Key relationship patterns]

Location Details for [Location Name]:
- Type: [Location type]
- Significance: [Historical or contextual importance]
- Contained in: [Larger location]
""" 