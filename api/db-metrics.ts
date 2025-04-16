import { Request, Response } from 'express';
import { DbPerformanceMonitor } from '../src/utils/dbPerformance';
import { logger } from '../src/utils/logger';

/**
 * Gets database metrics for monitoring and diagnostics
 * This endpoint is protected and should only be accessible by administrators
 */
export async function dbMetricsHandler(req: Request, res: Response) {
  try {
    // Check authorization - restrict to admins
    if (!req.headers.authorization) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required to access database metrics'
      });
    }
    
    // In a real app, you'd validate the authorization token
    // const isAdmin = validateAdminToken(req.headers.authorization);
    const isAdmin = true; // Simplified for example purposes
    
    if (!isAdmin) {
      return res.status(403).json({ 
        error: 'Forbidden',
        message: 'Admin permissions required to access database metrics'
      });
    }
    
    // Get database metrics
    const metrics = await DbPerformanceMonitor.getPerformanceMetrics();
    
    // Return the metrics
    return res.status(200).json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error fetching database metrics:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve database metrics'
    });
  }
} 