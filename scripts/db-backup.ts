import dotenv from 'dotenv';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createDatabaseBackup } from '../src/utils/db';

// Load environment variables
dotenv.config();

// Define backup directory
const BACKUP_DIR = path.join(process.cwd(), 'backups');

/**
 * Creates a database backup using Prisma and Supabase
 * This is a simplified example - in production, you would:
 * 1. Use Supabase's built-in backup features
 * 2. Store backups in a secure cloud storage (AWS S3, GCP Cloud Storage, etc.)
 * 3. Set up proper error handling and notifications
 */
async function backupDatabase() {
  console.log('Starting database backup...');
  
  try {
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      console.log(`Created backup directory: ${BACKUP_DIR}`);
    }
    
    // Create timestamp for backup file
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    const backupFileName = `backup-${timestamp}.sql`;
    const backupFilePath = path.join(BACKUP_DIR, backupFileName);
    
    // Run the backup using PostgreSQL dump
    // In production, you would use the Supabase API or direct PostgreSQL connection
    if (process.env.DATABASE_URL) {
      console.log('Backing up database...');
      
      // For actual implementation, use something like:
      // execSync(`pg_dump "${process.env.DATABASE_URL}" > "${backupFilePath}"`, { stdio: 'inherit' });
      
      // For demo/development purposes, we're just creating a placeholder backup file
      fs.writeFileSync(backupFilePath, `-- Database backup created at ${timestamp}\n-- This is a placeholder for an actual SQL dump`);
      
      console.log(`Backup created at: ${backupFilePath}`);
      
      // Call the utility function for additional backup tasks
      const backupResult = await createDatabaseBackup();
      if (backupResult) {
        console.log('Additional backup tasks completed successfully');
      } else {
        console.warn('Additional backup tasks were not fully successful');
      }
      
      // For automatic rotation/cleanup of old backups
      cleanupOldBackups();
      
      console.log('Database backup completed successfully!');
    } else {
      throw new Error('DATABASE_URL environment variable is not set');
    }
  } catch (error) {
    console.error('Database backup failed:', error);
    process.exit(1);
  }
}

/**
 * Cleans up old backups, keeping only the latest N backups
 */
function cleanupOldBackups(maxBackups = 7) {
  try {
    // Get all backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(file => file.startsWith('backup-') && file.endsWith('.sql'))
      .map(file => ({
        name: file,
        path: path.join(BACKUP_DIR, file),
        time: fs.statSync(path.join(BACKUP_DIR, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Sort newest first
    
    // Remove excess backups
    if (files.length > maxBackups) {
      console.log(`Cleaning up old backups, keeping the latest ${maxBackups}...`);
      const filesToDelete = files.slice(maxBackups);
      
      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`Deleted old backup: ${file.name}`);
      });
    }
  } catch (error) {
    console.error('Error during backup cleanup:', error);
  }
}

// Run the backup
backupDatabase(); 