import { PrismaClient } from '@prisma/client';
import { configurePrismaMiddleware } from './prismaMiddleware';

// PrismaClient is attached to the `global` object in development to prevent
// exhausting your database connection limit.
// Learn more: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// Configure Prisma client with connection pool settings
const prismaClientSingleton = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Connection pooling configuration
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Configure connection pool size
    // These values should be adjusted based on your application's needs
    // and the capacity of your database server
    // @ts-expect-error - These properties exist but aren't in the types
    connection: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    },
  });

  // Apply all middleware
  return configurePrismaMiddleware(client);
};

export const prisma = globalForPrisma.prisma || prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma; 