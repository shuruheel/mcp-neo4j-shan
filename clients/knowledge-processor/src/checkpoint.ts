import fs from 'fs-extra';
import path from 'path';
import { Logger } from 'winston';
import { CheckpointDB, CheckpointState, ReasoningChainFragment } from './types.js';

/**
 * Checkpoint manager for tracking processing progress
 */
export class CheckpointManager {
  private db: CheckpointDB;
  private checkpointPath: string;
  private logger: Logger;
  
  /**
   * Create a new checkpoint manager
   * @param checkpointDir - Directory to store checkpoint files
   * @param logger - Winston logger instance
   */
  constructor(checkpointDir: string, logger: Logger) {
    this.logger = logger;
    
    // Create checkpoint directory if it doesn't exist
    fs.mkdirpSync(checkpointDir);
    
    this.checkpointPath = path.join(checkpointDir, 'knowledge-processor-checkpoint.json');
    this.db = this.loadCheckpointDB();
  }
  
  /**
   * Load checkpoint database from disk
   * @returns Checkpoint database
   */
  private loadCheckpointDB(): CheckpointDB {
    try {
      if (fs.existsSync(this.checkpointPath)) {
        this.logger.debug(`Loading checkpoint DB from ${this.checkpointPath}`);
        return JSON.parse(fs.readFileSync(this.checkpointPath, 'utf8'));
      }
    } catch (error) {
      this.logger.error(`Error loading checkpoint DB: ${(error as Error).message}`);
      this.logger.info('Creating new checkpoint DB');
    }
    
    return {
      completedFiles: [],
      fileStates: {},
      pendingChains: {}
    };
  }
  
  /**
   * Save checkpoint database to disk
   */
  private saveCheckpointDB(): void {
    try {
      this.logger.debug(`Saving checkpoint DB to ${this.checkpointPath}`);
      fs.writeFileSync(this.checkpointPath, JSON.stringify(this.db, null, 2));
    } catch (error) {
      this.logger.error(`Error saving checkpoint DB: ${(error as Error).message}`);
    }
  }
  
  /**
   * Check if a file has been completely processed
   * @param file - File path
   * @returns True if the file is completed
   */
  isFileCompleted(file: string): boolean {
    return this.db.completedFiles.includes(file);
  }
  
  /**
   * Get the checkpoint state for a file
   * @param file - File path
   * @returns Checkpoint state
   */
  getCheckpoint(file: string): CheckpointState {
    return this.db.fileStates[file] || {
      lastCompletedChunk: -1,
      totalChunks: 0,
      processingStatus: 'not_started',
      retryCount: 0
    };
  }
  
  /**
   * Update the checkpoint state for a file
   * @param file - File path
   * @param state - Partial checkpoint state to update
   */
  updateCheckpoint(file: string, state: Partial<CheckpointState>): void {
    this.db.fileStates[file] = {
      ...this.getCheckpoint(file),
      ...state,
      lastUpdated: new Date().toISOString()
    };
    
    this.saveCheckpointDB();
  }
  
  /**
   * Mark a file as completed
   * @param file - File path
   */
  markFileAsCompleted(file: string): void {
    if (!this.db.completedFiles.includes(file)) {
      this.db.completedFiles.push(file);
      
      // Update the file state
      this.updateCheckpoint(file, {
        processingStatus: 'completed'
      });
      
      this.saveCheckpointDB();
    }
  }
  
  /**
   * Store pending reasoning chain fragments
   * @param file - File path
   * @param fragments - Reasoning chain fragments
   */
  storePendingChains(file: string, fragments: ReasoningChainFragment[]): void {
    this.db.pendingChains[file] = fragments;
    this.saveCheckpointDB();
  }
  
  /**
   * Get pending reasoning chain fragments for a file
   * @param file - File path
   * @returns Array of reasoning chain fragments
   */
  getPendingChains(file: string): ReasoningChainFragment[] {
    return this.db.pendingChains[file] || [];
  }
  
  /**
   * Clear pending reasoning chain fragments for a file
   * @param file - File path
   */
  clearPendingChains(file: string): void {
    delete this.db.pendingChains[file];
    this.saveCheckpointDB();
  }
  
  /**
   * Get all completed files
   * @returns Array of completed file paths
   */
  getCompletedFiles(): string[] {
    return [...this.db.completedFiles];
  }
  
  /**
   * Get all files with processing errors
   * @returns Array of file paths with errors
   */
  getFailedFiles(): string[] {
    return Object.entries(this.db.fileStates)
      .filter(([_, state]) => state.processingStatus === 'failed' || state.processingStatus === 'error')
      .map(([file]) => file);
  }
  
  /**
   * Get processing stats
   * @returns Object with processing statistics
   */
  getStats(): {
    completed: number;
    failed: number;
    inProgress: number;
    notStarted: number;
    total: number;
    pendingChains: number;
  } {
    const states = Object.values(this.db.fileStates);
    const pendingChainCount = Object.values(this.db.pendingChains)
      .reduce((total, chains) => total + chains.length, 0);
    
    return {
      completed: this.db.completedFiles.length,
      failed: states.filter(state => state.processingStatus === 'failed' || state.processingStatus === 'error').length,
      inProgress: states.filter(state => state.processingStatus === 'in_progress').length,
      notStarted: states.filter(state => state.processingStatus === 'not_started').length,
      total: Object.keys(this.db.fileStates).length,
      pendingChains: pendingChainCount
    };
  }
} 