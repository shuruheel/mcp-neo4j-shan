import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import * as os from 'os';
import * as path from 'path';

import { SqliteBackend } from '../storage/index.js';
import { setupTools } from './tools.js';
import { SYSTEM_PROMPT, TOOL_PROMPTS } from './prompts.js';

function setupPrompts(server: McpServer): void {
  server.registerPrompt(
    'system',
    {
      description:
        'Workflow guidance for building and exploring the knowledge graph',
    },
    async () => ({
      messages: [
        { role: 'user', content: { type: 'text', text: SYSTEM_PROMPT } },
      ],
    })
  );

  for (const [name, text] of Object.entries(TOOL_PROMPTS)) {
    server.registerPrompt(
      name,
      { description: `Usage guidance for the ${name} tool` },
      async () => ({
        messages: [{ role: 'user', content: { type: 'text', text } }],
      })
    );
  }
}

export async function main() {
  console.error('Starting mcp-engram server...');

  const dbPath =
    process.env.MCP_ENGRAM_DB_PATH ??
    path.join(os.homedir(), '.mcp-engram', 'knowledge.db');

  const storage = new SqliteBackend(dbPath);
  storage.initialize();
  console.error(`Database opened at ${dbPath}`);

  const server = new McpServer({ name: 'mcp-engram', version: '2.0.0' });

  setupTools(server, storage);
  setupPrompts(server);

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
