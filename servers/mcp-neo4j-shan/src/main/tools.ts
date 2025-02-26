import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Neo4jCreator } from "../node-creator/index.js";
import { Neo4jRetriever } from "../node-retriever/index.js";
import { NarrativeGenerator } from "../narrative-generator/index.js";
import { Entity, Relation } from "../types/index.js";

/**
 * Sets up all tools for the server
 * @param server - Server instance
 * @param nodeCreator - Node creator instance
 * @param nodeRetriever - Node retriever instance
 * @param narrativeGenerator - Narrative generator instance (kept for backward compatibility)
 */
export function setupTools(
  server: Server,
  nodeCreator: Neo4jCreator,
  nodeRetriever: Neo4jRetriever,
  narrativeGenerator: NarrativeGenerator
): void {
  console.error('Setting up knowledge graph tools');
  
  // Define all tools to be registered
  const tools = [
    {
      name: "explore_weighted_context",
      description: "Explore the context around a node with weighted relationships, prioritizing the most important cognitive connections first",
      inputSchema: {
        type: "object",
        properties: {
          nodeName: {
            type: "string",
            description: "Name of the node to explore"
          },
          maxDepth: {
            type: "number",
            description: "Maximum depth to explore (default: 2)"
          },
          minWeight: {
            type: "number",
            description: "Minimum weight of relationships to include (default: 0.0)"
          }
        },
        required: ["nodeName"]
      }
    },
    {
      name: "create_nodes",
      description: "Create multiple nodes of various types in the knowledge graph",
      inputSchema: {
        type: "object",
        properties: {
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Unique name for the node" },
                entityType: { type: "string", enum: ["Entity", "Event", "Concept", "ScientificInsight", "Law", "Thought", "ReasoningChain", "ReasoningStep"] }
                // Additional properties would be defined here, keeping it minimal for readability
              },
              required: ["name", "entityType"]
            }
          }
        },
        required: ["nodes"]
      }
    },
    {
      name: "create_relations",
      description: "Create relationships between nodes in the knowledge graph",
      inputSchema: {
        type: "object",
        properties: {
          relations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string", description: "Name of the source node" },
                to: { type: "string", description: "Name of the target node" },
                relationType: { type: "string", description: "Type of relationship" }
                // Additional properties would be defined here
              },
              required: ["from", "to", "relationType"]
            }
          }
        },
        required: ["relations"]
      }
    },
    {
      name: "get_temporal_sequence",
      description: "Get a temporal sequence of events from a starting node",
      inputSchema: {
        type: "object",
        properties: {
          startNodeName: { type: "string", description: "Name of the starting node" },
          direction: { type: "string", enum: ["forward", "backward", "both"] },
          maxEvents: { type: "number", description: "Maximum number of events to retrieve" }
        },
        required: ["startNodeName"]
      }
    },
    {
      name: "create_reasoning_chain",
      description: "Create a reasoning chain with connected steps",
      inputSchema: {
        type: "object",
        properties: {
          chainName: { type: "string", description: "Name of the reasoning chain" },
          description: { type: "string", description: "Description of the reasoning chain" },
          conclusion: { type: "string", description: "Final conclusion of the reasoning" },
          confidenceScore: { type: "number", description: "Overall confidence score (0.0-1.0)" },
          steps: { type: "array", items: { type: "object" } }
          // Additional properties would be defined here
        },
        required: ["chainName", "description", "conclusion", "confidenceScore", "steps"]
      }
    },
    {
      name: "get_reasoning_chain",
      description: "Get a reasoning chain and its steps",
      inputSchema: {
        type: "object",
        properties: {
          chainName: { type: "string", description: "Name of the reasoning chain" }
        },
        required: ["chainName"]
      }
    }
  ];

  // Register the tool list
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Register the tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error(`No arguments provided for tool: ${name}`);
    }

    let result;
    
    switch (name) {
      case "explore_weighted_context":
        try {
          const nodeName = args.nodeName as string;
          const maxDepth = args.maxDepth as number || 2;
          const minWeight = args.minWeight as number || 0.0;
          
          const graph = await nodeRetriever.exploreContextWeighted(nodeName, maxDepth, minWeight);
          
          // Return raw graph data instead of using narrative generator
          result = JSON.stringify(graph, null, 2);
        } catch (error) {
          result = `Error exploring weighted context: ${error.message}`;
        }
        break;

      case "explore_context":
        try {
          const nodeName = args.nodeName as string;
          const maxDepth = args.maxDepth as number || 2;
          
          const graph = await nodeRetriever.exploreContext(nodeName, maxDepth);
          
          // Return raw graph data instead of using narrative generator
          result = JSON.stringify(graph, null, 2);
        } catch (error) {
          result = `Error exploring context: ${error.message}`;
        }
        break;

      case "search_nodes":
        try {
          const query = args.query as string;
          const graph = await nodeRetriever.searchNodes(query);
          
          // Return raw graph data instead of using narrative generator
          result = JSON.stringify(graph, null, 2);
        } catch (error) {
          result = `Error searching nodes: ${error.message}`;
        }
        break;

      case "create_nodes":
        try {
          result = await nodeCreator.createEntities(args.nodes as Entity[]);
        } catch (error) {
          result = `Error creating nodes: ${error.message}`;
        }
        break;

      case "create_relations":
        try {
          result = await nodeCreator.createRelations(args.relations as Relation[]);
        } catch (error) {
          result = `Error creating relations: ${error.message}`;
        }
        break;

      case "get_temporal_sequence":
        try {
          const startNodeName = args.startNodeName as string;
          const direction = (args.direction || "both") as 'forward' | 'backward' | 'both';
          const maxEvents = args.maxEvents as number || 10;
          
          result = await nodeRetriever.getTemporalSequence(startNodeName, direction, maxEvents);
        } catch (error) {
          result = `Error getting temporal sequence: ${error.message}`;
        }
        break;

      case "create_reasoning_chain":
        try {
          const steps = args.steps as any[];
          
          // Map chain data with proper types
          const chainData = {
            name: args.chainName as string,
            description: args.description as string,
            conclusion: args.conclusion as string,
            confidenceScore: args.confidenceScore as number,
            sourceThought: args.sourceThought as string,
            creator: "System", // Default creator
            methodology: (args.methodology || "mixed") as 'deductive' | 'inductive' | 'abductive' | 'analogical' | 'mixed',
            domain: args.domain as string,
            tags: args.tags as string[],
            alternativeConclusionsConsidered: args.alternativeConclusionsConsidered as string[]
          };
          
          const chain = await nodeCreator.createReasoningChain(chainData);
          const createdSteps = [];
          if (steps && steps.length > 0) {
            for (const step of steps) {
              const stepWithChain = {
                ...step,
                chainName: chain.name
              };
              const createdStep = await nodeCreator.createReasoningStep(stepWithChain);
              createdSteps.push(createdStep);
            }
          }
          result = {
            success: true,
            message: `Created reasoning chain "${chain.name}" with ${createdSteps.length} steps`,
            chainName: chain.name,
            steps: createdSteps.length
          };
        } catch (error) {
          result = `Error creating reasoning chain: ${error.message}`;
        }
        break;

      case "get_reasoning_chain":
        try {
          const chainName = args.chainName as string;
          const chainResult = await nodeRetriever.getReasoningChain(chainName);
          result = {
            chain: chainResult.chain,
            steps: chainResult.steps
          };
        } catch (error) {
          result = `Error retrieving reasoning chain: ${error.message}`;
        }
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    // Return the result as a text content
    return { 
      content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }]
    };
  });

  console.error('All tools have been registered successfully');
} 