// Multi-Timeframe Analysis - HTF Bias & Alignment
// Higher timeframe bias modulation for lower timeframe signals

export type Candle = { open:number; high:number; low:number; close:number; volume:number };

export type HTFBias = {
  h4: { bias: 'bullish'|'bearish'|'neutral'; strength: number; emaTrend: 'bullish'|'bearish'|'mixed'|'neutral'; adx?: number|null };
  h1: { bias: 'bullish'|'bearish'|'neutral'; strength: number; emaTrend: 'bullish'|'bearish'|'mixed'|'neutral'; adx?: number|null };
  combined: { bias: 'bullish'|'bearish'|'neutral'; strength: number };
  notes: string[];
};

// Lightweight EMA calculation
function ema(vals:number[], period:number): number[] {
  const k=2/(period+1); 
  let out:number[]=[]; 
  let prev:number|undefined; 
  
  for (let i=0;i<vals.length;i++){ 
    const v=vals[i]; 
    prev = prev===undefined? v : v*k + prev*(1-k); 
    out.push(prev);
  } 
  return out; 
}

function inferBias(candles:Candle[]): {
  bias:'bullish'|'bearish'|'neutral'; 
  strength:number; 
  emaTrend:'bullish'|'bearish'|'mixed'|'neutral'
} {
  if (!candles || candles.length<60) {
    return { bias:'neutral', strength:0, emaTrend:'neutral' };
  }
  
  const c = candles.map(x=>x.close);
  const e20 = ema(c,20).at(-1)!; 
  const e50 = ema(c,50).at(-1)!;
  
  // EMA trend analysis
  const emaTrend = (e20>e50)? 'bullish' : (e20<e50? 'bearish':'mixed');
  
  // Swing bias via recent price direction (30 candles lookback)
  const last = c.at(-1)!; 
  const ref = c.at(-30)!;
  const dir = last - ref; 
  
  let bias:'bullish'|'bearish'|'neutral' = 'neutral';
  if (dir>0) bias='bullish'; 
  else if (dir<0) bias='bearish';
  
  // Calculate strength based on price momentum and EMA agreement
  const slope = Math.abs(dir) / Math.max(1, ref);
  const emaBonus = (emaTrend==='bullish'||emaTrend==='bearish') ? 2 : 0;
  
  // Strength 0-10 scale
  let strength = Math.min(10, Math.round((slope*200) + emaBonus));
  
  return { bias, strength, emaTrend };
}

export function computeHTFBias(opts:{h4:Candle[], h1:Candle[]}): HTFBias {
  // Analyze each timeframe independently
  const h4b = inferBias(opts.h4);
  const h1b = inferBias(opts.h1);
  
  // Combine H4 and H1 bias with H4 having higher weight
  let combinedBias:'bullish'|'bearish'|'neutral' = 'neutral';
  
  // Priority: H4 > H1 (higher timeframe dominance)
  if (h4b.bias === h1b.bias && h4b.bias !== 'neutral') {
    // Both agree on direction
    combinedBias = h4b.bias;
  } else if (h4b.bias !== 'neutral') {
    // H4 has bias, use it
    combinedBias = h4b.bias;
  } else if (h1b.bias !== 'neutral') {
    // Only H1 has bias
    combinedBias = h1b.bias;
  }
  
  // Combined strength (H4 weighted 60%, H1 weighted 40%)
  const combinedStrength = Math.max(1, Math.round((h4b.strength*0.6 + h1b.strength*0.4)));
  
  // Generate analysis notes
  const notes:string[] = [];
  notes.push(`H4: ${h4b.bias} (ema:${h4b.emaTrend}, str:${h4b.strength})`);
  notes.push(`H1: ${h1b.bias} (ema:${h1b.emaTrend}, str:${h1b.strength})`);
  notes.push(`Combined: ${combinedBias} x${combinedStrength}`);
  
  // Add agreement analysis
  if (h4b.bias === h1b.bias && h4b.bias !== 'neutral') {
    notes.push('✅ HTF alignment confirmed');
  } else if (h4b.bias !== 'neutral' && h1b.bias !== 'neutral' && h4b.bias !== h1b.bias) {
    notes.push('⚠️ HTF divergence detected');
  }
  
  return {
    h4: {...h4b, adx: null},
    h1: {...h1b, adx: null},
    combined: { bias: combinedBias, strength: combinedStrength },
    notes
  };
}

export function applyHTFModulation(
  baseNormalizedScore:number, 
  ltfBias:'bullish'|'bearish'|'neutral', 
  htf:HTFBias
): {
  adjusted: number;
  tilt: number;
  agree: boolean;
  disagree: boolean;
  reason: string;
} {
  let adjusted = baseNormalizedScore;
  
  // Check agreement/disagreement between LTF and HTF
  const agree = (ltfBias!=='neutral' && ltfBias===htf.combined.bias);
  const disagree = (ltfBias!=='neutral' && htf.combined.bias!=='neutral' && ltfBias!==htf.combined.bias);
  
  // Calculate tilt magnitude based on HTF strength (2-6 points)
  const tilt = Math.min(6, Math.max(2, Math.round(htf.combined.strength/2)));
  
  let reason = '';
  
  if (agree) {
    // LTF signal agrees with HTF bias - boost signal
    adjusted = Math.min(100, adjusted + tilt);
    reason = `+${tilt} HTF alignment boost`;
  } else if (disagree) {
    // LTF signal disagrees with HTF bias - penalize signal
    adjusted = Math.max(0, adjusted - tilt);
    reason = `-${tilt} HTF divergence penalty`;
  } else {
    // Neutral conditions
    reason = 'No HTF modulation (neutral bias)';
  }
  
  return { adjusted, tilt, agree, disagree, reason };
}

// Additional HTF analysis utilities
export function getHTFConfidence(htf: HTFBias): number {
  // Higher confidence when both timeframes agree and have strong bias
  const h4Confidence = htf.h4.strength / 10;
  const h1Confidence = htf.h1.strength / 10;
  const agreement = (htf.h4.bias === htf.h1.bias && htf.h4.bias !== 'neutral') ? 1.2 : 1.0;
  
  return Math.min(1.0, ((h4Confidence * 0.6) + (h1Confidence * 0.4)) * agreement);
}

export function getHTFSignalQuality(htf: HTFBias): 'high' | 'medium' | 'low' {
  const confidence = getHTFConfidence(htf);
  
  if (confidence >= 0.7 && htf.combined.strength >= 6) return 'high';
  if (confidence >= 0.5 && htf.combined.strength >= 4) return 'medium';
  return 'low';
}