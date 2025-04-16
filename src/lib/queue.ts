import Bull, { Queue, JobOptions, Job, QueueOptions } from 'bull';
import { Redis } from 'ioredis';
import RedisClient from './redis';
import { redisConfig } from '../config/redis';
import { logger } from '../utils/logger';

// Type for job data
export interface JobData {
  [key: string]: any;
}

// Generic job processor function type
export type JobProcessor<T extends JobData = JobData> = (job: Job<T>) => Promise<any>;

export class BullQueue<T extends JobData = JobData> {
  private queue: Queue<T>;
  private name: string;
  
  /**
   * Create a new Bull queue
   * @param name - The queue name
   * @param options - Optional Bull queue options
   */
  constructor(name: string, options?: QueueOptions) {
    this.name = name;
    
    // Default options from config
    const defaultOptions: QueueOptions = {
      defaultJobOptions: {
        ...redisConfig.defaultJobOptions,
      },
      // The queue will create its own Redis connections
      // We'll provide the same config as our main Redis client
      redis: {
        host: redisConfig.url.split('://')[1]?.split(':')[0] || 'localhost',
        port: parseInt(redisConfig.url.split(':').pop() || '6379', 10),
        password: redisConfig.password || undefined,
        tls: redisConfig.tls ? {} : undefined,
      }
    };
    
    // Create the Bull queue
    this.queue = new Bull<T>(name, {
      ...defaultOptions,
      ...options,
    });
    
    // Set up event handlers
    this.setupEventHandlers();
    
    logger.info(`Queue '${name}' initialized`);
  }
  
  /**
   * Get the Bull queue instance
   */
  public getQueue(): Queue<T> {
    return this.queue;
  }
  
  /**
   * Add a job to the queue
   * @param data - The job data
   * @param options - Optional job options
   * @returns The created job
   */
  public async add(data: T, options?: JobOptions): Promise<Job<T>> {
    const job = await this.queue.add(data, options);
    logger.debug(`Job ${job.id} added to queue '${this.name}'`);
    return job;
  }
  
  /**
   * Process jobs from the queue
   * @param processor - Function to process jobs
   * @param concurrency - Number of jobs to process concurrently
   */
  public process(processor: JobProcessor<T>, concurrency = 1): void {
    this.queue.process(concurrency, async (job) => {
      try {
        logger.info(`Processing job ${job.id} from queue '${this.name}'`);
        const result = await processor(job);
        logger.info(`Job ${job.id} completed successfully`);
        return result;
      } catch (error) {
        logger.error(`Error processing job ${job.id}: ${error instanceof Error ? error.message : String(error)}`);
        throw error; // Rethrow to let Bull handle retries
      }
    });
    
    logger.info(`Queue '${this.name}' processor registered with concurrency ${concurrency}`);
  }
  
  /**
   * Pause the queue
   */
  public async pause(): Promise<void> {
    await this.queue.pause();
    logger.info(`Queue '${this.name}' paused`);
  }
  
  /**
   * Resume the queue
   */
  public async resume(): Promise<void> {
    await this.queue.resume();
    logger.info(`Queue '${this.name}' resumed`);
  }
  
  /**
   * Close the queue and its Redis connections
   */
  public async close(): Promise<void> {
    await this.queue.close();
    logger.info(`Queue '${this.name}' closed`);
  }
  
  /**
   * Clean the queue by removing completed and failed jobs
   * @param grace - Grace period in milliseconds
   * @param status - Job status to clean
   * @param limit - Maximum number of jobs to clean
   */
  public async clean(grace: number, status: 'completed' | 'failed' | 'delayed' | 'active' | 'wait' = 'completed', limit?: number): Promise<number> {
    const count = await this.queue.clean(grace, status, limit);
    logger.info(`Cleaned ${count} ${status} jobs from queue '${this.name}'`);
    return count;
  }
  
  /**
   * Get queue metrics
   * @returns Object with queue counts
   */
  public async getMetrics(): Promise<{ 
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);
    
    const isPaused = await this.queue.isPaused();
    
    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  }
  
  /**
   * Set up event handlers for the queue
   */
  private setupEventHandlers(): void {
    // Job level events
    this.queue.on('completed', (job) => {
      logger.debug(`Job ${job.id} completed`);
    });
    
    this.queue.on('failed', (job, error) => {
      logger.error(`Job ${job?.id} failed: ${error}`);
    });
    
    this.queue.on('stalled', (job) => {
      logger.warn(`Job ${job.id} stalled`);
    });
    
    // Queue level events
    this.queue.on('error', (error) => {
      logger.error(`Queue '${this.name}' error: ${error}`);
    });
    
    this.queue.on('cleaned', (jobs, type) => {
      logger.info(`Queue '${this.name}' cleaned ${jobs.length} ${type} jobs`);
    });
  }
}

export default BullQueue; 