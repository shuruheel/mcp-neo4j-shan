import { Driver as Neo4jDriver } from 'neo4j-driver';
import { KnowledgeGraph, EntityWithRelationsResult, Entity } from '../types/index.js';

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

      entities.push(entity);
      
      // Add relations
      for (const rel of entityRelationships) {
        relations.push(rel.properties);
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