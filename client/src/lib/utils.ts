import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert timestamp to WIB (Indonesian Western Time) format
 * @param timestamp - ISO string or Date object
 * @returns Formatted time string in WIB timezone
 */
export function formatToWIB(timestamp: string | Date): string {
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    
    // Check for invalid date
    if (isNaN(date.getTime())) {
      return 'Invalid time';
    }
    
    // Format to WIB timezone (UTC+7)
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };
    
    const formatter = new Intl.DateTimeFormat('id-ID', options);
    return `${formatter.format(date)} WIB`;
  } catch (error) {
    console.warn('Error formatting timestamp to WIB:', error);
    return 'Time unavailable';
  }
}

/**
 * Calculate time elapsed since given timestamp
 * @param timestamp - ISO string or Date object
 * @returns Human readable elapsed time (e.g., "2m ago", "30s ago")
 */
export function getTimeElapsed(timestamp: string | Date): string {
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    
    if (isNaN(date.getTime())) {
      return 'Unknown';
    }
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(diffSeconds / 3600);
      return `${hours}h ago`;
    }
  } catch (error) {
    console.warn('Error calculating time elapsed:', error);
    return 'Unknown';
  }
}

/**
 * Format number with appropriate suffix (K, M, B)
 * @param num - Number to format
 * @returns Formatted string with suffix
 */
export function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

/**
 * Format latency with appropriate styling class
 * @param latency - Latency in milliseconds
 * @returns Object with formatted string and CSS class
 */
export function formatLatency(latency: number): { text: string; className: string } {
  if (latency < 100) {
    return { text: `${latency}ms`, className: 'text-green-400' };
  } else if (latency < 500) {
    return { text: `${latency}ms`, className: 'text-yellow-400' };
  } else if (latency < 1000) {
    return { text: `${latency}ms`, className: 'text-orange-400' };
  } else {
    return { text: `${latency}ms`, className: 'text-red-400' };
  }
}
