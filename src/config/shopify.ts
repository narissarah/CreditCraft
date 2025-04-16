import { shopify, ApiVersion } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';
import { RestClient } from '@shopify/shopify-api/rest/client';
import { GraphqlClient } from '@shopify/shopify-api/lib/clients/graphql';
import logger from '../utils/logger';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const {
  SHOPIFY_API_KEY = '',
  SHOPIFY_API_SECRET = '',
  SHOPIFY_APP_URL = '',
  SHOPIFY_API_VERSION = '2023-10'
} = process.env;

// Initialize Shopify API
shopify.config({
  apiKey: SHOPIFY_API_KEY,
  apiSecretKey: SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_SCOPES?.split(',') || [],
  hostName: SHOPIFY_APP_URL.replace(/https?:\/\//, ''),
  apiVersion: SHOPIFY_API_VERSION as ApiVersion,
  isEmbeddedApp: true,
  logger: {
    log: (severity, message) => {
      switch (severity) {
        case 'debug':
          logger.debug(message);
          break;
        case 'info':
          logger.info(message);
          break;
        case 'warning':
          logger.warn(message);
          break;
        case 'error':
          logger.error(message);
          break;
        default:
          logger.info(message);
      }
    }
  }
});

// Client cache to avoid recreating clients
const clientCache: Record<string, { rest: RestClient; graphql: GraphqlClient; timestamp: number }> = {};
const CLIENT_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Clean expired clients periodically
setInterval(() => {
  const now = Date.now();
  Object.keys(clientCache).forEach((key) => {
    if (now - clientCache[key].timestamp > CLIENT_TTL) {
      delete clientCache[key];
    }
  });
}, 10 * 60 * 1000); // Clean every 10 minutes

/**
 * Shopify client utilities
 */
export const ShopifyClient = {
  /**
   * Get a REST client for a shop
   */
  async getClient(shop: string, accessToken: string): Promise<RestClient> {
    const cacheKey = `${shop}:${accessToken}`;
    
    // Check cache first
    if (clientCache[cacheKey] && Date.now() - clientCache[cacheKey].timestamp < CLIENT_TTL) {
      return clientCache[cacheKey].rest;
    }
    
    try {
      // Create new REST client
      const client = new shopify.clients.Rest({
        session: {
          shop,
          accessToken,
          state: 'offline'
        },
        apiVersion: SHOPIFY_API_VERSION as ApiVersion
      });
      
      // Create new GraphQL client
      const graphqlClient = new shopify.clients.Graphql({
        session: {
          shop,
          accessToken,
          state: 'offline'
        },
        apiVersion: SHOPIFY_API_VERSION as ApiVersion
      });
      
      // Cache both clients
      clientCache[cacheKey] = {
        rest: client,
        graphql: graphqlClient,
        timestamp: Date.now()
      };
      
      return client;
    } catch (error) {
      logger.error(`Failed to create Shopify REST client for ${shop}:`, error);
      throw new Error(`Failed to create Shopify REST client: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
  
  /**
   * Get a GraphQL client for a shop
   */
  async getGraphQLClient(shop: string, accessToken: string): Promise<GraphqlClient> {
    const cacheKey = `${shop}:${accessToken}`;
    
    // Check cache first
    if (clientCache[cacheKey] && Date.now() - clientCache[cacheKey].timestamp < CLIENT_TTL) {
      return clientCache[cacheKey].graphql;
    }
    
    // If no cached client, create a new one via getClient (which caches both REST and GraphQL)
    await this.getClient(shop, accessToken);
    return clientCache[cacheKey].graphql;
  },
  
  /**
   * Validate a Shopify webhook
   */
  validateWebhook(
    topic: string, 
    shop: string, 
    hmac: string, 
    rawBody: string
  ): boolean {
    try {
      return shopify.webhooks.validate({
        rawBody,
        hmac,
        shop,
        apiSecret: SHOPIFY_API_SECRET
      });
    } catch (error) {
      logger.error(`Webhook validation error for ${topic}:`, error);
      return false;
    }
  },
  
  /**
   * Register a webhook
   */
  async registerWebhook(
    shop: string, 
    accessToken: string, 
    topic: string, 
    callbackUrl: string
  ): Promise<boolean> {
    try {
      const response = await shopify.webhooks.register({
        path: callbackUrl,
        topic,
        accessToken,
        shop
      });
      
      if (response.success) {
        logger.info(`Registered webhook ${topic} for ${shop}`);
        return true;
      } else {
        logger.warn(`Failed to register webhook ${topic} for ${shop}:`, response.result);
        return false;
      }
    } catch (error) {
      logger.error(`Error registering webhook ${topic} for ${shop}:`, error);
      return false;
    }
  }
}; 