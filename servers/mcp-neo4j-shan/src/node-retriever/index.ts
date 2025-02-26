import { Driver as Neo4jDriver } from 'neo4j-driver';
import { KnowledgeGraph, Entity } from '../types/index.js';

// Import method implementations from separate files
import { 
  robustSearch,
  searchNodes,
  searchNodesWithFuzzyMatching,
  processSearchResults
} from './methods/search.js';

import {
  exploreContextWeighted,
  exploreContext
} from './methods/exploration.js';

import {
  getTemporalSequence
} from './methods/temporal.js';

import {
  getReasoningChain,
  getReasoningChainsForThought,
  getReasoningStepDetails,
  findReasoningChainsWithSimilarConclusion,
  getReasoningAnalytics
} from './methods/reasoning.js';

/**
 * Neo4jRetriever - Graph retrieval functionality optimized for cognitive science principles
 * 
 * This class implements knowledge graph traversal and retrieval strategies based on
 * cognitive science principles. The key features include:
 * 
 * 1. Weighted Relationship Traversal - Relationships with higher weights are traversed
 *    first, prioritizing the most significant cognitive connections and mimicking how
 *    human memory retrieves information by importance
 * 
 * 2. Relationship Categorization - Supports different types of relationships:
 *    - Hierarchical (taxonomic, parent-child)
 *    - Lateral (associative, similarity-based)
 *    - Temporal (sequential, causal)
 *    - Compositional (part-whole, component relationships)
 * 
 * 3. Context-Enhanced Relationships - Includes rich contextual information and memory
 *    aids to support recall and comprehension
 * 
 * 4. Temporal Sequence Retrieval - Specialized traversal for time-based relationships
 * 
 * The implementation uses Neo4j's path traversal with custom cost functions based on 
 * relationship weights, making stronger relationships "cheaper" to traverse while making
 * weak relationships "expensive", effectively prioritizing the retrieval of the most
 * cognitively significant paths.
 */
export class Neo4jRetriever {
  /**
   * Creates a new Neo4jRetriever instance
   * @param neo4jDriver - Neo4j driver instance
   */
  constructor(private neo4jDriver: Neo4jDriver) { }

  /**
   * Private helper method to load graph from Neo4j
   */
  private async loadGraph(): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
  
    try {
      // Execute a Cypher statement in a Read Transaction that matches all node types
      const res = await session.executeRead(tx => tx.run(`
        MATCH (entity)
        WHERE entity:Entity OR entity:Event OR entity:Concept OR entity:ScientificInsight OR entity:Law OR entity:Thought
        OPTIONAL MATCH (entity)-[r]->(other)
        RETURN entity, collect(r) as relations
      `));
      
      const entities: Entity[] = [];
      const relations: any[] = [];
      
      for (const row of res.records) {
        const entityNode = row.get('entity');
        const entityRelationships = row.get('relations');

        // Convert Neo4j node to Entity format
        const entity: Entity = {
          name: entityNode.properties.name,
          entityType: entityNode.properties.nodeType || 'Entity',
          observations: 'observations' in entityNode.properties ? 
            entityNode.properties.observations : []
        };

        entities.push(entity);
        
        // Add relations
        for (const rel of entityRelationships) {
          relations.push(rel.properties);
        }
      }

      console.error(`Loaded ${entities.length} entities and ${relations.length} relations`);
      return { entities, relations };
    } catch (error) {
      console.error('Error loading graph:', error);
      return { entities: [], relations: [] };
    }
    finally {
      // Close the Session
      await session.close();
    }
  }

  /**
   * Performs a robust search across the knowledge graph
   * @param searchQuery - The search query
   * @returns Knowledge graph with matching nodes and relations
   */
  async robustSearch(searchQuery: string): Promise<KnowledgeGraph> {
    return robustSearch(this.neo4jDriver, searchQuery);
  }

  /**
   * Explores the context around a node with weighted relationships
   * @param nodeName - Name of the node to explore
   * @param maxDepth - Maximum depth to explore
   * @param minWeight - Minimum weight of relationships to include
   * @returns Knowledge graph with the node and its context
   */
  async exploreContextWeighted(
    nodeName: string,
    maxDepth: number = 2,
    minWeight: number = 0.0
  ): Promise<KnowledgeGraph> {
    return exploreContextWeighted(this.neo4jDriver, nodeName, maxDepth, minWeight);
  }

  /**
   * Explores the context around a node (deprecated)
   * @param nodeName - Name of the node to explore
   * @param maxDepth - Maximum depth to explore
   * @returns Knowledge graph with the node and its context
   */
  async exploreContext(
    nodeName: string,
    maxDepth: number = 2
  ): Promise<KnowledgeGraph> {
    return exploreContext(this.neo4jDriver, nodeName, maxDepth);
  }

  /**
   * Searches for nodes by name or properties
   * @param query - Search query
   * @returns Knowledge graph with matching nodes
   */
  async searchNodes(query: string): Promise<KnowledgeGraph> {
    return searchNodes(this.neo4jDriver, query);
  }

  /**
   * Searches for nodes with fuzzy matching
   * @param searchTerms - Search terms for different node types
   * @returns Knowledge graph with matching nodes
   */
  async searchNodesWithFuzzyMatching(searchTerms: {
    entities?: string[],
    concepts?: string[],
    events?: string[],
    scientificInsights?: string[],
    laws?: string[],
    thoughts?: string[],
    reasoningChains?: string[],
    reasoningSteps?: string[],
    fuzzyThreshold?: number
  }): Promise<KnowledgeGraph> {
    return searchNodesWithFuzzyMatching(this.neo4jDriver, searchTerms);
  }

  /**
   * Gets a temporal sequence of events
   * @param startNodeName - Name of the starting node
   * @param direction - Direction of the sequence
   * @param maxEvents - Maximum number of events to retrieve
   * @returns Sequence of events and their connections
   */
  async getTemporalSequence(
    startNodeName: string,
    direction: 'forward' | 'backward' | 'both' = 'both',
    maxEvents: number = 10
  ): Promise<{ sequence: Entity[], connections: any[] }> {
    return getTemporalSequence(this.neo4jDriver, startNodeName, direction, maxEvents);
  }

  /**
   * Gets a reasoning chain by name
   * @param chainName - Name of the reasoning chain
   * @returns The chain and its steps
   */
  async getReasoningChain(chainName: string): Promise<{
    chain: any,
    steps: any[]
  }> {
    return getReasoningChain(this.neo4jDriver, chainName);
  }

  /**
   * Gets reasoning chains for a thought
   * @param thoughtName - Name of the thought
   * @returns The thought and its chains
   */
  async getReasoningChainsForThought(thoughtName: string): Promise<{
    thought: any,
    chains: any[]
  }> {
    return getReasoningChainsForThought(this.neo4jDriver, thoughtName);
  }

  /**
   * Gets details for a reasoning step
   * @param stepName - Name of the step
   * @returns The step and related information
   */
  async getReasoningStepDetails(stepName: string): Promise<{
    step: any,
    supportingReferences: any[],
    previousSteps: any[],
    nextSteps: any[]
  }> {
    return getReasoningStepDetails(this.neo4jDriver, stepName);
  }

  /**
   * Finds reasoning chains with similar conclusions
   * @param conclusion - The conclusion to match
   * @param limit - Maximum number of chains to return
   * @returns Array of matching chains
   */
  async findReasoningChainsWithSimilarConclusion(
    conclusion: string,
    limit: number = 5
  ): Promise<any[]> {
    return findReasoningChainsWithSimilarConclusion(this.neo4jDriver, conclusion, limit);
  }

  /**
   * Gets analytics about reasoning in the knowledge graph
   * @returns Analytics data
   */
  async getReasoningAnalytics(): Promise<{
    totalChains: number,
    totalSteps: number,
    methodologyDistribution: Record<string, number>,
    averageStepsPerChain: number,
    topChainsByStepCount: any[]
  }> {
    return getReasoningAnalytics(this.neo4jDriver);
  }
} 