#!/usr/bin/env node

import { prisma } from '../../prisma/client';
import { logger } from '../utils/logger';
import { ReportService } from '../services/reportService';
import { EmailService } from '../services/emailService';
import * as cron from 'node-cron';
import * as path from 'path';
import * as fs from 'fs';
import { format } from 'date-fns';

// Set up services
const reportService = new ReportService();
const emailService = new EmailService();

// Ensure temporary directory exists
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

async function processScheduledReports() {
  try {
    logger.info('Processing scheduled reports...');
    
    // Find all active schedules that are due to run
    const now = new Date();
    const dueSchedules = await prisma.reportSchedule.findMany({
      where: {
        active: true,
        lastRunAt: {
          lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) // Only process if last run > 24 hours ago
        },
        // Check if the cron expression indicates it's time to run
        // Note: This is a simplified check; in production, you'd parse the cron expression
        // and properly determine if it's time to run
      }
    });
    
    logger.info(`Found ${dueSchedules.length} reports to process`);
    
    for (const schedule of dueSchedules) {
      try {
        await processReport(schedule);
      } catch (error) {
        logger.error(`Error processing report ${schedule.id}: ${error instanceof Error ? error.message : String(error)}`);
        
        // Update schedule with error details
        await prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: now,
            lastRunStatus: 'FAILED',
            errorDetails: error instanceof Error ? error.message : String(error)
          }
        });
      }
    }
    
    logger.info('Finished processing scheduled reports');
  } catch (error) {
    logger.error(`Error processing scheduled reports: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function processReport(schedule: any) {
  logger.info(`Processing report schedule ${schedule.id} for report type ${schedule.reportType}`);
  
  // Generate report data
  const parameters = schedule.parameters as Record<string, any>;
  const reportData = await generateReportData(schedule.reportType, parameters);
  
  // Generate report file based on format
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const filename = `${schedule.name.replace(/\s+/g, '_')}_${timestamp}`;
  const filePath = await generateReportFile(reportData, filename, schedule.format);
  
  // Send email with attachment
  await sendReportEmail(schedule, filePath);
  
  // Update schedule record
  await prisma.reportSchedule.update({
    where: { id: schedule.id },
    data: {
      lastRunAt: new Date(),
      lastRunStatus: 'SUCCESS',
      errorDetails: null
    }
  });
  
  // Clean up temp file
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  
  logger.info(`Successfully processed report schedule ${schedule.id}`);
}

async function generateReportData(reportType: string, parameters: Record<string, any>): Promise<any> {
  // Call appropriate report service method based on report type
  switch (reportType) {
    case 'CREDIT_SUMMARY':
      return await reportService.getCreditAnalyticsData(
        parameters.startDate ? new Date(parameters.startDate) : undefined,
        parameters.endDate ? new Date(parameters.endDate) : undefined
      );
    case 'CUSTOMER_SEGMENTATION':
      return await reportService.getCustomerSegmentationData(
        parameters.startDate ? new Date(parameters.startDate) : undefined,
        parameters.endDate ? new Date(parameters.endDate) : undefined
      );
    case 'STAFF_PERFORMANCE':
      return await reportService.getStaffPerformanceData(
        parameters.startDate ? new Date(parameters.startDate) : undefined,
        parameters.endDate ? new Date(parameters.endDate) : undefined
      );
    case 'DASHBOARD_OVERVIEW':
      return await reportService.getDashboardData(
        parameters.startDate ? new Date(parameters.startDate) : undefined,
        parameters.endDate ? new Date(parameters.endDate) : undefined
      );
    case 'CUSTOM_REPORT':
      if (!parameters.reportId) {
        throw new Error('Report ID is required for custom reports');
      }
      return await reportService.getCustomReportData(
        parameters.reportId,
        parameters.startDate ? new Date(parameters.startDate) : undefined,
        parameters.endDate ? new Date(parameters.endDate) : undefined
      );
    default:
      throw new Error(`Unsupported report type: ${reportType}`);
  }
}

async function generateReportFile(reportData: any, filename: string, format: string): Promise<string> {
  const filePath = path.join(tempDir, `${filename}.${format.toLowerCase()}`);
  
  // This is a simplified implementation
  // In a real-world scenario, you would use proper libraries for generating PDFs, CSVs, etc.
  // For now, we'll just serialize the data to JSON
  fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2));
  
  return filePath;
}

async function sendReportEmail(schedule: any, filePath: string) {
  const attachments = [{
    filename: path.basename(filePath),
    path: filePath
  }];
  
  try {
    // Use the EmailService's new method for sending scheduled reports
    await emailService.sendScheduledReportNotification(
      schedule.recipients,
      {
        reportName: schedule.name,
        format: schedule.format,
        reportType: schedule.reportType,
        startDate: schedule.parameters.startDate ? new Date(schedule.parameters.startDate) : new Date(new Date().setDate(new Date().getDate() - 30)),
        endDate: schedule.parameters.endDate ? new Date(schedule.parameters.endDate) : new Date(),
        additionalNotes: `This report was automatically generated according to your schedule. If you have any questions or need to adjust your report settings, please visit the Reports section in your CreditCraft dashboard.`,
        dashboardUrl: process.env.APP_URL || 'https://app.creditcraft.com',
        attachment: {
          filename: path.basename(filePath),
          path: filePath
        }
      }
    );
    
    logger.info(`Report email sent to ${schedule.recipients.join(', ')}`);
  } catch (error) {
    logger.error(`Error sending email for schedule ${schedule.id}: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// If running as a script
if (require.main === module) {
  processScheduledReports()
    .then(() => {
      logger.info('Report processing completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error(`Error running report processor: ${error}`);
      process.exit(1);
    });
}

// Function to set up a cron job for regular processing
export function setupReportProcessingCron(cronSchedule = '0 * * * *') { // Default to hourly
  return cron.schedule(cronSchedule, () => {
    processScheduledReports()
      .catch(error => {
        logger.error(`Error in scheduled report processing: ${error}`);
      });
  });
}

export { processScheduledReports }; 