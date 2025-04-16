# Payment Processing Integration

This document describes how payment processing integrates with CreditCraft's credit system across both Shopify POS and online checkout scenarios.

## Overview

CreditCraft integrates with Shopify's payment processing to allow customers to:
- Redeem store credits during checkout
- Receive refunds as store credits
- Use store credits alongside other payment methods

## Architecture

### Components

- **CreditCraft API**: Core backend that manages credit operations
- **Shopify Checkout Integration**: Embedded app that presents credits during online checkout
- **POS Extension**: Native POS extension for in-store credit redemption
- **Webhook Listeners**: Process order events to trigger credit operations

## Shopify Online Checkout Flow

1. **Credit Display**:
   - During checkout, available credits are displayed to the customer
   - Credit balance is fetched via authenticated API call

2. **Credit Application**:
   - Customer selects amount of credit to apply (up to available balance)
   - Credit is applied as a discount to the order
   - Remaining balance is processed through standard Shopify payment methods

3. **Order Completion**:
   - When order is completed, webhook triggers credit redemption
   - Credit balance is updated in CreditCraft database
   - Transaction record is created with order details

4. **Refund Processing**:
   - When refund is processed, webhook triggers credit issuance
   - New credit can be issued automatically or queued for review

## POS Integration Flow

1. **Customer Identification**:
   - Staff identifies customer in Shopify POS
   - CreditCraft POS extension loads customer's credit information

2. **Credit Redemption**:
   - Staff selects amount of credit to apply
   - Credit is applied as a custom payment method
   - API call to `/api/pos/redeem-credit` records the redemption

3. **Mixed Payment Processing**:
   - Credits can be combined with other payment methods
   - Remaining balance after credit is processed via standard POS payment methods

4. **Offline Support**:
   - POS extension stores authentication tokens for offline operation
   - Transactions are queued and synced when connectivity is restored

## API Endpoints

### Online Checkout

- **GET /api/customer/:id/credits** - Get available credits for customer
- **POST /api/credits/redeem** - Redeem credit during online checkout
- **POST /api/credits/issue** - Issue credit for refund or store credit purchase

### POS Integration

- **GET /api/pos/customer/:id/balance** - Get customer credit balance
- **POST /api/pos/issue-credit** - Issue new credit to customer
- **POST /api/pos/redeem-credit** - Redeem credit during POS checkout

## Webhook Processing

CreditCraft processes the following Shopify webhooks:

1. **Order Creation** (`orders/create`):
   - Records order in transaction history
   - Updates credit status if redemption was applied

2. **Order Update** (`orders/updated`):
   - Tracks payment status changes
   - Updates related credit transactions

3. **Order Cancellation** (`orders/cancelled`):
   - Triggers credit refund logic
   - Restores redeemed credits when appropriate

4. **Refunds** (`refunds/create`):
   - Issues new store credit when configured to do so
   - Records refund in transaction history

## Security Considerations

1. **Authentication**:
   - All API calls require valid Shopify authentication
   - POS requests include device verification
   - Admin functions require additional verification

2. **Data Protection**:
   - All transactions are logged with audit trail
   - Personal information is handled according to privacy policies
   - Credits are linked to customer ID, not payment methods

3. **Fraud Prevention**:
   - Rate limiting on all credit operations
   - Suspicious transactions can be flagged for review
   - Maximum credit limits configurable by merchant

## Configuration Options

Merchants can configure:

- Whether refunds automatically issue store credit
- Maximum credit amount per customer
- Credit expiration periods
- Staff permissions for credit operations

## Error Handling

- Failed transactions do not impact order processing
- Retry logic for temporary failures
- Error notifications for persistent issues
- Detailed logging for troubleshooting

## Testing

See the [Testing Guide](testing-guide.md) for instructions on testing payment integrations in development and staging environments. 