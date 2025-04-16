import { Request, Response } from 'express';
import { testDatabaseConnection } from '../src/utils/dbTest';
import { prisma } from '../prisma/client';

/**
 * API health check endpoint
 * Tests the database connection and other services
 */
export default async function healthCheck(req: Request, res: Response) {
  try {
    // Check database connection
    const dbConnected = await testDatabaseConnection();
    
    // Basic service checks
    const services = {
      api: true,
      database: dbConnected,
      // Add more service checks as needed
    };
    
    // Count entities for basic data check
    const counts = {
      customers: await prisma.customer.count(),
      credits: await prisma.credit.count(),
      transactions: await prisma.transaction.count(),
    };
    
    // Get system information
    const system = {
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
    
    // Overall status
    const allServicesHealthy = Object.values(services).every(Boolean);
    
    // Return health status
    return res.status(allServicesHealthy ? 200 : 503).json({
      status: allServicesHealthy ? 'healthy' : 'unhealthy',
      services,
      counts,
      system,
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
} 