import { getApiMap, getJson } from '../services/discovery';
import { normalizeSymbol } from '../utils/symbol';
import { track404 } from '../services/route404Tracker';

const FEAT = (name: string) =>
  (process.env[`FEATURE_${name}`] ?? 'on').toLowerCase() !== 'off';

export async function getSpotOrderbook(symbol: string, exchange = 'binance', depth = 50) {
  const spot = normalizeSymbol(symbol, 'spot');         // 'SOLUSDT'

  // Use unified POST endpoint
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  
  try {
    const response = await fetch((process.env.PY_BASE || 'http://127.0.0.1:8000') + '/gpts/advanced', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        op: 'spot_orderbook',
        params: {
          symbol: spot,
          exchange: exchange,
          depth: depth
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
      // Check Content-Type to handle both JSON and HTML responses
      const contentType = response.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      } else if (contentType.includes('text/html')) {
        const htmlText = await response.text();
        throw new Error(`[SpotOrderbook] Server returned HTML instead of JSON. Response: ${htmlText.substring(0, 300)}...`);
      } else {
        // Try JSON as fallback for unknown content types
        return await response.json();
      }
    } else {
      // Handle error responses
      if (response.status === 404) {
        track404('spot_ob');
      }
      
      // Check if error response is HTML or JSON to provide better error messages
      const contentType = response.headers.get('Content-Type') || '';
      let errorMessage = `[SpotOrderbook] HTTP ${response.status}: ${response.statusText}`;
      
      try {
        if (contentType.includes('text/html')) {
          const htmlText = await response.text();
          // Extract useful info from HTML error page
          const titleMatch = htmlText.match(/<title>(.*?)<\/title>/i);
          const title = titleMatch ? titleMatch[1] : 'Unknown HTML Error';
          errorMessage += ` - HTML Error Page: "${title}" (Content: ${htmlText.substring(0, 200)}...)`;
        } else if (contentType.includes('application/json')) {
          // Try to get JSON error details
          const errorData = await response.json();
          errorMessage += ` - JSON Error: ${JSON.stringify(errorData)}`;
        } else {
          // Unknown content type, try to read as text
          const responseText = await response.text();
          errorMessage += ` - Response: ${responseText.substring(0, 200)}...`;
        }
      } catch (parseError) {
        // If we can't parse the error response, use the basic message
        const parseErrorMsg = parseError instanceof Error ? parseError.message : String(parseError);
        errorMessage += ` (Unable to parse error response: ${parseErrorMsg})`;
      }
      
      throw new Error(errorMessage);
    }
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Fix TypeScript error by properly typing the error
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    
    if (errorMessage.includes('404')) {
      track404('spot_ob');
    }
    
    // Enhanced error logging with more context
    console.warn(`[SpotOrderbook] Request failed for symbol=${symbol}, exchange=${exchange}:`, {
      error: errorName,
      message: errorMessage,
      timestamp: new Date().toISOString()
    });
    
    throw error;
  }
}