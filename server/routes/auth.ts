import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { authenticate, requireAdmin } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

const createApiKeySchema = z.object({
  name: z.string().min(1, 'Key name is required'),
  scopes: z.array(z.enum(['read', 'write', 'trading', 'admin'])).default(['read']),
  quotaLimit: z.number().positive().optional(),
  expiresInDays: z.number().positive().optional(),
});

/**
 * POST /auth/register
 * Register new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const validated = registerSchema.parse(req.body);
    
    const user = await authService.registerUser(
      validated.email,
      validated.password,
      validated.name
    );

    // Generate JWT token
    const token = authService.generateJWT(user);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      },
      message: 'User registered successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(400).json({
      success: false,
      error: error.message || 'Registration failed',
    });
  }
});

/**
 * POST /auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const validated = loginSchema.parse(req.body);
    
    const { user, token } = await authService.login(
      validated.email,
      validated.password
    );

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      },
      message: 'Login successful',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(401).json({
      success: false,
      error: error.message || 'Login failed',
    });
  }
});

/**
 * GET /auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user!.id,
        email: req.user!.email,
        name: req.user!.name,
        role: req.user!.role,
      },
      authMethod: req.authMethod,
    },
  });
});

/**
 * POST /auth/api-keys
 * Create new API key for authenticated user
 */
router.post('/api-keys', authenticate, async (req: Request, res: Response) => {
  try {
    const validated = createApiKeySchema.parse(req.body);
    
    // Calculate expiration date if provided
    let expiresAt: Date | undefined;
    if (validated.expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validated.expiresInDays);
    }

    const { key, apiKey } = await authService.generateApiKey({
      userId: req.user!.id,
      name: validated.name,
      scopes: validated.scopes,
      quotaLimit: validated.quotaLimit,
      expiresAt,
    });

    res.json({
      success: true,
      data: {
        key, // Plain text key - only shown once!
        apiKey: {
          id: apiKey.id,
          name: apiKey.name,
          scopes: apiKey.scopes,
          quotaLimit: apiKey.quotaLimit,
          expiresAt: apiKey.expiresAt,
          createdAt: apiKey.createdAt,
        },
      },
      message: '⚠️ Save this API key! It will not be shown again.',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create API key',
    });
  }
});

/**
 * GET /auth/api-keys
 * List all API keys for authenticated user
 */
router.get('/api-keys', authenticate, async (req: Request, res: Response) => {
  try {
    const keys = await authService.getUserApiKeys(req.user!.id);

    res.json({
      success: true,
      data: {
        apiKeys: keys.map(k => ({
          id: k.id,
          name: k.name,
          scopes: k.scopes,
          quotaLimit: k.quotaLimit,
          quotaUsed: k.quotaUsed,
          lastUsedAt: k.lastUsedAt,
          expiresAt: k.expiresAt,
          isActive: k.isActive,
          createdAt: k.createdAt,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch API keys',
    });
  }
});

/**
 * DELETE /auth/api-keys/:keyId
 * Revoke API key
 */
router.delete('/api-keys/:keyId', authenticate, async (req: Request, res: Response) => {
  try {
    const { keyId } = req.params;
    
    // Verify ownership (unless admin)
    if (req.user!.role !== 'admin') {
      const keys = await authService.getUserApiKeys(req.user!.id);
      const ownsKey = keys.some(k => k.id === keyId);
      
      if (!ownsKey) {
        return res.status(403).json({
          success: false,
          error: 'You do not own this API key',
        });
      }
    }

    await authService.revokeApiKey(keyId);

    res.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to revoke API key',
    });
  }
});

/**
 * POST /auth/admin/reset-quotas
 * Reset all daily quotas (admin only)
 */
router.post('/admin/reset-quotas', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    await authService.resetDailyQuotas();

    res.json({
      success: true,
      message: 'All daily quotas reset successfully',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to reset quotas',
    });
  }
});

export default router;
