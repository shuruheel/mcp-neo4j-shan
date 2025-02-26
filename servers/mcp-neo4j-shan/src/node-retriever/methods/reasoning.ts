import { Driver as Neo4jDriver } from 'neo4j-driver';

/**
 * Retrieves a reasoning chain and its steps by name
 * @param neo4jDriver - Neo4j driver instance
 * @param chainName - Name of the reasoning chain
 * @returns The chain and its steps
 */
export async function getReasoningChain(
  neo4jDriver: Neo4jDriver,
  chainName: string
): Promise<{chain: any, steps: any[]}> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Retrieving reasoning chain: "${chainName}"`);
    
    // First check if the chain exists
    const chainExists = await session.executeRead(tx => tx.run(`
      MATCH (chain:ReasoningChain:Memory {name: $chainName})
      RETURN chain
    `, { chainName }));
    
    if (chainExists.records.length === 0) {
      const errorMsg = `ReasoningChain "${chainName}" not found`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    console.error(`Found reasoning chain: "${chainName}"`);
    
    // Get the chain and its steps in one query
    const result = await session.executeRead(tx => tx.run(`
      // Match the chain
      MATCH (chain:ReasoningChain:Memory {name: $chainName})
      
      // Get all steps ordered by the 'order' property
      OPTIONAL MATCH (chain)-[rel:CONTAINS_STEP]->(step:ReasoningStep)
      WITH chain, step, rel
      ORDER BY rel.order
      
      // Return chain and collected ordered steps
      RETURN chain, collect({step: step, order: rel.order}) as steps
    `, { chainName }));
    
    if (result.records.length === 0) {
      // This shouldn't happen since we already checked the chain exists
      const errorMsg = `Failed to retrieve reasoning chain "${chainName}" after confirming it exists`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    const record = result.records[0];
    const chain = record.get('chain').properties;
    
    // Process the steps, maintaining their order
    const steps = record.get('steps')
      .filter((stepObj: any) => stepObj.step !== null) // Filter out any null steps
      .map((stepObj: any) => {
        return {
          ...stepObj.step.properties,
          order: stepObj.order
        };
      })
      .sort((a: any, b: any) => a.order - b.order); // Ensure steps are ordered
    
    console.error(`Retrieved reasoning chain "${chainName}" with ${steps.length} steps`);
    
    // If there are steps with supportingReferences or previousSteps, get those details
    const stepsWithReferences = steps.filter(s => 
      (s.supportingReferences && s.supportingReferences.length > 0) || 
      (s.previousSteps && s.previousSteps.length > 0)
    );
    
    if (stepsWithReferences.length > 0) {
      console.error(`Retrieving additional details for ${stepsWithReferences.length} steps with references`);
      
      // For each step with references, get the reference details
      for (const step of stepsWithReferences) {
        try {
          const stepDetails = await getReasoningStepDetails(neo4jDriver, step.name);
          // Merge in the details for supportingReferences and previousSteps
          step.supportingReferencesDetails = stepDetails.supportingReferences;
          step.previousStepsDetails = stepDetails.previousSteps;
          step.nextStepsDetails = stepDetails.nextSteps;
        } catch (detailError) {
          console.error(`Error getting details for step ${step.name}:`, detailError);
          // Don't fail the entire operation for one step's details
        }
      }
    }
    
    return { chain, steps };
  } catch (error) {
    // Enhanced error message with more context
    const errorMessage = `Error retrieving reasoning chain "${chainName}": ${error.message || error}`;
    console.error(errorMessage);
    
    // If it's a Neo4j driver error, log more details
    if (error.code) {
      console.error(`Neo4j error code: ${error.code}`);
    }
    
    throw new Error(errorMessage);
  } finally {
    await session.close();
  }
}

/**
 * Retrieves reasoning chains associated with a thought
 * @param neo4jDriver - Neo4j driver instance
 * @param thoughtName - Name of the thought
 * @returns The thought and its chains
 */
export async function getReasoningChainsForThought(
  neo4jDriver: Neo4jDriver,
  thoughtName: string
): Promise<{thought: any, chains: any[]}> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Retrieving reasoning chains for thought: ${thoughtName}`);
    
    // Get the thought and all its reasoning chains
    const result = await session.executeRead(tx => tx.run(`
      // Match the thought
      MATCH (thought:Thought:Memory {name: $thoughtName})
      
      // Get all reasoning chains attached to this thought
      OPTIONAL MATCH (thought)-[:HAS_REASONING]->(chain:ReasoningChain)
      
      // Get basic step count for each chain
      OPTIONAL MATCH (chain)-[rel:CONTAINS_STEP]->(step:ReasoningStep)
      WITH thought, chain, count(step) as stepCount
      
      // Return thought and collected chains with their step counts
      RETURN thought, collect({chain: chain, stepCount: stepCount}) as chains
    `, { thoughtName }));
    
    if (result.records.length === 0) {
      throw new Error(`Thought ${thoughtName} not found`);
    }
    
    const record = result.records[0];
    const thought = record.get('thought').properties;
    
    // Process the chains
    const chains = record.get('chains')
      .filter((chainObj: any) => chainObj.chain !== null) // Filter out any null chains
      .map((chainObj: any) => {
        return {
          ...chainObj.chain.properties,
          stepCount: chainObj.stepCount
        };
      });
    
    return { thought, chains };
  } catch (error) {
    console.error(`Error retrieving reasoning chains for thought:`, error);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Retrieves details for a reasoning step
 * @param neo4jDriver - Neo4j driver instance
 * @param stepName - Name of the step
 * @returns The step and related information
 */
export async function getReasoningStepDetails(
  neo4jDriver: Neo4jDriver,
  stepName: string
): Promise<{
  step: any,
  supportingReferences: any[],
  previousSteps: any[],
  nextSteps: any[]
}> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Retrieving reasoning step details: ${stepName}`);
    
    // Get the step with its references and connections
    const result = await session.executeRead(tx => tx.run(`
      // Match the step
      MATCH (step:ReasoningStep:Memory {name: $stepName})
      
      // Get referenced nodes
      OPTIONAL MATCH (step)-[:REFERENCES]->(ref:Memory)
      WITH step, collect(ref) as refs
      
      // Get previous steps that lead to this one
      OPTIONAL MATCH (prev:ReasoningStep)-[:LEADS_TO]->(step)
      WITH step, refs, collect(prev) as prevSteps
      
      // Get next steps that this one leads to
      OPTIONAL MATCH (step)-[:LEADS_TO]->(next:ReasoningStep)
      
      // Return everything
      RETURN step, refs as supportingReferences, prevSteps, collect(next) as nextSteps
    `, { stepName }));
    
    if (result.records.length === 0) {
      throw new Error(`ReasoningStep ${stepName} not found`);
    }
    
    const record = result.records[0];
    const step = record.get('step').properties;
    
    // Process supporting references
    const supportingReferences = record.get('supportingReferences')
      .map((ref: any) => ref.properties);
    
    // Process previous steps
    const previousSteps = record.get('prevSteps')
      .map((prev: any) => prev.properties);
    
    // Process next steps
    const nextSteps = record.get('nextSteps')
      .map((next: any) => next.properties);
    
    return { 
      step, 
      supportingReferences, 
      previousSteps, 
      nextSteps 
    };
  } catch (error) {
    console.error(`Error retrieving reasoning step details:`, error);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Finds reasoning chains with similar conclusions
 * @param neo4jDriver - Neo4j driver instance
 * @param conclusion - The conclusion to match
 * @param limit - Maximum number of chains to return
 * @returns Array of matching chains
 */
export async function findReasoningChainsWithSimilarConclusion(
  neo4jDriver: Neo4jDriver,
  conclusion: string, 
  limit: number = 5
): Promise<any[]> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Finding reasoning chains with similar conclusion: ${conclusion}`);
    
    // Use full-text search if available, or fallback to simplified string matching
    const result = await session.executeRead(tx => tx.run(`
      // Match ReasoningChain nodes
      MATCH (chain:ReasoningChain:Memory)
      
      // Calculate similarity score
      // This is a simple implementation - in production consider vector embeddings
      WITH chain, 
           apoc.text.sorensenDiceSimilarity(toLower(chain.conclusion), toLower($conclusion)) as similarityScore
      
      // Filter by minimum threshold and sort by similarity
      WHERE similarityScore > 0.3
      RETURN chain, similarityScore
      ORDER BY similarityScore DESC
      LIMIT $limit
    `, { 
      conclusion,
      limit
    }));
    
    // Process and return the results
    return result.records.map(record => {
      const chain = record.get('chain').properties;
      const score = record.get('similarityScore');
      
      return {
        ...chain,
        similarityScore: score
      };
    });
  } catch (error) {
    console.error(`Error finding similar reasoning chains:`, error);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Gets analytics about reasoning in the knowledge graph
 * @param neo4jDriver - Neo4j driver instance
 * @returns Analytics data
 */
export async function getReasoningAnalytics(
  neo4jDriver: Neo4jDriver
): Promise<{
  totalChains: number,
  totalSteps: number,
  methodologyDistribution: Record<string, number>,
  averageStepsPerChain: number,
  topChainsByStepCount: any[]
}> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Retrieving reasoning analytics`);
    
    // Get chain statistics
    const statsResult = await session.executeRead(tx => tx.run(`
      // Count total chains and steps
      MATCH (chain:ReasoningChain:Memory)
      OPTIONAL MATCH (chain)-[:CONTAINS_STEP]->(step:ReasoningStep)
      
      RETURN count(DISTINCT chain) as totalChains,
             count(step) as totalSteps
    `));
    
    // Get methodology distribution
    const methodologyResult = await session.executeRead(tx => tx.run(`
      // Count chains by methodology
      MATCH (chain:ReasoningChain:Memory)
      RETURN chain.methodology as methodology, count(chain) as count
      ORDER BY count DESC
    `));
    
    // Get top chains by step count
    const topChainsResult = await session.executeRead(tx => tx.run(`
      // Find chains with the most steps
      MATCH (chain:ReasoningChain:Memory)
      OPTIONAL MATCH (chain)-[:CONTAINS_STEP]->(step:ReasoningStep)
      WITH chain, count(step) as stepCount
      RETURN chain.name as chainName, 
             chain.description as description,
             chain.methodology as methodology,
             stepCount
      ORDER BY stepCount DESC
      LIMIT 5
    `));
    
    // Process results
    const statsRecord = statsResult.records[0];
    const totalChains = statsRecord.get('totalChains').toNumber();
    const totalSteps = statsRecord.get('totalSteps').toNumber();
    const averageStepsPerChain = totalChains > 0 ? totalSteps / totalChains : 0;
    
    const methodologyDistribution: Record<string, number> = {};
    methodologyResult.records.forEach(record => {
      const methodology = record.get('methodology');
      const count = record.get('count').toNumber();
      if (methodology) {
        methodologyDistribution[methodology] = count;
      }
    });
    
    const topChainsByStepCount = topChainsResult.records.map(record => {
      return {
        name: record.get('chainName'),
        description: record.get('description'),
        methodology: record.get('methodology'),
        stepCount: record.get('stepCount').toNumber()
      };
    });
    
    return {
      totalChains,
      totalSteps,
      methodologyDistribution,
      averageStepsPerChain,
      topChainsByStepCount
    };
  } catch (error) {
    console.error(`Error retrieving reasoning analytics:`, error);
    throw error;
  } finally {
    await session.close();
  }
} 