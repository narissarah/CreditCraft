import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MockProvider } from '../../utils/tests/mockProvider';
import ReportPreview from './ReportPreview';

// Mock sample report data
const mockReportData = {
  data: [
    { id: '1', customer: 'John Doe', amount: '$100.00', date: '2023-07-01' },
    { id: '2', customer: 'Jane Smith', amount: '$250.00', date: '2023-07-02' },
    { id: '3', customer: 'Bob Johnson', amount: '$175.00', date: '2023-07-03' },
  ]
};

describe('ReportPreview Component', () => {
  
  it('renders loading state correctly', () => {
    render(
      <MockProvider>
        <ReportPreview 
          reportData={null} 
          format="PDF" 
          reportType="Transaction" 
          isLoading={true}
        />
      </MockProvider>
    );
    
    expect(screen.getByLabelText('Loading preview')).toBeInTheDocument();
  });
  
  it('renders error state correctly', () => {
    const errorMessage = 'Failed to load report data';
    
    render(
      <MockProvider>
        <ReportPreview 
          reportData={null} 
          format="PDF" 
          reportType="Transaction" 
          error={errorMessage}
        />
      </MockProvider>
    );
    
    expect(screen.getByText(`Failed to generate preview: ${errorMessage}`)).toBeInTheDocument();
  });
  
  it('renders PDF preview correctly', async () => {
    render(
      <MockProvider>
        <ReportPreview 
          reportData={mockReportData} 
          format="PDF" 
          reportType="Transaction" 
        />
      </MockProvider>
    );
    
    // Initial state should show pagination controls
    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();
    
    // Test pagination
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);
    expect(screen.getByText('Page 2 of 5')).toBeInTheDocument();
    
    // Wait for PDF preview to load
    await waitFor(() => {
      expect(screen.getByText('PDF Preview')).toBeInTheDocument();
    });
  });
  
  it('renders CSV/Excel preview correctly', () => {
    render(
      <MockProvider>
        <ReportPreview 
          reportData={mockReportData} 
          format="CSV" 
          reportType="Transaction" 
        />
      </MockProvider>
    );
    
    // Should display table data and info message
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('customer')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('CSV and Excel reports provide raw data for analysis in spreadsheet applications.')).toBeInTheDocument();
  });
  
  it('renders HTML preview correctly', () => {
    render(
      <MockProvider>
        <ReportPreview 
          reportData={mockReportData} 
          format="HTML" 
          reportType="Transaction" 
        />
      </MockProvider>
    );
    
    // Should display report title and data
    expect(screen.getByText('Transaction Report')).toBeInTheDocument();
    expect(screen.getByText(/Generated:/)).toBeInTheDocument();
  });
  
  it('calls onExport when export button is clicked', () => {
    const handleExport = jest.fn();
    
    render(
      <MockProvider>
        <ReportPreview 
          reportData={mockReportData} 
          format="PDF" 
          reportType="Transaction"
          onExport={handleExport}
        />
      </MockProvider>
    );
    
    const exportButton = screen.getByText('Export PDF');
    fireEvent.click(exportButton);
    
    expect(handleExport).toHaveBeenCalledWith('PDF');
  });
  
  it('calls onPrint when print button is clicked', () => {
    const handlePrint = jest.fn();
    
    render(
      <MockProvider>
        <ReportPreview 
          reportData={mockReportData} 
          format="PDF" 
          reportType="Transaction"
          onPrint={handlePrint}
        />
      </MockProvider>
    );
    
    const printButton = screen.getByText('Print');
    fireEvent.click(printButton);
    
    expect(handlePrint).toHaveBeenCalled();
  });
  
  it('switches between preview and data tabs', () => {
    render(
      <MockProvider>
        <ReportPreview 
          reportData={mockReportData} 
          format="PDF" 
          reportType="Transaction"
        />
      </MockProvider>
    );
    
    // Initially on Preview tab
    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();
    
    // Switch to Data tab
    const dataTab = screen.getByText('Data');
    fireEvent.click(dataTab);
    
    // Should show data table without preview controls
    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.queryByText('Page 1 of 5')).not.toBeInTheDocument();
  });
}); 