// Enhanced Screener Service with Multi-Timeframe Analysis
import { ScreenerRequest, ScreenerResponse, ScreeningLayers } from "../../shared/schemas";
import { aggregateMTF, type MTFConfluenceResult } from "./scoring.mtf";
import { computeIndicators } from "./indicators";
import { computeProIndicators } from "./indicators.pro";
import { computeRisk } from "./risk";
import { composeTradableSignal, type TradableSignal } from "./trade.signal";
import { FeeProfiles } from "./fees";
import { recordSignal, recordExecution, recordOutcome } from "../perf/signalTracker";
import { recordScreeningMetrics, recordSignalMetrics } from "../observability";
import { cache as cacheCfg } from "./config";
import { logger } from "./logger";
import { okxService } from "../../../server/services/okx";

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

// Enhanced market data fetcher with real OKX integration
async function fetchMarketData(symbol: string, timeframe: string, limit: number) {
  try {
    logger.debug(`Fetching real market data for ${symbol}`, { timeframe, limit });
    
    // Convert symbol to OKX format (e.g., BTC -> BTC-USDT-SWAP)
    const okxSymbol = symbol.includes('-') ? symbol : `${symbol.toUpperCase()}-USDT-SWAP`;
    
    // Map timeframe to OKX format
    const timeframeMap: Record<string, string> = {
      '1m': '1m',
      '5m': '5m', 
      '15m': '15m',
      '30m': '30m',
      '1h': '1H',
      '4h': '4H',
      '1d': '1D',
      '1w': '1W'
    };
    
    const okxTimeframe = timeframeMap[timeframe] || '15m';
    
    // Fetch real candle data from OKX
    const candles = await okxService.getCandles(okxSymbol, okxTimeframe, limit);
    
    // Convert OKX candle format to expected format
    const formattedCandles = candles.map(candle => ({
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
      volume: parseFloat(candle.volume),
      timestamp: candle.timestamp
    }));
    
    // Fetch real derivatives data
    let derivatives;
    try {
      const [fundingData, ticker] = await Promise.allSettled([
        okxService.getFundingRate(okxSymbol),
        okxService.getTicker(okxSymbol)
      ]);
      
      derivatives = {
        oiChangePct: null, // OI change data would need separate API call
        fundingRate: fundingData.status === 'fulfilled' ? parseFloat(fundingData.value.fundingRate) : null,
        premium: ticker.status === 'fulfilled' ? calculatePremium(ticker.value) : null
      };
    } catch (derivError) {
      logger.warn(`Failed to fetch derivatives data for ${symbol}`, derivError);
      derivatives = {
        oiChangePct: null,
        fundingRate: null, 
        premium: null
      };
    }
    
    logger.debug(`Successfully fetched real data for ${symbol}`, { 
      candlesCount: formattedCandles.length,
      hasDerivatives: !!(derivatives.fundingRate || derivatives.oiChangePct)
    });
    
    return { candles: formattedCandles, derivatives };
  } catch (error: any) {
    logger.error(`Failed to fetch real market data for ${symbol}`, error);
    
    // Fallback: return empty data structure instead of throwing
    return {
      candles: [],
      derivatives: {
        oiChangePct: null,
        fundingRate: null,
        premium: null
      }
    };
  }
}

// Helper function to calculate premium from ticker data
function calculatePremium(ticker: any): number | null {
  try {
    // Premium calculation based on price vs mark price or other metrics
    // This is a simplified calculation - you might want to enhance this
    const price = parseFloat(ticker.price);
    const open24h = parseFloat(ticker.high24h) + parseFloat(ticker.low24h) / 2;
    return ((price - open24h) / open24h) * 100; // Premium as percentage
  } catch {
    return null;
  }
}

// Enhanced SMC computation (placeholder)
function computeSMC(candles: any[]) {
  try {
    // Add safety check for empty candles array
    if (!candles || candles.length === 0) {
      return {
        bias: "neutral" as const,
        strength: 0,
        confidence: 0.1,
        notes: "No candle data available"
      };
    }

    // Simple trend analysis based on recent price action
    const recentCandles = candles.slice(-20);
    const closes = recentCandles.map(c => c?.close).filter(c => c != null);
    const highs = recentCandles.map(c => c?.high).filter(h => h != null);
    const lows = recentCandles.map(c => c?.low).filter(l => l != null);
    
    // Safety check for empty filtered arrays
    if (closes.length === 0 || highs.length === 0 || lows.length === 0) {
      return {
        bias: "neutral" as const,
        strength: 0,
        confidence: 0.1,
        notes: "Insufficient valid candle data"
      };
    }
    
    // Calculate trend strength with safe array operations
    const priceChange = (closes[closes.length - 1] - closes[0]) / closes[0];
    const volatility = Math.max(...highs) - Math.min(...lows);
    const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;
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
            // Safe access to latest close price with fallback
            const latestClose = ltfCandles && ltfCandles.length > 0 
              ? ltfCandles[ltfCandles.length - 1]?.close || 200 // Default price if undefined
              : 200; // Default price if no candles
              
            const riskCalc = computeRisk(ltfCandles, proIndicators, {
              accountEquity: 10000, // Default portfolio size
              riskPerTradePct: 0.5,  // 0.5% risk per trade
              atrSLMult: 1.5,        // 1.5x ATR stop loss
              maxPositionPct: 10     // Max 10% position size
            }, latestClose, confluence.label === 'BUY');
            
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
            const signalResult = recordSignal({
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
            
            // Record signal metrics for observability
            try {
              recordSignalMetrics(symbol, confluence.label, confluence.confidence || 0);
            } catch (error: any) {
              logger.error('Failed to record signal metrics', { error: error?.message || 'Unknown error' });
            }
            
            // Record execution if tradable signal is valid
            if (signalResult.signalId && tradableSignal.meta.valid && tradableSignal.side !== 'none') {
              recordExecution(signalResult.signalId, {
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
                risk_amount: riskCalc.riskAmount,
                symbol: symbol
              }, signalResult.eventSignalId || undefined);
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
          } catch (error: any) {
            logger.error(`Failed to process ${symbol}`, error);
            // Return neutral result on failure
            return {
              symbol,
              score: 50,
              label: "HOLD" as const,
              riskLevel: "high" as const,
              confidence: 0,
              summary: `Processing failed: ${error?.message || 'Unknown error'}`,
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
        error: (error as any)?.message || 'Unknown error', 
        processingTime,
        symbolsRequested: request.symbols.length
      });
      
      throw new Error(`Screening failed after ${processingTime}ms: ${(error as any)?.message || 'Unknown error'}`);
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
    } catch (error: any) {
      logger.error('Health check failed', error);
      return {
        status: 'unhealthy',
        timestamp: Date.now(),
        error: error?.message || 'Unknown error'
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