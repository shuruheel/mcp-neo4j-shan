/**
 * Types for the knowledge processor client
 */

// Node types supported by the Neo4j server
export enum NodeType {
  Entity = 'Entity',
  Event = 'Event',
  Concept = 'Concept',
  Attribute = 'Attribute',
  Proposition = 'Proposition',
  Emotion = 'Emotion',
  Agent = 'Agent',
  ScientificInsight = 'ScientificInsight',
  Law = 'Law',
  Thought = 'Thought',
  ReasoningChain = 'ReasoningChain',
  ReasoningStep = 'ReasoningStep'
}

// Relationship types
export enum RelationshipType {
  HIERARCHICAL = 'HIERARCHICAL',
  COMPOSITIONAL = 'COMPOSITIONAL',
  SPATIAL = 'SPATIAL',
  TEMPORAL = 'TEMPORAL',
  PARTICIPATION = 'PARTICIPATION',
  CAUSAL = 'CAUSAL',
  SEQUENTIAL = 'SEQUENTIAL',
  SOCIAL = 'SOCIAL',
  PROPERTY = 'PROPERTY',
  GENERAL = 'GENERAL',
  EMOTIONAL = 'EMOTIONAL',
  BELIEF = 'BELIEF',
  SOURCE = 'SOURCE'
}

// Base node interface
export interface Node {
  name: string;
  entityType: NodeType;
  description?: string;
  source?: string;
  emotionalValence?: number;
  emotionalArousal?: number;
  observations?: string[];
  [key: string]: any; // Additional properties based on node type
}

// Relation interface
export interface Relation {
  from: string;
  to: string;
  relationType: string;
  relationshipType: RelationshipType;
  context: string;
  confidenceScore?: number;
  weight?: number;
  sources?: string[];
  contextType?: 'hierarchical' | 'associative' | 'causal' | 'temporal' | 'analogical' | 'attributive';
}

// Reasoning chain completeness type
export type ChainCompleteness = 'complete' | 'partial-beginning' | 'partial-middle' | 'partial-end' | 'unknown';

// Reasoning chain fragment interface
export interface ReasoningChainFragment {
  chainName: string;
  description: string;
  conclusion: string;
  confidenceScore: number;
  methodology: 'deductive' | 'inductive' | 'abductive' | 'analogical' | 'mixed';
  domain?: string;
  sourceThought?: string;
  tags?: string[];
  steps: ReasoningStep[];
  // Fragment metadata
  source: string; // Source document
  chunkIndex: number; // Which chunk this came from
  completeness: ChainCompleteness; // How complete this fragment is
  connectionClues: string[]; // Clues for connecting to other fragments
  hash?: string; // Computed hash for deduplication
}

// Reasoning chain interface
export interface ReasoningChain {
  chainName: string;
  description: string;
  conclusion: string;
  confidenceScore: number;
  methodology: 'deductive' | 'inductive' | 'abductive' | 'analogical' | 'mixed';
  domain?: string;
  sourceThought?: string;
  tags?: string[];
  steps: ReasoningStep[];
}

// Reasoning step interface
export interface ReasoningStep {
  name: string;
  content: string;
  stepNumber: number;
  stepType: 'premise' | 'inference' | 'evidence' | 'counterargument' | 'rebuttal' | 'conclusion';
  confidence: number;
  evidenceType?: 'observation' | 'fact' | 'assumption' | 'inference' | 'expert_opinion' | 'statistical_data';
  supportingReferences?: string[];
  previousSteps?: string[];
  alternatives?: string[];
  counterarguments?: string[];
  assumptions?: string[];
  formalNotation?: string;
}

// Entity/Relation extraction result
export interface EntityRelationResult {
  nodes: Node[];
  relations: Relation[];
}

// Reasoning chain extraction result
export interface ReasoningChainResult {
  reasoningChains: ReasoningChainFragment[];
}

// Processing result interface
export interface ProcessingResult {
  nodes: Node[];
  relations: Relation[];
  reasoningChains: ReasoningChainFragment[];
}

// Checkpoint state interface
export interface CheckpointState {
  lastCompletedChunk: number;
  totalChunks: number;
  processingStatus: 'not_started' | 'in_progress' | 'completed' | 'error' | 'failed';
  lastAttemptedChunk?: number;
  lastError?: string;
  retryCount: number;
  lastUpdated?: string;
}

// Checkpoint database interface
export interface CheckpointDB {
  completedFiles: string[];
  fileStates: Record<string, CheckpointState>;
  // Add pending reasoning chains storage
  pendingChains: Record<string, ReasoningChainFragment[]>;
}

// Content extractor interface
export interface ContentExtractor {
  canHandle(file: string): boolean;
  extractContent(file: string): Promise<string>;
}

// Recovery action interface
export interface RecoveryAction {
  action: 'retry' | 'split-chunk' | 'skip';
  delay?: number;
}

// Configuration interface
export interface Config {
  anthropic: {
    apiKey: string;
    model: string;
  };
  mcp: {
    serverPath: string;
  };
  neo4j?: {
    uri: string;
    username: string;
    password: string;
  };
  processing: {
    chunkSize: number;
    maxRetries: number;
    concurrency: number;
  };
  logging: {
    level: string;
  };
} 