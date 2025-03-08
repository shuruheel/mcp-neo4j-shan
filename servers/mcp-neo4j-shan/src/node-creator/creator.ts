import { Driver as Neo4jDriver } from 'neo4j-driver';
import { Entity, Relation, KnowledgeGraph, CustomKnowledgeGraphMemory } from '../types/index.js';
import { loadGraph, saveGraph } from './utils.js';
import { 
  createEntities as createEntitiesImpl, 
  createRelations as createRelationsImpl,
  searchNodes as searchNodesImpl,
  createThought as createThoughtImpl,
  createReasoningChain as createReasoningChainImpl,
  createReasoningStep as createReasoningStepImpl,
  createLocation as createLocationImpl
} from './methods.js';

/**
 * Neo4jCreator - Main class for creating and persisting knowledge graph nodes in Neo4j
 * 
 * This class handles the creation of various node types (entities, events, concepts, etc.)
 * and the relations between them in a Neo4j database. It implements cognitive science
 * principles in the way it structures and enhances knowledge representation.
 */
export class Neo4jCreator implements CustomKnowledgeGraphMemory {
  /**
   * Creates a new Neo4jCreator instance
   * @param neo4jDriver - Neo4j driver instance for database connection
   */
  constructor(private neo4jDriver: Neo4jDriver) { }

  /**
   * Load the current graph from the Neo4j database
   * @returns Promise resolving to the KnowledgeGraph
   */
  async loadGraph(): Promise<KnowledgeGraph> {
    return loadGraph(this.neo4jDriver);
  }

  /**
   * Save the graph to the Neo4j database
   * @param graph - The graph to save
   */
  async saveGraph(graph: KnowledgeGraph): Promise<void> {
    return saveGraph(this.neo4jDriver, graph);
  }

  /**
   * Create entities in the Neo4j database
   * @param entities - Array of entities to create
   * @returns Promise resolving to the created entities
   */
  async createEntities(entities: Entity[]): Promise<Entity[]> {
    return createEntitiesImpl(this.neo4jDriver, entities);
  }

  /**
   * Create relations between entities in the Neo4j database
   * @param relations - Array of relations to create
   * @returns Promise resolving to the created relations
   */
  async createRelations(relations: Relation[]): Promise<Relation[]> {
    return createRelationsImpl(this.neo4jDriver, relations);
  }

  /**
   * Search for nodes in the Neo4j database
   * @param query - Search query
   * @returns Promise resolving to the matching knowledge graph
   */
  async searchNodes(query: string): Promise<KnowledgeGraph> {
    return searchNodesImpl(this.neo4jDriver, query);
  }

  /**
   * Create a thought node in the Neo4j database
   * @param thought - Thought data
   * @returns Promise resolving to the created entity
   */
  async createThought(thought: { 
    entityName?: string;
    title: string;
    thoughtContent: string;
    entities?: string[];
    concepts?: string[];
    events?: string[];
    scientificInsights?: string[];
    laws?: string[];
    thoughts?: string[];
    confidence?: number;
    source?: string;
    createdBy?: string;
    tags?: string[];
    impact?: string;
    emotionalValence?: number;
    emotionalArousal?: number;
    evidentialBasis?: string[];
    thoughtCounterarguments?: string[];
    implications?: string[];
    thoughtConfidenceScore?: number;
  }): Promise<Entity> {
    return createThoughtImpl(this.neo4jDriver, thought);
  }

  /**
   * Create a reasoning chain in the Neo4j database
   * @param reasoningChain - Reasoning chain data
   * @returns Promise resolving to the created entity
   */
  async createReasoningChain(reasoningChain: {
    name: string;
    description: string;
    conclusion: string;
    confidenceScore: number;
    sourceThought?: string;
    creator: string;
    methodology: 'deductive' | 'inductive' | 'abductive' | 'analogical' | 'mixed';
    domain?: string;
    tags?: string[];
    alternativeConclusionsConsidered?: string[];
  }): Promise<Entity> {
    return createReasoningChainImpl(this.neo4jDriver, reasoningChain);
  }

  /**
   * Create a reasoning step in the Neo4j database
   * @param stepData - Reasoning step data
   * @returns Promise resolving to the created entity
   */
  async createReasoningStep(stepData: {
    chainName: string;
    name: string;
    content: string;
    stepNumber: number;
    stepType: 'premise' | 'inference' | 'evidence' | 'counterargument' | 'rebuttal' | 'conclusion';
    evidenceType?: 'observation' | 'fact' | 'assumption' | 'inference' | 'expert_opinion' | 'statistical_data';
    supportingReferences?: string[];
    confidence: number;
    alternatives?: string[];
    counterarguments?: string[];
    assumptions?: string[];
    formalNotation?: string;
    previousSteps?: string[];
  }): Promise<Entity> {
    return createReasoningStepImpl(this.neo4jDriver, stepData);
  }

  /**
   * Create a location node in the Neo4j database
   * @param location - Location data
   * @param location.name - Name of the location
   * @param location.locationType - Type of location (City, Country, Region, Building, Virtual, etc.)
   * @param location.coordinates - Geographical coordinates {latitude, longitude}
   * @param location.description - Textual description of the location
   * @param location.locationSignificance - Historical, cultural, or personal importance
   * @param location.containedWithin - Creates a CONTAINED_IN relationship to another Location
   * @param location.eventsOccurred - Creates OCCURRED_AT relationships from Events to this Location
   * @returns Promise resolving to the created entity
   */
  async createLocation(location: {
    name: string;
    locationType?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    description?: string;
    containedWithin?: string;
    locationSignificance?: string;
    eventsOccurred?: string[];
  }): Promise<Entity> {
    return createLocationImpl(this.neo4jDriver, location);
  }
} 