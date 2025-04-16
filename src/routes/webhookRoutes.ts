import { Router, Request, Response, NextFunction } from 'express';
import { ShopifyClient } from '../config/shopify';
import { logger } from '../utils/logger';
import { WebhookService } from '../services/webhookService';

// Create router instance
const router = Router();

/**
 * Middleware to verify webhook authenticity
 */
const verifyShopifyWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // We need raw request body for HMAC validation
    const isValid = await ShopifyClient.verifyWebhook(req);
    
    if (!isValid) {
      logger.warn(`Invalid webhook signature: ${req.path}`);
      return res.status(401).send('Invalid webhook signature');
    }
    
    // Add shop to request for handlers to use
    const shop = req.headers['x-shopify-shop-domain'] as string;
    (req as any).shop = shop;
    
    next();
  } catch (error) {
    logger.error('Webhook verification error:', error);
    res.status(500).send('Webhook processing error');
  }
};

// Apply verification middleware to all webhook routes
router.use(verifyShopifyWebhook);

/**
 * Handler for orders/create webhook
 */
router.post('/orders-create', async (req: Request, res: Response) => {
  try {
    const shop = (req as any).shop;
    
    logger.info(`Received orders/create webhook for shop: ${shop}`);
    
    // Process the webhook asynchronously
    WebhookService.processOrderCreate(shop, req.body)
      .catch(error => logger.error(`Error in async webhook processing (orders/create):`, error));
    
    // Return 200 immediately to acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    logger.error(`Error in orders/create webhook handler:`, error);
    // Still return 200 to acknowledge receipt
    res.status(200).send('Webhook received');
  }
});

/**
 * Handler for orders/updated webhook
 */
router.post('/orders-updated', async (req: Request, res: Response) => {
  try {
    const shop = (req as any).shop;
    
    logger.info(`Received orders/updated webhook for shop: ${shop}`);
    
    // Process the webhook asynchronously
    WebhookService.processOrderUpdate(shop, req.body)
      .catch(error => logger.error(`Error in async webhook processing (orders/updated):`, error));
    
    // Return 200 immediately to acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    logger.error(`Error in orders/updated webhook handler:`, error);
    res.status(200).send('Webhook received');
  }
});

/**
 * Handler for orders/cancelled webhook
 */
router.post('/orders-cancelled', async (req: Request, res: Response) => {
  try {
    const shop = (req as any).shop;
    
    logger.info(`Received orders/cancelled webhook for shop: ${shop}`);
    
    // Process the webhook asynchronously
    WebhookService.processOrderCancel(shop, req.body)
      .catch(error => logger.error(`Error in async webhook processing (orders/cancelled):`, error));
    
    // Return 200 immediately to acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    logger.error(`Error in orders/cancelled webhook handler:`, error);
    res.status(200).send('Webhook received');
  }
});

/**
 * Handler for customers/create webhook
 */
router.post('/customers-create', async (req: Request, res: Response) => {
  try {
    const shop = (req as any).shop;
    
    logger.info(`Received customers/create webhook for shop: ${shop}`);
    
    // Process the webhook asynchronously
    WebhookService.processCustomerCreate(shop, req.body)
      .catch(error => logger.error(`Error in async webhook processing (customers/create):`, error));
    
    // Return 200 immediately to acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    logger.error(`Error in customers/create webhook handler:`, error);
    res.status(200).send('Webhook received');
  }
});

/**
 * Handler for customers/update webhook
 */
router.post('/customers-update', async (req: Request, res: Response) => {
  try {
    const shop = (req as any).shop;
    
    logger.info(`Received customers/update webhook for shop: ${shop}`);
    
    // Process the webhook asynchronously
    WebhookService.processCustomerUpdate(shop, req.body)
      .catch(error => logger.error(`Error in async webhook processing (customers/update):`, error));
    
    // Return 200 immediately to acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    logger.error(`Error in customers/update webhook handler:`, error);
    res.status(200).send('Webhook received');
  }
});

/**
 * Handler for app/uninstalled webhook
 */
router.post('/app-uninstalled', async (req: Request, res: Response) => {
  try {
    const shop = (req as any).shop;
    
    logger.info(`Received app/uninstalled webhook for shop: ${shop}`);
    
    // Process the webhook asynchronously 
    WebhookService.processAppUninstall(shop)
      .catch(error => logger.error(`Error in async webhook processing (app/uninstalled):`, error));
    
    // Return 200 immediately to acknowledge receipt
    res.status(200).send('OK');
  } catch (error) {
    logger.error(`Error in app/uninstalled webhook handler:`, error);
    res.status(200).send('Webhook received');
  }
});

export default router; 