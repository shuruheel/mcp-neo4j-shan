# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Engram — a Model Context Protocol server for building and exploring a cognitive neuroscience-inspired knowledge graph backed by SQLite. Models thought, emotion, reasoning, and episodic memory. Zero infrastructure — single file on disk, works offline.

## Build & Development Commands

```bash
# Install dependencies
npm install

# Build all projects
npx nx run-many -t build

# Build individual projects
npx nx build mcp-engram              # MCP server (ESM, output: dist/servers/mcp-engram)
npx nx build graphrag-memory         # Shared types library (CJS, output: dist/libs/graphrag-memory)

# Serve server in dev mode
npx nx serve mcp-engram

# Test
npx nx test graphrag-memory          # Library tests
npx nx test mcp-engram               # Server tests
npx nx test mcp-engram -- --testPathPattern="sqlite"  # Run single test file by pattern

# Lint
npx nx lint mcp-engram
npx nx lint graphrag-memory

# Run across all projects
npx nx run-many -t test
npx nx run-many -t lint
```

## Architecture

### Nx Monorepo

**`servers/mcp-engram`** — Main MCP server (TypeScript application)
- Entry: `src/main.ts` → `src/main/index.ts` (server init, SQLite setup, MCP wiring)
- `src/main/tools.ts` — MCP tool definitions and request handlers (8 tools)
- `src/main/prompts.ts` — System prompts and tool-specific prompts
- `src/storage/sqlite.ts` — `SqliteBackend` class: implements `StorageBackend` interface
- `src/storage/schema.ts` — SQLite DDL (nodes, edges, aliases, observations, FTS5)
- `src/storage/fts.ts` — FTS5 query builder
- `src/storage/validation.ts` — Provenance and confidence validation
- `src/types/` — All TypeScript interfaces, enums, `StorageBackend` interface
- Transport: StdioServerTransport (stdin/stdout)

**`libs/graphrag-memory`** — Shared type definitions library
- Exports: `Entity`, `Relation`, `KnowledgeGraph`, `KnowledgeGraphMemory`, `Source`, `EmotionalEvent`
- Path alias: `@mcp-engram/graphrag-memory`

### SQLite Patterns

- Single `nodes` table for all 15 node types, keyed by `name`
- `edges` table with UNIQUE(from_node, to_node, relation_type)
- `aliases` table for entity resolution
- `observations` table for per-node observation log
- FTS5 virtual table (`nodes_fts`) with auto-sync triggers for full-text search
- Complex objects stored as JSON in `properties` column
- Recursive CTEs for graph traversal
- WAL mode for concurrent read performance
- 15 node types: Entity, Event, Concept, Attribute, Proposition, Emotion, Thought, ScientificInsight, Law, Location, ReasoningChain, ReasoningStep, Agent, Source, EmotionalEvent

### Environment Variables

Optional: `MCP_ENGRAM_DB_PATH` (default: `~/.mcp-engram/knowledge.db`)

## Code Style

- Prettier: single quotes enabled
- 2-space indentation (editorconfig)
- ESLint with `@nx/enforce-module-boundaries`
- TypeScript: ES2022 target/module, ESM for server, CJS for library
- Test files: `*.spec.ts` / `*.test.ts` (Jest with ts-jest)

## Key Reference Files

- `graph_schema.md` — Complete node/relationship schema definitions
