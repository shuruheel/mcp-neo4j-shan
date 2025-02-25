import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
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
    },
  },);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_nodes",
        description: "Create new nodes in the knowledge graph for ALL the following node types in the conversation:\n\n- Entity: People, organizations, products, or physical objects (e.g., 'John Smith', 'Apple Inc.', 'Golden Gate Bridge')\n- Event: Time-bound occurrences with temporal attributes (e.g., 'World War II', 'Company Merger', 'Product Launch')\n- Concept: Abstract ideas, theories, principles, or frameworks (e.g., 'Democracy', 'Machine Learning', 'Sustainability')\n- ScientificInsight: Research findings, experimental results, or scientific claims with supporting evidence (e.g., 'Greenhouse Effect', 'Quantum Entanglement')\n- Law: Established principles, rules, or regularities that describe phenomena (e.g., 'Law of Supply and Demand', 'Newton's Laws of Motion')\n- Thought: Analyses, interpretations, or reflections about other nodes in the graph (e.g., 'Analysis of Market Trends', 'Critique of Theory X')\n\nEach node type has specific attributes that should be populated when available. Ensure node names are concise, specific, and uniquely identifiable.",
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
                  definition: { type: "string", description: "A brief definition of the concept" },
                  examples: {
                    type: "array",
                    items: { type: "string" },
                    description: "Examples for Concept type"
                  },
                  domain: { type: "string", description: "Domain of the Node Type (if any)" },
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
        description: "Create multiple new relations between nodes in the knowledge graph. Relations should be semantically meaningful and use active voice. Example relations between different node types:\n- Entity -> Concept: ADVOCATES, SUPPORTS, UNDERSTANDS\n- Entity -> Event: PARTICIPATED_IN, ORGANIZED, WITNESSED\n- Concept -> Concept: RELATES_TO, BUILDS_UPON, CONTRADICTS\n- Event -> ScientificInsight: LED_TO, DISPROVED, REINFORCED\n- ScientificInsight -> Law: SUPPORTS, CHALLENGES, REFINES",
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
                },
                required: ["from", "to", "relationType"],
              },
            },
          },
          required: ["relations"],
        },
      },
      {
        name: "search_nodes",
        description: "Search for nodes in the knowledge graph based on entities, concepts, events, scientific insights, laws, or thoughts discussed in the conversation. The search uses fuzzy matching to find relevant nodes even with slight naming variations.",
        inputSchema: {
          type: "object",
          properties: {
            query: { 
              type: "string", 
              description: "The search query to match against node names and content" 
            },
            entityTypes: {
              type: "array",
              items: { 
                type: "string",
                enum: ["Entity", "Event", "Concept", "ScientificInsight", "Law", "Thought"]
              },
              description: "Optional: Specific node types to search (defaults to all types)"
            }
          },
          required: ["query"],
        },
      },
      {
        name: "create_thoughts",
        description: "Create Thought nodes representing an analysis, interpretation, or insight about the conversation. Use this tool to document your reasoning, connect ideas across different nodes, or capture important observations that should be preserved. Thoughts should be linked to relevant entities, concepts, events, scientific insights, laws, and other thoughts, building a network of connected insights. Each thought should have clear content and, when possible, include confidence level.",
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
      },
      // New traversal tools
      {
        name: "find_concept_connections",
        description: "Find how two nodes in the knowledge graph are connected through relationships. This tool discovers paths between nodes, revealing how concepts, entities, or other nodes relate to each other through direct or indirect connections. Especially useful for understanding how different ideas are linked.",
        inputSchema: {
          type: "object",
          properties: {
            sourceNodeName: { 
              type: "string", 
              description: "Name of the source node to start the path from" 
            },
            targetNodeName: { 
              type: "string", 
              description: "Name of the target node to find a path to" 
            },
            maxDepth: { 
              type: "number", 
              description: "Maximum number of relationship hops to consider (default: 3)",
              default: 3 
            }
          },
          required: ["sourceNodeName", "targetNodeName"],
        },
      },
      {
        name: "explore_context",
        description: "Explore the complete context around a node in the knowledge graph. This tool reveals the neighborhood of relationships and connected nodes surrounding the specified node, providing deeper contextual understanding. Useful for building a comprehensive picture of how a concept, entity, event, or thought relates to other knowledge.",
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
      }
    ],
}});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  switch (name) {
    case "create_nodes":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphMemory.createEntities(args.nodes as Entity[]), null, 2) }] };
    case "create_relations":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphMemory.createRelations(args.relations as Relation[]), null, 2) }] };
    case "search_nodes":
      // Parse the query to extract different types of entities
      // Here we're using the same pattern used in create_entities
      const searchQuery = args.query as string;
      
      // Use the robust search method that combines fuzzy matching with fallbacks
      return { 
        content: [{ 
          type: "text", 
          text: JSON.stringify(
            await (knowledgeGraphMemory as Neo4jMemory).robustSearch(searchQuery), 
            null, 
            2
          ) 
        }] 
      };
    case "search_nodes_by_type":
      return { content: [{ type: "text", text: JSON.stringify(await (knowledgeGraphMemory as Neo4jMemory).findNodesByType(args.nodeType as string, args.query as string), null, 2) }] };
    case "create_thoughts":
      return { content: [{ type: "text", text: JSON.stringify(await (knowledgeGraphMemory as Neo4jMemory).createThought(args as { 
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
      }), null, 2) }] };
    // New handlers for traversal tools
    case "find_concept_connections":
      return { content: [{ type: "text", text: JSON.stringify(await (knowledgeGraphMemory as Neo4jMemory).findConceptConnections(
        args.sourceNodeName as string,
        args.targetNodeName as string,
        args.maxDepth as number || 3
      ), null, 2) }] };
    case "explore_context":
      return { content: [{ type: "text", text: JSON.stringify(await (knowledgeGraphMemory as Neo4jMemory).exploreContext(
        args.nodeName as string,
        args.maxDepth as number || 2
      ), null, 2) }] };
    case "trace_evidence":
      return { content: [{ type: "text", text: JSON.stringify(await (knowledgeGraphMemory as Neo4jMemory).traceEvidence(
        args.targetNodeName as string,
        args.relationshipType as string || "SUPPORTS"
      ), null, 2) }] };
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