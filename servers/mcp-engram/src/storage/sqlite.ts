import Database from 'better-sqlite3';
import * as fs from 'fs';
import * as path from 'path';
import { SCHEMA_DDL } from './schema.js';
import { buildFtsQuery } from './fts.js';
import { validateProvenance as validateProvenanceImpl } from './validation.js';
import type {
  Entity,
  Relation,
  KnowledgeGraph,
  StorageBackend,
  ExploreOptions,
  TemporalOptions,
  ValidationResult,
  ReasoningChainInput,
  ReasoningStepInput,
  ConflictPair,
  AssessClaimsResult,
} from '../types/index.js';

// ---- helpers ----

/** Well-known columns on the `nodes` table (everything else goes into `properties`). */
const NODE_COLUMNS = new Set([
  'name',
  'node_type',
  'sub_type',
  'status',
  'description',
  'statement',
  'content',
  'confidence',
  'properties',
  'search_text',
  'created_at',
  'updated_at',
]);

/** Relation types considered "temporal" for directed CTE traversal. */
const TEMPORAL_RELATION_TYPES = new Set([
  'FOLLOWS',
  'CAUSES',
  'NEXT',
  'AFTER',
  'BEFORE',
  'PREVIOUS',
  'before',
  'after',
  'next',
  'previous',
  'causes',
  'causedBy',
]);

/** Build the search_text column from various fields. */
function buildSearchText(entity: Entity): string {
  const parts: string[] = [entity.name];
  if (entity.description) parts.push(entity.description);
  if (entity.statement) parts.push(entity.statement);
  if (entity.content) parts.push(entity.content);
  if (entity.thoughtContent) parts.push(entity.thoughtContent);
  if (entity.definition) parts.push(entity.definition);
  if (entity.hypothesis) parts.push(entity.hypothesis);
  if (entity.conclusion) parts.push(entity.conclusion);
  return parts.join(' ');
}

/** Split an Entity into DB columns + a properties JSON blob. */
function entityToRow(entity: Entity) {
  const nodeType = entity.entityType;
  const subType = entity.subType ?? null;
  const description = entity.description ?? null;
  const statement = entity.statement ?? null;
  const content = entity.content ?? entity.thoughtContent ?? null;
  const confidence = entity.confidence ?? entity.confidenceScore ?? null;
  const status =
    confidence !== null && confidence < 0.5 ? 'candidate' : 'active';
  const searchText = buildSearchText(entity);

  // Everything that is not a top-level DB column goes into `properties`
  const props: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entity)) {
    if (
      k === 'name' ||
      k === 'entityType' ||
      k === 'observations' ||
      NODE_COLUMNS.has(k)
    ) {
      continue;
    }
    if (v !== undefined && v !== null) {
      props[k] = v;
    }
  }

  return {
    name: entity.name,
    nodeType,
    subType,
    status,
    description,
    statement,
    content,
    confidence,
    properties: JSON.stringify(props),
    searchText,
  };
}

/** Reconstitute an Entity from a DB row. */
function rowToEntity(row: Record<string, unknown>): Entity {
  const props =
    typeof row.properties === 'string'
      ? (JSON.parse(row.properties) as Record<string, unknown>)
      : {};

  const entity: Entity = {
    name: row.name as string,
    entityType: row.node_type as string,
    observations: [],
    ...props,
  };

  if (row.description) entity.description = row.description as string;
  if (row.statement) entity.statement = row.statement as string;
  if (row.content) entity.content = row.content as string;
  if (row.confidence !== null && row.confidence !== undefined)
    entity.confidence = row.confidence as number;
  if (row.sub_type) entity.subType = row.sub_type as string;

  return entity;
}

function rowToRelation(row: Record<string, unknown>): Relation {
  const props =
    typeof row.properties === 'string'
      ? (JSON.parse(row.properties) as Record<string, unknown>)
      : {};

  return {
    from: row.from_node as string,
    to: row.to_node as string,
    relationType: row.relation_type as string,
    context: (row.context as string) ?? undefined,
    confidenceScore: (row.confidence as number) ?? undefined,
    weight: (row.weight as number) ?? undefined,
    ...props,
  };
}

// ---- implementation ----

export class SqliteBackend implements StorageBackend {
  private db!: Database.Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath =
      dbPath ??
      process.env.MCP_ENGRAM_DB_PATH ??
      path.join(
        process.env.HOME ?? process.env.USERPROFILE ?? '.',
        '.mcp-engram',
        'knowledge.db'
      );
  }

  // ---------- lifecycle ----------

  initialize(): void {
    // Ensure the directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.exec(SCHEMA_DDL);
  }

  close(): void {
    this.db?.close();
  }

  // ---------- write ----------

  createNodes(nodes: Entity[]): Entity[] {
    const upsert = this.db.prepare(`
      INSERT INTO nodes (name, node_type, sub_type, status, description, statement, content, confidence, properties, search_text)
      VALUES (@name, @nodeType, @subType, @status, @description, @statement, @content, @confidence, @properties, @searchText)
      ON CONFLICT(name) DO UPDATE SET
        node_type   = excluded.node_type,
        sub_type    = excluded.sub_type,
        status      = excluded.status,
        description = excluded.description,
        statement   = excluded.statement,
        content     = excluded.content,
        confidence  = excluded.confidence,
        properties  = excluded.properties,
        search_text = excluded.search_text,
        updated_at  = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    `);

    const insertObs = this.db.prepare(
      'INSERT INTO observations (node_name, content) VALUES (?, ?)'
    );

    const insertAlias = this.db.prepare(
      'INSERT OR IGNORE INTO aliases (alias, canonical_name) VALUES (?, ?)'
    );

    const tx = this.db.transaction((entities: Entity[]) => {
      for (const entity of entities) {
        const row = entityToRow(entity);
        upsert.run(row);

        // observations
        if (entity.observations?.length) {
          for (const obs of entity.observations) {
            insertObs.run(entity.name, obs);
          }
        }

        // aliases
        if (entity.aliases?.length) {
          for (const alias of entity.aliases) {
            insertAlias.run(alias.toLowerCase(), entity.name);
          }
        }
      }
    });

    tx(nodes);
    return nodes;
  }

  createRelations(relations: Relation[]): Relation[] {
    const upsert = this.db.prepare(`
      INSERT INTO edges (from_node, to_node, relation_type, confidence, weight, context, properties)
      VALUES (@from, @to, @relationType, @confidence, @weight, @context, @properties)
      ON CONFLICT(from_node, to_node, relation_type) DO UPDATE SET
        confidence = excluded.confidence,
        weight     = excluded.weight,
        context    = excluded.context,
        properties = excluded.properties
    `);

    const tx = this.db.transaction((rels: Relation[]) => {
      for (const rel of rels) {
        const props: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(rel)) {
          if (
            [
              'from',
              'to',
              'relationType',
              'context',
              'confidenceScore',
              'weight',
            ].includes(k)
          )
            continue;
          if (v !== undefined && v !== null) props[k] = v;
        }

        upsert.run({
          from: rel.from,
          to: rel.to,
          relationType: rel.relationType,
          confidence: rel.confidenceScore ?? null,
          weight: rel.weight ?? 0.5,
          context: rel.context ?? null,
          properties: JSON.stringify(props),
        });
      }
    });

    tx(relations);
    return relations;
  }

  deleteNodes(names: string[]): void {
    const del = this.db.prepare('DELETE FROM nodes WHERE name = ?');
    const tx = this.db.transaction((ns: string[]) => {
      for (const n of ns) del.run(n);
    });
    tx(names);
  }

  deleteRelations(
    relations: { from: string; to: string; relationType: string }[]
  ): void {
    const del = this.db.prepare(
      'DELETE FROM edges WHERE from_node = ? AND to_node = ? AND relation_type = ?'
    );
    const tx = this.db.transaction(
      (rels: { from: string; to: string; relationType: string }[]) => {
        for (const r of rels) del.run(r.from, r.to, r.relationType);
      }
    );
    tx(relations);
  }

  addObservations(
    observations: { nodeName: string; contents: string[] }[]
  ): void {
    const ins = this.db.prepare(
      'INSERT INTO observations (node_name, content) VALUES (?, ?)'
    );
    const tx = this.db.transaction(
      (obs: { nodeName: string; contents: string[] }[]) => {
        for (const o of obs) {
          for (const c of o.contents) {
            ins.run(o.nodeName, c);
          }
        }
      }
    );
    tx(observations);
  }

  // ---------- search ----------

  searchNodes(
    query: string,
    filter?: { nodeTypes?: string[]; limit?: number }
  ): KnowledgeGraph {
    const limit = filter?.limit ?? 20;
    const ftsQuery = buildFtsQuery(query);

    let rows: Record<string, unknown>[];
    if (ftsQuery) {
      if (filter?.nodeTypes?.length) {
        const placeholders = filter.nodeTypes.map(() => '?').join(',');
        rows = this.db
          .prepare(
            `SELECT n.*, bm25(nodes_fts) AS rank
             FROM nodes_fts fts
             JOIN nodes n ON n.rowid = fts.rowid
             WHERE nodes_fts MATCH ?
               AND n.node_type IN (${placeholders})
             ORDER BY rank
             LIMIT ?`
          )
          .all(ftsQuery, ...filter.nodeTypes, limit) as Record<
          string,
          unknown
        >[];
      } else {
        rows = this.db
          .prepare(
            `SELECT n.*, bm25(nodes_fts) AS rank
             FROM nodes_fts fts
             JOIN nodes n ON n.rowid = fts.rowid
             WHERE nodes_fts MATCH ?
             ORDER BY rank
             LIMIT ?`
          )
          .all(ftsQuery, limit) as Record<string, unknown>[];
      }
    } else {
      rows = [];
    }

    const entities = rows.map(rowToEntity);
    this.attachObservations(entities);

    // Fetch edges between found entities
    const relations = this.getEdgesBetween(entities.map((e) => e.name));

    return { entities, relations };
  }

  getNodeByName(name: string): Entity | null {
    const row = this.db
      .prepare('SELECT * FROM nodes WHERE name = ?')
      .get(name) as Record<string, unknown> | undefined;

    if (!row) {
      // try alias resolution
      const alias = this.resolveAlias(name);
      if (alias) {
        return this.getNodeByName(alias);
      }
      return null;
    }

    const entity = rowToEntity(row);
    this.attachObservations([entity]);
    return entity;
  }

  getNodesByNames(names: string[]): Entity[] {
    if (names.length === 0) return [];
    const placeholders = names.map(() => '?').join(',');
    const rows = this.db
      .prepare(`SELECT * FROM nodes WHERE name IN (${placeholders})`)
      .all(...names) as Record<string, unknown>[];

    const entities = rows.map(rowToEntity);
    this.attachObservations(entities);
    return entities;
  }

  resolveAlias(alias: string): string | null {
    const row = this.db
      .prepare(
        'SELECT canonical_name FROM aliases WHERE alias = ? ORDER BY match_score DESC LIMIT 1'
      )
      .get(alias.toLowerCase()) as { canonical_name: string } | undefined;

    return row?.canonical_name ?? null;
  }

  // ---------- graph traversal ----------

  exploreContext(
    nodeNames: string[],
    options?: ExploreOptions
  ): KnowledgeGraph {
    const maxDepth = options?.maxDepth ?? 2;
    const minWeight = options?.minWeight ?? 0.0;

    if (nodeNames.length === 0) return { entities: [], relations: [] };

    const placeholders = nodeNames.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `WITH RECURSIVE reachable(name, depth) AS (
           SELECT name, 0 FROM nodes WHERE name IN (${placeholders})
           UNION
           SELECT
             CASE WHEN e.from_node = r.name THEN e.to_node ELSE e.from_node END,
             r.depth + 1
           FROM reachable r
           JOIN edges e ON (e.from_node = r.name OR e.to_node = r.name)
           WHERE r.depth < ?
             AND COALESCE(e.weight, 0.5) >= ?
         )
         SELECT DISTINCT n.* FROM reachable r
         JOIN nodes n ON n.name = r.name`
      )
      .all(...nodeNames, maxDepth, minWeight) as Record<string, unknown>[];

    let entities = rows.map(rowToEntity);
    this.attachObservations(entities);

    if (options?.includeTypes?.length) {
      const types = new Set(options.includeTypes);
      entities = entities.filter((e) => types.has(e.entityType));
    }

    const relations = this.getEdgesBetween(entities.map((e) => e.name));

    return { entities, relations };
  }

  getTemporalSequence(
    startNode: string,
    options?: TemporalOptions
  ): KnowledgeGraph {
    const direction = options?.direction ?? 'both';
    const maxEvents = options?.maxEvents ?? 10;
    const temporalTypes = [...TEMPORAL_RELATION_TYPES]
      .map(() => '?')
      .join(',');
    const temporalParams = [...TEMPORAL_RELATION_TYPES];

    let rows: Record<string, unknown>[];

    if (direction === 'forward' || direction === 'both') {
      const fwd = this.db
        .prepare(
          `WITH RECURSIVE seq(name, depth) AS (
             SELECT ?, 0
             UNION
             SELECT e.to_node, s.depth + 1
             FROM seq s
             JOIN edges e ON e.from_node = s.name
             WHERE e.relation_type IN (${temporalTypes})
               AND s.depth < ?
           )
           SELECT DISTINCT n.* FROM seq s JOIN nodes n ON n.name = s.name`
        )
        .all(startNode, ...temporalParams, maxEvents) as Record<
        string,
        unknown
      >[];
      rows = fwd;
    } else {
      rows = [];
    }

    if (direction === 'backward' || direction === 'both') {
      const bwd = this.db
        .prepare(
          `WITH RECURSIVE seq(name, depth) AS (
             SELECT ?, 0
             UNION
             SELECT e.from_node, s.depth + 1
             FROM seq s
             JOIN edges e ON e.to_node = s.name
             WHERE e.relation_type IN (${temporalTypes})
               AND s.depth < ?
           )
           SELECT DISTINCT n.* FROM seq s JOIN nodes n ON n.name = s.name`
        )
        .all(startNode, ...temporalParams, maxEvents) as Record<
        string,
        unknown
      >[];

      // Merge, avoiding duplicates
      const seen = new Set(rows.map((r) => r.name));
      for (const r of bwd) {
        if (!seen.has(r.name)) {
          rows.push(r);
          seen.add(r.name as string);
        }
      }
    }

    const entities = rows.map(rowToEntity);
    this.attachObservations(entities);
    const relations = this.getEdgesBetween(entities.map((e) => e.name));

    return { entities, relations };
  }

  findShortestPath(
    from: string,
    to: string,
    maxDepth = 6
  ): KnowledgeGraph {
    // BFS via recursive CTE with path tracking
    const rows = this.db
      .prepare(
        `WITH RECURSIVE bfs(name, depth, path) AS (
           SELECT ?, 0, ?
           UNION
           SELECT
             CASE WHEN e.from_node = b.name THEN e.to_node ELSE e.from_node END,
             b.depth + 1,
             b.path || ',' || CASE WHEN e.from_node = b.name THEN e.to_node ELSE e.from_node END
           FROM bfs b
           JOIN edges e ON (e.from_node = b.name OR e.to_node = b.name)
           WHERE b.depth < ?
             AND instr(b.path, CASE WHEN e.from_node = b.name THEN e.to_node ELSE e.from_node END) = 0
         )
         SELECT path FROM bfs WHERE name = ? ORDER BY depth LIMIT 1`
      )
      .get(from, from, maxDepth, to) as { path: string } | undefined;

    if (!rows) return { entities: [], relations: [] };

    const names = rows.path.split(',');
    const entities = this.getNodesByNames(names);
    const relations = this.getEdgesBetween(names);

    return { entities, relations };
  }

  // ---------- reasoning ----------

  createReasoningChain(
    chain: ReasoningChainInput,
    steps: ReasoningStepInput[]
  ): Entity {
    // Create the chain node
    const chainEntity: Entity = {
      name: chain.name,
      entityType: 'ReasoningChain',
      observations: [],
      description: chain.description,
      conclusion: chain.conclusion,
      confidenceScore: chain.confidenceScore,
      content: chain.conclusion,
      confidence: chain.confidenceScore,
      methodology: chain.methodology ?? 'mixed',
      domain: chain.domain,
      tags: chain.tags,
      sourceThought: chain.sourceThought,
      alternativeConclusionsConsidered: chain.alternativeConclusionsConsidered,
      numberOfSteps: steps.length,
    };

    this.createNodes([chainEntity]);

    // Create step nodes + HAS_STEP edges
    const stepEntities: Entity[] = steps.map((s) => ({
      name: s.name,
      entityType: 'ReasoningStep',
      observations: [],
      content: s.content,
      stepType: s.stepType,
      stepNumber: s.stepNumber,
      confidence: s.confidence,
      evidenceType: s.evidenceType,
      supportingReferences: s.supportingReferences,
      alternatives: s.alternatives,
      counterarguments: s.counterarguments,
      assumptions: s.assumptions,
      formalNotation: s.formalNotation,
      chainName: chain.name,
    }));

    if (stepEntities.length) {
      this.createNodes(stepEntities);
    }

    const stepRelations: Relation[] = steps.map((s) => ({
      from: chain.name,
      to: s.name,
      relationType: 'HAS_STEP',
      weight: 1.0,
      context: `Step ${s.stepNumber} of reasoning chain "${chain.name}"`,
    }));

    // Also link sequential steps
    for (let i = 1; i < steps.length; i++) {
      stepRelations.push({
        from: steps[i - 1].name,
        to: steps[i].name,
        relationType: 'NEXT',
        weight: 0.8,
      });
    }

    // Link to source thought if provided
    if (chain.sourceThought) {
      stepRelations.push({
        from: chain.name,
        to: chain.sourceThought,
        relationType: 'DERIVED_FROM',
        weight: 0.9,
      });
    }

    if (stepRelations.length) {
      this.createRelations(stepRelations);
    }

    return chainEntity;
  }

  getReasoningChain(chainName: string): KnowledgeGraph {
    const chain = this.getNodeByName(chainName);
    if (!chain) return { entities: [], relations: [] };

    // Get steps via HAS_STEP edges
    const stepRows = this.db
      .prepare(
        `SELECT n.* FROM edges e
         JOIN nodes n ON n.name = e.to_node
         WHERE e.from_node = ? AND e.relation_type = 'HAS_STEP'
         ORDER BY json_extract(n.properties, '$.stepNumber')`
      )
      .all(chainName) as Record<string, unknown>[];

    const steps = stepRows.map(rowToEntity);
    this.attachObservations(steps);

    const entities = [chain, ...steps];
    const relations = this.getEdgesBetween(entities.map((e) => e.name));

    return { entities, relations };
  }

  findReasoningChains(topics: string[], limit = 3): KnowledgeGraph {
    if (topics.length === 0) return { entities: [], relations: [] };

    // Search chains whose name/description/conclusion match any topic
    const ftsQuery = buildFtsQuery(topics.join(' '));
    if (!ftsQuery) return { entities: [], relations: [] };

    const chainRows = this.db
      .prepare(
        `SELECT n.* FROM nodes_fts fts
         JOIN nodes n ON n.rowid = fts.rowid
         WHERE nodes_fts MATCH ?
           AND n.node_type = 'ReasoningChain'
         ORDER BY bm25(nodes_fts)
         LIMIT ?`
      )
      .all(ftsQuery, limit) as Record<string, unknown>[];

    const allEntities: Entity[] = [];
    const allRelations: Relation[] = [];

    for (const row of chainRows) {
      const graph = this.getReasoningChain(row.name as string);
      allEntities.push(...graph.entities);
      allRelations.push(...graph.relations);
    }

    // Deduplicate
    const seenEntities = new Map<string, Entity>();
    for (const e of allEntities) seenEntities.set(e.name, e);

    const seenRelations = new Set<string>();
    const uniqueRelations: Relation[] = [];
    for (const r of allRelations) {
      const key = `${r.from}|${r.to}|${r.relationType}`;
      if (!seenRelations.has(key)) {
        seenRelations.add(key);
        uniqueRelations.push(r);
      }
    }

    return {
      entities: [...seenEntities.values()],
      relations: uniqueRelations,
    };
  }

  // ---------- validation ----------

  validateProvenance(nodeName: string): ValidationResult {
    return validateProvenanceImpl(this.db, nodeName);
  }

  // ---------- conflict detection & confidence propagation ----------

  detectConflicts(nodeNames?: string[]): ConflictPair[] {
    const conflicts: ConflictPair[] = [];

    // Find explicit CONTRADICTS edges (deduplicated for bidirectional pairs)
    let rows: Record<string, unknown>[];
    if (nodeNames?.length) {
      const placeholders = nodeNames.map(() => '?').join(',');
      rows = this.db
        .prepare(
          `SELECT DISTINCT
             CASE WHEN from_node < to_node THEN from_node ELSE to_node END AS node_a,
             CASE WHEN from_node < to_node THEN to_node ELSE from_node END AS node_b
           FROM edges
           WHERE relation_type IN ('contradicts', 'CONTRADICTS')
             AND (from_node IN (${placeholders}) OR to_node IN (${placeholders}))`
        )
        .all(...nodeNames, ...nodeNames) as Record<string, unknown>[];
    } else {
      rows = this.db
        .prepare(
          `SELECT DISTINCT
             CASE WHEN from_node < to_node THEN from_node ELSE to_node END AS node_a,
             CASE WHEN from_node < to_node THEN to_node ELSE from_node END AS node_b
           FROM edges
           WHERE relation_type IN ('contradicts', 'CONTRADICTS')`
        )
        .all() as Record<string, unknown>[];
    }

    if (rows.length === 0) return conflicts;

    // Bulk fetch entities
    const allNames = new Set<string>();
    for (const row of rows) {
      allNames.add(row.node_a as string);
      allNames.add(row.node_b as string);
    }
    const entityMap = new Map<string, Entity>();
    for (const e of this.getNodesByNames([...allNames])) {
      entityMap.set(e.name, e);
    }

    for (const row of rows) {
      const a = entityMap.get(row.node_a as string);
      const b = entityMap.get(row.node_b as string);
      if (a && b) {
        conflicts.push({
          nodeA: a,
          nodeB: b,
          type: 'explicit',
          reason: `CONTRADICTS edge between "${a.name}" and "${b.name}"`,
        });
      }
    }

    return conflicts;
  }

  computeEffectiveConfidence(nodeName: string): {
    effectiveConfidence: number;
    sources: Array<{ source: Entity; reliability: number }>;
  } {
    const node = this.getNodeByName(nodeName);
    if (!node) {
      return { effectiveConfidence: 0, sources: [] };
    }

    const storedConfidence = node.confidence ?? 1.0;

    // Find Source nodes linked via DERIVED_FROM or CITES edges
    const sourceRows = this.db
      .prepare(
        `SELECT n.* FROM edges e
         JOIN nodes n ON n.name = e.to_node AND n.node_type = 'Source'
         WHERE e.from_node = ?
           AND e.relation_type IN ('derivedFrom', 'cites', 'DERIVED_FROM', 'CITES')`
      )
      .all(nodeName) as Record<string, unknown>[];

    const sources: Array<{ source: Entity; reliability: number }> = [];
    for (const row of sourceRows) {
      const sourceEntity = rowToEntity(row);
      const reliability = sourceEntity.reliability ?? 1.0;
      sources.push({ source: sourceEntity, reliability });
    }

    let effectiveConfidence: number;
    if (sources.length === 0) {
      effectiveConfidence = storedConfidence;
    } else {
      const avgReliability =
        sources.reduce((sum, s) => sum + s.reliability, 0) / sources.length;
      effectiveConfidence = storedConfidence * avgReliability;
    }

    return { effectiveConfidence, sources };
  }

  assessClaims(query: string, nodeNames?: string[]): AssessClaimsResult {
    // 1. Get nodes to assess
    let entities: Entity[];
    if (nodeNames?.length) {
      entities = this.getNodesByNames(nodeNames);
    } else {
      const graph = this.searchNodes(query, {
        nodeTypes: ['Proposition', 'ScientificInsight', 'Thought'],
      });
      entities = graph.entities;
    }

    if (entities.length === 0) {
      return { assessments: [], conflicts: [], summary: 'No matching claims found.' };
    }

    // 2. Detect conflicts scoped to found nodes
    const names = entities.map((e) => e.name);
    const conflicts = this.detectConflicts(names);

    // 3. Compute effective confidence for each node
    const conflictsByNode = new Map<string, ConflictPair[]>();
    for (const c of conflicts) {
      for (const n of [c.nodeA.name, c.nodeB.name]) {
        if (!conflictsByNode.has(n)) conflictsByNode.set(n, []);
        conflictsByNode.get(n)!.push(c);
      }
    }

    const assessments = entities.map((node) => {
      const { effectiveConfidence, sources } =
        this.computeEffectiveConfidence(node.name);
      return {
        node,
        storedConfidence: node.confidence ?? 1.0,
        effectiveConfidence,
        sources,
        conflicts: conflictsByNode.get(node.name) ?? [],
      };
    });

    // 4. Build summary
    const conflictCount = conflicts.length;
    const lowConfidence = assessments.filter(
      (a) => a.effectiveConfidence < 0.5
    ).length;
    const parts: string[] = [
      `Assessed ${assessments.length} claim(s).`,
    ];
    if (conflictCount > 0) {
      parts.push(`Found ${conflictCount} conflict(s).`);
    }
    if (lowConfidence > 0) {
      parts.push(
        `${lowConfidence} claim(s) have effective confidence below 0.5.`
      );
    }
    if (conflictCount === 0 && lowConfidence === 0) {
      parts.push('No conflicts or low-confidence claims detected.');
    }

    return {
      assessments,
      conflicts,
      summary: parts.join(' '),
    };
  }

  // ---------- private helpers ----------

  private attachObservations(entities: Entity[]): void {
    if (entities.length === 0) return;
    const names = entities.map((e) => e.name);
    const placeholders = names.map(() => '?').join(',');
    const obsRows = this.db
      .prepare(
        `SELECT node_name, content FROM observations WHERE node_name IN (${placeholders}) ORDER BY created_at`
      )
      .all(...names) as { node_name: string; content: string }[];

    const obsMap = new Map<string, string[]>();
    for (const o of obsRows) {
      if (!obsMap.has(o.node_name)) obsMap.set(o.node_name, []);
      obsMap.get(o.node_name)!.push(o.content);
    }

    for (const e of entities) {
      e.observations = obsMap.get(e.name) ?? [];
    }
  }

  private getEdgesBetween(names: string[]): Relation[] {
    if (names.length === 0) return [];
    const placeholders = names.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT * FROM edges
         WHERE from_node IN (${placeholders}) AND to_node IN (${placeholders})`
      )
      .all(...names, ...names) as Record<string, unknown>[];

    return rows.map(rowToRelation);
  }
}
