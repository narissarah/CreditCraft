import Queue from 'bull';
import { prisma } from '../../prisma/client';
import { logger } from '../utils/logger';
import { NotificationTriggerService } from '../services/emailService/notificationTriggers';
import { getRedisBullConfig } from '../config/redis';

// Email notification job types
export enum EmailNotificationJobType {
  CREDIT_ISSUED = 'credit-issued',
  CREDIT_EXPIRING = 'credit-expiring',
  CREDIT_REDEEMED = 'credit-redeemed',
  BALANCE_UPDATE = 'balance-update',
  CUSTOM = 'custom',
  BATCH_EXPIRATION_REMINDER = 'batch-expiration-reminder'
}

// Email notification job data interface
interface EmailNotificationJobData {
  type: EmailNotificationJobType;
  customerId?: string;
  creditId?: string;
  transactionId?: string;
  subject?: string;
  message?: string;
  daysUntilExpiration?: number;
}

// Initialize the email notification queue
let emailNotificationQueue: Queue.Queue<EmailNotificationJobData>;

/**
 * Initialize the email notification queue
 */
export const initEmailNotificationQueue = async (): Promise<Queue.Queue<EmailNotificationJobData>> => {
  if (emailNotificationQueue) {
    return emailNotificationQueue;
  }

  try {
    // Create the queue
    emailNotificationQueue = new Queue<EmailNotificationJobData>(
      'email-notifications',
      getRedisBullConfig()
    );

    // Process jobs
    emailNotificationQueue.process(async (job) => {
      try {
        await processEmailNotificationJob(job.data);
        return { success: true };
      } catch (error) {
        logger.error(`Error processing email notification job ${job.id}:`, error);
        throw error;
      }
    });

    // Log completed jobs
    emailNotificationQueue.on('completed', (job) => {
      logger.info(`Email notification job ${job.id} completed successfully`);
    });

    // Log failed jobs
    emailNotificationQueue.on('failed', (job, error) => {
      logger.error(`Email notification job ${job.id} failed:`, error);
    });

    logger.info('Email notification queue initialized');
    return emailNotificationQueue;
  } catch (error) {
    logger.error('Failed to initialize email notification queue:', error);
    throw error;
  }
};

/**
 * Process an email notification job
 */
const processEmailNotificationJob = async (data: EmailNotificationJobData): Promise<void> => {
  const { type, customerId, creditId, transactionId, subject, message, daysUntilExpiration } = data;

  logger.info(`Processing ${type} email notification`, { customerId, creditId });

  switch (type) {
    case EmailNotificationJobType.CREDIT_ISSUED:
      if (!creditId) {
        throw new Error('Credit ID is required for credit issued notifications');
      }
      await NotificationTriggerService.onCreditIssued(creditId);
      break;

    case EmailNotificationJobType.CREDIT_EXPIRING:
      if (!creditId) {
        throw new Error('Credit ID is required for credit expiring notifications');
      }
      await NotificationTriggerService.onCreditExpiring(
        creditId, 
        daysUntilExpiration || 7 // Default to 7 days if not specified
      );
      break;

    case EmailNotificationJobType.CREDIT_REDEEMED:
      if (!creditId || !transactionId) {
        throw new Error('Credit ID and Transaction ID are required for credit redeemed notifications');
      }
      await NotificationTriggerService.onCreditRedeemed(creditId, transactionId);
      break;

    case EmailNotificationJobType.BATCH_EXPIRATION_REMINDER:
      await processExpirationReminders(daysUntilExpiration || 7);
      break;

    case EmailNotificationJobType.CUSTOM:
      if (!customerId || !subject || !message) {
        throw new Error('Customer ID, subject and message are required for custom notifications');
      }
      await NotificationTriggerService.sendCustomNotification(customerId, subject, message);
      break;

    default:
      throw new Error(`Unknown email notification type: ${type}`);
  }
};

/**
 * Process expiration reminders for all credits expiring in the given days
 */
const processExpirationReminders = async (daysUntilExpiration: number): Promise<void> => {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + daysUntilExpiration);
  
  // Get start and end of the target day
  const startOfDay = new Date(expirationDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(expirationDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  try {
    // Find all active credits expiring on the target day
    const expiringCredits = await prisma.credit.findMany({
      where: {
        status: 'ACTIVE',
        balance: { gt: 0 },
        expirationDate: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        customer: {
          include: {
            notificationPreferences: true
          }
        }
      }
    });
    
    logger.info(`Found ${expiringCredits.length} credits expiring in ${daysUntilExpiration} days`);
    
    // Send notifications for each expiring credit
    for (const credit of expiringCredits) {
      // Skip if customer has notifications disabled
      const preferences = credit.customer?.notificationPreferences;
      if (!preferences?.emailEnabled || !preferences?.creditExpiring) {
        logger.info(`Skipping notification for credit ${credit.id}, customer has disabled notifications`);
        continue;
      }
      
      try {
        await NotificationTriggerService.onCreditExpiring(credit.id, daysUntilExpiration);
      } catch (error) {
        logger.error(`Failed to send expiration notification for credit ${credit.id}:`, error);
      }
    }
    
    logger.info('Completed processing expiration reminders');
  } catch (error) {
    logger.error('Error processing expiration reminders:', error);
    throw error;
  }
};

/**
 * Schedule an email notification job
 */
export const scheduleEmailNotificationJob = async (
  data: EmailNotificationJobData,
  options: Queue.JobOptions = {}
): Promise<string> => {
  try {
    // Initialize queue if not already done
    const queue = await initEmailNotificationQueue();
    
    // Add job to queue
    const job = await queue.add(
      data,
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000
        },
        removeOnComplete: true,
        ...options
      }
    );
    
    logger.info(`Scheduled ${data.type} email notification job ${job.id}`, {
      customerId: data.customerId,
      creditId: data.creditId
    });
    
    return job.id.toString();
  } catch (error) {
    logger.error('Failed to schedule email notification job:', error);
    throw error;
  }
};

/**
 * Schedule a batch job to send expiration reminders
 */
export const scheduleExpirationReminders = async (
  daysUntilExpiration: number = 7
): Promise<string> => {
  return scheduleEmailNotificationJob({
    type: EmailNotificationJobType.BATCH_EXPIRATION_REMINDER,
    daysUntilExpiration
  });
};

export default {
  initEmailNotificationQueue,
  scheduleEmailNotificationJob,
  scheduleExpirationReminders
}; 