import { SqliteBackend } from '../sqlite';
import type { Entity } from '../../types';
let backend: SqliteBackend;
beforeEach(() => {
  backend = new SqliteBackend(':memory:');
  backend.initialize();
});
afterEach(() => {
  backend.close();
});
// ---- schema ----
describe('schema', () => {
  it('creates tables and indexes without error', () => {
    // initialize was called in beforeEach — just verify we can query
    const nodes = (backend as any).db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='nodes'",
      )
      .get();
    expect(nodes).toBeDefined();
  });
  it('creates FTS virtual table', () => {
    const fts = (backend as any).db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='nodes_fts'",
      )
      .get();
    expect(fts).toBeDefined();
  });
});
// ---- node CRUD ----
describe('createNodes', () => {
  it('creates and retrieves an Entity node', () => {
    const entity: Entity = {
      name: 'Albert Einstein',
      entityType: 'Entity',
      observations: ['Physicist', 'Nobel Prize 1921'],
      description: 'Theoretical physicist',
      subType: 'Person',
      confidence: 0.95,
    };
    backend.createNodes([entity]);
    const result = backend.getNodeByName('Albert Einstein');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Albert Einstein');
    expect(result!.entityType).toBe('Entity');
    expect(result!.observations).toEqual(['Physicist', 'Nobel Prize 1921']);
    expect(result!.description).toBe('Theoretical physicist');
  });
  it('upserts on conflict', () => {
    backend.createNodes([
      { name: 'A', entityType: 'Entity', observations: ['v1'] },
    ]);
    backend.createNodes([
      {
        name: 'A',
        entityType: 'Entity',
        observations: ['v2'],
        description: 'updated',
      },
    ]);
    const result = backend.getNodeByName('A');
    expect(result!.description).toBe('updated');
    // observations accumulate
    expect(result!.observations).toContain('v1');
    expect(result!.observations).toContain('v2');
  });
  it('creates all 15 node types', () => {
    const types = [
      'Entity',
      'Event',
      'Concept',
      'Attribute',
      'Proposition',
      'Emotion',
      'Agent',
      'ScientificInsight',
      'Law',
      'Location',
      'Thought',
      'ReasoningChain',
      'ReasoningStep',
      'Source',
      'EmotionalEvent',
    ];
    const nodes: Entity[] = types.map((t) => ({
      name: `test-${t}`,
      entityType: t,
      observations: [],
    }));
    backend.createNodes(nodes);
    for (const t of types) {
      const n = backend.getNodeByName(`test-${t}`);
      expect(n).not.toBeNull();
      expect(n!.entityType).toBe(t);
    }
  });
  it('marks low-confidence nodes as candidate', () => {
    backend.createNodes([
      {
        name: 'weak',
        entityType: 'Proposition',
        observations: [],
        confidence: 0.3,
      },
    ]);
    const row = (backend as any).db
      .prepare('SELECT status FROM nodes WHERE name = ?')
      .get('weak');
    expect(row.status).toBe('candidate');
  });
});
describe('deleteNodes', () => {
  it('deletes nodes and cascades to edges', () => {
    backend.createNodes([
      { name: 'A', entityType: 'Entity', observations: [] },
      { name: 'B', entityType: 'Entity', observations: [] },
    ]);
    backend.createRelations([{ from: 'A', to: 'B', relationType: 'KNOWS' }]);
    backend.deleteNodes(['A']);
    expect(backend.getNodeByName('A')).toBeNull();
    // Edge should be gone too (CASCADE)
    const edges = (backend as any).db
      .prepare('SELECT * FROM edges WHERE from_node = ?')
      .all('A');
    expect(edges).toHaveLength(0);
  });
});
// ---- relations ----
describe('createRelations', () => {
  it('creates and retrieves relations', () => {
    backend.createNodes([
      { name: 'A', entityType: 'Entity', observations: [] },
      { name: 'B', entityType: 'Concept', observations: [] },
    ]);
    backend.createRelations([
      {
        from: 'A',
        to: 'B',
        relationType: 'ADVOCATES',
        context: 'A supports B',
        weight: 0.8,
        confidenceScore: 0.9,
      },
    ]);
    const graph = backend.exploreContext(['A'], { maxDepth: 1 });
    expect(graph.relations.length).toBeGreaterThanOrEqual(1);
    const rel = graph.relations.find((r) => r.from === 'A' && r.to === 'B');
    expect(rel).toBeDefined();
    expect(rel!.relationType).toBe('ADVOCATES');
  });
  it('upserts on duplicate (from, to, relationType)', () => {
    backend.createNodes([
      { name: 'X', entityType: 'Entity', observations: [] },
      { name: 'Y', entityType: 'Entity', observations: [] },
    ]);
    backend.createRelations([
      { from: 'X', to: 'Y', relationType: 'KNOWS', weight: 0.5 },
    ]);
    backend.createRelations([
      { from: 'X', to: 'Y', relationType: 'KNOWS', weight: 0.9 },
    ]);
    const edges = (backend as any).db
      .prepare(
        "SELECT * FROM edges WHERE from_node = 'X' AND to_node = 'Y' AND relation_type = 'KNOWS'",
      )
      .all();
    expect(edges).toHaveLength(1);
    expect(edges[0].weight).toBe(0.9);
  });
});
describe('deleteRelations', () => {
  it('deletes specific relations', () => {
    backend.createNodes([
      { name: 'A', entityType: 'Entity', observations: [] },
      { name: 'B', entityType: 'Entity', observations: [] },
    ]);
    backend.createRelations([{ from: 'A', to: 'B', relationType: 'KNOWS' }]);
    backend.deleteRelations([{ from: 'A', to: 'B', relationType: 'KNOWS' }]);
    const edges = (backend as any).db
      .prepare('SELECT * FROM edges WHERE from_node = ? AND to_node = ?')
      .all('A', 'B');
    expect(edges).toHaveLength(0);
  });
});
// ---- observations ----
describe('addObservations', () => {
  it('adds observations to existing node', () => {
    backend.createNodes([
      { name: 'N', entityType: 'Entity', observations: ['initial'] },
    ]);
    backend.addObservations([{ nodeName: 'N', contents: ['obs1', 'obs2'] }]);
    const node = backend.getNodeByName('N');
    expect(node!.observations).toContain('initial');
    expect(node!.observations).toContain('obs1');
    expect(node!.observations).toContain('obs2');
  });
});
// ---- FTS search ----
describe('searchNodes', () => {
  beforeEach(() => {
    backend.createNodes([
      {
        name: 'Machine Learning',
        entityType: 'Concept',
        observations: [],
        description:
          'A field of artificial intelligence focused on learning from data',
        definition: 'Algorithms that improve through experience',
      },
      {
        name: 'Deep Learning',
        entityType: 'Concept',
        observations: [],
        description: 'A subset of machine learning using neural networks',
      },
      {
        name: 'Cooking Recipes',
        entityType: 'Entity',
        observations: [],
        description: 'A collection of cooking instructions',
      },
    ]);
  });
  it('finds nodes matching query', () => {
    const graph = backend.searchNodes('machine learning');
    expect(graph.entities.length).toBeGreaterThanOrEqual(1);
    expect(graph.entities.some((e) => e.name === 'Machine Learning')).toBe(
      true,
    );
  });
  it('ranks relevant results higher', () => {
    const graph = backend.searchNodes('learning');
    // Both ML and DL should appear, but "Machine Learning" has "learning" in the name
    expect(graph.entities.length).toBeGreaterThanOrEqual(2);
  });
  it('filters by nodeType', () => {
    const graph = backend.searchNodes('learning', {
      nodeTypes: ['Concept'],
    });
    for (const e of graph.entities) {
      expect(e.entityType).toBe('Concept');
    }
  });
  it('returns empty for no match', () => {
    const graph = backend.searchNodes('xyznonexistent');
    expect(graph.entities).toHaveLength(0);
  });
});
// ---- graph traversal ----
describe('exploreContext', () => {
  beforeEach(() => {
    backend.createNodes([
      { name: 'A', entityType: 'Entity', observations: [] },
      { name: 'B', entityType: 'Concept', observations: [] },
      { name: 'C', entityType: 'Entity', observations: [] },
      { name: 'D', entityType: 'Entity', observations: [] },
    ]);
    backend.createRelations([
      { from: 'A', to: 'B', relationType: 'RELATES_TO', weight: 0.8 },
      { from: 'B', to: 'C', relationType: 'RELATES_TO', weight: 0.7 },
      { from: 'C', to: 'D', relationType: 'RELATES_TO', weight: 0.6 },
    ]);
  });
  it('traverses to specified depth', () => {
    const graph = backend.exploreContext(['A'], { maxDepth: 2 });
    const names = graph.entities.map((e) => e.name);
    expect(names).toContain('A');
    expect(names).toContain('B');
    expect(names).toContain('C');
  });
  it('respects minWeight', () => {
    const graph = backend.exploreContext(['A'], {
      maxDepth: 3,
      minWeight: 0.75,
    });
    const names = graph.entities.map((e) => e.name);
    expect(names).toContain('A');
    expect(names).toContain('B');
    // C has edge weight 0.7 < 0.75 so should not be reached
    expect(names).not.toContain('C');
  });
});
describe('getTemporalSequence', () => {
  beforeEach(() => {
    backend.createNodes([
      { name: 'E1', entityType: 'Event', observations: [] },
      { name: 'E2', entityType: 'Event', observations: [] },
      { name: 'E3', entityType: 'Event', observations: [] },
    ]);
    backend.createRelations([
      { from: 'E1', to: 'E2', relationType: 'NEXT' },
      { from: 'E2', to: 'E3', relationType: 'NEXT' },
    ]);
  });
  it('follows forward temporal links', () => {
    const graph = backend.getTemporalSequence('E1', { direction: 'forward' });
    const names = graph.entities.map((e) => e.name);
    expect(names).toContain('E1');
    expect(names).toContain('E2');
    expect(names).toContain('E3');
  });
  it('follows backward temporal links', () => {
    const graph = backend.getTemporalSequence('E3', { direction: 'backward' });
    const names = graph.entities.map((e) => e.name);
    expect(names).toContain('E3');
    expect(names).toContain('E2');
    expect(names).toContain('E1');
  });
});
describe('findShortestPath', () => {
  it('finds a path between two nodes', () => {
    backend.createNodes([
      { name: 'S', entityType: 'Entity', observations: [] },
      { name: 'M', entityType: 'Entity', observations: [] },
      { name: 'T', entityType: 'Entity', observations: [] },
    ]);
    backend.createRelations([
      { from: 'S', to: 'M', relationType: 'CONNECTS' },
      { from: 'M', to: 'T', relationType: 'CONNECTS' },
    ]);
    const graph = backend.findShortestPath('S', 'T');
    const names = graph.entities.map((e) => e.name);
    expect(names).toContain('S');
    expect(names).toContain('M');
    expect(names).toContain('T');
  });
  it('returns empty for unreachable nodes', () => {
    backend.createNodes([
      { name: 'X', entityType: 'Entity', observations: [] },
      { name: 'Y', entityType: 'Entity', observations: [] },
    ]);
    const graph = backend.findShortestPath('X', 'Y');
    expect(graph.entities).toHaveLength(0);
  });
});
// ---- reasoning chains ----
describe('reasoning chains', () => {
  it('creates and retrieves a reasoning chain with steps', () => {
    const chain = backend.createReasoningChain(
      {
        name: 'TestChain',
        description: 'A test chain',
        conclusion: 'Testing works',
        confidenceScore: 0.9,
        methodology: 'deductive',
      },
      [
        {
          name: 'Step1',
          content: 'Premise one',
          stepNumber: 1,
          stepType: 'premise',
          confidence: 0.95,
        },
        {
          name: 'Step2',
          content: 'Inference from premise',
          stepNumber: 2,
          stepType: 'inference',
          confidence: 0.85,
        },
        {
          name: 'Step3',
          content: 'Conclusion reached',
          stepNumber: 3,
          stepType: 'conclusion',
          confidence: 0.9,
        },
      ],
    );
    expect(chain.name).toBe('TestChain');
    const graph = backend.getReasoningChain('TestChain');
    expect(graph.entities.length).toBe(4); // chain + 3 steps
    const chainNode = graph.entities.find(
      (e) => e.entityType === 'ReasoningChain',
    );
    expect(chainNode).toBeDefined();
    expect(chainNode!.name).toBe('TestChain');
    const steps = graph.entities.filter(
      (e) => e.entityType === 'ReasoningStep',
    );
    expect(steps).toHaveLength(3);
  });
  it('finds chains by topic search', () => {
    backend.createReasoningChain(
      {
        name: 'Climate Analysis',
        description: 'Analysis of climate change impacts',
        conclusion: 'Climate action is urgent',
        confidenceScore: 0.85,
      },
      [
        {
          name: 'CA_Step1',
          content: 'CO2 levels are rising',
          stepNumber: 1,
          stepType: 'premise',
          confidence: 0.99,
        },
      ],
    );
    const graph = backend.findReasoningChains(['climate']);
    expect(graph.entities.some((e) => e.name === 'Climate Analysis')).toBe(
      true,
    );
  });
});
// ---- aliases / entity resolution ----
describe('aliases', () => {
  it('resolves alias to canonical name', () => {
    backend.createNodes([
      {
        name: 'Albert Einstein',
        entityType: 'Entity',
        observations: [],
        aliases: ['einstein', 'A. Einstein'],
      },
    ]);
    expect(backend.resolveAlias('einstein')).toBe('Albert Einstein');
    expect(backend.resolveAlias('a. einstein')).toBe('Albert Einstein');
  });
  it('getNodeByName falls back to alias', () => {
    backend.createNodes([
      {
        name: 'Albert Einstein',
        entityType: 'Entity',
        observations: [],
        aliases: ['einstein'],
      },
    ]);
    const node = backend.getNodeByName('einstein');
    expect(node).not.toBeNull();
    expect(node!.name).toBe('Albert Einstein');
  });
});
// ---- provenance validation ----
describe('validateProvenance', () => {
  it('flags missing provenance on Thought node', () => {
    backend.createNodes([
      {
        name: 'MyThought',
        entityType: 'Thought',
        observations: [],
        content: 'A thought',
      },
    ]);
    const result = backend.validateProvenance('MyThought');
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.includes('DERIVED_FROM'))).toBe(true);
  });
  it('passes when DERIVED_FROM Source exists', () => {
    backend.createNodes([
      {
        name: 'MyThought',
        entityType: 'Thought',
        observations: [],
        content: 'A thought',
      },
      {
        name: 'MySource',
        entityType: 'Source',
        observations: [],
        sourceType: 'chat_message',
      },
    ]);
    backend.createRelations([
      { from: 'MyThought', to: 'MySource', relationType: 'DERIVED_FROM' },
    ]);
    const result = backend.validateProvenance('MyThought');
    expect(result.valid).toBe(true);
  });
  it('does not require provenance for Entity nodes', () => {
    backend.createNodes([
      { name: 'SomeEntity', entityType: 'Entity', observations: [] },
    ]);
    const result = backend.validateProvenance('SomeEntity');
    expect(result.valid).toBe(true);
  });
});
// ---- conflict detection ----
describe('detectConflicts', () => {
  it('detects explicit CONTRADICTS edges', () => {
    backend.createNodes([
      { name: 'P1', entityType: 'Proposition', observations: [], statement: 'Earth is flat', truthValue: true },
      { name: 'P2', entityType: 'Proposition', observations: [], statement: 'Earth is round', truthValue: true },
    ]);
    backend.createRelations([
      { from: 'P1', to: 'P2', relationType: 'contradicts' },
    ]);
    const conflicts = backend.detectConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('explicit');
    expect(conflicts[0].nodeA.name).toBe('P1');
    expect(conflicts[0].nodeB.name).toBe('P2');
  });
  it('scopes to specified nodeNames', () => {
    backend.createNodes([
      { name: 'A', entityType: 'Proposition', observations: [] },
      { name: 'B', entityType: 'Proposition', observations: [] },
      { name: 'C', entityType: 'Proposition', observations: [] },
      { name: 'D', entityType: 'Proposition', observations: [] },
    ]);
    backend.createRelations([
      { from: 'A', to: 'B', relationType: 'contradicts' },
      { from: 'C', to: 'D', relationType: 'contradicts' },
    ]);
    const conflicts = backend.detectConflicts(['A', 'B']);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].nodeA.name).toBe('A');
  });
  it('returns empty when no conflicts exist', () => {
    backend.createNodes([
      { name: 'X', entityType: 'Proposition', observations: [] },
    ]);
    const conflicts = backend.detectConflicts();
    expect(conflicts).toHaveLength(0);
  });
  it('detects uppercase CONTRADICTS edges', () => {
    backend.createNodes([
      { name: 'U1', entityType: 'Proposition', observations: [] },
      { name: 'U2', entityType: 'Proposition', observations: [] },
    ]);
    backend.createRelations([
      { from: 'U1', to: 'U2', relationType: 'CONTRADICTS' },
    ]);
    const conflicts = backend.detectConflicts();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('explicit');
  });
  it('deduplicates bidirectional CONTRADICTS edges', () => {
    backend.createNodes([
      { name: 'Bi1', entityType: 'Proposition', observations: [] },
      { name: 'Bi2', entityType: 'Proposition', observations: [] },
    ]);
    backend.createRelations([
      { from: 'Bi1', to: 'Bi2', relationType: 'contradicts' },
      { from: 'Bi2', to: 'Bi1', relationType: 'contradicts' },
    ]);
    const conflicts = backend.detectConflicts();
    expect(conflicts).toHaveLength(1);
  });
});
// ---- effective confidence ----
describe('computeEffectiveConfidence', () => {
  it('passes through stored confidence when no sources exist', () => {
    backend.createNodes([
      { name: 'Claim', entityType: 'Proposition', observations: [], confidence: 0.8 },
    ]);
    const result = backend.computeEffectiveConfidence('Claim');
    expect(result.effectiveConfidence).toBe(0.8);
    expect(result.sources).toHaveLength(0);
  });
  it('dampens confidence with a low-reliability source', () => {
    backend.createNodes([
      { name: 'Claim', entityType: 'Proposition', observations: [], confidence: 0.8 },
      { name: 'BadSource', entityType: 'Source', observations: [], sourceType: 'web_page', reliability: 0.5 },
    ]);
    backend.createRelations([
      { from: 'Claim', to: 'BadSource', relationType: 'DERIVED_FROM' },
    ]);
    const result = backend.computeEffectiveConfidence('Claim');
    expect(result.effectiveConfidence).toBeCloseTo(0.4); // 0.8 * 0.5
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].reliability).toBe(0.5);
  });
  it('averages reliability across multiple sources', () => {
    backend.createNodes([
      { name: 'Claim', entityType: 'Proposition', observations: [], confidence: 1.0 },
      { name: 'S1', entityType: 'Source', observations: [], sourceType: 'pdf', reliability: 0.8 },
      { name: 'S2', entityType: 'Source', observations: [], sourceType: 'web_page', reliability: 0.4 },
    ]);
    backend.createRelations([
      { from: 'Claim', to: 'S1', relationType: 'DERIVED_FROM' },
      { from: 'Claim', to: 'S2', relationType: 'DERIVED_FROM' },
    ]);
    const result = backend.computeEffectiveConfidence('Claim');
    expect(result.effectiveConfidence).toBeCloseTo(0.6); // 1.0 * avg(0.8, 0.4) = 0.6
    expect(result.sources).toHaveLength(2);
  });
  it('defaults reliability to 1.0 when not set', () => {
    backend.createNodes([
      { name: 'Claim', entityType: 'Proposition', observations: [], confidence: 0.9 },
      { name: 'PlainSource', entityType: 'Source', observations: [], sourceType: 'document' },
    ]);
    backend.createRelations([
      { from: 'Claim', to: 'PlainSource', relationType: 'DERIVED_FROM' },
    ]);
    const result = backend.computeEffectiveConfidence('Claim');
    expect(result.effectiveConfidence).toBeCloseTo(0.9); // 0.9 * 1.0
    expect(result.sources[0].reliability).toBe(1.0);
  });
  it('works with CITES edges', () => {
    backend.createNodes([
      { name: 'Insight', entityType: 'ScientificInsight', observations: [], confidence: 0.7 },
      { name: 'Paper', entityType: 'Source', observations: [], sourceType: 'pdf', reliability: 0.9 },
    ]);
    backend.createRelations([
      { from: 'Insight', to: 'Paper', relationType: 'CITES' },
    ]);
    const result = backend.computeEffectiveConfidence('Insight');
    expect(result.effectiveConfidence).toBeCloseTo(0.63); // 0.7 * 0.9
    expect(result.sources).toHaveLength(1);
  });
  it('returns zero for nonexistent node', () => {
    const result = backend.computeEffectiveConfidence('DoesNotExist');
    expect(result.effectiveConfidence).toBe(0);
    expect(result.sources).toHaveLength(0);
  });
});
// ---- assess claims ----
describe('assessClaims', () => {
  it('assesses claims found by query', () => {
    backend.createNodes([
      { name: 'Climate Change Real', entityType: 'Proposition', observations: [], statement: 'Climate change is real', confidence: 0.95, truthValue: true },
      { name: 'ReliableSource', entityType: 'Source', observations: [], sourceType: 'pdf', reliability: 0.9 },
    ]);
    backend.createRelations([
      { from: 'Climate Change Real', to: 'ReliableSource', relationType: 'DERIVED_FROM' },
    ]);
    const result = backend.assessClaims('climate');
    expect(result.assessments.length).toBeGreaterThanOrEqual(1);
    expect(result.summary).toContain('Assessed');
  });
  it('assesses specific nodeNames', () => {
    backend.createNodes([
      { name: 'P1', entityType: 'Proposition', observations: [], confidence: 0.8 },
      { name: 'P2', entityType: 'Proposition', observations: [], confidence: 0.6 },
    ]);
    const result = backend.assessClaims('', ['P1', 'P2']);
    expect(result.assessments).toHaveLength(2);
  });
  it('returns empty for no matches', () => {
    const result = backend.assessClaims('xyznonexistent');
    expect(result.assessments).toHaveLength(0);
    expect(result.conflicts).toHaveLength(0);
    expect(result.summary).toContain('No matching claims');
  });
});
// ---- source reliability ----
describe('source reliability', () => {
  it('stores and retrieves reliability in properties JSON', () => {
    backend.createNodes([
      { name: 'MySource', entityType: 'Source', observations: [], sourceType: 'web_page', reliability: 0.7 },
    ]);
    const node = backend.getNodeByName('MySource');
    expect(node).not.toBeNull();
    expect(node!.reliability).toBe(0.7);
  });
});
