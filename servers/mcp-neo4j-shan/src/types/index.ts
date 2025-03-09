import neo4j, { Integer, Node, Relationship, Driver as Neo4jDriver, DateTime } from 'neo4j-driver'
import { KnowledgeGraphMemory, Entity as BaseEntity, KnowledgeGraph as BaseKnowledgeGraph, Relation as BaseRelation } from "@neo4j/graphrag-memory";

// Add the RelationshipCategory enum
export enum RelationshipCategory {
  HIERARCHICAL = 'hierarchical', // parent-child, category-instance
  LATERAL = 'lateral',           // similarity, contrast, analogy
  TEMPORAL = 'temporal',         // before-after, causes-results
  COMPOSITIONAL = 'compositional', // part-whole, component-system
  CAUSAL = 'causal',             // causes-effect relationships
  ATTRIBUTIVE = 'attributive'    // entity-property relationships
}

// Base interface for all node types
export interface BaseNode {
  name: string;
  createdAt: DateTime;
  lastUpdated: DateTime;
}

// Enhanced Entity (corresponds to Entity in the recommended schema)
export interface EnhancedEntity extends BaseNode {
  nodeType: 'Entity';
  observations: string[];
  confidence?: number;
  source?: string;
  description?: string;
  biography?: string;  // Biographical information
  keyContributions?: string[];  // Key contributions
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
  // Optional entity subtype
  subType?: string; // "Person", "Organization", "Location", "Artifact", "Animal", "Concept"
  // Person details - either stored as a full Person object or as serialized JSON
  personDetails?: Person | string; // Detailed person information if this entity is a person
}

// Person (expanded schema from the Person node type)
export interface Person {
  // Basic Attributes
  name: string;
  aliases?: string[];  // Alternative names or nicknames
  biography?: string;  // Brief biographical summary

  // Psychological Profile
  personalityTraits?: {
    trait: string;  // e.g., "Analytical", "Pragmatic", "Authoritarian"
    evidence: string[];  // Textual evidence supporting this trait
    confidence: number;  // 0.0-1.0 - Model's confidence in this attribution
  }[];
  cognitiveStyle?: {
    decisionMaking?: string;  // How the person makes decisions (e.g., "Methodical", "Intuitive")
    problemSolving?: string;  // Approach to problem-solving
    worldview?: string;  // Person's fundamental perspective
    biases?: string[];  // Observed cognitive biases in their thinking
  };

  // Emotional Profile
  emotionalDisposition?: string;  // Overall emotional tendency (e.g., "Reserved", "Volatile")
  emotionalTriggers?: {
    trigger: string;  // Events/situations causing strong emotional responses
    reaction: string;  // Typical emotional response
    evidence: string[];  // Textual evidence
  }[];

  // Relational Dynamics
  interpersonalStyle?: string;  // How they typically interact with others
  powerDynamics?: {
    authorityResponse?: string;  // How they respond to authority
    subordinateManagement?: string;  // How they manage subordinates
    negotiationTactics?: string[];  // Observed negotiation approaches
  };
  loyalties?: {
    target: string;  // Person, institution, or concept
    strength: number;  // 0.0-1.0 - Intensity of loyalty
    evidence: string[];  // Supporting textual evidence
  }[];

  // Value System
  coreValues?: {
    value: string;  // e.g., "National security", "Global stability"
    importance: number;  // 0.0-1.0 - Relative importance
    consistency: number;  // 0.0-1.0 - How consistently upheld
  }[];
  ethicalFramework?: string;  // Ethical approach (e.g., "Realist", "Utilitarian")

  // Temporal Attributes
  psychologicalDevelopment?: {
    period: string;  // Time period
    changes: string;  // Notable psychological shifts
    catalysts: string[];  // Events triggering changes
  }[];

  // Meta Attributes
  narrativeTreatment?: {
    authorBias: number;  // -1.0 to 1.0 - Detected authorial bias
    portrayalConsistency: number;  // 0.0-1.0 - Consistency across sources
    controversialAspects: string[];  // Disputed psychological features
  };
  modelConfidence?: number;  // 0.0-1.0 - Overall confidence in profile
  evidenceStrength?: number;  // 0.0-1.0 - Strength of supporting evidence
}

// Event (corresponds to Event in the recommended schema)
export interface Event extends BaseNode {
  nodeType: 'Event';
  startDate?: string;
  endDate?: string;
  status?: string; // "Ongoing", "Concluded", "Planned"
  timestamp?: string;
  duration?: string;
  location?: string;
  participants: string[];
  outcome: string;
  significance?: string;
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
  causalPredecessors?: string[];  // Events that directly led to this event
  causalSuccessors?: string[];  // Events directly resulting from this event
  // Optional event subtype
  subType?: string; // "Action", "StateChange", "Observation", "Conversation"
}

// Concept/Category (corresponds to Concept/Category in the recommended schema)
export interface Concept extends BaseNode {
  nodeType: 'Concept';
  definition: string;  // Required concise explanation of the concept (1-2 sentences)
  description?: string;
  examples: string[];
  relatedConcepts: string[];
  domain: string;
  significance?: string;
  perspectives?: string[];  // Multiple viewpoints on the concept
  historicalDevelopment?: {period: string, development: string}[];  // Temporal evolution
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
  abstractionLevel?: number;  // 0.0-1.0 scale (concrete to abstract)
  metaphoricalMappings?: string[];  // Conceptual metaphors used to explain this concept
}

// Attribute/Quality (new in the recommended schema)
export interface Attribute extends BaseNode {
  nodeType: 'Attribute';
  value: string | number; // The actual attribute value
  unit?: string; // Unit of measurement if applicable
  valueType: 'numeric' | 'categorical' | 'boolean' | 'text'; // Type of the value
  possibleValues?: string[]; // Possible values for categorical attributes
  description?: string; // Description of what this attribute represents
}

// Proposition/Statement (new in the recommended schema)
export interface Proposition extends BaseNode {
  nodeType: 'Proposition';
  statement: string; // The actual propositional content
  status: 'fact' | 'hypothesis' | 'law' | 'rule' | 'claim'; // Type of proposition
  confidence: number; // 0.0-1.0 confidence score
  truthValue?: boolean; // True/false if known
  sources?: string[]; // Sources supporting this proposition
  domain?: string; // Knowledge domain this proposition belongs to
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
  evidenceStrength?: number;  // 0.0-1.0 scale of evidential support
  counterEvidence?: string[]; // Evidence against this proposition
}

// Emotion (new in the recommended schema)
export interface Emotion extends BaseNode {
  nodeType: 'Emotion';
  intensity: number; // 0.0-1.0 intensity scale
  valence: number; // -1.0 to 1.0 (negative to positive)
  category: string; // E.g., "Joy", "Sadness", "Anger", "Fear", "Surprise", "Disgust"
  subcategory?: string; // More specific emotion category if applicable
  description?: string; // Description of the emotional experience
}

// Agent/Cognitive Entity (new in the recommended schema)
export interface Agent extends BaseNode {
  nodeType: 'Agent';
  agentType: 'human' | 'ai' | 'organization' | 'other';
  description?: string;
  capabilities?: string[];
  beliefs?: string[]; // References to proposition nodes this agent believes
  knowledge?: string[]; // References to knowledge nodes this agent knows
  preferences?: string[]; // Agent's preferences
  emotionalState?: string; // Reference to current emotional state
}

// Thought (retained from original schema)
export interface Thought extends BaseNode {
  nodeType: 'Thought';
  thoughtContent: string;         // The main thought content
  references: string[];    // Names of entities/concepts/events referenced
  confidence?: number;     // How confident is this thought (0-1)
  source?: string;         // Where did this thought come from (person, document)
  createdBy?: string;      // Who created this thought
  tags?: string[];         // Classification tags 
  impact?: string;         // Potential impact or importance
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
  evidentialBasis?: string[];  // Nodes supporting this thought
  thoughtCounterarguments?: string[];  // Potential challenges to the thought
  implications?: string[];  // Logical consequences of the thought
  thoughtConfidenceScore?: number;  // 0.0-1.0 scale of certainty
  // New field to reference associated reasoning chains
  reasoningChains?: string[];  // References to ReasoningChain nodes
}

// ScientificInsight (retained as specified)
export interface ScientificInsight extends BaseNode {
  nodeType: 'ScientificInsight';
  hypothesis: string;
  evidence: string[];
  methodology?: string;
  confidence: number;
  field: string;
  publications?: string[];
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
  evidenceStrength?: number;  // Overall strength of evidential support (0.0-1.0)
  scientificCounterarguments?: string[];  // Known challenges to this insight
  applicationDomains?: string[];  // Practical areas where insight applies
  replicationStatus?: string;  // Current scientific consensus on replication
  surpriseValue?: number;  // How unexpected this insight is (0.0-1.0)
}

// Law (retained as specified)
export interface Law extends BaseNode {
  nodeType: 'Law';
  statement: string;
  conditions: string[];
  exceptions: string[];
  domain: string;
  proofs?: string[];
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
  domainConstraints?: string[];  // Limitations on where law applies
  historicalPrecedents?: string[];  // Earlier formulations or precursors
  counterexamples?: string[];  // Instances that challenge or limit the law
  formalRepresentation?: string;  // Mathematical or logical formulation when applicable
}

// Location (new in the recommended schema)
export interface Location extends BaseNode {
  nodeType: 'Location';
  locationType?: string;  // "City", "Country", "Region", "Building", "Virtual", etc.
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  description?: string;  // Textual description of the location
  locationSignificance?: string;  // Historical, cultural, or personal importance
}

// ReasoningChain (retained and integrated with Proposition)
export interface ReasoningChain extends BaseNode {
  nodeType: 'ReasoningChain';
  description: string;
  conclusion: string;
  confidenceScore: number;  // 0.0-1.0
  creator: string;
  methodology: 'deductive' | 'inductive' | 'abductive' | 'analogical' | 'mixed';
  domain?: string;
  tags?: string[];
  sourceThought?: string;  // Reference to the thought that initiated this reasoning
  numberOfSteps?: number;  // Cached count of steps
  alternativeConclusionsConsidered?: string[];  // Other conclusions that were considered
  // Integration with Proposition
  relatedPropositions?: string[]; // Propositions this reasoning chain relates to
}

// ReasoningStep (retained and integrated with Proposition)
export interface ReasoningStep extends BaseNode {
  nodeType: 'ReasoningStep';
  content: string;  // The actual reasoning content
  stepType: 'premise' | 'inference' | 'evidence' | 'counterargument' | 'rebuttal' | 'conclusion';
  evidenceType?: 'observation' | 'fact' | 'assumption' | 'inference' | 'expert_opinion' | 'statistical_data';
  supportingReferences?: string[];  // References to other nodes supporting this step
  confidence: number;  // 0.0-1.0
  alternatives?: string[];  // Alternative paths that could be taken at this step
  counterarguments?: string[];  // Known challenges to this reasoning step
  assumptions?: string[];  // Underlying assumptions for this step
  formalNotation?: string;  // For logical or mathematical steps
  // Integration with Proposition
  propositions?: string[]; // Propositions used in this reasoning step
}

export type KnowledgeNode = EnhancedEntity | Event | Concept | Attribute | Proposition | Emotion | Agent | ScientificInsight | Law | Location | Thought | ReasoningChain | ReasoningStep;

export type EntityNode = Node<Integer, KnowledgeNode>

// Enhanced Relation with expanded relationship types based on schema
export interface EnhancedRelation extends BaseRelation {
  fromType?: string;
  toType?: string;
  context?: string;  // Explanatory context of the relationship (30-50 words)
  confidenceScore?: number;  // Confidence scoring
  sources?: string[];  // Citation sources
  weight?: number;     // Weight of the relationship (0.0-1.0), used for traversal prioritization
  
  // Cognitive enhancement fields
  contextType?: 'hierarchical' | 'associative' | 'causal' | 'temporal' | 'analogical' | 'attributive';
  contextStrength?: number; // 0.0-1.0 indicating how strong this particular context is
  memoryAids?: string[]; // Phrases or cues that help recall this relationship
  relationshipCategory?: RelationshipCategory; // Categorization of relationship type
}

// Expanded list of relationship types based on schema
export enum RelationshipType {
  // Hierarchical relationships
  IS_A = 'isA',
  INSTANCE_OF = 'instanceOf',
  SUB_CLASS_OF = 'subClassOf',
  SUPER_CLASS_OF = 'superClassOf',
  
  // Compositional relationships
  HAS_PART = 'hasPart',
  PART_OF = 'partOf',
  
  // Spatial relationships
  LOCATED_IN = 'locatedIn',
  HAS_LOCATION = 'hasLocation',
  CONTAINED_IN = 'containedIn',
  CONTAINS = 'contains',
  OCCURRED_AT = 'occurredAt',
  
  // Temporal relationships
  HAS_TIME = 'hasTime',
  OCCURS_ON = 'occursOn',
  BEFORE = 'before',
  AFTER = 'after',
  DURING = 'during',
  
  // Participation relationships
  PARTICIPANT = 'participant',
  HAS_PARTICIPANT = 'hasParticipant',
  AGENT = 'agent',
  HAS_AGENT = 'hasAgent',
  PATIENT = 'patient',
  HAS_PATIENT = 'hasPatient',
  
  // Causal relationships
  CAUSES = 'causes',
  CAUSED_BY = 'causedBy',
  INFLUENCES = 'influences',
  INFLUENCED_BY = 'influencedBy',
  
  // Sequential relationships
  NEXT = 'next',
  PREVIOUS = 'previous',
  
  // Social relationships
  KNOWS = 'knows',
  FRIEND_OF = 'friendOf',
  MEMBER_OF = 'memberOf',
  
  // Property relationships
  HAS_PROPERTY = 'hasProperty',
  PROPERTY_OF = 'propertyOf',
  
  // General relationships
  RELATED_TO = 'relatedTo',
  ASSOCIATED_WITH = 'associatedWith',
  
  // Emotional relationships
  EXPRESSES_EMOTION = 'expressesEmotion',
  FEELS = 'feels',
  EVOKES_EMOTION = 'evokesEmotion',
  
  // Belief relationships
  BELIEVES = 'believes',
  SUPPORTS = 'supports',
  CONTRADICTS = 'contradicts',
  
  // Source relationships
  DERIVED_FROM = 'derivedFrom',
  CITES = 'cites',
  SOURCE = 'source',

  // Person-specific relationships
  MENTORS = 'mentors',
  MENTORED_BY = 'mentoredBy',
  ADMIRES = 'admires',
  ADMIRED_BY = 'admiredBy',
  OPPOSES = 'opposes',
  OPPOSED_BY = 'opposedBy',
  EXHIBITS_TRAIT = 'exhibitsTrait',
  HAS_PERSONALITY = 'hasPersonality',
  VALUES = 'values',
  ADHERES_TO = 'adheresTo',
  REJECTS = 'rejects',
  SHAPED_BY = 'shapedBy',
  TRANSFORMED = 'transformed',
  STRUGGLES_WITH = 'strugglesWith',
  LOYAL_TO = 'loyalTo',
  HAS_COGNITIVE_STYLE = 'hasCognitiveStyle',
  HAS_ETHICAL_FRAMEWORK = 'hasEthicalFramework'
}

export type EntityRelationship = Relationship<Integer, BaseRelation>

export type EntityWithRelationsResult = {
  entity: EntityNode,
  relations: EntityRelationship[],
  inRelations?: EntityRelationship[]
}

export interface KnowledgeGraph extends BaseKnowledgeGraph {
  entities: Entity[];
  relations: EnhancedRelation[];
}

// Updated Entity interface with all the new node type properties
export interface Entity extends BaseEntity {
  description?: string;
  biography?: string;
  keyContributions?: string[];
  emotionalValence?: number;
  emotionalArousal?: number;
  
  // Additional properties from EnhancedEntity
  source?: string;
  confidence?: number;
  subType?: string;
  
  // Person specific fields (from expanded Person schema)
  aliases?: string[];
  personalityTraits?: {
    trait: string;
    evidence: string[];
    confidence: number;
  }[];
  cognitiveStyle?: {
    decisionMaking?: string;
    problemSolving?: string;
    worldview?: string;
    biases?: string[];
  };
  emotionalDisposition?: string;
  emotionalTriggers?: {
    trigger: string;
    reaction: string;
    evidence: string[];
  }[];
  interpersonalStyle?: string;
  powerDynamics?: {
    authorityResponse?: string;
    subordinateManagement?: string;
    negotiationTactics?: string[];
  };
  loyalties?: {
    target: string;
    strength: number;
    evidence: string[];
  }[];
  coreValues?: {
    value: string;
    importance: number;
    consistency: number;
  }[];
  ethicalFramework?: string;
  psychologicalDevelopment?: {
    period: string;
    changes: string;
    catalysts: string[];
  }[];
  narrativeTreatment?: {
    authorBias: number;
    portrayalConsistency: number;
    controversialAspects: string[];
  };
  modelConfidence?: number;
  personEvidenceStrength?: number; // Renamed to avoid conflict with proposition's evidenceStrength
  
  // Additional properties from Event
  startDate?: string;
  endDate?: string;
  status?: string;
  location?: string;
  participants?: string[];
  outcome?: string;
  significance?: string;
  causalPredecessors?: string[];
  causalSuccessors?: string[];
  timestamp?: string;
  duration?: string;
  
  // Additional properties from Concept
  definition?: string;
  domain?: string;
  examples?: string[];
  relatedConcepts?: string[];
  perspectives?: string[];
  historicalDevelopment?: {period: string, development: string}[];
  abstractionLevel?: number;
  metaphoricalMappings?: string[];
  
  // Additional properties from Attribute
  value?: string | number;
  unit?: string;
  valueType?: 'numeric' | 'categorical' | 'boolean' | 'text';
  possibleValues?: string[];
  
  // Additional properties from Proposition
  statement?: string;
  truthValue?: boolean;
  evidenceStrength?: number;
  counterEvidence?: string[];
  
  // Additional properties from Emotion
  intensity?: number;
  valence?: number;
  category?: string;
  subcategory?: string;
  
  // Additional properties from Agent
  agentType?: 'human' | 'ai' | 'organization' | 'other';
  capabilities?: string[];
  beliefs?: string[];
  knowledge?: string[];
  preferences?: string[];
  emotionalState?: string;
  
  // Additional properties from Thought
  title?: string;
  thoughtContent?: string;
  implications?: string[];
  thoughtConfidenceScore?: number;
  tags?: string[];
  impact?: string;
  createdBy?: string;
  evidentialBasis?: string[];
  thoughtCounterarguments?: string[];
  reasoningChains?: string[];
  
  // Additional properties from ScientificInsight
  methodology?: string;
  hypothesis?: string;
  evidence?: string[];
  field?: string;
  publications?: string[];
  scientificCounterarguments?: string[];
  applicationDomains?: string[];
  replicationStatus?: string;
  surpriseValue?: number;
  
  // Additional properties from Law
  conditions?: string[];
  exceptions?: string[];
  proofs?: string[];
  domainConstraints?: string[];
  historicalPrecedents?: string[];
  counterexamples?: string[];
  formalRepresentation?: string;
  
  // Additional properties from Location
  locationType?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  locationSignificance?: string;
  /** @deprecated Use CONTAINED_IN relationship instead. Only used for relationship creation. */
  containedWithin?: string;
  /** @deprecated Use OCCURRED_AT relationship instead. Only used for relationship creation. */
  eventsOccurred?: string[];
  
  // Additional properties from ReasoningChain
  conclusion?: string;
  confidenceScore?: number;
  sourceThought?: string;
  numberOfSteps?: number;
  alternativeConclusionsConsidered?: string[];
  relatedPropositions?: string[];
  
  // Additional properties from ReasoningStep
  content?: string;
  stepType?: string;
  evidenceType?: string;
  supportingReferences?: string[];
  alternatives?: string[];
  counterarguments?: string[];
  assumptions?: string[];
  formalNotation?: string;
  propositions?: string[];
  chainName?: string;  // Reference to the reasoning chain this step belongs to
  stepNumber?: number; // Order/position of this step within the chain
}

export interface Relation extends BaseRelation {
  context?: string;
  confidenceScore?: number;
  weight?: number;
  sources?: string[];
  relationshipType?: RelationshipType;
  contextStrength?: number;
  memoryAids?: string[];
}

export interface CustomKnowledgeGraphMemory {
  createEntities(entities: Entity[]): Promise<Entity[]>;
  createRelations(relations: Relation[]): Promise<Relation[]>;
  searchNodes(query: string): Promise<KnowledgeGraph>;
} 