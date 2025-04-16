import { Transaction } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { createObjectCsvWriter } from 'csv-writer';
import { logger } from './logger';

/**
 * Export transactions to a file (CSV or JSON)
 */
export async function exportTransactions({
  transactions,
  format = 'csv',
  outputDir = 'exports',
  filename,
}: {
  transactions: Transaction[];
  format?: 'csv' | 'json';
  outputDir?: string;
  filename?: string;
}): Promise<{ filePath: string; count: number }> {
  try {
    // Create the output directory if it doesn't exist
    const fullOutputDir = path.resolve(process.cwd(), outputDir);
    if (!fs.existsSync(fullOutputDir)) {
      fs.mkdirSync(fullOutputDir, { recursive: true });
    }
    
    // Generate a filename if not provided
    const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
    const defaultFilename = `transactions-${timestamp}.${format}`;
    const outputFilename = filename || defaultFilename;
    const filePath = path.join(fullOutputDir, outputFilename);
    
    if (format === 'csv') {
      // Define the CSV writer with header fields
      const csvWriter = createObjectCsvWriter({
        path: filePath,
        header: [
          { id: 'id', title: 'Transaction ID' },
          { id: 'creditId', title: 'Credit ID' },
          { id: 'type', title: 'Type' },
          { id: 'amount', title: 'Amount' },
          { id: 'staffId', title: 'Staff ID' },
          { id: 'locationId', title: 'Location ID' },
          { id: 'orderId', title: 'Order ID' },
          { id: 'orderNumber', title: 'Order Number' },
          { id: 'note', title: 'Note' },
          { id: 'timestamp', title: 'Timestamp' },
          { id: 'customerId', title: 'Customer ID' },
        ],
      });
      
      // Format the transaction data for CSV
      const formattedTransactions = transactions.map(transaction => ({
        ...transaction,
        timestamp: transaction.timestamp.toISOString(),
        amount: transaction.amount.toString(),
      }));
      
      // Write the CSV file
      await csvWriter.writeRecords(formattedTransactions);
    } else if (format === 'json') {
      // Format the transaction data for JSON
      const formattedTransactions = transactions.map(transaction => ({
        ...transaction,
        timestamp: transaction.timestamp.toISOString(),
        amount: parseFloat(transaction.amount.toString()),
      }));
      
      // Write the JSON file
      fs.writeFileSync(
        filePath,
        JSON.stringify({ transactions: formattedTransactions }, null, 2)
      );
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }
    
    logger.info(`Exported ${transactions.length} transactions to ${filePath}`);
    
    return {
      filePath,
      count: transactions.length,
    };
  } catch (error) {
    logger.error('Error exporting transactions:', error);
    throw new Error(`Failed to export transactions: ${error.message}`);
  }
}

/**
 * Get a readable stream for a transaction export file
 */
export function getExportFileStream(filePath: string): fs.ReadStream {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Export file not found: ${filePath}`);
    }
    
    return fs.createReadStream(filePath);
  } catch (error) {
    logger.error('Error creating export file stream:', error);
    throw new Error(`Failed to create export file stream: ${error.message}`);
  }
} 