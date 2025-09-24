import { Request, Response, NextFunction } from 'express';
import { metricsCollector } from '../utils/metrics';
import { getClientIp, isLoopback, isPrivateNetwork } from '../utils/ip';
import { errorAlerter } from '../observability/errorAlerter';

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
  confluence_screening: {
    requests: 3,
    windowMs: 60 * 1000, // 1 minute
    message: 'Rate limit exceeded. Maximum 3 confluence screening requests per minute. This endpoint performs intensive multi-layer analysis.',
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

// Route exemptions for rate limiting
function isExemptRoute(path: string): boolean {
  const exemptPaths = [
    '/health',
    '/healthz',
    '/api/metrics',
    '/metrics',
    '/py/',
    '/coinglass/',
    '/openapi',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml'
  ];
  
  return exemptPaths.some(exemptPath => path.startsWith(exemptPath));
}

// Determine rate limit tier based on request path
function getRateLimitTier(path: string): string {
  // Confluence screening endpoints - most restrictive (3 req/min)
  if (path.includes('/screening/confluence')) {
    return 'confluence_screening';
  }
  
  // Other AI and analysis endpoints - strict limits (5 req/min)
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
  const path = req.path;
  
  // Early exemption for critical routes
  if (isExemptRoute(path)) {
    return next();
  }
  
  const clientIP = getClientIp(req);
  const tier = getRateLimitTier(path);
  const config = RATE_LIMIT_TIERS[tier];
  
  // Exempt loopback addresses to prevent system self-blocking
  if (isLoopback(clientIP)) {
    // Still log for monitoring but don't rate limit
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[RATE_LIMIT] Exempting loopback IP: ${clientIP} for ${path}`);
    }
    // Still add rate limit headers for testing/consistency
    res.set({
      'RateLimit-Limit': config.requests.toString(),
      'RateLimit-Remaining': config.requests.toString(),
      'RateLimit-Reset': Math.floor((Date.now() + config.windowMs) / 1000).toString(),
      'RateLimit-Policy': `${config.requests};w=${Math.floor(config.windowMs / 1000)}`,
      'X-RateLimit-Tier': tier
    });
    return next();
  }
  
  // Exempt private network addresses in development
  if (process.env.NODE_ENV === 'development' && isPrivateNetwork(clientIP)) {
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
  
  // Add standardized rate limit headers (RFC 6585 + draft-ietf-httpapi-ratelimit-headers)
  res.set({
    'RateLimit-Limit': config.requests.toString(),
    'RateLimit-Remaining': Math.max(0, config.requests - result.count).toString(),
    'RateLimit-Reset': Math.floor(result.resetTime / 1000).toString(),
    'RateLimit-Policy': `${config.requests};w=${Math.floor(config.windowMs / 1000)}`,
    'X-RateLimit-Tier': tier
  });

  if (result.count > config.requests) {
    securityMonitor.recordRateLimitHit(clientIP, tier);
    
    // Record 429 error for alerting
    errorAlerter.recordError(429, req.path, req.get('User-Agent'), clientIP);
    
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

  // Enhanced XSS detection and prevention
  static containsXSS(input: string): boolean {
    const xssPatterns = [
      // Script tags and variants
      /<script[^>]*>/i,
      /<\/script>/i,
      /javascript:/i,
      /vbscript:/i,
      /data:text\/html/i,
      
      // Event handlers
      /on\w+\s*=/i,
      /onerror\s*=/i,
      /onload\s*=/i,
      /onclick\s*=/i,
      /onmouseover\s*=/i,
      
      // HTML injection attempts
      /<(iframe|object|embed|form|img|svg|math|details|input)[^>]*>/i,
      /<\w+[^>]*?on\w+[^>]*>/i,
      
      // Expression and eval attempts
      /expression\s*\(/i,
      /eval\s*\(/i,
      /alert\s*\(/i,
      /confirm\s*\(/i,
      /prompt\s*\(/i,
      
      // URL-based XSS
      /^https?:\/\/.*<script/i,
      /%3C.*%3E/i,
      
      // CSS injection
      /style\s*=.*expression/i,
      /@import/i
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  }

  // Sanitize input by removing dangerous characters
  static sanitizeInput(input: string): string {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .replace(/[<>"'&]/g, '') // Remove HTML-dangerous chars
      .replace(/javascript:/gi, '') // Remove JS protocols
      .replace(/vbscript:/gi, '') // Remove VB protocols
      .replace(/data:/gi, '') // Remove data URLs
      .replace(/on\w+=/gi, '') // Remove event handlers
      .replace(/expression\(/gi, '') // Remove CSS expressions
      .replace(/eval\(/gi, '') // Remove eval calls
      .replace(/alert\(/gi, '') // Remove alert calls
      .trim()
      .slice(0, 200); // Limit length
  }

  // Comprehensive input validation middleware
  static validateInput(req: Request, res: Response, next: NextFunction): void {
    const clientIP = getClientIp(req);
    
    // Skip validation for loopback addresses to prevent self-blocking
    if (isLoopback(clientIP)) {
      return next();
    }
    let hasViolation = false;
    let violationReason = '';

    // Ensure all API responses use JSON content type
    if (req.path.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }

    // Check query parameters
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        // Check for SQL injection
        if (InputSanitizer.containsSQLInjection(value)) {
          securityMonitor.recordSuspiciousActivity(clientIP, `SQL injection attempt in query param: ${key}`);
          hasViolation = true;
          violationReason = 'SQL injection detected';
        }
        
        // Check for XSS attacks
        if (InputSanitizer.containsXSS(value)) {
          securityMonitor.recordSuspiciousActivity(clientIP, `XSS attempt in query param: ${key}`);
          hasViolation = true;
          violationReason = 'XSS payload detected';
        }

        // Check for excessively long inputs
        if (value.length > 200) {
          securityMonitor.recordValidationFailure(clientIP, req.path);
          hasViolation = true;
          violationReason = 'Input too long';
        }
        
        // Additional validation for trading symbol parameters
        if (key.toLowerCase().includes('symbol') || key.toLowerCase().includes('pair')) {
          if (!/^[a-zA-Z0-9\-_\/]+$/.test(value) || value.length > 20) {
            securityMonitor.recordValidationFailure(clientIP, req.path);
            hasViolation = true;
            violationReason = 'Invalid trading symbol format';
          }
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
        violationReason = 'SQL injection in body';
      }
      
      // XSS check in body
      if (InputSanitizer.containsXSS(bodyStr)) {
        securityMonitor.recordSuspiciousActivity(clientIP, 'XSS attempt in request body');
        hasViolation = true;
        violationReason = 'XSS payload in body';
      }
    }

    if (hasViolation) {
      res.status(400).json({
        success: false,
        error: 'Security violation detected',
        details: violationReason,
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