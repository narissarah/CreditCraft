import React from 'react';
import { 
  Card, 
  SkeletonBodyText, 
  SkeletonDisplayText, 
  TextStyle, 
  Icon,
  Badge,
  Button,
  Stack,
  EmptyState,
  Spinner,
  Banner,
  Heading,
  TextContainer,
  Text,
  Tooltip
} from '@shopify/polaris';
import { 
  CirclePlusOutlineMinor, 
  CancelMajor,
  AlertMinor,
  CircleTickMajor,
  MobileBackArrowMajor,
  RefreshMinor,
  TrendingUpMinor,
  TrendingDownMinor,
  InfoMinor
} from '@shopify/polaris-icons';

// Status Badge component for showing status of credits, transactions, etc.
export const StatusBadge: React.FC<{
  status: string;
}> = ({ status }) => {
  const getStatusDetails = (status: string) => {
    const statusMap: Record<string, { label: string; status: 'success' | 'info' | 'warning' | 'critical' | 'new' | 'attention' }> = {
      ACTIVE: { label: 'Active', status: 'success' },
      PENDING: { label: 'Pending', status: 'info' },
      USED: { label: 'Used', status: 'new' },
      EXPIRED: { label: 'Expired', status: 'critical' },
      CANCELLED: { label: 'Cancelled', status: 'critical' },
      PARTIAL: { label: 'Partial', status: 'attention' },
    };

    return statusMap[status] || { label: status, status: 'info' };
  };

  const statusDetails = getStatusDetails(status);

  return <Badge status={statusDetails.status}>{statusDetails.label}</Badge>;
};

// Summary Card component for dashboard metrics
export interface SummaryCardProps {
  title: string;
  value: string;
  loading?: boolean;
  trend?: {
    value: number;
    isUpward: boolean;
  };
  tooltipText?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ 
  title, 
  value, 
  loading = false, 
  trend,
  tooltipText
}) => {
  if (loading) {
    return (
      <Card sectioned>
        <SkeletonDisplayText size="small" />
        <div style={{ height: '8px' }} />
        <SkeletonBodyText lines={2} />
      </Card>
    );
  }

  return (
    <Card sectioned>
      <TextContainer spacing="tight">
        <Stack alignment="baseline">
          <Text variant="headingMd" as="h3">{title}</Text>
          {tooltipText && (
            <Tooltip content={tooltipText}>
              <Icon source={InfoMinor} color="base" />
            </Tooltip>
          )}
        </Stack>
        <Text variant="heading2xl" as="p">{value}</Text>
        {trend && (
          <Stack alignment="center" spacing="extraTight">
            <Icon
              source={trend.isUpward ? TrendingUpMinor : TrendingDownMinor}
              color={trend.isUpward ? 'success' : 'critical'}
            />
            <Text color={trend.isUpward ? 'success' : 'critical'}>
              {trend.value}% {trend.isUpward ? 'increase' : 'decrease'}
            </Text>
          </Stack>
        )}
      </TextContainer>
    </Card>
  );
};

// Empty State component for when there's no data
export interface EmptyStateProps {
  title: string;
  description: string;
  action?: {
    content: string;
    onAction: () => void;
  };
  image?: string;
  loading?: boolean;
}

export const EmptyStateComponent: React.FC<EmptyStateProps> = ({ 
  title, 
  description, 
  action, 
  image,
  loading = false
}) => {
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
        <Spinner size="large" />
      </div>
    );
  }
  
  return (
    <EmptyState
      heading={title}
      action={action ? {
        content: action.content,
        onAction: action.onAction
      } : undefined}
      image={image || "https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"}
    >
      <p>{description}</p>
    </EmptyState>
  );
};

// Section Header component with actions
export interface SectionHeaderProps {
  title: string;
  actions?: {
    primary?: {
      content: string;
      onAction: () => void;
      loading?: boolean;
      disabled?: boolean;
      icon?: React.ReactNode;
    };
    secondary?: Array<{
      content: string;
      onAction: () => void;
      loading?: boolean;
      disabled?: boolean;
      icon?: React.ReactNode;
    }>;
  };
  breadcrumbs?: Array<{
    content: string;
    onAction: () => void;
  }>;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ 
  title, 
  actions,
  breadcrumbs
}) => {
  return (
    <div style={{ marginBottom: '16px' }}>
      {breadcrumbs && (
        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center' }}>
          <Button
            plain
            icon={MobileBackArrowMajor}
            onClick={breadcrumbs[breadcrumbs.length - 1].onAction}
          >
            {breadcrumbs[breadcrumbs.length - 1].content}
          </Button>
        </div>
      )}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <Heading>{title}</Heading>
        {actions && (
          <Stack alignment="center" spacing="tight">
            {actions.secondary && actions.secondary.map((action, index) => (
              <Button
                key={`secondary-action-${index}`}
                onClick={action.onAction}
                loading={action.loading}
                disabled={action.disabled}
                icon={action.icon as any}
              >
                {action.content}
              </Button>
            ))}
            {actions.primary && (
              <Button
                primary
                onClick={actions.primary.onAction}
                loading={actions.primary.loading}
                disabled={actions.primary.disabled}
                icon={actions.primary.icon as any}
              >
                {actions.primary.content}
              </Button>
            )}
          </Stack>
        )}
      </div>
    </div>
  );
};

// Error or Success Banner
export interface NotificationBannerProps {
  status: 'success' | 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  onDismiss?: () => void;
  action?: {
    content: string;
    onAction: () => void;
  };
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({
  status,
  title,
  message,
  onDismiss,
  action
}) => {
  return (
    <Banner
      title={title}
      status={status}
      onDismiss={onDismiss}
      action={action ? {
        content: action.content,
        onAction: action.onAction
      } : undefined}
    >
      <p>{message}</p>
    </Banner>
  );
};

// Loading State component
export const LoadingState: React.FC<{
  lines?: number;
}> = ({ lines = 3 }) => {
  return (
    <Card sectioned>
      <SkeletonDisplayText size="small" />
      <div style={{ height: '16px' }} />
      <SkeletonBodyText lines={lines} />
    </Card>
  );
};

// Data Refresh Button
export const RefreshButton: React.FC<{
  loading: boolean;
  onRefresh: () => void;
}> = ({ loading, onRefresh }) => {
  return (
    <Button
      onClick={onRefresh}
      loading={loading}
      icon={RefreshMinor}
    >
      Refresh
    </Button>
  );
};

// Currency Formatter
export const formatCurrency = (
  amount: number, 
  currencyCode = 'USD',
  options?: Intl.NumberFormatOptions
) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options
  }).format(amount);
};

// Date Formatter
export const formatDate = (
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions
) => {
  const dateObj = typeof date === 'object' ? date : new Date(date);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options
  }).format(dateObj);
};

// Percentage Formatter
export const formatPercentage = (
  value: number,
  options?: Intl.NumberFormatOptions
) => {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    ...options
  }).format(value / 100);
};

// Data table component with pagination and filtering capabilities
export interface DataTableWrapperProps {
  title?: string;
  columns: string[];
  columnTypes: ('text' | 'numeric' | 'date' | 'status' | 'action')[];
  data: any[];
  isLoading?: boolean;
  emptyStateHeading?: string;
  emptyStateText?: string;
  onRowClick?: (id: string) => void;
  pagination?: {
    itemsPerPage: number;
    totalItems: number;
    currentPage: number;
    onPageChange: (page: number) => void;
  };
}

export const DataTableWrapper: React.FC<DataTableWrapperProps> = ({
  title,
  columns,
  columnTypes,
  data,
  isLoading = false,
  emptyStateHeading = 'No data available',
  emptyStateText = 'There are no items to display right now.',
  onRowClick,
  pagination
}) => {
  // Implement the data table wrapper with pagination
  // This is a placeholder for future implementation
  return (
    <Card sectioned title={title}>
      {/* Implement Polaris DataTable with pagination here */}
      <Text variant="bodyMd">Data table component to be implemented with Polaris DataTable</Text>
    </Card>
  );
};

// Filter group component for consistent filtering across admin pages
export interface FilterGroupProps {
  filters: {
    key: string;
    label: string;
    options: { label: string; value: string }[];
    selected: string[];
  }[];
  onFilterChange: (key: string, value: string[]) => void;
}

export const FilterGroup: React.FC<FilterGroupProps> = ({
  filters,
  onFilterChange
}) => {
  // Implement filter group component
  // This is a placeholder for future implementation
  return (
    <Card sectioned>
      <Text variant="bodyMd">Filter component to be implemented with Polaris Filters</Text>
    </Card>
  );
};

// Action bar component for bulk actions on selected items
export interface ActionBarProps {
  selectedItems: string[];
  actions: {
    label: string;
    onAction: () => void;
    destructive?: boolean;
    disabled?: boolean;
  }[];
  onSelectionChange: (selected: string[]) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({
  selectedItems,
  actions,
  onSelectionChange
}) => {
  // Implement action bar component
  // This is a placeholder for future implementation
  return (
    <div>
      <Text variant="bodyMd">
        Action bar component for bulk actions to be implemented
      </Text>
    </div>
  );
}; 