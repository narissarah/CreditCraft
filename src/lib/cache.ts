import RedisClient from './redis';
import { logger } from '../utils/logger';

export class Cache {
  private static readonly DEFAULT_TTL = 3600; // 1 hour in seconds
  
  /**
   * Set a value in the cache
   * @param key - Cache key
   * @param value - Value to cache (will be JSON stringified)
   * @param ttl - Optional TTL in seconds (defaults to 1 hour)
   */
  public static async set(key: string, value: any, ttl = Cache.DEFAULT_TTL): Promise<void> {
    try {
      const redis = await RedisClient.getClient();
      const serializedValue = JSON.stringify(value);
      
      if (ttl > 0) {
        await redis.setex(key, ttl, serializedValue);
      } else {
        await redis.set(key, serializedValue);
      }
      
      logger.debug(`Cache SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      logger.error(`Cache SET error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
      // We don't throw so the application can continue without caching
    }
  }

  /**
   * Get a value from the cache
   * @param key - Cache key
   * @returns The cached value or null if not found
   */
  public static async get<T>(key: string): Promise<T | null> {
    try {
      const redis = await RedisClient.getClient();
      const value = await redis.get(key);
      
      if (!value) {
        logger.debug(`Cache MISS: ${key}`);
        return null;
      }
      
      logger.debug(`Cache HIT: ${key}`);
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Cache GET error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Delete a value from the cache
   * @param key - Cache key to delete
   */
  public static async delete(key: string): Promise<void> {
    try {
      const redis = await RedisClient.getClient();
      await redis.del(key);
      logger.debug(`Cache DELETE: ${key}`);
    } catch (error) {
      logger.error(`Cache DELETE error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a value from cache, or compute and cache it if not found
   * @param key - Cache key
   * @param fn - Function to compute the value if not in cache
   * @param ttl - Optional TTL in seconds
   * @returns The cached or computed value
   */
  public static async getOrSet<T>(key: string, fn: () => Promise<T>, ttl = Cache.DEFAULT_TTL): Promise<T> {
    try {
      // Try to get from cache first
      const cachedValue = await Cache.get<T>(key);
      
      if (cachedValue !== null) {
        return cachedValue;
      }
      
      // Value not in cache, compute it
      const computedValue = await fn();
      
      // Cache the computed value
      await Cache.set(key, computedValue, ttl);
      
      return computedValue;
    } catch (error) {
      logger.error(`Cache getOrSet error for key ${key}: ${error instanceof Error ? error.message : String(error)}`);
      // If caching fails, just compute the value
      return fn();
    }
  }

  /**
   * Invalidate multiple cache keys using a pattern
   * @param pattern - Redis key pattern to match (e.g., "user:*")
   */
  public static async invalidatePattern(pattern: string): Promise<void> {
    try {
      const redis = await RedisClient.getClient();
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug(`Cache DELETE pattern: ${pattern} (${keys.length} keys)`);
      }
    } catch (error) {
      logger.error(`Cache invalidatePattern error for pattern ${pattern}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if the Redis cache is healthy and responding
   * @returns True if healthy, false otherwise
   */
  public static async healthCheck(): Promise<boolean> {
    try {
      const redis = await RedisClient.getClient();
      const result = await redis.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error(`Cache health check failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
}

export default Cache; 