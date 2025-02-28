import { Driver as Neo4jDriver } from 'neo4j-driver';
import { Entity, Relation, KnowledgeGraph, EnhancedRelation } from '../types/index.js';
import { loadGraph, processEntityDates } from './utils.js';

/**
 * Create entities in the Neo4j database
 * @param neo4jDriver - Neo4j driver instance
 * @param entities - Array of entities to create
 * @returns Promise resolving to the created entities
 */
export async function createEntities(neo4jDriver: Neo4jDriver, entities: Entity[]): Promise<Entity[]> {
  const session = neo4jDriver.session();
  
  try {
    // Log the incoming entities for debugging
    console.error(`Creating ${entities.length} entities`);
    
    const createdEntities: Entity[] = [];
    
    // Process each entity separately for better control and error handling
    for (const entity of entities) {
      console.error(`Processing entity: ${entity.name}, type: ${entity.entityType}`);
      
      // Specific query based on entity type
      if (entity.entityType === 'Entity') {
        const result = await session.executeWrite(tx => tx.run(`
          MERGE (node:Memory {name: $name})
          SET node.nodeType = 'Entity',
              node:Entity,
              node.lastUpdated = datetime(),
              node.observations = $observations,
              node.confidence = $confidence,
              node.source = $source,
              node.description = $description,
              node.biography = $biography,
              node.keyContributions = $keyContributions,
              node.emotionalValence = $emotionalValence,
              node.emotionalArousal = $emotionalArousal,
              node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
          RETURN node
        `, {
          name: entity.name,
          observations: entity.observations || [],
          confidence: entity.confidence || null,
          source: entity.source || null,
          description: entity.description || null,
          biography: entity.biography || null,
          keyContributions: entity.keyContributions || [],
          emotionalValence: entity.emotionalValence || null,
          emotionalArousal: entity.emotionalArousal || null
        }));
        
        if (result.records.length > 0) {
          createdEntities.push(entity);
          console.error(`Entity creation result: Success`);
        } else {
          console.error(`Entity creation result: Failed`);
        }
      } 
      else if (entity.entityType === 'Event') {
        const result = await session.executeWrite(tx => tx.run(`
          MERGE (node:Memory {name: $name})
          SET node.nodeType = 'Event',
              node:Event,
              node.lastUpdated = datetime(),
              node.startDate = $startDate,
              node.endDate = $endDate,
              node.status = $status,
              node.timestamp = $timestamp,
              node.duration = $duration,
              node.location = $location,
              node.participants = $participants,
              node.outcome = $outcome,
              node.significance = $significance,
              node.emotionalValence = $emotionalValence,
              node.emotionalArousal = $emotionalArousal,
              node.causalPredecessors = $causalPredecessors,
              node.causalSuccessors = $causalSuccessors,
              node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
          RETURN node
        `, {
          name: entity.name,
          startDate: entity.startDate || null,
          endDate: entity.endDate || null,
          status: entity.status || null,
          timestamp: entity.timestamp || null,
          duration: entity.duration || null,
          location: entity.location || null,
          participants: entity.participants || [],
          outcome: entity.outcome || null,
          significance: entity.significance || null,
          emotionalValence: entity.emotionalValence || null,
          emotionalArousal: entity.emotionalArousal || null,
          causalPredecessors: entity.causalPredecessors || [],
          causalSuccessors: entity.causalSuccessors || []
        }));
        
        if (result.records.length > 0) {
          createdEntities.push(entity);
          console.error(`Event creation result: Success`);
        } else {
          console.error(`Event creation result: Failed`);
        }
      }
      else if (entity.entityType === 'Concept') {
        const result = await session.executeWrite(tx => tx.run(`
          MERGE (node:Memory {name: $name})
          SET node.nodeType = 'Concept',
              node:Concept,
              node.lastUpdated = datetime(),
              node.definition = $definition,
              node.description = $description,
              node.examples = $examples,
              node.relatedConcepts = $relatedConcepts,
              node.domain = $domain,
              node.significance = $significance,
              node.perspectives = $perspectives,
              node.historicalDevelopment = $historicalDevelopment,
              node.emotionalValence = $emotionalValence,
              node.emotionalArousal = $emotionalArousal,
              node.abstractionLevel = $abstractionLevel,
              node.metaphoricalMappings = $metaphoricalMappings,
              node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
          RETURN node
        `, {
          name: entity.name,
          definition: entity.definition || null,
          description: entity.description || null,
          examples: entity.examples || [],
          relatedConcepts: entity.relatedConcepts || [],
          domain: entity.domain || null,
          significance: entity.significance || null,
          perspectives: entity.perspectives || [],
          historicalDevelopment: entity.historicalDevelopment || [],
          emotionalValence: entity.emotionalValence || null,
          emotionalArousal: entity.emotionalArousal || null,
          abstractionLevel: entity.abstractionLevel || null,
          metaphoricalMappings: entity.metaphoricalMappings || []
        }));
        
        if (result.records.length > 0) {
          createdEntities.push(entity);
          console.error(`Concept creation result: Success`);
        } else {
          console.error(`Concept creation result: Failed`);
        }
      }
      else if (entity.entityType === 'ScientificInsight') {
        const result = await session.executeWrite(tx => tx.run(`
          MERGE (node:Memory {name: $name})
          SET node.nodeType = 'ScientificInsight',
              node:ScientificInsight,
              node.lastUpdated = datetime(),
              node.hypothesis = $hypothesis,
              node.evidence = $evidence,
              node.methodology = $methodology,
              node.confidence = $confidence,
              node.field = $field,
              node.publications = $publications,
              node.emotionalValence = $emotionalValence,
              node.emotionalArousal = $emotionalArousal,
              node.evidenceStrength = $evidenceStrength,
              node.scientificCounterarguments = $scientificCounterarguments,
              node.applicationDomains = $applicationDomains,
              node.replicationStatus = $replicationStatus,
              node.surpriseValue = $surpriseValue,
              node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
          RETURN node
        `, {
          name: entity.name,
          hypothesis: entity.hypothesis || null,
          evidence: entity.evidence || [],
          methodology: entity.methodology || null,
          confidence: entity.confidence || null,
          field: entity.field || null,
          publications: entity.publications || [],
          emotionalValence: entity.emotionalValence || null,
          emotionalArousal: entity.emotionalArousal || null,
          evidenceStrength: entity.evidenceStrength || null,
          scientificCounterarguments: entity.scientificCounterarguments || [],
          applicationDomains: entity.applicationDomains || [],
          replicationStatus: entity.replicationStatus || null,
          surpriseValue: entity.surpriseValue || null
        }));
        
        if (result.records.length > 0) {
          createdEntities.push(entity);
          console.error(`ScientificInsight creation result: Success`);
        } else {
          console.error(`ScientificInsight creation result: Failed`);
        }
      }
      else if (entity.entityType === 'Law') {
        const result = await session.executeWrite(tx => tx.run(`
          MERGE (node:Memory {name: $name})
          SET node.nodeType = 'Law',
              node:Law,
              node.lastUpdated = datetime(),
              node.statement = $statement,
              node.conditions = $conditions,
              node.exceptions = $exceptions,
              node.domain = $domain,
              node.proofs = $proofs,
              node.emotionalValence = $emotionalValence,
              node.emotionalArousal = $emotionalArousal,
              node.domainConstraints = $domainConstraints,
              node.historicalPrecedents = $historicalPrecedents,
              node.counterexamples = $counterexamples,
              node.formalRepresentation = $formalRepresentation,
              node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
          RETURN node
        `, {
          name: entity.name,
          statement: entity.statement || null,
          conditions: entity.conditions || [],
          exceptions: entity.exceptions || [],
          domain: entity.domain || null,
          proofs: entity.proofs || [],
          emotionalValence: entity.emotionalValence || null,
          emotionalArousal: entity.emotionalArousal || null,
          domainConstraints: entity.domainConstraints || [],
          historicalPrecedents: entity.historicalPrecedents || [],
          counterexamples: entity.counterexamples || [],
          formalRepresentation: entity.formalRepresentation || null
        }));
        
        if (result.records.length > 0) {
          createdEntities.push(entity);
          console.error(`Law creation result: Success`);
        } else {
          console.error(`Law creation result: Failed`);
        }
      }
      else if (entity.entityType === 'ReasoningChain') {
        const result = await session.executeWrite(tx => tx.run(`
          MERGE (node:Memory {name: $name})
          SET node.nodeType = 'ReasoningChain',
              node:ReasoningChain,
              node.lastUpdated = datetime(),
              node.description = $description,
              node.conclusion = $conclusion,
              node.confidenceScore = $confidenceScore,
              node.creator = $creator,
              node.methodology = $methodology,
              node.domain = $domain,
              node.tags = $tags,
              node.sourceThought = $sourceThought,
              node.numberOfSteps = $numberOfSteps,
              node.alternativeConclusionsConsidered = $alternativeConclusionsConsidered,
              node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
          RETURN node
        `, {
          name: entity.name,
          description: entity.description || null,
          conclusion: entity.conclusion || null,
          confidenceScore: entity.confidenceScore || null,
          creator: entity.createdBy || null,
          methodology: entity.methodology || null,
          domain: entity.domain || null,
          tags: entity.tags || [],
          sourceThought: entity.sourceThought || null,
          numberOfSteps: entity.numberOfSteps || 0,
          alternativeConclusionsConsidered: entity.alternativeConclusionsConsidered || []
        }));
        
        if (result.records.length > 0) {
          createdEntities.push(entity);
          console.error(`ReasoningChain creation result: Success`);
        } else {
          console.error(`ReasoningChain creation result: Failed`);
        }
      }
      else if (entity.entityType === 'ReasoningStep') {
        const result = await session.executeWrite(tx => tx.run(`
          MERGE (node:Memory {name: $name})
          SET node.nodeType = 'ReasoningStep',
              node:ReasoningStep,
              node.lastUpdated = datetime(),
              node.content = $content,
              node.stepType = $stepType,
              node.evidenceType = $evidenceType,
              node.supportingReferences = $supportingReferences,
              node.confidence = $confidence,
              node.alternatives = $alternatives,
              node.counterarguments = $counterarguments,
              node.assumptions = $assumptions,
              node.formalNotation = $formalNotation,
              node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
          RETURN node
        `, {
          name: entity.name,
          content: entity.content || null,
          stepType: entity.stepType || null,
          evidenceType: entity.evidenceType || null,
          supportingReferences: entity.supportingReferences || [],
          confidence: entity.confidence || null,
          alternatives: entity.alternatives || [],
          counterarguments: entity.counterarguments || [],
          assumptions: entity.assumptions || [],
          formalNotation: entity.formalNotation || null
        }));
        
        if (result.records.length > 0) {
          createdEntities.push(entity);
          console.error(`ReasoningStep creation result: Success`);
        } else {
          console.error(`ReasoningStep creation result: Failed`);
        }
      }
      else {
        console.error(`Unknown entity type: ${entity.entityType}, skipping`);
      }
    }
    
    return createdEntities;
  } catch (error) {
    console.error(`Error creating entities: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Create relations between entities in the Neo4j database
 * @param neo4jDriver - Neo4j driver instance
 * @param relations - Array of relations to create
 * @returns Promise resolving to the created relations
 */
export async function createRelations(neo4jDriver: Neo4jDriver, relations: Relation[]): Promise<Relation[]> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Creating ${relations.length} relations`);
    
    const createdRelations: Relation[] = [];
    
    // Process each relation separately for better debugging
    for (const relation of relations) {
      const enhancedRelation = relation as EnhancedRelation;
      console.error(`Processing relation: ${relation.from} --[${relation.relationType}]--> ${relation.to}`);
      
      // First check if both nodes exist and get their types
      const nodesExist = await session.executeRead(tx => tx.run(`
        MATCH (from:Memory {name: $fromName}), (to:Memory {name: $toName})
        RETURN from.nodeType as fromNodeType, to.nodeType as toNodeType
      `, { 
        fromName: relation.from,
        toName: relation.to
      }));
      
      if (nodesExist.records.length === 0) {
        console.error(`Failed to create relation - one or both nodes not found: ${relation.from} or ${relation.to}`);
        continue;
      }
      
      // Check if node types match the specified types (if provided)
      const fromNodeType = nodesExist.records[0].get('fromNodeType');
      const toNodeType = nodesExist.records[0].get('toNodeType');
      
      if (enhancedRelation.fromType && fromNodeType !== enhancedRelation.fromType) {
        console.error(`Type mismatch for source node. Expected: ${enhancedRelation.fromType}, Actual: ${fromNodeType}`);
        continue;
      }
      
      if (enhancedRelation.toType && toNodeType !== enhancedRelation.toType) {
        console.error(`Type mismatch for target node. Expected: ${enhancedRelation.toType}, Actual: ${toNodeType}`);
        continue;
      }
      
      // Create the relationship using the APOC library
      try {
        const result = await session.executeWrite(tx => tx.run(`
          MATCH (from:Memory {name: $fromName}), (to:Memory {name: $toName})
          CALL apoc.merge.relationship(from, $relType, {}, 
                                     {
                                       lastUpdated: datetime(),
                                       fromType: $fromNodeType,
                                       toType: $toNodeType,
                                       context: $context,
                                       confidenceScore: $confidenceScore,
                                       sources: $sources,
                                       weight: $weight,
                                       // Cognitive enhancement fields
                                       contextType: $contextType,
                                       contextStrength: $contextStrength,
                                       memoryAids: $memoryAids,
                                       relationshipCategory: $relationshipCategory
                                     }, to, {})
          YIELD rel
          RETURN rel
        `, {
          fromName: relation.from,
          toName: relation.to,
          relType: relation.relationType || 'RELATES_TO',
          fromNodeType: fromNodeType,
          toNodeType: toNodeType,
          context: enhancedRelation.context || null,
          confidenceScore: enhancedRelation.confidenceScore || null,
          sources: enhancedRelation.sources || [],
          weight: enhancedRelation.weight || null,
          // Cognitive enhancement fields
          contextType: enhancedRelation.contextType || null,
          contextStrength: enhancedRelation.contextStrength || null,
          memoryAids: enhancedRelation.memoryAids || [],
          relationshipCategory: enhancedRelation.relationshipCategory || null
        }));
        
        if (result.records.length > 0) {
          console.error(`Relationship created successfully: ${relation.from} (${fromNodeType}) --[${relation.relationType}]--> ${relation.to} (${toNodeType})`);
          createdRelations.push(relation);
        } else {
          console.error(`Failed to create relationship: ${relation.from} (${fromNodeType}) --[${relation.relationType}]--> ${relation.to} (${toNodeType})`);
        }
      } catch (relError) {
        // Handle the case where APOC might not be available
        console.error(`Error with APOC for relation creation: ${relError}`);
        
        // Fallback to standard Cypher if APOC fails
        try {
          const fallbackResult = await session.executeWrite(tx => tx.run(`
            MATCH (from:Memory {name: $fromName}), (to:Memory {name: $toName})
            MERGE (from)-[r:${relation.relationType || 'RELATES_TO'}]->(to)
            ON CREATE SET r = $properties
            ON MATCH SET r = $properties
            RETURN r
          `, {
            fromName: relation.from,
            toName: relation.to,
            properties: {
              lastUpdated: new Date().toISOString(),
              fromType: fromNodeType,
              toType: toNodeType,
              context: enhancedRelation.context,
              confidenceScore: enhancedRelation.confidenceScore,
              sources: enhancedRelation.sources,
              weight: enhancedRelation.weight,
              contextType: enhancedRelation.contextType,
              contextStrength: enhancedRelation.contextStrength,
              memoryAids: enhancedRelation.memoryAids,
              relationshipCategory: enhancedRelation.relationshipCategory
            }
          }));
          
          if (fallbackResult.records.length > 0) {
            console.error(`Relationship created with fallback method: ${relation.from} --[${relation.relationType}]--> ${relation.to}`);
            createdRelations.push(relation);
          } else {
            console.error(`Failed to create relationship with fallback method: ${relation.from} --[${relation.relationType}]--> ${relation.to}`);
          }
        } catch (fallbackError) {
          console.error(`Fallback relation creation failed too: ${fallbackError}`);
        }
      }
    }
    
    return createdRelations;
  } catch (error) {
    console.error(`Error creating relations: ${error}`);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Search for nodes in the Neo4j database
 * @param neo4jDriver - Neo4j driver instance
 * @param query - Search query
 * @returns Promise resolving to the matching knowledge graph
 */
export async function searchNodes(neo4jDriver: Neo4jDriver, query: string): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Searching for nodes with query: ${query}`);
    
    // Sanitize the query for use in Cypher
    const sanitizedQuery = query.replace(/['"\\]/g, '\\$&');
    
    // Create a full-text search query that searches across multiple fields
    const result = await session.executeRead(tx => tx.run(`
      // First find nodes that match the query
      CALL {
        MATCH (node:Memory)
        WHERE 
          node.name =~ '(?i).*${sanitizedQuery}.*' OR
          (node:Entity AND any(obs IN node.observations WHERE obs =~ '(?i).*${sanitizedQuery}.*')) OR
          (node:Concept AND (
            node.definition =~ '(?i).*${sanitizedQuery}.*' OR
            any(ex IN node.examples WHERE ex =~ '(?i).*${sanitizedQuery}.*') OR
            node.description =~ '(?i).*${sanitizedQuery}.*'
          )) OR
          (node:Event AND (
            node.outcome =~ '(?i).*${sanitizedQuery}.*' OR
            node.significance =~ '(?i).*${sanitizedQuery}.*'
          )) OR
          (node:Law AND (
            node.statement =~ '(?i).*${sanitizedQuery}.*'
          )) OR
          (node:ScientificInsight AND (
            node.hypothesis =~ '(?i).*${sanitizedQuery}.*'
          )) OR
          (node:ReasoningChain AND (
            node.description =~ '(?i).*${sanitizedQuery}.*' OR
            node.conclusion =~ '(?i).*${sanitizedQuery}.*'
          )) OR
          (node:ReasoningStep AND (
            node.content =~ '(?i).*${sanitizedQuery}.*'
          ))
        RETURN node
      }

      // Get all relationships between the matching nodes
      MATCH (node)-[rel]->(otherNode:Memory)
      WHERE otherNode IN COLLECT(node)
      
      // Return both nodes and relationships
      RETURN COLLECT(DISTINCT node) as nodes, COLLECT(DISTINCT rel) as relations
    `));
    
    if (result.records.length === 0) {
      console.error('No results found for search');
      return { entities: [], relations: [] };
    }
    
    const nodes = result.records[0].get('nodes');
    const relations = result.records[0].get('relations');
    
    console.error(`Search found ${nodes.length} nodes and ${relations.length} relations`);
    
    // Convert Neo4j nodes to Entity objects
    const entities: Entity[] = nodes.map((node: any) => {
      const entityType = node.properties.nodeType || 'Entity';
      
      // Basic entity structure
      const entity: Entity = {
        name: node.properties.name,
        entityType: entityType,
        observations: node.properties.observations || []
      };
      
      // Process date fields
      const processedEntity = processEntityDates(node.properties);
      
      // Add additional properties based on entity type
      switch (entityType) {
        case 'Entity':
          entity.description = processedEntity.description;
          entity.confidence = processedEntity.confidence;
          entity.source = processedEntity.source;
          entity.biography = processedEntity.biography;
          entity.keyContributions = processedEntity.keyContributions;
          entity.emotionalValence = processedEntity.emotionalValence;
          entity.emotionalArousal = processedEntity.emotionalArousal;
          break;
        
        case 'Event':
          entity.startDate = processedEntity.startDate;
          entity.endDate = processedEntity.endDate;
          entity.status = processedEntity.status;
          entity.location = processedEntity.location;
          entity.participants = processedEntity.participants;
          entity.outcome = processedEntity.outcome;
          entity.significance = processedEntity.significance;
          entity.emotionalValence = processedEntity.emotionalValence;
          entity.emotionalArousal = processedEntity.emotionalArousal;
          entity.causalPredecessors = processedEntity.causalPredecessors;
          entity.causalSuccessors = processedEntity.causalSuccessors;
          break;
        
        case 'Concept':
          entity.definition = processedEntity.definition;
          entity.description = processedEntity.description;
          entity.examples = processedEntity.examples;
          entity.relatedConcepts = processedEntity.relatedConcepts;
          entity.domain = processedEntity.domain;
          entity.significance = processedEntity.significance;
          entity.perspectives = processedEntity.perspectives;
          entity.historicalDevelopment = processedEntity.historicalDevelopment;
          entity.emotionalValence = processedEntity.emotionalValence;
          entity.emotionalArousal = processedEntity.emotionalArousal;
          entity.abstractionLevel = processedEntity.abstractionLevel;
          entity.metaphoricalMappings = processedEntity.metaphoricalMappings;
          break;
        
        case 'ScientificInsight':
          entity.hypothesis = processedEntity.hypothesis;
          entity.evidence = processedEntity.evidence;
          entity.methodology = processedEntity.methodology;
          entity.confidence = processedEntity.confidence;
          entity.field = processedEntity.field;
          entity.publications = processedEntity.publications;
          entity.emotionalValence = processedEntity.emotionalValence;
          entity.emotionalArousal = processedEntity.emotionalArousal;
          entity.evidenceStrength = processedEntity.evidenceStrength;
          entity.scientificCounterarguments = processedEntity.scientificCounterarguments;
          entity.applicationDomains = processedEntity.applicationDomains;
          entity.replicationStatus = processedEntity.replicationStatus;
          entity.surpriseValue = processedEntity.surpriseValue;
          break;
          
        case 'Law':
          entity.statement = processedEntity.statement;
          entity.conditions = processedEntity.conditions;
          entity.exceptions = processedEntity.exceptions;
          entity.domain = processedEntity.domain;
          entity.proofs = processedEntity.proofs;
          entity.emotionalValence = processedEntity.emotionalValence;
          entity.emotionalArousal = processedEntity.emotionalArousal;
          entity.domainConstraints = processedEntity.domainConstraints;
          entity.historicalPrecedents = processedEntity.historicalPrecedents;
          entity.counterexamples = processedEntity.counterexamples;
          entity.formalRepresentation = processedEntity.formalRepresentation;
          break;
          
        case 'ReasoningChain':
          entity.description = processedEntity.description;
          entity.conclusion = processedEntity.conclusion;
          entity.confidenceScore = processedEntity.confidenceScore;
          entity.createdBy = processedEntity.creator;
          entity.domain = processedEntity.domain;
          entity.tags = processedEntity.tags;
          break;
          
        case 'ReasoningStep':
          entity.content = processedEntity.content;
          entity.confidence = processedEntity.confidence;
          entity.sourceThought = processedEntity.sourceThought;
          break;
      }
      
      return entity;
    });
    
    // Convert Neo4j relationships to Relation objects
    const enhancedRelations: EnhancedRelation[] = relations.map((rel: any) => {
      const relation: EnhancedRelation = {
        from: rel.start.properties.name,
        to: rel.end.properties.name,
        relationType: rel.type,
        // Add enhanced properties
        fromType: rel.properties.fromType,
        toType: rel.properties.toType,
        context: rel.properties.context,
        confidenceScore: rel.properties.confidenceScore,
        sources: rel.properties.sources,
        weight: rel.properties.weight,
        contextType: rel.properties.contextType,
        contextStrength: rel.properties.contextStrength,
        memoryAids: rel.properties.memoryAids,
        relationshipCategory: rel.properties.relationshipCategory
      };
      
      return relation;
    });
    
    return { entities, relations: enhancedRelations };
  } catch (error) {
    console.error(`Error searching nodes: ${error}`);
    return { entities: [], relations: [] };
  } finally {
    await session.close();
  }
}

/**
 * Create a thought node in the Neo4j database
 * @param neo4jDriver - Neo4j driver instance
 * @param thought - Thought data
 * @returns Promise resolving to the created entity
 */
export async function createThought(
  neo4jDriver: Neo4jDriver, 
  thought: {
    entityName?: string;
    title: string;
    thoughtContent: string;
    entities?: string[];
    concepts?: string[];
    events?: string[];
    scientificInsights?: string[];
    laws?: string[];
    thoughts?: string[];
    confidence?: number;
    source?: string;
    createdBy?: string;
    tags?: string[];
    impact?: string;
    emotionalValence?: number;
    emotionalArousal?: number;
    evidentialBasis?: string[];
    thoughtCounterarguments?: string[];
    implications?: string[];
    thoughtConfidenceScore?: number;
  }
): Promise<Entity> {
  const session = neo4jDriver.session();
  
  try {
    // Implementation will be added in a future refactoring phase
    console.error(`Creating thought: ${thought.title}`);
    
    // Return a basic entity for now
    return {
      name: thought.entityName || thought.title,
      entityType: 'Thought',
      observations: []
    };
  } catch (error) {
    console.error('Error creating thought:', error);
    throw error;
  } finally {
    await session.close();
  }
}

/**
 * Create a reasoning chain in the Neo4j database
 * @param neo4jDriver - Neo4j driver instance
 * @param reasoningChain - Reasoning chain data
 * @returns Promise resolving to the created entity
 */
export async function createReasoningChain(
  neo4jDriver: Neo4jDriver,
  reasoningChain: {
    name: string;
    description: string;
    conclusion: string;
    confidenceScore: number;
    sourceThought?: string;
    creator: string;
    methodology: 'deductive' | 'inductive' | 'abductive' | 'analogical' | 'mixed';
    domain?: string;
    tags?: string[];
    alternativeConclusionsConsidered?: string[];
  }
): Promise<Entity> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Creating reasoning chain: ${reasoningChain.name}`);
    
    // First check if sourceThought exists if provided
    if (reasoningChain.sourceThought) {
      const thoughtCheck = await session.executeRead(tx => tx.run(`
        MATCH (t:Memory:Thought {name: $thoughtName})
        RETURN t
      `, { thoughtName: reasoningChain.sourceThought }));
      
      if (thoughtCheck.records.length === 0) {
        console.error(`Warning: Source thought "${reasoningChain.sourceThought}" not found. Will create the chain without connecting to a thought.`);
      } else {
        console.error(`Found source thought "${reasoningChain.sourceThought}" for the chain.`);
      }
    }
    
    // Log the parameters being sent to Neo4j
    console.error('Creating reasoning chain with parameters:', {
      name: reasoningChain.name,
      description: reasoningChain.description ? reasoningChain.description.substring(0, 50) + '...' : null,
      conclusion: reasoningChain.conclusion ? reasoningChain.conclusion.substring(0, 50) + '...' : null,
      confidenceScore: reasoningChain.confidenceScore,
      methodology: reasoningChain.methodology,
      sourceThought: reasoningChain.sourceThought,
      tags: reasoningChain.tags,
      alternativeConclusionsConsidered: reasoningChain.alternativeConclusionsConsidered
    });
    
    // Create the ReasoningChain node
    const createResult = await session.executeWrite(tx => tx.run(`
      MERGE (rc:Memory:ReasoningChain {name: $name})
      SET rc.nodeType = 'ReasoningChain',
          rc.description = $description,
          rc.conclusion = $conclusion,
          rc.confidenceScore = $confidenceScore,
          rc.creator = $creator,
          rc.methodology = $methodology,
          rc.domain = $domain,
          rc.tags = $tags,
          rc.sourceThought = $sourceThought,
          rc.alternativeConclusionsConsidered = $alternativeConclusionsConsidered,
          rc.numberOfSteps = 0,
          rc.createdAt = CASE WHEN rc.createdAt IS NULL THEN datetime() ELSE rc.createdAt END,
          rc.lastUpdated = datetime()
      RETURN rc
    `, {
      name: reasoningChain.name,
      description: reasoningChain.description,
      conclusion: reasoningChain.conclusion,
      confidenceScore: reasoningChain.confidenceScore,
      creator: reasoningChain.creator,
      methodology: reasoningChain.methodology,
      domain: reasoningChain.domain || null,
      tags: reasoningChain.tags || [],
      sourceThought: reasoningChain.sourceThought || null,
      alternativeConclusionsConsidered: reasoningChain.alternativeConclusionsConsidered || []
    }));
    
    if (createResult.records.length === 0) {
      console.error(`Failed to create ReasoningChain node. No results returned from CREATE operation.`);
      throw new Error(`Failed to create ReasoningChain node - database did not return the created node`);
    }
    
    console.error(`Successfully created reasoning chain node: "${reasoningChain.name}"`);
    const chainNode = createResult.records[0].get('rc');
    
    // If a sourceThought was provided and exists, create the relationship in a separate query
    if (reasoningChain.sourceThought) {
      try {
        const relResult = await session.executeWrite(tx => tx.run(`
          MATCH (t:Memory:Thought {name: $thoughtName})
          MATCH (rc:Memory:ReasoningChain {name: $chainName})
          MERGE (t)-[r:HAS_REASONING]->(rc)
          SET r.lastUpdated = datetime()
          RETURN r
        `, {
          thoughtName: reasoningChain.sourceThought,
          chainName: reasoningChain.name
        }));
        
        if (relResult.records.length > 0) {
          console.error(`Successfully connected chain to thought "${reasoningChain.sourceThought}"`);
        } else {
          console.error(`Warning: Failed to connect chain to thought "${reasoningChain.sourceThought}". Relationship not created.`);
        }
      } catch (relError) {
        console.error(`Error connecting chain to thought:`, relError);
        // Don't fail the whole operation if just the relationship creation fails
      }
    }
    
    // Convert to Entity format for return
    const chainEntity: Entity = {
      name: chainNode.properties.name,
      entityType: 'ReasoningChain',
      observations: []
    };
    
    return chainEntity;
  } catch (error) {
    // Enhanced error message with more context
    const errorMessage = `Error creating reasoning chain "${reasoningChain.name}": ${error.message || error}`;
    console.error(errorMessage);
    
    // If it's a Neo4j driver error, log more details
    if ((error as any).code) {
      console.error(`Neo4j error code: ${(error as any).code}`);
    }
    
    throw new Error(errorMessage);
  } finally {
    await session.close();
  }
}

/**
 * Create a reasoning step in the Neo4j database
 * @param neo4jDriver - Neo4j driver instance
 * @param stepData - Reasoning step data
 * @returns Promise resolving to the created entity
 */
export async function createReasoningStep(
  neo4jDriver: Neo4jDriver,
  stepData: {
    chainName: string;
    name: string;
    content: string;
    stepNumber: number;
    stepType: 'premise' | 'inference' | 'evidence' | 'counterargument' | 'rebuttal' | 'conclusion';
    evidenceType?: 'observation' | 'fact' | 'assumption' | 'inference' | 'expert_opinion' | 'statistical_data';
    supportingReferences?: string[];
    confidence: number;
    alternatives?: string[];
    counterarguments?: string[];
    assumptions?: string[];
    formalNotation?: string;
    previousSteps?: string[];
  }
): Promise<Entity> {
  const session = neo4jDriver.session();
  
  try {
    console.error(`Creating reasoning step: "${stepData.name}" for chain: "${stepData.chainName}`);
    
    // First check if the chain exists
    const chainExists = await session.executeRead(tx => tx.run(`
      MATCH (rc:Memory:ReasoningChain {name: $chainName})
      RETURN rc
    `, { chainName: stepData.chainName }));
    
    if (chainExists.records.length === 0) {
      const errorMsg = `ReasoningChain "${stepData.chainName}" not found`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    console.error(`Found chain "${stepData.chainName}", proceeding with step creation`);
    
    // Log the step data for debugging
    console.error('Creating reasoning step with parameters:', {
      name: stepData.name,
      content: stepData.content ? stepData.content.substring(0, 50) + '...' : null,
      stepNumber: stepData.stepNumber,
      stepType: stepData.stepType,
      evidenceType: stepData.evidenceType,
      confidence: stepData.confidence,
      supportingReferences: stepData.supportingReferences ? 
        `${stepData.supportingReferences.length} references` : 'none',
      previousSteps: stepData.previousSteps ? 
        `${stepData.previousSteps.length} previous steps` : 'none'
    });
    
    // Check if the step already exists
    const stepCheck = await session.executeRead(tx => tx.run(`
      MATCH (rs:Memory:ReasoningStep {name: $name})
      RETURN rs
    `, { name: stepData.name }));
    
    if (stepCheck.records.length > 0) {
      console.error(`Note: Step "${stepData.name}" already exists. Will update its properties.`);
    }
    
    // Create the ReasoningStep node
    const result = await session.executeWrite(tx => tx.run(`
      // Create the step node
      MERGE (rs:Memory:ReasoningStep {name: $name})
      SET rs.nodeType = 'ReasoningStep',
          rs.content = $content,
          rs.stepType = $stepType,
          rs.evidenceType = $evidenceType,
          rs.supportingReferences = $supportingReferences,
          rs.confidence = $confidence,
          rs.alternatives = $alternatives,
          rs.counterarguments = $counterarguments,
          rs.assumptions = $assumptions,
          rs.formalNotation = $formalNotation,
          rs.createdAt = CASE WHEN rs.createdAt IS NULL THEN datetime() ELSE rs.createdAt END,
          rs.lastUpdated = datetime()
      
      // Connect to the reasoning chain with step order
      WITH rs
      MATCH (rc:Memory:ReasoningChain {name: $chainName})
      MERGE (rc)-[r:CONTAINS_STEP {order: $stepNumber}]->(rs)
      SET r.lastUpdated = datetime()
      
      // Update the numberOfSteps counter if this is a new maximum
      WITH rc, rs, $stepNumber as newStep
      SET rc.numberOfSteps = CASE 
          WHEN rc.numberOfSteps IS NULL THEN newStep
          WHEN rc.numberOfSteps < newStep THEN newStep
          ELSE rc.numberOfSteps 
        END
      
      RETURN rs
    `, {
      name: stepData.name,
      chainName: stepData.chainName,
      content: stepData.content,
      stepNumber: stepData.stepNumber,
      stepType: stepData.stepType,
      evidenceType: stepData.evidenceType || null,
      supportingReferences: stepData.supportingReferences || [],
      confidence: stepData.confidence,
      alternatives: stepData.alternatives || [],
      counterarguments: stepData.counterarguments || [],
      assumptions: stepData.assumptions || [],
      formalNotation: stepData.formalNotation || null
    }));
    
    if (result.records.length === 0) {
      const errorMsg = `Failed to create ReasoningStep node "${stepData.name}"`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
    
    console.error(`Successfully created reasoning step "${stepData.name}"`);
    
    // Create relationships to supporting references
    if (stepData.supportingReferences && stepData.supportingReferences.length > 0) {
      try {
        console.error(`Adding ${stepData.supportingReferences.length} supporting references to step "${stepData.name}"`);
        
        // First check which references exist
        const refCheck = await session.executeRead(tx => tx.run(`
          UNWIND $references as refName
          MATCH (ref:Memory {name: refName})
          RETURN ref.name as foundRef
        `, { references: stepData.supportingReferences }));
        
        const foundRefs = refCheck.records.map(record => record.get('foundRef'));
        
        if (foundRefs.length < stepData.supportingReferences.length) {
          const missingRefs = stepData.supportingReferences.filter(ref => !foundRefs.includes(ref));
          console.error(`Warning: Some supporting references not found: ${missingRefs.join(', ')}`);
        }
        
        if (foundRefs.length > 0) {
          const refResult = await session.executeWrite(tx => tx.run(`
            MATCH (rs:ReasoningStep:Memory {name: $stepName})
            UNWIND $references as refName
            MATCH (ref:Memory {name: refName})
            MERGE (rs)-[r:REFERENCES]->(ref)
            SET r.lastUpdated = datetime()
            RETURN count(r) as relCount
          `, {
            stepName: stepData.name,
            references: foundRefs
          }));
          
          const relCount = refResult.records[0].get('relCount').toNumber();
          console.error(`Created ${relCount} reference relationships from step "${stepData.name}"`);
        }
      } catch (refError) {
        console.error(`Error creating reference relationships:`, refError);
        // Don't fail the entire operation if just the references fail
      }
    }
    
    // Create relationships to previous steps
    if (stepData.previousSteps && stepData.previousSteps.length > 0) {
      try {
        console.error(`Adding ${stepData.previousSteps.length} previous step connections to step "${stepData.name}"`);
        
        // First check which previous steps exist
        const prevCheck = await session.executeRead(tx => tx.run(`
          UNWIND $prevSteps as prevName
          MATCH (prev:ReasoningStep:Memory {name: prevName})
          RETURN prev.name as foundPrev
        `, { prevSteps: stepData.previousSteps }));
        
        const foundPrevs = prevCheck.records.map(record => record.get('foundPrev'));
        
        if (foundPrevs.length < stepData.previousSteps.length) {
          const missingPrevs = stepData.previousSteps.filter(prev => !foundPrevs.includes(prev));
          console.error(`Warning: Some previous steps not found: ${missingPrevs.join(', ')}`);
        }
        
        if (foundPrevs.length > 0) {
          const prevResult = await session.executeWrite(tx => tx.run(`
            MATCH (rs:ReasoningStep:Memory {name: $stepName})
            UNWIND $prevSteps as prevName
            MATCH (prev:ReasoningStep:Memory {name: prevName})
            MERGE (prev)-[r:LEADS_TO]->(rs)
            SET r.lastUpdated = datetime()
            RETURN count(r) as relCount
          `, {
            stepName: stepData.name,
            prevSteps: foundPrevs
          }));
          
          const relCount = prevResult.records[0].get('relCount').toNumber();
          console.error(`Created ${relCount} LEADS_TO relationships to step "${stepData.name}"`);
        }
      } catch (prevError) {
        console.error(`Error creating previous step relationships:`, prevError);
        // Don't fail the entire operation if just the previous step connections fail
      }
    }
    
    const stepNode = result.records[0].get('rs');
    
    // Convert to Entity format for return
    const stepEntity: Entity = {
      name: stepNode.properties.name,
      entityType: 'ReasoningStep',
      observations: []
    };
    
    return stepEntity;
  } catch (error) {
    // Enhanced error message with more context
    const errorMessage = `Error creating reasoning step "${stepData.name}" for chain "${stepData.chainName}": ${error.message || error}`;
    console.error(errorMessage);
    
    // If it's a Neo4j driver error, log more details
    if ((error as any).code) {
      console.error(`Neo4j error code: ${(error as any).code}`);
    }
    
    throw new Error(errorMessage);
  } finally {
    await session.close();
  }
} 