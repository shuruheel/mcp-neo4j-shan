import { Driver as Neo4jDriver } from 'neo4j-driver';
import { KnowledgeGraph } from '../../types/index.js';
import { processSearchResults } from './search.js';

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
    
    // Check if chain exists
    const chainExists = await session.executeRead(tx => tx.run(`
      MATCH (chain:ReasoningChain:Memory {name: $chainName})
      RETURN chain
    `, { chainName }));
    
    if (chainExists.records.length === 0) {
      console.error(`No reasoning chain found with name: ${chainName}`);
      return { entities: [], relations: [] };
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
      WITH nodes, relationships
      UNWIND nodes as node
      
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
    
    const result = await session.executeRead(tx => tx.run(`
      // Find the reasoning step
      MATCH (step:ReasoningStep:Memory {name: $stepName})
      
      // Find the chain this step belongs to
      MATCH (chain:ReasoningChain)-[r:CONTAINS_STEP]->(step)
      
      // Use neighbor functions to find adjacent steps efficiently
      CALL {
        MATCH (step:ReasoningStep {name: $stepName})
        
        // Get all nodes directly connected to this step with specified relationships
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
      
      // Get outgoing relationships
      OPTIONAL MATCH (node)-[outRel]->(connected)
      
      // Get incoming relationships
      OPTIONAL MATCH (other)-[inRel]->(node)
      
      RETURN 
        node as entity,
        collect(DISTINCT outRel) as relations,
        collect(DISTINCT inRel) as inRelations
    `, { stepName }));
    
    console.error(`Retrieved reasoning step details with ${result.records.length} related nodes`);
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error retrieving reasoning step details: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Finds reasoning chains with similar conclusions to a given topic
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
  const session = neo4jDriver.session();
  
  try {
    console.error(`Finding reasoning chains with conclusions similar to: ${topic}`);
    
    const result = await session.executeRead(tx => tx.run(`
      // Use text search to efficiently find chains with similar conclusions
      CALL db.index.fulltext.queryNodes("reasoningChainContent", $searchTerm) 
      YIELD node as chain, score
      WHERE chain:ReasoningChain:Memory

      // Order by similarity score, then confidence score
      ORDER BY score DESC, chain.confidenceScore DESC
      LIMIT $limit
      
      // With the best matching chains, use subgraphAll to get related nodes
      WITH collect(chain) as matchingChains
      UNWIND matchingChains as chain
      
      // Get a subgraph for each chain with its most important relationships
      CALL apoc.path.subgraphAll(chain, {
        relationshipFilter: "CONTAINS_STEP>|HAS_REASONING<",
        maxLevel: 1
      })
      YIELD nodes, relationships
      
      // Return in the format expected by processSearchResults
      WITH nodes, relationships
      UNWIND nodes as node
      
      RETURN 
        node as entity,
        [rel IN relationships WHERE startNode(rel) = node] as relations,
        [rel IN relationships WHERE endNode(rel) = node] as inRelations
    `, { 
      searchTerm: `${topic}~`,
      limit 
    }));
    
    console.error(`Found ${result.records.length} nodes related to similar reasoning chains`);
    
    return processSearchResults(result.records);
  } catch (error) {
    // Fulltext search might not be available, use fuzzy matching as fallback
    try {
      console.error(`Fulltext search failed, using fallback: ${error}`);
      
      const fallbackResult = await session.executeRead(tx => tx.run(`
        // Find reasoning chains with similar conclusions using fuzzy matching
        MATCH (chain:ReasoningChain:Memory)
        WHERE apoc.text.fuzzyMatch(chain.conclusion, $topic, 0.7)
           OR chain.conclusion CONTAINS $topic
           OR chain.description CONTAINS $topic
        
        // Use similar patterns to collect relevant nodes
        WITH chain, 
             apoc.text.fuzzyMatch(chain.conclusion, $topic, 0.7) as score,
             chain.confidenceScore as confidence
        
        // Order by similarity score, then confidence score
        ORDER BY score DESC, confidence DESC
        LIMIT $limit
        
        // Collect the chains and their steps
        OPTIONAL MATCH (chain)-[:CONTAINS_STEP]->(step:ReasoningStep)
        OPTIONAL MATCH (thought:Thought)-[:HAS_REASONING]->(chain)
        
        // Combine nodes
        WITH chain, collect(step) as steps, collect(thought) as thoughts
        WITH [chain] + steps + thoughts as allNodes
        
        // Process each node
        UNWIND allNodes as node
        
        WITH DISTINCT node
        
        // Get outgoing relationships
        OPTIONAL MATCH (node)-[outRel]->(connected)
        
        // Get incoming relationships
        OPTIONAL MATCH (other)-[inRel]->(node)
        
        RETURN 
          node as entity,
          collect(DISTINCT outRel) as relations,
          collect(DISTINCT inRel) as inRelations
      `, { 
        topic,
        limit 
      }));
      
      console.error(`Fallback search found ${fallbackResult.records.length} nodes related to similar reasoning chains`);
      
      return processSearchResults(fallbackResult.records);
    } catch (fallbackError) {
      console.error(`Error finding similar reasoning chains using fallback: ${fallbackError}`);
      throw fallbackError;
    }
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
      WITH chain, stepCount, avgConfidence
           
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
      
      // Return the subgraph with analytics
      RETURN 
        nodes as entities,
        relationships as relations,
        chain.name as chainName,
        chain.methodology as methodology,
        stepCount,
        avgConfidence,
        size(stepNodes) as totalSteps,
        size(thoughtNodes) as relatedThoughts,
        size(referenceRels) as totalReferences
    `, params));
    
    console.error(`Retrieved reasoning analytics with ${result.records.length} chains`);
    
    // Process the results in a format compatible with processSearchResults
    const processedRecords = result.records.flatMap(record => {
      const entities = record.get('entities');
      const relations = record.get('relations');
      const chainName = record.get('chainName');
      const methodology = record.get('methodology');
      const stepCount = record.get('stepCount').toNumber();
      const avgConfidence = record.get('avgConfidence');
      const totalSteps = record.get('totalSteps').toNumber();
      const relatedThoughts = record.get('relatedThoughts').toNumber();
      const totalReferences = record.get('totalReferences').toNumber();
      
      // Format nodes to be processed by processSearchResults
      return entities.map((entity: any) => {
        // Add analytics metadata to chain entities
        if (entity.labels.includes('ReasoningChain') && entity.properties.name === chainName) {
          return {
            entity: entity,
            relations: relations.filter((r: any) => r.start.equals(entity.identity)),
            inRelations: relations.filter((r: any) => r.end.equals(entity.identity)),
            // Include analytics in properties
            analyticsData: {
              stepCount,
              avgConfidence,
              totalSteps,
              relatedThoughts,
              totalReferences,
              methodology
            }
          };
        }
        
        // Standard format for other entities
        return {
          entity: entity,
          relations: relations.filter((r: any) => r.start.equals(entity.identity)),
          inRelations: relations.filter((r: any) => r.end.equals(entity.identity))
        };
      });
    });
    
    // Process the records using the existing processSearchResults function
    return processSearchResults(processedRecords);
  } catch (error) {
    console.error(`Error retrieving reasoning analytics: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
} 