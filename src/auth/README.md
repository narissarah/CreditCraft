# Authentication Implementation

This directory contains the authentication implementation for the CreditCraft application, focusing on secure authentication with Shopify App Bridge and POS extensions.

## Files Overview

- `shopifyAuth.ts` - Core Shopify authentication utilities
- `appBridge.ts` - App Bridge integration for embedded apps
- `posAppBridge.ts` - POS-specific authentication utilities
- `authMiddleware.ts` - Express middleware for API route protection

## Authentication Flow

1. **Shopify App Installation**:
   - User installs the app from Shopify App Store
   - App redirects to Shopify OAuth flow
   - After successful authorization, Shopify redirects back with access token

2. **Embedded App Authentication**:
   - When loaded in Shopify Admin, the app authenticates via App Bridge
   - `AppBridgeContext` provider establishes secure connection
   - Session tokens are exchanged securely between Shopify and our app

3. **POS Extension Authentication**:
   - POS UI extensions authenticate using the Shopify POS bridge
   - The `usePOSAppBridgeAuth` hook handles POS-specific authentication
   - Supports offline authentication for POS devices without constant internet

## API Security

All API endpoints are protected by authentication middleware:

- `verifyShopifyAuth` - Verifies Shopify-issued JWT tokens
- `verifyApiAuth` - General-purpose JWT verification
- `verifyPOSAuth` - POS-specific authentication checks
- `rateLimiter` - Rate limiting to prevent abuse

## Using Authentication in Components

### Regular Embedded App

```tsx
import { AppBridgeAuthProvider, useAuth } from '../components/AppBridgeAuthProvider';

function MyApp() {
  return (
    <AppBridgeAuthProvider>
      <MyComponent />
    </AppBridgeAuthProvider>
  );
}

function MyComponent() {
  const { isAuthenticated, token } = useAuth();
  
  if (!isAuthenticated) {
    return <div>Please authenticate</div>;
  }
  
  return <div>Authenticated component content</div>;
}
```

### POS Extension

```tsx
import { POSAuthHandler } from '../components/POSAuthHandler';
import { usePOSAppBridgeAuth } from '../auth/posAppBridge';

function POSComponent() {
  const { authenticatedFetch } = usePOSAppBridgeAuth();
  
  // Use authenticatedFetch for API calls
  
  return (
    <POSAuthHandler requireOfflineAccess={true}>
      <div>POS extension content</div>
    </POSAuthHandler>
  );
}
```

## Security Considerations

- All API calls include Shopify session tokens
- Rate limiting is applied to prevent abuse
- Sensitive data is never exposed to the frontend
- POS offline mode ensures secure operation without internet
- Role-based access control restricts operations by permission level
- All authentication tokens have appropriate expiration times

## Offline Support

For POS systems that operate offline:

1. When online, the app securely stores an offline access token
2. If internet connection is lost, the app can still validate stored tokens
3. Offline operations are synchronized once connection is restored

## Troubleshooting

**Common Issues**:

- Missing shop in query parameters
- Invalid or expired session tokens
- Missing permissions for specific operations
- Rate limiting errors

Check the developer console for detailed error messages from the authentication system. 