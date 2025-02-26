import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

import neo4j, { Integer, Node, Relationship, Driver as Neo4jDriver, DateTime } from 'neo4j-driver'

import { KnowledgeGraphMemory, Entity, KnowledgeGraph, Relation } from "@neo4j/graphrag-memory";

// Add the RelationshipCategory enum
export enum RelationshipCategory {
  HIERARCHICAL = 'hierarchical', // parent-child, category-instance
  LATERAL = 'lateral',           // similarity, contrast, analogy
  TEMPORAL = 'temporal',         // before-after, causes-results
  COMPOSITIONAL = 'compositional' // part-whole, component-system
}

// Base interface for all node types
export interface BaseNode {
  name: string;
  createdAt: DateTime;
  lastUpdated: DateTime;
}

// Enhanced node type interfaces
export interface EnhancedEntity extends BaseNode {
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

export interface Event extends BaseNode {
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

export interface Concept extends BaseNode {
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

export interface Thought extends BaseNode {
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
  // New field to reference associated reasoning chains
  reasoningChains?: string[];  // References to ReasoningChain nodes
}

export interface ScientificInsight extends BaseNode {
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

export interface Law extends BaseNode {
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

// New interfaces for reasoning chains and steps
export interface ReasoningChain extends BaseNode {
  nodeType: 'ReasoningChain';
  description: string;
  conclusion: string;
  confidenceScore: number;  // 0.0-1.0
  creator: string;
  methodology: 'deductive' | 'inductive' | 'abductive' | 'analogical' | 'mixed';
  domain?: string;
  tags?: string[];
  sourceThought?: string;  // Reference to the thought that initiated this reasoning
  numberOfSteps?: number;  // Cached count of steps
  alternativeConclusionsConsidered?: string[];  // Other conclusions that were considered
}

export interface ReasoningStep extends BaseNode {
  nodeType: 'ReasoningStep';
  content: string;  // The actual reasoning content
  stepType: 'premise' | 'inference' | 'evidence' | 'counterargument' | 'rebuttal' | 'conclusion';
  evidenceType?: 'observation' | 'fact' | 'assumption' | 'inference' | 'expert_opinion' | 'statistical_data';
  supportingReferences?: string[];  // References to other nodes supporting this step
  confidence: number;  // 0.0-1.0
  alternatives?: string[];  // Alternative paths that could be taken at this step
  counterarguments?: string[];  // Known challenges to this reasoning step
  assumptions?: string[];  // Underlying assumptions for this step
  formalNotation?: string;  // For logical or mathematical steps
}

export type KnowledgeNode = EnhancedEntity | Event | Concept | ScientificInsight | Law | Thought | ReasoningChain | ReasoningStep;

export type EntityNode = Node<Integer, KnowledgeNode>

export interface EnhancedRelation extends Relation {
  fromType?: string;
  toType?: string;
  context?: string;  // Added field for explanatory context of the relationship (30-50 words)
  confidenceScore?: number;  // Added field for confidence scoring
  sources?: string[];  // Added field for citation sources
  weight?: number;     // Weight of the relationship (0.0-1.0), used for traversal prioritization
  
  // New cognitive enhancement fields
  contextType?: 'hierarchical' | 'associative' | 'causal' | 'temporal' | 'analogical';
  contextStrength?: number; // 0.0-1.0 indicating how strong this particular context is
  memoryAids?: string[]; // Phrases or cues that help recall this relationship
  relationshipCategory?: RelationshipCategory; // Categorization of relationship type
}

export type EntityRelationship = Relationship<Integer, Relation>

export type EntityWithRelationsResult = {
  entity: EntityNode,
  relations: EntityRelationship[],
  inRelations?: EntityRelationship[]
}

// Create a custom interface with only the methods you need
export interface CustomKnowledgeGraphMemory {
  createEntities(entities: Entity[]): Promise<Entity[]>;
  createRelations(relations: Relation[]): Promise<Relation[]>;
  searchNodes(query: string): Promise<KnowledgeGraph>;
}

export class Neo4jCreator implements CustomKnowledgeGraphMemory {
  constructor(private neo4jDriver: Neo4jDriver) { }

  private async loadGraph(): Promise<KnowledgeGraph> {
    const session = this.neo4jDriver.session();
    
    try {
      // Execute a Cypher statement in a Read Transaction that matches all node types
      const res = await session.executeRead(tx => tx.run<EntityWithRelationsResult>(`
        MATCH (entity)
        WHERE entity:Entity OR entity:Event OR entity:Concept OR entity:ScientificInsight OR entity:Law OR entity:Thought
        OPTIONAL MATCH (entity)-[r]->(other)
        RETURN entity, collect(r) as relations
      `));
      
      const kgMemory: KnowledgeGraph = res.records.reduce(
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
          kg.relations.push(...entityRelationships.map(r => r.properties as Relation));
          return kg;
        }, 
        ({entities:[], relations:[]} as KnowledgeGraph)
      );
      
      return kgMemory;
    } catch (error) {
      console.error('Error loading graph:', error);
      return { entities: [], relations: [] };
    } finally {
      await session.close();
    }
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
            
            // For ReasoningChain nodes
            FOREACH (ignore IN CASE WHEN entity.entityType = 'ReasoningChain' THEN [1] ELSE [] END | 
              MERGE (node:Memory {name: entity.name})
              SET node.nodeType = 'ReasoningChain',
                  node:ReasoningChain,
                  node.lastUpdated = datetime(),
                  node.description = entity.description,
                  node.conclusion = entity.conclusion,
                  node.confidenceScore = entity.confidenceScore,
                  node.creator = entity.creator,
                  node.methodology = entity.methodology,
                  node.domain = entity.domain,
                  node.tags = COALESCE(entity.tags, []),
                  node.sourceThought = entity.sourceThought,
                  node.numberOfSteps = entity.numberOfSteps,
                  node.alternativeConclusionsConsidered = COALESCE(entity.alternativeConclusionsConsidered, []),
                  node.createdAt = CASE WHEN node.createdAt IS NULL THEN datetime() ELSE node.createdAt END
            )
            
            // For ReasoningStep nodes
            FOREACH (ignore IN CASE WHEN entity.entityType = 'ReasoningStep' THEN [1] ELSE [] END | 
              MERGE (node:Memory {name: entity.name})
              SET node.nodeType = 'ReasoningStep',
                  node:ReasoningStep,
                  node.lastUpdated = datetime(),
                  node.content = entity.content,
                  node.stepType = entity.stepType,
                  node.evidenceType = entity.evidenceType,
                  node.supportingReferences = COALESCE(entity.supportingReferences, []),
                  node.confidence = entity.confidence,
                  node.alternatives = COALESCE(entity.alternatives, []),
                  node.counterarguments = COALESCE(entity.counterarguments, []),
                  node.assumptions = COALESCE(entity.assumptions, []),
                  node.formalNotation = entity.formalNotation,
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
                                       sources: $sources,
                                       weight: $weight,
                                       // New cognitive enhancement fields
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
          relType: relation.relationType,
          fromNodeType: fromNodeType,
          toNodeType: toNodeType,
          context: (enhancedRelation as any).context || null,
          confidenceScore: (enhancedRelation as any).confidenceScore || null,
          sources: (enhancedRelation as any).sources || [],
          weight: (enhancedRelation as any).weight || null,
          // New cognitive enhancement fields
          contextType: (enhancedRelation as any).contextType || null,
          contextStrength: (enhancedRelation as any).contextStrength || null,
          memoryAids: (enhancedRelation as any).memoryAids || [],
          relationshipCategory: (enhancedRelation as any).relationshipCategory || null
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

  async searchNodes(query: string): Promise<KnowledgeGraph> {
    // This will be implemented in Neo4jRetriever, but we need a stub here to satisfy the interface
    console.warn('searchNodes called on Neo4jCreator instead of Neo4jRetriever');
    return { entities: [], relations: [] };
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

  // Add these new methods to the Neo4jCreator class

  async createReasoningChain(reasoningChain: {
    name: string;
    description: string;
    conclusion: string;
    confidenceScore: number;
    sourceThought?: string; // The thought this reasoning is attached to
    creator: string;
    methodology: 'deductive' | 'inductive' | 'abductive' | 'analogical' | 'mixed';
    domain?: string;
    tags?: string[];
    alternativeConclusionsConsidered?: string[];
  }): Promise<Entity> {
    const session = this.neo4jDriver.session();
    
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
      
      // First create the ReasoningChain node (simpler query without the relationship)
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
      if (error.code) {
        console.error(`Neo4j error code: ${error.code}`);
      }
      
      throw new Error(errorMessage);
    } finally {
      await session.close();
    }
  }

  async createReasoningStep(stepData: {
    chainName: string; // The reasoning chain this step belongs to
    name: string;
    content: string;
    stepNumber: number; // Position in the chain (1-based)
    stepType: 'premise' | 'inference' | 'evidence' | 'counterargument' | 'rebuttal' | 'conclusion';
    evidenceType?: 'observation' | 'fact' | 'assumption' | 'inference' | 'expert_opinion' | 'statistical_data';
    supportingReferences?: string[]; // Names of nodes that support this step
    confidence: number;
    alternatives?: string[];
    counterarguments?: string[];
    assumptions?: string[];
    formalNotation?: string;
    previousSteps?: string[]; // Names of steps that directly lead to this one (for branching)
  }): Promise<Entity> {
    const session = this.neo4jDriver.session();
    
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
      if (error.code) {
        console.error(`Neo4j error code: ${error.code}`);
      }
      
      throw new Error(errorMessage);
    } finally {
      await session.close();
    }
  }
}