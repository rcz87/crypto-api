/**
 * Parse JSON response or transform HTML/other responses to structured JSON errors
 * This utility ensures consistent JSON error handling and eliminates "HTML instead of JSON" parsing errors
 */
export async function jsonOrText(response: any) {
  const contentType = response.headers.get('content-type') || '';
  const status = response.status || 200;
  const url = response.url || 'unknown';
  
  // Handle successful JSON responses
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (jsonError: any) {
      // Return structured error instead of throwing
      return {
        ok: false,
        error: 'Invalid JSON response',
        code: status,
        details: jsonError.message,
        contentType,
        url
      };
    }
  }
  
  // Handle HTML responses (often error pages)
  if (contentType.includes('text/html')) {
    const text = await response.text();
    
    // Try to extract meaningful error information from HTML
    let errorMessage = 'HTML error page returned instead of JSON';
    let errorDetails = '';
    
    // Extract title from HTML if available
    const titleMatch = text.match(/<title[^>]*>([^<]*)<\/title>/i);
    if (titleMatch) {
      errorMessage = titleMatch[1].trim() || errorMessage;
    }
    
    // Extract common error patterns
    const h1Match = text.match(/<h1[^>]*>([^<]*)<\/h1>/i);
    if (h1Match) {
      errorDetails = h1Match[1].trim();
    }
    
    // Look for error codes in common formats
    const errorCodeMatch = text.match(/\b(4\d\d|5\d\d)\b/);
    const extractedStatus = errorCodeMatch ? parseInt(errorCodeMatch[1]) : status;
    
    // Return structured JSON error instead of HTML
    return {
      ok: false,
      error: errorMessage,
      code: extractedStatus,
      details: errorDetails || 'Server returned HTML error page',
      contentType: 'text/html',
      htmlPreview: text.substring(0, 300) + (text.length > 300 ? '...' : ''),
      url
    };
  }
  
  // Handle plain text and other content types
  const text = await response.text();
  
  // Try to parse as JSON if it looks like JSON
  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    try {
      return JSON.parse(text);
    } catch (jsonError: any) {
      // Return structured error for malformed JSON
      return {
        ok: false,
        error: 'Malformed JSON response',
        code: status,
        details: jsonError.message,
        contentType,
        responsePreview: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        url
      };
    }
  }
  
  // Handle non-JSON responses (XML, plain text, etc.)
  if (text.trim()) {
    // Check for common error patterns in text
    const isErrorText = status >= 400 || 
                       /error|fail|exception|not found|forbidden|unauthorized/i.test(text);
    
    return {
      ok: !isErrorText,
      error: isErrorText ? 'Server returned non-JSON error' : 'Unexpected response format',
      code: status,
      message: text.substring(0, 500) + (text.length > 500 ? '...' : ''),
      contentType: contentType || 'text/plain',
      url
    };
  }
  
  // Handle empty responses
  return {
    ok: false,
    error: 'Empty response',
    code: status,
    details: 'Server returned empty response body',
    contentType,
    url
  };
}