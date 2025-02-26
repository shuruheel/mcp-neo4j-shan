import { Driver as Neo4jDriver } from 'neo4j-driver';
import { Entity, Relation, EnhancedRelation } from '../../types/index.js';

/**
 * Retrieves a temporal sequence of related events and concepts starting from a given node.
 * This implements the feature to visualize temporal sequences based on cognitive science principles.
 * 
 * @param neo4jDriver - Neo4j driver instance
 * @param startNodeName - The name of the node to start the temporal sequence from
 * @param direction - The direction of the temporal sequence: 'forward' (later events), 'backward' (earlier events), or 'both'
 * @param maxEvents - Maximum number of events to retrieve in the sequence
 * @returns A promise resolving to an object containing the sequence nodes and their connections
 */
export async function getTemporalSequence(
  neo4jDriver: Neo4jDriver,
  startNodeName: string, 
  direction: 'forward' | 'backward' | 'both' = 'both',
  maxEvents: number = 10
): Promise<{sequence: Entity[], connections: Relation[]}> {
  const session = neo4jDriver.session();
  
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
        if (node.properties.location) {
          (entity as any).location = node.properties.location;
        }
        if (node.properties.participants) {
          (entity as any).participants = node.properties.participants;
        }
        if (node.properties.outcome) {
          (entity as any).outcome = node.properties.outcome;
        }
        
        // Only add if not already in the sequence
        if (!sequence.some(e => e.name === entity.name)) {
          sequence.push(entity);
        }
      });
      
      // Convert relationships to Relation format
      rels.forEach((rel: any) => {
        const relation: Relation = {
          from: rel.properties.fromName || nodes.find((n: any) => n.identity.equals(rel.start)).properties.name,
          to: rel.properties.toName || nodes.find((n: any) => n.identity.equals(rel.end)).properties.name,
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