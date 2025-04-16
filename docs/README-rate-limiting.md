# CreditCraft Rate Limiting

## Overview
CreditCraft implements a tiered rate limiting system to protect API resources, prevent abuse, and ensure fair usage across all merchants and users.

## Quick Start

### Testing Rate Limits
Run the example script to see rate limits in action:
```bash
npx tsx examples/rate-limit-test.ts
```

### Rate Limit Headers
The API returns these headers with each response:
- `RateLimit-Limit`: Maximum requests allowed in the window
- `RateLimit-Remaining`: Remaining requests in current window
- `RateLimit-Reset`: Timestamp when the rate limit window resets

### When Rate Limited
When rate limits are exceeded, the API returns:
- Status: `429 Too Many Requests`
- Body: 
  ```json
  {
    "error": "Too many requests, please try again later.",
    "retryAfter": 60
  }
  ```

## Rate Limit Tiers

| Tier | Limit | Window | Endpoints |
|------|-------|--------|-----------|
| Standard | 100 | 60s | Most public endpoints |
| Auth | 5 | 60s | Auth endpoints (/api/auth/*) |
| POS | 20 | 60s | POS-specific endpoints (/api/pos/*) |
| Admin | 200 | 60s | Admin endpoints (/api/admin/*) |

## Shop-Specific Limits
POS endpoints use the `X-Shopify-Shop-Id` header to apply per-shop rate limits, ensuring one shop's usage doesn't impact others.

## Environment Variables
Configure rate limiting with these environment variables:
```
RATE_LIMIT_STANDARD=100
RATE_LIMIT_AUTH=5  
RATE_LIMIT_POS=20
RATE_LIMIT_ADMIN=200
RATE_LIMIT_WINDOW=60000
TRUSTED_IPS=127.0.0.1,192.168.1.1
```

## See Also
For more detailed information, see [Rate Limiting Documentation](./rate-limiting.md). 