# MCP Engram — Cognitive Knowledge Graph

A Model Context Protocol (MCP) server for building and exploring a cognitive neuroscience-inspired knowledge graph. Models thought, emotion, reasoning, and episodic memory after the structure of the human mind. Backed by SQLite — zero infrastructure, single file on disk, works offline.

## Quick Start

```bash
npx mcp-engram
```

Or install globally:

```bash
npm install -g mcp-engram
mcp-engram
```

The server stores its database at `~/.mcp-engram/knowledge.db` by default. No external services required.

## Architecture

### How It Works

The MCP server exposes 8 tools that let an LLM build, search, and traverse a knowledge graph:

| Tool | Purpose |
|---|---|
| `search_nodes` | Full-text search across all nodes (FTS5) |
| `explore_context` | Weighted graph traversal around given nodes |
| `create_nodes` | Create or upsert nodes of any type |
| `create_relations` | Create edges with context, weight, and confidence |
| `add_sources` | Record provenance (Source nodes + DERIVED_FROM links) |
| `get_temporal_sequence` | Follow chronological chains (NEXT, BEFORE, CAUSES) |
| `create_reasoning_chain` | Build structured multi-step reasoning |
| `get_reasoning_chain` | Retrieve reasoning chains by name or topic |

### Node Types (15)

Entity, Event, Concept, Attribute, Proposition, Emotion, Agent, ScientificInsight, Law, Location, Thought, ReasoningChain, ReasoningStep, **Source**, **EmotionalEvent**

### Storage

- **SQLite** with WAL mode for concurrent reads
- **FTS5** virtual table for full-text search with BM25 ranking
- **Recursive CTEs** for graph traversal
- Single `nodes` table for all types, `edges` table with UNIQUE constraint, plus `aliases` and `observations` tables
- Complex objects stored as JSON in a `properties` column

## Installation

### From npm

```bash
npx mcp-engram
```

### From source

```bash
npm install
npx nx build mcp-engram
node dist/servers/mcp-engram/main.js
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MCP_ENGRAM_DB_PATH` | No | `~/.mcp-engram/knowledge.db` | Path to the SQLite database file |

## Integrating with Claude Desktop

Add the server to your Claude Desktop config:

1. Open your config file:
   - **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. Add the server configuration:

```json
{
  "mcpServers": {
    "mcp-engram": {
      "command": "npx",
      "args": ["mcp-engram"]
    }
  }
}
```

3. Restart Claude Desktop.

## Project Structure

```
servers/mcp-engram/          # MCP server (TypeScript, ESM)
  src/main/                  # Server bootstrap, tool handlers, prompts
  src/storage/               # SQLite backend, FTS, schema, validation
  src/types/                 # TypeScript interfaces and enums

libs/graphrag-memory/        # Shared type library (Entity, Relation, etc.)
```

## Development

```bash
# Build all projects
npx nx run-many -t build

# Test all projects
npx nx run-many -t test

# Lint
npx nx lint mcp-engram

# Build specific project
npx nx build mcp-engram
npx nx build graphrag-memory
```

## License

MIT
