import { Driver as Neo4jDriver } from 'neo4j-driver';
import { KnowledgeGraph, Entity, Relation } from '../../types/index.js';

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
  nodeName: string, 
  maxDepth: number = 2, 
  minWeight: number = 0.0
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  try {
    // Enhanced Cypher query that uses relationship weights for traversal costs
    const query = `
      // First find the starting node
      MATCH (start:Memory {name: $nodeName})
      
      // Use variable-length path with weighted cost traversal
      CALL apoc.path.expandConfig(start, {
        relationshipFilter: ">"  // All relationship types, outgoing direction
        , labelFilter: ">Memory" // Only follow relationships to Memory nodes
        , uniqueness: "NODE_GLOBAL"  // Avoid cycles
        , bfs: false             // Depth-first for better exploration
        , limit: 100             // Limit total results
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
    
    // Execute the query and get the result
    const result = await session.executeRead(tx =>
      tx.run(query, { 
        nodeName,
        maxDepth,
        minWeight
      })
    );
    
    // Process the result
    if (result.records.length === 0) {
      console.error(`No nodes found with name: ${nodeName}`);
      return { entities: [], relations: [] };
    }
    
    // Extract nodes and relationships from the result
    const record = result.records[0];
    const nodes = record.get('nodes') || [];
    const relationships = record.get('relationships') || [];
    
    // Convert to Entity[] and Relation[] format
    // Process nodes to Entity format
    const entities: Entity[] = [];
    const processedNodeIds = new Set<string>();
    
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
    const relations: Relation[] = [];
    const processedRelIds = new Set<string>();
    
    for (const rel of relationships) {
      if (!rel) continue; // Skip null/undefined relationships
      
      const relId = typeof rel.identity === 'object' ? rel.identity.toString() : rel.identity;
      
      if (processedRelIds.has(relId)) continue; // Skip already processed relationships
      processedRelIds.add(relId);
      
      // Get source and target nodes
      const sourceNode = nodes.find(n => n.identity.equals(rel.start));
      const targetNode = nodes.find(n => n.identity.equals(rel.end));
      
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
    
    // Log the results
    console.error(`Found ${entities.length} entities and ${relations.length} relations for node: ${nodeName}`);
    
    return { entities, relations };
  } catch (error) {
    console.error(`Error in exploreContextWeighted: ${error}`);
    return { entities: [], relations: [] };
  } finally {
    await session.close();
  }
}

/**
 * DEPRECATED - Use exploreContextWeighted instead.
 * 
 * This method explores the context around a node without considering relationship weights,
 * which can lead to less effective exploration as weak and strong relationships are treated equally.
 * 
 * @deprecated Since version 1.0.1. Use exploreContextWeighted instead.
 * @param neo4jDriver - Neo4j driver instance
 * @param nodeName - The name of the node to explore context around
 * @param maxDepth - Maximum traversal depth (default: 2)
 * @returns A promise resolving to a KnowledgeGraph with nodes and relationships
 */
export async function exploreContext(
  neo4jDriver: Neo4jDriver,
  nodeName: string, 
  maxDepth: number = 2
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Exploring context for node: "${nodeName}" with maxDepth: ${maxDepth}`);
    
    // Use case-insensitive search from the start
    const nodeCheck = await session.executeRead(tx => tx.run(`
      MATCH (n:Memory)
      WHERE toLower(n.name) = toLower($nodeName)
      RETURN n
    `, { nodeName }));
    
    if (nodeCheck.records.length === 0) {
      console.error(`No node found with name "${nodeName}" (case-insensitive check)`);
      return { entities: [], relations: [] };
    }
    
    // Use the actual node name with correct casing
    const actualNodeName = nodeCheck.records[0].get('n').properties.name;
    console.error(`Found node: "${actualNodeName}"`);
    
    // SIMPLIFIED APPROACH: Same as exploreContextWeighted but without weight filtering
    // 1. First get all nodes within the specified depth
    // 2. Then separately get ALL relationships between ANY of these nodes
    
    // Step 1: Get all nodes within specified depth
    const nodesResult = await session.executeRead(tx => tx.run(`
      // Get the center node
      MATCH (center:Memory {name: $nodeName})
      
      // Find all nodes within maxDepth
      CALL {
        MATCH (center)-[*1..${maxDepth}]-(related:Memory)
        RETURN related as node
      }
      
      // Return all nodes including the center node
      RETURN collect(DISTINCT center) + collect(DISTINCT node) as allNodes
    `, { 
      nodeName: actualNodeName
    }));
    
    if (nodesResult.records.length === 0) {
      console.error(`No nodes found in context of "${actualNodeName}"`);
      return { entities: [], relations: [] };
    }
    
    // Process nodes from the first step
    const nodesArray = nodesResult.records[0].get('allNodes');
    const entities: Entity[] = [];
    const uniqueNodeIds = new Set();
    const nodeNames: string[] = [];
    
    // Build entities and collect node names for relationship query
    if (Array.isArray(nodesArray)) {
      nodesArray.forEach(node => {
        if (node && node.properties && node.properties.name) {
          const nodeId = node.elementId || node.identity.toString();
          if (!uniqueNodeIds.has(nodeId)) {
            // Add to entity list
            entities.push({
              name: node.properties.name,
              entityType: node.properties.nodeType || 'Entity',
              observations: node.properties.observations || []
            });
            
            // Track for deduplication
            uniqueNodeIds.add(nodeId);
            
            // Store name for relationship query
            nodeNames.push(node.properties.name);
          }
        }
      });
    }
    
    console.error(`Found ${entities.length} nodes in context exploration`);
    
    // If no nodes found, return empty results
    if (entities.length === 0) {
      return { entities: [], relations: [] };
    }
    
    // Step 2: Get ALL relationships between these nodes explicitly by name
    // Without weight filtering for regular context exploration
    const relsResult = await session.executeRead(tx => tx.run(`
      // Use node names to match exact nodes
      WITH $nodeNames as names
      MATCH (a:Memory)
      WHERE a.name IN names
      MATCH (b:Memory)
      WHERE b.name IN names AND a.name <> b.name
      
      // Get relationships in both directions
      OPTIONAL MATCH (a)-[r]->(b)
      
      // Return detailed relationship data for all relationships
      WITH a, b, r
      WHERE r IS NOT NULL
      
      RETURN collect({
        rel: r,
        fromName: a.name,
        toName: b.name,
        relType: type(r),
        props: properties(r)
      }) as relationshipData
    `, { 
      nodeNames: nodeNames
    }));
    
    // Process relationships
    const relations: Relation[] = [];
    const uniqueRelIds = new Set();
    
    if (relsResult.records.length > 0) {
      const relationshipDataArray = relsResult.records[0].get('relationshipData');
      
      if (Array.isArray(relationshipDataArray)) {
        console.error(`Found ${relationshipDataArray.length} relationships to process`);
        
        relationshipDataArray.forEach(relData => {
          try {
            if (!relData || !relData.rel) return;
            
            const rel = relData.rel;
            const relId = rel.elementId || rel.identity.toString();
            
            // Only process relationships with valid node names
            if (!uniqueRelIds.has(relId) && relData.fromName && relData.toName) {
              // Create relation object with all properties
              const relation: Relation = {
                from: relData.fromName,
                to: relData.toName,
                relationType: relData.relType || 'RELATED_TO',
                ...relData.props
              };
              
              relations.push(relation);
              uniqueRelIds.add(relId);
              
              console.error(`Added relation: ${relation.from} -[${relation.relationType}]-> ${relation.to}`);
            }
          } catch (relError) {
            console.error(`Error processing relationship data: ${relError}`);
          }
        });
      }
    }
    
    // Log detailed counts for debugging
    console.error(`Retrieved ${entities.length} entities and ${relations.length} relationships`);
    return { entities, relations };
  } catch (error) {
    console.error(`Error exploring context: ${error}`);
    return { entities: [], relations: [] };
  } finally {
    await session.close();
  }
} 