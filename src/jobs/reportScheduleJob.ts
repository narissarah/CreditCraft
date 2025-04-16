import { Queue, Job } from 'bull';
import { logger } from '../utils/logger';
import QueueRegistry from '../lib/queueRegistry';
import prisma from '../lib/prisma';
import { generateReport } from '../services/reportService';
import emailService from '../services/emailService';

// Define job data types
export interface ScheduledReportJobData {
  reportId: string;
  reportType: string;
  parameters: Record<string, any>;
  recipients: string[];
  format: 'PDF' | 'CSV' | 'EXCEL';
  scheduleId: string;
}

// Queue name
const QUEUE_NAME = 'report-schedule';

/**
 * Process a scheduled report job
 * @param job The Bull job containing report data
 */
export async function processScheduledReport(job: Job<ScheduledReportJobData>): Promise<void> {
  const { reportId, reportType, parameters, recipients, format, scheduleId } = job.data;
  
  try {
    logger.info(`Processing scheduled report job ${job.id} for report ${reportId} (${reportType})`);
    
    // Update the schedule record to show it's processing
    await prisma.reportSchedule.update({
      where: { id: scheduleId },
      data: { lastRunStatus: 'PROCESSING', lastRunStartedAt: new Date() }
    });
    
    // Generate the report
    const reportResult = await generateReport(reportType, parameters, format);
    
    // Send the report via email to all recipients
    const emailPromises = recipients.map(recipient => {
      return emailService.sendTemplateEmail({
        to: recipient,
        subject: `Your scheduled report: ${reportType}`,
        template: 'scheduled-report',
        data: {
          reportType,
          generatedDate: new Date().toLocaleString(),
          reportName: reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        },
        attachments: [
          {
            filename: `${reportType}_${new Date().toISOString().split('T')[0]}.${format.toLowerCase()}`,
            content: reportResult.content,
            contentType: format === 'PDF' ? 'application/pdf' : 
                         format === 'CSV' ? 'text/csv' : 
                         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }
        ]
      });
    });
    
    await Promise.all(emailPromises);
    
    // Update the schedule record to show success
    await prisma.reportSchedule.update({
      where: { id: scheduleId },
      data: { 
        lastRunStatus: 'SUCCESS', 
        lastRunCompletedAt: new Date(),
        lastSuccessfulRunAt: new Date(),
        runCount: { increment: 1 }
      }
    });
    
    logger.info(`Successfully processed scheduled report job ${job.id} for report ${reportId}`);
  } catch (error) {
    // Update the schedule record to show failure
    await prisma.reportSchedule.update({
      where: { id: scheduleId },
      data: { 
        lastRunStatus: 'FAILED', 
        lastRunCompletedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : String(error)
      }
    });
    
    logger.error(`Failed to process scheduled report job ${job.id}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

/**
 * Schedule a report job
 * @param data The report data
 * @param cronExpression The cron expression for scheduling
 */
export async function scheduleReport(
  data: ScheduledReportJobData, 
  cronExpression: string,
  jobOptions: { 
    jobId?: string,
    timezone?: string,
    removeOnComplete?: boolean | number,
    removeOnFail?: boolean | number
  } = {}
): Promise<Job<ScheduledReportJobData>> {
  const queue = QueueRegistry.getInstance().getQueue(QUEUE_NAME);
  
  if (!queue) {
    throw new Error(`Queue ${QUEUE_NAME} not initialized`);
  }
  
  // If a jobId is provided, remove any existing job with this ID
  if (jobOptions.jobId) {
    const existingJob = await queue.getJob(jobOptions.jobId);
    if (existingJob) {
      await existingJob.remove();
      logger.info(`Removed existing scheduled report job ${jobOptions.jobId}`);
    }
  }
  
  const options = {
    jobId: jobOptions.jobId ?? `report-${data.reportId}-${Date.now()}`,
    repeat: { cron: cronExpression, timezone: jobOptions.timezone ?? 'UTC' },
    removeOnComplete: jobOptions.removeOnComplete ?? 100,
    removeOnFail: jobOptions.removeOnFail ?? 5,
  };
  
  const job = await queue.add(data, options);
  logger.info(`Scheduled report job ${job.id} with cron: ${cronExpression}`);
  
  return job;
}

/**
 * Remove a scheduled report job
 * @param jobId The job ID to remove
 */
export async function removeScheduledReport(jobId: string): Promise<void> {
  const queue = QueueRegistry.getInstance().getQueue(QUEUE_NAME);
  
  if (!queue) {
    throw new Error(`Queue ${QUEUE_NAME} not initialized`);
  }
  
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove();
    logger.info(`Removed scheduled report job ${jobId}`);
  } else {
    logger.warn(`Scheduled report job ${jobId} not found`);
  }
  
  // Also remove any repeatable jobs with this ID pattern
  const repeatableJobs = await queue.getRepeatableJobs();
  const matchingJobs = repeatableJobs.filter(job => job.id === jobId || job.name === jobId);
  
  for (const job of matchingJobs) {
    await queue.removeRepeatableByKey(job.key);
    logger.info(`Removed repeatable job with key ${job.key}`);
  }
}

/**
 * Initialize the report scheduling queue
 */
export function initReportScheduleQueue(): Queue<ScheduledReportJobData> {
  try {
    logger.info('Initializing report schedule queue...');
    
    const queueRegistry = QueueRegistry.getInstance();
    const queue = queueRegistry.createQueue(QUEUE_NAME);
    
    // Process jobs
    queue.process(processScheduledReport);
    
    // Handle events
    queue.on('completed', (job) => {
      logger.info(`Report scheduling job ${job.id} completed successfully`);
    });
    
    queue.on('failed', (job, error) => {
      logger.error(`Report scheduling job ${job?.id} failed: ${error}`);
    });
    
    logger.info('Report schedule queue initialized successfully');
    
    return queue;
  } catch (error) {
    logger.error(`Failed to initialize report schedule queue: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

export default {
  initReportScheduleQueue,
  scheduleReport,
  removeScheduledReport,
  processScheduledReport
}; 