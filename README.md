# MCP Memory — Semantic Knowledge Graph

A Model Context Protocol (MCP) server for building and exploring a cognitive neuroscience-inspired knowledge graph. Backed by SQLite — zero infrastructure, single file on disk, works offline.

## Quick Start

```bash
npm install
npx nx build mcp-memory
```

The server stores its database at `~/.mcp-memory/knowledge.db` by default. No external services required.

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
- **Recursive CTEs** for graph traversal (replaces APOC procedures)
- Single `nodes` table for all types, `edges` table with UNIQUE constraint, plus `aliases` and `observations` tables
- Complex objects stored as JSON in a `properties` column

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/) v9+

### Build

```bash
npm install
npx nx build mcp-memory
```

### Run

```bash
npx nx serve mcp-memory
```

### Test

```bash
npx nx test mcp-memory
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MCP_MEMORY_DB_PATH` | No | `~/.mcp-memory/knowledge.db` | Path to the SQLite database file |

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
    "mcp-memory": {
      "command": "node",
      "args": [
        "/absolute/path/to/mcp-neo4j-shan/dist/servers/mcp-memory/main/index.js"
      ]
    }
  }
}
```

3. Restart Claude Desktop.

## Project Structure

```
servers/mcp-memory/          # MCP server (TypeScript, ESM)
  src/main/                  # Server bootstrap, tool handlers, prompts
  src/storage/               # SQLite backend, FTS, schema, validation
  src/types/                 # TypeScript interfaces and enums

libs/graphrag-memory/        # Shared type library (Entity, Relation, etc.)

clients/knowledge-processor/ # Python extraction pipeline (separate setup)
```

## Clients

### knowledge-processor

A Python pipeline for extracting structured knowledge from large text corpora and ingesting it into the knowledge graph.

- Processes books, articles, and documents into entities, events, concepts, and relationships
- Uses GPT-4o for extraction and GPT-4.5 for profile generation
- Supports checkpointing for resumable processing

```bash
cd clients/knowledge-processor
pip install -r requirements.txt
python kg_main.py
```

See `clients/knowledge-processor/` for details.

## Development

```bash
# Build all projects
npx nx run-many -t build

# Test all projects
npx nx run-many -t test

# Lint
npx nx lint mcp-memory

# Build specific project
npx nx build mcp-memory
npx nx build graphrag-memory
```

## License

MIT
