import { logger } from '../../utils/logger';
import { prisma } from '../../../prisma/client';
import EmailService from './index';
import { customerService } from '../customerService';
import { ShopService } from '../shopService';

/**
 * Service for triggering automated email notifications
 */
export class NotificationTriggerService {
  /**
   * Send notification when a credit is issued
   * 
   * @param creditId ID of the issued credit
   * @returns Promise resolving to email job ID if sent
   */
  static async onCreditIssued(creditId: string): Promise<string | null> {
    try {
      // Get the credit with customer data
      const credit = await prisma.credit.findUnique({
        where: { id: creditId },
        include: {
          customer: true
        }
      });
      
      if (!credit || !credit.customer) {
        logger.warn(`Cannot send credit issued notification: Credit ${creditId} or customer not found`);
        return null;
      }
      
      // Check if customer has opted out of this notification type
      const preferences = await this.getCustomerPreferences(credit.customer.id);
      if (!preferences.emailEnabled || !preferences.creditIssued) {
        logger.info(`Customer ${credit.customer.id} has opted out of credit issued notifications`);
        return null;
      }
      
      // Get shop details
      const shop = await ShopService.getShopByDomain(credit.shopDomain);
      if (!shop) {
        logger.warn(`Shop not found for domain ${credit.shopDomain}`);
        return null;
      }
      
      // Format customer name
      const customerName = this.formatCustomerName(credit.customer);
      
      // Send notification
      return await EmailService.sendCreditIssuedNotification(
        credit.customer.email,
        {
          customerName,
          creditAmount: credit.amount,
          creditCode: credit.code,
          expirationDate: credit.expirationDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          currency: credit.currency || '$',
          shopName: shop.name || shop.domain,
          shopUrl: `https://${shop.domain}`
        }
      );
    } catch (error) {
      logger.error(`Failed to send credit issued notification for credit ${creditId}:`, error);
      return null;
    }
  }
  
  /**
   * Send notification when a credit is about to expire
   * 
   * @param creditId ID of the expiring credit
   * @param daysUntilExpiration Days until the credit expires
   * @returns Promise resolving to email job ID if sent
   */
  static async onCreditExpiring(creditId: string, daysUntilExpiration: number): Promise<string | null> {
    try {
      // Get the credit with customer data
      const credit = await prisma.credit.findUnique({
        where: { id: creditId },
        include: {
          customer: true
        }
      });
      
      if (!credit || !credit.customer || !credit.expirationDate) {
        logger.warn(`Cannot send credit expiration notification: Credit ${creditId}, customer, or expiration date not found`);
        return null;
      }
      
      // Check if credit amount is zero or credit is not active
      if (credit.balance <= 0 || credit.status !== 'ACTIVE') {
        logger.info(`Skipping expiration notification for credit ${creditId}: Zero balance or inactive`);
        return null;
      }
      
      // Check if customer has opted out of this notification type
      const preferences = await this.getCustomerPreferences(credit.customer.id);
      if (!preferences.emailEnabled || !preferences.creditExpiring) {
        logger.info(`Customer ${credit.customer.id} has opted out of credit expiring notifications`);
        return null;
      }
      
      // Get shop details
      const shop = await ShopService.getShopByDomain(credit.shopDomain);
      if (!shop) {
        logger.warn(`Shop not found for domain ${credit.shopDomain}`);
        return null;
      }
      
      // Format customer name
      const customerName = this.formatCustomerName(credit.customer);
      
      // Send notification
      return await EmailService.sendCreditExpirationReminder(
        credit.customer.email,
        {
          customerName,
          creditAmount: credit.balance,
          creditCode: credit.code,
          expirationDate: credit.expirationDate,
          daysUntilExpiration,
          currency: credit.currency || '$',
          shopName: shop.name || shop.domain,
          shopUrl: `https://${shop.domain}`
        }
      );
    } catch (error) {
      logger.error(`Failed to send credit expiration notification for credit ${creditId}:`, error);
      return null;
    }
  }
  
  /**
   * Send notification when a credit is redeemed
   * 
   * @param creditId ID of the redeemed credit
   * @param transactionId ID of the redemption transaction
   * @returns Promise resolving to email job ID if sent
   */
  static async onCreditRedeemed(creditId: string, transactionId: string): Promise<string | null> {
    try {
      // Get the credit, transaction, and customer data
      const [credit, transaction] = await Promise.all([
        prisma.credit.findUnique({
          where: { id: creditId },
          include: { customer: true }
        }),
        prisma.transaction.findUnique({
          where: { id: transactionId }
        })
      ]);
      
      if (!credit || !credit.customer || !transaction) {
        logger.warn(`Cannot send credit redeemed notification: Credit ${creditId}, customer, or transaction not found`);
        return null;
      }
      
      // Check if customer has opted out of this notification type
      const preferences = await this.getCustomerPreferences(credit.customer.id);
      if (!preferences.emailEnabled || !preferences.creditRedeemed) {
        logger.info(`Customer ${credit.customer.id} has opted out of credit redeemed notifications`);
        return null;
      }
      
      // Get shop details
      const shop = await ShopService.getShopByDomain(credit.shopDomain);
      if (!shop) {
        logger.warn(`Shop not found for domain ${credit.shopDomain}`);
        return null;
      }
      
      // Format customer name
      const customerName = this.formatCustomerName(credit.customer);
      
      // Send notification for credit redeemed
      return await EmailService.sendTemplateEmail(
        credit.customer.email,
        'credit-redeemed',
        {
          subject: 'Your store credit has been redeemed',
          customerName,
          creditAmount: Math.abs(transaction.amount),
          remainingBalance: credit.balance,
          orderNumber: transaction.orderId,
          redeemedDate: transaction.createdAt.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }),
          currency: credit.currency || '$',
          shopName: shop.name || shop.domain,
          shopUrl: `https://${shop.domain}`,
          unsubscribeUrl: `https://${shop.domain}/customer/email-preferences?unsubscribe=credits`
        }
      );
    } catch (error) {
      logger.error(`Failed to send credit redeemed notification for credit ${creditId}:`, error);
      return null;
    }
  }
  
  /**
   * Send batch notification for expiring credits
   * 
   * @param days Days until expiration to check for
   * @returns Promise resolving to the number of emails sent
   */
  static async sendExpirationRemindersBatch(days: number): Promise<number> {
    try {
      // Calculate the target expiration date
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + days);
      
      // Set date to the beginning of the day
      targetDate.setHours(0, 0, 0, 0);
      
      // Get next day to create a range
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      // Find credits expiring on the target date with balance > 0 and active status
      const expiringCredits = await prisma.credit.findMany({
        where: {
          expirationDate: {
            gte: targetDate,
            lt: nextDay
          },
          balance: { gt: 0 },
          status: 'ACTIVE'
        },
        include: {
          customer: true
        }
      });
      
      logger.info(`Found ${expiringCredits.length} credits expiring in ${days} days`);
      
      let sentCount = 0;
      
      // Process each credit
      for (const credit of expiringCredits) {
        if (!credit.customer) continue;
        
        // Check if customer has opted out
        const preferences = await this.getCustomerPreferences(credit.customer.id);
        if (!preferences.emailEnabled || !preferences.creditExpiring) continue;
        
        // Get shop details
        const shop = await ShopService.getShopByDomain(credit.shopDomain);
        if (!shop) continue;
        
        // Send notification
        const result = await this.onCreditExpiring(credit.id, days);
        if (result) sentCount++;
      }
      
      return sentCount;
    } catch (error) {
      logger.error(`Failed to send batch expiration reminders for ${days} days:`, error);
      return 0;
    }
  }
  
  /**
   * Get customer notification preferences, creating default if not exists
   */
  private static async getCustomerPreferences(customerId: string) {
    let preferences = await prisma.notificationPreference.findUnique({
      where: { customerId }
    });
    
    if (!preferences) {
      // Create default preferences
      preferences = await prisma.notificationPreference.create({
        data: {
          customerId,
          emailEnabled: true,
          creditIssued: true,
          creditExpiring: true,
          creditRedeemed: true,
          balanceUpdates: true,
          promotions: true
        }
      });
    }
    
    return preferences;
  }
  
  /**
   * Format customer name for friendly display
   */
  private static formatCustomerName(customer: { firstName?: string; lastName?: string; email: string }): string {
    if (customer.firstName && customer.lastName) {
      return `${customer.firstName} ${customer.lastName}`;
    } else if (customer.firstName) {
      return customer.firstName;
    } else {
      // Use part of email if no name available
      return customer.email.split('@')[0];
    }
  }
}

export default NotificationTriggerService; 