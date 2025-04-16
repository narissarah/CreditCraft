import { Queue, Job } from 'bull';
import { logger } from '../utils/logger';
import { cleanupSessions } from '../session/sessionManager';

/**
 * Job handler for cleaning up expired sessions
 */
export async function processSessionCleanup(job: Job): Promise<void> {
  try {
    logger.info('Starting session cleanup job');
    
    const result = await cleanupSessions();
    
    if (result) {
      logger.info('Session cleanup completed successfully');
    } else {
      logger.warn('Session cleanup completed with warnings');
    }
    
    // Return job data with status
    job.updateProgress(100);
  } catch (error) {
    logger.error('Error processing session cleanup job:', error);
    throw error;
  }
}

/**
 * Register the session cleanup job with the queue
 * @param queue The Bull queue to register with
 */
export function registerSessionCleanupJob(queue: Queue): void {
  // Process the cleanup job
  queue.process('session:cleanup', processSessionCleanup);
  
  // Schedule the cleanup job to run daily at 2:30am
  queue.add(
    'session:cleanup',
    { timestamp: new Date().toISOString() },
    { 
      repeat: { 
        cron: '30 2 * * *' // Run at 2:30am every day
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
  
  logger.info('Session cleanup job registered');
}

/**
 * Manually trigger a session cleanup
 * @param queue The Bull queue to use
 */
export async function triggerSessionCleanup(queue: Queue): Promise<Job> {
  return queue.add(
    'session:cleanup',
    { timestamp: new Date().toISOString(), manual: true },
    { 
      attempts: 3,
      removeOnComplete: true,
    }
  );
} 