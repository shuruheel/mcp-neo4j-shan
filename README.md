# Neo4j MCP Clients & Servers

Model Context Protocol (MCP) is a [standardized protocol](https://modelcontextprotocol.io/introduction) for managing context between large language models (LLMs) and external systems. 

This lets you use Claude Desktop, or any MCP Client, to use natural language to accomplish things with Neo4j and your Aura account, e.g.:

* `What is in this graph?`

## Servers

### `mcp-neo4j-cypher` - natural language to Cypher queries

### `mcp-neo4j-memory` - knowledge graph memory stored in Neo4j

### `mcp-json-memory` - knowledge graph memory stored in a file

### `mcp-neo4j-shan` - knowledge graph memory stored in Neo4j with node types and relations

A reference server for modeling memory as a knowledge graph.

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
