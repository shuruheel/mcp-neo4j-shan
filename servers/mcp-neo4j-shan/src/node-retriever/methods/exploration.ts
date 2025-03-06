import { Driver as Neo4jDriver } from 'neo4j-driver';
import { KnowledgeGraph, Entity, Relation, RelationshipType } from '../../types/index.js';
import { processSearchResults } from './search.js';

/**
 * Explores the context around a node with prioritization based on relationship weights
 * 
 * This method is the primary way to explore the knowledge graph context, implementing
 * a cognitive-science based traversal strategy that mimics how human memory works:
 * - Stronger/more important connections are traversed first
 * - Relationship weights determine traversal cost (higher weight = lower cost)
 * - Weak connections require higher "cognitive effort" to traverse
 * 
 * @param neo4jDriver - Neo4j driver instance
 * @param nodeName - The name of the node to explore context around
 * @param maxDepth - Maximum number of relationship hops to traverse (default: 2)
 * @param minWeight - Minimum relationship weight to include (default: 0.0, range: 0.0-1.0)
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
    fuzzyThreshold?: number  // New parameter for controlling fuzzy matching
  } = {}
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  // Handle case where nodeName is an array
  const nodeNames = Array.isArray(nodeName) ? nodeName : [nodeName];
  
  // Set default options
  const maxNodes = options.maxNodes || 50;
  const fuzzyThreshold = options.fuzzyThreshold || 0.7; // Default fuzzy matching threshold (70% similarity)
  
  // Default to include all node types if not specified
  const includeTypes = options.includeTypes || [
    'Entity', 'Concept', 'Event', 'ScientificInsight', 
    'Law', 'Thought', 'ReasoningChain', 'ReasoningStep',
    'Attribute', 'Proposition', 'Emotion', 'Agent'
  ];
  
  const excludeTypes = options.excludeTypes || [];
  const includeRelationships = options.includeRelationships || [];
  
  // Generate type filters for Cypher query
  const labelFilter = generateTypeFilterQuery(includeTypes, excludeTypes);
  const relationshipFilter = generateRelationshipFilterQuery(includeRelationships);
  
  try {
    // First, let's try to find the nodes using fuzzy matching
    console.error(`Searching for nodes using fuzzy matching with threshold ${fuzzyThreshold}: ${nodeNames.join(', ')}`);
    
    const findNodesQuery = `
      // Collect all memory nodes
      MATCH (n:Memory)
      WHERE n.name IS NOT NULL
      
      // Filter to nodes that are fuzzy matches to our input names
      WITH n, [searchName IN $nodeNames | 
        apoc.text.fuzzyMatch(n.name, searchName) >= $fuzzyThreshold] AS matches
      
      // Keep nodes that matched at least one input name
      WHERE ANY(matched IN matches WHERE matched = true)
      
      // Return the matched node along with its similarity to the best matching input
      RETURN n, 
        MAX([searchName IN $nodeNames | apoc.text.fuzzyMatch(n.name, searchName)]) AS similarity
      ORDER BY similarity DESC
      LIMIT $maxNodes
    `;
    
    const matchingNodesResult = await session.executeRead(tx =>
      tx.run(findNodesQuery, { 
        nodeNames: nodeNames,
        fuzzyThreshold: fuzzyThreshold
      })
    );
    
    const matchedNodes = matchingNodesResult.records.map(record => record.get('n'));
    
    // Log which nodes were found
    if (matchedNodes.length > 0) {
      console.error(`Found ${matchedNodes.length} matching nodes:`);
      matchedNodes.forEach(node => {
        const similarity = matchingNodesResult.records.find(r => 
          r.get('n').identity.equals(node.identity)).get('similarity');
        console.error(`- ${node.properties.name} (${node.properties.nodeType || 'Unknown'}, similarity: ${similarity.toFixed(2)})`);
      });
    } else {
      console.error('No matching nodes found in the knowledge graph');
      return { entities: [], relations: [] };
    }
    
    // If we have multiple matched nodes, use the subgraphAll approach
    if (matchedNodes.length > 1) {
      console.error(`Exploring context for multiple fuzzy-matched nodes`);
      
      // Optimized Cypher query using APOC's subgraphAll
      const query = `
        // Use subgraphAll with the matched nodes
        CALL apoc.path.subgraphAll($startNodes, {
          relationshipFilter: ">|<",  // All relationships in any direction
          labelFilter: "${labelFilter}",
          maxLevel: $maxDepth,
          limit: $maxNodes,
          bfs: false  // Depth-first for better exploration
        })
        YIELD nodes, relationships
        
        // Filter relationships by weight
        WITH 
          nodes,
          [rel IN relationships WHERE coalesce(rel.weight, 0.5) >= $minWeight] AS weightFilteredRels
        
        RETURN collect(distinct nodes) as nodes, collect(distinct weightFilteredRels) as relationships
      `;
      
      // Execute the optimized query with the matched nodes
      const result = await session.executeRead(tx =>
        tx.run(query, { 
          startNodes: matchedNodes,  // Pass the actual node objects
          maxDepth: maxDepth,
          minWeight: minWeight,
          maxNodes: maxNodes
        })
      );
      
      if (result.records.length === 0) {
        console.error(`No subgraph found from the matched nodes`);
        return { entities: [], relations: [] };
      }
      
      // Process the results from the APOC procedure
      const record = result.records[0];
      
      // The APOC procedure returns collections of nodes and relationships
      // We need to flatten them
      const nodesArray = record.get('nodes');
      const relationshipsArray = record.get('relationships');
      
      // Flatten nested arrays if needed
      const nodes = Array.isArray(nodesArray[0]) ? nodesArray.flat() : nodesArray;
      const relationships = Array.isArray(relationshipsArray[0]) ? 
        relationshipsArray.flat() : relationshipsArray;
      
      // Process into Entity[] and Relation[] format
      return processExplorationResults([{ nodes, relationships }]);
    }
    
    // If we only have one node, use the original implementation with the matched node
    console.error(`Exploring context for single fuzzy-matched node: ${matchedNodes[0].properties.name}`);
    
    // Enhanced Cypher query that uses relationship weights for traversal costs
    const query = `
      // Use variable-length path with weighted cost traversal
      CALL apoc.path.expandConfig($startNode, {
        relationshipFilter: "${relationshipFilter || '>'}"  // Use specific relationships or all outgoing
        , labelFilter: "${labelFilter || '>Memory'}" // Use label filter or default to Memory nodes
        , uniqueness: "NODE_GLOBAL"  // Avoid cycles
        , bfs: false             // Depth-first for better exploration
        , limit: $maxNodes       // Limit total results
        , maxLevel: $maxDepth    // Maximum traversal depth
        , relCostProperty: "weight"   // Use weight property as cost factor
        , defaultRelCost: 1.0         // Default cost if weight is not specified
        , costEvaluator: "relationship.weight < $minWeight ? 10000000 : 1/relationship.weight" // Make low-weight relationships very expensive
      }) YIELD path
      
      // Extract nodes and relationships from the path with all their properties
      WITH 
        path,
        [node IN nodes(path) | node] as pathNodes,
        [rel IN relationships(path) | rel] as pathRels
      
      // Filter to only include relationships with weight >= minWeight
      WITH 
        pathNodes, 
        [rel IN pathRels WHERE COALESCE(rel.weight, 0.5) >= $minWeight] as filteredRels
      
      // Return all path nodes and filtered relationships
      WITH 
        COLLECT(DISTINCT [n IN pathNodes | n]) as allNodeArrays,
        COLLECT(DISTINCT [r IN filteredRels | r]) as allRelArrays
      
      // Flatten collections and return
      RETURN 
        CASE WHEN SIZE(allNodeArrays) > 0 THEN REDUCE(s = [], arr IN allNodeArrays | s + arr) ELSE [] END as nodes,
        CASE WHEN SIZE(allRelArrays) > 0 THEN REDUCE(s = [], arr IN allRelArrays | s + arr) ELSE [] END as relationships
    `;
    
    // Execute the query with the matched node
    const result = await session.executeRead(tx =>
      tx.run(query, { 
        startNode: matchedNodes[0],  // Pass the actual node object
        maxDepth,
        minWeight,
        maxNodes
      })
    );
    
    // Process the result
    if (result.records.length === 0) {
      console.error(`No paths found from matched node: ${matchedNodes[0].properties.name}`);
      return { entities: [], relations: [] };
    }
    
    // Extract nodes and relationships from the result
    const record = result.records[0];
    const nodes = record.get('nodes') || [];
    const relationships = record.get('relationships') || [];
    
    return processExplorationResults([{ nodes, relationships }]);
  } catch (error) {
    console.error(`Error exploring context: ${error.message}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Generates a label filter query string for Cypher
 * @param includeTypes - Types to include
 * @param excludeTypes - Types to exclude
 * @returns Formatted label filter string for APOC procedures
 */
function generateTypeFilterQuery(includeTypes: string[], excludeTypes: string[]): string {
  let labelFilter = '';
  
  // Add include filters (whitelist with +)
  if (includeTypes && includeTypes.length > 0) {
    labelFilter += includeTypes.map(type => `+${type}`).join('|');
  }
  
  // Add exclude filters (blacklist with -)
  if (excludeTypes && excludeTypes.length > 0) {
    if (labelFilter) labelFilter += '|';
    labelFilter += excludeTypes.map(type => `-${type}`).join('|');
  }
  
  return labelFilter || '>Memory'; // Default to Memory label if no filters
}

/**
 * Generates a relationship filter query string for Cypher
 * @param includeRelationships - Relationships to include
 * @returns Formatted relationship filter string for APOC procedures
 */
function generateRelationshipFilterQuery(includeRelationships: string[]): string {
  if (includeRelationships && includeRelationships.length > 0) {
    return includeRelationships.join('|');
  }
  return '>'; // Default to all outgoing relationships
}

/**
 * Processes results from exploration queries into the KnowledgeGraph format
 * @param records - Records from Neo4j query result
 * @returns Knowledge graph with entities and relations
 */
function processExplorationResults(records: any[]): KnowledgeGraph {
  // Initialize result arrays
  const entities: Entity[] = [];
  const relations: Relation[] = [];
  
  // Track processed nodes and relationships to avoid duplicates
  const processedNodeIds = new Set<string>();
  const processedRelIds = new Set<string>();
  
  for (const record of records) {
    // Handle both direct node objects and node arrays
    const nodes = record.nodes || [];
    const relationships = record.relationships || [];
    
    // Process nodes to Entity format
    for (const node of nodes) {
      if (!node) continue; // Skip null/undefined nodes
      
      const nodeId = typeof node.identity === 'object' ? node.identity.toString() : node.identity;
      
      if (processedNodeIds.has(nodeId)) continue; // Skip already processed nodes
      processedNodeIds.add(nodeId);
      
      const entity: Entity = {
        name: node.properties.name,
        entityType: node.properties.nodeType || 'Entity',
        observations: node.properties.observations || []
      };
      
      // Add additional properties based on entity type
      if (node.properties.nodeType === 'Entity') {
        (entity as any).description = node.properties.description;
        (entity as any).biography = node.properties.biography;
        (entity as any).keyContributions = node.properties.keyContributions;
      } 
      else if (node.properties.nodeType === 'Event') {
        (entity as any).startDate = node.properties.startDate;
        (entity as any).endDate = node.properties.endDate;
        (entity as any).location = node.properties.location;
        (entity as any).participants = node.properties.participants;
        (entity as any).outcome = node.properties.outcome;
      } 
      else if (node.properties.nodeType === 'Concept') {
        (entity as any).definition = node.properties.definition;
        (entity as any).domain = node.properties.domain;
        (entity as any).examples = node.properties.examples;
      }
      // Add all other properties generically
      for (const key in node.properties) {
        if (!entity.hasOwnProperty(key) && key !== 'name' && key !== 'entityType' && key !== 'observations') {
          (entity as any)[key] = node.properties[key];
        }
      }
      
      entities.push(entity);
    }
    
    // Process relationships to Relation format
    for (const rel of relationships) {
      if (!rel) continue; // Skip null/undefined relationships
      
      const relId = typeof rel.identity === 'object' ? rel.identity.toString() : rel.identity;
      
      if (processedRelIds.has(relId)) continue; // Skip already processed relationships
      processedRelIds.add(relId);
      
      // Get source and target nodes
      const sourceNode = nodes.find(n => 
        (n.identity.equals && n.identity.equals(rel.start)) || 
        n.identity === rel.start
      );
      
      const targetNode = nodes.find(n => 
        (n.identity.equals && n.identity.equals(rel.end)) || 
        n.identity === rel.end
      );
      
      if (!sourceNode || !targetNode) {
        console.error(`Could not find nodes for relationship: ${rel.type}`);
        continue;
      }
      
      const relation: Relation = {
        from: sourceNode.properties.name,
        to: targetNode.properties.name,
        relationType: rel.type
      };
      
      // Add all additional properties
      for (const key in rel.properties) {
        if (key !== 'from' && key !== 'to' && key !== 'relationType') {
          (relation as any)[key] = rel.properties[key];
        }
      }
      
      relations.push(relation);
    }
  }
  
  // Log the results
  console.error(`Found ${entities.length} entities and ${relations.length} relations`);
  
  return { entities, relations };
}

/**
 * Find conceptual associations between nodes based on sharing common connections
 */
export async function findConceptualAssociations(
  neo4jDriver: Neo4jDriver,
  nodeName: string,
  options: {
    maxAssociations?: number,
    minSharedConnections?: number,
    nodeTypes?: string[]
  } = {}
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  // Set default options
  const maxAssociations = options.maxAssociations || 10;
  const minSharedConnections = options.minSharedConnections || 2;
  const nodeTypes = options.nodeTypes || [
    'Entity', 'Concept', 'Event', 'ScientificInsight', 
    'Law', 'Thought', 'ReasoningChain', 'ReasoningStep',
    'Attribute', 'Proposition', 'Emotion', 'Agent'
  ];
  
  try {
    console.error(`Finding conceptual associations for node: ${nodeName}`);
    console.error(`Max associations: ${maxAssociations}, Min shared: ${minSharedConnections}`);
    console.error(`Node types: ${nodeTypes.join(', ')}`);
    
    const typeFilter = nodeTypes.map(type => `association:${type}`).join(' OR ');
    
    const result = await session.executeRead(tx => tx.run(`
      // Start with the source node
      MATCH (source:Memory {name: $nodeName})
      
      // Find all nodes that share connections with the source node
      MATCH (source)-[r1]-(shared)-[r2]-(association:Memory)
      WHERE association <> source
        AND (${typeFilter})
      
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
      LIMIT $maxAssociations
    `, {
      nodeName,
      minSharedConnections
    }));
    
    console.error(`Found ${result.records.length} conceptual associations`);
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error finding conceptual associations: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Find the shortest cognitive path between two nodes
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
    console.error(`Finding cognitive path from "${startNodeName}" to "${endNodeName}"`);
    console.error(`Max path length: ${maxPathLength}`);
    console.error(`Include types: ${includeTypes.join(', ')}`);
    
    const typeFilter = includeTypes.map(type => `node:${type}`).join(' OR ');
    
    const result = await session.executeRead(tx => tx.run(`
      // Find start and end nodes
      MATCH (start:Memory {name: $startNodeName})
      MATCH (end:Memory {name: $endNodeName})
      
      // Find shortest path, considering relationship weights as costs
      // Use relationship weights to influence traversal cost (lower weight = higher cost)
      CALL apoc.algo.dijkstra(
        start, 
        end, 
        "CONNECTS|RELATES_TO|PART_OF|BELONGS_TO|PRECEDES|FOLLOWS|HAS_ATTRIBUTE|DESCRIBES|HAS_PROPOSITION|FEELS|CREATED_BY|USED_FOR", 
        "weight", 
        $maxPathLength
      ) YIELD path, weight
      
      // Ensure all nodes in path match the type filter
      WHERE all(node in nodes(path) WHERE (${typeFilter}))
      
      // Collect all nodes and relationships in the path
      WITH nodes(path) as pathNodes, relationships(path) as pathRels, weight as pathWeight
      
      UNWIND pathNodes as node
      
      // Get relationships for each node in the path
      WITH DISTINCT node, pathRels, pathWeight
      OPTIONAL MATCH (node)-[outRel]->(connected)
      WITH node, pathRels, pathWeight, collect(outRel) as outRels
      
      OPTIONAL MATCH (other)-[inRel]->(node)
      
      RETURN 
        node as entity, 
        outRels as relations,
        collect(inRel) as inRelations,
        pathWeight as pathCost
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