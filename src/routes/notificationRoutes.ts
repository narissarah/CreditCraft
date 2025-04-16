import express, { Request, Response } from 'express';
import { prisma } from '../../prisma/client';
import { logger } from '../utils/logger';
import { customerService } from '../services/customerService';
import { authenticateShopify } from '../middleware/shopifyAuth';
import { rateLimiter } from '../middleware/rateLimiter';
import NotificationTriggerService from '../services/emailService/notificationTriggers';
import { 
  scheduleEmailNotificationJob,
  EmailNotificationJobType 
} from '../jobs/emailNotificationJob';
import { z } from 'zod';

const router = express.Router();

// Schema for updating notification preferences
const updatePreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  creditIssued: z.boolean().optional(),
  creditExpiring: z.boolean().optional(),
  creditRedeemed: z.boolean().optional(),
  balanceUpdates: z.boolean().optional(),
  promotions: z.boolean().optional(),
});

// Get notification preferences for a customer
router.get(
  '/customer/:customerId/preferences',
  authenticateShopify,
  rateLimiter({ max: 20, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const shop = req.shopify?.shop;
      
      if (!shop) {
        return res.status(401).json({ error: 'Shop not authenticated' });
      }
      
      // Verify customer belongs to shop
      const customer = await customerService.getCustomer(customerId);
      if (!customer || customer.shopDomain !== shop) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Get preferences (creates default if not exists)
      const preferences = await prisma.notificationPreference.findUnique({
        where: { customerId }
      }) || await prisma.notificationPreference.create({
        data: { customerId }
      });
      
      return res.json(preferences);
    } catch (error) {
      logger.error('Error getting notification preferences:', error);
      return res.status(500).json({ error: 'Failed to get notification preferences' });
    }
  }
);

// Update notification preferences for a customer
router.put(
  '/customer/:customerId/preferences',
  authenticateShopify,
  rateLimiter({ max: 10, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    try {
      const { customerId } = req.params;
      const shop = req.shopify?.shop;
      
      if (!shop) {
        return res.status(401).json({ error: 'Shop not authenticated' });
      }
      
      // Validate input
      const validationResult = updatePreferencesSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ error: 'Invalid preferences data', details: validationResult.error.errors });
      }
      
      // Verify customer belongs to shop
      const customer = await customerService.getCustomer(customerId);
      if (!customer || customer.shopDomain !== shop) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Update preferences (upsert)
      const preferences = await prisma.notificationPreference.upsert({
        where: { customerId },
        update: validationResult.data,
        create: {
          customerId,
          ...validationResult.data
        }
      });
      
      return res.json(preferences);
    } catch (error) {
      logger.error('Error updating notification preferences:', error);
      return res.status(500).json({ error: 'Failed to update notification preferences' });
    }
  }
);

// Test notification endpoint
router.post(
  '/test',
  authenticateShopify,
  rateLimiter({ max: 5, windowMs: 60000 }),
  async (req: Request, res: Response) => {
    try {
      const { 
        customerId, 
        notificationType, 
        subject, 
        message, 
        creditId,
        transactionId,
        daysUntilExpiration = 7 
      } = req.body;
      
      if (!customerId) {
        return res.status(400).json({ error: 'Customer ID is required' });
      }
      
      if (!notificationType) {
        return res.status(400).json({ error: 'Notification type is required' });
      }
      
      // Verify customer belongs to shop
      const customer = await customerService.getCustomer(customerId);
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      
      // Schedule the appropriate notification job
      let jobId: string;
      
      switch (notificationType) {
        case 'credit-issued':
          if (!creditId) {
            return res.status(400).json({ error: 'Credit ID is required for credit issued notifications' });
          }
          jobId = await scheduleEmailNotificationJob({
            type: EmailNotificationJobType.CREDIT_ISSUED,
            customerId,
            creditId
          });
          break;
          
        case 'credit-expiring':
          if (!creditId) {
            return res.status(400).json({ error: 'Credit ID is required for credit expiring notifications' });
          }
          jobId = await scheduleEmailNotificationJob({
            type: EmailNotificationJobType.CREDIT_EXPIRING,
            customerId,
            creditId,
            daysUntilExpiration: parseInt(daysUntilExpiration.toString())
          });
          break;
          
        case 'credit-redeemed':
          if (!creditId || !transactionId) {
            return res.status(400).json({ 
              error: 'Credit ID and Transaction ID are required for credit redeemed notifications' 
            });
          }
          jobId = await scheduleEmailNotificationJob({
            type: EmailNotificationJobType.CREDIT_REDEEMED,
            customerId,
            creditId,
            transactionId
          });
          break;
          
        case 'custom':
          if (!subject || !message) {
            return res.status(400).json({ error: 'Subject and message are required for custom notifications' });
          }
          jobId = await scheduleEmailNotificationJob({
            type: EmailNotificationJobType.CUSTOM,
            customerId,
            subject,
            message
          });
          break;
          
        default:
          return res.status(400).json({ error: `Unknown notification type: ${notificationType}` });
      }
      
      logger.info(`Test email notification scheduled for ${notificationType}`, { jobId, customerId });
      
      return res.json({ 
        message: 'Test notification scheduled', 
        jobId,
        type: notificationType
      });
    } catch (error) {
      logger.error('Error scheduling test notification:', error);
      return res.status(500).json({ error: 'Failed to schedule test notification' });
    }
  }
);

// Trigger batch notification job
router.post(
  '/batch',
  authenticateShopify,
  rateLimiter({ max: 5, windowMs: 300000 }), // 5 minutes
  async (req: Request, res: Response) => {
    try {
      const { type, data } = req.body;
      const shop = req.shopify?.shop;
      
      if (!shop) {
        return res.status(401).json({ error: 'Shop not authenticated' });
      }
      
      if (!type || !data) {
        return res.status(400).json({ error: 'Notification type and data are required' });
      }
      
      let job;
      
      switch (type) {
        case 'expiration-reminder': {
          const { days } = data;
          
          if (!days || !Number.isInteger(days) || days < 1) {
            return res.status(400).json({ error: 'Valid days parameter is required' });
          }
          
          job = await scheduleEmailNotificationJob({
            type: EmailNotificationJobType.EXPIRATION_REMINDER,
            data: { days }
          });
          break;
        }
        
        default:
          return res.status(400).json({ error: 'Invalid notification type' });
      }
      
      return res.json({ 
        success: true, 
        jobId: job.id,
        message: `Batch notification job for ${type} scheduled successfully`
      });
    } catch (error) {
      logger.error('Error scheduling batch notification:', error);
      return res.status(500).json({ error: 'Failed to schedule batch notification' });
    }
  }
);

export default router; 