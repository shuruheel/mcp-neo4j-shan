import fs from 'fs-extra';
import path from 'path';
import pdfParse from 'pdf-parse';
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
   * @returns Promise resolving to the file content
   */
  async extractContent(file: string): Promise<string> {
    this.logger.debug(`Extracting content from text file: ${file}`);
    return fs.readFile(file, 'utf-8');
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
   * @returns True if the file is a PDF
   */
  canHandle(file: string): boolean {
    return path.extname(file).toLowerCase() === '.pdf';
  }

  /**
   * Extract content from a PDF file
   * @param file - File path
   * @returns Promise resolving to the extracted text
   */
  async extractContent(file: string): Promise<string> {
    this.logger.debug(`Extracting content from PDF file: ${file}`);
    const dataBuffer = await fs.readFile(file);
    
    try {
      const pdf = await pdfParse(dataBuffer);
      return pdf.text;
    } catch (error) {
      this.logger.error(`Error parsing PDF file ${file}: ${(error as Error).message}`);
      throw new Error(`Failed to extract content from PDF: ${(error as Error).message}`);
    }
  }
}

/**
 * Content extractor factory
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
      // Add more extractors as needed
    ];
  }

  /**
   * Get an appropriate extractor for the given file
   * @param file - File path
   * @returns Content extractor that can handle the file
   */
  getExtractor(file: string): ContentExtractor {
    const extractor = this.extractors.find(e => e.canHandle(file));
    
    if (!extractor) {
      this.logger.error(`No suitable extractor found for file: ${file}`);
      throw new Error(`No suitable extractor found for file: ${file}`);
    }
    
    return extractor;
  }
} 