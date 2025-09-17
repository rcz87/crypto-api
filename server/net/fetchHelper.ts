/**
 * Robust fetch helper with timeout and retry logic
 */

interface RobustFetchOptions {
  label?: string;
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export async function robustFetch(url: string, options: RobustFetchOptions = {}) {
  const { label = 'fetch', timeout = 8000, retries = 2, headers = {} } = options;
  
  const defaultHeaders = {
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (compatible; TradingBot/1.0)',
    ...headers
  };

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        headers: defaultHeaders,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error: any) {
      const isLastAttempt = attempt === retries + 1;
      
      if (isLastAttempt) {
        console.error(`[${label}] Final attempt failed:`, error.message);
        throw error;
      } else {
        console.warn(`[${label}] Attempt ${attempt} failed, retrying:`, error.message);
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
      }
    }
  }
}