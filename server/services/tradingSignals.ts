import { SMCService } from './smc.js';
import { CVDService } from './cvd.js';
import { TechnicalIndicatorsService } from './technicalIndicators.js';
import { FibonacciService } from './fibonacci.js';
import { ConfluenceService } from './confluence.js';
import { okxService } from './okx.js';

export interface TradingSignal {
  signal: 'BUY' | 'SELL' | 'HOLD';
  strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
  confidence: number; // 0-100
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  riskReward: number;
  timeframe: string;
  timestamp: string;
  reasons: string[];
  explanations?: string[]; // Enhanced: Explanatory reasoning for unclear signals
  technicalAnalysis: {
    rsi: number;
    emaSignal: 'bullish' | 'bearish' | 'neutral';
    macdSignal: 'bullish' | 'bearish' | 'neutral';
    volumeConfirmation: boolean;
  };
  smartMoney: {
    bosSignal: 'bullish' | 'bearish' | 'neutral';
    liquidityGrab: boolean;
    institutionalFlow: 'buying' | 'selling' | 'neutral';
  };
  priceAction: {
    keyLevel: number;
    levelType: 'support' | 'resistance' | 'fib_level';
    distanceToLevel: number;
  };
  alerts: {
    urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    message: string;
  };
}

export interface LiveMarketConditions {
  price: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  volatility: 'low' | 'medium' | 'high' | 'extreme';
  volume: 'low' | 'normal' | 'high' | 'exceptional';
  marketStructure: 'uptrend' | 'downtrend' | 'ranging' | 'breakout';
}

class TradingSignalsService {
  private lastSignal: TradingSignal | null = null;
  private signalHistory: TradingSignal[] = [];
  private maxHistoryLength = 50;

  async generateLiveSignals(timeframe: string = '15m'): Promise<{
    primary: TradingSignal;
    secondary: TradingSignal;
    marketConditions: LiveMarketConditions;
    multiTimeframeAlignment: {
      shortTerm: TradingSignal;
      mediumTerm: TradingSignal;
      longTerm: TradingSignal;
      alignment: number; // -100 to 100
    };
  }> {
    try {
      // Get current market data
      const solData = await okxService.getCompleteSOLData();
      const candleKey = timeframe as keyof typeof solData.candles;
      const candles = solData.candles[candleKey] || [];
      const currentPrice = parseFloat(candles[candles.length - 1]?.close || '0');

      // Initialize services
      const smcService = new SMCService();
      const cvdService = new CVDService();
      const technicalService = new TechnicalIndicatorsService();
      const fibService = new FibonacciService();
      const confluenceService = new ConfluenceService();

      // Get trades data for CVD analysis (placeholder for demo)
      const tradesData: { price: string; timestamp: string; size: string; side: 'buy' | 'sell' }[] = [];
      
      // Fetch all analysis data in parallel with fallback for CVD
      const [smcData, technicalData, fibData] = await Promise.all([
        smcService.analyzeSMC(candles, timeframe),
        technicalService.analyzeTechnicalIndicators(candles, timeframe),
        fibService.analyzeFibonacci(candles, timeframe)
      ]);

      // CVD analysis with fallback
      let cvdData;
      try {
        // For now, create minimal CVD data since we need actual trades
        cvdData = {
          timeframe,
          buyerSellerAggression: {
            dominantSide: 'neutral',
            ratio: 1.0,
            confidence: 50
          },
          currentCVD: 0,
          volumeAnalysis: {
            buyVolume: '0',
            sellVolume: '0',
            totalVolume: '0'
          }
        };
      } catch (error) {
        console.log('CVD analysis skipped due to insufficient data');
        cvdData = null;
      }
      
      // Generate confluence data manually
      const confluenceData = {
        overall: this.calculateBasicConfluence(smcData, technicalData),
        trend: smcData?.trend || 'neutral',
        confidence: 50,
        strength: 'moderate',
        riskLevel: 'medium'
      };

      // Generate market conditions
      const marketConditions = this.analyzeMarketConditions(candles, technicalData, cvdData);

      // Generate primary signal (main timeframe)
      const primarySignal = this.generateSignal(
        currentPrice, 
        timeframe, 
        smcData, 
        cvdData, 
        technicalData, 
        fibData, 
        confluenceData,
        marketConditions
      );

      // Generate secondary signal (contrarian/scalping)
      const secondarySignal = this.generateContrarian(
        currentPrice,
        timeframe,
        technicalData,
        cvdData,
        marketConditions
      );

      // Multi-timeframe alignment
      const multiTimeframeAlignment = await this.analyzeMultiTimeframeAlignment(currentPrice);

      // Store signal in history
      this.addToHistory(primarySignal);

      return {
        primary: primarySignal,
        secondary: secondarySignal,
        marketConditions,
        multiTimeframeAlignment
      };

    } catch (error) {
      console.error('Error generating trading signals:', error);
      
      // Return safe fallback signal
      return this.getFallbackSignal(timeframe);
    }
  }

  private generateSignal(
    currentPrice: number,
    timeframe: string,
    smcData: any,
    cvdData: any,
    technicalData: any,
    fibData: any,
    confluenceData: any,
    marketConditions: LiveMarketConditions
  ): TradingSignal {
    const reasons: string[] = [];
    let signalDirection: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;
    let strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG' = 'WEAK';

    // Confluence Analysis (35% weight)
    const confluenceScore = confluenceData?.overall || 0;
    if (confluenceScore > 5) {
      signalDirection = 'BUY';
      confidence += 35;
      reasons.push(`Strong bullish confluence (+${confluenceScore})`);
    } else if (confluenceScore < -5) {
      signalDirection = 'SELL';
      confidence += 35;
      reasons.push(`Strong bearish confluence (${confluenceScore})`);
    }

    // Smart Money Concepts (25% weight)
    if (smcData?.trend === 'bullish' && smcData?.lastBOS?.type === 'bullish') {
      if (signalDirection === 'HOLD') signalDirection = 'BUY';
      confidence += signalDirection === 'BUY' ? 25 : -15;
      reasons.push('Bullish BOS confirmed, smart money buying');
    } else if (smcData?.trend === 'bearish' && smcData?.lastBOS?.type === 'bearish') {
      if (signalDirection === 'HOLD') signalDirection = 'SELL';
      confidence += signalDirection === 'SELL' ? 25 : -15;
      reasons.push('Bearish BOS confirmed, smart money selling');
    }

    // Technical Indicators (20% weight)
    const rsi = technicalData?.rsi?.current || 50;
    const emaSignal = this.getEMASignal(technicalData);
    
    if (rsi < 30 && emaSignal === 'bullish') {
      if (signalDirection === 'HOLD') signalDirection = 'BUY';
      confidence += signalDirection === 'BUY' ? 20 : -10;
      reasons.push('RSI oversold + EMA bullish alignment');
    } else if (rsi > 70 && emaSignal === 'bearish') {
      if (signalDirection === 'HOLD') signalDirection = 'SELL';
      confidence += signalDirection === 'SELL' ? 20 : -10;
      reasons.push('RSI overbought + EMA bearish alignment');
    }

    // Volume Confirmation (15% weight)
    const volumeConfirmation = this.analyzeVolumeConfirmation(cvdData, signalDirection);
    if (volumeConfirmation) {
      confidence += 15;
      reasons.push('Volume confirms directional bias');
    }

    // Fibonacci Levels (5% weight)
    if (fibData?.supportResistance?.nearestLevel) {
      const level = fibData.supportResistance.nearestLevel;
      const distance = Math.abs(currentPrice - level.price) / currentPrice * 100;
      
      if (distance < 0.5) { // Within 0.5% of key level
        confidence += 5;
        reasons.push(`Near key ${level.type} level at ${level.price.toFixed(2)}`);
      }
    }

    // Determine strength based on confidence
    if (confidence >= 80) strength = 'VERY_STRONG';
    else if (confidence >= 65) strength = 'STRONG';
    else if (confidence >= 45) strength = 'MODERATE';
    else strength = 'WEAK';

    // Enhanced: Generate explanations for unclear signals
    const explanations = this.generateExplanation(
      signalDirection, 
      confidence, 
      smcData, 
      cvdData, 
      technicalData, 
      confluenceData, 
      marketConditions
    );

    // Generate risk management levels
    const { stopLoss, takeProfit1, takeProfit2, riskReward } = this.calculateRiskLevels(
      currentPrice, 
      signalDirection, 
      technicalData,
      fibData,
      strength
    );

    // Generate alerts
    const alerts = this.generateAlerts(signalDirection, confidence, strength, reasons, explanations);

    return {
      signal: signalDirection,
      strength,
      confidence: Math.max(0, Math.min(100, confidence)),
      entryPrice: currentPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
      riskReward,
      timeframe,
      timestamp: new Date().toISOString(),
      reasons,
      explanations, // Enhanced: Add explanations for unclear signals
      technicalAnalysis: {
        rsi,
        emaSignal,
        macdSignal: this.getMACDSignal(technicalData),
        volumeConfirmation
      },
      smartMoney: {
        bosSignal: smcData?.lastBOS?.type || 'neutral',
        liquidityGrab: smcData?.liquidityGrabs?.length > 0,
        institutionalFlow: this.getInstitutionalFlow(cvdData)
      },
      priceAction: {
        keyLevel: fibData?.supportResistance?.nearestLevel?.price || currentPrice,
        levelType: fibData?.supportResistance?.nearestLevel?.type || 'support',
        distanceToLevel: Math.abs(currentPrice - (fibData?.supportResistance?.nearestLevel?.price || currentPrice))
      },
      alerts
    };
  }

  private generateContrarian(
    currentPrice: number,
    timeframe: string,
    technicalData: any,
    cvdData: any,
    marketConditions: LiveMarketConditions
  ): TradingSignal {
    const reasons: string[] = [];
    let signalDirection: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let confidence = 0;

    const rsi = technicalData?.rsi?.current || 50;

    // Contrarian signals for mean reversion
    if (rsi < 25 && marketConditions.volatility === 'high') {
      signalDirection = 'BUY';
      confidence = 65;
      reasons.push('Extreme oversold condition - mean reversion expected');
    } else if (rsi > 75 && marketConditions.volatility === 'high') {
      signalDirection = 'SELL';
      confidence = 65;
      reasons.push('Extreme overbought condition - mean reversion expected');
    }

    // Scalping opportunities
    if (marketConditions.marketStructure === 'ranging' && marketConditions.volume === 'low') {
      if (rsi < 40) {
        signalDirection = 'BUY';
        confidence = 45;
        reasons.push('Range trading - buy at lower bound');
      } else if (rsi > 60) {
        signalDirection = 'SELL';
        confidence = 45;
        reasons.push('Range trading - sell at upper bound');
      }
    }

    const { stopLoss, takeProfit1, takeProfit2, riskReward } = this.calculateRiskLevels(
      currentPrice, 
      signalDirection, 
      technicalData,
      null,
      'MODERATE'
    );

    return {
      signal: signalDirection,
      strength: confidence > 60 ? 'STRONG' : confidence > 40 ? 'MODERATE' : 'WEAK',
      confidence,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit1,
      takeProfit2,
      riskReward,
      timeframe: 'SCALP',
      timestamp: new Date().toISOString(),
      reasons,
      technicalAnalysis: {
        rsi,
        emaSignal: 'neutral',
        macdSignal: 'neutral',
        volumeConfirmation: false
      },
      smartMoney: {
        bosSignal: 'neutral',
        liquidityGrab: false,
        institutionalFlow: 'neutral'
      },
      priceAction: {
        keyLevel: currentPrice,
        levelType: 'support',
        distanceToLevel: 0
      },
      alerts: {
        urgency: 'LOW',
        message: 'Contrarian/scalping opportunity'
      }
    };
  }

  private analyzeMarketConditions(candles: any[], technicalData: any, cvdData: any): LiveMarketConditions {
    const recentCandles = candles.slice(-20);
    const currentPrice = parseFloat(recentCandles[recentCandles.length - 1]?.close || '0');
    
    // Calculate volatility
    const highLow = recentCandles.map(c => (parseFloat(c.high) - parseFloat(c.low)) / parseFloat(c.close) * 100);
    const avgVolatility = highLow.reduce((sum, v) => sum + v, 0) / highLow.length;
    
    let volatility: 'low' | 'medium' | 'high' | 'extreme';
    if (avgVolatility < 1) volatility = 'low';
    else if (avgVolatility < 2.5) volatility = 'medium';
    else if (avgVolatility < 4) volatility = 'high';
    else volatility = 'extreme';

    // Analyze trend
    const ema12 = technicalData?.ema12?.current || currentPrice;
    const ema26 = technicalData?.ema26?.current || currentPrice;
    
    let trend: 'bullish' | 'bearish' | 'neutral';
    if (currentPrice > ema12 && ema12 > ema26) trend = 'bullish';
    else if (currentPrice < ema12 && ema12 < ema26) trend = 'bearish';
    else trend = 'neutral';

    // Analyze volume
    const recentVolumes = recentCandles.map(c => parseFloat(c.volume || '0'));
    const avgVolume = recentVolumes.reduce((sum, v) => sum + v, 0) / recentVolumes.length;
    const currentVolume = recentVolumes[recentVolumes.length - 1];
    
    let volume: 'low' | 'normal' | 'high' | 'exceptional';
    if (currentVolume < avgVolume * 0.7) volume = 'low';
    else if (currentVolume < avgVolume * 1.3) volume = 'normal';
    else if (currentVolume < avgVolume * 2) volume = 'high';
    else volume = 'exceptional';

    // Determine market structure
    const highs = recentCandles.map(c => parseFloat(c.high));
    const lows = recentCandles.map(c => parseFloat(c.low));
    const isBreakingHigh = currentPrice > Math.max(...highs.slice(0, -1));
    const isBreakingLow = currentPrice < Math.min(...lows.slice(0, -1));
    
    let marketStructure: 'uptrend' | 'downtrend' | 'ranging' | 'breakout';
    if (isBreakingHigh || isBreakingLow) marketStructure = 'breakout';
    else if (trend === 'bullish') marketStructure = 'uptrend';
    else if (trend === 'bearish') marketStructure = 'downtrend';
    else marketStructure = 'ranging';

    return {
      price: currentPrice,
      trend,
      volatility,
      volume,
      marketStructure
    };
  }

  private async analyzeMultiTimeframeAlignment(currentPrice: number): Promise<{
    shortTerm: TradingSignal;
    mediumTerm: TradingSignal;
    longTerm: TradingSignal;
    alignment: number;
  }> {
    try {
      // Generate signals for different timeframes
      const [shortTerm, mediumTerm, longTerm] = await Promise.all([
        this.generateQuickSignal(currentPrice, '5m'),
        this.generateQuickSignal(currentPrice, '1H'),
        this.generateQuickSignal(currentPrice, '4H')
      ]);

      // Calculate alignment score
      let alignment = 0;
      const signals = [shortTerm, mediumTerm, longTerm];
      
      const buyCount = signals.filter(s => s.signal === 'BUY').length;
      const sellCount = signals.filter(s => s.signal === 'SELL').length;
      
      if (buyCount === 3) alignment = 100;
      else if (sellCount === 3) alignment = -100;
      else if (buyCount === 2) alignment = 50;
      else if (sellCount === 2) alignment = -50;
      else alignment = 0;

      return { shortTerm, mediumTerm, longTerm, alignment };
    } catch (error) {
      return this.getFallbackMultiTimeframe(currentPrice);
    }
  }

  private generateQuickSignal(currentPrice: number, timeframe: string): Promise<TradingSignal> {
    // Simplified signal generation for multi-timeframe analysis
    return Promise.resolve({
      signal: 'HOLD',
      strength: 'WEAK',
      confidence: 50,
      entryPrice: currentPrice,
      stopLoss: currentPrice * 0.98,
      takeProfit1: currentPrice * 1.02,
      takeProfit2: currentPrice * 1.04,
      riskReward: 2,
      timeframe,
      timestamp: new Date().toISOString(),
      reasons: ['Quick signal for multi-timeframe analysis'],
      technicalAnalysis: {
        rsi: 50,
        emaSignal: 'neutral',
        macdSignal: 'neutral',
        volumeConfirmation: false
      },
      smartMoney: {
        bosSignal: 'neutral',
        liquidityGrab: false,
        institutionalFlow: 'neutral'
      },
      priceAction: {
        keyLevel: currentPrice,
        levelType: 'support',
        distanceToLevel: 0
      },
      alerts: {
        urgency: 'LOW',
        message: 'Multi-timeframe analysis'
      }
    });
  }

  private calculateRiskLevels(
    entryPrice: number, 
    direction: 'BUY' | 'SELL' | 'HOLD', 
    technicalData: any,
    fibData: any,
    strength: string
  ) {
    if (direction === 'HOLD') {
      return {
        stopLoss: entryPrice,
        takeProfit1: entryPrice,
        takeProfit2: entryPrice,
        riskReward: 0
      };
    }

    // Dynamic stop loss based on volatility and strength
    let stopPercent = 0.015; // 1.5% default
    
    if (strength === 'VERY_STRONG') stopPercent = 0.01;
    else if (strength === 'STRONG') stopPercent = 0.012;
    else if (strength === 'MODERATE') stopPercent = 0.015;
    else stopPercent = 0.02;

    const stopLoss = direction === 'BUY' 
      ? entryPrice * (1 - stopPercent)
      : entryPrice * (1 + stopPercent);

    // Take profit levels with 2:1 and 3:1 risk-reward
    const takeProfitPercent1 = stopPercent * 2;
    const takeProfitPercent2 = stopPercent * 3;

    const takeProfit1 = direction === 'BUY'
      ? entryPrice * (1 + takeProfitPercent1)
      : entryPrice * (1 - takeProfitPercent1);

    const takeProfit2 = direction === 'BUY'
      ? entryPrice * (1 + takeProfitPercent2)
      : entryPrice * (1 - takeProfitPercent2);

    const riskReward = Math.abs(takeProfit1 - entryPrice) / Math.abs(entryPrice - stopLoss);

    return {
      stopLoss: parseFloat(stopLoss.toFixed(4)),
      takeProfit1: parseFloat(takeProfit1.toFixed(4)),
      takeProfit2: parseFloat(takeProfit2.toFixed(4)),
      riskReward: parseFloat(riskReward.toFixed(2))
    };
  }

  private generateAlerts(signal: 'BUY' | 'SELL' | 'HOLD', confidence: number, strength: string, reasons: string[], explanations?: string[]) {
    let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let message = '';

    if (signal === 'HOLD') {
      urgency = 'LOW';
      if (explanations && explanations.length > 0) {
        message = `No clear signal: ${explanations[0]}`;
      } else {
        message = 'No clear signal - wait for better setup';
      }
    } else if (strength === 'VERY_STRONG' && confidence > 85) {
      urgency = 'CRITICAL';
      message = `🚨 STRONG ${signal} SIGNAL - High probability setup!`;
    } else if (strength === 'STRONG' && confidence > 70) {
      urgency = 'HIGH';
      message = `⚡ ${signal} signal with good confluence`;
    } else if (confidence > 50) {
      urgency = 'MEDIUM';
      message = `📊 Moderate ${signal} signal detected`;
    } else {
      urgency = 'LOW';
      message = `⚠️ Weak ${signal} signal - proceed with caution`;
    }

    return { urgency, message };
  }

  // Enhanced: Explanatory Reasoning System
  private generateExplanation(
    signal: 'BUY' | 'SELL' | 'HOLD',
    confidence: number,
    smcData: any,
    cvdData: any,
    technicalData: any,
    confluenceData: any,
    marketConditions: any
  ): string[] {
    const explanations: string[] = [];
    
    if (signal === 'HOLD' || confidence < 45) {
      // Conflict Detection
      const conflicts = this.detectConflicts(smcData, cvdData, technicalData, confluenceData);
      if (conflicts.length > 0) {
        explanations.push(`Conflicting signals: ${conflicts.join(', ')}`);
      }
      
      // Market Balance Analysis  
      const balanceAnalysis = this.analyzeMarketBalance(cvdData, technicalData, marketConditions);
      if (balanceAnalysis) {
        explanations.push(balanceAnalysis);
      }
      
      // Volatility/Volume Issues
      if (marketConditions.volatility === 'low' && marketConditions.volume === 'low') {
        explanations.push('Low volatility and volume - insufficient market movement for profitable entry');
      }
      
      // Confluence Issues
      const confluenceScore = confluenceData?.overall || 0;
      if (Math.abs(confluenceScore) < 3) {
        explanations.push('Weak confluence score - multiple indicators showing mixed signals');
      }
      
      // Neutral Zone Analysis
      const rsi = technicalData?.rsi?.current || 50;
      if (rsi >= 40 && rsi <= 60) {
        explanations.push('RSI in neutral zone (40-60) - market showing indecision');
      }
      
      // Default explanation if no specific reasons found
      if (explanations.length === 0) {
        explanations.push('Market conditions unclear - waiting for better setup to minimize risk');
      }
    }
    
    return explanations;
  }

  private detectConflicts(smcData: any, cvdData: any, technicalData: any, confluenceData: any): string[] {
    const conflicts: string[] = [];
    
    // SMC vs Technical Conflict
    const smcTrend = smcData?.trend;
    const emaSignal = this.getEMASignal(technicalData);
    const macdSignal = this.getMACDSignal(technicalData);
    
    if (smcTrend === 'bullish' && (emaSignal === 'bearish' || macdSignal === 'bearish')) {
      conflicts.push('Smart Money bullish but technical indicators bearish');
    } else if (smcTrend === 'bearish' && (emaSignal === 'bullish' || macdSignal === 'bullish')) {
      conflicts.push('Smart Money bearish but technical indicators bullish');
    }
    
    // Volume vs Price Action Conflict
    const dominantSide = cvdData?.buyerSellerAggression?.dominantSide;
    const confluenceScore = confluenceData?.overall || 0;
    
    if (dominantSide === 'buyers' && confluenceScore < -3) {
      conflicts.push('Strong buying pressure but bearish price confluence');
    } else if (dominantSide === 'sellers' && confluenceScore > 3) {
      conflicts.push('Strong selling pressure but bullish price confluence');
    }
    
    // RSI vs Momentum Conflict
    const rsi = technicalData?.rsi?.current || 50;
    if (rsi > 70 && emaSignal === 'bullish') {
      conflicts.push('RSI overbought but momentum still bullish');
    } else if (rsi < 30 && emaSignal === 'bearish') {
      conflicts.push('RSI oversold but momentum still bearish');
    }
    
    return conflicts;
  }

  private analyzeMarketBalance(cvdData: any, technicalData: any, marketConditions: any): string | null {
    const buyerSellerRatio = cvdData?.buyerSellerAggression?.ratio || 1;
    const dominantSide = cvdData?.buyerSellerAggression?.dominantSide;
    const rsi = technicalData?.rsi?.current || 50;
    
    // Balanced market conditions
    if (buyerSellerRatio >= 0.9 && buyerSellerRatio <= 1.1) {
      return 'Buy and sell pressure evenly balanced - no clear directional bias';
    }
    
    // Weak dominance
    if (dominantSide === 'buyers' && buyerSellerRatio < 1.2) {
      return 'Slight buyer advantage but not strong enough for confident signal';
    } else if (dominantSide === 'sellers' && buyerSellerRatio > 0.8) {
      return 'Slight seller advantage but not strong enough for confident signal';
    }
    
    // RSI equilibrium
    if (rsi >= 45 && rsi <= 55) {
      return 'RSI showing market equilibrium - neither oversold nor overbought';
    }
    
    // Market structure issues
    if (marketConditions.marketStructure === 'ranging' && marketConditions.trend === 'neutral') {
      return 'Market in consolidation phase - waiting for breakout direction';
    }
    
    return null;
  }

  private getEMASignal(technicalData: any): 'bullish' | 'bearish' | 'neutral' {
    const ema12 = technicalData?.ema12?.current || 0;
    const ema26 = technicalData?.ema26?.current || 0;
    
    if (ema12 > ema26 * 1.001) return 'bullish';
    if (ema12 < ema26 * 0.999) return 'bearish';
    return 'neutral';
  }

  private getMACDSignal(technicalData: any): 'bullish' | 'bearish' | 'neutral' {
    const macd = technicalData?.macd?.current || 0;
    const signal = technicalData?.macd?.signal || 0;
    
    if (macd > signal) return 'bullish';
    if (macd < signal) return 'bearish';
    return 'neutral';
  }

  private analyzeVolumeConfirmation(cvdData: any, direction: 'BUY' | 'SELL' | 'HOLD'): boolean {
    if (direction === 'HOLD') return false;
    
    const dominantSide = cvdData?.buyerSellerAggression?.dominantSide;
    
    if (direction === 'BUY' && dominantSide === 'buyers') return true;
    if (direction === 'SELL' && dominantSide === 'sellers') return true;
    
    return false;
  }

  private getInstitutionalFlow(cvdData: any): 'buying' | 'selling' | 'neutral' {
    const dominantSide = cvdData?.buyerSellerAggression?.dominantSide;
    const ratio = cvdData?.buyerSellerAggression?.ratio || 1;
    
    if (dominantSide === 'buyers' && ratio > 1.2) return 'buying';
    if (dominantSide === 'sellers' && ratio < 0.8) return 'selling';
    return 'neutral';
  }

  private addToHistory(signal: TradingSignal) {
    this.signalHistory.unshift(signal);
    if (this.signalHistory.length > this.maxHistoryLength) {
      this.signalHistory.pop();
    }
    this.lastSignal = signal;
  }

  private getFallbackSignal(timeframe: string): any {
    return {
      primary: {
        signal: 'HOLD',
        strength: 'WEAK',
        confidence: 0,
        entryPrice: 0,
        stopLoss: 0,
        takeProfit1: 0,
        takeProfit2: 0,
        riskReward: 0,
        timeframe,
        timestamp: new Date().toISOString(),
        reasons: ['Error occurred - no signal available'],
        technicalAnalysis: { rsi: 50, emaSignal: 'neutral', macdSignal: 'neutral', volumeConfirmation: false },
        smartMoney: { bosSignal: 'neutral', liquidityGrab: false, institutionalFlow: 'neutral' },
        priceAction: { keyLevel: 0, levelType: 'support', distanceToLevel: 0 },
        alerts: { urgency: 'LOW', message: 'System error - please try again' }
      },
      secondary: {
        signal: 'HOLD',
        strength: 'WEAK',
        confidence: 0,
        entryPrice: 0,
        stopLoss: 0,
        takeProfit1: 0,
        takeProfit2: 0,
        riskReward: 0,
        timeframe: 'SCALP',
        timestamp: new Date().toISOString(),
        reasons: [],
        technicalAnalysis: { rsi: 50, emaSignal: 'neutral', macdSignal: 'neutral', volumeConfirmation: false },
        smartMoney: { bosSignal: 'neutral', liquidityGrab: false, institutionalFlow: 'neutral' },
        priceAction: { keyLevel: 0, levelType: 'support', distanceToLevel: 0 },
        alerts: { urgency: 'LOW', message: 'No signal' }
      },
      marketConditions: {
        price: 0,
        trend: 'neutral',
        volatility: 'medium',
        volume: 'normal',
        marketStructure: 'ranging'
      },
      multiTimeframeAlignment: {
        shortTerm: {} as TradingSignal,
        mediumTerm: {} as TradingSignal,
        longTerm: {} as TradingSignal,
        alignment: 0
      }
    };
  }

  private getFallbackMultiTimeframe(currentPrice: number): any {
    const fallbackSignal = {
      signal: 'HOLD',
      strength: 'WEAK',
      confidence: 0,
      entryPrice: currentPrice,
      stopLoss: currentPrice,
      takeProfit1: currentPrice,
      takeProfit2: currentPrice,
      riskReward: 0,
      timeframe: '1H',
      timestamp: new Date().toISOString(),
      reasons: [],
      technicalAnalysis: { rsi: 50, emaSignal: 'neutral', macdSignal: 'neutral', volumeConfirmation: false },
      smartMoney: { bosSignal: 'neutral', liquidityGrab: false, institutionalFlow: 'neutral' },
      priceAction: { keyLevel: currentPrice, levelType: 'support', distanceToLevel: 0 },
      alerts: { urgency: 'LOW', message: 'Fallback signal' }
    };

    return {
      shortTerm: fallbackSignal,
      mediumTerm: fallbackSignal,
      longTerm: fallbackSignal,
      alignment: 0
    };
  }

  private calculateBasicConfluence(smcData: any, technicalData: any): number {
    let score = 0;
    
    // SMC trend contribution
    if (smcData?.trend === 'bullish') score += 10;
    else if (smcData?.trend === 'bearish') score -= 10;
    
    // Technical indicators contribution
    const rsi = technicalData?.rsi?.current || 50;
    if (rsi < 30) score += 5;
    else if (rsi > 70) score -= 5;
    
    return score;
  }

  getSignalHistory(): TradingSignal[] {
    return [...this.signalHistory];
  }

  getLastSignal(): TradingSignal | null {
    return this.lastSignal;
  }
}

export const tradingSignalsService = new TradingSignalsService();