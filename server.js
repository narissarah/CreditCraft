import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import RedisStore from 'connect-redis';
import Redis from 'ioredis';
import { join } from 'path';
import { initializeShopify } from './src/auth/shopifyAuthHandler';
import { shopifySessionMiddleware, ensureEmbeddedApp } from './src/middleware/sessionMiddleware';
import { initializeSessionStorage, StorageType } from './src/session/sessionManager';
import { logger } from './src/utils/logger';
import { setupReportProcessingCron } from './src/scripts/processScheduledReports';

// Import routes
import authRoutes from './src/routes/authRoutes';

// ES Modules compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.SHOPIFY_APP_URL 
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true
}));

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure session
let sessionConfig = {
  secret: process.env.SESSION_SECRET || 'shopify-app-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Use Redis for session storage in production
if (process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
  try {
    const redisClient = new Redis(process.env.REDIS_URL);
    
    redisClient.on('error', (err) => {
      logger.error('Redis session error:', err);
    });
    
    // Initialize Redis store
    const redisStore = new RedisStore({
      client: redisClient,
      prefix: 'shopify_session:'
    });
    
    // Update session config to use Redis
    sessionConfig.store = redisStore;
    logger.info('Using Redis for session storage');
  } catch (error) {
    logger.error('Failed to initialize Redis session store:', error);
  }
}

// Apply session middleware
app.use(session(sessionConfig));

// Initialize session storage for Shopify API
const sessionStorageType = process.env.NODE_ENV === 'production' && process.env.REDIS_URL
  ? StorageType.REDIS
  : process.env.DATABASE_URL ? StorageType.DATABASE : StorageType.MEMORY;

// Initialize session storage with appropriate type
initializeSessionStorage(sessionStorageType, {
  redis: process.env.REDIS_URL
});

// Initialize Shopify API
initializeShopify();

// Apply Shopify session middleware to automatically load sessions
app.use(shopifySessionMiddleware());

// Ensure app is embedded in Shopify Admin (if configured)
app.use(ensureEmbeddedApp());

// Auth routes
app.use('/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    environment: process.env.NODE_ENV,
    shop: req.shopifySession?.shop || null
  });
});

// API Routes placeholder - to be expanded later
app.use('/api/v1', (req, res) => {
  res.status(200).json({ message: 'CreditCraft API v1' });
});

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the 'dist' directory
  app.use(express.static(join(__dirname, 'dist')));

  // For all requests that don't match API routes, serve the app
  app.get('*', (req, res) => {
    res.sendFile(join(__dirname, 'dist', 'index.html'));
  });
}

// Start the server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start report processing cron job
  if (process.env.ENABLE_REPORT_PROCESSOR !== 'false') {
    const reportCronJob = setupReportProcessingCron('0 */1 * * *'); // Run every hour
    logger.info('Report processor cron job started');
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, stopping report processor job');
      reportCronJob.stop();
    });
  }
});

export default app; 