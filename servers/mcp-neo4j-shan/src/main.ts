import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { driver as connectToNeo4j, auth as Neo4jAuth } from 'neo4j-driver'
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import { KnowledgeGraphMemory, Entity, KnowledgeGraph, Relation } from "@neo4j/graphrag-memory";
import { Neo4jMemory } from './neo4j-memory.js'

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// const args = process.argv.slice(2);

const neo4jDriver = connectToNeo4j(
  process.env.NEO4J_URI || 'neo4j+s://x.databases.neo4j.io',
  Neo4jAuth.basic(
    process.env.NEO4J_USER || 'neo4j', 
    process.env.NEO4J_PASSWORD || 'pwd'
  )
)

const knowledgeGraphMemory:KnowledgeGraphMemory = new Neo4jMemory(neo4jDriver);

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
        name: "create_entities",
        description: "Create multiple new nodes in the knowledge graph. When analyzing conversations, identify and create nodes of these types:\n\n- Entity: People, organizations, products, or physical objects (e.g., 'John Smith', 'Apple Inc.', 'Golden Gate Bridge')\n- Event: Time-bound occurrences with temporal attributes (e.g., 'World War II', 'Company Merger', 'Product Launch')\n- Concept: Abstract ideas, theories, principles, or frameworks (e.g., 'Democracy', 'Machine Learning', 'Sustainability')\n- ScientificInsight: Research findings, experimental results, or scientific claims with supporting evidence (e.g., 'Greenhouse Effect', 'Quantum Entanglement')\n- Law: Established principles, rules, or regularities that describe phenomena (e.g., 'Law of Supply and Demand', 'Newton's Laws of Motion')\n- Thought: Analyses, interpretations, or reflections about other nodes in the graph (e.g., 'Analysis of Market Trends', 'Critique of Theory X')\n\nEach node type has specific attributes that should be populated when available. Ensure node names are concise, specific, and uniquely identifiable.",
        inputSchema: {
          type: "object",
          properties: {
            entities: {
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
                  observations: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "An array of observation contents for each Node Type"
                  },
                  // Event specific fields
                  startDate: { type: "string", description: "Start date of the event (YYYY-MM-DD or descriptive)" },
                  endDate: { type: "string", description: "End date of the event (YYYY-MM-DD or descriptive)" },
                  location: { type: "string", description: "Location of the event" },
                  participants: { 
                    type: "array", 
                    items: { type: "string" },
                    description: "Entities that participated in the event"
                  },
                  outcome: { type: "string", description: "Outcome of the event" },
                  // Concept specific fields
                  definition: { type: "string", description: "A brief definition of the concept" },
                  examples: {
                    type: "array",
                    items: { type: "string" },
                    description: "Examples for Concept type"
                  },
                  domain: { type: "string", description: "Domain of the Node Type (if any)" },
                  // Scientific Insight specific fields
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
                  // Law specific fields
                  statement: { type: "string", description: "Statement for Law type" },
                  conditions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Conditions for Law type"
                  },
                  exceptions: {
                    type: "array",
                    items: { type: "string" },
                    description: "Exceptions for Law type"
                  },
                  proofs: {
                    type: "array",
                    items: { type: "string" },
                    description: "Proofs for Law type"
                  },
                  // Thought specific fields
                  content: { type: "string", description: "Summarize the thought in a concise manner" },
                  references: {
                    type: "array",
                    items: { type: "string" },
                    description: "List the entities, concepts, events, or scientific insights that are referenced in the thought"
                  },
                  createdBy: { type: "string", description: "Creator for Thought type" },
                  tags: {
                    type: "array",
                    items: { type: "string" },
                    description: "Classification tags for Thought type"
                  },
                  impact: { type: "string", description: "Potential impact for Thought type" }
                },
                required: ["name", "entityType"],
              },
            },
          },
          required: ["entities"],
        },
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
                  to: { type: "string", description: "The name of the node where the relation ends" },
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
        description: "Search for nodes in the knowledge graph based on a query",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The search query to match against entity names, types, and observation content" },
          },
          required: ["query"],
        },
      },
      {
        name: "find_by_type",
        description: "Find nodes of a specific type in the knowledge graph (Entity, Event, Concept, ScientificInsight, Law, or Thought)",
        inputSchema: {
          type: "object",
          properties: {
            nodeType: {
              type: "string",
              description: "The type of nodes to find",
              enum: ["Entity", "Event", "Concept", "ScientificInsight", "Law", "Thought"]
            },
          },
          required: ["nodeType"],
        },
      },
      {
        name: "create_thought",
        description: "Create a Thought node representing an analysis, interpretation, or insight about entities in the knowledge graph. Use this tool to document your reasoning, connect ideas across different nodes, or capture important observations that should be preserved. Thoughts should be linked to relevant entities and can reference other nodes to build a network of connected insights. Each thought should have clear content and, when possible, include confidence level, references to supporting nodes, and relevant tags for future retrieval.",
        inputSchema: {
          type: "object",
          properties: {
            entityName: {
              type: "string",
              description: "The name of the Entity that the Thought is related to"
            },
            title: {
              type: "string",
              description: "Brief title for the thought"
            },
            content: {
              type: "string", 
              description: "Articulate the thought in the best way possible"
            },
            references: {
              type: "array",
              items: { type: "string" },
              description: "References to Entity, Concept, Event, ScientificInsight, Law, and other Thought nodes"
            },
            confidence: {
              type: "number",
              description: "Confidence score for the thought (0-1)"
            },
            source: {
              type: "string",
              description: "Source of the thought (document, person, etc.)"
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Classification tags for the thought (used for categorization)"
            },
            impact: {
              type: "string",
              description: "Potential impact or importance of the thought"
            },
          },
          required: ["entityName", "content"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    throw new Error(`No arguments provided for tool: ${name}`);
  }

  switch (name) {
    case "create_entities":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphMemory.createEntities(args.entities as Entity[]), null, 2) }] };
    case "create_relations":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphMemory.createRelations(args.relations as Relation[]), null, 2) }] };
    case "add_observations":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphMemory.addObservations(args.observations as { entityName: string; contents: string[] }[]), null, 2) }] };
    case "delete_entities":
      await knowledgeGraphMemory.deleteEntities(args.entityNames as string[]);
      return { content: [{ type: "text", text: "Entities deleted successfully" }] };
    case "delete_observations":
      await knowledgeGraphMemory.deleteObservations(args.deletions as { entityName: string; observations: string[] }[]);
      return { content: [{ type: "text", text: "Observations deleted successfully" }] };
    case "delete_relations":
      await knowledgeGraphMemory.deleteRelations(args.relations as Relation[]);
      return { content: [{ type: "text", text: "Relations deleted successfully" }] };
    case "read_graph":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphMemory.readGraph(), null, 2) }] };
    case "search_nodes":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphMemory.searchNodes(args.query as string), null, 2) }] };
    case "open_nodes":
      return { content: [{ type: "text", text: JSON.stringify(await knowledgeGraphMemory.openNodes(args.names as string[]), null, 2) }] };
    case "find_by_type":
      return { content: [{ type: "text", text: JSON.stringify(await (knowledgeGraphMemory as Neo4jMemory).findNodesByType(args.nodeType as string), null, 2) }] };
    case "migrate_observations_to_thoughts":
      return { content: [{ type: "text", text: JSON.stringify(await (knowledgeGraphMemory as Neo4jMemory).migrateObservationsToThoughts(args.entityName as string), null, 2) }] };
    case "create_thought":
      return { content: [{ type: "text", text: JSON.stringify(await (knowledgeGraphMemory as Neo4jMemory).createThought(args as { 
        entityName: string; 
        content: string;
        title?: string;
        references?: string[];
        confidence?: number;
        source?: string;
        createdBy?: string;
        tags?: string[];
        impact?: string;
      }), null, 2) }] };
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