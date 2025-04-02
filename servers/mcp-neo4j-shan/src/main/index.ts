import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { driver as connectToNeo4j, auth as Neo4jAuth } from 'neo4j-driver';

import { Neo4jCreator } from '../node-creator/index.js';
import { Neo4jRetriever } from '../node-retriever/index.js';
import { setupTools } from './tools.js';
import { SYSTEM_PROMPT, TOOL_PROMPTS } from './prompts.js';

/**
 * Main function to initialize and start the server
 */
export async function main() {
  console.error('Starting mcp-neo4j-shan server...');
  
  // Initialize Neo4j connection
  const neo4jDriver = connectToNeo4j(
    'neo4j+s://c37b3de9.databases.neo4j.io',
    Neo4jAuth.basic('neo4j', 'lljC9tKYmLwquSKOvLPv3Qaw0QBxOTccviBkUIGqRR0')
  )
  
  console.error('Connected to Neo4j database');
  
  // Create instances for node creation and retrieval
  const nodeCreator = new Neo4jCreator(neo4jDriver);
  const nodeRetriever = new Neo4jRetriever(neo4jDriver);
  
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
  setupTools(server, nodeCreator, nodeRetriever);
  
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
