import { jest } from '@jest/globals';
import { shopifyApiUtils } from '../shopifyApiUtils';
import { ShopifyClient } from '../../config/shopify';
import NodeCache from 'node-cache';

// Mock dependencies
jest.mock('../../config/shopify', () => ({
  ShopifyClient: {
    getClient: jest.fn()
  }
}));

jest.mock('../../utils/logger', () => ({
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('timers/promises', () => ({
  setTimeout: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('node-cache', () => {
  return jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    keys: jest.fn().mockReturnValue(['shop1:products', 'shop1:customers', 'shop2:orders']),
    has: jest.fn()
  }));
});

describe('shopifyApiUtils', () => {
  const mockShop = 'test-shop.myshopify.com';
  const mockAccessToken = 'shpat_test_token';
  
  let mockRestClient: any;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up mock REST client
    mockRestClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
      patch: jest.fn(),
      query: jest.fn()
    };
    
    (ShopifyClient.getClient as jest.Mock).mockResolvedValue(mockRestClient);
  });
  
  describe('request method', () => {
    it('should make a GET request and return the response body', async () => {
      const mockResponse = { body: { product: { id: '123', title: 'Test Product' } } };
      mockRestClient.get.mockResolvedValue(mockResponse);
      
      const result = await shopifyApiUtils.request({
        shop: mockShop,
        accessToken: mockAccessToken,
        method: 'get',
        path: 'products/123'
      });
      
      expect(ShopifyClient.getClient).toHaveBeenCalledWith(mockShop, mockAccessToken);
      expect(mockRestClient.get).toHaveBeenCalledWith({ path: 'products/123', query: undefined });
      expect(result).toEqual(mockResponse.body);
    });
    
    it('should use cache for GET requests when enabled', async () => {
      const mockResponse = { body: { product: { id: '123', title: 'Test Product' } } };
      mockRestClient.get.mockResolvedValue(mockResponse);
      
      // Mock cache hit
      const cacheGet = (NodeCache as unknown as jest.Mock).mock.results[0].value.get;
      cacheGet.mockReturnValueOnce({ cached: true });
      
      const result = await shopifyApiUtils.request({
        shop: mockShop,
        accessToken: mockAccessToken,
        method: 'get',
        path: 'products/123',
        useCache: true
      });
      
      expect(cacheGet).toHaveBeenCalled();
      expect(result).toEqual({ cached: true });
      expect(mockRestClient.get).not.toHaveBeenCalled();
    });
    
    it('should make a POST request with data', async () => {
      const mockData = { product: { title: 'New Product' } };
      const mockResponse = { body: { product: { id: '123', title: 'New Product' } } };
      mockRestClient.post.mockResolvedValue(mockResponse);
      
      const result = await shopifyApiUtils.request({
        shop: mockShop,
        accessToken: mockAccessToken,
        method: 'post',
        path: 'products',
        data: mockData
      });
      
      expect(mockRestClient.post).toHaveBeenCalledWith({ 
        path: 'products', 
        data: mockData, 
        query: undefined 
      });
      expect(result).toEqual(mockResponse.body);
    });
    
    it('should retry on rate limit errors', async () => {
      // Mock a rate limit error on first call, then success
      const errorResponse = {
        response: {
          statusCode: 429,
          headers: { 'retry-after': '1' }
        }
      };
      const mockResponse = { body: { product: { id: '123' } } };
      
      mockRestClient.get
        .mockRejectedValueOnce(errorResponse)
        .mockResolvedValueOnce(mockResponse);
      
      const result = await shopifyApiUtils.request({
        shop: mockShop,
        accessToken: mockAccessToken,
        method: 'get',
        path: 'products/123'
      });
      
      expect(mockRestClient.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockResponse.body);
    });
    
    it('should throw after maximum retries', async () => {
      // Mock consistent failures
      const errorResponse = {
        response: {
          statusCode: 500
        }
      };
      
      mockRestClient.get.mockRejectedValue(errorResponse);
      
      await expect(shopifyApiUtils.request({
        shop: mockShop,
        accessToken: mockAccessToken,
        method: 'get',
        path: 'products/123',
        maxRetries: 2
      })).rejects.toEqual(errorResponse);
      
      expect(mockRestClient.get).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
  
  describe('product methods', () => {
    it('should call getProduct correctly', async () => {
      // Spy on the request method
      const requestSpy = jest.spyOn(shopifyApiUtils, 'request').mockResolvedValue({ product: { id: '123' } });
      
      await shopifyApiUtils.getProduct(mockShop, mockAccessToken, '123', true);
      
      expect(requestSpy).toHaveBeenCalledWith({
        shop: mockShop,
        accessToken: mockAccessToken,
        method: 'get',
        path: 'products/123',
        useCache: true
      });
    });
    
    it('should call updateProduct and clear cache', async () => {
      // Spy on the request and clearCache methods
      const requestSpy = jest.spyOn(shopifyApiUtils, 'request').mockResolvedValue({ product: { id: '123' } });
      const clearCacheSpy = jest.spyOn(shopifyApiUtils, 'clearCache').mockImplementation();
      
      await shopifyApiUtils.updateProduct(mockShop, mockAccessToken, '123', { title: 'Updated' });
      
      expect(requestSpy).toHaveBeenCalledWith({
        shop: mockShop,
        accessToken: mockAccessToken,
        method: 'put',
        path: 'products/123',
        data: { product: { title: 'Updated' } }
      });
      
      expect(clearCacheSpy).toHaveBeenCalledWith({ shop: mockShop, path: 'products/123' });
    });
  });
  
  describe('GraphQL method', () => {
    it('should execute a GraphQL query', async () => {
      const mockQuery = `query { shop { name } }`;
      const mockVariables = { id: '123' };
      const mockResponse = { body: { data: { shop: { name: 'Test Shop' } } } };
      
      mockRestClient.query = jest.fn().mockResolvedValue(mockResponse);
      
      const result = await shopifyApiUtils.graphql(
        mockShop, 
        mockAccessToken, 
        mockQuery,
        mockVariables
      );
      
      expect(mockRestClient.query).toHaveBeenCalledWith({
        data: {
          query: mockQuery,
          variables: mockVariables
        }
      });
      
      expect(result).toEqual(mockResponse.body);
    });
  });
  
  describe('cache management', () => {
    it('should clear cache for a specific path', () => {
      const cacheInstance = (NodeCache as unknown as jest.Mock).mock.results[0].value;
      const mockDel = cacheInstance.del;
      
      shopifyApiUtils.clearCache({ shop: mockShop, path: 'products/123' });
      
      expect(mockDel).toHaveBeenCalledWith(`${mockShop}:products/123`);
    });
    
    it('should clear all cache for a shop', () => {
      const cacheInstance = (NodeCache as unknown as jest.Mock).mock.results[0].value;
      const mockKeys = cacheInstance.keys;
      const mockDel = cacheInstance.del;
      
      // Mock that keys() returns some keys
      mockKeys.mockReturnValueOnce(['shop1:products', 'shop1:customers']);
      
      shopifyApiUtils.clearCache({ shop: 'shop1' });
      
      expect(mockKeys).toHaveBeenCalled();
      expect(mockDel).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('utility methods', () => {
    it('should determine whether to retry based on error', () => {
      // Should retry on network errors
      expect(shopifyApiUtils._shouldRetry({}, 0, 3)).toBe(true);
      
      // Should retry on specified status codes
      expect(shopifyApiUtils._shouldRetry({ response: { statusCode: 429 } }, 0, 3)).toBe(true);
      expect(shopifyApiUtils._shouldRetry({ response: { statusCode: 500 } }, 0, 3)).toBe(true);
      
      // Should not retry on other status codes
      expect(shopifyApiUtils._shouldRetry({ response: { statusCode: 400 } }, 0, 3)).toBe(false);
      expect(shopifyApiUtils._shouldRetry({ response: { statusCode: 404 } }, 0, 3)).toBe(false);
      
      // Should not retry if max retries reached
      expect(shopifyApiUtils._shouldRetry({ response: { statusCode: 429 } }, 3, 3)).toBe(false);
    });
  });
}); 