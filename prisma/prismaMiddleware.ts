import { PrismaClient } from '@prisma/client';
import { logger } from '../src/utils/logger';
import { DbPerformanceMonitor } from '../src/utils/dbPerformance';

/**
 * Configures Prisma middleware for performance monitoring
 * @param prisma The Prisma client instance
 * @returns The Prisma client with middleware applied
 */
export function configurePrismaMiddleware(prisma: PrismaClient): PrismaClient {
  // Add middleware for measuring query performance
  prisma.$use(async (params, next) => {
    const start = performance.now();
    
    const result = await next(params);
    
    const duration = performance.now() - start;
    const { model, action, args } = params;
    
    // Log slow queries based on threshold
    if (duration > parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000', 10)) {
      const query = `${model}.${action}(${JSON.stringify(args)})`;
      DbPerformanceMonitor.logSlowQuery(query, duration);
    }
    
    // For debugging in development
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_QUERIES === 'true') {
      logger.debug(`Query ${model}.${action} took ${Math.round(duration)}ms`);
    }
    
    return result;
  });
  
  // Middleware for transaction monitoring
  prisma.$use(async (params, next) => {
    if (params.action === 'createMany' || 
        params.action === 'updateMany' || 
        params.action === 'deleteMany') {
      logger.info(`Bulk operation: ${params.model}.${params.action}`);
    }
    
    return next(params);
  });
  
  // Middleware for soft-delete handling (if your app uses it)
  prisma.$use(async (params, next) => {
    // Example of how you might implement soft delete handling
    // This assumes you have a 'deleted' field in your models
    if (params.action === 'findUnique' || 
        params.action === 'findFirst' || 
        params.action === 'findMany') {
      // Add 'deleted: false' filter to all read operations if not explicitly set
      const hasDeletedCondition = params.args?.where?.deleted !== undefined;
      
      if (!hasDeletedCondition && params.model !== 'SystemLog') {
        // Only for models that have the deleted field (excluding system logs, for example)
        params.args = params.args || {};
        params.args.where = {
          ...params.args.where,
          deleted: false
        };
      }
    }
    
    return next(params);
  });
  
  // Error logging middleware
  prisma.$use(async (params, next) => {
    try {
      return await next(params);
    } catch (error) {
      // Log database errors
      logger.error(`Database error in ${params.model}.${params.action}: ${error instanceof Error ? error.message : String(error)}`);
      
      // Re-throw to maintain normal error flow
      throw error;
    }
  });
  
  return prisma;
}

export default configurePrismaMiddleware; 