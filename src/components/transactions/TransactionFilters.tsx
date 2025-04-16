import React, { useState } from 'react';
import { Card, Filters, Button, DatePicker, Select, TextField, Stack, Popover } from '@shopify/polaris';
import { TransactionType } from '@prisma/client';

export interface TransactionFiltersProps {
  onFiltersChange: (filters: TransactionFilterValues) => void;
  initialFilters?: Partial<TransactionFilterValues>;
}

export interface TransactionFilterValues {
  type?: TransactionType;
  customerId?: string;
  creditId?: string;
  staffId?: string;
  locationId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  orderId?: string;
}

const TransactionFilters: React.FC<TransactionFiltersProps> = ({ onFiltersChange, initialFilters = {} }) => {
  const [filters, setFilters] = useState<TransactionFilterValues>(initialFilters);
  const [dateFilterPopoverActive, setDateFilterPopoverActive] = useState(false);
  const [selectedDates, setSelectedDates] = useState({
    start: initialFilters.dateFrom || new Date(new Date().setMonth(new Date().getMonth() - 1)),
    end: initialFilters.dateTo || new Date(),
  });

  const handleFilterChange = (key: keyof TransactionFilterValues, value: any) => {
    const newFilters = { ...filters, [key]: value };
    
    // If empty string, remove the filter
    if (value === '') {
      delete newFilters[key];
    }
    
    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const handleClearAll = () => {
    setFilters({});
    setSelectedDates({
      start: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      end: new Date(),
    });
    onFiltersChange({});
  };

  const handleDateFilterChange = ({ start, end }: { start: Date; end: Date }) => {
    setSelectedDates({ start, end });
    const newFilters = {
      ...filters,
      dateFrom: start,
      dateTo: end,
    };
    setFilters(newFilters);
    onFiltersChange(newFilters);
    setDateFilterPopoverActive(false);
  };

  const transactionTypeOptions = [
    { label: 'All types', value: '' },
    { label: 'Issue', value: 'ISSUE' },
    { label: 'Redeem', value: 'REDEEM' },
    { label: 'Adjust', value: 'ADJUST' },
    { label: 'Cancel', value: 'CANCEL' },
    { label: 'Expire', value: 'EXPIRE' },
  ];

  return (
    <Card>
      <Filters
        queryValue={filters.orderId || ''}
        queryPlaceholder="Search by order ID"
        filters={[
          {
            key: 'type',
            label: 'Transaction Type',
            filter: (
              <Select
                label="Transaction Type"
                options={transactionTypeOptions}
                onChange={(value) => handleFilterChange('type', value || undefined)}
                value={filters.type || ''}
                labelHidden
              />
            ),
            shortcut: true,
          },
          {
            key: 'dateRange',
            label: 'Date Range',
            filter: (
              <Popover
                active={dateFilterPopoverActive}
                activator={
                  <Button onClick={() => setDateFilterPopoverActive(true)} disclosure>
                    {filters.dateFrom && filters.dateTo
                      ? `${filters.dateFrom.toLocaleDateString()} - ${filters.dateTo.toLocaleDateString()}`
                      : 'Select date range'}
                  </Button>
                }
                onClose={() => setDateFilterPopoverActive(false)}
              >
                <DatePicker
                  month={selectedDates.start.getMonth()}
                  year={selectedDates.start.getFullYear()}
                  onChange={handleDateFilterChange}
                  selected={selectedDates}
                  allowRange
                />
              </Popover>
            ),
            shortcut: true,
          },
          {
            key: 'customerId',
            label: 'Customer ID',
            filter: (
              <TextField
                label="Customer ID"
                value={filters.customerId || ''}
                onChange={(value) => handleFilterChange('customerId', value)}
                labelHidden
                placeholder="Enter customer ID"
              />
            ),
          },
          {
            key: 'creditId',
            label: 'Credit ID',
            filter: (
              <TextField
                label="Credit ID"
                value={filters.creditId || ''}
                onChange={(value) => handleFilterChange('creditId', value)}
                labelHidden
                placeholder="Enter credit ID"
              />
            ),
          },
          {
            key: 'staffId',
            label: 'Staff ID',
            filter: (
              <TextField
                label="Staff ID"
                value={filters.staffId || ''}
                onChange={(value) => handleFilterChange('staffId', value)}
                labelHidden
                placeholder="Enter staff ID"
              />
            ),
          },
          {
            key: 'locationId',
            label: 'Location ID',
            filter: (
              <TextField
                label="Location ID"
                value={filters.locationId || ''}
                onChange={(value) => handleFilterChange('locationId', value)}
                labelHidden
                placeholder="Enter location ID"
              />
            ),
          },
        ]}
        onQueryChange={(value) => handleFilterChange('orderId', value)}
        onQueryClear={() => handleFilterChange('orderId', '')}
        onClearAll={handleClearAll}
      />
    </Card>
  );
};

export default TransactionFilters; 