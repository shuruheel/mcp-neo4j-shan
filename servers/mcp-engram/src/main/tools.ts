import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { StorageBackend, Entity, Relation } from '../types/index.js';
import { RelationshipType } from '../types/index.js';

export function setupTools(server: Server, storage: StorageBackend): void {
  console.error('Setting up knowledge graph tools');

  const tools = [
    {
      name: 'search_nodes',
      description:
        'Full-text search across all nodes in the knowledge graph. Returns matching nodes ranked by relevance with their relationships.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          nodeTypes: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional filter by node types',
          },
          limit: {
            type: 'number',
            description: 'Max results (default 20)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'explore_context',
      description:
        'Explore the knowledge graph neighborhood around one or more nodes. Uses weighted traversal to surface the most important connections.',
      inputSchema: {
        type: 'object',
        properties: {
          entities: {
            type: 'array',
            items: { type: 'string' },
            description: 'Entity node names to explore (up to 3)',
          },
          concepts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Concept node names to explore (up to 3)',
          },
          maxDepth: {
            type: 'number',
            description: 'Max traversal depth (default 2)',
          },
          minWeight: {
            type: 'number',
            description: 'Minimum edge weight to follow (default 0.0)',
          },
        },
      },
    },
    {
      name: 'create_nodes',
      description:
        'Create or update nodes in the knowledge graph. Supports all node types: Entity, Event, Concept, Attribute, Proposition, Emotion, Agent, ScientificInsight, Law, Location, Thought, ReasoningChain, ReasoningStep, Source, EmotionalEvent.',
      inputSchema: {
        type: 'object',
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                entityType: { type: 'string' },
                observations: {
                  type: 'array',
                  items: { type: 'string' },
                },
                description: { type: 'string' },
                subType: { type: 'string' },
                confidence: { type: 'number' },
                source: { type: 'string' },
                statement: { type: 'string' },
                content: { type: 'string' },
                thoughtContent: { type: 'string' },
                definition: { type: 'string' },
                domain: { type: 'string' },
                hypothesis: { type: 'string' },
                conclusion: { type: 'string' },
                stance: {
                  type: 'string',
                  enum: ['support', 'oppose', 'uncertain', 'mixed'],
                },
                sourceType: {
                  type: 'string',
                  enum: [
                    'chat_message',
                    'web_page',
                    'pdf',
                    'email',
                    'transcript',
                    'document',
                    'api_payload',
                  ],
                },
                uri: { type: 'string' },
                collectedAt: { type: 'string' },
                contentHash: { type: 'string' },
                timestamp: { type: 'string' },
                valence: { type: 'number' },
                arousal: { type: 'number' },
                intensity: { type: 'number' },
                label: { type: 'string' },
                notes: { type: 'string' },
              },
              required: ['name', 'entityType'],
            },
          },
        },
        required: ['nodes'],
      },
    },
    {
      name: 'create_relations',
      description:
        'Create or update relationships between nodes. Always include context describing why nodes are connected.',
      inputSchema: {
        type: 'object',
        properties: {
          relations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                relationType: { type: 'string' },
                relationshipType: {
                  type: 'string',
                  enum: Object.values(RelationshipType),
                },
                context: { type: 'string' },
                confidenceScore: { type: 'number' },
                weight: { type: 'number' },
                sources: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['from', 'to', 'relationType'],
            },
          },
        },
        required: ['relations'],
      },
    },
    {
      name: 'add_sources',
      description:
        'Create Source nodes and optionally link them to existing nodes via DERIVED_FROM edges.',
      inputSchema: {
        type: 'object',
        properties: {
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                sourceType: {
                  type: 'string',
                  enum: [
                    'chat_message',
                    'web_page',
                    'pdf',
                    'email',
                    'transcript',
                    'document',
                    'api_payload',
                  ],
                },
                title: { type: 'string' },
                uri: { type: 'string' },
                collectedAt: { type: 'string' },
                reliability: {
                  type: 'number',
                  description:
                    'Source trustworthiness from 0.0 to 1.0 (default 1.0)',
                },
              },
              required: ['name', 'sourceType'],
            },
          },
          derivedFrom: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                nodeName: { type: 'string' },
                sourceName: { type: 'string' },
              },
              required: ['nodeName', 'sourceName'],
            },
            description:
              'Link existing nodes to these sources via DERIVED_FROM',
          },
        },
        required: ['sources'],
      },
    },
    {
      name: 'get_temporal_sequence',
      description:
        'Retrieve a chronological sequence of nodes connected by temporal relations (NEXT, BEFORE, AFTER, CAUSES, etc.).',
      inputSchema: {
        type: 'object',
        properties: {
          startNodeName: { type: 'string' },
          direction: {
            type: 'string',
            enum: ['forward', 'backward', 'both'],
          },
          maxEvents: { type: 'number' },
        },
        required: ['startNodeName'],
      },
    },
    {
      name: 'create_reasoning_chain',
      description:
        'Create a structured reasoning chain with ordered steps. Each step represents a logical move (premise, inference, evidence, etc.).',
      inputSchema: {
        type: 'object',
        properties: {
          chainName: { type: 'string' },
          description: { type: 'string' },
          conclusion: { type: 'string' },
          confidenceScore: { type: 'number' },
          methodology: {
            type: 'string',
            enum: [
              'deductive',
              'inductive',
              'abductive',
              'analogical',
              'mixed',
            ],
          },
          domain: { type: 'string' },
          sourceThought: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                content: { type: 'string' },
                stepNumber: { type: 'number' },
                stepType: {
                  type: 'string',
                  enum: [
                    'premise',
                    'inference',
                    'evidence',
                    'counterargument',
                    'rebuttal',
                    'conclusion',
                  ],
                },
                confidence: { type: 'number' },
                evidenceType: { type: 'string' },
                supportingReferences: {
                  type: 'array',
                  items: { type: 'string' },
                },
                previousSteps: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: [
                'name',
                'content',
                'stepNumber',
                'stepType',
                'confidence',
              ],
            },
          },
        },
        required: [
          'chainName',
          'description',
          'conclusion',
          'confidenceScore',
          'steps',
        ],
      },
    },
    {
      name: 'get_reasoning_chain',
      description:
        'Retrieve a reasoning chain by name, or find chains related to given topics.',
      inputSchema: {
        type: 'object',
        properties: {
          chainName: { type: 'string' },
          entities: { type: 'array', items: { type: 'string' } },
          concepts: { type: 'array', items: { type: 'string' } },
          limit: { type: 'number' },
        },
      },
    },
    {
      name: 'detect_conflicts',
      description:
        'Detect conflicting claims in the knowledge graph by finding CONTRADICTS edges between nodes.',
      inputSchema: {
        type: 'object',
        properties: {
          nodeNames: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional list of node names to scope the conflict search. If omitted, searches the entire graph.',
          },
        },
      },
    },
    {
      name: 'assess_claims',
      description:
        'Assess the reliability of claims by computing effective confidence scores that factor in source trustworthiness, and detecting conflicts between claims.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Search query to find claims (Propositions, ScientificInsights, Thoughts) to assess.',
          },
          nodeNames: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional specific node names to assess instead of searching by query.',
          },
        },
        required: ['query'],
      },
    },
  ];

  // Register tool list
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  // Register tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (!args) throw new Error(`No arguments provided for tool: ${name}`);

    let result: unknown;

    switch (name) {
      case 'search_nodes': {
        const graph = storage.searchNodes(args.query as string, {
          nodeTypes: args.nodeTypes as string[] | undefined,
          limit: args.limit as number | undefined,
        });
        result = graph;
        break;
      }

      case 'explore_context': {
        const nodeNames: string[] = [];
        if (Array.isArray(args.entities))
          nodeNames.push(...(args.entities as string[]).slice(0, 3));
        if (Array.isArray(args.concepts))
          nodeNames.push(...(args.concepts as string[]).slice(0, 3));

        if (nodeNames.length === 0) {
          result =
            'No nodes specified. Provide at least one entity or concept name.';
          break;
        }

        const graph = storage.exploreContext(nodeNames, {
          maxDepth: (args.maxDepth as number) || 2,
          minWeight: (args.minWeight as number) || 0.0,
        });
        result = graph;
        break;
      }

      case 'create_nodes': {
        const created = storage.createNodes(args.nodes as Entity[]);
        result = {
          created: created.length,
          nodes: created.map((n) => n.name),
        };
        break;
      }

      case 'create_relations': {
        const created = storage.createRelations(args.relations as Relation[]);
        result = { created: created.length };
        break;
      }

      case 'add_sources': {
        const sources = (args.sources as Record<string, unknown>[]).map(
          (s) =>
            ({
              name: s.name as string,
              entityType: 'Source',
              observations: [],
              sourceType: s.sourceType as string,
              description: (s.title as string) ?? undefined,
              uri: s.uri as string | undefined,
              collectedAt: s.collectedAt as string | undefined,
              reliability: s.reliability as number | undefined,
            }) as Entity
        );
        storage.createNodes(sources);

        if (Array.isArray(args.derivedFrom)) {
          const relations: Relation[] = (
            args.derivedFrom as { nodeName: string; sourceName: string }[]
          ).map((d) => ({
            from: d.nodeName,
            to: d.sourceName,
            relationType: 'DERIVED_FROM',
            weight: 1.0,
          }));
          storage.createRelations(relations);
        }

        result = { created: sources.length };
        break;
      }

      case 'get_temporal_sequence': {
        const graph = storage.getTemporalSequence(
          args.startNodeName as string,
          {
            direction:
              (args.direction as 'forward' | 'backward' | 'both') || 'both',
            maxEvents: (args.maxEvents as number) || 10,
          }
        );
        result = graph;
        break;
      }

      case 'create_reasoning_chain': {
        const steps = (
          (args.steps as ReasoningStepInputRaw[]) ?? []
        ).map((s) => ({
          name: s.name,
          content: s.content,
          stepNumber: s.stepNumber,
          stepType: s.stepType,
          confidence: s.confidence,
          evidenceType: s.evidenceType,
          supportingReferences: s.supportingReferences,
          previousSteps: s.previousSteps,
        }));

        const chain = storage.createReasoningChain(
          {
            name: args.chainName as string,
            description: args.description as string,
            conclusion: args.conclusion as string,
            confidenceScore: args.confidenceScore as number,
            methodology:
              (args.methodology as
                | 'deductive'
                | 'inductive'
                | 'abductive'
                | 'analogical'
                | 'mixed') ?? 'mixed',
            domain: args.domain as string | undefined,
            sourceThought: args.sourceThought as string | undefined,
            tags: args.tags as string[] | undefined,
          },
          steps
        );

        result = {
          success: true,
          message: `Created reasoning chain "${chain.name}"`,
          chainName: chain.name,
        };
        break;
      }

      case 'get_reasoning_chain': {
        if (args.chainName) {
          result = storage.getReasoningChain(args.chainName as string);
        } else {
          const topics: string[] = [
            ...((args.entities as string[]) ?? []),
            ...((args.concepts as string[]) ?? []),
          ];
          if (topics.length === 0) {
            result =
              'Provide chainName, entities, or concepts to find reasoning chains.';
            break;
          }
          result = storage.findReasoningChains(
            topics,
            (args.limit as number) ?? 3
          );
        }
        break;
      }

      case 'detect_conflicts': {
        const conflicts = storage.detectConflicts(
          args.nodeNames as string[] | undefined
        );
        result = {
          conflictCount: conflicts.length,
          conflicts: conflicts.map((c) => ({
            nodeA: c.nodeA.name,
            nodeB: c.nodeB.name,
            type: c.type,
            reason: c.reason,
          })),
        };
        break;
      }

      case 'assess_claims': {
        const assessment = storage.assessClaims(
          args.query as string,
          args.nodeNames as string[] | undefined
        );
        result = {
          summary: assessment.summary,
          assessments: assessment.assessments.map((a) => ({
            node: a.node.name,
            storedConfidence: a.storedConfidence,
            effectiveConfidence: a.effectiveConfidence,
            sources: a.sources.map((s) => ({
              name: s.source.name,
              reliability: s.reliability,
            })),
            conflictCount: a.conflicts.length,
          })),
          conflicts: assessment.conflicts.map((c) => ({
            nodeA: c.nodeA.name,
            nodeB: c.nodeB.name,
            type: c.type,
            reason: c.reason,
          })),
        };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text:
            typeof result === 'string'
              ? result
              : JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  console.error('All tools have been registered successfully');
}

interface ReasoningStepInputRaw {
  name: string;
  content: string;
  stepNumber: number;
  stepType:
    | 'premise'
    | 'inference'
    | 'evidence'
    | 'counterargument'
    | 'rebuttal'
    | 'conclusion';
  confidence: number;
  evidenceType?: string;
  supportingReferences?: string[];
  previousSteps?: string[];
}
