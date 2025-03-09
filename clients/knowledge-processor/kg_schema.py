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
You are a knowledge extraction system.

Extract and organize information from the given text into these categories, using structured JSON format where specified:

ENTITIES: Extract important named entities
- Each on a new line
- Include type/category in parentheses: Winston Churchill (Person)
- Include key descriptors: Winston Churchill (Person) - Prime Minister of UK during WWII
- Do NOT create separate entries for observations or attributes
- Do NOT start entries with "Observations:" or "KeyContributions:"
- Include all descriptive information after the hyphen

PERSON DETAILS: For important persons, extract comprehensive psychological profiles
- Format as JSON using this template:
```json
{{
  "name": "Person Name",
  "biography": "Brief biographical summary",
  "aliases": ["alternative name", "nickname"],
  "personalityTraits": [
    {{"trait": "Analytical", "evidence": ["evidence1", "evidence2"], "confidence": 0.9}},
    {{"trait": "Compassionate", "evidence": ["evidence3"], "confidence": 0.8}}
  ],
  "cognitiveStyle": {{
    "decisionMaking": "Data-driven",
    "problemSolving": "Systematic",
    "worldview": "Scientific realism",
    "biases": ["confirmation bias", "recency bias"]
  }},
  "emotionalProfile": {{
    "emotionalDisposition": "Reserved",
    "emotionalTriggers": [
      {{"trigger": "Personal criticism", "reaction": "Withdrawal", "evidence": ["example situation"]}}
    ]
  }},
  "relationalDynamics": {{
    "interpersonalStyle": "Collaborative",
    "powerDynamics": {{
      "authorityResponse": "Respectful but questioning",
      "subordinateManagement": "Mentoring approach",
      "negotiationTactics": ["Data-backed argumentation", "Compromise-oriented"]
    }},
    "loyalties": [
      {{"target": "Scientific integrity", "strength": 0.9, "evidence": ["refused to falsify data"]}}
    ]
  }},
  "valueSystem": {{
    "coreValues": [
      {{"value": "Truth", "importance": 0.9, "consistency": 0.8}}
    ],
    "ethicalFramework": "Utilitarian with deontological constraints"
  }},
  "psychologicalDevelopment": [
    {{"period": "Early career", "changes": "Shifted from theoretical to applied focus", "catalysts": ["event1", "event2"]}}
  ],
  "metaAttributes": {{
    "authorBias": 0.1,
    "portrayalConsistency": 0.8,
    "controversialAspects": ["disputed claim"]
  }},
  "modelConfidence": 0.85,
  "evidenceStrength": 0.75
}}
```
- Fill in as many sections as possible based on available information
- Leave sections empty or with null values if no information is available
- For each person you extract, create a complete section labeled "Person Details for [Name]:"

EVENTS: Extract significant events as structured JSON
- Format as:
```json
{{
  "name": "Event Name",
  "nodeType": "Event",
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD", 
  "status": "Ongoing/Concluded/Planned",
  "timestamp": "ISO datetime if specific point",
  "duration": "length of event",
  "location": "Where it occurred",
  "participants": ["Person1", "Organization1"],
  "outcome": "Result of the event",
  "significance": "Why this matters",
  "causalPredecessors": ["Event that led to this"],
  "causalSuccessors": ["Event caused by this"],
  "subType": "Action/StateChange/Observation/Conversation"
}}
```

CONCEPTS: Extract important abstract concepts, theories, or ideas
- Format as:
```json
{{
  "name": "Concept Name",
  "nodeType": "Concept",
  "definition": "Concise definition (1-2 sentences)",
  "description": "Expanded explanation",
  "examples": ["Example1", "Example2"],
  "relatedConcepts": ["Related concept1", "Related concept2"],
  "domain": "Field this belongs to",
  "significance": "Importance or impact"
}}
```

RELATIONSHIPS: Extract relationships between entities, concepts, and events
- Each on a new line
- Use ONE of these formats (pick whichever is clearer for each relationship):
  1. [SOURCE_ENTITY] --RELATIONSHIP_TYPE--> [TARGET_ENTITY] (Context: contextual information)
  2. SOURCE_ENTITY(TYPE) -> [RELATIONSHIP_TYPE] TARGET_ENTITY(TYPE) {{property1: value1, property2: value2}}
- For the second format, ensure you don't include the second arrow (just one ->)
- Use relationship types from this list where possible: IS_A, INSTANCE_OF, PART_OF, HAS_PART, LOCATED_IN, BEFORE, AFTER, 
  DURING, CAUSES, CAUSED_BY, INFLUENCES, RELATED_TO, ASSOCIATED_WITH, BELIEVES, SUPPORTS, CONTRADICTS
- Add confidence scores where possible: {{confidenceScore: 0.9}}

ATTRIBUTES: Extract qualities or properties of entities
- Format as:
```json
{{
  "name": "Attribute Name",
  "nodeType": "Attribute",
  "value": "attribute value",
  "valueType": "numeric/categorical/boolean/text",
  "unit": "unit of measurement if applicable",
  "possibleValues": ["value1", "value2"] 
}}
```

PROPOSITIONS: Extract objectively verifiable assertions
- Format as:
```json
{{
  "name": "Short Label",
  "nodeType": "Proposition",
  "statement": "The objectively verifiable assertion",
  "status": "fact/hypothesis/law/rule/claim",
  "confidence": 0.8,
  "truthValue": true,
  "sources": ["Source1", "Source2"],
  "domain": "Knowledge domain"
}}
```

EMOTIONS: Extract emotional states
- Format as:
```json
{{
  "name": "Emotion Name",
  "nodeType": "Emotion",
  "intensity": 0.7,
  "valence": 0.5,
  "category": "Joy/Sadness/Anger/etc.",
  "subcategory": "More specific emotion category"
}}
```

AGENTS: Extract cognitive entities capable of action or belief
- Format as:
```json
{{
  "name": "Agent Name",
  "nodeType": "Agent",
  "agentType": "human/ai/organization/other",
  "capabilities": ["capability1", "capability2"],
  "beliefs": ["belief1", "belief2"],
  "knowledge": ["knowledge1", "knowledge2"],
  "preferences": ["preference1", "preference2"]
}}
```

THOUGHTS: Extract subjective analyses or interpretations
- Format as:
```json
{{
  "name": "Thought Label",
  "nodeType": "Thought",
  "thoughtContent": "The subjective analysis or interpretation",
  "references": ["Entity1", "Concept1"],
  "confidence": 0.7,
  "source": "Who originated this thought",
  "createdBy": "Author of the thought"
}}
```

SCIENTIFIC INSIGHTS: Extract research findings or experimental results
- Format as:
```json
{{
  "name": "Insight Name",
  "nodeType": "ScientificInsight",
  "hypothesis": "The scientific hypothesis",
  "evidence": ["Evidence1", "Evidence2"],
  "methodology": "Research approach",
  "confidence": 0.85,
  "field": "Scientific discipline"
}}
```

LAWS: Extract established principles or rules
- Format as:
```json
{{
  "name": "Law Name",
  "nodeType": "Law",
  "statement": "The law's statement",
  "conditions": ["condition1", "condition2"],
  "exceptions": ["exception1", "exception2"],
  "domain": "Field where law applies"
}}
```

LOCATIONS: Extract physical or virtual places
- Format as:
```json
{{
  "name": "Location Name",
  "nodeType": "Location",
  "locationType": "City/Country/Building/Virtual/etc.",
  "coordinates": {{"latitude": 0.0, "longitude": 0.0}},
  "description": "Description of location",
  "significance": "Historical or cultural importance"
}}
```

REASONING CHAINS: Extract structured logical reasoning
- Format as:
```json
{{
  "name": "Reasoning Chain Name",
  "nodeType": "ReasoningChain",
  "description": "What this reasoning accomplishes",
  "conclusion": "Final conclusion reached",
  "confidenceScore": 0.8,
  "creator": "Who created this reasoning",
  "methodology": "deductive/inductive/abductive/analogical/mixed",
  "steps": ["step1", "step2", "step3"]
}}
```

REASONING STEPS: Extract individual steps within reasoning chains
- Format as:
```json
{{
  "name": "Step Name",
  "nodeType": "ReasoningStep",
  "content": "The actual reasoning content",
  "stepType": "premise/inference/evidence/counterargument/rebuttal/conclusion",
  "confidence": 0.8,
  "chainName": "Parent reasoning chain name",
  "order": 1
}}
```

Note for AI-specific Agent attributes:
When extracting AI agents, include these specialized attributes when available:
modelName, provider, apiEndpoint, trainingData, operationalConstraints, performanceMetrics, version, operationalStatus, ownership

IMPORTANT: JSON format must be strictly valid. All string values must be properly quoted, all arrays and objects properly structured.
""" 