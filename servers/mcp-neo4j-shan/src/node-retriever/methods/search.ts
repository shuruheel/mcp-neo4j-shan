import { Driver as Neo4jDriver } from 'neo4j-driver';
import { KnowledgeGraph, Entity, Relation } from '../../types/index.js';
import fetch from 'node-fetch';

/**
 * Generates an embedding vector using OpenAI's text-embedding-3-large model
 * 
 * @param text - Text to generate embedding for
 * @returns Promise resolving to an array of numbers representing the embedding
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  try {
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }
    
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: text.trim(),
        encoding_format: 'float'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${JSON.stringify(errorData)}`);
    }
    
    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error(`Error generating embedding: ${error}`);
    throw error;
  }
}

/**
 * Available vector embedding indexes in Neo4j
 */
export const VECTOR_INDEXES = [
  'concept-embeddings',
  'entity-embeddings',
  'person-embeddings',
  'proposition-embeddings',
  'reasoningchain-embeddings',
  'thought-embeddings'
];

/**
 * Maps node types to their corresponding embedding index
 */
const NODE_TYPE_TO_INDEX: Record<string, string> = {
  'Concept': 'concept-embeddings',
  'Entity': 'entity-embeddings',
  'Person': 'person-embeddings', // Person is a subType of Entity
  'Proposition': 'proposition-embeddings',
  'ReasoningChain': 'reasoningchain-embeddings',
  'Thought': 'thought-embeddings'
};

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
      observations: entityNode.properties.observations || []
    };
    
    // Copy all properties from the Neo4j node except embedding fields
    for (const key in entityNode.properties) {
      // Skip name, nodeType, observations which are handled separately,
      // and skip embedding fields which should not be returned to the client
      if (key !== 'name' && key !== 'nodeType' && key !== 'observations' && 
          key !== 'embedding' && !key.endsWith('Embedding')) {
        
        const value = entityNode.properties[key];
        
        // Check if the value is a Neo4j date/time object with low/high properties
        if (value && typeof value === 'object' && 
            ('low' in value || 
             (value.year && typeof value.year === 'object' && 'low' in value.year))) {
          
          // Handle direct Neo4j Integer objects
          if ('low' in value && 'high' in value) {
            (entity as any)[key] = value.low;
          }
          // Handle date/time objects with year, month, day etc. as Neo4j Integer objects
          else if (value.year && typeof value.year === 'object' && 'low' in value.year) {
            try {
              const dateString = `${value.year.low}-${value.month?.low || 1}-${value.day?.low || 1}`;
              const timeString = `${value.hour?.low || 0}:${value.minute?.low || 0}:${value.second?.low || 0}`;
              (entity as any)[key] = `${dateString}T${timeString}`;
            } catch (e) {
              // If anything goes wrong with date formatting, use the original value
              (entity as any)[key] = value;
            }
          }
          // Otherwise use the original value
          else {
            (entity as any)[key] = value;
          }
        } 
        // For regular values, copy as-is
        else {
          (entity as any)[key] = value;
        }
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
        
        // Add person details if valid
        if (personDetails && typeof personDetails === 'object') {
          Object.assign(entity, {
            aliases: personDetails.aliases || [],
            personalityTraits: personDetails.personalityTraits || [],
            cognitiveStyle: personDetails.cognitiveStyle || {},
            emotionalDisposition: personDetails.emotionalDisposition || null,
            emotionalTriggers: personDetails.emotionalTriggers || [],
            interpersonalStyle: personDetails.interpersonalStyle || null,
            powerDynamics: personDetails.powerDynamics || {},
            loyalties: personDetails.loyalties || [],
            coreValues: personDetails.coreValues || [],
            ethicalFramework: personDetails.ethicalFramework || null,
            psychologicalDevelopment: personDetails.psychologicalDevelopment || [],
            narrativeTreatment: personDetails.narrativeTreatment || {},
            modelConfidence: personDetails.modelConfidence || null,
            personEvidenceStrength: personDetails.evidenceStrength || null
          });
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
      outRelationships.forEach(rel => {
        if (!rel) return;
        
        // Get relationship properties
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
        
        // Get from and to nodes
        let fromName = entity.name;
        let toName = '';
        
        if (rel.endNode && rel.endNode.properties && rel.endNode.properties.name) {
          toName = rel.endNode.properties.name;
        } else if (relationProps.to) {
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
        }
      });
    }
    
    // Process incoming relationships
    if (inRelationships && Array.isArray(inRelationships)) {
      inRelationships.forEach(rel => {
        if (!rel) return;
        
        // Get relationship properties
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
        
        // Get from and to nodes
        let fromName = '';
        let toName = entity.name;
        
        if (rel.startNode && rel.startNode.properties && rel.startNode.properties.name) {
          fromName = rel.startNode.properties.name;
        } else if (relationProps.from) {
          fromName = relationProps.from;
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
            console.error(`Added incoming relation: ${relation.from} -[${relation.relationType}]-> ${relation.to}`);
          }
        }
      });
    }
  });
  
  console.error(`Search results processed: ${entities.length} entities, ${relations.length} relationships`);
  return { entities, relations };
}

/**
 * Performs vector search using Neo4j vector indexes
 * 
 * @param neo4jDriver Neo4j driver instance
 * @param searchQuery The search query text to generate embeddings for
 * @param nodeType Optional node type to restrict search to a specific type
 * @param limit Maximum number of results to return
 * @param threshold Similarity threshold (0-1)
 * @returns Knowledge graph with matching nodes and relations
 */
export async function vectorSearch(
  neo4jDriver: Neo4jDriver, 
  queryEmbedding: number[],
  nodeType?: string,
  limit: number = 27,
  threshold: number = 0.75
): Promise<KnowledgeGraph> {
  // We'll use a hardcoded integer value (27) for Neo4j LIMIT clause
  const session = neo4jDriver.session();
  
  try {
    console.error(`Performing vector search`);
    
    // Verify that queryEmbedding is an array of numbers
    if (!Array.isArray(queryEmbedding)) {
      console.error(`Error: Query embedding is not an array. Current type: ${typeof queryEmbedding}`);
      throw new Error('Vector search requires an embedding vector (array of numbers)');
    }
    
    // Determine which index to use based on nodeType
    let indexToUse: string;
    
    if (nodeType) {
      // If node type is provided, use the corresponding index
      indexToUse = NODE_TYPE_TO_INDEX[nodeType] || 'entity-embeddings';
    } else {
      // If no node type provided, use all indexes and combine results
      return combinedVectorSearch(neo4jDriver, queryEmbedding, limit, threshold);
    }
    
    console.error(`Using vector index: ${indexToUse}`);
    
    // Execute vector search query
    const result = await session.executeRead(tx => tx.run(`
      // Search the vector index
      CALL db.index.vector.queryNodes($indexName, $limit, $queryEmbedding)
      YIELD node, score
      WHERE score >= $threshold
      
      // Get node properties
      WITH node, score
      
      // Get outgoing relationships
      OPTIONAL MATCH (node)-[outRel]->(connected)
      
      // Get incoming relationships
      OPTIONAL MATCH (other)-[inRel]->(node)
      
      // Return node with relationships and similarity score
      RETURN 
        node as entity, 
        collect(DISTINCT outRel) as relations, 
        collect(DISTINCT inRel) as inRelations,
        score
      ORDER BY score DESC
      LIMIT 27
    `, { 
      queryEmbedding,
      indexName: indexToUse,
      limit,
      threshold
    }));
    
    console.error(`Vector search found ${result.records.length} results`);
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error in vector search: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Combined vector search across multiple indexes
 * 
 * @param neo4jDriver Neo4j driver instance
 * @param searchQuery The search query text
 * @param limit Maximum number of results per index
 * @param threshold Similarity threshold
 * @returns Knowledge graph with matching nodes and relations
 */
async function combinedVectorSearch(
  neo4jDriver: Neo4jDriver, 
  queryEmbedding: number[],
  limit: number = 10,
  threshold: number = 0.75
): Promise<KnowledgeGraph> {
  // We'll use a hardcoded integer value (27) for Neo4j LIMIT clause instead of parameter
  const session = neo4jDriver.session();
  
  try {
    console.error(`Performing combined vector search across all indexes`);
    
    // Verify that queryEmbedding is an array of numbers
    if (!Array.isArray(queryEmbedding)) {
      console.error(`Error: Query embedding is not an array. Current type: ${typeof queryEmbedding}`);
      throw new Error('Vector search requires an embedding vector (array of numbers)');
    }
    
    // Execute combined vector search query
    const result = await session.executeRead(tx => tx.run(`
      // Union results from all vector indexes
      CALL {
          CALL db.index.vector.queryNodes('concept-embeddings', 5, $queryEmbedding)
          YIELD node, score
          WHERE score >= $threshold
          RETURN node, score, 'Concept' as sourceIndex
        UNION
          CALL db.index.vector.queryNodes('entity-embeddings', 5, $queryEmbedding)
          YIELD node, score
          WHERE score >= $threshold AND node:Entity AND (node.subType IS NULL OR node.subType <> 'Person')
          RETURN node, score, 'Entity' as sourceIndex
        UNION
          CALL db.index.vector.queryNodes('person-embeddings', 5, $queryEmbedding)
          YIELD node, score
          WHERE score >= $threshold AND node:Entity AND node.subType = 'Person'
          RETURN node, score, 'Person' as sourceIndex
        UNION
          CALL db.index.vector.queryNodes('proposition-embeddings', 5, $queryEmbedding)
          YIELD node, score
          WHERE score >= $threshold
          RETURN node, score, 'Proposition' as sourceIndex
        UNION
          CALL db.index.vector.queryNodes('reasoningchain-embeddings', 5, $queryEmbedding)
          YIELD node, score
          WHERE score >= $threshold
          RETURN node, score, 'ReasoningChain' as sourceIndex
        UNION
          CALL db.index.vector.queryNodes('thought-embeddings', 5, $queryEmbedding)
          YIELD node, score
          WHERE score >= $threshold
          RETURN node, score, 'Thought' as sourceIndex
      }
      
      // Sort by score and limit total results
      ORDER BY score DESC
      LIMIT 27
      
      // With selected nodes, get relationships
      WITH node, score, sourceIndex
      
      // Get outgoing relationships
      OPTIONAL MATCH (node)-[outRel]->(connected)
      
      // Get incoming relationships
      OPTIONAL MATCH (other)-[inRel]->(node)
      
      // Return node with relationships and metadata
      RETURN 
        node as entity, 
        collect(DISTINCT outRel) as relations, 
        collect(DISTINCT inRel) as inRelations,
        score,
        sourceIndex
      ORDER BY score DESC
    `, { 
      queryEmbedding,
      threshold
      // Using hardcoded value 5 for limit per index
    }));
    
    console.error(`Combined vector search found ${result.records.length} results`);
    return processSearchResults(result.records);
  } catch (error) {
    console.error(`Error in combined vector search: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Performs a search across the knowledge graph using vector embeddings
 * @param neo4jDriver - Neo4j driver instance
 * @param queryEmbedding - The embedding vector for search query
 * @returns Knowledge graph with matching nodes and relations
 */
export async function robustSearch(
  neo4jDriver: Neo4jDriver, 
  queryEmbedding: number[]
): Promise<KnowledgeGraph> {
  return vectorSearch(neo4jDriver, queryEmbedding);
}

/**
 * Searches for nodes with vector embeddings across different node types
 * @param neo4jDriver - Neo4j driver instance
 * @param searchTerms - Search terms for different node types
 * @returns Knowledge graph with matching nodes
 */
export async function searchNodesWithVectorEmbeddings(
  neo4jDriver: Neo4jDriver,
  searchTerms: {
    entities?: string,
    concepts?: string,
    persons?: string,
    propositions?: string,
    reasoningChains?: string,
    thoughts?: string,
    limit?: number,
    threshold?: number
  }
): Promise<KnowledgeGraph> {
  // We'll use the hardcoded limit of 27 for all Neo4j queries
  const threshold = searchTerms.threshold || 0.75;
  const results: KnowledgeGraph = { entities: [], relations: [] };
  
  try {
    // Search each node type in parallel
    const searchPromises: Promise<KnowledgeGraph>[] = [];
    
    const { generateQueryEmbedding } = await import('./search.js');
    
    if (searchTerms.entities) {
      const queryEmbedding = await generateQueryEmbedding(searchTerms.entities);
      searchPromises.push(vectorSearch(neo4jDriver, queryEmbedding, 'Entity', 27, threshold));
    }
    
    if (searchTerms.concepts) {
      const queryEmbedding = await generateQueryEmbedding(searchTerms.concepts);
      searchPromises.push(vectorSearch(neo4jDriver, queryEmbedding, 'Concept', 27, threshold));
    }
    
    if (searchTerms.persons) {
      const queryEmbedding = await generateQueryEmbedding(searchTerms.persons);
      searchPromises.push(vectorSearch(neo4jDriver, queryEmbedding, 'Person', 27, threshold));
    }
    
    if (searchTerms.propositions) {
      const queryEmbedding = await generateQueryEmbedding(searchTerms.propositions);
      searchPromises.push(vectorSearch(neo4jDriver, queryEmbedding, 'Proposition', 27, threshold));
    }
    
    if (searchTerms.reasoningChains) {
      const queryEmbedding = await generateQueryEmbedding(searchTerms.reasoningChains);
      searchPromises.push(vectorSearch(neo4jDriver, queryEmbedding, 'ReasoningChain', 27, threshold));
    }
    
    if (searchTerms.thoughts) {
      const queryEmbedding = await generateQueryEmbedding(searchTerms.thoughts);
      searchPromises.push(vectorSearch(neo4jDriver, queryEmbedding, 'Thought', 27, threshold));
    }
    
    // Execute all searches in parallel
    if (searchPromises.length === 0) {
      // If no specific searches, do a combined search across all indexes
      const searchText = [
        searchTerms.entities, 
        searchTerms.concepts, 
        searchTerms.persons,
        searchTerms.propositions,
        searchTerms.reasoningChains,
        searchTerms.thoughts
      ].filter(Boolean).join(' ');
      
      if (searchText) {
        const { generateQueryEmbedding } = await import('./search.js');
        const queryEmbedding = await generateQueryEmbedding(searchText);
        searchPromises.push(vectorSearch(neo4jDriver, queryEmbedding, undefined, 27, threshold));
      }
    }
    
    // Collect results and merge
    const allResults = await Promise.all(searchPromises);
    
    // Combine all results
    for (const result of allResults) {
      results.entities.push(...result.entities);
      results.relations.push(...result.relations);
    }
    
    // Deduplicate entities and relations
    const uniqueEntities = new Map();
    const uniqueRelations = new Map();
    
    for (const entity of results.entities) {
      uniqueEntities.set(entity.name, entity);
    }
    
    for (const relation of results.relations) {
      const key = `${relation.from}-${relation.relationType}-${relation.to}`;
      uniqueRelations.set(key, relation);
    }
    
    return {
      entities: Array.from(uniqueEntities.values()),
      relations: Array.from(uniqueRelations.values())
    };
  } catch (error) {
    console.error('Error in searchNodesWithVectorEmbeddings:', error);
    throw error;
  }
}

/**
 * Searches for nodes by name using vector embeddings
 * @param neo4jDriver - Neo4j driver instance
 * @param query - Search query
 * @returns Knowledge graph with matching nodes
 */
export async function searchNodes(
  neo4jDriver: Neo4jDriver, 
  query: string
): Promise<KnowledgeGraph> {
  const { generateQueryEmbedding } = await import('./search.js');
  const queryEmbedding = await generateQueryEmbedding(query);
  return vectorSearch(neo4jDriver, queryEmbedding);
}

/**
 * Searches for nodes with vector embeddings across different node types
 * @param neo4jDriver - Neo4j driver instance
 * @param searchTerms - Search terms for different node types
 * @returns Knowledge graph with matching nodes
 */
export async function searchNodesWithFuzzyMatching(
  neo4jDriver: Neo4jDriver,
  searchTerms: any
): Promise<KnowledgeGraph> {
  // Create a new searchTerms object with string values instead of arrays
  const vectorSearchTerms: any = {};
  
  // Convert arrays to strings for vector search
  if (searchTerms.entities) vectorSearchTerms.entities = searchTerms.entities.join(' ');
  if (searchTerms.concepts) vectorSearchTerms.concepts = searchTerms.concepts.join(' ');
  if (searchTerms.thoughts) vectorSearchTerms.thoughts = searchTerms.thoughts.join(' ');
  if (searchTerms.reasoningChains) vectorSearchTerms.reasoningChains = searchTerms.reasoningChains.join(' ');
  if (searchTerms.propositions) vectorSearchTerms.propositions = searchTerms.propositions.join(' ');
  
  // Handle Person searches with special mapping
  if (searchTerms.personTraits || searchTerms.personalityTypes || 
      searchTerms.emotionalDispositions || searchTerms.ethicalFrameworks) {
    
    const personTerms = [
      ...(searchTerms.personTraits || []),
      ...(searchTerms.personalityTypes || []),
      ...(searchTerms.emotionalDispositions || []),
      ...(searchTerms.ethicalFrameworks || [])
    ];
    
    if (personTerms.length > 0) {
      vectorSearchTerms.persons = personTerms.join(' ');
    }
  }
  
  // Set threshold if specified
  if (searchTerms.fuzzyThreshold) {
    vectorSearchTerms.threshold = searchTerms.fuzzyThreshold;
  }
  
  return searchNodesWithVectorEmbeddings(neo4jDriver, vectorSearchTerms);
}