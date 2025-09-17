/**
 * Parse JSON response or throw descriptive error for HTML responses
 */
export async function jsonOrText(response: any) {
  const contentType = response.headers.get('content-type') || '';
  const status = response.status || 200;
  
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (jsonError: any) {
      throw new Error(`Invalid JSON (${status}): ${jsonError.message}`);
    }
  } else if (contentType.includes('text/html')) {
    // Clearly HTML response
    throw new Error(`Expected JSON but got HTML (${status}): Response is HTML page`);
  } else {
    // Try to parse as JSON if it looks like JSON
    const text = await response.text();
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        return JSON.parse(text);
      } catch (jsonError: any) {
        throw new Error(`Invalid JSON (${status}): ${jsonError.message}`);
      }
    } else {
      throw new Error(`Expected JSON but got ${contentType || 'unknown content type'} (${status}). Response: ${text.substring(0, 200)}...`);
    }
  }
}