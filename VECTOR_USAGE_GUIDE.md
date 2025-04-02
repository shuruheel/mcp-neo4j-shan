# Neo4j Vector Embedding Usage Guide

This guide provides a comprehensive checklist for vector embedding usage in the node-retriever system, ensuring consistent and correct usage patterns.

## Vector Search Patterns

There are two distinct use cases for vector search:

1. **Text query → vector search**: Requires converting text to embeddings via OpenAI API
2. **Node → vector search**: Uses existing node embeddings stored in Neo4j

## Function Checklist

### 1. index.ts (Parent Class)
- ✅ `robustSearch()`: Correctly generates embedding for text queries
- ✅ `vectorSearch()`: Correctly generates embedding for text queries
- ✅ `searchNodesByType()`: Calls searchNodesWithVectorEmbeddings which handles embedding generation

### 2. search.ts (Core Search Logic)
- ✅ `generateQueryEmbedding()`: Correctly implements OpenAI embedding generation
- ✅ `vectorSearch()`: Accepts and validates embeddings (array of numbers)
- ✅ `combinedVectorSearch()`: Accepts and validates embeddings
- ✅ `robustSearch()`: Takes embeddings directly
- ✅ `searchNodesWithVectorEmbeddings()`: Correctly generates embeddings for each term
- ✅ `searchNodes()`: Correctly generates embedding before searching
- ✅ `searchNodesWithFuzzyMatching()`: Uses vector embeddings properly

### 3. exploration.ts (Context & Association)
- ✅ `exploreContextWeighted()`: Correctly generates embedding when needed for fallback vector search
- ✅ `findConceptualAssociations()`: Correctly uses node's embedding from database (intended behavior)
- ✅ `findCognitivePath()`: No vector search involved, uses graph traversal

### 4. reasoning.ts (Reasoning Chains)
- ✅ `getReasoningChain()`: Correctly generates embedding when needed for vector fallback
- ✅ `getReasoningStepDetails()`: Correctly generates embedding when needed for vector fallback
- ✅ `findReasoningChainsWithSimilarConclusion()`: Correctly generates embedding for topic search
- ✅ `getReasoningAnalytics()`: No vector search involved

### 5. temporal.ts (Time-Based Queries)
- ✅ `getTemporalSequence()`: Correctly generates embedding when needed for vector fallback
- ✅ `findTemporalGaps()`: No vector search involved
- ✅ `traceCausalChains()`: Correctly generates embedding when needed for vector fallback

## Key Embedding Generation Patterns

### 1. Direct Text Query Pattern
```typescript
const { generateQueryEmbedding } = await import('./search.js');
const queryEmbedding = await generateQueryEmbedding(searchQuery);
return vectorSearch(neo4jDriver, queryEmbedding, ...);
```

### 2. Fallback Vector Search Pattern
```typescript
// Try exact match first
if (exactMatchFailed) {
  const { generateQueryEmbedding } = await import('./search.js');
  const queryEmbedding = await generateQueryEmbedding(nodeName);
  const searchResult = await vectorSearch(neo4jDriver, queryEmbedding, ...);
}
```

### 3. Node Embedding Pattern
```typescript
// First get the embedding from the node
const embeddingResult = await session.executeRead(tx => tx.run(`
  MATCH (n {name: $nodeName})
  RETURN n.embedding as embedding
`, { nodeName }));

const embedding = embeddingResult.records[0]?.get('embedding');
// Use node's embedding directly for vector search
```

## Implementation Guidelines

1. **When receiving text input from users:**
   - Always convert to embeddings using `generateQueryEmbedding`
   - Pass the resulting embedding array to vectorSearch

2. **When working with existing nodes:**
   - First try to retrieve the node embedding from the database
   - If the node has an embedding, use it directly for similar node searches
   - If the node doesn't have an embedding, generate one using the node name

3. **Error handling:**
   - Always validate that embeddings are arrays before using them
   - Provide meaningful error messages when embeddings can't be generated
   - Fall back to other search methods when vector search isn't possible

4. **Efficiency considerations:**
   - Cache embeddings when appropriate to reduce API calls
   - Use dynamic imports for the embedding generator to improve initial load time
   - Consider batch processing embeddings for multiple search terms

## Common Pitfalls to Avoid

1. Never pass raw text strings directly to vectorSearch functions
2. Don't assume node embeddings exist in the database - always check
3. Be cautious with embedding dimensions - ensure they match your vector index configuration
4. Remember that OpenAI embedding API calls have usage costs - optimize where possible
5. Never pass Neo4j node objects directly as parameters in Cypher queries - extract relevant properties like IDs instead
6. Always exclude embedding fields from the final results returned to clients

## Neo4j-Specific Considerations

### 1. Handling Node Objects in Cypher Queries

When working with node objects from previous query results:

```typescript
// ❌ INCORRECT: Passing Neo4j node objects directly as parameters
const result = await session.executeRead(tx => tx.run(`
  CALL apoc.path.subgraphAll($startNodes, {...})
`, { startNodes }));

// ✅ CORRECT: Extract node IDs and use them in the query
const startNodeIds = startNodes.map(node => node.identity);
const result = await session.executeRead(tx => tx.run(`
  MATCH (startNode)
  WHERE id(startNode) IN $startNodeIds
  CALL apoc.path.subgraphAll(startNode, {...})
`, { startNodeIds }));
```

### 2. Excluding Embedding Fields & Simplifying Neo4j Data Types

When processing Neo4j nodes before returning to clients:

```typescript
// ❌ INCORRECT: Including all properties (with large embedding vectors)
for (const key in entityNode.properties) {
  if (key !== 'name' && key !== 'nodeType') {
    entity[key] = entityNode.properties[key];
  }
}

// ✅ CORRECT: Explicitly excluding embedding fields and simplifying Neo4j data types
for (const key in entityNode.properties) {
  if (key !== 'name' && key !== 'nodeType' && 
      key !== 'embedding' && !key.endsWith('Embedding')) {
      
    const value = entityNode.properties[key];
    
    // Simplify Neo4j Integer objects
    if (value && typeof value === 'object' && 'low' in value && 'high' in value) {
      entity[key] = value.low; // Just use the 'low' part of Neo4j Integers
    }
    // Simplify Neo4j DateTime objects
    else if (value && typeof value === 'object' && 
             value.year && typeof value.year === 'object' && 'low' in value.year) {
      // Format as ISO-like date string
      const dateString = `${value.year.low}-${value.month.low}-${value.day.low}`;
      const timeString = `${value.hour.low}:${value.minute.low}:${value.second.low}`;
      entity[key] = `${dateString}T${timeString}`;
    }
    // Regular values
    else {
      entity[key] = value;
    }
  }
}
```

These patterns help avoid common errors like "It is not allowed to pass nodes in query parameters" and prevent large embedding vectors from being included in API responses. They also simplify Neo4j's verbose date/time and integer representations to make the results more readable and user-friendly.