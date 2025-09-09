/**
 * Smart Money Concepts (SMC) Analysis Module
 * Provides institutional-grade market structure analysis
 */

export type Swing = { 
  time: number; 
  high: number; 
  low: number; 
  close: number; 
  volume?: number;
};

export type SmcSignal = {
  bias: "bullish" | "bearish" | "neutral";
  reasons: string[];
  levels?: { 
    ob?: number; 
    fvg?: [number, number];
    liquidityPool?: number;
    sweep?: number;
  };
  confidence: number; // 0-1
  strength: number; // 1-10
};

/**
 * Deteksi Smart Money Concepts dengan multiple confirmations
 */
export function detectSMC(swings: Swing[]): SmcSignal {
  const reasons: string[] = [];
  let bias: SmcSignal["bias"] = "neutral";
  let confidence = 0.5;
  let strength = 5;

  if (swings.length < 10) {
    return { bias: "neutral", reasons: ["Insufficient data"], confidence: 0.1, strength: 1 };
  }

  // 1. Break of Structure (BOS) & Change of Character (CHoCH) Analysis
  const recentSwings = swings.slice(-10);
  const highs = recentSwings.map(s => s.high);
  const lows = recentSwings.map(s => s.low);
  
  const currentHigh = highs[highs.length - 1];
  const currentLow = lows[lows.length - 1];
  const prevHigh = Math.max(...highs.slice(-5, -1));
  const prevLow = Math.min(...lows.slice(-5, -1));

  // Break of Structure Detection
  if (currentHigh > prevHigh) {
    const breakStrength = ((currentHigh - prevHigh) / prevHigh) * 100;
    if (breakStrength > 0.5) {
      reasons.push("BOS upward");
      bias = "bullish";
      confidence += 0.2;
      strength += 2;
    }
  } else if (currentLow < prevLow) {
    const breakStrength = ((prevLow - currentLow) / prevLow) * 100;
    if (breakStrength > 0.5) {
      reasons.push("BOS downward");
      bias = "bearish";
      confidence += 0.2;
      strength += 2;
    }
  }

  // 2. Fair Value Gap (FVG) Detection
  const last3 = swings.slice(-3);
  if (last3.length === 3) {
    const [a, b, c] = last3;
    
    // Bullish FVG: Gap between candle 1 high and candle 3 low
    if (b.low > a.high && c.low > a.high) {
      reasons.push("Bullish FVG detected");
      if (bias !== "bearish") bias = "bullish";
      confidence += 0.15;
      strength += 1;
    }
    
    // Bearish FVG: Gap between candle 1 low and candle 3 high  
    if (b.high < a.low && c.high < a.low) {
      reasons.push("Bearish FVG detected");
      if (bias !== "bullish") bias = "bearish";
      confidence += 0.15;
      strength += 1;
    }
  }

  // 3. Order Block (OB) Analysis
  const orderBlockLevel = detectOrderBlock(recentSwings);
  if (orderBlockLevel) {
    reasons.push("Order block identified");
    confidence += 0.1;
    strength += 1;
  }

  // 4. Liquidity Sweep Detection
  const liquiditySweep = detectLiquiditySweep(swings);
  if (liquiditySweep) {
    reasons.push(`Liquidity sweep ${liquiditySweep.direction}`);
    confidence += 0.1;
    strength += 1;
  }

  // 5. Equal Highs/Lows (EQH/EQL) Detection
  const equalLevels = detectEqualLevels(recentSwings);
  if (equalLevels.length > 0) {
    reasons.push(`Equal levels at ${equalLevels.length} points`);
    confidence += 0.05;
  }

  // Clamp values
  confidence = Math.min(Math.max(confidence, 0), 1);
  strength = Math.min(Math.max(strength, 1), 10);

  return {
    bias,
    reasons,
    confidence,
    strength,
    levels: {
      ob: orderBlockLevel,
      liquidityPool: liquiditySweep?.level,
      sweep: liquiditySweep?.sweepLevel,
    }
  };
}

/**
 * Detect Order Block levels
 */
function detectOrderBlock(swings: Swing[]): number | undefined {
  if (swings.length < 5) return undefined;

  // Find areas where price made strong moves with high volume
  for (let i = 1; i < swings.length - 1; i++) {
    const current = swings[i];
    const prev = swings[i - 1];
    const next = swings[i + 1];

    // Look for significant price moves with volume confirmation
    const upMove = (current.high - prev.low) / prev.low;
    const downMove = (prev.high - current.low) / prev.high;

    if (upMove > 0.02 && current.volume && prev.volume && current.volume > prev.volume * 1.5) {
      return current.low; // Demand order block
    } else if (downMove > 0.02 && current.volume && prev.volume && current.volume > prev.volume * 1.5) {
      return current.high; // Supply order block
    }
  }

  return undefined;
}

/**
 * Detect liquidity sweeps (stop hunt patterns)
 */
function detectLiquiditySweep(swings: Swing[]): { direction: string; level: number; sweepLevel: number } | undefined {
  if (swings.length < 8) return undefined;

  const recent = swings.slice(-8);
  const highs = recent.map(s => s.high);
  const lows = recent.map(s => s.low);

  // Look for recent high that was swept
  const recentHigh = Math.max(...highs.slice(0, -2));
  const currentHigh = highs[highs.length - 1];
  
  if (currentHigh > recentHigh) {
    const sweepDistance = currentHigh - recentHigh;
    if (sweepDistance / recentHigh > 0.001) { // Minimum 0.1% sweep
      return {
        direction: "upward",
        level: recentHigh,
        sweepLevel: currentHigh
      };
    }
  }

  // Look for recent low that was swept
  const recentLow = Math.min(...lows.slice(0, -2));
  const currentLow = lows[lows.length - 1];
  
  if (currentLow < recentLow) {
    const sweepDistance = recentLow - currentLow;
    if (sweepDistance / recentLow > 0.001) { // Minimum 0.1% sweep
      return {
        direction: "downward", 
        level: recentLow,
        sweepLevel: currentLow
      };
    }
  }

  return undefined;
}

/**
 * Detect equal highs/lows levels
 */
function detectEqualLevels(swings: Swing[]): number[] {
  const equalLevels: number[] = [];
  const threshold = 0.002; // 0.2% tolerance for "equal" levels

  const highs = swings.map(s => s.high);
  const lows = swings.map(s => s.low);

  // Check for equal highs
  for (let i = 0; i < highs.length - 1; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      const diff = Math.abs(highs[i] - highs[j]) / highs[i];
      if (diff < threshold) {
        equalLevels.push(highs[i]);
        break;
      }
    }
  }

  // Check for equal lows
  for (let i = 0; i < lows.length - 1; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      const diff = Math.abs(lows[i] - lows[j]) / lows[i];
      if (diff < threshold) {
        equalLevels.push(lows[i]);
        break;
      }
    }
  }

  return equalLevels;
}

/**
 * Score SMC analysis untuk screening system
 */
export function scoreSMC(signal: SmcSignal): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [...signal.reasons];

  // Base score berdasarkan bias dan confidence
  if (signal.bias === "bullish") {
    score = Math.round(24 * signal.confidence);
  } else if (signal.bias === "bearish") {
    score = Math.round(-24 * signal.confidence);
  }

  // Adjust berdasarkan strength
  const strengthMultiplier = signal.strength / 10;
  score = Math.round(score * strengthMultiplier);

  // Bonus untuk multiple confirmations
  if (signal.reasons.length >= 3) {
    const bonus = signal.bias === "bullish" ? 2 : -2;
    score += bonus;
    reasons.push("Multiple SMC confirmations");
  }

  // Clamp score dalam range -30 sampai +30
  score = Math.max(-30, Math.min(30, score));

  return { score, reasons };
}