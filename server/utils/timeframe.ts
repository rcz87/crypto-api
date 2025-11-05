/**
 * Timeframe normalization utility
 * Converts any timeframe input to OKX-compatible format
 * 
 * @throws {Error} If timeframe is not supported
 */

// OKX API timeframe mapping (case-insensitive input → OKX format)
const TIMEFRAME_MAP: Record<string, string> = {
  // Minutes (lowercase output for OKX)
  '1m': '1m',
  '3m': '3m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  // Hours (uppercase output for OKX)
  '1h': '1H',
  '2h': '2H',
  '4h': '4H',
  '6h': '6H',
  '12h': '12H',
  // Days/Weeks (uppercase output for OKX)
  '1d': '1D',
  '3d': '3D',
  '1w': '1W',
  // Month variations
  '1mo': '1M',
  '1month': '1M'
};

/**
 * Normalize timeframe to OKX-compatible format
 * @param timeframe - Input timeframe (case-insensitive, e.g., "1h", "1H", "4H", "1d")
 * @returns OKX-compatible timeframe string
 * @throws {Error} If timeframe is unsupported
 */
export function normalizeTimeframe(timeframe: string | undefined): string {
  // Default fallback
  if (!timeframe) {
    console.warn('[Timeframe] No timeframe provided, defaulting to 1H');
    return '1H';
  }
  
  // Trim and convert to lowercase for lookup
  const normalized = timeframe.trim().toLowerCase();
  
  // Check if timeframe is supported
  if (!TIMEFRAME_MAP[normalized]) {
    const supportedTimeframes = Object.keys(TIMEFRAME_MAP).join(', ');
    console.error(`[Timeframe] ❌ Unsupported timeframe: "${timeframe}" - Supported: ${supportedTimeframes}`);
    throw new Error(
      `Unsupported timeframe: "${timeframe}". Supported values: ${supportedTimeframes}`
    );
  }
  
  const okxFormat = TIMEFRAME_MAP[normalized];
  
  // Log normalization for debugging (only if input differs from output)
  if (timeframe !== okxFormat) {
    console.log(`[Timeframe] ✓ Normalized "${timeframe}" → "${okxFormat}"`);
  }
  
  return okxFormat;
}

/**
 * Validate if timeframe is supported
 * @param timeframe - Input timeframe
 * @returns True if timeframe is supported
 */
export function isValidTimeframe(timeframe: string): boolean {
  try {
    normalizeTimeframe(timeframe); // Will throw if invalid
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get list of all supported timeframes
 * @returns Array of supported timeframe strings
 */
export function getSupportedTimeframes(): string[] {
  return Object.keys(TIMEFRAME_MAP);
}

/**
 * Get timeframe in milliseconds
 * @param timeframe - Input timeframe
 * @returns Timeframe duration in milliseconds
 */
export function getTimeframeMs(timeframe: string): number {
  const normalized = normalizeTimeframe(timeframe);
  
  const timeframeMs: Record<string, number> = {
    '1m': 60 * 1000,
    '3m': 3 * 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1H': 60 * 60 * 1000,
    '2H': 2 * 60 * 60 * 1000,
    '4H': 4 * 60 * 60 * 1000,
    '6H': 6 * 60 * 60 * 1000,
    '12H': 12 * 60 * 60 * 1000,
    '1D': 24 * 60 * 60 * 1000,
    '3D': 3 * 24 * 60 * 60 * 1000,
    '1W': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000
  };
  
  // Explicit fallback with warning - no silent bugs!
  if (!(normalized in timeframeMs)) {
    console.warn(`[Timeframe] ⚠️ Unknown timeframe "${normalized}" in getTimeframeMs(), using default 1H (3600000ms)`);
    return 60 * 60 * 1000; // 1 hour default
  }
  
  return timeframeMs[normalized];
}
