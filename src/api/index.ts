import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import posApiRoutes from '../routes/posApi';
import webhookRoutes from '../routes/webhookRoutes';
import customerRoutes from '../routes/customerRoutes';
import { 
  standardLimiter, 
  strictLimiter, 
  authLimiter, 
  webhookLimiter,
  createWhitelistLimiter,
  globalRateLimitSettings
} from '../middleware/rateLimiter';
import { rateLimitMonitor, getRateLimitViolationStats } from '../middleware/rateLimitMonitor';
import { verifyApiAuth } from '../auth/authMiddleware';
import creditsRouter from './routes/credits';
import adminRouter from './routes/admin';
import transactionsRouter from './routes/transactions';
import posRouter from '../routes/posApi';
import healthRouter from './health';
import { sentryRequestHandler, sentryErrorHandler, initializeErrorTracking } from '../config/monitoring';
import notificationRoutes from '../routes/notificationRoutes';

// Initialize express app
const app = express();

// Initialize error tracking
initializeErrorTracking();

// Apply Sentry request handler - must be first
if (process.env.SENTRY_DSN) {
  app.use(sentryRequestHandler());
}

// Apply global middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.SHOPIFY_APP_URL || '', 'https://*.myshopify.com'] 
    : '*',
  credentials: true,
}));

// For regular routes, parse JSON body
const jsonParser = express.json();
const urlencodedParser = express.urlencoded({ extended: true });

// For webhook routes, we need the raw body for HMAC verification
// This middleware preserves the raw body for webhook routes
app.use((req, res, next) => {
  const isWebhookPath = req.path.includes('/api/webhooks');
  
  if (isWebhookPath) {
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk.toString(); });
    req.on('end', () => {
      (req as any).rawBody = rawBody;
      
      // Parse JSON body after capturing raw body
      try {
        req.body = JSON.parse(rawBody);
      } catch (error) {
        console.error('Error parsing webhook body:', error);
      }
      
      next();
    });
  } else {
    // For non-webhook routes, use standard body parsers
    jsonParser(req, res, () => {
      urlencodedParser(req, res, next);
    });
  }
});

// Apply rate limit monitoring
app.use(rateLimitMonitor());

// Apply IP whitelist if configured
const whitelistedIps = globalRateLimitSettings.whitelistedIps;
if (whitelistedIps.length > 0) {
  console.log(`Rate limit whitelist configured with ${whitelistedIps.length} IPs`);
}

// Health endpoint without rate limiting and authentication
app.use('/api', healthRouter);

// Apply standard rate limiting globally if enabled
if (globalRateLimitSettings.enabled) {
  if (whitelistedIps.length > 0) {
    app.use(createWhitelistLimiter(whitelistedIps, {
      max: globalRateLimitSettings.standardMax,
      windowMs: globalRateLimitSettings.standardWindow,
    }));
  } else {
    app.use(standardLimiter);
  }
}

// Register POS API routes with base path and rate limiting
app.use('/api/pos', globalRateLimitSettings.enabled ? strictLimiter : (req, res, next) => next(), posRouter);

// Apply strict rate limiting to admin routes
app.use('/api/admin', 
  globalRateLimitSettings.enabled ? strictLimiter : (req, res, next) => next(),
  verifyApiAuth, 
  adminRouter
);

// Apply very strict rate limiting to auth routes
app.use('/api/auth', 
  globalRateLimitSettings.enabled ? authLimiter : (req, res, next) => next(),
  // Auth routes would be defined here
);

// Apply webhook-specific rate limiting to webhook endpoints
app.use('/api/webhooks', 
  globalRateLimitSettings.enabled ? webhookLimiter : (req, res, next) => next(),
  webhookRoutes
);

// Register routes
app.use('/credits', creditsRouter);
app.use('/transactions', transactionsRouter);
app.use('/api/customers', customerRoutes);
app.use('/api/notifications', notificationRoutes);

// Rate limit statistics endpoint (protected)
app.get('/api/admin/rate-limit-stats', verifyApiAuth, (req, res) => {
  try {
    // Get real stats from the rate limit monitor
    const stats = getRateLimitViolationStats();
    
    res.json({
      status: 'success',
      data: stats,
      rateLimitSettings: {
        standard: parseInt(process.env.RATE_LIMIT_STANDARD || '100'),
        auth: parseInt(process.env.RATE_LIMIT_AUTH || '5'),
        pos: parseInt(process.env.RATE_LIMIT_POS || '20'),
        admin: parseInt(process.env.RATE_LIMIT_ADMIN || '200'),
        window: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
      }
    });
  } catch (error) {
    console.error('Error retrieving rate limit stats:', error);
    res.status(500).json({ error: 'Error retrieving rate limit statistics' });
  }
});

// Apply Sentry error handler - must be before other error handlers
if (process.env.SENTRY_DSN) {
  app.use(sentryErrorHandler());
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      rateLimiting: globalRateLimitSettings.enabled ? 'enabled' : 'disabled'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', error: 'Health check failed' });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err);
  
  // Don't expose internal errors to clients
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 
    ? 'Internal server error' 
    : err.message || 'Something went wrong';
  
  res.status(statusCode).json({
    error: message,
    status: 'error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    status: 'error'
  });
});

export default app; 