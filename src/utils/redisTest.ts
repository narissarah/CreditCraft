import RedisClient from '../lib/redis';
import Cache from '../lib/cache';
import QueueRegistry from '../lib/queueRegistry';
import { logger } from './logger';

/**
 * Test Redis connection and basic functionality
 * @returns A promise that resolves to true if test passes, false otherwise
 */
export async function testRedisConnection(): Promise<boolean> {
  try {
    logger.info('Testing Redis connection...');
    
    // Test 1: Basic Redis connection
    const redis = await RedisClient.getClient();
    const pingResult = await redis.ping();
    
    if (pingResult !== 'PONG') {
      logger.error(`Redis ping failed: ${pingResult}`);
      return false;
    }
    
    logger.info('Redis ping successful');
    
    // Test 2: Cache set and get
    const testKey = `test:${Date.now()}`;
    const testValue = { test: true, timestamp: Date.now() };
    
    await Cache.set(testKey, testValue, 60);
    const retrievedValue = await Cache.get(testKey);
    
    if (!retrievedValue || retrievedValue.test !== true) {
      logger.error('Redis cache test failed: cached value not retrieved correctly');
      return false;
    }
    
    logger.info('Redis cache test successful');
    
    // Test 3: Delete from cache
    await Cache.delete(testKey);
    const deletedValue = await Cache.get(testKey);
    
    if (deletedValue !== null) {
      logger.error('Redis cache delete test failed: value still exists after deletion');
      return false;
    }
    
    logger.info('Redis cache delete test successful');
    
    return true;
  } catch (error) {
    logger.error(`Redis connection test failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Test Bull queue functionality
 * @returns A promise that resolves to true if test passes, false otherwise
 */
export async function testBullQueue(): Promise<boolean> {
  try {
    logger.info('Testing Bull queue...');
    
    // Create a test queue
    const queueRegistry = QueueRegistry.getInstance();
    const testQueueName = `test-queue-${Date.now()}`;
    const testQueue = queueRegistry.createQueue(testQueueName);
    
    // Test job processing
    let jobProcessed = false;
    
    testQueue.process(async (job) => {
      logger.info(`Processing test job ${job.id}`);
      jobProcessed = true;
      return { success: true };
    });
    
    // Add a test job
    const job = await testQueue.add({ test: true, timestamp: Date.now() });
    logger.info(`Test job ${job.id} added`);
    
    // Wait for job to be processed
    await new Promise<void>((resolve) => {
      const checkInterval = setInterval(async () => {
        if (jobProcessed) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });
    
    if (!jobProcessed) {
      logger.error('Bull queue test failed: job was not processed');
      return false;
    }
    
    logger.info('Bull queue test successful');
    
    // Clean up
    await testQueue.close();
    
    return true;
  } catch (error) {
    logger.error(`Bull queue test failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Run all Redis-related tests
 * @returns A promise that resolves to true if all tests pass, false otherwise
 */
export async function testRedisFeatures(): Promise<boolean> {
  try {
    // Test Redis connection
    const connectionTest = await testRedisConnection();
    if (!connectionTest) {
      return false;
    }
    
    // Test Bull queue
    const queueTest = await testBullQueue();
    if (!queueTest) {
      return false;
    }
    
    logger.info('All Redis tests passed successfully');
    return true;
  } catch (error) {
    logger.error(`Redis tests failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
} 