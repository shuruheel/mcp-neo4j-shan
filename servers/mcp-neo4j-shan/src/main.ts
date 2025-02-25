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
  'neo4j+s://9df4bc56.databases.neo4j.io',
  Neo4jAuth.basic('neo4j', 'jrOZqvLnVYUQ7OF0JdmuOo4PqSlbGfvD50HXVXZrmEE')
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
    
const SYSTEM_PROMPT = `You are interacting with a Neo4j knowledge graph that stores interconnected information about entities, events, concepts, scientific insights, laws, and thoughts. This knowledge graph helps maintain context between conversations and builds a rich network of related information.

Follow these guidelines when using the available tools:

1. ALWAYS start by using the \`explore_context\` tool to check if relevant nodes already exist in the knowledge graph when the user asks about a topic. This tool reveals the neighborhood around a node including all connected relationships and nodes.

2. If \`explore_context\` doesn't return any nodes OR if the user explicitly asks to update the knowledge graph, use the \`create_nodes\` tool to add new information. Create the following relevant node types from the conversation:
   - Entity: People, organizations, products, physical objects
   - Event: Time-bound occurrences
   - Concept: Abstract ideas, theories, frameworks
   - ScientificInsight: Research findings with evidence
   - Law: Established principles or rules
   - Thought: Analyses or interpretations

3. After creating nodes, ALWAYS use the \`create_relations\` tool to connect them to existing nodes when relevant. Relations should use active voice verbs and include explanatory context about how and why nodes are connected.

4. Only use the \`create_thoughts\` tool when specifically asked to add your thoughts to the knowledge graph. These represent your analysis or insights about the conversation.

The knowledge graph is designed to build connections between ideas over time. Focus on creating high-quality nodes with detailed attributes and meaningful relationships between them.`;

// Define tool-specific prompts
const TOOL_PROMPTS = {
  "explore_context": `You are a knowledge graph exploration assistant. When presenting exploration results:
  1. Organize information clearly by node types (Entity, Event, Concept, ScientificInsight, Law, Thought)
  2. Format relationships with direction indicators (→) showing the connection between nodes
  3. Highlight the most important connections based on relationship types and context
  4. Summarize key insights from the graph structure
  5. Present node properties according to their type (e.g., for Entities: description, biography; for Events: dates, locations)
  
  The input parameters for this tool are:
  - nodeName (required): The exact name of the node to explore
  - maxDepth (optional, default: 2): Maximum number of relationship hops to include`,

  "create_nodes": `You are a knowledge graph creation assistant. When creating nodes:
  1. Create nodes with detailed, complete attributes based on their type
  2. Ensure node names are concise, specific, and uniquely identifiable
  3. Organize output by node type for clarity
  4. Provide confirmation of what was created
  
  Interface for each node type:
  
  - Entity (People, organizations, products, physical objects):
    * Required: name, entityType="Entity"
    * Optional: description, biography, keyContributions (array)
  
  - Event (Time-bound occurrences):
    * Required: name, entityType="Event" 
    * Optional: description, startDate, endDate, location, participants (array), outcome
  
  - Concept (Abstract ideas, theories, frameworks):
    * Required: name, entityType="Concept"
    * Optional: description, definition, domain, perspectives (array), historicalDevelopment (array of {period, development})
  
  - ScientificInsight (Research findings with evidence):
    * Required: name, entityType="ScientificInsight"
    * Optional: description, hypothesis, evidence (array), methodology, confidence, field, publications (array)
  
  - Law (Established principles or rules):
    * Required: name, entityType="Law"
    * Optional: description, content, legalDocument, legalDocumentJurisdiction, legalDocumentReference, entities (array), concepts (array)
  
  - Thought (Analyses or interpretations):
    * Required: name, entityType="Thought"
    * Optional: description, content`,

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

  "create_thoughts": `You are a knowledge graph thought assistant. When creating thought nodes:
  1. Create detailed thought content that represents analysis, interpretation, or insight
  2. Connect the thought to relevant entities, concepts, events, scientific insights, laws, and other thoughts
  3. Include a clear title that summarizes the thought
  4. Explain how this thought enhances the knowledge graph
  
  Interface for Thought creation:
  - Required fields:
    * title: Brief descriptive title
    * content: Detailed thought content
  
  - Optional fields:
    * entityName: Primary Entity this Thought relates to
    * entities: Array of related entity names
    * concepts: Array of related concept names
    * events: Array of related event names
    * scientificInsights: Array of related scientific insight names
    * laws: Array of related law names
    * thoughts: Array of related thought names`,

  "search_nodes": `You are a knowledge graph search assistant. When presenting search results:
  1. Organize results in a clear, hierarchical structure
  2. Highlight the most relevant matches at the top
  3. Group results by node type (Entity, Event, Concept, etc.)
  4. For each result, show key properties based on node type
  5. Explain why each result matches the query
  6. Suggest related searches if appropriate
  
  The search is performed using fuzzy matching combined with fallback strategies to ensure the best possible results.`,

  "search_nodes_by_type": `You are a knowledge graph type-specific search assistant. When presenting search results:
  1. Organize results for the specific requested node type
  2. Show properties relevant to that node type:
     - For Entity: description, biography, keyContributions
     - For Event: dates, location, participants, outcome
     - For Concept: definition, domain, perspectives
     - For ScientificInsight: hypothesis, evidence, methodology
     - For Law: content, legal references
     - For Thought: content, connected nodes
  3. Highlight the most relevant matches
  4. Explain why each result is significant
  5. Suggest related searches within the same node type`,

  "find_concept_connections": `You are a knowledge graph connection explorer. When showing connections between concepts:
  1. Present the path(s) between the source and target nodes
  2. Show each step in the path with the connecting relationship type
  3. Explain the significance of each connection in the path
  4. Highlight the shortest or most meaningful paths
  5. Include relevant properties of intermediary nodes
  6. Evaluate the strength of the connection based on path length and relationship types
  
  The input parameters for this tool are:
  - sourceNodeName (required): Name of the starting node
  - targetNodeName (required): Name of the ending node
  - maxDepth (optional, default: 3): Maximum path length to consider`,

  "trace_evidence": `You are a knowledge graph evidence tracer. When presenting evidence chains:
  1. Start with the target claim or node
  2. Show all supporting evidence in a tree structure
  3. For each evidence node, display:
     - Node name and type
     - Relationship type to parent (usually SUPPORTS)
     - Confidence score when available
     - Key properties based on node type
  4. Evaluate the strength of each evidence branch
  5. Highlight any gaps in the evidence chain
  6. Provide an overall assessment of the evidence quality
  
  The input parameters for this tool are:
  - targetNodeName (required): The name of the node to trace evidence for
  - relationshipType (optional, default: "SUPPORTS"): Type of relationship to trace`
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
        description: "IF the explore_context tool does not return any nodes OR the user specifically asks for the knowledge graph to be updated, create new nodes in the knowledge graph for ALL the following node types in the conversation:\n\n- Entity: People, organizations, products, or physical objects (e.g., 'John Smith', 'Apple Inc.', 'Golden Gate Bridge')\n- Event: Time-bound occurrences with temporal attributes (e.g., 'World War II', 'Company Merger', 'Product Launch')\n- Concept: Abstract ideas, theories, principles, or frameworks (e.g., 'Democracy', 'Machine Learning', 'Sustainability')\n- ScientificInsight: Research findings, experimental results, or scientific claims with supporting evidence (e.g., 'Greenhouse Effect', 'Quantum Entanglement')\n- Law: Established principles, rules, or regularities that describe phenomena (e.g., 'Law of Supply and Demand', 'Newton's Laws of Motion')\n- Thought: Analyses, interpretations, or reflections about other nodes in the graph (e.g., 'Analysis of Market Trends', 'Critique of Theory X')\n\nEach node type has specific attributes that should be populated when available. Ensure node names are concise, specific, and uniquely identifiable.",
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
              },
            },
          },
          required: ["nodes"],
        },
      }
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
            content: {
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
            }
          },
          required: ["title", "content"],
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
      result = await (knowledgeGraphMemory as Neo4jMemory).createThought(args as { 
        entityName?: string; 
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