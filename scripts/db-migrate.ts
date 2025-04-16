import dotenv from 'dotenv';
import { execSync } from 'child_process';
import { trackException, trackMessage } from '../src/config/monitoring';

// Load environment variables
dotenv.config();

/**
 * Runs database migrations using Prisma
 * This script is intended to be run during the deployment process
 */
async function runDatabaseMigrations() {
  console.log('Starting database migrations...');
  
  try {
    // Check environment variables
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    // Generate Prisma client
    console.log('Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Create backup before migration (if not in CI environment)
    if (process.env.CI !== 'true') {
      console.log('Creating database backup before migration...');
      try {
        execSync('npm run db:backup', { stdio: 'inherit' });
      } catch (backupError) {
        console.warn('Backup creation failed, but proceeding with migration:', backupError);
        trackMessage('Database backup failed before migration', 'warning', { error: backupError });
      }
    }
    
    // Run migrations in production mode
    console.log('Applying migrations to database...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    
    // Verify database connection after migration
    console.log('Verifying database connection after migration...');
    execSync('npx tsx src/utils/dbTest.ts', { stdio: 'inherit' });
    
    console.log('Database migration completed successfully!');
    trackMessage('Database migration completed successfully', 'info');
    
    return true;
  } catch (error) {
    console.error('Database migration failed:', error);
    trackException(error as Error, { context: 'db-migrate.ts' });
    
    // Exit with error code to signal failure in CI/CD pipeline
    process.exit(1);
  }
}

// Run the migration
runDatabaseMigrations(); 