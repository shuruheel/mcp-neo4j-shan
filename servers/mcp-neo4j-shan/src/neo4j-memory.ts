import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

import neo4j, { Integer, Node, Relationship, Driver as Neo4jDriver, DateTime } from 'neo4j-driver'

import { KnowledgeGraphMemory, Entity, KnowledgeGraph, Relation } from "@neo4j/graphrag-memory";

// Base interface for all node types
interface BaseNode {
  name: string;
  createdAt: DateTime;
  lastUpdated: DateTime;
}

// Enhanced node type interfaces
interface EnhancedEntity extends BaseNode {
  nodeType: 'Entity';
  observations: string[];
  confidence?: number;
  source?: string;
  description?: string;
}

interface Event extends BaseNode {
  nodeType: 'Event';
  startDate?: string;
  endDate?: string;
  status?: string; // "Ongoing", "Concluded", "Planned"
  timestamp?: string;
  duration?: string;
  location?: string;
  participants: string[];
  outcome: string;
  significance?: string;
}

interface Concept extends BaseNode {
  nodeType: 'Concept';
  definition: string;
  description?: string;
  examples: string[];
  relatedConcepts: string[];
  domain: string;
  significance?: string;
}

interface Thought extends BaseNode {
  nodeType: 'Thought';
  content: string;         // The main thought/observation content
  references: string[];    // Names of entities/concepts/events referenced
  confidence?: number;     // How confident is this thought (0-1)
  source?: string;         // Where did this thought come from (person, document)
  createdBy?: string;      // Who created this thought
  tags?: string[];         // Classification tags 
  impact?: string;         // Potential impact or importance
}

interface ScientificInsight extends BaseNode {
  nodeType: 'ScientificInsight';
  hypothesis: string;
  evidence: string[];
  methodology?: string;
  confidence: number;
  field: string;
  publications?: string[];
}

interface Law extends BaseNode {
  nodeType: 'Law';
  statement: string;
  conditions: string[];
  exceptions: string[];
  domain: string;
  proofs?: string[];
}

type KnowledgeNode = EnhancedEntity | Event | Concept | ScientificInsight | Law | Thought;

type EntityNode = Node<Integer, KnowledgeNode>

type EntityRelationship = Relationship<Integer, Relation>

type EntityWithRelationsResult = {
  entity: EntityNode,
  relations: EntityRelationship[],
  inRelations?: EntityRelationship[]
}

export class Neo4jMemory implements KnowledgeGraphMemory {
  constructor(private neo4jDriver: Neo4jDriver) { }

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

  private async saveGraph(graph: KnowledgeGraph): Promise<void> {
    const session = this.neo4jDriver.session()

    try {
      // Create or update nodes with their specific labels based on entityType
      await session.executeWrite(async txc => {
        const nodeResult = await txc.run(`
          UNWIND $memoryGraph.entities as entity
          
          // Create each node with the appropriate label based on type
          CALL {
            WITH entity
            
            // For Entity nodes
            FOREACH (ignore IN CASE WHEN entity.entityType = 'Entity' THEN [1] ELSE [] END | 
              MERGE (node:Memory {name: entity.name})
              SET node.nodeType = 'Entity',
                  node:Entity,
                  node.lastUpdated = datetime(),
                  node.observations = COALESCE(entity.observations, []),
                  node.confidence = entity.confidence,
                  node.source = entity.source,
                  node.description = entity.description,
                  node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            )
            
            // For Event nodes
            FOREACH (ignore IN CASE WHEN entity.entityType = 'Event' THEN [1] ELSE [] END | 
              MERGE (node:Memory {name: entity.name})
              SET node.nodeType = 'Event',
                  node:Event,
                  node.lastUpdated = datetime(),
                  node.startDate = entity.startDate,
                  node.endDate = entity.endDate,
                  node.status = entity.status,
                  node.timestamp = entity.timestamp,
                  node.duration = entity.duration,
                  node.location = entity.location,
                  node.participants = COALESCE(entity.participants, []),
                  node.outcome = entity.outcome,
                  node.significance = entity.significance,
                  node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            )
            
            // For Concept nodes
            FOREACH (ignore IN CASE WHEN entity.entityType = 'Concept' THEN [1] ELSE [] END | 
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
                  node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            )
            
            // For Thought nodes
            FOREACH (ignore IN CASE WHEN entity.entityType = 'Thought' THEN [1] ELSE [] END | 
              MERGE (node:Memory {name: entity.name})
              SET node.nodeType = 'Thought',
                  node:Thought,
                  node.lastUpdated = datetime(),
                  node.content = entity.content,
                  node.references = COALESCE(entity.references, []),
                  node.confidence = entity.confidence,
                  node.source = entity.source,
                  node.createdBy = entity.createdBy,
                  node.tags = COALESCE(entity.tags, []),
                  node.impact = entity.impact,
                  node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            )
            
            // For ScientificInsight nodes
            FOREACH (ignore IN CASE WHEN entity.entityType = 'ScientificInsight' THEN [1] ELSE [] END | 
              MERGE (node:Memory {name: entity.name})
              SET node.nodeType = 'ScientificInsight',
                  node:ScientificInsight,
                  node.lastUpdated = datetime(),
                  node.hypothesis = entity.hypothesis,
                  node.evidence = COALESCE(entity.evidence, []),
                  node.methodology = entity.methodology,
                  node.confidence = entity.confidence,
                  node.field = entity.field,
                  node.publications = COALESCE(entity.publications, []),
                  node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            )
            
            // For Law nodes
            FOREACH (ignore IN CASE WHEN entity.entityType = 'Law' THEN [1] ELSE [] END | 
              MERGE (node:Memory {name: entity.name})
              SET node.nodeType = 'Law',
                  node:Law,
                  node.lastUpdated = datetime(),
                  node.statement = entity.statement,
                  node.conditions = COALESCE(entity.conditions, []),
                  node.exceptions = COALESCE(entity.exceptions, []),
                  node.domain = entity.domain,
                  node.proofs = COALESCE(entity.proofs, []),
                  node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            )
            
            // Handle new node creation date for all types
            WITH entity
            MATCH (node:Memory {name: entity.name})
            FOREACH (ignore IN CASE WHEN node.createdAt IS NULL THEN [1] ELSE [] END | 
              SET node.createdAt = datetime()
            )
          }
          RETURN count(*)
        `, { memoryGraph: graph });
        
        console.error(`Created/updated ${nodeResult.records[0].get(0)} nodes`);

        // Improved relationship creation with better debugging
        if (graph.relations.length > 0) {
          const relResult = await txc.run(`
            UNWIND $memoryGraph.relations as relation
            
            // Match source and target nodes with the Memory label
            MATCH (fromNode:Memory), (toNode:Memory)
            WHERE fromNode.name = relation.from AND toNode.name = relation.to
            
            // Debug information (will appear in server logs)
            WITH relation, fromNode, toNode, 
                 CASE WHEN fromNode IS NULL THEN "Source node not found" 
                      WHEN toNode IS NULL THEN "Target node not found"
                      ELSE "Both nodes found" END as debugInfo
            
            // Only proceed if both nodes were found
            WHERE NOT fromNode IS NULL AND NOT toNode IS NULL
            
            // Create or merge the relationship with the proper type
            CALL apoc.merge.relationship(fromNode, relation.relationType, {}, 
                                       {lastUpdated: datetime()}, toNode, {}) 
            YIELD rel
            
            RETURN count(*)
          `, { memoryGraph: graph });
          
          console.error(`Created/updated ${relResult.records[0].get(0)} relationships`);
        } else {
          console.error('No relationships to create or update');
        }
      });
    } catch (error) {
      console.error('Error saving graph:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async createEntities(entities: Entity[]): Promise<Entity[]> {
    const session = this.neo4jDriver.session();
    
    try {
      // Log the incoming entities for debugging
      console.error(`Creating entities: ${JSON.stringify(entities)}`);
      
      // Process each entity type separately for better debugging
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
                node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            RETURN node
          `, {
            name: entity.name,
            observations: entity.observations || [],
            confidence: (entity as any).confidence || null,
            source: (entity as any).source || null,
            description: (entity as any).description || null
          }));
          
          console.error(`Entity creation result: ${result.records.length > 0 ? 'Success' : 'Failed'}`);
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
                node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            RETURN node
          `, {
            name: entity.name,
            startDate: (entity as any).startDate || null,
            endDate: (entity as any).endDate || null,
            status: (entity as any).status || null,
            timestamp: (entity as any).timestamp || null,
            duration: (entity as any).duration || null,
            location: (entity as any).location || null,
            participants: (entity as any).participants || [],
            outcome: (entity as any).outcome || null,
            significance: (entity as any).significance || null
          }));
          
          console.error(`Event creation result: ${result.records.length > 0 ? 'Success' : 'Failed'}`);
          console.error(`Event temporal data - startDate: ${(entity as any).startDate}, endDate: ${(entity as any).endDate}`);
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
                node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            RETURN node
          `, {
            name: entity.name,
            definition: (entity as any).definition || null,
            description: (entity as any).description || null,
            examples: (entity as any).examples || [],
            relatedConcepts: (entity as any).relatedConcepts || [],
            domain: (entity as any).domain || null,
            significance: (entity as any).significance || null
          }));
          
          console.error(`Concept creation result: ${result.records.length > 0 ? 'Success' : 'Failed'}`);
        }
        else {
          // For other entity types, use the existing approach via saveGraph
          const graph = {
            entities: [entity],
            relations: []
          };
          await this.saveGraph(graph);
        }
      }
      
      // Now load the graph to return the created entities
      const graph = await this.loadGraph();
      const newEntities = entities.filter(e => 
        graph.entities.some(existingEntity => 
          existingEntity.name === e.name && existingEntity.entityType === e.entityType
        )
      );
      
      return newEntities;
    } catch (error) {
      console.error(`Error creating entities: ${error}`);
      throw error;
    } finally {
      await session.close();
    }
  }

  async createRelations(relations: Relation[]): Promise<Relation[]> {
    const session = this.neo4jDriver.session();
    
    try {
      console.error(`Creating relations: ${JSON.stringify(relations)}`);
      
      const createdRelations = [];
      
      // Process each relation separately for better debugging
      for (const relation of relations) {
        console.error(`Processing relation: ${relation.from} --[${relation.relationType}]--> ${relation.to}`);
        
        // Check if the source and target nodes exist
        const nodesExist = await session.executeRead(tx => tx.run(`
          MATCH (from:Memory {name: $fromName}), (to:Memory {name: $toName})
          RETURN from, to
        `, { 
          fromName: relation.from,
          toName: relation.to
        }));
        
        if (nodesExist.records.length === 0) {
          console.error(`Failed to create relation - one or both nodes not found: ${relation.from} or ${relation.to}`);
          continue;
        }
        
        // Create the relationship
        const result = await session.executeWrite(tx => tx.run(`
          MATCH (from:Memory {name: $fromName}), (to:Memory {name: $toName})
          CALL apoc.merge.relationship(from, $relType, {}, {lastUpdated: datetime()}, to, {})
          YIELD rel
          RETURN rel
        `, {
          fromName: relation.from,
          toName: relation.to,
          relType: relation.relationType
        }));
        
        if (result.records.length > 0) {
          console.error(`Relationship created successfully: ${relation.from} --[${relation.relationType}]--> ${relation.to}`);
          createdRelations.push(relation);
        } else {
          console.error(`Failed to create relationship: ${relation.from} --[${relation.relationType}]--> ${relation.to}`);
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

  async addObservations(observations: { entityName: string; contents: string[] }[]): Promise<{ entityName: string; addedObservations: string[] }[]> {
    const graph = await this.loadGraph();
    const results = observations.map(o => {
      const entity = graph.entities.find(e => e.name === o.entityName);
      if (!entity) {
        throw new Error(`Entity with name ${o.entityName} not found`);
      }
      const newObservations = o.contents.filter(content => !entity.observations.includes(content));
      entity.observations.push(...newObservations);
      return { entityName: o.entityName, addedObservations: newObservations };
    });
    await this.saveGraph(graph);
    return results;
  }

  async deleteEntities(entityNames: string[]): Promise<void> {
    const graph = await this.loadGraph();
    graph.entities = graph.entities.filter(e => !entityNames.includes(e.name));
    graph.relations = graph.relations.filter(r => !entityNames.includes(r.from) && !entityNames.includes(r.to));
    await this.saveGraph(graph);
  }

  async deleteObservations(deletions: { entityName: string; observations: string[] }[]): Promise<void> {
    const graph = await this.loadGraph();
    deletions.forEach(d => {
      const entity = graph.entities.find(e => e.name === d.entityName);
      if (entity) {
        entity.observations = entity.observations.filter(o => !d.observations.includes(o));
      }
    });
    await this.saveGraph(graph);
  }

  async deleteRelations(relations: Relation[]): Promise<void> {
    const graph = await this.loadGraph();
    graph.relations = graph.relations.filter(r => !relations.some(delRelation => 
      r.from === delRelation.from && 
      r.to === delRelation.to && 
      r.relationType === delRelation.relationType
    ));
    await this.saveGraph(graph);
  }

  async readGraph(): Promise<KnowledgeGraph> {

    return this.loadGraph();
  }

  // Very basic search function
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
      
      const kgMemory:KnowledgeGraph = {entities: [], relations: []};
      
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

  async openNodes(names: string[]): Promise<KnowledgeGraph> {
    const graph = await this.loadGraph();
    
    // Filter entities
    const filteredEntities = graph.entities.filter(e => names.includes(e.name));
  
    // Create a Set of filtered entity names for quick lookup
    const filteredEntityNames = new Set(filteredEntities.map(e => e.name));
  
    // Filter relations to only include those between filtered entities
    const filteredRelations = graph.relations.filter(r => 
      filteredEntityNames.has(r.from) && filteredEntityNames.has(r.to)
    );
  
    const filteredGraph: KnowledgeGraph = {
      entities: filteredEntities,
      relations: filteredRelations,
    };
  
    return filteredGraph;
  }

  // Function to find nodes by their type
  async findNodesByType(nodeType: string): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    
    try {
      // Execute query to find all nodes of a specific type
      const res = await session.executeRead(tx => tx.run<EntityWithRelationsResult>(`
        MATCH (entity)
        WHERE entity.nodeType = $nodeType
        OPTIONAL MATCH (entity)-[r]->(other)
        RETURN entity, collect(r) as relations
      `, { nodeType }));
      
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
      );
  
      return kgMemory;
    } catch (error) {
      console.error(`Error finding nodes of type ${nodeType}:`, error);
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }

  // Migrate observations from Entity nodes to connected Thought nodes
  async migrateObservationsToThoughts(entityName: string): Promise<void> {
    const session = this.neo4jDriver.session();
    
    try {
      // Find the entity and its observations
      const result = await session.executeRead(tx => tx.run(`
        MATCH (e:Entity:Memory {name: $entityName})
        RETURN e.observations as observations
      `, { entityName }));
      
      if (result.records.length === 0) {
        console.error(`Entity with name ${entityName} not found`);
        return;
      }
      
      const observations = result.records[0].get('observations') || [];
      
      if (observations.length === 0) {
        console.error(`No observations found for entity ${entityName}`);
        return;
      }
      
      // Create Thought nodes for each observation and connect them to the entity
      await session.executeWrite(tx => tx.run(`
        MATCH (e:Entity:Memory {name: $entityName})
        
        UNWIND $observations as observation
        
        // Create a Thought node with a unique name based on entity and timestamp
        CREATE (t:Thought:Memory {
          name: $entityName + '_thought_' + toString(timestamp()),
          nodeType: 'Thought',
          content: observation,
          createdAt: datetime(),
          lastUpdated: datetime(),
          references: [$entityName],
          createdBy: 'System Migration',
          tags: ['migrated_observation']
        })
        
        // Create relationship from Entity to Thought
        CREATE (e)-[r:HAS_OBSERVATION]->(t)
        SET r.lastUpdated = datetime()
        
        RETURN count(*)
      `, { 
        entityName,
        observations
      }));
      
      // Remove observations from Entity node
      await session.executeWrite(tx => tx.run(`
        MATCH (e:Entity:Memory {name: $entityName})
        REMOVE e.observations
        RETURN e
      `, { entityName }));
      
      console.error(`Successfully migrated ${observations.length} observations to Thought nodes for entity ${entityName}`);
    } catch (error) {
      console.error(`Error migrating observations to thoughts:`, error);
    } finally {
      await session.close();
    }
  }

  // Create a single Thought node and connect it to an entity
  async createThought(thought: { 
    entityName: string; 
    content: string;
    references?: string[];
    confidence?: number;
    source?: string;
    createdBy?: string;
    tags?: string[];
    impact?: string;
    title?: string; // Optional title for the thought
  }): Promise<Entity> {
    const session = this.neo4jDriver.session();
    
    try {
      // Generate a better name for the thought - use title if provided or create a short summary
      const thoughtName = thought.title || 
                        `Thought about ${thought.entityName}` + 
                        (thought.tags && thought.tags.length > 0 ? ` (${thought.tags[0]})` : '');
      
      // Create the Thought node and relationship to the entity
      const result = await session.executeWrite(tx => tx.run(`
        // Match the entity
        MATCH (e:Memory {name: $entityName})
        
        // Create the Thought node with appropriate labels
        CREATE (t:Memory:Thought {
          name: $thoughtName,
          nodeType: 'Thought',
          content: $content,
          createdAt: datetime(),
          lastUpdated: datetime(),
          references: $references,
          confidence: $confidence,
          source: $source,
          createdBy: $createdBy,
          tags: $tags,
          impact: $impact
        })
        
        // Create relationship from Entity to Thought
        CREATE (e)-[r:HAS_OBSERVATION]->(t)
        SET r.lastUpdated = datetime()
        
        RETURN t
      `, { 
        entityName: thought.entityName,
        thoughtName,
        content: thought.content,
        references: thought.references || [thought.entityName],
        confidence: thought.confidence || null,
        source: thought.source || null,
        createdBy: thought.createdBy || 'System',
        tags: thought.tags || [],
        impact: thought.impact || null
      }));
      
      if (result.records.length === 0) {
        throw new Error(`Failed to create Thought for entity ${thought.entityName}`);
      }
      
      const thoughtNode = result.records[0].get('t');
      
      // Convert to Entity format
      const thoughtEntity: Entity = {
        name: thoughtNode.properties.name,
        entityType: 'Thought',
        observations: []
      };
      
      return thoughtEntity;
    } catch (error) {
      console.error(`Error creating thought:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }
}

