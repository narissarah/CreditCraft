import React from 'react';
import { Card, Stack, TextContainer, Text, Badge, Divider, Link, Button } from '@shopify/polaris';
import { Transaction, TransactionType } from '@prisma/client';
import { formatDate, formatCurrency, formatCustomerName, formatTransactionType } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';

export interface TransactionDetailCardProps {
  transaction: Transaction & {
    credit?: {
      code: string;
      status: string;
    };
    customer?: {
      email: string;
      firstName: string;
      lastName: string;
    };
  };
}

const TransactionDetailCard: React.FC<TransactionDetailCardProps> = ({ transaction }) => {
  const navigate = useNavigate();

  const getBadgeStatus = (type: TransactionType) => {
    switch (type) {
      case 'ISSUE':
        return 'success';
      case 'REDEEM':
        return 'info';
      case 'ADJUST':
        return 'warning';
      case 'CANCEL':
        return 'critical';
      case 'EXPIRE':
        return 'attention';
      default:
        return 'new';
    }
  };

  const handleCreditClick = () => {
    if (transaction.creditId) {
      navigate(`/credits/${transaction.creditId}`);
    }
  };

  const handleCustomerClick = () => {
    if (transaction.customerId) {
      navigate(`/customers/${transaction.customerId}`);
    }
  };

  const handleOrderClick = () => {
    if (transaction.orderId) {
      // This would typically open the Shopify admin order page
      window.open(`https://admin.shopify.com/store/your-store/orders/${transaction.orderId}`, '_blank');
    }
  };

  return (
    <Card title="Transaction Details" sectioned>
      <Stack vertical spacing="loose">
        <Stack distribution="fill" alignment="center">
          <TextContainer spacing="tight">
            <Text variant="headingMd" as="h2">
              Transaction {transaction.id.slice(0, 8)}
            </Text>
            <Badge status={getBadgeStatus(transaction.type)}>
              {formatTransactionType(transaction.type)}
            </Badge>
          </TextContainer>
          <div style={{ textAlign: 'right' }}>
            <Text variant="headingLg">
              {transaction.type === 'ISSUE' || transaction.type === 'ADJUST' ? '+' : ''}
              {formatCurrency(Number(transaction.amount))}
            </Text>
            <Text variant="bodySm" color="subdued">
              {formatDate(transaction.timestamp)}
            </Text>
          </div>
        </Stack>

        <Divider />

        <Stack distribution="fillEvenly">
          <Stack vertical spacing="tight">
            <Text variant="headingSm">Credit</Text>
            {transaction.credit ? (
              <Link onClick={handleCreditClick}>{transaction.credit.code}</Link>
            ) : (
              <Text color="subdued">N/A</Text>
            )}
          </Stack>

          <Stack vertical spacing="tight">
            <Text variant="headingSm">Customer</Text>
            {transaction.customer ? (
              <>
                <Link onClick={handleCustomerClick}>
                  {formatCustomerName(transaction.customer.firstName, transaction.customer.lastName)}
                </Link>
                <Text variant="bodySm" color="subdued">
                  {transaction.customer.email}
                </Text>
              </>
            ) : (
              <Text color="subdued">N/A</Text>
            )}
          </Stack>
        </Stack>

        <Divider />

        <Stack distribution="fillEvenly">
          <Stack vertical spacing="tight">
            <Text variant="headingSm">Staff</Text>
            <Text>{transaction.staffId || 'N/A'}</Text>
          </Stack>

          <Stack vertical spacing="tight">
            <Text variant="headingSm">Location</Text>
            <Text>{transaction.locationId || 'N/A'}</Text>
          </Stack>
        </Stack>

        {transaction.orderId && (
          <>
            <Divider />
            <Stack vertical spacing="tight">
              <Text variant="headingSm">Order</Text>
              <Stack>
                <Text>#{transaction.orderNumber || transaction.orderId}</Text>
                <Button plain onClick={handleOrderClick}>
                  View in Shopify
                </Button>
              </Stack>
            </Stack>
          </>
        )}

        {transaction.note && (
          <>
            <Divider />
            <Stack vertical spacing="tight">
              <Text variant="headingSm">Note</Text>
              <Text>{transaction.note}</Text>
            </Stack>
          </>
        )}
      </Stack>
    </Card>
  );
};

export default TransactionDetailCard; 