import Papa from 'papaparse';
import { CustomerImportResult } from '../types/customer';

interface CustomerImportRow {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  shopify_customer_id?: string;
  tags?: string;
}

/**
 * Validates a customer import row
 */
function validateCustomerRow(row: CustomerImportRow, lineNumber: number): { valid: boolean; error?: string } {
  // Email is required
  if (!row.email || !row.email.trim()) {
    return { valid: false, error: 'Email is required' };
  }
  
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(row.email.trim())) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  return { valid: true };
}

/**
 * Parse tags from string format
 */
function parseTags(tagsString?: string): string[] {
  if (!tagsString) return [];
  
  return tagsString
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
}

/**
 * Imports customers from a CSV file
 */
export async function importCustomersFromCsv(
  file: File, 
  shopDomain: string
): Promise<CustomerImportResult> {
  return new Promise((resolve, reject) => {
    const result: CustomerImportResult = {
      total: 0,
      imported: 0,
      skipped: 0,
      errors: [],
    };
    
    const validCustomers: Array<{
      email: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      shopifyCustomerId?: string;
      tags?: string[];
    }> = [];
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (parseResults) => {
        if (parseResults.errors.length > 0) {
          reject(new Error('Error parsing CSV file'));
          return;
        }
        
        const rows = parseResults.data as CustomerImportRow[];
        result.total = rows.length;
        
        // Validate rows
        rows.forEach((row, index) => {
          const lineNumber = index + 2; // +2 because index is 0-based and headers are on line 1
          const validation = validateCustomerRow(row, lineNumber);
          
          if (!validation.valid) {
            result.errors.push({
              line: lineNumber,
              email: row.email || 'N/A',
              reason: validation.error || 'Unknown error',
            });
            return;
          }
          
          // Add to valid customers
          validCustomers.push({
            email: row.email!.trim(),
            firstName: row.first_name?.trim(),
            lastName: row.last_name?.trim(),
            phone: row.phone?.trim(),
            shopifyCustomerId: row.shopify_customer_id?.trim(),
            tags: parseTags(row.tags),
          });
        });
        
        try {
          // Send to API for processing
          const response = await fetch('/api/customers/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              customers: validCustomers,
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to import customers');
          }
          
          const importResult = await response.json();
          
          // Merge API result with validation result
          result.imported = importResult.imported;
          result.skipped = importResult.skipped;
          result.errors = [...result.errors, ...importResult.errors];
          
          resolve(result);
        } catch (error) {
          console.error('Error importing customers:', error);
          reject(error);
        }
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        reject(error);
      },
    });
  });
}

/**
 * Generates a sample CSV template for customer import
 */
export function generateCustomerCsvTemplate(): string {
  const headers = ['email', 'first_name', 'last_name', 'phone', 'shopify_customer_id', 'tags'];
  const sampleRow = ['customer@example.com', 'John', 'Doe', '+1 (123) 456-7890', '12345678', 'vip,returning'];
  
  return Papa.unparse({
    fields: headers,
    data: [sampleRow],
  });
}

/**
 * Download a file
 */
export function downloadFile(content: string, fileName: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  
  a.href = url;
  a.download = fileName;
  a.click();
  
  URL.revokeObjectURL(url);
}

/**
 * Download a customer CSV template
 */
export function downloadCustomerCsvTemplate(): void {
  const content = generateCustomerCsvTemplate();
  downloadFile(content, 'customer_import_template.csv', 'text/csv');
} 