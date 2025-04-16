import dotenv from 'dotenv';
import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Determine log level from environment variable
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Configure winston format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${metaString}`;
  })
);

// Create winston logger instance
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'creditcraft-api' },
  transports: [
    // Console transport for all environments
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    
    // File transports for errors and combined logs in production and staging
    ...(process.env.NODE_ENV !== 'development' ? [
      new winston.transports.File({ 
        filename: path.join(logsDir, 'error.log'), 
        level: 'error',
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      }),
      new winston.transports.File({ 
        filename: path.join(logsDir, 'combined.log'),
        maxsize: 10485760, // 10MB 
        maxFiles: 5,
      })
    ] : [])
  ]
});

// Add request logger middleware
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log when the request finishes
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel](`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      shopDomain: req.query.shop || req.body?.shop || 'unknown'
    });
  });
  
  next();
};

// Add API error logger
export const logApiError = (error, context = {}) => {
  const errorInfo = {
    message: error.message || 'Unknown error',
    stack: error.stack,
    ...context
  };
  
  logger.error(`API Error: ${errorInfo.message}`, errorInfo);
};

// Export logger instance
export default logger; 