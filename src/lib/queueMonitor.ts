import { Router } from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import QueueRegistry from './queueRegistry';
import { logger } from '../utils/logger';

export class QueueMonitor {
  private static instance: QueueMonitor;
  private serverAdapter: ExpressAdapter;
  private queueRegistry: QueueRegistry;
  
  private constructor() {
    this.queueRegistry = QueueRegistry.getInstance();
    this.serverAdapter = new ExpressAdapter();
    this.serverAdapter.setBasePath('/admin/queues');
    
    createBullBoard({
      queues: [],
      serverAdapter: this.serverAdapter,
    });
    
    logger.info('Queue monitor initialized');
  }
  
  /**
   * Get the QueueMonitor singleton instance
   */
  public static getInstance(): QueueMonitor {
    if (!QueueMonitor.instance) {
      QueueMonitor.instance = new QueueMonitor();
    }
    return QueueMonitor.instance;
  }
  
  /**
   * Add a queue to the monitoring dashboard
   * @param queueName - Name of the queue to monitor
   */
  public addQueue(queueName: string): void {
    const queue = this.queueRegistry.getQueue(queueName);
    
    if (!queue) {
      logger.warn(`Cannot add queue '${queueName}' to monitor: queue not found`);
      return;
    }
    
    try {
      // Add the queue to the board
      const bullQueue = queue.getQueue();
      const adapter = new BullAdapter(bullQueue);
      
      // @ts-ignore - addQueue exists but not in typings
      createBullBoard({
        queues: [adapter],
        serverAdapter: this.serverAdapter,
      });
      
      logger.info(`Queue '${queueName}' added to monitoring dashboard`);
    } catch (error) {
      logger.error(`Failed to add queue '${queueName}' to monitor: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get the Express router for the monitoring dashboard
   * @returns Express router
   */
  public getRouter(): Router {
    return this.serverAdapter.getRouter();
  }
  
  /**
   * Add all queues to the monitoring dashboard
   */
  public addAllQueues(): void {
    try {
      // Get metrics from registry to see all queues
      this.queueRegistry.getMetrics().then(metrics => {
        for (const queueName of metrics.keys()) {
          this.addQueue(queueName);
        }
      });
    } catch (error) {
      logger.error(`Failed to add all queues to monitor: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Setup middleware to protect queue dashboard (basic auth)
   * @param username - Basic auth username
   * @param password - Basic auth password
   * @returns Middleware function
   */
  public static createAuthMiddleware(username: string, password: string): (req: any, res: any, next: any) => void {
    return (req: any, res: any, next: any) => {
      // Check for basic auth header
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        res.setHeader('WWW-Authenticate', 'Basic realm="Queue Monitor"');
        return res.status(401).send('Authentication required');
      }
      
      // Verify auth credentials
      const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
      const user = auth[0];
      const pass = auth[1];
      
      if (user !== username || pass !== password) {
        return res.status(401).send('Invalid credentials');
      }
      
      next();
    };
  }
  
  /**
   * Get a basic HTML dashboard for queue metrics
   * This is a simple alternative to Bull Board
   */
  public async getHtmlDashboard(): Promise<string> {
    const metrics = await this.queueRegistry.getMetrics();
    
    let html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Queue Metrics Dashboard</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background-color: #f8f9fa; padding: 10px; border-bottom: 1px solid #ddd; }
            .queue { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 5px; overflow: hidden; }
            .queue-name { padding: 10px; background-color: #eee; font-weight: bold; border-bottom: 1px solid #ddd; }
            .queue-metrics { padding: 10px; }
            .metric { margin-bottom: 5px; }
            .warning { color: orange; }
            .error { color: red; }
            .success { color: green; }
            .timestamp { text-align: right; font-size: 0.8em; color: #777; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Queue Metrics Dashboard</h1>
            <div class="timestamp">Generated at: ${new Date().toISOString()}</div>
          </div>
    `;
    
    if (metrics.size === 0) {
      html += '<p>No queues registered</p>';
    } else {
      for (const [name, queueMetrics] of metrics.entries()) {
        const failureRate = queueMetrics.failed > 0 
          ? queueMetrics.failed / (queueMetrics.completed + queueMetrics.failed) 
          : 0;
        
        const failureClass = failureRate > 0.1 ? 'error' : (failureRate > 0.05 ? 'warning' : 'success');
        const backlogClass = queueMetrics.waiting > 100 ? 'warning' : 'success';
        
        html += `
          <div class="queue">
            <div class="queue-name">${name} ${queueMetrics.paused ? '(PAUSED)' : ''}</div>
            <div class="queue-metrics">
              <div class="metric">Waiting: <span class="${backlogClass}">${queueMetrics.waiting}</span></div>
              <div class="metric">Active: ${queueMetrics.active}</div>
              <div class="metric">Completed: ${queueMetrics.completed}</div>
              <div class="metric">Failed: <span class="${queueMetrics.failed > 0 ? 'error' : 'success'}">${queueMetrics.failed}</span></div>
              <div class="metric">Delayed: ${queueMetrics.delayed}</div>
              <div class="metric">Failure Rate: <span class="${failureClass}">${(failureRate * 100).toFixed(1)}%</span></div>
            </div>
          </div>
        `;
      }
    }
    
    html += `
        </body>
      </html>
    `;
    
    return html;
  }
}

export default QueueMonitor; 