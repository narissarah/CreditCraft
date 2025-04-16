import { Session } from '@shopify/shopify-api';
import { BaseSessionStorage } from './SessionStorage';
import { logger } from '../utils/logger';
import Redis from 'ioredis';

/**
 * Redis-based session storage
 * Provides persistent storage with automatic expiration
 */
export class RedisSessionStorage extends BaseSessionStorage {
  private redis: Redis;
  private readonly keyPrefix: string;
  private readonly defaultExpirationMs: number;
  
  /**
   * Create a new Redis session storage
   * @param redisConfig Redis configuration or connection string
   * @param keyPrefix Prefix for Redis keys
   * @param defaultExpirationMs Default expiration time in milliseconds
   */
  constructor(
    redisConfig: Redis.RedisOptions | string, 
    keyPrefix: string = 'shopify_session:', 
    defaultExpirationMs: number = 24 * 60 * 60 * 1000 // 1 day
  ) {
    super();
    this.keyPrefix = keyPrefix;
    this.defaultExpirationMs = defaultExpirationMs;
    
    try {
      // Create Redis client
      if (typeof redisConfig === 'string') {
        this.redis = new Redis(redisConfig);
      } else {
        this.redis = new Redis(redisConfig);
      }
      
      // Set up error handling
      this.redis.on('error', (err) => {
        logger.error('Redis session storage error:', err);
      });
      
      logger.info('Redis session storage initialized');
    } catch (error) {
      logger.error('Failed to initialize Redis session storage:', error);
      throw error;
    }
  }
  
  /**
   * Get the Redis key for a session
   * @param id Session ID
   */
  private getSessionKey(id: string): string {
    return `${this.keyPrefix}${id}`;
  }
  
  /**
   * Get the Redis key for a shop index
   * @param shop Shop domain
   */
  private getShopKey(shop: string): string {
    return `${this.keyPrefix}shop:${shop}`;
  }
  
  /**
   * Store a session in Redis
   * @param session The session to store
   */
  async storeSession(session: Session): Promise<boolean> {
    try {
      if (!session.id) {
        logger.error('Cannot store session without id');
        return false;
      }
      
      const sessionKey = this.getSessionKey(session.id);
      const shopKey = this.getShopKey(session.shop);
      
      // Calculate expiration time
      let expirationMs = this.defaultExpirationMs;
      if (session.expires) {
        const expireDate = new Date(session.expires);
        expirationMs = Math.max(0, expireDate.getTime() - Date.now());
      }
      
      // Use a pipeline for multiple operations
      const pipeline = this.redis.pipeline();
      
      // Store the serialized session
      pipeline.set(sessionKey, JSON.stringify(session), 'PX', expirationMs);
      
      // Add the session ID to the shop's set of sessions
      pipeline.sadd(shopKey, session.id);
      
      // Set expiration on the shop key to match the longest session
      pipeline.pexpire(shopKey, expirationMs * 2); // Longer expiry for shop index
      
      await pipeline.exec();
      
      logger.debug(`Session stored in Redis: ${session.id}`);
      return true;
    } catch (error) {
      logger.error('Error storing session in Redis:', error);
      return false;
    }
  }
  
  /**
   * Load a session from Redis by ID
   * @param id The session ID
   */
  async loadSession(id: string): Promise<Session | undefined> {
    try {
      const sessionKey = this.getSessionKey(id);
      const data = await this.redis.get(sessionKey);
      
      if (!data) {
        logger.debug(`Session not found in Redis: ${id}`);
        return undefined;
      }
      
      const session = JSON.parse(data) as Session;
      
      // Check for expiration
      if (this.isSessionExpired(session)) {
        logger.debug(`Session expired, removing from Redis: ${id}`);
        await this.deleteSession(id);
        return undefined;
      }
      
      logger.debug(`Session loaded from Redis: ${id}`);
      return session;
    } catch (error) {
      logger.error(`Error loading session from Redis (${id}):`, error);
      return undefined;
    }
  }
  
  /**
   * Delete a session from Redis by ID
   * @param id The session ID
   */
  async deleteSession(id: string): Promise<boolean> {
    try {
      const sessionKey = this.getSessionKey(id);
      
      // First get the session to find the shop
      const data = await this.redis.get(sessionKey);
      
      if (data) {
        try {
          const session = JSON.parse(data) as Session;
          const shopKey = this.getShopKey(session.shop);
          
          // Use pipeline to delete session and remove from shop set
          const pipeline = this.redis.pipeline();
          pipeline.del(sessionKey);
          pipeline.srem(shopKey, id);
          await pipeline.exec();
        } catch (parseError) {
          // If parsing fails, just delete the session key
          await this.redis.del(sessionKey);
        }
      } else {
        // If session not found, just return success
        return true;
      }
      
      logger.debug(`Session deleted from Redis: ${id}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting session from Redis (${id}):`, error);
      return false;
    }
  }
  
  /**
   * Find sessions in Redis by shop domain
   * @param shop The shop domain
   */
  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const shopKey = this.getShopKey(shop);
      
      // Get all session IDs for this shop
      const sessionIds = await this.redis.smembers(shopKey);
      
      if (sessionIds.length === 0) {
        logger.debug(`No sessions found for shop in Redis: ${shop}`);
        return [];
      }
      
      // Use pipeline to get all sessions
      const pipeline = this.redis.pipeline();
      for (const id of sessionIds) {
        pipeline.get(this.getSessionKey(id));
      }
      
      const results = await pipeline.exec();
      const sessions: Session[] = [];
      const expiredIds: string[] = [];
      
      // Process results
      results?.forEach((result, index) => {
        const [error, data] = result;
        
        if (error) {
          logger.error(`Error getting session ${sessionIds[index]}:`, error);
          return;
        }
        
        if (!data) {
          // Session not found, should be removed from shop set
          expiredIds.push(sessionIds[index]);
          return;
        }
        
        try {
          const session = JSON.parse(data as string) as Session;
          
          // Check for expiration
          if (this.isSessionExpired(session)) {
            expiredIds.push(sessionIds[index]);
          } else {
            sessions.push(session);
          }
        } catch (parseError) {
          logger.error(`Error parsing session ${sessionIds[index]}:`, parseError);
          expiredIds.push(sessionIds[index]);
        }
      });
      
      // Clean up expired sessions
      if (expiredIds.length > 0) {
        this.cleanupShopSessions(shop, expiredIds).catch(err => {
          logger.error(`Error cleaning up expired sessions for shop ${shop}:`, err);
        });
      }
      
      logger.debug(`Found ${sessions.length} valid sessions for shop in Redis: ${shop}`);
      return sessions;
    } catch (error) {
      logger.error(`Error finding sessions for shop in Redis (${shop}):`, error);
      return [];
    }
  }
  
  /**
   * Delete all sessions for a shop from Redis
   * @param shop The shop domain
   */
  async deleteSessions(shop: string): Promise<boolean> {
    try {
      const shopKey = this.getShopKey(shop);
      
      // Get all session IDs for this shop
      const sessionIds = await this.redis.smembers(shopKey);
      
      if (sessionIds.length === 0) {
        // No sessions to delete
        return true;
      }
      
      // Use pipeline to delete all sessions
      const pipeline = this.redis.pipeline();
      
      // Delete each session
      for (const id of sessionIds) {
        pipeline.del(this.getSessionKey(id));
      }
      
      // Delete the shop set
      pipeline.del(shopKey);
      
      await pipeline.exec();
      
      logger.debug(`Deleted all ${sessionIds.length} sessions for shop from Redis: ${shop}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting sessions for shop from Redis (${shop}):`, error);
      return false;
    }
  }
  
  /**
   * Clean up expired sessions for a shop
   * @param shop The shop domain
   * @param expiredIds Array of expired session IDs
   */
  private async cleanupShopSessions(shop: string, expiredIds: string[]): Promise<void> {
    try {
      const shopKey = this.getShopKey(shop);
      
      // Use pipeline to delete expired sessions and remove from shop set
      const pipeline = this.redis.pipeline();
      
      for (const id of expiredIds) {
        pipeline.del(this.getSessionKey(id));
        pipeline.srem(shopKey, id);
      }
      
      await pipeline.exec();
      
      logger.debug(`Cleaned up ${expiredIds.length} expired sessions for shop: ${shop}`);
    } catch (error) {
      logger.error(`Error cleaning up expired sessions for shop (${shop}):`, error);
      throw error;
    }
  }
  
  /**
   * Clean up all expired sessions
   * Note: This is a heavy operation and should be run periodically
   */
  async cleanupSessions(): Promise<boolean> {
    try {
      // Get all keys with the session prefix
      const scanStream = this.redis.scanStream({
        match: `${this.keyPrefix}*`,
        count: 100
      });
      
      let cleanedUp = 0;
      
      for await (const keys of scanStream) {
        // Skip shop keys
        const sessionKeys = (keys as string[]).filter(key => !key.includes(':shop:'));
        
        if (sessionKeys.length === 0) continue;
        
        // Get all sessions
        const pipeline = this.redis.pipeline();
        for (const key of sessionKeys) {
          pipeline.get(key);
        }
        
        const results = await pipeline.exec();
        const expiredSessions: { key: string, shop: string, id: string }[] = [];
        
        // Check each session for expiration
        results?.forEach((result, index) => {
          const [error, data] = result;
          
          if (error || !data) {
            // If error or no data, mark for deletion
            const key = sessionKeys[index];
            const id = key.replace(this.keyPrefix, '');
            expiredSessions.push({ key, shop: 'unknown', id });
            return;
          }
          
          try {
            const session = JSON.parse(data as string) as Session;
            
            // Check for expiration
            if (this.isSessionExpired(session)) {
              const key = sessionKeys[index];
              const id = key.replace(this.keyPrefix, '');
              expiredSessions.push({ key, shop: session.shop, id });
            }
          } catch (parseError) {
            // If parsing fails, mark for deletion
            const key = sessionKeys[index];
            const id = key.replace(this.keyPrefix, '');
            expiredSessions.push({ key, shop: 'unknown', id });
          }
        });
        
        // Delete expired sessions
        if (expiredSessions.length > 0) {
          const deletePipeline = this.redis.pipeline();
          
          // Group by shop for efficient removal
          const shopSessions: Record<string, string[]> = {};
          
          for (const { key, shop, id } of expiredSessions) {
            // Delete the session
            deletePipeline.del(key);
            
            // Group by shop
            if (shop !== 'unknown') {
              if (!shopSessions[shop]) {
                shopSessions[shop] = [];
              }
              shopSessions[shop].push(id);
            }
          }
          
          // Remove from shop sets
          for (const [shop, ids] of Object.entries(shopSessions)) {
            const shopKey = this.getShopKey(shop);
            deletePipeline.srem(shopKey, ...ids);
          }
          
          await deletePipeline.exec();
          cleanedUp += expiredSessions.length;
        }
      }
      
      logger.debug(`Cleaned up ${cleanedUp} expired sessions from Redis`);
      return true;
    } catch (error) {
      logger.error('Error cleaning up expired sessions from Redis:', error);
      return false;
    }
  }
  
  /**
   * Close the Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
  }
} 