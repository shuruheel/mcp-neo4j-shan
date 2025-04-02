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