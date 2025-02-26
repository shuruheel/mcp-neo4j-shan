import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

import neo4j, { Integer, Node, Relationship, Driver as Neo4jDriver, DateTime } from 'neo4j-driver'

import { KnowledgeGraphMemory, Entity, KnowledgeGraph, Relation } from "@neo4j/graphrag-memory";

// Import shared types and interfaces from node-creator if needed
// If these are duplicated, consider moving them to a shared types file
import { 
  BaseNode, EnhancedEntity, Event, Concept, Thought, ScientificInsight, Law,
  KnowledgeNode, EntityNode, EnhancedRelation, EntityRelationship, EntityWithRelationsResult,
  CustomKnowledgeGraphMemory, RelationshipCategory
} from './node-creator';

/**
 * Neo4jRetriever - Graph retrieval functionality optimized for cognitive science principles
 * 
 * This class implements knowledge graph traversal and retrieval strategies based on
 * cognitive science principles. The key features include:
 * 
 * 1. Weighted Relationship Traversal - Relationships with higher weights are traversed
 *    first, prioritizing the most significant cognitive connections and mimicking how
 *    human memory retrieves information by importance
 * 
 * 2. Relationship Categorization - Supports different types of relationships:
 *    - Hierarchical (taxonomic, parent-child)
 *    - Lateral (associative, similarity-based)
 *    - Temporal (sequential, causal)
 *    - Compositional (part-whole, component relationships)
 * 
 * 3. Context-Enhanced Relationships - Includes rich contextual information and memory
 *    aids to support recall and comprehension
 * 
 * 4. Temporal Sequence Retrieval - Specialized traversal for time-based relationships
 * 
 * The implementation uses Neo4j's path traversal with custom cost functions based on 
 * relationship weights, making stronger relationships "cheaper" to traverse while making
 * weak relationships "expensive", effectively prioritizing the retrieval of the most
 * cognitively significant paths.
 */
export class Neo4jRetriever {
    constructor(private neo4jDriver: Neo4jDriver) { }
  
  // Private helper method to load graph
    private async loadGraph(): Promise<KnowledgeGraph> {
      const session = this.neo4jDriver.session()
  
      try {
        // Execute a Cypher statement in a Read Transaction that matches all node types
        const res = await session.executeRead(tx => tx.run<EntityWithRelationsResult>(`
          MATCH (entity)
          WHERE entity:Entity OR entity:Event OR entity:Concept OR entity:ScientificInsight OR entity:Law OR entity:Thought
          OPTIONAL MATCH (entity)-[r]->(other)
          RETURN entity, collect(r) as relations
        `))
        
        const kgMemory:KnowledgeGraph = res.records.reduce(
          (kg, row) => {
            const entityNode = row.get('entity');
            const entityRelationships = row.get('relations');
  
            // Convert Neo4j node to Entity format
            const entity: Entity = {
              name: entityNode.properties.name,
              entityType: entityNode.properties.nodeType || 'Entity',
              observations: 'observations' in entityNode.properties ? 
                entityNode.properties.observations : []
            };
  
            kg.entities.push(entity);
            kg.relations.push(...entityRelationships.map(r => r.properties as Relation))
            return kg
          }, 
          ({entities:[], relations:[]} as KnowledgeGraph)
        )
    
        console.error(JSON.stringify(kgMemory.entities))
        console.error(JSON.stringify(kgMemory.relations))
  
        return kgMemory
      } catch (error) {
        console.error(error)
      }
      finally {
        // Close the Session
        await session.close()
      }
      
      return {
        entities: [],
        relations: []    
      };
    }

  // Main public methods for graph retrieval and querying
  async robustSearch(searchQuery: string): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    
    try {
      console.error(`Performing robust search for query: "${searchQuery}"`);
      
      // Check if query is empty or too short
      if (!searchQuery || searchQuery.trim().length < 1) {
        console.error('Search query is empty or too short');
        return { entities: [], relations: [] };
      }
      
      let results = { entities: [], relations: [] };
      const searchAttempts = [];
      
      // First attempt: Exact match (fastest and most precise)
      try {
        console.error('Trying exact match search');
        const exactMatchResult = await session.executeRead(tx => tx.run(`
          MATCH (entity:Memory)
          WHERE entity.name = $query
          
          // Get relationships
          WITH entity
          OPTIONAL MATCH (entity)-[r]->(other)
          WITH entity, collect(r) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          
          RETURN entity, outRels as relations, collect(inRel) as inRelations
        `, { query: searchQuery }));
        
        searchAttempts.push(`Exact match: ${exactMatchResult.records.length} results`);
        console.error(`Exact match search found ${exactMatchResult.records.length} results`);
        
        if (exactMatchResult.records.length > 0) {
          return this.processSearchResults(exactMatchResult.records);
        }
      } catch (error) {
        console.error(`Error in exact match search: ${error}`);
        searchAttempts.push(`Exact match: error - ${error.message}`);
      }
      
      // Second attempt: Case-insensitive exact match
      try {
        console.error('Trying case-insensitive exact match');
        const caseInsensitiveExactResult = await session.executeRead(tx => tx.run(`
          MATCH (entity:Memory)
          WHERE toLower(entity.name) = toLower($query)
          
          // Get relationships
          WITH entity
          OPTIONAL MATCH (entity)-[r]->(other)
          WITH entity, collect(r) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          
          RETURN entity, outRels as relations, collect(inRel) as inRelations
        `, { query: searchQuery }));
        
        searchAttempts.push(`Case-insensitive exact match: ${caseInsensitiveExactResult.records.length} results`);
        console.error(`Case-insensitive exact match found ${caseInsensitiveExactResult.records.length} results`);
        
        if (caseInsensitiveExactResult.records.length > 0) {
          return this.processSearchResults(caseInsensitiveExactResult.records);
        }
      } catch (error) {
        console.error(`Error in case-insensitive exact match search: ${error}`);
        searchAttempts.push(`Case-insensitive exact match: error - ${error.message}`);
      }
      
      // Third attempt: String containment search
      try {
        console.error('Trying string containment search');
        const containmentResult = await session.executeRead(tx => tx.run(`
          MATCH (entity:Memory)
          WHERE toLower(entity.name) CONTAINS toLower($query)
             OR (entity.content IS NOT NULL AND toLower(entity.content) CONTAINS toLower($query))
             OR (entity.definition IS NOT NULL AND toLower(entity.definition) CONTAINS toLower($query))
             OR (entity.nodeType = 'Entity' AND entity.observations IS NOT NULL AND 
                 any(obs IN entity.observations WHERE obs IS NOT NULL AND toLower(obs) CONTAINS toLower($query)))
          
          // Get relationships
          WITH entity
          OPTIONAL MATCH (entity)-[r]->(other)
          WITH entity, collect(r) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          
          RETURN entity, outRels as relations, collect(inRel) as inRelations
          LIMIT 20
        `, { query: searchQuery }));
        
        searchAttempts.push(`String containment: ${containmentResult.records.length} results`);
        console.error(`String containment search found ${containmentResult.records.length} results`);
        
        if (containmentResult.records.length > 0) {
          return this.processSearchResults(containmentResult.records);
        }
      } catch (error) {
        console.error(`Error in containment search: ${error}`);
        searchAttempts.push(`String containment: error - ${error.message}`);
      }
      
      // Fourth attempt: Token-based search (split query into tokens and search for each)
      try {
        console.error('Trying token-based search');
        const tokens = searchQuery.split(/\s+/).filter(token => token.length > 2);
        
        if (tokens.length > 0) {
          const tokenQuery = `
            MATCH (entity:Memory)
            WHERE 
              ${tokens.map((_, i) => `
                toLower(entity.name) CONTAINS toLower($token${i})
                OR (entity.content IS NOT NULL AND toLower(entity.content) CONTAINS toLower($token${i}))
                OR (entity.definition IS NOT NULL AND toLower(entity.definition) CONTAINS toLower($token${i}))
              `).join(' OR ')}
            
            // Get relationships
            WITH entity
            OPTIONAL MATCH (entity)-[r]->(other)
            WITH entity, collect(r) as outRels
            OPTIONAL MATCH (other)-[inRel]->(entity)
            
            RETURN entity, outRels as relations, collect(inRel) as inRelations
            LIMIT 20
          `;
          
          const params = {};
          tokens.forEach((token, i) => {
            params[`token${i}`] = token;
          });
          
          const tokenResult = await session.executeRead(tx => tx.run(tokenQuery, params));
          
          searchAttempts.push(`Token-based search: ${tokenResult.records.length} results`);
          console.error(`Token-based search found ${tokenResult.records.length} results`);
          
          if (tokenResult.records.length > 0) {
            return this.processSearchResults(tokenResult.records);
          }
        }
      } catch (error) {
        console.error(`Error in token-based search: ${error}`);
        searchAttempts.push(`Token-based search: error - ${error.message}`);
      }
      
      // Log all search attempts to help diagnose issues
      console.error(`All search attempts exhausted: ${searchAttempts.join(', ')}`);
      
      // Return empty results if nothing found
      return { entities: [], relations: [] };
    } catch (error) {
      console.error(`Error in robust search: ${error}`);
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }
  
  private processSearchResults(records: any[]): KnowledgeGraph {
    const entities: Entity[] = [];
    const relations: Relation[] = [];
    
    console.error(`Processing ${records.length} search result records`);
    
    records.forEach(record => {
      const entityNode = record.get('entity');
      const outRelationships = record.get('relations');
      const inRelationships = record.get('inRelations');
      
      if (!entityNode || !entityNode.properties || !entityNode.properties.name) {
        console.error('Skipping record with missing entity node');
        return;
      }
      
      // Convert Neo4j node to Entity format
      const entity: Entity = {
        name: entityNode.properties.name,
        entityType: entityNode.properties.nodeType || 'Entity',
        observations: 'observations' in entityNode.properties ? 
          entityNode.properties.observations : []
      };
      
      // Add to entities if not already included
      if (!entities.some(e => e.name === entity.name)) {
        entities.push(entity);
        console.error(`Added entity: ${entity.name} (${entity.entityType})`);
      }
      
      // Process outgoing relationships
      if (outRelationships && Array.isArray(outRelationships)) {
        console.error(`Processing ${outRelationships.length} outgoing relationships for ${entity.name}`);
        
        outRelationships.forEach(rel => {
          try {
            if (!rel) return;
            
            // Try to get relationship properties directly first
            let relationProps: any = {};
            
            // Access properties safely in different ways depending on what's available
            if (rel.properties) {
              relationProps = rel.properties;
            } else if (typeof rel.toObject === 'function') {
              relationProps = rel.toObject();
            } else if (rel.attributes) {
              relationProps = rel.attributes;
            }
            
            // Get relationship type
            const relType = rel.type || relationProps.relationType || 'RELATED_TO';
            
            // Get from and to nodes if possible
            let fromName = '';
            let toName = '';
            
            // Try to get from/to from relationship object
            if (rel.startNode && rel.startNode.properties && rel.startNode.properties.name) {
              fromName = rel.startNode.properties.name;
            } else {
              // If not available directly, use the entity name as the source
              fromName = entity.name;
            }
            
            if (rel.endNode && rel.endNode.properties && rel.endNode.properties.name) {
              toName = rel.endNode.properties.name;
            } else if (relationProps.to) {
              // If endNode not available but 'to' is in properties
              toName = relationProps.to;
            }
            
            // Only add relationship if we have both from and to names
            if (fromName && toName) {
              const relation: Relation = {
                from: fromName,
                to: toName,
                relationType: relType,
                ...relationProps
              };
              
              // Add if unique
              if (!relations.some(r => 
                r.from === relation.from && 
                r.to === relation.to && 
                r.relationType === relation.relationType
              )) {
                relations.push(relation);
                console.error(`Added outgoing relation: ${relation.from} -[${relation.relationType}]-> ${relation.to}`);
              }
            } else {
              console.error(`Skipping relationship with missing from/to names: ${relType}`);
            }
          } catch (error) {
            console.error(`Error processing outgoing relationship: ${error.message}`);
          }
        });
      }
      
      // Process incoming relationships
      if (inRelationships && Array.isArray(inRelationships)) {
        console.error(`Processing ${inRelationships.length} incoming relationships for ${entity.name}`);
        
        inRelationships.forEach(rel => {
          try {
            if (!rel) return;
            
            // Try to get relationship properties directly first
            let relationProps: any = {};
            
            // Access properties safely
            if (rel.properties) {
              relationProps = rel.properties;
            } else if (typeof rel.toObject === 'function') {
              relationProps = rel.toObject();
            } else if (rel.attributes) {
              relationProps = rel.attributes;
            }
            
            // Get relationship type
            const relType = rel.type || relationProps.relationType || 'RELATED_TO';
            
            // Get from and to nodes if possible
            let fromName = '';
            let toName = '';
            
            // Try to get from/to from relationship object
            if (rel.startNode && rel.startNode.properties && rel.startNode.properties.name) {
              fromName = rel.startNode.properties.name;
            } else if (relationProps.from) {
              fromName = relationProps.from;
            }
            
            if (rel.endNode && rel.endNode.properties && rel.endNode.properties.name) {
              toName = rel.endNode.properties.name;
            } else {
              // If not available directly, use the entity name as the target
              toName = entity.name;
            }
            
            // Only add relationship if we have both from and to names
            if (fromName && toName) {
              const relation: Relation = {
                from: fromName,
                to: toName,
                relationType: relType,
                relationDirection: 'incoming',
                ...relationProps
              };
              
              // Add if unique
              if (!relations.some(r => 
                r.from === relation.from && 
                r.to === relation.to && 
                r.relationType === relation.relationType
              )) {
                relations.push(relation);
                console.error(`Added incoming relation: ${relation.from} -[${relation.relationType}]-> ${relation.to}`);
              }
            } else {
              console.error(`Skipping relationship with missing from/to names: ${relType}`);
            }
          } catch (error) {
            console.error(`Error processing incoming relationship: ${error.message}`);
          }
        });
      }
    });
    
    console.error(`Search results processed: ${entities.length} entities, ${relations.length} relationships`);
    return { entities, relations };
  }

  /**
   * Explore context around a node with prioritization based on relationship weights
   * 
   * This method is the primary way to explore the knowledge graph context, implementing
   * a cognitive-science based traversal strategy that mimics how human memory works:
   * - Stronger/more important connections are traversed first
   * - Relationship weights determine traversal cost (higher weight = lower cost)
   * - Weak connections require higher "cognitive effort" to traverse
   * 
   * The implementation uses Neo4j's apoc.path.expandConfig with a custom cost evaluator
   * that makes high-weight relationships cheaper to traverse and low-weight relationships
   * more expensive. This mimics how human memory tends to recall strongly associated
   * information more readily than weak associations.
   * 
   * @param nodeName - The name of the node to explore context around
   * @param maxDepth - Maximum number of relationship hops to traverse (default: 2)
   * @param minWeight - Minimum relationship weight to include (default: 0.0, range: 0.0-1.0)
   * @returns A promise resolving to a KnowledgeGraph with nodes and relationships
   */
  async exploreContextWeighted(nodeName: string, maxDepth: number = 2, minWeight: number = 0.0): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    
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
   * The newer exploreContextWeighted method provides a more cognitively aligned exploration
   * strategy by prioritizing stronger relationships first.
   * 
   * @deprecated Since version 1.0.1. Will be removed in a future version.
   * @param nodeName - The name of the node to explore context around
   * @param maxDepth - Maximum traversal depth (default: 2)
   * @returns A promise resolving to a KnowledgeGraph with nodes and relationships
   */
  async exploreContext(nodeName: string, maxDepth: number = 2): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    
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

  // Search methods
  async searchNodes(query: string): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    
    try {
      // Execute a more comprehensive search query using fulltext search
      const res = await session.executeRead(tx => tx.run(`
        // First find matching nodes based on text properties
        MATCH (entity)
        WHERE entity.name CONTAINS $query
           OR entity.entityType CONTAINS $query
           OR any(obs IN entity.observations WHERE obs CONTAINS $query)
           OR entity.definition CONTAINS $query
           OR any(ex IN entity.examples WHERE ex CONTAINS $query)
           OR entity.statement CONTAINS $query
           OR entity.hypothesis CONTAINS $query
           OR entity.content CONTAINS $query
        
        // Get all relationships directly connected to matching nodes
        WITH entity
        OPTIONAL MATCH (entity)-[r]->(other)
        
        // Also get relationships where the node is the target
        WITH entity, collect(r) as outRels
        OPTIONAL MATCH (other)-[inRel]->(entity)
        
        // Return the node, outgoing relationships, and incoming relationships
        RETURN entity, outRels as relations, collect(inRel) as inRelations
      `, { query }));
      
      const kgMemory: KnowledgeGraph = {entities: [], relations: []};
      
      res.records.forEach(record => {
        const entityNode = record.get('entity');
        const outRelationships = record.get('relations') as Relationship[];
        const inRelationships = record.get('inRelations') as Relationship[];
        
        // Convert Neo4j node to Entity format
        const entity: Entity = {
          name: entityNode.properties.name,
          entityType: entityNode.properties.nodeType || 'Entity',
          observations: 'observations' in entityNode.properties ? 
            entityNode.properties.observations : []
        };
        
        kgMemory.entities.push(entity);
        
        // Add outgoing relationships
        if (outRelationships && Array.isArray(outRelationships)) {
          outRelationships.forEach(rel => {
            if (rel && rel.properties) {
              kgMemory.relations.push(rel.properties as unknown as Relation);
            }
          });
        }
        
        // Add incoming relationships with direction marked
        if (inRelationships && Array.isArray(inRelationships)) {
          inRelationships.forEach(rel => {
            if (rel && rel.properties) {
              const incomingRel = {
                ...rel.properties as unknown as Relation,
                relationDirection: 'incoming'
              };
              kgMemory.relations.push(incomingRel);
            }
          });
        }
      });
      
      return kgMemory;
    } catch (error) {
      console.error("Error searching nodes:", error);
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }

  async searchNodesWithFuzzyMatching(searchTerms: {
    entities?: string[],
    concepts?: string[],
    events?: string[],
    scientificInsights?: string[],
    laws?: string[],
    thoughts?: string[],
    fuzzyThreshold?: number
  }): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    const threshold = searchTerms.fuzzyThreshold || 0.7; // Default threshold
    
    try {
      // Initialize results arrays
      let matchedEntities: Entity[] = [];
      let matchedRelations: Relation[] = [];
      
      // Function to run fuzzy search for a specific node type
      const searchNodeType = async (nodeType: string, searchTerms: string[]) => {
        if (!searchTerms || searchTerms.length === 0) return;
        
        // Execute fuzzy search against specific node type
        const result = await session.executeRead(tx => tx.run(`
          MATCH (entity:Memory)
          WHERE entity.nodeType = $nodeType
          
          // For each search term, check for fuzzy matches
          WITH entity, [term in $searchTerms | 
            CASE
              WHEN apoc.text.fuzzyMatch(entity.name, term) > $threshold THEN 
                apoc.text.fuzzyMatch(entity.name, term) * 2
              WHEN entity.content IS NOT NULL AND apoc.text.fuzzyMatch(entity.content, term) > $threshold THEN
                apoc.text.fuzzyMatch(entity.content, term) * 1.5
              WHEN entity.definition IS NOT NULL AND apoc.text.fuzzyMatch(entity.definition, term) > $threshold THEN
                apoc.text.fuzzyMatch(entity.definition, term) * 1.5
              ELSE 0
            END
          ] AS scores
          
          // Calculate overall match score
          WITH entity, reduce(s = 0, score in scores | CASE WHEN score > s THEN score ELSE s END) as matchScore
          
          // Filter and order by score
          WHERE matchScore > 0
          ORDER BY matchScore DESC
          
          // Get relationships
          WITH entity
          OPTIONAL MATCH (entity)-[r]->(other)
          WITH entity, collect(r) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          
          RETURN entity, outRels as relations, collect(inRel) as inRelations
        `, { nodeType, searchTerms, threshold }));
        
        // Process results
        result.records.forEach(record => {
          const entityNode = record.get('entity');
          const outRelationships = record.get('relations');
          const inRelationships = record.get('inRelations');
          
          // Convert Neo4j node to Entity format
          const entity: Entity = {
            name: entityNode.properties.name,
            entityType: entityNode.properties.nodeType || 'Entity',
            observations: 'observations' in entityNode.properties ? 
              entityNode.properties.observations : []
          };
          
          // Add to matched entities if not already included
          if (!matchedEntities.some(e => e.name === entity.name)) {
            matchedEntities.push(entity);
          }
          
          // Add outgoing relationships
          if (outRelationships && Array.isArray(outRelationships)) {
            outRelationships.forEach(rel => {
              if (rel && rel.properties) {
                const relation = rel.properties as unknown as Relation;
                if (!matchedRelations.some(r => 
                  r.from === relation.from && 
                  r.to === relation.to && 
                  r.relationType === relation.relationType
                )) {
                  matchedRelations.push(relation);
                }
              }
            });
          }
          
          // Add incoming relationships
          if (inRelationships && Array.isArray(inRelationships)) {
            inRelationships.forEach(rel => {
              if (rel && rel.properties) {
                const relation = {
                  ...rel.properties as unknown as Relation,
                  relationDirection: 'incoming'
                };
                if (!matchedRelations.some(r => 
                  r.from === relation.from && 
                  r.to === relation.to && 
                  r.relationType === relation.relationType
                )) {
                  matchedRelations.push(relation);
                }
              }
            });
          }
        });
      };
      
      // Execute search for each node type with corresponding search terms
      await searchNodeType('Entity', searchTerms.entities || []);
      await searchNodeType('Concept', searchTerms.concepts || []);
      await searchNodeType('Event', searchTerms.events || []);
      await searchNodeType('ScientificInsight', searchTerms.scientificInsights || []);
      await searchNodeType('Law', searchTerms.laws || []);
      await searchNodeType('Thought', searchTerms.thoughts || []);
      
      return {
        entities: matchedEntities,
        relations: matchedRelations
      };
    } catch (error) {
      console.error("Error in fuzzy search:", error);
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }

  /**
   * Retrieves a temporal sequence of related events and concepts starting from a given node.
   * This implements the feature from the roadmap to visualize temporal sequences.
   * 
   * Based on cognitive science principles, this method:
   * 1. Recognizes that temporal relationships are fundamental to human cognition and memory
   * 2. Captures causal and sequential relationships between events
   * 3. Orders information chronologically to match how humans naturally organize temporal knowledge
   * 4. Supports both explicit time-based relationships and implicit sequential connections
   * 
   * The implementation aligns with research on episodic memory and event cognition, recognizing
   * that humans organize experiences temporally and understand causality through sequential
   * organization of events.
   * 
   * @param startNodeName - The name of the node to start the temporal sequence from
   * @param direction - The direction of the temporal sequence: 'forward' (later events), 'backward' (earlier events), or 'both'
   * @param maxEvents - Maximum number of events to retrieve in the sequence
   * @returns A promise resolving to an object containing the sequence nodes and their connections
   */
  async getTemporalSequence(
    startNodeName: string, 
    direction: 'forward' | 'backward' | 'both' = 'both',
    maxEvents: number = 10
  ): Promise<{sequence: Entity[], connections: Relation[]}> {
    const session = this.neo4jDriver.session();
    
    try {
      // Build the direction part of the query based on the direction parameter
      let directionClause = '';
      if (direction === 'forward') {
        directionClause = '<-[:PRECEDED_BY|FOLLOWED_BY|CAUSED|RESULTED_IN]-';
      } else if (direction === 'backward') {
        directionClause = '-[:PRECEDED_BY|FOLLOWED_BY|CAUSED|RESULTED_IN]->';
      } else { // 'both'
        directionClause = '-[:PRECEDED_BY|FOLLOWED_BY|CAUSED|RESULTED_IN]-';
      }
      
      // Cypher query to find temporal sequences
      const query = `
        MATCH path = (start:Memory {name: $startNodeName})${directionClause}(related)
        WHERE related:Event OR related:Concept OR related:ScientificInsight
        WITH path, relationships(path) as rels, nodes(path) as nodes
        WHERE all(r IN rels WHERE r.relationshipCategory = 'temporal' OR type(r) IN ['PRECEDED_BY', 'FOLLOWED_BY', 'CAUSED', 'RESULTED_IN'])
        WITH nodes, rels, [node IN nodes WHERE node:Event | node] as eventNodes
        WITH nodes, rels, eventNodes, size(eventNodes) as eventCount
        WHERE eventCount > 0 AND size(nodes) <= $maxEvents
        
        // Order by temporal attributes when available
        WITH nodes, rels,
            [node IN nodes WHERE node:Event AND node.startDate IS NOT NULL | 
              {node: node, date: node.startDate}] as datedNodes
        WITH nodes, rels, datedNodes
        
        // Return both the full sequence and only the events with their start dates
        RETURN nodes, rels, datedNodes
        ORDER BY 
          // First by explicit dates when available
          CASE WHEN size(datedNodes) > 0 
               THEN apoc.coll.min([n IN datedNodes | n.date]) 
               ELSE null 
          END
      `;
      
      const result = await session.executeRead(tx => 
        tx.run(query, { startNodeName, maxEvents })
      );
      
      // Process the results into Entity and Relation objects
      const sequence: Entity[] = [];
      const connections: Relation[] = [];
      
      result.records.forEach(record => {
        const nodes = record.get('nodes');
        const rels = record.get('rels');
        
        // Convert nodes to Entity format
        nodes.forEach((node: any) => {
          const entity: Entity = {
            name: node.properties.name,
            entityType: node.properties.nodeType || 'Entity',
            observations: node.properties.observations || []
          };
          
          // Add temporal properties if available
          if (node.properties.startDate) {
            (entity as any).startDate = node.properties.startDate;
          }
          if (node.properties.endDate) {
            (entity as any).endDate = node.properties.endDate;
          }
          
          // Only add if not already in the sequence
          if (!sequence.some(e => e.name === entity.name)) {
            sequence.push(entity);
          }
        });
        
        // Convert relationships to Relation format
        rels.forEach((rel: any) => {
          const relation: Relation = {
            from: rel.properties.fromName || rel.start.properties.name,
            to: rel.properties.toName || rel.end.properties.name,
            relationType: rel.type
          };
          
          // Add additional properties if available
          if (rel.properties.context) {
            (relation as EnhancedRelation).context = rel.properties.context;
          }
          if (rel.properties.confidenceScore) {
            (relation as EnhancedRelation).confidenceScore = rel.properties.confidenceScore;
          }
          
          // Add new cognitive properties
          if (rel.properties.contextType) {
            (relation as EnhancedRelation).contextType = rel.properties.contextType;
          }
          if (rel.properties.contextStrength) {
            (relation as EnhancedRelation).contextStrength = rel.properties.contextStrength;
          }
          if (rel.properties.relationshipCategory) {
            (relation as EnhancedRelation).relationshipCategory = rel.properties.relationshipCategory;
          }
          
          // Only add if not already in connections
          if (!connections.some(c => 
            c.from === relation.from && 
            c.to === relation.to && 
            c.relationType === relation.relationType)) {
            connections.push(relation);
          }
        });
      });
      
      return { sequence, connections };
    } catch (error) {
      console.error('Error retrieving temporal sequence:', error);
      return { sequence: [], connections: [] };
    } finally {
      await session.close();
    }
  }
}
  