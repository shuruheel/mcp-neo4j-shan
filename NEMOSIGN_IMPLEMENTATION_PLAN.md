# NemoSign Knowledge Graph Service - Implementation Plan

## Executive Summary

Transform the current MCP Neo4j knowledge graph into **NemoSign**: a Supermemory.ai-style service where users can upload documents, build personal knowledge graphs, visualize their interconnected knowledge, and query via Claude Desktop's MCP integration.

**Timeline**: Weekend MVP (2-3 days)
**Target Users**: <27 beta users
**Budget**: Minimal (Vercel free tier + pay-as-you-go for Neo4j Aura)
**Tech Stack**: Next.js 14 + Supabase + Neo4j Aura + React Flow + Existing MCP Server

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Database Schema Changes](#database-schema-changes)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [MCP Server Modifications](#mcp-server-modifications)
6. [Authentication & Authorization](#authentication--authorization)
7. [Document Processing Pipeline](#document-processing-pipeline)
8. [Deployment Strategy](#deployment-strategy)
9. [Pricing Model](#pricing-model)
10. [Weekend Implementation Roadmap](#weekend-implementation-roadmap)

---

## 1. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface                            │
│  ┌──────────────┐         ┌──────────────┐                      │
│  │ Claude Desktop│         │  Web App     │                      │
│  │   + MCP       │         │  (Next.js)   │                      │
│  └───────┬──────┘         └──────┬───────┘                      │
└──────────┼───────────────────────┼──────────────────────────────┘
           │                       │
           │                       │
┌──────────▼───────┐      ┌───────▼───────────────────────────────┐
│  MCP Server      │      │  Next.js API Routes + Supabase Auth   │
│  (Authenticated) │      │  ┌────────────┐  ┌─────────────────┐  │
│  - User-scoped   │      │  │ /api/docs  │  │ /api/graph      │  │
│  - Read-only     │      │  │ /api/upload│  │ /api/reasoning  │  │
│  - Neo4j queries │      │  └────────────┘  └─────────────────┘  │
└──────────┬───────┘      └───────┬───────────────────────────────┘
           │                      │
           │    ┌─────────────────┴─────────────────┐
           │    │                                   │
           └────▼───────────────────────────────────▼──────────┐
                │     Neo4j Aura (Single Instance)             │
                │     - Row-level security via user_id         │
                │     - Vector indexes for embeddings          │
                │     - Chunk nodes + Reasoning trees          │
                └──────────────────────────────────────────────┘
```

### Component Responsibilities

1. **Web App (Next.js + Supabase)**
   - User registration/login (Supabase Auth)
   - Document upload interface
   - Knowledge graph visualization (React Flow)
   - Document management
   - Settings/API key management for MCP

2. **MCP Server (Modified)**
   - User authentication via API key
   - Read-only access to user's knowledge graph
   - Tools: explore_context, get_chunks, get_reasoning_trees, search_nodes
   - Enforces user_id filtering on all queries

3. **Neo4j Database**
   - Single instance with multi-tenant data
   - All nodes have `user_id` property
   - Vector indexes for semantic search
   - New node types: Chunk, ReasoningTree

4. **Processing Pipeline (Async Jobs)**
   - Document text extraction
   - Chunking with overlap
   - Knowledge extraction (GPT-4)
   - Graph construction
   - Embedding generation

---

## 2. Database Schema Changes

### 2.1 Multi-Tenancy: Add `user_id` to All Nodes

**Required Changes:**
- Add `user_id: string` property to ALL node types
- Create compound indexes: `(user_id, nodeType, name)`
- Update all Cypher queries to filter by `user_id`

**Migration Strategy:**
```cypher
// Add user_id constraint on all node types
CREATE CONSTRAINT user_node_unique IF NOT EXISTS
FOR (n:Entity) REQUIRE (n.user_id, n.name) IS UNIQUE;

CREATE CONSTRAINT user_concept_unique IF NOT EXISTS
FOR (n:Concept) REQUIRE (n.user_id, n.name) IS UNIQUE;

// Repeat for all 13+ node types...

// Create indexes for performance
CREATE INDEX user_id_index IF NOT EXISTS FOR (n:Entity) ON (n.user_id);
CREATE INDEX user_id_concept_index IF NOT EXISTS FOR (n:Concept) ON (n.user_id);
// Repeat for all node types...
```

### 2.2 New Node Type: Chunk

**Purpose**: Store original document chunks with metadata

**Schema:**
```json
{
  "name": "chunk_<doc_id>_<chunk_index>",
  "nodeType": "Chunk",
  "user_id": "user_uuid",
  "content": "The actual text content of the chunk...",
  "document_id": "doc_uuid",
  "document_name": "My Research Paper.pdf",
  "chunk_index": 0,
  "total_chunks": 25,
  "char_count": 8500,
  "token_count": 2000,
  "metadata": {
    "source": "upload",
    "uploadedAt": "2025-10-24T12:00:00Z",
    "page_numbers": [1, 2]
  },
  "embedding": [0.123, -0.456, ...], // 1536-dim vector
  "created_at": "2025-10-24T12:00:00Z"
}
```

**Relationships:**
- `Chunk -[CONTAINS_ENTITY]-> Entity`
- `Chunk -[CONTAINS_CONCEPT]-> Concept`
- `Chunk -[CONTAINS_EVENT]-> Event`
- `Chunk -[SOURCE_OF]-> ReasoningTree`
- `Chunk -[NEXT_CHUNK]-> Chunk` (for sequential reading)

### 2.3 Reasoning Trees (Enhanced from ReasoningChain)

**Changes from Current ReasoningChain:**

1. **Add Branching Support**
   ```json
   {
     "name": "reasoning_tree_<id>",
     "nodeType": "ReasoningTree",
     "user_id": "user_uuid",
     "rootQuestion": "Should we invest in renewable energy?",
     "conclusion": "Yes, with focus on solar and wind",
     "confidenceScore": 0.85,
     "methodology": "hierarchical_decomposition",
     "created_at": "2025-10-24T12:00:00Z",
     "tags": ["energy", "investment", "climate"]
   }
   ```

2. **Enhanced ReasoningStep with Branching**
   ```json
   {
     "name": "step_<tree_id>_<step_id>",
     "nodeType": "ReasoningStep",
     "user_id": "user_uuid",
     "content": "Renewable energy costs have decreased 89% since 2010",
     "stepType": "evidence", // premise|evidence|inference|branch|conclusion
     "level": 1, // hierarchy depth
     "branch_id": "main", // allows multiple branches
     "alternatives": [
       {
         "content": "However, fossil fuels still dominate energy production",
         "confidence": 0.7
       }
     ],
     "confidence": 0.9,
     "supporting_chunks": ["chunk_1", "chunk_5"],
     "order": 1
   }
   ```

3. **New Relationships for Trees**
   - `ReasoningTree -[ROOT_STEP]-> ReasoningStep` (the starting step)
   - `ReasoningStep -[LEADS_TO]-> ReasoningStep` (linear progression)
   - `ReasoningStep -[BRANCHES_TO]-> ReasoningStep` (alternative paths)
   - `ReasoningStep -[CONTRADICTS]-> ReasoningStep` (conflicting reasoning)
   - `ReasoningStep -[SYNTHESIZES]-> ReasoningStep` (combining multiple paths)

### 2.4 Vector Indexes

**Update vector index creation for user_id scoping:**

```cypher
// Create vector index for Chunks
CREATE VECTOR INDEX chunk_embeddings IF NOT EXISTS
FOR (c:Chunk) ON (c.embedding)
OPTIONS {
  indexConfig: {
    `vector.dimensions`: 1536,
    `vector.similarity_function`: 'cosine'
  }
};

// Ensure all existing vector indexes support filtering by user_id
// (Neo4j handles this via WHERE clauses in queries)
```

---

## 3. Backend Implementation

### 3.1 Next.js API Routes

**File Structure:**
```
app/
├── api/
│   ├── auth/
│   │   └── [...supabase]/route.ts
│   ├── documents/
│   │   ├── route.ts              # GET all, POST upload
│   │   ├── [id]/route.ts         # GET, DELETE specific doc
│   │   └── [id]/process/route.ts # POST trigger processing
│   ├── graph/
│   │   ├── nodes/route.ts        # GET nodes with filters
│   │   ├── search/route.ts       # POST semantic search
│   │   └── visualize/route.ts    # GET graph for visualization
│   ├── chunks/
│   │   ├── route.ts              # GET chunks
│   │   └── search/route.ts       # POST chunk search
│   ├── reasoning/
│   │   ├── trees/route.ts        # GET all trees, POST create
│   │   └── [id]/route.ts         # GET specific tree
│   ├── mcp/
│   │   ├── keys/route.ts         # GET, POST, DELETE API keys
│   │   └── validate/route.ts     # POST validate API key
│   └── processing/
│       └── status/[jobId]/route.ts # GET job status
```

### 3.2 Core API Endpoints

#### 3.2.1 Document Upload & Processing

**POST /api/documents**
```typescript
// Input: FormData with file
// Output: { document_id, status: "processing", job_id }

async function POST(request: Request) {
  const user = await getUser(request);
  const formData = await request.formData();
  const file = formData.get('file');

  // 1. Upload to Supabase Storage
  const { path } = await supabase.storage
    .from('documents')
    .upload(`${user.id}/${file.name}`, file);

  // 2. Create document record
  const doc = await db.documents.create({
    user_id: user.id,
    name: file.name,
    storage_path: path,
    status: 'queued'
  });

  // 3. Trigger async processing
  const jobId = await queueDocumentProcessing(doc.id);

  return { document_id: doc.id, status: 'processing', job_id: jobId };
}
```

#### 3.2.2 Graph Retrieval

**GET /api/graph/nodes**
```typescript
// Query params: nodeType?, limit?, search?
// Output: { nodes: [...], relationships: [...] }

async function GET(request: Request) {
  const user = await getUser(request);
  const { searchParams } = new URL(request.url);

  const nodeType = searchParams.get('nodeType');
  const limit = parseInt(searchParams.get('limit') || '100');

  const nodes = await neo4jService.getNodes({
    user_id: user.id,
    nodeType,
    limit
  });

  return { nodes, relationships: [] };
}
```

**POST /api/graph/search**
```typescript
// Input: { query: string, filters?: {...} }
// Output: { nodes, relationships, chunks }

async function POST(request: Request) {
  const user = await getUser(request);
  const { query, filters } = await request.json();

  // Use vector search to find relevant chunks and nodes
  const results = await neo4jService.semanticSearch({
    user_id: user.id,
    query,
    filters
  });

  return results;
}
```

### 3.3 Neo4j Service Layer

**lib/neo4j-service.ts**
```typescript
import { Driver } from 'neo4j-driver';

export class Neo4jService {
  constructor(private driver: Driver) {}

  async getNodes(params: {
    user_id: string;
    nodeType?: string;
    limit?: number;
  }) {
    const session = this.driver.session();
    try {
      const query = `
        MATCH (n)
        WHERE n.user_id = $user_id
        ${params.nodeType ? 'AND n.nodeType = $nodeType' : ''}
        RETURN n
        LIMIT $limit
      `;

      const result = await session.run(query, {
        user_id: params.user_id,
        nodeType: params.nodeType,
        limit: params.limit || 100
      });

      return result.records.map(r => r.get('n').properties);
    } finally {
      await session.close();
    }
  }

  async semanticSearch(params: {
    user_id: string;
    query: string;
    filters?: any;
  }) {
    // 1. Generate embedding for query
    const embedding = await generateEmbedding(params.query);

    // 2. Vector search on Chunks
    const session = this.driver.session();
    try {
      const result = await session.run(`
        CALL db.index.vector.queryNodes('chunk_embeddings', 10, $embedding)
        YIELD node, score
        WHERE node.user_id = $user_id

        // Get related entities/concepts from chunks
        OPTIONAL MATCH (node)-[r:CONTAINS_ENTITY|CONTAINS_CONCEPT]->(related)
        WHERE related.user_id = $user_id

        RETURN node as chunk, score, collect(related) as related_nodes
        ORDER BY score DESC
      `, { user_id: params.user_id, embedding });

      // Format and return results
      return this.formatSearchResults(result);
    } finally {
      await session.close();
    }
  }
}
```

---

## 4. Frontend Implementation

### 4.1 Page Structure

```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (dashboard)/
│   ├── layout.tsx              # Sidebar navigation
│   ├── page.tsx                # Dashboard home (stats)
│   ├── documents/
│   │   ├── page.tsx            # Document list + upload
│   │   └── [id]/page.tsx       # Document details
│   ├── graph/
│   │   └── page.tsx            # Graph visualization
│   ├── search/
│   │   └── page.tsx            # Semantic search interface
│   └── settings/
│       └── page.tsx            # MCP API keys, preferences
└── components/
    ├── DocumentUpload.tsx
    ├── GraphVisualization.tsx
    ├── ChunkViewer.tsx
    └── ReasoningTreeViewer.tsx
```

### 4.2 Key Components

#### 4.2.1 Document Upload Component

**components/DocumentUpload.tsx**
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DocumentUpload() {
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);

    const formData = new FormData(e.currentTarget);
    const response = await fetch('/api/documents', {
      method: 'POST',
      body: formData
    });

    const { document_id } = await response.json();
    setUploading(false);
    router.push(`/documents/${document_id}`);
  }

  return (
    <form onSubmit={handleUpload}>
      <input
        type="file"
        name="file"
        accept=".pdf,.txt,.md"
        required
      />
      <button disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload Document'}
      </button>
    </form>
  );
}
```

#### 4.2.2 Graph Visualization Component

**components/GraphVisualization.tsx**
```tsx
'use client';

import { useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap
} from 'reactflow';
import 'reactflow/dist/style.css';

interface GraphData {
  nodes: any[];
  relationships: any[];
}

export function GraphVisualization({ userId }: { userId: string }) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    loadGraph();
  }, [userId]);

  async function loadGraph() {
    const response = await fetch('/api/graph/nodes?limit=50');
    const data: GraphData = await response.json();

    // Convert to ReactFlow format
    const flowNodes = data.nodes.map((n, i) => ({
      id: n.name,
      type: getNodeType(n.nodeType),
      position: calculatePosition(i), // Use force-directed layout
      data: { label: n.name, ...n }
    }));

    const flowEdges = data.relationships.map(r => ({
      id: `${r.from}-${r.to}`,
      source: r.from,
      target: r.to,
      label: r.relationType,
      animated: r.weight > 0.7
    }));

    setNodes(flowNodes);
    setEdges(flowEdges);
  }

  return (
    <div style={{ height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
```

#### 4.2.3 Reasoning Tree Viewer

**components/ReasoningTreeViewer.tsx**
```tsx
'use client';

import { useState, useEffect } from 'react';

interface ReasoningTree {
  name: string;
  rootQuestion: string;
  conclusion: string;
  steps: ReasoningStep[];
}

interface ReasoningStep {
  name: string;
  content: string;
  stepType: string;
  level: number;
  children: ReasoningStep[];
  alternatives?: any[];
}

export function ReasoningTreeViewer({ treeId }: { treeId: string }) {
  const [tree, setTree] = useState<ReasoningTree | null>(null);

  useEffect(() => {
    fetch(`/api/reasoning/trees/${treeId}`)
      .then(r => r.json())
      .then(setTree);
  }, [treeId]);

  if (!tree) return <div>Loading...</div>;

  return (
    <div className="reasoning-tree">
      <h2>{tree.rootQuestion}</h2>
      <div className="tree-container">
        <TreeNode step={tree.steps[0]} />
      </div>
      <div className="conclusion">
        <strong>Conclusion:</strong> {tree.conclusion}
      </div>
    </div>
  );
}

function TreeNode({ step }: { step: ReasoningStep }) {
  return (
    <div className="tree-node" data-level={step.level}>
      <div className="node-content">
        <span className="step-type">{step.stepType}</span>
        <p>{step.content}</p>
      </div>

      {step.alternatives && step.alternatives.length > 0 && (
        <div className="alternatives">
          {step.alternatives.map((alt, i) => (
            <div key={i} className="alternative">
              {alt.content}
            </div>
          ))}
        </div>
      )}

      {step.children && step.children.length > 0 && (
        <div className="children">
          {step.children.map((child, i) => (
            <TreeNode key={i} step={child} />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 5. MCP Server Modifications

### 5.1 Authentication Layer

**Add API Key Authentication**

**New file: `servers/mcp-neo4j-shan/src/auth/index.ts`**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Server-side only
);

export async function validateApiKey(apiKey: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('mcp_api_keys')
    .select('user_id, revoked')
    .eq('key', apiKey)
    .single();

  if (error || !data || data.revoked) {
    return null;
  }

  return data.user_id;
}
```

**Update: `servers/mcp-neo4j-shan/src/main/index.ts`**
```typescript
import { validateApiKey } from '../auth/index.js';

// Add to main function
export async function main() {
  // ... existing code ...

  // Get API key from environment
  const apiKey = process.env.NEMOSIGN_API_KEY;
  if (!apiKey) {
    throw new Error('NEMOSIGN_API_KEY environment variable is required');
  }

  // Validate and get user_id
  const userId = await validateApiKey(apiKey);
  if (!userId) {
    throw new Error('Invalid or revoked API key');
  }

  console.error(`Authenticated as user: ${userId}`);

  // Pass userId to creator and retriever
  const nodeCreator = new Neo4jCreator(neo4jDriver, userId);
  const nodeRetriever = new Neo4jRetriever(neo4jDriver, userId);

  // ... rest of setup ...
}
```

### 5.2 User-Scoped Queries

**Update: `servers/mcp-neo4j-shan/src/node-creator/creator.ts`**
```typescript
export class Neo4jCreator {
  private neo4jDriver: Neo4jDriver;
  private userId: string;

  constructor(neo4jDriver: Neo4jDriver, userId: string) {
    this.neo4jDriver = neo4jDriver;
    this.userId = userId;
  }

  async createEntities(entities: Entity[]): Promise<string> {
    const session = this.neo4jDriver.session();
    try {
      for (const entity of entities) {
        // Inject user_id into all created nodes
        await session.run(`
          MERGE (n:${entity.entityType} {
            name: $name,
            user_id: $user_id
          })
          SET n += $properties
        `, {
          name: entity.name,
          user_id: this.userId, // <-- User scoping
          properties: entity
        });
      }
      return `Created ${entities.length} nodes for user ${this.userId}`;
    } finally {
      await session.close();
    }
  }
}
```

**Update: `servers/mcp-neo4j-shan/src/node-retriever/methods/search.ts`**
```typescript
export async function vectorSearch(
  neo4jDriver: Neo4jDriver,
  userId: string, // <-- Add userId parameter
  queryEmbedding: number[],
  nodeType?: string,
  limit: number = 10,
  threshold: number = 0.75
): Promise<KnowledgeGraph> {
  const session = neo4jDriver.session();
  try {
    const result = await session.run(`
      CALL db.index.vector.queryNodes($indexName, $limit, $queryEmbedding)
      YIELD node, score
      WHERE node.user_id = $userId  // <-- Filter by user
        AND score >= $threshold
        ${nodeType ? 'AND node.nodeType = $nodeType' : ''}
      RETURN node, score
      ORDER BY score DESC
    `, {
      indexName: 'node_embeddings',
      limit,
      queryEmbedding,
      userId, // <-- Pass userId
      threshold,
      nodeType
    });

    // ... format results ...
  } finally {
    await session.close();
  }
}
```

### 5.3 New MCP Tools

**Add Chunk Retrieval Tool**

**Update: `servers/mcp-neo4j-shan/src/main/tools.ts`**
```typescript
const tools = [
  // ... existing tools ...

  {
    name: "get_chunks",
    description: "Retrieve document chunks related to specific nodes or search query. Returns the original text chunks that were used to extract knowledge.",
    inputSchema: {
      type: "object",
      properties: {
        nodeNames: {
          type: "array",
          items: { type: "string" },
          description: "Names of nodes to find related chunks for"
        },
        searchQuery: {
          type: "string",
          description: "Semantic search query to find relevant chunks"
        },
        limit: {
          type: "number",
          description: "Maximum number of chunks to return"
        }
      }
    }
  },

  {
    name: "get_reasoning_trees",
    description: "Retrieve reasoning trees that show hierarchical decomposition and branching decision paths for complex questions.",
    inputSchema: {
      type: "object",
      properties: {
        treeId: {
          type: "string",
          description: "Specific tree ID to retrieve"
        },
        relatedTo: {
          type: "array",
          items: { type: "string" },
          description: "Find trees related to these concepts/entities"
        },
        limit: {
          type: "number",
          description: "Maximum number of trees to return"
        }
      }
    }
  }
];
```

---

## 6. Authentication & Authorization

### 6.1 Supabase Setup

**Database Schema (Supabase SQL)**

```sql
-- Users table (managed by Supabase Auth)
-- Already exists, just reference it

-- MCP API Keys table
CREATE TABLE mcp_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE
);

-- Documents table
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, processing, completed, failed
  total_chunks INTEGER,
  processed_chunks INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Processing jobs table
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued',
  progress JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error TEXT
);

-- Row Level Security Policies
ALTER TABLE mcp_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own API keys"
  ON mcp_api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own API keys"
  ON mcp_api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own API keys"
  ON mcp_api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Similar policies for documents and jobs
```

### 6.2 API Key Management

**Generate API Key (Client Side)**

**app/settings/page.tsx**
```tsx
'use client';

import { useState } from 'react';

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState([]);

  async function generateApiKey(name: string) {
    const response = await fetch('/api/mcp/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    const { key } = await response.json();

    // Show the key once (can't be retrieved again)
    alert(`Your API Key: ${key}\n\nSave this key securely!`);

    // Reload keys list
    loadApiKeys();
  }

  return (
    <div>
      <h1>MCP Settings</h1>
      <button onClick={() => generateApiKey('My MCP Key')}>
        Generate New API Key
      </button>
      {/* List existing keys */}
    </div>
  );
}
```

**API Key Generation (Server Side)**

**app/api/mcp/keys/route.ts**
```typescript
import { createClient } from '@/lib/supabase/server';
import { randomBytes } from 'crypto';

export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { name } = await request.json();

  // Generate secure API key
  const key = `nemo_${randomBytes(32).toString('hex')}`;

  // Store in database
  const { error } = await supabase
    .from('mcp_api_keys')
    .insert({
      user_id: user.id,
      key,
      name
    });

  if (error) {
    return new Response('Error creating API key', { status: 500 });
  }

  return Response.json({ key });
}
```

---

## 7. Document Processing Pipeline

### 7.1 Processing Flow

```
Upload → Extract Text → Chunk → Extract Knowledge → Create Graph → Generate Embeddings
```

### 7.2 Processing Implementation

**lib/processing/document-processor.ts**
```typescript
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { ChatOpenAI } from '@langchain/openai';
import { generateEmbedding } from './embeddings';

export async function processDocument(documentId: string) {
  // 1. Load document from Supabase Storage
  const document = await loadDocument(documentId);

  // 2. Extract text (PDF, TXT, MD)
  const text = await extractText(document);

  // 3. Chunk the text
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 10000,
    chunkOverlap: 1000
  });
  const chunks = await splitter.createDocuments([text]);

  // 4. Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // 4a. Generate embedding for chunk
    const embedding = await generateEmbedding(chunk.pageContent);

    // 4b. Create Chunk node in Neo4j
    await createChunkNode({
      user_id: document.user_id,
      document_id: documentId,
      chunk_index: i,
      content: chunk.pageContent,
      embedding
    });

    // 4c. Extract knowledge from chunk
    const extracted = await extractKnowledge(chunk.pageContent);

    // 4d. Create nodes and relationships
    await createNodesFromExtraction(document.user_id, extracted);

    // 4e. Link chunk to extracted nodes
    await linkChunkToNodes(chunkId, extracted.nodes);

    // Update progress
    await updateProgress(documentId, i + 1, chunks.length);
  }

  // 5. Mark as complete
  await markDocumentComplete(documentId);
}
```

### 7.3 Knowledge Extraction (Reuse Existing Python Code)

**Option 1: Keep Python, Call from Node.js**
```typescript
import { spawn } from 'child_process';

async function extractKnowledge(text: string) {
  return new Promise((resolve, reject) => {
    const python = spawn('python', [
      'clients/knowledge-processor/extract.py',
      '--text', text
    ]);

    let output = '';
    python.stdout.on('data', (data) => {
      output += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        resolve(JSON.parse(output));
      } else {
        reject(new Error('Extraction failed'));
      }
    });
  });
}
```

**Option 2: Port to TypeScript (Faster for MVP)**
```typescript
import { ChatOpenAI } from '@langchain/openai';

const llm = new ChatOpenAI({
  modelName: 'gpt-4o',
  temperature: 0
});

async function extractKnowledge(text: string) {
  const prompt = `
    Extract structured knowledge from the following text.

    Return a JSON object with:
    - entities: array of entities (people, organizations, concepts)
    - relationships: array of relationships between entities
    - events: array of events mentioned
    - reasoning: any reasoning or arguments present

    Text:
    ${text}
  `;

  const response = await llm.invoke(prompt);
  return JSON.parse(response.content);
}
```

---

## 8. Deployment Strategy

### 8.1 Vercel Deployment

**vercel.json**
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "env": {
    "NEXT_PUBLIC_SUPABASE_URL": "@supabase-url",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY": "@supabase-anon-key",
    "SUPABASE_SERVICE_ROLE_KEY": "@supabase-service-role-key",
    "NEO4J_URI": "@neo4j-uri",
    "NEO4J_USERNAME": "@neo4j-username",
    "NEO4J_PASSWORD": "@neo4j-password",
    "OPENAI_API_KEY": "@openai-api-key"
  }
}
```

### 8.2 MCP Server Deployment

**Option 1: User Self-Hosts (Recommended for MVP)**
- Users install MCP server locally
- Configure with their NemoSign API key
- MCP connects to production Neo4j

**Claude Desktop Config (User Side):**
```json
{
  "mcpServers": {
    "nemosign": {
      "command": "npx",
      "args": ["-y", "@nemosign/mcp-server"],
      "env": {
        "NEMOSIGN_API_KEY": "nemo_abc123...",
        "NEO4J_URI": "neo4j+s://production.databases.neo4j.io",
        "NEO4J_USERNAME": "neo4j",
        "NEO4J_PASSWORD": "production-password"
      }
    }
  }
}
```

**Option 2: Hosted MCP Proxy (Future)**
- Deploy MCP server to Vercel/Railway
- Users configure webhook URL instead

### 8.3 Database Deployment

**Neo4j Aura (Managed)**
- Create free tier instance (50k nodes, 175k relationships)
- For MVP: Single AuraDB Free instance
- Production: Upgrade to AuraDB Professional ($65/month)

**Connection:**
```bash
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<generated-password>
```

---

## 9. Pricing Model

### 9.1 Cost Analysis

**Infrastructure Costs (per month):**
- Vercel: $0 (Hobby tier, 100GB bandwidth)
- Supabase: $0 (Free tier, 500MB database, 1GB storage)
- Neo4j Aura Free: $0 (50k nodes limit)
- OpenAI API: ~$0.01 per 1k GPT-4 tokens

**Processing Costs:**
- 100-page PDF ≈ 50k tokens
- Extraction: $0.50 (50k tokens × $0.01/1k)
- Embeddings: $0.0065 (50 chunks × $0.00013/chunk)
- **Total per 100-page doc: ~$0.51**

### 9.2 Pricing Tiers

**Free Tier:**
- 3 documents max
- 10MB storage
- 1,000 nodes in graph
- 1 MCP API key
- Community support

**Pro Tier ($9/month):**
- 50 documents
- 500MB storage
- 25,000 nodes
- 5 MCP API keys
- Email support

**Margin Calculation:**
- Average user: 10 docs/month = $5.10 in costs
- Pro tier revenue: $9
- Margin: $3.90 (43%)

**Using Haiku 4.5 (Lower Costs):**
- Extraction: 50k tokens × $0.000003/token = $0.15
- **Total per 100-page doc: ~$0.16**
- Margin improves to $7.40 (82%)

---

## 10. Weekend Implementation Roadmap

### Day 1: Saturday (8-10 hours)

**Morning (3 hours): Infrastructure Setup**
- [ ] Create Next.js project with Supabase starter
- [ ] Set up Supabase project (database, auth, storage)
- [ ] Set up Neo4j Aura instance
- [ ] Configure environment variables
- [ ] Set up Vercel project (don't deploy yet)

**Midday (3 hours): Database & Schema**
- [ ] Create Supabase tables (documents, api_keys, jobs)
- [ ] Create Neo4j constraints and indexes
- [ ] Add `user_id` to all node types in Neo4j schema
- [ ] Test multi-tenant queries manually

**Afternoon (4 hours): Basic Backend**
- [ ] Implement Supabase auth (login/signup pages)
- [ ] Create `/api/documents` upload endpoint
- [ ] Create Neo4j service layer with user scoping
- [ ] Test document upload flow

### Day 2: Sunday (8-10 hours)

**Morning (4 hours): Document Processing**
- [ ] Implement text extraction (PDF, TXT)
- [ ] Implement chunking logic
- [ ] Create Chunk node creation in Neo4j
- [ ] Implement simple knowledge extraction (LLM call)

**Midday (3 hours): MCP Server Updates**
- [ ] Add API key authentication to MCP server
- [ ] Update all Neo4j queries to filter by user_id
- [ ] Add `get_chunks` tool
- [ ] Test MCP server with Claude Desktop

**Afternoon (3 hours): Frontend**
- [ ] Create document list page
- [ ] Create basic graph visualization (React Flow)
- [ ] Create MCP API key management page
- [ ] Style with Tailwind CSS

### Day 3: Monday (Optional Polish, 4-6 hours)

**Morning (2 hours): Reasoning Trees**
- [ ] Update ReasoningChain schema to ReasoningTree
- [ ] Add branching support
- [ ] Create reasoning tree viewer component

**Midday (2 hours): Testing & Bug Fixes**
- [ ] End-to-end testing of upload flow
- [ ] Test MCP integration with real queries
- [ ] Fix any critical bugs

**Afternoon (2 hours): Deployment**
- [ ] Deploy to Vercel
- [ ] Test production environment
- [ ] Create onboarding documentation

---

## Appendix: File Checklist

### New Files to Create

**Backend:**
- [ ] `app/api/documents/route.ts`
- [ ] `app/api/documents/[id]/route.ts`
- [ ] `app/api/documents/[id]/process/route.ts`
- [ ] `app/api/graph/nodes/route.ts`
- [ ] `app/api/graph/search/route.ts`
- [ ] `app/api/chunks/route.ts`
- [ ] `app/api/reasoning/trees/route.ts`
- [ ] `app/api/mcp/keys/route.ts`
- [ ] `lib/neo4j-service.ts`
- [ ] `lib/processing/document-processor.ts`
- [ ] `lib/processing/text-extractor.ts`
- [ ] `lib/processing/knowledge-extractor.ts`
- [ ] `lib/embeddings.ts`

**Frontend:**
- [ ] `app/(auth)/login/page.tsx`
- [ ] `app/(auth)/signup/page.tsx`
- [ ] `app/(dashboard)/layout.tsx`
- [ ] `app/(dashboard)/page.tsx`
- [ ] `app/(dashboard)/documents/page.tsx`
- [ ] `app/(dashboard)/graph/page.tsx`
- [ ] `app/(dashboard)/settings/page.tsx`
- [ ] `components/DocumentUpload.tsx`
- [ ] `components/GraphVisualization.tsx`
- [ ] `components/ReasoningTreeViewer.tsx`

**MCP Server:**
- [ ] `servers/mcp-neo4j-shan/src/auth/index.ts`
- [ ] Update `servers/mcp-neo4j-shan/src/main/index.ts`
- [ ] Update `servers/mcp-neo4j-shan/src/main/tools.ts`
- [ ] Update `servers/mcp-neo4j-shan/src/node-creator/creator.ts`
- [ ] Update `servers/mcp-neo4j-shan/src/node-retriever/index.ts`

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Set up development environment** (Supabase, Neo4j Aura accounts)
3. **Create project board** with tasks from the weekend roadmap
4. **Start implementation** following Day 1 schedule

**Questions to resolve before starting:**
- Confirm OpenAI API budget for processing
- Decide on Python vs TypeScript for knowledge extraction
- Choose between self-hosted vs managed MCP deployment
- Finalize color scheme and branding for frontend

---

**Document Version:** 1.0
**Last Updated:** 2025-10-24
**Author:** Implementation Planning Team
