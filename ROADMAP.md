# Roadmap

Prioritized improvements identified in the August 2026 project review. Items are
roughly ordered within each section; nothing here is a commitment.

## Protocol & SDK

- ~~**Structured tool output**~~ — done: all tools declare `outputSchema` and
  return `structuredContent` alongside the JSON text blocks.
- ~~**Migrate to the SDK's high-level `McpServer` API**~~ — done: tools and
  prompts are registered via `registerTool` / `registerPrompt` with zod
  schemas and input validation.
- **Track spec 2026-07-28** — the stateless protocol core (`server/discover`,
  `resultType`, `_meta`-carried version/capabilities) is handled by the SDK;
  keep the SDK current and re-test against new client releases. Roots,
  Sampling, and Logging are deprecated — this server uses none of them
  (stderr logging is the recommended pattern and is what we do).

## Tool design

- **Merge-not-overwrite upserts** — `createNodes`/`createRelations` currently
  replace field values on conflict (`= excluded.*`), so re-creating a node with
  sparser data silently discards prior fields. Switch to COALESCE-style merge
  semantics, then relax the `destructiveHint: true` annotations on the write
  tools to `false` (they become genuinely additive).
- **Consolidate `relationType` / `relationshipType`** in `create_relations` —
  two overlapping fields (free string + enum) confuse models filling the
  schema. Keep one; accept the enum values as suggestions, not a closed set.
- **Expose alias management** — the `aliases` table is written on node creation
  but there is no tool to add aliases to an existing node or resolve an alias
  explicitly. Useful for entity resolution.
- **`contentHash` in `add_sources`** — the schema and `Source` type define it,
  but the tool's input schema omits it. Add it for dedup/provenance integrity.

## Search

- **Semantic/vector search** — complement FTS5 with embedding-based similarity
  (e.g. `sqlite-vec`), keeping the zero-infrastructure, single-file ethos.
  Requires deciding where embeddings come from (client-supplied vs. a local
  model vs. none by default).

## Testing & tooling

- **MCP-layer tests** — storage is tested (`sqlite.spec.ts`) but no test
  exercises the tool handlers or prompts. Use the SDK's `InMemoryTransport`
  linked client/server pair to test the full request path.
- **Fold `libs/graphrag-memory` into the server** — the library is ~40 lines of
  interfaces consumed by a single import in `src/types/index.ts`; the monorepo
  indirection isn't earning its keep.

## Housekeeping

- Delete `manage_instances.py` and `requirements.txt` (Neo4j Aura leftovers)
  and the empty `org/` directory.
