import { Router } from 'express';
import * as queueController from '../api/queues';
import QueueMonitor from '../lib/queueMonitor';

// Create router
const router = Router();

// Queue status endpoints
router.get('/status', queueController.getQueueStatus);
router.get('/health', queueController.getQueueHealth);
router.get('/dashboard', queueController.getQueueDashboard);
router.post('/maintenance', queueController.runQueueMaintenance);

// Queue control endpoints
router.post('/:name/pause', queueController.pauseQueue);
router.post('/:name/resume', queueController.resumeQueue);

// Bull Board monitoring dashboard setup
const queueMonitor = QueueMonitor.getInstance();
const basicAuthMiddleware = QueueMonitor.createAuthMiddleware(
  process.env.QUEUE_ADMIN_USER || 'admin',
  process.env.QUEUE_ADMIN_PASSWORD || 'password'
);

// Apply auth middleware to Bull Board routes
router.use('/admin/queues', basicAuthMiddleware, queueMonitor.getRouter());

export default router; 