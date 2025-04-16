import { parseExpression, fieldsToExpression } from 'cron-parser';
import { schedule, validate } from 'node-cron';

/**
 * Utility for working with cron expressions
 */
export const cronParser = {
  /**
   * Validate a cron expression
   * @param expression - The cron expression to validate
   * @returns True if the expression is valid, false otherwise
   */
  isValidCronExpression(expression: string): boolean {
    try {
      return validate(expression);
    } catch (error) {
      return false;
    }
  },

  /**
   * Get the next occurrence of a cron expression
   * @param expression - The cron expression
   * @param timezone - Optional timezone (defaults to UTC)
   * @returns Date object representing the next occurrence
   */
  getNextOccurrence(expression: string, timezone: string = 'UTC'): Date {
    try {
      const options = {
        currentDate: new Date(),
        tz: timezone
      };
      
      const interval = parseExpression(expression, options);
      return interval.next().toDate();
    } catch (error) {
      throw new Error(`Invalid cron expression: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  /**
   * Get multiple upcoming occurrences of a cron expression
   * @param expression - The cron expression
   * @param count - Number of occurrences to get
   * @param timezone - Optional timezone (defaults to UTC)
   * @returns Array of Date objects
   */
  getNextOccurrences(expression: string, count: number = 5, timezone: string = 'UTC'): Date[] {
    try {
      const options = {
        currentDate: new Date(),
        tz: timezone,
        iterator: true
      };
      
      const interval = parseExpression(expression, options);
      const dates: Date[] = [];
      
      for (let i = 0; i < count; i++) {
        const next = interval.next();
        if (next.done) break;
        dates.push(next.value.toDate());
      }
      
      return dates;
    } catch (error) {
      throw new Error(`Invalid cron expression: ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  /**
   * Create a cron expression from individual components
   * @param minutes - Minutes (0-59)
   * @param hours - Hours (0-23)
   * @param dayOfMonth - Day of month (1-31)
   * @param month - Month (1-12)
   * @param dayOfWeek - Day of week (0-6, Sunday to Saturday)
   * @returns Cron expression string
   */
  createCronExpression(
    minutes: string | number = '*',
    hours: string | number = '*',
    dayOfMonth: string | number = '*',
    month: string | number = '*',
    dayOfWeek: string | number = '*'
  ): string {
    return `${minutes} ${hours} ${dayOfMonth} ${month} ${dayOfWeek}`;
  },

  /**
   * Create a cron expression from a frequency
   * @param frequency - 'hourly', 'daily', 'weekly', 'monthly'
   * @param options - Optional configuration for the schedule
   * @returns Cron expression string
   */
  createCronFromFrequency(
    frequency: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly',
    options: {
      minute?: number;
      hour?: number;
      dayOfMonth?: number;
      dayOfWeek?: number;
      month?: number | number[];
    } = {}
  ): string {
    const minute = options.minute !== undefined ? options.minute : 0;
    const hour = options.hour !== undefined ? options.hour : 0;
    
    switch (frequency) {
      case 'hourly':
        return `${minute} * * * *`;
        
      case 'daily':
        return `${minute} ${hour} * * *`;
        
      case 'weekly':
        const dayOfWeek = options.dayOfWeek !== undefined ? options.dayOfWeek : 0; // Sunday by default
        return `${minute} ${hour} * * ${dayOfWeek}`;
        
      case 'monthly':
        const dayOfMonth = options.dayOfMonth !== undefined ? options.dayOfMonth : 1; // First day by default
        return `${minute} ${hour} ${dayOfMonth} * *`;
        
      case 'quarterly':
        const monthsInQuarter = options.month !== undefined 
          ? (Array.isArray(options.month) ? options.month : [options.month]) 
          : [1, 4, 7, 10]; // Jan, Apr, Jul, Oct by default
        
        const monthString = monthsInQuarter.join(',');
        const day = options.dayOfMonth !== undefined ? options.dayOfMonth : 1;
        
        return `${minute} ${hour} ${day} ${monthString} *`;
        
      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }
  },

  /**
   * Get a human-readable description of a cron expression
   * @param expression - The cron expression
   * @returns Human-readable description
   */
  getHumanReadableDescription(expression: string): string {
    try {
      const parts = expression.split(' ');
      if (parts.length !== 5) {
        throw new Error('Invalid cron expression format');
      }
      
      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
      
      // Simple cases
      if (expression === '0 * * * *') return 'Every hour';
      if (expression === '0 0 * * *') return 'Every day at midnight';
      if (expression.match(/^0 0 \* \* [0-6]$/)) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `Every ${days[parseInt(dayOfWeek)]} at midnight`;
      }
      
      // Build description for more complex cases
      let description = 'Runs at ';
      
      if (minute === '*') {
        description += 'every minute';
      } else {
        description += `minute ${minute}`;
      }
      
      if (hour !== '*') {
        description += ` of hour ${hour}`;
      }
      
      if (dayOfMonth !== '*') {
        description += ` on day ${dayOfMonth} of the month`;
      }
      
      if (month !== '*') {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                           'July', 'August', 'September', 'October', 'November', 'December'];
        
        if (month.includes(',')) {
          const months = month.split(',').map(m => {
            const idx = parseInt(m) - 1;
            return monthNames[idx];
          });
          description += ` in ${months.join(', ')}`;
        } else {
          const idx = parseInt(month) - 1;
          description += ` in ${monthNames[idx]}`;
        }
      }
      
      if (dayOfWeek !== '*') {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        if (dayOfWeek.includes(',')) {
          const days = dayOfWeek.split(',').map(d => dayNames[parseInt(d)]);
          description += ` on ${days.join(', ')}`;
        } else {
          description += ` on ${dayNames[parseInt(dayOfWeek)]}`;
        }
      }
      
      return description;
    } catch (error) {
      return 'Invalid cron expression';
    }
  },

  /**
   * Schedule a function to run according to a cron expression
   * @param expression - The cron expression
   * @param func - The function to run
   * @param options - Options for node-cron
   * @returns The scheduled task
   */
  scheduleCronJob(expression: string, func: () => void, options: any = {}): any {
    if (!this.isValidCronExpression(expression)) {
      throw new Error('Invalid cron expression');
    }
    
    return schedule(expression, func, options);
  }
};

export default cronParser; 