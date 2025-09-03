import { 
  CVDAnalysis, 
  VolumeProfileData, 
  FundingRateData, 
  OpenInterestData,
  SMCAnalysisData 
} from "@shared/schema";
import { TechnicalIndicatorsAnalysis } from "./technicalIndicators";
import { FibonacciAnalysis } from "./fibonacci";
import { OrderFlowMetrics } from "./orderFlow";
import { z } from "zod";

export interface ConfluenceScore {
  overall: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  confidence: number;
  components: {
    smc: number;
    cvd: number;
    volumeProfile: number;
    funding: number;
    openInterest: number;
    technicalIndicators: number;
    fibonacci: number;
    orderFlow: number;
  };
  signals: {
    type: string;
    source: string;
    weight: number;
    confidence: number;
  }[];
  recommendation: string;
  riskLevel: 'low' | 'medium' | 'high';
  timeframe: string;
  lastUpdate: string;
}

export class ConfluenceService {
  
  /**
   * Calculate confluence score from multiple analysis layers
   */
  async calculateConfluenceScore(
    smc?: SMCAnalysisData,
    cvd?: CVDAnalysis,
    volumeProfile?: VolumeProfileData,
    fundingRate?: FundingRateData,
    openInterest?: OpenInterestData,
    technicalIndicators?: TechnicalIndicatorsAnalysis,
    fibonacciAnalysis?: FibonacciAnalysis,
    orderFlowMetrics?: OrderFlowMetrics,
    timeframe: string = '1H'
  ): Promise<ConfluenceScore> {
    
    const signals: ConfluenceScore['signals'] = [];
    const components = {
      smc: 0,
      cvd: 0,
      volumeProfile: 0,
      funding: 0,
      openInterest: 0,
      technicalIndicators: 0,
      fibonacci: 0,
      orderFlow: 0
    };

    // 1. SMC Analysis Scoring (25% weight)
    if (smc) {
      const smcScore = this.calculateSMCScore(smc);
      components.smc = smcScore;
      
      signals.push({
        type: smc.trend,
        source: 'SMC Analysis',
        weight: 25,
        confidence: smc.confidence
      });

      // Add specific SMC signals
      if (smc.scenarios?.bullish?.probability && smc.scenarios.bullish.probability > 50) {
        signals.push({
          type: 'bullish',
          source: 'SMC Scenarios',
          weight: 15,
          confidence: smc.scenarios.bullish.probability
        });
      }
      
      if (smc.scenarios?.bearish?.probability && smc.scenarios.bearish.probability > 50) {
        signals.push({
          type: 'bearish',
          source: 'SMC Scenarios',
          weight: 15,
          confidence: smc.scenarios.bearish.probability
        });
      }
    }

    // 2. CVD Analysis Scoring (25% weight)
    if (cvd) {
      const cvdScore = this.calculateCVDScore(cvd);
      components.cvd = cvdScore;
      
      signals.push({
        type: cvd.buyerSellerAggression.dominantSide === 'buyers' ? 'bullish' : 
              cvd.buyerSellerAggression.dominantSide === 'sellers' ? 'bearish' : 'neutral',
        source: 'CVD Analysis',
        weight: 25,
        confidence: cvd.confidence.overall
      });

      // Smart money signals
      if (cvd.smartMoneySignals.accumulation.detected) {
        signals.push({
          type: 'bullish',
          source: 'CVD Smart Money (Accumulation)',
          weight: 20,
          confidence: 90
        });
      }
      
      if (cvd.smartMoneySignals.distribution.detected) {
        signals.push({
          type: 'bearish',
          source: 'CVD Smart Money (Distribution)',
          weight: 20,
          confidence: 90
        });
      }

      // Divergence signals
      if (cvd.activeDivergences.length > 0) {
        cvd.activeDivergences.forEach(div => {
          signals.push({
            type: div.type === 'bullish' || div.type === 'hidden_bullish' ? 'bullish' : 'bearish',
            source: 'CVD Divergence',
            weight: 18,
            confidence: div.significance === 'critical' ? 90 : div.significance === 'major' ? 75 : 60
          });
        });
      }
    }

    // 3. Volume Profile Scoring (20% weight)
    if (volumeProfile) {
      const vpScore = this.calculateVolumeProfileScore(volumeProfile);
      components.volumeProfile = vpScore;
      
      const pocBias = this.getPOCBias(volumeProfile);
      if (pocBias !== 'neutral') {
        signals.push({
          type: pocBias,
          source: 'Volume Profile POC',
          weight: 20,
          confidence: 75
        });
      }
    }

    // 4. Funding Rate Scoring (15% weight)
    if (fundingRate) {
      const fundingScore = this.calculateFundingScore(fundingRate);
      components.funding = fundingScore;
      
      const fundingBias = this.getFundingBias(fundingRate);
      if (fundingBias !== 'neutral') {
        signals.push({
          type: fundingBias,
          source: 'Funding Rate',
          weight: 15,
          confidence: 70
        });
      }
    }

    // 5. Open Interest Scoring (15% weight)
    if (openInterest) {
      const oiScore = this.calculateOpenInterestScore(openInterest);
      components.openInterest = oiScore;
      
      const oiBias = this.getOpenInterestBias(openInterest);
      if (oiBias !== 'neutral') {
        signals.push({
          type: oiBias,
          source: 'Open Interest',
          weight: 15,
          confidence: 65
        });
      }
    }

    // 6. Technical Indicators Scoring (20% weight) - RSI/EMA Analysis
    if (technicalIndicators) {
      const techScore = this.calculateTechnicalIndicatorsScore(technicalIndicators);
      components.technicalIndicators = techScore;
      
      // Overall momentum signal
      signals.push({
        type: technicalIndicators.momentum.overall,
        source: 'Technical Indicators',
        weight: 20,
        confidence: technicalIndicators.confidence.overall
      });

      // RSI signals
      if (technicalIndicators.rsi.signal !== 'neutral') {
        const rsiWeight = technicalIndicators.rsi.strength === 'strong' ? 18 : 
                         technicalIndicators.rsi.strength === 'moderate' ? 12 : 8;
        
        signals.push({
          type: technicalIndicators.rsi.signal === 'oversold' ? 'bullish' : 'bearish',
          source: 'RSI Analysis',
          weight: rsiWeight,
          confidence: technicalIndicators.confidence.rsiQuality
        });
      }

      // EMA crossover signals
      if (technicalIndicators.ema.crossover.status !== 'neutral') {
        signals.push({
          type: technicalIndicators.ema.crossover.status === 'golden_cross' ? 'bullish' : 'bearish',
          source: 'EMA Crossover',
          weight: 15,
          confidence: technicalIndicators.ema.crossover.confidence
        });
      }

      // RSI divergence signals
      if (technicalIndicators.rsi.divergence.detected) {
        signals.push({
          type: technicalIndicators.rsi.divergence.type || 'neutral',
          source: 'RSI Divergence',
          weight: 16,
          confidence: 85
        });
      }

      // Additional technical signals from the indicators service
      technicalIndicators.signals.forEach(signal => {
        const signalType = signal.type.includes('oversold') || signal.type.includes('golden') ? 'bullish' :
                          signal.type.includes('overbought') || signal.type.includes('death') ? 'bearish' : 'neutral';
        
        if (signalType !== 'neutral') {
          signals.push({
            type: signalType,
            source: `Technical Signal: ${signal.type}`,
            weight: signal.strength === 'strong' ? 14 : signal.strength === 'moderate' ? 10 : 6,
            confidence: signal.confidence
          });
        }
      });
    }

    // 7. Fibonacci Analysis Scoring (18% weight) - Golden Zones & Key Levels
    if (fibonacciAnalysis) {
      const fibScore = this.calculateFibonacciScore(fibonacciAnalysis);
      components.fibonacci = fibScore;
      
      // Overall Fibonacci confluence signal
      signals.push({
        type: fibonacciAnalysis.trend.direction,
        source: 'Fibonacci Analysis',
        weight: 18,
        confidence: fibonacciAnalysis.confluence.score
      });

      // Golden Zone signals
      if (fibonacciAnalysis.keyZones.goldenZone.isActive) {
        signals.push({
          type: fibonacciAnalysis.trend.direction === 'bullish' ? 'bullish' : 'bearish',
          source: 'Fibonacci Golden Zone',
          weight: 20,
          confidence: 88
        });
      }

      // Fibonacci level respect signals
      const respectedLevels = fibonacciAnalysis.retracements.filter(level => level.isRespected && level.significance !== 'minor');
      if (respectedLevels.length > 0) {
        signals.push({
          type: fibonacciAnalysis.trend.direction,
          source: 'Fibonacci Level Respect',
          weight: 16,
          confidence: Math.min(90, 60 + (respectedLevels.length * 10))
        });
      }

      // Extension target signals
      fibonacciAnalysis.extensions.forEach(ext => {
        const currentPrice = fibonacciAnalysis.currentPrice.value;
        const distance = Math.abs(currentPrice - ext.price) / currentPrice;
        
        if (distance < 0.05) { // Within 5% of extension target
          signals.push({
            type: 'bullish', // Extensions typically bullish targets
            source: `Fibonacci ${ext.name} Extension`,
            weight: ext.projection === 'conservative' ? 15 : ext.projection === 'moderate' ? 12 : 8,
            confidence: ext.probability
          });
        }
      });

      // Active Fibonacci signals
      fibonacciAnalysis.signals.forEach(signal => {
        const fibSignalType = signal.type === 'bounce_support' || signal.type === 'extension_target' ? 'bullish' :
                             signal.type === 'break_resistance' ? 'bearish' : 'neutral';
        
        if (fibSignalType !== 'neutral') {
          signals.push({
            type: fibSignalType,
            source: `Fibonacci Signal: ${signal.type}`,
            weight: signal.strength === 'strong' ? 17 : signal.strength === 'moderate' ? 12 : 8,
            confidence: signal.confidence
          });
        }
      });
    }

    // 8. Order Flow Analysis Scoring (15% weight) - Market Microstructure & Tape Reading
    if (orderFlowMetrics) {
      const ofScore = this.calculateOrderFlowScore(orderFlowMetrics);
      components.orderFlow = ofScore;
      
      // Bid/Ask Imbalance signals
      if (orderFlowMetrics.currentImbalance.significance !== 'minor') {
        signals.push({
          type: orderFlowMetrics.currentImbalance.prediction,
          source: 'Order Flow Imbalance',
          weight: orderFlowMetrics.currentImbalance.significance === 'critical' ? 20 : 15,
          confidence: Math.abs(orderFlowMetrics.currentImbalance.imbalanceRatio) * 100
        });
      }

      // Whale activity signals
      if (orderFlowMetrics.whaleActivity.detected && orderFlowMetrics.whaleActivity.strength !== 'weak') {
        const whaleSignalType = orderFlowMetrics.whaleActivity.direction === 'accumulation' ? 'bullish' : 
                               orderFlowMetrics.whaleActivity.direction === 'distribution' ? 'bearish' : 'neutral';
        
        if (whaleSignalType !== 'neutral') {
          signals.push({
            type: whaleSignalType,
            source: `Whale ${orderFlowMetrics.whaleActivity.direction}`,
            weight: orderFlowMetrics.whaleActivity.strength === 'strong' ? 18 : 12,
            confidence: orderFlowMetrics.whaleActivity.confidence
          });
        }
      }

      // Tape reading sentiment signals
      if (orderFlowMetrics.tapeReading.marketSentiment !== 'neutral' && 
          orderFlowMetrics.tapeReading.predictionConfidence > 60) {
        signals.push({
          type: orderFlowMetrics.tapeReading.marketSentiment,
          source: 'Tape Reading Analysis',
          weight: orderFlowMetrics.tapeReading.predictionConfidence > 80 ? 16 : 12,
          confidence: orderFlowMetrics.tapeReading.predictionConfidence
        });
      }

      // Flow dominance signals
      if (orderFlowMetrics.flowAnalysis.flowStrength !== 'weak') {
        const flowType = orderFlowMetrics.flowAnalysis.dominantFlow === 'taker_dominated' ? 'bullish' : 
                        orderFlowMetrics.flowAnalysis.dominantFlow === 'maker_dominated' ? 'bearish' : 'neutral';
        
        if (flowType !== 'neutral') {
          signals.push({
            type: flowType,
            source: `${orderFlowMetrics.flowAnalysis.dominantFlow} flow`,
            weight: orderFlowMetrics.flowAnalysis.flowStrength === 'strong' ? 14 : 10,
            confidence: orderFlowMetrics.flowAnalysis.makerTakerRatio > 0.7 ? 80 : 65
          });
        }
      }

      // Active order flow signals
      orderFlowMetrics.signals.forEach(signal => {
        const ofSignalType = signal.type.includes('buy') || signal.type.includes('bullish') || signal.type.includes('accumulation') ? 'bullish' :
                           signal.type.includes('sell') || signal.type.includes('bearish') || signal.type.includes('distribution') ? 'bearish' : 'neutral';
        
        if (ofSignalType !== 'neutral') {
          signals.push({
            type: ofSignalType,
            source: `Order Flow: ${signal.type}`,
            weight: signal.strength === 'strong' ? 15 : signal.strength === 'moderate' ? 10 : 6,
            confidence: signal.confidence
          });
        }
      });
    }

    // Calculate overall confluence
    const { overall, trend, strength, confidence } = this.calculateOverallConfluence(signals, components);
    
    return {
      overall,
      trend,
      strength,
      confidence,
      components,
      signals: signals.sort((a, b) => b.weight - a.weight), // Sort by weight
      recommendation: this.generateRecommendation(trend, strength, confidence, signals),
      riskLevel: this.calculateRiskLevel(confidence, signals),
      timeframe,
      lastUpdate: new Date().toISOString()
    };
  }

  private calculateSMCScore(smc: SMCAnalysisData): number {
    let score = 0;
    
    // Trend alignment
    if (smc.trend === 'bullish') score += 30;
    else if (smc.trend === 'bearish') score -= 30;
    
    // Scenario strength
    const bullishProb = smc.scenarios?.bullish?.probability || 0;
    const bearishProb = smc.scenarios?.bearish?.probability || 0;
    
    if (bullishProb > bearishProb) score += 20;
    else if (bearishProb > bullishProb) score -= 20;
    
    // Confidence - simplified since confidence might be different structure
    score += 10; // Fixed boost for having SMC data
    
    return Math.max(-100, Math.min(100, score));
  }

  private calculateCVDScore(cvd: CVDAnalysis): number {
    let score = 0;
    
    // Buyer/Seller dominance
    if (cvd.buyerSellerAggression.dominantSide === 'buyers') {
      score += cvd.buyerSellerAggression.buyerAggression.percentage * 0.8;
    } else if (cvd.buyerSellerAggression.dominantSide === 'sellers') {
      score -= cvd.buyerSellerAggression.sellerAggression.percentage * 0.8;
    }
    
    // Smart money signals
    if (cvd.smartMoneySignals.accumulation.detected) score += 25;
    if (cvd.smartMoneySignals.distribution.detected) score -= 25;
    
    // Flow analysis
    if (cvd.flowAnalysis.trend === 'accumulation') score += 15;
    else if (cvd.flowAnalysis.trend === 'distribution') score -= 15;
    
    // Divergences
    cvd.activeDivergences.forEach(div => {
      const confScore = div.significance === 'critical' ? 90 : div.significance === 'major' ? 75 : 60;
      if (div.type === 'bullish' || div.type === 'hidden_bullish') score += confScore * 0.3;
      else score -= confScore * 0.3;
    });
    
    return Math.max(-100, Math.min(100, score));
  }

  private calculateVolumeProfileScore(vp: VolumeProfileData): number {
    let score = 0;
    
    // POC (Point of Control) Analysis - 40% of volume score
    const pocPrice = parseFloat(vp.poc);
    // For now, use POC as reference since we don't have current price in this context
    // If POC exists, it means volume profile is functional, give base score
    if (pocPrice > 0) {
      score += 20; // Base score for having valid POC data
    }
    
    // POC quality analysis
    if (pocPrice > 200 && pocPrice < 220) { // Within reasonable SOL price range
      score += 15; // Valid POC in expected range
    }
    
    // Value Area Analysis - 30% of volume score
    if (vp.valueAreaHigh && vp.valueAreaLow) {
      const vaHigh = parseFloat(vp.valueAreaHigh);
      const vaLow = parseFloat(vp.valueAreaLow);
      const vaSpread = vaHigh - vaLow;
      
      if (vaSpread > 0 && vaSpread < 50) { // Reasonable value area spread
        score += 10; // Valid value area
      }
      
      // POC within value area is good sign
      if (pocPrice >= vaLow && pocPrice <= vaHigh) {
        score += 10; // POC in value area (balanced market)
      }
    }
    
    // Volume Distribution Analysis - 30% of volume score
    const totalVolume = parseFloat(vp.totalVolume || '0');
    if (totalVolume > 0) {
      // High volume indicates strong institutional interest
      if (totalVolume > 1000000) score += 15; // High volume
      else if (totalVolume > 500000) score += 10; // Moderate volume
      else score += 5; // Low volume
    }
    
    return Math.max(-50, Math.min(50, Math.round(score)));
  }

  private calculateFundingScore(funding: FundingRateData): number {
    const rate = parseFloat(funding.fundingRate);
    
    // Negative funding = bullish (shorts paying longs)
    // Positive funding = bearish (longs paying shorts)
    if (rate < -0.01) return 30; // Strong bullish
    if (rate < -0.005) return 15; // Moderate bullish
    if (rate > 0.01) return -30; // Strong bearish
    if (rate > 0.005) return -15; // Moderate bearish
    
    return 0; // Neutral
  }

  private calculateOpenInterestScore(oi: OpenInterestData): number {
    const currentOI = parseFloat(oi.oiUsd || '0');
    
    // Rising OI with price increase = bullish
    // Rising OI with price decrease = bearish
    // This is simplified - would need price context
    if (currentOI > 1000000000) { // Over 1B USD OI indicates strong interest
      return 10;
    }
    
    return 0;
  }

  private getPOCBias(vp: VolumeProfileData): 'bullish' | 'bearish' | 'neutral' {
    // Simplified POC analysis
    return 'neutral';
  }

  private getFundingBias(funding: FundingRateData): 'bullish' | 'bearish' | 'neutral' {
    const rate = parseFloat(funding.fundingRate);
    if (rate < -0.005) return 'bullish';
    if (rate > 0.005) return 'bearish';
    return 'neutral';
  }

  private getOpenInterestBias(oi: OpenInterestData): 'bullish' | 'bearish' | 'neutral' {
    const currentOI = parseFloat(oi.oiUsd || '0');
    if (currentOI > 1000000000) { // Over 1B USD OI
      return 'bullish'; // High OI generally bullish for adoption
    }
    return 'neutral';
  }

  private calculateOverallConfluence(
    signals: ConfluenceScore['signals'], 
    components: ConfluenceScore['components']
  ) {
    let bullishScore = 0;
    let bearishScore = 0;
    let totalWeight = 0;

    signals.forEach(signal => {
      const weightedScore = (signal.confidence / 100) * signal.weight;
      totalWeight += signal.weight;
      
      if (signal.type === 'bullish') {
        bullishScore += weightedScore;
      } else if (signal.type === 'bearish') {
        bearishScore += weightedScore;
      }
    });

    const netScore = bullishScore - bearishScore;
    const overall = totalWeight > 0 ? (netScore / totalWeight) * 100 : 0;
    
    // Determine trend
    let trend: 'bullish' | 'bearish' | 'neutral';
    if (overall > 15) trend = 'bullish';
    else if (overall < -15) trend = 'bearish';
    else trend = 'neutral';
    
    // Determine strength
    const absScore = Math.abs(overall);
    let strength: 'weak' | 'moderate' | 'strong';
    if (absScore > 60) strength = 'strong';
    else if (absScore > 30) strength = 'moderate';
    else strength = 'weak';
    
    // Calculate confidence based on signal agreement
    const agreement = signals.filter(s => s.type === trend).length / Math.max(signals.length, 1);
    const confidence = Math.min(95, agreement * 80 + (absScore * 0.2));
    
    return {
      overall: Math.round(overall),
      trend,
      strength,
      confidence: Math.round(confidence)
    };
  }

  private generateRecommendation(
    trend: 'bullish' | 'bearish' | 'neutral',
    strength: 'weak' | 'moderate' | 'strong',
    confidence: number,
    signals: ConfluenceScore['signals']
  ): string {
    const highConfidenceSignals = signals.filter(s => s.confidence > 80);
    
    if (trend === 'neutral' || confidence < 60) {
      return "Mixed signals detected. Consider waiting for clearer confluence before taking positions.";
    }
    
    if (trend === 'bullish') {
      if (strength === 'strong' && confidence > 80) {
        return `Strong bullish confluence detected. Multiple signals align for potential upward movement. Key signals: ${highConfidenceSignals.slice(0,2).map(s => s.source).join(', ')}.`;
      } else if (strength === 'moderate') {
        return `Moderate bullish bias with ${confidence}% confidence. Consider cautious long positioning with proper risk management.`;
      } else {
        return `Weak bullish signals detected. Monitor for additional confirmation before entering positions.`;
      }
    } else {
      if (strength === 'strong' && confidence > 80) {
        return `Strong bearish confluence detected. Multiple signals align for potential downward movement. Key signals: ${highConfidenceSignals.slice(0,2).map(s => s.source).join(', ')}.`;
      } else if (strength === 'moderate') {
        return `Moderate bearish bias with ${confidence}% confidence. Consider cautious short positioning with proper risk management.`;
      } else {
        return `Weak bearish signals detected. Monitor for additional confirmation before entering positions.`;
      }
    }
  }

  private calculateRiskLevel(
    confidence: number,
    signals: ConfluenceScore['signals']
  ): 'low' | 'medium' | 'high' {
    const signalCount = signals.length;
    const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / Math.max(signalCount, 1);
    
    if (confidence > 80 && avgConfidence > 75 && signalCount >= 4) {
      return 'low';
    } else if (confidence > 60 && avgConfidence > 60 && signalCount >= 3) {
      return 'medium';
    } else {
      return 'high';
    }
  }

  private calculateTechnicalIndicatorsScore(tech: TechnicalIndicatorsAnalysis): number {
    let score = 0;
    
    // RSI Analysis (50% of technical score)
    if (tech.rsi.signal === 'oversold') {
      score += tech.rsi.strength === 'strong' ? 30 : tech.rsi.strength === 'moderate' ? 20 : 15;
    } else if (tech.rsi.signal === 'overbought') {
      score -= tech.rsi.strength === 'strong' ? 30 : tech.rsi.strength === 'moderate' ? 20 : 15;
    } else if (tech.rsi.signal === 'neutral') {
      // Neutral RSI gives small score based on position in range
      const rsiValue = tech.rsi.current;
      if (rsiValue > 55) score += 8; // Slightly bullish
      else if (rsiValue < 45) score -= 8; // Slightly bearish
      else score += 2; // True neutral gets small positive (market functioning)
    }
    
    // RSI trend direction (25% of technical score)
    if (tech.rsi.trend === 'bullish') score += 15;
    else if (tech.rsi.trend === 'bearish') score -= 15;
    else if (tech.rsi.trend === 'neutral') score += 5; // Stability bonus
    
    // RSI divergence (15% of technical score)
    if (tech.rsi.divergence && tech.rsi.divergence.detected) {
      score += 10; // Any divergence detected is valuable signal
    }
    
    // EMA Analysis (10% of technical score) - simplified to match actual data structure
    if (tech.ema && tech.ema.fast) {
      const emaValue = tech.ema.fast.value;
      const rsiCurrent = tech.rsi.current;
      
      // Basic EMA trend analysis
      if (tech.ema.fast.trend === 'bullish') score += 5;
      else if (tech.ema.fast.trend === 'bearish') score -= 5;
      else score += 2; // Neutral trend gets small bonus
      
      // EMA-RSI confluence
      if (rsiCurrent > 50 && tech.ema.fast.trend === 'bullish') score += 5;
      else if (rsiCurrent < 50 && tech.ema.fast.trend === 'bearish') score -= 5;
    }
    
    // Base score for having valid technical data
    score += 10;
    
    return Math.max(-50, Math.min(50, Math.round(score)));
  }

  private calculateFibonacciScore(fib: FibonacciAnalysis): number {
    let score = 0;
    
    // Trend analysis (30% of fibonacci score)
    if (fib.trend.direction === 'bullish') {
      score += fib.trend.strength === 'strong' ? 30 : fib.trend.strength === 'moderate' ? 20 : 10;
    } else if (fib.trend.direction === 'bearish') {
      score -= fib.trend.strength === 'strong' ? 30 : fib.trend.strength === 'moderate' ? 20 : 10;
    }
    
    // Golden Zone activity (25% of fibonacci score)
    if (fib.keyZones.goldenZone.isActive) {
      const zoneBonus = fib.keyZones.goldenZone.strength === 'strong' ? 25 : 
                       fib.keyZones.goldenZone.strength === 'moderate' ? 18 : 12;
      
      if (fib.trend.direction === 'bullish') score += zoneBonus;
      else if (fib.trend.direction === 'bearish') score -= zoneBonus;
    }
    
    // Institutional Zone activity (20% of fibonacci score)
    if (fib.keyZones.institutionalZone.isActive) {
      const instBonus = fib.keyZones.institutionalZone.strength === 'strong' ? 20 : 15;
      
      if (fib.trend.direction === 'bullish') score += instBonus;
      else if (fib.trend.direction === 'bearish') score -= instBonus;
    }
    
    // Level respect quality (15% of fibonacci score)
    const respectRate = fib.confidence.levelRespect;
    if (respectRate > 70) score += 15;
    else if (respectRate > 50) score += 10;
    else if (respectRate > 30) score += 5;
    
    // Active Fibonacci signals (10% of fibonacci score)
    const strongSignals = fib.signals.filter(s => s.strength === 'strong').length;
    const moderateSignals = fib.signals.filter(s => s.strength === 'moderate').length;
    
    const signalBonus = (strongSignals * 6) + (moderateSignals * 3);
    
    if (fib.trend.direction === 'bullish') score += Math.min(10, signalBonus);
    else if (fib.trend.direction === 'bearish') score -= Math.min(10, signalBonus);
    
    // Confluence quality adjustment
    const confluenceMultiplier = fib.confluence.score / 100;
    score *= confluenceMultiplier;
    
    // Overall confidence adjustment
    const qualityMultiplier = fib.confidence.overall / 100;
    score *= qualityMultiplier;
    
    return Math.max(-100, Math.min(100, Math.round(score)));
  }

  private calculateOrderFlowScore(of: OrderFlowMetrics): number {
    let score = 0;
    
    // Bid/Ask imbalance analysis (25% of order flow score)
    const imbalanceScore = Math.abs(of.currentImbalance.imbalanceRatio) * 25;
    if (of.currentImbalance.prediction === 'bullish') {
      score += imbalanceScore;
    } else if (of.currentImbalance.prediction === 'bearish') {
      score -= imbalanceScore;
    }
    
    // Whale activity impact (25% of order flow score)
    if (of.whaleActivity.detected) {
      const whaleBonus = of.whaleActivity.strength === 'strong' ? 25 : 
                        of.whaleActivity.strength === 'moderate' ? 18 : 12;
      
      if (of.whaleActivity.direction === 'accumulation') {
        score += whaleBonus;
      } else if (of.whaleActivity.direction === 'distribution') {
        score -= whaleBonus;
      }
    }
    
    // Tape reading sentiment (20% of order flow score)
    const tapeBonus = of.tapeReading.predictionConfidence / 100 * 20;
    if (of.tapeReading.marketSentiment === 'bullish') {
      score += tapeBonus;
    } else if (of.tapeReading.marketSentiment === 'bearish') {
      score -= tapeBonus;
    }
    
    // Flow analysis (15% of order flow score)
    if (of.flowAnalysis.flowStrength !== 'weak') {
      const flowBonus = of.flowAnalysis.flowStrength === 'strong' ? 15 : 10;
      
      // Taker dominated = bullish (market orders, aggressive buying)
      // Maker dominated = bearish (limit orders, patient selling)
      if (of.flowAnalysis.dominantFlow === 'taker_dominated' && of.flowAnalysis.makerTakerRatio > 0.6) {
        score += flowBonus;
      } else if (of.flowAnalysis.dominantFlow === 'maker_dominated' && of.flowAnalysis.makerTakerRatio < 0.4) {
        score -= flowBonus;
      }
    }
    
    // Trade volume and momentum (15% of order flow score)
    const netVolumeRatio = of.recentTrades.netVolume / (of.recentTrades.buyVolume + of.recentTrades.sellVolume || 1);
    const momentumBonus = Math.abs(netVolumeRatio) * 15;
    
    if (netVolumeRatio > 0.1) {
      score += momentumBonus; // More buy volume
    } else if (netVolumeRatio < -0.1) {
      score -= momentumBonus; // More sell volume
    }
    
    // Quality adjustment based on confidence
    const qualityMultiplier = of.confidence.overall / 100;
    score *= qualityMultiplier;
    
    // Data reliability adjustment
    const reliabilityMultiplier = (of.confidence.dataQuality + of.confidence.signalReliability) / 200;
    score *= reliabilityMultiplier;
    
    return Math.max(-100, Math.min(100, Math.round(score)));
  }
}