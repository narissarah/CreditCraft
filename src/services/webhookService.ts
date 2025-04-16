import { logger } from '../utils/logger';
import { prisma } from '../../prisma/client';
import { QueueRegistry } from '../lib/queueRegistry';

/**
 * Service for processing Shopify webhooks
 */
export class WebhookService {
  /**
   * Process an order creation webhook
   * @param shop Shop domain
   * @param data Order data from webhook
   */
  static async processOrderCreate(shop: string, data: any): Promise<void> {
    try {
      const { id, order_number, customer, line_items, total_price, currency } = data;
      
      logger.info(`Processing order creation for shop ${shop}, order ${order_number}`);
      
      // Record order in database for auditing
      await prisma.transaction.create({
        data: {
          shopDomain: shop,
          orderId: id.toString(),
          amount: parseFloat(total_price),
          type: 'ORDER',
          status: 'COMPLETED',
          processedAt: new Date(),
          customerId: customer?.id ? customer.id.toString() : null,
          metadata: {
            orderNumber: order_number,
            lineItems: line_items.length,
            currency
          }
        }
      });
      
      // Queue additional processing if needed
      const queueRegistry = QueueRegistry.getInstance();
      await queueRegistry.getQueue('orders').add('process-order', {
        shop,
        orderId: id,
        orderNumber: order_number,
        customerId: customer?.id
      });
      
    } catch (error) {
      logger.error(`Error processing order creation:`, error);
      throw error;
    }
  }
  
  /**
   * Process an order update webhook
   * @param shop Shop domain
   * @param data Order data from webhook
   */
  static async processOrderUpdate(shop: string, data: any): Promise<void> {
    try {
      const { id, order_number, financial_status } = data;
      
      logger.info(`Processing order update for shop ${shop}, order ${order_number}`);
      
      if (financial_status) {
        await prisma.transaction.updateMany({
          where: {
            shopDomain: shop,
            orderId: id.toString(),
          },
          data: {
            status: WebhookService.mapFinancialStatus(financial_status),
            updatedAt: new Date()
          }
        });
      }
      
    } catch (error) {
      logger.error(`Error processing order update:`, error);
      throw error;
    }
  }
  
  /**
   * Process an order cancellation webhook
   * @param shop Shop domain
   * @param data Order data from webhook
   */
  static async processOrderCancel(shop: string, data: any): Promise<void> {
    try {
      const { id, order_number, cancel_reason } = data;
      
      logger.info(`Processing order cancellation for shop ${shop}, order ${order_number}`);
      
      // Update transaction status
      await prisma.transaction.updateMany({
        where: {
          shopDomain: shop,
          orderId: id.toString(),
        },
        data: {
          status: 'CANCELLED',
          updatedAt: new Date(),
          metadata: {
            cancelReason: cancel_reason
          }
        }
      });
      
      // Queue credit refund job if applicable
      const queueRegistry = QueueRegistry.getInstance();
      await queueRegistry.getQueue('credits').add('check-credit-refund', {
        shop,
        orderId: id,
        orderNumber: order_number
      });
      
    } catch (error) {
      logger.error(`Error processing order cancellation:`, error);
      throw error;
    }
  }
  
  /**
   * Process a customer creation webhook
   * @param shop Shop domain
   * @param data Customer data from webhook
   */
  static async processCustomerCreate(shop: string, data: any): Promise<void> {
    try {
      const { id, email, first_name, last_name } = data;
      
      logger.info(`Processing customer creation for shop ${shop}, customer ${email}`);
      
      // Create or update customer record
      await prisma.customer.upsert({
        where: {
          shopifyCustomerId_shopDomain: {
            shopifyCustomerId: id.toString(),
            shopDomain: shop
          }
        },
        update: {
          email,
          firstName: first_name,
          lastName: last_name,
          updatedAt: new Date()
        },
        create: {
          shopifyCustomerId: id.toString(),
          shopDomain: shop,
          email,
          firstName: first_name,
          lastName: last_name,
          status: 'ACTIVE'
        }
      });
      
    } catch (error) {
      logger.error(`Error processing customer creation:`, error);
      throw error;
    }
  }
  
  /**
   * Process a customer update webhook
   * @param shop Shop domain
   * @param data Customer data from webhook
   */
  static async processCustomerUpdate(shop: string, data: any): Promise<void> {
    try {
      const { id, email, first_name, last_name } = data;
      
      logger.info(`Processing customer update for shop ${shop}, customer ${email}`);
      
      // Update customer record
      await prisma.customer.updateMany({
        where: {
          shopifyCustomerId: id.toString(),
          shopDomain: shop
        },
        data: {
          email,
          firstName: first_name,
          lastName: last_name,
          updatedAt: new Date()
        }
      });
      
    } catch (error) {
      logger.error(`Error processing customer update:`, error);
      throw error;
    }
  }
  
  /**
   * Process an app uninstallation webhook
   * @param shop Shop domain
   */
  static async processAppUninstall(shop: string): Promise<void> {
    try {
      logger.info(`Processing app uninstallation for shop ${shop}`);
      
      // Mark all customers for this shop as inactive
      await prisma.customer.updateMany({
        where: {
          shopDomain: shop
        },
        data: {
          status: 'INACTIVE'
        }
      });
      
      // Mark all credits as inactive
      await prisma.credit.updateMany({
        where: {
          shopDomain: shop
        },
        data: {
          status: 'INACTIVE'
        }
      });
      
      // Queue cleanup job
      const queueRegistry = QueueRegistry.getInstance();
      await queueRegistry.getQueue('admin').add('cleanup-shop-data', {
        shop,
        reason: 'app_uninstalled'
      });
      
    } catch (error) {
      logger.error(`Error processing app uninstallation:`, error);
      throw error;
    }
  }
  
  /**
   * Map Shopify financial status to internal status
   * @param financialStatus Shopify financial status
   * @returns Internal status
   */
  static mapFinancialStatus(financialStatus: string): string {
    switch (financialStatus.toLowerCase()) {
      case 'paid':
        return 'COMPLETED';
      case 'partially_paid':
        return 'PARTIALLY_COMPLETED';
      case 'refunded':
        return 'REFUNDED';
      case 'partially_refunded':
        return 'PARTIALLY_REFUNDED';
      case 'pending':
        return 'PENDING';
      case 'voided':
        return 'VOIDED';
      default:
        return 'UNKNOWN';
    }
  }
} 