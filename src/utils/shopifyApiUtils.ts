import { shopify } from '@shopify/shopify-api';
import { type RestClient, type RestRequestReturn } from '@shopify/shopify-api/rest/client';
import { ShopifyClient } from '../config/shopify';
import logger from '../utils/logger';
import { setTimeout } from 'timers/promises';
import NodeCache from 'node-cache';

// Initialize cache
const cache = new NodeCache({
  stdTTL: 300, // Default cache TTL (seconds)
  checkperiod: 120 // Check for expired items every 2 minutes
});

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  retryStatusCodes: [408, 429, 500, 502, 503, 504]
};

// Type definitions
type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

interface RequestOptions {
  shop: string;
  accessToken: string;
  method: HttpMethod;
  path: string;
  data?: Record<string, any>;
  query?: Record<string, any>;
  useCache?: boolean;
  cacheTtl?: number;
  maxRetries?: number;
}

interface CacheClearOptions {
  shop: string;
  path?: string;
}

// Utility functions for Shopify API
export const shopifyApiUtils = {
  /**
   * Clear cache for a specific shop and optionally a specific path
   */
  clearCache({ shop, path }: CacheClearOptions): void {
    if (path) {
      const cacheKey = `${shop}:${path}`;
      cache.del(cacheKey);
      logger.debug(`Cache cleared for ${cacheKey}`);
    } else {
      // Clear all cache keys for this shop
      const keys = cache.keys();
      const shopKeys = keys.filter(key => key.startsWith(`${shop}:`));
      shopKeys.forEach(key => cache.del(key));
      logger.debug(`Cache cleared for shop: ${shop}, keys: ${shopKeys.length}`);
    }
  },

  /**
   * Main request function with retry logic and caching
   */
  async request({
    shop,
    accessToken,
    method,
    path,
    data,
    query,
    useCache = false,
    cacheTtl,
    maxRetries = RETRY_CONFIG.maxRetries
  }: RequestOptions): Promise<any> {
    const cacheKey = `${shop}:${path}:${JSON.stringify(query || {})}`;

    // Try to get from cache for GET requests
    if (method.toLowerCase() === 'get' && useCache) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        logger.debug(`Cache hit for ${cacheKey}`);
        return cachedData;
      }
    }

    // Create Shopify client
    const client = await ShopifyClient.getClient(shop, accessToken);
    
    let retries = 0;
    let lastError: any;
    let delay = RETRY_CONFIG.initialDelay;

    while (retries <= maxRetries) {
      try {
        const response = await this._makeRequest(client, {
          method, 
          path, 
          data, 
          query
        });

        // Cache successful GET responses
        if (method.toLowerCase() === 'get' && useCache) {
          cache.set(cacheKey, response.body, cacheTtl);
          logger.debug(`Cached data for ${cacheKey}`);
        }

        return response.body;
      } catch (error: any) {
        lastError = error;
        
        // Check if we should retry
        const shouldRetry = this._shouldRetry(error, retries, maxRetries);
        if (!shouldRetry) {
          break;
        }

        // Calculate delay, respecting Shopify's retry-after header if present
        const retryAfter = error.response?.headers?.['retry-after'];
        if (retryAfter) {
          delay = parseInt(retryAfter, 10) * 1000;
        } else {
          // Exponential backoff
          delay = delay * (1.5 + Math.random() * 0.5);
        }

        logger.warn(`Retrying request to ${path} after ${delay}ms (retry ${retries + 1}/${maxRetries})`);
        await setTimeout(delay);
        retries++;
      }
    }

    // If we've exhausted all retries, throw the last error
    logger.error(`Request to ${path} failed after ${maxRetries} retries`, lastError);
    throw lastError;
  },

  /**
   * Internal method to make a single request
   */
  async _makeRequest(
    client: RestClient,
    { method, path, data, query }: Omit<RequestOptions, 'shop' | 'accessToken' | 'useCache'>
  ): Promise<RestRequestReturn> {
    switch (method.toLowerCase()) {
      case 'get':
        return await client.get({ path, query });
      case 'post':
        return await client.post({ path, data, query });
      case 'put':
        return await client.put({ path, data, query });
      case 'delete':
        return await client.delete({ path, query });
      case 'patch':
        return await client.patch({ path, data, query });
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }
  },

  /**
   * Determine if we should retry a failed request
   */
  _shouldRetry(error: any, currentRetry: number, maxRetries: number): boolean {
    // Don't retry if we've hit the max retries
    if (currentRetry >= maxRetries) {
      return false;
    }

    // Retry on network errors
    if (!error.response) {
      return true;
    }

    // Retry on specific status codes
    const statusCode = error.response.statusCode;
    return RETRY_CONFIG.retryStatusCodes.includes(statusCode);
  },

  /**
   * Get a product by ID
   */
  async getProduct(
    shop: string,
    accessToken: string,
    productId: string | number,
    useCache: boolean = true
  ): Promise<any> {
    return this.request({
      shop,
      accessToken,
      method: 'get',
      path: `products/${productId}`,
      useCache
    });
  },

  /**
   * Update a product
   */
  async updateProduct(
    shop: string,
    accessToken: string,
    productId: string | number,
    data: Record<string, any>
  ): Promise<any> {
    const response = await this.request({
      shop,
      accessToken,
      method: 'put',
      path: `products/${productId}`,
      data: { product: data }
    });

    // Clear product cache after update
    this.clearCache({ shop, path: `products/${productId}` });
    return response;
  },

  /**
   * List products with optional filters
   */
  async listProducts(
    shop: string,
    accessToken: string,
    query: Record<string, any> = {},
    useCache: boolean = true
  ): Promise<any> {
    return this.request({
      shop,
      accessToken,
      method: 'get',
      path: 'products',
      query,
      useCache
    });
  },

  /**
   * Get a customer by ID
   */
  async getCustomer(
    shop: string,
    accessToken: string,
    customerId: string | number,
    useCache: boolean = true
  ): Promise<any> {
    return this.request({
      shop,
      accessToken,
      method: 'get',
      path: `customers/${customerId}`,
      useCache
    });
  },

  /**
   * Create a customer
   */
  async createCustomer(
    shop: string,
    accessToken: string,
    data: Record<string, any>
  ): Promise<any> {
    return this.request({
      shop,
      accessToken,
      method: 'post',
      path: 'customers',
      data: { customer: data }
    });
  },

  /**
   * Get an order by ID
   */
  async getOrder(
    shop: string,
    accessToken: string,
    orderId: string | number,
    useCache: boolean = true
  ): Promise<any> {
    return this.request({
      shop,
      accessToken,
      method: 'get',
      path: `orders/${orderId}`,
      useCache
    });
  },

  /**
   * List orders with optional filters
   */
  async listOrders(
    shop: string,
    accessToken: string,
    query: Record<string, any> = {},
    useCache: boolean = true
  ): Promise<any> {
    return this.request({
      shop,
      accessToken,
      method: 'get',
      path: 'orders',
      query,
      useCache
    });
  },

  /**
   * Create a webhook
   */
  async createWebhook(
    shop: string,
    accessToken: string,
    topic: string,
    address: string,
    fields: string[] = []
  ): Promise<any> {
    return this.request({
      shop,
      accessToken,
      method: 'post',
      path: 'webhooks',
      data: {
        webhook: {
          topic,
          address,
          format: 'json',
          fields
        }
      }
    });
  },

  /**
   * Execute a GraphQL query
   */
  async graphql(
    shop: string,
    accessToken: string,
    query: string,
    variables: Record<string, any> = {},
    useCache: boolean = false
  ): Promise<any> {
    // For cacheable queries, create a cache key based on the query and variables
    const cacheKey = useCache 
      ? `${shop}:graphql:${query}:${JSON.stringify(variables)}`
      : null;

    // Check cache if this is a cacheable query
    if (cacheKey) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        logger.debug(`Cache hit for GraphQL query`);
        return cachedData;
      }
    }

    const client = await ShopifyClient.getClient(shop, accessToken);
    
    let retries = 0;
    let lastError: any;
    let delay = RETRY_CONFIG.initialDelay;

    while (retries <= RETRY_CONFIG.maxRetries) {
      try {
        const response = await client.query({
          data: {
            query,
            variables
          }
        });

        // Cache successful responses if requested
        if (cacheKey) {
          cache.set(cacheKey, response.body, 300); // Default 5 min cache
          logger.debug(`Cached GraphQL query result`);
        }

        return response.body;
      } catch (error: any) {
        lastError = error;

        // Check if we should retry
        const shouldRetry = this._shouldRetry(error, retries, RETRY_CONFIG.maxRetries);
        if (!shouldRetry) {
          break;
        }

        // Calculate delay, respecting Shopify's retry-after header if present
        const retryAfter = error.response?.headers?.['retry-after'];
        if (retryAfter) {
          delay = parseInt(retryAfter, 10) * 1000;
        } else {
          // Exponential backoff
          delay = delay * (1.5 + Math.random() * 0.5);
        }

        logger.warn(`Retrying GraphQL query after ${delay}ms (retry ${retries + 1}/${RETRY_CONFIG.maxRetries})`);
        await setTimeout(delay);
        retries++;
      }
    }

    // If we've exhausted all retries, throw the last error
    logger.error(`GraphQL query failed after ${RETRY_CONFIG.maxRetries} retries`, lastError);
    throw lastError;
  }
};

export default shopifyApiUtils; 