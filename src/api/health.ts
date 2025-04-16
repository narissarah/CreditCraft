import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { logger } from '../config/monitoring';

const router = Router();
const prisma = new PrismaClient();

// Create Redis client using environment variables
const redisClient = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL, {
      password: process.env.REDIS_PASSWORD,
      tls: process.env.REDIS_TLS_ENABLED === 'true' ? {} : undefined,
    })
  : null;

/**
 * Health check endpoint for monitoring services
 * Returns a 200 OK status if the application is healthy
 * Returns a 503 Service Unavailable if any critical services are down
 */
router.get('/health', async (req, res) => {
  logger.info('Health check requested', { ip: req.ip });
  
  try {
    const healthResult = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: true,
        database: false,
        redis: false
      },
      version: process.env.npm_package_version || '1.0.0'
    };
    
    // Check database connection
    try {
      // Simple query to check if the database is responsive
      await prisma.$queryRaw`SELECT 1`;
      healthResult.services.database = true;
    } catch (dbError) {
      logger.error('Database health check failed', { error: dbError });
      healthResult.services.database = false;
      healthResult.status = 'degraded';
    }
    
    // Check Redis connection if configured
    if (redisClient) {
      try {
        // Simple ping to check if Redis is responsive
        const pingResult = await redisClient.ping();
        healthResult.services.redis = pingResult === 'PONG';
        
        if (pingResult !== 'PONG') {
          logger.error('Redis health check failed: unexpected ping response', { pingResult });
          healthResult.status = 'degraded';
        }
      } catch (redisError) {
        logger.error('Redis health check failed', { error: redisError });
        healthResult.services.redis = false;
        healthResult.status = 'degraded';
      }
    } else {
      // Redis is not configured - we'll mark as true if it's not required
      // or false if it's critical for the application
      healthResult.services.redis = !process.env.REDIS_REQUIRED || process.env.REDIS_REQUIRED !== 'true';
      
      if (!healthResult.services.redis) {
        healthResult.status = 'degraded';
      }
    }
    
    // Determine HTTP status code
    const criticalServicesDown = !healthResult.services.database || 
      (process.env.REDIS_REQUIRED === 'true' && !healthResult.services.redis);
    
    const statusCode = criticalServicesDown ? 503 : 200;
    if (criticalServicesDown) {
      healthResult.status = 'down';
    }
    
    // Log results for monitoring
    if (healthResult.status !== 'ok') {
      logger.warn('Health check returned non-ok status', { healthResult });
    }
    
    return res.status(statusCode).json(healthResult);
  } catch (error) {
    logger.error('Health check failed with exception', { error });
    
    return res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      message: 'Health check failed',
      services: {
        api: false,
        database: false,
        redis: false
      }
    });
  }
});

export default router; 