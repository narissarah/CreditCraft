import { Queue, JobOptions, Job } from 'bull';
import BullQueue, { JobData, JobProcessor } from './queue';
import { logger } from '../utils/logger';
import { redisConfig } from '../config/redis';

export class QueueRegistry {
  private static instance: QueueRegistry;
  private queues: Map<string, BullQueue<any>> = new Map();
  private monitorInterval: NodeJS.Timeout | null = null;
  
  /**
   * Get the QueueRegistry singleton instance
   */
  public static getInstance(): QueueRegistry {
    if (!QueueRegistry.instance) {
      QueueRegistry.instance = new QueueRegistry();
    }
    return QueueRegistry.instance;
  }
  
  /**
   * Create or get a queue by name
   * @param name - Queue name
   * @returns The Bull queue instance
   */
  public createQueue<T extends JobData>(name: string): BullQueue<T> {
    if (this.queues.has(name)) {
      return this.queues.get(name) as BullQueue<T>;
    }
    
    const queue = new BullQueue<T>(name);
    this.queues.set(name, queue);
    return queue;
  }
  
  /**
   * Get a queue by name
   * @param name - Queue name
   * @returns The Bull queue instance or undefined if not found
   */
  public getQueue<T extends JobData>(name: string): BullQueue<T> | undefined {
    return this.queues.get(name) as BullQueue<T> | undefined;
  }
  
  /**
   * Add a job to a queue
   * @param queueName - Queue name
   * @param data - Job data
   * @param options - Optional job options
   * @returns The created job
   */
  public async addJob<T extends JobData>(queueName: string, data: T, options?: JobOptions): Promise<Job<T>> {
    const queue = this.createQueue<T>(queueName);
    return queue.add(data, options);
  }
  
  /**
   * Process jobs from a queue
   * @param queueName - Queue name
   * @param processor - Function to process jobs
   * @param concurrency - Number of jobs to process concurrently
   */
  public processQueue<T extends JobData>(queueName: string, processor: JobProcessor<T>, concurrency = 1): void {
    const queue = this.createQueue<T>(queueName);
    queue.process(processor, concurrency);
  }
  
  /**
   * Get metrics for all queues
   * @returns Map of queue names to metrics
   */
  public async getMetrics(): Promise<Map<string, any>> {
    const metricsMap = new Map<string, any>();
    
    for (const [name, queue] of this.queues.entries()) {
      try {
        const metrics = await queue.getMetrics();
        metricsMap.set(name, metrics);
      } catch (error) {
        logger.error(`Failed to get metrics for queue '${name}': ${error instanceof Error ? error.message : String(error)}`);
        metricsMap.set(name, { error: 'Failed to get metrics' });
      }
    }
    
    return metricsMap;
  }
  
  /**
   * Start monitoring queues
   * @param interval - Monitor interval in milliseconds (default: from config)
   */
  public startMonitoring(interval = redisConfig.monitorInterval): void {
    // Stop existing monitoring if running
    this.stopMonitoring();
    
    logger.info(`Starting queue monitoring with interval ${interval}ms`);
    
    this.monitorInterval = setInterval(async () => {
      try {
        const metrics = await this.getMetrics();
        
        for (const [name, queueMetrics] of metrics.entries()) {
          // Check for queues with high failure rates
          if (queueMetrics.failed > 0) {
            const failureRate = queueMetrics.failed / (queueMetrics.completed + queueMetrics.failed);
            
            if (failureRate > 0.1) { // Over 10% failure rate
              logger.warn(`Queue '${name}' has a high failure rate: ${(failureRate * 100).toFixed(1)}%`);
            }
          }
          
          // Check for queues with long backlogs
          if (queueMetrics.waiting > redisConfig.alertThresholds.queueSize) {
            logger.warn(`Queue '${name}' has a large backlog: ${queueMetrics.waiting} waiting jobs`);
          }
        }
      } catch (error) {
        logger.error(`Queue monitoring error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, interval);
  }
  
  /**
   * Stop monitoring queues
   */
  public stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      logger.info('Queue monitoring stopped');
    }
  }
  
  /**
   * Clean all queues
   * @param grace - Grace period in milliseconds
   * @param status - Job status to clean
   */
  public async cleanAllQueues(grace = 24 * 60 * 60 * 1000, status: 'completed' | 'failed' = 'completed'): Promise<void> {
    for (const [name, queue] of this.queues.entries()) {
      try {
        const count = await queue.clean(grace, status);
        logger.info(`Cleaned ${count} ${status} jobs from queue '${name}'`);
      } catch (error) {
        logger.error(`Failed to clean queue '${name}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
  
  /**
   * Close all queues
   */
  public async closeAll(): Promise<void> {
    for (const [name, queue] of this.queues.entries()) {
      try {
        await queue.close();
      } catch (error) {
        logger.error(`Failed to close queue '${name}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    this.stopMonitoring();
    this.queues.clear();
    logger.info('All queues closed');
  }
  
  /**
   * Perform a health check on all queues
   * @returns Object with health status for each queue
   */
  public async healthCheck(): Promise<{ 
    overall: boolean; 
    queues: Record<string, boolean>;
  }> {
    const health = {
      overall: true,
      queues: {} as Record<string, boolean>
    };
    
    // If no queues, still healthy
    if (this.queues.size === 0) {
      return health;
    }
    
    for (const [name, queue] of this.queues.entries()) {
      try {
        const metrics = await queue.getMetrics();
        // Queue is considered healthy if we can get metrics
        health.queues[name] = true;
      } catch (error) {
        logger.error(`Queue '${name}' health check failed: ${error instanceof Error ? error.message : String(error)}`);
        health.queues[name] = false;
        health.overall = false;
      }
    }
    
    return health;
  }
}

export default QueueRegistry; 