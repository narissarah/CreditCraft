import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { prisma } from '../prisma/client';
import { runDatabaseTests } from '../src/utils/dbTest';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

/**
 * Test migrations by creating a shadow database,
 * applying migrations, and validating the schema and data access
 */
async function testMigrations() {
  console.log('🧪 Testing database migrations...');

  try {
    // Ensure we have a connection to the database
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Check for migrations directory
    const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.warn('⚠️ No migrations directory found. Run initial migration first.');
      return false;
    }

    // Get migration list
    const migrations = fs.readdirSync(migrationsDir)
      .filter(dir => dir !== 'migration_lock.toml' && !dir.startsWith('.'));
    
    console.log(`📋 Found ${migrations.length} migrations to test`);

    // Reset the database to a clean state
    console.log('🔄 Resetting database for testing...');
    try {
      execSync('npx prisma migrate reset --force', { stdio: 'inherit' });
    } catch (error) {
      console.error('❌ Failed to reset database:', error);
      return false;
    }

    // Regenerate Prisma client to match the current schema
    console.log('🔄 Regenerating Prisma client...');
    try {
      execSync('npx prisma generate', { stdio: 'inherit' });
    } catch (error) {
      console.error('❌ Failed to regenerate Prisma client:', error);
      return false;
    }

    // Check that Prisma can connect to the database
    console.log('🔍 Testing database connection...');
    try {
      await prisma.$connect();
      console.log('✅ Successfully connected to the database');
    } catch (error) {
      console.error('❌ Failed to connect to the database:', error);
      return false;
    }

    // Run database model tests to ensure schema is correct
    console.log('🧪 Testing database models...');
    const testsSuccessful = await runDatabaseTests();
    
    if (!testsSuccessful) {
      console.error('❌ Database model tests failed');
      return false;
    }

    console.log('✅ All migration tests passed successfully!');
    return true;
  } catch (error) {
    console.error('❌ Migration tests failed:', error);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the tests
testMigrations()
  .then(success => {
    if (!success) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('❌ Unhandled error in migration tests:', error);
    process.exit(1);
  }); 