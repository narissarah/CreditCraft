# Database Configuration Summary

## Overview
This document summarizes the database configuration and setup for the CreditCraft application. The application uses Supabase PostgreSQL for data storage, Prisma ORM for database interactions, and Redis for caching and job queues.

## Database Architecture

### Primary Components
- **Supabase PostgreSQL**: Main database for storing all application data
- **Prisma ORM**: Object-Relational Mapping tool for database interactions
- **Redis**: Caching layer and job queue manager

### Data Models
- **Customer**: Stores customer information linked to Shopify customers
- **Credit**: Stores store credit information with amount, status, expiry
- **Transaction**: Records all credit-related transactions with audit trail

## Security Configuration
- SSL/TLS encryption for all database connections
- Row Level Security (RLS) enabled in Supabase
- IP restrictions for database access
- Strong password policies
- Connection pooling with optimized settings
- Least privilege principles for database roles

## Performance Optimizations
- Connection pooling (min: 2, max: 10 connections)
- Query performance monitoring and slow query detection
- Database indexes on frequently queried fields
- Efficient query patterns with pagination
- Redis caching for frequently accessed data
- TTL (Time-To-Live) cache expiration

## Database Migrations
- Managed through Prisma Migrations
- Version controlled in the repository
- Migration testing with shadow databases
- Documented rollback strategies
- CI/CD integration for automated deployments

## Backup Strategy
- Daily automated backups via Supabase
- Additional pg_dump script for redundant backups
- 7-day retention policy for regular backups
- Backup verification process
- Documented restoration procedures

## Monitoring and Metrics
- Database performance monitoring
- Slow query detection and logging
- Connection pool statistics
- Entity count tracking
- Error logging and alerting

## Environment Variables
Key database-related environment variables:
- `DATABASE_URL`: Main connection string
- `SUPABASE_URL` & `SUPABASE_KEY`: Supabase configuration
- `DB_POOL_MIN` & `DB_POOL_MAX`: Connection pool settings
- `DB_SSL_ENABLED`: SSL configuration
- `REDIS_URL` & `REDIS_PASSWORD`: Redis configuration

## Key Files
- `prisma/schema.prisma`: Database schema definition
- `prisma/client.ts`: Prisma client configuration
- `prisma/prismaMiddleware.ts`: Performance monitoring middleware
- `src/config/database.ts`: Database configuration settings
- `src/utils/db.ts`: Database utility functions
- `src/utils/dbPerformance.ts`: Performance monitoring utilities
- `scripts/db-backup.ts`: Database backup script
- `scripts/db-init.ts`: Database initialization script
- `scripts/test-migrations.ts`: Migration testing script

## Additional Resources
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [Redis Documentation](https://redis.io/documentation)
- [Database Migration Strategy](./migration-strategy.md) 