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
import { Neo4jMemory } from './neo4j-memory.js'

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// const args = process.argv.slice(2);

const neo4jDriver = connectToNeo4j(
  'neo4j+s://x.databases.neo4j.io',
  Neo4jAuth.basic('neo4j', 'pwd')
)

const knowledgeGraphMemory:Neo4jMemory = new Neo4jMemory(neo4jDriver);

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
1. ALWAYS start by using the \`explore_context\` tool to check if relevant nodes already exist in the knowledge graph when the user asks about a topic. This tool reveals the neighborhood around a node including all connected relationships and nodes, providing rich contextual information.

2. If \`explore_context\` doesn't return any nodes OR if the user explicitly asks to update the knowledge graph, use the \`create_nodes\` tool to add new information. Extract ALL relevant node types from the conversation:

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

4. Only use the \`create_thoughts\` tool when specifically asked to add your thoughts to the knowledge graph. These represent your analysis or insights about the conversation and should be connected to relevant nodes.

5. When helping users explore existing knowledge, use appropriate search and traversal tools:
   - \`search_nodes\` for general searches across all node types
   - \`search_nodes_by_type\` for targeted searches within a specific node type
   - \`find_concept_connections\` to discover paths between nodes
   - \`trace_evidence\` to examine the evidence supporting a claim

QUALITY GUIDELINES:
- Create concise, specific, and uniquely identifiable node names
- Provide comprehensive attributes for each node type
- Construct meaningful relationships that clearly show how nodes are connected
- Build a coherent network structure that captures the semantic richness of information
- Focus on creating high-quality nodes with detailed attributes and meaningful relationships

The knowledge graph is designed to build connections between ideas over time. Your role is to help users interact with this knowledge structure effectively, extracting insights and adding new information in a structured, meaningful way.`;

// Define tool-specific prompts
const TOOL_PROMPTS = {
  "explore_context": `You are a knowledge graph exploration assistant with cognitive neuroscience capabilities. When presenting exploration results:
  1. Organize information clearly by node types (Entity, Event, Concept, ScientificInsight, Law, Thought)
  2. Format relationships with direction indicators (→) showing the connection between nodes
  3. Highlight the most important connections based on relationship types and context
  4. Summarize key insights from the graph structure
  5. Present node properties according to their type (e.g., for Entities: description, biography; for Events: dates, locations)
  6. Emphasize cognitive dimensions when available:
     - Emotional valence and arousal ratings across all node types
     - Causal relationships for Events (predecessors/successors)
     - Abstraction level and metaphorical mappings for Concepts
     - Evidence strength and surprise value for ScientificInsights
     - Domain constraints and counterexamples for Laws
     - Evidential basis and implication chains for Thoughts
  
  The input parameters for this tool are:
  - nodeName (required): The exact name of the node to explore
  - maxDepth (optional, default: 2): Maximum number of relationship hops to include
  
  When cognitive dimensions are present, analyze their implications for the node's significance, memorability, and contextual importance. Explain how these dimensions enhance understanding of the node and its connections.`,

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
  
  Required fields for each relation:
  - from: The name of the source node
  - to: The name of the target node  
  - relationType: An active voice verb describing the relationship (e.g., ADVOCATES, PARTICIPATED_IN, RELATES_TO)
  
  Optional but highly recommended fields:
  - context: Explanation of how and why these nodes are related (30-50 words)
  - confidenceScore: Number between 0.0-1.0
  - sources: Array of citation sources
  
  Example relation types between different node types:
  - Entity → Concept: ADVOCATES, SUPPORTS, UNDERSTANDS
  - Entity → Event: PARTICIPATED_IN, ORGANIZED, WITNESSED
  - Concept → Concept: RELATES_TO, BUILDS_UPON, CONTRADICTS
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
        name: "explore_context",
        description: "Whenever the user shows interest in exploring a topic, use this tool FIRST to explore the complete context around relevant Entity, Event, Concept, Scientific Insight, or Law nodes in the knowledge graph. This tool reveals the neighborhood of relationships and connected nodes surrounding the specified node, providing deeper contextual understanding with enhanced information:\n\n- For Entity nodes: Includes biographical information and key contributions when available\n- For Concept nodes: Includes definitions, examples, and multiple perspectives on the concept\n- For relationships: Includes explanatory context about how and why nodes are related\n\nUse this tool for all node types extracted from the user's query to build a comprehensive picture with rich contextual details.",
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
        description: "IF the explore_context tool does not return any nodes OR the user specifically asks for the knowledge graph to be updated, create new nodes in the knowledge graph for ALL the following node types in the conversation:\n\n- Entity: People, organizations, products, or physical objects (e.g., 'John Smith', 'Apple Inc.', 'Golden Gate Bridge')\n- Event: Time-bound occurrences with temporal attributes (e.g., 'World War II', 'Company Merger', 'Product Launch')\n- Concept: Abstract ideas, theories, principles, or frameworks (e.g., 'Democracy', 'Machine Learning', 'Sustainability')\n- ScientificInsight: Research findings, experimental results, or scientific claims with supporting evidence (e.g., 'Greenhouse Effect', 'Quantum Entanglement')\n- Law: Established principles, rules, or regularities that describe phenomena (e.g., 'Law of Supply and Demand', 'Newton's Laws of Motion')\n- Thought: Analyses, interpretations, or reflections about other nodes in the graph (e.g., 'Analysis of Market Trends', 'Critique of Theory X')\n\nEach node type has specific cognitive attributes that should be populated when available. Ensure node names are concise, specific, and uniquely identifiable.",
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
                  sources: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Citation sources supporting this relationship" 
                  },
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
      result = await knowledgeGraphMemory.createEntities(args.nodes as Entity[]);
      return { 
        content: [
          {
            role: "system",
            content: {
              type: "text",
              text: toolPrompt
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          }
        ] 
      };
      
    case "create_relations":
      result = await knowledgeGraphMemory.createRelations(args.relations as Relation[]);
      return { 
        content: [
          {
            role: "system",
            content: {
              type: "text",
              text: toolPrompt
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          }
        ] 
      };
      
    case "search_nodes":
      // Parse the query to extract different types of entities
      const searchQuery = args.query as string;
      
      // Use the robust search method that combines fuzzy matching with fallbacks
      result = await (knowledgeGraphMemory as Neo4jMemory).robustSearch(searchQuery);
      return { 
        content: [
          {
            role: "system",
            content: {
              type: "text",
              text: toolPrompt
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          }
        ] 
      };
      
    case "search_nodes_by_type":
      result = await (knowledgeGraphMemory as Neo4jMemory).findNodesByType(args.nodeType as string, args.query as string);
      return { 
        content: [
          {
            role: "system",
            content: {
              type: "text",
              text: toolPrompt
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          }
        ] 
      };
      
    case "create_thoughts":
      // Map content to thoughtContent for backward compatibility
      if (args.content && !args.thoughtContent) {
        args.thoughtContent = args.content;
      }
      
      result = await (knowledgeGraphMemory as Neo4jMemory).createThought(args as { 
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
        content: [
          {
            role: "system",
            content: {
              type: "text",
              text: toolPrompt
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          }
        ] 
      };
      
    // New handlers for traversal tools
    case "find_concept_connections":
      result = await (knowledgeGraphMemory as Neo4jMemory).findConceptConnections(
        args.sourceNodeName as string,
        args.targetNodeName as string,
        args.maxDepth as number || 3
      );
      return { 
        content: [
          {
            role: "system",
            content: {
              type: "text",
              text: toolPrompt
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          }
        ] 
      };
      
    case "explore_context":
      result = await (knowledgeGraphMemory as Neo4jMemory).exploreContext(
        args.nodeName as string,
        args.maxDepth as number || 2
      );
      
      // Ensure result is not undefined
      if (!result) {
        result = { entities: [], relations: [] };
      }
      
      return { 
        content: [
          {
            role: "system",
            content: {
              type: "text",
              text: toolPrompt || SYSTEM_PROMPT
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          }
        ] 
      };
      
    case "trace_evidence":
      result = await (knowledgeGraphMemory as Neo4jMemory).traceEvidence(
        args.targetNodeName as string,
        args.relationshipType as string || "SUPPORTS"
      );
      return { 
        content: [
          {
            role: "system",
            content: {
              type: "text",
              text: toolPrompt
            }
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          }
        ] 
      };
      
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