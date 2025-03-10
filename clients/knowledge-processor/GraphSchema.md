# Neo4j Semantic Graph Schema Documentation

This document provides a comprehensive reference for the Neo4j semantic graph schema, including all node types, their attributes, and relationship types implemented in the semantic memory system.

## Table of Contents

1. [Node Types Overview](#node-types-overview)
2. [Node Type Details](#node-type-details)
   - [Entity](#entity)
   - [Person Schema](#person-schema)
   - [Event](#event)
   - [Concept](#concept)
   - [Attribute](#attribute)
   - [Proposition](#proposition)
   - [Emotion](#emotion)
   - [Agent](#agent)
   - [Thought](#thought)
   - [Scientific Insight](#scientific-insight)
   - [Law](#law)
   - [Location](#location)
   - [Reasoning Chain](#reasoning-chain)
   - [Reasoning Step](#reasoning-step)
3. [Relationship Types](#relationship-types)
   - [Relationship Categories](#relationship-categories)
   - [Core Relationship Types](#core-relationship-types)
   - [Person-Specific Relationship Types](#person-specific-relationship-types)
4. [Relationship Properties](#relationship-properties)
5. [Schema Examples](#schema-examples)

## Node Types Overview

The semantic memory system implements the following primary node types:

| Node Type | Description | Primary Use |
|-----------|-------------|-------------|
| Entity | Concrete objects, people, places | Storing information about real-world objects and agents |
| Event | Time-bound occurrences | Representing actions, happenings, episodic knowledge |
| Concept | Abstract ideas, categories | Organizing taxonomic and conceptual knowledge |
| Attribute | Properties and qualities | Representing characteristics that can be assigned to entities |
| Proposition | Objectively verifiable assertions | Storing facts, hypotheses, and rules with truth values |
| Emotion | Emotional states | Representing affective dimensions of knowledge |
| Agent | Cognitive entities with beliefs | Modeling belief systems and perspectives |
| Thought | Subjective interpretations and reflections | Storing opinions, analyses, and personal perspectives |
| Scientific Insight | Research findings | Representing scientific knowledge with evidence |
| Law | Established principles | Representing regularities and universal statements |
| Location | Physical or virtual places | Representing geographical or spatial information |
| Reasoning Chain | Sequences of logical steps | Modeling complex reasoning processes |
| Reasoning Step | Individual reasoning moves | Representing steps within reasoning processes |

## Node Type Details

### Entity

The most general node type representing concrete items or agents in the world.

**Core Attributes:**
- `name` (string, required): Unique identifier for the entity
- `nodeType` (string, required): Always "Entity"
- `observations` (string[], required): Factual observations about the entity
- `subType` (string, optional): Specific entity type ("Person", "Organization", "Location", "Artifact", "Animal", "Concept")
- `confidence` (number, optional): Confidence in the entity information (0.0-1.0)
- `source` (string, optional): Source of the entity information
- `description` (string, optional): General description of the entity
- `biography` (string, optional): Biographical information (for people, organizations)
- `keyContributions` (string[], optional): Notable contributions or achievements
- `emotionalValence` (number, optional): Emotional tone from -1.0 (negative) to 1.0 (positive)
- `emotionalArousal` (number, optional): Emotional intensity from 0.0-3.0
- `personDetails` (Person object | string, optional): Detailed person information when subType="Person"

### Person Schema

Enhanced schema for Entity nodes with subType="Person".

**Basic Attributes:**
- `name` (string, required): Full name of the person
- `aliases` (string[], optional): Alternative names or nicknames
- `biography` (string, optional): Brief biographical summary

**Psychological Profile:**
- `personalityTraits` (array of objects, optional):
  - `trait` (string): Personality trait name (e.g., "Analytical", "Pragmatic")
  - `evidence` (string[]): Evidence supporting this trait attribution
  - `confidence` (number): Confidence in this trait attribution (0.0-1.0)
- `cognitiveStyle` (object, optional):
  - `decisionMaking` (string): How the person makes decisions (e.g., "Methodical")
  - `problemSolving` (string): Approach to problem-solving
  - `worldview` (string): Person's fundamental perspective
  - `biases` (string[]): Observed cognitive biases

**Emotional Profile:**
- `emotionalDisposition` (string, optional): Overall emotional tendency (e.g., "Reserved")
- `emotionalTriggers` (array of objects, optional):
  - `trigger` (string): Events causing strong emotional responses
  - `reaction` (string): Typical emotional reaction
  - `evidence` (string[]): Evidence supporting this trigger

**Relational Dynamics:**
- `interpersonalStyle` (string, optional): How they interact with others
- `powerDynamics` (object, optional):
  - `authorityResponse` (string): How they respond to authority
  - `subordinateManagement` (string): How they manage subordinates
  - `negotiationTactics` (string[]): Observed negotiation approaches
- `loyalties` (array of objects, optional):
  - `target` (string): Person, institution, or concept
  - `strength` (number): Intensity of loyalty (0.0-1.0)
  - `evidence` (string[]): Evidence supporting this loyalty

**Value System:**
- `coreValues` (array of objects, optional):
  - `value` (string): Value or principle (e.g., "National security")
  - `importance` (number): Relative importance (0.0-1.0)
  - `consistency` (number): How consistently upheld (0.0-1.0)
- `ethicalFramework` (string, optional): Ethical approach (e.g., "Utilitarian")

**Temporal Attributes:**
- `psychologicalDevelopment` (array of objects, optional):
  - `period` (string): Time period
  - `changes` (string): Notable psychological shifts
  - `catalysts` (string[]): Events triggering these changes

**Meta Attributes:**
- `narrativeTreatment` (object, optional):
  - `authorBias` (number): Detected authorial bias (-1.0 to 1.0)
  - `portrayalConsistency` (number): Consistency across sources (0.0-1.0)
  - `controversialAspects` (string[]): Disputed psychological features
- `modelConfidence` (number, optional): Overall confidence in profile (0.0-1.0)
- `personEvidenceStrength` (number, optional): Strength of supporting evidence (0.0-1.0)

### Event

Nodes representing time-bound occurrences.

**Core Attributes:**
- `name` (string, required): Unique identifier for the event
- `nodeType` (string, required): Always "Event"
- `startDate` (string, optional): When the event started
- `endDate` (string, optional): When the event ended
- `status` (string, optional): Event status ("Ongoing", "Concluded", "Planned")
- `timestamp` (string, optional): Point in time when the event occurred
- `duration` (string, optional): How long the event lasted
- `location` (string, optional): Where the event took place
- `participants` (string[], required): Entities involved in the event
- `outcome` (string, required): Result of the event
- `significance` (string, optional): Importance or impact of the event
- `emotionalValence` (number, optional): Emotional tone from -1.0 (negative) to 1.0 (positive)
- `emotionalArousal` (number, optional): Emotional intensity from 0.0-3.0
- `causalPredecessors` (string[], optional): Events that directly led to this event
- `causalSuccessors` (string[], optional): Events directly resulting from this event
- `subType` (string, optional): Specific event type ("Action", "StateChange", "Observation", "Conversation")

### Concept

Nodes representing abstract ideas or categories.

**Core Attributes:**
- `name` (string, required): Unique identifier for the concept
- `nodeType` (string, required): Always "Concept"
- `definition` (string, required): Concise explanation of the concept (1-2 sentences)
- `description` (string, optional): Expanded explanation of the concept
- `examples` (string[], required): Examples illustrating the concept
- `relatedConcepts` (string[], required): Other concepts related to this one
- `domain` (string, required): Field or domain the concept belongs to
- `significance` (string, optional): Importance or impact of the concept
- `perspectives` (string[], optional): Multiple viewpoints on the concept
- `historicalDevelopment` (array of objects, optional): How the concept evolved
  - `period` (string): Time period
  - `development` (string): Development during this period
- `emotionalValence` (number, optional): Emotional tone from -1.0 (negative) to 1.0 (positive)
- `emotionalArousal` (number, optional): Emotional intensity from 0.0-3.0
- `abstractionLevel` (number, optional): Concreteness to abstractness scale (0.0-1.0)
- `metaphoricalMappings` (string[], optional): Conceptual metaphors for this concept

### Attribute

Nodes representing qualities or properties that can be assigned to entities.

**Core Attributes:**
- `name` (string, required): Unique identifier for the attribute
- `nodeType` (string, required): Always "Attribute"
- `value` (string | number, required): The actual attribute value
- `unit` (string, optional): Unit of measurement if applicable
- `valueType` (string, required): Type of the value ("numeric", "categorical", "boolean", "text")
- `possibleValues` (string[], optional): Possible values for categorical attributes
- `description` (string, optional): Description of what this attribute represents

### Proposition

Nodes representing objectively verifiable assertions, statements, or claims that can be evaluated for truth or falsity against evidence.

**Core Attributes:**
- `name` (string, required): Unique identifier for the proposition
- `nodeType` (string, required): Always "Proposition"
- `statement` (string, required): The actual propositional content (an objectively verifiable assertion)
- `status` (string, required): Type of proposition ("fact", "hypothesis", "law", "rule", "claim")
- `confidence` (number, required): Confidence score (0.0-1.0) based on available evidence
- `truthValue` (boolean, optional): True/false if known and verified
- `sources` (string[], optional): Sources supporting this proposition's truth value
- `domain` (string, optional): Knowledge domain this proposition belongs to
- `emotionalValence` (number, optional): Emotional tone from -1.0 (negative) to 1.0 (positive)
- `emotionalArousal` (number, optional): Emotional intensity from 0.0-3.0
- `evidenceStrength` (number, optional): Strength of evidential support (0.0-1.0)
- `counterEvidence` (string[], optional): Evidence against this proposition

**Distinctive Feature:** Propositions represent objective claims about the world that can be verified or falsified through evidence. They focus on objective facts rather than personal interpretations.

### Emotion

Nodes representing emotional states and feelings.

**Core Attributes:**
- `name` (string, required): Unique identifier for the emotion
- `nodeType` (string, required): Always "Emotion"
- `intensity` (number, required): Intensity scale (0.0-1.0)
- `valence` (number, required): From -1.0 (negative) to 1.0 (positive)
- `category` (string, required): Emotion category (e.g., "Joy", "Sadness", "Anger")
- `subcategory` (string, optional): More specific emotion category
- `description` (string, optional): Description of the emotional experience

### Thought

Nodes representing subjective analyses, interpretations, reflections, opinions, or perspectives about other nodes in the graph. Unlike Propositions, Thoughts are inherently subjective and represent a viewpoint or interpretation rather than an objectively verifiable fact.

**Core Attributes:**
- `name` (string, required): Unique identifier for the thought
- `nodeType` (string, required): Always "Thought"
- `thoughtContent` (string, required): The main thought content (a subjective analysis or interpretation)
- `references` (string[], required): Names of entities/concepts/events this thought interprets or analyzes
- `confidence` (number, optional): How confident the thinker is in this thought (0-1)
- `source` (string, optional): The person or document from which this thought originated
- `createdBy` (string, optional): Who created this thought (emphasizing subjective origin)
- `tags` (string[], optional): Classification tags
- `impact` (string, optional): Potential impact or importance
- `emotionalValence` (number, optional): Emotional tone from -1.0 (negative) to 1.0 (positive)
- `emotionalArousal` (number, optional): Emotional intensity from 0.0-3.0
- `evidentialBasis` (string[], optional): Nodes supporting this thought (may include subjective justifications)
- `thoughtCounterarguments` (string[], optional): Potential challenges to the thought
- `implications` (string[], optional): Logical consequences of the thought
- `thoughtConfidenceScore` (number, optional): Scale of certainty (0.0-1.0)
- `reasoningChains` (string[], optional): References to ReasoningChain nodes

**Distinctive Feature:** Thoughts represent subjective interpretations, analyses, and personal perspectives that may vary between individuals. They focus on meaning-making, interpretation, and reflection rather than objective facts.

### Scientific Insight

Nodes representing research findings, experimental results, or scientific claims.

**Core Attributes:**
- `name` (string, required): Unique identifier for the insight
- `nodeType` (string, required): Always "ScientificInsight"
- `hypothesis` (string, required): The scientific hypothesis
- `evidence` (string[], required): Supporting evidence
- `methodology` (string, optional): Research methodology used
- `confidence` (number, required): Confidence in the insight (0.0-1.0)
- `field` (string, required): Scientific field or discipline
- `publications` (string[], optional): Related scientific publications
- `emotionalValence` (number, optional): Emotional tone from -1.0 (negative) to 1.0 (positive)
- `emotionalArousal` (number, optional): Emotional intensity from 0.0-3.0
- `evidenceStrength` (number, optional): Overall strength of evidence (0.0-1.0)
- `scientificCounterarguments` (string[], optional): Known challenges to this insight
- `applicationDomains` (string[], optional): Practical application areas
- `replicationStatus` (string, optional): Current replication consensus
- `surpriseValue` (number, optional): How unexpected this insight is (0.0-1.0)

### Law

Nodes representing established principles, rules, or regularities.

**Core Attributes:**
- `name` (string, required): Unique identifier for the law
- `nodeType` (string, required): Always "Law"
- `statement` (string, required): The law's statement
- `conditions` (string[], required): Conditions under which the law applies
- `exceptions` (string[], required): Exceptions to the law
- `domain` (string, required): Field or domain where the law applies
- `proofs` (string[], optional): Proofs or validations of the law
- `emotionalValence` (number, optional): Emotional tone from -1.0 (negative) to 1.0 (positive)
- `emotionalArousal` (number, optional): Emotional intensity from 0.0-3.0
- `domainConstraints` (string[], optional): Limitations on where law applies
- `historicalPrecedents` (string[], optional): Earlier formulations or precursors
- `counterexamples` (string[], optional): Instances challenging the law
- `formalRepresentation` (string, optional): Mathematical or logical formulation

### Location

Nodes representing physical or virtual places in space.

**Core Attributes:**
- `name` (string, required): Name of the location
- `nodeType` (string, required): Always "Location"
- `locationType` (string, optional): Type of location ("City", "Country", "Region", "Building", "Virtual", etc.)
- `coordinates` (object, optional): Geographical coordinates
  - `latitude` (number): Latitude coordinate
  - `longitude` (number): Longitude coordinate
- `description` (string, optional): Textual description of the location
- `locationSignificance` (string, optional): Historical, cultural, or personal importance of this location

**Location Relationships:**
- `CONTAINED_IN`: Points to another Location that contains this Location (e.g., a city contained in a country)
- `CONTAINS`: Points to Locations contained within this Location
- `OCCURRED_AT`: Events link to Locations with this relationship (e.g., Event -[OCCURRED_AT]-> Location)

**Note:** Location containment hierarchy and associated events are represented through relationships rather than attributes for better querying performance and graph traversal.

### Reasoning Chain

Nodes representing structured logical reasoning with multiple steps.

**Core Attributes:**
- `name` (string, required): Unique identifier for the reasoning chain
- `nodeType` (string, required): Always "ReasoningChain"
- `description` (string, required): Overview of what the reasoning chain accomplishes
- `conclusion` (string, required): Final conclusion reached through reasoning
- `confidenceScore` (number, required): Confidence in the conclusion (0.0-1.0)
- `creator` (string, required): Who created this reasoning chain
- `methodology` (string, required): Reasoning approach ("deductive", "inductive", "abductive", "analogical", "mixed")
- `domain` (string, optional): Field or domain of the reasoning
- `tags` (string[], optional): Classification tags
- `sourceThought` (string, optional): Thought that initiated this reasoning
- `numberOfSteps` (number, optional): Count of steps in the chain
- `alternativeConclusionsConsidered` (string[], optional): Other conclusions considered
- `relatedPropositions` (string[], optional): Propositions this reasoning relates to

### Reasoning Step

Nodes representing individual steps within a reasoning chain.

**Core Attributes:**
- `name` (string, required): Unique identifier for the reasoning step
- `nodeType` (string, required): Always "ReasoningStep"
- `content` (string, required): The actual reasoning content
- `stepType` (string, required): Type of step ("premise", "inference", "evidence", "counterargument", "rebuttal", "conclusion")
- `evidenceType` (string, optional): Type of evidence if applicable ("observation", "fact", "assumption", "inference", "expert_opinion", "statistical_data")
- `supportingReferences` (string[], optional): References supporting this step
- `confidence` (number, required): Confidence in this step (0.0-1.0)
- `alternatives` (string[], optional): Alternative paths at this step
- `counterarguments` (string[], optional): Known challenges to this step
- `assumptions` (string[], optional): Underlying assumptions
- `formalNotation` (string, optional): Logical or mathematical notation
- `propositions` (string[], optional): Propositions used in this step

## Relationship Types

### Relationship Categories

Relationships are categorized into the following types:

| Category | Description | Examples |
|----------|-------------|----------|
| HIERARCHICAL | Parent-child, category-instance relationships | isA, subClassOf, instanceOf |
| LATERAL | Similarity, contrast, analogy relationships | similarTo, contrastsWith, analogousTo |
| TEMPORAL | Before-after, causes-results relationships | before, after, during |
| COMPOSITIONAL | Part-whole, component-system relationships | hasPart, partOf |
| CAUSAL | Cause-effect relationships | causes, causedBy, influences |
| ATTRIBUTIVE | Entity-property relationships | hasProperty, propertyOf |

### Core Relationship Types

The system implements the following core relationship types:

#### Hierarchical Relationships
- `IS_A` / `INSTANCE_OF`: Links an individual Entity to a Concept/Class
- `SUB_CLASS_OF` / `SUPER_CLASS_OF`: Links a Concept to a higher/lower Concept

#### Compositional Relationships
- `HAS_PART` / `PART_OF`: Represents part-whole relationships

#### Spatial Relationships
- `LOCATED_IN` / `HAS_LOCATION`: Represents spatial containment or association
- `CONTAINED_IN` / `CONTAINS`: Represents containment relationships between Location nodes
- `OCCURRED_AT`: Links an Event to a Location where it occurred

#### Temporal Relationships
- `HAS_TIME` / `OCCURS_ON`: Temporal tag for events
- `BEFORE` / `AFTER` / `DURING`: Temporal ordering relationships

#### Participation Relationships
- `PARTICIPANT` / `HAS_PARTICIPANT`: Relates entities to events
- `AGENT` / `HAS_AGENT`: Identifies the active doer in an event
- `PATIENT` / `HAS_PATIENT`: Identifies the entity acted upon

#### Causal Relationships
- `CAUSES` / `CAUSED_BY`: Direct causal relationships
- `INFLUENCES` / `INFLUENCED_BY`: Indirect or partial causal relationships

#### Sequential Relationships
- `NEXT` / `PREVIOUS`: Ordering in a sequence

#### Social Relationships
- `KNOWS`: General acquaintance relationship between Entities (particularly Persons)
- `FRIEND_OF`: Friendship relationship between Entities (particularly Persons)
- `MEMBER_OF`: Membership relationship linking an Entity to an organization or group

#### Property Relationships
- `HAS_PROPERTY` / `PROPERTY_OF`: Links an Entity to an Attribute

#### General Relationships
- `RELATED_TO`: Generic relationship indicating a connection between two nodes
- `ASSOCIATED_WITH`: Indicates a looser association between nodes

#### Emotional Relationships
- `EXPRESSES_EMOTION`: Links an Entity (usually Person) to an Emotion they express
- `FEELS`: Links an Entity (usually Person) to an Emotion they experience
- `EVOKES_EMOTION`: Links a node to an Emotion it tends to evoke

#### Belief Relationships
- `BELIEVES`: Links an Agent to a Proposition they believe
- `SUPPORTS`: Indicates one node provides support for another (typically used with Propositions)
- `CONTRADICTS`: Indicates one node contradicts another (typically used with Propositions)

#### Source Relationships
- `DERIVED_FROM`: Indicates one node is derived from another
- `CITES`: Indicates one node cites another as a source
- `SOURCE`: Links a node to its source of information

### Person-Specific Relationship Types

These relationship types are specifically designed for modeling relationships involving Person entities:

#### Mentorship and Influence
- `MENTORS` / `MENTORED_BY`: Mentorship relationship between persons
- `ADMIRES` / `ADMIRED_BY`: Indicates admiration or respect
- `OPPOSES` / `OPPOSED_BY`: Indicates opposition or conflict
- `SHAPED_BY`: Indicates a person was significantly influenced by something
- `TRANSFORMED`: Indicates a transformative experience for a person

#### Personality and Psychology
- `EXHIBITS_TRAIT`: Links a Person to personality traits
- `HAS_PERSONALITY`: Links a Person to their overall personality profile
- `HAS_COGNITIVE_STYLE`: Links a Person to their cognitive approach
- `STRUGGLES_WITH`: Indicates challenges or difficulties a person faces

#### Values and Ethics
- `VALUES`: Links a Person to concepts they value highly
- `ADHERES_TO`: Links a Person to principles or beliefs they follow
- `REJECTS`: Links a Person to concepts or principles they reject
- `HAS_ETHICAL_FRAMEWORK`: Links a Person to their ethical system
- `LOYAL_TO`: Indicates loyalty to a person, organization, or concept

### Relationship Properties

All relationships can have the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `context` | string | Explanatory context of the relationship (30-50 words) |
| `confidenceScore` | number | Confidence in the relationship (0.0-1.0) |
| `sources` | string[] | Citation sources for the relationship |
| `weight` | number | Weight of the relationship (0.0-1.0), used for traversal prioritization |
| `relationshipCategory` | RelationshipCategory | Category the relationship belongs to |
| `contextType` | string | Type of context ('hierarchical', 'associative', 'causal', 'temporal', 'analogical', 'attributive') |
| `contextStrength` | number | How strong this particular context is (0.0-1.0) |
| `memoryAids` | string[] | Phrases or cues that help recall this relationship |

### Schema Examples

Below are examples of how various node types can be connected using these relationships:

#### Entity-Concept Relationships
```cypher
(personEntity:Entity {name: "Albert Einstein"}) -[:IS_A]-> (physicistConcept:Concept {name: "Physicist"})
(theoryEntity:Entity {name: "Theory of Relativity"}) -[:INSTANCE_OF]-> (theoryConcept:Concept {name: "Scientific Theory"})
```

#### Event Relationships
```cypher
(person:Entity {name: "Marie Curie"}) -[:AGENT]-> (discovery:Event {name: "Discovery of Radium"})
(discovery:Event {name: "Discovery of Radium"}) -[:OCCURRED_AT]-> (location:Location {name: "Paris, France"})
(discovery:Event {name: "Discovery of Radium"}) -[:BEFORE]-> (nobelPrize:Event {name: "Nobel Prize in Chemistry"})
```

#### Causal and Influence Relationships
```cypher
(invention:Event {name: "Invention of Printing Press"}) -[:CAUSES {weight: 0.9}]-> (literacyGrowth:Event {name: "Growth of Literacy in Europe"})
(philosopher:Entity {name: "Immanuel Kant"}) -[:INFLUENCES {weight: 0.8}]-> (ethicalTheory:Concept {name: "Deontological Ethics"})
```

#### Thought and Reasoning Relationships
```cypher
(person:Entity {name: "Jane Doe"}) -[:HAS_AGENT]-> (thought:Thought {name: "Analysis of Climate Policy"})
(thought:Thought {name: "Analysis of Climate Policy"}) -[:ASSOCIATED_WITH]-> (reasoningChain:ReasoningChain {name: "Climate Policy Impact Assessment"})
(reasoningChain:ReasoningChain) -[:HAS_PART]-> (reasoningStep:ReasoningStep {name: "Economic Impact Evaluation"})
```

#### Person-Specific Relationships
```cypher
(student:Entity {name: "Ada Lovelace"}) -[:MENTORED_BY {context: "Mathematical education and collaboration"}]-> (mentor:Entity {name: "Charles Babbage"})
(person:Entity {name: "Gandhi"}) -[:ADHERES_TO {weight: 0.95}]-> (principle:Concept {name: "Non-violence"})
(politician:Entity {name: "Abraham Lincoln"}) -[:EXHIBITS_TRAIT {confidenceScore: 0.9}]-> (trait:Attribute {name: "Perseverance"})
```