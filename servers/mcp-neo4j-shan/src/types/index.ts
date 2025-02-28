import neo4j, { Integer, Node, Relationship, Driver as Neo4jDriver, DateTime } from 'neo4j-driver'
import { KnowledgeGraphMemory, Entity as BaseEntity, KnowledgeGraph as BaseKnowledgeGraph, Relation as BaseRelation } from "@neo4j/graphrag-memory";

// Add the RelationshipCategory enum
export enum RelationshipCategory {
  HIERARCHICAL = 'hierarchical', // parent-child, category-instance
  LATERAL = 'lateral',           // similarity, contrast, analogy
  TEMPORAL = 'temporal',         // before-after, causes-results
  COMPOSITIONAL = 'compositional' // part-whole, component-system
}

// Base interface for all node types
export interface BaseNode {
  name: string;
  createdAt: DateTime;
  lastUpdated: DateTime;
}

// Enhanced node type interfaces
export interface EnhancedEntity extends BaseNode {
  nodeType: 'Entity';
  observations: string[];
  confidence?: number;
  source?: string;
  description?: string;
  biography?: string;  // Added field for biographical information
  keyContributions?: string[];  // Added field for key contributions
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
}

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
}

export interface Concept extends BaseNode {
  nodeType: 'Concept';
  definition: string;  // Required concise explanation of the concept (1-2 sentences)
  description?: string;
  examples: string[];
  relatedConcepts: string[];
  domain: string;
  significance?: string;
  perspectives?: string[];  // Added field for multiple viewpoints on the concept
  historicalDevelopment?: {period: string, development: string}[];  // Added field for temporal evolution
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
  abstractionLevel?: number;  // 0.0-1.0 scale (concrete to abstract)
  metaphoricalMappings?: string[];  // Conceptual metaphors used to explain this concept
}

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

// New interfaces for reasoning chains and steps
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
}

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
}

export type KnowledgeNode = EnhancedEntity | Event | Concept | ScientificInsight | Law | Thought | ReasoningChain | ReasoningStep;

export type EntityNode = Node<Integer, KnowledgeNode>

export interface EnhancedRelation extends BaseRelation {
  fromType?: string;
  toType?: string;
  context?: string;  // Added field for explanatory context of the relationship (30-50 words)
  confidenceScore?: number;  // Added field for confidence scoring
  sources?: string[];  // Added field for citation sources
  weight?: number;     // Weight of the relationship (0.0-1.0), used for traversal prioritization
  
  // New cognitive enhancement fields
  contextType?: 'hierarchical' | 'associative' | 'causal' | 'temporal' | 'analogical';
  contextStrength?: number; // 0.0-1.0 indicating how strong this particular context is
  memoryAids?: string[]; // Phrases or cues that help recall this relationship
  relationshipCategory?: RelationshipCategory; // Categorization of relationship type
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

export interface Entity extends BaseEntity {
  description?: string;
  biography?: string;
  keyContributions?: string[];
  emotionalValence?: number;
  emotionalArousal?: number;
  // Additional properties from EnhancedEntity
  source?: string;
  confidence?: number;
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
  timestamp?: string; // Added for Event entity
  duration?: string;  // Added for Event entity
  // Additional properties from Concept
  definition?: string;
  domain?: string;
  examples?: string[];
  relatedConcepts?: string[];
  perspectives?: string[];
  historicalDevelopment?: {period: string, development: string}[];
  abstractionLevel?: number;
  metaphoricalMappings?: string[];
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
  evidenceStrength?: number;
  scientificCounterarguments?: string[];
  applicationDomains?: string[];
  replicationStatus?: string;
  surpriseValue?: number;
  // Additional properties from Law
  statement?: string;
  conditions?: string[];
  exceptions?: string[];
  proofs?: string[];
  domainConstraints?: string[];
  historicalPrecedents?: string[];
  counterexamples?: string[];
  formalRepresentation?: string;
  // Additional properties from ReasoningChain
  conclusion?: string;                           // Added for ReasoningChain
  confidenceScore?: number;                      // Added for ReasoningChain
  sourceThought?: string;                        // Added for ReasoningChain
  numberOfSteps?: number;                        // Added for ReasoningChain
  alternativeConclusionsConsidered?: string[];   // Added for ReasoningChain
  // Additional properties from ReasoningStep
  content?: string;                              // Added for ReasoningStep
  stepType?: string;                             // Added for ReasoningStep
  evidenceType?: string;                         // Added for ReasoningStep
  supportingReferences?: string[];               // Added for ReasoningStep
  alternatives?: string[];                       // Added for ReasoningStep
  counterarguments?: string[];                   // Added for ReasoningStep
  assumptions?: string[];                        // Added for ReasoningStep
  formalNotation?: string;                       // Added for ReasoningStep
}

export interface Relation extends BaseRelation {
  context?: string;
  confidenceScore?: number;
  weight?: number;
  sources?: string[];
}

export interface CustomKnowledgeGraphMemory {
  createEntities(entities: Entity[]): Promise<Entity[]>;
  createRelations(relations: Relation[]): Promise<Relation[]>;
  searchNodes(query: string): Promise<KnowledgeGraph>;
} 