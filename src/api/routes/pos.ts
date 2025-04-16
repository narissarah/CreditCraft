import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validateRequest';
import { isShopifyAuthenticated } from '../middleware/auth';
import { createLogger } from '../../utils/logger';
import { prisma } from '../../db/prisma';
import { createCredit, adjustCreditAmount } from '../../services/creditService';
import { createTransaction } from '../../services/transactionService';

const router = Router();
const logger = createLogger('pos-api');

// Schema for validating credit issuance requests
const issueCreditSchema = z.object({
  customerId: z.string().min(1, 'Customer ID is required'),
  amount: z.number().positive('Amount must be positive'),
  reason: z.string().optional(),
  note: z.string().optional(),
  locationId: z.string().optional(),
  orderId: z.string().optional(),
  source: z.string().default('pos'),
  attributionId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Schema for validating receipt metadata updates
const receiptMetadataSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
  creditIds: z.array(z.string()).optional(),
  amount: z.number().optional(),
  customerId: z.string().optional(),
  locationId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Schema for validating offline transaction sync
const offlineTransactionSchema = z.object({
  transactions: z.array(
    z.object({
      type: z.string(),
      data: z.record(z.any()),
      timestamp: z.string(),
      id: z.string()
    })
  ),
  deviceId: z.string().optional(),
});

/**
 * Issue credit to a customer via POS
 */
router.post('/issue-credit', isShopifyAuthenticated, validateRequest(issueCreditSchema), async (req, res) => {
  try {
    const { customerId, amount, reason, note, locationId, orderId, source, attributionId, metadata } = req.body;
    const { shop } = req.user;

    // Create the credit
    const credit = await createCredit({
      customerId,
      shopDomain: shop,
      amount,
      reason: reason || 'POS Credit Issuance',
      note,
      source: source || 'pos',
      locationId,
      orderId,
      attributionId: attributionId || req.user.id,
      metadata: {
        ...metadata,
        issuedVia: 'pos',
        posDevice: req.headers['user-agent'],
        posLocationId: locationId,
      },
    });

    // Create a transaction record
    await createTransaction({
      creditId: credit.id,
      type: 'CREDIT_ISSUED',
      amount,
      metadata: {
        customerId,
        locationId,
        orderId,
        source: 'pos',
        issuedBy: req.user.id,
      },
    });

    logger.info(`POS credit issued: ${amount} to customer ${customerId} from ${shop}`, {
      creditId: credit.id,
      shop,
      customerId,
      amount,
    });

    return res.status(201).json({
      success: true,
      credit,
    });
  } catch (error) {
    logger.error('Error issuing credit via POS:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to issue credit',
      message: error.message,
    });
  }
});

/**
 * Update receipt metadata with credit information
 */
router.post('/receipt-metadata', isShopifyAuthenticated, validateRequest(receiptMetadataSchema), async (req, res) => {
  try {
    const { orderId, creditIds, amount, customerId, locationId, metadata } = req.body;
    const { shop } = req.user;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required',
      });
    }

    // Record the receipt metadata
    const receiptRecord = await prisma.posReceiptMetadata.create({
      data: {
        orderId,
        shopDomain: shop,
        creditIds: creditIds || [],
        amount: amount || 0,
        customerId,
        locationId,
        metadata: metadata || {},
      },
    });

    logger.info(`POS receipt metadata saved for order ${orderId} from ${shop}`, {
      shop,
      orderId,
      creditIds,
      amount,
    });

    return res.status(201).json({
      success: true,
      receiptId: receiptRecord.id,
    });
  } catch (error) {
    logger.error('Error saving POS receipt metadata:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to save receipt metadata',
      message: error.message,
    });
  }
});

/**
 * Synchronize offline transactions from POS
 */
router.post('/sync-offline-transactions', isShopifyAuthenticated, validateRequest(offlineTransactionSchema), async (req, res) => {
  try {
    const { transactions, deviceId } = req.body;
    const { shop, id: userId } = req.user;

    if (!transactions.length) {
      return res.status(200).json({
        success: true,
        message: 'No transactions to process',
        processed: 0,
        failed: 0,
      });
    }

    const results = {
      processed: 0,
      failed: 0,
      failures: [],
    };

    // Process each transaction
    for (const tx of transactions) {
      try {
        // Handle different transaction types
        switch (tx.type) {
          case 'CREDIT_ISSUE': {
            const { customerId, amount, reason, note, locationId, orderId } = tx.data;
            
            // Create the credit
            const credit = await createCredit({
              customerId,
              shopDomain: shop,
              amount,
              reason: reason || 'POS Credit Issuance (Offline)',
              note,
              source: 'pos_offline',
              locationId,
              orderId,
              attributionId: userId,
              metadata: {
                deviceId,
                offlineId: tx.id,
                offlineTimestamp: tx.timestamp,
                issuedVia: 'pos_offline',
              },
            });

            // Create a transaction record
            await createTransaction({
              creditId: credit.id,
              type: 'CREDIT_ISSUED',
              amount,
              metadata: {
                customerId,
                locationId,
                orderId,
                source: 'pos_offline',
                offlineId: tx.id,
                offlineTimestamp: tx.timestamp,
                issuedBy: userId,
              },
            });

            results.processed++;
            break;
          }
          
          case 'CREDIT_ADJUST': {
            const { creditId, amount, reason } = tx.data;
            
            // Adjust the credit
            await adjustCreditAmount({
              creditId,
              amount,
              reason: reason || 'POS Credit Adjustment (Offline)',
              source: 'pos_offline',
              attributionId: userId,
              metadata: {
                deviceId,
                offlineId: tx.id,
                offlineTimestamp: tx.timestamp,
                adjustedVia: 'pos_offline',
              },
            });

            results.processed++;
            break;
          }
          
          case 'RECEIPT_METADATA': {
            const { orderId, creditIds, amount, customerId, locationId, metadata } = tx.data;
            
            // Record the receipt metadata
            await prisma.posReceiptMetadata.create({
              data: {
                orderId,
                shopDomain: shop,
                creditIds: creditIds || [],
                amount: amount || 0,
                customerId,
                locationId,
                metadata: {
                  ...metadata,
                  deviceId,
                  offlineId: tx.id,
                  offlineTimestamp: tx.timestamp,
                },
              },
            });

            results.processed++;
            break;
          }
          
          default:
            throw new Error(`Unsupported transaction type: ${tx.type}`);
        }
      } catch (txError) {
        logger.error(`Error processing offline transaction ${tx.id} of type ${tx.type}:`, txError);
        results.failed++;
        results.failures.push({
          id: tx.id,
          type: tx.type,
          error: txError.message,
        });
      }
    }

    logger.info(`Processed ${results.processed} offline transactions from ${shop}, failed: ${results.failed}`, {
      shop,
      deviceId,
      processed: results.processed,
      failed: results.failed,
    });

    return res.status(200).json({
      success: true,
      message: `Processed ${results.processed} transactions, failed: ${results.failed}`,
      ...results,
    });
  } catch (error) {
    logger.error('Error synchronizing offline transactions:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to synchronize offline transactions',
      message: error.message,
    });
  }
});

export default router; 