import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

/**
 * Email configuration options
 */
export interface EmailConfig {
  // General settings
  enabled: boolean;
  defaultFromEmail: string;
  defaultFromName: string;
  
  // Service provider settings
  provider: 'sendgrid' | 'mailgun' | 'ses' | 'smtp' | 'test';
  apiKey?: string;
  region?: string; // For AWS SES
  
  // SMTP settings
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  
  // Tracking settings
  trackOpens: boolean;
  trackClicks: boolean;
  
  // Queue settings
  queueConcurrency: number;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Default configuration with values from environment variables
 */
const config: EmailConfig = {
  enabled: process.env.EMAIL_ENABLED !== 'false',
  defaultFromEmail: process.env.EMAIL_FROM || 'noreply@creditcraft.com',
  defaultFromName: process.env.EMAIL_FROM_NAME || 'CreditCraft',
  
  // Provider settings
  provider: (process.env.EMAIL_PROVIDER as EmailConfig['provider']) || 'test',
  apiKey: process.env.EMAIL_API_KEY,
  region: process.env.EMAIL_REGION || 'us-east-1',
  
  // SMTP settings
  smtpHost: process.env.SMTP_HOST,
  smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587,
  smtpUser: process.env.SMTP_USER,
  smtpPassword: process.env.SMTP_PASSWORD,
  smtpSecure: process.env.SMTP_SECURE === 'true',
  
  // Tracking settings
  trackOpens: process.env.EMAIL_TRACK_OPENS !== 'false',
  trackClicks: process.env.EMAIL_TRACK_CLICKS !== 'false',
  
  // Queue settings
  queueConcurrency: parseInt(process.env.EMAIL_QUEUE_CONCURRENCY || '5', 10),
  maxRetries: parseInt(process.env.EMAIL_MAX_RETRIES || '3', 10),
  retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY || '5000', 10)
};

/**
 * Validates the email configuration
 */
export function validateEmailConfig(): boolean {
  if (!config.enabled) {
    logger.info('Email notifications are disabled');
    return true;
  }
  
  if (config.provider === 'test') {
    logger.warn('Using test email provider - emails will be logged but not sent');
    return true;
  }
  
  // Check required provider-specific settings
  switch (config.provider) {
    case 'sendgrid':
    case 'mailgun':
      if (!config.apiKey) {
        logger.error(`API key is required for ${config.provider}`);
        return false;
      }
      break;
    case 'ses':
      if (!config.apiKey) {
        logger.error('AWS credentials are required for SES');
        return false;
      }
      break;
    case 'smtp':
      if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) {
        logger.error('SMTP host, user, and password are required for SMTP provider');
        return false;
      }
      break;
  }
  
  return true;
}

export default config; 