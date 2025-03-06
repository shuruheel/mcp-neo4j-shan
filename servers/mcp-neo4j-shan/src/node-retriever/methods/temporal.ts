import { Driver as Neo4jDriver } from 'neo4j-driver';
import { Entity, Relation, EnhancedRelation } from '../../types/index.js';
import { KnowledgeGraph } from '../../types/index.js';
import { processSearchResults } from './search.js';

/**
 * Retrieves a temporal sequence of related events and concepts starting from a given node.
 * This implements the feature to visualize temporal sequences based on cognitive science principles.
 * 
 * @param neo4jDriver - Neo4j driver instance
 * @param startNodeName - The name of the node to start the temporal sequence from
 * @param direction - The direction of the temporal sequence: 'forward' (later events), 'backward' (earlier events), or 'both'
 * @param maxEvents - Maximum number of events to retrieve in the sequence
 * @param nodeTypes - Types of nodes to include in the sequence (default: all types)
 * @returns A promise resolving to a KnowledgeGraph with the temporal sequence
 */
export async function getTemporalSequence(
  neo4jDriver: Neo4jDriver,
  startNodeName: string, 
  direction: 'forward' | 'backward' | 'both' = 'both',
  maxEvents: number = 20,
  nodeTypes: string[] = [
    'Event', 'Concept', 'Entity', 'ScientificInsight', 
    'Law', 'Thought', 'ReasoningChain', 'ReasoningStep',
    'Attribute', 'Proposition', 'Emotion', 'Agent'
  ]
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Finding temporal sequence from "${startNodeName}" in direction: ${direction}`);
    
    // Generate type filter
    const typeFilter = nodeTypes.map(type => `node:${type}`).join(' OR ');
    
    // Build relationship pattern based on direction
    let relationshipPattern = '';
    if (direction === 'forward' || direction === 'both') {
      relationshipPattern += '(start)-[:FOLLOWS|PRECEDES|CAUSED_BY|CAUSES|NEXT|PREVIOUS|BEFORE|AFTER]->(node)';
    }
    if (direction === 'backward' || direction === 'both') {
      if (relationshipPattern) relationshipPattern += ' OR ';
      relationshipPattern += '(node)-[:FOLLOWS|PRECEDES|CAUSED_BY|CAUSES|NEXT|PREVIOUS|BEFORE|AFTER]->(start)';
    }
    
    // Query to find the temporal sequence
    const result = await session.executeRead(tx => tx.run(`
      // Start with the node by name
      MATCH (start:Memory {name: $startNodeName})
      
      // Find connected nodes with temporal relationships
      MATCH (related:Memory)
      WHERE ${relationshipPattern}
      AND (${typeFilter.replace(/node/g, 'related')})
      
      // Get relationship properties for proper sequencing
      WITH start, related,
           CASE 
             WHEN (start)-[:FOLLOWS]->(related) THEN 1
             WHEN (related)-[:FOLLOWS]->(start) THEN -1
             WHEN (start)-[:PRECEDES]->(related) THEN -1
             WHEN (related)-[:PRECEDES]->(start) THEN 1
             WHEN (start)-[:CAUSED_BY]->(related) THEN -1
             WHEN (related)-[:CAUSED_BY]->(start) THEN 1
             WHEN (start)-[:CAUSES]->(related) THEN 1
             WHEN (related)-[:CAUSES]->(start) THEN -1
             WHEN (start)-[:NEXT]->(related) THEN 1
             WHEN (related)-[:NEXT]->(start) THEN -1
             WHEN (start)-[:PREVIOUS]->(related) THEN -1
             WHEN (related)-[:PREVIOUS]->(start) THEN 1
             WHEN (start)-[:BEFORE]->(related) THEN -1
             WHEN (related)-[:BEFORE]->(start) THEN 1
             WHEN (start)-[:AFTER]->(related) THEN 1
             WHEN (related)-[:AFTER]->(start) THEN -1
             ELSE 0
           END as sequenceOrder
      
      // Order by temporal sequence
      ORDER BY sequenceOrder
      LIMIT $maxEvents
      
      // Get relationships for each node
      WITH start, related, sequenceOrder
      OPTIONAL MATCH (related)-[outRel]->(connected)
      WITH related, sequenceOrder, collect(outRel) as outRels
      
      OPTIONAL MATCH (other)-[inRel]->(related)
      
      // Return nodes with their relationships
      RETURN 
        related as entity,
        outRels as relations,
        collect(inRel) as inRelations,
        sequenceOrder
      ORDER BY sequenceOrder
    `, {
      startNodeName,
      maxEvents
    }));
    
    console.error(`Found ${result.records.length} nodes in temporal sequence`);
    
    // Also include the start node in the results
    const startNodeResult = await session.executeRead(tx => tx.run(`
      MATCH (start:Memory {name: $startNodeName})
      
      OPTIONAL MATCH (start)-[outRel]->(connected)
      WITH start, collect(outRel) as outRels
      
      OPTIONAL MATCH (other)-[inRel]->(start)
      
      RETURN 
        start as entity,
        outRels as relations,
        collect(inRel) as inRelations,
        0 as sequenceOrder
    `, {
      startNodeName
    }));
    
    // Combine the results
    const combinedRecords = [...startNodeResult.records, ...result.records];
    
    return processSearchResults(combinedRecords);
  } catch (error) {
    console.error(`Error retrieving temporal sequence: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Analyzes temporal gaps in knowledge by identifying events without proper temporal context
 * 
 * @param neo4jDriver Neo4j driver instance
 * @param domainFilter Optional domain to filter events by
 * @param limit Maximum number of events to retrieve
 * @returns KnowledgeGraph with events that lack temporal context
 */
export async function findTemporalGaps(
  neo4jDriver: Neo4jDriver,
  domainFilter?: string,
  limit: number = 10
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Finding temporal gaps in knowledge${domainFilter ? ` for domain: ${domainFilter}` : ''}`);
    
    // Domain filter condition
    const domainCondition = domainFilter 
      ? 'AND (event.domain = $domainFilter OR exists((event)-[:RELATES_TO]->(:Concept {domain: $domainFilter})))' 
      : '';
    
    const result = await session.executeRead(tx => tx.run(`
      // Match events without temporal relationships
      MATCH (event:Event)
      WHERE NOT exists((event)-[:BEFORE|AFTER|FOLLOWS|PRECEDES|NEXT|PREVIOUS]->()) 
        AND NOT exists(()-[:BEFORE|AFTER|FOLLOWS|PRECEDES|NEXT|PREVIOUS]->(event))
        ${domainCondition}
      
      // Get relationships for these events
      WITH event
      OPTIONAL MATCH (event)-[outRel]->(connected)
      WITH event, collect(outRel) as outRels
      
      OPTIONAL MATCH (other)-[inRel]->(event)
      
      RETURN 
        event as entity,
        outRels as relations,
        collect(inRel) as inRelations
      LIMIT $limit
    `, {
      domainFilter,
      limit
    }));
    
    console.error(`Found ${result.records.length} events with temporal gaps`);
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error finding temporal gaps: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Identifies causal chains in the knowledge graph
 * 
 * Traces cause-effect relationships across multiple nodes to identify
 * chains of causality, providing insight into complex causal structures.
 * 
 * @param neo4jDriver Neo4j driver instance
 * @param startNode Optional starting node for the causal chain
 * @param maxLength Maximum length of causal chains to retrieve
 * @param includeProbable Whether to include probable (lower confidence) causal relationships
 * @returns KnowledgeGraph with causal chains
 */
export async function traceCausalChains(
  neo4jDriver: Neo4jDriver,
  startNode?: string,
  maxLength: number = 5,
  includeProbable: boolean = true
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Tracing causal chains${startNode ? ` from: ${startNode}` : ''}`);
    
    // Build the query based on whether a start node is provided
    let query;
    let params: any = { maxLength, minWeight: includeProbable ? 0.3 : 0.7 };
    
    if (startNode) {
      // For specific start node
      query = `
        // Start with specified node
        MATCH (start:Memory {name: $startNode})
        
        // Find causal chains using path expansion
        CALL apoc.path.expandConfig(start, {
          relationshipFilter: "CAUSES>|INFLUENCES>",
          minLevel: 1,
          maxLevel: $maxLength,
          uniqueness: "NODE_GLOBAL"
        }) YIELD path
        
        // Filter by relationship weight if needed
        WHERE all(rel in relationships(path) WHERE rel.weight >= $minWeight)
        
        // Extract nodes and relationships
        WITH nodes(path) as pathNodes, relationships(path) as pathRels
        
        // Process each node
        UNWIND pathNodes as node
        
        // Get all relationships for context
        WITH DISTINCT node
        OPTIONAL MATCH (node)-[outRel]->(connected)
        WITH node, collect(outRel) as outRels
        
        OPTIONAL MATCH (other)-[inRel]->(node)
        
        // Return as graph
        RETURN 
          node as entity,
          outRels as relations,
          collect(inRel) as inRelations
      `;
      params.startNode = startNode;
    } else {
      // For general causal chain discovery
      query = `
        // Find chains of causal relationships
        MATCH path = (start:Memory)-[:CAUSES|INFLUENCES*1..${maxLength}]->(end:Memory)
        WHERE all(rel in relationships(path) WHERE rel.weight >= $minWeight)
        
        // Calculate chain strength
        WITH path, 
             reduce(s = 1.0, rel in relationships(path) | s * rel.weight) as chainStrength,
             length(path) as chainLength
        ORDER BY chainStrength DESC, chainLength DESC
        LIMIT 10
        
        // Extract nodes and relationships
        WITH nodes(path) as pathNodes, relationships(path) as pathRels
        
        // Process each node
        UNWIND pathNodes as node
        
        // Get all relationships for context
        WITH DISTINCT node
        OPTIONAL MATCH (node)-[outRel]->(connected)
        WITH node, collect(outRel) as outRels
        
        OPTIONAL MATCH (other)-[inRel]->(node)
        
        // Return as graph
        RETURN 
          node as entity,
          outRels as relations,
          collect(inRel) as inRelations
      `;
    }
    
    const result = await session.executeRead(tx => tx.run(query, params));
    
    console.error(`Found ${result.records.length} nodes in causal chains`);
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error tracing causal chains: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
} 