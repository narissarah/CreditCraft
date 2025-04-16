import { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config();

// Configuration from environment variables
const LOG_RATE_LIMIT_VIOLATIONS = process.env.LOG_RATE_LIMIT_VIOLATIONS !== 'false';
const ALERT_ON_RATE_LIMIT_VIOLATIONS = process.env.ALERT_ON_RATE_LIMIT_VIOLATIONS === 'true';
const VIOLATION_THRESHOLD = parseInt(process.env.RATE_LIMIT_VIOLATION_THRESHOLD || '10', 10);

// In-memory store for rate limit violations
// In production, consider using Redis or another persistent store
const violationCounts: Record<string, { count: number; firstViolation: Date; lastViolation: Date }> = {};

/**
 * Tracks rate limit violations by IP and/or shop
 */
export function trackRateLimitViolation(req: Request) {
  if (!LOG_RATE_LIMIT_VIOLATIONS) return;
  
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const shop = (req as any).shop || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';
  const path = req.path || 'unknown';
  
  // Create a key that combines IP and shop if available
  const key = shop !== 'unknown' ? `${ip}:${shop}` : ip;
  
  // Record the violation
  const now = new Date();
  if (!violationCounts[key]) {
    violationCounts[key] = {
      count: 1,
      firstViolation: now,
      lastViolation: now,
    };
  } else {
    violationCounts[key].count += 1;
    violationCounts[key].lastViolation = now;
  }
  
  // Log the violation
  console.warn(`Rate limit exceeded: IP=${ip}, Shop=${shop}, Path=${path}, Count=${violationCounts[key].count}`);
  
  // Check if we should trigger an alert
  if (ALERT_ON_RATE_LIMIT_VIOLATIONS && violationCounts[key].count >= VIOLATION_THRESHOLD) {
    // In a real implementation, you might send an email, Slack notification, or trigger an alert system
    console.error(`ALERT: Rate limit threshold (${VIOLATION_THRESHOLD}) exceeded for ${key}`);
    
    // Additional details for the alert
    const details = {
      ip,
      shop,
      userAgent,
      path,
      count: violationCounts[key].count,
      firstViolation: violationCounts[key].firstViolation,
      lastViolation: violationCounts[key].lastViolation,
      timeSpan: now.getTime() - violationCounts[key].firstViolation.getTime(),
    };
    
    // Send to alert system (this is a placeholder)
    // sendAlert('rate_limit_violation', details);
  }
}

/**
 * Middleware to track rate limit violations
 * This should be applied after the rate limiter middleware
 */
export function rateLimitMonitor() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store the original send method
    const originalSend = res.send;
    
    // Override the send method to detect rate limit violations
    res.send = function(body: any) {
      // Check if this is a rate limit response
      if (res.statusCode === 429) {
        trackRateLimitViolation(req);
      }
      
      // Call the original send method
      return originalSend.call(this, body);
    };
    
    next();
  };
}

/**
 * Get a summary of rate limit violations
 * @returns Object with violation statistics
 */
export function getRateLimitViolationStats() {
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  // Count violations in the last 24 hours
  let recentViolations = 0;
  let totalViolations = 0;
  let topOffenders: Array<{ key: string; count: number }> = [];
  
  Object.entries(violationCounts).forEach(([key, data]) => {
    totalViolations += data.count;
    
    if (data.lastViolation > last24Hours) {
      recentViolations += data.count;
      topOffenders.push({ key, count: data.count });
    }
  });
  
  // Sort offenders by count and get top 10
  topOffenders = topOffenders
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    totalViolations,
    recentViolations,
    topOffenders,
    last24Hours,
    now,
  };
}

/**
 * Clear old violation records (older than 7 days)
 */
export function cleanupOldViolations() {
  const now = new Date();
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days
  
  Object.entries(violationCounts).forEach(([key, data]) => {
    if (data.lastViolation < cutoff) {
      delete violationCounts[key];
    }
  });
}

// Set up periodic cleanup
if (LOG_RATE_LIMIT_VIOLATIONS) {
  // Clean up old violations once a day
  setInterval(cleanupOldViolations, 24 * 60 * 60 * 1000);
} 