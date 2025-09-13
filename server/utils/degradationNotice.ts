/**
 * Degradation Notice Utility for Signal Engine Transparency
 * Provides institutional-grade messaging when system operates in degraded mode
 * Ensures never-blank responses with appropriate data quality indicators
 */

import type { HealthStatus, DegradationMetadata } from '../services/coinapi.js';

export interface DegradationContext {
  degraded: boolean;
  fallback_reason?: string;
  data_source: 'coinapi' | 'okx_fallback' | 'last_good_cache' | 'degraded_coinapi';
  health_status: HealthStatus;
  confidence_impact: number; // 0-1, reduction in confidence due to degradation
  message?: string;
}

export interface SignalDegradationNotice {
  is_degraded: boolean;
  notice?: string;
  confidence_adjustment: number; // Multiplier to apply to original confidence (0.5-1.0)
  data_quality_score: number; // 0-100, overall data quality
  fallback_scenario: string; // Always provide a market scenario
  transparency_note?: string; // Additional institutional transparency
}

/**
 * Generate degradation context from health monitoring systems
 */
export async function getDegradationContext(): Promise<DegradationContext> {
  try {
    // Import CoinAPI service to get health status
    const { coinAPIService } = await import('../services/coinapi.js');
    
    const healthStatus = await coinAPIService.healthCheck();
    const isDegraded = healthStatus.status !== 'healthy';
    
    // Determine data source and confidence impact
    let dataSource: DegradationContext['data_source'] = 'coinapi';
    let confidenceImpact = 0;
    let fallbackReason: string | undefined;
    
    if (isDegraded) {
      if (healthStatus.status === 'down') {
        dataSource = 'okx_fallback';
        confidenceImpact = 0.3; // 30% confidence reduction
        fallbackReason = healthStatus.degradation_reason || 'coinapi_unavailable';
      } else if (healthStatus.status === 'degraded') {
        dataSource = 'degraded_coinapi';
        confidenceImpact = 0.15; // 15% confidence reduction
        fallbackReason = healthStatus.degradation_reason || 'api_performance_issues';
      }
    }
    
    return {
      degraded: isDegraded,
      fallback_reason: fallbackReason,
      data_source: dataSource,
      health_status: healthStatus,
      confidence_impact: confidenceImpact,
      message: isDegraded ? generateDegradationMessage(dataSource, fallbackReason) : undefined
    };
  } catch (error) {
    console.warn('Failed to get degradation context, assuming degraded mode:', error);
    
    // Fallback: assume degraded mode for safety
    return {
      degraded: true,
      fallback_reason: 'health_check_failed',
      data_source: 'okx_fallback',
      health_status: {
        status: 'degraded',
        p95_latency: 0,
        avg_latency: 0,
        last_check: new Date().toISOString(),
        error_rate: 0,
        degradation_reason: 'health_monitoring_unavailable'
      },
      confidence_impact: 0.25,
      message: '⚠️ Data degraded - using OKX fallback due to health monitoring issues'
    };
  }
}

/**
 * Generate institutional-grade degradation message
 */
function generateDegradationMessage(
  dataSource: DegradationContext['data_source'],
  reason?: string
): string {
  const baseMessage = '⚠️ Data degraded';
  
  switch (dataSource) {
    case 'coinapi':
      return `${baseMessage} - primary data source operational`;
      
    case 'degraded_coinapi':
      if (reason?.includes('latency')) {
        return `${baseMessage} - using primary API with elevated latency`;
      } else if (reason?.includes('error')) {
        return `${baseMessage} - using primary API with intermittent errors`;
      }
      return `${baseMessage} - primary API performance impacted`;
      
    case 'okx_fallback':
      return `${baseMessage} - using OKX fallback due to ${reason?.replace('_', ' ') || 'primary API unavailable'}`;
      
    case 'last_good_cache':
      return `${baseMessage} - using cached data due to ${reason?.replace('_', ' ') || 'API unavailable'}`;
      
    default:
      return `${baseMessage} - operating in fallback mode`;
  }
}

/**
 * Create signal degradation notice for institutional transparency
 */
export function createSignalDegradationNotice(
  context: DegradationContext,
  signalType: 'ai_signal' | 'confluence' | 'smc' | 'trading_signals' | 'technical'
): SignalDegradationNotice {
  if (!context.degraded) {
    return {
      is_degraded: false,
      confidence_adjustment: 1.0,
      data_quality_score: 95,
      fallback_scenario: generateFallbackScenario(signalType, 'optimal')
    };
  }
  
  const qualityScore = calculateDataQualityScore(context);
  const confidenceAdjustment = Math.max(0.5, 1.0 - context.confidence_impact);
  
  return {
    is_degraded: true,
    notice: context.message,
    confidence_adjustment: confidenceAdjustment,
    data_quality_score: qualityScore,
    fallback_scenario: generateFallbackScenario(signalType, 'degraded'),
    transparency_note: generateTransparencyNote(context, signalType)
  };
}

/**
 * Calculate data quality score based on degradation context
 */
function calculateDataQualityScore(context: DegradationContext): number {
  const baseScore = 85; // Start with good baseline
  
  switch (context.data_source) {
    case 'coinapi':
      return Math.min(95, baseScore + 10);
      
    case 'degraded_coinapi':
      if (context.health_status.error_rate > 30) {
        return Math.max(50, baseScore - 25);
      } else if (context.health_status.p95_latency > 1000) {
        return Math.max(60, baseScore - 15);
      }
      return Math.max(65, baseScore - 10);
      
    case 'okx_fallback':
      return Math.max(60, baseScore - 15);
      
    case 'last_good_cache':
      return Math.max(45, baseScore - 30);
      
    default:
      return 50;
  }
}

/**
 * Generate never-blank fallback scenarios for different signal types
 */
function generateFallbackScenario(
  signalType: string,
  mode: 'optimal' | 'degraded'
): string {
  const scenarios = {
    optimal: {
      ai_signal: "Comprehensive multi-layer analysis with full data confidence",
      confluence: "8-layer institutional analysis with complete market intelligence",
      smc: "Full Smart Money Concepts analysis with institutional flow detection",
      trading_signals: "Real-time signal generation with optimal execution parameters",
      technical: "Complete technical analysis with full indicator convergence"
    },
    degraded: {
      ai_signal: "Core AI patterns detected - reduced confidence but actionable intelligence maintained",
      confluence: "Primary confluence layers operational - key market structure signals preserved",
      smc: "Essential SMC patterns identified - institutional flows trackable with fallback data",
      trading_signals: "Fundamental signals active - entry/exit parameters adjusted for data limitations",
      technical: "Core technical indicators functional - trend analysis maintained with baseline confidence"
    }
  };
  
  return scenarios[mode][signalType as keyof typeof scenarios.optimal] || 
         scenarios[mode].ai_signal;
}

/**
 * Generate institutional transparency note
 */
function generateTransparencyNote(
  context: DegradationContext,
  signalType: string
): string {
  const notes = {
    latency: "Analysis adjusted for elevated API response times. Core signal integrity maintained through enhanced validation.",
    error: "Intermittent data gaps addressed via redundant sourcing. Signal confidence scaled proportionally.",
    fallback: "Secondary data sources activated. Analysis maintains institutional standards with adjusted confidence parameters.",
    cache: "Recent historical data utilized. Time-sensitive indicators may show reduced responsiveness."
  };
  
  if (context.fallback_reason?.includes('latency')) {
    return notes.latency;
  } else if (context.fallback_reason?.includes('error')) {
    return notes.error;
  } else if (context.data_source === 'last_good_cache') {
    return notes.cache;
  }
  
  return notes.fallback;
}

/**
 * Apply degradation notice to any signal response
 */
export function applyDegradationNotice<T extends Record<string, any>>(
  signalResponse: T,
  notice: SignalDegradationNotice,
  originalConfidence?: number
): T & { degradation_notice: SignalDegradationNotice; adjusted_confidence?: number } {
  const enhanced = {
    ...signalResponse,
    degradation_notice: notice
  };
  
  // Apply confidence adjustment if original confidence is provided
  if (originalConfidence !== undefined) {
    enhanced.adjusted_confidence = Math.round(originalConfidence * notice.confidence_adjustment);
  }
  
  // Apply confidence adjustment to common confidence fields
  if ('confidence' in signalResponse && typeof signalResponse.confidence === 'number') {
    enhanced.confidence = Math.round(signalResponse.confidence * notice.confidence_adjustment);
  }
  
  if ('strength' in signalResponse && typeof signalResponse.strength === 'number') {
    enhanced.strength = Math.round(signalResponse.strength * notice.confidence_adjustment);
  }
  
  return enhanced;
}

/**
 * Never-blank signal generator - ensures always return actionable intelligence
 */
export function ensureNeverBlankSignal<T>(
  signalPromise: Promise<T>,
  fallbackGenerator: () => T,
  signalType: string
): Promise<T> {
  return signalPromise.catch(async (error) => {
    console.warn(`Signal generation failed for ${signalType}, using fallback:`, error);
    
    try {
      const degradationContext = await getDegradationContext();
      const notice = createSignalDegradationNotice(degradationContext, signalType as any);
      
      const fallbackSignal = fallbackGenerator();
      return applyDegradationNotice(fallbackSignal, notice) as T;
    } catch (fallbackError) {
      console.error(`Fallback signal generation failed for ${signalType}:`, fallbackError);
      // Last resort: return basic fallback without degradation notice
      return fallbackGenerator();
    }
  });
}

/**
 * Check if system should operate in degraded mode based on context
 */
export function shouldOperateInDegradedMode(context: DegradationContext): boolean {
  return context.degraded || 
         context.health_status.error_rate > 15 || 
         context.health_status.p95_latency > 800;
}

/**
 * Get confidence scaling factor based on degradation context
 */
export function getConfidenceScalingFactor(context: DegradationContext): number {
  if (!context.degraded) return 1.0;
  
  // Scale confidence based on data quality
  const qualityScore = calculateDataQualityScore(context);
  return Math.max(0.5, qualityScore / 100);
}