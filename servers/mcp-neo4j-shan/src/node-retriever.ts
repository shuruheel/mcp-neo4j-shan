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
      
      // Second attempt: Full text search (good balance of speed and relevance)
      try {
        console.error('Trying full text search');
        const fullTextResult = await session.executeRead(tx => tx.run(`
          // Search in all the fields that might contain relevant text
          CALL db.index.fulltext.queryNodes("entityContentIndex", $query) YIELD node, score
          
          // Only get memory nodes and sort by relevance score
          WHERE node:Memory
          WITH node as entity, score
          ORDER BY score DESC
          
          // Get relationships for each matching node
          WITH entity
          OPTIONAL MATCH (entity)-[r]->(other)
          WITH entity, collect(r) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          
          RETURN entity, outRels as relations, collect(inRel) as inRelations
          LIMIT 10
        `, { query: searchQuery }));
        
        searchAttempts.push(`Full text: ${fullTextResult.records.length} results`);
        console.error(`Full text search found ${fullTextResult.records.length} results`);
        
        if (fullTextResult.records.length > 0) {
          return this.processSearchResults(fullTextResult.records);
        }
      } catch (error) {
        // This is expected to fail if the fulltext index doesn't exist
        console.error(`Error in full text search: ${error}`);
        searchAttempts.push(`Full text: error - ${error.message}`);
      }
      
      // Third attempt: Fuzzy name matching (more flexible, catches spelling variations)
      try {
        console.error('Trying fuzzy name matching');
        const fuzzyResult = await session.executeRead(tx => tx.run(`
          MATCH (entity:Memory)
          WHERE entity:Entity OR entity:Concept OR entity:Event OR 
                entity:ScientificInsight OR entity:Law OR entity:Thought OR 
                entity:ReasoningChain OR entity:ReasoningStep
          
          // Use fuzzy matching to find similar node names
          WITH entity, apoc.text.fuzzyMatch(toLower(entity.name), toLower($query)) as score
          WHERE score > 0.7
          ORDER BY score DESC
          
          // Get relationships
          WITH entity
          OPTIONAL MATCH (entity)-[r]->(other)
          WITH entity, collect(r) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          
          RETURN entity, outRels as relations, collect(inRel) as inRelations
          LIMIT 10
        `, { query: searchQuery }));
        
        searchAttempts.push(`Fuzzy name: ${fuzzyResult.records.length} results`);
        console.error(`Fuzzy name matching found ${fuzzyResult.records.length} results`);
        
        if (fuzzyResult.records.length > 0) {
          return this.processSearchResults(fuzzyResult.records);
        }
      } catch (error) {
        console.error(`Error in fuzzy name matching: ${error}`);
        searchAttempts.push(`Fuzzy name: error - ${error.message}`);
      }
      
      // Fourth attempt: Content search (looks for the query in node content fields)
      try {
        console.error('Trying content search');
        const contentResult = await session.executeRead(tx => tx.run(`
          MATCH (entity:Memory)
          WHERE 
            // Search in entity/concept/event text fields
            (entity:Entity AND entity.description CONTAINS $query) OR
            (entity:Concept AND (entity.definition CONTAINS $query OR entity.description CONTAINS $query)) OR
            (entity:Event AND entity.description CONTAINS $query) OR
            (entity:ScientificInsight AND (entity.hypothesis CONTAINS $query OR entity.description CONTAINS $query)) OR
            (entity:Law AND entity.content CONTAINS $query) OR
            (entity:Thought AND entity.thoughtContent CONTAINS $query) OR
            (entity:ReasoningChain AND (entity.description CONTAINS $query OR entity.conclusion CONTAINS $query)) OR
            (entity:ReasoningStep AND entity.content CONTAINS $query)
          
          // Get relationships
          WITH entity
          OPTIONAL MATCH (entity)-[r]->(other)
          WITH entity, collect(r) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          
          RETURN entity, outRels as relations, collect(inRel) as inRelations
          LIMIT 10
        `, { query: searchQuery }));
        
        searchAttempts.push(`Content: ${contentResult.records.length} results`);
        console.error(`Content search found ${contentResult.records.length} results`);
        
        if (contentResult.records.length > 0) {
          return this.processSearchResults(contentResult.records);
        }
      } catch (error) {
        console.error(`Error in content search: ${error}`);
        searchAttempts.push(`Content: error - ${error.message}`);
      }
      
      // Final attempt: Relationship context (looks for relationships containing the query)
      try {
        console.error('Trying relationship context search');
        const relationshipResult = await session.executeRead(tx => tx.run(`
          // Match relationships that have context containing the search query
          MATCH (entity:Memory)-[rel]->(other:Memory)
          WHERE rel.context CONTAINS $query
          
          // Get full relationship context
          WITH entity, collect(rel) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          
          RETURN entity, outRels as relations, collect(inRel) as inRelations
          LIMIT 10
        `, { query: searchQuery }));
        
        searchAttempts.push(`Relationship context: ${relationshipResult.records.length} results`);
        console.error(`Relationship context search found ${relationshipResult.records.length} results`);
        
        if (relationshipResult.records.length > 0) {
          return this.processSearchResults(relationshipResult.records);
        }
      } catch (error) {
        console.error(`Error in relationship context search: ${error}`);
        searchAttempts.push(`Relationship context: error - ${error.message}`);
      }
      
      // If no results found through any method
      console.error(`No results found for query "${searchQuery}" after trying multiple methods: ${searchAttempts.join(', ')}`);
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
    reasoningChains?: string[],
    reasoningSteps?: string[],
    fuzzyThreshold?: number
  }): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    const threshold = searchTerms.fuzzyThreshold || 0.7;
    
    try {
      console.error(`Performing fuzzy matching search with threshold ${threshold}`);
      
      // Generate a unique map of search terms to avoid duplicates
      const allSearchTerms = new Map<string, {
        term: string,
        nodeTypes: string[]
      }>();
      
      // Helper function to add search terms for a node type
      const searchNodeType = async (nodeType: string, searchTerms: string[]) => {
        if (!searchTerms || searchTerms.length === 0) return [];
        
        console.error(`Searching for ${nodeType} nodes matching: ${searchTerms.join(', ')}`);
        
        // For each search term, add it to the map with its node type
        searchTerms.forEach(term => {
          if (allSearchTerms.has(term)) {
            // Add this node type to existing term
            allSearchTerms.get(term)!.nodeTypes.push(nodeType);
          } else {
            // Create new entry
            allSearchTerms.set(term, {
              term,
              nodeTypes: [nodeType]
            });
          }
        });
      };
      
      // Add search terms for each node type
      if (searchTerms.entities) await searchNodeType('Entity', searchTerms.entities);
      if (searchTerms.concepts) await searchNodeType('Concept', searchTerms.concepts);
      if (searchTerms.events) await searchNodeType('Event', searchTerms.events);
      if (searchTerms.scientificInsights) await searchNodeType('ScientificInsight', searchTerms.scientificInsights);
      if (searchTerms.laws) await searchNodeType('Law', searchTerms.laws);
      if (searchTerms.thoughts) await searchNodeType('Thought', searchTerms.thoughts);
      // Add new node types
      if (searchTerms.reasoningChains) await searchNodeType('ReasoningChain', searchTerms.reasoningChains);
      if (searchTerms.reasoningSteps) await searchNodeType('ReasoningStep', searchTerms.reasoningSteps);
      
      // If no search terms provided, return empty result
      if (allSearchTerms.size === 0) {
        console.error('No search terms provided');
        return { entities: [], relations: [] };
      }
      
      // Convert map values to array for processing
      const searchTermArray = Array.from(allSearchTerms.values());
      console.error(`Searching for ${searchTermArray.length} unique terms across multiple node types`);
      
      // Execute search for all terms
      const result = await session.executeRead(tx => tx.run(`
        // Find nodes that match the search terms with fuzzy matching
        UNWIND $searchTerms as searchItem
        MATCH (node:Memory)
        WHERE (
          // Check if node matches any of the specified types for this term
          ANY(nodeType IN searchItem.nodeTypes WHERE node:\${nodeType})
          // And the node name matches the search term with fuzzy matching
          AND apoc.text.fuzzyMatch(node.name, searchItem.term) > $threshold
        )
        
        // Get relationships for matching nodes
        WITH DISTINCT node
        OPTIONAL MATCH (node)-[r]->(other)
        WITH node, collect(r) as outRelations
        OPTIONAL MATCH (other)-[inRel]->(node)
        
        // Return nodes and their relationships
        RETURN node, outRelations as relations, collect(inRel) as inRelations
      `, { 
        searchTerms: searchTermArray,
        threshold
      }));
      
      console.error(`Found ${result.records.length} matching nodes`);
      
      return this.processSearchResults(result.records);
    } catch (error) {
      console.error(`Error in fuzzy matching search: ${error}`);
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

  async getReasoningChain(chainName: string): Promise<{
    chain: any,
    steps: any[]
  }> {
    const session = this.neo4jDriver.session();
    
    try {
      console.error(`Retrieving reasoning chain: ${chainName}`);
      
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
        throw new Error(`ReasoningChain ${chainName} not found`);
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
      
      return { chain, steps };
    } catch (error) {
      console.error(`Error retrieving reasoning chain:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async getReasoningChainsForThought(thoughtName: string): Promise<{
    thought: any,
    chains: any[]
  }> {
    const session = this.neo4jDriver.session();
    
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

  async getReasoningStepDetails(stepName: string): Promise<{
    step: any,
    supportingReferences: any[],
    previousSteps: any[],
    nextSteps: any[]
  }> {
    const session = this.neo4jDriver.session();
    
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

  async findReasoningChainsWithSimilarConclusion(conclusion: string, limit: number = 5): Promise<any[]> {
    const session = this.neo4jDriver.session();
    
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
        limit: neo4j.int(limit)
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

  async getReasoningAnalytics(): Promise<{
    totalChains: number,
    totalSteps: number,
    methodologyDistribution: Record<string, number>,
    averageStepsPerChain: number,
    topChainsByStepCount: any[]
  }> {
    const session = this.neo4jDriver.session();
    
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
}
  