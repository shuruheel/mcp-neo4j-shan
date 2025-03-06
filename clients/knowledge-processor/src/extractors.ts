import fs from 'fs-extra';
import path from 'path';
import { ContentExtractor } from './types.js';
import { Logger } from 'winston';

/**
 * Text file extractor
 */
export class TextExtractor implements ContentExtractor {
  constructor(private logger: Logger) {}

  /**
   * Check if this extractor can handle the given file
   * @param file - File path
   * @returns True if the file is a text file
   */
  canHandle(file: string): boolean {
    const ext = path.extname(file).toLowerCase();
    return ['.txt', '.md', '.json', '.csv', '.html', '.htm'].includes(ext);
  }

  /**
   * Extract content from a text file
   * @param file - File path
   * @returns Extracted text content
   */
  async extractContent(file: string): Promise<string> {
    try {
      this.logger.info(`Extracting content from text file: ${file}`);
      return await fs.readFile(file, 'utf8');
    } catch (error) {
      this.logger.error(`Error extracting text content: ${(error as Error).message}`);
      throw new Error(`Failed to extract content from text file: ${(error as Error).message}`);
    }
  }
}

/**
 * PDF file extractor
 */
export class PDFExtractor implements ContentExtractor {
  constructor(private logger: Logger) {}

  /**
   * Check if this extractor can handle the given file
   * @param file - File path
   * @returns True if the file is a PDF file
   */
  canHandle(file: string): boolean {
    const ext = path.extname(file).toLowerCase();
    return ext === '.pdf';
  }

  /**
   * Extract content from a PDF file
   * @param file - File path
   * @returns Extracted text content
   */
  async extractContent(file: string): Promise<string> {
    try {
      // Dynamically import pdf-parse only when needed
      const pdfParse = await import('pdf-parse');
      
      this.logger.info(`Extracting content from PDF: ${file}`);
      const dataBuffer = await fs.readFile(file);
      const result = await pdfParse.default(dataBuffer);
      
      return result.text;
    } catch (error) {
      this.logger.error(`Error extracting PDF content: ${(error as Error).message}`);
      throw new Error(`Failed to extract content from PDF: ${(error as Error).message}`);
    }
  }
}

/**
 * Factory for creating content extractors
 */
export class ContentExtractorFactory {
  private extractors: ContentExtractor[];

  /**
   * Create a new content extractor factory
   * @param logger - Winston logger instance
   */
  constructor(private logger: Logger) {
    this.extractors = [
      new TextExtractor(logger),
      new PDFExtractor(logger)
    ];
  }

  /**
   * Get an extractor for a file
   * @param file - File path
   * @returns Content extractor for the file
   */
  getExtractor(file: string): ContentExtractor {
    for (const extractor of this.extractors) {
      if (extractor.canHandle(file)) {
        return extractor;
      }
    }

    throw new Error(`No content extractor available for file: ${file}`);
  }
} 