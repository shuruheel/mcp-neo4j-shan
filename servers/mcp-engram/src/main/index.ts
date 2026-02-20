import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { GetPromptRequestSchema } from '@modelcontextprotocol/sdk/types.js';

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

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const promptName = request.params.name || 'system';
    const promptContent = TOOL_PROMPTS[promptName] || SYSTEM_PROMPT;
    return {
      messages: [
        { role: 'system', content: { type: 'text', text: promptContent } },
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
