import { Request, Response, NextFunction } from 'express';
import { shopify } from '../config/shopify';
import { logger } from '../utils/logger';
import crypto from 'crypto';

/**
 * OAuth handler for Shopify authentication
 */
export const oauthHandler = {
  /**
   * Begin OAuth flow by redirecting to Shopify authorization URL
   * @param {Request} req Express request
   * @param {Response} res Express response
   */
  beginAuth: async (req: Request, res: Response) => {
    // Get shop from query parameter
    const shop = req.query.shop as string;
    
    // Validate shop parameter
    if (!shop || typeof shop !== 'string') {
      logger.error('Missing or invalid shop parameter');
      return res.status(400).send('Missing or invalid shop parameter');
    }
    
    // Generate a nonce for CSRF protection
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Store the nonce in session for verification during callback
    if (req.session) {
      req.session.shopifyNonce = nonce;
      req.session.shop = shop;
    }
    
    try {
      // Generate the authorization URL
      const authRoute = await shopify.auth.begin({
        shop,
        callbackPath: '/auth/callback',
        isOnline: false, // Use offline access mode for long-lived tokens
        state: nonce,
      });
      
      logger.info(`Redirecting to Shopify auth: ${shop}`);
      res.redirect(authRoute);
    } catch (error) {
      logger.error('Error during auth begin:', error);
      res.status(500).send('Error initiating authentication process');
    }
  },
  
  /**
   * Handle OAuth callback from Shopify
   * @param {Request} req Express request
   * @param {Response} res Express response
   */
  handleCallback: async (req: Request, res: Response) => {
    try {
      // Validate the callback
      const callbackResponse = await shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });
      
      // The above validates HMAC, nonce/state and shop, and exchanges code for access token
      const { session } = callbackResponse;
      
      // Store session in your session storage
      await shopify.session.storeSessions([session]);
      
      // Get shop from session
      const shop = session.shop;
      
      logger.info(`Authentication successful for shop: ${shop}`);
      
      // Now we need to set up webhooks for this shop
      await registerWebhooks(session);
      
      // Redirect to app home or embedded app URL
      res.redirect(`/?shop=${shop}`);
    } catch (error) {
      logger.error('Error during auth callback:', error);
      
      // Extract shop from session if available for redirect back to auth
      const shop = req.session?.shop || req.query.shop;
      
      if (shop) {
        // Redirect back to auth with the shop parameter
        return res.redirect(`/auth?shop=${shop}`);
      }
      
      // If we don't have a shop, redirect to a generic error page
      res.status(500).send('Authentication failed. Please try again.');
    }
  },
  
  /**
   * Middleware to check if a session exists and is valid
   * @param {Request} req Express request
   * @param {Response} res Express response
   * @param {NextFunction} next Express next function
   */
  verifySession: async (req: Request, res: Response, next: NextFunction) => {
    // Get shop from query or session
    const shop = (req.query.shop as string) || (req.session?.shop as string);
    
    if (!shop) {
      logger.warn('No shop found in session or query');
      return res.redirect('/auth/begin');
    }
    
    try {
      // Look up session by shop
      const sessionDetails = await shopify.session.findSessionsByShop(shop);
      
      if (sessionDetails.length === 0) {
        logger.warn(`No session found for shop: ${shop}`);
        return res.redirect(`/auth?shop=${shop}`);
      }
      
      // Sort sessions by expiration, get most recent
      const session = sessionDetails.sort((a, b) => 
        (b.expires?.getTime() || 0) - (a.expires?.getTime() || 0)
      )[0];
      
      // Check if session is expired
      if (session.expires && new Date() > session.expires) {
        logger.warn(`Session expired for shop: ${shop}`);
        return res.redirect(`/auth?shop=${shop}`);
      }
      
      // Attach session to request for use in route handlers
      req.shopifySession = session;
      next();
    } catch (error) {
      logger.error('Error verifying session:', error);
      res.redirect(`/auth?shop=${shop}`);
    }
  }
};

/**
 * Register webhooks for a shop
 * @param {Session} session Shopify session
 */
async function registerWebhooks(session: any) {
  try {
    // Define the webhooks to register
    const webhookTopics = [
      'orders/create',
      'orders/updated',
      'orders/cancelled',
      'customers/create',
      'customers/update',
      'app/uninstalled',
    ];
    
    const host = process.env.SHOPIFY_APP_URL;
    
    // Register each webhook
    for (const topic of webhookTopics) {
      try {
        const response = await shopify.webhooks.addHandlers({
          [topic]: {
            deliveryMethod: shopify.webhooks.DeliveryMethod.Http,
            callbackUrl: `${host}/api/webhooks/${topic.replace('/', '-')}`,
          },
        });
        
        logger.info(`Registered webhook: ${topic}`);
      } catch (webhookError) {
        logger.error(`Failed to register webhook ${topic}:`, webhookError);
      }
    }
  } catch (error) {
    logger.error('Error registering webhooks:', error);
    throw error;
  }
}

// Export the OAuth handler
export default oauthHandler; 