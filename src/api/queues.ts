import { Request, Response } from 'express';
import QueueRegistry from '../lib/queueRegistry';
import QueueMonitor from '../lib/queueMonitor';
import { logger } from '../utils/logger';

/**
 * Get status of all job queues
 */
export async function getQueueStatus(req: Request, res: Response): Promise<void> {
  try {
    const queueRegistry = QueueRegistry.getInstance();
    const metrics = await queueRegistry.getMetrics();
    
    const result: Record<string, any> = {};
    
    for (const [name, queueMetrics] of metrics.entries()) {
      result[name] = queueMetrics;
    }
    
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to get queue status: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get queue status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get HTML dashboard for queue monitoring
 */
export async function getQueueDashboard(req: Request, res: Response): Promise<void> {
  try {
    const queueMonitor = QueueMonitor.getInstance();
    const html = await queueMonitor.getHtmlDashboard();
    
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    logger.error(`Failed to get queue dashboard: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get queue dashboard',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Run queue maintenance tasks
 */
export async function runQueueMaintenance(req: Request, res: Response): Promise<void> {
  try {
    const queueRegistry = QueueRegistry.getInstance();
    
    // Clean completed jobs older than 24 hours
    await queueRegistry.cleanAllQueues(24 * 60 * 60 * 1000, 'completed');
    
    // Clean failed jobs older than 7 days
    await queueRegistry.cleanAllQueues(7 * 24 * 60 * 60 * 1000, 'failed');
    
    res.json({
      success: true,
      message: 'Queue maintenance completed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to run queue maintenance: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({
      success: false,
      error: 'Failed to run queue maintenance',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Pause a specific queue
 */
export async function pauseQueue(req: Request, res: Response): Promise<void> {
  try {
    const { name } = req.params;
    
    if (!name) {
      res.status(400).json({
        success: false,
        error: 'Queue name is required'
      });
      return;
    }
    
    const queueRegistry = QueueRegistry.getInstance();
    const queue = queueRegistry.getQueue(name);
    
    if (!queue) {
      res.status(404).json({
        success: false,
        error: `Queue '${name}' not found`
      });
      return;
    }
    
    await queue.pause();
    
    res.json({
      success: true,
      message: `Queue '${name}' paused successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to pause queue: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({
      success: false,
      error: 'Failed to pause queue',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Resume a specific queue
 */
export async function resumeQueue(req: Request, res: Response): Promise<void> {
  try {
    const { name } = req.params;
    
    if (!name) {
      res.status(400).json({
        success: false,
        error: 'Queue name is required'
      });
      return;
    }
    
    const queueRegistry = QueueRegistry.getInstance();
    const queue = queueRegistry.getQueue(name);
    
    if (!queue) {
      res.status(404).json({
        success: false,
        error: `Queue '${name}' not found`
      });
      return;
    }
    
    await queue.resume();
    
    res.json({
      success: true,
      message: `Queue '${name}' resumed successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to resume queue: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({
      success: false,
      error: 'Failed to resume queue',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get health status of all queues
 */
export async function getQueueHealth(req: Request, res: Response): Promise<void> {
  try {
    const queueRegistry = QueueRegistry.getInstance();
    const health = await queueRegistry.healthCheck();
    
    res.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Failed to get queue health: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get queue health',
      message: error instanceof Error ? error.message : String(error)
    });
  }
} 