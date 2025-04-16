import { Request, Response } from 'express';
import Shopify, { AuthQuery } from '@shopify/shopify-api';
import { logger } from '../utils/logger';
import { authConfig } from '../config/auth';
import { storeSession, loadSession, deleteShopSessions } from '../session/sessionManager';

/**
 * Initialize Shopify API with our configuration
 */
export function initializeShopify() {
  try {
    Shopify.Context.initialize({
      API_KEY: authConfig.shopify.apiKey,
      API_SECRET_KEY: authConfig.shopify.apiSecret,
      SCOPES: authConfig.shopify.scopes,
      HOST_NAME: new URL(authConfig.shopify.appUrl).hostname,
      API_VERSION: '2023-10', // Update to latest stable version
      IS_EMBEDDED_APP: authConfig.shopify.embedded,
      SESSION_STORAGE: {
        storeSession: async (session) => {
          return await storeSession(session);
        },
        loadSession: async (id) => {
          return await loadSession(id);
        },
        deleteSession: async (id) => {
          return await deleteSession(id);
        },
      },
    });
    
    logger.info('Shopify API context initialized successfully');
    return true;
  } catch (error) {
    logger.error('Failed to initialize Shopify API context:', error);
    return false;
  }
}

/**
 * Handler for OAuth authorization request
 */
export async function handleShopifyAuth(req: Request, res: Response) {
  try {
    const shop = req.query.shop as string;
    
    if (!shop) {
      logger.error('Missing shop parameter in auth request');
      return res.status(400).send('Missing shop parameter');
    }
    
    // Delete any existing sessions for this shop
    await deleteShopSessions(shop);
    
    // Build auth URL
    const authQuery: AuthQuery = {
      shop,
      redirectPath: '/auth/callback',
    };
    
    // Generate auth URL 
    const authUrl = await Shopify.Auth.beginAuth(
      req,
      res,
      shop,
      '/auth/callback',
      true // online mode
    );
    
    logger.debug(`Redirecting to Shopify auth: ${authUrl}`);
    return res.redirect(authUrl);
  } catch (error) {
    logger.error('Error starting Shopify auth:', error);
    return res.status(500).send('Authorization failed');
  }
}

/**
 * Handler for OAuth callback
 */
export async function handleShopifyAuthCallback(req: Request, res: Response) {
  try {
    const session = await Shopify.Auth.validateAuthCallback(
      req,
      res,
      req.query as AuthQuery
    );
    
    logger.info(`Authentication successful for shop: ${session.shop}`);
    
    // Save shop in the Express session
    if (req.session) {
      req.session.shop = session.shop;
    }
    
    // Check if we have a return URL in the session
    let redirectUrl = '/';
    if (req.session?.returnTo) {
      redirectUrl = req.session.returnTo;
      delete req.session.returnTo;
    }
    
    // If embedded app and we need to go into an iframe
    if (authConfig.shopify.embedded) {
      return res.redirect(`/auth/complete?shop=${session.shop}&redirectUrl=${encodeURIComponent(redirectUrl)}`);
    }
    
    // Otherwise redirect directly
    return res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Error completing Shopify auth:', error);
    return res.status(500).send('Authentication callback failed');
  }
}

/**
 * Handler for rendering embedded app redirect page
 * This is needed to handle the redirect into the Shopify Admin iframe
 */
export function handleAuthComplete(req: Request, res: Response) {
  const { shop, redirectUrl } = req.query;
  
  if (!shop) {
    return res.status(400).send('Missing shop parameter');
  }
  
  const embeddedAppUrl = `https://${shop}/admin/apps/${authConfig.shopify.apiKey}`;
  const target = redirectUrl ? `${embeddedAppUrl}${redirectUrl}` : embeddedAppUrl;
  
  // Render a simple HTML page that redirects to the embedded app URL
  return res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Redirecting...</title>
        <script>
          window.top.location.href = "${target}";
        </script>
      </head>
      <body>
        <p>Redirecting to Shopify admin...</p>
      </body>
    </html>
  `);
}

/**
 * Handler for logging out the shop
 */
export async function handleShopifyLogout(req: Request, res: Response) {
  try {
    // Get the shop from query or session
    let shop = req.query.shop as string;
    
    if (!shop && req.session?.shop) {
      shop = req.session.shop;
    }
    
    if (!shop) {
      return res.status(400).send('Missing shop parameter');
    }
    
    // Delete all sessions for this shop
    await deleteShopSessions(shop);
    
    // Clear Express session
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          logger.error('Error destroying session:', err);
        }
      });
    }
    
    logger.info(`Logged out shop: ${shop}`);
    
    // Redirect to auth
    return res.redirect(`/auth?shop=${shop}`);
  } catch (error) {
    logger.error('Error during logout:', error);
    return res.status(500).send('Logout failed');
  }
} 