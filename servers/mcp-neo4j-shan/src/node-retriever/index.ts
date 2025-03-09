import { Driver as Neo4jDriver } from 'neo4j-driver';
import { KnowledgeGraph } from '../types/index.js';
import { 
  robustSearch, 
  searchNodesWithFuzzyMatching 
} from './methods/search.js';
import { 
  exploreContextWeighted,
  findConceptualAssociations,
  findCognitivePath 
} from './methods/exploration.js';
import { 
  getTemporalSequence,
  findTemporalGaps,
  traceCausalChains 
} from './methods/temporal.js';
import { 
  getReasoningChain, 
  getReasoningStepDetails, 
  findReasoningChainsWithSimilarConclusion,
  getReasoningAnalytics 
} from './methods/reasoning.js';

/**
 * Neo4jRetriever: Main class for graph retrieval with cognitive-science based strategies
 * 
 * This class implements retrieval methods that mirror human memory access patterns,
 * including weighted relationship traversal, context-enhanced relationships,
 * and various retrieval strategies like spreading activation and targeted search.
 */
export class Neo4jRetriever {
  private neo4jDriver: Neo4jDriver;
  
  constructor(neo4jDriver: Neo4jDriver) {
    this.neo4jDriver = neo4jDriver;
    console.error('Neo4jRetriever initialized with cognitive-science based retrieval strategies');
  }
  
  /**
   * Loads graph data for the specified node name and its connections
   * 
   * @param nodeName Name of the node to load connections for
   * @param depth Maximum traversal depth (default: 2)
   * @param minWeight Minimum relationship weight to include (0.0-1.0)
   * @returns Promise resolving to a KnowledgeGraph
   */
  async loadGraph(
    nodeName: string, 
    depth: number = 2, 
    minWeight: number = 0.0
  ): Promise<KnowledgeGraph> {
    return exploreContextWeighted(this.neo4jDriver, nodeName, depth, minWeight);
  }
  
  /**
   * Performs a robust search using multiple strategies
   * 
   * @param searchQuery Query string to search for
   * @returns Promise resolving to a KnowledgeGraph
   */
  async robustSearch(searchQuery: string): Promise<KnowledgeGraph> {
    return robustSearch(this.neo4jDriver, searchQuery);
  }
  
  /**
   * Searches for nodes with fuzzy matching by node type
   * 
   * @param searchTerms Search terms for different node types
   * @returns Promise resolving to a KnowledgeGraph
   */
  async searchNodesByType(
    searchTerms: {
      entities?: string[],
      concepts?: string[],
      events?: string[],
      attributes?: string[],
      propositions?: string[],
      emotions?: string[],
      agents?: string[],
      scientificInsights?: string[],
      laws?: string[],
      locations?: string[],
      thoughts?: string[],
      reasoningChains?: string[],
      reasoningSteps?: string[],
      personTraits?: string[],
      personalityTypes?: string[],
      emotionalDispositions?: string[],
      ethicalFrameworks?: string[],
      fuzzyThreshold?: number
    }
  ): Promise<KnowledgeGraph> {
    return searchNodesWithFuzzyMatching(this.neo4jDriver, searchTerms);
  }
  
  /**
   * Explores the context around a node with weighted relationship traversal
   * 
   * @param nodeName Name of the node to explore context around
   * @param options Configuration options for exploration
   * @returns Promise resolving to a KnowledgeGraph
   */
  async exploreContext(
    nodeName: string | string[],
    options: {
      maxNodes?: number,
      includeTypes?: string[],
      excludeTypes?: string[],
      maxDepth?: number,
      minWeight?: number,
      includeRelationships?: string[]
    } = {}
  ): Promise<KnowledgeGraph> {
    const maxDepth = options.maxDepth || 2;
    const minWeight = options.minWeight || 0.0;
    
    return exploreContextWeighted(
      this.neo4jDriver, 
      nodeName, 
      maxDepth, 
      minWeight,
      {
        maxNodes: options.maxNodes,
        includeTypes: options.includeTypes,
        excludeTypes: options.excludeTypes,
        includeRelationships: options.includeRelationships
      }
    );
  }
  
  /**
   * Finds conceptual associations between nodes
   * 
   * @param nodeName The central node to find associations for
   * @param options Configuration options
   * @returns Promise resolving to a KnowledgeGraph
   */
  async findConceptualAssociations(
    nodeName: string,
    options: {
      maxAssociations?: number,
      minSharedConnections?: number,
      nodeTypes?: string[]
    } = {}
  ): Promise<KnowledgeGraph> {
    return findConceptualAssociations(this.neo4jDriver, nodeName, options);
  }
  
  /**
   * Retrieves a temporal sequence of related events
   * 
   * @param startNodeName Name of the node to start from
   * @param direction Direction to explore: 'forward', 'backward', or 'both'
   * @param maxEvents Maximum number of events to retrieve
   * @param nodeTypes Types of nodes to include in the sequence
   * @returns Promise resolving to a KnowledgeGraph
   */
  async getTemporalSequence(
    startNodeName: string,
    direction: 'forward' | 'backward' | 'both' = 'both',
    maxEvents: number = 20,
    nodeTypes?: string[]
  ): Promise<KnowledgeGraph> {
    return getTemporalSequence(this.neo4jDriver, startNodeName, direction, maxEvents, nodeTypes);
  }
  
  /**
   * Finds gaps in temporal knowledge
   * 
   * @param domainFilter Optional domain to filter by
   * @param limit Maximum number of gaps to return
   * @returns Promise resolving to a KnowledgeGraph
   */
  async findTemporalGaps(
    domainFilter?: string,
    limit: number = 10
  ): Promise<KnowledgeGraph> {
    return findTemporalGaps(this.neo4jDriver, domainFilter, limit);
  }
  
  /**
   * Traces causal chains in the knowledge graph
   * 
   * @param startNode Optional starting node
   * @param maxLength Maximum length of causal chains to retrieve
   * @param includeProbable Whether to include probable causal relationships
   * @returns Promise resolving to a KnowledgeGraph
   */
  async traceCausalChains(
    startNode?: string,
    maxLength: number = 5,
    includeProbable: boolean = true
  ): Promise<KnowledgeGraph> {
    return traceCausalChains(this.neo4jDriver, startNode, maxLength, includeProbable);
  }
  
  /**
   * Finds the shortest cognitive path between two nodes
   * 
   * @param startNodeName Name of the start node
   * @param endNodeName Name of the end node
   * @param options Configuration options
   * @returns Promise resolving to a KnowledgeGraph
   */
  async findCognitivePath(
    startNodeName: string,
    endNodeName: string,
    options: {
      maxPathLength?: number,
      includeTypes?: string[]
    } = {}
  ): Promise<KnowledgeGraph> {
    return findCognitivePath(this.neo4jDriver, startNodeName, endNodeName, options);
  }
  
  /**
   * Retrieves a reasoning chain by name
   * 
   * @param chainName Name of the reasoning chain
   * @returns Promise resolving to a KnowledgeGraph
   */
  async getReasoningChain(chainName: string): Promise<KnowledgeGraph> {
    return getReasoningChain(this.neo4jDriver, chainName);
  }
  
  /**
   * Gets details for a reasoning step
   * 
   * @param stepName Name of the reasoning step
   * @returns Promise resolving to a KnowledgeGraph
   */
  async getReasoningStepDetails(stepName: string): Promise<KnowledgeGraph> {
    return getReasoningStepDetails(this.neo4jDriver, stepName);
  }
  
  /**
   * Finds reasoning chains with similar conclusions
   * 
   * @param topic Topic or conclusion to search for
   * @param limit Maximum number of chains to return
   * @returns Promise resolving to a KnowledgeGraph
   */
  async findReasoningChainsWithSimilarConclusion(
    topic: string,
    limit: number = 5
  ): Promise<KnowledgeGraph> {
    return findReasoningChainsWithSimilarConclusion(this.neo4jDriver, topic, limit);
  }
  
  /**
   * Gets analytics about reasoning in the knowledge graph
   * 
   * @param filter Optional filter to limit analysis
   * @returns Promise resolving to a KnowledgeGraph
   */
  async getReasoningAnalytics(
    filter?: { domain?: string, methodology?: string }
  ): Promise<KnowledgeGraph> {
    return getReasoningAnalytics(this.neo4jDriver, filter);
  }
} 