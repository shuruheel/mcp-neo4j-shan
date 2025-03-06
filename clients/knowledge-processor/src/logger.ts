import winston from 'winston';
import { Config } from './types.js';

/**
 * Create a logger instance
 * @param config - Configuration object
 * @returns Winston logger instance
 */
export function createLogger(config: Config): winston.Logger {
  return winston.createLogger({
    level: config.logging.level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf((info) => {
        const { timestamp, level, message } = info;
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
      })
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ 
        filename: 'knowledge-processor.log',
        dirname: './logs'
      })
    ]
  });
} 