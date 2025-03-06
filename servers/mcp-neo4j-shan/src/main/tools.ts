import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { Neo4jCreator } from "../node-creator/index.js";
import { Neo4jRetriever } from "../node-retriever/index.js";
import { Entity, Relation, RelationshipType } from "../types/index.js";

// Import tool descriptions from the old implementation
const TOOL_DESCRIPTIONS = {
  "explore_weighted_context": "The PRIMARY tool for exploring the knowledge graph context around specific nodes. Accepts arrays of Entity nodes and Concept nodes to provide a comprehensive view of related knowledge and connections. ALWAYS extract and categorize topics from the conversation into these types:\n\n- Entity nodes (pass in 'entities' array):\n  * People/Individuals (e.g., 'Albert Einstein', 'Marie Curie')\n  * Organizations (e.g., 'Google', 'United Nations', 'Harvard University')\n  * Countries/Locations (e.g., 'United States', 'China', 'Paris')\n  * Physical Objects (e.g., 'Smartphone', 'CRISPR', 'Reactor')\n  * Products (e.g., 'iPhone', 'ChatGPT', 'Tesla Model S')\n\n- Concept nodes (pass in 'concepts' array):\n  * Abstract Ideas (e.g., 'Democracy', 'Justice', 'Sustainability')\n  * Academic Fields (e.g., 'Artificial Intelligence', 'Quantum Physics', 'Economics')\n  * Theories (e.g., 'Relativity', 'Evolution', 'Game Theory')\n  * Activities (e.g., 'Research', 'Competition', 'Collaboration')\n  * Frameworks (e.g., 'Capitalism', 'Scientific Method', 'Agile')\n\nIMPORTANT: When exploring a complex topic like 'US-China AI Competition', DECOMPOSE it into individual entities and concepts:\n - Entities: 'United States', 'China'\n - Concepts: 'Artificial Intelligence', 'Competition', 'Geopolitics'\n\nThe tool uses relationship weights to prioritize the most important connections, providing an intelligent view focused on the strongest and most relevant relationships first. It finds significant paths connecting the entities and concepts, showing how they relate to each other.",
  "create_nodes": "WHEN the user specifically asks for the knowledge graph to be updated, create new nodes in the knowledge graph for ALL the following node types in the conversation:\n\n- Entity: People, organizations, products, physical objects, or any tangible item (e.g., 'John Smith', 'Apple Inc.', 'Golden Gate Bridge'). Include attributes like description, source, confidence, biography, keyContributions, emotionalValence, and emotionalArousal when available.\n\n- Event: Time-bound occurrences with temporal attributes (e.g., 'World War II', 'Company Merger', 'Product Launch'). Include attributes like startDate, endDate, status, location, participants, outcome, significance, timestamp, duration, causalPredecessors, and causalSuccessors when available.\n\n- Concept: Abstract ideas, theories, principles, or frameworks (e.g., 'Democracy', 'Machine Learning', 'Sustainability'). Include attributes like definition, description, examples, relatedConcepts, domain, significance, perspectives, historicalDevelopment, emotionalValence, emotionalArousal, and abstractionLevel when available.\n\n- Attribute: Qualities or properties that can be assigned to entities (e.g., 'Color', 'Height', 'Temperature'). Include attributes like value, unit, valueType, possibleValues, and description when available.\n\n- Proposition: Facts, claims, rules, or pieces of knowledge (e.g., 'CO2 levels influence global temperature', 'Einstein won the 1921 Nobel Prize'). Include attributes like statement, status, confidence, truthValue, sources, domain, emotionalValence, emotionalArousal, evidenceStrength, and counterEvidence when available.\n\n- Emotion: Emotional states and feelings (e.g., 'Joy', 'Sadness', 'Fear'). Include attributes like intensity, valence, category, subcategory, and description when available.\n\n- Agent: Cognitive entities capable of action or belief (e.g., 'AI Assistant', 'Customer Service Rep', 'Researcher'). Include attributes like agentType, description, capabilities, beliefs, knowledge, preferences, and emotionalState when available.\n\n- ScientificInsight: Research findings, experimental results, or scientific claims (e.g., 'Greenhouse Effect', 'Quantum Entanglement'). Include attributes like hypothesis, evidence, methodology, confidence, field, publications, emotionalValence, emotionalArousal, evidenceStrength, scientificCounterarguments, applicationDomains, replicationStatus, and surpriseValue when available.\n\n- Law: Established principles, rules, or regularities that describe phenomena (e.g., 'Law of Supply and Demand', 'Newton's Laws of Motion'). Include attributes like statement, conditions, exceptions, domain, proofs, emotionalValence, emotionalArousal, domainConstraints, historicalPrecedents, counterexamples, and formalRepresentation when available.\n\n- Thought: Analyses, interpretations, or reflections about other nodes in the graph (e.g., 'Analysis of Market Trends', 'Critique of Theory X'). Include attributes like thoughtContent, references, confidence, source, createdBy, tags, impact, emotionalValence, emotionalArousal, evidentialBasis, thoughtCounterarguments, implications, and thoughtConfidenceScore when available.\n\n- ReasoningChain: Structured logical reasoning with multiple steps (e.g., 'Analysis of Climate Policy Impact', 'Argument for Economic Reform'). Include attributes like description, conclusion, confidenceScore, creator, methodology, domain, tags, sourceThought, numberOfSteps, and alternativeConclusionsConsidered when available.\n\n- ReasoningStep: Steps within a reasoning chain. Include attributes like content, stepType, evidenceType, supportingReferences, confidence, alternatives, counterarguments, assumptions, formalNotation, and propositions when available.\n\nEach node type has specific cognitive attributes that should be populated when available. Ensure node names are concise, specific, and uniquely identifiable.",
  "create_relations": "Whenever you create new nodes, always create any relevant new relations between nodes in the knowledge graph. Relations should be semantically meaningful and use active voice. All relations MUST include the following:\n\n1. from: The name of the source node\n2. to: The name of the target node\n3. relationType: A descriptive label for the relationship (e.g., ADVOCATES, CONTRIBUTES_TO)\n4. relationshipType: A standardized relationship type from the RelationshipType enum\n5. context: A brief explanation (30-50 words) that describes how and why the nodes are connected\n\nWhenever possible, also include these important attributes:\n- confidenceScore: A number from 0.0 to 1.0 indicating confidence in this relationship\n- weight: A number from 0.0 to 1.0 indicating the strength/importance of this relationship (used for traversal prioritization)\n- sources: Array of citation sources for this relationship\n- contextType: One of 'hierarchical', 'associative', 'causal', 'temporal', 'analogical', or 'attributive'\n\nExample relationships by category:\n\n- HIERARCHICAL: isA, instanceOf, subClassOf, superClassOf\n- COMPOSITIONAL: hasPart, partOf\n- SPATIAL: locatedIn, hasLocation\n- TEMPORAL: hasTime, occursOn, before, after, during\n- PARTICIPATION: participant, hasParticipant, agent, hasAgent, patient, hasPatient\n- CAUSAL: causes, causedBy, influences, influencedBy\n- SEQUENTIAL: next, previous\n- SOCIAL: knows, friendOf, memberOf\n- PROPERTY: hasProperty, propertyOf\n- GENERAL: relatedTo, associatedWith\n- EMOTIONAL: expressesEmotion, feels, evokesEmotion\n- BELIEF: believes, supports, contradicts\n- SOURCE: derivedFrom, cites, source\n\nExample relations between different node types:\n- Entity -> Concept: ADVOCATES, SUPPORTS, UNDERSTANDS\n- Entity -> Event: PARTICIPATED_IN, ORGANIZED, WITNESSED\n- Concept -> Concept: RELATES_TO, BUILDS_UPON, CONTRADICTS\n- Event -> ScientificInsight: LED_TO, DISPROVED, REINFORCED\n- ScientificInsight -> Law: SUPPORTS, CHALLENGES, REFINES\n- Entity -> Attribute: HAS_PROPERTY, EXHIBITS\n- Proposition -> Entity: DESCRIBES, REFERS_TO\n- Agent -> Proposition: BELIEVES, DOUBTS\n- Event -> Emotion: EVOKES, TRIGGERS\n- Entity -> Agent: KNOWS, COLLABORATES_WITH",
  "get_temporal_sequence": "ESSENTIAL tool for analyzing CHRONOLOGICAL and CAUSAL relationships within the knowledge graph. Visualizes temporal sequences of related events, concepts, and insights showing how they unfold over time. Use this tool WHENEVER you need to:\n\n- Understand historical progression of events (e.g., 'Evolution of Artificial Intelligence', 'Stages of the Industrial Revolution')\n- Identify cause-and-effect relationships by temporal ordering\n- Track the development of scientific insights over time\n- Map the influence of events on concept development\n\nThe tool provides the ability to look FORWARD in time (future events/consequences), BACKWARD in time (historical causes/precedents), or BOTH directions from any starting node. Results are returned as a chronologically ordered sequence with timestamps and relationship descriptions, making it ideal for constructing timelines and narratives.",
  "create_reasoning_chain": "POWERFUL tool for documenting and structuring explicit logical reasoning within the knowledge graph. Creates a new reasoning chain node with multiple structured reasoning steps that represent a formal logical analysis. USE THIS TOOL when you need to:\n\n- Capture complex multi-step reasoning processes (e.g., 'Analysis of Climate Change Impacts', 'Evaluation of Economic Policy')\n- Document critical thinking paths with clear premises and conclusions\n- Preserve the logical structure behind important insights or decisions\n- Build verifiable reasoning that others can examine and critique\n\nEach reasoning chain requires the following core parameters:\n\n1. chainName: A concise, descriptive name for the chain (e.g., \"Climate Policy Impact Analysis\")\n2. description: An overview of what the reasoning chain accomplishes\n3. conclusion: The final conclusion reached through the reasoning\n4. confidenceScore: How confident you are in the conclusion (0.0-1.0)\n5. steps: An array of reasoning steps in logical order\n\nOptional but valuable parameters include:\n- methodology: The reasoning approach used (deductive, inductive, abductive, analogical, mixed)\n- domain: The field or subject area of the reasoning (e.g., \"Economics\", \"Climate Science\")\n- sourceThought: The name of a Thought node this reasoning chain is derived from\n- tags: Keywords that categorize the reasoning chain\n\nEACH STEP in the chain represents a distinct logical move with specific properties:\n- name: A unique identifier for the step (e.g., \"ClimatePolicy_Step1_Premise\")\n- content: The actual content of the reasoning step\n- stepNumber: The position in the sequence (1, 2, 3, etc.)\n- stepType: One of 'premise', 'inference', 'evidence', 'counterargument', 'rebuttal', 'conclusion'\n- confidence: How confident you are in this specific step (0.0-1.0)\n- supportingReferences: Names of existing nodes that support this step\n- previousSteps: Names of steps that logically precede this one\n\nExample input structure:\n```json\n{\n  \"chainName\": \"Climate Policy Impact Analysis\",\n  \"description\": \"Analysis of carbon pricing policies and their effectiveness\",\n  \"conclusion\": \"Carbon taxes are more effective than cap-and-trade in reducing emissions while maintaining economic growth\",\n  \"confidenceScore\": 0.85,\n  \"methodology\": \"mixed\",\n  \"domain\": \"Climate Policy\",\n  \"steps\": [\n    {\n      \"name\": \"ClimatePolicy_Step1\",\n      \"content\": \"Carbon pricing mechanisms are the most economically efficient way to reduce emissions\",\n      \"stepNumber\": 1,\n      \"stepType\": \"premise\",\n      \"confidence\": 0.9,\n      \"supportingReferences\": [\"IPCC Report 2022\", \"Carbon Economics Study\"]\n    },\n    {\n      \"name\": \"ClimatePolicy_Step2\",\n      \"content\": \"Carbon taxes provide price certainty while cap-and-trade provides quantity certainty\",\n      \"stepNumber\": 2,\n      \"stepType\": \"evidence\",\n      \"evidenceType\": \"fact\",\n      \"confidence\": 0.95,\n      \"previousSteps\": [\"ClimatePolicy_Step1\"]\n    }\n  ]\n}\n```\n\nThe chain becomes a first-class node in the knowledge graph that can be retrieved later using the get_reasoning_chain tool.",
  "get_reasoning_chain": "POWERFUL retrieval tool for accessing reasoning chains and all their constituent steps from the knowledge graph. This tool supports two query modes:\n\n1. BY NAME: Retrieve a specific reasoning chain by exact name\n   Example: {\"chainName\": \"Climate Change Impact Analysis\"}\n\n2. BY TOPICS: Find reasoning chains related to specific entities and concepts\n   Example: {\"entities\": [\"United States\", \"Tesla\"], \"concepts\": [\"Electric Vehicles\", \"Climate Policy\"]}\n\nUse this tool WHENEVER you need to:\n\n- Find reasoning chains relevant to specific topics or entities being discussed\n- Examine the logical structure behind complex conclusions\n- Review step-by-step reasoning processes for verification purposes\n- Build upon existing reasoning chains with new insights\n- Compare different reasoning approaches to similar problems\n\nThe tool returns the full chain metadata (methodology, confidence, domain) along with ALL reasoning steps in their proper sequence. Each step includes its content, type, evidence, and connections to other steps.\n\nExample inputs:\n1. {\"chainName\": \"Analysis of Carbon Pricing Policy\"}\n2. {\"entities\": [\"Elon Musk\", \"SpaceX\"], \"concepts\": [\"Space Exploration\"]}\n3. {\"concepts\": [\"Nuclear Energy\", \"Climate Change\", \"Energy Policy\"]}\n\nNote: When searching by topics, provide the most specific and relevant entities and concepts for best results."
};

/**
 * Sets up all tools for the server
 * @param server - Server instance
 * @param nodeCreator - Node creator instance
 * @param nodeRetriever - Node retriever instance
 */
export function setupTools(
  server: Server,
  nodeCreator: Neo4jCreator,
  nodeRetriever: Neo4jRetriever
): void {
  console.error('Setting up knowledge graph tools');
  
  // Define all tools to be registered
  const tools = [
    {
      name: "explore_weighted_context",
      description: TOOL_DESCRIPTIONS["explore_weighted_context"],
      inputSchema: {
        type: "object",
        properties: {
          entities: {
            type: "array",
            items: { type: "string" },
            description: "Array of up to 3 most relevant Entity node names to explore"
          },
          concepts: {
            type: "array",
            items: { type: "string" },
            description: "Array of up to 3 most relevant Concept node names to explore"
          },
          nodeName: {
            type: "string",
            description: "DEPRECATED: Legacy support for single node name to explore"
          },
          maxDepth: {
            type: "number",
            description: "Maximum depth to explore (default: 2)"
          },
          minWeight: {
            type: "number",
            description: "Minimum weight of relationships to include (default: 0.0)"
          }
        },
        required: []
      }
    },
    {
      name: "create_nodes",
      description: TOOL_DESCRIPTIONS["create_nodes"],
      inputSchema: {
        type: "object",
        properties: {
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Unique name for the node" },
                entityType: { 
                  type: "string", 
                  enum: [
                    "Entity", 
                    "Event", 
                    "Concept", 
                    "Attribute", 
                    "Proposition", 
                    "Emotion", 
                    "ScientificInsight", 
                    "Law", 
                    "ReasoningChain", 
                    "ReasoningStep"
                  ] 
                },
                // Common properties
                description: { type: "string", description: "Description of the node" },
                source: { type: "string", description: "Source of information" },
                emotionalValence: { type: "number", description: "Emotional valence (-1.0 to 1.0)" },
                emotionalArousal: { type: "number", description: "Emotional arousal (0.0-3.0)" },
                observations: { type: "array", items: { type: "string" }, description: "Observations related to this node" },
                
                // Entity properties
                biography: { type: "string", description: "Biographical information for Entity nodes" },
                keyContributions: { type: "array", items: { type: "string" }, description: "Key contributions for Entity nodes" },
                subType: { type: "string", description: "Subtype for Entity nodes (Person, Organization, Location, etc.)" },
                
                // Event properties
                startDate: { type: "string", description: "Start date for Event nodes" },
                endDate: { type: "string", description: "End date for Event nodes" },
                eventStatus: { type: "string", description: "Status for Event nodes (Ongoing, Concluded, Planned)" },
                timestamp: { type: "string", description: "Timestamp for Event nodes" },
                duration: { type: "string", description: "Duration for Event nodes" },
                location: { type: "string", description: "Location for Event nodes" },
                participants: { type: "array", items: { type: "string" }, description: "Participants for Event nodes" },
                outcome: { type: "string", description: "Outcome for Event nodes" },
                significance: { type: "string", description: "Significance for Event nodes" },
                causalPredecessors: { type: "array", items: { type: "string" }, description: "Causal predecessors for Event nodes" },
                causalSuccessors: { type: "array", items: { type: "string" }, description: "Causal successors for Event nodes" },
                
                // Concept properties
                definition: { type: "string", description: "Definition for Concept nodes" },
                examples: { type: "array", items: { type: "string" }, description: "Examples for Concept nodes" },
                relatedConcepts: { type: "array", items: { type: "string" }, description: "Related concepts for Concept nodes" },
                domain: { type: "string", description: "Domain for Concept nodes" },
                perspectives: { type: "array", items: { type: "string" }, description: "Perspectives for Concept nodes" },
                historicalDevelopment: { 
                  type: "array", 
                  items: { 
                    type: "object", 
                    properties: {
                      period: { type: "string" },
                      development: { type: "string" }
                    }
                  }, 
                  description: "Historical development for Concept nodes" 
                },
                abstractionLevel: { type: "number", description: "Abstraction level for Concept nodes (0.0-1.0)" },
                metaphoricalMappings: { type: "array", items: { type: "string" }, description: "Metaphorical mappings for Concept nodes" },
                
                // Attribute properties
                value: { type: ["string", "number"], description: "Value for Attribute nodes" },
                unit: { type: "string", description: "Unit for Attribute nodes" },
                valueType: { 
                  type: "string", 
                  enum: ["numeric", "categorical", "boolean", "text"],
                  description: "Value type for Attribute nodes" 
                },
                possibleValues: { type: "array", items: { type: "string" }, description: "Possible values for Attribute nodes" },
                
                // Proposition properties
                statement: { type: "string", description: "Statement for Proposition nodes" },
                propositionStatus: { 
                  type: "string", 
                  enum: ["fact", "hypothesis", "law", "rule", "claim"],
                  description: "Status for Proposition nodes" 
                },
                truthValue: { type: "boolean", description: "Truth value for Proposition nodes" },
                sources: { type: "array", items: { type: "string" }, description: "Sources for Proposition nodes" },
                evidenceStrength: { type: "number", description: "Evidence strength for Proposition nodes (0.0-1.0)" },
                counterEvidence: { type: "array", items: { type: "string" }, description: "Counter evidence for Proposition nodes" },
                
                // Emotion properties
                intensity: { type: "number", description: "Intensity for Emotion nodes (0.0-1.0)" },
                valence: { type: "number", description: "Valence for Emotion nodes (-1.0 to 1.0)" },
                category: { type: "string", description: "Category for Emotion nodes (Joy, Sadness, Anger, etc.)" },
                subcategory: { type: "string", description: "Subcategory for Emotion nodes" },
                
                // ScientificInsight properties
                hypothesis: { type: "string", description: "Hypothesis for ScientificInsight nodes" },
                evidence: { type: "array", items: { type: "string" }, description: "Evidence for ScientificInsight nodes" },
                scientificMethodology: { type: "string", description: "Methodology for ScientificInsight nodes" },
                field: { type: "string", description: "Field for ScientificInsight nodes" },
                publications: { type: "array", items: { type: "string" }, description: "Publications for ScientificInsight nodes" },
                scientificCounterarguments: { type: "array", items: { type: "string" }, description: "Scientific counterarguments for ScientificInsight nodes" },
                applicationDomains: { type: "array", items: { type: "string" }, description: "Application domains for ScientificInsight nodes" },
                replicationStatus: { type: "string", description: "Replication status for ScientificInsight nodes" },
                surpriseValue: { type: "number", description: "Surprise value for ScientificInsight nodes (0.0-1.0)" },
                
                // Law properties
                conditions: { type: "array", items: { type: "string" }, description: "Conditions for Law nodes" },
                exceptions: { type: "array", items: { type: "string" }, description: "Exceptions for Law nodes" },
                proofs: { type: "array", items: { type: "string" }, description: "Proofs for Law nodes" },
                domainConstraints: { type: "array", items: { type: "string" }, description: "Domain constraints for Law nodes" },
                historicalPrecedents: { type: "array", items: { type: "string" }, description: "Historical precedents for Law nodes" },
                counterexamples: { type: "array", items: { type: "string" }, description: "Counterexamples for Law nodes" },
                formalRepresentation: { type: "string", description: "Formal representation for Law nodes" },
                
                // ReasoningChain properties
                conclusion: { type: "string", description: "Conclusion for ReasoningChain nodes" },
                confidenceScore: { type: "number", description: "Confidence score for ReasoningChain nodes (0.0-1.0)" },
                creator: { type: "string", description: "Creator for ReasoningChain nodes" },
                methodology: { 
                  type: "string", 
                  enum: ["deductive", "inductive", "abductive", "analogical", "mixed"],
                  description: "Methodology for ReasoningChain nodes" 
                },
                sourceThought: { type: "string", description: "Source thought for ReasoningChain nodes" },
                numberOfSteps: { type: "number", description: "Number of steps for ReasoningChain nodes" },
                alternativeConclusionsConsidered: { type: "array", items: { type: "string" }, description: "Alternative conclusions considered for ReasoningChain nodes" },
                relatedPropositions: { type: "array", items: { type: "string" }, description: "Related propositions for ReasoningChain nodes" },
                
                // ReasoningStep properties
                content: { type: "string", description: "Content for ReasoningStep nodes" },
                stepType: { 
                  type: "string", 
                  enum: ["premise", "inference", "evidence", "counterargument", "rebuttal", "conclusion"],
                  description: "Step type for ReasoningStep nodes" 
                },
                evidenceType: { 
                  type: "string", 
                  enum: ["observation", "fact", "assumption", "inference", "expert_opinion", "statistical_data"],
                  description: "Evidence type for ReasoningStep nodes" 
                },
                supportingReferences: { type: "array", items: { type: "string" }, description: "Supporting references for ReasoningStep nodes" },
                stepConfidence: { type: "number", description: "Confidence level for ReasoningStep nodes (0.0-1.0)" },
                alternatives: { type: "array", items: { type: "string" }, description: "Alternatives for ReasoningStep nodes" },
                counterarguments: { type: "array", items: { type: "string" }, description: "Counterarguments for ReasoningStep nodes" },
                assumptions: { type: "array", items: { type: "string" }, description: "Assumptions for ReasoningStep nodes" },
                formalNotation: { type: "string", description: "Formal notation for ReasoningStep nodes" },
                propositions: { type: "array", items: { type: "string" }, description: "Propositions for ReasoningStep nodes" }
              },
              required: ["name", "entityType"]
            }
          }
        },
        required: ["nodes"]
      }
    },
    {
      name: "create_relations",
      description: TOOL_DESCRIPTIONS["create_relations"],
      inputSchema: {
        type: "object",
        properties: {
          relations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                from: { type: "string", description: "Name of the source node" },
                to: { type: "string", description: "Name of the target node" },
                relationType: { type: "string", description: "Type of relationship" },
                relationshipType: { 
                  type: "string", 
                  description: "Standardized relationship type from RelationshipType enum",
                  enum: Object.values(RelationshipType)
                },
                // Enhanced relation properties
                fromType: { type: "string", description: "Type of the source node" },
                toType: { type: "string", description: "Type of the target node" },
                context: { type: "string", description: "Explanatory context of the relationship (30-50 words)" },
                confidenceScore: { type: "number", description: "Confidence score (0.0-1.0)" },
                sources: { type: "array", items: { type: "string" }, description: "Citation sources" },
                weight: { type: "number", description: "Weight of the relationship (0.0-1.0), used for traversal prioritization" },
                
                // Cognitive enhancement fields
                contextType: { 
                  type: "string", 
                  enum: [
                    "hierarchical", 
                    "associative", 
                    "causal", 
                    "temporal", 
                    "analogical", 
                    "attributive"
                  ],
                  description: "Type of context for this relationship"
                },
                contextStrength: { 
                  type: "number", 
                  description: "Strength of this particular context (0.0-1.0)"
                },
                memoryAids: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "Phrases or cues that help recall this relationship"
                },
                relationshipCategory: { 
                  type: "string", 
                  enum: [
                    "hierarchical", 
                    "lateral", 
                    "temporal", 
                    "compositional", 
                    "causal", 
                    "attributive"
                  ],
                  description: "Categorization of relationship type"
                }
              },
              required: ["from", "to", "relationType"]
            }
          }
        },
        required: ["relations"]
      }
    },
    {
      name: "get_temporal_sequence",
      description: TOOL_DESCRIPTIONS["get_temporal_sequence"],
      inputSchema: {
        type: "object",
        properties: {
          startNodeName: { type: "string", description: "Name of the starting node" },
          direction: { type: "string", enum: ["forward", "backward", "both"] },
          maxEvents: { type: "number", description: "Maximum number of events to retrieve" }
        },
        required: ["startNodeName"]
      }
    },
    {
      name: "create_reasoning_chain",
      description: TOOL_DESCRIPTIONS["create_reasoning_chain"],
      inputSchema: {
        type: "object",
        properties: {
          chainName: { 
            type: "string", 
            description: "A concise, descriptive name for the reasoning chain (e.g., 'Climate Policy Impact Analysis')" 
          },
          description: { 
            type: "string", 
            description: "An overview description of what the reasoning chain accomplishes" 
          },
          conclusion: { 
            type: "string", 
            description: "The final conclusion reached through the reasoning process" 
          },
          confidenceScore: { 
            type: "number", 
            description: "Overall confidence score in the conclusion (0.0-1.0)" 
          },
          methodology: { 
            type: "string", 
            enum: ["deductive", "inductive", "abductive", "analogical", "mixed"],
            description: "The reasoning methodology used in this chain (default: mixed)" 
          },
          domain: { 
            type: "string", 
            description: "The field or subject area of the reasoning (e.g., 'Economics', 'Climate Science')" 
          },
          sourceThought: { 
            type: "string", 
            description: "The name of a Thought node this reasoning chain is derived from" 
          },
          tags: { 
            type: "array", 
            items: { type: "string" }, 
            description: "Keywords that categorize the reasoning chain" 
          },
          alternativeConclusionsConsidered: { 
            type: "array", 
            items: { type: "string" }, 
            description: "Other possible conclusions that were considered" 
          },
          steps: { 
            type: "array", 
            items: { 
              type: "object",
              properties: {
                name: { 
                  type: "string", 
                  description: "A unique identifier for the step (e.g., 'ClimatePolicy_Step1')" 
                },
                content: { 
                  type: "string", 
                  description: "The actual content of the reasoning step" 
                },
                stepNumber: { 
                  type: "number", 
                  description: "The position in the sequence (1, 2, 3, etc.)" 
                },
                stepType: { 
                  type: "string", 
                  enum: ["premise", "inference", "evidence", "counterargument", "rebuttal", "conclusion"],
                  description: "The type of reasoning step" 
                },
                evidenceType: { 
                  type: "string", 
                  enum: ["observation", "fact", "assumption", "inference", "expert_opinion", "statistical_data"],
                  description: "For evidence steps, the type of evidence presented" 
                },
                confidence: { 
                  type: "number", 
                  description: "Confidence score for this specific step (0.0-1.0)" 
                },
                supportingReferences: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "Names of existing nodes that support this step" 
                },
                alternatives: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "Alternative formulations of this step that were considered" 
                },
                counterarguments: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "Potential counterarguments to this step" 
                },
                assumptions: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "Underlying assumptions for this step" 
                },
                formalNotation: { 
                  type: "string", 
                  description: "Formal logical or mathematical notation for this step" 
                },
                previousSteps: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "Names of steps that logically precede this one" 
                }
              },
              required: ["name", "content", "stepNumber", "stepType", "confidence"]
            },
            description: "An array of reasoning steps in logical order"
          }
        },
        required: ["chainName", "description", "conclusion", "confidenceScore", "steps"]
      }
    },
    {
      name: "get_reasoning_chain",
      description: TOOL_DESCRIPTIONS["get_reasoning_chain"],
      inputSchema: {
        type: "object",
        properties: {
          chainName: { 
            type: "string", 
            description: "Exact name of a specific reasoning chain to retrieve" 
          },
          entities: {
            type: "array",
            items: { type: "string" },
            description: "Array of Entity node names to find related reasoning chains for"
          },
          concepts: {
            type: "array",
            items: { type: "string" },
            description: "Array of Concept node names to find related reasoning chains for"
          },
          limit: {
            type: "number",
            description: "Maximum number of reasoning chains to return (default: 3)"
          }
        },
        oneOf: [
          { required: ["chainName"] },
          { required: ["entities"] },
          { required: ["concepts"] }
        ]
      }
    }
  ];

  // Register the tool list
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Register the tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (!args) {
      throw new Error(`No arguments provided for tool: ${name}`);
    }

    let result;
    
    switch (name) {
      case "explore_weighted_context":
        try {
          // Support both new and legacy formats
          let nodeNames: string[] = [];
          
          // Check for new format (entities and concepts arrays)
          if (args.entities && Array.isArray(args.entities)) {
            nodeNames = nodeNames.concat(args.entities.slice(0, 3)); // Take up to 3 entity nodes
          }
          
          if (args.concepts && Array.isArray(args.concepts)) {
            nodeNames = nodeNames.concat(args.concepts.slice(0, 3)); // Take up to 3 concept nodes
          }
          
          // Fall back to legacy format if no entities/concepts provided
          if (nodeNames.length === 0 && args.nodeName) {
            nodeNames = [args.nodeName as string];
          }
          
          // Handle empty input case
          if (nodeNames.length === 0) {
            result = "No nodes specified for exploration. Please provide at least one entity or concept name.";
            break;
          }
          
          const maxDepth = args.maxDepth as number || 2;
          const minWeight = args.minWeight as number || 0.0;
          
          console.error(`Exploring context for nodes: ${nodeNames.join(', ')}`);
          
          const graph = await nodeRetriever.exploreContext(nodeNames, {
            maxDepth,
            minWeight,
            // Prioritize key node types most relevant for context
            includeTypes: [
              'Entity', 'Concept', 'Event', 'Proposition',
              'Attribute', 'ScientificInsight', 'Law'
            ]
          });
          
          // Return raw graph data instead of using narrative generator
          result = JSON.stringify(graph, null, 2);
        } catch (error) {
          result = `Error exploring weighted context: ${error.message}`;
        }
        break;

      case "explore_context":
        try {
          const nodeName = args.nodeName as string;
          const maxDepth = args.maxDepth as number || 2;
          
          const graph = await nodeRetriever.exploreContext(nodeName, {
            maxDepth
          });
          
          // Return raw graph data instead of using narrative generator
          result = JSON.stringify(graph, null, 2);
        } catch (error) {
          result = `Error exploring context: ${error.message}`;
        }
        break;

      case "search_nodes":
        try {
          const query = args.query as string;
          const graph = await nodeRetriever.robustSearch(query);
          
          // Return raw graph data instead of using narrative generator
          result = JSON.stringify(graph, null, 2);
        } catch (error) {
          result = `Error searching nodes: ${error.message}`;
        }
        break;

      case "create_nodes":
        try {
          result = await nodeCreator.createEntities(args.nodes as Entity[]);
        } catch (error) {
          result = `Error creating nodes: ${error.message}`;
        }
        break;

      case "create_relations":
        try {
          result = await nodeCreator.createRelations(args.relations as Relation[]);
        } catch (error) {
          result = `Error creating relations: ${error.message}`;
        }
        break;

      case "get_temporal_sequence":
        try {
          const startNodeName = args.startNodeName as string;
          const direction = (args.direction || "both") as 'forward' | 'backward' | 'both';
          const maxEvents = args.maxEvents as number || 10;
          
          result = await nodeRetriever.getTemporalSequence(startNodeName, direction, maxEvents);
        } catch (error) {
          result = `Error getting temporal sequence: ${error.message}`;
        }
        break;

      case "create_reasoning_chain":
        try {
          const steps = args.steps as any[];
          
          // Map chain data with proper types
          const chainData = {
            name: args.chainName as string,
            description: args.description as string,
            conclusion: args.conclusion as string,
            confidenceScore: args.confidenceScore as number,
            sourceThought: args.sourceThought as string,
            creator: "System", // Default creator
            methodology: (args.methodology || "mixed") as 'deductive' | 'inductive' | 'abductive' | 'analogical' | 'mixed',
            domain: args.domain as string,
            tags: args.tags as string[],
            alternativeConclusionsConsidered: args.alternativeConclusionsConsidered as string[]
          };
          
          const chain = await nodeCreator.createReasoningChain(chainData);
          const createdSteps = [];
          if (steps && steps.length > 0) {
            for (const step of steps) {
              const stepWithChain = {
                ...step,
                chainName: chain.name
              };
              const createdStep = await nodeCreator.createReasoningStep(stepWithChain);
              createdSteps.push(createdStep);
            }
          }
          result = {
            success: true,
            message: `Created reasoning chain "${chain.name}" with ${createdSteps.length} steps`,
            chainName: chain.name,
            steps: createdSteps.length
          };
        } catch (error) {
          result = `Error creating reasoning chain: ${error.message}`;
        }
        break;

      case "get_reasoning_chain":
        try {
          // Check if we're retrieving by exact chain name
          if (args.chainName) {
            const chainName = args.chainName as string;
            const knowledgeGraph = await nodeRetriever.getReasoningChain(chainName);
            
            // Extract chain and steps from entities in the knowledge graph
            const chain = knowledgeGraph.entities.find(e => e.entityType === 'ReasoningChain');
            const steps = knowledgeGraph.entities
              .filter(e => e.entityType === 'ReasoningStep')
              .sort((a, b) => {
                // Sort by step number if available
                const aStepNumber = (a as any).stepNumber || 0;
                const bStepNumber = (b as any).stepNumber || 0;
                return aStepNumber - bStepNumber;
              });
            
            result = {
              chains: [{ chain, steps }]
            };
          } 
          // Otherwise, search for related chains based on entities and concepts
          else {
            let topics: string[] = [];
            
            // Collect entity names
            if (args.entities && Array.isArray(args.entities)) {
              topics = topics.concat(args.entities);
            }
            
            // Collect concept names
            if (args.concepts && Array.isArray(args.concepts)) {
              topics = topics.concat(args.concepts);
            }
            
            if (topics.length === 0) {
              result = "No entities or concepts provided. Please specify at least one entity or concept to find related reasoning chains.";
              break;
            }
            
            // Get the limit parameter with a default of 3
            const limit = typeof args.limit === 'number' ? args.limit : 3;
            
            // Collect results for each topic
            const chains = [];
            console.error(`Finding reasoning chains related to topics: ${topics.join(', ')}`);
            
            for (const topic of topics) {
              // Find reasoning chains with similar conclusions to the topic
              const topicLimit = Math.max(1, Math.floor(limit / topics.length));
              const knowledgeGraph = await nodeRetriever.findReasoningChainsWithSimilarConclusion(topic, topicLimit);
              
              // Extract chains from the knowledge graph
              const foundChains = knowledgeGraph.entities.filter(e => e.entityType === 'ReasoningChain');
              
              for (const chain of foundChains) {
                // Get steps for each chain
                const chainSteps = knowledgeGraph.entities
                  .filter(e => e.entityType === 'ReasoningStep' && 
                           knowledgeGraph.relations.some(r => 
                             r.from === chain.name && 
                             r.to === e.name && 
                             r.relationType === 'CONTAINS_STEP'))
                  .sort((a, b) => {
                    // Sort by step number if available
                    const aStepNumber = (a as any).stepNumber || 0;
                    const bStepNumber = (b as any).stepNumber || 0;
                    return aStepNumber - bStepNumber;
                  });
                
                chains.push({
                  chain,
                  steps: chainSteps,
                  relevantTopic: topic
                });
              }
            }
            
            // Ensure we don't exceed the overall limit
            const uniqueChains = chains
              .filter((chain, index, self) => 
                self.findIndex(c => c.chain.name === chain.chain.name) === index)
              .slice(0, limit);
            
            result = {
              chains: uniqueChains,
              count: uniqueChains.length
            };
          }
        } catch (error) {
          result = `Error retrieving reasoning chain: ${error.message}`;
        }
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    // Return the result as a text content
    return { 
      content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }]
    };
  });

  console.error('All tools have been registered successfully');
} 