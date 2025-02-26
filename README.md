# MCP Semantic Graph Memory

This repository contains a collection of MCP Clients and Servers that enable LLMs to build, maintain, and explore a comprehensive knowledge graph with cognitive neuroscience-inspired features.

## Servers

### `mcp-neo4j-shan` 

A sophisticated knowledge graph memory system that stores interconnected information with rich semantic structure using Neo4j.

#### Key Features

- **Rich Node Type System**: Supports seven specialized node types, each with tailored attributes:
  - **Entity**: People, organizations, products, physical objects
  - **Event**: Time-bound occurrences with temporal attributes
  - **Concept**: Abstract ideas, theories, principles, frameworks
  - **ScientificInsight**: Research findings with supporting evidence
  - **Law**: Established principles, rules, or regularities
  - **ReasoningChain**: Structured representations of logical reasoning
  - **ReasoningStep**: Individual steps in a reasoning process

- **Cognitive Dimensions**: Captures emotional and cognitive aspects of information:
  - Emotional valence and arousal ratings
  - Abstraction levels for concepts
  - Evidence strength for scientific insights
  - Causal relationships between events
  - Confidence scores for thoughts and relations
  - Metaphorical mappings for concepts
  - Formal notations for reasoning steps

- **Semantic Relationships**: Creates meaningful connections between nodes with:
  - Active voice relationship types (e.g., ADVOCATES, PARTICIPATED_IN)
  - Directional relationships with contextual explanations
  - Relationship weights indicating importance (0.0-1.0)
  - Relationship categories (hierarchical, lateral, temporal, compositional)
  - Memory aids and context types for enhanced recall

- **Available Tools**:
  - **Graph Exploration**:
    - `explore_weighted_context`: The PRIMARY tool for exploring the knowledge graph, prioritizing important connections based on relationship weights
    - `explore_context`: (Deprecated) Basic context exploration without weight prioritization
    - `get_temporal_sequence`: Visualizes how events and concepts unfold over time
  
  - **Knowledge Creation**:
    - `create_nodes`: Adds new information to the graph with specialized node types
    - `create_relations`: Establishes meaningful connections between nodes with metadata
  
  - **Reasoning and Analysis**:
    - `create_reasoning_chain`: Creates structured representations of logical reasoning with well-defined steps
    - `get_reasoning_chain`: Retrieves reasoning chains with their steps and generates narratives

#### Use Cases

- Building persistent memory across conversations
- Creating interconnected knowledge networks
- Capturing complex relationships between concepts, entities, and events
- Preserving context with emotional and cognitive dimensions
- Enabling sophisticated knowledge exploration and retrieval
- Documenting chains of reasoning with explicit logical steps
- Visualizing temporal sequences and causal relationships

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
