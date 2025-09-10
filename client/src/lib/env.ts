// Environment utilities
export const getApiBase = (): string => {
  if (typeof window === 'undefined') {
    // SSR/Server side - use localhost for development
    return 'http://localhost:5000';
  }
  
  // For Replit environment, always use current origin
  if (window.location.hostname.includes('.replit.dev')) {
    return window.location.origin;
  }
  
  // Client side - use environment variable or current origin
  const envBase = import.meta.env.VITE_API_BASE || (process as any).env?.NEXT_PUBLIC_API_BASE;
  if (envBase) {
    return envBase.replace(/\/$/, '');
  }
  
  // Fallback to current origin
  return window.location.origin;
};

export const getWsBase = (): string => {
  if (typeof window === 'undefined') {
    return 'ws://localhost:5000/ws';
  }
  
  // For Replit environment, always use current domain with proper protocol
  if (window.location.hostname.includes('.replit.dev')) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }
  
  const envWs = import.meta.env.VITE_WS_BASE || (process as any).env?.NEXT_PUBLIC_WS_BASE;
  if (envWs) {
    return envWs;
  }
  
  // Fallback WebSocket URL based on current origin
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
};

export const fetchJSON = async (endpoint: string, options?: RequestInit) => {
  const apiBase = getApiBase();
  const url = endpoint.startsWith('http') ? endpoint : `${apiBase}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
};