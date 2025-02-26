import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { driver as connectToNeo4j, auth as Neo4jAuth } from 'neo4j-driver';
import path from 'path';
import { fileURLToPath } from 'url';

import { Neo4jCreator } from '../node-creator/index.js';
import { Neo4jRetriever } from '../node-retriever/index.js';
import { NarrativeGenerator } from '../narrative-generator/index.js';
import { setupTools } from './tools.js';
import { SYSTEM_PROMPT, TOOL_PROMPTS } from './prompts.js';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Main function to initialize and start the server
 */
async function main() {
  console.error('Starting mcp-neo4j-shan server...');
  
  // Initialize Neo4j connection
  const neo4jDriver = connectToNeo4j(
    'neo4j+s://x.databases.neo4j.io',
    Neo4jAuth.basic('neo4j', 'pwd')
  );
  
  console.error('Connected to Neo4j database');
  
  // Create instances for node creation and retrieval
  const nodeCreator = new Neo4jCreator(neo4jDriver);
  const nodeRetriever = new Neo4jRetriever(neo4jDriver);
  const narrativeGenerator = new NarrativeGenerator();
  
  // Create the server instance
  const server = new Server(
    {
      name: "mcp-neo4j-shan",
      version: "1.0.1",
    },
    {
      capabilities: {
        tools: {},
        prompts: {}
      },
    }
  );
  
  // Set up tools
  setupTools(server, nodeCreator, nodeRetriever, narrativeGenerator);
  
  // Add system prompt
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptName = request.params.name || "system";
    const promptContent = TOOL_PROMPTS[promptName] || SYSTEM_PROMPT;
    
    return { 
      messages: [
        {
          role: "system",
          content: {
            type: "text",
            text: promptContent
          }
        }
      ]
    };
  });
  
  // Create transport
  const transport = new StdioServerTransport();
  
  // Start server
  console.error("Starting server...");
  await server.connect(transport);
  console.error("Server started!");
}

// Run the main function
main().catch((error) => {
  console.error("Error in main:", error);
  process.exit(1);
}); 