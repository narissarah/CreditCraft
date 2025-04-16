import { PrismaClient, Transaction, TransactionType } from '@prisma/client';
import { logger } from '../utils/logger';

// Initialize Prisma Client
const prisma = new PrismaClient();

export type ListTransactionsResult = {
  transactions: (Transaction & {
    credit?: Credit;
    customer?: Customer;
  })[];
  totalCount: number;
  pageCount: number;
  page: number;
};

/**
 * Service for managing credit transactions
 */
export const transactionService = {
  /**
   * Get a transaction by ID
   */
  async getTransactionById(id: string): Promise<Transaction | null> {
    try {
      return await prisma.transaction.findUnique({
        where: { id },
        include: {
          credit: true,
          customer: true,
        },
      });
    } catch (error) {
      logger.error(`Error retrieving transaction by ID ${id}:`, error);
      throw new Error(`Failed to retrieve transaction: ${error.message}`);
    }
  },

  /**
   * List transactions with pagination and filtering
   */
  async listTransactions({
    shopId,
    customerId,
    creditId,
    type,
    staffId,
    locationId,
    dateFrom,
    dateTo,
    orderId,
    page = 1,
    limit = 20,
    sortBy = 'timestamp',
    sortOrder = 'desc',
  }: {
    shopId: string;
    customerId?: string;
    creditId?: string;
    type?: TransactionType;
    staffId?: string;
    locationId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    orderId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<ListTransactionsResult> {
    try {
      const skip = (page - 1) * limit;
      
      // Build filter
      const where: any = { shopId };
      if (customerId) where.customerId = customerId;
      if (creditId) where.creditId = creditId;
      if (type) where.type = type;
      if (staffId) where.staffId = staffId;
      if (locationId) where.locationId = locationId;
      if (orderId) where.orderId = orderId;
      
      // Date range filter
      if (dateFrom || dateTo) {
        where.timestamp = {};
        if (dateFrom) where.timestamp.gte = dateFrom;
        if (dateTo) where.timestamp.lte = dateTo;
      }
      
      // Ensure valid sort field
      const validSortFields = ['timestamp', 'amount', 'type'];
      const orderBy: any = {};
      orderBy[validSortFields.includes(sortBy) ? sortBy : 'timestamp'] = sortOrder;
      
      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          orderBy,
          skip,
          take: limit,
          include: {
            credit: {
              select: {
                code: true,
                status: true,
              },
            },
            customer: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        }),
        prisma.transaction.count({ where }),
      ]);
      
      const totalPages = Math.ceil(total / limit);
      
      return {
        transactions,
        totalCount: total,
        pageCount: totalPages,
        page,
      };
    } catch (error) {
      logger.error('Error listing transactions:', error);
      throw new Error(`Failed to list transactions: ${error.message}`);
    }
  },

  /**
   * Get transaction summary data for reporting
   */
  async getTransactionSummary({
    shopId,
    groupBy = 'type',
    dateFrom,
    dateTo,
  }: {
    shopId: string;
    groupBy?: 'type' | 'day' | 'week' | 'month' | 'location' | 'staff';
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<any> {
    try {
      // Build date range filter
      const where: any = { shopId };
      if (dateFrom || dateTo) {
        where.timestamp = {};
        if (dateFrom) where.timestamp.gte = dateFrom;
        if (dateTo) where.timestamp.lte = dateTo;
      }
      
      let groupByField: string;
      let dateGrouping: any = null;
      
      // Determine grouping field
      switch (groupBy) {
        case 'type':
          groupByField = 'type';
          break;
        case 'day':
          groupByField = 'date';
          dateGrouping = { date: { _dateFormat: 'YYYY-MM-DD' } };
          break;
        case 'week':
          groupByField = 'week';
          dateGrouping = { week: { _dateFormat: 'YYYY-WW' } };
          break;
        case 'month':
          groupByField = 'month';
          dateGrouping = { month: { _dateFormat: 'YYYY-MM' } };
          break;
        case 'location':
          groupByField = 'locationId';
          break;
        case 'staff':
          groupByField = 'staffId';
          break;
        default:
          groupByField = 'type';
      }
      
      // For date-based grouping, use raw SQL query with date formatting
      if (dateGrouping) {
        // This would need to be implemented with raw SQL queries
        // For simplicity, we'll just group by type in this case
        logger.warn(`Date-based grouping for '${groupBy}' not fully implemented, falling back to type grouping`);
        groupByField = 'type';
      }
      
      // Execute the query
      const results = await prisma.transaction.groupBy({
        by: [groupByField],
        where,
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });
      
      // Format the response based on groupBy type
      return {
        summary: results.map((result) => ({
          group: result[groupByField],
          count: result._count.id,
          totalAmount: result._sum.amount,
        })),
        groupBy,
        dateFrom,
        dateTo,
      };
    } catch (error) {
      logger.error('Error generating transaction summary:', error);
      throw new Error(`Failed to generate transaction summary: ${error.message}`);
    }
  },

  /**
   * Get audit log data for a specific entity (credit or customer)
   */
  async getAuditLog({
    shopId,
    entityType,
    entityId,
    page = 1,
    limit = 20,
  }: {
    shopId: string;
    entityType: 'credit' | 'customer';
    entityId: string;
    page?: number;
    limit?: number;
  }): Promise<{
    transactions: Transaction[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;
      
      // Build filter based on entity type
      const where: any = { shopId };
      if (entityType === 'credit') {
        where.creditId = entityId;
      } else if (entityType === 'customer') {
        where.customerId = entityId;
      } else {
        throw new Error('Invalid entity type: must be "credit" or "customer"');
      }
      
      const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip,
          take: limit,
          include: {
            credit: {
              select: {
                code: true,
                status: true,
              },
            },
          },
        }),
        prisma.transaction.count({ where }),
      ]);
      
      const totalPages = Math.ceil(total / limit);
      
      return {
        transactions,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      logger.error(`Error retrieving audit log for ${entityType} ${entityId}:`, error);
      throw new Error(`Failed to retrieve audit log: ${error.message}`);
    }
  },
}; 