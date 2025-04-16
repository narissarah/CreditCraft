import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { testDatabaseConnection } from '../src/utils/dbTest';

// Load environment variables
dotenv.config();

async function initializeDatabase() {
  console.log('🚀 Initializing database...');

  try {
    // Check environment variables
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Generate Prisma client
    console.log('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Run migrations
    console.log('🔄 Running migrations...');
    execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });

    // Test connection
    console.log('🔍 Testing database connection...');
    const connectionSuccessful = await testDatabaseConnection();
    if (!connectionSuccessful) {
      throw new Error('Database connection test failed');
    }

    // Seed database
    console.log('🌱 Seeding database with initial data...');
    execSync('npx prisma db seed', { stdio: 'inherit' });

    console.log('✅ Database initialization completed successfully!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run the initialization
initializeDatabase(); 