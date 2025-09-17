/**
 * Binance Geo-block Detector - Auto-disable Binance for 24h when geo-blocked
 */

let until = 0; // epoch ms

export function binanceBlocked() {
  return Date.now() < until;
}

export function markBinanceBlocked(hours = Number(process.env.GEO_COOLDOWN_HOURS ?? 24)) {
  until = Date.now() + hours * 60 * 60 * 1000;
  console.warn(`[GeoGuard] Binance blocked for ${hours}h until ${new Date(until).toISOString()}`);
}

export function detectGeoBlockBinance(body: any) {
  if (!body) return false;
  const msg = (typeof body === 'string' ? body : (body.msg || body.message || '')).toLowerCase();
  if (msg.includes('restricted location') || msg.includes('eligibility')) {
    markBinanceBlocked();
    return true;
  }
  return false;
}