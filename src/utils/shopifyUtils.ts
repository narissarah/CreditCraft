import { shopify, ShopifyClient } from '../config/shopify';
import { Shopify } from '@shopify/shopify-api';
import { logger } from './logger';

/**
 * Shopify utility functions for common operations
 */
export const shopifyUtils = {
  /**
   * Verify a Shopify session is valid
   * @param {string} shop The shop domain
   * @param {string} accessToken The access token
   * @returns {Promise<boolean>} Whether the session is valid
   */
  async verifySession(shop: string, accessToken: string): Promise<boolean> {
    try {
      if (!shop || !accessToken) {
        logger.warn('Missing shop or access token for session verification');
        return false;
      }

      // Create a GraphQL client
      const client = ShopifyClient.createGraphQLClient(shop, accessToken);
      
      // Try to fetch shop info to verify the token is valid
      const response = await client.query({
        data: `{
          shop {
            name
          }
        }`,
      });
      
      return response && response.body && response.body.data && response.body.data.shop;
    } catch (error) {
      logger.error('Session verification failed:', error);
      return false;
    }
  },
  
  /**
   * Get shop information
   * @param {string} shop The shop domain
   * @param {string} accessToken The access token
   * @returns {Promise<Object>} Shop information
   */
  async getShopInfo(shop: string, accessToken: string): Promise<any> {
    try {
      const client = ShopifyClient.createGraphQLClient(shop, accessToken);
      
      const response = await client.query({
        data: `{
          shop {
            id
            name
            email
            myshopifyDomain
            primaryDomain {
              url
            }
            plan {
              displayName
              partnerDevelopment
              shopifyPlus
            }
          }
        }`,
      });
      
      return response?.body?.data?.shop;
    } catch (error) {
      logger.error('Failed to get shop info:', error);
      throw new Error(`Failed to get shop info: ${error.message}`);
    }
  },
  
  /**
   * Get shop locations
   * @param {string} shop The shop domain
   * @param {string} accessToken The access token
   * @returns {Promise<Array>} Shop locations
   */
  async getShopLocations(shop: string, accessToken: string): Promise<any[]> {
    try {
      const client = ShopifyClient.createRestClient(shop, accessToken);
      const response = await client.get({
        path: 'locations',
      });
      
      return response?.body?.locations || [];
    } catch (error) {
      logger.error('Failed to get shop locations:', error);
      throw new Error(`Failed to get shop locations: ${error.message}`);
    }
  },
  
  /**
   * Create a webhook subscription
   * @param {string} shop The shop domain
   * @param {string} accessToken The access token
   * @param {string} topic The webhook topic
   * @param {string} address The webhook address
   * @returns {Promise<Object>} Created webhook
   */
  async createWebhook(shop: string, accessToken: string, topic: string, address: string): Promise<any> {
    try {
      const client = ShopifyClient.createRestClient(shop, accessToken);
      
      const response = await client.post({
        path: 'webhooks',
        data: {
          webhook: {
            topic,
            address,
            format: 'json',
          },
        },
      });
      
      logger.info(`Webhook created: ${topic} -> ${address}`);
      return response?.body?.webhook;
    } catch (error) {
      logger.error(`Failed to create webhook ${topic}:`, error);
      throw new Error(`Failed to create webhook: ${error.message}`);
    }
  },
  
  /**
   * Get customer by ID
   * @param {string} shop The shop domain
   * @param {string} accessToken The access token
   * @param {string} customerId The customer ID
   * @returns {Promise<Object>} Customer data
   */
  async getCustomer(shop: string, accessToken: string, customerId: string): Promise<any> {
    try {
      const client = ShopifyClient.createRestClient(shop, accessToken);
      
      const response = await client.get({
        path: `customers/${customerId}`,
      });
      
      return response?.body?.customer;
    } catch (error) {
      logger.error(`Failed to get customer ${customerId}:`, error);
      throw new Error(`Failed to get customer: ${error.message}`);
    }
  },
  
  /**
   * Search customers
   * @param {string} shop The shop domain
   * @param {string} accessToken The access token
   * @param {string} query The search query
   * @returns {Promise<Array>} Matching customers
   */
  async searchCustomers(shop: string, accessToken: string, query: string): Promise<any[]> {
    try {
      const client = ShopifyClient.createRestClient(shop, accessToken);
      
      const response = await client.get({
        path: 'customers/search',
        query: { query },
      });
      
      return response?.body?.customers || [];
    } catch (error) {
      logger.error(`Failed to search customers with query "${query}":`, error);
      throw new Error(`Failed to search customers: ${error.message}`);
    }
  },
  
  /**
   * Get order by ID
   * @param {string} shop The shop domain
   * @param {string} accessToken The access token
   * @param {string} orderId The order ID
   * @returns {Promise<Object>} Order data
   */
  async getOrder(shop: string, accessToken: string, orderId: string): Promise<any> {
    try {
      const client = ShopifyClient.createRestClient(shop, accessToken);
      
      const response = await client.get({
        path: `orders/${orderId}`,
      });
      
      return response?.body?.order;
    } catch (error) {
      logger.error(`Failed to get order ${orderId}:`, error);
      throw new Error(`Failed to get order: ${error.message}`);
    }
  },
  
  /**
   * Create a metafield for an order
   * @param {string} shop The shop domain
   * @param {string} accessToken The access token
   * @param {string} orderId The order ID
   * @param {string} namespace The metafield namespace
   * @param {string} key The metafield key
   * @param {string} value The metafield value
   * @param {string} type The metafield type
   * @returns {Promise<Object>} Created metafield
   */
  async createOrderMetafield(
    shop: string, 
    accessToken: string, 
    orderId: string, 
    namespace: string, 
    key: string, 
    value: string, 
    type: string = 'single_line_text_field'
  ): Promise<any> {
    try {
      const client = ShopifyClient.createRestClient(shop, accessToken);
      
      const response = await client.post({
        path: `orders/${orderId}/metafields`,
        data: {
          metafield: {
            namespace,
            key,
            value,
            type,
          },
        },
      });
      
      return response?.body?.metafield;
    } catch (error) {
      logger.error(`Failed to create order metafield:`, error);
      throw new Error(`Failed to create order metafield: ${error.message}`);
    }
  }
};

export default shopifyUtils; 