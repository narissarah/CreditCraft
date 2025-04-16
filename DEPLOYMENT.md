# CreditCraft Deployment Guide

This document outlines the steps to deploy CreditCraft to production using Vercel for hosting and connecting it to the Shopify platform.

## Prerequisites

- Shopify Partner account
- Vercel account
- GitHub repository with your CreditCraft codebase

## Step 1: Set Up Environment Variables

Before deploying, gather the following environment variables:

- `SHOPIFY_API_KEY`: Your Shopify app API key
- `SHOPIFY_API_SECRET`: Your Shopify app API secret
- `SHOPIFY_APP_URL`: Your production app URL (e.g., https://creditcraft.vercel.app)
- `DATABASE_URL`: Your PostgreSQL connection string
- `REDIS_URL`: Your Redis connection string
- `SESSION_SECRET`: A secure random string for session encryption
- `NODE_ENV`: Set to "production"

## Step 2: Deploy to Vercel

1. Push your code to GitHub
2. Log in to the Vercel dashboard
3. Import your GitHub repository
4. Add all required environment variables under "Settings > Environment Variables"
5. Deploy using the "Deploy" button or by running `npm run deploy:vercel`
6. Vercel will automatically build and deploy your application

Note: Our custom vercel.json configuration ensures the correct build process is used.

## Step 3: Update Shopify App Settings

1. Go to your Shopify Partner Dashboard
2. Navigate to your app settings
3. Update the App URL to your Vercel deployment URL
4. Update the redirect URLs to include:
   - `https://{your-vercel-url}/auth/callback`
   - `https://{your-vercel-url}/auth/shopify/callback`
5. Save your changes

## Step 4: Deploy to Shopify

After Vercel deployment is successful:

```bash
npm run deploy
```

This publishes your app to the Shopify App Store (if applicable) or makes it available for custom app installation.

## Step 5: Verify Deployment

1. Test the app installation flow on a development store
2. Verify all features are working correctly
3. Check database connections and Redis caching

## Production Monitoring

- Set up Sentry for error tracking
- Configure database backups
- Set up uptime monitoring

## Troubleshooting

If you encounter deployment issues:

1. Check Vercel build logs
2. Verify environment variables are correctly set
3. Review database connection settings
4. Ensure Shopify API credentials are valid

## Updating Your App

To deploy updates:

1. Make changes to your codebase
2. Commit and push to GitHub
3. Vercel will automatically deploy the changes
4. Run `npm run deploy` to update the Shopify app

## POS Extension Updates

For POS extension updates:

1. Make changes to the POS extension code
2. Run the deployment scripts in the extensions/pos-extension directory
3. Verify the extension appears in the POS app

## Security Considerations

- Ensure all environment variables are properly secured
- Set up rate limiting to prevent abuse
- Configure CORS to only allow necessary origins
- Use HTTPS for all communications
- Regularly update dependencies using `npm audit fix` 