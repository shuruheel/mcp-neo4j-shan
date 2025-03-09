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
            "observations": [],
            "subType": "",  # Person, Organization, Location, Artifact, Animal, Concept
            "confidence": 0.0,
            "source": "",
            "description": "",
            "biography": "",
            "keyContributions": [],
            "emotionalValence": 0.0,
            "emotionalArousal": 0.0,
            "personDetails": {}  # Will contain Person object when subType="Person"
        },
        {
            "nodeType": "Event",
            "name": "",
            "startDate": "",
            "endDate": "",
            "status": "",  # Ongoing, Concluded, Planned
            "timestamp": "",
            "duration": "",
            "location": "",
            "participants": [],
            "outcome": "",
            "significance": "",
            "emotionalValence": 0.0,
            "emotionalArousal": 0.0,
            "causalPredecessors": [],
            "causalSuccessors": [],
            "subType": ""  # Action, StateChange, Observation, Conversation
        },
        {
            "nodeType": "Concept",
            "name": "",
            "definition": "",
            "description": "",
            "examples": [],
            "relatedConcepts": [],
            "domain": "",
            "significance": "",
            "perspectives": [],
            "historicalDevelopment": [],
            "emotionalValence": 0.0,
            "emotionalArousal": 0.0,
            "abstractionLevel": 0.0,
            "metaphoricalMappings": []
        },
        {
            "nodeType": "Attribute",
            "name": "",
            "value": "",
            "unit": "",
            "valueType": "",  # numeric, categorical, boolean, text
            "possibleValues": [],
            "description": ""
        },
        {
            "nodeType": "Proposition",
            "name": "",
            "statement": "",
            "status": "",  # fact, hypothesis, law, rule, claim
            "confidence": 0.0,
            "truthValue": None,
            "sources": [],
            "domain": "",
            "emotionalValence": 0.0,
            "emotionalArousal": 0.0,
            "evidenceStrength": 0.0,
            "counterEvidence": []
        },
        {
            "nodeType": "Emotion",
            "name": "",
            "intensity": 0.0,
            "valence": 0.0,
            "category": "",
            "subcategory": "",
            "description": ""
        },
        {
            "nodeType": "Agent",
            "name": "",
            "agentType": "",  # human, ai, organization, other
            "description": "",
            "capabilities": [],
            "beliefs": [],
            "knowledge": [],
            "preferences": [],
            "emotionalState": "",
            "modelName": "",
            "provider": "",
            "apiEndpoint": "",
            "trainingData": [],
            "operationalConstraints": [],
            "performanceMetrics": {},
            "version": "",
            "operationalStatus": "",
            "ownership": "",
            "interactionHistory": []
        },
        {
            "nodeType": "Thought",
            "name": "",
            "thoughtContent": "",
            "references": [],
            "confidence": 0.0,
            "source": "",
            "createdBy": "",
            "tags": [],
            "impact": "",
            "emotionalValence": 0.0,
            "emotionalArousal": 0.0,
            "evidentialBasis": [],
            "thoughtCounterarguments": [],
            "implications": [],
            "thoughtConfidenceScore": 0.0,
            "reasoningChains": []
        },
        {
            "nodeType": "ScientificInsight",
            "name": "",
            "hypothesis": "",
            "evidence": [],
            "methodology": "",
            "confidence": 0.0,
            "field": "",
            "publications": [],
            "emotionalValence": 0.0,
            "emotionalArousal": 0.0,
            "evidenceStrength": 0.0,
            "scientificCounterarguments": [],
            "applicationDomains": [],
            "replicationStatus": "",
            "surpriseValue": 0.0
        },
        {
            "nodeType": "Law",
            "name": "",
            "statement": "",
            "conditions": [],
            "exceptions": [],
            "domain": "",
            "proofs": [],
            "emotionalValence": 0.0,
            "emotionalArousal": 0.0,
            "domainConstraints": [],
            "historicalPrecedents": [],
            "counterexamples": [],
            "formalRepresentation": ""
        },
        {
            "nodeType": "Location",
            "name": "",
            "locationType": "",  # City, Country, Region, Building, Virtual, etc.
            "coordinates": {"latitude": 0.0, "longitude": 0.0},
            "description": "",
            "locationSignificance": ""
        },
        {
            "nodeType": "ReasoningChain",
            "name": "",
            "description": "",
            "conclusion": "",
            "confidenceScore": 0.0,
            "creator": "",
            "methodology": "",  # deductive, inductive, abductive, analogical, mixed
            "domain": "",
            "tags": [],
            "sourceThought": "",
            "numberOfSteps": 0,
            "alternativeConclusionsConsidered": [],
            "relatedPropositions": []
        },
        {
            "nodeType": "ReasoningStep",
            "name": "",
            "content": "",
            "stepType": "",  # premise, inference, evidence, counterargument, rebuttal, conclusion
            "evidenceType": "",
            "supportingReferences": [],
            "confidence": 0.0,
            "alternatives": [],
            "counterarguments": [],
            "assumptions": [],
            "formalNotation": "",
            "propositions": [],
            "chainName": "",
            "order": 0
        }
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
You are a knowledge extraction system. DO NOT introduce yourself or add any explanatory text.
IMPORTANT: Skip any greetings, explanations, or meta-commentary. Return ONLY the structured extraction results.

REQUIRED OUTPUT FORMAT: Return your ENTIRE response as a SINGLE valid JSON object containing ALL extracted information with this structure:
{
  "entities": [ {entity1}, {entity2}, ... ],
  "events": [ {event1}, {event2}, ... ],
  "concepts": [ {concept1}, {concept2}, ... ],
  "propositions": [ {proposition1}, {proposition2}, ... ],
  "attributes": [ {attribute1}, {attribute2}, ... ],
  "emotions": [ {emotion1}, {emotion2}, ... ],
  "agents": [ {agent1}, {agent2}, ... ],
  "thoughts": [ {thought1}, {thought2}, ... ],
  "scientificInsights": [ {insight1}, {insight2}, ... ],
  "laws": [ {law1}, {law2}, ... ],
  "reasoningChains": [ {chain1}, {chain2}, ... ],
  "reasoningSteps": [ {step1}, {step2}, ... ],
  "relationships": [ {relationship1}, {relationship2}, ... ],
  "personDetails": { "person1": {details1}, "person2": {details2}, ... },
  "locationDetails": { "location1": {details1}, "location2": {details2}, ... }
}

DO NOT include section headers, explanatory text, or any content outside this JSON object.
Include ONLY fields that have meaningful content - do not include blank fields or empty arrays.
Use null instead of empty arrays/objects for missing data.

Extract and organize information from the given text into these categories, using the following JSON templates for each node type:

ENTITIES: Extract important named entities
- Format as:
```json
{
  "name": "Entity Name",
  "nodeType": "Entity",
  "observations": ["Factual observation 1", "Factual observation 2"],
  "subType": "Person/Organization/Location/Artifact/Animal/Concept",
  "confidence": 0.9,
  "source": "Source of information",
  "description": "General description",
  "biography": "Biographical information",
  "keyContributions": ["Contribution 1", "Contribution 2"],
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0
}
```

PERSON DETAILS: For important persons, extract comprehensive psychological profiles
- Format as:
```json
{
  "name": "Person Name",
  "nodeType": "Entity",
  "subType": "Person",
  "biography": "Brief biographical summary",
  "aliases": ["alternative name", "nickname"],
  "personalityTraits": [
    {"trait": "Analytical", "evidence": ["evidence1", "evidence2"], "confidence": 0.9},
    {"trait": "Compassionate", "evidence": ["evidence3"], "confidence": 0.8}
  ],
  "cognitiveStyle": {
    "decisionMaking": "Data-driven",
    "problemSolving": "Systematic",
    "worldview": "Scientific realism",
    "biases": ["confirmation bias", "recency bias"]
  },
  "emotionalProfile": {
    "emotionalDisposition": "Reserved",
    "emotionalTriggers": [
      {"trigger": "Personal criticism", "reaction": "Withdrawal", "evidence": ["example situation"]}
    ]
  },
  "relationalDynamics": {
    "interpersonalStyle": "Collaborative",
    "powerDynamics": {
      "authorityResponse": "Respectful but questioning",
      "subordinateManagement": "Mentoring approach",
      "negotiationTactics": ["Data-backed argumentation", "Compromise-oriented"]
    },
    "loyalties": [
      {"target": "Scientific integrity", "strength": 0.9, "evidence": ["refused to falsify data"]}
    ]
  },
  "valueSystem": {
    "coreValues": [
      {"value": "Truth", "importance": 0.9, "consistency": 0.8}
    ],
    "ethicalFramework": "Utilitarian with deontological constraints"
  },
  "psychologicalDevelopment": [
    {"period": "Early career", "changes": "Shifted from theoretical to applied focus", "catalysts": ["event1", "event2"]}
  ],
  "metaAttributes": {
    "authorBias": 0.1,
    "portrayalConsistency": 0.8,
    "controversialAspects": ["disputed claim"]
  },
  "modelConfidence": 0.85,
  "evidenceStrength": 0.75
}
```

EVENTS: Extract significant events
- Format as:
```json
{
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
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0,
  "causalPredecessors": ["Event that led to this"],
  "causalSuccessors": ["Event caused by this"],
  "subType": "Action/StateChange/Observation/Conversation"
}
```

CONCEPTS: Extract important abstract concepts, theories, or ideas
- Format as:
```json
{
  "name": "Concept Name",
  "nodeType": "Concept",
  "definition": "Concise definition (1-2 sentences)",
  "description": "Expanded explanation",
  "examples": ["Example1", "Example2"],
  "relatedConcepts": ["Related concept1", "Related concept2"],
  "domain": "Field this belongs to",
  "significance": "Importance or impact",
  "perspectives": ["Perspective 1", "Perspective 2"],
  "historicalDevelopment": [
    {"period": "Time period", "development": "Development during this period"}
  ],
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0,
  "abstractionLevel": 0.7,
  "metaphoricalMappings": ["Metaphor 1", "Metaphor 2"]
}
```

ATTRIBUTES: Extract qualities or properties of entities
- Format as:
```json
{
  "name": "Attribute Name",
  "nodeType": "Attribute",
  "value": "attribute value",
  "unit": "unit of measurement if applicable",
  "valueType": "numeric/categorical/boolean/text",
  "possibleValues": ["value1", "value2"],
  "description": "Description of what this attribute represents"
}
```

PROPOSITIONS: Extract objectively verifiable assertions
- Format as:
```json
{
  "name": "Short Label",
  "nodeType": "Proposition",
  "statement": "The objectively verifiable assertion",
  "status": "fact/hypothesis/law/rule/claim",
  "confidence": 0.8,
  "truthValue": true,
  "sources": ["Source1", "Source2"],
  "domain": "Knowledge domain",
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0,
  "evidenceStrength": 0.8,
  "counterEvidence": ["Counter evidence 1", "Counter evidence 2"]
}
```

EMOTIONS: Extract emotional states
- Format as:
```json
{
  "name": "Emotion Name",
  "nodeType": "Emotion",
  "intensity": 0.7,
  "valence": 0.5,
  "category": "Joy/Sadness/Anger/etc.",
  "subcategory": "More specific emotion category",
  "description": "Description of the emotional experience"
}
```

AGENTS: Extract cognitive entities capable of action or belief
- Format as:
```json
{
  "name": "Agent Name",
  "nodeType": "Agent",
  "agentType": "human/ai/organization/other",
  "description": "Description of the agent",
  "capabilities": ["capability1", "capability2"],
  "beliefs": ["belief1", "belief2"],
  "knowledge": ["knowledge1", "knowledge2"],
  "preferences": ["preference1", "preference2"],
  "emotionalState": "Current emotional state",
  "modelName": "Name/version of AI model",
  "provider": "Organization providing the AI model",
  "apiEndpoint": "Endpoint for interaction",
  "trainingData": ["Data source 1", "Data source 2"],
  "operationalConstraints": ["Constraint 1", "Constraint 2"],
  "performanceMetrics": {
    "accuracy": 0.9,
    "precision": 0.85
  },
  "version": "Version of the AI agent",
  "operationalStatus": "active/deprecated/experimental",
  "ownership": "Responsible entity or individual",
  "interactionHistory": ["Reference 1", "Reference 2"]
}
```

THOUGHTS: Extract subjective analyses or interpretations
- Format as:
```json
{
  "name": "Thought Label",
  "nodeType": "Thought",
  "thoughtContent": "The subjective analysis or interpretation",
  "references": ["Entity1", "Concept1"],
  "confidence": 0.7,
  "source": "Who originated this thought",
  "createdBy": "Author of the thought",
  "tags": ["Tag1", "Tag2"],
  "impact": "Potential impact or importance",
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0,
  "evidentialBasis": ["Evidence 1", "Evidence 2"],
  "thoughtCounterarguments": ["Counterargument 1", "Counterargument 2"],
  "implications": ["Implication 1", "Implication 2"],
  "thoughtConfidenceScore": 0.8,
  "reasoningChains": ["Reasoning chain 1", "Reasoning chain 2"]
}
```

SCIENTIFIC INSIGHTS: Extract research findings or experimental results
- Format as:
```json
{
  "name": "Insight Name",
  "nodeType": "ScientificInsight",
  "hypothesis": "The scientific hypothesis",
  "evidence": ["Evidence1", "Evidence2"],
  "methodology": "Research approach",
  "confidence": 0.85,
  "field": "Scientific discipline",
  "publications": ["Publication 1", "Publication 2"],
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0,
  "evidenceStrength": 0.8,
  "scientificCounterarguments": ["Counterargument 1", "Counterargument 2"],
  "applicationDomains": ["Domain 1", "Domain 2"],
  "replicationStatus": "Current replication consensus",
  "surpriseValue": 0.6
}
```

LAWS: Extract established principles or rules
- Format as:
```json
{
  "name": "Law Name",
  "nodeType": "Law",
  "statement": "The law's statement",
  "conditions": ["condition1", "condition2"],
  "exceptions": ["exception1", "exception2"],
  "domain": "Field where law applies",
  "proofs": ["Proof 1", "Proof 2"],
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0,
  "domainConstraints": ["Constraint 1", "Constraint 2"],
  "historicalPrecedents": ["Precedent 1", "Precedent 2"],
  "counterexamples": ["Counterexample 1", "Counterexample 2"],
  "formalRepresentation": "Mathematical or logical formulation"
}
```

LOCATIONS: Extract physical or virtual places
- Format as:
```json
{
  "name": "Location Name",
  "nodeType": "Location",
  "locationType": "City/Country/Building/Virtual/etc.",
  "coordinates": {"latitude": 0.0, "longitude": 0.0},
  "description": "Description of location",
  "locationSignificance": "Historical, cultural, or personal importance"
}
```

REASONING CHAINS: Extract structured logical reasoning
- Format as:
```json
{
  "name": "Reasoning Chain Name",
  "nodeType": "ReasoningChain",
  "description": "What this reasoning accomplishes",
  "conclusion": "Final conclusion reached",
  "confidenceScore": 0.8,
  "creator": "Who created this reasoning",
  "methodology": "deductive/inductive/abductive/analogical/mixed",
  "domain": "Field or domain of the reasoning",
  "tags": ["Tag1", "Tag2"],
  "sourceThought": "Thought that initiated this reasoning",
  "numberOfSteps": 3,
  "alternativeConclusionsConsidered": ["Alternative 1", "Alternative 2"],
  "relatedPropositions": ["Proposition 1", "Proposition 2"]
}
```

REASONING STEPS: Extract individual steps within reasoning chains
- Format as:
```json
{
  "name": "Step Name",
  "nodeType": "ReasoningStep",
  "content": "The actual reasoning content",
  "stepType": "premise/inference/evidence/counterargument/rebuttal/conclusion",
  "evidenceType": "observation/fact/assumption/inference/expert_opinion/statistical_data",
  "supportingReferences": ["Reference 1", "Reference 2"],
  "confidence": 0.8,
  "alternatives": ["Alternative 1", "Alternative 2"],
  "counterarguments": ["Counterargument 1", "Counterargument 2"],
  "assumptions": ["Assumption 1", "Assumption 2"],
  "formalNotation": "Logical or mathematical notation",
  "propositions": ["Proposition 1", "Proposition 2"],
  "chainName": "Parent reasoning chain name",
  "order": 1
}
```

Note for AI-specific Agent attributes:
When extracting AI agents, include these specialized attributes when available:
modelName, provider, apiEndpoint, trainingData, operationalConstraints, performanceMetrics, version, operationalStatus, ownership

IMPORTANT: JSON format must be strictly valid. All string values must be properly quoted, all arrays and objects properly structured.
"""

# Node Type JSON Templates - Use these for all knowledge extraction
# ALWAYS ensure responses are formatted using these JSON templates, never in plain text

# Entity Node Template
ENTITY_TEMPLATE = """
```json
{
  "name": "Entity Name",
  "nodeType": "Entity",
  "observations": ["Factual observation 1", "Factual observation 2"],
  "subType": "Person/Organization/Location/Artifact/Animal/Concept",
  "confidence": 0.9,
  "source": "Source of information",
  "description": "General description",
  "biography": "Biographical information",
  "keyContributions": ["Contribution 1", "Contribution 2"],
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0,
  "personDetails": {}  # Will contain Person object when subType="Person"
}
```
"""

# Person Detail Template
PERSON_TEMPLATE = """
```json
{
  "name": "Person Name",
  "nodeType": "Entity",
  "subType": "Person",
  "biography": "Brief biographical summary",
  "aliases": ["alternative name", "nickname"],
  "personalityTraits": [
    {"trait": "Analytical", "evidence": ["evidence1", "evidence2"], "confidence": 0.9},
    {"trait": "Compassionate", "evidence": ["evidence3"], "confidence": 0.8}
  ],
  "cognitiveStyle": {
    "decisionMaking": "Data-driven", 
    "problemSolving": "Systematic",
    "worldview": "Scientific realism",
    "biases": ["confirmation bias", "recency bias"]
  },
  "emotionalProfile": {
    "emotionalDisposition": "Reserved",
    "emotionalTriggers": [
      {"trigger": "Personal criticism", "reaction": "Withdrawal", "evidence": ["example situation"]}
    ]
  },
  "relationalDynamics": {
    "interpersonalStyle": "Collaborative",
    "powerDynamics": {
      "authorityResponse": "Respectful but questioning",
      "subordinateManagement": "Mentoring approach",
      "negotiationTactics": ["Data-backed argumentation", "Compromise-oriented"]
    },
    "loyalties": [
      {"target": "Scientific integrity", "strength": 0.9, "evidence": ["refused to falsify data"]}
    ]
  },
  "valueSystem": {
    "coreValues": [
      {"value": "Truth", "importance": 0.9, "consistency": 0.8}
    ],
    "ethicalFramework": "Utilitarian with deontological constraints"
  },
  "psychologicalDevelopment": [
    {"period": "Early career", "changes": "Shifted from theoretical to applied focus", "catalysts": ["event1", "event2"]}
  ],
  "metaAttributes": {
    "authorBias": 0.1,
    "portrayalConsistency": 0.8,
    "controversialAspects": ["disputed claim"]
  },
  "modelConfidence": 0.85,
  "evidenceStrength": 0.75
}
```
"""

# Event Node Template
EVENT_TEMPLATE = """
```json
{
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
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0,
  "causalPredecessors": ["Event that led to this"],
  "causalSuccessors": ["Event caused by this"],
  "subType": "Action/StateChange/Observation/Conversation"
}
```
"""

# Concept Node Template
CONCEPT_TEMPLATE = """
```json
{
  "name": "Concept Name",
  "nodeType": "Concept",
  "definition": "Concise definition (1-2 sentences)",
  "description": "Expanded explanation",
  "examples": ["Example1", "Example2"],
  "relatedConcepts": ["Related concept1", "Related concept2"],
  "domain": "Field this belongs to",
  "significance": "Importance or impact",
  "perspectives": ["Perspective 1", "Perspective 2"],
  "historicalDevelopment": [
    {"period": "Time period", "development": "Development during this period"}
  ],
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0,
  "abstractionLevel": 0.7,
  "metaphoricalMappings": ["Metaphor 1", "Metaphor 2"]
}
```
"""

# Attribute Node Template
ATTRIBUTE_TEMPLATE = """
```json
{
  "name": "Attribute Name",
  "nodeType": "Attribute",
  "value": "attribute value",
  "unit": "unit of measurement if applicable",
  "valueType": "numeric/categorical/boolean/text",
  "possibleValues": ["value1", "value2"],
  "description": "Description of what this attribute represents"
}
```
"""

# Proposition Node Template
PROPOSITION_TEMPLATE = """
```json
{
  "name": "Short Label",
  "nodeType": "Proposition",
  "statement": "The objectively verifiable assertion",
  "status": "fact/hypothesis/law/rule/claim",
  "confidence": 0.8,
  "truthValue": true,
  "sources": ["Source1", "Source2"],
  "domain": "Knowledge domain",
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0,
  "evidenceStrength": 0.8,
  "counterEvidence": ["Counter evidence 1", "Counter evidence 2"]
}
```
"""

# Emotion Node Template
EMOTION_TEMPLATE = """
```json
{
  "name": "Emotion Name",
  "nodeType": "Emotion",
  "intensity": 0.7,
  "valence": 0.5,
  "category": "Joy/Sadness/Anger/etc.",
  "subcategory": "More specific emotion category",
  "description": "Description of the emotional experience"
}
```
"""

# Agent Node Template
AGENT_TEMPLATE = """
```json
{
  "name": "Agent Name",
  "nodeType": "Agent",
  "agentType": "human/ai/organization/other",
  "description": "Description of the agent",
  "capabilities": ["capability1", "capability2"],
  "beliefs": ["belief1", "belief2"],
  "knowledge": ["knowledge1", "knowledge2"],
  "preferences": ["preference1", "preference2"],
  "emotionalState": "Current emotional state",
  "modelName": "Name/version of AI model",
  "provider": "Organization providing the AI model",
  "apiEndpoint": "Endpoint for interaction",
  "trainingData": ["Data source 1", "Data source 2"],
  "operationalConstraints": ["Constraint 1", "Constraint 2"],
  "performanceMetrics": {
    "accuracy": 0.9,
    "precision": 0.85
  },
  "version": "Version of the AI agent",
  "operationalStatus": "active/deprecated/experimental",
  "ownership": "Responsible entity or individual",
  "interactionHistory": ["Reference 1", "Reference 2"]
}
```
"""

# Thought Node Template
THOUGHT_TEMPLATE = """
```json
{
  "name": "Thought Label",
  "nodeType": "Thought",
  "thoughtContent": "The subjective analysis or interpretation",
  "references": ["Entity1", "Concept1"],
  "confidence": 0.7,
  "source": "Who originated this thought",
  "createdBy": "Author of the thought",
  "tags": ["Tag1", "Tag2"],
  "impact": "Potential impact or importance",
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0,
  "evidentialBasis": ["Evidence 1", "Evidence 2"],
  "thoughtCounterarguments": ["Counterargument 1", "Counterargument 2"],
  "implications": ["Implication 1", "Implication 2"],
  "thoughtConfidenceScore": 0.8,
  "reasoningChains": ["Reasoning chain 1", "Reasoning chain 2"]
}
```
"""

# Scientific Insight Node Template
SCIENTIFIC_INSIGHT_TEMPLATE = """
```json
{
  "name": "Insight Name",
  "nodeType": "ScientificInsight",
  "hypothesis": "The scientific hypothesis",
  "evidence": ["Evidence1", "Evidence2"],
  "methodology": "Research approach",
  "confidence": 0.85,
  "field": "Scientific discipline",
  "publications": ["Publication 1", "Publication 2"],
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0,
  "evidenceStrength": 0.8,
  "scientificCounterarguments": ["Counterargument 1", "Counterargument 2"],
  "applicationDomains": ["Domain 1", "Domain 2"],
  "replicationStatus": "Current replication consensus",
  "surpriseValue": 0.6
}
```
"""

# Law Node Template
LAW_TEMPLATE = """
```json
{
  "name": "Law Name",
  "nodeType": "Law",
  "statement": "The law's statement",
  "conditions": ["condition1", "condition2"],
  "exceptions": ["exception1", "exception2"],
  "domain": "Field where law applies",
  "proofs": ["Proof 1", "Proof 2"],
  "emotionalValence": 0.5,
  "emotionalArousal": 1.0,
  "domainConstraints": ["Constraint 1", "Constraint 2"],
  "historicalPrecedents": ["Precedent 1", "Precedent 2"],
  "counterexamples": ["Counterexample 1", "Counterexample 2"],
  "formalRepresentation": "Mathematical or logical formulation"
}
```
"""

# Location Node Template
LOCATION_TEMPLATE = """
```json
{
  "name": "Location Name",
  "nodeType": "Location",
  "locationType": "City/Country/Building/Virtual/etc.",
  "coordinates": {"latitude": 0.0, "longitude": 0.0},
  "description": "Description of location",
  "locationSignificance": "Historical, cultural, or personal importance"
}
```
"""

# Reasoning Chain Node Template
REASONING_CHAIN_TEMPLATE = """
```json
{
  "name": "Reasoning Chain Name",
  "nodeType": "ReasoningChain",
  "description": "What this reasoning accomplishes",
  "conclusion": "Final conclusion reached",
  "confidenceScore": 0.8,
  "creator": "Who created this reasoning",
  "methodology": "deductive/inductive/abductive/analogical/mixed",
  "domain": "Field or domain of the reasoning",
  "tags": ["Tag1", "Tag2"],
  "sourceThought": "Thought that initiated this reasoning",
  "numberOfSteps": 3,
  "alternativeConclusionsConsidered": ["Alternative 1", "Alternative 2"],
  "relatedPropositions": ["Proposition 1", "Proposition 2"]
}
```
"""

# Reasoning Step Node Template
REASONING_STEP_TEMPLATE = """
```json
{
  "name": "Step Name",
  "nodeType": "ReasoningStep",
  "content": "The actual reasoning content",
  "stepType": "premise/inference/evidence/counterargument/rebuttal/conclusion",
  "evidenceType": "observation/fact/assumption/inference/expert_opinion/statistical_data",
  "supportingReferences": ["Reference 1", "Reference 2"],
  "confidence": 0.8,
  "alternatives": ["Alternative 1", "Alternative 2"],
  "counterarguments": ["Counterargument 1", "Counterargument 2"],
  "assumptions": ["Assumption 1", "Assumption 2"],
  "formalNotation": "Logical or mathematical notation",
  "propositions": ["Proposition 1", "Proposition 2"],
  "chainName": "Parent reasoning chain name",
  "order": 1
}
```
""" 