# CreditCraft Rate Limiting - Developer Guide

This guide provides technical details on how rate limiting is implemented in CreditCraft, how to configure it, test it, and extend it for new endpoint types.

## Architecture Overview

The rate limiting system consists of the following components:

1. **Redis-backed Store**: Uses Redis to track request counts across all application instances.
2. **Tiered Middleware**: Different rate limit tiers applied to different endpoint types.
3. **Monitoring & Alerting**: System to track violations and trigger alerts for suspicious activity.
4. **Admin Dashboard**: UI component to visualize rate limit statistics.

## Key Files

- `src/middleware/rateLimiter.ts` - Core rate limiting implementation
- `src/middleware/rateLimitMonitor.ts` - Violation tracking and reporting
- `src/api/index.ts` - Application of rate limits to routes
- `src/components/RateLimitStats.tsx` - Admin UI component
- `examples/rate-limit-test.ts` - Test script for rate limits
- `docs/rate-limiting.md` - User-facing documentation

## Rate Limit Tiers

We define multiple tiers with different limits:

| Tier | Default Limit | Purpose |
|------|--------------|---------|
| standard | 100 req/min | General API endpoints |
| auth | 5 req/min | Authentication-related endpoints |
| pos | 20 req/min | POS-specific operations |
| admin | 200 req/min | Admin dashboard operations |

## Applying Rate Limits

To apply rate limiting to a new route, import the appropriate middleware:

```typescript
import { standardRateLimit, authRateLimit, posRateLimit, adminRateLimit } from '../middleware/rateLimiter';

// Standard endpoint
app.get('/api/resource', standardRateLimit, (req, res) => {
  // Handler code
});

// Auth endpoint
app.post('/api/auth/login', authRateLimit, (req, res) => {
  // Handler code
});

// POS endpoint
app.get('/api/pos/transactions', posRateLimit, (req, res) => {
  // Handler code
});

// Admin endpoint
app.get('/api/admin/users', adminRateLimit, (req, res) => {
  // Handler code
});
```

## Creating Custom Rate Limit Tiers

If you need a custom tier beyond the predefined ones:

1. Add the tier configuration in `src/middleware/rateLimiter.ts`:

```typescript
const rateLimitTiers: Record<string, RateLimitTier> = {
  // Existing tiers...
  
  // Add new custom tier
  custom: {
    points: parseInt(process.env.RATE_LIMIT_CUSTOM || '50'),
    duration: parseInt(process.env.RATE_LIMIT_WINDOW || '60000') / 1000,
    keyPrefix: 'rl:custom',
    errorMessage: 'Custom rate limit exceeded, please try again later.'
  },
};

// Add export at the bottom of the file
export const customRateLimit = createRateLimitMiddleware('custom');
```

2. Use your new middleware in routes:

```typescript
import { customRateLimit } from '../middleware/rateLimiter';

app.get('/api/custom-endpoint', customRateLimit, (req, res) => {
  // Handler
});
```

## Configuration

All rate limit settings are configurable via environment variables:

```env
# Rate limit configuration
RATE_LIMIT_STANDARD=100
RATE_LIMIT_AUTH=5
RATE_LIMIT_POS=20
RATE_LIMIT_ADMIN=200
RATE_LIMIT_WINDOW=60000
TRUSTED_IPS=127.0.0.1,192.168.1.1
LOG_RATE_LIMIT_VIOLATIONS=true
ALERT_ON_RATE_LIMIT_VIOLATIONS=true
RATE_LIMIT_VIOLATION_THRESHOLD=10
```

## Testing Rate Limits

### Automated Testing

Run the test script to see rate limits in action:

```bash
npm run test:rate-limit
```

This runs various scenarios to trigger rate limits and reports the results.

### Manual Testing

You can test manually with curl:

```bash
# Hit standard endpoint repeatedly
for i in {1..120}; do 
  curl -i http://localhost:3000/api/credits
  sleep 0.2
done

# Check if you get a 429 response after ~100 requests
```

### Resetting Redis Rate Limits

During development, you may need to reset rate limits:

```bash
npm run reset:rate-limits
```

## Monitoring Rate Limit Violations

### Real-time Monitoring

In development, violations are logged to the console.

In production, violations are:
1. Logged to the application logs
2. Stored for statistical analysis
3. Trigger alerts when thresholds are exceeded

### Admin Dashboard

Rate limit statistics are available in the admin dashboard at `/admin/rate-limits` or via the API at `/api/admin/rate-limit-stats`.

## Exemptions

The following requests are exempt from rate limiting:

1. Requests from trusted IPs (defined in `TRUSTED_IPS`)
2. Requests with a valid admin API key
3. Health check endpoints
4. Webhook endpoints with valid signatures

## Shop-Specific Rate Limiting

For multi-tenant applications, we track limits per shop. This is done by checking for:

- `X-Shop-ID` header
- `shop_id` query parameter

If either is present, rate limits are applied per-shop rather than just per-IP.

## Advanced: Handling Rate Limit Failures

If the Redis connection fails, the system falls back to an in-memory store with a warning logged. This ensures the application continues to function, albeit without distributed rate limiting.

## Troubleshooting

### Common Issues

1. **Rate limits too restrictive**: Adjust the limits in environment variables
2. **False positives**: Check if the client is behind a proxy and ensure `X-Forwarded-For` is properly configured
3. **Redis connection issues**: Verify Redis connection string and credentials

### Logs to Check

- Application logs for "Rate limit exceeded" messages
- Redis logs for connection issues
- Monitor `/api/admin/rate-limit-stats` for unusual patterns

## Security Considerations

1. Keep your Redis instance secure with authentication and network restrictions
2. Do not expose rate limit internals via public APIs
3. Consider adding IP blocking for persistent offenders
4. Regularly review rate limit statistics for abuse patterns

## Future Improvements

- Gradual response degradation instead of hard cutoffs
- Machine learning for dynamic rate limiting based on usage patterns
- Circuit breakers for dependent services
- Regional-based rate limiting

## Contributing

When extending the rate limiting system:

1. Add tests for new functionality
2. Update documentation
3. Consider backwards compatibility
4. Ensure security is maintained

For specific questions, contact the infrastructure team. 