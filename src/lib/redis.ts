import Redis from 'ioredis';
import { redisConfig } from '../config/redis';
import { logger } from '../utils/logger';

class RedisClient {
  private static instance: Redis | null = null;
  private static isConnecting = false;
  private static connectionPromise: Promise<Redis> | null = null;

  /**
   * Get a singleton Redis client instance
   * Creates a new client if one doesn't exist or returns the existing one
   */
  public static async getClient(): Promise<Redis> {
    // If we already have an instance, return it
    if (RedisClient.instance) {
      return RedisClient.instance;
    }

    // If we're already connecting, return the promise
    if (RedisClient.isConnecting && RedisClient.connectionPromise) {
      return RedisClient.connectionPromise;
    }

    // Create a new connection
    RedisClient.isConnecting = true;
    RedisClient.connectionPromise = new Promise((resolve, reject) => {
      try {
        // Create Redis client with config
        const client = new Redis({
          // Connection
          host: redisConfig.url.split('://')[1]?.split(':')[0] || 'localhost',
          port: parseInt(redisConfig.url.split(':').pop() || '6379', 10),
          password: redisConfig.password || undefined,
          tls: redisConfig.tls ? {} : undefined,
          
          // Timeout settings
          connectTimeout: redisConfig.connectionTimeout,
          maxRetriesPerRequest: redisConfig.maxRetriesPerRequest,
          enableReadyCheck: redisConfig.enableReadyCheck,
          enableOfflineQueue: redisConfig.enableOfflineQueue,
          
          // Retry strategy for connection issues
          retryStrategy(times) {
            const delay = Math.min(times * 100, 3000);
            logger.info(`Redis connection retry attempt #${times} in ${delay}ms`);
            return delay;
          }
        });

        // Set up event handlers
        client.on('connect', () => {
          logger.info('Redis client connected');
        });

        client.on('ready', () => {
          logger.info('Redis client ready');
          // Set memory limits if supported (Redis 4.0+)
          client.config('SET', 'maxmemory', redisConfig.maxMemory).catch(err => {
            logger.warn(`Could not set Redis maxmemory: ${err.message}`);
          });
          
          client.config('SET', 'maxmemory-policy', redisConfig.evictionPolicy).catch(err => {
            logger.warn(`Could not set Redis maxmemory-policy: ${err.message}`);
          });
        });

        client.on('error', (err) => {
          logger.error(`Redis client error: ${err.message}`);
        });

        client.on('close', () => {
          logger.warn('Redis client connection closed');
        });

        client.on('reconnecting', () => {
          logger.info('Redis client reconnecting');
        });

        // Store and return the client
        RedisClient.instance = client;
        RedisClient.isConnecting = false;
        resolve(client);
      } catch (error) {
        RedisClient.isConnecting = false;
        logger.error(`Failed to create Redis client: ${error instanceof Error ? error.message : String(error)}`);
        reject(error);
      }
    });

    return RedisClient.connectionPromise;
  }

  /**
   * Close the Redis connection properly
   */
  public static async close(): Promise<void> {
    if (RedisClient.instance) {
      logger.info('Closing Redis client connection...');
      await RedisClient.instance.quit();
      RedisClient.instance = null;
      RedisClient.connectionPromise = null;
      logger.info('Redis client connection closed');
    }
  }
}

export default RedisClient; 