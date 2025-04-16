import express, { Request, Response } from 'express';
import { customerService } from '../services/customerService';
import { logger } from '../utils/logger';
import { verifyShopifyAuth } from '../middleware/auth';

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyShopifyAuth);

/**
 * Get customer by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const shop = (req as any).shop;
    
    if (!id) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }
    
    const customer = await customerService.getCustomerById(id);
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    if (customer.shopDomain !== shop) {
      return res.status(403).json({ error: 'Unauthorized to access this customer' });
    }
    
    res.json({ customer });
  } catch (error) {
    logger.error(`Error getting customer:`, error);
    res.status(500).json({ error: 'Failed to get customer' });
  }
});

/**
 * List customers with pagination and filtering
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const shop = (req as any).shop;
    const { 
      page, 
      limit, 
      status, 
      sortBy, 
      sortOrder, 
      search, 
      tag,
      hasCreditBalance
    } = req.query;
    
    const result = await customerService.listCustomers({
      shopDomain: shop,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      status: status as string,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'asc' | 'desc',
      search: search as string,
      tag: tag as string,
      hasCreditBalance: hasCreditBalance === 'true' ? true : 
                        hasCreditBalance === 'false' ? false : undefined,
    });
    
    res.json(result);
  } catch (error) {
    logger.error(`Error listing customers:`, error);
    res.status(500).json({ error: 'Failed to list customers' });
  }
});

/**
 * Create a new customer
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const shop = (req as any).shop;
    const { email, firstName, lastName, phone, shopifyCustomerId, tags } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if customer already exists
    const existingByEmail = await customerService.getCustomerByEmail(email, shop);
    
    if (existingByEmail) {
      return res.status(409).json({ error: 'Customer with this email already exists' });
    }
    
    if (shopifyCustomerId) {
      const existingById = await customerService.getCustomerByShopifyId(shopifyCustomerId, shop);
      
      if (existingById) {
        return res.status(409).json({ 
          error: 'Customer with this Shopify ID already exists' 
        });
      }
    }
    
    const customer = await customerService.createCustomer({
      email,
      firstName,
      lastName,
      phone,
      shopifyCustomerId,
      shopDomain: shop,
      tags,
    });
    
    res.status(201).json({ customer });
  } catch (error) {
    logger.error(`Error creating customer:`, error);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

/**
 * Update a customer
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const shop = (req as any).shop;
    const { firstName, lastName, phone, tags, status } = req.body;
    
    // Verify customer exists and belongs to shop
    const existingCustomer = await customerService.getCustomerById(id);
    
    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    if (existingCustomer.shopDomain !== shop) {
      return res.status(403).json({ error: 'Unauthorized to modify this customer' });
    }
    
    const customer = await customerService.updateCustomer(id, {
      firstName,
      lastName,
      phone,
      tags,
      status,
    });
    
    res.json({ customer });
  } catch (error) {
    logger.error(`Error updating customer:`, error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

/**
 * Delete a customer
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const shop = (req as any).shop;
    
    // Verify customer exists and belongs to shop
    const existingCustomer = await customerService.getCustomerById(id);
    
    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    if (existingCustomer.shopDomain !== shop) {
      return res.status(403).json({ error: 'Unauthorized to delete this customer' });
    }
    
    await customerService.deleteCustomer(id);
    
    res.status(204).send();
  } catch (error) {
    logger.error(`Error deleting customer:`, error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

/**
 * Get customer credit balance
 */
router.get('/:id/balance', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const shop = (req as any).shop;
    
    // Verify customer exists and belongs to shop
    const existingCustomer = await customerService.getCustomerById(id);
    
    if (!existingCustomer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    if (existingCustomer.shopDomain !== shop) {
      return res.status(403).json({ error: 'Unauthorized to access this customer' });
    }
    
    const balance = await customerService.getCustomerCreditBalance(id);
    
    res.json(balance);
  } catch (error) {
    logger.error(`Error getting customer balance:`, error);
    res.status(500).json({ error: 'Failed to get customer balance' });
  }
});

/**
 * Import customers
 */
router.post('/import', async (req: Request, res: Response) => {
  try {
    const shop = (req as any).shop;
    const { customers } = req.body;
    
    if (!customers || !Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ error: 'Valid customers array is required' });
    }
    
    const result = await customerService.importCustomers(shop, customers);
    
    res.status(200).json(result);
  } catch (error) {
    logger.error(`Error importing customers:`, error);
    res.status(500).json({ error: 'Failed to import customers' });
  }
});

/**
 * Get customer stats
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const shop = (req as any).shop;
    
    const stats = await customerService.getCustomerStats(shop);
    
    res.json(stats);
  } catch (error) {
    logger.error(`Error getting customer stats:`, error);
    res.status(500).json({ error: 'Failed to get customer stats' });
  }
});

export default router; 