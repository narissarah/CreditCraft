import { PrismaClient, Credit, CreditStatus, CreditTransaction, CreditTransactionType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';

// Initialize Prisma Client
const prisma = new PrismaClient();

// Characters used for credit code generation
const CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// Credit code structure: PREFIX-RANDOMCHARS-CHECKSUM
const CODE_PREFIX = 'SC';
const CODE_RANDOM_LENGTH = 8;
const CODE_PATTERN = new RegExp(`^${CODE_PREFIX}-[${CODE_CHARACTERS}]{${CODE_RANDOM_LENGTH}}-[0-9A-F]{2}$`);

/**
 * Generates a unique credit code with a checksum
 * Format: SC-XXXXXXXX-YY where X is alphanumeric and YY is a checksum
 */
export function generateCreditCode(): string {
  // Generate random part
  let randomPart = '';
  for (let i = 0; i < CODE_RANDOM_LENGTH; i++) {
    const randomIndex = crypto.randomInt(0, CODE_CHARACTERS.length);
    randomPart += CODE_CHARACTERS.charAt(randomIndex);
  }
  
  // Calculate checksum (simple implementation)
  const baseCode = `${CODE_PREFIX}-${randomPart}`;
  const checksum = crypto
    .createHash('md5')
    .update(baseCode)
    .digest('hex')
    .substring(0, 2)
    .toUpperCase();
    
  return `${baseCode}-${checksum}`;
}

/**
 * Validates a credit code format and checksum
 */
export function validateCreditCode(code: string): boolean {
  if (!CODE_PATTERN.test(code)) {
    return false;
  }
  
  // Verify checksum
  const parts = code.split('-');
  const baseCode = `${parts[0]}-${parts[1]}`;
  const providedChecksum = parts[2];
  
  const calculatedChecksum = crypto
    .createHash('md5')
    .update(baseCode)
    .digest('hex')
    .substring(0, 2)
    .toUpperCase();
    
  return providedChecksum === calculatedChecksum;
}

/**
 * Service for managing credits
 */
export const creditService = {
  /**
   * Create a new credit
   */
  async createCredit({
    amount,
    customerId,
    currency = 'USD',
    expirationDate,
    shopId,
    staffId,
    note,
  }: {
    amount: number;
    customerId?: string;
    currency?: string;
    expirationDate?: Date;
    shopId: string;
    staffId?: string;
    note?: string;
  }): Promise<Credit> {
    // Generate a unique code
    const code = generateCreditCode();
    
    try {
      const credit = await prisma.$transaction(async (tx) => {
        // Create the credit
        const newCredit = await tx.credit.create({
          data: {
            code,
            amount,
            balance: amount, // Initially, balance equals the full amount
            currency,
            status: 'ACTIVE' as CreditStatus,
            expirationDate,
            customerId,
            shopId,
            note,
          },
        });
        
        // Create a transaction record for the creation
        await tx.creditTransaction.create({
          data: {
            creditId: newCredit.id,
            type: 'ISSUE' as CreditTransactionType,
            amount,
            staffId,
            metadata: {
              note: note || 'Credit issued',
            },
          },
        });
        
        return newCredit;
      });
      
      logger.info(`Credit created: ${credit.id} with code ${credit.code}`);
      return credit;
    } catch (error) {
      logger.error('Error creating credit:', error);
      throw new Error(`Failed to create credit: ${error.message}`);
    }
  },
  
  /**
   * Get a credit by ID
   */
  async getCreditById(id: string): Promise<Credit | null> {
    try {
      return await prisma.credit.findUnique({
        where: { id },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    } catch (error) {
      logger.error(`Error retrieving credit by ID ${id}:`, error);
      throw new Error(`Failed to retrieve credit: ${error.message}`);
    }
  },
  
  /**
   * Get a credit by code
   */
  async getCreditByCode(code: string): Promise<Credit | null> {
    // Validate code format first
    if (!validateCreditCode(code)) {
      logger.warn(`Invalid credit code format: ${code}`);
      return null;
    }
    
    try {
      return await prisma.credit.findUnique({
        where: { code },
        include: {
          transactions: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    } catch (error) {
      logger.error(`Error retrieving credit by code ${code}:`, error);
      throw new Error(`Failed to retrieve credit: ${error.message}`);
    }
  },
  
  /**
   * List credits with pagination and filtering
   */
  async listCredits({
    shopId,
    customerId,
    status,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  }: {
    shopId: string;
    customerId?: string;
    status?: CreditStatus;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    credits: Credit[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;
      
      // Build filter
      const where: any = { shopId };
      if (customerId) where.customerId = customerId;
      if (status) where.status = status;
      
      // Ensure valid sort field
      const validSortFields = ['createdAt', 'updatedAt', 'amount', 'balance', 'expirationDate'];
      const orderBy: any = {};
      orderBy[validSortFields.includes(sortBy) ? sortBy : 'createdAt'] = sortOrder;
      
      const [credits, total] = await Promise.all([
        prisma.credit.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 5, // Include only the 5 most recent transactions
            },
          },
        }),
        prisma.credit.count({ where }),
      ]);
      
      const totalPages = Math.ceil(total / limit);
      
      return {
        credits,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      logger.error('Error listing credits:', error);
      throw new Error(`Failed to list credits: ${error.message}`);
    }
  },
  
  /**
   * Update a credit
   */
  async updateCredit(
    id: string,
    {
      status,
      expirationDate,
      customerId,
      note,
    }: {
      status?: CreditStatus;
      expirationDate?: Date | null;
      customerId?: string | null;
      note?: string;
    }
  ): Promise<Credit> {
    try {
      // First get the current credit
      const credit = await prisma.credit.findUnique({
        where: { id },
      });
      
      if (!credit) {
        throw new Error('Credit not found');
      }
      
      // Prevent modifying expired or cancelled credits
      if (
        (credit.status === 'EXPIRED' || credit.status === 'CANCELLED') &&
        status && status !== credit.status
      ) {
        throw new Error(`Cannot update a credit with status ${credit.status}`);
      }
      
      // Update the credit
      const updatedCredit = await prisma.credit.update({
        where: { id },
        data: {
          ...(status && { status }),
          ...(expirationDate !== undefined && { expirationDate }),
          ...(customerId !== undefined && { customerId }),
          ...(note && { note }),
        },
      });
      
      logger.info(`Credit updated: ${id}, new status: ${updatedCredit.status}`);
      return updatedCredit;
    } catch (error) {
      logger.error(`Error updating credit ${id}:`, error);
      throw new Error(`Failed to update credit: ${error.message}`);
    }
  },
  
  /**
   * Apply (redeem) a credit
   */
  async applyCredit({
    id,
    amount,
    orderId,
    staffId,
    locationId,
  }: {
    id: string;
    amount: number;
    orderId?: string;
    staffId?: string;
    locationId?: string;
  }): Promise<Credit> {
    try {
      return await prisma.$transaction(async (tx) => {
        // Get the current credit with a lock for update
        const credit = await tx.credit.findUnique({
          where: { id },
        });
        
        if (!credit) {
          throw new Error('Credit not found');
        }
        
        // Check if credit is active
        if (credit.status !== 'ACTIVE') {
          throw new Error(`Credit cannot be applied because it is ${credit.status.toLowerCase()}`);
        }
        
        // Check if credit is expired
        if (credit.expirationDate && new Date(credit.expirationDate) < new Date()) {
          // Update status to EXPIRED
          await tx.credit.update({
            where: { id },
            data: { status: 'EXPIRED' },
          });
          throw new Error('Credit has expired');
        }
        
        // Check if sufficient balance
        if (credit.balance < amount) {
          throw new Error(`Insufficient balance. Available: ${credit.balance}, Requested: ${amount}`);
        }
        
        // Calculate new balance
        const newBalance = credit.balance - amount;
        const newStatus = newBalance === 0 ? 'REDEEMED' as CreditStatus : credit.status;
        
        // Update the credit
        const updatedCredit = await tx.credit.update({
          where: { id },
          data: {
            balance: newBalance,
            status: newStatus,
          },
        });
        
        // Create a transaction record
        await tx.creditTransaction.create({
          data: {
            creditId: credit.id,
            type: 'REDEEM' as CreditTransactionType,
            amount: -amount, // Negative amount for redemption
            referenceId: orderId,
            staffId,
            locationId,
            metadata: {
              orderId,
              locationId,
            },
          },
        });
        
        logger.info(`Credit ${id} applied: ${amount}, new balance: ${newBalance}, new status: ${newStatus}`);
        return updatedCredit;
      });
    } catch (error) {
      logger.error(`Error applying credit ${id}:`, error);
      throw new Error(`Failed to apply credit: ${error.message}`);
    }
  },
  
  /**
   * Cancel a credit
   */
  async cancelCredit({
    id,
    reason,
    staffId,
  }: {
    id: string;
    reason: string;
    staffId?: string;
  }): Promise<Credit> {
    try {
      return await prisma.$transaction(async (tx) => {
        // Get the current credit
        const credit = await tx.credit.findUnique({
          where: { id },
        });
        
        if (!credit) {
          throw new Error('Credit not found');
        }
        
        // Cannot cancel already cancelled or fully redeemed credits
        if (credit.status === 'CANCELLED') {
          throw new Error('Credit is already cancelled');
        }
        
        if (credit.status === 'REDEEMED' && credit.balance === 0) {
          throw new Error('Cannot cancel a fully redeemed credit');
        }
        
        // Update the credit
        const updatedCredit = await tx.credit.update({
          where: { id },
          data: {
            status: 'CANCELLED' as CreditStatus,
          },
        });
        
        // Create a transaction record for the cancellation
        await tx.creditTransaction.create({
          data: {
            creditId: credit.id,
            type: 'CANCEL' as CreditTransactionType,
            amount: 0, // No amount change for cancellation
            staffId,
            metadata: {
              reason,
              previousStatus: credit.status,
            },
          },
        });
        
        logger.info(`Credit ${id} cancelled. Reason: ${reason}`);
        return updatedCredit;
      });
    } catch (error) {
      logger.error(`Error cancelling credit ${id}:`, error);
      throw new Error(`Failed to cancel credit: ${error.message}`);
    }
  },
  
  /**
   * Adjust credit amount (increase or decrease)
   */
  async adjustCreditAmount({
    id,
    adjustmentAmount,
    reason,
    staffId,
  }: {
    id: string;
    adjustmentAmount: number; // Positive for increase, negative for decrease
    reason: string;
    staffId?: string;
  }): Promise<Credit> {
    try {
      return await prisma.$transaction(async (tx) => {
        // Get the current credit
        const credit = await tx.credit.findUnique({
          where: { id },
        });
        
        if (!credit) {
          throw new Error('Credit not found');
        }
        
        // Cannot adjust inactive credits
        if (credit.status !== 'ACTIVE') {
          throw new Error(`Cannot adjust an inactive credit with status ${credit.status}`);
        }
        
        // Check if adjustment would make balance negative
        const newBalance = credit.balance + adjustmentAmount;
        if (newBalance < 0) {
          throw new Error(`Adjustment would result in negative balance. Current balance: ${credit.balance}, Adjustment: ${adjustmentAmount}`);
        }
        
        // Determine new status if applicable
        let newStatus = credit.status;
        if (newBalance === 0) {
          newStatus = 'REDEEMED' as CreditStatus;
        }
        
        // Update the credit
        const updatedCredit = await tx.credit.update({
          where: { id },
          data: {
            amount: credit.amount + adjustmentAmount,
            balance: newBalance,
            status: newStatus,
          },
        });
        
        // Create a transaction record for the adjustment
        await tx.creditTransaction.create({
          data: {
            creditId: credit.id,
            type: adjustmentAmount > 0 ? 'INCREASE' : 'DECREASE' as CreditTransactionType,
            amount: adjustmentAmount,
            staffId,
            metadata: {
              reason,
              previousBalance: credit.balance,
            },
          },
        });
        
        logger.info(`Credit ${id} adjusted by ${adjustmentAmount}. New balance: ${newBalance}. Reason: ${reason}`);
        return updatedCredit;
      });
    } catch (error) {
      logger.error(`Error adjusting credit ${id}:`, error);
      throw new Error(`Failed to adjust credit amount: ${error.message}`);
    }
  },
  
  /**
   * Process expired credits
   * This can be run as a scheduled job
   */
  async processExpiredCredits(): Promise<number> {
    const today = new Date();
    
    try {
      const expiredCredits = await prisma.credit.findMany({
        where: {
          status: 'ACTIVE',
          expirationDate: {
            lt: today,
          },
        },
      });
      
      if (expiredCredits.length === 0) {
        logger.info('No expired credits to process');
        return 0;
      }
      
      // Update all expired credits
      await prisma.$transaction(
        expiredCredits.map((credit) =>
          prisma.credit.update({
            where: { id: credit.id },
            data: { status: 'EXPIRED' },
          })
        )
      );
      
      // Create transaction records for all expirations
      await prisma.$transaction(
        expiredCredits.map((credit) =>
          prisma.creditTransaction.create({
            data: {
              creditId: credit.id,
              type: 'EXPIRE' as CreditTransactionType,
              amount: 0,
              metadata: {
                expirationDate: credit.expirationDate,
                remainingBalance: credit.balance,
              },
            },
          })
        )
      );
      
      logger.info(`Processed ${expiredCredits.length} expired credits`);
      return expiredCredits.length;
    } catch (error) {
      logger.error('Error processing expired credits:', error);
      throw new Error(`Failed to process expired credits: ${error.message}`);
    }
  },
  
  /**
   * Get credits that will expire soon
   */
  async getExpiringCredits({
    shopId,
    days = 30,
    page = 1,
    limit = 20,
  }: {
    shopId: string;
    days?: number;
    page?: number;
    limit?: number;
  }): Promise<{
    credits: Credit[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;
      
      const today = new Date();
      const expirationDate = new Date();
      expirationDate.setDate(today.getDate() + days);
      
      const [credits, total] = await Promise.all([
        prisma.credit.findMany({
          where: {
            shopId,
            status: 'ACTIVE',
            expirationDate: {
              not: null,
              gt: today,
              lte: expirationDate,
            },
          },
          orderBy: {
            expirationDate: 'asc', // Sort by expiration date (closest first)
          },
          skip,
          take: limit,
          include: {
            transactions: {
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        }),
        prisma.credit.count({
          where: {
            shopId,
            status: 'ACTIVE',
            expirationDate: {
              not: null,
              gt: today,
              lte: expirationDate,
            },
          },
        }),
      ]);
      
      const totalPages = Math.ceil(total / limit);
      
      return {
        credits,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      logger.error('Error getting expiring credits:', error);
      throw new Error(`Failed to get expiring credits: ${error.message}`);
    }
  },
  
  /**
   * Extend expiration date of a credit
   */
  async extendExpirationDate({
    id,
    newExpirationDate,
    reason,
    staffId,
  }: {
    id: string;
    newExpirationDate: Date;
    reason: string;
    staffId?: string;
  }): Promise<Credit> {
    try {
      return await prisma.$transaction(async (tx) => {
        // Get the current credit
        const credit = await tx.credit.findUnique({
          where: { id },
        });
        
        if (!credit) {
          throw new Error('Credit not found');
        }
        
        // Cannot extend inactive credits
        if (credit.status !== 'ACTIVE') {
          throw new Error(`Cannot extend expiration of a credit with status ${credit.status}`);
        }
        
        // Verify the new date is in the future
        const today = new Date();
        if (newExpirationDate <= today) {
          throw new Error('New expiration date must be in the future');
        }
        
        // Store the old expiration date
        const oldExpirationDate = credit.expirationDate;
        
        // Update the credit
        const updatedCredit = await tx.credit.update({
          where: { id },
          data: {
            expirationDate: newExpirationDate,
          },
        });
        
        // Create a transaction record for the extension
        await tx.creditTransaction.create({
          data: {
            creditId: credit.id,
            type: 'ADJUST' as CreditTransactionType,
            amount: 0, // No amount change for expiration extension
            staffId,
            metadata: {
              action: 'EXTEND_EXPIRATION',
              reason,
              previousExpirationDate: oldExpirationDate,
              newExpirationDate,
            },
          },
        });
        
        logger.info(`Credit ${id} expiration extended from ${oldExpirationDate} to ${newExpirationDate}. Reason: ${reason}`);
        return updatedCredit;
      });
    } catch (error) {
      logger.error(`Error extending credit expiration ${id}:`, error);
      throw new Error(`Failed to extend credit expiration: ${error.message}`);
    }
  },
};

export default creditService; 