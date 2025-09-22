/**
 * @fileoverview AI Decision Engine - 6-Dimensional Token Analysis
 * Implementasi sesuai spesifikasi dengan JSDoc contracts
 */

const { logger } = require('../utils/logger');

/**
 * @typedef {import('../types/contracts').TokenSnapshot} TokenSnapshot
 * @typedef {import('../types/contracts').AnalysisScores} AnalysisScores
 */

/**
 * Score liquidity based on pool size and depth
 * @param {TokenSnapshot} snapshot - Token data snapshot
 * @returns {number} Liquidity score (0..10)
 */
function scoreLiquidity(snapshot) {
  try {
    const { poolLiquiditySol, volume24h, liqChange24hPct } = snapshot;
    
    // Base score from pool liquidity
    let score = 0;
    if (poolLiquiditySol >= 100) score += 4;      // 100+ SOL = good base
    else if (poolLiquiditySol >= 50) score += 3;  // 50+ SOL = decent
    else if (poolLiquiditySol >= 20) score += 2;  // 20+ SOL = minimal
    else if (poolLiquiditySol >= 10) score += 1;  // 10+ SOL = risky
    
    // Volume to liquidity ratio (healthy: 0.5-2.0)
    const volumeRatio = volume24h / (poolLiquiditySol * 1000); // Normalize to USD
    if (volumeRatio >= 0.5 && volumeRatio <= 2.0) score += 3;
    else if (volumeRatio >= 0.2 && volumeRatio <= 5.0) score += 2;
    else if (volumeRatio >= 0.1) score += 1;
    
    // Liquidity stability (prefer stable or growing)
    if (liqChange24hPct >= -5 && liqChange24hPct <= 20) score += 3; // Stable/growing
    else if (liqChange24hPct >= -15) score += 1; // Moderate decline
    
    return Math.min(10, Math.max(0, score));
  } catch (error) {
    logger.warn('Error scoring liquidity:', error);
    return 0;
  }
}

/**
 * Score security based on token authorities and hooks
 * @param {TokenSnapshot} snapshot - Token data snapshot
 * @returns {number} Security score (0..10)
 */
function scoreSecurity(snapshot) {
  try {
    const { mintAuthorityNull, freezeAuthorityNull, transferHookDetected, hoursSinceLaunch } = snapshot;
    
    let score = 0;
    
    // Mint authority check (critical)
    if (mintAuthorityNull) {
      score += 4; // Cannot mint new tokens
    } else {
      return 0; // Auto-fail if mint authority exists
    }
    
    // Freeze authority check (important)
    if (freezeAuthorityNull) {
      score += 3; // Cannot freeze accounts
    } else {
      score += 1; // Risky but not auto-fail
    }
    
    // Transfer hook detection (red flag)
    if (!transferHookDetected) {
      score += 2; // No custom transfer logic
    } else {
      score -= 2; // Penalty for transfer hooks
    }
    
    // Time since launch (newer = riskier)
    if (hoursSinceLaunch >= 168) score += 1;      // 1+ week old
    else if (hoursSinceLaunch >= 24) score += 0.5; // 1+ day old
    // New tokens get no bonus
    
    return Math.min(10, Math.max(0, score));
  } catch (error) {
    logger.warn('Error scoring security:', error);
    return 0;
  }
}

/**
 * Score whale activity and holder distribution
 * @param {TokenSnapshot} snapshot - Token data snapshot
 * @returns {number} Whale score (0..10)
 */
function scoreWhale(snapshot) {
  try {
    const { topHoldersPct, whaleAccumPct } = snapshot;
    
    let score = 0;
    
    // Top holders concentration (prefer distributed)
    if (topHoldersPct <= 20) score += 4;         // Well distributed
    else if (topHoldersPct <= 40) score += 3;    // Moderately distributed
    else if (topHoldersPct <= 60) score += 2;    // Concentrated
    else if (topHoldersPct <= 80) score += 1;    // Highly concentrated
    // >80% = 0 points (too risky)
    
    // Whale accumulation trend
    if (whaleAccumPct > 0 && whaleAccumPct <= 10) {
      score += 4; // Healthy whale accumulation
    } else if (whaleAccumPct > 10 && whaleAccumPct <= 25) {
      score += 3; // Moderate accumulation
    } else if (whaleAccumPct > 25) {
      score += 1; // Heavy accumulation (could be manipulation)
    } else if (whaleAccumPct < 0) {
      score -= 1; // Whale selling (bearish)
    }
    
    // Smart money bonus (if whales are accumulating but not too concentrated)
    if (whaleAccumPct > 0 && topHoldersPct <= 40) {
      score += 2; // Smart money following
    }
    
    return Math.min(10, Math.max(0, score));
  } catch (error) {
    logger.warn('Error scoring whale activity:', error);
    return 5; // Neutral score on error
  }
}

/**
 * Score technical indicators
 * @param {TokenSnapshot} snapshot - Token data snapshot
 * @returns {number} Technical score (0..10)
 */
function scoreTechnical(snapshot) {
  try {
    const { rsi, macdBullish, volume24h, priceChangePct } = snapshot;
    
    let score = 0;
    
    // RSI analysis (prefer 30-70 range, avoid extremes)
    if (rsi >= 30 && rsi <= 70) {
      score += 3; // Healthy range
    } else if (rsi >= 20 && rsi <= 80) {
      score += 2; // Acceptable range
    } else if (rsi < 30) {
      score += 4; // Oversold (potential bounce)
    } else {
      score += 1; // Overbought (risky)
    }
    
    // MACD signal
    if (macdBullish) {
      score += 3; // Bullish momentum
    } else {
      score += 1; // Bearish momentum
    }
    
    // Volume confirmation
    if (volume24h > 10000) score += 2;      // High volume
    else if (volume24h > 5000) score += 1;  // Moderate volume
    
    // Price momentum (prefer moderate positive movement)
    if (priceChangePct >= 5 && priceChangePct <= 50) {
      score += 2; // Healthy uptrend
    } else if (priceChangePct >= 0 && priceChangePct < 5) {
      score += 1; // Stable/slight up
    } else if (priceChangePct < 0 && priceChangePct >= -20) {
      score += 1; // Minor correction
    }
    // Extreme moves get no bonus
    
    return Math.min(10, Math.max(0, score));
  } catch (error) {
    logger.warn('Error scoring technical indicators:', error);
    return 5; // Neutral score on error
  }
}

/**
 * Score price action and momentum
 * @param {TokenSnapshot} snapshot - Token data snapshot
 * @returns {number} Price score (0..10)
 */
function scorePrice(snapshot) {
  try {
    const { priceChangePct, hoursSinceLaunch, volume24h } = snapshot;
    
    let score = 0;
    
    // Price momentum scoring
    if (priceChangePct >= 10 && priceChangePct <= 100) {
      score += 4; // Strong positive momentum
    } else if (priceChangePct >= 5 && priceChangePct < 10) {
      score += 3; // Moderate positive momentum
    } else if (priceChangePct >= 0 && priceChangePct < 5) {
      score += 2; // Slight positive momentum
    } else if (priceChangePct >= -10 && priceChangePct < 0) {
      score += 1; // Minor correction
    }
    // Larger drops or extreme pumps get 0
    
    // Early stage bonus (if price is moving up in first hours)
    if (hoursSinceLaunch <= 24 && priceChangePct > 0) {
      score += 2; // Early momentum bonus
    }
    
    // Volume-price relationship
    const volumeScore = Math.min(4, Math.log10(volume24h + 1));
    score += volumeScore;
    
    return Math.min(10, Math.max(0, score));
  } catch (error) {
    logger.warn('Error scoring price action:', error);
    return 5; // Neutral score on error
  }
}

/**
 * Score social sentiment and buzz
 * @param {TokenSnapshot} snapshot - Token data snapshot
 * @returns {number} Social score (0..10)
 */
function scoreSocial(snapshot) {
  try {
    const { socialBuzzScore } = snapshot;
    
    // Convert 0..1 buzz score to 0..10 scale
    let score = socialBuzzScore * 10;
    
    // Cap social influence to prevent hype-driven decisions
    score = Math.min(7, score); // Max 7/10 from social
    
    return Math.max(0, score);
  } catch (error) {
    logger.warn('Error scoring social sentiment:', error);
    return 3; // Low neutral score on error
  }
}

/**
 * Normalize scores to ensure they're in 0..10 range
 * @param {Object} scores - Raw scores object
 * @returns {Object} Normalized scores
 */
function normalizeScores(scores) {
  const normalized = {};
  
  for (const [key, value] of Object.entries(scores)) {
    normalized[key] = Math.min(10, Math.max(0, value));
  }
  
  return normalized;
}

/**
 * Calculate weighted final score
 * @param {Object} scores - Normalized scores
 * @param {Object} weights - Weight configuration
 * @returns {number} Weighted score
 */
function weighted(scores, weights) {
  let totalScore = 0;
  let totalWeight = 0;
  
  for (const [category, weight] of Object.entries(weights)) {
    if (scores[category] !== undefined) {
      totalScore += scores[category] * weight;
      totalWeight += weight;
    }
  }
  
  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

/**
 * Calculate sentiment bonus (capped)
 * @param {TokenSnapshot} snapshot - Token data snapshot
 * @returns {number} Bonus score (max +0.5)
 */
function sentimentBonus(snapshot) {
  try {
    const { socialBuzzScore, whaleAccumPct, macdBullish } = snapshot;
    
    let bonus = 0;
    
    // Social buzz bonus (max +0.2)
    if (socialBuzzScore > 0.7) bonus += 0.2;
    else if (socialBuzzScore > 0.5) bonus += 0.1;
    
    // Whale accumulation bonus (max +0.2)
    if (whaleAccumPct > 15) bonus += 0.2;
    else if (whaleAccumPct > 5) bonus += 0.1;
    
    // Technical momentum bonus (max +0.1)
    if (macdBullish) bonus += 0.1;
    
    return Math.min(0.5, bonus); // Cap at +0.5
  } catch (error) {
    return 0;
  }
}

/**
 * Multi-source data quorum check
 * @param {TokenSnapshot[]} snapshots - Array of snapshots from different sources
 * @returns {TokenSnapshot} Consensus snapshot
 */
function applyQuorum(snapshots) {
  if (snapshots.length === 1) return snapshots[0];
  
  // Check for significant discrepancies in key metrics
  const volumes = snapshots.map(s => s.volume24h).filter(v => v > 0);
  const liquidities = snapshots.map(s => s.poolLiquiditySol).filter(l => l > 0);
  
  if (volumes.length > 1) {
    const maxVol = Math.max(...volumes);
    const minVol = Math.min(...volumes);
    
    // If volume differs by more than 50%, use median and reduce liquidity weight
    if (maxVol / minVol > 1.5) {
      logger.warn('Volume discrepancy detected across sources, using median');
      const medianVolume = volumes.sort()[Math.floor(volumes.length / 2)];
      
      // Return consensus snapshot with adjusted data
      return {
        ...snapshots[0],
        volume24h: medianVolume,
        poolLiquiditySol: liquidities.length > 0 ? 
          liquidities.sort()[Math.floor(liquidities.length / 2)] : 
          snapshots[0].poolLiquiditySol
      };
    }
  }
  
  return snapshots[0]; // Use first source if no major discrepancies
}

/**
 * Main analysis function - analyzes token and returns scores
 * @param {TokenSnapshot} snapshot - Token data snapshot
 * @param {Object} deps - Dependencies (unused for now, future extensibility)
 * @returns {Promise<AnalysisScores>} Analysis scores
 */
async function analyzeToken(snapshot, deps = {}) {
  try {
    logger.info(`Analyzing token: ${snapshot.symbol} (${snapshot.mint})`);
    
    // Calculate individual scores
    const liq = scoreLiquidity(snapshot);
    const sec = scoreSecurity(snapshot);
    const wh = scoreWhale(snapshot);
    const ta = scoreTechnical(snapshot);
    const pr = scorePrice(snapshot);
    const so = scoreSocial(snapshot);
    
    // Normalize all scores
    const normalized = normalizeScores({ liq, sec, wh, ta, pr, so });
    
    // Calculate weighted final score
    const finalScore = weighted(
      {
        liquidity: normalized.liq,
        security: normalized.sec,
        whale: normalized.wh,
        technical: normalized.ta,
        price: normalized.pr,
        social: normalized.so
      },
      {
        liquidity: 0.25,  // 25% - Pool health is critical
        security: 0.30,   // 30% - Security is most important
        whale: 0.20,      // 20% - Smart money matters
        technical: 0.15,  // 15% - Technical confirmation
        price: 0.10,      // 10% - Price momentum
        social: 0.10      // 10% - Social sentiment (capped influence)
      }
    ) + sentimentBonus(snapshot);
    
    const result = {
      liquidity: normalized.liq,
      security: normalized.sec,
      whale: normalized.wh,
      technical: normalized.ta,
      price: normalized.pr,
      social: normalized.so,
      finalScore: Math.min(10.5, finalScore) // Cap at 10.5 with bonus
    };
    
    logger.info(`Analysis complete for ${snapshot.symbol}: Final Score ${result.finalScore.toFixed(2)}/10`);
    
    return result;
    
  } catch (error) {
    logger.error('Error in token analysis:', error);
    
    // Return safe default scores on error
    return {
      liquidity: 0,
      security: 0,
      whale: 0,
      technical: 0,
      price: 0,
      social: 0,
      finalScore: 0
    };
  }
}

module.exports = {
  analyzeToken,
  scoreLiquidity,
  scoreSecurity,
  scoreWhale,
  scoreTechnical,
  scorePrice,
  scoreSocial,
  normalizeScores,
  weighted,
  sentimentBonus,
  applyQuorum
};
