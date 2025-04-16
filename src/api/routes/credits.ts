import express from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../../middleware/auth';
import { creditService, validateCreditCode } from '../../services/creditService';
import { validateRequest } from '../../middleware/validateRequest';
import { logger } from '../../utils/logger';
import { isAdmin } from '../../middleware/admin';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Apply authentication middleware to all credit routes
router.use(isAuthenticated);

// Schemas for request validation
const createCreditSchema = z.object({
  body: z.object({
    amount: z.number().positive().min(0.01),
    customerId: z.string().optional(),
    currency: z.string().min(3).max(3).default('USD'),
    expirationDate: z.string().datetime().optional().nullable(),
    note: z.string().max(500).optional(),
  }),
});

const updateCreditSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'REDEEMED', 'CANCELLED', 'EXPIRED']).optional(),
    expirationDate: z.string().datetime().optional().nullable(),
    customerId: z.string().optional().nullable(),
    note: z.string().max(500).optional(),
  }),
});

const getCreditSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

const getCreditByCodeSchema = z.object({
  params: z.object({
    code: z.string().refine(validateCreditCode, {
      message: 'Invalid credit code format',
    }),
  }),
});

const listCreditsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
    status: z.enum(['ACTIVE', 'REDEEMED', 'CANCELLED', 'EXPIRED']).optional(),
    customerId: z.string().optional(),
    sortBy: z.string().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

const applyCreditSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    amount: z.number().positive().min(0.01),
    orderId: z.string().optional(),
    staffId: z.string().optional(),
    locationId: z.string().optional(),
  }),
});

const cancelCreditSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    reason: z.string().min(3).max(500),
    staffId: z.string().optional(),
  }),
});

const adjustCreditSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    adjustmentAmount: z.number().min(-1000000).max(1000000),
    reason: z.string().min(3).max(500),
    staffId: z.string().optional(),
  }),
});

const getExpiringCreditsSchema = z.object({
  query: z.object({
    days: z.string().transform(Number).default('30'),
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
  }),
});

const extendExpirationSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    newExpirationDate: z.string().datetime(),
    reason: z.string().min(3).max(500),
    staffId: z.string().optional(),
  }),
});

// Create a new credit
router.post(
  '/',
  validateRequest(createCreditSchema),
  async (req, res) => {
    try {
      const { amount, customerId, currency, expirationDate, note } = req.body;
      
      // Extract shop ID from authenticated session
      const shopId = req.session.shop;
      
      const credit = await creditService.createCredit({
        amount,
        customerId,
        currency,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        shopId,
        staffId: req.body.staffId,
        note,
      });
      
      res.status(201).json({ success: true, credit });
    } catch (error) {
      logger.error('API Error - Create Credit:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// List credits with pagination
router.get(
  '/',
  validateRequest(listCreditsSchema),
  async (req, res) => {
    try {
      const { page, limit, status, customerId, sortBy, sortOrder } = req.query;
      
      // Extract shop ID from authenticated session
      const shopId = req.session.shop;
      
      const result = await creditService.listCredits({
        shopId,
        customerId,
        status,
        page,
        limit,
        sortBy,
        sortOrder,
      });
      
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error('API Error - List Credits:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// Get a credit by ID
router.get(
  '/:id',
  validateRequest(getCreditSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const credit = await creditService.getCreditById(id);
      
      if (!credit) {
        return res.status(404).json({ success: false, error: 'Credit not found' });
      }
      
      // Ensure the credit belongs to the authenticated shop
      if (credit.shopId !== req.session.shop) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      res.json({ success: true, credit });
    } catch (error) {
      logger.error(`API Error - Get Credit ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// Get a credit by code
router.get(
  '/code/:code',
  validateRequest(getCreditByCodeSchema),
  async (req, res) => {
    try {
      const { code } = req.params;
      const credit = await creditService.getCreditByCode(code);
      
      if (!credit) {
        return res.status(404).json({ success: false, error: 'Credit not found' });
      }
      
      // Ensure the credit belongs to the authenticated shop
      if (credit.shopId !== req.session.shop) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      res.json({ success: true, credit });
    } catch (error) {
      logger.error(`API Error - Get Credit by Code ${req.params.code}:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// Update a credit
router.patch(
  '/:id',
  validateRequest(updateCreditSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, expirationDate, customerId, note } = req.body;
      
      // First check if the credit exists and belongs to the authenticated shop
      const existingCredit = await creditService.getCreditById(id);
      
      if (!existingCredit) {
        return res.status(404).json({ success: false, error: 'Credit not found' });
      }
      
      if (existingCredit.shopId !== req.session.shop) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      const credit = await creditService.updateCredit(id, {
        status,
        expirationDate: expirationDate ? new Date(expirationDate) : undefined,
        customerId,
        note,
      });
      
      res.json({ success: true, credit });
    } catch (error) {
      logger.error(`API Error - Update Credit ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// Apply (redeem) a credit
router.post(
  '/:id/apply',
  validateRequest(applyCreditSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { amount, orderId, staffId, locationId } = req.body;
      
      // First check if the credit exists and belongs to the authenticated shop
      const existingCredit = await creditService.getCreditById(id);
      
      if (!existingCredit) {
        return res.status(404).json({ success: false, error: 'Credit not found' });
      }
      
      if (existingCredit.shopId !== req.session.shop) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      const credit = await creditService.applyCredit({
        id,
        amount,
        orderId,
        staffId,
        locationId,
      });
      
      res.json({ success: true, credit });
    } catch (error) {
      logger.error(`API Error - Apply Credit ${req.params.id}:`, error);
      
      // Map specific error messages to appropriate status codes
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          return res.status(400).json({ success: false, error: error.message });
        }
        if (error.message.includes('Insufficient balance')) {
          return res.status(400).json({ success: false, error: error.message });
        }
        if (error.message.includes('cannot be applied')) {
          return res.status(400).json({ success: false, error: error.message });
        }
      }
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// Cancel a credit
router.post(
  '/:id/cancel',
  validateRequest(cancelCreditSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { reason, staffId } = req.body;
      
      // First check if the credit exists and belongs to the authenticated shop
      const existingCredit = await creditService.getCreditById(id);
      
      if (!existingCredit) {
        return res.status(404).json({ success: false, error: 'Credit not found' });
      }
      
      if (existingCredit.shopId !== req.session.shop) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      const credit = await creditService.cancelCredit({
        id,
        reason,
        staffId,
      });
      
      res.json({ success: true, credit });
    } catch (error) {
      logger.error(`API Error - Cancel Credit ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// Adjust credit amount
router.post(
  '/:id/adjust',
  validateRequest(adjustCreditSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { adjustmentAmount, reason, staffId } = req.body;
      
      // First check if the credit exists and belongs to the authenticated shop
      const existingCredit = await creditService.getCreditById(id);
      
      if (!existingCredit) {
        return res.status(404).json({ success: false, error: 'Credit not found' });
      }
      
      if (existingCredit.shopId !== req.session.shop) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      const credit = await creditService.adjustCreditAmount({
        id,
        adjustmentAmount,
        reason,
        staffId,
      });
      
      res.json({ success: true, credit });
    } catch (error) {
      logger.error(`API Error - Adjust Credit ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// Process expired credits (Admin only)
router.post(
  '/process-expired',
  isAdmin,
  async (req, res) => {
    try {
      const count = await creditService.processExpiredCredits();
      res.json({ success: true, count });
    } catch (error) {
      logger.error('API Error - Process Expired Credits:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// Get credits that will expire soon
router.get(
  '/expiring',
  validateRequest(getExpiringCreditsSchema),
  async (req, res) => {
    try {
      const { days, page, limit } = req.query;
      
      // Extract shop ID from authenticated session
      const shopId = req.session.shop;
      
      const result = await creditService.getExpiringCredits({
        shopId,
        days,
        page,
        limit,
      });
      
      res.json({
        success: true,
        ...result,
        expiringWithinDays: days,
      });
    } catch (error) {
      logger.error('API Error - Get Expiring Credits:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// Extend credit expiration date
router.post(
  '/:id/extend-expiration',
  validateRequest(extendExpirationSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { newExpirationDate, reason, staffId } = req.body;
      
      // First check if the credit exists and belongs to the authenticated shop
      const existingCredit = await creditService.getCreditById(id);
      
      if (!existingCredit) {
        return res.status(404).json({ success: false, error: 'Credit not found' });
      }
      
      if (existingCredit.shopId !== req.session.shop) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      const credit = await creditService.extendExpirationDate({
        id,
        newExpirationDate: new Date(newExpirationDate),
        reason,
        staffId,
      });
      
      res.json({ success: true, credit });
    } catch (error) {
      logger.error(`API Error - Extend Credit Expiration ${req.params.id}:`, error);
      
      // Map specific error messages to appropriate status codes
      if (error instanceof Error) {
        if (error.message.includes('must be in the future')) {
          return res.status(400).json({ success: false, error: error.message });
        }
        if (error.message.includes('Cannot extend expiration')) {
          return res.status(400).json({ success: false, error: error.message });
        }
      }
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

export default router; 