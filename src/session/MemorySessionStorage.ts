import { Session } from '@shopify/shopify-api';
import { BaseSessionStorage } from './SessionStorage';
import { logger } from '../utils/logger';

/**
 * In-memory session storage
 * Note: This should only be used for development or testing
 */
export class MemorySessionStorage extends BaseSessionStorage {
  private sessions: Map<string, Session> = new Map();
  
  /**
   * Store a session in memory
   * @param session The session to store
   */
  async storeSession(session: Session): Promise<boolean> {
    try {
      if (!session.id) {
        logger.error('Cannot store session without id');
        return false;
      }
      
      this.sessions.set(session.id, session);
      logger.debug(`Session stored in memory: ${session.id}`);
      return true;
    } catch (error) {
      logger.error('Error storing session in memory:', error);
      return false;
    }
  }
  
  /**
   * Load a session from memory by ID
   * @param id The session ID
   */
  async loadSession(id: string): Promise<Session | undefined> {
    try {
      const session = this.sessions.get(id);
      
      if (!session) {
        logger.debug(`Session not found in memory: ${id}`);
        return undefined;
      }
      
      // Check for expiration
      if (this.isSessionExpired(session)) {
        logger.debug(`Session expired, removing from memory: ${id}`);
        this.sessions.delete(id);
        return undefined;
      }
      
      logger.debug(`Session loaded from memory: ${id}`);
      return session;
    } catch (error) {
      logger.error(`Error loading session from memory (${id}):`, error);
      return undefined;
    }
  }
  
  /**
   * Delete a session from memory by ID
   * @param id The session ID
   */
  async deleteSession(id: string): Promise<boolean> {
    try {
      const result = this.sessions.delete(id);
      logger.debug(`Session deleted from memory: ${id}`);
      return result;
    } catch (error) {
      logger.error(`Error deleting session from memory (${id}):`, error);
      return false;
    }
  }
  
  /**
   * Find sessions in memory by shop domain
   * @param shop The shop domain
   */
  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const shopSessions: Session[] = [];
      
      // Iterate through all sessions and find those matching the shop
      this.sessions.forEach((session) => {
        if (session.shop === shop && !this.isSessionExpired(session)) {
          shopSessions.push(session);
        }
      });
      
      logger.debug(`Found ${shopSessions.length} sessions for shop: ${shop}`);
      return shopSessions;
    } catch (error) {
      logger.error(`Error finding sessions for shop (${shop}):`, error);
      return [];
    }
  }
  
  /**
   * Delete all sessions for a shop from memory
   * @param shop The shop domain
   */
  async deleteSessions(shop: string): Promise<boolean> {
    try {
      let deleted = 0;
      
      // Iterate through all sessions and delete those matching the shop
      this.sessions.forEach((session, id) => {
        if (session.shop === shop) {
          this.sessions.delete(id);
          deleted++;
        }
      });
      
      logger.debug(`Deleted ${deleted} sessions for shop: ${shop}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting sessions for shop (${shop}):`, error);
      return false;
    }
  }
  
  /**
   * Clean up expired sessions from memory
   */
  async cleanupSessions(): Promise<boolean> {
    try {
      let cleanedUp = 0;
      
      // Iterate through all sessions and delete expired ones
      this.sessions.forEach((session, id) => {
        if (this.isSessionExpired(session)) {
          this.sessions.delete(id);
          cleanedUp++;
        }
      });
      
      logger.debug(`Cleaned up ${cleanedUp} expired sessions from memory`);
      return true;
    } catch (error) {
      logger.error('Error cleaning up expired sessions from memory:', error);
      return false;
    }
  }
} 