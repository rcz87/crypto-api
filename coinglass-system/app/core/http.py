import time, random, logging
import requests
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = (5, 15)
MAX_RETRIES = 5
INITIAL_BACKOFF = 0.2
MAX_BACKOFF = 5.0

class HttpError(Exception):
    """Custom exception for HTTP errors"""
    def __init__(self, status_code: int, message: str, response_data: Optional[Dict] = None):
        self.status_code = status_code
        self.message = message
        self.response_data = response_data
        super().__init__(f"HTTP {status_code}: {message}")

class RateLimitExceeded(HttpError):
    """Exception for rate limit errors"""
    def __init__(self, retry_after: Optional[int] = None):
        self.retry_after = retry_after
        super().__init__(429, f"Rate limit exceeded. Retry after: {retry_after}s")

class Http:
    def __init__(self, headers: Dict[str, str]):
        self.headers = headers
        self.session = requests.Session()
        self.session.headers.update(headers)

    def get(self, url: str, params: Optional[Dict[str, Any]] = None, retries: int = MAX_RETRIES) -> requests.Response:
        """Enhanced GET method with proper error handling and exponential backoff"""
        backoff = INITIAL_BACKOFF
        last_exception = None
        
        for attempt in range(retries):
            try:
                logger.debug(f"Making GET request to {url} (attempt {attempt + 1}/{retries})")
                
                response = self.session.get(
                    url, 
                    params=params, 
                    timeout=DEFAULT_TIMEOUT
                )
                
                # Handle rate limiting
                if response.status_code == 429:
                    retry_after = int(response.headers.get('Retry-After', backoff))
                    logger.warning(f"Rate limit hit. Waiting {retry_after}s before retry")
                    
                    if attempt == retries - 1:
                        raise RateLimitExceeded(retry_after)
                    
                    time.sleep(retry_after)
                    continue
                
                # Handle server errors (5xx)
                if response.status_code >= 500:
                    logger.warning(f"Server error {response.status_code} on attempt {attempt + 1}")
                    
                    if attempt == retries - 1:
                        raise HttpError(
                            response.status_code, 
                            f"Server error: {response.text}",
                            self._safe_json(response)
                        )
                    
                    time.sleep(backoff + random.uniform(0, 0.2))
                    backoff = min(backoff * 2, MAX_BACKOFF)
                    continue
                
                # Handle client errors (4xx)
                if response.status_code >= 400:
                    error_data = self._safe_json(response)
                    error_message = self._extract_error_message(error_data, response.text)
                    
                    logger.error(f"Client error {response.status_code}: {error_message}")
                    
                    # Don't retry client errors (except 429 which is handled above)
                    raise HttpError(
                        response.status_code,
                        error_message,
                        error_data
                    )
                
                # Success case
                logger.debug(f"Successful response from {url}: {response.status_code}")
                return response
                
            except (requests.exceptions.ConnectionError, 
                   requests.exceptions.Timeout, 
                   requests.exceptions.RequestException) as e:
                
                last_exception = e
                logger.warning(f"Network error on attempt {attempt + 1}: {str(e)}")
                
                if attempt == retries - 1:
                    raise HttpError(
                        0, 
                        f"Network error after {retries} attempts: {str(e)}"
                    )
                
                time.sleep(backoff + random.uniform(0, 0.2))
                backoff = min(backoff * 2, MAX_BACKOFF)
        
        # Should not reach here, but just in case
        raise HttpError(0, f"Request failed after {retries} attempts", {"last_exception": str(last_exception)})
    
    def _safe_json(self, response: requests.Response) -> Optional[Dict]:
        """Safely extract JSON from response"""
        try:
            return response.json()
        except (ValueError, requests.exceptions.JSONDecodeError):
            return None
    
    def _extract_error_message(self, error_data: Optional[Dict], fallback_text: str) -> str:
        """Extract meaningful error message from response"""
        if error_data:
            # Common error message keys in APIs
            for key in ['message', 'error', 'detail', 'msg', 'description']:
                if key in error_data:
                    return str(error_data[key])
        
        # Return truncated response text as fallback
        return fallback_text[:200] + "..." if len(fallback_text) > 200 else fallback_text
    
    def close(self):
        """Close the session to free up resources"""
        self.session.close()