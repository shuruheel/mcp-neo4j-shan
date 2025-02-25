# Neo4j MCP Clients & Servers

Model Context Protocol (MCP) is a [standardized protocol](https://modelcontextprotocol.io/introduction) for managing context between large language models (LLMs) and external systems. 

This lets you use Claude Desktop, or any MCP Client, to use natural language to accomplish things with Neo4j and your Aura account, e.g.:

* `What is in this graph?`

## Servers

### `mcp-neo4j-cypher` - natural language to Cypher queries

### `mcp-neo4j-memory` - knowledge graph memory stored in Neo4j

### `mcp-json-memory` - knowledge graph memory stored in a file

### `mcp-neo4j-shan` - knowledge graph memory stored in Neo4j with node types and relations

A sophisticated knowledge graph memory system that stores interconnected information with rich semantic structure. This server enables LLMs to build, maintain, and explore a comprehensive knowledge graph with cognitive neuroscience-inspired features.

#### Key Features

- **Rich Node Type System**: Supports six specialized node types, each with tailored attributes:
  - **Entity**: People, organizations, products, physical objects
  - **Event**: Time-bound occurrences with temporal attributes
  - **Concept**: Abstract ideas, theories, principles, frameworks
  - **ScientificInsight**: Research findings with supporting evidence
  - **Law**: Established principles, rules, or regularities
  - **Thought**: Analyses, interpretations, or reflections

- **Cognitive Dimensions**: Captures emotional and cognitive aspects of information:
  - Emotional valence and arousal ratings
  - Abstraction levels for concepts
  - Evidence strength for scientific insights
  - Causal relationships between events
  - Confidence scores for thoughts and relations

- **Semantic Relationships**: Creates meaningful connections between nodes with:
  - Active voice relationship types (e.g., ADVOCATES, PARTICIPATED_IN)
  - Directional relationships with contextual explanations
  - Confidence scores and citation sources for academic claims

- **Exploration Tools**:
  - `explore_context`: Reveals the neighborhood around nodes with rich contextual information
  - `create_nodes`: Adds new information to the knowledge graph with appropriate node types
  - `create_relations`: Establishes meaningful connections between nodes
  - `create_thoughts`: Captures AI analysis and insights about the conversation

#### Use Cases

- Building persistent memory across conversations
- Creating interconnected knowledge networks
- Capturing complex relationships between concepts, entities, and events
- Preserving context with emotional and cognitive dimensions
- Enabling sophisticated knowledge exploration and retrieval

## Environment Setup

Each server that connects to Neo4j requires environment variables for database connection. Follow these steps:

1. Copy the `.env.example` file in the server directory to `.env`
2. Update the values in the `.env` file with your Neo4j database credentials:
   ```
   NEO4J_URI=neo4j+s://your-instance.databases.neo4j.io
   NEO4J_USER=your_username
   NEO4J_PASSWORD=your_password
   ```
3. The `.env` file is ignored by git to prevent committing sensitive information

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
