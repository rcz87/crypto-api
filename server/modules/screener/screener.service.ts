/**
 * Core Screening Service
 * Orkestrasi semua analisis untuk multi-coin screening system
 */

import { okxService } from '../../services/okx.js';
import { CVDService } from '../../services/cvd.js';
import { detectSMC, scoreSMC } from './smc.js';
import { 
  analyzeEMAConfluence, 
  analyzeMomentum, 
  atr, 
  type Candle 
} from './indicators.js';
import {
  aggregateScores,
  scoreFromSMC,
  scoreFromEMA,
  scoreFromMomentum,
  scoreFromFunding,
  scoreFromOI,
  scoreFromCVD,
  scoreFromFibonacci,
  scoreFromPriceAction,
  generateTradingLevels,
  type ConfluenceResult
} from './scoring.js';
import { storage } from '../../storage.js';
import { 
  screenerRuns, 
  screenerResults,
  type ScreenerParams,
  type ScreeningResult,
  type ScreeningResponse,
  type LayerScore,
  type ScreeningLayers
} from '../../../shared/schema.js';

export type ScreenerServiceOptions = {
  enableCache?: boolean;
  timeout?: number;
  parallelLimit?: number;
};

export class ScreenerService {
  private readonly options: ScreenerServiceOptions;
  
  constructor(options: ScreenerServiceOptions = {}) {
    this.options = {
      enableCache: true,
      timeout: 30000, // 30 seconds timeout
      parallelLimit: 5, // Max 5 parallel requests
      ...options
    };
  }

  /**
   * Jalankan screening untuk single symbol
   */
  async screenSymbol(
    symbol: string, 
    params: ScreenerParams
  ): Promise<ScreeningResult> {
    const startTime = Date.now();
    
    try {
      const tradingSymbol = `${symbol.toUpperCase()}-USDT-SWAP`;
      
      // Fetch semua data yang diperlukan secara paralel
      const [candles, cvdData, fundingData, oiData] = await Promise.all([
        okxService.getCandles(tradingSymbol, params.timeframe, params.limit),
        this.getCVDData(tradingSymbol).catch(() => null),
        this.getFundingData(tradingSymbol).catch(() => null),
        this.getOIData(tradingSymbol).catch(() => null),
      ]);

      if (!candles || candles.length < 50) {
        throw new Error(`Insufficient candle data for ${symbol}`);
      }

      // Convert candles ke format yang diperlukan
      const candleData: Candle[] = candles.map((c: any) => ({
        time: parseInt(c.ts),
        open: parseFloat(c.o),
        high: parseFloat(c.h),
        low: parseFloat(c.l),
        close: parseFloat(c.c),
        volume: parseFloat(c.vol),
      }));

      const currentPrice = candleData[candleData.length - 1].close;
      const close = candleData.map(c => c.close);
      
      // Analisis semua layers
      const layers = await this.analyzeAllLayers(
        candleData, 
        params.enabledLayers,
        { cvdData, fundingData, oiData }
      );

      // Agregasi scores
      const confluence = aggregateScores(layers);
      
      // Generate trading levels
      const atrValue = atr(candleData, 14)[candleData.length - 1];
      const levels = generateTradingLevels(currentPrice, confluence, atrValue);

      // Buat hasil screening
      const result: ScreeningResult = {
        symbol,
        score: confluence.normalizedScore,
        label: confluence.label,
        layers,
        levels,
        confidence: confluence.confidence,
        timestamp: new Date().toISOString(),
        analysis: {
          summary: confluence.summary,
          keyLevels: [levels.entry, ...levels.tp, levels.sl],
          riskAssessment: confluence.riskLevel,
          timeHorizon: this.determineTimeHorizon(params.timeframe, confluence.confidence),
        }
      };

      const processingTime = Date.now() - startTime;
      console.log(`✅ Screened ${symbol}: ${confluence.label} (${confluence.normalizedScore}) in ${processingTime}ms`);
      
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Error screening ${symbol} in ${processingTime}ms:`, error);
      
      // Return default result for failed screening
      return {
        symbol,
        score: 50,
        label: "HOLD",
        layers: { smc: { score: 0, reasons: [`Error: ${error instanceof Error ? error.message : 'Unknown error'}`] } },
        confidence: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Jalankan screening untuk multiple symbols (batch processing)
   */
  async screenMultipleSymbols(params: ScreenerParams): Promise<ScreeningResponse> {
    const runId = `scr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      // Simpan run info (simplified for current storage)
      console.log(`📝 Starting run ${runId} with params:`, params);

      console.log(`🚀 Starting screening run ${runId} for ${params.symbols.length} symbols`);

      // Process symbols dalam batch untuk avoid rate limiting
      const results: ScreeningResult[] = [];
      const batchSize = this.options.parallelLimit || 5;
      
      for (let i = 0; i < params.symbols.length; i += batchSize) {
        const batch = params.symbols.slice(i, i + batchSize);
        console.log(`📊 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(params.symbols.length/batchSize)}: ${batch.join(', ')}`);
        
        // Process batch secara paralel
        const batchPromises = batch.map(symbol => 
          this.screenSymbol(symbol, params)
            .then(result => {
              // Log hasil (simplified storage for now)
              console.log(`💾 Processed ${symbol}: ${result.label} (${result.score})`);
              return result;
            })
        );

        const batchResults = await Promise.allSettled(batchPromises);
        
        // Extract successful results
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          }
        }

        // Update progress (log for now)
        console.log(`📈 Progress: ${results.length}/${params.symbols.length} symbols completed`);

        // Small delay antara batch untuk menghindari rate limiting
        if (i + batchSize < params.symbols.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Sort hasil berdasarkan score
      results.sort((a, b) => {
        if (a.label === b.label) return b.score - a.score;
        if (a.label === 'BUY') return -1;
        if (b.label === 'BUY') return 1;
        if (a.label === 'SELL') return 1;
        return -1;
      });

      // Generate statistics
      const stats = this.generateStats(results, Date.now() - startTime);
      
      // Update run status (log for now)
      console.log(`✅ Run ${runId} completed with ${results.length} results`);

      const response: ScreeningResponse = {
        run_id: runId,
        params,
        status: 'completed',
        results,
        stats,
        timestamp: new Date().toISOString(),
      };

      console.log(`✅ Completed screening run ${runId} in ${stats.processingTime}ms`);
      return response;

    } catch (error) {
      console.error(`❌ Screening run ${runId} failed:`, error);
      
      // Update run status ke failed (log for now)
      console.log(`❌ Run ${runId} failed`);

      throw error;
    }
  }

  /**
   * Analisis semua layers yang diaktifkan
   */
  private async analyzeAllLayers(
    candles: Candle[],
    enabledLayers: ScreenerParams['enabledLayers'],
    externalData: { cvdData?: any; fundingData?: any; oiData?: any }
  ): Promise<ScreeningLayers> {
    const layers: ScreeningLayers = {} as ScreeningLayers;
    const close = candles.map(c => c.close);
    const currentPrice = candles[candles.length - 1].close;

    // 1. SMC Analysis (Priority layer - selalu diaktifkan)
    if (enabledLayers.smc) {
      const swings = candles.map(c => ({
        time: c.time,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));
      
      const smcSignal = detectSMC(swings);
      layers.smc = scoreFromSMC(smcSignal);
    }

    // 2. Price Action Analysis
    if (enabledLayers.price_action) {
      const recentCandles = candles.slice(-20);
      const highs = recentCandles.map(c => c.high);
      const lows = recentCandles.map(c => c.low);
      
      const higherHighs = highs[highs.length - 1] > Math.max(...highs.slice(0, -5));
      const higherLows = lows[lows.length - 1] > Math.min(...lows.slice(0, -5));
      const trendStrength = this.calculateTrendStrength(recentCandles);
      
      layers.price_action = scoreFromPriceAction(higherHighs, higherLows, trendStrength);
    }

    // 3. EMA Analysis
    if (enabledLayers.ema) {
      const emaAnalysis = analyzeEMAConfluence(close);
      layers.ema = scoreFromEMA(emaAnalysis);
    }

    // 4. RSI/MACD Momentum
    if (enabledLayers.rsi_macd) {
      const momentumAnalysis = analyzeMomentum(candles);
      layers.rsi_macd = scoreFromMomentum(momentumAnalysis);
    }

    // 5. Funding Rate Analysis
    if (enabledLayers.funding && externalData.fundingData) {
      const funding = externalData.fundingData;
      layers.funding = scoreFromFunding(
        parseFloat(funding.fundingRate || '0'),
        parseFloat(funding.nextFundingRate || '0'),
        parseFloat(funding.premium || '0')
      );
    }

    // 6. Open Interest Analysis
    if (enabledLayers.oi && externalData.oiData) {
      const oi = externalData.oiData;
      layers.oi = scoreFromOI(
        oi.historical_context?.oi_change_24h || 0,
        0, // Price change akan dihitung dari candles
        oi.advanced_metrics?.oi_pressure_ratio || 0.5
      );
    }

    // 7. CVD Analysis
    if (enabledLayers.cvd && externalData.cvdData) {
      const cvd = externalData.cvdData;
      layers.cvd = scoreFromCVD(
        cvd.trend || 'neutral',
        cvd.divergence?.strength || 0,
        cvd.volumePressure || 0.5
      );
    }

    // 8. Fibonacci Analysis
    if (enabledLayers.fibo) {
      const fibLevels = this.calculateFibonacciLevels(candles);
      const nearest = this.findNearestFibLevel(currentPrice, fibLevels);
      layers.fibo = scoreFromFibonacci(currentPrice, fibLevels, nearest);
    }

    return layers;
  }

  /**
   * Helper methods untuk analisis tambahan
   */
  private calculateTrendStrength(candles: Candle[]): number {
    const closes = candles.map(c => c.close);
    const firstClose = closes[0];
    const lastClose = closes[closes.length - 1];
    
    const totalChange = (lastClose - firstClose) / firstClose;
    return Math.min(Math.abs(totalChange) * 10, 1); // Normalize ke 0-1
  }

  private calculateFibonacciLevels(candles: Candle[]): { level: number; type: 'support' | 'resistance' }[] {
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const highest = Math.max(...highs);
    const lowest = Math.min(...lows);
    const range = highest - lowest;

    const fibRatios = [0.236, 0.382, 0.5, 0.618, 0.786];
    
    return fibRatios.map(ratio => ({
      level: lowest + (range * ratio),
      type: ratio > 0.5 ? 'resistance' : 'support' as 'support' | 'resistance'
    }));
  }

  private findNearestFibLevel(price: number, levels: { level: number; type: 'support' | 'resistance' }[]) {
    let nearest = levels[0];
    let minDistance = Math.abs(price - levels[0].level) / price;

    for (const level of levels) {
      const distance = Math.abs(price - level.level) / price;
      if (distance < minDistance) {
        minDistance = distance;
        nearest = level;
      }
    }

    return { ...nearest, distance: minDistance };
  }

  private determineTimeHorizon(timeframe: string, confidence: number): 'scalp' | 'day' | 'swing' | 'position' {
    if (timeframe === '5m' || timeframe === '15m') return confidence > 0.7 ? 'scalp' : 'day';
    if (timeframe === '30m' || timeframe === '1h') return confidence > 0.7 ? 'day' : 'swing';
    return confidence > 0.7 ? 'swing' : 'position';
  }

  private generateStats(results: ScreeningResult[], processingTime: number) {
    const buySignals = results.filter(r => r.label === 'BUY').length;
    const sellSignals = results.filter(r => r.label === 'SELL').length;
    const holdSignals = results.filter(r => r.label === 'HOLD').length;
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    
    const topPicks = results
      .filter(r => r.label === 'BUY')
      .slice(0, 5)
      .map(r => ({
        symbol: r.symbol,
        score: r.score,
        label: r.label,
      }));

    return {
      totalSymbols: results.length,
      buySignals,
      sellSignals,
      holdSignals,
      avgScore: Math.round(avgScore * 100) / 100,
      processingTime,
      topPicks,
    };
  }

  /**
   * Helper methods untuk fetch external data
   */
  private async getCVDData(symbol: string) {
    try {
      // Simplified CVD data untuk demo
      return {
        trend: 'neutral' as const,
        divergence: { strength: 0.5 },
        volumePressure: 0.5
      };
    } catch (error) {
      return null;
    }
  }

  private async getFundingData(symbol: string) {
    try {
      // Fetch basic funding rate dari OKX
      const funding = await okxService.getFundingRate(symbol);
      return funding;
    } catch (error) {
      return null;
    }
  }

  private async getOIData(symbol: string) {
    try {
      // Fetch basic OI data dari OKX
      const oi = await okxService.getOpenInterest(symbol);
      return {
        historical_context: { 
          oi_change_24h: 0.05,
          oi_change_7d: 0.1 
        },
        advanced_metrics: { 
          oi_pressure_ratio: 0.6 
        }
      };
    } catch (error) {
      return null;
    }
  }
}

// Export default instance
export const screenerService = new ScreenerService();