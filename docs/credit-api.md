# Credit API Documentation

This document outlines the Credit Management API endpoints available in the CreditCraft Shopify application.

## Authentication

All API endpoints require authentication. The application uses Shopify's OAuth for authentication.

## Endpoints

### Create Credit

Creates a new store credit.

- **URL**: `/credits`
- **Method**: `POST`
- **Auth required**: Yes
- **Permissions required**: Admin or staff with appropriate permissions

**Request Body**:

```json
{
  "amount": 100.00,
  "customerId": "customer_id",  // Optional
  "currency": "USD",            // Optional, defaults to USD
  "expirationDate": "2023-12-31T23:59:59Z",  // Optional
  "note": "Refund for order #1001"  // Optional
}
```

**Success Response**:

- **Code**: 201 Created
- **Content**:

```json
{
  "success": true,
  "credit": {
    "id": "credit_id",
    "code": "SC-ABCD1234-XY",
    "amount": 100.00,
    "balance": 100.00,
    "currency": "USD",
    "status": "ACTIVE",
    "expirationDate": "2023-12-31T23:59:59Z",
    "createdAt": "2023-01-15T10:30:00Z",
    "updatedAt": "2023-01-15T10:30:00Z",
    "customerId": "customer_id",
    "shopId": "shop_id",
    "note": "Refund for order #1001"
  }
}
```

### List Credits

Get a paginated list of credits.

- **URL**: `/credits`
- **Method**: `GET`
- **Auth required**: Yes
- **Permissions required**: Admin or staff with appropriate permissions

**Query Parameters**:

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `status` (optional): Filter by status (ACTIVE, REDEEMED, CANCELLED, EXPIRED)
- `customerId` (optional): Filter by customer ID
- `sortBy` (optional): Field to sort by (default: createdAt)
- `sortOrder` (optional): Sort direction - 'asc' or 'desc' (default: desc)

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "credits": [
    {
      "id": "credit_id",
      "code": "SC-ABCD1234-XY",
      "amount": 100.00,
      "balance": 100.00,
      "currency": "USD",
      "status": "ACTIVE",
      "expirationDate": "2023-12-31T23:59:59Z",
      "createdAt": "2023-01-15T10:30:00Z",
      "updatedAt": "2023-01-15T10:30:00Z",
      "customerId": "customer_id",
      "shopId": "shop_id",
      "note": "Refund for order #1001",
      "transactions": [
        {
          "id": "transaction_id",
          "type": "ISSUE",
          "amount": 100.00,
          "timestamp": "2023-01-15T10:30:00Z"
        }
      ]
    }
  ],
  "total": 50,
  "page": 1,
  "totalPages": 3
}
```

### Get Credit by ID

Retrieve a specific credit by its ID.

- **URL**: `/credits/:id`
- **Method**: `GET`
- **Auth required**: Yes
- **Permissions required**: Admin or staff with appropriate permissions

**URL Parameters**:

- `id`: Credit ID

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "credit": {
    "id": "credit_id",
    "code": "SC-ABCD1234-XY",
    "amount": 100.00,
    "balance": 100.00,
    "currency": "USD",
    "status": "ACTIVE",
    "expirationDate": "2023-12-31T23:59:59Z",
    "createdAt": "2023-01-15T10:30:00Z",
    "updatedAt": "2023-01-15T10:30:00Z",
    "customerId": "customer_id",
    "shopId": "shop_id",
    "note": "Refund for order #1001",
    "transactions": [
      {
        "id": "transaction_id",
        "type": "ISSUE",
        "amount": 100.00,
        "timestamp": "2023-01-15T10:30:00Z"
      }
    ]
  }
}
```

### Get Credit by Code

Retrieve a specific credit by its code.

- **URL**: `/credits/code/:code`
- **Method**: `GET`
- **Auth required**: Yes
- **Permissions required**: Admin or staff with appropriate permissions

**URL Parameters**:

- `code`: Credit code (e.g., SC-ABCD1234-XY)

**Success Response**: Same as "Get Credit by ID"

### Update Credit

Update credit details.

- **URL**: `/credits/:id`
- **Method**: `PATCH`
- **Auth required**: Yes
- **Permissions required**: Admin or staff with appropriate permissions

**URL Parameters**:

- `id`: Credit ID

**Request Body**:

```json
{
  "status": "ACTIVE",            // Optional
  "expirationDate": "2024-12-31T23:59:59Z",  // Optional
  "customerId": "new_customer_id",  // Optional
  "note": "Updated note"         // Optional
}
```

**Success Response**:

- **Code**: 200 OK
- **Content**: Updated credit object with `success: true`

### Apply Credit

Apply (redeem) a credit (full or partial).

- **URL**: `/credits/:id/apply`
- **Method**: `POST`
- **Auth required**: Yes
- **Permissions required**: Admin or staff with appropriate permissions

**URL Parameters**:

- `id`: Credit ID

**Request Body**:

```json
{
  "amount": 50.00,
  "orderId": "order_id",         // Optional
  "staffId": "staff_id",         // Optional
  "locationId": "location_id"    // Optional
}
```

**Success Response**:

- **Code**: 200 OK
- **Content**: Updated credit object with `success: true`

### Cancel Credit

Cancel a credit.

- **URL**: `/credits/:id/cancel`
- **Method**: `POST`
- **Auth required**: Yes
- **Permissions required**: Admin or staff with appropriate permissions

**URL Parameters**:

- `id`: Credit ID

**Request Body**:

```json
{
  "reason": "Customer requested cancellation",
  "staffId": "staff_id"          // Optional
}
```

**Success Response**:

- **Code**: 200 OK
- **Content**: Updated credit object with `success: true`

### Adjust Credit Amount

Adjust credit amount (increase or decrease).

- **URL**: `/credits/:id/adjust`
- **Method**: `POST`
- **Auth required**: Yes
- **Permissions required**: Admin or staff with appropriate permissions

**URL Parameters**:

- `id`: Credit ID

**Request Body**:

```json
{
  "adjustmentAmount": 25.00,     // Positive for increase, negative for decrease
  "reason": "Goodwill addition",
  "staffId": "staff_id"          // Optional
}
```

**Success Response**:

- **Code**: 200 OK
- **Content**: Updated credit object with `success: true`

### Get Expiring Credits

Get credits that will expire soon.

- **URL**: `/credits/expiring`
- **Method**: `GET`
- **Auth required**: Yes
- **Permissions required**: Admin or staff with appropriate permissions

**Query Parameters**:

- `days` (optional): Days until expiration (default: 30)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "credits": [
    {
      "id": "credit_id",
      "code": "SC-ABCD1234-XY",
      "amount": 100.00,
      "balance": 100.00,
      "currency": "USD",
      "status": "ACTIVE",
      "expirationDate": "2023-02-15T23:59:59Z",
      "createdAt": "2023-01-15T10:30:00Z",
      "updatedAt": "2023-01-15T10:30:00Z",
      "customerId": "customer_id",
      "shopId": "shop_id"
    }
  ],
  "total": 5,
  "page": 1,
  "totalPages": 1,
  "expiringWithinDays": 30
}
```

### Extend Credit Expiration

Extend the expiration date of a credit.

- **URL**: `/credits/:id/extend-expiration`
- **Method**: `POST`
- **Auth required**: Yes
- **Permissions required**: Admin or staff with appropriate permissions

**URL Parameters**:

- `id`: Credit ID

**Request Body**:

```json
{
  "newExpirationDate": "2024-12-31T23:59:59Z",
  "reason": "Customer service accommodation",
  "staffId": "staff_id"          // Optional
}
```

**Success Response**:

- **Code**: 200 OK
- **Content**: Updated credit object with `success: true`

### Process Expired Credits (Admin only)

Trigger processing of all expired credits.

- **URL**: `/credits/process-expired`
- **Method**: `POST`
- **Auth required**: Yes
- **Permissions required**: Admin only

**Request Body**: None

**Success Response**:

- **Code**: 200 OK
- **Content**:

```json
{
  "success": true,
  "count": 15  // Number of credits processed
}
```

## Error Responses

**Error Response**:

- **Code**: 400 Bad Request, 403 Forbidden, 404 Not Found, or 500 Internal Server Error
- **Content**:

```json
{
  "success": false,
  "error": "Error message"
}
```

## Status Codes

- `200 OK`: Request succeeded
- `201 Created`: Resource created successfully
- `400 Bad Request`: Invalid request data
- `403 Forbidden`: Authentication valid but insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server-side error 