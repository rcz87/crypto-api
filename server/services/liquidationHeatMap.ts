import { CandleData } from "@shared/schema";

export interface LiquidationCluster {
  price: number;
  estimatedPositions: number;
  totalNotional: number; // Total USD value of positions
  leverageProfile: {
    leverage5x: number;
    leverage10x: number;
    leverage20x: number;
    leverage50x: number;
    leverage100x: number;
  };
  liquidationProbability: number; // 0-1 scale
  timeToLiquidation: string; // "immediate", "1-3h", "6-12h", "1-3d"
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  impact: 'minimal' | 'moderate' | 'significant' | 'severe';
}

export interface LiquidationZone {
  priceLevel: number;
  zoneName: string;
  totalRisk: number; // Combined risk score
  positionCount: number;
  averageLeverage: number;
  dominantSide: 'long' | 'short' | 'balanced';
  cascadeRisk: number; // Risk of cascade liquidations
  marketImpact: {
    priceImpact: number; // Expected price movement %
    volumeImpact: number; // Expected liquidation volume
    durationEstimate: string; // How long liquidation event might last
  };
  nearestCluster: {
    distance: number; // % from current price
    severity: 'low' | 'medium' | 'high' | 'extreme';
  };
}

export interface MarketLiquidationRisk {
  currentPrice: number;
  overallRiskScore: number; // 0-100 composite risk score
  
  // Immediate risk analysis (0-5% from current price)
  immediateRisk: {
    upside: LiquidationZone[];   // Long liquidations above current price
    downside: LiquidationZone[]; // Short liquidations below current price
    netRisk: number;
    criticalLevels: number[];
  };
  
  // Medium-term risk (5-15% from current price)
  mediumTermRisk: {
    upside: LiquidationZone[];
    downside: LiquidationZone[];
    netRisk: number;
    significantLevels: number[];
  };
  
  // Long-term risk (15%+ from current price)
  longTermRisk: {
    upside: LiquidationZone[];
    downside: LiquidationZone[];
    totalPositionsAtRisk: number;
    maximumCascadeRisk: number;
  };
  
  // Heat map data for visualization
  heatMapData: {
    priceLevel: number;
    intensity: number; // 0-100 heat intensity
    positionDensity: number;
    riskCategory: 'safe' | 'caution' | 'warning' | 'danger' | 'extreme';
    leverageBreakdown: {
      low: number;    // 1-10x
      medium: number; // 10-25x
      high: number;   // 25-50x
      extreme: number; // 50x+
    };
  }[];
  
  // Aggregated insights
  insights: {
    dominantLeverageRange: '1-10x' | '10-25x' | '25-50x' | '50x+';
    riskConcentration: 'distributed' | 'clustered' | 'highly_clustered';
    nearestThreat: {
      direction: 'upside' | 'downside';
      distance: number;
      severity: 'low' | 'medium' | 'high' | 'extreme';
      estimatedImpact: string;
    };
    marketStability: 'stable' | 'unstable' | 'volatile' | 'dangerous';
    recommendedAction: string;
  };
  
  // Temporal analysis
  timeToNextRisk: string;
  cascadeScenarios: {
    scenario: 'mild' | 'moderate' | 'severe';
    triggerPrice: number;
    expectedDrop: number; // % price drop
    affectedPositions: number;
    totalLiquidation: number; // USD value
    recoveryTime: string;
  }[];
  
  // Metadata
  lastUpdate: string;
  calculationTime: number;
  dataConfidence: number;
}

export class LiquidationHeatMapService {
  
  private readonly LEVERAGE_LEVELS = [5, 10, 20, 50, 100];
  private readonly RISK_ZONES = {
    immediate: { min: 0, max: 0.05 },     // 0-5%
    medium: { min: 0.05, max: 0.15 },     // 5-15% 
    longTerm: { min: 0.15, max: 0.5 }     // 15-50%
  };
  
  /**
   * Estimate leveraged position distribution based on market data
   */
  estimatePositionDistribution(
    currentPrice: number, 
    volume24h: number,
    openInterest: number,
    fundingRate: number
  ): LiquidationCluster[] {
    const clusters: LiquidationCluster[] = [];
    
    // Generate liquidation levels around current price
    const priceRange = currentPrice * 0.5; // 50% price range
    const stepSize = currentPrice * 0.01; // 1% increments
    
    for (let offset = -priceRange; offset <= priceRange; offset += stepSize) {
      const price = currentPrice + offset;
      if (price <= 0) continue;
      
      // Estimate position density based on psychological levels
      const distanceFromCurrent = Math.abs(offset) / currentPrice;
      const psychologicalFactor = this.calculatePsychologicalFactor(price);
      
      // Estimate positions at each leverage level
      const basePositions = (volume24h * 0.1) * psychologicalFactor * Math.exp(-distanceFromCurrent * 5);
      
      const leverageProfile = {
        leverage5x: basePositions * this.getLeverageDistribution(5, distanceFromCurrent, fundingRate),
        leverage10x: basePositions * this.getLeverageDistribution(10, distanceFromCurrent, fundingRate),
        leverage20x: basePositions * this.getLeverageDistribution(20, distanceFromCurrent, fundingRate),
        leverage50x: basePositions * this.getLeverageDistribution(50, distanceFromCurrent, fundingRate),
        leverage100x: basePositions * this.getLeverageDistribution(100, distanceFromCurrent, fundingRate)
      };
      
      const totalPositions = Object.values(leverageProfile).reduce((sum, pos) => sum + pos, 0);
      const totalNotional = totalPositions * price * 50; // Average position size estimate
      
      if (totalPositions > 0.1) { // Filter out negligible clusters
        // Calculate liquidation probability based on distance and market conditions
        const liquidationProbability = this.calculateLiquidationProbability(
          distanceFromCurrent, leverageProfile, fundingRate
        );
        
        // Determine time to liquidation
        const timeToLiquidation = this.estimateTimeToLiquidation(distanceFromCurrent, liquidationProbability);
        
        // Risk and impact assessment
        const riskLevel = this.assessRiskLevel(liquidationProbability, totalNotional);
        const impact = this.assessImpact(totalNotional, totalPositions);
        
        clusters.push({
          price: Math.round(price * 100) / 100,
          estimatedPositions: Math.round(totalPositions * 100) / 100,
          totalNotional: Math.round(totalNotional),
          leverageProfile: {
            leverage5x: Math.round(leverageProfile.leverage5x * 100) / 100,
            leverage10x: Math.round(leverageProfile.leverage10x * 100) / 100,
            leverage20x: Math.round(leverageProfile.leverage20x * 100) / 100,
            leverage50x: Math.round(leverageProfile.leverage50x * 100) / 100,
            leverage100x: Math.round(leverageProfile.leverage100x * 100) / 100
          },
          liquidationProbability: Math.round(liquidationProbability * 1000) / 1000,
          timeToLiquidation,
          riskLevel,
          impact
        });
      }
    }
    
    return clusters
      .sort((a, b) => b.liquidationProbability - a.liquidationProbability)
      .slice(0, 50); // Top 50 most risky clusters
  }
  
  /**
   * Calculate psychological price level factor (round numbers attract more positions)
   */
  private calculatePsychologicalFactor(price: number): number {
    const roundness = [1, 5, 10, 25, 50, 100];
    const priceStr = price.toFixed(2);
    
    // Check for round numbers
    for (const round of roundness) {
      if (price % round === 0) return 2.5; // Strong psychological level
    }
    
    // Check for .50, .25, .75 endings
    const decimal = parseFloat(priceStr.split('.')[1] || '0');
    if ([0, 25, 50, 75].includes(decimal)) return 1.8;
    
    // Check for .00, .05 endings
    if (decimal % 5 === 0) return 1.4;
    
    return 1.0; // Normal price level
  }
  
  /**
   * Get leverage distribution probability at distance from current price
   */
  private getLeverageDistribution(
    leverage: number, 
    distanceFromCurrent: number, 
    fundingRate: number
  ): number {
    // Higher leverage more likely closer to current price
    const distanceFactor = Math.exp(-distanceFromCurrent * leverage * 2);
    
    // Funding rate affects leverage preference
    const fundingFactor = Math.abs(fundingRate) > 0.01 ? 0.8 : 1.2;
    
    // Base distribution by leverage
    const baseDistribution = {
      5: 0.35,   // 35% of traders use 5x
      10: 0.30,  // 30% use 10x
      20: 0.20,  // 20% use 20x
      50: 0.10,  // 10% use 50x
      100: 0.05  // 5% use 100x (degens)
    };
    
    return (baseDistribution[leverage as keyof typeof baseDistribution] || 0) * 
           distanceFactor * fundingFactor;
  }
  
  /**
   * Calculate liquidation probability based on market conditions
   */
  private calculateLiquidationProbability(
    distanceFromCurrent: number,
    leverageProfile: any,
    fundingRate: number
  ): number {
    // Base probability increases with distance
    const distanceProb = Math.min(0.9, distanceFromCurrent * 2);
    
    // High leverage positions more likely to liquidate
    const highLevPositions = leverageProfile.leverage50x + leverageProfile.leverage100x;
    const totalPositions = Object.values(leverageProfile).reduce((sum: number, pos: any) => sum + pos, 0);
    const highLevRatio = totalPositions > 0 ? highLevPositions / totalPositions : 0;
    
    const leverageFactor = 1 + (highLevRatio * 0.5);
    
    // Extreme funding rates increase liquidation risk
    const fundingFactor = 1 + (Math.abs(fundingRate) * 10);
    
    return Math.min(0.95, distanceProb * leverageFactor * fundingFactor);
  }
  
  /**
   * Estimate time to liquidation based on current market velocity
   */
  private estimateTimeToLiquidation(distance: number, probability: number): string {
    if (distance < 0.02 && probability > 0.8) return "immediate";
    if (distance < 0.05 && probability > 0.6) return "1-3h";
    if (distance < 0.15 && probability > 0.4) return "6-12h";
    return "1-3d";
  }
  
  /**
   * Assess risk level based on probability and notional value
   */
  private assessRiskLevel(probability: number, notional: number): 'low' | 'medium' | 'high' | 'extreme' {
    const combinedRisk = probability * (Math.log10(notional / 1000000) + 1); // Log scale for notional
    
    if (combinedRisk > 0.8) return 'extreme';
    if (combinedRisk > 0.6) return 'high';
    if (combinedRisk > 0.3) return 'medium';
    return 'low';
  }
  
  /**
   * Assess market impact of liquidation cluster
   */
  private assessImpact(notional: number, positions: number): 'minimal' | 'moderate' | 'significant' | 'severe' {
    // Impact based on total value and position count
    if (notional > 50000000 && positions > 1000) return 'severe';    // $50M+ with 1000+ positions
    if (notional > 20000000 && positions > 500) return 'significant'; // $20M+ with 500+ positions
    if (notional > 5000000 && positions > 100) return 'moderate';     // $5M+ with 100+ positions
    return 'minimal';
  }
  
  /**
   * Analyze liquidation zones and create risk assessment
   */
  analyzeLiquidationZones(clusters: LiquidationCluster[], currentPrice: number): {
    upside: LiquidationZone[];
    downside: LiquidationZone[];
    netRisk: number;
    criticalLevels: number[];
    significantLevels: number[];
  } {
    const upsideClusters = clusters.filter(c => c.price > currentPrice);
    const downsideClusters = clusters.filter(c => c.price < currentPrice);
    
    // Group clusters into zones
    const createZones = (clusterSet: LiquidationCluster[], direction: 'upside' | 'downside'): LiquidationZone[] => {
      const zones: LiquidationZone[] = [];
      const sortedClusters = clusterSet.sort((a, b) => a.price - b.price);
      
      // Group nearby clusters (within 2% of each other)
      let currentZone: LiquidationCluster[] = [];
      let lastPrice = 0;
      
      sortedClusters.forEach(cluster => {
        if (currentZone.length === 0 || Math.abs(cluster.price - lastPrice) / lastPrice < 0.02) {
          currentZone.push(cluster);
          lastPrice = cluster.price;
        } else {
          // Process completed zone
          if (currentZone.length > 0) {
            zones.push(this.createZoneFromClusters(currentZone, currentPrice));
          }
          currentZone = [cluster];
          lastPrice = cluster.price;
        }
      });
      
      // Process final zone
      if (currentZone.length > 0) {
        zones.push(this.createZoneFromClusters(currentZone, currentPrice));
      }
      
      return zones.sort((a, b) => b.totalRisk - a.totalRisk);
    };
    
    const upsideZones = createZones(upsideClusters, 'upside');
    const downsideZones = createZones(downsideClusters, 'downside');
    
    // Calculate net risk (positive = more long liquidations, negative = more short liquidations)
    const upsideRisk = upsideZones.reduce((sum, zone) => sum + zone.totalRisk, 0);
    const downsideRisk = downsideZones.reduce((sum, zone) => sum + zone.totalRisk, 0);
    const netRisk = (downsideRisk - upsideRisk) / Math.max(upsideRisk + downsideRisk, 1);
    
    // Identify critical levels (extreme risk zones)
    const criticalLevels = [...upsideZones, ...downsideZones]
      .filter(zone => zone.totalRisk > 80 || zone.cascadeRisk > 0.7)
      .map(zone => zone.priceLevel)
      .sort((a, b) => a - b);
    
    // Identify significant levels (major risk zones)
    const significantLevels = [...upsideZones, ...downsideZones]
      .filter(zone => zone.totalRisk > 60)
      .map(zone => zone.priceLevel)
      .sort((a, b) => a - b);
    
    return {
      upside: upsideZones,
      downside: downsideZones,
      netRisk: Math.round(netRisk * 1000) / 1000,
      criticalLevels,
      significantLevels
    };
  }
  
  /**
   * Create liquidation zone from cluster of nearby positions
   */
  private createZoneFromClusters(clusters: LiquidationCluster[], currentPrice: number): LiquidationZone {
    const avgPrice = clusters.reduce((sum, c) => sum + c.price, 0) / clusters.length;
    const totalPositions = clusters.reduce((sum, c) => sum + c.estimatedPositions, 0);
    const totalNotional = clusters.reduce((sum, c) => sum + c.totalNotional, 0);
    
    // Calculate average leverage weighted by position count
    const weightedLeverage = clusters.reduce((sum, c) => {
      const clusterAvgLev = (5 * c.leverageProfile.leverage5x + 
                            10 * c.leverageProfile.leverage10x + 
                            20 * c.leverageProfile.leverage20x + 
                            50 * c.leverageProfile.leverage50x + 
                            100 * c.leverageProfile.leverage100x) / 
                           Math.max(1, Object.values(c.leverageProfile).reduce((s, p) => s + p, 0));
      return sum + (clusterAvgLev * c.estimatedPositions);
    }, 0) / Math.max(1, totalPositions);
    
    // Determine dominant side (long liquidations above price, short liquidations below)
    const isAbovePrice = avgPrice > currentPrice;
    const dominantSide = isAbovePrice ? 'long' : 'short';
    
    // Calculate cascade risk (risk of triggering further liquidations)
    const cascadeRisk = Math.min(0.95, 
      (totalNotional / 10000000) * // $10M+ increases cascade risk
      (weightedLeverage / 20) *    // Higher leverage increases cascade risk
      (totalPositions / 100)       // More positions increase cascade risk
    );
    
    // Market impact estimation
    const priceImpact = (totalNotional / 100000000) * (weightedLeverage / 10); // % expected price move
    const volumeImpact = totalPositions * (weightedLeverage * 10); // Expected liquidation volume
    
    let durationEstimate = "1-5 minutes";
    if (totalNotional > 50000000) durationEstimate = "10-30 minutes";
    if (totalNotional > 100000000) durationEstimate = "30-60 minutes";
    
    // Risk assessment
    const distanceFromCurrent = Math.abs(avgPrice - currentPrice) / currentPrice;
    const totalRisk = Math.min(100, 
      cascadeRisk * 40 + 
      (priceImpact * 100) * 30 + 
      (1 - distanceFromCurrent) * 30
    );
    
    // Zone naming
    const direction = isAbovePrice ? "↗" : "↘";
    const distancePercent = Math.round(distanceFromCurrent * 100);
    const zoneName = `${direction} ${distancePercent}% Zone (${Math.round(weightedLeverage)}x avg)`;
    
    return {
      priceLevel: Math.round(avgPrice * 100) / 100,
      zoneName,
      totalRisk: Math.round(totalRisk),
      positionCount: Math.round(totalPositions),
      averageLeverage: Math.round(weightedLeverage * 10) / 10,
      dominantSide,
      cascadeRisk: Math.round(cascadeRisk * 1000) / 1000,
      marketImpact: {
        priceImpact: Math.round(priceImpact * 1000) / 1000,
        volumeImpact: Math.round(volumeImpact),
        durationEstimate
      },
      nearestCluster: {
        distance: Math.round(distanceFromCurrent * 10000) / 100, // % from current
        severity: cascadeRisk > 0.8 ? 'extreme' : 
                 cascadeRisk > 0.6 ? 'high' : 
                 cascadeRisk > 0.3 ? 'medium' : 'low'
      }
    };
  }
  
  /**
   * Generate heat map visualization data
   */
  generateHeatMapData(clusters: LiquidationCluster[], currentPrice: number): any[] {
    return clusters.map(cluster => {
      const distance = Math.abs(cluster.price - currentPrice) / currentPrice;
      
      // Heat intensity based on risk and proximity
      const proximityIntensity = Math.max(0, 100 - (distance * 500)); // Closer = hotter
      const riskIntensity = cluster.liquidationProbability * 100;
      const volumeIntensity = Math.min(100, cluster.estimatedPositions * 2);
      
      const intensity = Math.round((proximityIntensity + riskIntensity + volumeIntensity) / 3);
      
      // Risk category
      let riskCategory: 'safe' | 'caution' | 'warning' | 'danger' | 'extreme';
      if (intensity > 80) riskCategory = 'extreme';
      else if (intensity > 60) riskCategory = 'danger';
      else if (intensity > 40) riskCategory = 'warning';
      else if (intensity > 20) riskCategory = 'caution';
      else riskCategory = 'safe';
      
      // Leverage breakdown
      const totalLevPositions = Object.values(cluster.leverageProfile).reduce((sum, pos) => sum + pos, 0);
      const leverageBreakdown = {
        low: Math.round((cluster.leverageProfile.leverage5x + cluster.leverageProfile.leverage10x) / totalLevPositions * 100) || 0,
        medium: Math.round((cluster.leverageProfile.leverage20x) / totalLevPositions * 100) || 0, 
        high: Math.round((cluster.leverageProfile.leverage50x) / totalLevPositions * 100) || 0,
        extreme: Math.round((cluster.leverageProfile.leverage100x) / totalLevPositions * 100) || 0
      };
      
      return {
        priceLevel: cluster.price,
        intensity,
        positionDensity: Math.round(cluster.estimatedPositions * 100) / 100,
        riskCategory,
        leverageBreakdown
      };
    }).sort((a, b) => a.priceLevel - b.priceLevel);
  }
  
  /**
   * Generate market insights and recommendations
   */
  generateMarketInsights(
    immediateRisk: any,
    mediumTermRisk: any,
    longTermRisk: any,
    currentPrice: number
  ): any {
    // Determine dominant leverage range
    const allZones = [...immediateRisk.upside, ...immediateRisk.downside, ...mediumTermRisk.upside, ...mediumTermRisk.downside];
    const avgLeverage = allZones.reduce((sum, zone) => sum + zone.averageLeverage, 0) / Math.max(1, allZones.length);
    
    let dominantLeverageRange: '1-10x' | '10-25x' | '25-50x' | '50x+';
    if (avgLeverage <= 10) dominantLeverageRange = '1-10x';
    else if (avgLeverage <= 25) dominantLeverageRange = '10-25x';
    else if (avgLeverage <= 50) dominantLeverageRange = '25-50x';
    else dominantLeverageRange = '50x+';
    
    // Risk concentration analysis
    const totalZones = allZones.length;
    const highRiskZones = allZones.filter(z => z.totalRisk > 60).length;
    const riskConcentration = highRiskZones / totalZones > 0.7 ? 'highly_clustered' :
                             highRiskZones / totalZones > 0.3 ? 'clustered' : 'distributed';
    
    // Find nearest threat
    const allThreats = allZones.filter(z => z.totalRisk > 50);
    const nearestThreat = allThreats.sort((a, b) => 
      Math.abs(a.priceLevel - currentPrice) - Math.abs(b.priceLevel - currentPrice)
    )[0];
    
    let nearestThreatInfo = {
      direction: 'upside' as 'upside' | 'downside',
      distance: 0,
      severity: 'low' as 'low' | 'medium' | 'high' | 'extreme',
      estimatedImpact: "Minimal market impact expected"
    };
    
    if (nearestThreat) {
      nearestThreatInfo = {
        direction: nearestThreat.priceLevel > currentPrice ? 'upside' : 'downside',
        distance: Math.round(Math.abs(nearestThreat.priceLevel - currentPrice) / currentPrice * 10000) / 100,
        severity: nearestThreat.cascadeRisk > 0.8 ? 'extreme' :
                 nearestThreat.cascadeRisk > 0.6 ? 'high' :
                 nearestThreat.cascadeRisk > 0.3 ? 'medium' : 'low',
        estimatedImpact: `${nearestThreat.marketImpact.priceImpact.toFixed(2)}% price impact, ${nearestThreat.marketImpact.durationEstimate} duration`
      };
    }
    
    // Market stability assessment
    const overallRisk = (immediateRisk.netRisk + mediumTermRisk.netRisk) / 2;
    const marketStability = Math.abs(overallRisk) > 0.7 ? 'dangerous' :
                           Math.abs(overallRisk) > 0.4 ? 'volatile' :
                           Math.abs(overallRisk) > 0.2 ? 'unstable' : 'stable';
    
    // Recommendation based on analysis
    let recommendedAction = "Continue monitoring market conditions";
    if (nearestThreatInfo.severity === 'extreme' && nearestThreatInfo.distance < 5) {
      recommendedAction = "⚠️ CRITICAL: Reduce positions immediately, extreme liquidation risk detected";
    } else if (nearestThreatInfo.severity === 'high' && nearestThreatInfo.distance < 10) {
      recommendedAction = "⚠️ HIGH RISK: Consider reducing leverage and setting tight stop losses";
    } else if (marketStability === 'dangerous') {
      recommendedAction = "⚠️ UNSTABLE: Market conditions volatile, exercise extreme caution";
    } else if (Math.abs(overallRisk) > 0.5) {
      recommendedAction = "CAUTION: Significant liquidation imbalance detected, monitor closely";
    }
    
    return {
      dominantLeverageRange,
      riskConcentration,
      nearestThreat: nearestThreatInfo,
      marketStability,
      recommendedAction
    };
  }
  
  /**
   * Generate cascade scenarios for stress testing
   */
  generateCascadeScenarios(clusters: LiquidationCluster[], currentPrice: number): any[] {
    const scenarios = [];
    
    // Mild cascade (10% move)
    const mildTrigger = currentPrice * 0.9;
    const mildAffected = clusters.filter(c => 
      (c.price >= mildTrigger && c.price <= currentPrice) || 
      (c.price <= currentPrice * 1.1 && c.price >= currentPrice)
    );
    const mildLiquidation = mildAffected.reduce((sum, c) => sum + c.totalNotional, 0);
    
    scenarios.push({
      scenario: 'mild',
      triggerPrice: Math.round(mildTrigger * 100) / 100,
      expectedDrop: 5, // % additional drop from liquidations
      affectedPositions: mildAffected.reduce((sum, c) => sum + c.estimatedPositions, 0),
      totalLiquidation: Math.round(mildLiquidation),
      recoveryTime: "30-60 minutes"
    });
    
    // Moderate cascade (20% move)  
    const moderateTrigger = currentPrice * 0.8;
    const moderateAffected = clusters.filter(c => 
      (c.price >= moderateTrigger && c.price <= currentPrice * 1.2)
    );
    const moderateLiquidation = moderateAffected.reduce((sum, c) => sum + c.totalNotional, 0);
    
    scenarios.push({
      scenario: 'moderate',
      triggerPrice: Math.round(moderateTrigger * 100) / 100,
      expectedDrop: 12, // % additional drop
      affectedPositions: moderateAffected.reduce((sum, c) => sum + c.estimatedPositions, 0),
      totalLiquidation: Math.round(moderateLiquidation),
      recoveryTime: "2-4 hours"
    });
    
    // Severe cascade (30%+ move)
    const severeTrigger = currentPrice * 0.7;
    const severeAffected = clusters.filter(c => 
      (c.price >= severeTrigger && c.price <= currentPrice * 1.3)
    );
    const severeLiquidation = severeAffected.reduce((sum, c) => sum + c.totalNotional, 0);
    
    scenarios.push({
      scenario: 'severe',
      triggerPrice: Math.round(severeTrigger * 100) / 100,
      expectedDrop: 25, // % additional drop
      affectedPositions: severeAffected.reduce((sum, c) => sum + c.estimatedPositions, 0),
      totalLiquidation: Math.round(severeLiquidation),
      recoveryTime: "6-24 hours"
    });
    
    return scenarios;
  }
  
  /**
   * Main liquidation heat map analysis
   */
  async analyzeLiquidationRisk(
    currentPrice: number,
    volume24h: number,
    openInterest: number,
    fundingRate: number
  ): Promise<MarketLiquidationRisk> {
    const startTime = Date.now();
    
    // Generate position clusters
    const clusters = this.estimatePositionDistribution(currentPrice, volume24h, openInterest, fundingRate);
    
    // Categorize clusters by distance from current price
    const immediateClusters = clusters.filter(c => {
      const distance = Math.abs(c.price - currentPrice) / currentPrice;
      return distance >= this.RISK_ZONES.immediate.min && distance <= this.RISK_ZONES.immediate.max;
    });
    
    const mediumClusters = clusters.filter(c => {
      const distance = Math.abs(c.price - currentPrice) / currentPrice;
      return distance >= this.RISK_ZONES.medium.min && distance <= this.RISK_ZONES.medium.max;
    });
    
    const longTermClusters = clusters.filter(c => {
      const distance = Math.abs(c.price - currentPrice) / currentPrice;
      return distance >= this.RISK_ZONES.longTerm.min && distance <= this.RISK_ZONES.longTerm.max;
    });
    
    // Analyze each risk zone
    const immediateRisk = this.analyzeLiquidationZones(immediateClusters, currentPrice);
    const mediumTermRisk = this.analyzeLiquidationZones(mediumClusters, currentPrice);
    
    const longTermRisk = {
      upside: this.analyzeLiquidationZones(longTermClusters.filter(c => c.price > currentPrice), currentPrice).upside,
      downside: this.analyzeLiquidationZones(longTermClusters.filter(c => c.price < currentPrice), currentPrice).downside,
      totalPositionsAtRisk: longTermClusters.reduce((sum, c) => sum + c.estimatedPositions, 0),
      maximumCascadeRisk: Math.max(...longTermClusters.map(c => c.liquidationProbability))
    };
    
    // Generate heat map visualization data
    const heatMapData = this.generateHeatMapData(clusters, currentPrice);
    
    // Generate insights and recommendations
    const insights = this.generateMarketInsights(immediateRisk, mediumTermRisk, longTermRisk, currentPrice);
    
    // Calculate overall risk score
    const immediateRiskScore = Math.abs(immediateRisk.netRisk) * 50;
    const mediumRiskScore = Math.abs(mediumTermRisk.netRisk) * 30;
    const cascadeRiskScore = longTermRisk.maximumCascadeRisk * 20;
    const overallRiskScore = Math.min(100, immediateRiskScore + mediumRiskScore + cascadeRiskScore);
    
    // Time to next significant risk
    const nearestRisk = [...immediateRisk.upside, ...immediateRisk.downside]
      .sort((a, b) => a.nearestCluster.distance - b.nearestCluster.distance)[0];
    
    const timeToNextRisk = nearestRisk ? 
      `${nearestRisk.nearestCluster.distance.toFixed(1)}% move required` : 
      "No immediate risk detected";
    
    // Generate cascade scenarios
    const cascadeScenarios = this.generateCascadeScenarios(clusters, currentPrice);
    
    const calculationTime = Date.now() - startTime;
    const dataConfidence = Math.min(95, 70 + (clusters.length / 10)); // More clusters = higher confidence
    
    return {
      currentPrice: Math.round(currentPrice * 100) / 100,
      overallRiskScore: Math.round(overallRiskScore),
      immediateRisk,
      mediumTermRisk,
      longTermRisk,
      heatMapData,
      insights,
      timeToNextRisk,
      cascadeScenarios,
      lastUpdate: new Date().toISOString(),
      calculationTime,
      dataConfidence
    };
  }
}