import { Router } from 'express';
import { 
  handleShopifyAuth, 
  handleShopifyAuthCallback, 
  handleAuthComplete,
  handleShopifyLogout 
} from '../auth/shopifyAuthHandler';
import { requireShopifyAuth } from '../middleware/sessionMiddleware';

const router = Router();

/**
 * Route for starting the auth flow
 * GET /auth
 */
router.get('/', handleShopifyAuth);

/**
 * Route for the OAuth callback
 * GET /auth/callback
 */
router.get('/callback', handleShopifyAuthCallback);

/**
 * Route for embedded app redirect
 * GET /auth/complete
 */
router.get('/complete', handleAuthComplete);

/**
 * Route for logging out
 * GET /auth/logout
 */
router.get('/logout', handleShopifyLogout);

/**
 * Route to verify current authentication status
 * GET /auth/verify
 */
router.get('/verify', requireShopifyAuth(), (req, res) => {
  return res.status(200).json({
    authenticated: true,
    shop: req.shopifySession?.shop,
    scopes: req.shopifySession?.scope?.split(',') || [],
    expires: req.shopifySession?.expires,
  });
});

export default router; 