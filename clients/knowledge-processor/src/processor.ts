import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';
import { Logger } from 'winston';
import { ContentExtractorFactory } from './extractors.js';
import { MCPClientManager } from './mcp-client.js';
import { CheckpointManager } from './checkpoint.js';
import { ChainReconciliationManager } from './chain-reconciliation.js';
import { Config, ProcessingResult, RecoveryAction, ReasoningChain } from './types.js';

/**
 * Main knowledge processor class
 */
export class KnowledgeProcessor {
  private logger: Logger;
  private config: Config;
  private extractorFactory: ContentExtractorFactory;
  private mcpClient: MCPClientManager;
  private checkpointManager: CheckpointManager;
  private chainReconciliationManager: ChainReconciliationManager;
  
  /**
   * Create a new knowledge processor
   * @param logger - Winston logger instance
   * @param config - Configuration object
   * @param checkpointDir - Directory to store checkpoints
   */
  constructor(logger: Logger, config: Config, checkpointDir: string = './checkpoints') {
    this.logger = logger;
    this.config = config;
    this.extractorFactory = new ContentExtractorFactory(logger);
    this.mcpClient = new MCPClientManager(logger, config);
    this.checkpointManager = new CheckpointManager(checkpointDir, logger);
    this.chainReconciliationManager = new ChainReconciliationManager(logger);
  }
  
  /**
   * Initialize the processor
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing knowledge processor');
    await this.mcpClient.connect();
  }
  
  /**
   * Process a single file
   * @param filePath - Path to the file
   */
  async processFile(filePath: string): Promise<void> {
    const absolutePath = path.resolve(filePath);
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    
    // Check if already processed
    if (this.checkpointManager.isFileCompleted(absolutePath)) {
      this.logger.info(`File already processed: ${absolutePath}`);
      return;
    }
    
    try {
      this.logger.info(`Processing file: ${absolutePath}`);
      
      // Get an appropriate extractor
      const extractor = this.extractorFactory.getExtractor(absolutePath);
      
      // Extract content
      const content = await extractor.extractContent(absolutePath);
      
      // Create chunks
      const chunks = this.createChunks(content, this.config.processing.chunkSize);
      this.logger.info(`Created ${chunks.length} chunks from file: ${absolutePath}`);
      
      // Update checkpoint with total chunks
      this.checkpointManager.updateCheckpoint(absolutePath, {
        totalChunks: chunks.length,
        processingStatus: 'in_progress'
      });
      
      // Get the last checkpoint
      const checkpoint = this.checkpointManager.getCheckpoint(absolutePath);
      const startChunkIndex = checkpoint.lastCompletedChunk + 1;
      
      // Process chunks
      for (let i = startChunkIndex; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          this.logger.info(`Processing chunk ${i + 1}/${chunks.length} of file: ${path.basename(absolutePath)}`);
          const result = await this.processChunk(chunk, absolutePath, i);
          
          // Add any reasoning chain fragments to the reconciliation manager
          if (result.reasoningChains && result.reasoningChains.length > 0) {
            this.logger.info(`Adding ${result.reasoningChains.length} reasoning chain fragments to reconciliation manager`);
            
            for (const fragment of result.reasoningChains) {
              this.chainReconciliationManager.addChainFragment(absolutePath, fragment);
            }
          }
          
          // Update checkpoint
          this.checkpointManager.updateCheckpoint(absolutePath, {
            lastCompletedChunk: i,
            processingStatus: 'in_progress'
          });
        } catch (error) {
          // Handle errors
          const recoveryAction = this.handleChunkError(error as Error, {
            chunkIndex: i,
            filePath: absolutePath,
            retryCount: checkpoint.retryCount || 0
          });
          
          this.checkpointManager.updateCheckpoint(absolutePath, {
            lastAttemptedChunk: i,
            lastError: (error as Error).message,
            retryCount: (checkpoint.retryCount || 0) + 1
          });
          
          if (recoveryAction.action === 'retry') {
            if (checkpoint.retryCount >= this.config.processing.maxRetries) {
              this.logger.error(`Maximum retry count reached for chunk ${i} of file: ${absolutePath}`);
              this.checkpointManager.updateCheckpoint(absolutePath, {
                processingStatus: 'failed'
              });
              break;
            }
            
            this.logger.info(`Retrying chunk ${i} of file: ${absolutePath} after delay...`);
            await new Promise(resolve => setTimeout(resolve, recoveryAction.delay || 5000));
            i--; // Retry the same chunk
          } else if (recoveryAction.action === 'split-chunk') {
            this.logger.info(`Splitting chunk ${i} of file: ${absolutePath} for processing...`);
            
            // Split the chunk
            const subChunks = this.splitChunk(chunk);
            
            // Process sub-chunks
            for (const subChunk of subChunks) {
              await this.processChunk(subChunk, absolutePath, i);
            }
            
            // Mark this chunk as completed
            this.checkpointManager.updateCheckpoint(absolutePath, {
              lastCompletedChunk: i,
              processingStatus: 'in_progress'
            });
          } else {
            // Skip this chunk
            this.logger.warn(`Skipping chunk ${i} of file: ${absolutePath} due to error`);
          }
        }
      }
      
      // After all chunks are processed, reconcile reasoning chains
      this.logger.info('Reconciling reasoning chains across chunks');
      const completeChains = this.chainReconciliationManager.reconcileChains(absolutePath);
      
      // Persist complete chains to the database
      if (completeChains.length > 0) {
        this.logger.info(`Persisting ${completeChains.length} complete reasoning chains to the database`);
        await this.persistReasoningChains(completeChains, absolutePath);
      }
      
      // Mark file as completed
      this.checkpointManager.markFileAsCompleted(absolutePath);
      this.logger.info(`Completed processing file: ${absolutePath}`);
    } catch (error) {
      this.logger.error(`Error processing file ${absolutePath}: ${(error as Error).message}`);
      this.checkpointManager.updateCheckpoint(absolutePath, {
        processingStatus: 'failed',
        lastError: (error as Error).message
      });
      throw error;
    }
  }
  
  /**
   * Process a directory of files
   * @param dirPath - Path to the directory
   * @param recursive - Whether to process files in subdirectories
   */
  async processDirectory(dirPath: string, recursive: boolean = false): Promise<void> {
    const absolutePath = path.resolve(dirPath);
    
    // Check if directory exists
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
      throw new Error(`Directory not found: ${absolutePath}`);
    }
    
    this.logger.info(`Processing directory: ${absolutePath}`);
    
    // Find all files
    const pattern = recursive ? '**/*' : '*';
    const files = await glob(path.join(absolutePath, pattern), { nodir: true });
    
    this.logger.info(`Found ${files.length} files in directory: ${absolutePath}`);
    
    // Get unprocessed files
    const unprocessedFiles = files.filter((file: string) => !this.checkpointManager.isFileCompleted(file));
    
    this.logger.info(`Processing ${unprocessedFiles.length} unprocessed files`);
    
    // Process concurrently with limited concurrency
    const concurrency = this.config.processing.concurrency;
    const chunks = [];
    
    for (let i = 0; i < unprocessedFiles.length; i += concurrency) {
      chunks.push(unprocessedFiles.slice(i, i + concurrency));
    }
    
    for (const chunk of chunks) {
      await Promise.all(chunk.map((file: string) => this.processFile(file).catch(error => {
        this.logger.error(`Error processing file ${file}: ${error.message}`);
      })));
    }
    
    this.logger.info(`Completed processing directory: ${absolutePath}`);
  }
  
  /**
   * Process a single chunk
   * @param chunk - Text chunk
   * @param source - Source file path
   * @param chunkIndex - Index of the chunk
   */
  private async processChunk(chunk: string, source: string, chunkIndex: number): Promise<ProcessingResult> {
    // Process the chunk using MCP client
    return this.mcpClient.processChunk(chunk, `${source}#chunk${chunkIndex}`);
  }
  
  /**
   * Persist complete reasoning chains to the database
   * @param chains - Complete reasoning chains
   * @param source - Source file path
   */
  private async persistReasoningChains(chains: ReasoningChain[], source: string): Promise<void> {
    if (!this.mcpClient) {
      throw new Error('MCP client not connected');
    }
    
    for (const chain of chains) {
      try {
        // Call create_reasoning_chain tool through the MCP client
        const session = (this.mcpClient as any).session;
        if (!session) {
          throw new Error('MCP session not available');
        }
        
        // Create the chain
        await session.call_tool('create_reasoning_chain', {
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
        
        // Create each step
        for (const step of chain.steps) {
          await session.call_tool('create_reasoning_step', {
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
        
        this.logger.info(`Successfully persisted reasoning chain: ${chain.chainName}`);
      } catch (error) {
        this.logger.error(`Error persisting reasoning chain ${chain.chainName}: ${(error as Error).message}`);
      }
    }
  }
  
  /**
   * Create chunks from content
   * @param content - Content to chunk
   * @param chunkSize - Maximum chunk size in characters
   * @returns Array of chunks
   */
  private createChunks(content: string, chunkSize: number): string[] {
    // If content is small enough, return as a single chunk
    if (content.length <= chunkSize) {
      return [content];
    }
    
    const chunks: string[] = [];
    
    // Split by paragraphs first
    const paragraphs = content.split(/\n\n+/);
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      // If adding this paragraph exceeds the chunk size and we already have content,
      // save the current chunk and start a new one
      if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // If the paragraph itself is larger than chunk size, split it further
      if (paragraph.length > chunkSize) {
        const paragraphChunks = this.splitLargeParagraph(paragraph, chunkSize);
        
        // If we have content in currentChunk, add it to the first paragraph chunk
        if (currentChunk.length > 0) {
          paragraphChunks[0] = currentChunk + '\n\n' + paragraphChunks[0];
          currentChunk = '';
        }
        
        // Add all but the last paragraph chunk
        for (let i = 0; i < paragraphChunks.length - 1; i++) {
          chunks.push(paragraphChunks[i]);
        }
        
        // Keep the last paragraph chunk for the next iteration
        currentChunk = paragraphChunks[paragraphChunks.length - 1];
      } else {
        // Add paragraph to current chunk
        if (currentChunk.length > 0) {
          currentChunk += '\n\n';
        }
        currentChunk += paragraph;
      }
    }
    
    // Add the last chunk if not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  /**
   * Split a large paragraph into smaller chunks
   * @param paragraph - Paragraph to split
   * @param chunkSize - Maximum chunk size
   * @returns Array of paragraph chunks
   */
  private splitLargeParagraph(paragraph: string, chunkSize: number): string[] {
    const chunks: string[] = [];
    
    // Split by sentences (simplified)
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    let currentChunk = '';
    
    for (const sentence of sentences) {
      // If adding this sentence exceeds the chunk size and we already have content,
      // save the current chunk and start a new one
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      // If the sentence itself is larger than chunk size, split it further
      if (sentence.length > chunkSize) {
        // Split by words as a last resort
        const words = sentence.split(/\s+/);
        
        for (const word of words) {
          if (currentChunk.length + word.length + 1 > chunkSize) {
            chunks.push(currentChunk);
            currentChunk = word;
          } else {
            if (currentChunk.length > 0) {
              currentChunk += ' ';
            }
            currentChunk += word;
          }
        }
      } else {
        // Add sentence to current chunk
        if (currentChunk.length > 0) {
          currentChunk += ' ';
        }
        currentChunk += sentence;
      }
    }
    
    // Add the last chunk if not empty
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  /**
   * Split a chunk in half
   * @param chunk - Chunk to split
   * @returns Array of sub-chunks
   */
  private splitChunk(chunk: string): string[] {
    // Try to split at paragraph boundaries
    const paragraphs = chunk.split(/\n\n+/);
    
    if (paragraphs.length > 1) {
      const midpoint = Math.floor(paragraphs.length / 2);
      return [
        paragraphs.slice(0, midpoint).join('\n\n'),
        paragraphs.slice(midpoint).join('\n\n')
      ];
    }
    
    // If no paragraphs, split by sentences
    const sentences = chunk.split(/(?<=[.!?])\s+/);
    
    if (sentences.length > 1) {
      const midpoint = Math.floor(sentences.length / 2);
      return [
        sentences.slice(0, midpoint).join(' '),
        sentences.slice(midpoint).join(' ')
      ];
    }
    
    // If all else fails, split in the middle
    const midpoint = Math.floor(chunk.length / 2);
    return [
      chunk.substring(0, midpoint),
      chunk.substring(midpoint)
    ];
  }
  
  /**
   * Handle a chunk processing error
   * @param error - Error that occurred
   * @param context - Error context
   * @returns Recovery action
   */
  private handleChunkError(error: Error, context: {
    chunkIndex: number;
    filePath: string;
    retryCount: number;
  }): RecoveryAction {
    const errorMessage = error.message.toLowerCase();
    
    // Handle specific error types
    if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
      // Rate limiting error
      return {
        action: 'retry',
        delay: 60000 // 1 minute
      };
    } else if (errorMessage.includes('connection') || errorMessage.includes('network')) {
      // Connection error
      const delay = Math.min(1000 * Math.pow(2, context.retryCount), 300000); // exponential backoff, max 5 minutes
      return {
        action: 'retry',
        delay
      };
    } else if (
      errorMessage.includes('token limit') || 
      errorMessage.includes('context limit') || 
      errorMessage.includes('too long') ||
      errorMessage.includes('truncated') ||
      errorMessage.includes('incomplete json')
    ) {
      // Content too large
      return {
        action: 'split-chunk'
      };
    }
    
    // Default: retry with a short delay
    return {
      action: 'retry',
      delay: 5000
    };
  }
  
  /**
   * Show processing status
   */
  showStatus(): void {
    const stats = this.checkpointManager.getStats();
    
    this.logger.info('=== Knowledge Processing Status ===');
    this.logger.info(`Total files: ${stats.total}`);
    this.logger.info(`Completed: ${stats.completed}`);
    this.logger.info(`In progress: ${stats.inProgress}`);
    this.logger.info(`Failed: ${stats.failed}`);
    this.logger.info(`Not started: ${stats.notStarted}`);
    
    if (stats.failed > 0) {
      const failedFiles = this.checkpointManager.getFailedFiles();
      this.logger.info('Failed files:');
      failedFiles.forEach(file => {
        const checkpoint = this.checkpointManager.getCheckpoint(file);
        this.logger.info(`- ${file}: ${checkpoint.lastError}`);
      });
    }
  }
  
  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up resources');
    await this.mcpClient.disconnect();
  }
} 