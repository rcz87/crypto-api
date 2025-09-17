import { Request } from 'express';

/**
 * IP utility functions for proper client IP detection and normalization
 */

/**
 * Get normalized client IP address from request
 * Handles proxy forwarding and IPv6-mapped IPv4 normalization
 */
export function getClientIp(req: Request): string {
  // Try multiple sources for client IP
  const possibleIps = [
    // X-Forwarded-For header (most reliable for proxied requests)
    req.headers['x-forwarded-for'],
    // X-Real-IP header (nginx proxy)
    req.headers['x-real-ip'],
    // CF-Connecting-IP header (Cloudflare)
    req.headers['cf-connecting-ip'],
    // Request IP (Express with trust proxy)
    req.ip,
    // Socket remote address (direct connection)
    req.socket?.remoteAddress,
    // Connection remote address (fallback)
    req.connection?.remoteAddress
  ].filter(Boolean);

  for (const ipSource of possibleIps) {
    if (typeof ipSource === 'string') {
      // Handle comma-separated list in X-Forwarded-For
      const ips = ipSource.split(',').map(ip => ip.trim());
      for (const ip of ips) {
        const normalizedIp = normalizeIp(ip);
        if (normalizedIp && isValidIp(normalizedIp)) {
          return normalizedIp;
        }
      }
    }
  }

  // Fallback to unknown if no valid IP found
  return 'unknown';
}

/**
 * Normalize IP address (handle IPv6-mapped IPv4 addresses)
 */
function normalizeIp(ip: string): string {
  if (!ip) return '';
  
  // Remove IPv6 wrapper for IPv4 addresses
  // e.g., ::ffff:127.0.0.1 -> 127.0.0.1
  if (ip.startsWith('::ffff:')) {
    const ipv4Part = ip.substring(7);
    if (isValidIpv4(ipv4Part)) {
      return ipv4Part;
    }
  }
  
  // Remove IPv6 loopback mapping
  // e.g., ::1 -> 127.0.0.1 for consistency
  if (ip === '::1') {
    return '127.0.0.1';
  }
  
  return ip.toLowerCase();
}

/**
 * Check if IP address is a loopback address
 */
export function isLoopback(ip: string): boolean {
  if (!ip) return false;
  
  const normalizedIp = normalizeIp(ip);
  
  // IPv4 loopback addresses
  if (normalizedIp === '127.0.0.1' || normalizedIp.startsWith('127.')) {
    return true;
  }
  
  // IPv6 loopback
  if (normalizedIp === '::1') {
    return true;
  }
  
  // Localhost variations
  if (normalizedIp === 'localhost') {
    return true;
  }
  
  return false;
}

/**
 * Check if IP is a local/private network address
 */
export function isPrivateNetwork(ip: string): boolean {
  if (!ip) return false;
  
  const normalizedIp = normalizeIp(ip);
  
  // Private IPv4 ranges
  const privateRanges = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^169\.254\./,              // 169.254.0.0/16 (link-local)
    /^127\./                    // 127.0.0.0/8 (loopback)
  ];
  
  return privateRanges.some(range => range.test(normalizedIp));
}

/**
 * Validate IP address format
 */
function isValidIp(ip: string): boolean {
  return isValidIpv4(ip) || isValidIpv6(ip);
}

/**
 * Validate IPv4 address format
 */
function isValidIpv4(ip: string): boolean {
  const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  return ipv4Regex.test(ip);
}

/**
 * Validate IPv6 address format (basic check)
 */
function isValidIpv6(ip: string): boolean {
  // Basic IPv6 format check
  const ipv6Regex = /^([0-9a-f]{0,4}:){1,7}[0-9a-f]{0,4}$/i;
  return ipv6Regex.test(ip) || ip === '::1';
}

/**
 * Get client IP info for debugging
 */
export function getClientIpInfo(req: Request): {
  detectedIp: string;
  isLoopback: boolean;
  isPrivate: boolean;
  headers: {
    xForwardedFor?: string;
    xRealIp?: string;
    cfConnectingIp?: string;
  };
  requestIp?: string;
  socketIp?: string;
} {
  const detectedIp = getClientIp(req);
  
  return {
    detectedIp,
    isLoopback: isLoopback(detectedIp),
    isPrivate: isPrivateNetwork(detectedIp),
    headers: {
      xForwardedFor: req.headers['x-forwarded-for'] as string,
      xRealIp: req.headers['x-real-ip'] as string,
      cfConnectingIp: req.headers['cf-connecting-ip'] as string,
    },
    requestIp: req.ip,
    socketIp: req.socket?.remoteAddress,
  };
}