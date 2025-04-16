import express from 'express';
import { isAdmin } from '../../middleware/admin';
import { logger } from '../../utils/logger';
import QueueRegistry from '../../lib/queueRegistry';
import creditJob from '../../jobs/creditJob';

const router = express.Router();

// Apply admin middleware to all routes
router.use(isAdmin);

/**
 * Trigger processing of expired credits
 * 
 * This endpoint allows admins to manually trigger the processing of
 * expired credits outside of the scheduled job
 */
router.post('/credits/process-expired', async (req, res) => {
  try {
    logger.info('Admin manually triggered expired credits processing');
    
    const queueRegistry = QueueRegistry.getInstance();
    const creditQueue = queueRegistry.getQueue('credit');
    
    // Add a job to the queue to process expired credits
    const job = await creditJob.triggerExpiredCreditsProcessing(creditQueue);
    
    res.json({
      success: true,
      message: 'Expired credits processing job triggered',
      jobId: job.id
    });
  } catch (error) {
    logger.error('Error triggering expired credits processing:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
});

/**
 * Get job status
 * 
 * This endpoint allows admins to check the status of a specific job
 */
router.get('/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { queue } = req.query;
    
    if (!queue) {
      return res.status(400).json({
        success: false,
        error: 'Queue name is required'
      });
    }
    
    const queueRegistry = QueueRegistry.getInstance();
    const jobQueue = queueRegistry.getQueue(queue as string);
    
    if (!jobQueue) {
      return res.status(404).json({
        success: false,
        error: `Queue "${queue}" not found`
      });
    }
    
    const job = await jobQueue.getJob(id);
    
    if (!job) {
      return res.status(404).json({
        success: false,
        error: `Job "${id}" not found in queue "${queue}"`
      });
    }
    
    const state = await job.getState();
    const progress = job._progress;
    const result = job.returnvalue;
    
    res.json({
      success: true,
      job: {
        id: job.id,
        state,
        progress,
        result,
        data: job.data,
        timestamp: job.timestamp
      }
    });
  } catch (error) {
    logger.error(`Error getting job status: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      success: false,
      error: 'Failed to get job status'
    });
  }
});

export default router; 