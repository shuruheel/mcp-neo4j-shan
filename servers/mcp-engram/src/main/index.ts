import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import * as os from 'os';
import * as path from 'path';

import { SqliteBackend } from '../storage/index.js';
import { setupTools } from './tools.js';
import { SYSTEM_PROMPT, TOOL_PROMPTS } from './prompts.js';

export async function main() {
  console.error('Starting mcp-engram server...');

  const dbPath =
    process.env.MCP_ENGRAM_DB_PATH ??
    path.join(os.homedir(), '.mcp-engram', 'knowledge.db');

  const storage = new SqliteBackend(dbPath);
  storage.initialize();
  console.error(`Database opened at ${dbPath}`);

  const server = new Server(
    { name: 'mcp-engram', version: '2.0.0' },
    { capabilities: { tools: {}, prompts: {} } }
  );

  setupTools(server, storage);

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      {
        name: 'system',
        description:
          'Workflow guidance for building and exploring the knowledge graph',
      },
      ...Object.keys(TOOL_PROMPTS).map((name) => ({
        name,
        description: `Usage guidance for the ${name} tool`,
      })),
    ],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptName = request.params.name;
    const promptContent =
      promptName === 'system' ? SYSTEM_PROMPT : TOOL_PROMPTS[promptName];
    if (!promptContent) {
      throw new Error(`Unknown prompt: ${promptName}`);
    }
    return {
      messages: [
        { role: 'user', content: { type: 'text', text: promptContent } },
      ],
    };
  });

  process.on('SIGINT', () => {
    storage.close();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    storage.close();
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  console.error('Starting server...');
  await server.connect(transport);
  console.error('Server started!');
}

main().catch((error) => {
  console.error('Error in main:', error);
  process.exit(1);
});
