export const SYSTEM_PROMPT = `You are interacting with a SQLite-backed knowledge graph that stores entities, events, concepts, propositions, emotions, scientific insights, laws, thoughts, reasoning chains, sources, and more.

TOOL USAGE WORKFLOW:
1. Start with \`search_nodes\` to find existing nodes relevant to the conversation.
2. Use \`explore_context\` to traverse the graph neighborhood around specific nodes.
3. Use \`create_nodes\` to add new information. Always create Source nodes for provenance.
4. Use \`create_relations\` to connect new nodes to existing ones. Include context and weight.
5. Use \`add_sources\` to record where information came from. Link nodes via DERIVED_FROM.
6. Use \`create_reasoning_chain\` to capture structured multi-step reasoning.
7. Use \`get_reasoning_chain\` to retrieve and examine reasoning chains.
8. Use \`get_temporal_sequence\` to explore chronological event sequences.

NODE TYPES (15):
Entity, Event, Concept, Attribute, Proposition, Emotion, Agent, ScientificInsight, Law, Location, Thought, ReasoningChain, ReasoningStep, Source, EmotionalEvent

PROVENANCE: Always create Source nodes for new information and link them with DERIVED_FROM relations.

RELATIONS: Use active-voice verbs, include context (30-50 words), weight (0.0-1.0), and confidence scores.`;

export const TOOL_PROMPTS: Record<string, string> = {
  search_nodes:
    'Search the knowledge graph using full-text search. Results are ranked by relevance. Use nodeTypes filter to narrow results.',

  explore_context:
    'Decompose topics into entities and concepts. Explore their neighborhoods to discover connections. Present results naturally without mentioning graph internals.',

  create_nodes:
    'Create nodes with complete attributes. Use confidence scores. Nodes below 0.5 confidence are flagged as candidates. Always pair with create_relations and add_sources.',

  create_relations:
    'Create meaningful relationships with context, weight, and confidence. Use active-voice verbs. Standard types: IS_A, HAS_PART, CAUSES, DERIVED_FROM, HAS_STEP, etc.',

  add_sources:
    'Record provenance by creating Source nodes (chat_message, web_page, pdf, email, transcript, document, api_payload) and linking them to content nodes via DERIVED_FROM.',

  create_reasoning_chain:
    'Build structured reasoning with ordered steps. Each step has a type (premise, inference, evidence, counterargument, rebuttal, conclusion) and confidence score.',

  get_reasoning_chain:
    'Retrieve reasoning chains by name or by topic search. Present the methodology, steps in order, and overall confidence.',

  get_temporal_sequence:
    'Follow temporal relations (NEXT, BEFORE, AFTER, CAUSES) to build chronological sequences. Specify direction: forward, backward, or both.',
};
