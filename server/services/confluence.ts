import { 
  CVDAnalysis, 
  VolumeProfileData, 
  FundingRateData, 
  OpenInterestData,
  SMCAnalysisData 
} from "@shared/schema";
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
    timeframe: string = '1H'
  ): Promise<ConfluenceScore> {
    
    const signals: ConfluenceScore['signals'] = [];
    const components = {
      smc: 0,
      cvd: 0,
      volumeProfile: 0,
      funding: 0,
      openInterest: 0
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
    // Implementation based on volume profile data
    // This is a simplified version - can be enhanced
    return 0; // Placeholder
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
}