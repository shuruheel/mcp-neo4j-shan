import { Driver as Neo4jDriver } from 'neo4j-driver';
import { Entity, Relation } from '../../types/index.js';
import { KnowledgeGraph } from '../../types/index.js';
import { processSearchResults, vectorSearch } from './search.js';

/**
 * Retrieves a temporal sequence of related events and concepts starting from a given node.
 * 
 * @param neo4jDriver - Neo4j driver instance
 * @param startNodeName - The name of the node to start the temporal sequence from
 * @param direction - The direction of the temporal sequence: 'forward' (later events), 'backward' (earlier events), or 'both'
 * @param maxEvents - DEPRECATED - Maximum number of events to retrieve (hardcoded to 27 internally)
 * @param nodeTypes - Types of nodes to include in the sequence (default: all types)
 * @returns A promise resolving to a KnowledgeGraph with the temporal sequence
 */
export async function getTemporalSequence(
  neo4jDriver: Neo4jDriver,
  startNodeName: string, 
  direction: 'forward' | 'backward' | 'both' = 'both',
  maxEvents: number = 27, // Keep parameter for API compatibility but use hardcoded limit
  nodeTypes: string[] = [
    'Event', 'Concept', 'Entity', 'ScientificInsight', 
    'Law', 'Thought', 'ReasoningChain', 'ReasoningStep',
    'Attribute', 'Proposition', 'Emotion', 'Agent'
  ]
): Promise<KnowledgeGraph> {
  // We use a hardcoded limit of 27 nodes for consistency
  const session = neo4jDriver.session();
  
  try {
    console.error(`Finding temporal sequence from "${startNodeName}" in direction: ${direction}`);
    
    // First check if the node exists by exact name
    const nodeCheck = await session.executeRead(tx => tx.run(`
      MATCH (n {name: $startNodeName})
      RETURN n
    `, { startNodeName }));
    
    if (nodeCheck.records.length === 0) {
      console.error(`No exact match for node: ${startNodeName}. Using vector search.`);
      
      // Generate embedding for the search term
      console.error(`Generating embedding for search term: ${startNodeName}`);
      
      try {
        // Import the embedding generator
        const { generateQueryEmbedding } = await import('./search.js');
        
        // Generate embedding for the search term
        const queryEmbedding = await generateQueryEmbedding(startNodeName);
        
        // Now we can perform vector search with the embedding
        const searchResult = await vectorSearch(
          neo4jDriver,
          queryEmbedding,
          undefined, // search across all indexes
          1,  // limit to top match
          0.75 // threshold
        );
        
        if (searchResult.entities.length === 0) {
          console.error(`No node found matching: ${startNodeName}`);
          return { entities: [], relations: [] };
        }
        
        // Use the best matching node name
        startNodeName = searchResult.entities[0].name;
        console.error(`Using best matching node: ${startNodeName}`);
      } catch (error) {
        console.error(`Error generating embedding: ${error}`);
        return { entities: [], relations: [] };
      }
      
    }
    
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
    
    // Use APOC path expansion procedure for efficient path discovery
    const result = await session.executeRead(tx => tx.run(`
      // Start with the node by name
      MATCH (start {name: $startNodeName})
      
      // Use APOC path expansion with temporal relationship filter
      CALL apoc.path.expandConfig(start, {
        relationshipFilter: $relationshipFilter,
        labelFilter: "",
        uniqueness: "NODE_GLOBAL",
        minLevel: 1,
        maxLevel: 3
      }) YIELD path
      
      // Extract nodes from path
      WITH DISTINCT nodes(path) AS pathNodes
      UNWIND pathNodes AS node
      WITH node
      
      // Ensure node meets type criteria
      WHERE (${typeFilter})
      
      // Get temporal relationship to start node
      WITH node, $startNodeName as startNodeName
      
      // Get relationships for each node
      OPTIONAL MATCH (node)-[outRel]->(connected)
      WITH node, collect(outRel) as outRels
      
      OPTIONAL MATCH (other)-[inRel]->(node)
      
      // Return nodes with their relationships
      RETURN 
        node as entity,
        outRels as relations,
        collect(inRel) as inRelations
      LIMIT 27
    `, {
      startNodeName,
      relationshipFilter
    }));
    
    console.error(`Found ${result.records.length} nodes in temporal sequence`);
    
    // If we didn't find any temporal relationships, try using timestamp or date properties
    if (result.records.length === 0) {
      console.error(`No temporal relationships found. Trying timestamp-based sequence.`);
      
      // Use vector embeddings to find semantically related events and sort by timestamp
      const timestampResult = await session.executeRead(tx => tx.run(`
        // Start with the node
        MATCH (start {name: $startNodeName})
        
        // Find the appropriate vector index for this node
        WITH start,
             CASE 
               WHEN start:Concept THEN 'concept-embeddings'
               WHEN start:Entity AND start.subType = 'Person' THEN 'person-embeddings' 
               WHEN start:Entity THEN 'entity-embeddings'
               WHEN start:Proposition THEN 'proposition-embeddings'
               WHEN start:ReasoningChain THEN 'reasoningchain-embeddings'
               WHEN start:Thought THEN 'thought-embeddings'
               ELSE 'entity-embeddings'
             END as indexName
        
        // Use vector search to find related nodes using embedding
        CALL db.index.vector.queryNodes(indexName, 27, start.embedding)
        YIELD node, score
        WHERE score >= 0.7
          AND node <> start
          AND (${typeFilter})
          AND (node.timestamp IS NOT NULL OR node.startDate IS NOT NULL)
        
        // Order by timestamp or date
        WITH node, score, 
          CASE 
            WHEN node.timestamp IS NOT NULL THEN node.timestamp
            WHEN node.startDate IS NOT NULL THEN node.startDate
            ELSE null
          END as timeValue
        WHERE timeValue IS NOT NULL
        
        // Order by time based on direction
        ORDER BY 
          CASE WHEN $direction = 'backward' THEN timeValue END DESC,
          CASE WHEN $direction IN ['forward', 'both'] THEN timeValue END ASC,
          score DESC
        
        // Get relationships for each node
        WITH node
        OPTIONAL MATCH (node)-[outRel]->(connected)
        WITH node, collect(outRel) as outRels
        
        OPTIONAL MATCH (other)-[inRel]->(node)
        
        // Return nodes with their relationships
        RETURN 
          node as entity,
          outRels as relations,
          collect(inRel) as inRelations
        LIMIT 27
      `, {
        startNodeName,
        direction
      }));
      
      if (timestampResult.records.length > 0) {
        console.error(`Found ${timestampResult.records.length} nodes using timestamp-based sequence`);
        
        return processSearchResults(timestampResult.records);
      }
    }
    
    // If we have results from the temporal traversal, include the start node in them
    if (result.records.length > 0) {
      // Get the start node and combine with the temporal sequence in a single transaction
      const combinedResult = await session.executeRead(tx => tx.run(`
        // First get the start node with its relationships
        MATCH (start {name: $startNodeName})
        
        OPTIONAL MATCH (start)-[outRel]->(connected)
        WITH start, collect(outRel) as outRels
        
        OPTIONAL MATCH (other)-[inRel]->(start)
        
        // Return start node as the first result
        RETURN 
          start as entity,
          outRels as relations,
          collect(inRel) as inRelations
      `, { startNodeName }));
      
      // Combine the results
      const combinedRecords = [...combinedResult.records, ...result.records];
      return processSearchResults(combinedRecords);
    }
    
    // Just return the start node if no sequence found
    const startNodeResult = await session.executeRead(tx => tx.run(`
      MATCH (start {name: $startNodeName})
      
      OPTIONAL MATCH (start)-[outRel]->(connected)
      WITH start, collect(outRel) as outRels
      
      OPTIONAL MATCH (other)-[inRel]->(start)
      
      RETURN 
        start as entity,
        outRels as relations,
        collect(inRel) as inRelations
    `, { startNodeName }));
    
    return processSearchResults(startNodeResult.records);
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
  // We'll use a hardcoded integer value (27) for Neo4j LIMIT clause
  const session = neo4jDriver.session();
  
  try {
    console.error(`Finding temporal gaps in knowledge${domainFilter ? ` for domain: ${domainFilter}` : ''}`);
    
    // Domain filter condition
    const domainCondition = domainFilter 
      ? 'AND (event.domain = $domainFilter OR exists((event)-[:RELATES_TO]->(:Concept {domain: $domainFilter})))' 
      : '';
    
    // Find events without temporal relationships or timestamp/date information
    const result = await session.executeRead(tx => tx.run(`
      // Match events without temporal relationships
      MATCH (event:Event)
      WHERE NOT exists((event)-[:BEFORE|AFTER|FOLLOWS|PRECEDES|NEXT|PREVIOUS|CAUSES|CAUSED_BY]->()) 
        AND NOT exists(()-[:BEFORE|AFTER|FOLLOWS|PRECEDES|NEXT|PREVIOUS|CAUSES|CAUSED_BY]->(event))
        ${domainCondition}
      
      // Check if event has timestamp/date properties
      WITH event,
           (event.timestamp IS NULL AND event.startDate IS NULL) AS missingDateInfo
      
      // Order by those missing both relationships and date properties first
      ORDER BY missingDateInfo DESC
      LIMIT 27
      
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
      domainFilter
      // Using hardcoded LIMIT 27 in the query instead of parameter
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
 * Identifies causal chains in the knowledge graph using vector embeddings and relationships
 * 
 * @param neo4jDriver Neo4j driver instance
 * @param startNode Optional starting node for the causal chain
 * @param maxLength Maximum length of causal chains to retrieve
 * @param threshold Similarity threshold for vector search
 * @returns KnowledgeGraph with causal chains
 */
export async function traceCausalChains(
  neo4jDriver: Neo4jDriver,
  startNode?: string,
  maxLength: number = 5,
  threshold: number = 0.75
): Promise<KnowledgeGraph> {
  // We'll use a fixed path length but keep the parameter for API compatibility
  const session = neo4jDriver.session();
  
  try {
    console.error(`Tracing causal chains${startNode ? ` from: ${startNode}` : ''}`);
    
    // If a start node is provided
    if (startNode) {
      // Check if node exists with exact name
      const nodeCheck = await session.executeRead(tx => tx.run(`
        MATCH (n {name: $startNode})
        RETURN n
      `, { startNode }));
      
      if (nodeCheck.records.length === 0) {
        console.error(`No exact match for node: ${startNode}. Using vector search.`);
        
        try {
          // Import the embedding generator
          const { generateQueryEmbedding } = await import('./search.js');
          
          // Generate embedding for the search term
          const queryEmbedding = await generateQueryEmbedding(startNode);
          
          // Now we can perform vector search with the embedding
          const searchResult = await vectorSearch(
            neo4jDriver,
            queryEmbedding,
            undefined, // search across all indexes
            1,  // limit to top match
            threshold
          );
        
          if (searchResult.entities.length === 0) {
            console.error(`No node found matching: ${startNode}`);
            return { entities: [], relations: [] };
          }
          
          // Use the best matching node name
          startNode = searchResult.entities[0].name;
          console.error(`Using best matching node: ${startNode}`);
        } catch (error) {
          console.error(`Error generating embedding: ${error}`);
          return { entities: [], relations: [] };
        }
      }
      
      // Find causal chains starting from this node using relationship traversal
      const result = await session.executeRead(tx => tx.run(`
        // Start with specified node
        MATCH (start {name: $startNode})
        
        // Find causal chains using path expansion
        CALL apoc.path.expandConfig(start, {
          relationshipFilter: "CAUSES>|INFLUENCES>|LEADS_TO>",
          minLevel: 1,
          maxLevel: $maxLength,
          uniqueness: "NODE_GLOBAL"
        }) YIELD path
        
        // Get path strength (product of weights)
        WITH path,
             reduce(s = 1.0, rel in relationships(path) | s * coalesce(rel.weight, 0.5)) as chainStrength,
             length(path) as chainLength
        
        // Order by strength and length
        ORDER BY chainStrength DESC, chainLength DESC
        
        // Extract nodes and relationships from each path
        WITH nodes(path) as pathNodes, relationships(path) as pathRels
        
        // Process each node
        UNWIND pathNodes as node
        
        // Return each node with its relationships along the path
        WITH DISTINCT node, pathRels
        
        // Get outgoing relationships from this node that are part of the path
        WITH node, [rel IN pathRels WHERE startNode(rel) = node] as outRels
        
        // Get all relationships for context
        OPTIONAL MATCH (node)-[additionalRel]->(other)
        WHERE NOT additionalRel IN outRels
        
        WITH node, outRels + collect(additionalRel) as allOutRels
        
        OPTIONAL MATCH (other)-[inRel]->(node)
        
        // Return as graph
        RETURN 
          node as entity,
          allOutRels as relations,
          collect(inRel) as inRelations
      `, { 
        startNode,
        maxLength
      }));
      
      console.error(`Found ${result.records.length} nodes in causal chains from ${startNode}`);
      
      return processSearchResults(result.records);
    }
    
    // If no start node provided, find significant causal chains across the knowledge graph
    const result = await session.executeRead(tx => tx.run(`
      // Find chains of causal relationships
      MATCH path = (start:Memory)-[:CAUSES|INFLUENCES*1..${maxLength}]->(end:Memory)
      
      // Calculate chain strength
      WITH path, 
           reduce(s = 1.0, rel in relationships(path) | s * coalesce(rel.weight, 0.5)) as chainStrength,
           length(path) as chainLength
      
      // Order by strength and length
      ORDER BY chainStrength DESC, chainLength DESC
      LIMIT 5
      
      // Extract nodes and relationships
      WITH nodes(path) as pathNodes, relationships(path) as pathRels
      
      // Process each node
      UNWIND pathNodes as node
      
      // Get outgoing relationships from this node that are part of the path
      WITH DISTINCT node, pathRels
      
      WITH node, [rel IN pathRels WHERE startNode(rel) = node] as outRels
      
      // Get all relationships for context
      OPTIONAL MATCH (node)-[additionalRel]->(other)
      WHERE NOT additionalRel IN outRels
      
      WITH node, outRels + collect(additionalRel) as allOutRels
      
      OPTIONAL MATCH (other)-[inRel]->(node)
      
      // Return as graph
      RETURN 
        node as entity,
        allOutRels as relations,
        collect(inRel) as inRelations
    `));
    
    console.error(`Found ${result.records.length} nodes in significant causal chains`);
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error tracing causal chains: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}