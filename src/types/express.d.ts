import { Session } from '@shopify/shopify-api';

// Extend Express Request interface to include Shopify session
declare global {
  namespace Express {
    interface Request {
      shopifySession?: Session;
    }

    interface Session {
      shopifyNonce?: string;
      shop?: string;
    }
  }
}

export {}; 