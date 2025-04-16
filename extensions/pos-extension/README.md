# CreditCraft POS Extension

A Shopify POS UI Extension for managing customer credits directly from the point of sale system. This extension integrates with the CreditCraft backend to provide a seamless credit management experience for store staff.

## Features

- **Customer Credit Management**: View, issue, and redeem customer credits directly from the POS
- **Offline Support**: Continue issuing credits even when offline with automatic synchronization
- **Multi-location Support**: Track credits and transactions by location
- **Receipt Integration**: Add credit details to order receipts or generate standalone credit receipts
- **Credit Analytics**: View credit usage trends and metrics by location

## Setup and Installation

### Prerequisites

- Node.js (v16 or later)
- Shopify Partner account with access to the Shopify POS UI Extensions API
- CreditCraft backend API deployed and configured

### Installation

1. Clone the repository and navigate to the extension directory:

```bash
cd extensions/pos-extension
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file with the following configuration:

```
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_APP_URL=https://your-app-url.com
```

4. Start the development server:

```bash
npm run dev
```

## Extension Structure

- `src/` - Source code for the extension
  - `components/` - UI components
  - `hooks/` - Custom React hooks
  - `utils/` - Utility functions and managers
  - `contexts/` - React context providers
- `assets/` - Static assets
- `config/` - Configuration files
- `tests/` - Unit and integration tests

## Key Utilities

### Location Manager

The Location Manager utility handles multi-location support, allowing the extension to track credits and transactions by location.

```javascript
import { useLocationManager } from './utils/locationManager';

// In your component
const { currentLocation, locations, fetchLocations } = useLocationManager();

// Use location data
console.log(currentLocation.name);
```

### Receipt Manager

The Receipt Manager utility handles receipt integration, allowing credit details to be added to order receipts or generated as standalone receipts.

```javascript
import { useReceiptManager } from './utils/receiptManager';

// In your component
const { 
  addCreditIssuanceToReceipt, 
  createStandaloneCreditReceipt 
} = useReceiptManager();

// Add to order receipt
await addCreditIssuanceToReceipt(orderId, creditData);

// Generate standalone receipt
await createStandaloneCreditReceipt(creditData);
```

### Offline Manager

The Offline Manager utility handles offline support, allowing the extension to continue functioning when offline and synchronize when online.

```javascript
import { useOfflineManager } from './utils/offlineManager';

// In your component
const { 
  isOnline, 
  hasPendingOperations, 
  syncWithServer, 
  createOfflineCredit 
} = useOfflineManager();

// Check online status
if (!isOnline) {
  // Create offline credit
  await createOfflineCredit(creditData);
}

// Sync when back online
if (isOnline && hasPendingOperations) {
  await syncWithServer();
}
```

## Component Usage

### CreditAnalytics

The CreditAnalytics component displays credit usage trends and metrics by location.

```jsx
import CreditAnalytics from './components/CreditAnalytics';

// In your component
return (
  <div>
    <CreditAnalytics />
  </div>
);
```

## API Endpoints

The extension communicates with the following API endpoints:

- `/api/customers/:id` - Get customer details
- `/api/customers/:id/credits` - Get customer credits
- `/api/credits` - Create a new credit
- `/api/credits/:id/apply` - Apply credit to an order
- `/api/locations` - Get all store locations
- `/api/locations/:id/config` - Get location-specific configuration
- `/api/analytics/credits` - Get credit analytics data
- `/api/pos/receipt` - Add credit details to order receipt
- `/api/pos/standalone-receipt` - Create standalone credit receipt
- `/api/transactions` - Record a transaction

## Testing

Run unit tests:

```bash
npm test
```

Run a specific test file:

```bash
npm test -- src/utils/locationManager.test.js
```

## Deployment

Deploy the extension to your Shopify Partner account:

```bash
npm run build
shopify app deploy
```

## Troubleshooting

- **Extension not loading**: Ensure the API key and secrets are correctly configured
- **Offline sync not working**: Check that local storage is accessible and not full
- **Receipt integration issues**: Verify that the POS device has permission to modify receipts

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -am 'Add new feature'`
4. Push to the branch: `git push origin feature/my-feature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support or questions, please contact support@creditcraft.com 