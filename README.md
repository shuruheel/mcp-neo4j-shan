# MCP Semantic Graph Memory

This repository contains a collection of Servers that enable LLMs to build, maintain, and explore a comprehensive knowledge graph with cognitive neuroscience-inspired features.

## Servers

### `mcp-neo4j-shan` 

A sophisticated knowledge graph memory system that stores interconnected information with rich semantic structure using Neo4j.

#### Key Features

- **Rich Node Type System**: Supports twelve specialized node types, each with tailored attributes:
  - **Entity**: People, organizations, products, physical objects
  - **Event**: Time-bound occurrences with temporal attributes
  - **Concept**: Abstract ideas, theories, principles, frameworks
  - **Attribute**: Qualities or properties that can be assigned to entities
  - **Proposition**: Facts, claims, rules, or pieces of knowledge
  - **Emotion**: Emotional states and feelings
  - **Agent**: Cognitive entities capable of action or belief
  - **ScientificInsight**: Research findings with supporting evidence
  - **Law**: Established principles, rules, or regularities
  - **ReasoningChain**: Structured representations of logical reasoning
  - **ReasoningStep**: Individual steps in a reasoning process

- **Cognitive Dimensions**: Captures emotional and cognitive aspects of information:
  - Emotional valence and arousal ratings
  - Abstraction levels for concepts
  - Evidence strength for scientific insights
  - Causal relationships between events
  - Confidence scores for reasoning chains and relations
  - Metaphorical mappings for concepts
  - Formal notations for reasoning steps
  - Memory aid for relations between node types

- **Semantic Relationships**: Creates meaningful connections between nodes with:
  - Active voice relationship types (e.g., ADVOCATES, PARTICIPATED_IN)
  - Directional relationships with contextual explanations
  - Relationship weights indicating importance (0.0-1.0)
  - Relationship categories (hierarchical, lateral, temporal, compositional)

- **Cognitive Schema-Based Knowledge Storage**:
  - **Node Creation System**: Implements a schema-based approach to knowledge representation through the `Neo4jCreator` class:
    - Type-specific attribute capture (e.g., temporal information for Events, evidence for ScientificInsights)
    - Rich metadata support with emotional dimensions (valence, arousal)
    - Reasoning chains with formal logic structure and confidence scoring
    - Stepwise reasoning capture with premises, inferences, and conclusions

  - **Advanced Cypher Queries**: Uses sophisticated Neo4j query patterns:
    - Parametrized MERGE operations for deduplication and efficient updates
    - Dynamic property setting based on node type
    - Temporal data handling with Neo4j's datetime functions
    - Multi-relationship pattern matching for complex knowledge structures

- **Cognitively-Inspired Retrieval Methods**:
  - **Spreading Activation Retrieval**: The `Neo4jRetriever` class implements retrieval patterns modeled after human memory:
    - Weighted relationship traversal prioritizing stronger connections
    - Fuzzy matching with configurable thresholds for approximate name matching
    - Subgraph exploration with relationship filters and type-based constraints
    - APOC path-finding algorithms for efficient graph traversal

  - **Specialized Retrieval Patterns**:
    - Temporal sequence retrieval with forward/backward traversal options
    - Conceptual association finding based on shared connections
    - Multi-node context exploration with weight-based prioritization
    - Reasoning chain retrieval with complete step context
    - Causal chain tracing with probability assessment

- **Available Tools**:
  - **Graph Exploration**:
    - `explore_weighted_context`: The PRIMARY tool for exploring the knowledge graph, enhanced with:
      - **Multi-node exploration**: Accepts multiple Entity and Concept nodes simultaneously for comprehensive context exploration
      - **Intelligent topic decomposition**: Provides guidance for decomposing complex topics into individual entities and concepts
      - **Advanced path traversal**: Finds meaningful connections between multiple starting nodes using Neo4j APOC procedures
      - **Weighted relationship prioritization**: Focuses on stronger connections based on relationship weights
      - **Node type filtering**: Targets specific node types to deliver more relevant context
    - `get_temporal_sequence`: Visualizes how events and concepts unfold over time
    - `find_conceptual_associations`: Discovers semantically related concepts based on shared connections (not tested)
    - `find_cognitive_path`: Traces pathways between nodes with custom traversal rules (not tested)
  
  - **Knowledge Creation**:
    - `create_nodes`: Adds new information to the graph with specialized node types
    - `create_relations`: Establishes meaningful connections between nodes with metadata
  
  - **Reasoning and Analysis**:
    - `create_reasoning_chain`: Creates structured representations of logical reasoning with well-defined steps
    - `get_reasoning_chain`: Retrieves reasoning chains with their steps and generates narratives
    - `find_reasoning_chains_with_similar_conclusion`: Finds related reasoning on similar topics (not tested)
    - `get_reasoning_analytics`: Analyzes reasoning patterns across domains and methodologies (not tested)

#### Use Cases

- Building persistent memory across conversations
- Creating interconnected knowledge networks
- Capturing complex relationships between concepts, entities, and events
- Preserving context with emotional and cognitive dimensions
- Enabling sophisticated knowledge exploration and retrieval
- Documenting chains of reasoning with explicit logical steps
- Visualizing temporal sequences and causal relationships

## Installation and Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- [npm](https://www.npmjs.com/) v9 or newer
- [Neo4j](https://neo4j.com/) database (hosted or local instance)

### Building the Project

This project uses Nx for build management. To build all servers:

```bash
# Install dependencies
npm install

# Build all servers
npx nx run-many -t build -p "*"

# Build a specific server
npx nx build mcp-neo4j-shan
```

### Running a Server

```bash
# Run a specific server
npx nx serve mcp-neo4j-shan
```

## Integrating with Claude Desktop

To use these MCP servers with Claude Desktop, you need to add server configurations to your Claude Desktop configuration file:

1. Locate your Claude Desktop config file at:
   - Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. Add server configurations to the `mcpServers` section:

```json
{
  "mcpServers": {
    "mcp-neo4j-shan": {
      "command": "node",
      "args": [
        "/path/to/mcp-neo4j/dist/servers/mcp-neo4j-shan/main/index.js"
      ],
      "env": {
        "NEO4J_URI": "your-neo4j-instance-uri",
        "NEO4J_USERNAME": "your-username",
        "NEO4J_PASSWORD": "your-password"
      }
    }
  }
}
```

Replace `/path/to/mcp-neo4j` with the absolute path to your cloned repository, and update the Neo4j credentials with your own.

3. Restart Claude Desktop to apply the changes.

4. In your Claude conversation, you can now use the configured server by typing `/mcp mcp-neo4j-shan` followed by a query to the knowledge graph.
