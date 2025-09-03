import { CandleData } from '@shared/schema';

// Position Calculator Types
export interface PositionParams {
  entryPrice: number;
  currentPrice?: number;
  size: number; // Contract size
  leverage: number; // 1x to 100x
  side: 'long' | 'short';
  marginMode: 'isolated' | 'cross';
}

export interface MarginCalculation {
  initialMargin: number;
  maintenanceMargin: number;
  freeMargin: number;
  marginRatio: number;
  liquidationPrice: number;
  marginCall: number; // Price at which margin call occurs
}

export interface PnLCalculation {
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  pnlPercentage: number;
  roe: number; // Return on Equity
}

export interface RiskMetrics {
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  liquidationDistance: number; // Distance to liquidation in %
  timeToLiquidation?: number; // Estimated time if current trend continues
  maxDrawdown: number;
  sharpeRatio: number;
  valueAtRisk: number; // VaR 95%
}

export interface PositionSizing {
  optimalSize: number;
  maxSafeSize: number;
  kellySize: number; // Kelly Criterion
  fixedRatioSize: number;
  riskPercentage: number;
}

export interface LeverageAnalysis {
  currentLeverage: number;
  effectiveLeverage: number;
  maxSafeLeverage: number;
  leverageRisk: 'low' | 'medium' | 'high' | 'extreme';
  recommendations: string[];
}

export interface PositionCalculatorResult {
  position: PositionParams;
  margin: MarginCalculation;
  pnl: PnLCalculation;
  risk: RiskMetrics;
  sizing: PositionSizing;
  leverage: LeverageAnalysis;
  scenarios: {
    bullish: { price: number; pnl: number; margin: number };
    bearish: { price: number; pnl: number; margin: number };
    liquidation: { price: number; time?: number };
  };
  recommendations: {
    action: 'hold' | 'reduce' | 'close' | 'add';
    reason: string;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
}

export class PositionCalculatorService {
  private okxService: any;
  private CONTRACT_SIZE = 1; // SOL contract size
  private MAKER_FEE = 0.0002; // 0.02%
  private TAKER_FEE = 0.0005; // 0.05%
  private FUNDING_FEE = 0.0001; // Estimated daily funding

  constructor(okxService?: any) {
    this.okxService = okxService;
  }

  /**
   * Calculate comprehensive position metrics
   */
  async calculatePosition(params: PositionParams, accountBalance: number = 10000): Promise<PositionCalculatorResult> {
    try {
      console.log('Starting position calculation with params:', params);
      
      // Use entry price as current price if not provided (fallback)
      const currentPrice = params.currentPrice || params.entryPrice;
      console.log('Using current price:', currentPrice);
      
      // Calculate margin requirements
      console.log('Calculating margin...');
      const margin = this.calculateMargin(params, accountBalance);
      console.log('Margin calculated:', margin);
      
      // Calculate PnL
      console.log('Calculating PnL...');
      const pnl = this.calculatePnL(params, currentPrice);
      console.log('PnL calculated:', pnl);
      
      // Calculate risk metrics
      console.log('Calculating risk metrics...');
      const risk = this.calculateRiskMetrics(params, currentPrice, accountBalance, margin);
      console.log('Risk calculated:', risk);
      
      // Calculate optimal position sizing
      console.log('Calculating position sizing...');
      const sizing = this.calculatePositionSizing(params, accountBalance, risk);
      console.log('Sizing calculated:', sizing);
      
      // Analyze leverage
      console.log('Analyzing leverage...');
      const leverage = this.analyzeLeverage(params, risk, margin);
      console.log('Leverage analyzed:', leverage);
      
      // Generate scenarios
      console.log('Generating scenarios...');
      const scenarios = this.generateScenarios(params, currentPrice);
      console.log('Scenarios generated:', scenarios);
      
      // Generate recommendations
      console.log('Generating recommendations...');
      const recommendations = this.generateRecommendations(params, risk, margin, pnl);
      console.log('Recommendations generated:', recommendations);

      const result = {
        position: { ...params, currentPrice },
        margin,
        pnl,
        risk,
        sizing,
        leverage,
        scenarios,
        recommendations
      };
      
      console.log('Position calculation completed successfully');
      return result;

    } catch (error) {
      console.error('Error in position calculation:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        params,
        accountBalance
      });
      throw new Error(`Failed to calculate position metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate margin requirements and liquidation price
   */
  private calculateMargin(params: PositionParams, accountBalance: number): MarginCalculation {
    const notionalValue = params.size * params.entryPrice;
    const initialMarginRate = 1 / params.leverage;
    const maintenanceMarginRate = initialMarginRate * 0.5; // Typical 50% of initial margin

    const initialMargin = notionalValue * initialMarginRate;
    const maintenanceMargin = notionalValue * maintenanceMarginRate;
    const freeMargin = accountBalance - initialMargin;
    const marginRatio = maintenanceMargin / accountBalance;

    // Calculate liquidation price
    const liquidationPrice = this.calculateLiquidationPrice(params, maintenanceMarginRate);
    
    // Calculate margin call price (80% of liquidation distance)
    const marginCallPrice = params.side === 'long' 
      ? params.entryPrice - (params.entryPrice - liquidationPrice) * 0.8
      : params.entryPrice + (liquidationPrice - params.entryPrice) * 0.8;

    return {
      initialMargin,
      maintenanceMargin,
      freeMargin,
      marginRatio,
      liquidationPrice,
      marginCall: marginCallPrice
    };
  }

  /**
   * Calculate liquidation price with fees
   */
  private calculateLiquidationPrice(params: PositionParams, mmr: number): number {
    const { entryPrice, leverage, side } = params;
    
    if (side === 'long') {
      return entryPrice * (1 - 1/leverage + mmr + this.TAKER_FEE);
    } else {
      return entryPrice * (1 + 1/leverage - mmr - this.TAKER_FEE);
    }
  }

  /**
   * Calculate PnL metrics
   */
  private calculatePnL(params: PositionParams, currentPrice: number): PnLCalculation {
    const { entryPrice, size, side } = params;
    
    let unrealizedPnL = 0;
    if (side === 'long') {
      unrealizedPnL = (currentPrice - entryPrice) * size;
    } else {
      unrealizedPnL = (entryPrice - currentPrice) * size;
    }

    const notionalValue = size * entryPrice;
    const pnlPercentage = (unrealizedPnL / notionalValue) * 100;
    
    // ROE calculation (Return on Equity)
    const initialMargin = notionalValue / params.leverage;
    const roe = (unrealizedPnL / initialMargin) * 100;

    return {
      unrealizedPnL,
      realizedPnL: 0, // Would be tracked separately
      totalPnL: unrealizedPnL,
      pnlPercentage,
      roe
    };
  }

  /**
   * Calculate comprehensive risk metrics
   */
  private calculateRiskMetrics(params: PositionParams, currentPrice: number, accountBalance: number, margin: MarginCalculation): RiskMetrics {
    // Calculate liquidation distance
    const liquidationDistance = Math.abs((currentPrice - margin.liquidationPrice) / currentPrice) * 100;
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'extreme';
    if (liquidationDistance > 50) riskLevel = 'low';
    else if (liquidationDistance > 20) riskLevel = 'medium';
    else if (liquidationDistance > 10) riskLevel = 'high';
    else riskLevel = 'extreme';

    // Estimate max drawdown based on leverage
    const maxDrawdown = Math.min(100 / params.leverage * 2, 100);
    
    // Simple Sharpe ratio estimation (would need historical data for accurate calculation)
    const sharpeRatio = riskLevel === 'low' ? 1.5 : riskLevel === 'medium' ? 1.0 : 0.5;
    
    // Value at Risk (95% confidence)
    const valueAtRisk = accountBalance * (params.leverage / 100) * 1.65; // 1.65 for 95% VaR

    return {
      riskLevel,
      liquidationDistance,
      maxDrawdown,
      sharpeRatio,
      valueAtRisk
    };
  }

  /**
   * Calculate optimal position sizing
   */
  private calculatePositionSizing(params: PositionParams, accountBalance: number, risk: RiskMetrics): PositionSizing {
    // Kelly Criterion (simplified)
    const winRate = 0.55; // Assume 55% win rate
    const avgWin = 0.02; // 2% average win
    const avgLoss = 0.015; // 1.5% average loss
    const kellyPercent = winRate - ((1 - winRate) / (avgWin / avgLoss));
    const kellySize = (accountBalance * kellyPercent) / params.entryPrice;

    // Fixed Ratio sizing
    const riskPercent = 0.02; // 2% risk per trade
    const fixedRatioSize = (accountBalance * riskPercent) / params.entryPrice;

    // Maximum safe size based on liquidation risk
    const maxSafeSize = accountBalance * 0.1 / params.entryPrice; // Max 10% of account

    // Optimal size considering risk level
    const riskMultiplier = risk.riskLevel === 'low' ? 1.0 : 
                          risk.riskLevel === 'medium' ? 0.7 : 
                          risk.riskLevel === 'high' ? 0.4 : 0.2;
    
    const optimalSize = Math.min(kellySize, fixedRatioSize) * riskMultiplier;

    return {
      optimalSize: Math.max(0, optimalSize),
      maxSafeSize,
      kellySize: Math.max(0, kellySize),
      fixedRatioSize,
      riskPercentage: (optimalSize * params.entryPrice / accountBalance) * 100
    };
  }

  /**
   * Analyze leverage efficiency and safety
   */
  private analyzeLeverage(params: PositionParams, risk: RiskMetrics, margin: MarginCalculation): LeverageAnalysis {
    const { leverage } = params;
    
    // Calculate effective leverage based on position size
    const effectiveLeverage = leverage;
    
    // Determine maximum safe leverage based on risk tolerance
    const maxSafeLeverage = risk.liquidationDistance > 50 ? Math.min(leverage * 1.5, 20) :
                           risk.liquidationDistance > 20 ? Math.min(leverage, 10) :
                           Math.min(leverage * 0.5, 5);

    // Determine leverage risk
    let leverageRisk: 'low' | 'medium' | 'high' | 'extreme';
    if (leverage <= 5) leverageRisk = 'low';
    else if (leverage <= 15) leverageRisk = 'medium';
    else if (leverage <= 50) leverageRisk = 'high';
    else leverageRisk = 'extreme';

    // Generate recommendations
    const recommendations: string[] = [];
    if (leverage > maxSafeLeverage) {
      recommendations.push(`Consider reducing leverage to ${maxSafeLeverage.toFixed(1)}x for better risk management`);
    }
    if (risk.liquidationDistance < 20) {
      recommendations.push('Position is close to liquidation - consider reducing size or adding margin');
    }
    if (leverage > 20) {
      recommendations.push('High leverage detected - ensure proper risk management');
    }

    return {
      currentLeverage: leverage,
      effectiveLeverage,
      maxSafeLeverage,
      leverageRisk,
      recommendations
    };
  }

  /**
   * Generate price scenarios
   */
  private generateScenarios(params: PositionParams, currentPrice: number) {
    const { entryPrice, size, side } = params;
    
    // Bullish scenario (+10%)
    const bullishPrice = currentPrice * 1.1;
    const bullishPnL = side === 'long' 
      ? (bullishPrice - entryPrice) * size
      : (entryPrice - bullishPrice) * size;
    
    // Bearish scenario (-10%)
    const bearishPrice = currentPrice * 0.9;
    const bearishPnL = side === 'long'
      ? (bearishPrice - entryPrice) * size
      : (entryPrice - bearishPrice) * size;

    // Liquidation scenario
    const liquidationPrice = this.calculateLiquidationPrice(params, 0.5 / params.leverage);

    return {
      bullish: {
        price: bullishPrice,
        pnl: bullishPnL,
        margin: (size * bullishPrice) / params.leverage
      },
      bearish: {
        price: bearishPrice,
        pnl: bearishPnL,
        margin: (size * bearishPrice) / params.leverage
      },
      liquidation: {
        price: liquidationPrice
      }
    };
  }

  /**
   * Generate trading recommendations
   */
  private generateRecommendations(params: PositionParams, risk: RiskMetrics, margin: MarginCalculation, pnl: PnLCalculation) {
    let action: 'hold' | 'reduce' | 'close' | 'add' = 'hold';
    let reason = 'Position within normal risk parameters';
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Critical situations
    if (risk.liquidationDistance < 5) {
      action = 'close';
      reason = 'Liquidation risk extremely high - immediate action required';
      urgency = 'critical';
    } else if (risk.liquidationDistance < 15) {
      action = 'reduce';
      reason = 'Position approaching liquidation zone';
      urgency = 'high';
    } else if (risk.riskLevel === 'extreme') {
      action = 'reduce';
      reason = 'Risk level too high for current market conditions';
      urgency = 'high';
    } else if (pnl.roe > 50) {
      action = 'reduce';
      reason = 'Consider taking profits - excellent ROE achieved';
      urgency = 'medium';
    } else if (pnl.roe < -30) {
      action = 'close';
      reason = 'Significant losses - consider cutting position';
      urgency = 'medium';
    } else if (risk.liquidationDistance > 50 && pnl.roe > 0) {
      action = 'hold';
      reason = 'Position showing profit with good risk management';
      urgency = 'low';
    }

    return {
      action,
      reason,
      urgency
    };
  }

  /**
   * Quick liquidation price calculator
   */
  async getQuickLiquidationPrice(entryPrice: number, leverage: number, side: 'long' | 'short'): Promise<number> {
    const mmr = 0.5 / leverage; // Maintenance margin rate
    return this.calculateLiquidationPrice({ entryPrice, leverage, side } as PositionParams, mmr);
  }

  /**
   * Calculate required margin for a position
   */
  calculateRequiredMargin(size: number, price: number, leverage: number): number {
    return (size * price) / leverage;
  }

  /**
   * Calculate maximum position size for given account balance
   */
  calculateMaxPositionSize(accountBalance: number, price: number, leverage: number, riskPercent: number = 0.02): number {
    const maxRiskAmount = accountBalance * riskPercent;
    return maxRiskAmount * leverage / price;
  }
}