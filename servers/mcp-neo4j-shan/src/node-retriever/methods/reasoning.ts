import { Driver as Neo4jDriver } from 'neo4j-driver';
import { KnowledgeGraph } from '../../types/index.js';
import { processSearchResults, vectorSearch } from './search.js';

/**
 * Retrieves a reasoning chain and its steps by name
 *
 * @param neo4jDriver Neo4j driver instance
 * @param chainName Name of the reasoning chain to retrieve
 * @returns Promise resolving to a KnowledgeGraph containing the chain and its steps
 */
export async function getReasoningChain(
  neo4jDriver: Neo4jDriver,
  chainName: string
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Retrieving reasoning chain: ${chainName}`);
    
    // Check if chain exists with exact name match
    const chainExists = await session.executeRead(tx => tx.run(`
      MATCH (chain:ReasoningChain:Memory {name: $chainName})
      RETURN chain
    `, { chainName }));
    
    if (chainExists.records.length === 0) {
      console.error(`No exact match for reasoning chain with name: ${chainName}. Using vector search.`);
      
      // Try finding the chain using vector embeddings
      const { generateQueryEmbedding } = await import('./search.js');
      const queryEmbedding = await generateQueryEmbedding(chainName);
      
      const searchResults = await vectorSearch(
        neo4jDriver, 
        queryEmbedding, 
        'ReasoningChain', 
        1, // limit to top match
        0.75 // threshold
      );
      
      if (searchResults.entities.length === 0) {
        console.error(`No reasoning chain found matching: ${chainName}`);
        return { entities: [], relations: [] };
      }
      
      // Use the best matching chain name for the rest of the query
      chainName = searchResults.entities[0].name;
      console.error(`Using best matching chain: ${chainName}`);
    }
    
    // Use apoc.path.subgraphAll to efficiently retrieve the complete subgraph
    const result = await session.executeRead(tx => tx.run(`
      // Find the chain
      MATCH (chain:ReasoningChain:Memory {name: $chainName})
      
      // Use subgraphAll to get the complete subgraph with all relationships
      CALL apoc.path.subgraphAll(chain, {
        relationshipFilter: "CONTAINS_STEP>|HAS_REASONING<|RELATED_TO>|REFERENCES>|LEADS_TO>",
        maxLevel: 3
      })
      YIELD nodes, relationships
      
      // Unwind the nodes to process them individually
      UNWIND nodes as node
      
      // Get relationships for each node
      WITH node, relationships
      
      // Return in the format expected by processSearchResults
      RETURN 
        node as entity,
        [rel IN relationships WHERE startNode(rel) = node] as relations,
        [rel IN relationships WHERE endNode(rel) = node] as inRelations
    `, { chainName }));
    
    console.error(`Retrieved reasoning chain with ${result.records.length} related nodes`);
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error retrieving reasoning chain: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Retrieves detailed information about a specific reasoning step
 *
 * @param neo4jDriver Neo4j driver instance
 * @param stepName Name of the reasoning step to retrieve details for
 * @returns Promise resolving to a KnowledgeGraph containing the step and related nodes
 */
export async function getReasoningStepDetails(
  neo4jDriver: Neo4jDriver,
  stepName: string
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Retrieving details for reasoning step: ${stepName}`);
    
    // First check for exact name match
    const stepCheck = await session.executeRead(tx => tx.run(`
      MATCH (step:ReasoningStep:Memory {name: $stepName})
      RETURN step
    `, { stepName }));
    
    if (stepCheck.records.length === 0) {
      console.error(`No exact match for reasoning step: ${stepName}. Using vector search.`);
      
      // Try finding the reasoning step using vector search
      const { generateQueryEmbedding } = await import('./search.js');
      const queryEmbedding = await generateQueryEmbedding(stepName);
      
      const searchResult = await vectorSearch(
        neo4jDriver,
        queryEmbedding,
        undefined, // search across all indexes
        1, // limit to top match
        0.75 // threshold
      );
      
      if (searchResult.entities.length === 0 || searchResult.entities[0].entityType !== 'ReasoningStep') {
        console.error(`No reasoning step found matching: ${stepName}`);
        return { entities: [], relations: [] };
      }
      
      // Use the best matching step name
      stepName = searchResult.entities[0].name;
      console.error(`Using best matching step: ${stepName}`);
    }
    
    // Get detailed information about the step and its context
    const result = await session.executeRead(tx => tx.run(`
      // Find the reasoning step
      MATCH (step:ReasoningStep:Memory {name: $stepName})
      
      // Find the chain this step belongs to
      MATCH (chain:ReasoningChain)-[r:CONTAINS_STEP]->(step)
      
      // Use neighbor functions to find adjacent steps efficiently
      CALL {
        MATCH (step:ReasoningStep {name: $stepName})
        
        // Get all nodes directly connected to this step
        CALL apoc.neighbors.byhop(step, "REFERENCES>|LEADS_TO>|<LEADS_TO|USES_PROPOSITION>", 1)
        YIELD nodes as connectedNodes
        
        UNWIND connectedNodes as connected
        RETURN collect(DISTINCT connected) as relatedNodes
      }
      
      // Get any referenced entities from the step
      CALL {
        MATCH (step:ReasoningStep {name: $stepName})
        OPTIONAL MATCH (step)-[:REFERENCES]->(reference)
        RETURN collect(DISTINCT reference) as references
      }
      
      // Combine all nodes of interest
      WITH step, chain, relatedNodes, references
      
      // Get all step details in the same chain for context
      OPTIONAL MATCH (chain)-[:CONTAINS_STEP]->(otherStep:ReasoningStep)
      WHERE otherStep <> step
      
      // Combine all nodes
      WITH [step] + [chain] + relatedNodes + references + collect(DISTINCT otherStep) as allNodes
      
      // Process each node to get its relationships
      UNWIND allNodes as node
      
      WITH DISTINCT node
      
      // Return the node with its relationships
      RETURN 
        node as entity,
        [] as relations,
        [] as inRelations
    `, { stepName }));
    
    // Get the returned nodes
    const nodes = result.records.map(record => record.get('entity'));
    
    // Now get relationships between these nodes
    const relationships = await session.executeRead(tx => tx.run(`
      // Get the nodes we found
      WITH $nodeIds as nodeIds
      
      // Match relationships between these nodes
      MATCH (n)-[r]->(m)
      WHERE id(n) IN nodeIds AND id(m) IN nodeIds
      
      // Return the relationships grouped by source node
      RETURN id(n) as sourceId, collect(r) as outRels
    `, { 
      nodeIds: nodes.map(node => node.identity.toNumber())
    }));
    
    // Combine nodes with their relationships
    const finalRecords = result.records.map(record => {
      const node = record.get('entity');
      const nodeId = node.identity.toNumber();
      
      // Find relationships for this node
      const relationshipRecord = relationships.records.find(r => r.get('sourceId') === nodeId);
      const outRels = relationshipRecord ? relationshipRecord.get('outRels') : [];
      
      // Return updated record
      return {
        entity: node,
        relations: outRels,
        inRelations: [] // We'll handle incoming relationships through outgoing ones
      };
    });
    
    console.error(`Retrieved reasoning step details with ${finalRecords.length} related nodes`);
    
    return processSearchResults(finalRecords);
  } catch (error) {
    console.error(`Error retrieving reasoning step details: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Finds reasoning chains with similar conclusions to a given topic
 * using vector embeddings
 *
 * @param neo4jDriver Neo4j driver instance
 * @param topic Topic or conclusion to find similar reasoning chains for
 * @param limit Maximum number of similar chains to return
 * @returns Promise resolving to a KnowledgeGraph with similar reasoning chains
 */
export async function findReasoningChainsWithSimilarConclusion(
  neo4jDriver: Neo4jDriver,
  topic: string,
  limit: number = 5
): Promise<KnowledgeGraph> {
  // We'll use a hardcoded integer value (27) for Neo4j LIMIT clause
  const session = neo4jDriver.session();
  
  try {
    console.error(`Finding reasoning chains with conclusions similar to: ${topic}`);
    
    // Use vector search to find similar reasoning chains
    const { generateQueryEmbedding } = await import('./search.js');
    const queryEmbedding = await generateQueryEmbedding(topic);
    
    const searchResults = await vectorSearch(
      neo4jDriver,
      queryEmbedding,
      'ReasoningChain',
      27, // Use hardcoded value for LIMIT
      0.7 // lower threshold to get more diverse results
    );
    
    if (searchResults.entities.length === 0) {
      console.error(`No similar reasoning chains found for topic: ${topic}`);
      return { entities: [], relations: [] };
    }
    
    // Get chain names from the search results
    const chainNames = searchResults.entities.map(entity => entity.name);
    
    // Get detailed information about these chains and their steps
    const result = await session.executeRead(tx => tx.run(`
      // Match chains from our search results
      MATCH (chain:ReasoningChain:Memory)
      WHERE chain.name IN $chainNames
      
      // Get the steps for each chain
      OPTIONAL MATCH (chain)-[:CONTAINS_STEP]->(step:ReasoningStep)
      
      // Get thoughts connected to the chains
      OPTIONAL MATCH (thought:Thought)-[:HAS_REASONING]->(chain)
      
      // Get referenced entities
      OPTIONAL MATCH (step)-[:REFERENCES]->(reference)
      
      // Combine all nodes
      WITH chain, collect(DISTINCT step) as steps, collect(DISTINCT thought) as thoughts, 
           collect(DISTINCT reference) as references
      
      // Unwind all nodes to process them
      WITH chain, steps, thoughts, references
      UNWIND [chain] + steps + thoughts + references as node
      
      // Return each node
      WITH DISTINCT node
      
      // Return the node in the format expected by processSearchResults
      RETURN 
        node as entity,
        [] as relations,
        [] as inRelations
    `, { chainNames }));
    
    // Get the returned nodes
    const nodes = result.records.map(record => record.get('entity'));
    
    // Now get relationships between these nodes
    const relationships = await session.executeRead(tx => tx.run(`
      // Get the nodes we found
      WITH $nodeIds as nodeIds
      
      // Match relationships between these nodes
      MATCH (n)-[r]->(m)
      WHERE id(n) IN nodeIds AND id(m) IN nodeIds
      
      // Return the relationships grouped by source node
      RETURN id(n) as sourceId, collect(r) as outRels
    `, { 
      nodeIds: nodes.map(node => node.identity.toNumber())
    }));
    
    // Combine nodes with their relationships
    const finalRecords = result.records.map(record => {
      const node = record.get('entity');
      const nodeId = node.identity.toNumber();
      
      // Find relationships for this node
      const relationshipRecord = relationships.records.find(r => r.get('sourceId') === nodeId);
      const outRels = relationshipRecord ? relationshipRecord.get('outRels') : [];
      
      // Return updated record
      return {
        entity: node,
        relations: outRels,
        inRelations: [] // We'll handle incoming relationships through outgoing ones
      };
    });
    
    console.error(`Found ${chainNames.length} similar reasoning chains with ${finalRecords.length} total nodes`);
    
    return processSearchResults(finalRecords);
  } catch (error) {
    console.error(`Error finding similar reasoning chains: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Retrieves analytics about reasoning chains and their relationships
 *
 * @param neo4jDriver Neo4j driver instance
 * @param filter Optional domain filter to limit the analysis
 * @returns Promise resolving to a KnowledgeGraph with reasoning analytics
 */
export async function getReasoningAnalytics(
  neo4jDriver: Neo4jDriver,
  filter?: { domain?: string, methodology?: string }
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Retrieving reasoning analytics${filter?.domain ? ` for domain: ${filter.domain}` : ''}${filter?.methodology ? ` with methodology: ${filter.methodology}` : ''}`);
    
    // Build filter conditions
    let filterConditions = '';
    const params: any = {};
    
    if (filter?.domain) {
      filterConditions += 'AND chain.domain = $domain ';
      params.domain = filter.domain;
    }
    
    if (filter?.methodology) {
      filterConditions += 'AND chain.methodology = $methodology ';
      params.methodology = filter.methodology;
    }
    
    // Execute analytics query
    const result = await session.executeRead(tx => tx.run(`
      // Find all reasoning chains matching the filters
      MATCH (chain:ReasoningChain:Memory)
      WHERE true ${filterConditions}
      
      // Calculate analytics per chain
      WITH chain
      
      // Get step count and confidence using pattern comprehension
      OPTIONAL MATCH (chain)-[:CONTAINS_STEP]->(step:ReasoningStep)
      WITH chain, 
           count(step) as stepCount,
           CASE WHEN count(step) > 0 THEN avg(step.confidence) ELSE null END as avgConfidence
      
      // Only include chains with at least one step
      WHERE stepCount > 0
      
      // Use subgraph expansion to get key connected entities
      CALL apoc.path.subgraphAll(chain, {
        relationshipFilter: "CONTAINS_STEP>|HAS_REASONING<|REFERENCES>",
        maxLevel: 2,
        limit: 100  // Limit to prevent very large subgraphs
      })
      YIELD nodes, relationships
      
      // Calculate additional analytics per subgraph
      WITH chain, stepCount, avgConfidence, nodes, relationships,
           [n IN nodes WHERE n:ReasoningStep] as stepNodes,
           [n IN nodes WHERE n:Thought] as thoughtNodes,
           [r IN relationships WHERE type(r) = 'REFERENCES'] as referenceRels
      
      // Return the analytics data
      RETURN 
        chain as entity,
        relationships as relations,
        [] as inRelations,
        stepCount,
        avgConfidence,
        size(stepNodes) as totalSteps,
        size(thoughtNodes) as relatedThoughts,
        size(referenceRels) as totalReferences
    `, params));
    
    // Transform the results to include analytics information
    const processedRecords = result.records.map(record => {
      const chain = record.get('entity');
      const relationships = record.get('relations');
      const stepCount = record.get('stepCount')?.toNumber() || 0;
      const avgConfidence = record.get('avgConfidence');
      const totalSteps = record.get('totalSteps')?.toNumber() || 0;
      const relatedThoughts = record.get('relatedThoughts')?.toNumber() || 0;
      const totalReferences = record.get('totalReferences')?.toNumber() || 0;
      
      // Add analytics data to the chain properties
      chain.properties.analytics = {
        stepCount,
        avgConfidence,
        totalSteps,
        relatedThoughts,
        totalReferences
      };
      
      return {
        entity: chain,
        relations: relationships,
        inRelations: []
      };
    });
    
    console.error(`Retrieved reasoning analytics for ${processedRecords.length} chains`);
    
    return processSearchResults(processedRecords);
  } catch (error) {
    console.error(`Error retrieving reasoning analytics: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}