import { Request, Response, NextFunction } from 'express';
import { metricsCollector } from '../utils/metrics';

// Rate limiting configuration for different endpoint tiers
interface RateLimitConfig {
  requests: number;
  windowMs: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}

// Tier-based rate limiting configs
const RATE_LIMIT_TIERS: Record<string, RateLimitConfig> = {
  general: {
    requests: 100,
    windowMs: 60 * 1000, // 1 minute
    message: 'Rate limit exceeded. Maximum 100 requests per minute.',
  },
  sensitive: {
    requests: 10,
    windowMs: 60 * 1000, // 1 minute
    message: 'Rate limit exceeded. Maximum 10 requests per minute for sensitive endpoints.',
  },
  ai_analysis: {
    requests: 5,
    windowMs: 60 * 1000, // 1 minute
    message: 'Rate limit exceeded. Maximum 5 AI analysis requests per minute.',
  },
  auth: {
    requests: 5,
    windowMs: 60 * 1000, // 1 minute
    message: 'Rate limit exceeded. Maximum 5 authentication requests per minute.',
  }
};

// In-memory rate limit store with automatic cleanup
class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number; firstRequest: number }>();
  private lastCleanup = Date.now();
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

  private cleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL) return;

    const entries = Array.from(this.store.entries());
    for (const [key, data] of entries) {
      if (now > data.resetTime) {
        this.store.delete(key);
      }
    }
    this.lastCleanup = now;
  }

  increment(key: string, windowMs: number): { count: number; resetTime: number; isNewWindow: boolean } {
    this.cleanup();
    
    const now = Date.now();
    const existing = this.store.get(key);
    
    if (!existing || now > existing.resetTime) {
      // New window
      const resetTime = now + windowMs;
      this.store.set(key, { count: 1, resetTime, firstRequest: now });
      return { count: 1, resetTime, isNewWindow: true };
    } else {
      // Existing window
      existing.count++;
      this.store.set(key, existing);
      return { count: existing.count, resetTime: existing.resetTime, isNewWindow: false };
    }
  }

  getStats(): { totalKeys: number; oldestEntry: number } {
    const now = Date.now();
    let oldestEntry = now;
    
    for (const [, data] of Array.from(this.store.entries())) {
      if (data.firstRequest < oldestEntry) {
        oldestEntry = data.firstRequest;
      }
    }
    
    return {
      totalKeys: this.store.size,
      oldestEntry: now - oldestEntry
    };
  }
}

const rateLimitStore = new RateLimitStore();

// Enhanced security metrics with per-IP tracking
interface IPViolationRecord {
  rateLimitHits: number;
  validationFailures: number;
  suspiciousActivities: number;
  firstViolation: number;
  lastViolation: number;
  blockedUntil?: number;
}

interface SecurityMetrics {
  totalRateLimitHits: number;
  totalSuspiciousRequests: number;
  totalValidationFailures: number;
  lastSecurityEvent: number;
  activelyBlockedIPs: number;
}

class SecurityMonitor {
  private ipViolations = new Map<string, IPViolationRecord>();
  private metrics: SecurityMetrics = {
    totalRateLimitHits: 0,
    totalSuspiciousRequests: 0,
    totalValidationFailures: 0,
    lastSecurityEvent: 0,
    activelyBlockedIPs: 0
  };
  
  // Configuration for per-IP thresholds and timeouts
  private readonly BLOCK_THRESHOLDS = {
    rateLimitViolations: 8,     // Block after 8 rate limit hits per IP
    validationFailures: 5,      // Block after 5 validation failures per IP  
    suspiciousActivities: 3,    // Block after 3 suspicious activities per IP
    totalViolations: 10         // Block after 10 total violations per IP
  };
  
  private readonly TIMEOUTS = {
    violationDecay: 15 * 60 * 1000,    // 15 minutes - violations decay
    blockDuration: 30 * 60 * 1000,     // 30 minutes - IP block duration
    cleanupInterval: 5 * 60 * 1000      // 5 minutes - cleanup old records
  };
  
  constructor() {
    // Start cleanup timer to remove old violation records
    setInterval(() => this.cleanupOldRecords(), this.TIMEOUTS.cleanupInterval);
  }

  private getOrCreateIPRecord(ip: string): IPViolationRecord {
    if (!this.ipViolations.has(ip)) {
      this.ipViolations.set(ip, {
        rateLimitHits: 0,
        validationFailures: 0,
        suspiciousActivities: 0,
        firstViolation: Date.now(),
        lastViolation: Date.now()
      });
    }
    return this.ipViolations.get(ip)!;
  }
  
  private shouldBlockIP(record: IPViolationRecord): boolean {
    const totalViolations = record.rateLimitHits + record.validationFailures + record.suspiciousActivities;
    
    return (
      record.rateLimitHits >= this.BLOCK_THRESHOLDS.rateLimitViolations ||
      record.validationFailures >= this.BLOCK_THRESHOLDS.validationFailures ||
      record.suspiciousActivities >= this.BLOCK_THRESHOLDS.suspiciousActivities ||
      totalViolations >= this.BLOCK_THRESHOLDS.totalViolations
    );
  }
  
  private cleanupOldRecords(): void {
    const now = Date.now();
    const cutoff = now - this.TIMEOUTS.violationDecay;
    
    for (const [ip, record] of Array.from(this.ipViolations.entries())) {
      // Remove records older than decay period and not currently blocked
      if (record.lastViolation < cutoff && (!record.blockedUntil || now > record.blockedUntil)) {
        this.ipViolations.delete(ip);
      }
      // Unblock IPs whose block period has expired
      else if (record.blockedUntil && now > record.blockedUntil) {
        delete record.blockedUntil;
        console.info(`IP unblocked after timeout: ${ip}`);
      }
    }
  }

  recordRateLimitHit(ip: string, tier: string): void {
    const record = this.getOrCreateIPRecord(ip);
    record.rateLimitHits++;
    record.lastViolation = Date.now();
    
    this.metrics.totalRateLimitHits++;
    this.metrics.lastSecurityEvent = Date.now();
    
    // Check if IP should be blocked
    if (!record.blockedUntil && this.shouldBlockIP(record)) {
      record.blockedUntil = Date.now() + this.TIMEOUTS.blockDuration;
      this.metrics.activelyBlockedIPs++;
      console.warn(`IP blocked for repeated violations: IP=${ip}, Tier=${tier}, RateLimit=${record.rateLimitHits}, Total=${record.rateLimitHits + record.validationFailures + record.suspiciousActivities}`);
    } else {
      console.warn(`Rate limit exceeded: IP=${ip}, Tier=${tier}, Violations=${record.rateLimitHits}/${this.BLOCK_THRESHOLDS.rateLimitViolations}`);
    }
  }

  recordValidationFailure(ip: string, endpoint: string): void {
    const record = this.getOrCreateIPRecord(ip);
    record.validationFailures++;
    record.lastViolation = Date.now();
    
    this.metrics.totalValidationFailures++;
    this.metrics.lastSecurityEvent = Date.now();
    
    // Check if IP should be blocked
    if (!record.blockedUntil && this.shouldBlockIP(record)) {
      record.blockedUntil = Date.now() + this.TIMEOUTS.blockDuration;
      this.metrics.activelyBlockedIPs++;
      console.warn(`IP blocked for validation failures: IP=${ip}, Endpoint=${endpoint}, Failures=${record.validationFailures}`);
    } else {
      console.warn(`Input validation failed: IP=${ip}, Endpoint=${endpoint}, Failures=${record.validationFailures}/${this.BLOCK_THRESHOLDS.validationFailures}`);
    }
  }

  recordSuspiciousActivity(ip: string, reason: string): void {
    const record = this.getOrCreateIPRecord(ip);
    record.suspiciousActivities++;
    record.lastViolation = Date.now();
    
    this.metrics.totalSuspiciousRequests++;
    this.metrics.lastSecurityEvent = Date.now();
    
    // Check if IP should be blocked
    if (!record.blockedUntil && this.shouldBlockIP(record)) {
      record.blockedUntil = Date.now() + this.TIMEOUTS.blockDuration;
      this.metrics.activelyBlockedIPs++;
      console.warn(`IP blocked for suspicious activity: IP=${ip}, Reason=${reason}, Activities=${record.suspiciousActivities}`);
    } else {
      console.warn(`Suspicious activity detected: IP=${ip}, Reason=${reason}, Activities=${record.suspiciousActivities}/${this.BLOCK_THRESHOLDS.suspiciousActivities}`);
    }
  }

  getSecurityMetrics() {
    // Update active blocked IPs count
    const now = Date.now();
    let activeBlocks = 0;
    const blockedIPs: string[] = [];
    
    for (const [ip, record] of Array.from(this.ipViolations.entries())) {
      if (record.blockedUntil && now < record.blockedUntil) {
        activeBlocks++;
        // Only include IPs in development or with sanitized format in production
        if (process.env.NODE_ENV === 'development') {
          blockedIPs.push(ip);
        } else {
          // Sanitize IP in production (show only first two octets)
          const parts = ip.split('.');
          if (parts.length === 4) {
            blockedIPs.push(`${parts[0]}.${parts[1]}.*.***`);
          } else {
            blockedIPs.push('***');
          }
        }
      }
    }
    
    this.metrics.activelyBlockedIPs = activeBlocks;
    
    return {
      ...this.metrics,
      blockedIPsCount: activeBlocks,
      blockedIPs: blockedIPs,
      rateLimitStoreStats: rateLimitStore.getStats(),
      thresholds: this.BLOCK_THRESHOLDS,
      timeouts: {
        violationDecayMinutes: this.TIMEOUTS.violationDecay / (60 * 1000),
        blockDurationMinutes: this.TIMEOUTS.blockDuration / (60 * 1000)
      }
    };
  }

  isBlocked(ip: string): boolean {
    const record = this.ipViolations.get(ip);
    if (!record || !record.blockedUntil) {
      return false;
    }
    
    const now = Date.now();
    if (now > record.blockedUntil) {
      // Block expired, clean it up
      delete record.blockedUntil;
      return false;
    }
    
    return true;
  }
  
  // Admin function to manually unblock an IP (for future admin interface)
  unblockIP(ip: string): boolean {
    const record = this.ipViolations.get(ip);
    if (record && record.blockedUntil) {
      delete record.blockedUntil;
      console.info(`IP manually unblocked: ${ip}`);
      return true;
    }
    return false;
  }
  
  // Get detailed info for an IP (for debugging)
  getIPInfo(ip: string): IPViolationRecord | null {
    return this.ipViolations.get(ip) || null;
  }
}

export const securityMonitor = new SecurityMonitor();

// Get client IP address with proxy support
function getClientIP(req: Request): string {
  return (
    req.ip ||
    req.socket.remoteAddress ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    'unknown'
  );
}

// Determine rate limit tier based on request path
function getRateLimitTier(path: string): string {
  // AI and analysis endpoints - strictest limits
  if (path.includes('/ai') || path.includes('/signal') || path.includes('/screener') || path.includes('/analysis')) {
    return 'ai_analysis';
  }
  
  // Authentication endpoints
  if (path.includes('/auth') || path.includes('/login') || path.includes('/register')) {
    return 'auth';
  }
  
  // Sensitive trading data endpoints
  if (path.includes('/complete') || path.includes('/orderbook') || path.includes('/multi-exchange')) {
    return 'sensitive';
  }
  
  // General endpoints (health, metrics, static data)
  return 'general';
}

// Enhanced rate limiting middleware with tiered protection
export function enhancedRateLimit(req: Request, res: Response, next: NextFunction): void {
  const clientIP = getClientIP(req);
  const path = req.path;
  const tier = getRateLimitTier(path);
  const config = RATE_LIMIT_TIERS[tier];
  
  // Skip rate limiting for local development
  if (process.env.NODE_ENV === 'development' && 
      (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === 'localhost')) {
    return next();
  }

  // Check if IP is blocked
  if (securityMonitor.isBlocked(clientIP)) {
    res.status(429).json({
      success: false,
      error: 'IP temporarily blocked due to excessive violations',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const key = `${tier}:${clientIP}`;
  const result = rateLimitStore.increment(key, config.windowMs);
  
  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': config.requests.toString(),
    'X-RateLimit-Remaining': Math.max(0, config.requests - result.count).toString(),
    'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
    'X-RateLimit-Tier': tier
  });

  if (result.count > config.requests) {
    securityMonitor.recordRateLimitHit(clientIP, tier);
    
    // Enhanced 429 response with security info
    res.status(429).json({
      success: false,
      error: config.message,
      details: {
        limit: config.requests,
        windowMs: config.windowMs,
        tier,
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
      },
      timestamp: new Date().toISOString(),
    });
    return;
  }

  next();
}

// Input sanitization utilities
export class InputSanitizer {
  // Sanitize cryptocurrency symbol (only alphanumeric, dash, underscore)
  static sanitizeSymbol(symbol: string): string {
    if (!symbol || typeof symbol !== 'string') return '';
    return symbol.replace(/[^a-zA-Z0-9\-_]/g, '').toUpperCase().slice(0, 20);
  }

  // Sanitize timeframe parameter
  static sanitizeTimeframe(timeframe: string): string {
    const validTimeframes = ['1m', '5m', '15m', '30m', '1H', '4H', '6H', '12H', '1D', '1W'];
    if (!timeframe || typeof timeframe !== 'string') return '1H';
    return validTimeframes.includes(timeframe) ? timeframe : '1H';
  }

  // Sanitize numeric parameters with bounds
  static sanitizeNumeric(value: any, min: number = 1, max: number = 1000, defaultValue: number = 100): number {
    const num = parseInt(value, 10);
    if (isNaN(num)) return defaultValue;
    return Math.max(min, Math.min(max, num));
  }

  // Check for potential SQL injection patterns
  static containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(--|\/\*|\*\/|;)/,
      /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
      /'(\s*(OR|AND)\s+)?.*'/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  // Comprehensive input validation middleware
  static validateInput(req: Request, res: Response, next: NextFunction): void {
    const clientIP = getClientIP(req);
    let hasViolation = false;

    // Check query parameters
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        // Check for SQL injection
        if (InputSanitizer.containsSQLInjection(value)) {
          securityMonitor.recordSuspiciousActivity(clientIP, `SQL injection attempt in query param: ${key}`);
          hasViolation = true;
        }

        // Check for excessively long inputs
        if (value.length > 100) {
          securityMonitor.recordValidationFailure(clientIP, req.path);
          hasViolation = true;
        }
      }
    }

    // Check request body size and content
    if (req.body && typeof req.body === 'object') {
      const bodyStr = JSON.stringify(req.body);
      
      // Size check (1MB limit)
      if (bodyStr.length > 1024 * 1024) {
        securityMonitor.recordValidationFailure(clientIP, req.path);
        res.status(413).json({
          success: false,
          error: 'Request body too large',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // SQL injection check in body
      if (InputSanitizer.containsSQLInjection(bodyStr)) {
        securityMonitor.recordSuspiciousActivity(clientIP, 'SQL injection attempt in request body');
        hasViolation = true;
      }
    }

    if (hasViolation) {
      res.status(400).json({
        success: false,
        error: 'Invalid input detected',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  }
}

// Extend existing metrics collector with security data
export function getEnhancedSecurityMetrics() {
  const baseMetrics = metricsCollector.getMetrics();
  const securityMetrics = securityMonitor.getSecurityMetrics();
  
  return {
    ...baseMetrics,
    security: securityMetrics,
    timestamp: new Date().toISOString()
  };
}