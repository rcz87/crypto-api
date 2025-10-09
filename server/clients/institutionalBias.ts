/**
 * Institutional Bias Client with Fallback
 * Handles fetching institutional bias data with automatic fallback between Node and Python services
 */

import axios from "axios";
import { jsonOrText } from "../utils/jsonOrText.js";
import { normalizePerp } from "../utils/symbols.js";

const API_BASE = process.env.API_BASE || "http://127.0.0.1:5000";
const PY_BASE = process.env.PY_BASE || "http://127.0.0.1:8000";
const BIAS_TARGET = (process.env.BIAS_TARGET || "python").toLowerCase() as "node" | "python";

export type BiasOk = { 
  ok: true; 
  data: any; 
  symbol: string; 
  status: number; 
};

export type BiasUnavailable = { 
  ok: false; 
  unavailable: true; 
  status: 404; 
  symbol: string; 
  reason?: string; 
};

/**
 * Fetch institutional bias data from a specific base URL
 */
async function getOnce(base: string, symbol: string): Promise<BiasOk | BiasUnavailable> {
  const norm = normalizePerp(symbol);
  const url = base === PY_BASE
    ? `${PY_BASE}/advanced/institutional/bias?symbol=${encodeURIComponent(norm)}`
    : `${API_BASE}/gpts/institutional/bias?symbol=${encodeURIComponent(norm)}`;

  console.log(`[BiasClient] Fetching from: ${url}`);

  try {
    const response = await axios.get(url, { 
      headers: { 
        Accept: "application/json",
        "User-Agent": "InstitutionalBias-Client"
      },
      timeout: 10000,
      validateStatus: () => true // Don't throw on 4xx/5xx status codes
    });

  // 404 → treat as unavailable (bukan throw)
  if (response.status === 404) {
    const body = response.data || '';
    return {
      ok: false,
      unavailable: true,
      status: 404,
      reason: body.slice(0, 200),
      symbol: norm,
    };
  }

  if (response.status >= 400) {
    const body = response.data || '';
    throw new Error(`Bias API ${response.status}: ${body.slice(0, 160)}`);
  }

    const data = response.data;
    return { 
      ok: true, 
      status: response.status, 
      data, 
      symbol: norm 
    };
  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      throw new Error(`Request timeout after 10000ms for ${url}`);
    }
    throw error;
  }
}

/**
 * Fetch institutional bias data with automatic fallback
 */
export async function fetchInstitutionalBias(symbol: string): Promise<BiasOk | BiasUnavailable> {
  const primary = BIAS_TARGET === "python" ? PY_BASE : API_BASE;
  const backup = BIAS_TARGET === "python" ? API_BASE : PY_BASE;

  console.log(`[BiasClient] Primary target: ${primary}, Backup: ${backup}`);

  try {
    const res = await getOnce(primary, symbol);
    if (!res.ok && res.unavailable) return res; // 404 → tidak error
    return res;
  } catch (error: any) {
    const msg = String(error?.message || error);
    
    // Fallback sekali kalau primary balas HTML
    if (msg.includes("Expected JSON but got HTML")) {
      console.warn("[BiasClient] Primary returned HTML, retrying with backup base...");
      const res = await getOnce(backup, symbol);
      if (!res.ok && res.unavailable) return res;
      return res;
    }
    
    throw error;
  }
}

/**
 * Ambil daftar symbol yang didukung dari Python service
 */
export async function fetchSupportedSymbols(): Promise<string[]> {
  try {
    const response = await axios.get(`${PY_BASE}/symbols`, { 
      headers: { Accept: "application/json" } 
    });
    
    if (response.status >= 400) return [];
    
    const data = response.data as any;
    return Array.isArray(data) ? data : (data?.symbols ? data.symbols : []);
  } catch {
    return [];
  }
}