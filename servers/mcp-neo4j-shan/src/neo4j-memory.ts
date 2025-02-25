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

interface EnhancedRelation extends Relation {
  fromType?: string;
  toType?: string;
}

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
              MERGE (node:Memory {name: entity.name})
              SET node.nodeType = 'Concept',
                  node:Concept,
                  node.lastUpdated = datetime(),
                  node.definition = entity.definition,
                  node.description = entity.description,
                  node.examples = COALESCE(entity.examples, []),
                  node.relatedConcepts = COALESCE(entity.relatedConcepts, []),
                  node.domain = entity.domain,
                  node.significance = entity.significance,
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
                  node.legalDocument = entity.legalDocument,
                  node.legalDocumentJurisdiction = entity.legalDocumentJurisdiction,
                  node.legalDocumentReference = entity.legalDocumentReference,
                  node.content = entity.content,
                  node.entities = COALESCE(entity.entities, []),
                  node.concepts = COALESCE(entity.concepts, []),
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
                node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            RETURN node
          `, {
            name: entity.name,
            hypothesis: (entity as any).hypothesis || null,
            evidence: (entity as any).evidence || [],
            methodology: (entity as any).methodology || null,
            confidence: (entity as any).confidence || null,
            field: (entity as any).field || null,
            publications: (entity as any).publications || []
          }));
          
          console.error(`ScientificInsight creation result: ${result.records.length > 0 ? 'Success' : 'Failed'}`);
        }
        else if (entity.entityType === 'Law') {
          const result = await session.executeWrite(tx => tx.run(`
            MERGE (node:Memory {name: $name})
            SET node.nodeType = 'Law',
                node:Law,
                node.lastUpdated = datetime(),
                node.legalDocument = $legalDocument,
                node.legalDocumentJurisdiction = $legalDocumentJurisdiction,
                node.legalDocumentReference = $legalDocumentReference,
                node.content = $content,
                node.entities = $entities,
                node.concepts = $concepts,
                node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            RETURN node
          `, {
            name: entity.name,
            legalDocument: (entity as any).legalDocument || null,
            legalDocumentJurisdiction: (entity as any).legalDocumentJurisdiction || null,
            legalDocumentReference: (entity as any).legalDocumentReference || null,
            content: (entity as any).content || null,
            entities: (entity as any).entities || [],
            concepts: (entity as any).concepts || []
          }));
          
          console.error(`Law creation result: ${result.records.length > 0 ? 'Success' : 'Failed'}`);
        }
        else if (entity.entityType === 'Thought') {
          const result = await session.executeWrite(tx => tx.run(`
            MERGE (node:Memory {name: $name})
            SET node.nodeType = 'Thought',
                node:Thought,
                node.lastUpdated = datetime(),
                node.content = $content,
                node.references = $references,
                node.confidence = $confidence,
                node.source = $source,
                node.createdBy = $createdBy,
                node.tags = $tags,
                node.impact = $impact,
                node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            RETURN node
          `, {
            name: entity.name,
            content: (entity as any).content || null,
            references: (entity as any).references || [],
            confidence: (entity as any).confidence || null,
            source: (entity as any).source || null,
            createdBy: (entity as any).createdBy || null,
            tags: (entity as any).tags || [],
            impact: (entity as any).impact || null
          }));
          
          console.error(`Thought creation result: ${result.records.length > 0 ? 'Success' : 'Failed'}`);
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
        
        // Create the relationship and store node types as relationship properties
        const result = await session.executeWrite(tx => tx.run(`
          MATCH (from:Memory {name: $fromName}), (to:Memory {name: $toName})
          CALL apoc.merge.relationship(from, $relType, {}, 
                                     {
                                       lastUpdated: datetime(),
                                       fromType: $fromNodeType,
                                       toType: $toNodeType
                                     }, to, {})
          YIELD rel
          RETURN rel
        `, {
          fromName: relation.from,
          toName: relation.to,
          relType: relation.relationType,
          fromNodeType: fromNodeType,
          toNodeType: toNodeType
        }));
        
        if (result.records.length > 0) {
          console.error(`Relationship created successfully: ${relation.from} (${fromNodeType}) --[${relation.relationType}]--> ${relation.to} (${toNodeType})`);
          createdRelations.push(relation);
        } else {
          console.error(`Failed to create relationship: ${relation.from} (${fromNodeType}) --[${relation.relationType}]--> ${relation.to} (${toNodeType})`);
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
  async findNodesByType(nodeType: string, query?: string): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    
    try {
      // If a query is provided, use it to filter results
      if (query && query.trim() !== '') {
        console.error(`Searching for nodes of type ${nodeType} matching query: "${query}"`);
        
        // Execute query to find filtered nodes of specified type
        const res = await session.executeRead(tx => tx.run(`
          MATCH (entity:Memory)
          WHERE entity.nodeType = $nodeType
          AND (
            toLower(entity.name) CONTAINS toLower($query)
            OR (entity.content IS NOT NULL AND toLower(entity.content) CONTAINS toLower($query))
            OR (entity.definition IS NOT NULL AND toLower(entity.definition) CONTAINS toLower($query))
            OR (entity.nodeType = 'Entity' AND any(obs IN entity.observations WHERE toLower(obs) CONTAINS toLower($query)))
          )
          OPTIONAL MATCH (entity)-[r]->(other)
          WITH entity, collect(r) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          RETURN entity, outRels as relations, collect(inRel) as inRelations
        `, { nodeType, query }));
        
        return this.processSearchResults(res.records);
      } else {
        console.error(`Finding all nodes of type ${nodeType}`);
        
        // Execute original query without filtering - list all nodes of the type
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
      }
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
    entityName?: string; // Now optional
    title: string;
    content: string;
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
  }): Promise<Entity> {
    const session = this.neo4jDriver.session();
    
    try {
      // Use title as the thought name, or generate one if not provided
      const thoughtName = thought.title || 
                        `Thought: ${thought.content.substring(0, 30)}...`;
      
      // Collect all referenced node names for the references array
      const allReferences = [
        ...(thought.entities || []),
        ...(thought.concepts || []),
        ...(thought.events || []),
        ...(thought.scientificInsights || []),
        ...(thought.laws || []),
        ...(thought.thoughts || [])
      ];
      
      // For backward compatibility
      if (thought.entityName && !allReferences.includes(thought.entityName)) {
        allReferences.push(thought.entityName);
      }
      
      // Create the Thought node
      const result = await session.executeWrite(tx => tx.run(`
        // Create the Thought node with appropriate labels
        CREATE (t:Memory:Thought {
          name: $thoughtName,
          nodeType: 'Thought',
          content: $content,
          createdAt: datetime(),
          lastUpdated: datetime(),
          references: $allReferences,
          confidence: $confidence,
          source: $source,
          createdBy: $createdBy,
          tags: $tags,
          impact: $impact
        })
        
        RETURN t
      `, { 
        thoughtName,
        content: thought.content,
        allReferences,
        confidence: thought.confidence || null,
        source: thought.source || null,
        createdBy: thought.createdBy || 'System',
        tags: thought.tags || [],
        impact: thought.impact || null
      }));
      
      if (result.records.length === 0) {
        throw new Error(`Failed to create Thought node`);
      }
      
      const thoughtNode = result.records[0].get('t');
      
      // Now create relationships to all referenced nodes
      // For entities
      if (thought.entities && thought.entities.length > 0) {
        await session.executeWrite(tx => tx.run(`
          MATCH (t:Thought:Memory {name: $thoughtName})
          UNWIND $nodeNames as nodeName
          MATCH (e:Entity:Memory {name: nodeName})
          CREATE (t)-[r:REFERENCES]->(e)
          SET r.lastUpdated = datetime()
        `, {
          thoughtName,
          nodeNames: thought.entities
        }));
      }
      
      // For concepts
      if (thought.concepts && thought.concepts.length > 0) {
        await session.executeWrite(tx => tx.run(`
          MATCH (t:Thought:Memory {name: $thoughtName})
          UNWIND $nodeNames as nodeName
          MATCH (c:Concept:Memory {name: nodeName})
          CREATE (t)-[r:REFERENCES]->(c)
          SET r.lastUpdated = datetime()
        `, {
          thoughtName,
          nodeNames: thought.concepts
        }));
      }
      
      // For events
      if (thought.events && thought.events.length > 0) {
        await session.executeWrite(tx => tx.run(`
          MATCH (t:Thought:Memory {name: $thoughtName})
          UNWIND $nodeNames as nodeName
          MATCH (e:Event:Memory {name: nodeName})
          CREATE (t)-[r:REFERENCES]->(e)
          SET r.lastUpdated = datetime()
        `, {
          thoughtName,
          nodeNames: thought.events
        }));
      }
      
      // For scientific insights
      if (thought.scientificInsights && thought.scientificInsights.length > 0) {
        await session.executeWrite(tx => tx.run(`
          MATCH (t:Thought:Memory {name: $thoughtName})
          UNWIND $nodeNames as nodeName
          MATCH (s:ScientificInsight:Memory {name: nodeName})
          CREATE (t)-[r:REFERENCES]->(s)
          SET r.lastUpdated = datetime()
        `, {
          thoughtName,
          nodeNames: thought.scientificInsights
        }));
      }
      
      // For laws
      if (thought.laws && thought.laws.length > 0) {
        await session.executeWrite(tx => tx.run(`
          MATCH (t:Thought:Memory {name: $thoughtName})
          UNWIND $nodeNames as nodeName
          MATCH (l:Law:Memory {name: nodeName})
          CREATE (t)-[r:REFERENCES]->(l)
          SET r.lastUpdated = datetime()
        `, {
          thoughtName,
          nodeNames: thought.laws
        }));
      }
      
      // For thoughts
      if (thought.thoughts && thought.thoughts.length > 0) {
        await session.executeWrite(tx => tx.run(`
          MATCH (t:Thought:Memory {name: $thoughtName})
          UNWIND $nodeNames as nodeName
          MATCH (ot:Thought:Memory {name: nodeName})
          CREATE (t)-[r:REFERENCES]->(ot)
          SET r.lastUpdated = datetime()
        `, {
          thoughtName,
          nodeNames: thought.thoughts
        }));
      }
      
      // For backward compatibility - handle entityName
      if (thought.entityName) {
        await session.executeWrite(tx => tx.run(`
          MATCH (t:Thought:Memory {name: $thoughtName})
          MATCH (e:Memory {name: $entityName})
          CREATE (t)-[r:REFERENCES]->(e)
          SET r.lastUpdated = datetime()
        `, {
          thoughtName,
          entityName: thought.entityName
        }));
      }
      
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

  // Find paths connecting two nodes (especially useful for concepts)
  async findConceptConnections(sourceNodeName: string, targetNodeName: string, maxDepth: number = 3): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    
    try {
      // Find paths between the source and target nodes
      const result = await session.executeRead(tx => tx.run(`
        MATCH path = shortestPath((source:Memory {name: $sourceName})-[*1..$maxDepth]-(target:Memory {name: $targetName}))
        UNWIND nodes(path) as node
        WITH collect(DISTINCT node) as nodes, relationships(path) as pathRels
        
        // Get all relationships between the nodes in the path
        UNWIND nodes as n1
        UNWIND nodes as n2
        OPTIONAL MATCH (n1)-[r]->(n2)
        WHERE n1 <> n2
        
        RETURN nodes, collect(DISTINCT r) as rels
      `, {
        sourceName: sourceNodeName,
        targetName: targetNodeName,
        maxDepth
      }));
      
      if (result.records.length === 0) {
        console.error(`No path found between ${sourceNodeName} and ${targetNodeName} within ${maxDepth} hops`);
        return { entities: [], relations: [] };
      }
      
      // Process the nodes
      const record = result.records[0];
      const nodes = record.get('nodes');
      const relationships = record.get('rels');
      
      // Map nodes to entities
      const entities: Entity[] = nodes.map((node: any) => ({
        name: node.properties.name,
        entityType: node.properties.nodeType || 'Entity',
        observations: 'observations' in node.properties ? 
          node.properties.observations : []
      }));
      
      // Map relationships to relations
      const relations: Relation[] = relationships.map((rel: any) => ({
        from: rel.startNode.properties.name,
        to: rel.endNode.properties.name,
        relationType: rel.type
      }));
      
      return {
        entities,
        relations
      };
    } catch (error) {
      console.error(`Error finding concept connections: ${error}`);
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }
  
  // Explore the neighborhood context around a node
  async exploreContext(nodeName: string, maxDepth: number = 2): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    
    try {
      // Find the neighborhood subgraph
      const result = await session.executeRead(tx => tx.run(`
        MATCH (center:Memory {name: $nodeName})
        CALL apoc.path.subgraphNodes(center, {
          maxLevel: $maxDepth,
          relationshipFilter: '*'
        }) YIELD node
        WITH collect(DISTINCT node) as nodes
        
        // Find all relationships between these nodes
        UNWIND nodes as n1
        UNWIND nodes as n2
        MATCH (n1)-[r]->(n2)
        WHERE n1 <> n2
        
        RETURN nodes, collect(DISTINCT r) as relationships
      `, {
        nodeName,
        maxDepth
      }));
      
      if (result.records.length === 0) {
        console.error(`No node found with name ${nodeName}`);
        return { entities: [], relations: [] };
      }
      
      // Process the nodes
      const record = result.records[0];
      const nodes = record.get('nodes');
      const relationships = record.get('relationships');
      
      // Map nodes to entities
      const entities: Entity[] = nodes.map((node: any) => ({
        name: node.properties.name,
        entityType: node.properties.nodeType || 'Entity',
        observations: 'observations' in node.properties ? 
          node.properties.observations : []
      }));
      
      // Map relationships to relations
      const relations: Relation[] = relationships.map((rel: any) => ({
        from: rel.startNode.properties.name,
        to: rel.endNode.properties.name,
        relationType: rel.type
      }));
      
      return {
        entities,
        relations
      };
    } catch (error) {
      console.error(`Error exploring context: ${error}`);
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }
  
  // Trace evidence chains that support or contradict a node
  async traceEvidence(targetNodeName: string, relationshipType: string = "SUPPORTS"): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    
    try {
      // Find evidence paths
      const result = await session.executeRead(tx => tx.run(`
        MATCH path = (source:Memory)-[:${relationshipType}*1..3]->(target:Memory {name: $targetName})
        WHERE source <> target
        UNWIND nodes(path) as node
        WITH collect(DISTINCT node) as nodes, relationships(path) as pathRels
        
        // Get additional relationships between these nodes
        UNWIND nodes as n1
        UNWIND nodes as n2
        OPTIONAL MATCH (n1)-[r]->(n2)
        WHERE n1 <> n2
        
        RETURN nodes, collect(DISTINCT r) as rels
      `, {
        targetName: targetNodeName
      }));
      
      // Process the nodes
      let entities: Entity[] = [];
      let relations: Relation[] = [];
      
      if (result.records.length > 0) {
        const record = result.records[0];
        const nodes = record.get('nodes');
        const relationships = record.get('rels');
        
        // Map nodes to entities
        entities = nodes.map((node: any) => ({
          name: node.properties.name,
          entityType: node.properties.nodeType || 'Entity',
          observations: 'observations' in node.properties ? 
            node.properties.observations : []
        }));
        
        // Map relationships to relations
        relations = relationships.map((rel: any) => ({
          from: rel.startNode.properties.name,
          to: rel.endNode.properties.name,
          relationType: rel.type
        }));
      }
      
      return {
        entities,
        relations
      };
    } catch (error) {
      console.error(`Error tracing evidence: ${error}`);
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }

  // Enhanced search that tries both fuzzy matching and string containment
  async robustSearch(searchQuery: string): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    
    try {
      console.error(`Performing robust search for query: "${searchQuery}"`);
      
      // First try with fuzzy search capability
      let fuzzyMatchResult;
      try {
        // Use a try-catch since apoc may not be available
        fuzzyMatchResult = await session.executeRead(tx => tx.run(`
          MATCH (entity:Memory)
          WHERE apoc.text.fuzzyMatch(entity.name, $query) > 0.6
             OR (entity.content IS NOT NULL AND apoc.text.fuzzyMatch(entity.content, $query) > 0.5)
             OR (entity.definition IS NOT NULL AND apoc.text.fuzzyMatch(entity.definition, $query) > 0.5)
          WITH entity, 
               CASE WHEN apoc.text.fuzzyMatch(entity.name, $query) > 0.6 THEN apoc.text.fuzzyMatch(entity.name, $query) * 2
                    WHEN entity.content IS NOT NULL AND apoc.text.fuzzyMatch(entity.content, $query) > 0.5 THEN apoc.text.fuzzyMatch(entity.content, $query)
                    WHEN entity.definition IS NOT NULL AND apoc.text.fuzzyMatch(entity.definition, $query) > 0.5 THEN apoc.text.fuzzyMatch(entity.definition, $query)
                    ELSE 0 END as score
          WHERE score > 0
          ORDER BY score DESC
          LIMIT 20
          
          // Get relationships
          WITH entity
          OPTIONAL MATCH (entity)-[r]->(other)
          WITH entity, collect(r) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          
          RETURN entity, outRels as relations, collect(inRel) as inRelations
        `, { query: searchQuery }));
        
        console.error(`Fuzzy search found ${fuzzyMatchResult.records.length} results`);
      } catch (fuzzyError) {
        console.error(`Fuzzy search failed (APOC might not be available): ${fuzzyError}`);
        fuzzyMatchResult = { records: [] };
      }
      
      // If fuzzy search found results, use them
      if (fuzzyMatchResult.records.length > 0) {
        return this.processSearchResults(fuzzyMatchResult.records);
      }
      
      // If no results from fuzzy search, fall back to simple containment search
      console.error(`No fuzzy match results found, falling back to string containment search`);
      
      // Debug: check for nodes that might match
      const debugResult = await session.executeRead(tx => tx.run(`
        MATCH (entity:Memory)
        RETURN entity.name, entity.nodeType LIMIT 10
      `));
      console.error(`Sample nodes in database: ${JSON.stringify(debugResult.records.map(r => ({
        name: r.get('entity.name'),
        type: r.get('entity.nodeType')
      })))}`);
      
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
      
      console.error(`String containment search found ${containmentResult.records.length} results`);
      
      // If still no results, try a tokenized search (split the query and search for each token)
      if (containmentResult.records.length === 0) {
        console.error(`No exact containment results, trying tokenized search`);
        
        // Split the query into words and filter out short tokens
        const tokens = searchQuery.split(/\s+/).filter(token => token.length > 2);
        console.error(`Tokens for search: ${JSON.stringify(tokens)}`);
        
        if (tokens.length > 0) {
          // Create a parameterized query with tokens
          const tokensParam = { tokens, query: searchQuery };
          
          const tokenizedResult = await session.executeRead(tx => tx.run(`
            MATCH (entity:Memory)
            WITH entity, $tokens as tokens
            WHERE any(token IN tokens WHERE entity.name IS NOT NULL AND toLower(entity.name) CONTAINS toLower(token))
               OR (entity.content IS NOT NULL AND any(token IN tokens WHERE toLower(entity.content) CONTAINS toLower(token)))
               OR (entity.definition IS NOT NULL AND any(token IN tokens WHERE toLower(entity.definition) CONTAINS toLower(token)))
               OR (entity.nodeType = 'Entity' AND entity.observations IS NOT NULL AND 
                   any(token IN tokens WHERE any(obs IN entity.observations WHERE obs IS NOT NULL AND toLower(obs) CONTAINS toLower(token))))
            
            // Get relationships
            WITH entity
            OPTIONAL MATCH (entity)-[r]->(other)
            WITH entity, collect(r) as outRels
            OPTIONAL MATCH (other)-[inRel]->(entity)
            
            RETURN entity, outRels as relations, collect(inRel) as inRelations
            LIMIT 20
          `, tokensParam));
          
          console.error(`Tokenized search found ${tokenizedResult.records.length} results`);
          if (tokenizedResult.records.length > 0) {
            console.error(`First result name: ${tokenizedResult.records[0].get('entity').properties.name}`);
            return this.processSearchResults(tokenizedResult.records);
          }
        }
        
        // If tokens search still returns nothing, try a broader pattern search
        console.error(`Trying partial pattern search as last resort`);
        const partialMatchResult = await session.executeRead(tx => tx.run(`
          MATCH (entity:Memory)
          WHERE toLower(entity.name) =~ '.*${searchQuery.toLowerCase().split(/\s+/).join(".*")}.*'
             OR (entity.content IS NOT NULL AND toLower(entity.content) =~ '.*${searchQuery.toLowerCase().split(/\s+/).join(".*")}.*')
          
          // Get relationships
          WITH entity
          OPTIONAL MATCH (entity)-[r]->(other)
          WITH entity, collect(r) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          
          RETURN entity, outRels as relations, collect(inRel) as inRelations
          LIMIT 20
        `));
        
        console.error(`Pattern search found ${partialMatchResult.records.length} results`);
        if (partialMatchResult.records.length > 0) {
          return this.processSearchResults(partialMatchResult.records);
        }
      }
      
      return this.processSearchResults(containmentResult.records);
    } catch (error) {
      console.error(`Error in robust search: ${error}`);
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }
  
  // Helper function to process search results
  private processSearchResults(records: any[]): KnowledgeGraph {
    const entities: Entity[] = [];
    const relations: Relation[] = [];
    
    records.forEach(record => {
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
      
      // Add to entities if not already included
      if (!entities.some(e => e.name === entity.name)) {
        entities.push(entity);
      }
      
      // Add outgoing relationships
      if (outRelationships && Array.isArray(outRelationships)) {
        outRelationships.forEach(rel => {
          if (rel && rel.properties) {
            const relation = rel.properties as unknown as Relation;
            if (!relations.some(r => 
              r.from === relation.from && 
              r.to === relation.to && 
              r.relationType === relation.relationType
            )) {
              relations.push(relation);
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
            if (!relations.some(r => 
              r.from === relation.from && 
              r.to === relation.to && 
              r.relationType === relation.relationType
            )) {
              relations.push(relation);
            }
          }
        });
      }
    });
    
    return { entities, relations };
  }
}

