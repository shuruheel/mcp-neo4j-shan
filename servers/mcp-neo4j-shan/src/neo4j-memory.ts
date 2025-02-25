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
  biography?: string;  // Added field for biographical information
  keyContributions?: string[];  // Added field for key contributions
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
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
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
  causalPredecessors?: string[];  // Events that directly led to this event
  causalSuccessors?: string[];  // Events directly resulting from this event
}

interface Concept extends BaseNode {
  nodeType: 'Concept';
  definition: string;  // Required concise explanation of the concept (1-2 sentences)
  description?: string;
  examples: string[];
  relatedConcepts: string[];
  domain: string;
  significance?: string;
  perspectives?: string[];  // Added field for multiple viewpoints on the concept
  historicalDevelopment?: {period: string, development: string}[];  // Added field for temporal evolution
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
  abstractionLevel?: number;  // 0.0-1.0 scale (concrete to abstract)
  metaphoricalMappings?: string[];  // Conceptual metaphors used to explain this concept
}

interface Thought extends BaseNode {
  nodeType: 'Thought';
  thoughtContent: string;         // The main thought/observation content
  references: string[];    // Names of entities/concepts/events referenced
  confidence?: number;     // How confident is this thought (0-1)
  source?: string;         // Where did this thought come from (person, document)
  createdBy?: string;      // Who created this thought
  tags?: string[];         // Classification tags 
  impact?: string;         // Potential impact or importance
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
  evidentialBasis?: string[];  // Nodes supporting this thought
  thoughtCounterarguments?: string[];  // Potential challenges to the thought
  implications?: string[];  // Logical consequences of the thought
  thoughtConfidenceScore?: number;  // 0.0-1.0 scale of certainty
}

interface ScientificInsight extends BaseNode {
  nodeType: 'ScientificInsight';
  hypothesis: string;
  evidence: string[];
  methodology?: string;
  confidence: number;
  field: string;
  publications?: string[];
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
  evidenceStrength?: number;  // Overall strength of evidential support (0.0-1.0)
  scientificCounterarguments?: string[];  // Known challenges to this insight
  applicationDomains?: string[];  // Practical areas where insight applies
  replicationStatus?: string;  // Current scientific consensus on replication
  surpriseValue?: number;  // How unexpected this insight is (0.0-1.0)
}

interface Law extends BaseNode {
  nodeType: 'Law';
  statement: string;
  conditions: string[];
  exceptions: string[];
  domain: string;
  proofs?: string[];
  // Cognitive enhancement fields
  emotionalValence?: number;  // -1.0 to 1.0 (negative to positive)
  emotionalArousal?: number;  // 0.0-3.0 scale of emotional intensity
  domainConstraints?: string[];  // Limitations on where law applies
  historicalPrecedents?: string[];  // Earlier formulations or precursors
  counterexamples?: string[];  // Instances that challenge or limit the law
  formalRepresentation?: string;  // Mathematical or logical formulation when applicable
}

type KnowledgeNode = EnhancedEntity | Event | Concept | ScientificInsight | Law | Thought;

type EntityNode = Node<Integer, KnowledgeNode>

interface EnhancedRelation extends Relation {
  fromType?: string;
  toType?: string;
  context?: string;  // Added field for explanatory context of the relationship (30-50 words)
  confidenceScore?: number;  // Added field for confidence scoring
  sources?: string[];  // Added field for citation sources
}

type EntityRelationship = Relationship<Integer, Relation>

type EntityWithRelationsResult = {
  entity: EntityNode,
  relations: EntityRelationship[],
  inRelations?: EntityRelationship[]
}

// Create a custom interface with only the methods you need
interface CustomKnowledgeGraphMemory {
  createEntities(entities: Entity[]): Promise<Entity[]>;
  createRelations(relations: Relation[]): Promise<Relation[]>;
  searchNodes(query: string): Promise<KnowledgeGraph>;
}

export class Neo4jMemory implements CustomKnowledgeGraphMemory {
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
                  node.biography = entity.biography,
                  node.keyContributions = entity.keyContributions,
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
                  node.perspectives = $perspectives,
                  node.historicalDevelopment = $historicalDevelopment,
                  node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            )
            
            // For Thought nodes
            FOREACH (ignore IN CASE WHEN entity.entityType = 'Thought' THEN [1] ELSE [] END | 
              MERGE (node:Memory {name: entity.name})
              SET node.nodeType = 'Thought',
                  node:Thought,
                  node.lastUpdated = datetime(),
                  node.thoughtContent = entity.thoughtContent,
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
                node.biography = $biography,
                node.keyContributions = $keyContributions,
                node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            RETURN node
          `, {
            name: entity.name,
            observations: entity.observations || [],
            confidence: (entity as any).confidence || null,
            source: (entity as any).source || null,
            description: (entity as any).description || null,
            biography: (entity as any).biography || null,
            keyContributions: (entity as any).keyContributions || []
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
                node.perspectives = $perspectives,
                node.historicalDevelopment = $historicalDevelopment,
                node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            RETURN node
          `, {
            name: entity.name,
            definition: (entity as any).definition || null,
            description: (entity as any).description || null,
            examples: (entity as any).examples || [],
            relatedConcepts: (entity as any).relatedConcepts || [],
            domain: (entity as any).domain || null,
            significance: (entity as any).significance || null,
            perspectives: (entity as any).perspectives || [],
            historicalDevelopment: (entity as any).historicalDevelopment || []
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
                node.thoughtContent = $thoughtContent,
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
                                       toType: $toNodeType,
                                       context: $context,
                                       confidenceScore: $confidenceScore,
                                       sources: $sources
                                     }, to, {})
          YIELD rel
          RETURN rel
        `, {
          fromName: relation.from,
          toName: relation.to,
          relType: relation.relationType,
          fromNodeType: fromNodeType,
          toNodeType: toNodeType,
          context: (enhancedRelation as any).context || null,
          confidenceScore: (enhancedRelation as any).confidenceScore || null,
          sources: (enhancedRelation as any).sources || []
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
            OR (entity.nodeType = 'Entity' AND entity.observations IS NOT NULL AND 
                any(obs IN entity.observations WHERE obs IS NOT NULL AND toLower(obs) CONTAINS toLower($query)))
          )
          WITH entity
          OPTIONAL MATCH (entity)-[r]->(other)
          WITH entity, collect(r) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          RETURN entity, outRels as relations, collect(inRel) as inRelations
          ORDER BY entity.name
        `, { nodeType, query }));
        
        // Log results for debugging
        console.error(`Found ${res.records.length} nodes of type ${nodeType} matching "${query}"`);
        if (res.records.length > 0) {
          console.error(`First result: ${res.records[0].get('entity').properties.name}`);
        } else {
          // Try with individual tokens as fallback
          const tokens = query.split(/\s+/).filter(token => token.length > 1);
          if (tokens.length > 1) {
            console.error(`No direct matches found. Attempting token-based search with: ${tokens.join(', ')}`);
            
            const tokenResult = await session.executeRead(tx => tx.run(`
              MATCH (entity:Memory)
              WHERE entity.nodeType = $nodeType
              AND (
                any(token IN $tokens WHERE 
                  entity.name IS NOT NULL AND 
                  toLower(entity.name) CONTAINS toLower(token)
                )
                OR 
                (entity.content IS NOT NULL AND 
                 any(token IN $tokens WHERE toLower(entity.content) CONTAINS toLower(token)))
                OR 
                (entity.definition IS NOT NULL AND 
                 any(token IN $tokens WHERE toLower(entity.definition) CONTAINS toLower(token)))
                OR 
                (entity.nodeType = 'Entity' AND entity.observations IS NOT NULL AND 
                 any(token IN $tokens WHERE 
                   any(obs IN entity.observations WHERE 
                     obs IS NOT NULL AND toLower(obs) CONTAINS toLower(token)
                   )
               )
            
            // Get relationships
            WITH entity
            OPTIONAL MATCH (entity)-[r]->(other)
            WITH entity, collect(r) as outRels
            OPTIONAL MATCH (other)-[inRel]->(entity)
            
            RETURN entity, outRels as relations, collect(inRel) as inRelations
            ORDER BY entity.name
          `, { nodeType, tokens }));
            
            console.error(`Token-based search found ${tokenResult.records.length} results`);
            if (tokenResult.records.length > 0) {
              return this.processSearchResults(tokenResult.records);
            }
          }
        }
        
        return this.processSearchResults(res.records);
      } else {
        console.error(`Finding all nodes of type ${nodeType}`);
        
        // Execute original query without filtering - list all nodes of the type
        const res = await session.executeRead(tx => tx.run<EntityWithRelationsResult>(`
          MATCH (entity:Memory)
          WHERE entity.nodeType = $nodeType
          WITH entity
          OPTIONAL MATCH (entity)-[r]->(other)
          WITH entity, collect(r) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          RETURN entity, outRels as relations, collect(inRel) as inRelations
          ORDER BY entity.name
        `, { nodeType }));
        
        console.error(`Found ${res.records.length} nodes of type ${nodeType}`);
        return this.processSearchResults(res.records);
      }
    } catch (error) {
      console.error(`Error finding nodes of type ${nodeType}:`, error);
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }

  // Create a single Thought node and connect it to an entity
  async createThought(thought: { 
    entityName?: string; // Now optional
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
    // Cognitive enhancement fields
    emotionalValence?: number;
    emotionalArousal?: number;
    evidentialBasis?: string[];
    thoughtCounterarguments?: string[];
    implications?: string[];
    thoughtConfidenceScore?: number;
  }): Promise<Entity> {
    const session = this.neo4jDriver.session();
    
    try {
      // Use title as the thought name, or generate one if not provided
      const thoughtName = thought.title || 
                        `Thought: ${thought.thoughtContent.substring(0, 30)}...`;
      
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
          thoughtContent: $thoughtContent,
          createdAt: datetime(),
          lastUpdated: datetime(),
          references: $allReferences,
          confidence: $confidence,
          source: $source,
          createdBy: $createdBy,
          tags: $tags,
          impact: $impact,
          // Cognitive enhancement fields
          emotionalValence: $emotionalValence,
          emotionalArousal: $emotionalArousal,
          evidentialBasis: $evidentialBasis,
          thoughtCounterarguments: $thoughtCounterarguments,
          implications: $implications,
          thoughtConfidenceScore: $thoughtConfidenceScore
        })
        
        RETURN t
      `, { 
        thoughtName,
        thoughtContent: thought.thoughtContent,
        allReferences,
        confidence: thought.confidence || null,
        source: thought.source || null,
        createdBy: thought.createdBy || 'System',
        tags: thought.tags || [],
        impact: thought.impact || null,
        // Cognitive enhancement fields
        emotionalValence: thought.emotionalValence || null,
        emotionalArousal: thought.emotionalArousal || null,
        evidentialBasis: thought.evidentialBasis || [],
        thoughtCounterarguments: thought.thoughtCounterarguments || [],
        implications: thought.implications || [],
        thoughtConfidenceScore: thought.thoughtConfidenceScore || null
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

  // Trace evidence chains that support or contradict a node
  async traceEvidence(targetNodeName: string, relationshipType: string = "SUPPORTS"): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    
    try {
      console.error(`Tracing evidence paths with relationship type ${relationshipType} for node: "${targetNodeName}"`);
      
      // First check if the target node exists
      const nodeCheck = await session.executeRead(tx => tx.run(`
        MATCH (node:Memory)
        WHERE toLower(node.name) = toLower($nodeName)
        RETURN node
      `, { nodeName: targetNodeName }));
      
      if (nodeCheck.records.length === 0) {
        console.error(`No node found with name "${targetNodeName}" (case-insensitive check)`);
        return { entities: [], relations: [] };
      }
      
      // Get the actual node name with correct casing
      const actualNodeName = nodeCheck.records[0].get('node').properties.name;
      console.error(`Found target node: "${actualNodeName}"`);
      
      // Validate the relationship type is valid
      const validRelationshipTypes = ["SUPPORTS", "CONTRADICTS", "VALIDATES", "CHALLENGES", "REFINES"];
      const relType = validRelationshipTypes.includes(relationshipType) ? 
                      relationshipType : "SUPPORTS";
      
      if (relType !== relationshipType) {
        console.error(`Invalid relationship type "${relationshipType}", using "${relType}" instead`);
      }
      
      // Find evidence paths using case-insensitive node matching
      const result = await session.executeRead(tx => tx.run(`
        // Find the target node first with case-insensitive matching
        MATCH (target:Memory)
        WHERE toLower(target.name) = toLower($targetName)
        
        // Then find paths
        WITH target
        MATCH path = (source:Memory)-[:${relType}*1..3]->(target)
        WHERE source <> target
        
        // Process path nodes
        WITH collect(nodes(path)) as paths
        UNWIND paths as pathNodes
        UNWIND pathNodes as node
        WITH collect(DISTINCT node) as allNodes
        
        // Get relationships between these nodes
        UNWIND allNodes as n1
        UNWIND allNodes as n2
        OPTIONAL MATCH (n1)-[r]->(n2)
        WHERE n1 <> n2 AND type(r) IN $validRelTypes
        
        RETURN allNodes as nodes, collect(DISTINCT r) as rels
      `, {
        targetName: targetNodeName,
        validRelTypes: validRelationshipTypes
      }));
      
      // Process the nodes
      if (result.records.length === 0) {
        console.error(`No evidence paths found for "${targetNodeName}" with relationship type "${relType}"`);
        
        // Try to find the node and its immediate connections instead
        const fallbackResult = await session.executeRead(tx => tx.run(`
          MATCH (target:Memory)
          WHERE toLower(target.name) = toLower($targetName)
          
          // Get all immediate connections (in both directions)
          OPTIONAL MATCH (target)-[r1]-(other)
          
          // Return target node plus connected nodes
          WITH target, collect(DISTINCT other) as connected
          UNWIND connected as c
          
          RETURN collect(DISTINCT target) + collect(DISTINCT c) as nodes,
                 collect(DISTINCT (target)-[r2]-(c)) as rels
        `, { targetName: targetNodeName }));
        
        if (fallbackResult.records.length > 0 && fallbackResult.records[0].get('nodes').length > 0) {
          const record = fallbackResult.records[0];
          const nodes = record.get('nodes');
          const relationships = record.get('rels');
          
          console.error(`Found ${nodes.length} nodes and ${relationships.length} relationships in immediate context of "${targetNodeName}"`);
          
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
        }
        
        return { entities: [], relations: [] };
      }
      
      // Process the evidence paths
      const record = result.records[0];
      const nodes = record.get('nodes');
      const relationships = record.get('rels');
      
      console.error(`Found ${nodes.length} nodes and ${relationships.length} relationships in evidence paths`);
      
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
      console.error(`Error tracing evidence: ${error}`);
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }

  // Find paths connecting two nodes (especially useful for concepts)
  async findConceptConnections(sourceNodeName: string, targetNodeName: string, maxDepth: number = 3): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    
    try {
      console.error(`Finding concept connections between "${sourceNodeName}" and "${targetNodeName}" with maxDepth: ${maxDepth}`);
      
      // First check if both nodes exist with direct name matching
      const nodesExist = await session.executeRead(tx => tx.run(`
        MATCH (source:Memory {name: $sourceName}), (target:Memory {name: $targetName})
        RETURN source, target
      `, { 
        sourceName: sourceNodeName,
        targetName: targetNodeName 
      }));
      
      if (nodesExist.records.length === 0) {
        // Try case-insensitive search as fallback
        const caseInsensitiveCheck = await session.executeRead(tx => tx.run(`
          MATCH (source:Memory), (target:Memory)
          WHERE toLower(source.name) = toLower($sourceName)
          AND toLower(target.name) = toLower($targetName)
          RETURN source, target
        `, { 
          sourceName: sourceNodeName,
          targetName: targetNodeName 
        }));
        
        if (caseInsensitiveCheck.records.length === 0) {
          console.error(`Cannot find nodes: "${sourceNodeName}" and/or "${targetNodeName}"`);
          return { entities: [], relations: [] };
        } else {
          // Get the actual node names with correct casing
          sourceNodeName = caseInsensitiveCheck.records[0].get('source').properties.name;
          targetNodeName = caseInsensitiveCheck.records[0].get('target').properties.name;
          console.error(`Found nodes with case-insensitive search: "${sourceNodeName}" and "${targetNodeName}"`);
        }
      } else {
        // Get the actual node names from the results
        sourceNodeName = nodesExist.records[0].get('source').properties.name;
        targetNodeName = nodesExist.records[0].get('target').properties.name;
      }

      // Use a simpler approach with explicit depth traversal
      let pathFound = false;
      let allNodes: any[] = [];
      let allRelationships: any[] = [];
      
      // Try direct relationship (depth 1)
      const directRelationResult = await session.executeRead(tx => tx.run(`
        MATCH (source:Memory {name: $sourceName})-[r]-(target:Memory {name: $targetName})
        RETURN source, target, r
      `, {
        sourceName: sourceNodeName,
        targetName: targetNodeName
      }));
      
      if (directRelationResult.records.length > 0) {
        console.error(`Found direct relationship between "${sourceNodeName}" and "${targetNodeName}"`);
        pathFound = true;
        
        const source = directRelationResult.records[0].get('source');
        const target = directRelationResult.records[0].get('target');
        const relationship = directRelationResult.records[0].get('r');
        
        allNodes = [source, target];
        allRelationships = [relationship];
      }
      
      // If no direct path and maxDepth > 1, try 2-hop path
      if (!pathFound && maxDepth >= 2) {
        console.error(`Trying 2-hop path between "${sourceNodeName}" and "${targetNodeName}"`);
        
        const twoHopResult = await session.executeRead(tx => tx.run(`
          MATCH (source:Memory {name: $sourceName})-[r1]-(mid)-[r2]-(target:Memory {name: $targetName})
          WHERE mid <> source AND mid <> target
          RETURN source, mid, target, r1, r2
        `, {
          sourceName: sourceNodeName,
          targetName: targetNodeName
        }));
        
        if (twoHopResult.records.length > 0) {
          console.error(`Found 2-hop path between "${sourceNodeName}" and "${targetNodeName}"`);
          pathFound = true;
          
          const record = twoHopResult.records[0];
          const source = record.get('source');
          const mid = record.get('mid');
          const target = record.get('target');
          const rel1 = record.get('r1');
          const rel2 = record.get('r2');
          
          allNodes = [source, mid, target];
          allRelationships = [rel1, rel2];
        }
      }
      
      // If still no path and maxDepth > 2, try 3-hop path
      if (!pathFound && maxDepth >= 3) {
        console.error(`Trying 3-hop path between "${sourceNodeName}" and "${targetNodeName}"`);
        
        const threeHopResult = await session.executeRead(tx => tx.run(`
          MATCH (source:Memory {name: $sourceName})-[r1]-(mid1)-[r2]-(mid2)-[r3]-(target:Memory {name: $targetName})
          WHERE mid1 <> source AND mid1 <> target 
          AND mid2 <> source AND mid2 <> target AND mid2 <> mid1
          RETURN source, mid1, mid2, target, r1, r2, r3
        `, {
          sourceName: sourceNodeName,
          targetName: targetNodeName
        }));
        
        if (threeHopResult.records.length > 0) {
          console.error(`Found 3-hop path between "${sourceNodeName}" and "${targetNodeName}"`);
          pathFound = true;
          
          const record = threeHopResult.records[0];
          const source = record.get('source');
          const mid1 = record.get('mid1');
          const mid2 = record.get('mid2');
          const target = record.get('target');
          const rel1 = record.get('r1');
          const rel2 = record.get('r2');
          const rel3 = record.get('r3');
          
          allNodes = [source, mid1, mid2, target];
          allRelationships = [rel1, rel2, rel3];
        }
      }
      
      if (!pathFound) {
        console.error(`No path found between "${sourceNodeName}" and "${targetNodeName}" within ${maxDepth} hops`);
        
        // If no path found, check if the nodes exist individually to help with debugging
        const sourceCheck = await session.executeRead(tx => tx.run(`
          MATCH (n:Memory {name: $nodeName})
          RETURN n
        `, { nodeName: sourceNodeName }));
        
        const targetCheck = await session.executeRead(tx => tx.run(`
          MATCH (n:Memory {name: $nodeName})
          RETURN n
        `, { nodeName: targetNodeName }));
        
        console.error(`Source node "${sourceNodeName}" exists: ${sourceCheck.records.length > 0}`);
        console.error(`Target node "${targetNodeName}" exists: ${targetCheck.records.length > 0}`);
        
        // Check if they have any relationships at all
        if (sourceCheck.records.length > 0) {
          const sourceRels = await session.executeRead(tx => tx.run(`
            MATCH (n:Memory {name: $nodeName})-[r]-()
            RETURN count(r) as relCount
          `, { nodeName: sourceNodeName }));
          
          console.error(`Source node has ${sourceRels.records[0].get('relCount')} relationships`);
        }
        
        if (targetCheck.records.length > 0) {
          const targetRels = await session.executeRead(tx => tx.run(`
            MATCH (n:Memory {name: $nodeName})-[r]-()
            RETURN count(r) as relCount
          `, { nodeName: targetNodeName }));
          
          console.error(`Target node has ${targetRels.records[0].get('relCount')} relationships`);
        }
        
        return { entities: [], relations: [] };
      }
      
      // Convert nodes and relationships to entities and relations
      const entities: Entity[] = allNodes.map(node => {
        // Create a basic entity with required properties
        const entity: Entity = {
          name: node.properties.name,
          entityType: node.properties.nodeType || 'Entity',
          observations: node.properties.observations || []
        };
        
        // Add additional fields based on entity type
        if (node.properties.nodeType === 'Entity') {
          (entity as any).description = node.properties.description;
          (entity as any).biography = node.properties.biography;
          (entity as any).keyContributions = node.properties.keyContributions;
          (entity as any).confidence = node.properties.confidence;
        } 
        else if (node.properties.nodeType === 'Concept') {
          (entity as any).definition = node.properties.definition;
          (entity as any).examples = node.properties.examples;
          (entity as any).domain = node.properties.domain;
          (entity as any).perspectives = node.properties.perspectives;
          (entity as any).historicalDevelopment = node.properties.historicalDevelopment;
        }
        
        return entity;
      });
      
      const relations: Relation[] = allRelationships.map(rel => ({
        from: rel.startNodeElementId ? 
          allNodes.find(n => n.elementId === rel.startNodeElementId)?.properties.name : 
          rel.startNode.properties.name,
        to: rel.endNodeElementId ? 
          allNodes.find(n => n.elementId === rel.endNodeElementId)?.properties.name : 
          rel.endNode.properties.name,
        relationType: rel.type
      }));
      
      return { entities, relations };
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
      console.error(`Exploring context for node: "${nodeName}" with maxDepth: ${maxDepth}`);
      
      // First check if the node exists with direct lookup
      const nodeCheck = await session.executeRead(tx => tx.run(`
        MATCH (n:Memory {name: $nodeName})
        RETURN n
      `, { nodeName }));
      
      // If not found by exact match, try case-insensitive
      if (nodeCheck.records.length === 0) {
        console.error(`Node not found with exact name "${nodeName}", trying case-insensitive match`);
        
        const caseInsensitiveCheck = await session.executeRead(tx => tx.run(`
          MATCH (n:Memory)
          WHERE toLower(n.name) = toLower($nodeName)
          RETURN n
        `, { nodeName }));
        
        if (caseInsensitiveCheck.records.length === 0) {
          console.error(`No node found with name "${nodeName}" (case-insensitive check)`);
          return { entities: [], relations: [] };
        }
        
        // Use the actual node name
        nodeName = caseInsensitiveCheck.records[0].get('n').properties.name;
        console.error(`Found node with case-insensitive match: "${nodeName}"`);
      } else {
        nodeName = nodeCheck.records[0].get('n').properties.name;
      }
      
      // Build the result incrementally, starting with the center node
      let allNodes: any[] = [];
      let allRelationships: any[] = [];
      let uniqueNodeIds = new Set<string>();
      
      // Get the center node
      const centerNodeResult = await session.executeRead(tx => tx.run(`
        MATCH (center:Memory {name: $nodeName})
        RETURN center
      `, { nodeName }));
      
      if (centerNodeResult.records.length === 0) {
        console.error(`Center node "${nodeName}" not found even after confirmation`);
        return { entities: [], relations: [] };
      }
      
      const centerNode = centerNodeResult.records[0].get('center');
      allNodes.push(centerNode);
      uniqueNodeIds.add(centerNode.elementId || centerNode.identity.toString());
      
      // Get immediate neighbors (depth 1)
      if (maxDepth >= 1) {
        console.error(`Getting depth 1 neighbors for "${nodeName}"`);
        
        const depth1Result = await session.executeRead(tx => tx.run(`
          MATCH (center:Memory {name: $nodeName})-[r]-(neighbor)
          RETURN neighbor, r
        `, { nodeName }));
        
        console.error(`Found ${depth1Result.records.length} direct neighbors`);
        
        // Process depth 1 relationships
        for (const record of depth1Result.records) {
          const neighbor = record.get('neighbor');
          const relationship = record.get('r');
          
          // Add neighbor if not already included
          const neighborId = neighbor.elementId || neighbor.identity.toString();
          if (!uniqueNodeIds.has(neighborId)) {
            allNodes.push(neighbor);
            uniqueNodeIds.add(neighborId);
          }
          
          // Add relationship
          allRelationships.push(relationship);
        }
      }
      
      // Get depth 2 neighbors if needed
      if (maxDepth >= 2) {
        console.error(`Getting depth 2 neighbors for "${nodeName}"`);
        
        const depth2Result = await session.executeRead(tx => tx.run(`
          MATCH (center:Memory {name: $nodeName})-[r1]-(depth1)-[r2]-(depth2)
          WHERE depth2 <> center AND depth1 <> depth2
          RETURN depth1, depth2, r1, r2
        `, { nodeName }));
        
        console.error(`Found connections to ${depth2Result.records.length} depth-2 neighbors`);
        
        // Process depth 2 relationships
        for (const record of depth2Result.records) {
          const depth1 = record.get('depth1');
          const depth2 = record.get('depth2');
          const rel1 = record.get('r1');
          const rel2 = record.get('r2');
          
          // Add depth1 node if not already included
          const depth1Id = depth1.elementId || depth1.identity.toString();
          if (!uniqueNodeIds.has(depth1Id)) {
            allNodes.push(depth1);
            uniqueNodeIds.add(depth1Id);
          }
          
          // Add depth2 node if not already included
          const depth2Id = depth2.elementId || depth2.identity.toString();
          if (!uniqueNodeIds.has(depth2Id)) {
            allNodes.push(depth2);
            uniqueNodeIds.add(depth2Id);
          }
          
          // Add relationships (avoiding duplicates by simply adding them all for now)
          allRelationships.push(rel1);
          allRelationships.push(rel2);
        }
      }
      
      // If we found relationships, deduplicate them by their identity
      const uniqueRelationships = allRelationships.filter((rel, index, self) => 
        index === self.findIndex(r => 
          (r.identity && rel.identity && r.identity.equals(rel.identity)) || 
          r === rel
        )
      );
      
      console.error(`Found ${allNodes.length} nodes and ${uniqueRelationships.length} relationships in context`);
      
      // Convert to entities and relations format for return
      const entities: Entity[] = allNodes.map(node => {
        // Create a basic entity with required properties
        const entity: Entity = {
          name: node.properties.name,
          entityType: node.properties.nodeType || 'Entity',
          observations: node.properties.observations || []
        };
        
        // Add additional fields based on entity type
        if (node.properties.nodeType === 'Entity') {
          (entity as any).description = node.properties.description;
          (entity as any).biography = node.properties.biography;
          (entity as any).keyContributions = node.properties.keyContributions;
          (entity as any).confidence = node.properties.confidence;
        } 
        else if (node.properties.nodeType === 'Concept') {
          (entity as any).definition = node.properties.definition;
          (entity as any).examples = node.properties.examples;
          (entity as any).domain = node.properties.domain;
          (entity as any).perspectives = node.properties.perspectives;
          (entity as any).historicalDevelopment = node.properties.historicalDevelopment;
        }
        
        return entity;
      });
      
      const relations: Relation[] = uniqueRelationships.map(rel => {
        // Basic relation properties
        const relation: Relation = {
          from: rel.startNodeElementId ? 
            allNodes.find(n => n.elementId === rel.startNodeElementId)?.properties.name : 
            rel.startNode.properties.name,
          to: rel.endNodeElementId ? 
            allNodes.find(n => n.elementId === rel.endNodeElementId)?.properties.name : 
            rel.endNode.properties.name,
          relationType: rel.type
        };
        
        // Add enhanced relation properties if they exist
        if (rel.properties) {
          if (rel.properties.context) {
            (relation as any).context = rel.properties.context;
          }
          if (rel.properties.confidenceScore) {
            (relation as any).confidenceScore = rel.properties.confidenceScore;
          }
          if (rel.properties.sources) {
            (relation as any).sources = rel.properties.sources;
          }
        }
        
        return relation;
      });
      
      return { entities, relations };
    } catch (error) {
      console.error(`Error exploring context: ${error}`);
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
  }
  
  // Enhanced search that tries both exact matching and string containment
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
      
      // Second attempt: Case-insensitive exact match
      try {
        console.error('Trying case-insensitive exact match');
        const caseInsensitiveExactResult = await session.executeRead(tx => tx.run(`
          MATCH (entity:Memory)
          WHERE toLower(entity.name) = toLower($query)
          
          // Get relationships
          WITH entity
          OPTIONAL MATCH (entity)-[r]->(other)
          WITH entity, collect(r) as outRels
          OPTIONAL MATCH (other)-[inRel]->(entity)
          
          RETURN entity, outRels as relations, collect(inRel) as inRelations
        `, { query: searchQuery }));
        
        searchAttempts.push(`Case-insensitive exact match: ${caseInsensitiveExactResult.records.length} results`);
        console.error(`Case-insensitive exact match found ${caseInsensitiveExactResult.records.length} results`);
        
        if (caseInsensitiveExactResult.records.length > 0) {
          return this.processSearchResults(caseInsensitiveExactResult.records);
        }
      } catch (error) {
        console.error(`Error in case-insensitive exact match search: ${error}`);
        searchAttempts.push(`Case-insensitive exact match: error - ${error.message}`);
      }
      
      // Third attempt: String containment search
      try {
        console.error('Trying string containment search');
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
        
        searchAttempts.push(`String containment: ${containmentResult.records.length} results`);
        console.error(`String containment search found ${containmentResult.records.length} results`);
        
        if (containmentResult.records.length > 0) {
          return this.processSearchResults(containmentResult.records);
        }
      } catch (error) {
        console.error(`Error in containment search: ${error}`);
        searchAttempts.push(`String containment: error - ${error.message}`);
      }
      
      // Fourth attempt: Token-based search (split query into tokens and search for each)
      try {
        console.error('Trying token-based search');
        const tokens = searchQuery.split(/\s+/).filter(token => token.length > 2);
        
        if (tokens.length > 0) {
          const tokenQuery = `
            MATCH (entity:Memory)
            WHERE 
              ${tokens.map((_, i) => `
                toLower(entity.name) CONTAINS toLower($token${i})
                OR (entity.content IS NOT NULL AND toLower(entity.content) CONTAINS toLower($token${i}))
                OR (entity.definition IS NOT NULL AND toLower(entity.definition) CONTAINS toLower($token${i}))
              `).join(' OR ')}
            
            // Get relationships
            WITH entity
            OPTIONAL MATCH (entity)-[r]->(other)
            WITH entity, collect(r) as outRels
            OPTIONAL MATCH (other)-[inRel]->(entity)
            
            RETURN entity, outRels as relations, collect(inRel) as inRelations
            LIMIT 20
          `;
          
          const params = {};
          tokens.forEach((token, i) => {
            params[`token${i}`] = token;
          });
          
          const tokenResult = await session.executeRead(tx => tx.run(tokenQuery, params));
          
          searchAttempts.push(`Token-based search: ${tokenResult.records.length} results`);
          console.error(`Token-based search found ${tokenResult.records.length} results`);
          
          if (tokenResult.records.length > 0) {
            return this.processSearchResults(tokenResult.records);
          }
        }
      } catch (error) {
        console.error(`Error in token-based search: ${error}`);
        searchAttempts.push(`Token-based search: error - ${error.message}`);
      }
      
      // Log all search attempts to help diagnose issues
      console.error(`All search attempts exhausted: ${searchAttempts.join(', ')}`);
      
      // Return empty results if nothing found
      return { entities: [], relations: [] };
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

