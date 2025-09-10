export const isBrowser = typeof window !== 'undefined';

export function getApiBase(): string {
  const env = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
  if (env) return env;
  if (!isBrowser) return '';
  const { protocol, host } = window.location;
  const base = `${protocol}//${host}`; // e.g. https://<replit-hash>.replit.dev
  return base; // fallback aman
}

export function getWsBase(): string {
  const env = (import.meta.env.VITE_WS_BASE || '').trim();
  if (env) return env; // gunakan ENV jika ada
  if (!isBrowser) return '';
  const { protocol, host } = window.location;
  // Map http→ws, https→wss
  const wsProto = protocol === 'https:' ? 'wss:' : 'ws:';
  // Anti-localhost: jika host mengandung 'localhost' → gunakan domain produksi
  const safeHost = /localhost/i.test(host)
    ? 'guardiansofthegreentoken.com'
    : host;
  // Default path gateway WS kamu
  return `${wsProto}//${safeHost}/ws`;
}

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