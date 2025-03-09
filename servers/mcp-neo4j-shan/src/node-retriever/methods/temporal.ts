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
    
    // Build relationship filter for APOC procedure based on direction
    let relationshipFilter = '';
    if (direction === 'forward') {
      relationshipFilter = 'FOLLOWS>|CAUSES>|NEXT>|AFTER>';
    } else if (direction === 'backward') {
      relationshipFilter = '<FOLLOWS|<CAUSES|<NEXT|<AFTER|PRECEDES>|CAUSED_BY>|PREVIOUS>|BEFORE>';
    } else { // both
      relationshipFilter = 'FOLLOWS>|CAUSES>|NEXT>|AFTER>|<FOLLOWS|<CAUSES|<NEXT|<AFTER|PRECEDES>|CAUSED_BY>|PREVIOUS>|BEFORE>';
    }
    
    // Use APOC path expansion procedure for more efficient and flexible path discovery
    const result = await session.executeRead(tx => tx.run(`
      // Start with the node by name
      MATCH (start:Memory {name: $startNodeName})
      
      // Use APOC path expansion with proper relationship filter
      CALL apoc.path.expandConfig(start, {
        relationshipFilter: $relationshipFilter,
        labelFilter: $labelFilter,
        uniqueness: "NODE_GLOBAL",
        minLevel: 1,
        maxLevel: 3
      }) YIELD path
      
      // Extract nodes from path
      WITH DISTINCT nodes(path) AS pathNodes
      UNWIND pathNodes AS node
      
      // Ensure node meets type criteria
      WHERE (${typeFilter})
      
      // Get temporal relationship to start node
      OPTIONAL MATCH (start)-[r1:FOLLOWS|PRECEDES|CAUSED_BY|CAUSES|NEXT|PREVIOUS|BEFORE|AFTER]->(node)
      OPTIONAL MATCH (node)-[r2:FOLLOWS|PRECEDES|CAUSED_BY|CAUSES|NEXT|PREVIOUS|BEFORE|AFTER]->(start)
      
      // Calculate time position relative to start node
      WITH start, node,
           CASE 
             WHEN (start)-[:FOLLOWS]->(node) THEN -1
             WHEN (node)-[:FOLLOWS]->(start) THEN 1
             WHEN (start)-[:PRECEDES]->(node) THEN 1
             WHEN (node)-[:PRECEDES]->(start) THEN -1
             WHEN (start)-[:CAUSED_BY]->(node) THEN -1
             WHEN (node)-[:CAUSED_BY]->(start) THEN 1
             WHEN (start)-[:CAUSES]->(node) THEN 1
             WHEN (node)-[:CAUSES]->(start) THEN -1
             WHEN (start)-[:NEXT]->(node) THEN 1
             WHEN (node)-[:NEXT]->(start) THEN -1
             WHEN (start)-[:PREVIOUS]->(node) THEN -1
             WHEN (node)-[:PREVIOUS]->(start) THEN 1
             WHEN (start)-[:BEFORE]->(node) THEN -1
             WHEN (node)-[:BEFORE]->(start) THEN 1
             WHEN (start)-[:AFTER]->(node) THEN 1
             WHEN (node)-[:AFTER]->(start) THEN -1
             // If no direct relationship, calculate based on timestamps or dates if available
             WHEN node.timestamp IS NOT NULL AND start.timestamp IS NOT NULL THEN
               CASE WHEN node.timestamp > start.timestamp THEN 1 ELSE -1 END
             WHEN node.startDate IS NOT NULL AND start.startDate IS NOT NULL THEN
               CASE WHEN node.startDate > start.startDate THEN 1 ELSE -1 END
             ELSE 0
           END as sequenceOrder
      
      // Order by temporal sequence
      ORDER BY sequenceOrder
      LIMIT $maxEvents
      
      // Get relationships for each node
      WITH node, sequenceOrder
      OPTIONAL MATCH (node)-[outRel]->(connected)
      WITH node, sequenceOrder, collect(outRel) as outRels
      
      OPTIONAL MATCH (other)-[inRel]->(node)
      
      // Return nodes with their relationships
      RETURN 
        node as entity,
        outRels as relations,
        collect(inRel) as inRelations,
        sequenceOrder
      ORDER BY sequenceOrder
    `, {
      startNodeName,
      maxEvents,
      relationshipFilter,
      labelFilter: '+' + nodeTypes.join('|')
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
      WHERE NOT exists((event)-[:BEFORE|AFTER|FOLLOWS|PRECEDES|NEXT|PREVIOUS|CAUSES|CAUSED_BY]->()) 
        AND NOT exists(()-[:BEFORE|AFTER|FOLLOWS|PRECEDES|NEXT|PREVIOUS|CAUSES|CAUSED_BY]->(event))
        ${domainCondition}
      
      // Check if event has timestamp/date properties but no temporal relationships
      WITH event,
           (event.timestamp IS NULL AND event.startDate IS NULL) AS missingDateInfo
      
      // Order by those missing both relationships and date properties first
      ORDER BY missingDateInfo DESC
      LIMIT $limit
      
      // Get relationships for these events
      WITH event
      OPTIONAL MATCH (event)-[outRel]->(connected)
      WITH event, collect(outRel) as outRels
      
      OPTIONAL MATCH (other)-[inRel]->(event)
      
      RETURN 
        event as entity,
        outRels as relations,
        collect(inRel) as inRelations
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
    let params: any = { 
      maxLength, 
      minWeight: includeProbable ? 0.3 : 0.7,
      relationshipFilter: "CAUSES>|INFLUENCES>"
    };
    
    if (startNode) {
      // For specific start node using APOC path expansion
      query = `
        // Start with specified node
        MATCH (start:Memory {name: $startNode})
        
        // Find causal chains using path expansion
        CALL apoc.path.expandConfig(start, {
          relationshipFilter: $relationshipFilter,
          minLevel: 1,
          maxLevel: $maxLength,
          uniqueness: "NODE_GLOBAL"
        }) YIELD path
        
        // Filter by relationship weight if needed
        WHERE all(rel in relationships(path) WHERE rel.weight >= $minWeight)
        
        // Get path strength (product of weights)
        WITH path,
             reduce(s = 1.0, rel in relationships(path) | s * coalesce(rel.weight, 0.5)) as chainStrength,
             length(path) as chainLength
        
        // Order by strength and length
        ORDER BY chainStrength DESC, chainLength DESC
        
        // Extract nodes and relationships
        WITH nodes(path) as pathNodes
        UNWIND pathNodes as node
        
        // Process each node
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
             reduce(s = 1.0, rel in relationships(path) | s * coalesce(rel.weight, 0.5)) as chainStrength,
             length(path) as chainLength
        ORDER BY chainStrength DESC, chainLength DESC
        LIMIT 10
        
        // Extract nodes and relationships
        WITH nodes(path) as pathNodes
        UNWIND pathNodes as node
        
        // Process each node
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