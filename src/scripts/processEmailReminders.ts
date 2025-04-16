#!/usr/bin/env tsx

import { scheduleExpirationReminders } from '../jobs/emailNotificationJob';
import { logger } from '../utils/logger';

/**
 * Main script entry point
 */
async function main() {
  try {
    logger.info('Starting email reminder processor');
    
    // Process different reminder thresholds
    await Promise.all([
      // Reminders for credits expiring in 1 day
      scheduleExpirationReminders(1)
        .then(jobId => logger.info(`Scheduled 1-day expiration reminders, job ID: ${jobId}`)),
      
      // Reminders for credits expiring in 7 days  
      scheduleExpirationReminders(7)
        .then(jobId => logger.info(`Scheduled 7-day expiration reminders, job ID: ${jobId}`)),
      
      // Reminders for credits expiring in 30 days
      scheduleExpirationReminders(30)
        .then(jobId => logger.info(`Scheduled 30-day expiration reminders, job ID: ${jobId}`))
    ]);
    
    logger.info('Email reminder processor completed successfully');
    
    // Allow time for the jobs to be processed
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    process.exit(0);
  } catch (error) {
    logger.error('Error processing email reminders:', error);
    process.exit(1);
  }
}

// Run the script
main(); 