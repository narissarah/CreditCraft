import { logger } from '../utils/logger';
import QueueRegistry from '../lib/queueRegistry';
import QueueMonitor from '../lib/queueMonitor';
import emailJob from './emailJob';
import creditJob from './creditJob';
import emailNotificationJob, { initEmailNotificationQueue } from './emailNotificationJob';
import reportScheduleJob from './reportScheduleJob';

/**
 * Initialize all job queues for the application
 */
export function initializeJobQueues(): void {
  try {
    logger.info('Initializing job queues...');
    
    // Initialize the queue registry monitoring
    const queueRegistry = QueueRegistry.getInstance();
    queueRegistry.startMonitoring();
    
    // Initialize specific job queues
    emailJob.initializeEmailQueue();
    
    // Initialize credit jobs
    const creditQueue = queueRegistry.createQueue('credit');
    creditJob.registerExpiredCreditsJob(creditQueue);
    
    // Initialize email notification jobs
    initEmailNotificationQueue().catch(err => {
      logger.error('Failed to initialize email notification queue:', err);
    });
    
    // Initialize report scheduling jobs
    reportScheduleJob.initReportScheduleQueue();
    
    // Initialize queue monitoring
    const queueMonitor = QueueMonitor.getInstance();
    queueMonitor.addAllQueues();
    
    logger.info('Job queues initialized successfully');
  } catch (error) {
    logger.error(`Failed to initialize job queues: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Clean up job queues (for graceful shutdown)
 */
export async function cleanupJobQueues(): Promise<void> {
  try {
    logger.info('Cleaning up job queues...');
    
    const queueRegistry = QueueRegistry.getInstance();
    queueRegistry.stopMonitoring();
    await queueRegistry.closeAll();
    
    logger.info('Job queues cleaned up successfully');
  } catch (error) {
    logger.error(`Failed to clean up job queues: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export default {
  initializeJobQueues,
  cleanupJobQueues,
  // Export specific job queue utilities for easy access
  email: emailJob,
  credit: creditJob,
  emailNotification: emailNotificationJob,
  reportSchedule: reportScheduleJob
}; 