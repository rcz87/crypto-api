import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { users, apiKeys, type User, type ApiKey, type InsertUser } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

interface ApiKeyData {
  userId: string;
  name: string;
  scopes: string[];
  quotaLimit?: number;
  expiresAt?: Date;
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly SALT_ROUNDS = 10;

  constructor() {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    this.JWT_SECRET = secret;
  }

  /**
   * Register new user with email and password
   */
  async registerUser(email: string, password: string, name?: string, role: string = 'user'): Promise<User> {
    // Check if user already exists
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, this.SALT_ROUNDS);

    // Create user
    const [newUser] = await db.insert(users).values({
      email,
      passwordHash,
      name,
      role,
    }).returning();

    return newUser;
  }

  /**
   * Login user and return JWT token
   */
  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    // Find user
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (!user.isActive) {
      throw new Error('User account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = this.generateJWT(user);

    return { user, token };
  }

  /**
   * Generate JWT token for user
   */
  generateJWT(user: User): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    return jwt.sign(payload, this.JWT_SECRET, { 
      expiresIn: '24h',
      issuer: 'crypto-api',
    });
  }

  /**
   * Verify JWT token and return payload
   */
  verifyJWT(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, this.JWT_SECRET, {
        issuer: 'crypto-api',
      }) as JWTPayload;
      return payload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Generate API key for user
   */
  async generateApiKey(data: ApiKeyData): Promise<{ key: string; apiKey: ApiKey }> {
    // Generate random API key
    const apiKey = `sk_${crypto.randomBytes(32).toString('hex')}`;
    
    // Hash the key for storage
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Store in database
    const [newApiKey] = await db.insert(apiKeys).values({
      userId: data.userId,
      keyHash,
      name: data.name,
      scopes: data.scopes,
      quotaLimit: data.quotaLimit || 1000,
      expiresAt: data.expiresAt,
    }).returning();

    // Return the plain key (only time it's visible) and the stored record
    return { key: apiKey, apiKey: newApiKey };
  }

  /**
   * Verify API key and return associated user
   */
  async verifyApiKey(apiKey: string): Promise<{ user: User; key: ApiKey } | null> {
    // Hash the provided key
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Find API key in database
    const [keyRecord] = await db.select()
      .from(apiKeys)
      .where(and(
        eq(apiKeys.keyHash, keyHash),
        eq(apiKeys.isActive, true)
      ))
      .limit(1);

    if (!keyRecord) {
      return null;
    }

    // Check if expired
    if (keyRecord.expiresAt && keyRecord.expiresAt < new Date()) {
      return null;
    }

    // Check quota
    if (keyRecord.quotaUsed >= keyRecord.quotaLimit) {
      throw new Error('API key quota exceeded');
    }

    // Get associated user
    const [user] = await db.select()
      .from(users)
      .where(and(
        eq(users.id, keyRecord.userId),
        eq(users.isActive, true)
      ))
      .limit(1);

    if (!user) {
      return null;
    }

    // Update last used timestamp and quota
    await db.update(apiKeys)
      .set({ 
        lastUsedAt: new Date(),
        quotaUsed: keyRecord.quotaUsed + 1,
      })
      .where(eq(apiKeys.id, keyRecord.id));

    return { user, key: keyRecord };
  }

  /**
   * Check if API key has required scope
   */
  hasScope(apiKey: ApiKey, requiredScope: string): boolean {
    return apiKey.scopes.includes(requiredScope) || apiKey.scopes.includes('admin');
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(keyId: string): Promise<void> {
    await db.update(apiKeys)
      .set({ isActive: false })
      .where(eq(apiKeys.id, keyId));
  }

  /**
   * Get all API keys for user
   */
  async getUserApiKeys(userId: string): Promise<ApiKey[]> {
    return db.select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId));
  }

  /**
   * Reset daily quota for all keys (call this daily via cron)
   */
  async resetDailyQuotas(): Promise<void> {
    await db.update(apiKeys)
      .set({ quotaUsed: 0 })
      .where(eq(apiKeys.isActive, true));
  }
}

// Export singleton instance
export const authService = new AuthService();
