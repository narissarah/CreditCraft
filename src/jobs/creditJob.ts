import { Queue, Job } from 'bull';
import { logger } from '../utils/logger';
import { creditService } from '../services/creditService';

/**
 * Job handler for processing expired credits
 */
export async function processExpiredCreditsJob(job: Job): Promise<void> {
  try {
    logger.info('Starting expired credits processing job');
    
    const count = await creditService.processExpiredCredits();
    
    logger.info(`Expired credits processing completed: ${count} credits processed`);
    
    // Update job progress
    job.updateProgress(100);
  } catch (error) {
    logger.error('Error processing expired credits job:', error);
    throw error;
  }
}

/**
 * Register the expired credits processing job with the queue
 * @param queue The Bull queue to register with
 */
export function registerExpiredCreditsJob(queue: Queue): void {
  // Process the job
  queue.process('credit:process-expired', processExpiredCreditsJob);
  
  // Schedule the job to run daily at 3:00am
  queue.add(
    'credit:process-expired',
    { timestamp: new Date().toISOString() },
    { 
      repeat: { 
        cron: '0 3 * * *' // Run at 3:00am every day
      },
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
  
  logger.info('Expired credits processing job registered');
}

/**
 * Manually trigger processing of expired credits
 * @param queue The Bull queue to use
 */
export async function triggerExpiredCreditsProcessing(queue: Queue): Promise<Job> {
  return queue.add(
    'credit:process-expired',
    { timestamp: new Date().toISOString(), manual: true },
    { 
      attempts: 3,
      removeOnComplete: true,
    }
  );
}

export default {
  processExpiredCreditsJob,
  registerExpiredCreditsJob,
  triggerExpiredCreditsProcessing
}; 