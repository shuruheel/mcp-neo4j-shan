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
    
    // Copy all properties from the Neo4j node
    for (const key in entityNode.properties) {
      if (key !== 'name' && key !== 'nodeType' && key !== 'observations') {
        (entity as any)[key] = entityNode.properties[key];
      }
    }
    
    // Handle Person-specific details if subType is 'Person'
    if (entityNode.properties.nodeType === 'Entity' && 
        entityNode.properties.subType === 'Person' && 
        entityNode.properties.personDetails) {
      try {
        // Parse the personDetails JSON if it exists
        let personDetails;
        if (typeof entityNode.properties.personDetails === 'string') {
          try {
            personDetails = JSON.parse(entityNode.properties.personDetails);
          } catch (parseError) {
            console.error(`Error parsing personDetails JSON for ${entityNode.properties.name}:`, parseError);
            personDetails = null;
          }
        } else {
          personDetails = entityNode.properties.personDetails;
        }
        
        // Add all person details properties to the entity only if personDetails is valid
        if (personDetails && typeof personDetails === 'object') {
          // Safely add properties with validation
          const safeArrayAssign = (target: any, prop: string, value: any) => {
            if (Array.isArray(value)) {
              target[prop] = value;
            } else if (value === null || value === undefined) {
              target[prop] = [];
            } else {
              console.warn(`Expected array for ${prop} but got ${typeof value} for entity ${entityNode.properties.name}`);
              target[prop] = [];
            }
          };
          
          const safeObjectAssign = (target: any, prop: string, value: any) => {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              target[prop] = value;
            } else if (value === null || value === undefined) {
              target[prop] = {};
            } else {
              console.warn(`Expected object for ${prop} but got ${typeof value} for entity ${entityNode.properties.name}`);
              target[prop] = {};
            }
          };
          
          // Assign with validation
          (entity as any).aliases = personDetails.aliases || [];
          safeArrayAssign(entity as any, 'personalityTraits', personDetails.personalityTraits);
          safeObjectAssign(entity as any, 'cognitiveStyle', personDetails.cognitiveStyle);
          (entity as any).emotionalDisposition = personDetails.emotionalDisposition || null;
          safeArrayAssign(entity as any, 'emotionalTriggers', personDetails.emotionalTriggers);
          (entity as any).interpersonalStyle = personDetails.interpersonalStyle || null;
          safeObjectAssign(entity as any, 'powerDynamics', personDetails.powerDynamics);
          safeArrayAssign(entity as any, 'loyalties', personDetails.loyalties);
          safeArrayAssign(entity as any, 'coreValues', personDetails.coreValues);
          (entity as any).ethicalFramework = personDetails.ethicalFramework || null;
          safeArrayAssign(entity as any, 'psychologicalDevelopment', personDetails.psychologicalDevelopment);
          safeObjectAssign(entity as any, 'narrativeTreatment', personDetails.narrativeTreatment);
          (entity as any).modelConfidence = personDetails.modelConfidence || null;
          (entity as any).personEvidenceStrength = personDetails.evidenceStrength || null;
        }
      } catch (e) {
        console.error(`Error processing personDetails for ${entityNode.properties.name}:`, e);
      }
    }
    
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
    // Step 1: Try exact match on node name
    console.error(`Performing exact name match for: "${searchQuery}"`);
    
    const exactMatchResult = await session.executeRead(tx => tx.run(`
      MATCH (entity:Memory)
      WHERE entity.name = $searchQuery
      
      // Get outgoing relationships
      OPTIONAL MATCH (entity)-[outRel]->(connected)
      
      // Get incoming relationships
      OPTIONAL MATCH (other)-[inRel]->(entity)
      
      RETURN entity, collect(DISTINCT outRel) as relations, collect(DISTINCT inRel) as inRelations
    `, { searchQuery }));
    
    if (exactMatchResult.records.length > 0) {
      console.error(`Found exact match for "${searchQuery}"`);
      return processSearchResults(exactMatchResult.records);
    }
    
    // Step 2: Try combining fuzzy search with text search
    console.error(`No exact matches, trying fuzzy and keyword search for: "${searchQuery}"`);
    
    // Split the search query into keywords
    const keywords = searchQuery.split(/\s+/).filter(k => k.length > 2);
    console.error(`Keywords for search:`, keywords);
    
    const fuzzyResult = await session.executeRead(tx => tx.run(`
      // Match memory nodes with fuzzy name matching or keyword containment
      MATCH (entity:Memory)
      WHERE apoc.text.fuzzyMatch(entity.name, $searchQuery, 0.7)
         OR entity.name CONTAINS $searchQuery
         OR any(keyword IN $keywords WHERE 
              entity.name CONTAINS keyword
              OR (entity.description IS NOT NULL AND entity.description CONTAINS keyword)
              OR (entity:Entity AND entity.biography IS NOT NULL AND entity.biography CONTAINS keyword)
              OR (entity:Concept AND entity.definition IS NOT NULL AND entity.definition CONTAINS keyword)
              OR (entity:Event AND entity.outcome IS NOT NULL AND entity.outcome CONTAINS keyword)
              OR (entity:ScientificInsight AND entity.hypothesis IS NOT NULL AND entity.hypothesis CONTAINS keyword)
              OR (entity:Law AND entity.statement IS NOT NULL AND entity.statement CONTAINS keyword) 
              OR (entity:Thought AND entity.thoughtContent IS NOT NULL AND entity.thoughtContent CONTAINS keyword)
              OR (entity:ReasoningChain AND entity.conclusion IS NOT NULL AND entity.conclusion CONTAINS keyword)
              OR (entity:ReasoningStep AND entity.content IS NOT NULL AND entity.content CONTAINS keyword)
              OR (entity:Attribute AND entity.value IS NOT NULL AND toString(entity.value) CONTAINS keyword)
              OR (entity:Proposition AND entity.statement IS NOT NULL AND entity.statement CONTAINS keyword)
              OR (entity:Emotion AND entity.category IS NOT NULL AND entity.category CONTAINS keyword)
              OR (entity:Agent AND entity.agentType IS NOT NULL AND entity.agentType CONTAINS keyword)
            )
      
      // Get outgoing relationships
      OPTIONAL MATCH (entity)-[outRel]->(connected)
      
      // Get incoming relationships 
      OPTIONAL MATCH (other)-[inRel]->(entity)
      
      RETURN entity, collect(DISTINCT outRel) as relations, collect(DISTINCT inRel) as inRelations
    `, { 
      searchQuery,
      keywords
    }));
    
    console.error(`Fuzzy search found ${fuzzyResult.records.length} results`);
    
    if (fuzzyResult.records.length > 0) {
      return processSearchResults(fuzzyResult.records);
    }
    
    // Step 3: Fallback to broader semantic search with vector embeddings if available
    // Note: This is a placeholder for future enhancement with vector embeddings
    console.error(`No fuzzy matches found for "${searchQuery}"`);
    
    return { entities: [], relations: [] };
  } catch (error) {
    console.error('Error in robustSearch:', error);
    throw error;
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
    attributes?: string[],
    propositions?: string[],
    emotions?: string[],
    agents?: string[],
    scientificInsights?: string[],
    laws?: string[],
    locations?: string[],
    thoughts?: string[],
    reasoningChains?: string[],
    reasoningSteps?: string[],
    // Person-specific search parameters
    personTraits?: string[],
    personalityTypes?: string[],
    emotionalDispositions?: string[],
    ethicalFrameworks?: string[],
    fuzzyThreshold?: number
  }
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  const fuzzyThreshold = searchTerms.fuzzyThreshold || 0.7;
  const allResults: KnowledgeGraph = { entities: [], relations: [] };
  
  try {
    // Search for each node type in parallel
    const searchPromises: Promise<KnowledgeGraph>[] = [];
    
    const searchNodeType = async (nodeType: string, searchTerms: string[]): Promise<KnowledgeGraph> => {
      if (!searchTerms || searchTerms.length === 0) return { entities: [], relations: [] };
      
      const terms = searchTerms.map(term => term.trim()).filter(term => term.length > 0);
      if (terms.length === 0) return { entities: [], relations: [] };
      
      console.error(`Searching for ${nodeType} nodes with terms:`, terms);
      
      // Use apoc.text.fuzzyMatch for approximate matching with configurable threshold
      const result = await session.executeRead(tx => tx.run(`
        MATCH (node:${nodeType}:Memory)
        WHERE ANY(term IN $terms WHERE apoc.text.fuzzyMatch(node.name, term, $threshold))
           OR ANY(term IN $terms WHERE 
                node.name CONTAINS term 
                OR (node.description IS NOT NULL AND node.description CONTAINS term)
                ${nodeType === 'Entity' ? 'OR (node.biography IS NOT NULL AND node.biography CONTAINS term)' : ''}
                ${nodeType === 'Concept' ? 'OR (node.definition IS NOT NULL AND node.definition CONTAINS term)' : ''}
                ${nodeType === 'Event' ? 'OR (node.outcome IS NOT NULL AND node.outcome CONTAINS term)' : ''}
                ${nodeType === 'ScientificInsight' ? 'OR (node.hypothesis IS NOT NULL AND node.hypothesis CONTAINS term)' : ''}
                ${nodeType === 'Law' ? 'OR (node.statement IS NOT NULL AND node.statement CONTAINS term)' : ''}
                ${nodeType === 'Thought' ? 'OR (node.thoughtContent IS NOT NULL AND node.thoughtContent CONTAINS term)' : ''}
                ${nodeType === 'ReasoningChain' ? 'OR (node.conclusion IS NOT NULL AND node.conclusion CONTAINS term)' : ''}
                ${nodeType === 'ReasoningStep' ? 'OR (node.content IS NOT NULL AND node.content CONTAINS term)' : ''}
                ${nodeType === 'Attribute' ? 'OR (node.value IS NOT NULL AND toString(node.value) CONTAINS term)' : ''}
                ${nodeType === 'Proposition' ? 'OR (node.statement IS NOT NULL AND node.statement CONTAINS term)' : ''}
                ${nodeType === 'Emotion' ? 'OR (node.category IS NOT NULL AND node.category CONTAINS term)' : ''}
                ${nodeType === 'Agent' ? 'OR (node.agentType IS NOT NULL AND node.agentType CONTAINS term)' : ''}
             )
        
        // Get outgoing relationships
        OPTIONAL MATCH (node)-[outRel]->(connected)
        
        // Get incoming relationships
        OPTIONAL MATCH (other)-[inRel]->(node)
        
        RETURN node as entity, collect(DISTINCT outRel) as relations, collect(DISTINCT inRel) as inRelations
      `, { 
        terms, 
        threshold: fuzzyThreshold
      }));
      
      return processSearchResults(result.records);
    };
    
    // Handle standard node type searches
    if (searchTerms.entities && searchTerms.entities.length > 0) {
      searchPromises.push(searchNodeType('Entity', searchTerms.entities));
    }
    
    if (searchTerms.events && searchTerms.events.length > 0) {
      searchPromises.push(searchNodeType('Event', searchTerms.events));
    }
    
    if (searchTerms.concepts && searchTerms.concepts.length > 0) {
      searchPromises.push(searchNodeType('Concept', searchTerms.concepts));
    }
    
    if (searchTerms.attributes && searchTerms.attributes.length > 0) {
      searchPromises.push(searchNodeType('Attribute', searchTerms.attributes));
    }
    
    if (searchTerms.propositions && searchTerms.propositions.length > 0) {
      searchPromises.push(searchNodeType('Proposition', searchTerms.propositions));
    }
    
    if (searchTerms.emotions && searchTerms.emotions.length > 0) {
      searchPromises.push(searchNodeType('Emotion', searchTerms.emotions));
    }
    
    if (searchTerms.agents && searchTerms.agents.length > 0) {
      searchPromises.push(searchNodeType('Agent', searchTerms.agents));
    }
    
    if (searchTerms.scientificInsights && searchTerms.scientificInsights.length > 0) {
      searchPromises.push(searchNodeType('ScientificInsight', searchTerms.scientificInsights));
    }
    
    if (searchTerms.laws && searchTerms.laws.length > 0) {
      searchPromises.push(searchNodeType('Law', searchTerms.laws));
    }
    
    if (searchTerms.locations && searchTerms.locations.length > 0) {
      searchPromises.push(searchNodeType('Location', searchTerms.locations));
    }
    
    if (searchTerms.thoughts && searchTerms.thoughts.length > 0) {
      searchPromises.push(searchNodeType('Thought', searchTerms.thoughts));
    }
    
    if (searchTerms.reasoningChains && searchTerms.reasoningChains.length > 0) {
      searchPromises.push(searchNodeType('ReasoningChain', searchTerms.reasoningChains));
    }
    
    if (searchTerms.reasoningSteps && searchTerms.reasoningSteps.length > 0) {
      searchPromises.push(searchNodeType('ReasoningStep', searchTerms.reasoningSteps));
    }
    
    // Add Person-specific searches
    if (searchTerms.personTraits && searchTerms.personTraits.length > 0) {
      searchPromises.push(searchPersonByTraits(neo4jDriver, searchTerms.personTraits, fuzzyThreshold));
    }
    
    if (searchTerms.personalityTypes && searchTerms.personalityTypes.length > 0) {
      searchPromises.push(searchPersonByPersonalityTypes(neo4jDriver, searchTerms.personalityTypes, fuzzyThreshold));
    }
    
    if (searchTerms.emotionalDispositions && searchTerms.emotionalDispositions.length > 0) {
      searchPromises.push(searchPersonByEmotionalDispositions(neo4jDriver, searchTerms.emotionalDispositions, fuzzyThreshold));
    }
    
    if (searchTerms.ethicalFrameworks && searchTerms.ethicalFrameworks.length > 0) {
      searchPromises.push(searchPersonByEthicalFrameworks(neo4jDriver, searchTerms.ethicalFrameworks, fuzzyThreshold));
    }
    
    // Collect and merge all results
    const allSearchResults = await Promise.all(searchPromises);
    for (const result of allSearchResults) {
      allResults.entities.push(...result.entities);
      allResults.relations.push(...result.relations);
    }
    
    // Deduplicate results
    const uniqueEntities = new Map();
    const uniqueRelations = new Map();
    
    for (const entity of allResults.entities) {
      uniqueEntities.set(entity.name, entity);
    }
    
    for (const relation of allResults.relations) {
      const key = `${relation.from}-${relation.relationType}-${relation.to}`;
      uniqueRelations.set(key, relation);
    }
    
    return { 
      entities: Array.from(uniqueEntities.values()), 
      relations: Array.from(uniqueRelations.values()) 
    };
  } catch (error) {
    console.error(`Error in fuzzy node search:`, error);
    return { entities: [], relations: [] };
  } finally {
    await session.close();
  }
}

/**
 * Searches for Person entities by personality traits
 */
async function searchPersonByTraits(
  neo4jDriver: Neo4jDriver, 
  traits: string[], 
  fuzzyThreshold: number
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  try {
    // Verify that APOC is available
    const apocCheck = await session.executeRead(tx => 
      tx.run(`CALL apoc.help('text.fuzzyMatch') YIELD name RETURN count(name) AS available`)
    );
    
    const apocAvailable = apocCheck.records.length > 0 && apocCheck.records[0].get('available') > 0;
    
    let query;
    if (apocAvailable) {
      // Use APOC for fuzzy matching if available
      query = `
        MATCH (e:Entity)
        WHERE e.subType = 'Person' AND e.personDetails IS NOT NULL
        WITH e, 
             CASE WHEN e.personDetails IS STRING 
               THEN apoc.convert.fromJsonMap(e.personDetails) 
               ELSE e.personDetails
             END AS personDetails
        WHERE personDetails IS NOT NULL AND personDetails.personalityTraits IS NOT NULL
        WITH e, personDetails,
             [trait IN personDetails.personalityTraits WHERE 
                ANY(searchTrait IN $traits WHERE 
                    apoc.text.fuzzyMatch(trait.trait, searchTrait) > $fuzzyThreshold)
             ] AS matchedTraits
        WHERE size(matchedTraits) > 0
        RETURN e as entity, 
               [] as relations, 
               [] as inRelations
      `;
    } else {
      // Fallback to basic CONTAINS search if APOC is not available
      console.warn("APOC not available for fuzzy matching, using basic CONTAINS instead");
      query = `
        MATCH (e:Entity)
        WHERE e.subType = 'Person' AND e.personDetails IS NOT NULL
        WITH e, 
             CASE WHEN e.personDetails IS STRING 
               THEN apoc.convert.fromJsonMap(e.personDetails) 
               ELSE e.personDetails
             END AS personDetails
        WHERE personDetails IS NOT NULL AND personDetails.personalityTraits IS NOT NULL
        WITH e, personDetails,
             [trait IN personDetails.personalityTraits WHERE 
                ANY(searchTrait IN $traits WHERE 
                    trait.trait CONTAINS searchTrait OR searchTrait CONTAINS trait.trait)
             ] AS matchedTraits
        WHERE size(matchedTraits) > 0
        RETURN e as entity, 
               [] as relations, 
               [] as inRelations
      `;
    }
    
    const result = await session.executeRead(tx => 
      tx.run(query, { traits, fuzzyThreshold })
    );
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error searching for Person entities by traits:`, error);
    // Fall back to simpler query if complex query fails
    try {
      const simpleQuery = `
        MATCH (e:Entity)
        WHERE e.subType = 'Person'
        AND e.personDetails IS NOT NULL
        AND ANY(trait IN $traits WHERE toString(e.personDetails) CONTAINS trait)
        RETURN e as entity, [] as relations, [] as inRelations
        LIMIT 10
      `;
      
      const result = await session.executeRead(tx => 
        tx.run(simpleQuery, { traits })
      );
      
      return processSearchResults(result.records);
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return { entities: [], relations: [] };
    }
  } finally {
    await session.close();
  }
}

/**
 * Searches for Person entities by personality types or cognitive styles
 */
async function searchPersonByPersonalityTypes(
  neo4jDriver: Neo4jDriver, 
  types: string[], 
  fuzzyThreshold: number
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  try {
    // Verify that APOC is available
    const apocCheck = await session.executeRead(tx => 
      tx.run(`CALL apoc.help('text.fuzzyMatch') YIELD name RETURN count(name) AS available`)
    );
    
    const apocAvailable = apocCheck.records.length > 0 && apocCheck.records[0].get('available') > 0;
    
    let query;
    if (apocAvailable) {
      // Use APOC for fuzzy matching if available
      query = `
        MATCH (e:Entity)
        WHERE e.subType = 'Person' AND e.personDetails IS NOT NULL
        WITH e, 
             CASE WHEN e.personDetails IS STRING 
               THEN apoc.convert.fromJsonMap(e.personDetails) 
               ELSE e.personDetails
             END AS personDetails
        WHERE personDetails IS NOT NULL AND personDetails.cognitiveStyle IS NOT NULL
        WITH e, personDetails,
             personDetails.cognitiveStyle AS cogStyle
        WHERE 
          (cogStyle.decisionMaking IS NOT NULL AND 
            ANY(type IN $types WHERE apoc.text.fuzzyMatch(cogStyle.decisionMaking, type) > $fuzzyThreshold))
          OR
          (cogStyle.problemSolving IS NOT NULL AND 
            ANY(type IN $types WHERE apoc.text.fuzzyMatch(cogStyle.problemSolving, type) > $fuzzyThreshold))
          OR
          (cogStyle.worldview IS NOT NULL AND 
            ANY(type IN $types WHERE apoc.text.fuzzyMatch(cogStyle.worldview, type) > $fuzzyThreshold))
        RETURN e as entity, 
               [] as relations, 
               [] as inRelations
      `;
    } else {
      // Fallback to basic CONTAINS search if APOC is not available
      console.warn("APOC not available for fuzzy matching, using basic CONTAINS instead");
      query = `
        MATCH (e:Entity)
        WHERE e.subType = 'Person' AND e.personDetails IS NOT NULL
        WITH e, 
             CASE WHEN e.personDetails IS STRING 
               THEN apoc.convert.fromJsonMap(e.personDetails) 
               ELSE e.personDetails
             END AS personDetails
        WHERE personDetails IS NOT NULL AND personDetails.cognitiveStyle IS NOT NULL
        WITH e, personDetails,
             personDetails.cognitiveStyle AS cogStyle
        WHERE 
          (cogStyle.decisionMaking IS NOT NULL AND 
            ANY(type IN $types WHERE cogStyle.decisionMaking CONTAINS type OR type CONTAINS cogStyle.decisionMaking))
          OR
          (cogStyle.problemSolving IS NOT NULL AND 
            ANY(type IN $types WHERE cogStyle.problemSolving CONTAINS type OR type CONTAINS cogStyle.problemSolving))
          OR
          (cogStyle.worldview IS NOT NULL AND 
            ANY(type IN $types WHERE cogStyle.worldview CONTAINS type OR type CONTAINS cogStyle.worldview))
        RETURN e as entity, 
               [] as relations, 
               [] as inRelations
      `;
    }
    
    const result = await session.executeRead(tx => 
      tx.run(query, { types, fuzzyThreshold })
    );
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error searching for Person entities by personality types:`, error);
    // Fall back to simpler query if complex query fails
    try {
      const simpleQuery = `
        MATCH (e:Entity)
        WHERE e.subType = 'Person'
        AND e.personDetails IS NOT NULL
        AND ANY(type IN $types WHERE toString(e.personDetails) CONTAINS type)
        RETURN e as entity, [] as relations, [] as inRelations
        LIMIT 10
      `;
      
      const result = await session.executeRead(tx => 
        tx.run(simpleQuery, { types })
      );
      
      return processSearchResults(result.records);
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return { entities: [], relations: [] };
    }
  } finally {
    await session.close();
  }
}

/**
 * Searches for Person entities by emotional dispositions
 */
async function searchPersonByEmotionalDispositions(
  neo4jDriver: Neo4jDriver, 
  dispositions: string[], 
  fuzzyThreshold: number
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  try {
    // Verify that APOC is available
    const apocCheck = await session.executeRead(tx => 
      tx.run(`CALL apoc.help('text.fuzzyMatch') YIELD name RETURN count(name) AS available`)
    );
    
    const apocAvailable = apocCheck.records.length > 0 && apocCheck.records[0].get('available') > 0;
    
    let query;
    if (apocAvailable) {
      // Use APOC for fuzzy matching if available
      query = `
        MATCH (e:Entity)
        WHERE e.subType = 'Person' AND e.personDetails IS NOT NULL
        WITH e, 
             CASE WHEN e.personDetails IS STRING 
               THEN apoc.convert.fromJsonMap(e.personDetails) 
               ELSE e.personDetails
             END AS personDetails
        WHERE personDetails IS NOT NULL AND personDetails.emotionalDisposition IS NOT NULL
        WITH e, personDetails,
             personDetails.emotionalDisposition AS disposition
        WHERE 
          ANY(disp IN $dispositions WHERE 
              apoc.text.fuzzyMatch(disposition, disp) > $fuzzyThreshold)
        RETURN e as entity, 
               [] as relations, 
               [] as inRelations
      `;
    } else {
      // Fallback to basic CONTAINS search if APOC is not available
      console.warn("APOC not available for fuzzy matching, using basic CONTAINS instead");
      query = `
        MATCH (e:Entity)
        WHERE e.subType = 'Person' AND e.personDetails IS NOT NULL
        WITH e, 
             CASE WHEN e.personDetails IS STRING 
               THEN apoc.convert.fromJsonMap(e.personDetails) 
               ELSE e.personDetails
             END AS personDetails
        WHERE personDetails IS NOT NULL AND personDetails.emotionalDisposition IS NOT NULL
        WITH e, personDetails,
             personDetails.emotionalDisposition AS disposition
        WHERE 
          ANY(disp IN $dispositions WHERE 
              disposition CONTAINS disp OR disp CONTAINS disposition)
        RETURN e as entity, 
               [] as relations, 
               [] as inRelations
      `;
    }
    
    const result = await session.executeRead(tx => 
      tx.run(query, { dispositions, fuzzyThreshold })
    );
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error searching for Person entities by emotional dispositions:`, error);
    // Fall back to simpler query if complex query fails
    try {
      const simpleQuery = `
        MATCH (e:Entity)
        WHERE e.subType = 'Person'
        AND e.personDetails IS NOT NULL
        AND ANY(disp IN $dispositions WHERE toString(e.personDetails) CONTAINS disp)
        RETURN e as entity, [] as relations, [] as inRelations
        LIMIT 10
      `;
      
      const result = await session.executeRead(tx => 
        tx.run(simpleQuery, { dispositions })
      );
      
      return processSearchResults(result.records);
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return { entities: [], relations: [] };
    }
  } finally {
    await session.close();
  }
}

/**
 * Searches for Person entities by ethical frameworks
 */
async function searchPersonByEthicalFrameworks(
  neo4jDriver: Neo4jDriver, 
  frameworks: string[], 
  fuzzyThreshold: number
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  try {
    // Verify that APOC is available
    const apocCheck = await session.executeRead(tx => 
      tx.run(`CALL apoc.help('text.fuzzyMatch') YIELD name RETURN count(name) AS available`)
    );
    
    const apocAvailable = apocCheck.records.length > 0 && apocCheck.records[0].get('available') > 0;
    
    let query;
    if (apocAvailable) {
      // Use APOC for fuzzy matching if available
      query = `
        MATCH (e:Entity)
        WHERE e.subType = 'Person' AND e.personDetails IS NOT NULL
        WITH e, 
             CASE WHEN e.personDetails IS STRING 
               THEN apoc.convert.fromJsonMap(e.personDetails) 
               ELSE e.personDetails
             END AS personDetails
        WHERE personDetails IS NOT NULL AND personDetails.ethicalFramework IS NOT NULL
        WITH e, personDetails,
             personDetails.ethicalFramework AS framework
        WHERE 
          ANY(f IN $frameworks WHERE 
              apoc.text.fuzzyMatch(framework, f) > $fuzzyThreshold)
        RETURN e as entity, 
               [] as relations, 
               [] as inRelations
      `;
    } else {
      // Fallback to basic CONTAINS search if APOC is not available
      console.warn("APOC not available for fuzzy matching, using basic CONTAINS instead");
      query = `
        MATCH (e:Entity)
        WHERE e.subType = 'Person' AND e.personDetails IS NOT NULL
        WITH e, 
             CASE WHEN e.personDetails IS STRING 
               THEN apoc.convert.fromJsonMap(e.personDetails) 
               ELSE e.personDetails
             END AS personDetails
        WHERE personDetails IS NOT NULL AND personDetails.ethicalFramework IS NOT NULL
        WITH e, personDetails,
             personDetails.ethicalFramework AS framework
        WHERE 
          ANY(f IN $frameworks WHERE 
              framework CONTAINS f OR f CONTAINS framework)
        RETURN e as entity, 
               [] as relations, 
               [] as inRelations
      `;
    }
    
    const result = await session.executeRead(tx => 
      tx.run(query, { frameworks, fuzzyThreshold })
    );
    
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error searching for Person entities by ethical frameworks:`, error);
    // Fall back to simpler query if complex query fails
    try {
      const simpleQuery = `
        MATCH (e:Entity)
        WHERE e.subType = 'Person'
        AND e.personDetails IS NOT NULL
        AND ANY(f IN $frameworks WHERE toString(e.personDetails) CONTAINS f)
        RETURN e as entity, [] as relations, [] as inRelations
        LIMIT 10
      `;
      
      const result = await session.executeRead(tx => 
        tx.run(simpleQuery, { frameworks })
      );
      
      return processSearchResults(result.records);
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
      return { entities: [], relations: [] };
    }
  } finally {
    await session.close();
  }
} 