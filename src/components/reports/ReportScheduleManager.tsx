import React, { useState, useCallback, useEffect } from 'react';
import {
  Card,
  Button,
  Modal,
  FormLayout,
  TextField,
  Select,
  SkeletonBodyText,
  Banner,
  DataTable,
  Stack,
  Text,
  Popover,
  Badge,
  ActionList,
  ButtonGroup,
  Toast,
  Frame,
  Icon,
  Tooltip,
  TextContainer,
  EmptyState
} from '@shopify/polaris';
import {
  CalendarTimeMinor,
  DeleteMinor,
  EditMinor,
  PlayMinor,
  PauseMinor,
  CircleRightMajor,
  EmailMajor,
  ReportMinor,
  ClockMinor
} from '@shopify/polaris-icons';
import { useAPI } from '../../hooks/useAPI';

// Define types
interface ReportSchedule {
  id: string;
  name: string;
  description: string;
  reportType: string;
  parameters: Record<string, any>;
  cronExpression: string;
  timezone: string;
  format: string;
  recipients: string[];
  active: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  errorDetails: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ReportScheduleManager() {
  const api = useAPI();
  
  // State
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ReportSchedule | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [toastActive, setToastActive] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [scheduleHistory, setScheduleHistory] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    reportType: 'CREDIT_SUMMARY',
    cronExpression: '0 8 * * *', // Default to 8 AM daily
    timezone: 'UTC',
    format: 'PDF',
    recipients: '',
    parameters: {
      startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0]
    }
  });
  
  // Report type options
  const reportTypeOptions = [
    { label: 'Credit Summary', value: 'CREDIT_SUMMARY' },
    { label: 'Customer Segmentation', value: 'CUSTOMER_SEGMENTATION' },
    { label: 'Staff Performance', value: 'STAFF_PERFORMANCE' },
    { label: 'Dashboard Overview', value: 'DASHBOARD_OVERVIEW' },
    { label: 'Custom Report', value: 'CUSTOM_REPORT' }
  ];
  
  // Format options
  const formatOptions = [
    { label: 'PDF Document', value: 'PDF' },
    { label: 'CSV Spreadsheet', value: 'CSV' },
    { label: 'Excel Spreadsheet', value: 'EXCEL' },
    { label: 'HTML Document', value: 'HTML' }
  ];
  
  // Common cron expressions
  const cronOptions = [
    { label: 'Daily at 8:00 AM', value: '0 8 * * *' },
    { label: 'Weekly on Monday at 9:00 AM', value: '0 9 * * 1' },
    { label: 'Monthly on the 1st at 7:00 AM', value: '0 7 1 * *' },
    { label: 'Quarterly (Jan, Apr, Jul, Oct) on the 1st at 6:00 AM', value: '0 6 1 1,4,7,10 *' },
    { label: 'Custom (Advanced)', value: 'custom' }
  ];
  
  // Fetch schedules
  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get('/api/reports/schedules');
      setSchedules(response.data.schedules);
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setError('Failed to load report schedules. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [api]);
  
  // Fetch schedule history
  const fetchScheduleHistory = useCallback(async (scheduleId: string) => {
    setLoadingHistory(true);
    
    try {
      const response = await api.get(`/api/reports/schedules/${scheduleId}/history`);
      setScheduleHistory(response.data.history);
      setHistoryModalOpen(true);
    } catch (err) {
      console.error('Error fetching schedule history:', err);
      showToast('Failed to load schedule history', true);
    } finally {
      setLoadingHistory(false);
    }
  }, [api]);
  
  // Initial data load
  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);
  
  // Handle form input changes
  const handleFormChange = useCallback((value: string, id: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  }, []);
  
  // Handle parameter changes
  const handleParamChange = useCallback((value: string, param: string) => {
    setFormData(prev => ({
      ...prev,
      parameters: {
        ...prev.parameters,
        [param]: value
      }
    }));
  }, []);
  
  // Reset form
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      reportType: 'CREDIT_SUMMARY',
      cronExpression: '0 8 * * *',
      timezone: 'UTC',
      format: 'PDF',
      recipients: '',
      parameters: {
        startDate: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      }
    });
    setIsEditing(false);
    setSelectedSchedule(null);
  }, []);
  
  // Open modal for creating a new schedule
  const handleOpenCreateModal = useCallback(() => {
    resetForm();
    setModalOpen(true);
  }, [resetForm]);
  
  // Open modal for editing a schedule
  const handleOpenEditModal = useCallback((schedule: ReportSchedule) => {
    setSelectedSchedule(schedule);
    setFormData({
      name: schedule.name,
      description: schedule.description || '',
      reportType: schedule.reportType,
      cronExpression: schedule.cronExpression,
      timezone: schedule.timezone || 'UTC',
      format: schedule.format,
      recipients: schedule.recipients.join(', '),
      parameters: schedule.parameters
    });
    setIsEditing(true);
    setModalOpen(true);
    setActionMenuOpen(null);
  }, []);
  
  // Save schedule (create or update)
  const handleSaveSchedule = useCallback(async () => {
    // Validate form
    if (!formData.name.trim()) {
      showToast('Schedule name is required', true);
      return;
    }
    
    if (!formData.recipients.trim()) {
      showToast('At least one recipient email is required', true);
      return;
    }
    
    // Format data for API
    const scheduleData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      reportType: formData.reportType,
      parameters: formData.parameters,
      cronExpression: formData.cronExpression,
      timezone: formData.timezone,
      format: formData.format,
      recipients: formData.recipients.split(',').map(email => email.trim()).filter(Boolean)
    };
    
    try {
      if (isEditing && selectedSchedule) {
        // Update existing schedule
        await api.put(`/api/reports/schedules/${selectedSchedule.id}`, scheduleData);
        showToast('Schedule updated successfully');
      } else {
        // Create new schedule
        await api.post('/api/reports/schedules', scheduleData);
        showToast('Schedule created successfully');
      }
      
      // Close modal and refresh data
      setModalOpen(false);
      fetchSchedules();
    } catch (err) {
      console.error('Error saving schedule:', err);
      showToast('Failed to save schedule. Please check your inputs and try again.', true);
    }
  }, [api, fetchSchedules, formData, isEditing, selectedSchedule]);
  
  // Delete schedule
  const handleDeleteSchedule = useCallback(async (scheduleId: string) => {
    if (!window.confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      return;
    }
    
    try {
      await api.delete(`/api/reports/schedules/${scheduleId}`);
      showToast('Schedule deleted successfully');
      fetchSchedules();
    } catch (err) {
      console.error('Error deleting schedule:', err);
      showToast('Failed to delete schedule', true);
    } finally {
      setActionMenuOpen(null);
    }
  }, [api, fetchSchedules]);
  
  // Toggle schedule active status
  const handleToggleStatus = useCallback(async (schedule: ReportSchedule) => {
    try {
      await api.patch(`/api/reports/schedules/${schedule.id}/status`, {
        active: !schedule.active
      });
      
      showToast(`Schedule ${schedule.active ? 'paused' : 'activated'} successfully`);
      fetchSchedules();
    } catch (err) {
      console.error('Error toggling schedule status:', err);
      showToast('Failed to update schedule status', true);
    } finally {
      setActionMenuOpen(null);
    }
  }, [api, fetchSchedules]);
  
  // Run schedule now
  const handleRunNow = useCallback(async (scheduleId: string) => {
    try {
      await api.post(`/api/reports/schedules/${scheduleId}/run`);
      showToast('Report has been queued to run');
      fetchSchedules();
    } catch (err) {
      console.error('Error running schedule:', err);
      showToast('Failed to run report', true);
    } finally {
      setActionMenuOpen(null);
    }
  }, [api, fetchSchedules]);
  
  // Show toast message
  const showToast = useCallback((message: string, isError = false) => {
    setToastMessage(message);
    setToastError(isError);
    setToastActive(true);
  }, []);
  
  // Dismiss toast
  const dismissToast = useCallback(() => {
    setToastActive(false);
  }, []);
  
  // Status badge for a schedule
  const getStatusBadge = useCallback((schedule: ReportSchedule) => {
    if (!schedule.active) {
      return <Badge status="warning">Paused</Badge>;
    }
    
    if (schedule.lastRunStatus === 'FAILED') {
      return <Badge status="critical">Failed</Badge>;
    }
    
    if (schedule.lastRunStatus === 'SUCCESS') {
      return <Badge status="success">Success</Badge>;
    }
    
    return <Badge status="info">Pending</Badge>;
  }, []);
  
  // Format cron expression to human-readable text
  const formatCronExpression = useCallback((cronExpression: string) => {
    const cronOption = cronOptions.find(option => option.value === cronExpression);
    if (cronOption) {
      return cronOption.label;
    }
    
    // A very basic formatter for common patterns
    if (cronExpression === '0 * * * *') return 'Hourly at minute 0';
    if (cronExpression.match(/^0 \d+ \* \* \*$/)) {
      const hour = cronExpression.split(' ')[1];
      return `Daily at ${hour}:00`;
    }
    
    return cronExpression;
  }, [cronOptions]);
  
  return (
    <Frame>
      <Card>
        <Card.Section>
          <Stack distribution="equalSpacing">
            <Stack.Item>
              <TextContainer>
                <Text variant="headingMd" as="h2">
                  <Stack spacing="tight">
                    <Icon source={CalendarTimeMinor} />
                    <span>Scheduled Reports</span>
                  </Stack>
                </Text>
                <Text variant="bodyMd" as="p" color="subdued">
                  Create, manage, and schedule automated reports.
                </Text>
              </TextContainer>
            </Stack.Item>
            <Stack.Item>
              <Button primary onClick={handleOpenCreateModal}>
                Schedule a new report
              </Button>
            </Stack.Item>
          </Stack>
        </Card.Section>
        
        {error && (
          <Card.Section>
            <Banner
              title="Error loading schedules"
              status="critical"
              onDismiss={() => setError(null)}
              action={{content: 'Try again', onAction: fetchSchedules}}
            >
              <p>{error}</p>
            </Banner>
          </Card.Section>
        )}
        
        <Card.Section>
          {loading ? (
            <SkeletonBodyText lines={5} />
          ) : schedules.length === 0 ? (
            <EmptyState
              heading="No scheduled reports"
              image=""
              action={{content: 'Create schedule', onAction: handleOpenCreateModal}}
            >
              <p>
                You haven't set up any scheduled reports yet. Create your first report
                schedule to automatically generate and send reports.
              </p>
            </EmptyState>
          ) : (
            <DataTable
              columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text', '']}
              headings={['Name', 'Type', 'Format', 'Schedule', 'Recipients', 'Status', 'Actions']}
              rows={schedules.map(schedule => [
                <Text key={`name-${schedule.id}`} variant="bodyMd" fontWeight="bold">
                  {schedule.name}
                </Text>,
                reportTypeOptions.find(option => option.value === schedule.reportType)?.label || schedule.reportType,
                formatOptions.find(option => option.value === schedule.format)?.label || schedule.format,
                <Stack key={`schedule-${schedule.id}`} spacing="tight" alignment="center">
                  <Icon source={ClockMinor} color="subdued" />
                  <Text variant="bodyMd">{formatCronExpression(schedule.cronExpression)}</Text>
                </Stack>,
                <Stack key={`recipients-${schedule.id}`} spacing="tight" alignment="center">
                  <Icon source={EmailMajor} color="subdued" />
                  <Text variant="bodyMd">
                    {schedule.recipients.length > 1 
                      ? `${schedule.recipients[0]} +${schedule.recipients.length - 1} more` 
                      : schedule.recipients[0]}
                  </Text>
                </Stack>,
                getStatusBadge(schedule),
                <ButtonGroup key={`actions-${schedule.id}`} segmented>
                  <Tooltip content={schedule.active ? 'Pause' : 'Activate'}>
                    <Button 
                      icon={schedule.active ? PauseMinor : PlayMinor} 
                      onClick={() => handleToggleStatus(schedule)}
                    />
                  </Tooltip>
                  <Tooltip content="Run now">
                    <Button 
                      icon={PlayMinor} 
                      onClick={() => handleRunNow(schedule.id)}
                    />
                  </Tooltip>
                  <Tooltip content="Edit">
                    <Button 
                      icon={EditMinor} 
                      onClick={() => handleOpenEditModal(schedule)}
                    />
                  </Tooltip>
                  <Tooltip content="Delete">
                    <Button 
                      icon={DeleteMinor} 
                      onClick={() => handleDeleteSchedule(schedule.id)}
                    />
                  </Tooltip>
                </ButtonGroup>
              ])}
            />
          )}
        </Card.Section>
      </Card>
      
      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isEditing ? 'Edit Schedule' : 'Create Schedule'}
        primaryAction={{
          content: 'Save',
          onAction: handleSaveSchedule,
        }}
        secondaryActions={[
          {
            content: 'Cancel',
            onAction: () => setModalOpen(false),
          },
        ]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Schedule Name"
              value={formData.name}
              onChange={(value) => handleFormChange(value, 'name')}
              autoComplete="off"
              requiredIndicator
            />
            
            <TextField
              label="Description"
              value={formData.description}
              onChange={(value) => handleFormChange(value, 'description')}
              autoComplete="off"
              multiline={2}
            />
            
            <Select
              label="Report Type"
              options={reportTypeOptions}
              value={formData.reportType}
              onChange={(value) => handleFormChange(value, 'reportType')}
              requiredIndicator
            />
            
            <Select
              label="Format"
              options={formatOptions}
              value={formData.format}
              onChange={(value) => handleFormChange(value, 'format')}
              requiredIndicator
            />
            
            <Select
              label="Schedule"
              options={cronOptions}
              value={
                cronOptions.find(option => option.value === formData.cronExpression)
                  ? formData.cronExpression
                  : 'custom'
              }
              onChange={(value) => handleFormChange(value, 'cronExpression')}
              helpText="When the report should be generated and sent"
              requiredIndicator
            />
            
            {formData.cronExpression === 'custom' && (
              <TextField
                label="Custom Cron Expression"
                value={formData.cronExpression === 'custom' ? '0 8 * * *' : formData.cronExpression}
                onChange={(value) => handleFormChange(value, 'cronExpression')}
                helpText="Use cron syntax (e.g., '0 8 * * *' for daily at 8 AM)"
                requiredIndicator
              />
            )}
            
            <TextField
              label="Recipients"
              value={formData.recipients}
              onChange={(value) => handleFormChange(value, 'recipients')}
              helpText="Comma-separated list of email addresses"
              requiredIndicator
            />
            
            <FormLayout.Group>
              <TextField
                label="Start Date"
                type="date"
                value={formData.parameters.startDate}
                onChange={(value) => handleParamChange(value, 'startDate')}
              />
              
              <TextField
                label="End Date"
                type="date"
                value={formData.parameters.endDate}
                onChange={(value) => handleParamChange(value, 'endDate')}
              />
            </FormLayout.Group>
          </FormLayout>
        </Modal.Section>
      </Modal>
      
      {/* History Modal */}
      <Modal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Schedule History"
      >
        <Modal.Section>
          {loadingHistory ? (
            <SkeletonBodyText lines={5} />
          ) : !scheduleHistory ? (
            <Banner status="info">No history available for this schedule.</Banner>
          ) : (
            <FormLayout>
              <FormLayout.Group>
                <TextField
                  label="Last Run"
                  value={scheduleHistory.lastRunAt ? new Date(scheduleHistory.lastRunAt).toLocaleString() : 'Never'}
                  readOnly
                />
                
                <TextField
                  label="Status"
                  value={scheduleHistory.lastRunStatus || 'Unknown'}
                  readOnly
                />
              </FormLayout.Group>
              
              {scheduleHistory.errorDetails && (
                <Banner status="critical" title="Error Details">
                  <pre style={{ whiteSpace: 'pre-wrap' }}>{scheduleHistory.errorDetails}</pre>
                </Banner>
              )}
            </FormLayout>
          )}
        </Modal.Section>
      </Modal>
      
      {toastActive && (
        <Toast
          content={toastMessage}
          error={toastError}
          onDismiss={dismissToast}
          duration={4000}
        />
      )}
    </Frame>
  );
} 