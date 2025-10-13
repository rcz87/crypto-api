import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService';
import type { User, ApiKey } from '@shared/schema';

// Extend Express Request type to include auth data
declare global {
  namespace Express {
    interface Request {
      user?: User;
      apiKey?: ApiKey;
      authMethod?: 'jwt' | 'apikey';
    }
  }
}

/**
 * Middleware to authenticate requests via JWT or API Key
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check for API Key in header (X-API-Key)
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      const result = await authService.verifyApiKey(apiKey);
      if (!result) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid or expired API key' 
        });
      }

      req.user = result.user;
      req.apiKey = result.key;
      req.authMethod = 'apikey';
      return next();
    }

    // Check for JWT in Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = authService.verifyJWT(token);
        
        // Note: In production, you might want to fetch full user from DB
        // For now, we trust the JWT payload
        req.user = {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
        } as User;
        req.authMethod = 'jwt';
        return next();
      } catch (error) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid or expired token' 
        });
      }
    }

    // No authentication provided
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required. Provide X-API-Key or Authorization Bearer token.' 
    });
  } catch (error: any) {
    // Handle quota exceeded specifically
    if (error.message === 'API key quota exceeded') {
      return res.status(429).json({ 
        success: false, 
        error: 'API key quota exceeded',
        retryAfter: '24h',
      });
    }

    return res.status(500).json({ 
      success: false, 
      error: 'Authentication error' 
    });
  }
};

/**
 * Middleware to check if user has required scope
 */
export const requireScope = (requiredScope: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    // If authenticated via API key, check scopes
    if (req.authMethod === 'apikey' && req.apiKey) {
      if (!authService.hasScope(req.apiKey, requiredScope)) {
        return res.status(403).json({ 
          success: false, 
          error: `Insufficient permissions. Required scope: ${requiredScope}` 
        });
      }
    }

    // If authenticated via JWT, check role
    if (req.authMethod === 'jwt') {
      // Admin role has all permissions
      if (req.user.role === 'admin') {
        return next();
      }

      // Map scopes to roles
      const scopeRoleMap: Record<string, string[]> = {
        'read': ['user', 'premium', 'admin'],
        'write': ['premium', 'admin'],
        'trading': ['premium', 'admin'],
        'admin': ['admin'],
      };

      const allowedRoles = scopeRoleMap[requiredScope] || [];
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ 
          success: false, 
          error: `Insufficient permissions. Required scope: ${requiredScope}` 
        });
      }
    }

    next();
  };
};

/**
 * Middleware to optionally authenticate (don't fail if no auth provided)
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Try API Key
    const apiKey = req.headers['x-api-key'] as string;
    if (apiKey) {
      const result = await authService.verifyApiKey(apiKey);
      if (result) {
        req.user = result.user;
        req.apiKey = result.key;
        req.authMethod = 'apikey';
      }
    }

    // Try JWT
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ') && !req.user) {
      const token = authHeader.substring(7);
      try {
        const payload = authService.verifyJWT(token);
        req.user = {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
        } as User;
        req.authMethod = 'jwt';
      } catch (error) {
        // Ignore JWT errors for optional auth
      }
    }

    // Continue regardless of auth status
    next();
  } catch (error) {
    // Continue even if auth fails
    next();
  }
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication required' 
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access required' 
    });
  }

  next();
};
