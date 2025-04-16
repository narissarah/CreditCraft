import { prisma } from '../../prisma/client';
import { logger } from '../utils/logger';
import { ReportService } from './reportService';

interface SaveReportParams {
  name: string;
  description?: string;
  type: 'dashboard' | 'credit' | 'customer' | 'staff' | 'custom';
  config: {
    metrics: string[];
    dimensions: string[];
    filters: Record<string, any>;
    dateRange: {
      start: Date;
      end?: Date;
      period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
    };
    visualization?: 'bar' | 'line' | 'pie' | 'table';
  };
  isPublic?: boolean;
}

export class SavedReportService {
  private reportService: ReportService;

  constructor() {
    this.reportService = new ReportService();
  }

  /**
   * Save a new report configuration
   */
  async saveReport(params: SaveReportParams, userId: string): Promise<any> {
    try {
      const savedReport = await prisma.savedReport.create({
        data: {
          name: params.name,
          description: params.description || '',
          type: params.type,
          config: params.config as any,
          createdBy: userId,
          isPublic: params.isPublic || false
        }
      });

      logger.info(`Report saved with ID: ${savedReport.id}`);
      return savedReport;
    } catch (error) {
      logger.error(`Error saving report: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to save report');
    }
  }

  /**
   * Get all saved reports for a user
   */
  async getUserReports(userId: string, filters?: { type?: string; search?: string }): Promise<any[]> {
    try {
      // Build filter conditions
      const where: any = {
        OR: [
          { createdBy: userId },
          { isPublic: true }
        ]
      };

      // Add type filter if provided
      if (filters?.type) {
        where.type = filters.type;
      }

      // Add search filter if provided
      if (filters?.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } }
        ];
      }

      const reports = await prisma.savedReport.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          schedules: {
            select: {
              id: true,
              frequency: true,
              isActive: true
            }
          }
        }
      });

      return reports;
    } catch (error) {
      logger.error(`Error getting user reports: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to retrieve reports');
    }
  }

  /**
   * Get a single report by ID
   */
  async getReportById(reportId: string, userId: string): Promise<any> {
    try {
      const report = await prisma.savedReport.findFirst({
        where: {
          id: reportId,
          OR: [
            { createdBy: userId },
            { isPublic: true }
          ]
        },
        include: {
          schedules: true
        }
      });

      if (!report) {
        throw new Error('Report not found or access denied');
      }

      return report;
    } catch (error) {
      logger.error(`Error getting report by ID: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to retrieve report');
    }
  }

  /**
   * Update an existing report
   */
  async updateReport(reportId: string, params: Partial<SaveReportParams>, userId: string): Promise<any> {
    try {
      // First check if the user has permission to update this report
      const existingReport = await prisma.savedReport.findFirst({
        where: {
          id: reportId,
          createdBy: userId
        }
      });

      if (!existingReport) {
        throw new Error('Report not found or you do not have permission to update it');
      }

      // Update the report
      const updateData: any = {};
      if (params.name) updateData.name = params.name;
      if (params.description !== undefined) updateData.description = params.description;
      if (params.type) updateData.type = params.type;
      if (params.config) updateData.config = params.config;
      if (params.isPublic !== undefined) updateData.isPublic = params.isPublic;

      const updatedReport = await prisma.savedReport.update({
        where: { id: reportId },
        data: updateData
      });

      return updatedReport;
    } catch (error) {
      logger.error(`Error updating report: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to update report');
    }
  }

  /**
   * Delete a report
   */
  async deleteReport(reportId: string, userId: string): Promise<void> {
    try {
      // Check if the user has permission to delete this report
      const existingReport = await prisma.savedReport.findFirst({
        where: {
          id: reportId,
          createdBy: userId
        }
      });

      if (!existingReport) {
        throw new Error('Report not found or you do not have permission to delete it');
      }

      // Delete any associated schedules first
      await prisma.reportSchedule.deleteMany({
        where: { reportId }
      });

      // Delete the report
      await prisma.savedReport.delete({
        where: { id: reportId }
      });
    } catch (error) {
      logger.error(`Error deleting report: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to delete report');
    }
  }

  /**
   * Generate report data from a saved report
   */
  async generateReportData(reportId: string, userId: string): Promise<any> {
    try {
      // Get the report configuration
      const report = await this.getReportById(reportId, userId);
      
      // Generate the report data
      return await this.reportService.getCustomReportData(report);
    } catch (error) {
      logger.error(`Error generating report data: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to generate report data');
    }
  }

  /**
   * Clone an existing report
   */
  async cloneReport(reportId: string, userId: string, newName?: string): Promise<any> {
    try {
      // Get the source report
      const sourceReport = await this.getReportById(reportId, userId);
      
      // Create a new report based on the source
      const clonedReport = await prisma.savedReport.create({
        data: {
          name: newName || `Copy of ${sourceReport.name}`,
          description: sourceReport.description,
          type: sourceReport.type,
          config: sourceReport.config,
          createdBy: userId,
          isPublic: false // Default cloned reports to private
        }
      });
      
      return clonedReport;
    } catch (error) {
      logger.error(`Error cloning report: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error('Failed to clone report');
    }
  }
} 