import {
  Entity as BaseEntity,
  KnowledgeGraph as BaseKnowledgeGraph,
  Relation as BaseRelation,
  Source,
  EmotionalEvent,
} from '@mcp-engram/graphrag-memory';

export type { Source, EmotionalEvent };

// Relationship category for edge classification
export enum RelationshipCategory {
  HIERARCHICAL = 'hierarchical',
  LATERAL = 'lateral',
  TEMPORAL = 'temporal',
  COMPOSITIONAL = 'compositional',
  CAUSAL = 'causal',
  ATTRIBUTIVE = 'attributive',
}

// Expanded relationship type enum
export enum RelationshipType {
  // Hierarchical
  IS_A = 'isA',
  INSTANCE_OF = 'instanceOf',
  SUB_CLASS_OF = 'subClassOf',
  SUPER_CLASS_OF = 'superClassOf',

  // Compositional
  HAS_PART = 'hasPart',
  PART_OF = 'partOf',

  // Spatial
  LOCATED_IN = 'locatedIn',
  HAS_LOCATION = 'hasLocation',
  CONTAINED_IN = 'containedIn',
  CONTAINS = 'contains',
  OCCURRED_AT = 'occurredAt',

  // Temporal
  HAS_TIME = 'hasTime',
  OCCURS_ON = 'occursOn',
  BEFORE = 'before',
  AFTER = 'after',
  DURING = 'during',

  // Participation
  PARTICIPANT = 'participant',
  HAS_PARTICIPANT = 'hasParticipant',
  AGENT = 'agent',
  HAS_AGENT = 'hasAgent',
  PATIENT = 'patient',
  HAS_PATIENT = 'hasPatient',

  // Causal
  CAUSES = 'causes',
  CAUSED_BY = 'causedBy',
  INFLUENCES = 'influences',
  INFLUENCED_BY = 'influencedBy',

  // Sequential
  NEXT = 'next',
  PREVIOUS = 'previous',

  // Social
  KNOWS = 'knows',
  FRIEND_OF = 'friendOf',
  MEMBER_OF = 'memberOf',

  // Property
  HAS_PROPERTY = 'hasProperty',
  PROPERTY_OF = 'propertyOf',

  // General
  RELATED_TO = 'relatedTo',
  ASSOCIATED_WITH = 'associatedWith',

  // Emotional
  EXPRESSES_EMOTION = 'expressesEmotion',
  FEELS = 'feels',
  EVOKES_EMOTION = 'evokesEmotion',

  // Belief
  BELIEVES = 'believes',
  SUPPORTS = 'supports',
  CONTRADICTS = 'contradicts',

  // Source / provenance
  DERIVED_FROM = 'derivedFrom',
  CITES = 'cites',
  SOURCE = 'source',

  // Person-specific
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
  HAS_ETHICAL_FRAMEWORK = 'hasEthicalFramework',

  // New relation types
  EXPERIENCED = 'experienced',
  ABOUT = 'about',
  TRIGGERED_BY = 'triggeredBy',
  HAS_STEP = 'hasStep',
  USES = 'uses',
  BASED_ON = 'basedOn',
  RESULT_OF = 'resultOf',
  EVALUATED_BY = 'evaluatedBy',
}

// ----- Entity (the flat "bag of optional fields" shape used by MCP tools) -----

export interface Entity extends BaseEntity {
  description?: string;
  biography?: string;
  keyContributions?: string[];
  emotionalValence?: number;
  emotionalArousal?: number;
  source?: string;
  confidence?: number;
  subType?: string;

  // Person
  aliases?: string[];
  personalityTraits?: { trait: string; evidence: string[]; confidence: number }[];
  cognitiveStyle?: {
    decisionMaking?: string;
    problemSolving?: string;
    worldview?: string;
    biases?: string[];
  };
  emotionalDisposition?: string;
  emotionalTriggers?: { trigger: string; reaction: string; evidence: string[] }[];
  interpersonalStyle?: string;
  powerDynamics?: {
    authorityResponse?: string;
    subordinateManagement?: string;
    negotiationTactics?: string[];
  };
  loyalties?: { target: string; strength: number; evidence: string[] }[];
  coreValues?: { value: string; importance: number; consistency: number }[];
  ethicalFramework?: string;
  psychologicalDevelopment?: { period: string; changes: string; catalysts: string[] }[];
  narrativeTreatment?: {
    authorBias: number;
    portrayalConsistency: number;
    controversialAspects: string[];
  };
  modelConfidence?: number;
  personEvidenceStrength?: number;

  // Event
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

  // Concept
  definition?: string;
  domain?: string;
  examples?: string[];
  relatedConcepts?: string[];
  perspectives?: string[];
  historicalDevelopment?: { period: string; development: string }[];
  abstractionLevel?: number;
  metaphoricalMappings?: string[];

  // Attribute
  value?: string | number;
  unit?: string;
  valueType?: 'numeric' | 'categorical' | 'boolean' | 'text';
  possibleValues?: string[];

  // Proposition
  statement?: string;
  truthValue?: boolean;
  evidenceStrength?: number;
  counterEvidence?: string[];

  // Emotion
  intensity?: number;
  valence?: number;
  category?: string;
  subcategory?: string;

  // Agent
  agentType?: 'human' | 'ai' | 'organization' | 'other';
  capabilities?: string[];
  beliefs?: string[];
  knowledge?: string[];
  preferences?: string[];
  emotionalState?: string;

  // Thought
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
  stance?: 'support' | 'oppose' | 'uncertain' | 'mixed';

  // ScientificInsight
  methodology?: string;
  hypothesis?: string;
  evidence?: string[];
  field?: string;
  publications?: string[];
  scientificCounterarguments?: string[];
  applicationDomains?: string[];
  replicationStatus?: string;
  surpriseValue?: number;

  // Law
  conditions?: string[];
  exceptions?: string[];
  proofs?: string[];
  domainConstraints?: string[];
  historicalPrecedents?: string[];
  counterexamples?: string[];
  formalRepresentation?: string;

  // Location
  locationType?: string;
  coordinates?: { latitude: number; longitude: number };
  locationSignificance?: string;

  // ReasoningChain
  conclusion?: string;
  confidenceScore?: number;
  sourceThought?: string;
  numberOfSteps?: number;
  alternativeConclusionsConsidered?: string[];
  relatedPropositions?: string[];

  // ReasoningStep
  content?: string;
  stepType?: string;
  evidenceType?: string;
  supportingReferences?: string[];
  alternatives?: string[];
  counterarguments?: string[];
  assumptions?: string[];
  formalNotation?: string;
  propositions?: string[];
  chainName?: string;
  stepNumber?: number;

  // Source (when entityType === 'Source')
  sourceType?: string;
  uri?: string;
  collectedAt?: string;
  contentHash?: string;
  metadataJson?: string;
  reliability?: number; // 0.0-1.0 source trustworthiness (default 1.0)

  // EmotionalEvent (when entityType === 'EmotionalEvent')
  arousal?: number;
  label?: string;
  notes?: string;
}

export interface Relation extends BaseRelation {
  context?: string;
  confidenceScore?: number;
  weight?: number;
  sources?: string[];
  relationshipType?: RelationshipType;
  contextStrength?: number;
  memoryAids?: string[];
  relationshipCategory?: RelationshipCategory;
}

export interface KnowledgeGraph extends BaseKnowledgeGraph {
  entities: Entity[];
  relations: Relation[];
}

// ---------- Conflict detection & confidence propagation ----------

export interface ConflictPair {
  nodeA: Entity;
  nodeB: Entity;
  type: 'explicit';
  reason: string;
}

export interface ClaimAssessment {
  node: Entity;
  storedConfidence: number;
  effectiveConfidence: number;
  sources: Array<{ source: Entity; reliability: number }>;
  conflicts: ConflictPair[];
}

export interface AssessClaimsResult {
  assessments: ClaimAssessment[];
  conflicts: ConflictPair[];
  summary: string;
}

// ---------- Storage backend abstraction ----------

export interface ExploreOptions {
  maxDepth?: number;
  minWeight?: number;
  includeTypes?: string[];
}

export interface TemporalOptions {
  direction?: 'forward' | 'backward' | 'both';
  maxEvents?: number;
}

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export interface ReasoningChainInput {
  name: string;
  description: string;
  conclusion: string;
  confidenceScore: number;
  creator?: string;
  methodology?: 'deductive' | 'inductive' | 'abductive' | 'analogical' | 'mixed';
  domain?: string;
  tags?: string[];
  sourceThought?: string;
  alternativeConclusionsConsidered?: string[];
}

export interface ReasoningStepInput {
  name: string;
  content: string;
  stepNumber: number;
  stepType: 'premise' | 'inference' | 'evidence' | 'counterargument' | 'rebuttal' | 'conclusion';
  confidence: number;
  evidenceType?: string;
  supportingReferences?: string[];
  alternatives?: string[];
  counterarguments?: string[];
  assumptions?: string[];
  formalNotation?: string;
  previousSteps?: string[];
}

export interface StorageBackend {
  initialize(): void;
  close(): void;

  // Write
  createNodes(nodes: Entity[]): Entity[];
  createRelations(relations: Relation[]): Relation[];
  deleteNodes(names: string[]): void;
  deleteRelations(relations: { from: string; to: string; relationType: string }[]): void;
  addObservations(observations: { nodeName: string; contents: string[] }[]): void;

  // Search
  searchNodes(query: string, filter?: { nodeTypes?: string[]; limit?: number }): KnowledgeGraph;
  getNodeByName(name: string): Entity | null;
  getNodesByNames(names: string[]): Entity[];
  resolveAlias(alias: string): string | null;

  // Graph traversal
  exploreContext(nodeNames: string[], options?: ExploreOptions): KnowledgeGraph;
  getTemporalSequence(startNode: string, options?: TemporalOptions): KnowledgeGraph;
  findShortestPath(from: string, to: string, maxDepth?: number): KnowledgeGraph;

  // Reasoning
  createReasoningChain(chain: ReasoningChainInput, steps: ReasoningStepInput[]): Entity;
  getReasoningChain(chainName: string): KnowledgeGraph;
  findReasoningChains(topics: string[], limit?: number): KnowledgeGraph;

  // Validation
  validateProvenance(nodeName: string): ValidationResult;

  // Conflict detection & confidence propagation
  detectConflicts(nodeNames?: string[]): ConflictPair[];
  computeEffectiveConfidence(nodeName: string): {
    effectiveConfidence: number;
    sources: Array<{ source: Entity; reliability: number }>;
  };
  assessClaims(query: string, nodeNames?: string[]): AssessClaimsResult;
}
