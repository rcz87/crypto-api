/**
 * Capability Discovery: baca OpenAPI Python lalu petakan path yang tersedia.
 * Cache 10 menit untuk menghindari overhead.
 */
const PY_BASE = process.env.PY_BASE_URL ?? 'http://127.0.0.1:8000';

type OpenApiDoc = { paths?: Record<string, any> };

let _cache:
  | { at: number; map: Record<string, string> }
  | null = null;

export async function getApiMap(): Promise<Record<string, string>> {
  const now = Date.now();
  if (_cache && now - _cache.at < 10 * 60 * 1000) return _cache.map;

  try {
    const res = await fetch(`${PY_BASE}/openapi.json`);
    if (!res.ok) {
      // fallback: kosongkan map agar client pakai default patterns
      _cache = { at: now, map: {} };
      return _cache.map;
    }

    const spec = (await res.json()) as OpenApiDoc;
    const paths = Object.keys(spec.paths ?? {});

    // Helper function to strip template variables from paths
    const stripTemplateVars = (path: string): string => {
      return path.replace(/{[^}]+}/g, '').replace(/\/+$/, '');
    };

    const map: Record<string, string> = {
      // heuristik untuk path yang sering beda antar build
      heatmap:
        stripTemplateVars(
          paths.find((p) => /liquidation.*heatmap/i.test(p)) ||
          paths.find((p) => /liquidations.*heatmap/i.test(p)) ||
          ''
        ),
      spot_ob:
        stripTemplateVars(
          paths.find((p) => /spot.*orderbook/i.test(p)) ||
          paths.find((p) => /orderbook.*spot/i.test(p)) ||
          ''
        ),
      bias:
        stripTemplateVars(
          paths.find((p) => /institutional.*bias/i.test(p)) ||
          '/institutional/bias'
        ),
      whale_alerts:
        stripTemplateVars(
          paths.find((p) => /whale.*alerts/i.test(p)) || '/advanced/whale/alerts'
        ),
      etf_flows:
        stripTemplateVars(
          paths.find((p) => /etf.*flows/i.test(p)) || '/advanced/etf/flows'
        ),
    };

    _cache = { at: now, map };
    return map;
  } catch (error) {
    console.error('[Discovery] Failed to fetch OpenAPI:', error);
    // fallback: kosongkan map agar client pakai default patterns
    _cache = { at: now, map: {} };
    return _cache.map;
  }
}

export function pyUrl(path: string) {
  // pastikan path dimulai dengan '/'
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${PY_BASE}${p}`;
}

export async function getJson(path: string) {
  const r = await fetch(pyUrl(path));
  if (!r.ok) {
    const e: any = new Error(`HTTP ${r.status}: ${r.statusText}`);
    e.status = r.status;
    e.url = path;
    throw e;
  }
  return r.json();
}

export async function getText(path: string) {
  const r = await fetch(pyUrl(path));
  if (!r.ok) {
    const e: any = new Error(`HTTP ${r.status}: ${r.statusText}`);
    e.status = r.status;
    e.url = path;
    throw e;
  }
  return r.text();
}

export async function debugListPathsLike(...patterns: string[]) {
  try {
    const res = await fetch(`${PY_BASE}/openapi.json`);
    if (!res.ok) { 
      console.warn(`[Discovery] openapi.json HTTP ${res.status}`); 
      return; 
    }
    const spec = (await res.json()) as OpenApiDoc;
    const paths = Object.keys(spec.paths ?? {});
    patterns.forEach(pat => {
      const rx = new RegExp(pat, 'i');
      const hits = paths.filter(p => rx.test(p));
      console.log(`[Discovery] Matches /${pat}/i → ${hits.length}`);
      hits.slice(0, 100).forEach(h => console.log(`  - ${h}`));
    });
  } catch (e: any) {
    console.warn(`[Discovery] list paths failed: ${e.message}`);
  }
}