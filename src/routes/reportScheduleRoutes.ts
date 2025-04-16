import express from 'express';
import { verifyAuthMiddleware } from '../middleware/authMiddleware';
import { validateRequest } from '../middleware/validationMiddleware';
import { z } from 'zod';
import {
  getReportSchedules,
  getReportScheduleById,
  createReportSchedule,
  updateReportSchedule,
  deleteReportSchedule,
  toggleReportScheduleStatus,
  runReportScheduleNow,
  getReportScheduleHistory
} from '../controllers/reportScheduleController';

const router = express.Router();

// Schema for creating/updating a report schedule
const reportScheduleSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  reportType: z.string().min(1, 'Report type is required'),
  parameters: z.record(z.any()),
  cronExpression: z.string().min(1, 'Cron expression is required'),
  timezone: z.string().optional(),
  format: z.enum(['PDF', 'CSV', 'EXCEL', 'HTML']),
  recipients: z.array(z.string().email('Invalid email')).min(1, 'At least one recipient email is required')
});

// Schema for updating status
const toggleStatusSchema = z.object({
  active: z.union([z.boolean(), z.enum(['true', 'false'])])
});

// Get all report schedules
router.get(
  '/',
  verifyAuthMiddleware,
  getReportSchedules
);

// Get a specific report schedule
router.get(
  '/:id',
  verifyAuthMiddleware,
  getReportScheduleById
);

// Create a new report schedule
router.post(
  '/',
  verifyAuthMiddleware,
  validateRequest({ body: reportScheduleSchema }),
  createReportSchedule
);

// Update an existing report schedule
router.put(
  '/:id',
  verifyAuthMiddleware,
  validateRequest({ body: reportScheduleSchema.partial() }),
  updateReportSchedule
);

// Delete a report schedule
router.delete(
  '/:id',
  verifyAuthMiddleware,
  deleteReportSchedule
);

// Toggle a report schedule's active status
router.patch(
  '/:id/status',
  verifyAuthMiddleware,
  validateRequest({ body: toggleStatusSchema }),
  toggleReportScheduleStatus
);

// Run a report schedule immediately
router.post(
  '/:id/run',
  verifyAuthMiddleware,
  runReportScheduleNow
);

// Get report schedule's run history
router.get(
  '/:id/history',
  verifyAuthMiddleware,
  getReportScheduleHistory
);

export default router; 