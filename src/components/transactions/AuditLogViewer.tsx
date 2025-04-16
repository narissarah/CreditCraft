import React, { useState, useEffect } from 'react';
import { Card, DataTable, Pagination, Spinner, Text, Badge, EmptyState } from '@shopify/polaris';
import { Transaction, TransactionType } from '@prisma/client';
import { formatDate, formatCurrency, formatTransactionType } from '../../utils/formatters';

export interface AuditLogViewerProps {
  entityType: 'credit' | 'customer';
  entityId: string;
  title?: string;
}

const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ entityType, entityId, title }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const fetchAuditLog = async (page = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/transactions/audit?entityType=${entityType}&entityId=${entityId}&page=${page}&limit=10`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch audit log data');
      }

      const data = await response.json();

      if (data.success) {
        setTransactions(data.transactions);
        setTotalPages(data.totalPages);
        setCurrentPage(data.page);
      } else {
        throw new Error(data.error || 'Failed to fetch audit log data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      console.error('Error fetching audit log:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLog(1);
  }, [entityType, entityId]);

  const handlePageChange = (page: number) => {
    fetchAuditLog(page);
  };

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

  if (isLoading) {
    return (
      <Card sectioned>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <Spinner size="large" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card sectioned>
        <EmptyState
          heading="Could not load audit log"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>{error}</p>
        </EmptyState>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card sectioned title={title || 'Audit Log'}>
        <EmptyState
          heading="No transaction history"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>No transactions have been recorded for this {entityType} yet.</p>
        </EmptyState>
      </Card>
    );
  }

  const rows = transactions.map((transaction) => [
    <Text variant="bodyMd" key={`date-${transaction.id}`}>
      {formatDate(transaction.timestamp)}
    </Text>,
    <Badge status={getBadgeStatus(transaction.type)} key={`type-${transaction.id}`}>
      {formatTransactionType(transaction.type)}
    </Badge>,
    <Text key={`amount-${transaction.id}`}>
      {transaction.type === 'ISSUE' || transaction.type === 'ADJUST' ? '+' : ''}
      {formatCurrency(Number(transaction.amount))}
    </Text>,
    <Text key={`staff-${transaction.id}`}>{transaction.staffId || 'System'}</Text>,
    <Text key={`location-${transaction.id}`}>{transaction.locationId || 'N/A'}</Text>,
    <Text key={`note-${transaction.id}`}>{transaction.note || '-'}</Text>,
  ]);

  return (
    <Card title={title || 'Audit Log'}>
      <DataTable
        columnContentTypes={['text', 'text', 'numeric', 'text', 'text', 'text']}
        headings={['Date', 'Action', 'Amount', 'Staff', 'Location', 'Note']}
        rows={rows}
      />
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem', paddingBottom: '1rem' }}>
          <Pagination
            hasPrevious={currentPage > 1}
            hasNext={currentPage < totalPages}
            onPrevious={() => handlePageChange(currentPage - 1)}
            onNext={() => handlePageChange(currentPage + 1)}
          />
        </div>
      )}
    </Card>
  );
};

export default AuditLogViewer; 