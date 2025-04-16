import React, { useState, useEffect } from 'react';
import {
  Card,
  Spinner,
  Banner,
  Button,
  TextContainer,
  Stack,
  Text,
  Icon,
  Tabs,
  LegacyCard,
  DataTable,
  Thumbnail,
  MediaCard
} from '@shopify/polaris';
import {
  DocumentMajor,
  ChartBarMajor,
  PageDownMajor,
  PageUpMajor,
  AlertMinor,
  PrintMinor,
  DownloadMinor
} from '@shopify/polaris-icons';

interface ReportPreviewProps {
  reportData: any;
  format: string;
  reportType: string;
  isLoading?: boolean;
  error?: string;
  onExport?: (format: string) => void;
  onPrint?: () => void;
}

export default function ReportPreview({
  reportData,
  format,
  reportType,
  isLoading = false,
  error = '',
  onExport,
  onPrint
}: ReportPreviewProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  
  // Number of pages in the preview (for PDF format)
  const totalPages = 5; // This would normally be determined from the PDF
  
  useEffect(() => {
    // This effect would normally generate a preview based on the format
    if (format === 'PDF' && reportData) {
      // In a real implementation, we'd generate a PDF blob here
      // For now we'll just simulate it
      setTimeout(() => {
        const simulatedBlob = new Blob(['PDF content'], { type: 'application/pdf' });
        setPdfBlob(simulatedBlob);
        setPdfUrl(URL.createObjectURL(simulatedBlob));
      }, 1000);
    }
    
    return () => {
      // Clean up any created object URLs
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [format, reportData]);
  
  const handleTabChange = (selectedTabIndex: number) => {
    setActiveTab(selectedTabIndex);
  };
  
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prevPage => prevPage + 1);
    }
  };
  
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prevPage => prevPage - 1);
    }
  };
  
  const tabs = [
    {
      id: 'preview',
      content: 'Preview',
      accessibilityLabel: 'Preview tab',
      panelID: 'preview-panel',
    },
    {
      id: 'data',
      content: 'Data',
      accessibilityLabel: 'Data tab',
      panelID: 'data-panel',
    },
  ];
  
  // Render table data from the report data
  const renderTableData = () => {
    if (!reportData || !reportData.data) {
      return <Text>No data available</Text>;
    }
    
    // In a real implementation, this would format the data based on the report type
    const columnHeadings = Object.keys(reportData.data[0] || {});
    const rows = reportData.data.map((item: any) => {
      return columnHeadings.map(heading => item[heading]);
    });
    
    return (
      <LegacyCard>
        <DataTable
          columnContentTypes={columnHeadings.map(() => 'text')}
          headings={columnHeadings}
          rows={rows}
        />
      </LegacyCard>
    );
  };
  
  // Render the preview based on the format
  const renderPreview = () => {
    if (isLoading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
          <Spinner accessibilityLabel="Loading preview" size="large" />
        </div>
      );
    }
    
    if (error) {
      return (
        <Banner status="critical" icon={AlertMinor}>
          <p>Failed to generate preview: {error}</p>
        </Banner>
      );
    }
    
    if (!reportData) {
      return (
        <Banner status="info">
          <p>No data available for preview. Try adjusting the report parameters.</p>
        </Banner>
      );
    }
    
    switch (format) {
      case 'PDF':
        return (
          <div>
            <div style={{ marginBottom: '10px' }}>
              <Card>
                <Card.Section>
                  <Stack distribution="equalSpacing">
                    <Text>Page {currentPage} of {totalPages}</Text>
                    <Stack>
                      <Button 
                        icon={PageUpMajor} 
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      <Button 
                        icon={PageDownMajor} 
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </Stack>
                  </Stack>
                </Card.Section>
              </Card>
            </div>
            
            <div style={{ height: '500px', border: '1px solid #ddd', borderRadius: '5px', overflow: 'hidden' }}>
              {pdfUrl ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <MediaCard
                    title="PDF Preview"
                    primaryAction={{
                      content: 'Download',
                      onAction: () => onExport && onExport('PDF'),
                    }}
                    description="This is a preview of the PDF report. Download or print to see the full report."
                  >
                    <img
                      alt="PDF preview"
                      width="100%"
                      height="100%"
                      style={{ objectFit: 'contain' }}
                      src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgPHBhdGggZD0iTTcgMTguMzJDNS44MyAxOC4zMiA0LjgxIDE3Ljk3IDMuOTUgMTcuMjdDMy4wOSAxNi41NyAyLjUgMTUuNzMgMi4xOCAxNC43N0MyLjA2IDE0LjQ3IDIgMTQuMTUgMiAxMy44MkMyIDEyLjc0IDIuMzggMTEuODcgMy4xMiAxMS4yMkMzLjg3IDEwLjU2IDQuNzkgMTAuMjMgNS44OCAxMC4yM0M2LjI5IDEwLjIzIDYuNjkgMTAuMjkgNy4wNiAxMC40TDYuODMgMTEuOEM2LjUgMTEuNjkgNi4xNiAxMS42NCA1LjgxIDExLjY0QzUuMDggMTEuNjQgNC40OCAxMS44NyAzLjk5IDEyLjMyQzMuNTEgMTIuNzggMy4yNiAxMy4zNSAzLjI2IDE0LjA0QzMuMjYgMTQuMDcgMy4yNiAxNC4xMiAzLjI2IDE0LjE5QzMuMjYgMTQuMjUgMy4yNyAxNC4zMSAzLjI5IDE0LjM2QzMuNDEgMTUuMDEgMy43NCAxNS41OCA0LjMgMTYuMDZDNC44NiAxNi41MyA1LjUxIDE2Ljc3IDYuMjUgMTYuNzdDNi42NiAxNi43NyA3LjA2IDE2LjY4IDcuNDUgMTYuNTFMNy43NSAxNy44QzcuMjggMTguMTQgNi43IDE4LjMyIDcgMTguMzJaTTEzLjM4IDE4LjMyQzEyLjE0IDE4LjMyIDExLjEyIDE3Ljg5IDEwLjMzIDE3LjAzQzkuNTMgMTYuMTcgOS4xNCAxNS4wNiA5LjE0IDEzLjY5VjEzLjExQzkuMTQgMTEuNzEgOS41MiAxMC41OCAxMC4yOSA5LjczQzExLjA1IDguODggMTIuMDcgOC40NSAxMy4zNCA4LjQ1QzE0LjYgOC40NSAxNS42MSA4Ljg4IDE2LjM3IDkuNzNDMTcuMTMgMTAuNTggMTcuNTEgMTEuNyAxNy41MSAxMy4xMVYxMy42OUMxNy41MSAxNS4wNiAxNy4xMyAxNi4xNyAxNi4zNiAxNy4wM0MxNS41OSAxNy44OSAxNC41OSAxOC4zMiAxMy4zOCAxOC4zMlpNMTMuMzQgOS45MkMxMi42IDkuOTIgMTIuMDEgMTAuMjEgMTEuNTcgMTAuOEMxMS4xMyAxMS4zOCAxMC45MSAxMi4xNiAxMC45MSAxMy4xMVYxMy42OUMxMC45MSAxNC42MiAxMS4xMyAxNS4zOSAxMS41NyAxNS45OEMxMi4wMSAxNi41NyAxMi41OSAxNi44NiAxMy4zMiAxNi44NkMxNC4wNyAxNi44NiAxNC42NiAxNi41NyAxNS4xIDE1Ljk4QzE1LjU0IDE1LjM5IDE1Ljc2IDE0LjYyIDE1Ljc2IDEzLjY5VjEzLjExQzE1Ljc2IDEyLjE2IDE1LjU0IDExLjM4IDE1LjEgMTAuOEMxNC42NiAxMC4yMSAxNC4wOCA5LjkyIDEzLjM0IDkuOTJaTTIyIDE0Ljk4VjE3Ljk2SDIwLjM1VjIySDE4LjY5VjE0LjQ1SDIyVjE0Ljk4QzIyLjAwMDEgMTQuOTggMjIuMDAwMSAxNC45OCAyMiAxNC45OEM0Mi4wMDAxIC0xMC4wMiAyMiAxNC45OCAyMiAxNC45OFoiIGZpbGw9IiM1QzZBQzQiLz4KPC9zdmc+Cg=="
                    />
                  </MediaCard>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Spinner accessibilityLabel="Loading PDF" size="large" />
                </div>
              )}
            </div>
          </div>
        );
        
      case 'CSV':
      case 'EXCEL':
        return (
          <div>
            {renderTableData()}
            <div style={{ marginTop: '10px' }}>
              <Banner status="info">
                <p>CSV and Excel reports provide raw data for analysis in spreadsheet applications. Click Export to download the file.</p>
              </Banner>
            </div>
          </div>
        );
        
      case 'HTML':
        return (
          <div>
            <div style={{ height: '500px', border: '1px solid #ddd', borderRadius: '5px', padding: '20px', overflow: 'auto' }}>
              <TextContainer>
                <Text variant="headingLg" as="h3">{reportType} Report</Text>
                <Text variant="bodyMd">Generated: {new Date().toLocaleString()}</Text>
                
                {/* Example report content - this would be dynamic in a real implementation */}
                <div style={{ marginTop: '20px' }}>
                  {renderTableData()}
                </div>
              </TextContainer>
            </div>
          </div>
        );
        
      default:
        return (
          <Banner status="warning">
            <p>Unsupported format: {format}</p>
          </Banner>
        );
    }
  };
  
  return (
    <Card>
      <Card.Section title="Report Preview">
        <Tabs tabs={tabs} selected={activeTab} onSelect={handleTabChange} />
        
        <div style={{ marginTop: '16px' }}>
          {activeTab === 0 ? (
            renderPreview()
          ) : (
            renderTableData()
          )}
        </div>
      </Card.Section>
      
      <Card.Section>
        <Stack distribution="trailing">
          {onPrint && (
            <Button icon={PrintMinor} onClick={onPrint}>
              Print
            </Button>
          )}
          
          {onExport && (
            <Button icon={DownloadMinor} primary onClick={() => onExport(format)}>
              Export {format}
            </Button>
          )}
        </Stack>
      </Card.Section>
    </Card>
  );
} 