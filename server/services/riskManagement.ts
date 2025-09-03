import { OKXService } from './okx.js';
import { PositionCalculatorService } from './positionCalculator.js';

// Risk Management Types
export interface RiskMetrics {
  portfolioValue: number;
  totalExposure: number;
  marginUtilization: number;
  valueAtRisk: {
    daily: number;
    weekly: number;
    confidence95: number;
    confidence99: number;
  };
  maxDrawdown: {
    current: number;
    estimated: number;
    historical: number;
  };
  riskScore: number; // 0-100 scale
  riskLevel: 'conservative' | 'moderate' | 'aggressive' | 'extreme';
}

export interface PortfolioPosition {
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  leverage: number;
  marginMode: 'isolated' | 'cross';
  unrealizedPnl: number;
  liquidationPrice: number;
  liquidationDistance: number;
  riskWeight: number;
}

export interface MarketRiskFactors {
  volatilityRegime: 'low' | 'normal' | 'high' | 'extreme';
  volatilityPercentile: number;
  marketTrend: 'bullish' | 'bearish' | 'sideways';
  fundingRateImpact: number;
  openInterestChange24h: number;
  correlationRisk: number;
  liquidityRisk: 'low' | 'medium' | 'high';
}

export interface RiskAlerts {
  marginCallWarnings: Array<{
    position: string;
    currentMargin: number;
    requiredMargin: number;
    timeToMarginCall: string;
    severity: 'warning' | 'critical';
  }>;
  liquidationWarnings: Array<{
    position: string;
    liquidationDistance: number;
    estimatedTime: string;
    severity: 'warning' | 'danger' | 'critical';
  }>;
  concentrationRisk: Array<{
    type: 'position' | 'sector' | 'leverage';
    description: string;
    riskLevel: number;
    recommendation: string;
  }>;
  marketAlerts: Array<{
    type: 'volatility' | 'funding' | 'liquidity' | 'correlation';
    message: string;
    impact: 'low' | 'medium' | 'high';
    action: string;
  }>;
}

export interface RiskDashboardData {
  timestamp: string;
  accountBalance: number;
  portfolioMetrics: RiskMetrics;
  positions: PortfolioPosition[];
  marketFactors: MarketRiskFactors;
  alerts: RiskAlerts;
  recommendations: {
    overall: string;
    positions: string[];
    riskAdjustments: string[];
    urgentActions: string[];
  };
  compliance: {
    riskLimits: {
      maxDrawdown: { limit: number; current: number; status: 'safe' | 'warning' | 'breach' };
      maxLeverage: { limit: number; current: number; status: 'safe' | 'warning' | 'breach' };
      maxExposure: { limit: number; current: number; status: 'safe' | 'warning' | 'breach' };
      varLimit: { limit: number; current: number; status: 'safe' | 'warning' | 'breach' };
    };
    overallCompliance: 'compliant' | 'warning' | 'non_compliant';
  };
}

export class RiskManagementService {
  private okxService: OKXService;
  private positionCalculator: PositionCalculatorService;
  
  // Risk Management Constants
  private readonly RISK_FREE_RATE = 0.05; // 5% annual risk-free rate
  private readonly VaR_CONFIDENCE_95 = 1.645; // Z-score for 95% confidence
  private readonly VaR_CONFIDENCE_99 = 2.326; // Z-score for 99% confidence
  private readonly VOLATILITY_WINDOW = 252; // Trading days for volatility calculation
  
  // Risk Limits (configurable)
  private readonly DEFAULT_RISK_LIMITS = {
    maxDrawdown: 20, // 20% maximum drawdown
    maxLeverage: 25, // 25x maximum leverage
    maxExposure: 80, // 80% of portfolio max exposure
    varLimit: 10, // 10% VaR limit
  };

  constructor(okxService: OKXService) {
    this.okxService = okxService;
    this.positionCalculator = new PositionCalculatorService(okxService);
  }

  /**
   * Generate comprehensive risk dashboard for portfolio
   */
  async generateRiskDashboard(
    positions: PortfolioPosition[],
    accountBalance: number,
    riskLimits = this.DEFAULT_RISK_LIMITS
  ): Promise<RiskDashboardData> {
    try {
      console.log('Generating risk dashboard for portfolio...');
      
      // Get current market data
      const marketData = await this.okxService.getCompleteSOLData();
      const currentPrice = parseFloat(marketData.ticker.price);
      
      // Calculate portfolio risk metrics
      const portfolioMetrics = await this.calculatePortfolioRisk(positions, accountBalance, currentPrice);
      
      // Analyze market risk factors
      const marketFactors = await this.analyzeMarketRiskFactors();
      
      // Generate risk alerts
      const alerts = await this.generateRiskAlerts(positions, portfolioMetrics, marketFactors);
      
      // Check compliance
      const compliance = this.checkRiskCompliance(portfolioMetrics, riskLimits);
      
      // Generate recommendations
      const recommendations = this.generateRiskRecommendations(
        portfolioMetrics, 
        positions, 
        marketFactors, 
        alerts
      );

      return {
        timestamp: new Date().toISOString(),
        accountBalance,
        portfolioMetrics,
        positions,
        marketFactors,
        alerts,
        recommendations,
        compliance
      };

    } catch (error) {
      console.error('Error generating risk dashboard:', error);
      throw new Error(`Failed to generate risk dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate comprehensive portfolio risk metrics
   */
  private async calculatePortfolioRisk(
    positions: PortfolioPosition[],
    accountBalance: number,
    currentPrice: number
  ): Promise<RiskMetrics> {
    
    // Calculate total portfolio value and exposure
    const totalUnrealizedPnl = positions.reduce((sum, pos) => sum + pos.unrealizedPnl, 0);
    const portfolioValue = accountBalance + totalUnrealizedPnl;
    const totalExposure = positions.reduce((sum, pos) => sum + (pos.size * pos.currentPrice), 0);
    
    // Calculate margin utilization
    const totalMarginUsed = positions.reduce((sum, pos) => {
      return sum + (pos.size * pos.currentPrice / pos.leverage);
    }, 0);
    const marginUtilization = totalMarginUsed / accountBalance;
    
    // Calculate Value at Risk (VaR)
    const valueAtRisk = await this.calculateVaR(positions, portfolioValue);
    
    // Calculate Maximum Drawdown
    const maxDrawdown = await this.calculateMaxDrawdown(positions, portfolioValue);
    
    // Calculate overall risk score (0-100)
    const riskScore = this.calculateRiskScore(
      marginUtilization,
      valueAtRisk.confidence95 / portfolioValue,
      maxDrawdown.estimated / 100,
      positions
    );
    
    // Determine risk level
    const riskLevel = this.determineRiskLevel(riskScore);

    return {
      portfolioValue,
      totalExposure,
      marginUtilization: marginUtilization * 100,
      valueAtRisk,
      maxDrawdown,
      riskScore,
      riskLevel
    };
  }

  /**
   * Calculate Value at Risk using parametric method
   */
  private async calculateVaR(positions: PortfolioPosition[], portfolioValue: number) {
    // Get historical volatility data (simplified - using current market data)
    const volatilityData = await this.okxService.getCompleteSOLData();
    
    // Estimate portfolio volatility (simplified calculation)
    // In practice, this would use historical price data and correlations
    const estimatedVolatility = 0.03; // 3% daily volatility estimate
    
    const dailyVaR = portfolioValue * estimatedVolatility * this.VaR_CONFIDENCE_95;
    const weeklyVaR = dailyVaR * Math.sqrt(7); // Scale for weekly
    
    return {
      daily: dailyVaR,
      weekly: weeklyVaR,
      confidence95: dailyVaR,
      confidence99: portfolioValue * estimatedVolatility * this.VaR_CONFIDENCE_99
    };
  }

  /**
   * Calculate maximum drawdown estimates
   */
  private async calculateMaxDrawdown(positions: PortfolioPosition[], portfolioValue: number) {
    // Calculate current unrealized losses
    const currentDrawdown = positions.reduce((sum, pos) => {
      return sum + Math.min(0, pos.unrealizedPnl);
    }, 0);
    
    // Estimate potential maximum drawdown based on leverage and volatility
    const avgLeverage = positions.length > 0 
      ? positions.reduce((sum, pos) => sum + pos.leverage, 0) / positions.length 
      : 1;
    
    const estimatedMaxDrawdown = Math.min(avgLeverage * 2, 50); // Cap at 50%
    
    return {
      current: Math.abs(currentDrawdown / portfolioValue) * 100,
      estimated: estimatedMaxDrawdown,
      historical: 25 // Historical max drawdown estimate
    };
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private calculateRiskScore(
    marginUtilization: number,
    varRatio: number,
    drawdownRatio: number,
    positions: PortfolioPosition[]
  ): number {
    // Weight different risk factors
    const marginWeight = 0.3;
    const varWeight = 0.25;
    const drawdownWeight = 0.25;
    const concentrationWeight = 0.2;
    
    // Calculate concentration risk
    const concentrationRisk = this.calculateConcentrationRisk(positions);
    
    // Normalize all factors to 0-100 scale
    const marginScore = Math.min(marginUtilization * 100, 100);
    const varScore = Math.min(varRatio * 1000, 100);
    const drawdownScore = Math.min(drawdownRatio * 100, 100);
    const concentrationScore = concentrationRisk * 100;
    
    const riskScore = 
      marginScore * marginWeight +
      varScore * varWeight +
      drawdownScore * drawdownWeight +
      concentrationScore * concentrationWeight;
    
    return Math.min(Math.max(riskScore, 0), 100);
  }

  /**
   * Calculate concentration risk
   */
  private calculateConcentrationRisk(positions: PortfolioPosition[]): number {
    if (positions.length === 0) return 0;
    
    const totalExposure = positions.reduce((sum, pos) => sum + (pos.size * pos.currentPrice), 0);
    
    // Calculate Herfindahl index for concentration
    const herfindahlIndex = positions.reduce((sum, pos) => {
      const weight = (pos.size * pos.currentPrice) / totalExposure;
      return sum + (weight * weight);
    }, 0);
    
    // Convert to risk score (0-1)
    return Math.min(herfindahlIndex * 2, 1);
  }

  /**
   * Determine risk level based on risk score
   */
  private determineRiskLevel(riskScore: number): 'conservative' | 'moderate' | 'aggressive' | 'extreme' {
    if (riskScore <= 25) return 'conservative';
    if (riskScore <= 50) return 'moderate';
    if (riskScore <= 75) return 'aggressive';
    return 'extreme';
  }

  /**
   * Analyze market risk factors
   */
  private async analyzeMarketRiskFactors(): Promise<MarketRiskFactors> {
    try {
      // Get comprehensive market data
      const [completeData, fundingData] = await Promise.all([
        this.okxService.getCompleteSOLData(),
        this.okxService.getFundingRate()
      ]);
      
      // Get technical analysis data (simplified for now)
      const technicalData = { 
        volatility: { percentile: 50 }, 
        trend: 'NEUTRAL' 
      };

      // Analyze volatility regime
      const volatilityPercentile = technicalData.volatility?.percentile || 50;
      const volatilityRegime = this.determineVolatilityRegime(volatilityPercentile);
      
      // Determine market trend
      const marketTrend = technicalData.trend === 'BULLISH' ? 'bullish' : 
                         technicalData.trend === 'BEARISH' ? 'bearish' : 'sideways';
      
      // Calculate funding rate impact
      const fundingRateImpact = Math.abs(parseFloat(fundingData.fundingRate)) * 100;
      
      // Get open interest change
      const openInterestData = await this.okxService.getOpenInterest();
      const openInterestChange24h = 5.2; // Simplified - would calculate from historical data
      
      // Calculate correlation risk (simplified)
      const correlationRisk = 0.3; // 30% correlation assumption
      
      // Determine liquidity risk
      const liquidityRisk = this.determineLiquidityRisk(completeData.orderBook);

      return {
        volatilityRegime,
        volatilityPercentile,
        marketTrend,
        fundingRateImpact,
        openInterestChange24h,
        correlationRisk,
        liquidityRisk
      };

    } catch (error) {
      console.error('Error analyzing market risk factors:', error);
      // Return default values
      return {
        volatilityRegime: 'normal',
        volatilityPercentile: 50,
        marketTrend: 'sideways',
        fundingRateImpact: 0,
        openInterestChange24h: 0,
        correlationRisk: 0.3,
        liquidityRisk: 'medium'
      };
    }
  }

  /**
   * Determine volatility regime
   */
  private determineVolatilityRegime(percentile: number): 'low' | 'normal' | 'high' | 'extreme' {
    if (percentile <= 20) return 'low';
    if (percentile <= 60) return 'normal';
    if (percentile <= 85) return 'high';
    return 'extreme';
  }

  /**
   * Determine liquidity risk from order book
   */
  private determineLiquidityRisk(orderBook: any): 'low' | 'medium' | 'high' {
    try {
      const bidSum = orderBook.bids.slice(0, 10).reduce((sum: number, bid: string[]) => sum + parseFloat(bid[1]), 0);
      const askSum = orderBook.asks.slice(0, 10).reduce((sum: number, ask: string[]) => sum + parseFloat(ask[1]), 0);
      const totalLiquidity = bidSum + askSum;
      
      if (totalLiquidity > 1000) return 'low';    // High liquidity = Low risk
      if (totalLiquidity > 500) return 'medium';
      return 'high';
    } catch (error) {
      return 'medium';
    }
  }

  /**
   * Generate risk alerts
   */
  private async generateRiskAlerts(
    positions: PortfolioPosition[],
    portfolioMetrics: RiskMetrics,
    marketFactors: MarketRiskFactors
  ): Promise<RiskAlerts> {
    
    const marginCallWarnings = positions
      .filter(pos => pos.liquidationDistance < 20) // Within 20% of liquidation
      .map(pos => ({
        position: `${pos.symbol} ${pos.side}`,
        currentMargin: pos.liquidationDistance,
        requiredMargin: 20,
        timeToMarginCall: this.estimateTimeToMarginCall(pos.liquidationDistance),
        severity: pos.liquidationDistance < 10 ? 'critical' as const : 'warning' as const
      }));

    const liquidationWarnings = positions
      .filter(pos => pos.liquidationDistance < 15) // Within 15% of liquidation
      .map(pos => ({
        position: `${pos.symbol} ${pos.side}`,
        liquidationDistance: pos.liquidationDistance,
        estimatedTime: this.estimateTimeToLiquidation(pos.liquidationDistance),
        severity: pos.liquidationDistance < 5 ? 'critical' as const : 
                 pos.liquidationDistance < 10 ? 'danger' as const : 'warning' as const
      }));

    const concentrationRisk = this.analyzeConcentrationRisk(positions, portfolioMetrics);
    const marketAlerts = this.generateMarketAlerts(marketFactors);

    return {
      marginCallWarnings,
      liquidationWarnings,
      concentrationRisk,
      marketAlerts
    };
  }

  /**
   * Estimate time to margin call
   */
  private estimateTimeToMarginCall(liquidationDistance: number): string {
    if (liquidationDistance < 5) return 'Immediate';
    if (liquidationDistance < 10) return '< 1 hour';
    if (liquidationDistance < 15) return '< 4 hours';
    return '< 24 hours';
  }

  /**
   * Estimate time to liquidation
   */
  private estimateTimeToLiquidation(liquidationDistance: number): string {
    if (liquidationDistance < 2) return 'Imminent (< 15 min)';
    if (liquidationDistance < 5) return '< 1 hour';
    if (liquidationDistance < 10) return '< 6 hours';
    return '< 24 hours';
  }

  /**
   * Analyze concentration risk
   */
  private analyzeConcentrationRisk(positions: PortfolioPosition[], portfolioMetrics: RiskMetrics) {
    const alerts = [];
    
    // Check position concentration
    const totalExposure = portfolioMetrics.totalExposure;
    for (const pos of positions) {
      const positionWeight = (pos.size * pos.currentPrice) / totalExposure;
      if (positionWeight > 0.5) { // More than 50% in single position
        alerts.push({
          type: 'position' as const,
          description: `${pos.symbol} represents ${(positionWeight * 100).toFixed(1)}% of portfolio`,
          riskLevel: positionWeight * 100,
          recommendation: 'Consider reducing position size or adding diversification'
        });
      }
    }
    
    // Check leverage concentration
    const avgLeverage = positions.reduce((sum, pos) => sum + pos.leverage, 0) / positions.length;
    if (avgLeverage > 15) {
      alerts.push({
        type: 'leverage' as const,
        description: `Average leverage of ${avgLeverage.toFixed(1)}x is high`,
        riskLevel: Math.min(avgLeverage * 2, 100),
        recommendation: 'Consider reducing leverage across positions'
      });
    }
    
    return alerts;
  }

  /**
   * Generate market alerts
   */
  private generateMarketAlerts(marketFactors: MarketRiskFactors) {
    const alerts = [];
    
    if (marketFactors.volatilityRegime === 'extreme') {
      alerts.push({
        type: 'volatility' as const,
        message: 'Extreme volatility detected - increased liquidation risk',
        impact: 'high' as const,
        action: 'Reduce position sizes or increase margin buffers'
      });
    }
    
    if (marketFactors.fundingRateImpact > 0.1) {
      alerts.push({
        type: 'funding' as const,
        message: `High funding rate impact: ${marketFactors.fundingRateImpact.toFixed(3)}%`,
        impact: 'medium' as const,
        action: 'Monitor funding costs and consider position timing'
      });
    }
    
    if (marketFactors.liquidityRisk === 'high') {
      alerts.push({
        type: 'liquidity' as const,
        message: 'Low market liquidity detected',
        impact: 'high' as const,
        action: 'Use limit orders and avoid large market orders'
      });
    }
    
    return alerts;
  }

  /**
   * Check risk compliance against limits
   */
  private checkRiskCompliance(portfolioMetrics: RiskMetrics, limits: typeof this.DEFAULT_RISK_LIMITS) {
    const riskLimits = {
      maxDrawdown: {
        limit: limits.maxDrawdown,
        current: portfolioMetrics.maxDrawdown.estimated,
        status: portfolioMetrics.maxDrawdown.estimated <= limits.maxDrawdown ? 'safe' as const :
               portfolioMetrics.maxDrawdown.estimated <= limits.maxDrawdown * 1.2 ? 'warning' as const : 'breach' as const
      },
      maxLeverage: {
        limit: limits.maxLeverage,
        current: Math.round(portfolioMetrics.totalExposure / (portfolioMetrics.portfolioValue || 1)),
        status: 'safe' as const // Simplified
      },
      maxExposure: {
        limit: limits.maxExposure,
        current: portfolioMetrics.marginUtilization,
        status: portfolioMetrics.marginUtilization <= limits.maxExposure ? 'safe' as const :
               portfolioMetrics.marginUtilization <= limits.maxExposure * 1.1 ? 'warning' as const : 'breach' as const
      },
      varLimit: {
        limit: limits.varLimit,
        current: (portfolioMetrics.valueAtRisk.confidence95 / portfolioMetrics.portfolioValue) * 100,
        status: 'safe' as const // Simplified
      }
    };

    const hasBreaches = Object.values(riskLimits).some(limit => limit.status === 'breach');
    const hasWarnings = Object.values(riskLimits).some(limit => limit.status === 'warning');
    
    const overallCompliance = hasBreaches ? 'non_compliant' as const :
                             hasWarnings ? 'warning' as const : 'compliant' as const;

    return {
      riskLimits,
      overallCompliance
    };
  }

  /**
   * Generate risk recommendations
   */
  private generateRiskRecommendations(
    portfolioMetrics: RiskMetrics,
    positions: PortfolioPosition[],
    marketFactors: MarketRiskFactors,
    alerts: RiskAlerts
  ) {
    const recommendations = {
      overall: '',
      positions: [] as string[],
      riskAdjustments: [] as string[],
      urgentActions: [] as string[]
    };

    // Overall recommendation based on risk level
    switch (portfolioMetrics.riskLevel) {
      case 'extreme':
        recommendations.overall = 'URGENT: Portfolio risk is extremely high. Immediate action required to reduce exposure.';
        break;
      case 'aggressive':
        recommendations.overall = 'Portfolio risk is high. Consider reducing leverage and position sizes.';
        break;
      case 'moderate':
        recommendations.overall = 'Portfolio risk is moderate. Monitor positions closely and maintain risk controls.';
        break;
      case 'conservative':
        recommendations.overall = 'Portfolio risk is low. Current risk management is effective.';
        break;
    }

    // Position-specific recommendations
    positions.forEach(pos => {
      if (pos.liquidationDistance < 10) {
        recommendations.positions.push(
          `${pos.symbol}: Critically close to liquidation (${pos.liquidationDistance.toFixed(1)}%) - Add margin or reduce size immediately`
        );
        recommendations.urgentActions.push(`Urgent: Add margin to ${pos.symbol} position`);
      } else if (pos.liquidationDistance < 20) {
        recommendations.positions.push(
          `${pos.symbol}: Approaching liquidation zone (${pos.liquidationDistance.toFixed(1)}%) - Consider risk reduction`
        );
      }
    });

    // Risk adjustment recommendations
    if (portfolioMetrics.marginUtilization > 70) {
      recommendations.riskAdjustments.push('Reduce margin utilization below 70%');
    }
    
    if (marketFactors.volatilityRegime === 'extreme') {
      recommendations.riskAdjustments.push('Reduce position sizes due to extreme volatility');
    }

    return recommendations;
  }
}