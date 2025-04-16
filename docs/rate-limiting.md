# Rate Limiting in CreditCraft

## Architecture

CreditCraft employs a Redis-based rate limiting system with a tiered approach to protect API resources and ensure fair usage. 

### Key Components

1. **Redis Store**: Maintains counters for rate limit tracking with automatic expiration
2. **Express Middleware**: Applies rate limits early in the request lifecycle
3. **Tiered Limits**: Different endpoints have appropriate limits based on their purpose and expected usage
4. **Shop-Specific Limits**: For multi-tenant operations, especially in POS contexts

## Implementation Details

### Rate Limit Tiers

The system defines several tiers of rate limits:

| Tier | Default Limit | Window | Target Endpoints |
|------|--------------|--------|-----------------|
| Standard | 100 req/min | 60 seconds | Most public endpoints |
| Auth | 5 req/min | 60 seconds | Authentication endpoints |
| POS | 20 req/min | 60 seconds | Point of Sale operations |
| Admin | 200 req/min | 60 seconds | Admin-only operations |

### Client Identification

Requests are identified by:
- IP address for unauthenticated requests
- User ID for authenticated requests
- Shop ID for shop-specific endpoints

To handle clients behind proxies, the system respects the `X-Forwarded-For` header from trusted proxy IPs.

### Redis Schema

Rate limits are tracked in Redis using these key patterns:

```
rateLimit:{tier}:{identifier}  // Counter key
rateLimit:{tier}:{identifier}:ts  // Last reset timestamp
```

### Response Headers

All API responses include rate limit information:

- `RateLimit-Limit`: Maximum requests allowed in the window
- `RateLimit-Remaining`: Remaining requests in current window
- `RateLimit-Reset`: Timestamp when the rate limit window resets

### Rate Limit Exceeded Response

When a client exceeds the rate limit:

- HTTP Status: `429 Too Many Requests`
- Response body:
  ```json
  {
    "error": "Too many requests, please try again later.",
    "retryAfter": 60 // seconds until reset
  }
  ```

## Configuration

Rate limits are configurable via environment variables:

```
RATE_LIMIT_STANDARD=100  # Standard tier limit
RATE_LIMIT_AUTH=5        # Auth tier limit
RATE_LIMIT_POS=20        # POS tier limit
RATE_LIMIT_ADMIN=200     # Admin tier limit
RATE_LIMIT_WINDOW=60000  # Window in milliseconds
TRUSTED_IPS=127.0.0.1,192.168.1.1  # Comma-separated trusted proxy IPs
```

## Exemptions

Certain scenarios bypass rate limiting:

1. Requests from trusted IPs defined in the `TRUSTED_IPS` environment variable
2. Requests containing a valid admin API key in the `X-Admin-API-Key` header
3. Health check endpoints
4. Webhook delivery endpoints (with valid signatures)

## Monitoring and Alerts

- Rate limit hit counts are logged and available in the monitoring dashboard
- Alert thresholds notify administrators when clients consistently hit limits
- Rate limit stats endpoint (`/api/admin/rate-limit-stats`) provides insight for admins

## Best Practices for API Consumers

1. Implement exponential backoff when receiving 429 responses
2. Respect the `Retry-After` header value
3. Distribute requests evenly rather than in bursts
4. Cache responses when appropriate
5. Use bulk operations instead of multiple single operations

## Testing

The example script at `examples/rate-limit-test.ts` demonstrates various rate limiting scenarios. Run it with:

```bash
npx tsx examples/rate-limit-test.ts
``` 