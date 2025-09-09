// Professional Indicators Library - Pure TypeScript Implementation
// No external dependencies, optimized for screening performance

export type Candle = { open:number; high:number; low:number; close:number; volume:number };

export type ProIndicators = {
  ema20: number | null;
  ema50: number | null;
  emaTrend: 'bullish'|'bearish'|'mixed'|'neutral';
  rsi14: number | null;
  macd: { macd:number|null; signal:number|null; hist:number|null };
  bb: { mid:number|null; upper:number|null; lower:number|null; widthPct:number|null };
  atr14: number | null;
  adx14: number | null; // Wilder
  diPlus14: number | null;
  diMinus14: number | null;
  cci20: number | null;
  stoch: { k:number|null; d:number|null };
  sar: number | null;
};

const eps = 1e-9;

function sma(arr:number[], period:number): number[] {
  const out:number[] = []; let sum=0; 
  for (let i=0;i<arr.length;i++){ 
    sum+=arr[i]; 
    if (i>=period) sum-=arr[i-period]; 
    if (i>=period-1) out.push(sum/period); 
    else out.push(NaN); 
  } 
  return out;
}

function ema(arr:number[], period:number): number[] {
  const k = 2/(period+1); const out:number[]=[]; let prev:number|undefined;
  for (let i=0;i<arr.length;i++){ 
    const v=arr[i]; 
    prev = prev===undefined? v : v*k + prev*(1-k); 
    out.push(prev); 
  } 
  return out;
}

function rsi(arr:number[], period=14): number[] {
  let gains=0, losses=0; const out:number[]=[];
  for (let i=1;i<arr.length;i++){
    const ch = arr[i]-arr[i-1]; 
    const g = Math.max(0,ch), l = Math.max(0,-ch);
    if (i<=period){ 
      gains+=g; losses+=l; out.push(NaN); 
      if (i===period){ 
        const avgG=gains/period, avgL=losses/period; 
        const rs=avgL<eps? 100: avgG/(avgL+eps); 
        out[i-1] = 100 - (100/(1+rs)); 
      } 
    }
    else {
      gains = (gains*(period-1)+g)/period; 
      losses=(losses*(period-1)+l)/period; 
      const rs=losses<eps? 100: gains/(losses+eps); 
      out.push(100 - (100/(1+rs)));
    }
  }
  out.unshift(NaN); // align length
  return out;
}

function macdSeries(arr:number[], fast=12, slow=26, signalP=9){
  const emaF = ema(arr, fast); 
  const emaS = ema(arr, slow); 
  const macd = arr.map((_,i)=> (emaF[i]-emaS[i]));
  const signal = ema(macd, signalP); 
  const hist = macd.map((v,i)=> v - signal[i]);
  return { macd, signal, hist };
}

function std(arr:number[], period:number): number[] {
  const out:number[]=[]; const q:number[]=[]; let sum=0, sum2=0;
  for (let i=0;i<arr.length;i++){
    const v=arr[i]; q.push(v); sum+=v; sum2+=v*v; 
    if(q.length>period){ 
      const r=q.shift()!; sum-=r; sum2-=r*r; 
    }
    if (q.length===period){ 
      const mean=sum/period; 
      out.push(Math.sqrt(Math.max(0, sum2/period - mean*mean))); 
    } else out.push(NaN);
  }
  return out;
}

function bbands(arr:number[], period=20, mult=2){
  const mid = sma(arr, period); 
  const dev = std(arr, period); 
  const upper:number[]=[]; const lower:number[]=[]; const widthPct:number[]=[];
  for (let i=0;i<arr.length;i++){ 
    const m=mid[i], d=dev[i]; 
    if (Number.isNaN(m)||Number.isNaN(d)) { 
      upper.push(NaN); lower.push(NaN); widthPct.push(NaN);
    } else { 
      upper.push(m+mult*d); lower.push(m-mult*d); 
      widthPct.push(((upper[i]-lower[i])/(m+eps))*100); 
    } 
  }
  return { mid, upper, lower, widthPct };
}

function trueRange(h:number[], l:number[], c:number[]): number[] {
  const tr:number[]=[]; 
  for(let i=0;i<h.length;i++){ 
    if (i===0) tr.push(h[i]-l[i]); 
    else tr.push(Math.max(h[i]-l[i], Math.abs(h[i]-c[i-1]), Math.abs(l[i]-c[i-1]))); 
  } 
  return tr;
}

function atrWilder(h:number[], l:number[], c:number[], period=14): number[] {
  const tr = trueRange(h,l,c); const out:number[]=[]; let prev:number|undefined;
  for (let i=0;i<tr.length;i++){
    if (i<period) { 
      out.push(NaN); 
      if (i===period-1){ 
        const seed = tr.slice(0,period).reduce((a,b)=>a+b,0)/period; 
        prev=seed; out[i]=seed; 
      } 
    }
    else { 
      prev = ((prev as number)*(period-1) + tr[i]) / period; 
      out.push(prev); 
    }
  } 
  return out;
}

function adxWilder(h:number[], l:number[], c:number[], period=14){
  const len = h.length; const plusDM:number[]=[]; const minusDM:number[]=[];
  for (let i=0;i<len;i++){
    if (i===0){ plusDM.push(0); minusDM.push(0); continue; }
    const upMove = h[i]-h[i-1]; const downMove = l[i-1]-l[i];
    plusDM.push((upMove>downMove && upMove>0)? upMove: 0);
    minusDM.push((downMove>upMove && downMove>0)? downMove: 0);
  }
  
  // Wilder smoothing for TR, +DM, -DM
  const tr = trueRange(h,l,c);
  function wSmooth(src:number[]): number[] { 
    const out:number[]=[]; let prev:number|undefined; 
    for (let i=0;i<src.length;i++){ 
      if (i<period){ 
        out.push(NaN); 
        if(i===period-1){ 
          const seed=src.slice(0,period).reduce((a,b)=>a+b,0); 
          prev=seed; out[i]=seed; 
        } 
      } else { 
        prev = (prev as number) - ((prev as number)/period) + src[i]; 
        out.push(prev as number); 
      } 
    } 
    return out; 
  }
  
  const trS = wSmooth(tr); const pDMS = wSmooth(plusDM); const mDMS = wSmooth(minusDM);
  const plusDI:number[]=[]; const minusDI:number[]=[]; const dx:number[]=[];
  
  for (let i=0;i<len;i++){
    const trv = trS[i]; const p = pDMS[i]; const m = mDMS[i];
    if (Number.isNaN(trv)) { 
      plusDI.push(NaN); minusDI.push(NaN); dx.push(NaN); 
    }
    else {
      const pdi = 100 * (p/(trv+eps)); 
      const mdi = 100 * (m/(trv+eps)); 
      plusDI.push(pdi); minusDI.push(mdi);
      const dxi = 100 * (Math.abs(pdi - mdi) / (pdi + mdi + eps)); 
      dx.push(dxi);
    }
  }
  
  // ADX = Wilder EMA of DX
  const adx:number[]=[]; let prevADX:number|undefined; 
  for (let i=0;i<dx.length;i++){
    if (i<period*2-1){ 
      adx.push(NaN); 
      if (i===period*2-2){ 
        const seed = dx.slice(period-1, period*2-1).reduce((a,b)=>a+(Number.isNaN(b)?0:b),0)/period; 
        prevADX = seed; adx[i] = seed; 
      } 
    }
    else { 
      prevADX = ((prevADX as number)*(period-1) + dx[i]) / period; 
      adx.push(prevADX as number); 
    }
  }
  return { adx, plusDI, minusDI };
}

function typicalPrice(h:number[], l:number[], c:number[]): number[] { 
  return h.map((_,i)=> (h[i]+l[i]+c[i])/3); 
}

function cciSeries(h:number[], l:number[], c:number[], period=20){ 
  const tp=typicalPrice(h,l,c); 
  const smaTp=sma(tp,period); 
  const dev:number[]=[]; 
  for(let i=0;i<tp.length;i++){ 
    const m=smaTp[i]; 
    if (Number.isNaN(m)) dev.push(NaN); 
    else dev.push(Math.abs(tp[i]-m)); 
  } 
  const md = sma(dev, period); 
  const out:number[]=[]; 
  for (let i=0;i<tp.length;i++){ 
    const m=smaTp[i]; const d=md[i]; 
    if (Number.isNaN(m)||Number.isNaN(d)||d<eps) out.push(NaN); 
    else out.push((tp[i]-m)/(0.015*d)); 
  } 
  return out; 
}

function stochSeries(h:number[], l:number[], c:number[], kPeriod=14, dPeriod=3){
  const k:number[]=[]; 
  for (let i=0;i<c.length;i++){ 
    const s=Math.max(0, i-kPeriod+1); 
    const hh = Math.max(...h.slice(s,i+1)); 
    const ll = Math.min(...l.slice(s,i+1)); 
    const val = (hh-ll)<eps? 50 : ((c[i]-ll)/(hh-ll))*100; 
    k.push(val); 
  }
  const d = sma(k, dPeriod); 
  return { k, d };
}

function parabolicSAR(h:number[], l:number[], step=0.02, max=0.2){
  const len=h.length; 
  const out:number[] = new Array(len).fill(NaN); 
  if (len<2) return out;
  
  // Initialize trend by first two candles
  let isLong = h[1] + l[1] >= h[0] + l[0];
  let ep = isLong ? h[1] : l[1]; // extreme point
  let sar = isLong ? l[0] : h[0];
  let af = step;
  out[0]=NaN; out[1]=sar;
  
  for (let i=2;i<len;i++){
    sar = sar + af * (ep - sar);
    if (isLong){ 
      sar = Math.min(sar, l[i-1], l[i-2]); 
      if (h[i] > ep){ ep = h[i]; af = Math.min(max, af + step); } 
      if (l[i] < sar){ isLong = false; sar = ep; ep = l[i]; af = step; } 
    }
    else { 
      sar = Math.max(sar, h[i-1], h[i-2]); 
      if (l[i] < ep){ ep = l[i]; af = Math.min(max, af + step); } 
      if (h[i] > sar){ isLong = true; sar = ep; ep = h[i]; af = step; } 
    }
    out[i]=sar;
  }
  return out;
}

export function computeProIndicators(candles:Candle[]): ProIndicators {
  const c = candles.map(x=>x.close), h = candles.map(x=>x.high), l = candles.map(x=>x.low);
  
  const ema20S = ema(c,20), ema50S = ema(c,50);
  const ema20 = ema20S.at(-1) ?? null; 
  const ema50 = ema50S.at(-1) ?? null;
  const emaTrend = (ema20!=null && ema50!=null)? (ema20>ema50? 'bullish' : (ema20<ema50? 'bearish':'mixed')) : 'neutral';
  
  const rsiS = rsi(c,14); 
  const rsi14 = rsiS.at(-1) ?? null;
  
  const { macd:macdS, signal:signalS, hist:histS } = macdSeries(c);
  const macd = { 
    macd: macdS.at(-1) ?? null, 
    signal: signalS.at(-1) ?? null, 
    hist: histS.at(-1) ?? null 
  };
  
  const bb = (()=>{ 
    const b = bbands(c,20,2); 
    const i=c.length-1; 
    return { 
      mid: b.mid[i]??null, 
      upper: b.upper[i]??null, 
      lower: b.lower[i]??null, 
      widthPct: b.widthPct[i]??null 
    }; 
  })();
  
  const atrS = atrWilder(h,l,c,14); 
  const atr14 = atrS.at(-1) ?? null;
  
  const { adx:adxS, plusDI, minusDI } = adxWilder(h,l,c,14); 
  const adx14 = adxS.at(-1) ?? null;
  const diPlus14 = plusDI.at(-1) ?? null; 
  const diMinus14 = minusDI.at(-1) ?? null;
  
  const cciS = cciSeries(h,l,c,20); 
  const cci20 = cciS.at(-1) ?? null;
  
  const { k: kS, d: dS } = stochSeries(h,l,c,14,3); 
  const stoch = { k: kS.at(-1) ?? null, d: dS.at(-1) ?? null };
  
  const sarS = parabolicSAR(h,l,0.02,0.2); 
  const sar = sarS.at(-1) ?? null;
  
  return { 
    ema20, ema50, emaTrend, rsi14, macd, bb, atr14, adx14, 
    diPlus14, diMinus14, cci20, stoch, sar 
  };
}