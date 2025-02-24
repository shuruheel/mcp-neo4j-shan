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

    // Explore the neighborhood context around a node
    async exploreContext(nodeName: string, maxDepth: number = 2): Promise<KnowledgeGraph> {
      const session = this.neo4jDriver.session();
      
      try {
        console.error(`Exploring context for node: "${nodeName}" with maxDepth: ${maxDepth}`);
        
        // Use case-insensitive search from the start
        const nodeCheck = await session.executeRead(tx => tx.run(`
          MATCH (n:Memory)
          WHERE toLower(n.name) = toLower($nodeName)
          RETURN n
        `, { nodeName }));
        
        if (nodeCheck.records.length === 0) {
          console.error(`No node found with name "${nodeName}" (case-insensitive check)`);
          return { entities: [], relations: [] };
        }
        
        // Use the actual node name with correct casing
        const actualNodeName = nodeCheck.records[0].get('n').properties.name;
        console.error(`Found node: "${actualNodeName}"`);
        
        // Build the result incrementally, starting with the center node
        let allNodes: any[] = [];
        let allRelationships: any[] = [];
        let uniqueNodeIds = new Set<string>();
        
        // Get the center node
        const centerNode = nodeCheck.records[0].get('n');
        allNodes.push(centerNode);
        uniqueNodeIds.add(centerNode.elementId || centerNode.identity.toString());
        
        // Get immediate neighbors (depth 1)
        if (maxDepth >= 1) {
          console.error(`Getting depth 1 neighbors for "${actualNodeName}"`);
          
          const depth1Result = await session.executeRead(tx => tx.run(`
            MATCH (center:Memory {name: $nodeName})-[r]-(neighbor)
            RETURN neighbor, r
          `, { nodeName: actualNodeName }));
          
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
          console.error(`Getting depth 2 neighbors for "${actualNodeName}"`);
          
          const depth2Result = await session.executeRead(tx => tx.run(`
            MATCH (center:Memory {name: $nodeName})-[r1]-(depth1)-[r2]-(depth2)
            WHERE depth2 <> center AND depth1 <> depth2
            RETURN depth1, depth2, r1, r2
          `, { nodeName: actualNodeName }));
          
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
            
            // Add relationships
            allRelationships.push(rel1);
            allRelationships.push(rel2);
          }
        }
        
        // Deduplicate relationships by their identity
        const uniqueRelationships = allRelationships.filter((rel, index, self) => 
          index === self.findIndex(r => 
            (r.identity && rel.identity && r.identity.equals(rel.identity)) || 
            r === rel
          )
        );
        
        console.error(`Found ${allNodes.length} nodes and ${uniqueRelationships.length} relationships in context`);
        
        // Convert to entities and relations format for return
        const entities: Entity[] = allNodes.map(node => {
          try {
            // Make sure properties exist
            const nodeProps = node.properties || {};
            
            // Create a basic entity with required properties, with fallbacks for missing values
            const entity: any = {
              name: nodeProps.name || 'Unnamed Node',
              entityType: nodeProps.nodeType || 'Entity',
              observations: Array.isArray(nodeProps.observations) ? nodeProps.observations : []
            };
            
            // Safely add additional fields based on entity type
            if (nodeProps.nodeType === 'Entity') {
              if (nodeProps.description !== undefined && nodeProps.description !== null) entity.description = nodeProps.description;
              if (nodeProps.biography !== undefined && nodeProps.biography !== null) entity.biography = nodeProps.biography;
              if (nodeProps.keyContributions !== undefined && nodeProps.keyContributions !== null) 
                entity.keyContributions = Array.isArray(nodeProps.keyContributions) ? nodeProps.keyContributions : [];
              if (nodeProps.confidence !== undefined && nodeProps.confidence !== null) entity.confidence = nodeProps.confidence;
              
              // Add cognitive enhancement fields if they exist
              if (nodeProps.emotionalValence !== undefined && nodeProps.emotionalValence !== null) entity.emotionalValence = nodeProps.emotionalValence;
              if (nodeProps.emotionalArousal !== undefined && nodeProps.emotionalArousal !== null) entity.emotionalArousal = nodeProps.emotionalArousal;
            } 
            else if (nodeProps.nodeType === 'Concept') {
              if (nodeProps.definition) entity.definition = nodeProps.definition;
              if (nodeProps.examples) entity.examples = Array.isArray(nodeProps.examples) ? nodeProps.examples : [];
              if (nodeProps.domain) entity.domain = nodeProps.domain;
              if (nodeProps.perspectives) entity.perspectives = Array.isArray(nodeProps.perspectives) ? nodeProps.perspectives : [];
              if (nodeProps.historicalDevelopment) entity.historicalDevelopment = Array.isArray(nodeProps.historicalDevelopment) ? nodeProps.historicalDevelopment : [];
              
              // Add cognitive enhancement fields if they exist
              if (nodeProps.emotionalValence !== undefined && nodeProps.emotionalValence !== null) entity.emotionalValence = nodeProps.emotionalValence;
              if (nodeProps.emotionalArousal !== undefined && nodeProps.emotionalArousal !== null) entity.emotionalArousal = nodeProps.emotionalArousal;
              if (nodeProps.abstractionLevel !== undefined && nodeProps.abstractionLevel !== null) entity.abstractionLevel = nodeProps.abstractionLevel;
              if (nodeProps.metaphoricalMappings) entity.metaphoricalMappings = Array.isArray(nodeProps.metaphoricalMappings) ? nodeProps.metaphoricalMappings : [];
            }
            else if (nodeProps.nodeType === 'Event') {
              if (nodeProps.startDate) entity.startDate = nodeProps.startDate;
              if (nodeProps.endDate) entity.endDate = nodeProps.endDate;
              if (nodeProps.location) entity.location = nodeProps.location;
              if (nodeProps.participants) entity.participants = Array.isArray(nodeProps.participants) ? nodeProps.participants : [];
              if (nodeProps.outcome) entity.outcome = nodeProps.outcome;
              
              // Add cognitive enhancement fields if they exist
              if (nodeProps.emotionalValence !== undefined && nodeProps.emotionalValence !== null) entity.emotionalValence = nodeProps.emotionalValence;
              if (nodeProps.emotionalArousal !== undefined && nodeProps.emotionalArousal !== null) entity.emotionalArousal = nodeProps.emotionalArousal;
              if (nodeProps.causalPredecessors) entity.causalPredecessors = Array.isArray(nodeProps.causalPredecessors) ? nodeProps.causalPredecessors : [];
              if (nodeProps.causalSuccessors) entity.causalSuccessors = Array.isArray(nodeProps.causalSuccessors) ? nodeProps.causalSuccessors : [];
            }
            else if (nodeProps.nodeType === 'Thought') {
              if (nodeProps.thoughtContent) entity.thoughtContent = nodeProps.thoughtContent;
              if (nodeProps.content && !nodeProps.thoughtContent) entity.thoughtContent = nodeProps.content; // Backward compatibility
              if (nodeProps.references) entity.references = Array.isArray(nodeProps.references) ? nodeProps.references : [];
              if (nodeProps.confidence !== undefined && nodeProps.confidence !== null) entity.confidence = nodeProps.confidence;
              
              // Add cognitive enhancement fields if they exist
              if (nodeProps.emotionalValence !== undefined && nodeProps.emotionalValence !== null) entity.emotionalValence = nodeProps.emotionalValence;
              if (nodeProps.emotionalArousal !== undefined && nodeProps.emotionalArousal !== null) entity.emotionalArousal = nodeProps.emotionalArousal;
              if (nodeProps.evidentialBasis) entity.evidentialBasis = Array.isArray(nodeProps.evidentialBasis) ? nodeProps.evidentialBasis : [];
              if (nodeProps.thoughtCounterarguments) entity.thoughtCounterarguments = Array.isArray(nodeProps.thoughtCounterarguments) ? nodeProps.thoughtCounterarguments : [];
              if (nodeProps.implications) entity.implications = Array.isArray(nodeProps.implications) ? nodeProps.implications : [];
              if (nodeProps.thoughtConfidenceScore !== undefined && nodeProps.thoughtConfidenceScore !== null) entity.thoughtConfidenceScore = nodeProps.thoughtConfidenceScore;
            }
            else if (nodeProps.nodeType === 'ScientificInsight') {
              if (nodeProps.hypothesis) entity.hypothesis = nodeProps.hypothesis;
              if (nodeProps.evidence) entity.evidence = Array.isArray(nodeProps.evidence) ? nodeProps.evidence : [];
              if (nodeProps.methodology) entity.methodology = nodeProps.methodology;
              if (nodeProps.confidence !== undefined && nodeProps.confidence !== null) entity.confidence = nodeProps.confidence;
              
              // Add cognitive enhancement fields if they exist
              if (nodeProps.emotionalValence !== undefined && nodeProps.emotionalValence !== null) entity.emotionalValence = nodeProps.emotionalValence;
              if (nodeProps.emotionalArousal !== undefined && nodeProps.emotionalArousal !== null) entity.emotionalArousal = nodeProps.emotionalArousal;
              if (nodeProps.evidenceStrength !== undefined && nodeProps.evidenceStrength !== null) entity.evidenceStrength = nodeProps.evidenceStrength;
              if (nodeProps.scientificCounterarguments) entity.scientificCounterarguments = Array.isArray(nodeProps.scientificCounterarguments) ? nodeProps.scientificCounterarguments : [];
              if (nodeProps.applicationDomains) entity.applicationDomains = Array.isArray(nodeProps.applicationDomains) ? nodeProps.applicationDomains : [];
              if (nodeProps.replicationStatus) entity.replicationStatus = nodeProps.replicationStatus;
              if (nodeProps.surpriseValue !== undefined && nodeProps.surpriseValue !== null) entity.surpriseValue = nodeProps.surpriseValue;
            }
            else if (nodeProps.nodeType === 'Law') {
              if (nodeProps.statement) entity.statement = nodeProps.statement;
              if (nodeProps.conditions) entity.conditions = Array.isArray(nodeProps.conditions) ? nodeProps.conditions : [];
              if (nodeProps.exceptions) entity.exceptions = Array.isArray(nodeProps.exceptions) ? nodeProps.exceptions : [];
              if (nodeProps.domain) entity.domain = nodeProps.domain;
              
              // Add cognitive enhancement fields if they exist
              if (nodeProps.emotionalValence !== undefined && nodeProps.emotionalValence !== null) entity.emotionalValence = nodeProps.emotionalValence;
              if (nodeProps.emotionalArousal !== undefined && nodeProps.emotionalArousal !== null) entity.emotionalArousal = nodeProps.emotionalArousal;
              if (nodeProps.domainConstraints) entity.domainConstraints = Array.isArray(nodeProps.domainConstraints) ? nodeProps.domainConstraints : [];
              if (nodeProps.historicalPrecedents) entity.historicalPrecedents = Array.isArray(nodeProps.historicalPrecedents) ? nodeProps.historicalPrecedents : [];
              if (nodeProps.counterexamples) entity.counterexamples = Array.isArray(nodeProps.counterexamples) ? nodeProps.counterexamples : [];
              if (nodeProps.formalRepresentation) entity.formalRepresentation = nodeProps.formalRepresentation;
            }
            
            return entity;
          } catch (error) {
            console.error(`Error processing node: ${error}`);
            return {
            };
          }
        });
        
        const relations: Relation[] = uniqueRelationships.map(rel => {
          try {
            // Make sure properties exist
            const relProps = rel.properties || {};
            
            // Find start and end node names with fallbacks
            let fromName = 'Unknown';
            let toName = 'Unknown';
            
            try {
              // Try to get the start node name
              if (rel.startNodeElementId) {
                const startNode = allNodes.find(n => n.elementId === rel.startNodeElementId);
                if (startNode && startNode.properties && startNode.properties.name) {
                  fromName = startNode.properties.name;
                }
              } else if (rel.startNode && rel.startNode.properties && rel.startNode.properties.name) {
                fromName = rel.startNode.properties.name;
              }
              
              // Try to get the end node name
              if (rel.endNodeElementId) {
                const endNode = allNodes.find(n => n.elementId === rel.endNodeElementId);
                if (endNode && endNode.properties && endNode.properties.name) {
                  toName = endNode.properties.name;
                }
              } else if (rel.endNode && rel.endNode.properties && rel.endNode.properties.name) {
                toName = rel.endNode.properties.name;
              }
            } catch (e) {
              console.error(`Error retrieving node names for relationship: ${e}`);
            }
            
            // Basic relation properties
            const relation: any = {
              from: fromName,
              to: toName,
              relationType: rel.type || 'RELATED_TO'
            };
            
            // Add enhanced relation properties if they exist
            if (relProps) {
              if (relProps.context !== undefined && relProps.context !== null) {
                relation.context = relProps.context;
              }
              if (relProps.confidenceScore !== undefined && relProps.confidenceScore !== null) {
                relation.confidenceScore = relProps.confidenceScore;
              }
              if (relProps.sources !== undefined && relProps.sources !== null) {
                relation.sources = Array.isArray(relProps.sources) ? relProps.sources : [];
              }
              if (relProps.fromType !== undefined && relProps.fromType !== null) {
                relation.fromType = relProps.fromType;
              }
              if (relProps.toType !== undefined && relProps.toType !== null) {
                relation.toType = relProps.toType;
              }
            }
            
            return relation;
          } catch (error) {
            console.error(`Error processing relationship: ${error}`);
            // Return a minimal valid relation if there's an error
            return {
              from: 'Unknown',
              to: 'Unknown',
              relationType: 'ERROR_PROCESSING'
            };
          }
        });
        
        return { entities, relations };
      } catch (error) {
        console.error(`Error exploring context: ${error}`);
        return { entities: [], relations: [] };
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

