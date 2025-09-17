/**
 * Institutional Bias Client with Fallback
 * Handles fetching institutional bias data with automatic fallback between Node and Python services
 */

import fetch from "node-fetch";

const API_BASE = process.env.API_BASE || "http://127.0.0.1:5000";
const PY_BASE = process.env.PY_BASE || "http://127.0.0.1:8000";
const BIAS_TARGET = (process.env.BIAS_TARGET || "node").toLowerCase();

/**
 * Parse JSON response or throw descriptive error for HTML responses
 */
async function jsonOrText(response: any) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (jsonError: any) {
      throw new Error(`Invalid JSON response: ${jsonError.message}`);
    }
  } else {
    // If response is not JSON, read as text to see what we got
    const text = await response.text();
    throw new Error(`Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}...`);
  }
}

/**
 * Fetch institutional bias data from a specific base URL
 */
async function getOnce(base: string, symbol: string) {
  const url = base === PY_BASE
    ? `${PY_BASE}/institutional/bias?symbol=${encodeURIComponent(symbol)}`
    : `${API_BASE}/gpts/institutional/bias?symbol=${encodeURIComponent(symbol)}`;

  console.log(`[BiasClient] Fetching from: ${url}`);

  const response = await fetch(url, { 
    headers: { 
      Accept: "application/json",
      "User-Agent": "InstitutionalBias-Client"
    },
    timeout: 10000
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bias API ${response.status}: ${body.slice(0, 160)}`);
  }

  return jsonOrText(response);
}

/**
 * Fetch institutional bias data with automatic fallback
 */
export async function fetchInstitutionalBias(symbol: string) {
  const primary = BIAS_TARGET === "python" ? PY_BASE : API_BASE;
  const backup = BIAS_TARGET === "python" ? API_BASE : PY_BASE;

  console.log(`[BiasClient] Primary target: ${primary}, Backup: ${backup}`);

  try {
    return await getOnce(primary, symbol);
  } catch (error: any) {
    const msg = String(error?.message || error);
    
    // Fallback only if we clearly got HTML instead of JSON
    if (msg.includes("Expected JSON but got") && (msg.includes("text/html") || msg.includes("<!DOCTYPE"))) {
      console.warn("[BiasClient] Primary returned HTML, retrying with backup base...");
      try {
        return await getOnce(backup, symbol);
      } catch (backupError: any) {
        console.error("[BiasClient] Both primary and backup failed");
        throw new Error(`Both endpoints failed. Primary: ${msg}. Backup: ${backupError.message}`);
      }
    }
    
    // If it's not an HTML response error, don't retry
    throw error;
  }
}