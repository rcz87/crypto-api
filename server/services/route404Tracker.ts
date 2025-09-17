/**
 * Route 404 Tracker - Auto-detects repeated 404s and triggers OpenAPI scanning
 */
import { debugListPathsLike } from './discovery';

type Cat = 'heatmap' | 'spot_ob';
const THRESHOLD = Number(process.env.ROUTE_404_THRESHOLD ?? 3);
const WINDOW_MS = Number(process.env.ROUTE_404_WINDOW_MS ?? 60_000);

const buckets: Record<Cat, number[]> = { heatmap: [], spot_ob: [] };
let lastScanAt: Record<Cat, number> = { heatmap: 0, spot_ob: 0 };
const SCAN_COOLDOWN_MS = 120_000; // prevent spam scanning

export function track404(cat: Cat) {
  const now = Date.now();
  const arr = buckets[cat];

  // Remove expired entries
  while (arr.length && now - arr[0] > WINDOW_MS) arr.shift();
  arr.push(now);

  if (arr.length >= THRESHOLD && now - lastScanAt[cat] > SCAN_COOLDOWN_MS) {
    lastScanAt[cat] = now;
    // async, don't block request
    setTimeout(() => {
      if (cat === 'heatmap') {
        console.warn('[404-Tracker] heatmap 404≥THRESHOLD → scanning OpenAPI for candidates...');
        debugListPathsLike('heatmap', 'liquidation', 'liquidations', 'map');
      } else if (cat === 'spot_ob') {
        console.warn('[404-Tracker] spot_ob 404≥THRESHOLD → scanning OpenAPI for candidates...');
        debugListPathsLike('orderbook', 'spot', 'depth', 'book');
      }
    }, 0);
  }
}