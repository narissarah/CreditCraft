import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth';
import { validateShopifyToken, getShopFromToken } from './shopifyAuth';

/**
 * Interface for verified JWT token data
 */
interface TokenPayload {
  shop: string;
  iss?: string;
  dest?: string;
  aud?: string;
  sub?: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  jti?: string;
  sid?: string;
}

/**
 * Middleware to verify Shopify authentication for API routes
 */
export function verifyShopifyAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get the token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Validate the token
    if (!validateShopifyToken(token)) {
      return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
    
    // Extract shop information
    const shop = getShopFromToken(token);
    if (!shop) {
      return res.status(401).json({ error: 'Unauthorized - Missing shop information' });
    }
    
    // Add shop to request object for use in route handlers
    (req as any).shop = shop;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Unauthorized - Authentication failed' });
  }
}

/**
 * Middleware to verify API JWT authentication
 */
export function verifyApiAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Get the token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized - No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token
    const decoded = jwt.verify(token, authConfig.jwt.secret) as TokenPayload;
    
    // Add user data to request object
    (req as any).user = decoded;
    
    next();
  } catch (error) {
    console.error('API authentication error:', error);
    return res.status(401).json({ error: 'Unauthorized - Invalid token' });
  }
}

/**
 * Middleware to verify POS-specific authentication
 */
export function verifyPOSAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // Verify standard Shopify auth first
    verifyShopifyAuth(req, res, (err) => {
      if (err) return next(err);
      
      // Additional POS-specific verification could be done here
      // For example, checking if the request comes from a POS device
      
      // Check for POS-specific headers
      const posDeviceId = req.headers['x-pos-device-id'];
      if (!posDeviceId) {
        return res.status(401).json({ error: 'Unauthorized - Not a POS request' });
      }
      
      // Add POS context to request
      (req as any).posDevice = posDeviceId;
      
      next();
    });
  } catch (error) {
    console.error('POS authentication error:', error);
    return res.status(401).json({ error: 'Unauthorized - POS authentication failed' });
  }
}

/**
 * Middleware factory for role-based access control
 */
export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // First verify the token is valid
      verifyApiAuth(req, res, (err) => {
        if (err) return next(err);
        
        // Check if user has required role
        const userRoles = (req as any).user.roles || [];
        const hasRole = roles.some(role => userRoles.includes(role));
        
        if (!hasRole) {
          return res.status(403).json({ 
            error: 'Forbidden - Insufficient permissions' 
          });
        }
        
        next();
      });
    } catch (error) {
      console.error('Role verification error:', error);
      return res.status(403).json({ error: 'Forbidden - Role verification failed' });
    }
  };
} 