/**
 * Heatmap Shim - Approximated liquidation heatmap when native endpoints are unavailable
 */

export type HeatmapPoint = { price: number; score: number };
export type HeatmapData = { tf: string; points: HeatmapPoint[]; source: string };

async function fetchMarkPxOKX(instId='SOL-USDT-SWAP'): Promise<number> {
  try {
    const r = await fetch(`https://www.okx.com/api/v5/public/mark-price?instType=SWAP&instId=${instId}`);
    const j = await r.json();
    const d = j?.data?.[0];
    return +d.markPx;
  } catch (_) { 
    return NaN; 
  }
}

export async function heatmapApproxSOL(tf='1h'): Promise<HeatmapData> {
  const markPx = await fetchMarkPxOKX('SOL-USDT-SWAP');
  const base = Number.isFinite(markPx) ? markPx : 200;

  const bands = 40; // ±10% total (0.5% step)
  const span = 0.10;
  const pts: HeatmapPoint[] = [];
  for (let i = -bands/2; i <= bands/2; i++) {
    const pct = (i / (bands/2)) * span;
    const price = base * (1 + pct);
    const roundBonus = (price % 5 < 0.25 || price % 5 > 4.75) ? 1.2 : 1.0;
    const centerBias = Math.max(0, 1 - Math.abs(pct) * 0.7);
    const score = +(centerBias * roundBonus).toFixed(4);
    pts.push({ price: +price.toFixed(2), score });
  }
  return { tf, points: pts, source: 'shim-approx' };
}