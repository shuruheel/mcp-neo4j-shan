import { Driver as Neo4jDriver } from 'neo4j-driver';
import { KnowledgeGraph, Entity, Relation } from '../../types/index.js';

/**
 * Processes search results into a standardized KnowledgeGraph format
 * @param records - The records returned from a Neo4j query
 * @returns A knowledge graph with entities and relations
 */
export function processSearchResults(records: any[]): KnowledgeGraph {
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
 * Performs a robust search across the knowledge graph with multiple search strategies
 * @param neo4jDriver - Neo4j driver instance
 * @param searchQuery - The search query
 * @returns Knowledge graph with matching nodes and relations
 */
export async function robustSearch(neo4jDriver: Neo4jDriver, searchQuery: string): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
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
        return processSearchResults(exactMatchResult.records);
      }
    } catch (error) {
      console.error(`Error in exact match search: ${error}`);
      searchAttempts.push(`Exact match: error - ${error.message}`);
    }
    
    // Second attempt: Fuzzy name matching (more flexible, catches spelling variations)
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
        return processSearchResults(fuzzyResult.records);
      }
    } catch (error) {
      console.error(`Error in fuzzy name matching: ${error}`);
      searchAttempts.push(`Fuzzy name: error - ${error.message}`);
    }
    
    // Third attempt: Content search (looks for the query in node content fields)
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
        return processSearchResults(contentResult.records);
      }
    } catch (error) {
      console.error(`Error in content search: ${error}`);
      searchAttempts.push(`Content: error - ${error.message}`);
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

/**
 * Searches for nodes by name or properties
 * @param neo4jDriver - Neo4j driver instance
 * @param query - Search query
 * @returns Knowledge graph with matching nodes
 */
export async function searchNodes(neo4jDriver: Neo4jDriver, query: string): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
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
    
    return processSearchResults(res.records);
  } catch (error) {
    console.error("Error searching nodes:", error);
    return { entities: [], relations: [] };
  } finally {
    await session.close();
  }
}

/**
 * Searches for nodes with fuzzy matching across different node types
 * @param neo4jDriver - Neo4j driver instance
 * @param searchTerms - Search terms for different node types
 * @returns Knowledge graph with matching nodes
 */
export async function searchNodesWithFuzzyMatching(
  neo4jDriver: Neo4jDriver,
  searchTerms: {
    entities?: string[],
    concepts?: string[],
    events?: string[],
    scientificInsights?: string[],
    laws?: string[],
    thoughts?: string[],
    reasoningChains?: string[],
    reasoningSteps?: string[],
    fuzzyThreshold?: number
  }
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
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
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error in fuzzy matching search: ${error}`);
    return { entities: [], relations: [] };
  } finally {
    await session.close();
  }
} 