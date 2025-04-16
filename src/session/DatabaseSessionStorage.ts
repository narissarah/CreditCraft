import { Session } from '@shopify/shopify-api';
import { BaseSessionStorage } from './SessionStorage';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

/**
 * Database session storage using Prisma
 * Provides persistent storage with automatic expiration handling
 */
export class DatabaseSessionStorage extends BaseSessionStorage {
  private prisma: PrismaClient;
  
  /**
   * Create a new database session storage
   * @param prismaClient Prisma client instance (optional)
   */
  constructor(prismaClient?: PrismaClient) {
    super();
    
    try {
      // Use provided client or create a new one
      this.prisma = prismaClient || new PrismaClient();
      logger.info('Database session storage initialized');
    } catch (error) {
      logger.error('Failed to initialize database session storage:', error);
      throw error;
    }
  }
  
  /**
   * Store a session in the database
   * @param session The session to store
   */
  async storeSession(session: Session): Promise<boolean> {
    try {
      if (!session.id) {
        logger.error('Cannot store session without id');
        return false;
      }

      // Calculate expiration time
      const expires = session.expires 
        ? new Date(session.expires) 
        : new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day default
      
      // Create or update the session
      await this.prisma.shopifySession.upsert({
        where: { id: session.id },
        update: {
          shop: session.shop,
          state: session.state,
          isOnline: session.isOnline,
          scope: session.scope,
          accessToken: session.accessToken,
          expires,
          onlineAccessInfo: session.onlineAccessInfo 
            ? JSON.stringify(session.onlineAccessInfo) 
            : null,
        },
        create: {
          id: session.id,
          shop: session.shop,
          state: session.state,
          isOnline: session.isOnline || false,
          scope: session.scope || '',
          accessToken: session.accessToken,
          expires,
          onlineAccessInfo: session.onlineAccessInfo 
            ? JSON.stringify(session.onlineAccessInfo) 
            : null,
        },
      });
      
      logger.debug(`Session stored in database: ${session.id}`);
      return true;
    } catch (error) {
      logger.error('Error storing session in database:', error);
      return false;
    }
  }
  
  /**
   * Load a session from the database by ID
   * @param id The session ID
   */
  async loadSession(id: string): Promise<Session | undefined> {
    try {
      const dbSession = await this.prisma.shopifySession.findUnique({
        where: { id },
      });
      
      if (!dbSession) {
        logger.debug(`Session not found in database: ${id}`);
        return undefined;
      }
      
      // Convert database session to Shopify Session
      const session: Session = {
        id: dbSession.id,
        shop: dbSession.shop,
        state: dbSession.state,
        isOnline: dbSession.isOnline,
        scope: dbSession.scope,
        expires: dbSession.expires.toISOString(),
        accessToken: dbSession.accessToken,
      };
      
      // Add online access info if available
      if (dbSession.onlineAccessInfo) {
        try {
          session.onlineAccessInfo = JSON.parse(dbSession.onlineAccessInfo);
        } catch (error) {
          logger.error(`Error parsing onlineAccessInfo for session ${id}:`, error);
        }
      }
      
      // Check for expiration
      if (this.isSessionExpired(session)) {
        logger.debug(`Session expired, removing from database: ${id}`);
        await this.deleteSession(id);
        return undefined;
      }
      
      logger.debug(`Session loaded from database: ${id}`);
      return session;
    } catch (error) {
      logger.error(`Error loading session from database (${id}):`, error);
      return undefined;
    }
  }
  
  /**
   * Delete a session from the database by ID
   * @param id The session ID
   */
  async deleteSession(id: string): Promise<boolean> {
    try {
      await this.prisma.shopifySession.delete({
        where: { id },
      });
      
      logger.debug(`Session deleted from database: ${id}`);
      return true;
    } catch (error) {
      // If the session doesn't exist, consider it a success
      if (error.code === 'P2025') {
        logger.debug(`Session not found when deleting: ${id}`);
        return true;
      }
      
      logger.error(`Error deleting session from database (${id}):`, error);
      return false;
    }
  }
  
  /**
   * Find sessions in the database by shop domain
   * @param shop The shop domain
   */
  async findSessionsByShop(shop: string): Promise<Session[]> {
    try {
      const dbSessions = await this.prisma.shopifySession.findMany({
        where: { shop },
      });
      
      if (dbSessions.length === 0) {
        logger.debug(`No sessions found for shop in database: ${shop}`);
        return [];
      }
      
      const sessions: Session[] = [];
      const expiredIds: string[] = [];
      
      // Convert database sessions to Shopify Sessions
      for (const dbSession of dbSessions) {
        const session: Session = {
          id: dbSession.id,
          shop: dbSession.shop,
          state: dbSession.state,
          isOnline: dbSession.isOnline,
          scope: dbSession.scope,
          expires: dbSession.expires.toISOString(),
          accessToken: dbSession.accessToken,
        };
        
        // Add online access info if available
        if (dbSession.onlineAccessInfo) {
          try {
            session.onlineAccessInfo = JSON.parse(dbSession.onlineAccessInfo);
          } catch (error) {
            logger.error(`Error parsing onlineAccessInfo for session ${dbSession.id}:`, error);
          }
        }
        
        // Check for expiration
        if (this.isSessionExpired(session)) {
          expiredIds.push(dbSession.id);
        } else {
          sessions.push(session);
        }
      }
      
      // Clean up expired sessions
      if (expiredIds.length > 0) {
        this.deleteExpiredSessions(expiredIds).catch(err => {
          logger.error('Error deleting expired sessions:', err);
        });
      }
      
      logger.debug(`Found ${sessions.length} valid sessions for shop in database: ${shop}`);
      return sessions;
    } catch (error) {
      logger.error(`Error finding sessions for shop in database (${shop}):`, error);
      return [];
    }
  }
  
  /**
   * Delete all sessions for a shop from the database
   * @param shop The shop domain
   */
  async deleteSessions(shop: string): Promise<boolean> {
    try {
      const result = await this.prisma.shopifySession.deleteMany({
        where: { shop },
      });
      
      logger.debug(`Deleted ${result.count} sessions for shop from database: ${shop}`);
      return true;
    } catch (error) {
      logger.error(`Error deleting sessions for shop from database (${shop}):`, error);
      return false;
    }
  }
  
  /**
   * Delete expired sessions by IDs
   * @param ids Array of session IDs to delete
   */
  private async deleteExpiredSessions(ids: string[]): Promise<void> {
    try {
      await this.prisma.shopifySession.deleteMany({
        where: {
          id: {
            in: ids,
          },
        },
      });
      
      logger.debug(`Deleted ${ids.length} expired sessions from database`);
    } catch (error) {
      logger.error('Error deleting expired sessions from database:', error);
      throw error;
    }
  }
  
  /**
   * Clean up all expired sessions
   */
  async cleanupSessions(): Promise<boolean> {
    try {
      const now = new Date();
      
      const result = await this.prisma.shopifySession.deleteMany({
        where: {
          expires: {
            lt: now,
          },
        },
      });
      
      logger.debug(`Cleaned up ${result.count} expired sessions from database`);
      return true;
    } catch (error) {
      logger.error('Error cleaning up expired sessions from database:', error);
      return false;
    }
  }
  
  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
} 