import { Router, Request, Response } from 'express';
import { verifyPOSAuth } from '../auth/authMiddleware';
import { prisma } from '../prisma/client';
import { createShopSpecificLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply shop-specific rate limiting to all POS API routes
// This is in addition to the global/strict rate limiting in api/index.ts
router.use(createShopSpecificLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 requests per 5 minutes per shop
}));

// Get POS context for the current session
router.get('/context', verifyPOSAuth, async (req: Request, res: Response) => {
  try {
    // Get the shop and device information from the authenticated request
    const shop = (req as any).shop;
    const posDeviceId = (req as any).posDevice;
    
    // In a real implementation, you would fetch location and staff information
    // from your database or from Shopify's API
    const posContext = {
      shop,
      deviceId: posDeviceId,
      location: {
        id: 'location-123',
        name: 'Main Store',
      },
      permissions: [
        'read_customers',
        'write_customers',
        'read_products',
        'read_orders',
        'write_orders',
      ],
      // This would be a real token in production
      offlineAccessToken: 'sample-offline-token',
    };
    
    res.json(posContext);
  } catch (error) {
    console.error('Error getting POS context:', error);
    res.status(500).json({ error: 'Failed to get POS context' });
  }
});

// Search for customers
router.get('/customers/search', verifyPOSAuth, async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    const shop = (req as any).shop;
    
    if (!query || typeof query !== 'string' || query.length < 3) {
      return res.status(400).json({ 
        error: 'Search query must be at least 3 characters long' 
      });
    }
    
    // Search for customers by name, email, or phone
    const customers = await prisma.customer.findMany({
      where: {
        shopDomain: shop,
        OR: [
          { 
            firstName: { 
              contains: query,
              mode: 'insensitive'
            } 
          },
          { 
            lastName: { 
              contains: query,
              mode: 'insensitive'
            } 
          },
          { 
            email: { 
              contains: query,
              mode: 'insensitive'
            } 
          },
          { 
            phone: { 
              contains: query,
              mode: 'insensitive'
            } 
          }
        ]
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        shopifyCustomerId: true
      },
      take: 10, // Limit results to 10
    });
    
    res.json({ customers });
  } catch (error) {
    console.error('Error searching for customers:', error);
    res.status(500).json({ error: 'Failed to search for customers' });
  }
});

// Issue credit to a customer
router.post('/issue-credit', verifyPOSAuth, async (req: Request, res: Response) => {
  try {
    const { customerId, amount } = req.body;
    
    // Validate request
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    
    // Get the shop from the authenticated request
    const shop = (req as any).shop;
    
    // Check if customer exists
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        shopDomain: shop,
      },
    });
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Create a new credit record
    const credit = await prisma.credit.create({
      data: {
        customerId,
        amount: parseFloat(amount),
        shopDomain: shop,
        issuedBy: (req as any).posDevice,
        issuedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
      },
    });
    
    // Create a transaction record
    await prisma.transaction.create({
      data: {
        creditId: credit.id,
        customerId,
        amount: parseFloat(amount),
        type: 'ISSUE',
        shopDomain: shop,
        processedBy: (req as any).posDevice,
        processedAt: new Date(),
        status: 'COMPLETED',
      },
    });
    
    // Return the new credit
    res.status(201).json({ credit });
  } catch (error) {
    console.error('Error issuing credit:', error);
    res.status(500).json({ error: 'Failed to issue credit' });
  }
});

// Redeem credit for a customer
router.post('/redeem-credit', verifyPOSAuth, async (req: Request, res: Response) => {
  try {
    const { customerId, amount, orderId } = req.body;
    
    // Validate request
    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    
    // Get the shop from the authenticated request
    const shop = (req as any).shop;
    
    // Get customer's available credits
    const availableCredits = await prisma.credit.findMany({
      where: {
        customerId,
        shopDomain: shop,
        expiresAt: {
          gt: new Date(),
        },
        // Only get credits that haven't been fully redeemed
        // This would need more complex logic in a real implementation
        // to calculate remaining balances
      },
    });
    
    // Calculate total available credit
    const totalAvailable = availableCredits.reduce(
      (total, credit) => total + credit.amount,
      0
    );
    
    if (totalAvailable < amount) {
      return res.status(400).json({ 
        error: 'Insufficient credit available',
        available: totalAvailable,
        requested: amount,
      });
    }
    
    // In a real implementation, you would need to handle partial redemptions
    // across multiple credit records. This is simplified.
    
    // Create a transaction record for the redemption
    const transaction = await prisma.transaction.create({
      data: {
        creditId: availableCredits[0].id, // Simplified - use first available credit
        customerId,
        amount: -parseFloat(amount), // Negative for redemption
        type: 'REDEEM',
        shopDomain: shop,
        orderId,
        processedBy: (req as any).posDevice,
        processedAt: new Date(),
        status: 'COMPLETED',
      },
    });
    
    res.status(200).json({ 
      success: true,
      transaction,
      remainingCredit: totalAvailable - amount 
    });
  } catch (error) {
    console.error('Error redeeming credit:', error);
    res.status(500).json({ error: 'Failed to redeem credit' });
  }
});

// Get customer credit balance
router.get('/customer/:id/balance', verifyPOSAuth, async (req: Request, res: Response) => {
  try {
    const customerId = req.params.id;
    const shop = (req as any).shop;
    
    // Check if customer exists
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        shopDomain: shop,
      },
    });
    
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Get customer's available credits
    const availableCredits = await prisma.credit.findMany({
      where: {
        customerId,
        shopDomain: shop,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
    
    // Calculate total available credit
    const totalAvailable = availableCredits.reduce(
      (total, credit) => total + credit.amount,
      0
    );
    
    // Find soon-to-expire credits (within 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const soonToExpireCredits = availableCredits.filter(credit => 
      credit.expiresAt < thirtyDaysFromNow
    );
    
    const expiringAmount = soonToExpireCredits.reduce(
      (total, credit) => total + credit.amount,
      0
    );
    
    // Find the earliest expiry date among soon-to-expire credits
    let earliestExpiryDate = null;
    if (soonToExpireCredits.length > 0) {
      earliestExpiryDate = new Date(Math.min(...soonToExpireCredits.map(c => c.expiresAt.getTime())));
    }
    
    res.json({
      available: totalAvailable,
      expiring: expiringAmount,
      expiryDate: earliestExpiryDate ? earliestExpiryDate.toISOString().split('T')[0] : null,
    });
  } catch (error) {
    console.error('Error getting customer balance:', error);
    res.status(500).json({ error: 'Failed to get customer balance' });
  }
});

export default router; 