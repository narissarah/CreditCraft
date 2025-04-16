import 'dotenv/config';
import { cleanupSessions, initializeSessionStorage, StorageType, getRecommendedStorageType } from '../src/session/sessionManager';
import { logger } from '../src/utils/logger';

/**
 * Main function to run the session cleanup
 */
async function main() {
  try {
    logger.info('Starting session cleanup');
    
    // Determine the appropriate storage type
    const storageType = process.env.SESSION_STORAGE_TYPE 
      ? process.env.SESSION_STORAGE_TYPE as StorageType 
      : getRecommendedStorageType();
    
    // Initialize the session storage
    logger.info(`Initializing session storage with type: ${storageType}`);
    
    const options: Record<string, any> = {};
    
    // Set up Redis options if needed
    if (storageType === StorageType.REDIS && process.env.REDIS_URL) {
      options.redis = process.env.REDIS_URL;
    }
    
    // Initialize the session storage
    initializeSessionStorage(storageType, options);
    
    // Run the cleanup
    const result = await cleanupSessions();
    
    if (result) {
      logger.info('Session cleanup completed successfully');
    } else {
      logger.error('Session cleanup failed');
      process.exit(1);
    }
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during session cleanup:', error);
    process.exit(1);
  }
}

// Execute the main function
main(); 