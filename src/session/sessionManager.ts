import { Session } from '@shopify/shopify-api';
import { SessionStorage } from './SessionStorage';
import { createSessionStorage, getRecommendedStorageType, StorageType } from './sessionFactory';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { prisma } from '../../prisma/client';

// Singleton session storage instance
let sessionStorageInstance: SessionStorage | null = null;

/**
 * Initialize session storage with the configured type
 * @param type Storage type to use
 * @param options Configuration options
 */
export function initializeSessionStorage(
  type?: StorageType,
  options?: {
    redis?: string | object;
    prisma?: PrismaClient;
  }
): SessionStorage {
  // If already initialized, return existing instance
  if (sessionStorageInstance) {
    return sessionStorageInstance;
  }
  
  // Determine storage type if not specified
  const storageType = type || getRecommendedStorageType();
  
  // Apply default options if not specified
  const storageOptions = {
    ...options,
    // Use shared Prisma instance if not provided
    prisma: options?.prisma || prisma
  };
  
  // Create and store the session storage
  sessionStorageInstance = createSessionStorage(storageType, storageOptions);
  logger.info(`Session storage initialized with type: ${storageType}`);
  
  return sessionStorageInstance;
}

/**
 * Get the session storage instance
 * Initializes with defaults if not already done
 */
export function getSessionStorage(): SessionStorage {
  if (!sessionStorageInstance) {
    return initializeSessionStorage();
  }
  return sessionStorageInstance;
}

/**
 * Store a Shopify session
 * @param session The session to store
 */
export async function storeSession(session: Session): Promise<boolean> {
  return getSessionStorage().storeSession(session);
}

/**
 * Load a Shopify session by ID
 * @param id The session ID
 */
export async function loadSession(id: string): Promise<Session | undefined> {
  return getSessionStorage().loadSession(id);
}

/**
 * Delete a Shopify session by ID
 * @param id The session ID
 */
export async function deleteSession(id: string): Promise<boolean> {
  return getSessionStorage().deleteSession(id);
}

/**
 * Find sessions for a shop
 * @param shop The shop domain
 */
export async function findSessionsByShop(shop: string): Promise<Session[]> {
  return getSessionStorage().findSessionsByShop(shop);
}

/**
 * Delete all sessions for a shop
 * @param shop The shop domain
 */
export async function deleteShopSessions(shop: string): Promise<boolean> {
  return getSessionStorage().deleteSessions(shop);
}

/**
 * Clean up expired sessions
 */
export async function cleanupSessions(): Promise<boolean> {
  return getSessionStorage().cleanupSessions();
}

/**
 * Get the most recent active session for a shop
 * @param shop The shop domain
 */
export async function getActiveShopSession(shop: string): Promise<Session | undefined> {
  try {
    const sessions = await findSessionsByShop(shop);
    
    if (sessions.length === 0) {
      logger.debug(`No active sessions found for shop: ${shop}`);
      return undefined;
    }
    
    // Sort sessions by expiry date (most recent first)
    const sortedSessions = sessions.sort((a, b) => {
      const aExpires = a.expires ? new Date(a.expires).getTime() : 0;
      const bExpires = b.expires ? new Date(b.expires).getTime() : 0;
      return bExpires - aExpires;
    });
    
    // Return the most recent session
    return sortedSessions[0];
  } catch (error) {
    logger.error(`Error getting active shop session for ${shop}:`, error);
    return undefined;
  }
} 