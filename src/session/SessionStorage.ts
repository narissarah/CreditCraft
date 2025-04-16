import { Session } from '@shopify/shopify-api';
import { logger } from '../utils/logger';

/**
 * Interface for session storage implementations
 */
export interface SessionStorage {
  /**
   * Store a session
   * @param session The session to store
   */
  storeSession(session: Session): Promise<boolean>;
  
  /**
   * Load a session by ID
   * @param id The session ID
   */
  loadSession(id: string): Promise<Session | undefined>;
  
  /**
   * Delete a session by ID
   * @param id The session ID
   */
  deleteSession(id: string): Promise<boolean>;
  
  /**
   * Find sessions by shop domain
   * @param shop The shop domain
   */
  findSessionsByShop(shop: string): Promise<Session[]>;
  
  /**
   * Delete sessions by shop domain
   * @param shop The shop domain
   */
  deleteSessions(shop: string): Promise<boolean>;
  
  /**
   * Clean up expired sessions
   */
  cleanupSessions(): Promise<boolean>;
}

/**
 * Abstract base class for session storage implementations
 */
export abstract class BaseSessionStorage implements SessionStorage {
  abstract storeSession(session: Session): Promise<boolean>;
  abstract loadSession(id: string): Promise<Session | undefined>;
  abstract deleteSession(id: string): Promise<boolean>;
  abstract findSessionsByShop(shop: string): Promise<Session[]>;
  abstract deleteSessions(shop: string): Promise<boolean>;
  
  /**
   * Generate a session ID from shop and state
   * @param shop The shop domain
   * @param state The state parameter
   */
  protected generateSessionId(shop: string, state: string): string {
    return `${shop}_${state}`;
  }
  
  /**
   * Check if a session has expired
   * @param session The session to check
   */
  protected isSessionExpired(session: Session): boolean {
    return session.expires ? new Date() > session.expires : false;
  }
  
  /**
   * Default implementation for cleaning up expired sessions
   */
  async cleanupSessions(): Promise<boolean> {
    try {
      // This is just a placeholder - specific implementations
      // should override this with their own cleanup logic
      logger.info('Session cleanup triggered');
      return true;
    } catch (error) {
      logger.error('Error cleaning up sessions:', error);
      return false;
    }
  }
} 