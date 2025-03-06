import { ClientSession, StdioServerParameters } from '@modelcontextprotocol/sdk';
import { stdio_client } from '@modelcontextprotocol/sdk/dist/client/stdio.js';
import { Anthropic } from '@anthropic-ai/sdk';
import { Logger } from 'winston';
import { 
  Config, 
  ProcessingResult, 
  Node, 
  Relation, 
  ReasoningChainFragment,
  EntityRelationResult,
  ReasoningChainResult,
  NodeType,
  RelationshipType
} from './types.js';

/**
 * MCP client manager for connecting to and interacting with MCP servers
 */
export class MCPClientManager {
  private session: ClientSession | null = null;
  private anthropic: Anthropic;
  private logger: Logger;
  private config: Config;
  
  /**
   * Create a new MCP client manager
   * @param logger - Winston logger instance
   * @param config - Configuration object
   */
  constructor(logger: Logger, config: Config) {
    this.logger = logger;
    this.config = config;
    this.anthropic = new Anthropic({
      apiKey: config.anthropic.apiKey,
    });
  }
  
  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    try {
      this.logger.info(`Connecting to MCP server at: ${this.config.mcp.serverPath}`);
      
      const serverPath = this.config.mcp.serverPath;
      const isJavaScript = serverPath.endsWith('.js');
      const isPython = serverPath.endsWith('.py');
      
      if (!isJavaScript && !isPython) {
        throw new Error('MCP server path must end with .js or .py');
      }
      
      const command = isPython ? 'python' : 'node';
      
      const serverParams = StdioServerParameters({
        command,
        args: [serverPath],
        env: this.config.neo4j ? {
          NEO4J_URI: this.config.neo4j.uri,
          NEO4J_USERNAME: this.config.neo4j.username,
          NEO4J_PASSWORD: this.config.neo4j.password
        } : undefined
      });
      
      const stdioTransport = await stdio_client(serverParams);
      const [stdio, write] = stdioTransport;
      
      this.session = new ClientSession(stdio, write);
      await this.session.initialize();
      
      // List available tools to confirm connection
      const toolsResponse = await this.session.list_tools();
      this.logger.info(`Connected to MCP server with tools: ${toolsResponse.tools.map((t: any) => t.name).join(', ')}`);
    } catch (error) {
      this.logger.error(`Failed to connect to MCP server: ${(error as Error).message}`);
      throw new Error(`Failed to connect to MCP server: ${(error as Error).message}`);
    }
  }
  
  /**
   * Process a text chunk and extract knowledge
   * Uses separate calls for entity/relation extraction and reasoning chain extraction
   * @param chunk - Text chunk to process
   * @param source - Source of the chunk (e.g., file name)
   * @returns Processing result with nodes, relations, and reasoning chains
   */
  async processChunk(chunk: string, source: string): Promise<ProcessingResult> {
    if (!this.session) {
      throw new Error('MCP client not connected. Call connect() first.');
    }
    
    try {
      this.logger.info(`Processing chunk from source: ${source}`);
      this.logger.debug(`Chunk length: ${chunk.length} characters`);
      
      // First pass: Extract entities and relations only
      const entityRelationResult = await this.extractEntitiesAndRelations(chunk, source);
      
      // Second pass: Extract reasoning chains only
      const reasoningChainResult = await this.extractReasoningChains(chunk, source);
      
      // Combine results
      return {
        nodes: entityRelationResult.nodes,
        relations: entityRelationResult.relations,
        reasoningChains: reasoningChainResult.reasoningChains
      };
    } catch (error) {
      this.logger.error(`Error processing chunk: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * Extract entities and relations from a text chunk
   * @param chunk - Text chunk to process
   * @param source - Source of the chunk
   * @returns Entity and relation extraction result
   */
  private async extractEntitiesAndRelations(chunk: string, source: string): Promise<EntityRelationResult> {
    if (!this.session) {
      throw new Error('MCP client not connected. Call connect() first.');
    }
    
    this.logger.info(`Extracting entities and relations from chunk source: ${source}`);
    
    // First, get available tools
    const toolsResponse = await this.session.list_tools();
    const availableTools = toolsResponse.tools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }));
    
    // Generate prompt for Claude to extract entities and relations
    const entityRelationPrompt = `
You are an expert knowledge extraction system. Your task is to extract entities, concepts, and their relationships from the following text, formatting them for ingestion into a knowledge graph.

Extract ALL of the following node types when present:
- Entity: People, organizations, products, physical objects (include attributes like description, biography, keyContributions, etc.)
- Event: Time-bound occurrences (include attributes like startDate, endDate, location, participants, etc.)
- Concept: Abstract ideas, theories, principles, frameworks (include attributes like definition, domain, etc.)
- Attribute: Qualities or properties (include attributes like value, unit, etc.)
- Proposition: Facts, claims, rules (include attributes like statement, confidence, etc.)
- Emotion: Emotional states and feelings (include attributes like intensity, valence, etc.)
- Agent: Cognitive entities capable of action (include attributes like agentType, capabilities, etc.)
- ScientificInsight: Research findings (include attributes like hypothesis, evidence, etc.)
- Law: Established principles or rules (include attributes like statement, conditions, etc.)
- Thought: Analyses or interpretations (include attributes like content, confidence, etc.)

For relations, always include:
- from: The name of the source node
- to: The name of the target node
- relationType: A descriptive label (e.g., ADVOCATES, CONTRIBUTES_TO)
- relationshipType: One of: HIERARCHICAL, COMPOSITIONAL, SPATIAL, TEMPORAL, PARTICIPATION, CAUSAL, SEQUENTIAL, SOCIAL, PROPERTY, GENERAL, EMOTIONAL, BELIEF, SOURCE
- context: Brief explanation of how the nodes are connected
- confidenceScore: Number from 0.0 to 1.0 (if possible)
- weight: Number from 0.0 to 1.0 for relationship strength (if possible)

Extract ONLY the significant, noteworthy nodes and relationships. Look for:
1. Named entities with importance to the domain
2. Key concepts that structure understanding
3. Events that have causal or temporal significance
4. Important relationships between nodes that reflect real knowledge

SOURCE TEXT:
${chunk}

Output ONLY a JSON structure with arrays for nodes and relations:
{
  "nodes": [
    {
      "name": "string",
      "entityType": "Entity|Event|Concept|etc.",
      "description": "string",
      ... other attributes
    }
  ],
  "relations": [
    {
      "from": "string",
      "to": "string",
      "relationType": "string",
      "relationshipType": "HIERARCHICAL|etc.",
      "context": "string",
      ... other attributes
    }
  ]
}
`;
    
    // Use Claude to extract entities and relations
    const response = await this.anthropic.messages.create({
      model: this.config.anthropic.model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: entityRelationPrompt }]
    });
    
    // Parse the response to extract JSON
    // Get content from the content blocks, accounting for possible different types
    const contentText = response.content[0].type === 'text' 
      ? response.content[0].text 
      : JSON.stringify(response.content[0]);
    
    const extractedJson = this.extractJsonFromText(contentText);
    
    if (!extractedJson) {
      throw new Error('Failed to extract valid JSON from Claude response');
    }
    
    // Validate and process the extracted nodes and relations
    const result: EntityRelationResult = {
      nodes: [],
      relations: []
    };
    
    // Process nodes
    if (extractedJson.nodes && Array.isArray(extractedJson.nodes) && extractedJson.nodes.length > 0) {
      // Validate each node
      const validNodes = extractedJson.nodes.filter((node: any) => this.validateNodeStructure(node));
      
      this.logger.info(`Extracted ${validNodes.length} valid nodes from chunk`);
      
      // Add source to nodes
      const nodesWithSource = validNodes.map((node: Node) => ({
        ...node,
        source: node.source || source
      }));
      
      // Call create_nodes tool
      const createNodesResponse = await this.session.call_tool('create_nodes', {
        nodes: nodesWithSource
      });
      
      result.nodes = nodesWithSource;
    }
    
    // Process relations
    if (extractedJson.relations && Array.isArray(extractedJson.relations) && extractedJson.relations.length > 0) {
      // Validate each relation
      const validRelations = extractedJson.relations.filter((relation: any) => this.validateRelationStructure(relation));
      
      this.logger.info(`Extracted ${validRelations.length} valid relations from chunk`);
      
      // Call create_relations tool
      const createRelationsResponse = await this.session.call_tool('create_relations', {
        relations: validRelations
      });
      
      result.relations = validRelations;
    }
    
    return result;
  }
  
  /**
   * Extract reasoning chains from a text chunk
   * @param chunk - Text chunk to process
   * @param source - Source of the chunk
   * @returns Reasoning chain extraction result
   */
  private async extractReasoningChains(chunk: string, source: string): Promise<ReasoningChainResult> {
    if (!this.session) {
      throw new Error('MCP client not connected. Call connect() first.');
    }
    
    this.logger.info(`Extracting reasoning chains from chunk source: ${source}`);
    
    // Generate prompt for Claude to extract reasoning chains
    const reasoningChainPrompt = `
You are an expert at identifying structured reasoning in text. Analyze this passage for complete or partial reasoning chains.

A reasoning chain consists of:
- A central thesis or conclusion
- Supporting premises or evidence
- Logical steps connecting premises to conclusion
- Optional: counterarguments and rebuttals

For each detected reasoning chain or fragment, include:
- chainName: A descriptive name for the reasoning chain
- description: Overview of what the reasoning is about
- conclusion: The final conclusion if present
- confidenceScore: How confident you are in this reasoning (0.0-1.0)
- methodology: The reasoning approach (deductive, inductive, abductive, analogical, mixed)
- domain: The field or subject area (optional)
- completeness: Is this a complete chain or fragment (complete, partial-beginning, partial-middle, partial-end)
- connectionClues: Any references to content that might appear in other parts of the document
- steps: The logical steps in sequence, with these properties for each step:
  - name: A unique identifier for the step
  - content: The actual content of the reasoning step
  - stepNumber: The position in the sequence (1, 2, 3, etc.)
  - stepType: One of 'premise', 'inference', 'evidence', 'counterargument', 'rebuttal', 'conclusion'
  - confidence: How confident you are in this specific step (0.0-1.0)
  - evidenceType: The type of evidence (observation, fact, assumption, inference, expert_opinion, statistical_data) if applicable
  - supportingReferences: Names of existing nodes that support this step
  - previousSteps: Names of steps that logically precede this one

Only extract well-structured reasoning, not every claim or statement.

SOURCE TEXT:
${chunk}

Output ONLY a JSON structure with an array of reasoning chain fragments:
{
  "reasoningChains": [
    {
      "chainName": "string",
      "description": "string",
      "conclusion": "string",
      "confidenceScore": number,
      "methodology": "deductive|inductive|abductive|analogical|mixed",
      "domain": "string",
      "completeness": "complete|partial-beginning|partial-middle|partial-end",
      "connectionClues": ["string"],
      "steps": [
        {
          "name": "string",
          "content": "string",
          "stepNumber": number,
          "stepType": "premise|inference|evidence|counterargument|rebuttal|conclusion",
          "confidence": number,
          ... other step properties
        }
      ]
    }
  ]
}
`;
    
    // Use Claude to extract reasoning chains
    const response = await this.anthropic.messages.create({
      model: this.config.anthropic.model,
      max_tokens: 4000,
      messages: [{ role: 'user', content: reasoningChainPrompt }]
    });
    
    // Parse the response to extract JSON
    // Get content from the content blocks, accounting for possible different types
    const contentText = response.content[0].type === 'text' 
      ? response.content[0].text 
      : JSON.stringify(response.content[0]);
    
    const extractedJson = this.extractJsonFromText(contentText);
    
    if (!extractedJson || !extractedJson.reasoningChains) {
      this.logger.info('No reasoning chains found in chunk');
      return { reasoningChains: [] };
    }
    
    // Validate the extracted reasoning chains
    const result: ReasoningChainResult = {
      reasoningChains: []
    };
    
    if (Array.isArray(extractedJson.reasoningChains) && extractedJson.reasoningChains.length > 0) {
      // Validate each reasoning chain
      const validChains = extractedJson.reasoningChains.filter((chain: any) => this.validateReasoningChainStructure(chain));
      
      this.logger.info(`Extracted ${validChains.length} valid reasoning chain fragments from chunk`);
      
      // Add source and chunk index to fragments
      const chainsWithSource = validChains.map((chain: any) => ({
        ...chain,
        source: source,
        chunkIndex: parseInt(source.split('#chunk')[1] || '0', 10)
      }));
      
      // For complete chains, create them immediately
      const completeChains = chainsWithSource.filter((chain: ReasoningChainFragment) => 
        chain.completeness === 'complete'
      );
      
      if (completeChains.length > 0) {
        this.logger.info(`Creating ${completeChains.length} complete reasoning chains immediately`);
        
        // Process each complete reasoning chain
        for (const chain of completeChains) {
          try {
            // Call create_reasoning_chain tool
            const createChainResponse = await this.session.call_tool('create_reasoning_chain', {
              chainName: chain.chainName,
              description: chain.description,
              conclusion: chain.conclusion,
              confidenceScore: chain.confidenceScore,
              methodology: chain.methodology,
              domain: chain.domain,
              creator: "KnowledgeProcessor",
              tags: chain.tags,
              alternativeConclusionsConsidered: []
            });
            
            // Create reasoning steps
            for (const step of chain.steps) {
              const createStepResponse = await this.session.call_tool('create_reasoning_step', {
                chainName: chain.chainName,
                name: step.name,
                content: step.content,
                stepNumber: step.stepNumber,
                stepType: step.stepType,
                evidenceType: step.evidenceType,
                supportingReferences: step.supportingReferences,
                confidence: step.confidence,
                alternatives: step.alternatives,
                counterarguments: step.counterarguments,
                assumptions: step.assumptions,
                formalNotation: step.formalNotation,
                previousSteps: step.previousSteps
              });
            }
          } catch (error) {
            this.logger.error(`Error creating reasoning chain ${chain.chainName}: ${(error as Error).message}`);
          }
        }
      }
      
      result.reasoningChains = chainsWithSource;
    }
    
    return result;
  }
  
  /**
   * Validate node structure
   * @param node - Node to validate
   * @returns True if the node is valid
   */
  private validateNodeStructure(node: any): boolean {
    // Check required fields
    if (!node.name || !node.entityType) {
      this.logger.debug(`Invalid node missing required fields: ${JSON.stringify(node)}`);
      return false;
    }
    
    // Check if entityType is valid
    try {
      const entityType = node.entityType as NodeType;
      if (!Object.values(NodeType).includes(entityType)) {
        this.logger.debug(`Invalid node type: ${entityType}`);
        return false;
      }
    } catch (error) {
      this.logger.debug(`Invalid node type: ${node.entityType}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Validate relation structure
   * @param relation - Relation to validate
   * @returns True if the relation is valid
   */
  private validateRelationStructure(relation: any): boolean {
    // Check required fields
    if (!relation.from || !relation.to || !relation.relationType || !relation.relationshipType || !relation.context) {
      this.logger.debug(`Invalid relation missing required fields: ${JSON.stringify(relation)}`);
      return false;
    }
    
    // Check if relationshipType is valid
    try {
      const relationshipType = relation.relationshipType as RelationshipType;
      if (!Object.values(RelationshipType).includes(relationshipType)) {
        this.logger.debug(`Invalid relationship type: ${relationshipType}`);
        return false;
      }
    } catch (error) {
      this.logger.debug(`Invalid relationship type: ${relation.relationshipType}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Validate reasoning chain structure
   * @param chain - Reasoning chain to validate
   * @returns True if the chain is valid
   */
  private validateReasoningChainStructure(chain: any): boolean {
    // Check required fields
    if (!chain.chainName || !chain.description || !chain.conclusion || 
        chain.confidenceScore === undefined || !chain.methodology || !chain.steps) {
      this.logger.debug(`Invalid reasoning chain missing required fields: ${JSON.stringify(chain)}`);
      return false;
    }
    
    // Check if steps is an array
    if (!Array.isArray(chain.steps) || chain.steps.length === 0) {
      this.logger.debug(`Invalid reasoning chain with no steps: ${chain.chainName}`);
      return false;
    }
    
    // Check required fields for each step
    for (const step of chain.steps) {
      if (!step.name || !step.content || step.stepNumber === undefined || !step.stepType || step.confidence === undefined) {
        this.logger.debug(`Invalid reasoning step missing required fields: ${JSON.stringify(step)}`);
        return false;
      }
    }
    
    // Add default completeness if not present
    if (!chain.completeness) {
      chain.completeness = 'unknown';
    }
    
    // Add empty connection clues if not present
    if (!chain.connectionClues) {
      chain.connectionClues = [];
    }
    
    return true;
  }
  
  /**
   * Extract JSON from a text response
   * @param text - Text to extract JSON from
   * @returns Parsed JSON object or null if no valid JSON found
   */
  private extractJsonFromText(text: string): any {
    try {
      // Look for JSON blocks in markdown format
      const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/;
      const match = text.match(jsonRegex);
      
      if (match && match[1]) {
        return JSON.parse(match[1].trim());
      }
      
      // If no markdown blocks, try to find JSON object in the text
      const jsonObjectRegex = /(\{[\s\S]*\})/;
      const objectMatch = text.match(jsonObjectRegex);
      
      if (objectMatch && objectMatch[1]) {
        return JSON.parse(objectMatch[1].trim());
      }
      
      // If all else fails, try to parse the entire text as JSON
      return JSON.parse(text.trim());
    } catch (error) {
      this.logger.error(`Error extracting JSON from text: ${(error as Error).message}`);
      return null;
    }
  }
  
  /**
   * Close the connection to the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.session) {
      this.logger.info('Disconnecting from MCP server');
      // No explicit close method in ClientSession, but we should clean up if needed
    }
  }
} 