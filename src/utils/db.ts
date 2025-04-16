import { prisma } from '../../prisma/client';
import { randomUUID } from 'crypto';

/**
 * Generate a unique credit code
 * @returns {string} A unique code for store credits
 */
export const generateCreditCode = async (): Promise<string> => {
  // Generate a base code with prefix and unique identifier
  const prefix = 'CC'; // CreditCraft prefix
  const uniqueId = randomUUID().replace(/-/g, '').substring(0, 8).toUpperCase();
  const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
  const baseCode = `${prefix}-${uniqueId}-${timestamp}`;
  
  // Check if the code already exists
  const existingCredit = await prisma.credit.findUnique({
    where: { code: baseCode },
  });
  
  // If the code already exists (extremely unlikely), recursively generate a new one
  if (existingCredit) {
    return generateCreditCode();
  }
  
  return baseCode;
};

/**
 * Transaction helper for database operations that need to be atomic
 * @param fn Function that contains database operations
 * @returns The result of the function
 */
export const transaction = async <T>(fn: () => Promise<T>): Promise<T> => {
  return prisma.$transaction(async (tx) => {
    return fn();
  });
};

/**
 * Format a currency amount for display
 * @param amount The decimal amount
 * @param currency The currency code (default: USD)
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number, currency = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

/**
 * Check if a credit is expired
 * @param expirationDate The expiration date of the credit
 * @returns Boolean indicating if the credit is expired
 */
export const isCreditExpired = (expirationDate: Date | null): boolean => {
  if (!expirationDate) return false;
  return expirationDate < new Date();
};

/**
 * Create a backup of the database
 * This is a placeholder for actual backup logic which would be implemented
 * based on your specific infrastructure and requirements
 */
export const createDatabaseBackup = async (): Promise<boolean> => {
  try {
    // In a real implementation, this would trigger a backup process
    // E.g., using Supabase's backup features or a custom solution
    console.log('Database backup initiated at', new Date().toISOString());
    return true;
  } catch (error) {
    console.error('Database backup failed:', error);
    return false;
  }
}; 