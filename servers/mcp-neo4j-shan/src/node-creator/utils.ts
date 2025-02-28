import { Driver as Neo4jDriver, DateTime as Neo4jDateTime, isDateTime } from 'neo4j-driver';
import { KnowledgeGraph, EntityWithRelationsResult, Entity } from '../types/index.js';

/**
 * Converts a Neo4j DateTime object to a JavaScript Date object
 * @param neo4jDateTime - Neo4j DateTime object
 * @returns JavaScript Date object
 */
export function neo4jDateTimeToJSDate(neo4jDateTime: Neo4jDateTime | any): Date | null {
  if (!neo4jDateTime) return null;
  
  if (isDateTime(neo4jDateTime)) {
    // If it's already a Neo4j DateTime object, use its built-in toStandardDate method
    return neo4jDateTime.toStandardDate();
  }
  
  // Handle the case where we get the nested object representation
  if (neo4jDateTime.year && neo4jDateTime.month && neo4jDateTime.day) {
    const year = typeof neo4jDateTime.year === 'object' ? neo4jDateTime.year.low : neo4jDateTime.year;
    const month = typeof neo4jDateTime.month === 'object' ? neo4jDateTime.month.low : neo4jDateTime.month;
    const day = typeof neo4jDateTime.day === 'object' ? neo4jDateTime.day.low : neo4jDateTime.day;
    const hour = neo4jDateTime.hour ? 
      (typeof neo4jDateTime.hour === 'object' ? neo4jDateTime.hour.low : neo4jDateTime.hour) : 0;
    const minute = neo4jDateTime.minute ? 
      (typeof neo4jDateTime.minute === 'object' ? neo4jDateTime.minute.low : neo4jDateTime.minute) : 0;
    const second = neo4jDateTime.second ? 
      (typeof neo4jDateTime.second === 'object' ? neo4jDateTime.second.low : neo4jDateTime.second) : 0;
    const millisecond = neo4jDateTime.nanosecond ? 
      Math.floor((typeof neo4jDateTime.nanosecond === 'object' ? 
        neo4jDateTime.nanosecond.low : neo4jDateTime.nanosecond) / 1000000) : 0;
    
    // Create the JavaScript date (month is 0-indexed in JS Date)
    return new Date(year, month - 1, day, hour, minute, second, millisecond);
  }
  
  return null;
}

/**
 * Formats a Neo4j DateTime object as a string
 * @param neo4jDateTime - Neo4j DateTime object
 * @param format - Optional format string (default is ISO string)
 * @returns Formatted date string
 */
export function formatNeo4jDateTime(neo4jDateTime: Neo4jDateTime | any, format: string = 'iso'): string | null {
  const jsDate = neo4jDateTimeToJSDate(neo4jDateTime);
  if (!jsDate) return null;
  
  switch (format.toLowerCase()) {
    case 'iso':
      return jsDate.toISOString();
    case 'simple':
      return jsDate.toLocaleString();
    case 'date':
      return jsDate.toLocaleDateString();
    case 'time':
      return jsDate.toLocaleTimeString();
    default:
      return jsDate.toISOString();
  }
}

/**
 * Processes an entity object, converting any Neo4j DateTime properties to JavaScript Date objects
 * @param entity - Entity object with potential Neo4j DateTime properties
 * @returns Entity with converted date properties
 */
export function processEntityDates(entity: any): any {
  const processed = { ...entity };
  
  // Convert common date fields
  if (processed.createdAt) {
    processed.createdAt = neo4jDateTimeToJSDate(processed.createdAt);
  }
  
  if (processed.lastUpdated) {
    processed.lastUpdated = neo4jDateTimeToJSDate(processed.lastUpdated);
  }
  
  // Handle Event-specific date fields
  if (processed.startDate) {
    processed.startDate = neo4jDateTimeToJSDate(processed.startDate);
  }
  
  if (processed.endDate) {
    processed.endDate = neo4jDateTimeToJSDate(processed.endDate);
  }
  
  if (processed.timestamp) {
    processed.timestamp = neo4jDateTimeToJSDate(processed.timestamp);
  }
  
  return processed;
}

/**
 * Load the current graph from the Neo4j database
 * @param neo4jDriver - Neo4j driver instance
 * @returns Promise resolving to the knowledge graph
 */
export async function loadGraph(neo4jDriver: Neo4jDriver): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();

  try {
    // Execute a Cypher statement in a Read Transaction that matches all node types
    const res = await session.executeRead(tx => tx.run<EntityWithRelationsResult>(`
      MATCH (entity)
      WHERE entity:Entity OR entity:Event OR entity:Concept OR entity:ScientificInsight OR entity:Law OR entity:Thought
      OPTIONAL MATCH (entity)-[r]->(other)
      RETURN entity, collect(r) as relations
    `));
    
    const entities: Entity[] = [];
    const relations: any[] = [];
    
    for (const row of res.records) {
      const entityNode = row.get('entity');
      const entityRelationships = row.get('relations');

      // Convert Neo4j node to Entity format
      const entity: Entity = {
        name: entityNode.properties.name,
        entityType: entityNode.properties.nodeType || 'Entity',
        observations: 'observations' in entityNode.properties ? 
          entityNode.properties.observations : []
      };
      
      // Process any date fields in the entity
      const processedEntity = processEntityDates({ 
        ...entity, 
        ...entityNode.properties 
      });
      
      // Keep only the Entity interface properties
      entities.push({
        name: processedEntity.name,
        entityType: processedEntity.entityType,
        observations: processedEntity.observations
      });
      
      // Add relations
      for (const rel of entityRelationships) {
        // Process date fields in relations if any
        const processedRelation = processEntityDates(rel.properties);
        relations.push(processedRelation);
      }
    }

    console.error(`Loaded ${entities.length} entities and ${relations.length} relations`);
    return { entities, relations };
  } catch (error) {
    console.error('Error loading graph:', error);
    return { entities: [], relations: [] };
  }
  finally {
    // Close the Session
    await session.close();
  }
}

/**
 * Save the graph to the Neo4j database
 * @param neo4jDriver - Neo4j driver instance
 * @param graph - The graph to save
 */
export async function saveGraph(neo4jDriver: Neo4jDriver, graph: KnowledgeGraph): Promise<void> {
  const session = neo4jDriver.session();

  try {
    await session.executeWrite(async tx => {
      // Create entities
      for (const entity of graph.entities) {
        const entityType = entity.entityType || 'Entity';
        
        // Prepare entity properties
        const properties: Record<string, any> = {
          name: entity.name,
          nodeType: entityType
        };
        
        // Add other properties based on entity type
        switch (entityType) {
          case 'Entity':
            if (entity.description) properties.description = entity.description;
            if (entity.observations) properties.observations = entity.observations;
            if (entity.confidence) properties.confidence = entity.confidence;
            if (entity.source) properties.source = entity.source;
            if (entity.biography) properties.biography = entity.biography;
            if (entity.keyContributions) properties.keyContributions = entity.keyContributions;
            if (entity.emotionalValence !== undefined) properties.emotionalValence = entity.emotionalValence;
            if (entity.emotionalArousal !== undefined) properties.emotionalArousal = entity.emotionalArousal;
            break;
            
          case 'Event':
            if (entity.description) properties.description = entity.description;
            if (entity.startDate) properties.startDate = entity.startDate;
            if (entity.endDate) properties.endDate = entity.endDate;
            if (entity.status) properties.status = entity.status;
            if (entity.location) properties.location = entity.location;
            if (entity.participants) properties.participants = entity.participants;
            if (entity.outcome) properties.outcome = entity.outcome;
            if (entity.significance) properties.significance = entity.significance;
            if (entity.emotionalValence !== undefined) properties.emotionalValence = entity.emotionalValence;
            if (entity.emotionalArousal !== undefined) properties.emotionalArousal = entity.emotionalArousal;
            if (entity.causalPredecessors) properties.causalPredecessors = entity.causalPredecessors;
            if (entity.causalSuccessors) properties.causalSuccessors = entity.causalSuccessors;
            break;
            
          // Add other entity types as needed...
        }
        
        // Create or merge the entity
        await tx.run(`
          MERGE (e:${entityType} {name: $name})
          ON CREATE SET e = $properties
          ON MATCH SET e = $properties
        `, {
          name: entity.name,
          properties
        });
      }
      
      // Create relations
      for (const relation of graph.relations) {
        await tx.run(`
          MATCH (from {name: $fromName})
          MATCH (to {name: $toName})
          MERGE (from)-[r:${relation.relationType || 'RELATES_TO'}]->(to)
          ON CREATE SET r = $properties
          ON MATCH SET r = $properties
        `, {
          fromName: relation.from,
          toName: relation.to,
          properties: {
            ...relation,
            relationType: relation.relationType || 'RELATES_TO'
          }
        });
      }
    });
    
    console.error(`Saved ${graph.entities.length} entities and ${graph.relations.length} relations`);
  } catch (error) {
    console.error('Error saving graph:', error);
    throw error;
  }
  finally {
    await session.close();
  }
} 