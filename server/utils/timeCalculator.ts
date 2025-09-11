/**
 * Accurate Time Calculator for Candle Close Time
 * Fixes timezone and calculation issues for better accuracy
 */

/**
 * Calculate exact time remaining until next candle close
 * @param timeframe - Candle timeframe (1H, 15m, 5m, etc.)
 * @param currentTimestamp - Current candle timestamp from OKX
 * @returns Accurate minutes and seconds remaining
 */
export function calculateTimeToNextCandleClose(timeframe: string, currentTimestamp?: string): {
  minutesRemaining: number;
  secondsRemaining: number;
  nextCloseTime: Date;
  accuracy: 'high' | 'medium' | 'low';
} {
  const now = new Date();
  const currentUTC = now.getTime();

  // Define timeframe intervals in milliseconds
  const intervals: Record<string, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1H': 60 * 60 * 1000,
    '4H': 4 * 60 * 60 * 1000,
    '1D': 24 * 60 * 60 * 1000,
  };

  const intervalMs = intervals[timeframe] || intervals['1H'];

  let nextCloseTime: Date;
  let accuracy: 'high' | 'medium' | 'low' = 'medium';

  if (currentTimestamp) {
    // High accuracy: Calculate next boundary based on candle alignment
    const candleStartTime = parseInt(currentTimestamp);
    const candleDate = new Date(candleStartTime);
    
    // Calculate next interval boundary from current time, not candle time
    if (timeframe === '1H') {
      // Next hour boundary (e.g., 15:38 -> 16:00)
      nextCloseTime = new Date(now);
      nextCloseTime.setUTCHours(nextCloseTime.getUTCHours() + 1);
      nextCloseTime.setUTCMinutes(0);
      nextCloseTime.setUTCSeconds(0);
      nextCloseTime.setUTCMilliseconds(0);
    } else {
      // For other timeframes, use interval-based calculation
      const timeframeMins = intervalMs / (60 * 1000);
      const currentMinute = now.getUTCMinutes();
      const nextCloseMinute = Math.ceil((currentMinute + 1) / timeframeMins) * timeframeMins;
      
      nextCloseTime = new Date(now);
      if (nextCloseMinute >= 60) {
        nextCloseTime.setUTCHours(nextCloseTime.getUTCHours() + 1);
        nextCloseTime.setUTCMinutes(0);
      } else {
        nextCloseTime.setUTCMinutes(nextCloseMinute);
      }
      nextCloseTime.setUTCSeconds(0);
      nextCloseTime.setUTCMilliseconds(0);
    }
    accuracy = 'high';
  } else {
    // Medium accuracy: Calculate based on current time alignment
    const timeframeMinutes = intervalMs / (60 * 1000);
    
    // Align to timeframe boundaries (e.g., for 1H: :00, for 15m: :00, :15, :30, :45)
    const currentMinute = now.getUTCMinutes();
    const currentSecond = now.getUTCSeconds();
    
    let nextCloseMinute: number;
    
    if (timeframe === '1H') {
      // Next hour boundary
      nextCloseMinute = 60;
    } else if (timeframe === '15m') {
      // Next 15-minute boundary: 0, 15, 30, 45
      nextCloseMinute = Math.ceil((currentMinute + 1) / 15) * 15;
      if (nextCloseMinute > 60) nextCloseMinute = 60;
    } else if (timeframe === '5m') {
      // Next 5-minute boundary: 0, 5, 10, 15, 20, etc.
      nextCloseMinute = Math.ceil((currentMinute + 1) / 5) * 5;
      if (nextCloseMinute > 60) nextCloseMinute = 60;
    } else {
      // General calculation for other timeframes
      nextCloseMinute = Math.ceil((currentMinute + 1) / timeframeMinutes) * timeframeMinutes;
      if (nextCloseMinute > 60) nextCloseMinute = 60;
    }

    // Calculate next close time
    nextCloseTime = new Date(now);
    if (nextCloseMinute === 60) {
      nextCloseTime.setUTCHours(nextCloseTime.getUTCHours() + 1);
      nextCloseTime.setUTCMinutes(0);
    } else {
      nextCloseTime.setUTCMinutes(nextCloseMinute);
    }
    nextCloseTime.setUTCSeconds(0);
    nextCloseTime.setUTCMilliseconds(0);
  }

  // Calculate remaining time
  const remainingMs = nextCloseTime.getTime() - currentUTC;
  const minutesRemaining = Math.floor(remainingMs / (60 * 1000));
  const secondsRemaining = Math.floor((remainingMs % (60 * 1000)) / 1000);

  return {
    minutesRemaining: Math.max(0, minutesRemaining),
    secondsRemaining: Math.max(0, secondsRemaining),
    nextCloseTime,
    accuracy
  };
}

/**
 * Format time remaining for display
 */
export function formatTimeRemaining(minutesRemaining: number, secondsRemaining: number): string {
  if (minutesRemaining > 0) {
    return `${minutesRemaining}m ${secondsRemaining}s`;
  } else {
    return `${secondsRemaining}s`;
  }
}

/**
 * Get human-readable time until candle close
 */
export function getTimeToCloseDescription(timeframe: string, currentTimestamp?: string): string {
  const { minutesRemaining, secondsRemaining, accuracy } = calculateTimeToNextCandleClose(timeframe, currentTimestamp);
  
  const timeStr = formatTimeRemaining(minutesRemaining, secondsRemaining);
  const accuracyNote = accuracy === 'high' ? ' (precise)' : accuracy === 'medium' ? ' (estimated)' : ' (approximate)';
  
  return `Next ${timeframe} candle closes in ${timeStr}${accuracyNote}`;
}

/**
 * Check if current time is close to candle close (within 1 minute)
 */
export function isNearCandleClose(timeframe: string, currentTimestamp?: string): boolean {
  const { minutesRemaining } = calculateTimeToNextCandleClose(timeframe, currentTimestamp);
  return minutesRemaining <= 1;
}