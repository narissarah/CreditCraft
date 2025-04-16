import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';
import winston from 'winston';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure Winston logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'creditcraft-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

/**
 * Initialize Sentry for error tracking
 * Should be called once at application startup
 */
export function initializeErrorTracking() {
  // Only initialize Sentry if DSN is provided
  if (process.env.SENTRY_DSN) {
    logger.info('Initializing Sentry error tracking...');
    
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      integrations: [
        new ProfilingIntegration(),
      ],
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring
      tracesSampleRate: 1.0,
      // Capture 25% of profiles for performance monitoring
      profilesSampleRate: 0.25,
    });
    
    logger.info('Sentry initialized successfully');
  } else {
    logger.warn('Sentry DSN not provided, error tracking will not be available');
  }
}

/**
 * Create an Express middleware to capture errors and send them to Sentry
 */
export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler();
}

/**
 * Create an Express middleware to track requests
 */
export function sentryRequestHandler() {
  return Sentry.Handlers.requestHandler();
}

/**
 * Track an exception in Sentry and logs it
 * 
 * @param error The error to track
 * @param context Additional context information
 */
export function trackException(error: Error, context: Record<string, any> = {}) {
  logger.error(`Error: ${error.message}`, { error, ...context });
  
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Track a message in Sentry and logs it
 * 
 * @param message The message to track
 * @param level The severity level
 * @param context Additional context information
 */
export function trackMessage(
  message: string, 
  level: 'info' | 'warning' | 'error' = 'info',
  context: Record<string, any> = {}
) {
  logger[level](message, context);
  
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level: level === 'warning' ? 'warning' : level === 'error' ? 'error' : 'info',
      extra: context,
    });
  }
}

/**
 * Set user information for tracking
 * 
 * @param user User information (id, shop, etc.)
 */
export function setUser(user: { id?: string; shop?: string; [key: string]: any }) {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser(user);
  }
}

/**
 * Start a new transaction for performance monitoring
 * 
 * @param name Transaction name
 * @param op Operation type
 * @returns Sentry Transaction object
 */
export function startTransaction(name: string, op: string) {
  if (process.env.SENTRY_DSN) {
    return Sentry.startTransaction({
      name,
      op,
    });
  }
  return null;
}

/**
 * Finish a transaction
 * 
 * @param transaction The transaction to finish
 * @param status Transaction status
 */
export function finishTransaction(transaction: any, status: 'ok' | 'error' = 'ok') {
  if (transaction) {
    transaction.finish(status);
  }
} 