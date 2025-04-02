Neo4j Graph Database Schema

# Node type definitions
NODE_TYPES = [
    "Entity", "Event", "Concept", "Attribute", "Proposition", 
    "Emotion", "Thought", "ScientificInsight", "Law",
    "ReasoningChain", "ReasoningStep", "Location"
]

# Entity Node Template
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


# Person Node Subtype Template
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


# Event Node Template
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


# Concept Node Template
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


# Attribute Node Template
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


# Proposition Node Template
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


# Emotion Node Template
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


# Thought Node Template
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


# Scientific Insight Node Template
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


# Law Node Template
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


# Location Node Template
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


# Reasoning Chain Node Template
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


# Reasoning Step Node Template
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
    "HAS_PART", "PART_OF", "PART_OF_CHAIN",
    
    # Spatial relationships
    "LOCATED_IN", "HAS_LOCATION", "CONTAINED_IN", "CONTAINS", "OCCURRED_AT", "VISITED", "ATTENDED",
    
    # Temporal relationships
    "HAS_TIME", "OCCURS_ON", "BEFORE", "AFTER", "DURING",
    
    # Participation relationships
    "PARTICIPANT", "HAS_PARTICIPANT", "AGENT", "HAS_AGENT", "PATIENT", "HAS_PATIENT", "INVOLVED_IN", 
    "PARTICIPATED_IN", "JOINS",
    
    # Causal relationships
    "CAUSES", "CAUSED_BY", "INFLUENCES", "INFLUENCED_BY", "CAUSED",
    
    # Sequential relationships
    "NEXT", "PREVIOUS",
    
    # Social relationships
    "KNOWS", "FRIEND_OF", "MEMBER_OF", "APPOINTED", "FOUNDED", "FOUNDER_OF", "CHAIRMAN_OF",
    
    # Property relationships
    "HAS_PROPERTY", "PROPERTY_OF",
    
    # General relationships
    "RELATED_TO", "ASSOCIATED_WITH", "REFERENCES",
    
    # Emotional relationships
    "EXPRESSES_EMOTION", "FEELS", "EVOKES_EMOTION",
    
    # Belief relationships
    "BELIEVES", "SUPPORTS", "CONTRADICTS", "PROPOSED", "ACCEPTS", "SUPPORTED_BY", "ADVOCATED_FOR",
    "OPPOSITION_TO", 
    
    # Competition relationships
    "COMPETES_WITH",
    
    # Source relationships
    "DERIVED_FROM", "CITES", "SOURCE",
    
    # Economic relationships
    "NATIONALIZATION_OF",
    
    # Symbolic relationships
    "ICON_OF",
    
    # Person-specific relationships
    "MENTORS", "MENTORED_BY", "ADMIRES", "ADMIRED_BY", "OPPOSES", "OPPOSED_BY",
    "SHAPED_BY", "TRANSFORMED", "EXHIBITS_TRAIT", "HAS_PERSONALITY", 
    "HAS_COGNITIVE_STYLE", "STRUGGLES_WITH", "VALUES", "ADHERES_TO", 
    "REJECTS", "HAS_ETHICAL_FRAMEWORK", "LOYAL_TO"
]