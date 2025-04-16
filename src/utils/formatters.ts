/**
 * Utility functions for formatting data in a consistent way across the application
 */

/**
 * Format a number as currency with the specified locale and currency code
 * @param amount - The amount to format
 * @param locale - The locale to use (defaults to 'en-US')
 * @param currencyCode - The currency code to use (defaults to 'USD')
 * @returns Formatted currency string (e.g., "$100.00")
 */
export function formatCurrency(
  amount: number, 
  locale = 'en-US', 
  currencyCode = 'USD'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a date in a readable format
 * @param date - The date to format
 * @param locale - The locale to use (defaults to 'en-US')
 * @returns Formatted date string (e.g., "Jan 1, 2023")
 */
export function formatDate(
  date: Date,
  locale = 'en-US'
): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/**
 * Format a date with time in a readable format
 * @param date - The date to format
 * @param locale - The locale to use (defaults to 'en-US')
 * @returns Formatted date and time string (e.g., "Jan 1, 2023, 12:00 PM")
 */
export function formatDateTime(
  date: Date,
  locale = 'en-US'
): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  }).format(date);
}

/**
 * Format a relative time (e.g., "2 hours ago", "in 3 days")
 * @param date - The date to format relative to now
 * @param locale - The locale to use (defaults to 'en-US')
 * @returns Formatted relative time string
 */
export function formatRelativeTime(
  date: Date,
  locale = 'en-US'
): string {
  const now = new Date();
  const diffInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);
  const absSeconds = Math.abs(diffInSeconds);

  // Determine the appropriate unit
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  let value = absSeconds;

  if (absSeconds >= 60) {
    const minutes = Math.floor(absSeconds / 60);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        if (days >= 30) {
          const months = Math.floor(days / 30);
          if (months >= 12) {
            const years = Math.floor(months / 12);
            unit = 'year';
            value = years;
          } else {
            unit = 'month';
            value = months;
          }
        } else {
          unit = 'day';
          value = days;
        }
      } else {
        unit = 'hour';
        value = hours;
      }
    } else {
      unit = 'minute';
      value = minutes;
    }
  }

  // Use the correct sign for past/future
  value = diffInSeconds < 0 ? -value : value;

  return new Intl.RelativeTimeFormat(locale, { 
    numeric: 'auto' 
  }).format(value, unit);
}

/**
 * Format a percentage
 * @param value - The value to format as a percentage
 * @param locale - The locale to use (defaults to 'en-US')
 * @param digits - Number of digits after decimal point (defaults to 1)
 * @returns Formatted percentage string (e.g., "42.0%")
 */
export function formatPercentage(
  value: number,
  locale = 'en-US',
  digits = 1
): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value / 100);
}

/**
 * Truncate a string to a specified length and add ellipsis if needed
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated text with ellipsis if needed
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text;
  }
  return `${text.substring(0, maxLength - 3)}...`;
}

/**
 * Format a phone number to a standardized format
 * @param phoneNumber - The phone number to format
 * @returns Formatted phone number (e.g., "(123) 456-7890")
 */
export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-numeric characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
  } else if (cleaned.length === 11 && cleaned.charAt(0) === '1') {
    return `+1 (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7, 11)}`;
  }
  
  // Return original if we can't format it
  return phoneNumber;
}

/**
 * Format a credit status with appropriate capitalization
 * @param status - The credit status to format
 * @returns Formatted status string with proper capitalization
 */
export function formatCreditStatus(status: string): string {
  if (!status) return '';
  
  // Convert to lowercase, then capitalize first letter
  return status.toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Format a transaction type into a readable format
 */
export function formatTransactionType(type: string): string {
  const typeMap: Record<string, string> = {
    'ISSUE': 'Issued',
    'REDEEM': 'Redeemed',
    'ADJUST': 'Adjusted',
    'CANCEL': 'Cancelled',
    'EXPIRE': 'Expired'
  };
  
  return typeMap[type] || type;
}

/**
 * Format a customer name from first and last name
 */
export function formatCustomerName(firstName?: string, lastName?: string): string {
  if (!firstName && !lastName) return 'Unknown';
  return `${firstName || ''} ${lastName || ''}`.trim();
} 