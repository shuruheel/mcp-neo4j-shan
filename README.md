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

- **Available Tools**:
  - **Graph Exploration**:
    - `explore_context`: Reveals the neighborhood around nodes with rich contextual information
    - `explore_weighted_context`: Prioritizes important connections based on relationship weights
    - `robust_search`: Performs multi-strategy searches with fallback options
  
  - **Knowledge Creation**:
    - `create_nodes`: Adds new information to the graph with specialized node types
    - `create_relations`: Establishes meaningful connections between nodes with metadata
    - `create_thoughts`: Captures AI analysis and insights about the conversation
  
  - **Search and Analysis**:
    - `search_nodes`: Finds nodes matching specific text patterns
    - `search_nodes_with_fuzzy_matching`: Uses fuzzy text matching for more flexible searches
    - `generate_narrative`: Creates coherent narratives based on graph knowledge

#### Use Cases

- Building persistent memory across conversations
- Creating interconnected knowledge networks
- Capturing complex relationships between concepts, entities, and events
- Preserving context with emotional and cognitive dimensions
- Enabling sophisticated knowledge exploration and retrieval

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
