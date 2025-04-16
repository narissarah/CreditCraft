import React, { useState, useEffect } from 'react';
import {
  FormLayout,
  TextField,
  Select,
  DatePicker,
  Button,
  Stack,
  Checkbox,
  InlineError,
  Card,
  Autocomplete,
  Tag,
  Icon,
  TextContainer,
  Banner
} from '@shopify/polaris';
import { SearchMinor } from '@shopify/polaris-icons';
import { useAPI } from '../../hooks/useAPI';
import { CreditType } from '../../types/credit';
import { formatCurrency } from '../common/AdminUIComponents';

interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface CreditFormProps {
  credit?: CreditType;
  onSubmit: (data: any) => void;
  submitButtonId?: string;
  isEditing?: boolean;
}

const CreditForm: React.FC<CreditFormProps> = ({ 
  credit, 
  onSubmit, 
  submitButtonId,
  isEditing = false 
}) => {
  // Form state
  const [amount, setAmount] = useState(credit?.amount?.toString() || '');
  const [currency, setCurrency] = useState(credit?.currency || 'USD');
  const [customerId, setCustomerId] = useState(credit?.customerId || '');
  const [customerSelected, setCustomerSelected] = useState<Customer | null>(null);
  const [noExpiration, setNoExpiration] = useState(!credit?.expirationDate);
  const [note, setNote] = useState(credit?.note || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Customer search
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedCustomerOption, setSelectedCustomerOption] = useState<string[]>([]);

  // Date picker
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    credit?.expirationDate ? new Date(credit.expirationDate) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // Default 1 year
  );
  const [{ month, year }, setDate] = useState({
    month: selectedDate ? selectedDate.getMonth() : new Date().getMonth(),
    year: selectedDate ? selectedDate.getFullYear() : new Date().getFullYear(),
  });

  const api = useAPI();

  // Fetch customer details if customerId is provided
  useEffect(() => {
    const fetchCustomer = async () => {
      if (credit?.customerId) {
        try {
          const response = await api.get(`/customers/${credit.customerId}`);
          if (response.data.success) {
            const customer = response.data.customer;
            setCustomerSelected({
              id: customer.id,
              firstName: customer.firstName,
              lastName: customer.lastName,
              email: customer.email,
            });
            setSelectedCustomerOption([`${customer.firstName} ${customer.lastName} (${customer.email})`]);
          }
        } catch (error) {
          console.error('Error fetching customer:', error);
        }
      }
    };

    fetchCustomer();
  }, [api, credit?.customerId]);

  // Search customers
  const handleCustomerSearch = async (value: string) => {
    setSearchValue(value);
    
    if (value.length < 3) return;
    
    setIsLoadingCustomers(true);
    try {
      const response = await api.get('/customers/search', {
        params: { query: value }
      });
      
      if (response.data.success) {
        setCustomers(response.data.customers);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setIsLoadingCustomers(false);
    }
  };

  // Format customer options for autocomplete
  const customerOptions = customers.map(customer => ({
    label: `${customer.firstName} ${customer.lastName} (${customer.email})`,
    value: customer.id,
  }));

  // Handle customer selection
  const handleCustomerSelect = (selected: string[]) => {
    setSelectedCustomerOption(selected);
    
    if (selected.length === 0) {
      setCustomerId('');
      setCustomerSelected(null);
      return;
    }
    
    // Find the customer by the label
    const selectedLabel = selected[0];
    const customer = customers.find(c => 
      `${c.firstName} ${c.lastName} (${c.email})` === selectedLabel
    );
    
    if (customer) {
      setCustomerId(customer.id);
      setCustomerSelected(customer);
    }
  };

  // Handle date selection
  const handleDateChange = (newDate: { start: Date; end: Date }) => {
    setSelectedDate(newDate.start);
  };

  const handleMonthChange = (month: number, year: number) => {
    setDate({ month, year });
  };

  // Form validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      newErrors.amount = 'Amount is required and must be greater than 0';
    }
    
    if (!noExpiration && !selectedDate) {
      newErrors.expirationDate = 'Expiration date is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateForm()) return;
    
    const formData = {
      amount: parseFloat(amount),
      currency,
      customerId: customerId || undefined,
      expirationDate: noExpiration ? null : selectedDate?.toISOString(),
      note: note || undefined,
    };
    
    onSubmit(formData);
  };

  // Available currencies
  const currencyOptions = [
    { label: 'USD - US Dollar', value: 'USD' },
    { label: 'EUR - Euro', value: 'EUR' },
    { label: 'GBP - British Pound', value: 'GBP' },
    { label: 'CAD - Canadian Dollar', value: 'CAD' },
    { label: 'AUD - Australian Dollar', value: 'AUD' },
    { label: 'JPY - Japanese Yen', value: 'JPY' },
  ];

  // Render customer tag for selected customer
  const renderSelectedCustomer = () => {
    if (!customerSelected) return null;
    
    return (
      <div style={{ marginTop: '8px' }}>
        <Tag onRemove={() => {
          setCustomerId('');
          setCustomerSelected(null);
          setSelectedCustomerOption([]);
        }}>
          {customerSelected.firstName} {customerSelected.lastName} ({customerSelected.email})
        </Tag>
      </div>
    );
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormLayout>
        {isEditing && (
          <Banner
            title="Some fields cannot be edited"
            status="info"
          >
            <p>Credit amount and currency cannot be changed after creation. Use the "Adjust" function if you need to modify the credit balance.</p>
          </Banner>
        )}
        
        <FormLayout.Group>
          <TextField
            label="Amount"
            type="number"
            value={amount}
            onChange={setAmount}
            autoComplete="off"
            prefix={currency}
            disabled={isEditing}
            error={errors.amount}
            helpText="The total value of the credit"
            required
          />
          
          <Select
            label="Currency"
            options={currencyOptions}
            value={currency}
            onChange={setCurrency}
            disabled={isEditing}
            helpText="The currency for this credit"
          />
        </FormLayout.Group>
        
        <Autocomplete
          options={customerOptions}
          selected={selectedCustomerOption}
          onSelect={handleCustomerSelect}
          loading={isLoadingCustomers}
          textField={
            <Autocomplete.TextField
              onChange={handleCustomerSearch}
              label="Customer"
              value={searchValue}
              prefix={<Icon source={SearchMinor} />}
              placeholder="Search for a customer..."
              helpText="Search by name or email. Optional - leave blank for unassigned credit."
            />
          }
        />
        
        {renderSelectedCustomer()}
        
        <Checkbox
          label="No expiration date"
          checked={noExpiration}
          onChange={setNoExpiration}
          helpText="If checked, this credit will never expire"
        />
        
        {!noExpiration && (
          <Stack vertical>
            <TextContainer>
              <p>Expiration Date</p>
            </TextContainer>
            <DatePicker
              month={month}
              year={year}
              onChange={handleDateChange}
              onMonthChange={handleMonthChange}
              selected={selectedDate || undefined}
              error={errors.expirationDate}
            />
          </Stack>
        )}
        
        <TextField
          label="Note"
          value={note}
          onChange={setNote}
          multiline={3}
          autoComplete="off"
          helpText="Optional note about this credit (reason for issuance, restrictions, etc.)"
        />
        
        {!submitButtonId && (
          <Stack distribution="trailing">
            <Button primary submit>
              {isEditing ? 'Update Credit' : 'Create Credit'}
            </Button>
          </Stack>
        )}
        
        {submitButtonId && (
          <Button id={submitButtonId} primary submit style={{ display: 'none' }}>
            {isEditing ? 'Update Credit' : 'Create Credit'}
          </Button>
        )}
      </FormLayout>
    </form>
  );
};

export default CreditForm; 