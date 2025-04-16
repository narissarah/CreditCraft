import dotenv from 'dotenv';

dotenv.config();

export const authConfig = {
  shopify: {
    apiKey: process.env.SHOPIFY_API_KEY || '',
    apiSecret: process.env.SHOPIFY_API_SECRET || '',
    scopes: (process.env.SHOPIFY_SCOPES || '').split(','),
    appUrl: process.env.SHOPIFY_APP_URL || '',
    embedded: true,
    // Auth configuration for secure cookies
    cookies: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'none' as const,
      httpOnly: true,
    }
  },
  // Session configuration
  session: {
    secret: process.env.SESSION_SECRET || 'your-session-secret',
    duration: 24 * 60 * 60 * 1000, // 24 hours
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'none' as const,
    secure: process.env.NODE_ENV === 'production',
  },
  // JWT settings
  jwt: {
    secret: process.env.JWT_SECRET || process.env.SHOPIFY_API_SECRET || '',
    expiresIn: '24h',
  }
}; 