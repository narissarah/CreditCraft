import React, { useState, useEffect } from 'react';
import { Page, Layout, Stack, ButtonGroup, Button, Toast, Spinner } from '@shopify/polaris';
import { useParams, useNavigate } from 'react-router-dom';
import { Transaction } from '@prisma/client';
import TransactionDetailCard from '../../components/transactions/TransactionDetailCard';
import AuditLogViewer from '../../components/transactions/AuditLogViewer';

const TransactionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchTransaction = async () => {
      setIsLoading(true);

      try {
        const response = await fetch(`/api/transactions/${id}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch transaction');
        }

        const data = await response.json();

        if (data.success) {
          setTransaction(data.transaction);
        } else {
          throw new Error(data.error || 'Failed to fetch transaction');
        }
      } catch (error) {
        console.error('Error fetching transaction:', error);
        showToast((error as Error).message, true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransaction();
  }, [id]);

  const showToast = (message: string, isError = false) => {
    setToastMessage(message);
    setToastError(isError);
    setToastActive(true);
  };

  const hideToast = () => {
    setToastActive(false);
  };

  const handleBackClick = () => {
    navigate('/transactions');
  };

  const handleCreditClick = () => {
    if (transaction?.creditId) {
      navigate(`/credits/${transaction.creditId}`);
    }
  };

  const handleCustomerClick = () => {
    if (transaction?.customerId) {
      navigate(`/customers/${transaction.customerId}`);
    }
  };

  if (isLoading) {
    return (
      <Page title="Transaction Details" backAction={{ content: 'Transactions', onAction: handleBackClick }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <Spinner size="large" />
        </div>
      </Page>
    );
  }

  if (!transaction) {
    return (
      <Page title="Transaction Not Found" backAction={{ content: 'Transactions', onAction: handleBackClick }}>
        <Layout>
          <Layout.Section>
            <p>The requested transaction could not be found or you do not have permission to view it.</p>
            <div style={{ marginTop: '1rem' }}>
              <Button onClick={handleBackClick}>Back to Transactions</Button>
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title={`Transaction ${transaction.id.slice(0, 8)}`}
      backAction={{ content: 'Transactions', onAction: handleBackClick }}
      secondaryActions={[
        {
          content: 'View Credit',
          onAction: handleCreditClick,
          disabled: !transaction.creditId,
        },
        {
          content: 'View Customer',
          onAction: handleCustomerClick,
          disabled: !transaction.customerId,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <TransactionDetailCard transaction={transaction} />
        </Layout.Section>

        {transaction.creditId && (
          <Layout.Section>
            <AuditLogViewer
              entityType="credit"
              entityId={transaction.creditId}
              title="Credit Transaction History"
            />
          </Layout.Section>
        )}

        <Layout.Section>
          <Stack distribution="trailing">
            <ButtonGroup>
              <Button onClick={handleBackClick}>Back to Transactions</Button>
            </ButtonGroup>
          </Stack>
        </Layout.Section>
      </Layout>

      {toastActive && (
        <Toast content={toastMessage} error={toastError} onDismiss={hideToast} />
      )}
    </Page>
  );
};

export default TransactionDetailPage; 