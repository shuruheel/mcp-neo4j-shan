import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { driver as connectToNeo4j, auth as Neo4jAuth } from 'neo4j-driver'
import path from 'path';
import { fileURLToPath } from 'url';

import { Entity, Relation } from "@neo4j/graphrag-memory";
import { Neo4jCreator } from './node-creator.js'
import { Neo4jRetriever } from './node-retriever.js'
import { NarrativeGenerator, NarrativeOptions } from './narrative-generator.js'

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const args = process.argv.slice(2);

const neo4jDriver = connectToNeo4j(
  'neo4j+s://9df4bc56.databases.neo4j.io',
  Neo4jAuth.basic('neo4j', 'jrOZqvLnVYUQ7OF0JdmuOo4PqSlbGfvD50HXVXZrmEE')
)

// Create instances for node creation and retrieval
const nodeCreator = new Neo4jCreator(neo4jDriver);
const nodeRetriever = new Neo4jRetriever(neo4jDriver);

// The server instance and tools exposed to Claude
const server = new Server({
  name: "mcp-neo4j-shan",
  version: "1.0.1",
  },    {
      capabilities: {
        tools: {},
        prompts: {}
      },
    },);
    
const SYSTEM_PROMPT = `You are interacting with a Neo4j knowledge graph that stores interconnected information about entities, events, concepts, scientific insights, laws, and thoughts. This knowledge graph helps maintain context between conversations and builds a rich network of related information over time.

TOOL USAGE WORKFLOW:
1. ALWAYS start by using the \`explore_weighted_context\` tool to check if relevant nodes already exist in the knowledge graph when the user asks about a topic. This tool reveals the neighborhood around a node with intelligent prioritization of the most important relationships first, providing rich contextual information organized by relationship weights.

2. If \`explore_weighted_context\` doesn't return any nodes OR if the user explicitly asks to update the knowledge graph, use the \`create_nodes\` tool to add new information. Extract ALL relevant node types from the conversation:

   NODE TYPES AND SCHEMAS:
   - Entity: People, organizations, products, physical objects
     * Required: name, entityType="Entity"
     * Optional: description, biography, keyContributions (array)
   
   - Event: Time-bound occurrences with temporal attributes
     * Required: name, entityType="Event" 
     * Optional: description, startDate, endDate, location, participants (array), outcome
   
   - Concept: Abstract ideas, theories, principles, frameworks
     * Required: name, entityType="Concept"
     * Optional: description, definition, domain, perspectives (array), historicalDevelopment (array)
   
   - ScientificInsight: Research findings with supporting evidence
     * Required: name, entityType="ScientificInsight"
     * Optional: description, hypothesis, evidence (array), methodology, confidence, field, publications (array)
   
   - Law: Established principles, rules, or regularities
     * Required: name, entityType="Law"
     * Optional: description, content, legalDocument, legalDocumentJurisdiction, legalDocumentReference, entities (array), concepts (array)
   
   - Thought: Analyses, interpretations, or reflections
     * Required: name, entityType="Thought"
     * Optional: description, content

3. After creating nodes, ALWAYS use the \`create_relations\` tool to connect them to existing nodes. Relations are critical for building a valuable knowledge graph:
   - Use active voice verbs for relationTypes (e.g., ADVOCATES, PARTICIPATED_IN, RELATES_TO)
   - Ensure proper directionality (from → to) with meaningful connections
   - Always include a detailed context field (30-50 words) explaining how and why the nodes are related
   - Include confidence scores (0.0-1.0) when appropriate
   - Add citation sources when available for academic or factual claims
   - Always provide weight values (0.0-1.0) indicating how important the relationship is
   - Set appropriate relationshipCategory values (hierarchical, lateral, temporal, compositional)

4. Only use the \`create_thoughts\` tool when specifically asked to add your thoughts to the knowledge graph. These represent your analysis or insights about the conversation and should be connected to relevant nodes.

5. For exploring temporal information, use the \`get_temporal_sequence\` tool to visualize how events and concepts unfold over time.

COGNITIVE ORGANIZATION GUIDELINES:
- Categorize relationships appropriately (hierarchical, lateral, temporal, compositional)
- Use weights to indicate importance (higher weights = more important connections)
- Include memory aids and context information to enhance recall
- Consider emotional dimensions when representing knowledge

QUALITY GUIDELINES:
- Create concise, specific, and uniquely identifiable node names
- Provide comprehensive attributes for each node type
- Construct meaningful relationships that clearly show how nodes are connected
- Build a coherent network structure that captures the semantic richness of information
- Focus on creating high-quality nodes with detailed attributes and meaningful relationships

The knowledge graph is designed to build connections between ideas over time. Your role is to help users interact with this knowledge structure effectively, extracting insights and adding new information in a structured, meaningful way.`;

// Define tool-specific prompts
const TOOL_PROMPTS = {
  "explore_weighted_context": `You are a knowledge graph exploration assistant with cognitive science capabilities. When presenting exploration results from weighted context exploration:
  
  1. Focus on the STRONGEST relationships first (higher weight values indicate more important connections)
  2. Organize information clearly by node types (Entity, Event, Concept, ScientificInsight, Law, Thought)
  3. Format relationships with direction indicators (→) showing the connection between nodes
  4. Include relationship weights and contextual information to explain WHY nodes are connected
  5. Highlight cognitive dimensions when available:
     - Emotional valence and arousal ratings across all node types
     - Relationship categories (hierarchical, lateral, temporal, compositional)
     - Context types and memory aids in relationships
  
  Present the results in a narrative format that emphasizes:
  1. The central node and its most important connections (highest weights)
  2. The hierarchical structure of knowledge where appropriate
  3. The temporal sequences when relevant
  4. The most semantically significant relationships based on context and weight
  
  This weighted approach prioritizes the most cognitively significant connections first, helping users understand complex knowledge structures more intuitively by focusing on relationships that mirror human memory organization.`,

  "explore_context": `DEPRECATED - Please use explore_weighted_context instead as it provides better cognitive organization of knowledge.
  
  This tool explores the knowledge graph without considering relationship weights, which may result in less intuitive exploration as weak relationships are treated the same as strong ones.`,

  "create_nodes": `You are a knowledge graph creation assistant with cognitive neuroscience capabilities. When creating nodes:
  1. Create nodes with detailed, complete attributes based on their type
  2. Ensure node names are concise, specific, and uniquely identifiable
  3. Organize output by node type for clarity
  4. Provide confirmation of what was created
  5. Extract cognitive and emotional dimensions for each node
  
  For ALL node types, extract these cognitive dimensions:
  - emotionalValence: Analyze the emotional tone from -1.0 (negative) to 1.0 (positive)
  - emotionalArousal: Assess emotional intensity from 0.0 (calm) to 3.0 (highly arousing)
  
  Type-specific cognitive extraction:
  
  - Entity (People, organizations, products, physical objects):
    * Core fields: name, entityType="Entity", description, biography, keyContributions
    * Extract emotional dimensions based on linguistic cues in descriptions and user sentiment
  
  - Event (Time-bound occurrences):
    * Core fields: name, entityType="Event", description, dates, location, participants, outcome
    * Extract causalPredecessors: Events that directly led to this event
    * Extract causalSuccessors: Events directly resulting from this event
    * Identify emotional significance of the event
  
  - Concept (Abstract ideas, theories, frameworks):
    * Core fields: name, entityType="Concept", definition, domain, perspectives, historicalDevelopment
    * Extract abstractionLevel: How abstract (1.0) vs. concrete (0.0) the concept is
    * Identify metaphoricalMappings: Conceptual metaphors used to explain this concept
  
  - ScientificInsight (Research findings with evidence):
    * Core fields: name, entityType="ScientificInsight", hypothesis, evidence, methodology, confidence
    * Extract evidenceStrength: Assess overall strength of evidence (0.0-1.0)
    * Identify scientificCounterarguments: Known challenges to this insight
    * Determine applicationDomains: Practical areas where insight applies
    * Note replicationStatus: Current scientific consensus on replication
    * Assess surpriseValue: How unexpected this insight is (0.0-1.0)
  
  - Law (Established principles or rules):
    * Core fields: name, entityType="Law", description, content
    * Identify domainConstraints: Limitations on where law applies
    * Find historicalPrecedents: Earlier formulations or precursors
    * Extract counterexamples: Cases that challenge or limit the law
    * Capture formalRepresentation: Mathematical/logical formulation when applicable
  
  - Thought (Analyses or interpretations):
    * Core fields: name, entityType="Thought", title, thoughtContent
    * Identify evidentialBasis: Nodes supporting this thought
    * Extract thoughtCounterarguments: Potential challenges to this thought
    * Determine implications: Logical consequences of this thought
    * Assess thoughtConfidenceScore: Level of certainty (0.0-1.0)
    
  Focus on extracting these cognitive dimensions naturally from context rather than asking the user directly. Use linguistic cues, semantic analysis, and contextual understanding to determine these values.`,

  "create_relations": `You are a knowledge graph relation assistant. When creating relations:
  1. Use active voice verbs for relationTypes that clearly indicate the semantic connection
  2. Ensure proper directionality (from → to) with meaningful connections
  3. Always include a detailed context field (30-50 words) explaining how and why the nodes are related
  4. Include confidence scores (0.0-1.0) when appropriate
  5. Add citation sources when available
  6. Provide a weight (0.0-1.0) indicating the relationship's strength or importance
  
  Required fields for each relation:
  - from: The name of the source node
  - to: The name of the target node  
  - relationType: An active voice verb describing the relationship (e.g., ADVOCATES, PARTICIPATED_IN, RELATES_TO)
  
  Optional but highly recommended fields:
  - context: Explanation of how and why these nodes are related (30-50 words)
  - confidenceScore: Number between 0.0-1.0 indicating certainty of the relationship
  - weight: Number between 0.0-1.0 indicating the strength/importance of the relationship
  - sources: Array of citation sources
  
  Cognitive enhancement fields (based on cognitive science principles):
  - contextType: The type of context this relationship represents ('hierarchical', 'associative', 'causal', 'temporal', 'analogical')
  - contextStrength: How strong this particular context is (0.0-1.0)
  - memoryAids: Phrases or cues that help recall this relationship
  - relationshipCategory: Categorization of the relationship type ('hierarchical', 'lateral', 'temporal', 'compositional')
  
  Guidelines for relationship categories:
  - HIERARCHICAL: Parent-child relationships, category-instance, is-a, taxonomic structures
  - LATERAL: Similarity relationships, contrasts, analogies, associations
  - TEMPORAL: Before-after relationships, causes-results, sequences
  - COMPOSITIONAL: Part-whole relationships, component-system, contains/contained
  
  Guidelines for weights:
  - Higher weights (0.8-1.0): Direct, strong, and crucial relationships (e.g., defining characteristics, direct causation)
  - Medium weights (0.4-0.7): Important but not defining relationships (e.g., significant influences, correlations)
  - Lower weights (0.1-0.3): Minor or tangential relationships (e.g., weak associations, historical connections)
  
  Example relation types between different node types:
  - Entity → Concept: ADVOCATES, SUPPORTS, UNDERSTANDS
  - Entity → Event: PARTICIPATED_IN, ORGANIZED, WITNESSED
  - Concept → Concept: RELATES_TO, BUILDS_UPON, CONTRADICTS, IS_PREREQUISITE_FOR, IS_A, PART_OF
  - Event → ScientificInsight: LED_TO, DISPROVED, REINFORCED
  - ScientificInsight → Law: SUPPORTS, CHALLENGES, REFINES`,

  "create_thoughts": `You are a knowledge graph thought assistant with cognitive neuroscience capabilities. When creating thought nodes:
  1. Create detailed thought content that represents analysis, interpretation, or insight
  2. Connect the thought to relevant entities, concepts, events, scientific insights, laws, and other thoughts
  3. Include a clear title that summarizes the thought
  4. Explain how this thought enhances the knowledge graph
  5. Extract cognitive and emotional dimensions for the thought
  
  Interface for Thought creation with cognitive enhancements:
  - Required fields:
    * title: Brief descriptive title
    * thoughtContent: Detailed thought content
  
  - Cognitive dimensions to extract:
    * emotionalValence: Analyze emotional tone from -1.0 (negative) to 1.0 (positive)
    * emotionalArousal: Assess emotional intensity from 0.0 (calm) to 3.0 (arousing)
    * evidentialBasis: Identify nodes that support or provide evidence for this thought
    * thoughtCounterarguments: Extract potential challenges or counterarguments
    * implications: Determine logical consequences or implications
    * thoughtConfidenceScore: Assess level of certainty (0.0-1.0)
  
  - Optional fields for connections:
    * entityName: Primary Entity this Thought relates to
    * entities: Array of related entity names
    * concepts: Array of related concept names
    * events: Array of related event names
    * scientificInsights: Array of related scientific insight names
    * laws: Array of related law names
    * thoughts: Array of related thought names
    
  Focus on extracting cognitive dimensions naturally from context rather than asking the user directly. Use linguistic cues, semantic analysis, and contextual understanding to determine these values.`,

  "get_temporal_sequence": `You are a temporal sequence visualization assistant. This tool helps users understand how events, concepts, and insights unfold over time by retrieving temporally connected nodes from the knowledge graph.

  When presenting temporal sequence results:
  1. Organize events chronologically, using either explicit dates when available or implicit sequence when dates are missing
  2. Highlight cause-and-effect relationships between events (CAUSED, RESULTED_IN relationships)
  3. Emphasize the temporal flow with appropriate transition phrases
  4. Identify key turning points or pivotal events in the sequence
  5. Note any significant time gaps or compression in the timeline
  
  Input parameters:
  - nodeName (required): The name of the node to start the temporal sequence from
  - direction (optional): 
    * "forward" - show events that came after the starting node
    * "backward" - show events that came before the starting node
    * "both" (default) - show events in both directions
  - maxEvents (optional): Maximum number of events to include (default: 10)
  
  This tool is particularly useful for:
  - Understanding historical developments and their causal relationships
  - Tracking the evolution of concepts over time
  - Visualizing cause-and-effect chains in complex scenarios
  - Creating narrative structures from interconnected events
  
  Present the results as a coherent narrative that follows temporal progression, making it easier for users to understand how events and concepts are connected through time.`
};

// Define the PROMPTS constant that's used in the GetPromptRequestSchema handler
const PROMPTS = {
  default: SYSTEM_PROMPT,
  ...TOOL_PROMPTS
};

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const prompt = PROMPTS[request.params.name];
  if (!prompt) {
    throw new Error(`Prompt not found: ${request.params.name}`);
  }

  // Include the system prompt for all tool-related prompts
  const messages = [
    {
      role: "system",
      content: {
        type: "text",
        text: prompt
      }
    }
  ];

  return { messages };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "explore_weighted_context",
        description: "The PRIMARY tool for exploring the knowledge graph context around a node. Uses relationship weights to prioritize the most important connections, providing an intelligent view focused on the strongest and most relevant relationships first. Particularly useful for understanding complex networks by highlighting significant connections based on their weights.",
        inputSchema: {
          type: "object",
          properties: {
            nodeName: { 
              type: "string", 
              description: "Name of the node to explore the context around" 
            },
            maxDepth: { 
              type: "number", 
              description: "Maximum number of relationship hops to include (default: 2)",
              default: 2 
            },
            minWeight: {
              type: "number",
              description: "Minimum relationship weight to include (0.0-1.0). Higher values filter out weaker connections. (default: 0.3)",
              default: 0.3
            }
          },
          required: ["nodeName"],
        },
      },
      {
        name: "explore_context",
        description: "DEPRECATED - Use explore_weighted_context instead. This tool will be removed in a future version. Explores the knowledge graph context around a node without considering relationship weights.",
        inputSchema: {
          type: "object",
          properties: {
            nodeName: { 
              type: "string", 
              description: "Name of the node to explore the context around" 
            },
            maxDepth: { 
              type: "number", 
              description: "Maximum number of relationship hops to include (default: 2)",
              default: 2 
            }
          },
          required: ["nodeName"],
        },
      },
      {
        name: "create_nodes",
        description: "WHEN the user specifically asks for the knowledge graph to be updated, create new nodes in the knowledge graph for ALL the following node types in the conversation:\n\n- Entity: People, organizations, products, or physical objects (e.g., 'John Smith', 'Apple Inc.', 'Golden Gate Bridge')\n- Event: Time-bound occurrences with temporal attributes (e.g., 'World War II', 'Company Merger', 'Product Launch')\n- Concept: Abstract ideas, theories, principles, or frameworks (e.g., 'Democracy', 'Machine Learning', 'Sustainability')\n- ScientificInsight: Research findings, experimental results, or scientific claims with supporting evidence (e.g., 'Greenhouse Effect', 'Quantum Entanglement')\n- Law: Established principles, rules, or regularities that describe phenomena (e.g., 'Law of Supply and Demand', 'Newton's Laws of Motion')\n- Thought: Analyses, interpretations, or reflections about other nodes in the graph (e.g., 'Analysis of Market Trends', 'Critique of Theory X')\n\nEach node type has specific cognitive attributes that should be populated when available. Ensure node names are concise, specific, and uniquely identifiable.",
        inputSchema: {
          type: "object",
          properties: {
            nodes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Node Title" },
                  entityType: { 
                    type: "string", 
                    description: "Node Type: Entity, Event, Concept, ScientificInsight, Law, Thought",
                    enum: ["Entity", "Event", "Concept", "ScientificInsight", "Law", "Thought"]
                  },
                  // Common cognitive fields for all node types
                  emotionalValence: { 
                    type: "number", 
                    description: "Emotional tone from -1.0 (negative) to 1.0 (positive)" 
                  },
                  emotionalArousal: { 
                    type: "number", 
                    description: "Emotional intensity from 0.0 (calm) to 3.0 (highly arousing)" 
                  },
                  
                  // Fields for Entity type
                  description: { type: "string", description: "Brief description of the entity" },
                  biography: { type: "string", description: "Biographical information for people or historical background for organizations/objects" },
                  keyContributions: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Key contributions or significance of this entity" 
                  },
                  
                  // Fields for Node Type: Event
                  startDate: { type: "string", description: "Start date of the event (YYYY-MM-DD or descriptive)" },
                  endDate: { type: "string", description: "End date of the event (YYYY-MM-DD or descriptive)" },
                  location: { type: "string", description: "Location of the event" },
                  participants: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Entities that participated in the event"
                  },
                  outcome: { type: "string", description: "Outcome of the event" },
                  causalPredecessors: {
                    type: "array",
                    items: { type: "string" },
                    description: "Events that directly led to this event"
                  },
                  causalSuccessors: {
                    type: "array",
                    items: { type: "string" },
                    description: "Events directly resulting from this event"
                  },
                  
                  // Fields for Node Type: Concept
                  definition: { type: "string", description: "A brief definition of the concept (1-2 concise sentences)" },
                  discoveryDate: { type: "string", description: "Date of discovery of the concept" },
                  domain: { type: "string", description: "Domain of the Node Type (if any)" },
                  perspectives: {
                    type: "array",
                    items: { type: "string" },
                    description: "Different viewpoints or perspectives on this concept"
                  },
                  historicalDevelopment: {
                    type: "array",
                    items: { 
                      type: "object",
                      properties: {
                        period: { type: "string", description: "Time period or era" },
                        development: { type: "string", description: "How the concept evolved during this period" }
                      }
                    }
                  },
                  abstractionLevel: {
                    type: "number",
                    description: "How abstract vs. concrete the concept is (0.0 = very concrete, 1.0 = highly abstract)"
                  },
                  metaphoricalMappings: {
                    type: "array",
                    items: { type: "string" },
                    description: "Conceptual metaphors used to explain this concept (e.g., 'Time is Money')"
                  },
                  
                  // Fields for Node Type: Scientific Insight
                  hypothesis: { type: "string", description: "Describe the hypothesis for the Scientific Insight node" },
                  evidence: {
                    type: "array",
                    items: { type: "string" },
                    description: "Evidence supporting the hypothesis"
                  },
                  methodology: { type: "string", description: "Methodology used to validate the hypothesis" },
                  confidence: { type: "number", description: "Confidence score the scientific insight" },
                  field: { type: "string", description: "Field of Science" },
                  publications: {
                    type: "array",
                    items: { type: "string" },
                    description: "Academic publications such as scientific papers, books, or articles"
                  },
                  evidenceStrength: {
                    type: "number",
                    description: "Overall strength of evidential support (0.0-1.0)"
                  },
                  scientificCounterarguments: {
                    type: "array",
                    items: { type: "string" },
                    description: "Known challenges or counter-arguments to this insight"
                  },
                  applicationDomains: {
                    type: "array",
                    items: { type: "string" },
                    description: "Practical areas where insight applies"
                  },
                  replicationStatus: {
                    type: "string",
                    description: "Current replication status (e.g., 'Replicated', 'Mixed', 'Failed', 'Unreplicated')"
                  },
                  surpriseValue: {
                    type: "number",
                    description: "How unexpected this insight is given prior knowledge (0.0-1.0)"
                  },
                  
                  // Fields for Node Type: Law
                  legalDocument: { type: "string", description: "Legal document that the law is derived from e.g., 'US Constitution'" },
                  legalDocumentJurisdiction: { type: "string", description: "Jurisdiction of the legal document e.g., 'United States'" },
                  legalDocumentReference: { type: "string", description: "Reference to the specific article and/or section of the legal document e.g., 'Article 1, Section 8'" },
                  content: { type: "string", description: "Content of the law" },
                  entities: {
                    type: "array",
                    items: { type: "string" },
                    description: "Entities that the law is related to"
                  },
                  concepts: {
                    type: "array",
                    items: { type: "string" },
                    description: "Concepts that the law is related to"
                  },
                  domainConstraints: {
                    type: "array",
                    items: { type: "string" },
                    description: "Limitations or boundaries where this law applies"
                  },
                  historicalPrecedents: {
                    type: "array",
                    items: { type: "string" },
                    description: "Earlier formulations or precursors to this law"
                  },
                  counterexamples: {
                    type: "array",
                    items: { type: "string" },
                    description: "Cases or instances that challenge or limit this law"
                  },
                  formalRepresentation: {
                    type: "string",
                    description: "Mathematical or logical formulation of the law when applicable"
                  },
                  
                  // Fields for Thought node type
                  title: { type: "string", description: "Brief title for the thought" },
                  thoughtContent: { type: "string", description: "Content of the thought in detail" },
                  evidentialBasis: {
                    type: "array",
                    items: { type: "string" },
                    description: "Nodes that support or provide evidence for this thought"
                  },
                  thoughtCounterarguments: {
                    type: "array",
                    items: { type: "string" },
                    description: "Potential challenges or counterarguments to this thought"
                  },
                  implications: {
                    type: "array",
                    items: { type: "string" },
                    description: "Logical consequences or implications of this thought"
                  },
                  thoughtConfidenceScore: {
                    type: "number", 
                    description: "Level of certainty in this thought (0.0-1.0)"
                  },
                },
                required: ["name", "entityType"],
              },
            },
          },
          required: ["nodes"],
        },
      },
      {
        name: "create_relations",
        description: "Whenever you create new nodes, always create any relevant new relations between nodes in the knowledge graph. Relations should be semantically meaningful and use active voice. IMPORTANT: Always include a brief explanation (context field) for each relationship that describes how and why the nodes are connected (30-50 words).\n\nExample relations between different node types:\n- Entity -> Concept: ADVOCATES, SUPPORTS, UNDERSTANDS\n- Entity -> Event: PARTICIPATED_IN, ORGANIZED, WITNESSED\n- Concept -> Concept: RELATES_TO, BUILDS_UPON, CONTRADICTS\n- Event -> ScientificInsight: LED_TO, DISPROVED, REINFORCED\n- ScientificInsight -> Law: SUPPORTS, CHALLENGES, REFINES\n\nWhen appropriate, include a confidence score (0.0-1.0) and citation sources for the relationship.",
        inputSchema: {
          type: "object",
          properties: {
            relations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  from: { type: "string", description: "The name of the node where the relation starts" },
                  fromType: { type: "string", description: "The type of the node where the relation starts" },
                  to: { type: "string", description: "The name of the node where the relation ends" },
                  toType: { type: "string", description: "The type of the node where the relation ends" },
                  relationType: { type: "string", description: "The type of the relation" },
                  context: { type: "string", description: "Brief explanation (30-50 words) of how and why these nodes are related" },
                  confidenceScore: { type: "number", description: "Confidence score for this relationship (0.0-1.0)" },
                  weight: { type: "number", description: "Weight indicating the relationship's strength/importance (0.0-1.0)" },
                  sources: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Citation sources supporting this relationship" 
                  },
                  // New cognitive enhancement fields
                  contextType: { 
                    type: "string", 
                    enum: ["hierarchical", "associative", "causal", "temporal", "analogical"],
                    description: "The type of context this relationship represents"
                  },
                  contextStrength: { 
                    type: "number", 
                    description: "How strong this particular context is (0.0-1.0)"
                  },
                  memoryAids: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Phrases or cues that help recall this relationship"
                  },
                  relationshipCategory: {
                    type: "string",
                    enum: ["hierarchical", "lateral", "temporal", "compositional"],
                    description: "Categorization of the relationship type"
                  }
                },
                required: ["from", "to", "relationType"],
              },
            },
          },
          required: ["relations"],
        },
      },
      {
        name: "create_thoughts",
        description: "Only when specifically asked to add your thoughts to the knowledge graph, create Thought nodes representing an analysis, interpretation, or insight about the conversation. Use this tool to document your reasoning, connect ideas across different nodes, or capture important observations that should be preserved. Thoughts should be linked to relevant entities, concepts, events, scientific insights, laws, and other thoughts, building a network of connected insights. Each thought should have clear content and, when possible, include confidence level.",
        inputSchema: {
          type: "object",
          properties: {
            entityName: { 
              type: "string",
              description: "The name of the primary Entity that the Thought is related to"
            },
            title: {
              type: "string",
              description: "Brief title for the thought"
            },
            thoughtContent: {
              type: "string", 
              description: "Articulate the thought in the best way possible"
            },
            entities: {
              type: "array",
              items: { type: "string" },
              description: "Names of entities that the thought is related to"
            },
            concepts: {
              type: "array",
              items: { type: "string" },
              description: "Names of concepts that the thought is related to"
            },
            events: {
              type: "array",
              items: { type: "string" },
              description: "Names of events that the thought is related to"
            },
            scientificInsights: {
              type: "array",
              items: { type: "string" },
              description: "Names of scientific insights that the thought is related to"
            },
            laws: {
              type: "array",
              items: { type: "string" },
              description: "Names of laws that the thought is related to"
            },
            thoughts: {
              type: "array",
              items: { type: "string" },
              description: "Names of thoughts that the thought is related to"
            },
            // Cognitive enhancement fields
            emotionalValence: { 
              type: "number", 
              description: "Emotional tone from -1.0 (negative) to 1.0 (positive)" 
            },
            emotionalArousal: { 
              type: "number", 
              description: "Emotional intensity from 0.0 (calm) to 3.0 (arousing)" 
            },
            evidentialBasis: {
              type: "array",
              items: { type: "string" },
              description: "Nodes that support or provide evidence for this thought"
            },
            thoughtCounterarguments: {
              type: "array",
              items: { type: "string" },
              description: "Potential challenges or counterarguments to this thought"
            },
            implications: {
              type: "array",
              items: { type: "string" },
              description: "Logical consequences or implications of this thought"
            },
            thoughtConfidenceScore: {
              type: "number", 
              description: "Level of certainty in this thought (0.0-1.0)"
            }
          },
          required: ["title", "thoughtContent"],
        },
      },
      {
        name: "get_temporal_sequence",
        description: "Visualize temporal sequences of related events and concepts, showing how they unfold over time. This helps understand causal and chronological relationships between nodes in the knowledge graph. The tool identifies time-bound relationships and provides a chronologically ordered sequence of connected events, scientific insights, and concepts.",
        inputSchema: {
          type: "object",
          properties: {
            nodeName: { 
              type: "string", 
              description: "The name of the node to start the temporal sequence from" 
            },
            direction: { 
              type: "string", 
              enum: ["forward", "backward", "both"],
              description: "Direction of temporal sequence: 'forward' (later events), 'backward' (earlier events), or 'both'",
              default: "both"
            },
            maxEvents: { 
              type: "number", 
              description: "Maximum number of events to include in the sequence",
              default: 10
            }
          },
          required: ["nodeName"],
        },
      }
    ],
}});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const toolPrompt = TOOL_PROMPTS[name] || SYSTEM_PROMPT;

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  let result;
  
  switch (name) {
    case "create_nodes":
      result = await nodeCreator.createEntities(args.nodes as Entity[]);
      return { 
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
      
    case "create_relations":
      result = await nodeCreator.createRelations(args.relations as Relation[]);
      return { 
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
      
    case "search_nodes":
      // Parse the query to extract different types of entities
      const searchQuery = args.query as string;
      
      // Use the robust search method that combines fuzzy matching with fallbacks
      result = await nodeRetriever.robustSearch(searchQuery);
      return { 
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
      
    case "create_thoughts":
      // Map content to thoughtContent for backward compatibility
      if (args.content && !args.thoughtContent) {
        args.thoughtContent = args.content;
      }
      
      result = await nodeCreator.createThought(args as { 
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
        // Cognitive enhancement fields
        emotionalValence?: number;
        emotionalArousal?: number;
        evidentialBasis?: string[];
        thoughtCounterarguments?: string[];
        implications?: string[];
        thoughtConfidenceScore?: number;
      });
      return { 
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
      
    case "explore_context":
      try {
        // Log the input parameters for debugging
        console.error(`Exploring context for node: ${args.nodeName}, maxDepth: ${args.maxDepth || 2}`);
        
        result = await nodeRetriever.exploreContext(
          args.nodeName as string,
          args.maxDepth as number || 2
        );
        
        // Ensure result has the expected structure even if null/undefined is returned
        if (!result) {
          console.error(`exploreContext returned undefined for node: ${args.nodeName}`);
          result = { entities: [], relations: [] };
        }
        
        // Basic validation and cleanup to ensure we always return valid arrays
        const cleanResult = {
          entities: Array.isArray(result.entities) ? result.entities : [],
          relations: Array.isArray(result.relations) ? result.relations : []
        };

        // Validate each entity to ensure they have at least required fields
        cleanResult.entities = cleanResult.entities.filter(entity => {
          if (!entity || typeof entity !== 'object') return false;
          if (!entity.name) {
            console.error(`Found entity without name, filtering out`);
            return false;
          }
          return true;
        });

        // Validate each relation to ensure they have required fields
        cleanResult.relations = cleanResult.relations.filter(relation => {
          if (!relation || typeof relation !== 'object') return false;
          if (!relation.from || !relation.to || !relation.relationType) {
            console.error(`Found relation missing required fields, filtering out`);
            return false;
          }
          return true;
        });

        console.error(`Returning ${cleanResult.entities.length} entities and ${cleanResult.relations.length} relations`);

        // Return properly formatted response with content type explicitly set to "text"
        return { 
          content: [{ type: "text", text: JSON.stringify(cleanResult, null, 2) }]
        };
      } catch (error) {
        console.error(`Error in explore_context tool: ${error}`);
        
        // Return a graceful error response with properly formatted content
        return { 
          content: [{ type: "text", text: JSON.stringify({
            error: `Error exploring context for node "${args.nodeName}": ${error.message || error}`,
            entities: [],
            relations: []
          }, null, 2) }]
        };
      }
            
    case "explore_weighted_context":
      try {
        // Log the input parameters for debugging
        console.error(`Exploring weighted context for node: ${args.nodeName}, maxDepth: ${args.maxDepth || 2}, minWeight: ${args.minWeight || 0.3}`);
        
        // Execute the weighted context exploration - this is the primary context exploration tool
        result = await nodeRetriever.exploreContextWeighted(
          args.nodeName as string,
          args.maxDepth as number || 2,
          args.minWeight as number || 0.3
        );
        
        // Ensure result has the expected structure even if null/undefined is returned
        if (!result) {
          console.error(`exploreContextWeighted returned undefined for node: ${args.nodeName}`);
          result = { entities: [], relations: [] };
        }
        
        // Basic validation and cleanup to ensure we always return valid arrays
        const cleanResult = {
          entities: Array.isArray(result.entities) ? result.entities : [],
          relations: Array.isArray(result.relations) ? result.relations : []
        };

        // Sort relations by weight in descending order to prioritize strongest connections
        if (cleanResult.relations.length > 0) {
          cleanResult.relations.sort((a, b) => {
            const weightA = (a as any).weight || 0.5;
            const weightB = (b as any).weight || 0.5;
            return weightB - weightA; // Descending order
          });
        }

        // Validate each entity to ensure they have at least required fields
        cleanResult.entities = cleanResult.entities.filter(entity => {
          if (!entity || typeof entity !== 'object') return false;
          if (!entity.name) {
            console.error(`Found entity without name, filtering out`);
            return false;
          }
          return true;
        });

        // Validate each relation to ensure they have required fields
        cleanResult.relations = cleanResult.relations.filter(relation => {
          if (!relation || typeof relation !== 'object') return false;
          if (!relation.from || !relation.to || !relation.relationType) {
            console.error(`Found relation missing required fields, filtering out`);
            return false;
          }
          return true;
        });

        console.error(`Returning ${cleanResult.entities.length} entities and ${cleanResult.relations.length} weighted relations`);

        // Return properly formatted response with content type explicitly set to "text"
        return { 
          content: [{ type: "text", text: JSON.stringify(cleanResult, null, 2) }]
        };
      } catch (error) {
        console.error(`Error in explore_weighted_context tool: ${error}`);
        
        // Return a graceful error response with properly formatted content
        return { 
          content: [{ type: "text", text: JSON.stringify({
            error: `Error exploring weighted context for node "${args.nodeName}": ${error.message || error}`,
            entities: [],
            relations: []
          }, null, 2) }]
        };
      }
            
    case "generate_narrative":
      try {
        const { topic, length, style } = args;
        
        // First get the knowledge graph data related to the topic
        const topicGraph = await nodeRetriever.robustSearch(topic as string);
        
        // Convert length and style to appropriate options
        const maxLength = length === 'short' ? 500 : length === 'medium' ? 1500 : 3000;
        const format = style === 'informative' ? 'detailed' : 
                       style === 'engaging' ? 'storytelling' : 'educational';
        
        // Create a narrative generator instance
        const narrativeGenerator = new NarrativeGenerator();
        
        // Generate the narrative
        const narrativeOptions: NarrativeOptions = { 
          focusEntity: topic as string,
          maxLength,
          format: format as any,
          includeEmotionalDimensions: true
        };
        
        const narrative = narrativeGenerator.generateNarrative(topicGraph, narrativeOptions);
        
        return { 
          content: [{ type: "text", text: narrative }]
        };
      } catch (error) {
        console.error(`Error in generate_narrative tool: ${error}`);
        return { 
          content: [{ type: "text", text: JSON.stringify({
            error: `Error generating narrative: ${error.message || error}`,
            topic: args.topic,
            length: args.length,
            style: args.style
          }, null, 2) }]
        };
      }
            
    case "create_thought":
      console.error(`Creating thought with title: ${args.title}, content: ${args.thoughtContent}`);
      
      result = await nodeCreator.createThought(args as { 
        entityName?: string; 
        title: string;
        thoughtContent: string;
        entities?: string[];
        concepts?: string[];
        events?: string[];
        scientificInsights?: string[];
        laws?: string[];
        thoughts?: string[];
      });
      return { 
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
            
    case "get_temporal_sequence":
      try {
        const { nodeName, direction, maxEvents } = args;
        console.error(`Getting temporal sequence for: ${nodeName}, direction: ${direction || 'both'}, maxEvents: ${maxEvents || 10}`);
        
        // Call the getTemporalSequence method
        result = await nodeRetriever.getTemporalSequence(
          nodeName as string,
          direction as 'forward' | 'backward' | 'both' || 'both',
          maxEvents as number || 10
        );
        
        return { 
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      } catch (error) {
        console.error(`Error in get_temporal_sequence tool: ${error}`);
        return { 
          content: [{ type: "text", text: JSON.stringify({
            error: `Error getting temporal sequence: ${error.message || error}`,
            nodeName: args.nodeName
          }, null, 2) }]
        };
      }
            
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Knowledge Graph Memory using Neo4j running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});