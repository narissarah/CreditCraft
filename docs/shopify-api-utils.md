# Shopify API Utilities

Our Shopify API Utilities provide a robust wrapper around the Shopify API with these key features:

- **Automatic Retry** - Intelligently retries requests on network failures and rate limits
- **Smart Backoff** - Respects Shopify's retry-after headers and uses exponential backoff
- **Response Caching** - Caches frequently requested data to improve performance
- **Consistent Error Handling** - Standardized error handling across all API operations
- **Normalized Responses** - Consistent response structure for easier integration

## Installation

The utilities require `node-cache` for caching:

```bash
npm install node-cache
```

## Configuration

Default configuration values:

| Option | Default | Description |
|--------|---------|-------------|
| Cache TTL | 300 seconds (5 min) | Time-to-live for cached responses |
| Max Retries | 3 | Maximum number of retry attempts |
| Initial Retry Delay | 1000ms (1 second) | Base delay before first retry |
| Retry Status Codes | [408, 429, 500, 502, 503, 504] | HTTP status codes that trigger retries |

## Basic Usage

Import the utilities:

```typescript
import { shopifyApiUtils } from '../utils/shopifyApiUtils';
```

### Making API Requests

The core `request` method provides access to any Shopify REST API endpoint:

```typescript
// GET example with caching
const product = await shopifyApiUtils.request({
  shop: 'your-shop.myshopify.com',
  accessToken: 'shop_access_token',
  method: 'get',
  path: 'products/1234567890',
  useCache: true
});

// POST example
const result = await shopifyApiUtils.request({
  shop: 'your-shop.myshopify.com',
  accessToken: 'shop_access_token',
  method: 'post',
  path: 'products',
  data: { product: { title: 'New Product' } }
});
```

## Available Methods

### Product Operations

```typescript
// Get a product
const product = await shopifyApiUtils.getProduct(
  'your-shop.myshopify.com',
  'access_token',
  '1234567890',
  true // use cache (default)
);

// List products with optional filters
const products = await shopifyApiUtils.listProducts(
  'your-shop.myshopify.com',
  'access_token',
  { limit: 50, created_at_min: '2023-01-01' }
);

// Update a product
const updatedProduct = await shopifyApiUtils.updateProduct(
  'your-shop.myshopify.com',
  'access_token',
  '1234567890',
  { title: 'Updated Product Title', published: true }
);
```

### Customer Operations

```typescript
// Get a customer
const customer = await shopifyApiUtils.getCustomer(
  'your-shop.myshopify.com',
  'access_token',
  '1234567890'
);

// Create a customer
const newCustomer = await shopifyApiUtils.createCustomer(
  'your-shop.myshopify.com',
  'access_token',
  {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com'
  }
);
```

### Order Operations

```typescript
// Get an order
const order = await shopifyApiUtils.getOrder(
  'your-shop.myshopify.com',
  'access_token',
  '1234567890'
);

// List orders with filters
const orders = await shopifyApiUtils.listOrders(
  'your-shop.myshopify.com',
  'access_token',
  { 
    status: 'any',
    financial_status: 'paid',
    created_at_min: '2023-01-01'
  }
);
```

### Webhook Operations

```typescript
// Create a webhook
const webhook = await shopifyApiUtils.createWebhook(
  'your-shop.myshopify.com',
  'access_token',
  'products/create',
  'https://your-webhook-url.com/webhook',
  ['id', 'title'] // optional fields to include
);
```

### GraphQL Operations

```typescript
// Execute a GraphQL query
const result = await shopifyApiUtils.graphql(
  'your-shop.myshopify.com',
  'access_token',
  `
    query GetProduct($id: ID!) {
      product(id: $id) {
        id
        title
        handle
        description
      }
    }
  `,
  { id: 'gid://shopify/Product/1234567890' },
  true // use cache (optional)
);
```

## Caching

By default, GET requests can be cached. Cache can be cleared for specific shops or endpoints:

```typescript
// Clear cache for a specific shop and endpoint
shopifyApiUtils.clearCache({ 
  shop: 'your-shop.myshopify.com',
  path: 'products/1234567890'
});

// Clear all cached data for a shop
shopifyApiUtils.clearCache({ shop: 'your-shop.myshopify.com' });
```

## Error Handling

The utilities implement proper error handling and retry logic:

```typescript
try {
  const result = await shopifyApiUtils.request({
    shop: 'your-shop.myshopify.com',
    accessToken: 'access_token',
    method: 'get',
    path: 'products/1234567890'
  });
  // Process successful response
} catch (error) {
  console.error('API request failed:', error.message);
  // Handle error appropriately
}
```

## Rate Limiting

When encountering rate limits (429 status code), the utilities will:

1. Respect Shopify's `retry-after` header
2. Use exponential backoff
3. Retry automatically up to the configured number of retries

## Best Practices

- Use caching for frequently accessed, rarely changing data
- Clear cache when updating resources
- Be mindful of rate limits with bulk operations
- Consider using GraphQL for complex queries that need multiple resources
- Handle errors gracefully in your application code

## Advanced Configuration

For advanced use cases, you can customize the retry and caching behavior:

```typescript
// Custom retry configuration
const result = await shopifyApiUtils.request({
  shop: 'your-shop.myshopify.com',
  accessToken: 'access_token',
  method: 'get',
  path: 'products',
  maxRetries: 5, // More retries for this request
  useCache: true,
  cacheTtl: 600 // 10 minutes TTL for this request
});
``` 