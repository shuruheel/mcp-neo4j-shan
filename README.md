# MCP Semantic Graph Memory

This repository contains a collection of Servers and Client Tools that enable LLMs to build, maintain, and explore a comprehensive knowledge graph with cognitive neuroscience-inspired features.


## Clients

### `knowledge-processor`

A powerful Python-based tool for extracting rich semantic knowledge from large text corpora and ingesting it into the Neo4j knowledge graph according to the same schema used by the MCP Server.

#### Key Features

- **Large-Scale Knowledge Extraction**: Processes entire books or large text collections to build comprehensive knowledge graphs:
  - Automatically splits documents into manageable chunks
  - Processes chunks in parallel for faster extraction
  - Handles checkpointing to resume interrupted processing
  - Scales to process entire libraries of books

- **AI-Powered Information Extraction**: Leverages OpenAI's GPT-4 models to extract:
  - Entities, events, concepts and their interrelationships
  - Sophisticated relationship types with contextual explanations
  - Emotional and cognitive dimensions of information
  - Complex reasoning chains and scientific insights
  - Person-specific psychological profiles

- **Entity Aggregation and Profile Generation**:
  - Consolidates mentions of the same entity across different text sources
  - Generates comprehensive profiles for key entities
  - Resolves entity coreferences and disambiguates similar entities
  - Enhances entities with rich metadata from multiple sources

- **Schema-Compliant Neo4j Integration**:
  - Maps extracted knowledge to the same Neo4j schema used by the MCP server
  - Implements proper node typing and relationship categorization
  - Handles all 13 specialized node types with appropriate attributes
  - Creates typed relationships following the schema specifications
  - Ensures compatibility with MCP server exploration tools

- **Process Components**:
  - **Document Loading & Splitting**: Processes text files from the data directory
  - **Knowledge Extraction**: Extracts structured information from text chunks
  - **Entity Aggregation**: Consolidates and enhances entity information
  - **Comprehensive Profile Generation**: Creates detailed profiles for key entities
  - **Neo4j Storage**: Persists extracted knowledge in the graph database

#### Usage

1. **Setup**:
   - Place text files (books, articles, documents) in the `data` directory
   - Configure Neo4j connection parameters in `.env` file
   - Ensure OpenAI API key is set in the environment

2. **Running the Processor**:
   ```bash
   python kg_main.py
   ```

3. **Processing Stages**:
   - Stage 1: Document loading and text processing
   - Stage 2: Knowledge extraction and entity aggregation
   - Stage 3: Comprehensive profile generation
   - Stage 4: Neo4j database storage

4. **Diagnostic Mode**:
   ```bash
   python kg_main.py --diagnostic
   ```

#### Use Cases

- Building knowledge graphs from books, research papers, or articles
- Creating domain-specific knowledge bases for specialized fields
- Generating interconnected context for AI assistants
- Enabling semantic search across large document collections
- Discovering non-obvious connections between concepts and entities
- Supporting reasoning and analysis with rich factual context
=======

## Servers

### `mcp-neo4j-shan` 

A sophisticated knowledge graph memory system that stores interconnected information with rich semantic structure using Neo4j.

#### Key Features

- **Rich Node Type System**: Supports thirteen specialized node types, each with tailored attributes:
  - **Entity**: People, organizations, products, physical objects with enhanced Person schema support
  - **Event**: Time-bound occurrences with temporal attributes and causal relationships
  - **Concept**: Abstract ideas, theories, principles, frameworks with abstraction levels
  - **Attribute**: Qualities or properties that can be assigned to entities
  - **Proposition**: Objectively verifiable assertions, facts, or claims with truth values
  - **Emotion**: Emotional states and feelings with intensity and valence ratings
  - **Agent**: Cognitive entities capable of action, belief and knowledge representation
  - **Thought**: Subjective interpretations, analyses, and personal perspectives
  - **ScientificInsight**: Research findings with supporting evidence and methodologies
  - **Law**: Established principles, rules, or regularities with conditions and exceptions
  - **Location**: Physical or virtual places with geographical coordinates and containment hierarchies
  - **ReasoningChain**: Structured representations of logical reasoning processes
  - **ReasoningStep**: Individual steps in a reasoning process with formal notation

- **Cognitive Dimensions**: Captures emotional and cognitive aspects of information:
  - Emotional valence (positive/negative) and arousal ratings
  - Abstraction levels for concepts from concrete to abstract
  - Evidence strength for scientific insights and propositions
  - Causal relationships between events with confidence scores
  - Relationship weights indicating importance (0.0-1.0)
  - Metaphorical mappings for concepts
  - Formal notations for reasoning steps
  - Psychological profiles for Person entities
  - Memory aids for relations between node types

- **Semantic Relationships**: Creates meaningful connections between nodes with:
  - Comprehensive relationship types organized by categories:
    - Hierarchical (IS_A, INSTANCE_OF, SUB_CLASS_OF)
    - Compositional (HAS_PART, PART_OF)
    - Spatial (LOCATED_IN, CONTAINS)
    - Temporal (BEFORE, AFTER, DURING)
    - Causal (CAUSES, INFLUENCES)
    - Social (KNOWS, FRIEND_OF, MEMBER_OF)
    - Person-specific (MENTORS, ADMIRES, EXHIBITS_TRAIT, VALUES)
  - Directional relationships with contextual explanations
  - Relationship weights and confidence scores
  - Relationship categories with context types
  - Evidence and source references for relationships

- **Cognitive Schema-Based Knowledge Storage**:
  - **Node Creation System**: Implements a schema-based approach to knowledge representation through the `Neo4jCreator` class:
    - Type-specific attribute capture (e.g., temporal information for Events, evidence for ScientificInsights)
    - Rich metadata support with emotional dimensions (valence, arousal)
    - Person schema with psychological profiles, values, and relational dynamics
    - Reasoning chains with formal logic structure and confidence scoring
    - Stepwise reasoning capture with premises, inferences, and conclusions
    - Location hierarchies with spatial containment relationships

  - **Advanced Cypher Queries**: Uses sophisticated Neo4j query patterns:
    - Parametrized MERGE operations for deduplication and efficient updates
    - Dynamic property setting based on node type
    - Temporal data handling with Neo4j's datetime functions
    - Multi-relationship pattern matching for complex knowledge structures
    - Path-finding algorithms for cognitive traversal patterns

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
    - Location-based retrieval for spatial context
    - Thought-to-reasoning chain traversal for insight capture

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
    - `create_thought`: Captures subjective interpretations and analyses
    - `create_location`: Defines geographical or virtual places
  
  - **Reasoning and Analysis**:
    - `create_reasoning_chain`: Creates structured representations of logical reasoning with well-defined steps
    - `create_reasoning_step`: Adds individual steps to reasoning chains
    - `get_reasoning_chain`: Retrieves reasoning chains with their steps and generates narratives
    - `find_reasoning_chains_with_similar_conclusion`: Finds related reasoning on similar topics (not tested)
    - `get_reasoning_analytics`: Analyzes reasoning patterns across domains and methodologies (not tested)

## Installation and Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- [npm](https://www.npmjs.com/) v9 or newer
- [Neo4j](https://neo4j.com/) database (hosted or local instance)
- [Python](https://www.python.org/) 3.8+ (for knowledge-processor)

### Building the MCP Server

This project uses Nx for build management. To build all servers:

```bash
# Install dependencies
npm install

# Build all servers
npx nx run-many -t build -p "*"

# Build a specific server
npx nx build mcp-neo4j-shan
```

### Setting up the Knowledge Processor

```bash
# Navigate to the knowledge processor directory
cd clients/knowledge-processor

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
# Edit .env with your Neo4j and OpenAI credentials
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
