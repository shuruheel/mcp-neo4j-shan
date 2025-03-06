# Knowledge Processor

A powerful command-line batch processor for ingesting knowledge from various media types (books, PDFs, text, etc.) into the MCP-Neo4j semantic graph memory system.

## Features

- Process individual files or entire directories of knowledge content
- Extract entities, concepts, relations, and reasoning chains from text
- Support for various file formats (PDF, TXT, MD, etc.)
- Intelligent chunking with optimal size management
- Robust error handling and auto-recovery
- Checkpoint system to enable resumable processing
- Detailed logging and status reporting
- **Advanced Reasoning Chain Processing**:
  - Separate extraction passes for entities/relations and reasoning chains
  - Cross-chunk reasoning chain reconciliation
  - Intelligent merging of partial reasoning chains

## Installation

1. Clone the repository
2. Navigate to the knowledge processor directory:
   ```
   cd clients/knowledge-processor
   ```
3. Install dependencies:
   ```
   npm install
   ```
4. Build the project:
   ```
   npm run build
   ```
5. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```
6. Edit the `.env` file to add your Anthropic API key and Neo4j database credentials

## Usage

### Process a Single File

```bash
npm start process path/to/your/file.pdf
```

### Process a Directory of Files

```bash
npm start process-batch path/to/your/directory
```

With recursive scanning of subdirectories:

```bash
npm start process-batch path/to/your/directory --recursive
```

### Check Processing Status

```bash
npm start status
```

## Command Options

- `process` - Process a single file
  - `-c, --checkpoint-dir <dir>` - Directory to store checkpoints (default: `./checkpoints`)

- `process-batch` - Process all files in a directory
  - `-c, --checkpoint-dir <dir>` - Directory to store checkpoints (default: `./checkpoints`)
  - `-r, --recursive` - Process files in subdirectories (default: `false`)

- `status` - Show processing status
  - `-c, --checkpoint-dir <dir>` - Directory where checkpoints are stored (default: `./checkpoints`)

## Configuration

The following environment variables can be set in the `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key | - |
| `MCP_SERVER_PATH` | Path to the MCP-Neo4j server | `../servers/mcp-neo4j-shan/dist/main/index.js` |
| `NEO4J_URI` | Neo4j database URI | `neo4j://localhost:7687` |
| `NEO4J_USERNAME` | Neo4j database username | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j database password | `password` |
| `CHUNK_SIZE` | Maximum chunk size in characters | `4000` |
| `MAX_RETRIES` | Maximum number of retries for failed chunks | `3` |
| `CONCURRENCY` | Number of files to process concurrently | `2` |
| `LOG_LEVEL` | Logging level | `info` |

## How It Works

1. **File Extraction**: The processor extracts text content from various file formats
2. **Intelligent Chunking**: Content is divided into optimal chunks for processing
3. **Two-Pass Knowledge Extraction**:
   - **First Pass**: Extract entities, concepts, events, and relations
   - **Second Pass**: Extract reasoning chains and fragments
4. **Cross-Chunk Reasoning Chain Reconciliation**:
   - Identify fragments of reasoning chains that span multiple chunks
   - Group related fragments based on chain names and connection clues
   - Merge fragments into complete chains with proper step ordering
   - Validate completeness before persisting to the database
5. **Graph Integration**: Extracted knowledge is stored in the Neo4j graph database
6. **Checkpoint Management**: Progress is tracked to enable resumable processing

## Reasoning Chain Processing

The processor uses a sophisticated approach to handle reasoning chains that span multiple chunks:

1. **Fragment Identification**: Each chunk is analyzed for complete or partial reasoning chains
2. **Fragment Classification**: Fragments are classified as:
   - `complete`: A self-contained reasoning chain
   - `partial-beginning`: The start of a chain that continues in later chunks
   - `partial-middle`: A middle section of a chain
   - `partial-end`: The conclusion of a chain that started in earlier chunks
3. **Connection Clues**: Fragments store clues that help identify related fragments
4. **Reconciliation Process**: After processing all chunks, fragments are:
   - Grouped by chain name and other similarity metrics
   - Ordered by chunk index
   - Merged into complete chains with proper step ordering
   - Validated for completeness (must have beginning and end)
5. **Persistence**: Only complete, reconciled chains are stored in the database

## Extensibility

The processor is designed to be extensible:

- Add new content extractors in `extractors.ts`
- Customize knowledge extraction prompts in `mcp-client.ts`
- Add error recovery strategies in `processor.ts`
- Enhance chain reconciliation logic in `chain-reconciliation.ts`

## Troubleshooting

- **API Key Issues**: Ensure your Anthropic API key is correctly set in `.env`
- **Connection Errors**: Verify your Neo4j database is running and credentials are correct
- **Processing Errors**: Check the logs in `./logs` for detailed error information
- **Checkpoint Issues**: If processing seems stuck, check the checkpoint file in the checkpoint directory
- **Reasoning Chain Issues**: If chains are not being properly reconciled, try adjusting the chunk size

## License

MIT 