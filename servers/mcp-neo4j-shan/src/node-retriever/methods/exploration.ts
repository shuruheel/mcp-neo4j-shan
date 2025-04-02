import { Driver as Neo4jDriver } from 'neo4j-driver';
import { KnowledgeGraph, Entity, Relation } from '../../types/index.js';
import { processSearchResults, vectorSearch } from './search.js';

/**
 * Explores the context around a node using vector embeddings and relationships
 * 
 * @param neo4jDriver - Neo4j driver instance
 * @param nodeName - The name of the node to explore context around
 * @param maxDepth - Maximum number of relationship hops to traverse (default: 2)
 * @param options - Additional options for exploration
 * @returns A promise resolving to a KnowledgeGraph with nodes and relationships
 */
export async function exploreContextWeighted(
  neo4jDriver: Neo4jDriver, 
  nodeName: string | string[], 
  maxDepth: number = 2, 
  minWeight: number = 0.0,
  options: {
    maxNodes?: number,
    includeTypes?: string[],
    excludeTypes?: string[],
    includeRelationships?: string[],
    threshold?: number
  } = {}
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  // Handle case where nodeName is an array
  const nodeNames = Array.isArray(nodeName) ? nodeName : [nodeName];
  
  // Set default options
  const maxNodes = Math.floor(options.maxNodes || 50); // Ensure integer value for LIMIT
  const threshold = options.threshold || 0.75;
  
  try {
    console.error(`Exploring context for: ${nodeNames.join(', ')}`);
    
    // First find the starting nodes - prioritize exact matches
    const findNodesQuery = `
      // Find nodes by exact name match
      MATCH (n)
      WHERE n.name IN $nodeNames
      RETURN n
    `;
    
    const exactMatchResult = await session.executeRead(tx => 
      tx.run(findNodesQuery, { nodeNames })
    );
    
    let startNodes = exactMatchResult.records.map(record => record.get('n'));
    
    // If no exact matches, use vector search
    if (startNodes.length === 0) {
      console.error('No exact name matches found, using vector search');
      
      // Generate embedding for search
      const { generateQueryEmbedding } = await import('./search.js');
      const queryEmbedding = await generateQueryEmbedding(nodeNames.join(' '));
      
      const searchResults = await vectorSearch(
        neo4jDriver, 
        queryEmbedding, 
        undefined,
        27, // Use hardcoded value for LIMIT
        threshold
      );
      
      if (searchResults.entities.length === 0) {
        console.error('No nodes found in the knowledge graph matching the search criteria');
        return { entities: [], relations: [] };
      }
      
      // Get the found nodes from Neo4j to use as start nodes
      const matchedNodeNames = searchResults.entities.map(entity => entity.name);
      const vectorMatchResult = await session.executeRead(tx => 
        tx.run(`
          MATCH (n)
          WHERE n.name IN $matchedNodeNames
          RETURN n
        `, { matchedNodeNames })
      );
      
      startNodes = vectorMatchResult.records.map(record => record.get('n'));
    }
    
    console.error(`Found ${startNodes.length} starting nodes`);
    
    // Get relationship filter if provided
    const relationshipFilter = options.includeRelationships && options.includeRelationships.length > 0
      ? options.includeRelationships.join('|')
      : '>'; // Default to all outgoing relationships
    
    // Generate type filters
    const includeTypes = options.includeTypes || [];
    const excludeTypes = options.excludeTypes || [];
    let labelFilter = '';
    
    // Add include filters
    if (includeTypes.length > 0) {
      labelFilter += includeTypes.map(type => `+${type}`).join('|');
    }
    
    // Add exclude filters
    if (excludeTypes.length > 0) {
      if (labelFilter) labelFilter += '|';
      labelFilter += excludeTypes.map(type => `-${type}`).join('|');
    }
    
    if (!labelFilter) {
      labelFilter = ''; // No default label filter
    }
    
    // Extract node IDs from startNodes instead of passing node objects directly
    const startNodeIds = startNodes.map(node => node.identity);
    
    // Get context using subgraph expansion with node IDs
    const result = await session.executeRead(tx => tx.run(`
      // First, get the nodes by their IDs
      MATCH (startNode)
      WHERE id(startNode) IN $startNodeIds
      
      // Use subgraphAll to get a complete subgraph with all relationships
      CALL apoc.path.subgraphAll(startNode, {
        relationshipFilter: $relationshipFilter,
        labelFilter: $labelFilter,
        maxLevel: $maxDepth,
        limit: 27
      })
      YIELD nodes, relationships
      
      // Filter relationships by weight if specified
      WITH 
        nodes,
        [rel IN relationships WHERE coalesce(rel.weight, 0.5) >= $minWeight] AS filteredRels
      
      // Process each node to get related information
      UNWIND nodes as node
      
      // Return node with outgoing and incoming relationships
      WITH DISTINCT node, filteredRels
      
      RETURN 
        node as entity,
        [rel IN filteredRels WHERE startNode(rel) = node] as relations,
        [rel IN filteredRels WHERE endNode(rel) = node] as inRelations
    `, { 
      startNodeIds,
      relationshipFilter,
      labelFilter,
      maxDepth,
      maxNodes,
      minWeight
    }));
    
    console.error(`Context exploration found ${result.records.length} nodes`);
    
    // Process the subgraph results
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error exploring context: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Find conceptual associations between nodes based on sharing common connections
 * or semantic similarity using vector embeddings
 */
export async function findConceptualAssociations(
  neo4jDriver: Neo4jDriver,
  nodeName: string,
  options: {
    maxAssociations?: number,
    minSharedConnections?: number,
    nodeTypes?: string[],
    threshold?: number
  } = {}
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  // Set default options
  const maxAssociations = options.maxAssociations || 10;
  const minSharedConnections = options.minSharedConnections || 1;
  const threshold = options.threshold || 0.75;
  const nodeTypes = options.nodeTypes || [
    'Entity', 'Concept', 'Event', 'ScientificInsight', 
    'Law', 'Thought', 'ReasoningChain', 'ReasoningStep',
    'Attribute', 'Proposition', 'Emotion', 'Agent'
  ];
  
  try {
    console.error(`Finding conceptual associations for node: ${nodeName}`);
    
    // First find the node to get its properties
    const findNodeResult = await session.executeRead(tx => tx.run(`
      MATCH (source {name: $nodeName})
      RETURN source
    `, { nodeName }));
    
    if (findNodeResult.records.length === 0) {
      console.error(`Node not found: ${nodeName}`);
      return { entities: [], relations: [] };
    }
    
    const sourceNode = findNodeResult.records[0].get('source');
    const nodeType = sourceNode.properties.nodeType;
    
    // Get the corresponding vector index based on the node type
    const vectorIndex = getVectorIndexForNodeType(nodeType);
    
    // First get the embedding from the node
    const embeddingResult = await session.executeRead(tx => tx.run(`
      MATCH (n {name: $nodeName})
      RETURN n.embedding as embedding
    `, { nodeName }));
    
    const embedding = embeddingResult.records[0]?.get('embedding');
    
    // Check if we found an embedding
    if (!embedding) {
      console.error(`Error: Node '${nodeName}' doesn't have an embedding vector. Cannot perform vector search.`);
      // Return empty result if no embedding is found
      return { entities: [], relations: [] };
    }
    
    console.error(`Found embedding for node '${nodeName}', using for vector search`);
    
    // Use the embedding for vector search
    const result = await session.executeRead(tx => tx.run(`
      // Use vector search based on node similarity with embedding
      CALL db.index.vector.queryNodes($vectorIndex, $maxAssociations, $nodeEmbedding)
      YIELD node, score
      WHERE score >= $threshold AND node.name <> $nodeName
      
      // Keep only nodes with specified types
      WITH node, score
      WHERE (${nodeTypes.map(type => `node:${type}`).join(' OR ')})
      
      // Get relationships
      OPTIONAL MATCH (node)-[outRel]->(connected)
      WITH node, score, collect(outRel) as outRels
      
      OPTIONAL MATCH (other)-[inRel]->(node)
      
      // Return results
      RETURN 
        node as entity, 
        outRels as relations,
        collect(inRel) as inRelations,
        score as associationStrength
      ORDER BY associationStrength DESC
      LIMIT 27
    `, {
      nodeName,
      vectorIndex,
      nodeEmbedding: embedding,
      maxAssociations,
      threshold
    }));
    
    console.error(`Found ${result.records.length} conceptual associations using vector similarity`);
    
    // If not enough results from vector search, find associated nodes through shared connections
    if (result.records.length < maxAssociations) {
      const remainingCount = maxAssociations - result.records.length;
      console.error(`Looking for ${remainingCount} more associations through shared connections`);
      
      const sharedConnectionResult = await session.executeRead(tx => tx.run(`
        // Start with the source node
        MATCH (source:Memory {name: $nodeName})
        
        // Find all nodes that share connections with the source node
        MATCH (source)-[r1]-(shared)-[r2]-(association:Memory)
        WHERE association <> source
          AND (${nodeTypes.map(type => `association:${type}`).join(' OR ')})
        
        // Group by association and count shared connections
        WITH association, collect(DISTINCT shared) AS sharedNodes, count(DISTINCT shared) AS sharedCount
        WHERE sharedCount >= $minSharedConnections
        
        // Get relationships for the associated nodes
        OPTIONAL MATCH (association)-[outRel]->(connected)
        WITH association, sharedNodes, sharedCount, collect(outRel) as outRels
        
        OPTIONAL MATCH (other)-[inRel]->(association)
        
        RETURN 
          association as entity, 
          outRels as relations,
          collect(inRel) as inRelations,
          sharedCount as associationStrength,
          [node in sharedNodes | node.name] as sharedConcepts
        ORDER BY associationStrength DESC
        LIMIT 27
      `, {
        nodeName,
        minSharedConnections
        // We're not using remainingCount in the query anymore since we're using a hardcoded LIMIT
      }));
      
      console.error(`Found ${sharedConnectionResult.records.length} additional conceptual associations through shared connections`);
      
      // Combine results from both approaches
      const combinedResults = result.records.concat(sharedConnectionResult.records);
      return processSearchResults(combinedResults);
    }
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error finding conceptual associations: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Find the shortest path between two nodes
 */
export async function findCognitivePath(
  neo4jDriver: Neo4jDriver,
  startNodeName: string,
  endNodeName: string,
  options: {
    maxPathLength?: number,
    includeTypes?: string[]
  } = {}
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  // Set default options
  const maxPathLength = options.maxPathLength || 5;
  const includeTypes = options.includeTypes || [
    'Entity', 'Concept', 'Event', 'ScientificInsight', 
    'Law', 'Thought', 'ReasoningChain', 'ReasoningStep',
    'Attribute', 'Proposition', 'Emotion', 'Agent'
  ];
  
  try {
    console.error(`Finding path from "${startNodeName}" to "${endNodeName}"`);
    
    const typeFilter = includeTypes.map(type => `node:${type}`).join(' OR ');
    
    const result = await session.executeRead(tx => tx.run(`
      // Find start and end nodes
      MATCH (start:Memory {name: $startNodeName})
      MATCH (end:Memory {name: $endNodeName})
      
      // Find shortest path
      CALL apoc.algo.dijkstra(
        start, 
        end, 
        null, // Use any relationship type
        "weight", 
        $maxPathLength
      ) YIELD path, weight
      
      // Ensure all nodes in path match the type filter
      WHERE all(node in nodes(path) WHERE (${typeFilter}))
      
      // Extract nodes and relationships from the path
      WITH nodes(path) as pathNodes, relationships(path) as pathRels, weight
      
      // Process each node
      UNWIND pathNodes as node
      
      WITH DISTINCT node, pathRels, weight
      
      // Get outgoing relationships from this node
      WITH node, pathRels, weight,
           [rel IN pathRels WHERE startNode(rel) = node] as outRels
      
      // Get incoming relationships to this node
      WITH node, outRels, weight,
           [rel IN pathRels WHERE endNode(rel) = node] as inRels
      
      // Return node with its relationships
      RETURN 
        node as entity, 
        outRels as relations,
        inRels as inRelations,
        weight as pathCost
      ORDER BY id(node)  // Preserve path order
    `, {
      startNodeName,
      endNodeName,
      maxPathLength
    }));
    
    console.error(`Found cognitive path with ${result.records.length} nodes`);
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error finding cognitive path: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Helper function to get the appropriate vector index based on node type
 */
function getVectorIndexForNodeType(nodeType: string): string {
  switch (nodeType) {
    case 'Concept':
      return 'concept-embeddings';
    case 'Entity':
      return 'entity-embeddings';
    case 'Proposition':
      return 'proposition-embeddings';
    case 'ReasoningChain':
      return 'reasoningchain-embeddings';
    case 'Thought':
      return 'thought-embeddings';
    default:
      // Default to entity embeddings for unknown types
      return 'entity-embeddings';
  }
}