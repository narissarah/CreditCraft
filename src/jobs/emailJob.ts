import { Job } from 'bull';
import QueueRegistry from '../lib/queueRegistry';
import { logger } from '../utils/logger';

// Queue name
export const EMAIL_QUEUE = 'email';

// Job data interface
export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
  template?: string;
  data?: Record<string, any>;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
}

/**
 * Process email jobs
 * @param job The Bull job containing email data
 */
export async function processEmailJob(job: Job<EmailJobData>): Promise<any> {
  try {
    const { to, subject, body, template, data, attachments } = job.data;
    
    logger.info(`Processing email job ${job.id}: ${subject} to ${to}`);
    
    // In a real implementation, this would send the email using your
    // email service provider (e.g., SendGrid, Mailgun, SES)
    
    // Simulate email sending
    await new Promise<void>(resolve => setTimeout(resolve, 500));
    
    logger.info(`Email sent successfully: ${subject} to ${to}`);
    
    return {
      success: true,
      messageId: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      to,
      subject
    };
  } catch (error) {
    logger.error(`Failed to process email job ${job.id}: ${error instanceof Error ? error.message : String(error)}`);
    throw error; // Rethrow to allow Bull to handle retries
  }
}

/**
 * Add an email job to the queue
 * @param data Email job data
 * @param delay Optional delay in milliseconds
 * @returns The created job
 */
export async function queueEmail(data: EmailJobData, delay?: number): Promise<Job<EmailJobData>> {
  const queueRegistry = QueueRegistry.getInstance();
  
  return queueRegistry.addJob<EmailJobData>(EMAIL_QUEUE, data, {
    delay,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000 // 5 seconds initial delay
    },
    removeOnComplete: 100,
    removeOnFail: 200
  });
}

/**
 * Initialize the email queue
 */
export function initializeEmailQueue(concurrency = 5): void {
  const queueRegistry = QueueRegistry.getInstance();
  
  // Register the queue and processor
  queueRegistry.processQueue<EmailJobData>(EMAIL_QUEUE, processEmailJob, concurrency);
  
  logger.info(`Email queue initialized with concurrency ${concurrency}`);
}

export default {
  queueEmail,
  processEmailJob,
  initializeEmailQueue,
  EMAIL_QUEUE
}; 