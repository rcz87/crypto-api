/**
 * 🎯 Signal Aggregator - Institutional Bias Endpoint
 * Combines whale activity, ETF flows, sentiment, and liquidation data
 * into a single institutional trading recommendation
 */

import { Request, Response } from "express";
import fetch from "node-fetch";

const PY_BASE = process.env.PY_BASE || "http://localhost:5000/py";

/**
 * GET /signal/institutional/{symbol}
 * Aggregates all institutional data into a single recommendation
 */
export async function getInstitutionalSignal(req: Request, res: Response) {
  try {
    const { symbol = "BTC" } = req.params;
    const validSymbols = ["BTC", "ETH", "SOL"];
    
    if (!validSymbols.includes(symbol.toUpperCase())) {
      return res.status(400).json({
        error: "Invalid symbol",
        supported: validSymbols
      });
    }

    console.log(`🎯 Generating institutional signal for ${symbol}`);

    // Parallel fetch of all institutional data sources
    const startTime = Date.now();
    const [whaleData, etfData, sentimentData, heatmapData, orderbookData] = await Promise.all([
      fetchWithRetry(`${PY_BASE}/advanced/whale/alerts?symbol=${symbol}`),
      fetchWithRetry(`${PY_BASE}/advanced/etf/flows?asset=BTC`), // ETF flows mainly track BTC
      fetchWithRetry(`${PY_BASE}/advanced/market/sentiment`),
      fetchWithRetry(`${PY_BASE}/advanced/liquidation/heatmap/${symbol}?timeframe=1h`),
      fetchWithRetry(`${PY_BASE}/advanced/spot/orderbook/${symbol}?exchange=binance`)
    ]);

    const fetchTime = Date.now() - startTime;

    // 🐋 Analyze Whale Activity
    const whaleEvents = whaleData?.events || [];
    const whaleMetrics = analyzeWhaleActivity(whaleEvents);

    // 💰 Analyze ETF Flow Impact
    const etfMetrics = analyzeETFFlows(etfData);

    // 📊 Analyze Market Sentiment
    const sentimentMetrics = analyzeSentiment(sentimentData);

    // 🔥 Analyze Liquidation Risk
    const liquidationMetrics = analyzeLiquidationHeatmap(heatmapData);

    // 📈 Analyze Orderbook Structure
    const orderbookMetrics = analyzeOrderbook(orderbookData);

    // 🎯 Generate Institutional Bias Score
    const biasScore = calculateInstitutionalBias({
      whale: whaleMetrics,
      etf: etfMetrics,
      sentiment: sentimentMetrics,
      liquidation: liquidationMetrics,
      orderbook: orderbookMetrics
    });

    // 📝 Generate Trading Recommendation
    const recommendation = generateTradingRecommendation(symbol, biasScore);

    // 📊 Response
    res.json({
      symbol: symbol.toUpperCase(),
      timestamp: new Date().toISOString(),
      bias: biasScore.direction,
      confidence: biasScore.confidence,
      strength: biasScore.strength,
      recommendation,
      analysis: {
        whale: whaleMetrics,
        etf: etfMetrics,
        sentiment: sentimentMetrics,
        liquidation: liquidationMetrics,
        orderbook: orderbookMetrics
      },
      metadata: {
        fetchTimeMs: fetchTime,
        sources: 5,
        algorithm: "institutional-bias-v1"
      }
    });

  } catch (error: any) {
    console.error("❌ Signal aggregation error:", error.message);
    res.status(500).json({
      error: "Signal generation failed",
      message: error.message
    });
  }
}

/**
 * 🐋 Analyze whale activity patterns
 */
function analyzeWhaleActivity(events: any[]): any {
  const buyEvents = events.filter(e => e.side === "buy");
  const sellEvents = events.filter(e => e.side === "sell");
  
  const largeBuys = buyEvents.filter(e => (e.usd_size || 0) >= 1_000_000);
  const largeSells = sellEvents.filter(e => (e.usd_size || 0) >= 1_000_000);
  
  const buyVolume = buyEvents.reduce((sum, e) => sum + (e.usd_size || 0), 0);
  const sellVolume = sellEvents.reduce((sum, e) => sum + (e.usd_size || 0), 0);
  
  const netFlow = buyVolume - sellVolume;
  const bias = netFlow > 0 ? "bullish" : netFlow < 0 ? "bearish" : "neutral";
  
  return {
    bias,
    netFlow,
    buyVolume,
    sellVolume,
    largeBuys: largeBuys.length,
    largeSells: largeSells.length,
    score: Math.min(100, Math.abs(netFlow) / 1_000_000 * 20) // Scale to 0-100
  };
}

/**
 * 💰 Analyze ETF flow impact
 */
function analyzeETFFlows(data: any): any {
  const todayFlow = data?.today?.net_inflow_usd || 0;
  const weekFlow = data?.week?.net_inflow_usd || 0;
  
  const bias = todayFlow > 0 ? "bullish" : todayFlow < 0 ? "bearish" : "neutral";
  
  return {
    bias,
    todayFlow,
    weekFlow,
    momentum: weekFlow > 0 ? "positive" : "negative",
    score: Math.min(100, Math.abs(todayFlow) / 10_000_000 * 50) // Scale to 0-100
  };
}

/**
 * 📊 Analyze market sentiment
 */
function analyzeSentiment(data: any): any {
  const score = data?.score || 50;
  const bias = score > 60 ? "bullish" : score < 40 ? "bearish" : "neutral";
  
  return {
    bias,
    score,
    level: score > 80 ? "extreme-bullish" : 
           score > 60 ? "bullish" :
           score > 40 ? "neutral" :
           score > 20 ? "bearish" : "extreme-bearish"
  };
}

/**
 * 🔥 Analyze liquidation heatmap
 */
function analyzeLiquidationHeatmap(data: any): any {
  const heatmap = data?.heatmap || [];
  
  // Find clusters within 2% of current price
  const nearClusters = heatmap.filter((level: any) => 
    Math.abs(level.price_distance_pct || 0) < 2
  );
  
  const supportClusters = nearClusters.filter((l: any) => (l.price_distance_pct || 0) < 0);
  const resistanceClusters = nearClusters.filter((l: any) => (l.price_distance_pct || 0) > 0);
  
  const supportStrength = supportClusters.reduce((sum: number, l: any) => sum + (l.size_usd || 0), 0);
  const resistanceStrength = resistanceClusters.reduce((sum: number, l: any) => sum + (l.size_usd || 0), 0);
  
  const bias = supportStrength > resistanceStrength ? "bullish" : "bearish";
  
  return {
    bias,
    supportStrength,
    resistanceStrength,
    nearClusters: nearClusters.length,
    score: Math.min(100, (supportStrength - resistanceStrength) / 1_000_000 * 20)
  };
}

/**
 * 📈 Analyze orderbook structure
 */
function analyzeOrderbook(data: any): any {
  const orderbook = data?.orderbook || { bids: [], asks: [] };
  const bids = orderbook.bids || [];
  const asks = orderbook.asks || [];
  
  const topBids = bids.slice(0, 10);
  const topAsks = asks.slice(0, 10);
  
  const bidVolume = topBids.reduce((sum: number, bid: any) => sum + (bid[1] || 0), 0);
  const askVolume = topAsks.reduce((sum: number, ask: any) => sum + (ask[1] || 0), 0);
  
  const imbalance = bidVolume / (askVolume + bidVolume || 1);
  const bias = imbalance > 0.6 ? "bullish" : imbalance < 0.4 ? "bearish" : "neutral";
  
  return {
    bias,
    imbalance,
    bidVolume,
    askVolume,
    score: Math.abs(imbalance - 0.5) * 200 // Scale to 0-100
  };
}

/**
 * 🎯 Calculate overall institutional bias score
 */
function calculateInstitutionalBias(metrics: any): any {
  const weights = {
    whale: 0.35,    // 35% - Whale activity most important
    etf: 0.25,      // 25% - ETF flows strong institutional indicator  
    sentiment: 0.15, // 15% - Market sentiment
    liquidation: 0.15, // 15% - Liquidation levels
    orderbook: 0.10  // 10% - Current orderbook structure
  };
  
  // Convert bias to numeric scores
  const biasToScore = (bias: string) => 
    bias === "bullish" ? 1 : bias === "bearish" ? -1 : 0;
  
  const whaleScore = biasToScore(metrics.whale.bias) * metrics.whale.score / 100;
  const etfScore = biasToScore(metrics.etf.bias) * metrics.etf.score / 100;
  const sentimentScore = (metrics.sentiment.score - 50) / 50; // Normalize -1 to 1
  const liquidationScore = biasToScore(metrics.liquidation.bias) * Math.abs(metrics.liquidation.score) / 100;
  const orderbookScore = biasToScore(metrics.orderbook.bias) * metrics.orderbook.score / 100;
  
  const weightedScore = 
    whaleScore * weights.whale +
    etfScore * weights.etf +
    sentimentScore * weights.sentiment +
    liquidationScore * weights.liquidation +
    orderbookScore * weights.orderbook;
  
  const direction = weightedScore > 0.2 ? "LONG" : 
                   weightedScore < -0.2 ? "SHORT" : "NEUTRAL";
  
  const confidence = Math.min(100, Math.abs(weightedScore) * 100);
  const strength = confidence > 75 ? "HIGH" : 
                  confidence > 50 ? "MEDIUM" : "LOW";
  
  return {
    direction,
    confidence: Math.round(confidence),
    strength,
    rawScore: weightedScore,
    components: {
      whale: whaleScore * weights.whale,
      etf: etfScore * weights.etf,
      sentiment: sentimentScore * weights.sentiment,
      liquidation: liquidationScore * weights.liquidation,
      orderbook: orderbookScore * weights.orderbook
    }
  };
}

/**
 * 📝 Generate trading recommendation
 */
function generateTradingRecommendation(symbol: string, biasScore: any): any {
  const { direction, confidence, strength } = biasScore;
  
  if (direction === "NEUTRAL" || confidence < 30) {
    return {
      action: "WAIT",
      reason: "Insufficient institutional consensus",
      priority: "LOW",
      timeframe: "Monitor for clearer signals"
    };
  }
  
  const action = direction === "LONG" ? "BUY" : "SELL";
  const priority = strength === "HIGH" ? "HIGH" : 
                  strength === "MEDIUM" ? "MEDIUM" : "LOW";
  
  const timeframe = confidence > 75 ? "1-4 hours" :
                   confidence > 50 ? "4-12 hours" : "12-24 hours";
  
  const reason = generateReasonString(biasScore);
  
  return {
    action,
    direction,
    priority,
    timeframe,
    reason,
    confidence: `${confidence}%`
  };
}

function generateReasonString(biasScore: any): string {
  const components = biasScore.components;
  const reasons = [];
  
  if (Math.abs(components.whale) > 0.1) {
    reasons.push(`Whale activity: ${components.whale > 0 ? 'buying' : 'selling'} pressure`);
  }
  if (Math.abs(components.etf) > 0.05) {
    reasons.push(`ETF flows: ${components.etf > 0 ? 'inflows' : 'outflows'} detected`);
  }
  if (Math.abs(components.sentiment) > 0.1) {
    reasons.push(`Sentiment: ${components.sentiment > 0 ? 'bullish' : 'bearish'} trend`);
  }
  
  return reasons.join(', ') || 'Mixed signals';
}

/**
 * 🔄 Fetch with retry logic, timeout, and exponential backoff
 */
async function fetchWithRetry(url: string, options: any = {}, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeout);
      
      if (response.ok) {
        return await response.json();
      }
      
      if (i === retries - 1) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      clearTimeout(timeout);
      
      if (i === retries - 1) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }
}