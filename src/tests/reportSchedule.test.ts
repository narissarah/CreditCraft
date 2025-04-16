import request from 'supertest';
import app from '../../server';
import { prisma } from '../../prisma/client';
import { cronParser } from '../utils/cronUtils';
import { format, addDays } from 'date-fns';

// Mock authentication middleware
jest.mock('../middleware/authMiddleware', () => ({
  verifyAuthMiddleware: (req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  },
}));

// Mock email service
jest.mock('../services/emailService', () => ({
  __esModule: true,
  default: {
    sendCustomNotification: jest.fn().mockResolvedValue(true),
  },
}));

describe('Report Schedule API', () => {
  // Test data
  const testSchedule = {
    name: 'Test Daily Report',
    description: 'A test report that runs daily',
    reportType: 'CREDIT_SUMMARY',
    parameters: { startDate: '2023-01-01', endDate: '2023-12-31' },
    cronExpression: '0 8 * * *', // Every day at 8 AM
    format: 'PDF',
    recipients: ['test@example.com']
  };

  // Clean up after tests
  afterAll(async () => {
    await prisma.reportSchedule.deleteMany({
      where: { name: { contains: 'Test' } }
    });
  });

  describe('POST /api/reports/schedules', () => {
    it('should create a new report schedule', async () => {
      const response = await request(app)
        .post('/api/reports/schedules')
        .send(testSchedule)
        .expect(201);

      expect(response.body.schedule).toBeDefined();
      expect(response.body.schedule.name).toBe(testSchedule.name);
      expect(response.body.schedule.cronExpression).toBe(testSchedule.cronExpression);
      expect(response.body.schedule.active).toBe(true);
    });

    it('should reject invalid cron expressions', async () => {
      const invalidSchedule = {
        ...testSchedule,
        name: 'Invalid Cron Test',
        cronExpression: 'invalid-cron'
      };

      const response = await request(app)
        .post('/api/reports/schedules')
        .send(invalidSchedule)
        .expect(400);

      expect(response.body.error).toContain('Invalid cron expression');
    });

    it('should require at least one recipient', async () => {
      const invalidSchedule = {
        ...testSchedule,
        name: 'Missing Recipients Test',
        recipients: []
      };

      const response = await request(app)
        .post('/api/reports/schedules')
        .send(invalidSchedule)
        .expect(400);

      expect(response.body.error).toContain('recipient');
    });
  });

  describe('GET /api/reports/schedules', () => {
    it('should return a list of report schedules', async () => {
      // Create a test schedule first
      await prisma.reportSchedule.create({
        data: {
          name: 'Test Schedule For Listing',
          reportType: 'DASHBOARD_OVERVIEW',
          parameters: {},
          cronExpression: '0 9 * * *',
          format: 'PDF',
          recipients: ['test@example.com'],
          active: true,
          createdBy: 'test-user-id'
        }
      });

      const response = await request(app)
        .get('/api/reports/schedules')
        .expect(200);

      expect(Array.isArray(response.body.schedules)).toBe(true);
      expect(response.body.schedules.length).toBeGreaterThan(0);
      expect(response.body.schedules.some(s => s.name === 'Test Schedule For Listing')).toBe(true);
    });
  });

  describe('GET /api/reports/schedules/:id', () => {
    let testScheduleId;

    beforeAll(async () => {
      // Create a test schedule
      const schedule = await prisma.reportSchedule.create({
        data: {
          name: 'Test Schedule For Retrieval',
          reportType: 'STAFF_PERFORMANCE',
          parameters: {},
          cronExpression: '0 10 * * *',
          format: 'CSV',
          recipients: ['test@example.com'],
          active: true,
          createdBy: 'test-user-id'
        }
      });
      testScheduleId = schedule.id;
    });

    it('should return a specific report schedule', async () => {
      const response = await request(app)
        .get(`/api/reports/schedules/${testScheduleId}`)
        .expect(200);

      expect(response.body.schedule).toBeDefined();
      expect(response.body.schedule.id).toBe(testScheduleId);
      expect(response.body.schedule.name).toBe('Test Schedule For Retrieval');
    });

    it('should return 404 for non-existent schedule', async () => {
      const response = await request(app)
        .get('/api/reports/schedules/non-existent-id')
        .expect(404);

      expect(response.body.error).toContain('not found');
    });
  });

  describe('PUT /api/reports/schedules/:id', () => {
    let testScheduleId;

    beforeAll(async () => {
      // Create a test schedule
      const schedule = await prisma.reportSchedule.create({
        data: {
          name: 'Test Schedule For Update',
          reportType: 'CUSTOMER_SEGMENTATION',
          parameters: {},
          cronExpression: '0 11 * * *',
          format: 'EXCEL',
          recipients: ['test@example.com'],
          active: true,
          createdBy: 'test-user-id'
        }
      });
      testScheduleId = schedule.id;
    });

    it('should update a report schedule', async () => {
      const updatedData = {
        name: 'Updated Test Schedule',
        description: 'This schedule has been updated',
        cronExpression: '0 12 * * *'
      };

      const response = await request(app)
        .put(`/api/reports/schedules/${testScheduleId}`)
        .send(updatedData)
        .expect(200);

      expect(response.body.schedule).toBeDefined();
      expect(response.body.schedule.name).toBe(updatedData.name);
      expect(response.body.schedule.description).toBe(updatedData.description);
      expect(response.body.schedule.cronExpression).toBe(updatedData.cronExpression);
    });
  });

  describe('PATCH /api/reports/schedules/:id/status', () => {
    let testScheduleId;

    beforeAll(async () => {
      // Create a test schedule
      const schedule = await prisma.reportSchedule.create({
        data: {
          name: 'Test Schedule For Status Toggle',
          reportType: 'DASHBOARD_OVERVIEW',
          parameters: {},
          cronExpression: '0 13 * * *',
          format: 'PDF',
          recipients: ['test@example.com'],
          active: true,
          createdBy: 'test-user-id'
        }
      });
      testScheduleId = schedule.id;
    });

    it('should toggle a schedule status to inactive', async () => {
      const response = await request(app)
        .patch(`/api/reports/schedules/${testScheduleId}/status`)
        .send({ active: false })
        .expect(200);

      expect(response.body.schedule).toBeDefined();
      expect(response.body.schedule.active).toBe(false);
    });

    it('should toggle a schedule status back to active', async () => {
      const response = await request(app)
        .patch(`/api/reports/schedules/${testScheduleId}/status`)
        .send({ active: true })
        .expect(200);

      expect(response.body.schedule).toBeDefined();
      expect(response.body.schedule.active).toBe(true);
    });
  });

  describe('POST /api/reports/schedules/:id/run', () => {
    let testScheduleId;

    beforeAll(async () => {
      // Create a test schedule
      const schedule = await prisma.reportSchedule.create({
        data: {
          name: 'Test Schedule For Immediate Run',
          reportType: 'CREDIT_SUMMARY',
          parameters: {},
          cronExpression: '0 14 * * *',
          format: 'PDF',
          recipients: ['test@example.com'],
          active: true,
          createdBy: 'test-user-id'
        }
      });
      testScheduleId = schedule.id;
    });

    it('should queue a report to run immediately', async () => {
      const response = await request(app)
        .post(`/api/reports/schedules/${testScheduleId}/run`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('queued to run');

      // Verify the schedule was updated with past lastRunAt
      const updatedSchedule = await prisma.reportSchedule.findUnique({
        where: { id: testScheduleId }
      });
      
      // The lastRunAt should be set to the epoch (a past date)
      expect(updatedSchedule.lastRunAt.getTime()).toBeLessThan(new Date(2000, 0, 1).getTime());
    });
  });

  describe('DELETE /api/reports/schedules/:id', () => {
    let testScheduleId;

    beforeAll(async () => {
      // Create a test schedule
      const schedule = await prisma.reportSchedule.create({
        data: {
          name: 'Test Schedule For Deletion',
          reportType: 'DASHBOARD_OVERVIEW',
          parameters: {},
          cronExpression: '0 15 * * *',
          format: 'PDF',
          recipients: ['test@example.com'],
          active: true,
          createdBy: 'test-user-id'
        }
      });
      testScheduleId = schedule.id;
    });

    it('should delete a report schedule', async () => {
      const response = await request(app)
        .delete(`/api/reports/schedules/${testScheduleId}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify it's actually deleted
      const deletedSchedule = await prisma.reportSchedule.findUnique({
        where: { id: testScheduleId }
      });
      expect(deletedSchedule).toBeNull();
    });
  });

  // Test the cron utils separately
  describe('Cron Utilities', () => {
    it('should validate cron expressions correctly', () => {
      expect(cronParser.isValidCronExpression('0 8 * * *')).toBe(true);
      expect(cronParser.isValidCronExpression('*/15 * * * *')).toBe(true);
      expect(cronParser.isValidCronExpression('invalid')).toBe(false);
      expect(cronParser.isValidCronExpression('* * * *')).toBe(false); // Missing field
    });

    it('should generate readable descriptions for cron expressions', () => {
      const dailyDesc = cronParser.getHumanReadableDescription('0 8 * * *');
      expect(dailyDesc).toContain('8');
      expect(dailyDesc).toContain('minute 0');

      const weeklyDesc = cronParser.getHumanReadableDescription('0 9 * * 1');
      expect(weeklyDesc).toContain('Monday');
    });

    it('should create cron expressions from frequencies', () => {
      const dailyCron = cronParser.createCronFromFrequency('daily', { hour: 8, minute: 30 });
      expect(dailyCron).toBe('30 8 * * *');

      const weeklyCron = cronParser.createCronFromFrequency('weekly', { hour: 9, minute: 0, dayOfWeek: 1 });
      expect(weeklyCron).toBe('0 9 * * 1');

      const monthlyCron = cronParser.createCronFromFrequency('monthly', { hour: 10, minute: 15, dayOfMonth: 15 });
      expect(monthlyCron).toBe('15 10 15 * *');
    });
  });
}); 