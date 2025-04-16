import express from 'express';
import { verifyAuthMiddleware } from '../middleware/authMiddleware';
import { prisma } from '../../prisma/client';
import { ReportService } from '../services/reportService';
import { exportToPdf, exportToCsv, exportToExcel } from '../utils/exportUtils';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validationMiddleware';
import { z } from 'zod';
import reportScheduleRoutes from './reportScheduleRoutes';

const router = express.Router();

// Mount report schedule routes
router.use('/schedules', reportScheduleRoutes);

// Schema for report data request
const reportDataSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  tabId: z.string().optional(),
  reportId: z.string().optional(),
});

// Schema for report export request
const reportExportSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  tabId: z.string().optional(),
  reportId: z.string().optional(),
  format: z.enum(['pdf', 'csv', 'xlsx']),
});

// Schema for saving a report
const saveReportSchema = z.object({
  name: z.string().min(1, 'Report name is required'),
  config: z.object({
    metrics: z.array(z.string()).min(1, 'At least one metric is required'),
    dimensions: z.array(z.string()),
    filters: z.record(z.any()),
    chartType: z.string(),
  }),
});

// Schema for scheduling a report
const scheduleReportSchema = z.object({
  reportId: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  recipients: z.string().min(1, 'At least one recipient is required'),
  format: z.enum(['pdf', 'csv', 'xlsx']),
});

// Get report data
router.get('/data', 
  verifyAuthMiddleware, 
  validateRequest({ query: reportDataSchema }), 
  async (req, res) => {
    try {
      const { startDate, endDate, tabId, reportId } = req.query as any;
      
      const reportService = new ReportService();
      let reportData;
      
      if (reportId) {
        // Load saved report
        reportData = await reportService.getCustomReportData(
          reportId, 
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        );
      } else if (tabId) {
        // Load built-in report
        switch (tabId) {
          case 'dashboard':
            reportData = await reportService.getDashboardData(
              startDate ? new Date(startDate) : undefined,
              endDate ? new Date(endDate) : undefined
            );
            break;
          case 'credits':
            reportData = await reportService.getCreditAnalyticsData(
              startDate ? new Date(startDate) : undefined,
              endDate ? new Date(endDate) : undefined
            );
            break;
          case 'customers':
            reportData = await reportService.getCustomerSegmentationData(
              startDate ? new Date(startDate) : undefined,
              endDate ? new Date(endDate) : undefined
            );
            break;
          case 'staff':
            reportData = await reportService.getStaffPerformanceData(
              startDate ? new Date(startDate) : undefined,
              endDate ? new Date(endDate) : undefined
            );
            break;
          default:
            throw new Error('Invalid report type');
        }
      } else {
        throw new Error('Either reportId or tabId is required');
      }
      
      res.json(reportData);
    } catch (error) {
      logger.error(`Error getting report data: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to load report data' });
    }
});

// Export report
router.get('/export', 
  verifyAuthMiddleware, 
  validateRequest({ query: reportExportSchema }), 
  async (req, res) => {
    try {
      const { startDate, endDate, tabId, reportId, format } = req.query as any;
      
      const reportService = new ReportService();
      let reportData;
      let reportTitle = 'Report';
      
      if (reportId) {
        // Load saved report
        const savedReport = await prisma.savedReport.findUnique({
          where: { id: reportId }
        });
        
        if (!savedReport) {
          throw new Error('Report not found');
        }
        
        reportTitle = savedReport.name;
        reportData = await reportService.getCustomReportData(
          reportId, 
          startDate ? new Date(startDate) : undefined,
          endDate ? new Date(endDate) : undefined
        );
      } else if (tabId) {
        // Load built-in report
        switch (tabId) {
          case 'dashboard':
            reportTitle = 'Dashboard Overview';
            reportData = await reportService.getDashboardData(
              startDate ? new Date(startDate) : undefined,
              endDate ? new Date(endDate) : undefined
            );
            break;
          case 'credits':
            reportTitle = 'Credit Analytics';
            reportData = await reportService.getCreditAnalyticsData(
              startDate ? new Date(startDate) : undefined,
              endDate ? new Date(endDate) : undefined
            );
            break;
          case 'customers':
            reportTitle = 'Customer Segmentation';
            reportData = await reportService.getCustomerSegmentationData(
              startDate ? new Date(startDate) : undefined,
              endDate ? new Date(endDate) : undefined
            );
            break;
          case 'staff':
            reportTitle = 'Staff Performance';
            reportData = await reportService.getStaffPerformanceData(
              startDate ? new Date(startDate) : undefined,
              endDate ? new Date(endDate) : undefined
            );
            break;
          default:
            throw new Error('Invalid report type');
        }
      } else {
        throw new Error('Either reportId or tabId is required');
      }
      
      // Process export based on format
      switch (format) {
        case 'pdf':
          const pdfBuffer = await exportToPdf(reportData, reportTitle);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename=${reportTitle.replace(/ /g, '_')}.pdf`);
          return res.send(pdfBuffer);
        
        case 'csv':
          const csvContent = await exportToCsv(reportData);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename=${reportTitle.replace(/ /g, '_')}.csv`);
          return res.send(csvContent);
        
        case 'xlsx':
          const excelBuffer = await exportToExcel(reportData, reportTitle);
          res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          res.setHeader('Content-Disposition', `attachment; filename=${reportTitle.replace(/ /g, '_')}.xlsx`);
          return res.send(excelBuffer);
        
        default:
          throw new Error('Unsupported export format');
      }
    } catch (error) {
      logger.error(`Error exporting report: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to export report' });
    }
});

// Get saved reports
router.get('/saved', 
  verifyAuthMiddleware, 
  async (req, res) => {
    try {
      const reports = await prisma.savedReport.findMany({
        orderBy: { createdAt: 'desc' }
      });
      
      res.json({ reports });
    } catch (error) {
      logger.error(`Error getting saved reports: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to load saved reports' });
    }
});

// Save custom report
router.post('/save', 
  verifyAuthMiddleware, 
  validateRequest({ body: saveReportSchema }), 
  async (req, res) => {
    try {
      const { name, config } = req.body;
      
      const report = await prisma.savedReport.create({
        data: {
          name,
          config: config,
          createdById: (req as any).user.id,
        }
      });
      
      res.json({ success: true, report });
    } catch (error) {
      logger.error(`Error saving report: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to save report' });
    }
});

// Schedule report
router.post('/schedule', 
  verifyAuthMiddleware, 
  validateRequest({ body: scheduleReportSchema }), 
  async (req, res) => {
    try {
      const { reportId, frequency, recipients, format } = req.body;
      
      // Validate report existence if reportId is provided
      if (reportId) {
        const report = await prisma.savedReport.findUnique({
          where: { id: reportId }
        });
        
        if (!report) {
          return res.status(404).json({ error: 'Report not found' });
        }
      }
      
      // Create the schedule
      const schedule = await prisma.reportSchedule.create({
        data: {
          reportId,
          frequency,
          recipients: recipients.split(',').map(email => email.trim()),
          format,
          nextRunDate: calculateNextRunDate(frequency),
          createdById: (req as any).user.id,
        }
      });
      
      res.json({ success: true, schedule });
    } catch (error) {
      logger.error(`Error scheduling report: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to schedule report' });
    }
});

// Delete saved report
router.delete('/saved/:id', 
  verifyAuthMiddleware, 
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if report exists
      const report = await prisma.savedReport.findUnique({
        where: { id }
      });
      
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      
      // Delete the report
      await prisma.savedReport.delete({
        where: { id }
      });
      
      // Delete associated schedules
      await prisma.reportSchedule.deleteMany({
        where: { reportId: id }
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error(`Error deleting report: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to delete report' });
    }
});

// Get scheduled reports
router.get('/schedules', 
  verifyAuthMiddleware, 
  async (req, res) => {
    try {
      const schedules = await prisma.reportSchedule.findMany({
        include: {
          report: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      
      res.json({ schedules });
    } catch (error) {
      logger.error(`Error getting report schedules: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to load report schedules' });
    }
});

// Delete schedule
router.delete('/schedules/:id', 
  verifyAuthMiddleware, 
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if schedule exists
      const schedule = await prisma.reportSchedule.findUnique({
        where: { id }
      });
      
      if (!schedule) {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      
      // Delete the schedule
      await prisma.reportSchedule.delete({
        where: { id }
      });
      
      res.json({ success: true });
    } catch (error) {
      logger.error(`Error deleting schedule: ${error instanceof Error ? error.message : String(error)}`);
      res.status(500).json({ error: 'Failed to delete schedule' });
    }
});

// Helper function to calculate next run date
function calculateNextRunDate(frequency: string): Date {
  const now = new Date();
  
  switch (frequency) {
    case 'daily':
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(8, 0, 0, 0); // 8 AM
      return tomorrow;
    
    case 'weekly':
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(8, 0, 0, 0); // 8 AM
      return nextWeek;
    
    case 'monthly':
      const nextMonth = new Date(now);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1); // First day of next month
      nextMonth.setHours(8, 0, 0, 0); // 8 AM
      return nextMonth;
    
    default:
      return new Date(now.setDate(now.getDate() + 1)); // Default to tomorrow
  }
}

export default router; 