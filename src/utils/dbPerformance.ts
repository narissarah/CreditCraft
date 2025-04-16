import { prisma } from '../../prisma/client';
import { logger } from './logger';

/**
 * Interval in ms for how often to log slow queries
 */
const SLOW_QUERY_LOG_INTERVAL = 1000 * 60 * 60; // 1 hour

/**
 * Threshold in ms for what constitutes a slow query
 */
const SLOW_QUERY_THRESHOLD = 
  parseInt(process.env.DB_SLOW_QUERY_THRESHOLD || '1000', 10);

/**
 * In-memory store of slow queries to prevent flooding logs
 */
const slowQueryCache = new Map<string, {
  count: number,
  lastLogged: number,
  avgDuration: number,
}>();

/**
 * Tracks database metrics and monitors for slow queries
 */
export class DbPerformanceMonitor {
  /**
   * Log a slow query and its execution time
   * @param query The query that was executed
   * @param durationMs How long the query took in milliseconds
   */
  static logSlowQuery(query: string, durationMs: number): void {
    // Only log if it's above the threshold
    if (durationMs < SLOW_QUERY_THRESHOLD) {
      return;
    }

    const now = Date.now();
    const queryHash = this.hashQuery(query);
    const cached = slowQueryCache.get(queryHash);

    if (cached) {
      // Update metrics
      cached.count++;
      cached.avgDuration = (cached.avgDuration * (cached.count - 1) + durationMs) / cached.count;

      // Only log if it's been a while since last log
      if (now - cached.lastLogged > SLOW_QUERY_LOG_INTERVAL) {
        logger.warn(`Slow query detected (${cached.count} occurrences, avg ${Math.round(cached.avgDuration)}ms): ${query}`);
        cached.lastLogged = now;
      }
    } else {
      // First time seeing this query
      slowQueryCache.set(queryHash, {
        count: 1,
        lastLogged: now,
        avgDuration: durationMs,
      });
      logger.warn(`Slow query detected (${durationMs}ms): ${query}`);
    }
  }

  /**
   * Creates a simple hash of the query to use as a cache key
   * @param query The SQL query
   * @returns A string hash
   */
  private static hashQuery(query: string): string {
    // Simple hash function for queries
    // In a production app, you might want a more robust hashing function
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      hash = ((hash << 5) - hash) + query.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Execute a database function with performance tracking
   * @param name Name of the operation for logging
   * @param fn Function to execute
   * @returns The result of the function
   */
  static async trackPerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      if (duration > SLOW_QUERY_THRESHOLD) {
        this.logSlowQuery(name, duration);
      }
    }
  }

  /**
   * Get database performance metrics
   * @returns Object with performance metrics
   */
  static async getPerformanceMetrics() {
    try {
      // Get connection pool stats (if available in your setup)
      const poolStats = {
        totalConnections: 0,
        idleConnections: 0,
        waitingClients: 0
      };

      // Count various entity types
      const [
        customerCount,
        creditCount,
        transactionCount,
        activeCreditsCount
      ] = await Promise.all([
        prisma.customer.count(),
        prisma.credit.count(),
        prisma.transaction.count(),
        prisma.credit.count({ where: { status: 'ACTIVE' } }),
      ]);

      // Get slow query statistics
      const slowQueries = Array.from(slowQueryCache.values()).reduce(
        (acc, curr) => {
          acc.count += curr.count;
          acc.totalDuration += curr.avgDuration * curr.count;
          return acc;
        },
        { count: 0, totalDuration: 0 }
      );

      return {
        timestamp: new Date().toISOString(),
        poolStats,
        entityCounts: {
          customers: customerCount,
          credits: creditCount,
          transactions: transactionCount,
          activeCredits: activeCreditsCount,
        },
        slowQueries: {
          uniqueQueries: slowQueryCache.size,
          totalOccurrences: slowQueries.count,
          averageDuration: slowQueries.count > 0 
            ? slowQueries.totalDuration / slowQueries.count 
            : 0,
        }
      };
    } catch (error) {
      logger.error('Failed to get database performance metrics:', error);
      throw error;
    }
  }

  /**
   * Reset performance metrics
   */
  static resetMetrics(): void {
    slowQueryCache.clear();
  }
}

export default DbPerformanceMonitor; 