import { prisma } from '../../prisma/client';
import { logger } from '../utils/logger';
import { SavedReportService } from './savedReportService';
import { EmailService } from './emailService';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { format } from 'date-fns';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { ReportResult, ScheduleReportParams, EmailAttachment, ReportExportOptions } from '../types/report';
import { reportService } from './reportService';
import { emailService } from './emailService';

interface ScheduleReportParams {
  reportId: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  dayOfWeek?: number; // 0-6, Sunday to Saturday (for weekly)
  dayOfMonth?: number; // 1-31 (for monthly)
  month?: number; // 0-11 (for quarterly)
  hour: number; // 0-23
  minute: number; // 0-59
  recipients: string[];
  format: 'pdf' | 'csv' | 'excel';
  includeData: boolean;
  subject?: string;
  message?: string;
}

export class ReportSchedulingService {
  private savedReportService: SavedReportService;
  private emailService: EmailService;
  private tempDir: string;

  constructor() {
    this.savedReportService = new SavedReportService();
    this.emailService = new EmailService();
    this.tempDir = join(process.cwd(), 'temp');
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Schedule a report to be sent automatically
   */
  async scheduleReport(params: ScheduleReportParams, userId: string): Promise<any> {
    try {
      // Verify the report exists and user has access
      const report = await this.savedReportService.getReportById(params.reportId, userId);
      if (!report) {
        throw new Error('Report not found or access denied');
      }

      // Create a cron expression based on the frequency
      const cronExpression = this.createCronExpression(params);
      
      // Calculate initial next run date
      const now = new Date();
      let nextRunDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        params.hour,
        params.minute
      );
      
      // If next run time is in the past, move to next occurrence
      if (nextRunDate <= now) {
        switch (params.frequency) {
          case 'daily':
            nextRunDate.setDate(nextRunDate.getDate() + 1);
            break;
          case 'weekly':
            nextRunDate.setDate(nextRunDate.getDate() + (7 - nextRunDate.getDay() + (params.dayOfWeek || 0)) % 7);
            break;
          case 'monthly':
            nextRunDate.setMonth(nextRunDate.getMonth() + 1);
            nextRunDate.setDate(params.dayOfMonth || 1);
            break;
          case 'quarterly':
            nextRunDate.setMonth(nextRunDate.getMonth() + 3);
            break;
        }
      }

      // Create the schedule
      const schedule = await prisma.reportSchedule.create({
        data: {
          reportId: params.reportId,
          frequency: params.frequency,
          dayOfWeek: params.dayOfWeek,
          dayOfMonth: params.dayOfMonth,
          month: params.month,
          hour: params.hour,
          minute: params.minute,
          recipients: params.recipients,
          format: params.format,
          includeData: params.includeData,
          subject: params.subject || `${report.name} - Scheduled Report`,
          message: params.message || `Please find attached the scheduled report "${report.name}".`,
          nextRunDate,
          createdBy: userId,
          isActive: true
        }
      });

      logger.info(`Report schedule created with ID: ${schedule.id}`);
      return schedule;
    } catch (error) {
      logger.error(`Error scheduling report: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to schedule report');
    }
  }

  /**
   * Process all schedules that are due
   */
  async processDueSchedules(): Promise<void> {
    try {
      const now = new Date();
      
      // Find all active schedules that are due
      const dueSchedules = await prisma.reportSchedule.findMany({
        where: {
          isActive: true,
          nextRunDate: {
            lte: now
          }
        },
        include: {
          report: true
        }
      });

      logger.info(`Found ${dueSchedules.length} due report schedules`);

      // Process each due schedule
      for (const schedule of dueSchedules) {
        try {
          await this.processSchedule(schedule);
          
          // Update the next run date based on frequency
          const nextRunDate = this.calculateNextRunDate(schedule);
          
          await prisma.reportSchedule.update({
            where: { id: schedule.id },
            data: { 
              nextRunDate,
              lastRunDate: now,
              lastRunStatus: 'success',
              lastRunError: null
            }
          });
        } catch (error) {
          logger.error(`Error processing schedule ${schedule.id}: ${error instanceof Error ? error.message : String(error)}`);
          
          // Update the schedule with error information
          await prisma.reportSchedule.update({
            where: { id: schedule.id },
            data: {
              lastRunDate: now,
              lastRunStatus: 'failed',
              lastRunError: error instanceof Error ? error.message : String(error)
            }
          });
        }
      }
    } catch (error) {
      logger.error(`Error processing due schedules: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Process a single schedule
   */
  private async processSchedule(schedule: any): Promise<void> {
    try {
      logger.info(`Processing schedule ${schedule.id} for report ${schedule.reportId}`);
      
      // Generate the report data
      const reportData = await reportService.generateReport(
        schedule.reportId,
        schedule.report.configuration,
        schedule.createdBy
      );
      
      if (!reportData || !reportData.data) {
        throw new Error('Failed to generate report data');
      }
      
      // Generate the report file based on format
      const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
      const filename = `${schedule.report.name.replace(/\s+/g, '_')}_${timestamp}`;
      const attachments: EmailAttachment[] = [];
      
      switch (schedule.format) {
        case 'pdf':
          const pdfPath = await this.exportToPdf(reportData, filename);
          attachments.push({
            filename: `${filename}.pdf`,
            path: pdfPath,
            contentType: 'application/pdf'
          });
          break;
          
        case 'csv':
          const csvPath = await this.exportToCsv(reportData, filename);
          attachments.push({
            filename: `${filename}.csv`,
            path: csvPath,
            contentType: 'text/csv'
          });
          break;
          
        case 'excel':
          const excelPath = await this.exportToExcel(reportData, filename);
          attachments.push({
            filename: `${filename}.xlsx`,
            path: excelPath,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          });
          break;
          
        default:
          throw new Error(`Unsupported export format: ${schedule.format}`);
      }
      
      // Send email with the report
      const subject = schedule.subject || `Scheduled Report: ${schedule.report.name}`;
      const message = schedule.message || `Please find attached your scheduled report "${schedule.report.name}" generated on ${format(new Date(), 'MMMM d, yyyy')} at ${format(new Date(), 'h:mm a')}.`;
      
      await emailService.sendCustomNotification({
        to: schedule.recipients,
        subject,
        message,
        attachments
      });
      
      // Clean up temporary files
      for (const attachment of attachments) {
        if (existsSync(attachment.path)) {
          unlinkSync(attachment.path);
        }
      }
      
      logger.info(`Successfully processed schedule ${schedule.id}`);
      
    } catch (error) {
      logger.error(`Error processing schedule ${schedule.id}:`, error);
      throw error;
    }
  }

  /**
   * Calculate the next run date based on schedule frequency
   */
  private calculateNextRunDate(schedule: any): Date {
    const lastRun = schedule.nextRunDate || new Date();
    const nextRun = new Date(lastRun);
    
    switch (schedule.frequency) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        // Handle edge cases like Feb 30 -> Mar 2
        const dayOfMonth = schedule.dayOfMonth || lastRun.getDate();
        const month = nextRun.getMonth();
        nextRun.setDate(1);
        nextRun.setDate(Math.min(dayOfMonth, this.getLastDayOfMonth(nextRun)));
        break;
      case 'quarterly':
        nextRun.setMonth(nextRun.getMonth() + 3);
        break;
    }
    
    // Set the time component
    nextRun.setHours(schedule.hour, schedule.minute, 0, 0);
    
    return nextRun;
  }

  /**
   * Get the last day of a month
   */
  private getLastDayOfMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  /**
   * Create a cron expression based on schedule parameters
   */
  private createCronExpression(params: ScheduleReportParams): string {
    const { frequency, dayOfWeek, dayOfMonth, month, hour, minute } = params;
    
    switch (frequency) {
      case 'daily':
        return `${minute} ${hour} * * *`;
      case 'weekly':
        return `${minute} ${hour} * * ${dayOfWeek || 0}`;
      case 'monthly':
        return `${minute} ${hour} ${dayOfMonth || 1} * *`;
      case 'quarterly':
        // This is an approximation for quarterly using months 1,4,7,10
        const months = month !== undefined ? [month] : [0, 3, 6, 9];
        return `${minute} ${hour} ${dayOfMonth || 1} ${months.join(',')} *`;
      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }
  }

  /**
   * Export report data to CSV
   */
  private async exportToCsv(reportData: ReportResult, filename: string): Promise<string> {
    try {
      const filePath = join(this.tempDir, `${filename}.csv`);
      
      if (reportData.data.length === 0) {
        // Create empty CSV file
        writeFileSync(filePath, '');
        return filePath;
      }
      
      // Get CSV headers from the first data object
      const headers = Object.keys(reportData.data[0]).map(key => ({
        id: key,
        title: key.charAt(0).toUpperCase() + key.slice(1)
      }));
      
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: headers
      });
      
      await csvWriter.writeRecords(reportData.data);
      
      return filePath;
    } catch (error) {
      logger.error('Error exporting to CSV:', error);
      throw new Error(`Failed to export report to CSV: ${error.message}`);
    }
  }

  /**
   * Export report data to Excel
   */
  private async exportToExcel(reportData: ReportResult, filename: string): Promise<string> {
    try {
      const filePath = join(this.tempDir, `${filename}.xlsx`);
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Report');
      
      if (reportData.data.length === 0) {
        // Add empty header row
        worksheet.addRow(['No data available']);
        await workbook.xlsx.writeFile(filePath);
        return filePath;
      }
      
      // Add summary if available
      if (reportData.summary) {
        const summarySheet = workbook.addWorksheet('Summary');
        for (const [key, value] of Object.entries(reportData.summary)) {
          summarySheet.addRow([key, value]);
        }
      }
      
      // Get headers from the first data object
      const headers = Object.keys(reportData.data[0]);
      worksheet.addRow(headers);
      
      // Format header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      
      // Add data rows
      reportData.data.forEach(item => {
        const row = [];
        headers.forEach(header => {
          row.push(item[header]);
        });
        worksheet.addRow(row);
      });
      
      // Auto-fit columns
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 10;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = maxLength < 10 ? 10 : maxLength + 2;
      });
      
      await workbook.xlsx.writeFile(filePath);
      return filePath;
    } catch (error) {
      logger.error('Error exporting to Excel:', error);
      throw new Error(`Failed to export report to Excel: ${error.message}`);
    }
  }

  /**
   * Export report data to PDF
   */
  private async exportToPdf(reportData: ReportResult, filename: string): Promise<string> {
    try {
      // Note: This is a placeholder implementation
      // In a real application, you would use a PDF generation library like PDFKit or puppeteer
      // For now, we'll create a simple text file as a placeholder
      const filePath = join(this.tempDir, `${filename}.pdf`);
      
      // Create a simple text representation of the report
      let content = `Report: ${filename}\n`;
      content += `Generated: ${new Date().toISOString()}\n\n`;
      
      if (reportData.summary) {
        content += `Summary:\n`;
        for (const [key, value] of Object.entries(reportData.summary)) {
          content += `${key}: ${value}\n`;
        }
        content += `\n`;
      }
      
      if (reportData.data.length > 0) {
        const headers = Object.keys(reportData.data[0]);
        content += headers.join('\t') + '\n';
        content += '='.repeat(headers.join('\t').length) + '\n';
        
        reportData.data.forEach(item => {
          const rowValues = headers.map(header => item[header]);
          content += rowValues.join('\t') + '\n';
        });
      } else {
        content += 'No data available\n';
      }
      
      writeFileSync(filePath, content);
      
      // In a production environment, replace with actual PDF generation
      logger.warn('PDF generation is using placeholder implementation');
      
      return filePath;
    } catch (error) {
      logger.error('Error exporting to PDF:', error);
      throw new Error(`Failed to export report to PDF: ${error.message}`);
    }
  }

  /**
   * Get all schedules for a report
   */
  async getSchedules(reportId: string, userId: string): Promise<any[]> {
    try {
      // Verify the report exists and user has access
      await this.savedReportService.getReportById(reportId, userId);
      
      return await prisma.reportSchedule.findMany({
        where: {
          reportId,
          createdBy: userId
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error) {
      logger.error(`Error getting schedules: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to get schedules');
    }
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(scheduleId: string, userId: string): Promise<void> {
    try {
      const schedule = await prisma.reportSchedule.findUnique({
        where: { id: scheduleId }
      });
      
      if (!schedule) {
        throw new Error('Schedule not found');
      }
      
      if (schedule.createdBy !== userId) {
        throw new Error('You do not have permission to delete this schedule');
      }
      
      await prisma.reportSchedule.delete({
        where: { id: scheduleId }
      });
    } catch (error) {
      logger.error(`Error deleting schedule: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to delete schedule');
    }
  }

  /**
   * Update a schedule's status (active/inactive)
   */
  async updateScheduleStatus(scheduleId: string, isActive: boolean, userId: string): Promise<any> {
    try {
      const schedule = await prisma.reportSchedule.findUnique({
        where: { id: scheduleId }
      });
      
      if (!schedule) {
        throw new Error('Schedule not found');
      }
      
      if (schedule.createdBy !== userId) {
        throw new Error('You do not have permission to update this schedule');
      }
      
      return await prisma.reportSchedule.update({
        where: { id: scheduleId },
        data: { isActive }
      });
    } catch (error) {
      logger.error(`Error updating schedule status: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to update schedule status');
    }
  }
} 