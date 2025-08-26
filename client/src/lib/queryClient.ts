import { QueryClient, QueryFunction } from "@tanstack/react-query";

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
  // Use current domain for development, production domain for production
  const apiBase = window.location.hostname === 'localhost' || window.location.hostname.includes('replit') 
    ? window.location.origin 
    : 'https://guardiansofthegreentoken.com';
  const fullUrl = url.startsWith('http') ? url : `${apiBase}${url}`;
  
  console.log('API Request:', fullUrl);
  
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Use current domain for development, production domain for production
    const apiBase = window.location.hostname === 'localhost' || window.location.hostname.includes('replit') 
      ? window.location.origin 
      : 'https://guardiansofthegreentoken.com';
    const endpoint = queryKey.join("/") as string;
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint}`;
    
    console.log('API Request:', fullUrl);
    
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

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
