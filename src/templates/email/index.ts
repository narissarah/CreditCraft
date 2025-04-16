/**
 * Base interface for all email template data
 */
export interface EmailTemplateBase {
  subject: string;
  preheader?: string;
}

/**
 * Credit issuance notification template data
 */
export interface CreditIssuedTemplateData extends EmailTemplateBase {
  customerName: string;
  creditAmount: number;
  creditCode: string;
  expirationDate: string;
  currency: string;
  shopName: string;
  shopUrl: string;
  unsubscribeUrl: string;
}

/**
 * Credit expiration reminder template data
 */
export interface CreditExpirationTemplateData extends EmailTemplateBase {
  customerName: string;
  creditAmount: number;
  creditCode: string;
  expirationDate: string;
  daysUntilExpiration: number;
  currency: string;
  shopName: string;
  shopUrl: string;
  unsubscribeUrl: string;
}

/**
 * Credit redeemed notification template data
 */
export interface CreditRedeemedTemplateData extends EmailTemplateBase {
  customerName: string;
  creditAmount: number;
  remainingBalance: number;
  orderNumber?: string;
  redeemedDate: string;
  currency: string;
  shopName: string;
  shopUrl: string;
  unsubscribeUrl: string;
}

/**
 * Credit balance update notification template data
 */
export interface CreditBalanceUpdateTemplateData extends EmailTemplateBase {
  customerName: string;
  previousBalance: number;
  newBalance: number;
  reason: string;
  updateDate: string;
  currency: string;
  shopName: string;
  shopUrl: string;
  unsubscribeUrl: string;
}

/**
 * Custom notification template data
 */
export interface CustomTemplateData extends EmailTemplateBase {
  customerName: string;
  customMessage: string;
  shopName: string;
  shopUrl: string;
  unsubscribeUrl: string;
}

/**
 * Scheduled report template data
 */
export interface ScheduledReportTemplateData extends EmailTemplateBase {
  reportName: string;
  format: string;
  generatedDate: string;
  startDate: string;
  endDate: string;
  reportType: string;
  additionalNotes?: string;
  dashboardUrl: string;
  currentYear: string;
}

/**
 * Union type of all template data types
 */
export type TemplateData = 
  | CreditIssuedTemplateData
  | CreditExpirationTemplateData
  | CreditRedeemedTemplateData
  | CreditBalanceUpdateTemplateData
  | CustomTemplateData
  | ScheduledReportTemplateData;

/**
 * Template names enum
 */
export enum EmailTemplate {
  CREDIT_ISSUED = 'credit-issued',
  CREDIT_EXPIRATION = 'credit-expiration',
  CREDIT_REDEEMED = 'credit-redeemed',
  CREDIT_BALANCE_UPDATE = 'credit-balance-update',
  CUSTOM = 'custom',
  SCHEDULED_REPORT = 'scheduled-report'
}

/**
 * Email template registry
 */
export const EMAIL_TEMPLATES = {
  [EmailTemplate.CREDIT_ISSUED]: {
    name: 'Credit Issued',
    description: 'Sent when a new credit is issued to a customer',
    subject: 'Your store credit has been issued',
    preview: 'Your {amount} store credit is ready to use',
  },
  [EmailTemplate.CREDIT_EXPIRATION]: {
    name: 'Credit Expiration Reminder',
    description: 'Reminder sent before a credit expires',
    subject: 'Your store credit is expiring soon',
    preview: 'Your {amount} store credit will expire in {days} days',
  },
  [EmailTemplate.CREDIT_REDEEMED]: {
    name: 'Credit Redeemed',
    description: 'Sent when a credit is redeemed (fully or partially)',
    subject: 'Your store credit has been redeemed',
    preview: 'You\'ve used {amount} of your store credit',
  },
  [EmailTemplate.CREDIT_BALANCE_UPDATE]: {
    name: 'Credit Balance Update',
    description: 'Sent when a credit balance is updated',
    subject: 'Your store credit balance has been updated',
    preview: 'Your store credit balance has changed to {amount}',
  },
  [EmailTemplate.CUSTOM]: {
    name: 'Custom Message',
    description: 'Custom message to customers',
    subject: 'Message from {shopName}',
    preview: 'Custom message from {shopName}',
  },
  [EmailTemplate.SCHEDULED_REPORT]: {
    name: 'Scheduled Report',
    description: 'Sent when a scheduled report is generated',
    subject: 'Your scheduled report: {reportName}',
    preview: 'Your scheduled report is ready to view',
  }
};

/**
 * Get the appropriate template filename based on template name
 */
export function getTemplateFilename(template: EmailTemplate): string {
  return `${template}.html`;
}

export default EMAIL_TEMPLATES; 