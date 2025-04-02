import { Driver as Neo4jDriver } from 'neo4j-driver';
import { KnowledgeGraph } from '../types/index.js';
import { 
  robustSearch, 
  vectorSearch,
  searchNodesWithVectorEmbeddings
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
 * Neo4jRetriever: Main class for graph retrieval using vector embeddings
 * 
 * This class implements efficient retrieval methods using Neo4j's vector search capabilities,
 * combined with graph traversal for comprehensive knowledge exploration.
 */
export class Neo4jRetriever {
  private neo4jDriver: Neo4jDriver;
  
  constructor(neo4jDriver: Neo4jDriver) {
    this.neo4jDriver = neo4jDriver;
    console.error('Neo4jRetriever initialized with vector embedding-based retrieval strategies');
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
   * Performs a search using vector embeddings
   * 
   * @param searchQuery Query string to search for
   * @returns Promise resolving to a KnowledgeGraph
   */
  async robustSearch(searchQuery: string): Promise<KnowledgeGraph> {
    try {
      console.error(`Generating embedding for search query: ${searchQuery}`);
      const { generateQueryEmbedding } = await import('./methods/search.js');
      const queryEmbedding = await generateQueryEmbedding(searchQuery);
      return robustSearch(this.neo4jDriver, queryEmbedding);
    } catch (error) {
      console.error(`Error in robustSearch: ${error}`);
      throw error;
    }
  }
  
  /**
   * Performs a targeted vector search for a specific node type
   * 
   * @param searchQuery Query string to search for
   * @param nodeType Type of node to search for
   * @param limit Maximum number of results to return
   * @param threshold Similarity threshold (0-1)
   * @returns Promise resolving to a KnowledgeGraph
   */
  async vectorSearch(
    searchQuery: string,
    nodeType?: string,
    limit: number = 10,
    threshold: number = 0.75
  ): Promise<KnowledgeGraph> {
    try {
      console.error(`Generating embedding for vector search: ${searchQuery}`);
      const { generateQueryEmbedding } = await import('./methods/search.js');
      const queryEmbedding = await generateQueryEmbedding(searchQuery);
      return vectorSearch(this.neo4jDriver, queryEmbedding, nodeType, limit, threshold);
    } catch (error) {
      console.error(`Error in vectorSearch: ${error}`);
      throw error;
    }
  }
  
  /**
   * Searches for nodes by type with vector embeddings
   * 
   * @param searchTerms Search terms for different node types
   * @returns Promise resolving to a KnowledgeGraph
   */
  async searchNodesByType(
    searchTerms: {
      entities?: string,
      concepts?: string,
      persons?: string,
      propositions?: string,
      reasoningChains?: string,
      thoughts?: string,
      limit?: number,
      threshold?: number
    }
  ): Promise<KnowledgeGraph> {
    return searchNodesWithVectorEmbeddings(this.neo4jDriver, searchTerms);
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
      includeRelationships?: string[],
      threshold?: number
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
        includeRelationships: options.includeRelationships,
        threshold: options.threshold
      }
    );
  }
  
  /**
   * Finds conceptual associations between nodes using vector similarity
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
      nodeTypes?: string[],
      threshold?: number
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
   * @param threshold Similarity threshold for vector search
   * @returns Promise resolving to a KnowledgeGraph
   */
  async traceCausalChains(
    startNode?: string,
    maxLength: number = 5,
    threshold: number = 0.75
  ): Promise<KnowledgeGraph> {
    return traceCausalChains(this.neo4jDriver, startNode, maxLength, threshold);
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