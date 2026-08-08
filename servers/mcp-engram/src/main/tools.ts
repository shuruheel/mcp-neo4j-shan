import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type {
  StorageBackend,
  Entity,
  KnowledgeGraph,
  Relation,
} from '../types/index.js';
import { RelationshipType } from '../types/index.js';

const SOURCE_TYPES = [
  'chat_message',
  'web_page',
  'pdf',
  'email',
  'transcript',
  'document',
  'api_payload',
] as const;

const STEP_TYPES = [
  'premise',
  'inference',
  'evidence',
  'counterargument',
  'rebuttal',
  'conclusion',
] as const;

const METHODOLOGIES = [
  'deductive',
  'inductive',
  'abductive',
  'analogical',
  'mixed',
] as const;

// Loose schemas: nodes carry many type-specific optional fields that are
// stored in the properties JSON blob, so unknown keys must pass through.
const nodeOutput = z.looseObject({ name: z.string() });
const relationOutput = z.looseObject({
  from: z.string(),
  to: z.string(),
  relationType: z.string(),
});
const graphOutput = {
  entities: z.array(nodeOutput),
  relations: z.array(relationOutput),
};

const READ_ONLY = { readOnlyHint: true, openWorldHint: false };
const WRITE = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: true,
  openWorldHint: false,
};

function graphResult(graph: KnowledgeGraph) {
  return {
    content: [
      { type: 'text' as const, text: JSON.stringify(graph, null, 2) },
    ],
    structuredContent: graph as unknown as Record<string, unknown>,
  };
}

function errorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}

export function setupTools(server: McpServer, storage: StorageBackend): void {
  console.error('Setting up knowledge graph tools');

  server.registerTool(
    'search_nodes',
    {
      title: 'Search Knowledge Graph',
      description:
        'Full-text search across all nodes in the knowledge graph. Returns matching nodes ranked by relevance with their relationships.',
      inputSchema: {
        query: z.string().describe('Search query'),
        nodeTypes: z
          .array(z.string())
          .optional()
          .describe('Optional filter by node types'),
        limit: z.number().optional().describe('Max results (default 20)'),
      },
      outputSchema: graphOutput,
      annotations: READ_ONLY,
    },
    async ({ query, nodeTypes, limit }) =>
      graphResult(storage.searchNodes(query, { nodeTypes, limit }))
  );

  server.registerTool(
    'explore_context',
    {
      title: 'Explore Graph Context',
      description:
        'Explore the knowledge graph neighborhood around one or more nodes. Uses weighted traversal to surface the most important connections.',
      inputSchema: {
        entities: z
          .array(z.string())
          .optional()
          .describe('Entity node names to explore (up to 3)'),
        concepts: z
          .array(z.string())
          .optional()
          .describe('Concept node names to explore (up to 3)'),
        maxDepth: z.number().optional().describe('Max traversal depth (default 2)'),
        minWeight: z
          .number()
          .optional()
          .describe('Minimum edge weight to follow (default 0.0)'),
      },
      outputSchema: graphOutput,
      annotations: READ_ONLY,
    },
    async ({ entities, concepts, maxDepth, minWeight }) => {
      const nodeNames = [
        ...(entities ?? []).slice(0, 3),
        ...(concepts ?? []).slice(0, 3),
      ];
      if (nodeNames.length === 0) {
        return errorResult(
          'No nodes specified. Provide at least one entity or concept name.'
        );
      }
      return graphResult(
        storage.exploreContext(nodeNames, {
          maxDepth: maxDepth ?? 2,
          minWeight: minWeight ?? 0.0,
        })
      );
    }
  );

  server.registerTool(
    'create_nodes',
    {
      title: 'Create or Update Nodes',
      description:
        'Create or update nodes in the knowledge graph. Supports all node types: Entity, Event, Concept, Attribute, Proposition, Emotion, Agent, ScientificInsight, Law, Location, Thought, ReasoningChain, ReasoningStep, Source, EmotionalEvent. Note: re-creating an existing node overwrites its fields.',
      inputSchema: {
        nodes: z.array(
          z.looseObject({
            name: z.string(),
            entityType: z.string(),
            observations: z.array(z.string()).optional(),
            aliases: z.array(z.string()).optional(),
            description: z.string().optional(),
            subType: z.string().optional(),
            confidence: z.number().optional(),
            source: z.string().optional(),
            statement: z.string().optional(),
            content: z.string().optional(),
            thoughtContent: z.string().optional(),
            definition: z.string().optional(),
            domain: z.string().optional(),
            hypothesis: z.string().optional(),
            conclusion: z.string().optional(),
            stance: z.enum(['support', 'oppose', 'uncertain', 'mixed']).optional(),
            sourceType: z.enum(SOURCE_TYPES).optional(),
            uri: z.string().optional(),
            collectedAt: z.string().optional(),
            contentHash: z.string().optional(),
            timestamp: z.string().optional(),
            valence: z.number().optional(),
            arousal: z.number().optional(),
            intensity: z.number().optional(),
            label: z.string().optional(),
            notes: z.string().optional(),
          })
        ),
      },
      outputSchema: {
        created: z.number(),
        nodes: z.array(z.string()),
      },
      annotations: WRITE,
    },
    async ({ nodes }) => {
      const created = storage.createNodes(nodes as Entity[]);
      const result = { created: created.length, nodes: created.map((n) => n.name) };
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    'create_relations',
    {
      title: 'Create or Update Relations',
      description:
        'Create or update relationships between nodes. Always include context describing why nodes are connected.',
      inputSchema: {
        relations: z.array(
          z.looseObject({
            from: z.string(),
            to: z.string(),
            relationType: z.string(),
            relationshipType: z
              .enum(Object.values(RelationshipType) as [string, ...string[]])
              .optional(),
            context: z.string().optional(),
            confidenceScore: z.number().optional(),
            weight: z.number().optional(),
            sources: z.array(z.string()).optional(),
          })
        ),
      },
      outputSchema: { created: z.number() },
      annotations: WRITE,
    },
    async ({ relations }) => {
      const created = storage.createRelations(relations as Relation[]);
      const result = { created: created.length };
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    'add_sources',
    {
      title: 'Add Provenance Sources',
      description:
        'Create Source nodes and optionally link them to existing nodes via DERIVED_FROM edges.',
      inputSchema: {
        sources: z.array(
          z.looseObject({
            name: z.string(),
            sourceType: z.enum(SOURCE_TYPES),
            title: z.string().optional(),
            uri: z.string().optional(),
            collectedAt: z.string().optional(),
          })
        ),
        derivedFrom: z
          .array(
            z.object({
              nodeName: z.string(),
              sourceName: z.string(),
            })
          )
          .optional()
          .describe('Link existing nodes to these sources via DERIVED_FROM'),
      },
      outputSchema: { created: z.number(), linked: z.number() },
      annotations: WRITE,
    },
    async ({ sources, derivedFrom }) => {
      const sourceNodes = sources.map(
        (s) =>
          ({
            name: s.name,
            entityType: 'Source',
            observations: [],
            sourceType: s.sourceType,
            description: s.title ?? undefined,
            uri: s.uri,
            collectedAt: s.collectedAt,
          }) as Entity
      );
      storage.createNodes(sourceNodes);

      let linked = 0;
      if (derivedFrom?.length) {
        const relations: Relation[] = derivedFrom.map((d) => ({
          from: d.nodeName,
          to: d.sourceName,
          relationType: 'DERIVED_FROM',
          weight: 1.0,
        }));
        linked = storage.createRelations(relations).length;
      }

      const result = { created: sourceNodes.length, linked };
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    'get_temporal_sequence',
    {
      title: 'Get Temporal Sequence',
      description:
        'Retrieve a chronological sequence of nodes connected by temporal relations (NEXT, BEFORE, AFTER, CAUSES, etc.).',
      inputSchema: {
        startNodeName: z.string(),
        direction: z.enum(['forward', 'backward', 'both']).optional(),
        maxEvents: z.number().optional(),
      },
      outputSchema: graphOutput,
      annotations: READ_ONLY,
    },
    async ({ startNodeName, direction, maxEvents }) =>
      graphResult(
        storage.getTemporalSequence(startNodeName, {
          direction: direction ?? 'both',
          maxEvents: maxEvents ?? 10,
        })
      )
  );

  server.registerTool(
    'create_reasoning_chain',
    {
      title: 'Create Reasoning Chain',
      description:
        'Create a structured reasoning chain with ordered steps. Each step represents a logical move (premise, inference, evidence, etc.).',
      inputSchema: {
        chainName: z.string(),
        description: z.string(),
        conclusion: z.string(),
        confidenceScore: z.number(),
        methodology: z.enum(METHODOLOGIES).optional(),
        domain: z.string().optional(),
        sourceThought: z.string().optional(),
        tags: z.array(z.string()).optional(),
        steps: z.array(
          z.object({
            name: z.string(),
            content: z.string(),
            stepNumber: z.number(),
            stepType: z.enum(STEP_TYPES),
            confidence: z.number(),
            evidenceType: z.string().optional(),
            supportingReferences: z.array(z.string()).optional(),
            previousSteps: z.array(z.string()).optional(),
          })
        ),
      },
      outputSchema: {
        success: z.boolean(),
        message: z.string(),
        chainName: z.string(),
      },
      annotations: WRITE,
    },
    async (args) => {
      const chain = storage.createReasoningChain(
        {
          name: args.chainName,
          description: args.description,
          conclusion: args.conclusion,
          confidenceScore: args.confidenceScore,
          methodology: args.methodology ?? 'mixed',
          domain: args.domain,
          sourceThought: args.sourceThought,
          tags: args.tags,
        },
        args.steps
      );
      const result = {
        success: true,
        message: `Created reasoning chain "${chain.name}"`,
        chainName: chain.name,
      };
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(result, null, 2) },
        ],
        structuredContent: result,
      };
    }
  );

  server.registerTool(
    'get_reasoning_chain',
    {
      title: 'Get Reasoning Chain',
      description:
        'Retrieve a reasoning chain by name, or find chains related to given topics.',
      inputSchema: {
        chainName: z.string().optional(),
        entities: z.array(z.string()).optional(),
        concepts: z.array(z.string()).optional(),
        limit: z.number().optional(),
      },
      outputSchema: graphOutput,
      annotations: READ_ONLY,
    },
    async ({ chainName, entities, concepts, limit }) => {
      if (chainName) {
        return graphResult(storage.getReasoningChain(chainName));
      }
      const topics = [...(entities ?? []), ...(concepts ?? [])];
      if (topics.length === 0) {
        return errorResult(
          'Provide chainName, entities, or concepts to find reasoning chains.'
        );
      }
      return graphResult(storage.findReasoningChains(topics, limit ?? 3));
    }
  );

  console.error('All tools have been registered successfully');
}
