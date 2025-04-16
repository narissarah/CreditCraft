import { SessionStorage } from './SessionStorage';
import { MemorySessionStorage } from './MemorySessionStorage';
import { RedisSessionStorage } from './RedisSessionStorage';
import { DatabaseSessionStorage } from './DatabaseSessionStorage';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// Session storage types
export enum StorageType {
  MEMORY = 'memory',
  REDIS = 'redis',
  DATABASE = 'database'
}

/**
 * Create a session storage instance based on type
 * @param type The type of storage to create
 * @param options Options for the storage
 * @returns A SessionStorage instance
 */
export function createSessionStorage(
  type: StorageType = StorageType.DATABASE, 
  options?: {
    redis?: string | object;
    prisma?: PrismaClient;
  }
): SessionStorage {
  try {
    switch (type) {
      case StorageType.REDIS:
        if (!options?.redis) {
          throw new Error('Redis configuration required for Redis session storage');
        }
        logger.info('Creating Redis session storage');
        return new RedisSessionStorage(options.redis);
        
      case StorageType.DATABASE:
        logger.info('Creating Database session storage');
        return new DatabaseSessionStorage(options?.prisma);
        
      case StorageType.MEMORY:
      default:
        logger.info('Creating Memory session storage (not recommended for production)');
        return new MemorySessionStorage();
    }
  } catch (error) {
    logger.error('Error creating session storage:', error);
    logger.warn('Falling back to memory session storage');
    return new MemorySessionStorage();
  }
}

/**
 * Get the recommended session storage type based on environment
 */
export function getRecommendedStorageType(): StorageType {
  const env = process.env.NODE_ENV || 'development';
  
  // In production, prefer database storage
  if (env === 'production') {
    if (process.env.REDIS_URL) {
      return StorageType.REDIS;
    } else {
      return StorageType.DATABASE;
    }
  }
  
  // In development, use database storage if available
  if (process.env.DATABASE_URL) {
    return StorageType.DATABASE;
  }
  
  // For testing or if no configuration is available, use memory
  return StorageType.MEMORY;
} 