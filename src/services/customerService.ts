import { PrismaClient, Customer, Credit } from '@prisma/client';
import { logger } from '../utils/logger';
import { CustomerType, CustomerSearchParams, CustomerStats } from '../types/customer';
import { formatCustomerName } from '../utils/formatters';

// Initialize Prisma Client
const prisma = new PrismaClient();

/**
 * Service for managing customers
 */
export const customerService = {
  /**
   * Create a new customer
   */
  async createCustomer({
    email,
    firstName,
    lastName,
    phone,
    shopifyCustomerId,
    shopDomain,
    tags = [],
  }: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    shopifyCustomerId?: string;
    shopDomain: string;
    tags?: string[];
  }): Promise<Customer> {
    try {
      const customer = await prisma.customer.create({
        data: {
          email,
          firstName,
          lastName,
          phone,
          shopifyCustomerId,
          shopDomain,
          tags,
          status: 'ACTIVE',
        },
      });
      
      logger.info(`Customer created: ${customer.id} with email ${customer.email}`);
      return customer;
    } catch (error) {
      logger.error('Error creating customer:', error);
      throw new Error(`Failed to create customer: ${error.message}`);
    }
  },
  
  /**
   * Get a customer by ID
   */
  async getCustomerById(id: string): Promise<Customer | null> {
    try {
      return await prisma.customer.findUnique({
        where: { id },
        include: {
          credits: {
            where: {
              status: 'ACTIVE',
            },
          },
        },
      });
    } catch (error) {
      logger.error(`Error retrieving customer by ID ${id}:`, error);
      throw new Error(`Failed to retrieve customer: ${error.message}`);
    }
  },
  
  /**
   * Get a customer by Shopify customer ID
   */
  async getCustomerByShopifyId(shopifyCustomerId: string, shopDomain: string): Promise<Customer | null> {
    try {
      return await prisma.customer.findFirst({
        where: {
          shopifyCustomerId,
          shopDomain,
        },
        include: {
          credits: {
            where: {
              status: 'ACTIVE',
            },
          },
        },
      });
    } catch (error) {
      logger.error(`Error retrieving customer by Shopify ID ${shopifyCustomerId}:`, error);
      throw new Error(`Failed to retrieve customer: ${error.message}`);
    }
  },
  
  /**
   * Get a customer by email
   */
  async getCustomerByEmail(email: string, shopDomain: string): Promise<Customer | null> {
    try {
      return await prisma.customer.findFirst({
        where: {
          email,
          shopDomain,
        },
        include: {
          credits: {
            where: {
              status: 'ACTIVE',
            },
          },
        },
      });
    } catch (error) {
      logger.error(`Error retrieving customer by email ${email}:`, error);
      throw new Error(`Failed to retrieve customer: ${error.message}`);
    }
  },
  
  /**
   * List customers with pagination and filtering
   */
  async listCustomers({
    shopDomain,
    status,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    search,
    tag,
    hasCreditBalance,
  }: {
    shopDomain: string;
    status?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    search?: string;
    tag?: string;
    hasCreditBalance?: boolean;
  }): Promise<{
    customers: Customer[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const skip = (page - 1) * limit;
      
      // Build filter
      const where: any = { shopDomain };
      if (status) where.status = status;
      
      // Add search condition if provided
      if (search) {
        where.OR = [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ];
      }
      
      // Add tag filter if provided
      if (tag) {
        where.tags = {
          has: tag
        };
      }
      
      // Ensure valid sort field
      const validSortFields = ['createdAt', 'updatedAt', 'email', 'firstName', 'lastName'];
      const orderBy: any = {};
      orderBy[validSortFields.includes(sortBy) ? sortBy : 'createdAt'] = sortOrder;
      
      let customers = await prisma.customer.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          credits: {
            where: {
              status: 'ACTIVE',
            },
            select: {
              id: true,
              amount: true,
              balance: true,
              currency: true,
              status: true,
              expirationDate: true,
            },
          },
          _count: {
            select: {
              credits: true,
            },
          },
        },
      });
      
      // Filter by credit balance if needed
      if (hasCreditBalance === true) {
        customers = customers.filter(customer => 
          customer.credits.some(credit => 
            credit.status === 'ACTIVE' && credit.balance > 0
          )
        );
      } else if (hasCreditBalance === false) {
        customers = customers.filter(customer => 
          !customer.credits.some(credit => 
            credit.status === 'ACTIVE' && credit.balance > 0
          )
        );
      }
      
      const total = await prisma.customer.count({ where });
      const totalPages = Math.ceil(total / limit);
      
      return {
        customers,
        total,
        page,
        totalPages,
      };
    } catch (error) {
      logger.error('Error listing customers:', error);
      throw new Error(`Failed to list customers: ${error.message}`);
    }
  },
  
  /**
   * Update a customer
   */
  async updateCustomer(
    id: string,
    {
      firstName,
      lastName,
      phone,
      tags,
      status,
    }: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      tags?: string[];
      status?: string;
    }
  ): Promise<Customer> {
    try {
      return await prisma.customer.update({
        where: { id },
        data: {
          firstName,
          lastName,
          phone,
          tags,
          status,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error(`Error updating customer ${id}:`, error);
      throw new Error(`Failed to update customer: ${error.message}`);
    }
  },
  
  /**
   * Delete a customer
   */
  async deleteCustomer(id: string): Promise<void> {
    try {
      await prisma.customer.delete({
        where: { id },
      });
      
      logger.info(`Customer deleted: ${id}`);
    } catch (error) {
      logger.error(`Error deleting customer ${id}:`, error);
      throw new Error(`Failed to delete customer: ${error.message}`);
    }
  },
  
  /**
   * Import customers from a list
   */
  async importCustomers(
    shopDomain: string,
    customers: Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      shopifyCustomerId?: string;
      tags?: string[];
    }>
  ): Promise<{
    total: number;
    imported: number;
    skipped: number;
    errors: Array<{
      line: number;
      email: string;
      reason: string;
    }>;
  }> {
    const result = {
      total: customers.length,
      imported: 0,
      skipped: 0,
      errors: [] as Array<{
        line: number;
        email: string;
        reason: string;
      }>,
    };
    
    try {
      for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        
        try {
          // Check if customer already exists
          const existing = await prisma.customer.findFirst({
            where: {
              OR: [
                { email: customer.email, shopDomain },
                customer.shopifyCustomerId 
                  ? { shopifyCustomerId: customer.shopifyCustomerId, shopDomain }
                  : undefined,
              ].filter(Boolean) as any,
            },
          });
          
          if (existing) {
            // Update existing customer
            await prisma.customer.update({
              where: { id: existing.id },
              data: {
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone,
                tags: customer.tags,
                updatedAt: new Date(),
              },
            });
            
            result.skipped++;
            logger.info(`Customer updated: ${existing.id} with email ${customer.email}`);
          } else {
            // Create new customer
            await prisma.customer.create({
              data: {
                email: customer.email,
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone,
                shopifyCustomerId: customer.shopifyCustomerId,
                shopDomain,
                tags: customer.tags,
                status: 'ACTIVE',
              },
            });
            
            result.imported++;
            logger.info(`Customer imported: ${customer.email}`);
          }
        } catch (err) {
          logger.error(`Error importing customer ${customer.email}:`, err);
          result.errors.push({
            line: i + 1,
            email: customer.email,
            reason: err.message || 'Unknown error',
          });
        }
      }
      
      return result;
    } catch (error) {
      logger.error('Error importing customers:', error);
      throw new Error(`Failed to import customers: ${error.message}`);
    }
  },
  
  /**
   * Get customer statistics
   */
  async getCustomerStats(shopDomain: string): Promise<CustomerStats> {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const sixtyDaysAgo = new Date(now);
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      
      // Get total customers
      const totalCustomers = await prisma.customer.count({
        where: { shopDomain },
      });
      
      // Get total customers 30-60 days ago
      const totalCustomersPrevious = await prisma.customer.count({
        where: {
          shopDomain,
          createdAt: { lt: thirtyDaysAgo },
        },
      });
      
      // Calculate trend
      const totalCustomersTrend = totalCustomersPrevious > 0
        ? Math.round(((totalCustomers - totalCustomersPrevious) / totalCustomersPrevious) * 100)
        : 0;
      
      // Get active customers
      const activeCustomers = await prisma.customer.count({
        where: {
          shopDomain,
          status: 'ACTIVE',
        },
      });
      
      // Get active customers 30-60 days ago
      const activeCustomersPrevious = await prisma.customer.count({
        where: {
          shopDomain,
          status: 'ACTIVE',
          createdAt: { lt: thirtyDaysAgo },
        },
      });
      
      // Calculate trend
      const activeCustomersTrend = activeCustomersPrevious > 0
        ? Math.round(((activeCustomers - activeCustomersPrevious) / activeCustomersPrevious) * 100)
        : 0;
      
      // Get new customers in the last 30 days
      const newCustomers = await prisma.customer.count({
        where: {
          shopDomain,
          createdAt: { gte: thirtyDaysAgo },
        },
      });
      
      // Get new customers 30-60 days ago
      const newCustomersPrevious = await prisma.customer.count({
        where: {
          shopDomain,
          createdAt: {
            gte: sixtyDaysAgo,
            lt: thirtyDaysAgo,
          },
        },
      });
      
      // Calculate trend
      const newCustomersTrend = newCustomersPrevious > 0
        ? Math.round(((newCustomers - newCustomersPrevious) / newCustomersPrevious) * 100)
        : 0;
      
      // Get customers with credit
      const customersWithCredit = await prisma.customer.count({
        where: {
          shopDomain,
          credits: {
            some: {
              status: 'ACTIVE',
              balance: { gt: 0 },
            },
          },
        },
      });
      
      // Get customers with credit 30-60 days ago
      const customersWithCreditPrevious = await prisma.customer.count({
        where: {
          shopDomain,
          credits: {
            some: {
              status: 'ACTIVE',
              balance: { gt: 0 },
              createdAt: { lt: thirtyDaysAgo },
            },
          },
        },
      });
      
      // Calculate trend
      const customerWithCreditTrend = customersWithCreditPrevious > 0
        ? Math.round(((customersWithCredit - customersWithCreditPrevious) / customersWithCreditPrevious) * 100)
        : 0;
      
      return {
        totalCustomers,
        totalCustomersTrend,
        activeCustomers,
        activeCustomersTrend,
        newCustomers,
        newCustomersTrend,
        customerWithCredit: customersWithCredit,
        customerWithCreditTrend,
      };
    } catch (error) {
      logger.error('Error getting customer stats:', error);
      throw new Error(`Failed to get customer stats: ${error.message}`);
    }
  },
  
  /**
   * Calculate customer credit balance
   */
  async getCustomerCreditBalance(customerId: string): Promise<{
    available: number;
    expiring: number;
    expiryDate: string | null;
  }> {
    try {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      // Get active credits
      const credits = await prisma.credit.findMany({
        where: {
          customerId,
          status: 'ACTIVE',
          balance: { gt: 0 },
        },
      });
      
      // Calculate total available balance
      const available = credits.reduce((total, credit) => total + Number(credit.balance), 0);
      
      // Calculate expiring amount
      const expiringCredits = credits.filter(credit => 
        credit.expirationDate && 
        credit.expirationDate <= thirtyDaysFromNow
      );
      
      const expiring = expiringCredits.reduce((total, credit) => total + Number(credit.balance), 0);
      
      // Get the earliest expiry date
      const expiryDates = expiringCredits
        .map(credit => credit.expirationDate)
        .filter(Boolean) as Date[];
        
      const earliestExpiryDate = expiryDates.length > 0 
        ? new Date(Math.min(...expiryDates.map(d => d.getTime()))).toISOString().split('T')[0]
        : null;
        
      return {
        available,
        expiring,
        expiryDate: earliestExpiryDate,
      };
    } catch (error) {
      logger.error(`Error calculating credit balance for customer ${customerId}:`, error);
      throw new Error(`Failed to calculate credit balance: ${error.message}`);
    }
  },
};

// Export the service
export default customerService; 