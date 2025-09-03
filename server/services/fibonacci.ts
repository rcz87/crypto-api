import { CandleData } from "@shared/schema";

export interface SwingPoint {
  price: number;
  timestamp: string;
  index: number;
  type: 'high' | 'low';
  strength: 'weak' | 'moderate' | 'strong';
}

export interface FibonacciLevel {
  level: number; // 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0
  price: number;
  name: string;
  type: 'retracement' | 'extension';
  significance: 'minor' | 'major' | 'critical';
  isRespected: boolean; // Has price respected this level recently
  touchCount: number; // How many times price touched this level
}

export interface FibonacciExtension {
  level: number; // 1.272, 1.618, 2.618
  price: number;
  name: string;
  probability: number; // 0-100% chance of reaching this level
  projection: 'conservative' | 'moderate' | 'aggressive';
}

export interface FibonacciSignal {
  type: 'bounce_support' | 'break_resistance' | 'extension_target' | 'retracement_complete';
  level: FibonacciLevel;
  strength: 'weak' | 'moderate' | 'strong';
  confidence: number;
  description: string;
  timeframe: string;
  timestamp: string;
}

export interface FibonacciAnalysis {
  timeframe: string;
  
  // Current trend analysis
  trend: {
    direction: 'bullish' | 'bearish' | 'sideways';
    strength: 'weak' | 'moderate' | 'strong';
    phase: 'impulse' | 'correction' | 'consolidation';
  };
  
  // Swing points detected
  swingPoints: {
    current: {
      high: SwingPoint;
      low: SwingPoint;
    };
    previous: {
      high: SwingPoint;
      low: SwingPoint;
    };
  };
  
  // Fibonacci levels
  retracements: FibonacciLevel[];
  extensions: FibonacciExtension[];
  
  // Current price analysis
  currentPrice: {
    value: number;
    nearestLevel: FibonacciLevel;
    distanceToLevel: number; // percentage
    position: 'above' | 'below' | 'at';
  };
  
  // Active signals
  signals: FibonacciSignal[];
  
  // Key zones
  keyZones: {
    goldenZone: { // 0.618 - 0.786 area
      start: number;
      end: number;
      strength: 'weak' | 'moderate' | 'strong';
      isActive: boolean;
    };
    institutionalZone: { // 0.705 - 0.79 optimal entry zone
      start: number;
      end: number;
      strength: 'weak' | 'moderate' | 'strong';
      isActive: boolean;
    };
  };
  
  // Confluence analysis
  confluence: {
    score: number; // 0-100
    signals: string[];
    recommendation: string;
    riskLevel: 'low' | 'medium' | 'high';
  };
  
  // Quality metrics
  confidence: {
    overall: number;
    trendQuality: number;
    swingQuality: number;
    levelRespect: number;
    dataPoints: number;
  };
  
  // Metadata
  lastUpdate: string;
  calculationTime: number;
}

export class FibonacciService {
  
  // Standard Fibonacci ratios
  private readonly RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
  private readonly EXTENSION_LEVELS = [1.272, 1.618, 2.618];
  
  /**
   * Detect swing highs and lows with configurable strength
   */
  detectSwingPoints(candles: CandleData[], lookback: number = 5): SwingPoint[] {
    const swingPoints: SwingPoint[] = [];
    
    for (let i = lookback; i < candles.length - lookback; i++) {
      const current = parseFloat(candles[i].high);
      const currentLow = parseFloat(candles[i].low);
      
      // Check for swing high
      let isSwingHigh = true;
      let strengthHigh = 0;
      
      for (let j = 1; j <= lookback; j++) {
        const leftHigh = parseFloat(candles[i - j].high);
        const rightHigh = parseFloat(candles[i + j].high);
        
        if (current <= leftHigh || current <= rightHigh) {
          isSwingHigh = false;
          break;
        }
        strengthHigh++;
      }
      
      if (isSwingHigh) {
        swingPoints.push({
          price: current,
          timestamp: candles[i].timestamp,
          index: i,
          type: 'high',
          strength: strengthHigh > 4 ? 'strong' : strengthHigh > 2 ? 'moderate' : 'weak'
        });
      }
      
      // Check for swing low
      let isSwingLow = true;
      let strengthLow = 0;
      
      for (let j = 1; j <= lookback; j++) {
        const leftLow = parseFloat(candles[i - j].low);
        const rightLow = parseFloat(candles[i + j].low);
        
        if (currentLow >= leftLow || currentLow >= rightLow) {
          isSwingLow = false;
          break;
        }
        strengthLow++;
      }
      
      if (isSwingLow) {
        swingPoints.push({
          price: currentLow,
          timestamp: candles[i].timestamp,
          index: i,
          type: 'low',
          strength: strengthLow > 4 ? 'strong' : strengthLow > 2 ? 'moderate' : 'weak'
        });
      }
    }
    
    return swingPoints.sort((a, b) => b.index - a.index); // Most recent first
  }
  
  /**
   * Calculate Fibonacci retracement levels
   */
  calculateRetracements(high: number, low: number): FibonacciLevel[] {
    const range = high - low;
    const retracements: FibonacciLevel[] = [];
    
    this.RETRACEMENT_LEVELS.forEach(level => {
      const price = high - (range * level);
      
      retracements.push({
        level,
        price: Math.round(price * 100) / 100,
        name: level === 0 ? '0.0% (High)' : 
              level === 1 ? '100% (Low)' : 
              `${(level * 100).toFixed(1)}%`,
        type: 'retracement',
        significance: level === 0.618 || level === 0.786 ? 'critical' : 
                     level === 0.382 || level === 0.5 ? 'major' : 'minor',
        isRespected: false,
        touchCount: 0
      });
    });
    
    return retracements;
  }
  
  /**
   * Calculate Fibonacci extensions
   */
  calculateExtensions(swing1High: number, swing1Low: number, swing2High: number): FibonacciExtension[] {
    const range = swing1High - swing1Low;
    const extensions: FibonacciExtension[] = [];
    
    this.EXTENSION_LEVELS.forEach(level => {
      const price = swing2High + (range * (level - 1));
      
      extensions.push({
        level,
        price: Math.round(price * 100) / 100,
        name: `${(level * 100).toFixed(1)}%`,
        probability: level === 1.272 ? 85 : level === 1.618 ? 70 : 45,
        projection: level === 1.272 ? 'conservative' : level === 1.618 ? 'moderate' : 'aggressive'
      });
    });
    
    return extensions;
  }
  
  /**
   * Analyze how well price respects Fibonacci levels
   */
  analyzeLevelRespect(candles: CandleData[], levels: FibonacciLevel[]): void {
    const recentCandles = candles.slice(-20); // Last 20 candles
    
    levels.forEach(level => {
      let touchCount = 0;
      let respectCount = 0;
      
      recentCandles.forEach(candle => {
        const high = parseFloat(candle.high);
        const low = parseFloat(candle.low);
        const close = parseFloat(candle.close);
        
        // Check if price touched this level (within 0.5% tolerance)
        const tolerance = level.price * 0.005;
        const levelTouched = (low <= level.price + tolerance && high >= level.price - tolerance);
        
        if (levelTouched) {
          touchCount++;
          
          // Check if price respected the level (bounced rather than broke through)
          if (level.significance === 'critical' || level.significance === 'major') {
            const priceMovedAway = Math.abs(close - level.price) > tolerance;
            if (priceMovedAway) {
              respectCount++;
            }
          }
        }
      });
      
      level.touchCount = touchCount;
      level.isRespected = respectCount >= Math.floor(touchCount * 0.6); // 60% respect rate
    });
  }
  
  /**
   * Generate Fibonacci-based trading signals
   */
  generateFibonacciSignals(
    currentPrice: number, 
    levels: FibonacciLevel[], 
    extensions: FibonacciExtension[],
    trend: string,
    timeframe: string
  ): FibonacciSignal[] {
    const signals: FibonacciSignal[] = [];
    const timestamp = new Date().toISOString();
    
    // Find nearest levels
    const nearestSupport = levels
      .filter(l => l.price < currentPrice && l.significance !== 'minor')
      .sort((a, b) => b.price - a.price)[0];
      
    const nearestResistance = levels
      .filter(l => l.price > currentPrice && l.significance !== 'minor')
      .sort((a, b) => a.price - b.price)[0];
    
    // Golden zone analysis (0.618 - 0.786)
    const goldenZoneLevels = levels.filter(l => l.level >= 0.618 && l.level <= 0.786);
    const inGoldenZone = goldenZoneLevels.some(l => 
      Math.abs(currentPrice - l.price) / l.price < 0.01 // Within 1%
    );
    
    if (inGoldenZone && trend === 'bullish') {
      signals.push({
        type: 'bounce_support',
        level: goldenZoneLevels[0],
        strength: 'strong',
        confidence: 85,
        description: 'Price in Golden Zone (61.8%-78.6%) - High probability bullish bounce area',
        timeframe,
        timestamp
      });
    }
    
    // Support bounce signal
    if (nearestSupport && nearestSupport.isRespected) {
      const distance = (currentPrice - nearestSupport.price) / nearestSupport.price;
      if (distance < 0.02) { // Within 2% of support
        signals.push({
          type: 'bounce_support',
          level: nearestSupport,
          strength: nearestSupport.significance === 'critical' ? 'strong' : 'moderate',
          confidence: nearestSupport.touchCount > 2 ? 80 : 65,
          description: `Price approaching respected ${nearestSupport.name} Fibonacci support`,
          timeframe,
          timestamp
        });
      }
    }
    
    // Resistance break signal
    if (nearestResistance) {
      const distance = (nearestResistance.price - currentPrice) / currentPrice;
      if (distance < 0.01) { // Within 1% of resistance
        signals.push({
          type: 'break_resistance',
          level: nearestResistance,
          strength: 'moderate',
          confidence: 70,
          description: `Price testing ${nearestResistance.name} Fibonacci resistance`,
          timeframe,
          timestamp
        });
      }
    }
    
    // Extension target signals
    extensions.forEach(ext => {
      const distance = Math.abs(currentPrice - ext.price) / currentPrice;
      if (distance < 0.05 && trend === 'bullish') { // Within 5% of extension
        signals.push({
          type: 'extension_target',
          level: {
            level: ext.level,
            price: ext.price,
            name: ext.name,
            type: 'extension',
            significance: 'major',
            isRespected: false,
            touchCount: 0
          },
          strength: ext.projection === 'conservative' ? 'strong' : 'moderate',
          confidence: ext.probability,
          description: `Approaching ${ext.name} Fibonacci extension target`,
          timeframe,
          timestamp
        });
      }
    });
    
    return signals;
  }
  
  /**
   * Determine trend phase based on Fibonacci analysis
   */
  analyzeTrendPhase(swingPoints: SwingPoint[], currentPrice: number): {
    direction: 'bullish' | 'bearish' | 'sideways';
    strength: 'weak' | 'moderate' | 'strong';
    phase: 'impulse' | 'correction' | 'consolidation';
  } {
    const recentSwings = swingPoints.slice(0, 6); // Last 6 swing points
    
    if (recentSwings.length < 4) {
      return {
        direction: 'sideways',
        strength: 'weak',
        phase: 'consolidation'
      };
    }
    
    // Analyze swing progression
    const highs = recentSwings.filter(s => s.type === 'high').slice(0, 3);
    const lows = recentSwings.filter(s => s.type === 'low').slice(0, 3);
    
    let direction: 'bullish' | 'bearish' | 'sideways' = 'sideways';
    let strength: 'weak' | 'moderate' | 'strong' = 'weak';
    let phase: 'impulse' | 'correction' | 'consolidation' = 'consolidation';
    
    if (highs.length >= 2 && lows.length >= 2) {
      const isHigherHighs = highs[0].price > highs[1].price;
      const isHigherLows = lows[0].price > lows[1].price;
      const isLowerHighs = highs[0].price < highs[1].price;
      const isLowerLows = lows[0].price < lows[1].price;
      
      if (isHigherHighs && isHigherLows) {
        direction = 'bullish';
        strength = 'strong';
        phase = 'impulse';
      } else if (isLowerHighs && isLowerLows) {
        direction = 'bearish';
        strength = 'strong';
        phase = 'impulse';
      } else if (isHigherLows || isLowerHighs) {
        direction = isHigherLows ? 'bullish' : 'bearish';
        strength = 'moderate';
        phase = 'correction';
      }
    }
    
    return { direction, strength, phase };
  }
  
  /**
   * Main Fibonacci analysis function
   */
  async analyzeFibonacci(
    candles: CandleData[], 
    timeframe: string = '1H'
  ): Promise<FibonacciAnalysis> {
    const startTime = Date.now();
    
    if (candles.length < 20) {
      throw new Error('Insufficient data for Fibonacci analysis');
    }
    
    // Detect swing points
    const swingPoints = this.detectSwingPoints(candles, 5);
    
    if (swingPoints.length < 4) {
      throw new Error('Insufficient swing points for Fibonacci analysis');
    }
    
    // Get most recent swing high and low
    const recentHighs = swingPoints.filter(s => s.type === 'high').slice(0, 2);
    const recentLows = swingPoints.filter(s => s.type === 'low').slice(0, 2);
    
    const currentHigh = recentHighs[0];
    const currentLow = recentLows[0];
    const previousHigh = recentHighs[1] || currentHigh;
    const previousLow = recentLows[1] || currentLow;
    
    // Calculate retracements and extensions
    const retracements = this.calculateRetracements(currentHigh.price, currentLow.price);
    const extensions = this.calculateExtensions(
      previousHigh.price, 
      previousLow.price, 
      currentHigh.price
    );
    
    // Analyze level respect
    this.analyzeLevelRespect(candles, retracements);
    
    // Current price analysis
    const currentPrice = parseFloat(candles[candles.length - 1].close);
    const nearestLevel = [...retracements, ...extensions.map(e => ({
      level: e.level,
      price: e.price,
      name: e.name,
      type: 'extension' as const,
      significance: 'major' as const,
      isRespected: false,
      touchCount: 0
    }))]
      .sort((a, b) => Math.abs(a.price - currentPrice) - Math.abs(b.price - currentPrice))[0];
    
    const distanceToLevel = Math.abs(currentPrice - nearestLevel.price) / currentPrice * 100;
    
    // Trend analysis
    const trend = this.analyzeTrendPhase(swingPoints, currentPrice);
    
    // Generate signals
    const signals = this.generateFibonacciSignals(
      currentPrice, 
      retracements, 
      extensions, 
      trend.direction, 
      timeframe
    );
    
    // Calculate key zones
    const goldenZoneStart = retracements.find(l => l.level === 0.618)?.price || currentPrice;
    const goldenZoneEnd = retracements.find(l => l.level === 0.786)?.price || currentPrice;
    
    const institutionalZoneStart = goldenZoneStart + (goldenZoneEnd - goldenZoneStart) * 0.3;
    const institutionalZoneEnd = goldenZoneStart + (goldenZoneEnd - goldenZoneStart) * 0.7;
    
    // Confluence analysis
    const confluenceSignals = signals.map(s => s.description);
    const confluenceScore = Math.min(95, 
      (signals.length * 15) + 
      (retracements.filter(l => l.isRespected).length * 10) +
      (trend.strength === 'strong' ? 25 : trend.strength === 'moderate' ? 15 : 5)
    );
    
    const calculationTime = Date.now() - startTime;
    
    return {
      timeframe,
      trend,
      swingPoints: {
        current: { high: currentHigh, low: currentLow },
        previous: { high: previousHigh, low: previousLow }
      },
      retracements,
      extensions,
      currentPrice: {
        value: currentPrice,
        nearestLevel,
        distanceToLevel: Math.round(distanceToLevel * 100) / 100,
        position: currentPrice > nearestLevel.price ? 'above' : 
                 currentPrice < nearestLevel.price ? 'below' : 'at'
      },
      signals,
      keyZones: {
        goldenZone: {
          start: Math.min(goldenZoneStart, goldenZoneEnd),
          end: Math.max(goldenZoneStart, goldenZoneEnd),
          strength: trend.strength,
          isActive: currentPrice >= Math.min(goldenZoneStart, goldenZoneEnd) && 
                   currentPrice <= Math.max(goldenZoneStart, goldenZoneEnd)
        },
        institutionalZone: {
          start: Math.min(institutionalZoneStart, institutionalZoneEnd),
          end: Math.max(institutionalZoneStart, institutionalZoneEnd),
          strength: trend.strength,
          isActive: currentPrice >= Math.min(institutionalZoneStart, institutionalZoneEnd) && 
                   currentPrice <= Math.max(institutionalZoneStart, institutionalZoneEnd)
        }
      },
      confluence: {
        score: confluenceScore,
        signals: confluenceSignals,
        recommendation: this.generateRecommendation(signals, trend, confluenceScore),
        riskLevel: confluenceScore > 70 ? 'low' : confluenceScore > 40 ? 'medium' : 'high'
      },
      confidence: {
        overall: Math.min(95, swingPoints.length * 8 + (candles.length > 50 ? 20 : 10)),
        trendQuality: trend.strength === 'strong' ? 90 : trend.strength === 'moderate' ? 70 : 50,
        swingQuality: Math.min(95, swingPoints.filter(s => s.strength !== 'weak').length * 12),
        levelRespect: Math.round(retracements.filter(l => l.isRespected).length / retracements.length * 100),
        dataPoints: candles.length
      },
      lastUpdate: new Date().toISOString(),
      calculationTime
    };
  }
  
  private generateRecommendation(signals: FibonacciSignal[], trend: any, confluenceScore: number): string {
    if (signals.length === 0) {
      return "No clear Fibonacci signals detected. Monitor price action around key levels.";
    }
    
    const strongSignals = signals.filter(s => s.strength === 'strong');
    const highConfidenceSignals = signals.filter(s => s.confidence > 75);
    
    if (strongSignals.length > 0 && trend.direction !== 'sideways') {
      const primarySignal = strongSignals[0];
      
      if (primarySignal.type === 'bounce_support') {
        return `Strong Fibonacci support detected at ${primarySignal.level.name}. ${trend.direction === 'bullish' ? 'Consider long entries' : 'Watch for reversal'} with tight stops below key level.`;
      } else if (primarySignal.type === 'extension_target') {
        return `Approaching ${primarySignal.level.name} Fibonacci extension. Consider taking partial profits and tightening stops.`;
      }
    }
    
    if (confluenceScore > 60) {
      return `Multiple Fibonacci levels converging with ${confluenceScore}% confluence. High-probability setup developing.`;
    }
    
    return "Mixed Fibonacci signals. Wait for clearer price confirmation before entering positions.";
  }
}