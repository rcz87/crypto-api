// Enhanced Screener Service with Multi-Timeframe Analysis
import { ScreenerRequest, ScreenerResponse, ScreeningLayers } from "../../shared/schemas";
import { aggregateMTF, type MTFConfluenceResult } from "./scoring.mtf";
import { computeIndicators } from "./indicators";
import { computeProIndicators } from "./indicators.pro";
import { computeRisk } from "./risk";
import { composeTradableSignal, type TradableSignal } from "./trade.signal";
import { FeeProfiles } from "./fees";
import { recordSignal, recordExecution, recordOutcome } from "../perf/signalTracker";
import { cache as cacheCfg } from "./config";
import { logger } from "./logger";

// In-memory cache (production should use Redis)
const memCache = new Map<string, { data: any; expireAt: number }>();

function cacheGet(key: string) {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expireAt) { 
    memCache.delete(key); 
    return null; 
  }
  return hit.data;
}

function cacheSet(key: string, data: any, ttlSec: number) {
  memCache.set(key, { 
    data, 
    expireAt: Date.now() + ttlSec * 1000 
  });
}

// Enhanced market data fetcher (placeholder - integrate with OKX)
async function fetchMarketData(symbol: string, timeframe: string, limit: number) {
  try {
    logger.debug(`Fetching market data for ${symbol}`, { timeframe, limit });
    
    // TODO: Replace with actual OKX integration
    // For now, generate realistic mock data with trend simulation
    const trend = Math.sin(Date.now() / 1000000) * 0.1; // Slow trend component
    const candles = Array.from({ length: limit }, (_, i) => {
      const basePrice = 200 + trend * i * 0.1 + Math.sin(i / 10) * 5;
      const volatility = 0.02;
      const random = () => (Math.random() - 0.5) * volatility;
      
      return {
        open: basePrice + random() * basePrice,
        high: basePrice + Math.abs(random()) * basePrice + 2,
        low: basePrice - Math.abs(random()) * basePrice - 2,
        close: basePrice + random() * basePrice,
        volume: 1000 + Math.random() * 500
      };
    });
    
    // Mock derivatives data
    const derivatives = { 
      oiChangePct: (Math.random() - 0.5) * 4, // -2% to +2%
      fundingRate: (Math.random() - 0.5) * 0.002, // -0.1% to +0.1%
      premium: (Math.random() - 0.5) * 0.004 // -0.2% to +0.2%
    };
    
    return { candles, derivatives };
  } catch (error) {
    logger.error(`Failed to fetch market data for ${symbol}`, error);
    throw new Error(`Market data fetch failed: ${error.message}`);
  }
}

// Enhanced SMC computation (placeholder)
function computeSMC(candles: any[]) {
  try {
    // Simple trend analysis based on recent price action
    const recentCandles = candles.slice(-20);
    const closes = recentCandles.map(c => c.close);
    const highs = recentCandles.map(c => c.high);
    const lows = recentCandles.map(c => c.low);
    
    // Calculate trend strength
    const priceChange = (closes[closes.length - 1] - closes[0]) / closes[0];
    const volatility = Math.max(...highs) - Math.min(...lows);
    const avgClose = closes.reduce((a, b) => a + b) / closes.length;
    const normalizedVolatility = volatility / avgClose;
    
    let bias: "bullish" | "bearish" | "neutral" = "neutral";
    let strength = 0;
    let confidence = 0.5;
    
    if (priceChange > 0.02 && normalizedVolatility < 0.1) {
      bias = "bullish";
      strength = Math.min(8, Math.abs(priceChange) * 100);
      confidence = Math.min(0.9, 0.5 + Math.abs(priceChange) * 10);
    } else if (priceChange < -0.02 && normalizedVolatility < 0.1) {
      bias = "bearish";  
      strength = Math.min(8, Math.abs(priceChange) * 100);
      confidence = Math.min(0.9, 0.5 + Math.abs(priceChange) * 10);
    } else {
      strength = Math.min(3, normalizedVolatility * 50);
      confidence = Math.max(0.1, 0.5 - normalizedVolatility * 2);
    }
    
    return { 
      bias, 
      strength: Math.round(strength), 
      confidence: Math.round(confidence * 100) / 100,
      notes: `Trend analysis based on ${recentCandles.length} candles`
    };
  } catch (error) {
    logger.error('SMC computation failed', error);
    return { 
      bias: "neutral" as const, 
      strength: 0, 
      confidence: 0.1,
      notes: "SMC analysis failed"
    };
  }
}

export class ScreenerService {
  async run(request: ScreenerRequest): Promise<ScreenerResponse> {
    const startTime = Date.now();
    logger.info('Starting screening run', { 
      symbols: request.symbols.length, 
      timeframe: request.timeframe,
      limit: request.limit 
    });

    try {
      const { symbols, timeframe, limit } = request;
      const results: ScreenerResponse["results"] = [];

      // Process symbols in batches for better performance
      const batchSize = 5;
      const batches = [];
      for (let i = 0; i < symbols.length; i += batchSize) {
        batches.push(symbols.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        const batchPromises = batch.map(async (symbol) => {
          try {
            const cacheKey = `${symbol}:${timeframe}:${limit}`;
            
            // Check cache first
            if (cacheCfg.enabled) {
              const cached = cacheGet(cacheKey);
              if (cached) {
                logger.debug(`Cache hit for ${symbol}`);
                return cached;
              }
            }

            // Fetch multi-timeframe data
            const ltfCandles = await fetchMarketData(symbol, timeframe, limit).then(d => d.candles);
            const h1Candles = await fetchMarketData(symbol, '1h', 300).then(d => d.candles);
            const h4Candles = await fetchMarketData(symbol, '4h', 300).then(d => d.candles);
            const derivatives = await fetchMarketData(symbol, timeframe, limit).then(d => d.derivatives);
            
            const smc = computeSMC(ltfCandles);
            const indicators = computeIndicators(ltfCandles);
            
            // Build layers
            const layers: ScreeningLayers = {
              smc,
              indicators,
              derivatives
            };
            
            // Calculate MTF confluence with HTF bias modulation
            const confluence = aggregateMTF(layers, ltfCandles, h1Candles, h4Candles);
            
            // Calculate professional risk metrics
            const proIndicators = computeProIndicators(ltfCandles);
            const riskCalc = computeRisk(ltfCandles, proIndicators, {
              accountEquity: 10000, // Default portfolio size
              riskPerTradePct: 0.5,  // 0.5% risk per trade
              atrSLMult: 1.5,        // 1.5x ATR stop loss
              maxPositionPct: 10     // Max 10% position size
            }, ltfCandles[ltfCandles.length - 1].close, confluence.label === 'BUY');
            
            // Generate tradable signal with professional risk management
            const tradableSignal = composeTradableSignal(
              {
                symbol,
                label: confluence.label,
                score: confluence.normalizedScore,
                summary: confluence.summary,
                confidence: confluence.confidence,
                riskLevel: confluence.riskLevel,
                layers: confluence.layers,
                regime: confluence.regime,
                htf: confluence.htf,
                mtf: confluence.mtf
              },
              ltfCandles,
              {
                accountEquity: 10000,    // Default portfolio
                riskPerTradePct: 0.5,    // 0.5% risk per trade
                atrSLMult: 1.5,          // 1.5x ATR stops
                tp1RR: 1.5,              // 1.5:1 first target
                tp2RR: 2.5,              // 2.5:1 second target
                capPositionPct: 15       // Max 15% position size
              },
              {
                minNotional: 5,          // $5 minimum
                minQty: 0.001,           // Min quantity
                qtyStep: 0.001,          // Quantity step
                priceStep: 0.01,         // Price tick
                takerFeeRate: 0.0005,    // OKX default fee
                slippageBps: 8,          // 0.8 bps slippage
                spreadBps: 5             // 0.5 bps spread
              }
            );
            
            // Track signal for performance analysis
            const signalId = recordSignal({
              ts: Date.now(),
              symbol,
              label: confluence.label,
              score: confluence.normalizedScore,
              confidence: confluence.confidence,
              timeframe,
              regime: confluence.regime,
              htf_bias: confluence.htf?.combined?.bias,
              mtf_aligned: confluence.mtf?.agree,
              summary: confluence.summary
            });
            
            // Record execution if tradable signal is valid
            if (signalId && tradableSignal.meta.valid && tradableSignal.side !== 'none') {
              recordExecution(signalId, {
                side: tradableSignal.side,
                entry: tradableSignal.entry!,
                sl: tradableSignal.sl,
                tp1: tradableSignal.tp1,
                tp2: tradableSignal.tp2,
                qty: tradableSignal.qty,
                notional: tradableSignal.notional,
                fees: tradableSignal.costs.fees,
                slip: tradableSignal.costs.slip,
                spread: tradableSignal.costs.spread,
                risk_amount: riskCalc.riskAmount
              });
            }
            
            const result = {
              symbol,
              score: confluence.normalizedScore,
              label: confluence.label,
              riskLevel: confluence.riskLevel,
              confidence: confluence.confidence,
              summary: confluence.summary,
              layers,
              // Enhanced PRO PACK + MTF features
              regime: confluence.regime,
              regimeReason: confluence.regimeReason,
              dynamicThresholds: confluence.dynamicThresholds,
              regimeAdjustment: confluence.regimeAdjustment,
              proIndicators: confluence.proIndicators,
              // MTF Analysis
              htf: confluence.htf,
              mtf: confluence.mtf,
              risk: {
                positionSize: riskCalc.positionSize,
                stopLoss: riskCalc.stopLoss,
                riskAmount: riskCalc.riskAmount,
                riskRewardRatio: riskCalc.riskRewardRatio
              },
              // Enhanced Tradable Signal
              tradableSignal: {
                side: tradableSignal.side,
                entry: tradableSignal.entry,
                sl: tradableSignal.sl,
                tp1: tradableSignal.tp1,
                tp2: tradableSignal.tp2,
                qty: tradableSignal.qty,
                notional: tradableSignal.notional,
                rr1: tradableSignal.rr1,
                rr2: tradableSignal.rr2,
                costs: tradableSignal.costs,
                valid: tradableSignal.meta.valid,
                violations: tradableSignal.meta.violations,
                priority: tradableSignal.timing.priority,
                expiry: tradableSignal.timing.expiry
              }
            };

            // Cache result
            if (cacheCfg.enabled) {
              cacheSet(cacheKey, result, cacheCfg.ttlSeconds);
            }

            logger.debug(`Processed ${symbol}`, { 
              score: result.score, 
              label: result.label 
            });

            return result;
          } catch (error) {
            logger.error(`Failed to process ${symbol}`, error);
            // Return neutral result on failure
            return {
              symbol,
              score: 50,
              label: "HOLD" as const,
              riskLevel: "high" as const,
              confidence: 0,
              summary: `Processing failed: ${error.message}`,
              layers: {
                smc: { bias: "neutral" as const, strength: 0, confidence: 0.1 },
                indicators: { rsi: null, emaTrend: "neutral" as const },
                derivatives: { oiChangePct: null, fundingRate: null }
              }
            };
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }

      // Generate statistics
      const processingTime = Date.now() - startTime;
      const buySignals = results.filter(r => r.label === 'BUY').length;
      const sellSignals = results.filter(r => r.label === 'SELL').length;
      const holdSignals = results.filter(r => r.label === 'HOLD').length;
      const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
      
      const topPicks = results
        .filter(r => r.label === 'BUY')
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(r => ({
          symbol: r.symbol,
          score: r.score,
          label: r.label
        }));

      const response: ScreenerResponse = {
        timestamp: Date.now(),
        processingTime,
        results: results.sort((a, b) => {
          // Sort by label priority (BUY > SELL > HOLD) then by score
          const labelPriority = { BUY: 3, SELL: 2, HOLD: 1 };
          if (labelPriority[a.label] !== labelPriority[b.label]) {
            return labelPriority[b.label] - labelPriority[a.label];
          }
          return b.score - a.score;
        }),
        stats: {
          totalSymbols: results.length,
          buySignals,
          sellSignals,
          holdSignals,
          avgScore: Math.round(avgScore * 100) / 100,
          topPicks
        }
      };

      logger.info('Screening completed successfully', {
        symbols: results.length,
        processingTime,
        buySignals,
        sellSignals,
        holdSignals
      });

      return response;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Screening run failed', { 
        error: error.message, 
        processingTime,
        symbolsRequested: request.symbols.length
      });
      
      throw new Error(`Screening failed after ${processingTime}ms: ${error.message}`);
    }
  }

  // Health check method
  async healthCheck() {
    try {
      // Test basic functionality
      const testResult = await this.run({
        symbols: ['TEST'],
        timeframe: '15m',
        limit: 100
      });
      
      return {
        status: 'healthy',
        timestamp: Date.now(),
        cache: {
          enabled: cacheCfg.enabled,
          entries: memCache.size
        },
        testProcessingTime: testResult.processingTime
      };
    } catch (error) {
      logger.error('Health check failed', error);
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        error: error.message
      };
    }
  }

  // Clear cache method
  clearCache() {
    const entriesCleared = memCache.size;
    memCache.clear();
    logger.info(`Cache cleared: ${entriesCleared} entries removed`);
    return { entriesCleared };
  }
}