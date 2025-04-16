import React, { useState, useCallback, useRef } from 'react';
import {
  Modal,
  Stack,
  DropZone,
  Heading,
  Button,
  Banner,
  List,
  TextStyle,
  Spinner,
  Toast,
  Frame,
  DataTable
} from '@shopify/polaris';
import { 
  importCustomersFromCsv, 
  downloadCustomerCsvTemplate 
} from '../../utils/customerImporter';
import { CustomerImportResult } from '../../types/customer';

interface CustomerImportProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (result: CustomerImportResult) => void;
}

export default function CustomerImport({ 
  open, 
  onClose,
  onSuccess
}: CustomerImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CustomerImportResult | null>(null);
  const [activeToast, setActiveToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const handleDropZoneDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        setFile(acceptedFiles[0]);
        setError(null);
      }
    },
    []
  );
  
  const handleDownloadTemplate = useCallback(() => {
    downloadCustomerCsvTemplate();
    
    setToastMessage('Template downloaded successfully');
    setActiveToast(true);
  }, []);
  
  const toggleToast = useCallback(() => setActiveToast((active) => !active), []);
  
  const validateFile = useCallback(() => {
    if (!file) {
      setError('Please select a file to import');
      return false;
    }
    
    // Check file type
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return false;
    }
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit');
      return false;
    }
    
    return true;
  }, [file]);
  
  const handleImport = useCallback(async () => {
    if (!validateFile()) return;
    
    setIsLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const importResult = await importCustomersFromCsv(file!, '');
      
      setResult(importResult);
      
      if (importResult.imported > 0) {
        setToastMessage(`Imported ${importResult.imported} customers successfully`);
        setActiveToast(true);
        
        if (onSuccess) {
          onSuccess(importResult);
        }
      }
    } catch (err) {
      console.error('Import error:', err);
      setError((err as Error).message || 'Failed to import customers');
    } finally {
      setIsLoading(false);
    }
  }, [file, validateFile, onSuccess]);
  
  const handleClose = useCallback(() => {
    // Reset state
    setFile(null);
    setError(null);
    setResult(null);
    setIsLoading(false);
    
    onClose();
  }, [onClose]);
  
  const resetForm = useCallback(() => {
    setFile(null);
    setError(null);
    setResult(null);
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);
  
  const renderErrorsTable = useCallback(() => {
    if (!result || result.errors.length === 0) return null;
    
    const rows = result.errors.map(error => [
      error.line.toString(),
      error.email,
      error.reason
    ]);
    
    return (
      <DataTable
        columnContentTypes={['text', 'text', 'text']}
        headings={['Line', 'Email', 'Error']}
        rows={rows}
      />
    );
  }, [result]);
  
  const primaryAction = result 
    ? { content: 'Import Again', onAction: resetForm }
    : { content: 'Import Customers', onAction: handleImport, loading: isLoading, disabled: !file || isLoading };
  
  return (
    <Frame>
      <Modal
        open={open}
        onClose={handleClose}
        title="Import Customers"
        primaryAction={primaryAction}
        secondaryActions={[
          {
            content: result ? 'Close' : 'Cancel',
            onAction: handleClose,
          },
          {
            content: 'Download Template',
            onAction: handleDownloadTemplate,
          },
        ]}
      >
        <Modal.Section>
          {error && (
            <div style={{ marginBottom: '1rem' }}>
              <Banner status="critical">{error}</Banner>
            </div>
          )}
          
          {result ? (
            <Stack vertical>
              <Banner
                status={result.imported > 0 ? 'success' : (result.errors.length > 0 ? 'warning' : 'info')}
              >
                <p>Import completed with the following results:</p>
                <List>
                  <List.Item>Total records: {result.total}</List.Item>
                  <List.Item>Successfully imported: {result.imported}</List.Item>
                  <List.Item>Skipped (already exist): {result.skipped}</List.Item>
                  <List.Item>Errors: {result.errors.length}</List.Item>
                </List>
              </Banner>
              
              {result.errors.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <Heading>Error Details</Heading>
                  {renderErrorsTable()}
                </div>
              )}
            </Stack>
          ) : (
            <Stack vertical>
              <Stack.Item>
                <TextStyle>
                  Upload a CSV file with customer data. The file should include the following columns:
                </TextStyle>
                <List>
                  <List.Item><strong>email</strong> (required)</List.Item>
                  <List.Item>first_name</List.Item>
                  <List.Item>last_name</List.Item>
                  <List.Item>phone</List.Item>
                  <List.Item>shopify_customer_id</List.Item>
                  <List.Item>tags (comma separated)</List.Item>
                </List>
              </Stack.Item>
              
              <Stack.Item>
                <div style={{ marginTop: '1rem' }}>
                  <DropZone
                    accept=".csv,text/csv"
                    errorOverlayText="File type must be .csv"
                    type="file"
                    onDrop={handleDropZoneDrop}
                    variableHeight
                    ref={fileInputRef}
                  >
                    {file ? (
                      <div style={{ padding: '1rem' }}>
                        <Stack>
                          <Stack.Item fill>
                            <Stack vertical spacing="tight">
                              <TextStyle variation="strong">{file.name}</TextStyle>
                              <TextStyle>{(file.size / 1024).toFixed(2)} KB</TextStyle>
                            </Stack>
                          </Stack.Item>
                          
                          <Button onClick={resetForm}>Remove</Button>
                        </Stack>
                      </div>
                    ) : (
                      <div style={{ padding: '1rem', textAlign: 'center' }}>
                        <DropZone.FileUpload actionHint="or drop file to upload" />
                      </div>
                    )}
                  </DropZone>
                </div>
              </Stack.Item>
              
              {isLoading && (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <Spinner size="large" />
                  <div style={{ marginTop: '0.5rem' }}>
                    <TextStyle>Processing import...</TextStyle>
                  </div>
                </div>
              )}
            </Stack>
          )}
        </Modal.Section>
      </Modal>
      
      {activeToast && (
        <Toast content={toastMessage} onDismiss={toggleToast} />
      )}
    </Frame>
  );
} 