# CreditCraft Deployment Guide

This guide provides detailed instructions for deploying the CreditCraft application to production using Railway for the backend, Vercel for the frontend, and configuring the necessary security and monitoring tools.

## Prerequisites

- GitHub account with access to the CreditCraft repository
- Railway account (https://railway.app)
- Vercel account (https://vercel.com)
- Supabase account (for database)
- Redis instance (for caching and rate limiting)

## Environment Variables

The application requires several environment variables. Use `.env.example` as a reference. The following variables must be set in your deployment platforms:

### Core Configuration
- `SHOPIFY_API_KEY` - Your Shopify API key
- `SHOPIFY_API_SECRET` - Your Shopify API secret
- `SHOPIFY_APP_URL` - The URL of your deployed app
- `SHOPIFY_APP_NAME` - The name of your app (CreditCraft)
- `SHOPIFY_SCOPES` - Required scopes for the Shopify API

### Database Configuration
- `DATABASE_URL` - Supabase PostgreSQL connection string
- `POSTGRES_URL_NON_POOLING` - Non-pooling database URL
- `DB_SSL_ENABLED` - Enable SSL for database connections (should be true in production)
- `DB_ALLOWED_IPS` - Comma-separated list of allowed IPs

### Supabase Configuration
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Supabase service role key
- `SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_JWT_SECRET` - JWT secret for authentication

### Redis Configuration
- `REDIS_URL` - Redis instance URL
- `REDIS_PASSWORD` - Redis password
- `REDIS_TLS_ENABLED` - Enable TLS for Redis (should be true in production)

### Vercel Configuration
- `VERCEL_TOKEN` - Vercel API token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

## 1. Railway Setup for Backend Deployment

Railway is used to host the backend Node.js application.

### Setup Steps

1. **Create a Railway Project**:
   - Go to https://railway.app and create a new project
   - Select "Deploy from GitHub repo"
   - Select the CreditCraft repository

2. **Configure Environment Variables**:
   - Go to your project's "Variables" tab
   - Add all required environment variables from the list above
   - Ensure sensitive variables (API keys, secrets) are properly secured

3. **Configure Build Settings**:
   - Set the build command to `npm run build`
   - Set the start command to `npm run serve`

4. **Set Up Database**:
   - Add a PostgreSQL plugin from the Railway dashboard
   - Railway will automatically set the `DATABASE_URL` environment variable

5. **Set Up Redis**:
   - Add a Redis plugin from the Railway dashboard
   - Railway will automatically set the `REDIS_URL` environment variable

6. **Configure Domain**:
   - Go to the "Settings" tab in your Railway project
   - Set up a custom domain for your backend API
   - Update the `SHOPIFY_APP_URL` environment variable with this domain

## 2. Vercel Setup for Frontend Deployment

Vercel is used to host the frontend React application.

### Setup Steps

1. **Create a Vercel Project**:
   - Go to https://vercel.com and create a new project
   - Import the CreditCraft repository
   - Select the frontend directory as the root directory (if applicable)

2. **Configure Environment Variables**:
   - Go to your project's "Settings" > "Environment Variables"
   - Add all required environment variables, especially API endpoints
   - Ensure `NEXT_PUBLIC_` prefix for any variables needed on the client side

3. **Configure Build Settings**:
   - Framework preset: Select "Create React App" or "Next.js" based on your frontend
   - Build command: `npm run build`
   - Output directory: `dist` or `build` (based on your frontend setup)
   - Install command: `npm ci`

4. **Set Up Domain**:
   - Go to "Settings" > "Domains"
   - Add and configure your custom domain
   - Update any relevant environment variables with this domain

## 3. Database Migration Automation

Database migrations are automated through the CI/CD pipeline.

### Setup Steps

1. **Prisma Migration Configuration**:
   - Ensure all database schema changes are tracked in Prisma migration files
   - Migrations are run automatically during deployment

2. **Backup Configuration**:
   - Regular backups are performed daily using the `db:backup` script
   - Point-in-Time Recovery (PITR) is enabled in Supabase

3. **Managing Migrations**:
   - When adding new migrations:
     - Run `npm run prisma:migrate:dev` locally to create migration
     - Commit the new migration files to the repository
     - Migrations will be applied automatically during deployment

## 4. Monitoring, Error Tracking, and Security

### Monitoring Setup

1. **UptimeRobot Configuration**:
   - Create a new monitor for your API endpoints
   - Set up alerts for downtime notifications

2. **Error Tracking with Sentry**:
   - Sign up at https://sentry.io
   - Add the Sentry SDK to your application
   - Configure environment variables:
     - `SENTRY_DSN` - Sentry project DSN
     - `SENTRY_ENVIRONMENT` - Environment name (production, staging)

3. **Logging**:
   - Railway and Vercel provide built-in logs
   - For advanced logging, configure Winston to send logs to a centralized service

### Security Configuration

1. **SSL/TLS Configuration**:
   - Both Railway and Vercel provide automatic SSL/TLS certificates
   - Ensure `HTTPS` is enforced for all communications

2. **Security Headers**:
   - Helmet.js is used to set security headers
   - Ensure `helmet` middleware is properly configured in `server.js`

3. **Rate Limiting**:
   - Rate limiting is implemented via Redis
   - Configure appropriate limits based on expected traffic

### Audit and Compliance

1. **Regular Security Audits**:
   - Run `npm audit` regularly to check for vulnerabilities
   - Keep dependencies updated with `npm update`

2. **Compliance Checklist**:
   - Review the compliance checklist before each major release
   - Ensure all security measures are properly implemented

## 5. CI/CD Pipeline

The CI/CD pipeline is configured using GitHub Actions.

### Pipeline Configuration

1. **Workflow File**:
   - Located at `.github/workflows/main.yml`
   - Configured to run tests, linting, and deployment

2. **Secret Management**:
   - Store all sensitive information in GitHub Secrets
   - Reference these secrets in the workflow file

3. **Deployment Process**:
   - On push to main branch:
     - Run tests and linting
     - Build the application
     - Deploy to Railway and Vercel
     - Run database migrations
     - Verify deployment

## Troubleshooting

### Common Issues

1. **Database Connection Issues**:
   - Verify that the `DATABASE_URL` is correct
   - Check that the database is accessible from the application

2. **Redis Connection Issues**:
   - Verify that the `REDIS_URL` is correct
   - Check Redis authentication and TLS settings

3. **Deployment Failures**:
   - Check GitHub Actions logs for detailed error information
   - Verify that all required environment variables are set

## Maintenance Procedures

### Regular Maintenance Tasks

1. **Database Backups**:
   - Automated daily backups
   - Manually test restoration process monthly

2. **Dependency Updates**:
   - Run `npm outdated` to check for updates
   - Update dependencies regularly with `npm update`

3. **Security Audits**:
   - Run `npm audit` weekly
   - Fix identified vulnerabilities promptly

## Emergency Procedures

### Rollback Procedure

1. **Identify the Issue**:
   - Check logs and error tracking to identify the problem

2. **Rollback Deployment**:
   - Go to Railway and Vercel dashboards
   - Rollback to the previous successful deployment

3. **Database Rollback**:
   - If necessary, restore from the most recent backup
   - Use PITR to restore to a specific point in time 