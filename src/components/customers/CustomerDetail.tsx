import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Page,
  Card,
  Layout,
  Stack,
  TextStyle,
  Button,
  ButtonGroup,
  Spinner,
  Banner,
  Tabs,
  Badge,
  LegacyCard, 
  SkeletonBodyText,
  Modal,
  Form,
  FormLayout,
  TextField,
  Select,
  Tag,
  Avatar,
  EmptyState,
  ResourceItem, 
  ResourceList
} from '@shopify/polaris';
import { StatusBadge, SummaryCard } from '../common/AdminUIComponents';
import { formatDate } from '../../utils/formatters';
import { CustomerType } from '../../types/customer';
import { CreditType } from '../../types/credit';
import NotificationPreferences from './NotificationPreferences';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState<CustomerType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [creditBalance, setCreditBalance] = useState<{
    available: number;
    expiring: number;
    expiryDate: string | null;
  } | null>(null);
  
  // Form state
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [status, setStatus] = useState<string>('ACTIVE');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  
  // Fetch customer data
  const fetchCustomer = useCallback(async () => {
    if (!id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/customers/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch customer');
      }
      
      const data = await response.json();
      setCustomer(data.customer);
      
      // Set form fields
      setFirstName(data.customer.firstName || '');
      setLastName(data.customer.lastName || '');
      setEmail(data.customer.email || '');
      setPhone(data.customer.phone || '');
      setStatus(data.customer.status || 'ACTIVE');
      setTags(data.customer.tags || []);
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error fetching customer:', err);
      setError('There was an error loading customer details. Please try again.');
      setIsLoading(false);
    }
  }, [id]);
  
  // Fetch credit balance
  const fetchCreditBalance = useCallback(async () => {
    if (!id) return;
    
    try {
      const response = await fetch(`/api/customers/${id}/balance`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch credit balance');
      }
      
      const data = await response.json();
      setCreditBalance(data);
    } catch (err) {
      console.error('Error fetching credit balance:', err);
    }
  }, [id]);
  
  // Load data when component mounts
  useEffect(() => {
    fetchCustomer();
    fetchCreditBalance();
  }, [fetchCustomer, fetchCreditBalance]);
  
  // Handle edit form submission
  const handleEditSubmit = useCallback(async () => {
    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
          status,
          tags,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update customer');
      }
      
      const data = await response.json();
      setCustomer(data.customer);
      setIsEditModalOpen(false);
      
      // Refresh customer data
      fetchCustomer();
    } catch (err) {
      console.error('Error updating customer:', err);
      // Handle error (could show an error message)
    }
  }, [id, firstName, lastName, phone, status, tags, fetchCustomer]);
  
  // Handle customer deletion
  const handleDelete = useCallback(async () => {
    try {
      const response = await fetch(`/api/customers/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete customer');
      }
      
      // Navigate back to customer list
      navigate('/customers');
    } catch (err) {
      console.error('Error deleting customer:', err);
      // Handle error (could show an error message)
    }
  }, [id, navigate]);
  
  // Handle tag addition
  const handleTagAdd = useCallback(() => {
    if (tagInput && !tags.includes(tagInput)) {
      setTags([...tags, tagInput]);
      setTagInput('');
    }
  }, [tagInput, tags]);
  
  // Handle tag removal
  const handleTagRemove = useCallback((tag: string) => {
    setTags(tags.filter(t => t !== tag));
  }, [tags]);
  
  // Define tabs
  const tabs = [
    {
      id: 'overview',
      content: 'Overview',
      accessibilityLabel: 'Customer overview tab',
      panelID: 'overview-panel',
    },
    {
      id: 'credits',
      content: 'Credits',
      accessibilityLabel: 'Customer credits tab',
      panelID: 'credits-panel',
    },
    {
      id: 'transactions',
      content: 'Transactions',
      accessibilityLabel: 'Customer transactions tab',
      panelID: 'transactions-panel',
    },
    {
      id: 'notifications',
      content: 'Notifications',
      accessibilityLabel: 'Customer notification preferences tab',
      panelID: 'notifications-panel',
    }
  ];
  
  if (isLoading) {
    return (
      <Page title="Customer Details">
        <Card>
          <Card.Section>
            <Stack distribution="center">
              <Spinner size="large" />
            </Stack>
          </Card.Section>
        </Card>
      </Page>
    );
  }
  
  if (error || !customer) {
    return (
      <Page title="Customer Details">
        <Banner status="critical">
          {error || 'Customer not found'}
        </Banner>
        <div style={{ marginTop: '1rem' }}>
          <Button onClick={() => navigate('/customers')}>
            Back to Customers
          </Button>
        </div>
      </Page>
    );
  }
  
  const { firstName: custFirstName, lastName: custLastName, email: custEmail } = customer;
  const customerName = `${custFirstName || ''} ${custLastName || ''}`.trim() || 'Unknown';
  
  return (
    <Page
      breadcrumbs={[{ content: 'Customers', url: '/customers' }]}
      title={customerName}
      titleMetadata={customer.status && <StatusBadge status={customer.status} />}
      subtitle={custEmail}
      primaryAction={{
        content: 'Edit Customer',
        onAction: () => setIsEditModalOpen(true),
      }}
      secondaryActions={[
        {
          content: 'Delete',
          destructive: true,
          onAction: () => setIsDeleteModalOpen(true),
        },
      ]}
    >
      <Tabs
        tabs={tabs}
        selected={selectedTab}
        onSelect={(index) => setSelectedTab(index)}
      />
      
      <div style={{ marginTop: '1rem' }}>
        {selectedTab === 0 && (
          <Layout>
            <Layout.Section oneHalf>
              <Card title="Customer Information">
                <Card.Section>
                  <Stack>
                    <Stack.Item>
                      <Avatar customer size="large" name={customerName} />
                    </Stack.Item>
                    <Stack.Item fill>
                      <TextStyle variation="strong">{customerName}</TextStyle>
                      <div>
                        <TextStyle variation="subdued">{custEmail}</TextStyle>
                      </div>
                      {customer.phone && (
                        <div>
                          <TextStyle variation="subdued">{customer.phone}</TextStyle>
                        </div>
                      )}
                    </Stack.Item>
                  </Stack>
                </Card.Section>
                
                <Card.Section title="Details">
                  <Stack vertical>
                    <Stack.Item>
                      <Stack distribution="equalSpacing">
                        <TextStyle variation="subdued">Customer Since</TextStyle>
                        <div>{formatDate(customer.createdAt)}</div>
                      </Stack>
                    </Stack.Item>
                    
                    <Stack.Item>
                      <Stack distribution="equalSpacing">
                        <TextStyle variation="subdued">Status</TextStyle>
                        <div><StatusBadge status={customer.status || 'ACTIVE'} /></div>
                      </Stack>
                    </Stack.Item>
                    
                    {customer.shopifyCustomerId && (
                      <Stack.Item>
                        <Stack distribution="equalSpacing">
                          <TextStyle variation="subdued">Shopify ID</TextStyle>
                          <div>{customer.shopifyCustomerId}</div>
                        </Stack>
                      </Stack.Item>
                    )}
                    
                    {customer.shopDomain && (
                      <Stack.Item>
                        <Stack distribution="equalSpacing">
                          <TextStyle variation="subdued">Store</TextStyle>
                          <div>{customer.shopDomain}</div>
                        </Stack>
                      </Stack.Item>
                    )}
                  </Stack>
                </Card.Section>
                
                {(customer.tags && customer.tags.length > 0) && (
                  <Card.Section title="Tags">
                    <Stack spacing="tight">
                      {customer.tags.map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </Stack>
                  </Card.Section>
                )}
              </Card>
            </Layout.Section>
            
            <Layout.Section oneHalf>
              <Card title="Credits Summary">
                <Card.Section>
                  {creditBalance ? (
                    <Stack vertical>
                      <Stack distribution="fillEvenly">
                        <SummaryCard
                          title="Available Credit"
                          value={creditBalance.available}
                          valueType="currency"
                          loading={false}
                        />
                        
                        <SummaryCard
                          title="Expiring Soon"
                          value={creditBalance.expiring}
                          valueType="currency"
                          loading={false}
                          tooltip={creditBalance.expiryDate ? `Expires on ${creditBalance.expiryDate}` : undefined}
                        />
                      </Stack>
                      
                      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                        <ButtonGroup>
                          <Button primary>Issue Credit</Button>
                          <Button>View Activity</Button>
                        </ButtonGroup>
                      </div>
                    </Stack>
                  ) : (
                    <Stack vertical alignment="center">
                      <SkeletonBodyText lines={3} />
                    </Stack>
                  )}
                </Card.Section>
              </Card>
              
              <div style={{ marginTop: '1rem' }}>
                <Card title="Recent Activity">
                  <Card.Section>
                    <EmptyState
                      heading="No recent activity"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>This customer hasn't had any recent credit activity.</p>
                    </EmptyState>
                  </Card.Section>
                </Card>
              </div>
            </Layout.Section>
          </Layout>
        )}
        
        {selectedTab === 1 && (
          <Card title="Customer Credits">
            {customer.credits && customer.credits.length > 0 ? (
              <ResourceList
                resourceName={{ singular: 'credit', plural: 'credits' }}
                items={customer.credits}
                renderItem={(credit: CreditType) => {
                  const { id, code, amount, balance, status, expirationDate } = credit;
                  
                  return (
                    <ResourceItem
                      id={id}
                      accessibilityLabel={`View details for credit ${code}`}
                      onClick={() => navigate(`/credits/${id}`)}
                    >
                      <Stack>
                        <Stack.Item fill>
                          <Stack vertical spacing="tight">
                            <Stack.Item>
                              <TextStyle variation="strong">{code}</TextStyle>
                            </Stack.Item>
                            <Stack.Item>
                              <TextStyle variation="subdued">
                                {expirationDate ? `Expires: ${formatDate(expirationDate)}` : 'No expiration'}
                              </TextStyle>
                            </Stack.Item>
                          </Stack>
                        </Stack.Item>
                        
                        <Stack.Item>
                          <Stack vertical alignment="trailing" spacing="tight">
                            <Stack.Item>
                              <StatusBadge status={status} />
                            </Stack.Item>
                            <Stack.Item>
                              <Badge status={parseFloat(balance.toString()) === 0 ? 'attention' : 'success'}>
                                ${parseFloat(balance.toString()).toFixed(2)} / ${parseFloat(amount.toString()).toFixed(2)}
                              </Badge>
                            </Stack.Item>
                          </Stack>
                        </Stack.Item>
                      </Stack>
                    </ResourceItem>
                  );
                }}
              />
            ) : (
              <Card.Section>
                <EmptyState
                  heading="No credits found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  action={{ content: 'Issue Credit', onAction: () => console.log('Issue credit') }}
                >
                  <p>This customer doesn't have any credits.</p>
                </EmptyState>
              </Card.Section>
            )}
          </Card>
        )}
        
        {selectedTab === 2 && (
          <Card title="Customer Transactions">
            <Card.Section>
              <EmptyState
                heading="No transactions found"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>No credit transactions found for this customer.</p>
              </EmptyState>
            </Card.Section>
          </Card>
        )}
        
        {selectedTab === 3 && (
          <NotificationPreferences 
            customer={customer} 
            onUpdate={() => {
              // Refresh customer data after update if needed
              fetchCustomer();
            }} 
          />
        )}
      </div>
      
      {/* Edit Customer Modal */}
      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Customer"
        primaryAction={{
          content: 'Save',
          onAction: handleEditSubmit,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsEditModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <Form onSubmit={handleEditSubmit}>
            <FormLayout>
              <FormLayout.Group>
                <TextField
                  label="First Name"
                  value={firstName}
                  onChange={setFirstName}
                  autoComplete="given-name"
                />
                <TextField
                  label="Last Name"
                  value={lastName}
                  onChange={setLastName}
                  autoComplete="family-name"
                />
              </FormLayout.Group>
              
              <TextField
                label="Email"
                value={email}
                onChange={setEmail}
                disabled
                autoComplete="email"
              />
              
              <TextField
                label="Phone"
                value={phone}
                onChange={setPhone}
                autoComplete="tel"
              />
              
              <Select
                label="Status"
                options={[
                  { label: 'Active', value: 'ACTIVE' },
                  { label: 'Inactive', value: 'INACTIVE' },
                  { label: 'Blocked', value: 'BLOCKED' },
                ]}
                value={status}
                onChange={setStatus}
              />
              
              <Stack vertical>
                <div>
                  <TextStyle>Tags</TextStyle>
                </div>
                <Stack spacing="tight">
                  {tags.map((tag) => (
                    <Tag
                      key={tag}
                      onRemove={() => handleTagRemove(tag)}
                    >
                      {tag}
                    </Tag>
                  ))}
                  
                  <div style={{ marginLeft: '0.25rem' }}>
                    <Stack spacing="tight">
                      <TextField
                        label="Add tag"
                        labelHidden
                        value={tagInput}
                        onChange={setTagInput}
                        connectedRight={
                          <Button 
                            onClick={handleTagAdd}
                            disabled={!tagInput || tags.includes(tagInput)}
                          >
                            Add
                          </Button>
                        }
                      />
                    </Stack>
                  </div>
                </Stack>
              </Stack>
            </FormLayout>
          </Form>
        </Modal.Section>
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Customer"
        primaryAction={{
          content: 'Delete',
          onAction: handleDelete,
          destructive: true,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setIsDeleteModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <Stack vertical>
            <p>
              Are you sure you want to delete this customer? This action cannot be undone and will also delete all customer credit records.
            </p>
            <Stack.Item>
              <Banner status="warning">
                Warning: This will permanently delete all customer data and cannot be undone.
              </Banner>
            </Stack.Item>
          </Stack>
        </Modal.Section>
      </Modal>
    </Page>
  );
} 