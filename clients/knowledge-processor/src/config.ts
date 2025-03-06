import dotenv from 'dotenv';
import { Config } from './types.js';
import path from 'path';
import fs from 'fs';

// Load environment variables from .env file
dotenv.config();

/**
 * Load configuration from environment variables
 * @returns Configuration object
 */
export function loadConfig(): Config {
  // Check if required environment variables are set
  const requiredVars = ['ANTHROPIC_API_KEY', 'MCP_SERVER_PATH'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  // Resolve the MCP server path
  const mcpServerPath = path.resolve(process.cwd(), process.env.MCP_SERVER_PATH!);
  
  // Check if the MCP server path exists
  if (!fs.existsSync(mcpServerPath)) {
    throw new Error(`MCP server not found at path: ${mcpServerPath}`);
  }

  return {
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    },
    mcp: {
      serverPath: mcpServerPath,
    },
    neo4j: process.env.NEO4J_URI ? {
      uri: process.env.NEO4J_URI,
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'password',
    } : undefined,
    processing: {
      chunkSize: parseInt(process.env.CHUNK_SIZE || '4000', 10),
      maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
      concurrency: parseInt(process.env.CONCURRENCY || '2', 10),
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
  };
} 