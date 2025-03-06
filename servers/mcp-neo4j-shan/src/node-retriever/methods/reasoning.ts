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
    
    // Get the chain and its ordered steps
    const result = await session.executeRead(tx => tx.run(`
      // Find the chain
      MATCH (chain:ReasoningChain:Memory {name: $chainName})
      
      // Find all steps in this chain
      OPTIONAL MATCH (chain)-[r:HAS_STEP]->(step:ReasoningStep)
      
      // Get related propositions
      OPTIONAL MATCH (chain)-[:RELATED_TO]->(prop:Proposition)
      
      // Collect all relevant nodes
      WITH chain, 
           collect(step) as steps,
           collect(prop) as props
      
      // Get all nodes in the collection
      WITH [chain] + steps + props as allNodes
      
      // Get relationships for each node
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
      
      // Get evidence and related nodes
      OPTIONAL MATCH (step)-[:SUPPORTED_BY]->(evidence)
      OPTIONAL MATCH (step)-[:USES_PROPOSITION]->(prop:Proposition)
      
      // Get parent chain
      OPTIONAL MATCH (chain:ReasoningChain)-[:HAS_STEP]->(step)
      
      // Get alternative steps if any
      OPTIONAL MATCH (step)-[:HAS_ALTERNATIVE]->(alt:ReasoningStep)
      
      // Collect all relevant nodes
      WITH step, 
           collect(DISTINCT evidence) as evidenceNodes,
           collect(DISTINCT prop) as propositions,
           collect(DISTINCT chain) as chains,
           collect(DISTINCT alt) as alternatives
      
      // Combine all nodes
      WITH [step] + evidenceNodes + propositions + chains + alternatives as allNodes
      
      // Get relationships for each node
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
      // Find reasoning chains with similar conclusions
      MATCH (chain:ReasoningChain:Memory)
      WHERE apoc.text.fuzzyMatch(chain.conclusion, $topic, 0.7)
         OR chain.conclusion CONTAINS $topic
         OR chain.description CONTAINS $topic
      
      // Get connections to other node types for context
      OPTIONAL MATCH (chain)-[:RELATED_TO]->(prop:Proposition)
      OPTIONAL MATCH (chain)-[:SUPPORTS]->(concept:Concept)
      OPTIONAL MATCH (chain)-[:HAS_STEP]->(step:ReasoningStep)
      
      // Gather nodes in one collection for processing
      WITH chain, 
           collect(DISTINCT prop) as propositions,
           collect(DISTINCT concept) as concepts,
           collect(DISTINCT step) as steps,
           apoc.text.fuzzyMatch(chain.conclusion, $topic, 0.7) as score
      
      // Order by similarity score
      ORDER BY score DESC
      LIMIT $limit
      
      // Combine all nodes
      WITH chain, propositions, concepts, steps, score
      WITH [chain] + propositions + concepts + steps as allNodes
      
      // Get relationships for each node
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
    
    console.error(`Found ${result.records.length} nodes related to similar reasoning chains`);
    
    return processSearchResults(result.records);
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
    
    const result = await session.executeRead(tx => tx.run(`
      // Find all reasoning chains and their steps
      MATCH (chain:ReasoningChain:Memory)
      WHERE true ${filterConditions}
      
      // Get steps, sorted by chain and sequence
      OPTIONAL MATCH (chain)-[r:HAS_STEP]->(step:ReasoningStep)
      
      // Get connected propositions
      OPTIONAL MATCH (chain)-[:RELATED_TO]->(prop:Proposition)
      OPTIONAL MATCH (step)-[:USES_PROPOSITION]->(stepProp:Proposition)
      
      // Get other significant connections
      OPTIONAL MATCH (chain)-[:SUPPORTS|CONTRADICTS]->(entity)
      WHERE entity:Concept OR entity:ScientificInsight OR entity:Proposition
      
      // Gather all nodes
      WITH chain,
           collect(DISTINCT step) as steps,
           collect(DISTINCT prop) + collect(DISTINCT stepProp) as propositions,
           collect(DISTINCT entity) as supportedConcepts,
           count(DISTINCT step) as stepCount,
           avg(step.confidence) as avgConfidence
      
      // Combine into a single collection
      WITH chain, steps, propositions, supportedConcepts, stepCount, avgConfidence
      WITH [chain] + steps + propositions + supportedConcepts as allNodes,
           chain.name as chainName,
           stepCount,
           avgConfidence
      
      // Process each node
      UNWIND allNodes as node
      
      WITH DISTINCT node, chainName, stepCount, avgConfidence
      
      // Get outgoing relationships
      OPTIONAL MATCH (node)-[outRel]->(connected)
      
      // Get incoming relationships
      OPTIONAL MATCH (other)-[inRel]->(node)
      
      RETURN 
        node as entity,
        collect(DISTINCT outRel) as relations,
        collect(DISTINCT inRel) as inRelations,
        chainName,
        stepCount,
        avgConfidence
    `, params));
    
    console.error(`Retrieved reasoning analytics with ${result.records.length} nodes`);
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error retrieving reasoning analytics: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
} 