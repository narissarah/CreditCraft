import express from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validateRequest';
import { logger } from '../../utils/logger';
import { transactionService } from '../../services/transactionService';
import { exportTransactions, getExportFileStream } from '../../utils/exportUtils';
import { TransactionType } from '@prisma/client';

const router = express.Router();

// Apply authentication middleware to all transaction routes
router.use(isAuthenticated);

// Schemas for request validation
const getTransactionSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

const listTransactionsSchema = z.object({
  query: z.object({
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
    type: z.enum(['ISSUE', 'REDEEM', 'ADJUST', 'CANCEL', 'EXPIRE']).optional(),
    customerId: z.string().optional(),
    creditId: z.string().optional(),
    staffId: z.string().optional(),
    locationId: z.string().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    orderId: z.string().optional(),
    sortBy: z.string().default('timestamp'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  }),
});

const getTransactionSummarySchema = z.object({
  query: z.object({
    groupBy: z.enum(['type', 'day', 'week', 'month', 'location', 'staff']).default('type'),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
  }),
});

const getAuditLogSchema = z.object({
  query: z.object({
    entityType: z.enum(['credit', 'customer']),
    entityId: z.string().uuid(),
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
  }),
});

const exportTransactionsSchema = z.object({
  query: z.object({
    format: z.enum(['csv', 'json']).default('csv'),
    type: z.enum(['ISSUE', 'REDEEM', 'ADJUST', 'CANCEL', 'EXPIRE']).optional(),
    customerId: z.string().optional(),
    creditId: z.string().optional(),
    staffId: z.string().optional(),
    locationId: z.string().optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    orderId: z.string().optional(),
  }),
});

// Get a transaction by ID
router.get(
  '/:id',
  validateRequest(getTransactionSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const transaction = await transactionService.getTransactionById(id);
      
      if (!transaction) {
        return res.status(404).json({ success: false, error: 'Transaction not found' });
      }
      
      // Ensure the transaction belongs to the authenticated shop
      if (transaction.shopId !== req.session.shop) {
        return res.status(403).json({ success: false, error: 'Access denied' });
      }
      
      res.json({ success: true, transaction });
    } catch (error) {
      logger.error(`API Error - Get Transaction ${req.params.id}:`, error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// List transactions with filtering and pagination
router.get(
  '/',
  validateRequest(listTransactionsSchema),
  async (req, res) => {
    try {
      const {
        page,
        limit,
        type,
        customerId,
        creditId,
        staffId,
        locationId,
        dateFrom,
        dateTo,
        orderId,
        sortBy,
        sortOrder,
      } = req.query;
      
      // Extract shop ID from authenticated session
      const shopId = req.session.shop;
      
      const result = await transactionService.listTransactions({
        shopId,
        customerId,
        creditId,
        type: type as TransactionType | undefined,
        staffId,
        locationId,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        orderId,
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
      logger.error('API Error - List Transactions:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// Get transaction summary for reporting
router.get(
  '/summary',
  validateRequest(getTransactionSummarySchema),
  async (req, res) => {
    try {
      const { groupBy, dateFrom, dateTo } = req.query;
      
      // Extract shop ID from authenticated session
      const shopId = req.session.shop;
      
      const result = await transactionService.getTransactionSummary({
        shopId,
        groupBy,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
      });
      
      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      logger.error('API Error - Transaction Summary:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// Get audit log for a specific entity
router.get(
  '/audit',
  validateRequest(getAuditLogSchema),
  async (req, res) => {
    try {
      const { entityType, entityId, page, limit } = req.query;
      
      // Extract shop ID from authenticated session
      const shopId = req.session.shop;
      
      const result = await transactionService.getAuditLog({
        shopId,
        entityType,
        entityId,
        page,
        limit,
      });
      
      res.json({
        success: true,
        ...result,
        entityType,
        entityId,
      });
    } catch (error) {
      logger.error('API Error - Audit Log:', error);
      
      // Handle specific error for invalid entity type
      if (error instanceof Error && error.message.includes('Invalid entity type')) {
        return res.status(400).json({
          success: false,
          error: error.message,
        });
      }
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

// Export transactions
router.get(
  '/export',
  validateRequest(exportTransactionsSchema),
  async (req, res) => {
    try {
      const {
        format,
        type,
        customerId,
        creditId,
        staffId,
        locationId,
        dateFrom,
        dateTo,
        orderId,
      } = req.query;
      
      // Extract shop ID from authenticated session
      const shopId = req.session.shop;
      
      // Get transactions with the specified filters, but without pagination limits
      const { transactions } = await transactionService.listTransactions({
        shopId,
        customerId,
        creditId,
        type: type as TransactionType | undefined,
        staffId,
        locationId,
        dateFrom: dateFrom ? new Date(dateFrom) : undefined,
        dateTo: dateTo ? new Date(dateTo) : undefined,
        orderId,
        // We're exporting all matching transactions, so use a large limit
        limit: 10000,
        page: 1,
        sortBy: 'timestamp',
        sortOrder: 'desc',
      });
      
      // Export the transactions
      const { filePath, count } = await exportTransactions({
        transactions,
        format: format as 'csv' | 'json',
      });
      
      // Set appropriate content type and headers
      const contentType = format === 'csv' ? 'text/csv' : 'application/json';
      const filename = `transactions-${new Date().toISOString().split('T')[0]}.${format}`;
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      // Stream the file to the response
      const fileStream = getExportFileStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      logger.error('API Error - Export Transactions:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
      });
    }
  }
);

export default router; 