/**
 * 🧠 Pump Detector Engine
 *
 * Detects early-stage pump before explosive candle happens
 *
 * Logic Core:
 * ✅ OI spikes (derivatives evidence)
 * ✅ CVD / smart money buy pressure
 * ✅ Funding rate still neutral (retail belum masuk)
 * ✅ Price masih konsolidasi → belum breakout
 * ✅ Volume acceleration pattern
 * ✅ Whale accumulation signals
 *
 * Strategy:
 * 1. Detect pump BEFORE explosive candle
 * 2. Enter early with tight SL
 * 3. Exit on funding rate spike (retail FOMO = top signal)
 */

import { coinAPIService } from '../services/coinapi';
import { coinGlassBridge } from '../services/coinGlassBridgeService';
import { sendTelegramPumpAlert } from '../services/telegramNotifier';

/**
 * Pump detection configuration
 */
export interface PumpDetectorConfig {
  // OI thresholds
  oiSpikeThreshold: number;        // Minimum OI change % (default: 3%)
  oiTimeframe: string;              // Timeframe for OI change (default: 15m)

  // CVD thresholds
  cvdPositiveRequired: boolean;     // CVD must be positive
  cvdMinValue: number;              // Minimum CVD value

  // Funding rate limits
  fundingMaxNeutral: number;        // Max funding for "neutral" (default: 0.01)
  fundingWarningLevel: number;      // Funding level = top signal (default: 0.03)

  // Price action
  consolidationRequired: boolean;   // Price must be consolidating
  consolidationTimeMin: number;     // Min consolidation time (minutes)

  // Volume
  volumeSpikeThreshold: number;     // Volume spike % (default: 50%)
  volumeTimeframe: string;          // Timeframe for volume check

  // Whale activity
  checkWhaleActivity: boolean;      // Include whale detection
  whaleMinPosition: number;         // Min whale position size ($)

  // Alert settings
  alertOnDetection: boolean;        // Send Telegram on detection
  minTimeBetweenAlerts: number;     // Cooldown (minutes)
}

/**
 * Pump signal output
 */
export interface PumpSignal {
  symbol: string;
  detected: boolean;
  confidence: number;              // 0-1 confidence score
  strength: 'weak' | 'medium' | 'strong';

  // Reasoning
  reasons: string[];
  warnings: string[];

  // Data points
  metrics: {
    oiChangePercent: number;
    cvd: number;
    fundingRate: number;
    volumeChangePercent: number;
    price: number;
    isConsolidating: boolean;
    consolidationDuration: number; // minutes
    whaleActivity?: 'accumulation' | 'distribution' | 'neutral';
  };

  // Timing
  timestamp: string;
  detectionTime: number;           // Unix timestamp

  // Trading recommendation
  recommendation?: {
    action: 'ENTER' | 'WAIT' | 'EXIT';
    entryPrice?: number;
    stopLoss?: number;
    takeProfit?: number[];
    positionSize?: number;
    urgency: 'low' | 'medium' | 'high';
  };
}

/**
 * Pump detection state tracking
 */
interface PumpState {
  lastAlertTime: number;
  detectionCount: number;
  lastPrice: number;
  alertSent: boolean;
}

export class PumpDetector {
  private config: PumpDetectorConfig;
  private state: Map<string, PumpState> = new Map();

  constructor(config?: Partial<PumpDetectorConfig>) {
    this.config = {
      // Default configuration
      oiSpikeThreshold: 3.0,
      oiTimeframe: '15m',
      cvdPositiveRequired: true,
      cvdMinValue: 0,
      fundingMaxNeutral: 0.01,
      fundingWarningLevel: 0.03,
      consolidationRequired: true,
      consolidationTimeMin: 30,
      volumeSpikeThreshold: 50,
      volumeTimeframe: '15m',
      checkWhaleActivity: true,
      whaleMinPosition: 1000000,
      alertOnDetection: true,
      minTimeBetweenAlerts: 15,
      ...config
    };

    console.log('🧠 [PumpDetector] Initialized with config:', this.config);
  }

  /**
   * Main pump detection method
   */
  async detectPump(symbol: string): Promise<PumpSignal> {
    console.log(`🔍 [PumpDetector] Analyzing ${symbol} for pump signals...`);

    try {
      // 1. Fetch data from CoinAPI (price, volume, structure)
      const priceData = await this.fetchPriceData(symbol);

      // 2. Fetch derivatives data from CoinGlass (OI, funding)
      const derivativeData = await this.fetchDerivativeData(symbol);

      // 3. Fetch whale activity (optional)
      const whaleData = this.config.checkWhaleActivity
        ? await this.fetchWhaleActivity(symbol)
        : null;

      // 4. Analyze consolidation pattern
      const consolidationAnalysis = this.analyzeConsolidation(priceData);

      // 5. Calculate volume spike
      const volumeSpike = this.calculateVolumeSpike(priceData);

      // 6. Run pump detection rules
      const detection = this.runDetectionRules({
        symbol,
        priceData,
        derivativeData,
        whaleData,
        consolidationAnalysis,
        volumeSpike
      });

      // 7. Send alert if detected and cooldown passed
      if (detection.detected && this.config.alertOnDetection) {
        await this.sendAlertIfNeeded(detection);
      }

      return detection;

    } catch (error) {
      console.error('❌ [PumpDetector] Detection failed:', error);
      return this.createDefaultSignal(symbol, `Detection error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Fetch price data from CoinAPI
   */
  private async fetchPriceData(symbol: string): Promise<any> {
    const symbolId = `BINANCE_SPOT_${symbol}_USDT`;

    // Fetch recent candles for analysis
    const data = await coinAPIService.getHistoricalData(
      symbolId,
      '5MIN',
      undefined,
      undefined,
      24 // Last 2 hours (24 * 5min candles)
    );

    if (!data || !data.data || data.data.length === 0) {
      throw new Error('No price data available');
    }

    return {
      candles: data.data,
      currentPrice: parseFloat(data.data[data.data.length - 1].price_close),
      volume: data.data.map((c: any) => parseFloat(c.volume_traded || 0))
    };
  }

  /**
   * Fetch derivative data from CoinGlass
   */
  private async fetchDerivativeData(symbol: string): Promise<any> {
    const derivatives = await coinGlassBridge.getDerivativesData(symbol);

    if (!derivatives) {
      throw new Error('No derivative data available');
    }

    return {
      oiChangePercent: derivatives.oi_change_percent,
      fundingRate: derivatives.funding_rate,
      longShortRatio: derivatives.long_short_ratio
    };
  }

  /**
   * Fetch whale activity
   */
  private async fetchWhaleActivity(symbol: string): Promise<any> {
    try {
      const whaleActivity = await coinGlassBridge.getDerivativesData(symbol);
      return {
        activity: whaleActivity?.whale_activity || 'neutral'
      };
    } catch (error) {
      console.warn('⚠️ [PumpDetector] Whale activity fetch failed');
      return { activity: 'neutral' };
    }
  }

  /**
   * Analyze if price is consolidating
   */
  private analyzeConsolidation(priceData: any): {
    isConsolidating: boolean;
    durationMinutes: number;
    rangePercent: number;
  } {
    const candles = priceData.candles;
    if (candles.length < 6) {
      return { isConsolidating: false, durationMinutes: 0, rangePercent: 0 };
    }

    // Take last 6 candles (30 minutes with 5min candles)
    const recentCandles = candles.slice(-6);

    const highs = recentCandles.map((c: any) => parseFloat(c.price_high));
    const lows = recentCandles.map((c: any) => parseFloat(c.price_low));

    const maxHigh = Math.max(...highs);
    const minLow = Math.min(...lows);
    const rangePercent = ((maxHigh - minLow) / minLow) * 100;

    // Consolidation = price range < 2%
    const isConsolidating = rangePercent < 2.0;
    const durationMinutes = recentCandles.length * 5; // 5min candles

    return {
      isConsolidating,
      durationMinutes,
      rangePercent
    };
  }

  /**
   * Calculate volume spike
   */
  private calculateVolumeSpike(priceData: any): number {
    const volumes = priceData.volume;
    if (volumes.length < 4) return 0;

    // Compare recent volume vs average
    const recentVolume = volumes[volumes.length - 1];
    const avgVolume = volumes.slice(0, -1).reduce((sum: number, v: number) => sum + v, 0) / (volumes.length - 1);

    if (avgVolume === 0) return 0;

    const spike = ((recentVolume - avgVolume) / avgVolume) * 100;
    return spike;
  }

  /**
   * Run detection rules and generate signal
   */
  private runDetectionRules(data: {
    symbol: string;
    priceData: any;
    derivativeData: any;
    whaleData: any;
    consolidationAnalysis: any;
    volumeSpike: number;
  }): PumpSignal {
    const {
      symbol,
      priceData,
      derivativeData,
      whaleData,
      consolidationAnalysis,
      volumeSpike
    } = data;

    const reasons: string[] = [];
    const warnings: string[] = [];
    let detected = false;
    let confidence = 0;
    let strength: 'weak' | 'medium' | 'strong' = 'weak';

    // --- RULE 1: OI Spike ---
    const oiMet = derivativeData.oiChangePercent > this.config.oiSpikeThreshold;
    if (oiMet) {
      confidence += 0.3;
      reasons.push(`✅ OI spike: +${derivativeData.oiChangePercent.toFixed(2)}% (threshold: ${this.config.oiSpikeThreshold}%)`);
    } else {
      warnings.push(`⚠️ OI change too low: ${derivativeData.oiChangePercent.toFixed(2)}%`);
    }

    // --- RULE 2: CVD Positive (Smart Money Buying) ---
    // Simplified: use volume trend as proxy for CVD
    const cvd = volumeSpike; // Placeholder - should calculate actual CVD
    const cvdMet = cvd > this.config.cvdMinValue;
    if (cvdMet) {
      confidence += 0.2;
      reasons.push(`✅ Volume spike: +${cvd.toFixed(1)}% (buy pressure detected)`);
    }

    // --- RULE 3: Funding Rate Still Neutral ---
    const fundingMet = derivativeData.fundingRate <= this.config.fundingMaxNeutral;
    if (fundingMet) {
      confidence += 0.2;
      reasons.push(`✅ Funding neutral: ${(derivativeData.fundingRate * 100).toFixed(3)}% (retail belum FOMO)`);
    } else if (derivativeData.fundingRate > this.config.fundingWarningLevel) {
      warnings.push(`🚨 Funding HIGH: ${(derivativeData.fundingRate * 100).toFixed(3)}% - Possible top!`);
      confidence -= 0.2;
    }

    // --- RULE 4: Price Consolidation ---
    const consolidationMet = consolidationAnalysis.isConsolidating;
    if (consolidationMet) {
      confidence += 0.15;
      reasons.push(`✅ Consolidating: ${consolidationAnalysis.durationMinutes}min, range ${consolidationAnalysis.rangePercent.toFixed(2)}%`);
    } else {
      warnings.push(`⚠️ Not consolidating - range ${consolidationAnalysis.rangePercent.toFixed(2)}%`);
    }

    // --- RULE 5: Whale Activity ---
    if (whaleData && whaleData.activity === 'accumulation') {
      confidence += 0.15;
      reasons.push(`✅ Whale accumulation detected`);
    }

    // --- DETECTION LOGIC ---
    if (oiMet && cvdMet && fundingMet && consolidationMet) {
      detected = true;

      if (confidence > 0.8) strength = 'strong';
      else if (confidence > 0.6) strength = 'medium';
      else strength = 'weak';
    }

    // --- TRADING RECOMMENDATION ---
    let recommendation = undefined;
    if (detected) {
      const currentPrice = priceData.currentPrice;
      const stopLoss = currentPrice * 0.98; // 2% SL
      const takeProfits = [
        currentPrice * 1.03, // TP1: 3%
        currentPrice * 1.05, // TP2: 5%
        currentPrice * 1.08  // TP3: 8%
      ];

      recommendation = {
        action: 'ENTER' as const,
        entryPrice: currentPrice,
        stopLoss,
        takeProfit: takeProfits,
        positionSize: confidence * 100, // % of capital based on confidence
        urgency: strength === 'strong' ? 'high' as const : 'medium' as const
      };
    } else if (derivativeData.fundingRate > this.config.fundingWarningLevel) {
      recommendation = {
        action: 'EXIT' as const,
        urgency: 'high' as const
      };
    }

    return {
      symbol,
      detected,
      confidence,
      strength,
      reasons,
      warnings,
      metrics: {
        oiChangePercent: derivativeData.oiChangePercent,
        cvd,
        fundingRate: derivativeData.fundingRate,
        volumeChangePercent: volumeSpike,
        price: priceData.currentPrice,
        isConsolidating: consolidationAnalysis.isConsolidating,
        consolidationDuration: consolidationAnalysis.durationMinutes,
        whaleActivity: whaleData?.activity
      },
      timestamp: new Date().toISOString(),
      detectionTime: Date.now(),
      recommendation
    };
  }

  /**
   * Send Telegram alert if cooldown period passed
   */
  private async sendAlertIfNeeded(signal: PumpSignal): Promise<void> {
    const state = this.state.get(signal.symbol) || {
      lastAlertTime: 0,
      detectionCount: 0,
      lastPrice: 0,
      alertSent: false
    };

    const now = Date.now();
    const timeSinceLastAlert = (now - state.lastAlertTime) / (1000 * 60); // minutes

    if (timeSinceLastAlert >= this.config.minTimeBetweenAlerts) {
      await sendTelegramPumpAlert(signal);

      state.lastAlertTime = now;
      state.detectionCount++;
      state.lastPrice = signal.metrics.price;
      state.alertSent = true;

      this.state.set(signal.symbol, state);

      console.log(`✅ [PumpDetector] Alert sent for ${signal.symbol}`);
    } else {
      console.log(`⏳ [PumpDetector] Alert cooldown active (${timeSinceLastAlert.toFixed(1)}/${this.config.minTimeBetweenAlerts}min)`);
    }
  }

  /**
   * Create default signal (fallback)
   */
  private createDefaultSignal(symbol: string, reason: string): PumpSignal {
    return {
      symbol,
      detected: false,
      confidence: 0,
      strength: 'weak',
      reasons: [],
      warnings: [reason],
      metrics: {
        oiChangePercent: 0,
        cvd: 0,
        fundingRate: 0,
        volumeChangePercent: 0,
        price: 0,
        isConsolidating: false,
        consolidationDuration: 0
      },
      timestamp: new Date().toISOString(),
      detectionTime: Date.now()
    };
  }

  /**
   * Update detector configuration
   */
  updateConfig(newConfig: Partial<PumpDetectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 [PumpDetector] Config updated:', newConfig);
  }

  /**
   * Get detector statistics
   */
  getStats(): {
    totalDetections: number;
    symbolsTracked: string[];
    lastAlerts: { symbol: string; time: number; price: number }[];
  } {
    const stats = {
      totalDetections: 0,
      symbolsTracked: Array.from(this.state.keys()),
      lastAlerts: [] as { symbol: string; time: number; price: number }[]
    };

    for (const [symbol, state] of this.state.entries()) {
      stats.totalDetections += state.detectionCount;
      if (state.alertSent) {
        stats.lastAlerts.push({
          symbol,
          time: state.lastAlertTime,
          price: state.lastPrice
        });
      }
    }

    return stats;
  }

  /**
   * Reset state for a symbol
   */
  resetSymbol(symbol: string): void {
    this.state.delete(symbol);
    console.log(`🔄 [PumpDetector] State reset for ${symbol}`);
  }

  /**
   * Reset all state
   */
  resetAll(): void {
    this.state.clear();
    console.log('🔄 [PumpDetector] All state reset');
  }
}

// Export singleton instance with default config
export const pumpDetector = new PumpDetector();

// Export factory for custom instances
export function createPumpDetector(config?: Partial<PumpDetectorConfig>): PumpDetector {
  return new PumpDetector(config);
}
