# POS Extension Integration

This document describes how the POS UI extension integrates with the CreditCraft backend API.

## Authentication Flow

The extension uses Shopify App Bridge to authenticate requests to the CreditCraft API:

1. When loaded, the extension gets a session token using the App Bridge `getSessionToken` function
2. This token is included in all API requests to CreditCraft endpoints
3. The extension uses the `authenticatedFetch` utility provided in `src/auth/posAppBridge.ts`

## API Endpoints

The extension uses the following API endpoints from `src/routes/posApi.ts`:

### 1. Get Customer Credit Context

**Endpoint:** `GET /api/pos/context`
**Description:** Retrieves the store context for POS, including location and permission information.

### 2. Issue Credit

**Endpoint:** `POST /api/pos/issue-credit`
**Description:** Issues new credit to a customer.
**Payload:**
```json
{
  "customerId": "string",
  "amount": "number"
}
```

### 3. Redeem Credit

**Endpoint:** `POST /api/pos/redeem-credit`
**Description:** Redeems customer credit for an order.
**Payload:**
```json
{
  "customerId": "string",
  "amount": "number",
  "orderId": "string"
}
```

### 4. Get Customer Balance

**Endpoint:** `GET /api/pos/customer/:id/balance`
**Description:** Gets the current credit balance for a customer.

## Error Handling

The extension handles API errors through:

1. Proper error responses from API endpoints (status codes and error messages)
2. UI feedback for users when operations fail
3. Logging through Shopify's extension logging system

## Rate Limiting

The POS extension is subject to the same rate limits as defined in `src/middleware/rateLimiter.ts`:

```javascript
pos: {
  points: parseInt(process.env.RATE_LIMIT_POS || '20'),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
  keyPrefix: 'rl:pos',
  errorMessage: 'Too many POS requests, please try again later.'
}
```

## Security Considerations

1. All requests use HTTPS
2. Authentication is handled through Shopify App Bridge
3. Device ID verification happens in `src/auth/authMiddleware.ts` via `verifyPOSAuth`
4. Proper input validation on all API endpoints

## Offline Support

The extension implements the `usePOSOfflineAuth` hook from `src/auth/posAppBridge.ts` to handle offline functionality:

1. Offline tokens are stored locally when online
2. Offline operations use stored tokens when network connectivity is lost
3. Syncing happens automatically when connection is restored 