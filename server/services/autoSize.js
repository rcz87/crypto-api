/**
 * 💰 Auto-Sizing by Confidence System
 * Dynamically adjusts position sizes based on signal confidence, volatility, and market conditions
 */

// Using global fetch (Node 18+)

const PY_BASE = process.env.PY_BASE || "http://localhost:5000/py";

/**
 * 🎯 Calculate Position Size by Confidence
 * 
 * Formula: size = equity * base_risk% * mult(conf) * vol_adj * flow_adj
 * 
 * @param {Object} params - Sizing parameters
 * @param {number} params.confidence - Signal confidence (0-100)
 * @param {string} params.symbol - Trading symbol (e.g., 'SOL', 'BTC')
 * @param {number} params.equity - Portfolio equity in USD (defaults to env EQUITY_USD)
 * @param {number} params.baseRisk - Base risk percentage (defaults to env BASE_RISK_PCT)
 * @param {Object} params.market - Market data for adjustments
 * @param {number} params.market.atrPercent - Current ATR as percentage
 * @param {number} params.market.etfFlowUSD - BTC ETF net inflow in USD
 * @param {string} params.timeframe - Timeframe for volatility calculation
 * @returns {Object} Position sizing calculation
 */
export async function sizeByConfidence(params) {
  try {
    const {
      confidence,
      symbol = 'SOL',
      equity = parseFloat(process.env.EQUITY_USD) || 10000,
      baseRisk = parseFloat(process.env.BASE_RISK_PCT) || 2.0,
      market = {},
      timeframe = '1h'
    } = params;

    // Validate inputs
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 100) {
      throw new Error('Confidence must be a number between 0-100');
    }

    console.log(`💰 Calculating position size: confidence=${confidence}%, symbol=${symbol}, equity=$${equity}`);

    // 1. Confidence Multiplier
    const confidenceMultiplier = getConfidenceMultiplier(confidence);
    
    // 2. Fetch market data if not provided
    let atrPercent = market.atrPercent;
    let etfFlowUSD = market.etfFlowUSD;
    
    if (atrPercent == null || etfFlowUSD == null) {
      const marketData = await fetchMarketData(symbol, timeframe);
      atrPercent = atrPercent ?? marketData.atrPercent ?? 0.8; // Default 0.8% ATR
      etfFlowUSD = etfFlowUSD ?? marketData.etfFlowUSD ?? 0;
    }

    // 3. Volatility Adjustment
    const volatilityAdjustment = getVolatilityAdjustment(atrPercent);
    
    // 4. ETF Flow Boost
    const etfFlowBoost = getETFFlowBoost(etfFlowUSD);

    // 5. Calculate Final Position Size
    const baseRiskDecimal = baseRisk / 100;
    const calculatedSize = equity * baseRiskDecimal * confidenceMultiplier * volatilityAdjustment * etfFlowBoost;
    
    // 6. Apply sizing limits (max 5% of equity for safety)
    const maxSize = equity * 0.05;
    const finalSize = Math.min(calculatedSize, maxSize);
    
    // 7. Calculate contract/coin amounts
    const contractAmount = await calculateContractAmount(finalSize, symbol);
    
    const result = {
      sizing: {
        dollarAmount: Math.round(finalSize),
        contractAmount: contractAmount.contracts,
        coinAmount: contractAmount.coins,
        percentage: ((finalSize / equity) * 100).toFixed(2)
      },
      factors: {
        confidence: {
          value: confidence,
          multiplier: confidenceMultiplier,
          tier: getConfidenceTier(confidence)
        },
        volatility: {
          atrPercent: atrPercent.toFixed(3),
          adjustment: volatilityAdjustment.toFixed(3),
          regime: getVolatilityRegime(atrPercent)
        },
        etfFlow: {
          flowUSD: etfFlowUSD,
          boost: etfFlowBoost,
          impact: etfFlowUSD > 50_000_000 ? 'BULLISH' : 'NEUTRAL'
        }
      },
      portfolio: {
        equity,
        baseRisk: `${baseRisk}%`,
        maxAllocation: `${((maxSize / equity) * 100).toFixed(1)}%`,
        remainingCapacity: `$${Math.round(equity - finalSize).toLocaleString()}`
      },
      calculation: {
        formula: 'equity × base_risk% × conf_mult × vol_adj × flow_boost',
        breakdown: `$${equity} × ${baseRisk}% × ${confidenceMultiplier} × ${volatilityAdjustment.toFixed(3)} × ${etfFlowBoost} = $${Math.round(calculatedSize)}`,
        capped: calculatedSize > maxSize ? `Capped at max 5% ($${Math.round(maxSize)})` : 'No cap applied'
      },
      timestamp: new Date().toISOString()
    };

    console.log(`💰 Size calculated: $${result.sizing.dollarAmount} (${result.sizing.percentage}% of equity)`);
    return result;

  } catch (error) {
    console.error('❌ Auto-sizing calculation failed:', error.message);
    const fallbackEquity = Number(process.env.EQUITY_USD) || 10000;
    return {
      error: error.message,
      fallbackSize: {
        dollarAmount: Math.round(fallbackEquity * 0.01), // 1% fallback
        warning: 'Using conservative 1% fallback due to calculation error'
      }
    };
  }
}

/**
 * 🎚️ Get Confidence Multiplier
 * <60=0.5x, 60-70=1.0x, 70-80=1.3x, >80=1.6x
 */
function getConfidenceMultiplier(confidence) {
  if (confidence < 60) return 0.5;
  if (confidence < 70) return 1.0;
  if (confidence < 80) return 1.3;
  return 1.6;
}

/**
 * 📊 Get Confidence Tier Description
 */
function getConfidenceTier(confidence) {
  if (confidence < 60) return 'LOW';
  if (confidence < 70) return 'MEDIUM';
  if (confidence < 80) return 'HIGH';
  return 'VERY_HIGH';
}

/**
 * 📈 Get Volatility Adjustment
 * vol_adj = clamp(ATR% / 0.8%, 0.8 .. 1.25)
 */
function getVolatilityAdjustment(atrPercent) {
  const rawAdjustment = atrPercent / 0.8; // Normalize to 0.8% baseline
  return Math.max(0.8, Math.min(1.25, rawAdjustment));
}

/**
 * 🌡️ Get Volatility Regime Description
 */
function getVolatilityRegime(atrPercent) {
  if (atrPercent < 0.5) return 'LOW';
  if (atrPercent < 1.0) return 'NORMAL';
  if (atrPercent < 2.0) return 'HIGH';
  return 'EXTREME';
}

/**
 * 💸 Get ETF Flow Boost
 * flow_adj = 1.1 if BTC net inflow > $50M else 1.0
 */
function getETFFlowBoost(etfFlowUSD) {
  return etfFlowUSD > 50_000_000 ? 1.1 : 1.0;
}

/**
 * 📊 Fetch Market Data for Adjustments
 */
async function fetchMarketData(symbol, timeframe) {
  try {
    // Use unified endpoint for ETF flows, keep technical/atr as is for now
    const [atrData, etfData] = await Promise.all([
      fetchWithTimeout(`${PY_BASE}/advanced/technical/atr?symbol=${symbol}&timeframe=${timeframe}`, 5000), // Keep original for now
      fetchUnifiedEndpoint('etf_flows', { asset: 'BTC' })
    ]);

    const atrPercent = atrData?.atr_percent ?? 0.8;
    const etfFlowUSD = etfData?.today?.net_inflow_usd ?? 0;

    return { atrPercent, etfFlowUSD };

  } catch (error) {
    console.warn('⚠️ Market data fetch failed, using defaults:', error.message);
    return { atrPercent: 0.8, etfFlowUSD: 0 };
  }
}

/**
 * 🔄 Fetch Unified Endpoint Helper
 */
async function fetchUnifiedEndpoint(operation, params) {
  const response = await fetchWithTimeout(`${PY_BASE}/gpts/advanced`, 8000, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      op: operation,
      params: params
    })
  });
  return response;
}

/**
 * 🪙 Calculate Contract/Coin Amounts
 */
async function calculateContractAmount(dollarAmount, symbol) {
  try {
    // Get current price for symbol using unified endpoint
    const priceData = await fetchUnifiedEndpoint('ticker', { symbol: symbol });
    const currentPrice = priceData?.price ?? priceData?.last ?? 200; // Fallback price for SOL

    const coinAmount = dollarAmount / currentPrice;
    
    // For perpetual futures, contracts are typically 1:1 with coin amount
    const contracts = coinAmount;

    return {
      contracts: parseFloat(contracts.toFixed(4)),
      coins: parseFloat(coinAmount.toFixed(4)),
      price: currentPrice
    };

  } catch (error) {
    console.warn('⚠️ Price fetch failed for contract calculation:', error.message);
    // Fallback calculation with estimated price
    const estimatedPrice = symbol === 'SOL' ? 200 : symbol === 'BTC' ? 65000 : 100;
    const coinAmount = dollarAmount / estimatedPrice;
    
    return {
      contracts: parseFloat(coinAmount.toFixed(4)),
      coins: parseFloat(coinAmount.toFixed(4)),
      price: estimatedPrice,
      warning: 'Using estimated price due to data fetch error'
    };
  }
}

/**
 * 🔄 Fetch with Timeout
 */
async function fetchWithTimeout(url, timeoutMs = 5000, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

/**
 * 🧮 Batch Size Calculator for Multiple Signals
 */
export async function calculateMultipleSizes(signals) {
  try {
    console.log(`💰 Calculating sizes for ${signals.length} signals`);
    
    const results = await Promise.all(
      signals.map(signal => sizeByConfidence(signal))
    );

    const totalAllocation = results.reduce((sum, result) => {
      return sum + (result.sizing?.dollarAmount || 0);
    }, 0);

    const equity = results[0]?.portfolio?.equity || 10000;
    const totalAllocationPercent = ((totalAllocation / equity) * 100).toFixed(2);

    return {
      signals: results,
      portfolio: {
        totalAllocation: Math.round(totalAllocation),
        totalAllocationPercent: `${totalAllocationPercent}%`,
        remainingCapacity: Math.round(equity - totalAllocation),
        utilizationStatus: totalAllocation > equity * 0.1 ? 'HIGH' : 'MODERATE'
      },
      summary: {
        signalCount: signals.length,
        successfulCalculations: results.filter(r => !r.error).length,
        averageConfidence: (signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length).toFixed(1)
      }
    };

  } catch (error) {
    console.error('❌ Batch size calculation failed:', error.message);
    return { error: error.message };
  }
}

/**
 * 📋 Get Sizing Summary for Display
 */
export function formatSizingForDisplay(sizingResult, options = {}) {
  const { compact = false, showBreakdown = true } = options;
  
  if (sizingResult.error) {
    return `❌ Sizing Error: ${sizingResult.error}`;
  }

  const { sizing, factors, calculation } = sizingResult;
  
  if (compact) {
    return `💰 Size: $${sizing.dollarAmount.toLocaleString()} (${sizing.percentage}%) | Conf: ${factors.confidence.tier} | Vol: ${factors.volatility.regime}`;
  }

  let display = `💰 **POSITION SIZING**\n\n`;
  display += `💵 Dollar Amount: $${sizing.dollarAmount.toLocaleString()}\n`;
  display += `📊 Portfolio %: ${sizing.percentage}%\n`;
  display += `🪙 Contracts: ${sizing.contractAmount}\n`;
  display += `💎 Coins: ${sizing.coinAmount}\n\n`;
  
  display += `📈 **CONFIDENCE**: ${factors.confidence.value}% (${factors.confidence.tier})\n`;
  display += `📊 **VOLATILITY**: ${factors.volatility.atrPercent}% ATR (${factors.volatility.regime})\n`;
  display += `💸 **ETF FLOW**: ${factors.etfFlow.impact}\n\n`;
  
  if (showBreakdown) {
    display += `🧮 **CALCULATION**\n`;
    display += `${calculation.breakdown}\n`;
    if (calculation.capped.includes('Capped')) {
      display += `⚠️ ${calculation.capped}`;
    }
  }

  return display;
}