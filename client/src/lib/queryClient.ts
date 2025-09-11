import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getApiBase } from "./env";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Use environment-aware API base
  const apiBase = getApiBase();
  const fullUrl = url.startsWith('http') ? url : `${apiBase}${url}`;
  
  console.log('API Request:', fullUrl);
  
  const startTime = Date.now();
  
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  const latency = Date.now() - startTime;
  
  // Add latency info to response headers for debugging
  console.log(`API Response: ${fullUrl} - ${latency}ms`);
  
  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Use environment-aware API base
    const apiBase = getApiBase();
    const endpoint = queryKey.join("/") as string;
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint}`;
    
    console.log('API Request:', fullUrl);
    
    const startTime = Date.now();
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });
    
    const latency = Date.now() - startTime;
    
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    const data = await res.json();
    
    // Enhance response with metadata for DataTrustIndicator
    if (data && typeof data === 'object') {
      const enhancedData = {
        ...data,
        _metadata: {
          latency,
          requestTime: new Date().toISOString(),
          endpoint: fullUrl,
          // Infer data source from endpoint
          dataSource: inferDataSource(endpoint),
        }
      };
      
      console.log(`API Response: ${fullUrl} - ${latency}ms - Source: ${enhancedData._metadata.dataSource}`);
      
      return enhancedData;
    }
    
    return data;
  };

/**
 * Infer data source from API endpoint
 * @param endpoint - API endpoint URL
 * @returns Data source identifier
 */
function inferDataSource(endpoint: string): string {
  const path = endpoint.toLowerCase();
  
  if (path.includes('/ai/') || path.includes('enhanced') || path.includes('confluence') || path.includes('signal')) {
    return 'Enhanced AI';
  } else if (path.includes('coinapi') || path.includes('/technical') || path.includes('/indicators')) {
    return 'CoinAPI';
  } else if (path.includes('/sol/') || path.includes('/btc/') || path.includes('/eth/') || path.includes('funding') || path.includes('/oi/') || path.includes('complete')) {
    return 'OKX';
  } else if (path.includes('screener') || path.includes('screening')) {
    return 'Multi-Engine';
  } else {
    return 'System';
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: 30000, // 30 seconds instead of false
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds instead of Infinity
      retry: 1, // Try once more instead of no retry
      retryDelay: 2000,
    },
    mutations: {
      retry: false,
    },
  },
});
