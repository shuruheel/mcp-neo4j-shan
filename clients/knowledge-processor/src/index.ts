#!/usr/bin/env node

import { Command } from 'commander';
import path from 'path';
import fs from 'fs-extra';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { KnowledgeProcessor } from './processor.js';

// Create the log directory
fs.mkdirpSync('./logs');

// Load configuration
let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(`Error loading configuration: ${(error as Error).message}`);
  console.error("Please make sure your .env file is set up correctly.");
  process.exit(1);
}

// Initialize logger
const logger = createLogger(config);

// Create the knowledge processor
const processor = new KnowledgeProcessor(logger, config);

// Set up command line interface
const program = new Command();

program
  .name('knowledge-processor')
  .description('Process knowledge from various media types into a Neo4j graph')
  .version('1.0.0');

program
  .command('process')
  .description('Process a single file')
  .argument('<file>', 'Path to the file to process')
  .option('-c, --checkpoint-dir <dir>', 'Directory to store checkpoints', './checkpoints')
  .action(async (file, options) => {
    try {
      logger.info(`Starting to process file: ${file}`);
      
      const checkpointDir = path.resolve(options.checkpointDir);
      const processor = new KnowledgeProcessor(logger, config, checkpointDir);
      
      await processor.initialize();
      await processor.processFile(path.resolve(file));
      await processor.cleanup();
      
      logger.info('Processing completed successfully');
    } catch (error) {
      logger.error(`Processing failed: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('process-batch')
  .description('Process all files in a directory')
  .argument('<directory>', 'Path to the directory containing files to process')
  .option('-c, --checkpoint-dir <dir>', 'Directory to store checkpoints', './checkpoints')
  .option('-r, --recursive', 'Process files in subdirectories', false)
  .action(async (directory, options) => {
    try {
      logger.info(`Starting to process directory: ${directory}`);
      
      const checkpointDir = path.resolve(options.checkpointDir);
      const processor = new KnowledgeProcessor(logger, config, checkpointDir);
      
      await processor.initialize();
      await processor.processDirectory(path.resolve(directory), options.recursive);
      await processor.cleanup();
      
      logger.info('Processing completed successfully');
    } catch (error) {
      logger.error(`Processing failed: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show processing status')
  .option('-c, --checkpoint-dir <dir>', 'Directory where checkpoints are stored', './checkpoints')
  .action((options) => {
    try {
      const checkpointDir = path.resolve(options.checkpointDir);
      const processor = new KnowledgeProcessor(logger, config, checkpointDir);
      
      processor.showStatus();
    } catch (error) {
      logger.error(`Status check failed: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program.parse(); 