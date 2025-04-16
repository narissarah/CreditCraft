import { Request, Response } from 'express';
import { prisma } from '../../prisma/client';
import { logger } from '../utils/logger';
import { cronParser } from '../utils/cronUtils';
import { parseISO } from 'date-fns';

/**
 * Get all report schedules
 */
export async function getReportSchedules(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    
    const schedules = await prisma.reportSchedule.findMany({
      where: {
        createdBy: userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return res.json({ schedules });
  } catch (error) {
    logger.error(`Error retrieving report schedules: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ error: 'Failed to retrieve report schedules' });
  }
}

/**
 * Get a report schedule by ID
 */
export async function getReportScheduleById(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    
    const schedule = await prisma.reportSchedule.findFirst({
      where: {
        id,
        createdBy: userId
      }
    });
    
    if (!schedule) {
      return res.status(404).json({ error: 'Report schedule not found' });
    }
    
    return res.json({ schedule });
  } catch (error) {
    logger.error(`Error retrieving report schedule: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ error: 'Failed to retrieve report schedule' });
  }
}

/**
 * Create a new report schedule
 */
export async function createReportSchedule(req: Request, res: Response) {
  try {
    const {
      name,
      description,
      reportType,
      parameters,
      cronExpression,
      timezone = 'UTC',
      format,
      recipients
    } = req.body;
    
    const userId = (req as any).user.id;
    
    // Validate cron expression
    if (!cronParser.isValidCronExpression(cronExpression)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }
    
    // Validate recipients
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required' });
    }
    
    // Create the schedule
    const schedule = await prisma.reportSchedule.create({
      data: {
        name,
        description,
        reportType,
        parameters,
        cronExpression,
        timezone,
        format,
        recipients,
        active: true,
        createdBy: userId
      }
    });
    
    logger.info(`Created report schedule with ID: ${schedule.id}`);
    return res.status(201).json({ schedule });
  } catch (error) {
    logger.error(`Error creating report schedule: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ error: 'Failed to create report schedule' });
  }
}

/**
 * Update a report schedule
 */
export async function updateReportSchedule(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    
    // Check if schedule exists and belongs to user
    const existingSchedule = await prisma.reportSchedule.findFirst({
      where: {
        id,
        createdBy: userId
      }
    });
    
    if (!existingSchedule) {
      return res.status(404).json({ error: 'Report schedule not found' });
    }
    
    const {
      name,
      description,
      reportType,
      parameters,
      cronExpression,
      timezone,
      format,
      recipients,
      active
    } = req.body;
    
    // Validate cron expression if provided
    if (cronExpression && !cronParser.isValidCronExpression(cronExpression)) {
      return res.status(400).json({ error: 'Invalid cron expression' });
    }
    
    // Update the schedule
    const schedule = await prisma.reportSchedule.update({
      where: { id },
      data: {
        name,
        description,
        reportType,
        parameters,
        cronExpression,
        timezone,
        format,
        recipients,
        active,
        updatedAt: new Date()
      }
    });
    
    logger.info(`Updated report schedule with ID: ${schedule.id}`);
    return res.json({ schedule });
  } catch (error) {
    logger.error(`Error updating report schedule: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ error: 'Failed to update report schedule' });
  }
}

/**
 * Delete a report schedule
 */
export async function deleteReportSchedule(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    
    // Check if schedule exists and belongs to user
    const existingSchedule = await prisma.reportSchedule.findFirst({
      where: {
        id,
        createdBy: userId
      }
    });
    
    if (!existingSchedule) {
      return res.status(404).json({ error: 'Report schedule not found' });
    }
    
    // Delete the schedule
    await prisma.reportSchedule.delete({
      where: { id }
    });
    
    logger.info(`Deleted report schedule with ID: ${id}`);
    return res.json({ success: true });
  } catch (error) {
    logger.error(`Error deleting report schedule: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ error: 'Failed to delete report schedule' });
  }
}

/**
 * Toggle a report schedule's active status
 */
export async function toggleReportScheduleStatus(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { active } = req.body;
    const userId = (req as any).user.id;
    
    // Check if schedule exists and belongs to user
    const existingSchedule = await prisma.reportSchedule.findFirst({
      where: {
        id,
        createdBy: userId
      }
    });
    
    if (!existingSchedule) {
      return res.status(404).json({ error: 'Report schedule not found' });
    }
    
    // Update active status
    const schedule = await prisma.reportSchedule.update({
      where: { id },
      data: {
        active: active === true || active === 'true',
        updatedAt: new Date()
      }
    });
    
    logger.info(`Updated active status for report schedule with ID: ${schedule.id} to ${schedule.active}`);
    return res.json({ schedule });
  } catch (error) {
    logger.error(`Error toggling report schedule status: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ error: 'Failed to update report schedule status' });
  }
}

/**
 * Run a report schedule immediately
 */
export async function runReportScheduleNow(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    
    // Check if schedule exists and belongs to user
    const existingSchedule = await prisma.reportSchedule.findFirst({
      where: {
        id,
        createdBy: userId
      }
    });
    
    if (!existingSchedule) {
      return res.status(404).json({ error: 'Report schedule not found' });
    }
    
    // Queue the report to run immediately
    // In a real implementation, this would call a job queue
    // For now, we'll just mark it as needing to run
    await prisma.reportSchedule.update({
      where: { id },
      data: {
        lastRunAt: new Date(0), // Setting to past date will make it eligible to run
        updatedAt: new Date()
      }
    });
    
    logger.info(`Queued report schedule with ID: ${id} to run immediately`);
    return res.json({ 
      success: true, 
      message: 'Report has been queued to run and will be processed shortly' 
    });
  } catch (error) {
    logger.error(`Error running report schedule: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ error: 'Failed to run report schedule' });
  }
}

/**
 * Get report schedule history (runs and statuses)
 */
export async function getReportScheduleHistory(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    
    // Check if schedule exists and belongs to user
    const existingSchedule = await prisma.reportSchedule.findFirst({
      where: {
        id,
        createdBy: userId
      }
    });
    
    if (!existingSchedule) {
      return res.status(404).json({ error: 'Report schedule not found' });
    }
    
    // For a full implementation, you would have a separate table for run history
    // For this example, we'll just return the basic information
    const history = {
      lastRunAt: existingSchedule.lastRunAt,
      lastRunStatus: existingSchedule.lastRunStatus,
      errorDetails: existingSchedule.errorDetails
    };
    
    return res.json({ history });
  } catch (error) {
    logger.error(`Error retrieving report schedule history: ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ error: 'Failed to retrieve report schedule history' });
  }
} 