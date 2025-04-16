import { Request, Response, NextFunction } from 'express';
import { Session } from '@shopify/shopify-api';
import { loadSession, getActiveShopSession } from '../session/sessionManager';
import { logger } from '../utils/logger';
import { authConfig } from '../config/auth';

/**
 * Extract shop domain from request (query, header, or session)
 */
function extractShopFromRequest(req: Request): string | undefined {
  // Check query parameters first
  if (req.query.shop) {
    return req.query.shop as string;
  }
  
  // Check headers for shop
  if (req.headers['x-shopify-shop-domain']) {
    return req.headers['x-shopify-shop-domain'] as string;
  }
  
  // Check session for shop
  if (req.session?.shop) {
    return req.session.shop;
  }
  
  return undefined;
}

/**
 * Extract session ID from authorization header
 */
function extractSessionIdFromHeader(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }
  
  return authHeader.replace('Bearer ', '');
}

/**
 * Middleware to load Shopify session and attach to request
 * This doesn't enforce authentication, just attaches the session if found
 */
export function shopifySessionMiddleware() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let session: Session | undefined;
      
      // Try to get session ID from Authorization header
      const sessionId = extractSessionIdFromHeader(req);
      if (sessionId) {
        session = await loadSession(sessionId);
        if (session) {
          logger.debug(`Session loaded from header: ${sessionId}`);
          req.shopifySession = session;
          return next();
        }
      }
      
      // Try to get session from shop in request
      const shop = extractShopFromRequest(req);
      if (shop) {
        session = await getActiveShopSession(shop);
        if (session) {
          logger.debug(`Active session found for shop: ${shop}`);
          req.shopifySession = session;
        }
      }
      
      next();
    } catch (error) {
      logger.error('Error in Shopify session middleware:', error);
      next();
    }
  };
}

/**
 * Middleware to enforce Shopify authentication
 * Redirects to auth flow if no valid session is found
 */
export function requireShopifyAuth(options: { 
  returnTo?: string,
  scopes?: string[] 
} = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Check if we have a Shopify session
      if (req.shopifySession) {
        // Check if session is valid
        if (!req.shopifySession.expires || new Date(req.shopifySession.expires) > new Date()) {
          // Check if scopes match
          if (!options.scopes || options.scopes.every(scope => 
            req.shopifySession?.scope?.split(',').includes(scope))) {
            return next();
          }
        }
      }
      
      // Get shop from request
      const shop = extractShopFromRequest(req);
      if (!shop) {
        return res.status(400).send({
          error: 'missing_shop',
          message: 'Shop parameter is required'
        });
      }
      
      // Store the return URL in session
      if (options.returnTo || req.originalUrl) {
        req.session.returnTo = options.returnTo || req.originalUrl;
      }
      
      // Redirect to auth
      const authPath = `/auth?shop=${shop}`;
      logger.debug(`Redirecting to Shopify auth: ${authPath}`);
      res.redirect(authPath);
    } catch (error) {
      logger.error('Error in requireShopifyAuth middleware:', error);
      next(error);
    }
  };
}

/**
 * Middleware to ensure the request is from the embedded app
 */
export function ensureEmbeddedApp() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip for auth routes
    if (req.path.startsWith('/auth') || req.path.startsWith('/api/webhooks')) {
      return next();
    }
    
    const shop = extractShopFromRequest(req);
    
    // If no shop or not an HTML request, continue
    if (!shop || !req.accepts('html')) {
      return next();
    }
    
    // Check if we're already in the iframe
    const embedded = req.query.embedded === '1';
    
    if (!embedded && authConfig.shopify.embedded) {
      const embeddedUrl = `https://${shop}/admin/apps/${authConfig.shopify.apiKey}${req.path}`;
      return res.redirect(embeddedUrl);
    }
    
    next();
  };
} 