import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Database and ORM configuration
 */
export const databaseConfig = {
  // Database URL with connection string from environment variables
  url: process.env.DATABASE_URL || '',
  
  // Supabase configuration
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || '',
    
    // Security settings
    enableSSL: true,
    enableRLS: true, // Row Level Security
    
    // Backup settings
    enablePITR: true, // Point in Time Recovery
    backupRetentionDays: 7,
    
    // Migration settings
    usePrismaMigrations: true,
  },
  
  // Connection pool settings
  pool: {
    min: 2,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
  
  // Security settings
  security: {
    sslEnabled: true,
    // Allowed IP addresses for database access
    // In production, this should be restricted to application servers and admin IPs
    allowedIPs: process.env.NODE_ENV === 'production'
      ? (process.env.DB_ALLOWED_IPS || '').split(',')
      : ['localhost', '127.0.0.1'],
  },
  
  // Logging and monitoring
  logging: {
    slowQueryThreshold: 1000, // in milliseconds
    logQueries: process.env.NODE_ENV === 'development',
    logErrors: true,
  },
  
  // Schema and migration settings
  schema: {
    // Tables that should have row-level security enabled
    tablesWithRLS: ['credits', 'transactions', 'customers'],
    
    // Use Prisma migrations exclusively
    usePrismaMigrations: true,
  }
};

export default databaseConfig; 