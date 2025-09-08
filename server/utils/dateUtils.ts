/**
 * Date utility functions to prevent NaN and invalid date issues
 */

export function sanitizeTimestamp(timestamp: string | number | Date | null | undefined): string {
  if (!timestamp) {
    return new Date().toISOString();
  }

  // Handle string timestamps
  if (typeof timestamp === 'string') {
    // Check for already valid ISO strings
    if (timestamp.includes('T') && timestamp.includes('Z')) {
      const date = new Date(timestamp);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    
    // Check for NaN or invalid strings
    if (timestamp.includes('NaN') || timestamp === 'Invalid Date') {
      return new Date().toISOString();
    }
    
    // Try parsing as number (Unix timestamp)
    const numTimestamp = parseInt(timestamp);
    if (Number.isFinite(numTimestamp) && numTimestamp > 0) {
      // Handle both milliseconds and seconds timestamps
      const date = new Date(numTimestamp < 1e12 ? numTimestamp * 1000 : numTimestamp);
      if (!isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
  }

  // Handle number timestamps
  if (typeof timestamp === 'number') {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return new Date().toISOString();
    }
    
    // Handle both milliseconds and seconds timestamps
    const date = new Date(timestamp < 1e12 ? timestamp * 1000 : timestamp);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  // Handle Date objects
  if (timestamp instanceof Date) {
    if (!isNaN(timestamp.getTime())) {
      return timestamp.toISOString();
    }
  }

  // Fallback to current time
  return new Date().toISOString();
}

export function formatNextFundingTime(timestamp: string | number | null | undefined): string {
  const sanitized = sanitizeTimestamp(timestamp);
  const date = new Date(sanitized);
  const now = new Date();
  
  const diffMs = date.getTime() - now.getTime();
  
  if (diffMs <= 0) {
    return '0m';
  }
  
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  
  return `${minutes}m`;
}

export function sanitizeNumericValue(value: any, fallback: number = 0): number {
  if (value === null || value === undefined) {
    return fallback;
  }
  
  const parsed = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function validateAndSanitizeData(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  
  if (typeof obj === 'number') {
    return Number.isFinite(obj) ? obj : 0;
  }
  
  if (typeof obj === 'string') {
    // Handle timestamp strings
    if (obj.includes('NaN') || obj === 'Invalid Date') {
      return new Date().toISOString();
    }
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => validateAndSanitizeData(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key.toLowerCase().includes('time') || key.toLowerCase().includes('timestamp')) {
        sanitized[key] = sanitizeTimestamp(value as any);
      } else {
        sanitized[key] = validateAndSanitizeData(value);
      }
    }
    return sanitized;
  }
  
  return obj;
}