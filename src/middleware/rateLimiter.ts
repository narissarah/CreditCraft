/**
 * Rate limiting middleware for CreditCraft
 * 
 * Implements tiered rate limiting with Redis-backed storage for distributed environments.
 */

import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { logger } from '../utils/logger';

// Attempt to connect to Redis
let redisClient: Redis | null = null;
try {
  redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    enableTLS: process.env.REDIS_TLS_ENABLED === 'true',
    password: process.env.REDIS_PASSWORD,
    retryStrategy: (times) => Math.min(times * 50, 2000)
  });
  
  redisClient.on('error', (err) => {
    logger.error(`Redis connection error: ${err.message}`);
  });
  
  logger.info('Redis connection established for rate limiter');
} catch (error) {
  logger.warn(`Redis connection failed: ${error.message}. Using in-memory fallback.`);
  redisClient = null;
}

// Rate limit tiers configuration
interface RateLimitTier {
  points: number;        // Max requests in the window  
  duration: number;      // Window duration in seconds
  keyPrefix: string;     // Redis key prefix
  errorMessage: string;  // Custom error message
}

// Define rate limit tiers
const rateLimitTiers: Record<string, RateLimitTier> = {
  standard: {
    points: parseInt(process.env.RATE_LIMIT_STANDARD || '100'),
    duration: parseInt(process.env.RATE_LIMIT_WINDOW || '60000') / 1000,
    keyPrefix: 'rl:standard',
    errorMessage: 'Too many requests, please try again later.'
  },
  auth: {
    points: parseInt(process.env.RATE_LIMIT_AUTH || '5'),
    duration: parseInt(process.env.RATE_LIMIT_WINDOW || '60000') / 1000,
    keyPrefix: 'rl:auth',
    errorMessage: 'Too many authentication attempts, please try again later.'
  },
  pos: {
    points: parseInt(process.env.RATE_LIMIT_POS || '20'),
    duration: parseInt(process.env.RATE_LIMIT_WINDOW || '60000') / 1000,
    keyPrefix: 'rl:pos',
    errorMessage: 'Too many POS requests, please try again later.'
  },
  admin: {
    points: parseInt(process.env.RATE_LIMIT_ADMIN || '200'),
    duration: parseInt(process.env.RATE_LIMIT_WINDOW || '60000') / 1000,
    keyPrefix: 'rl:admin',
    errorMessage: 'Too many administration requests, please try again later.'
  },
};

// Create rate limiters for each tier
const createRateLimiter = (tier: RateLimitTier) => {
  if (redisClient) {
    return new RateLimiterRedis({
      storeClient: redisClient,
      keyPrefix: tier.keyPrefix,
      points: tier.points,
      duration: tier.duration,
      inMemoryBlockOnConsumed: tier.points + 1, // Block when over limit
      inMemoryBlockDuration: tier.duration, // Block for the duration
    });
  }
  
  // In-memory fallback
  return new RateLimiterRedis({
    keyPrefix: tier.keyPrefix,
    points: tier.points,
    duration: tier.duration,
    inMemoryBlockOnConsumed: tier.points + 1,
    inMemoryBlockDuration: tier.duration,
  });
};

// Initialize rate limiters for each tier
const rateLimiters: Record<string, RateLimiterRedis> = Object.fromEntries(
  Object.entries(rateLimitTiers).map(([name, tier]) => [name, createRateLimiter(tier)])
);

// Parse trusted IPs from environment variable
const trustedIps = (process.env.TRUSTED_IPS || '127.0.0.1')
  .split(',')
  .map(ip => ip.trim());

// Get client IP from request
const getClientIp = (req: Request): string => {
  // Support for X-Forwarded-For header for clients behind a proxy
  const xForwardedFor = req.headers['x-forwarded-for'] as string;
  
  if (xForwardedFor) {
    // Get the first IP in the list (client's original IP)
    const firstIp = xForwardedFor.split(',')[0].trim();
    return firstIp;
  }
  
  return req.ip || '0.0.0.0';
};

// Check if request is from a trusted IP
const isFromTrustedIp = (req: Request): boolean => {
  const clientIp = getClientIp(req);
  return trustedIps.includes(clientIp);
};

// Check if request is a health check
const isHealthCheck = (req: Request): boolean => {
  return req.path.includes('/health') || req.path.includes('/api/health');
};

// Check if request has valid admin API key
const hasValidAdminKey = (req: Request): boolean => {
  const adminKey = req.headers['x-admin-api-key'];
  return adminKey === process.env.ADMIN_API_KEY;
};

// Check if request is a webhook with valid signature
const isValidWebhook = (req: Request): boolean => {
  // Basic check for webhook path and expected header
  if (!req.path.includes('/webhooks') || !req.headers['x-shopify-hmac-sha256']) {
    return false;
  }
  
  // Note: We don't do full HMAC validation here because that requires 
  // the raw body which is only available as a promise/async operation
  // Full validation is done in the webhook routes middleware
  
  // Check for expected Shopify webhook headers
  const hasShopHeader = !!req.headers['x-shopify-shop-domain'];
  const hasTopicHeader = !!req.headers['x-shopify-topic'];
  const hasTimestampHeader = !!req.headers['x-shopify-api-version'];
  
  return hasShopHeader && hasTopicHeader && hasTimestampHeader;
};

// Check for rate limit exemptions
const isExempt = (req: Request): boolean => {
  return (
    isFromTrustedIp(req) ||
    isHealthCheck(req) ||
    hasValidAdminKey(req) ||
    isValidWebhook(req)
  );
};

// Create middleware for a specific rate limit tier
export const createRateLimitMiddleware = (tierName: string) => {
  const tier = rateLimitTiers[tierName];
  const limiter = rateLimiters[tierName];
  
  if (!tier || !limiter) {
    throw new Error(`Rate limit tier '${tierName}' not found`);
  }
  
  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip rate limiting for exempt requests
    if (isExempt(req)) {
      return next();
    }
    
    // Determine the rate limit key
    let key = getClientIp(req);
    
    // Add user ID if authenticated
    if (req.user && req.user.id) {
      key = `user:${req.user.id}`;
    }
    
    // Add shop ID if present (for shop-specific rate limiting)
    const shopId = req.headers['x-shop-id'] || req.query.shop_id;
    if (shopId) {
      key = `shop:${shopId}`;
    }
    
    try {
      const rateLimiterRes = await limiter.consume(key);
      
      // Add rate limit headers to response
      applyRateLimitHeaders(res, rateLimiterRes, tier);
      
      next();
    } catch (rejRes) {
      if (rejRes instanceof RateLimiterRes) {
        // Apply rate limit headers to response
        applyRateLimitHeaders(res, rejRes, tier);
        
        // Log rate limit hit
        logger.warn(`Rate limit exceeded - Tier: ${tierName}, IP: ${key}`);
        
        // Return rate limit exceeded response
        return res
          .status(429)
          .json({
            error: tier.errorMessage,
            retryAfter: Math.round(rejRes.msBeforeNext / 1000) || 60
          });
      } else {
        // Rate limiter error - skip rate limiting and log error
        logger.error(`Rate limiter error: ${rejRes.message}`);
        next();
      }
    }
  };
};

// Apply rate limit headers to response
const applyRateLimitHeaders = (
  res: Response, 
  rateLimiterRes: RateLimiterRes, 
  tier: RateLimitTier
) => {
  // RFC-compatible headers for rate limiting
  res.setHeader('RateLimit-Limit', tier.points);
  res.setHeader('RateLimit-Remaining', rateLimiterRes.remainingPoints);
  
  // Set reset time in Unix time (seconds)
  const resetTimeSeconds = Math.round(Date.now() / 1000) + 
    Math.round(rateLimiterRes.msBeforeNext / 1000);
  res.setHeader('RateLimit-Reset', resetTimeSeconds);
  
  // Add Retry-After header for 429 responses
  if (rateLimiterRes.remainingPoints <= 0) {
    const retrySeconds = Math.round(rateLimiterRes.msBeforeNext / 1000) || 60;
    res.setHeader('Retry-After', retrySeconds);
  }
};

// Export ready-to-use middlewares for each tier
export const standardRateLimit = createRateLimitMiddleware('standard');
export const authRateLimit = createRateLimitMiddleware('auth');
export const posRateLimit = createRateLimitMiddleware('pos');
export const adminRateLimit = createRateLimitMiddleware('admin');

// Export the isExempt function for use in other rate limit related code
export { isExempt }; 