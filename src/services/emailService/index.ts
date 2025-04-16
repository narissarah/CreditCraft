import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';
import { queueEmail, EmailJobData } from '../../jobs/emailJob';
import emailConfig from '../../config/email';
import { 
  EmailTemplate, 
  TemplateData,
  getTemplateFilename 
} from '../../templates/email';
import { prisma } from '../../../prisma/client';

// Cache for templates
const templateCache: Record<string, string> = {};

/**
 * Email service for sending notifications
 */
export class EmailService {
  /**
   * Get the HTML content of a template
   * 
   * @param template The template name to load
   * @returns The HTML content of the template
   */
  static async getTemplateContent(template: EmailTemplate): Promise<string> {
    // Check cache first
    if (templateCache[template]) {
      return templateCache[template];
    }
    
    const templatePath = path.join(
      __dirname, 
      '../../templates/email', 
      getTemplateFilename(template)
    );
    
    try {
      // Load template file
      const content = await fs.promises.readFile(templatePath, 'utf8');
      
      // Cache the template
      templateCache[template] = content;
      
      return content;
    } catch (error) {
      logger.error(`Failed to load email template ${template}:`, error);
      throw new Error(`Email template ${template} not found`);
    }
  }
  
  /**
   * Render a template with data
   * 
   * @param template The template to render
   * @param data The data to use for rendering
   * @returns The rendered HTML
   */
  static renderTemplate(template: string, data: Record<string, any>): string {
    // Simple template engine using {{var}} syntax
    return template.replace(
      /\{\{([^}]+)\}\}/g, 
      (match, key) => {
        // For current year
        if (key === 'currentYear') {
          return new Date().getFullYear().toString();
        }
        
        // For formatting currency values
        if (key.startsWith('format.currency.')) {
          const valueKey = key.replace('format.currency.', '');
          const value = data[valueKey];
          if (value !== undefined) {
            return typeof value === 'number' 
              ? value.toFixed(2)
              : value.toString();
          }
        }
        
        return data[key] !== undefined ? data[key].toString() : '';
      }
    );
  }
  
  /**
   * Send an email using a template
   * 
   * @param to Recipient email address
   * @param template Template to use
   * @param data Template data
   * @param options Additional options
   * @returns Promise resolving to the job ID
   */
  static async sendTemplateEmail(
    to: string,
    template: EmailTemplate,
    data: TemplateData,
    options: {
      cc?: string | string[];
      bcc?: string | string[];
      attachments?: EmailJobData['attachments'];
      delay?: number;
      trackingData?: Record<string, any>;
    } = {}
  ): Promise<string> {
    if (!emailConfig.enabled) {
      logger.info(`Email sending is disabled. Would have sent ${template} to ${to}`);
      return 'disabled';
    }
    
    try {
      // Get template content
      const templateContent = await this.getTemplateContent(template);
      
      // Render the template with data
      const html = this.renderTemplate(templateContent, data);
      
      // Create a plain text version
      const text = html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // Queue the email
      const job = await queueEmail(
        {
          to,
          subject: data.subject,
          body: text,
          template: template,
          data: {
            ...data,
            html
          },
          attachments: options.attachments
        },
        options.delay
      );
      
      // Record the email in the database for tracking if enabled
      if (emailConfig.trackOpens || emailConfig.trackClicks) {
        await this.recordEmailSent(to, template, data, options.trackingData, job.id);
      }
      
      logger.info(`Email queued: ${template} to ${to} (Job ID: ${job.id})`);
      
      return job.id;
    } catch (error) {
      logger.error(`Failed to send email template ${template} to ${to}:`, error);
      throw error;
    }
  }
  
  /**
   * Record sent email in database for tracking
   */
  private static async recordEmailSent(
    to: string,
    template: EmailTemplate,
    data: TemplateData,
    trackingData?: Record<string, any>,
    jobId?: string | number
  ): Promise<void> {
    try {
      await prisma.emailLog.create({
        data: {
          recipient: to,
          template,
          subject: data.subject,
          jobId: jobId?.toString(),
          metadata: {
            ...(trackingData || {}),
            templateData: data
          },
          sentAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to record email in database:', error);
      // Don't throw here, as this shouldn't prevent the email from being sent
    }
  }
  
  /**
   * Send a credit issued notification
   */
  static async sendCreditIssuedNotification(
    to: string,
    data: {
      customerName: string;
      creditAmount: number;
      creditCode: string;
      expirationDate: Date;
      currency: string;
      shopName: string;
      shopUrl: string;
      customSubject?: string;
    }
  ): Promise<string> {
    const formattedDate = data.expirationDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    return this.sendTemplateEmail(
      to,
      EmailTemplate.CREDIT_ISSUED,
      {
        subject: data.customSubject || 'Your store credit has been issued',
        customerName: data.customerName,
        creditAmount: data.creditAmount,
        creditCode: data.creditCode,
        expirationDate: formattedDate,
        currency: data.currency,
        shopName: data.shopName,
        shopUrl: data.shopUrl,
        unsubscribeUrl: `${data.shopUrl}/customer/email-preferences?unsubscribe=credits`
      }
    );
  }
  
  /**
   * Send a credit expiration reminder
   */
  static async sendCreditExpirationReminder(
    to: string,
    data: {
      customerName: string;
      creditAmount: number;
      creditCode: string;
      expirationDate: Date;
      daysUntilExpiration: number;
      currency: string;
      shopName: string;
      shopUrl: string;
      customSubject?: string;
    }
  ): Promise<string> {
    const formattedDate = data.expirationDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    return this.sendTemplateEmail(
      to,
      EmailTemplate.CREDIT_EXPIRATION,
      {
        subject: data.customSubject || `Your store credit expires in ${data.daysUntilExpiration} days`,
        customerName: data.customerName,
        creditAmount: data.creditAmount,
        creditCode: data.creditCode,
        expirationDate: formattedDate,
        daysUntilExpiration: data.daysUntilExpiration,
        currency: data.currency,
        shopName: data.shopName,
        shopUrl: data.shopUrl,
        unsubscribeUrl: `${data.shopUrl}/customer/email-preferences?unsubscribe=credits`
      }
    );
  }
  
  /**
   * Send a custom notification
   */
  static async sendCustomNotification(
    to: string,
    data: {
      customerName: string;
      subject: string;
      message: string;
      shopName: string;
      shopUrl: string;
    }
  ): Promise<string> {
    return this.sendTemplateEmail(
      to, 
      EmailTemplate.CUSTOM,
      {
        subject: data.subject,
        customerName: data.customerName,
        customMessage: data.message,
        shopName: data.shopName,
        shopUrl: data.shopUrl,
        unsubscribeUrl: `${data.shopUrl}/unsubscribe`
      }
    );
  }
  
  /**
   * Send a scheduled report notification with attachment
   */
  static async sendScheduledReportNotification(
    to: string | string[],
    data: {
      reportName: string;
      format: string;
      reportType: string;
      startDate: Date;
      endDate: Date;
      additionalNotes?: string;
      dashboardUrl: string;
      attachment: {
        filename: string;
        path: string;
      };
      customSubject?: string;
    }
  ): Promise<string> {
    const recipients = Array.isArray(to) ? to.join(',') : to;
    
    // Format dates
    const formattedStartDate = data.startDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formattedEndDate = data.endDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const generatedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Pretty format for the report type
    const reportTypeMap: Record<string, string> = {
      'CREDIT_SUMMARY': 'Credit Summary',
      'CUSTOMER_SEGMENTATION': 'Customer Segmentation',
      'STAFF_PERFORMANCE': 'Staff Performance',
      'DASHBOARD_OVERVIEW': 'Dashboard Overview',
      'CUSTOM_REPORT': 'Custom Report'
    };
    
    const formattedReportType = reportTypeMap[data.reportType] || data.reportType;
    
    // Pretty format for file format
    const formatMap: Record<string, string> = {
      'PDF': 'PDF Document',
      'CSV': 'CSV Spreadsheet',
      'EXCEL': 'Excel Spreadsheet',
      'HTML': 'HTML Document'
    };
    
    const formattedFormat = formatMap[data.format] || data.format;
    
    return this.sendTemplateEmail(
      recipients,
      EmailTemplate.SCHEDULED_REPORT,
      {
        subject: data.customSubject || `Your scheduled report: ${data.reportName}`,
        reportName: data.reportName,
        format: formattedFormat,
        generatedDate: generatedDate,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        reportType: formattedReportType,
        additionalNotes: data.additionalNotes || '',
        dashboardUrl: data.dashboardUrl,
        currentYear: new Date().getFullYear().toString()
      },
      {
        attachments: [
          {
            filename: data.attachment.filename,
            path: data.attachment.path
          }
        ]
      }
    );
  }
  
  /**
   * Send a batch of emails using the same template
   */
  static async sendBatchEmails(
    recipients: Array<{
      email: string;
      data: Record<string, any>;
    }>,
    template: EmailTemplate,
    baseData: Partial<TemplateData>,
    options: {
      delay?: number;
      batchSize?: number;
      delayBetweenBatches?: number;
    } = {}
  ): Promise<string[]> {
    const batchSize = options.batchSize || 50;
    const delayBetweenBatches = options.delayBetweenBatches || 1000;
    const results: string[] = [];
    
    // Process in batches
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      
      // Add delay between batches
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
      
      // Process batch
      const batchPromises = batch.map(({ email, data }) => 
        this.sendTemplateEmail(
          email,
          template,
          { ...baseData, ...data } as TemplateData,
          { delay: options.delay }
        )
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }
    
    return results;
  }
}

export default EmailService; 