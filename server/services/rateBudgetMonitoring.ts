/**
 * Comprehensive Monitoring and Observability for Rate Budget System
 * 
 * Tracks usage patterns, violations, and system health for rate coordination
 */

import { EventEmitter } from 'events';
import { getRateBudgetManager } from './rateBudget';
import { MONITORING } from '../config/rateLimitConfig';
import type { Provider, UseCase, BudgetStatus, RateLimitViolation } from './rateBudget';

export interface RateBudgetMetrics {
  timestamp: number;
  provider: Provider;
  useCase: UseCase;
  budgetUsed: number;
  budgetAllocated: number;
  budgetRemaining: number;
  utilizationPercentage: number;
}

export interface SystemHealthReport {
  overall_health: 'healthy' | 'degraded' | 'critical';
  providers: {
    [key in Provider]: {
      status: 'healthy' | 'degraded' | 'critical';
      utilization: number;
      violations_last_hour: number;
      budget_remaining: number;
    }
  };
  violations_last_24h: number;
  top_violating_use_cases: Array<{
    provider: Provider;
    useCase: UseCase;
    violations: number;
  }>;
  recommendations: string[];
}

export interface AlertEvent {
  type: 'low_budget' | 'critical_budget' | 'rate_violation' | 'system_degraded';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  provider?: Provider;
  useCase?: UseCase;
  metadata?: Record<string, any>;
  timestamp: number;
}

class RateBudgetMonitor extends EventEmitter {
  private metrics: RateBudgetMetrics[] = [];
  private maxMetricsHistory = 10000; // Keep 10k metrics points
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastViolationCheck = Date.now();
  
  constructor() {
    super();
    this.startHealthMonitoring();
  }

  /**
   * Record usage metrics for tracking and analysis
   */
  recordUsage(provider: Provider, useCase: UseCase, budgetStatus: BudgetStatus): void {
    const utilizationPercentage = budgetStatus.allocated > 0 
      ? ((budgetStatus.used / budgetStatus.allocated) * 100) 
      : 0;

    const metric: RateBudgetMetrics = {
      timestamp: Date.now(),
      provider,
      useCase,
      budgetUsed: budgetStatus.used,
      budgetAllocated: budgetStatus.allocated,
      budgetRemaining: budgetStatus.remaining,
      utilizationPercentage
    };

    this.metrics.push(metric);

    // Clean up old metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory / 2);
    }

    // Check for alert conditions
    this.checkAlertConditions(metric);

    // Log if enabled
    if (MONITORING.ENABLE_RATE_LIMIT_LOGGING) {
      console.log(`[RateBudgetMonitor] ${provider}:${useCase} - Used: ${budgetStatus.used}/${budgetStatus.allocated} (${utilizationPercentage.toFixed(1)}%)`);
    }
  }

  /**
   * Generate comprehensive system health report
   */
  generateHealthReport(): SystemHealthReport {
    const rateBudgetManager = getRateBudgetManager();
    const allStatuses = rateBudgetManager.getAllBudgetStatus();
    const recentViolations = rateBudgetManager.getRecentViolations(100);
    const stats = rateBudgetManager.getStats();

    // Calculate provider-level health
    const providers: SystemHealthReport['providers'] = {
      okx: this.calculateProviderHealth('okx', allStatuses, recentViolations),
      coinglass: this.calculateProviderHealth('coinglass', allStatuses, recentViolations),
      coinapi: this.calculateProviderHealth('coinapi', allStatuses, recentViolations)
    };

    // Overall system health
    const providerHealthScores = Object.values(providers).map(p => 
      p.status === 'healthy' ? 3 : p.status === 'degraded' ? 2 : 1
    );
    const avgHealthScore = providerHealthScores.reduce((sum, score) => sum + score, 0) / providerHealthScores.length;
    
    const overall_health = avgHealthScore >= 2.5 ? 'healthy' : avgHealthScore >= 1.5 ? 'degraded' : 'critical';

    // Top violating use cases
    const violationCounts = new Map<string, { provider: Provider; useCase: UseCase; violations: number }>();
    
    recentViolations.forEach(violation => {
      const key = `${violation.provider}:${violation.useCase}`;
      const existing = violationCounts.get(key);
      if (existing) {
        existing.violations++;
      } else {
        violationCounts.set(key, {
          provider: violation.provider,
          useCase: violation.useCase,
          violations: 1
        });
      }
    });

    const top_violating_use_cases = Array.from(violationCounts.values())
      .sort((a, b) => b.violations - a.violations)
      .slice(0, 5);

    // Generate recommendations
    const recommendations = this.generateRecommendations(providers, stats, top_violating_use_cases);

    return {
      overall_health,
      providers,
      violations_last_24h: stats.violationsLast24h,
      top_violating_use_cases,
      recommendations
    };
  }

  /**
   * Get usage metrics for a specific time period
   */
  getMetrics(hours: number = 1): RateBudgetMetrics[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.metrics.filter(metric => metric.timestamp > cutoff);
  }

  /**
   * Get utilization trends for monitoring dashboards
   */
  getUtilizationTrends(provider: Provider, hours: number = 24): {
    provider: Provider;
    dataPoints: Array<{
      timestamp: number;
      totalUtilization: number;
      useCaseBreakdown: Record<UseCase, number>;
    }>;
  } {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    const providerMetrics = this.metrics.filter(m => 
      m.provider === provider && m.timestamp > cutoff
    );

    // Group by 15-minute windows
    const windowSize = 15 * 60 * 1000; // 15 minutes
    const windows = new Map<number, RateBudgetMetrics[]>();

    providerMetrics.forEach(metric => {
      const windowStart = Math.floor(metric.timestamp / windowSize) * windowSize;
      const windowMetrics = windows.get(windowStart) || [];
      windowMetrics.push(metric);
      windows.set(windowStart, windowMetrics);
    });

    const dataPoints = Array.from(windows.entries()).map(([timestamp, metrics]) => {
      const totalUtilization = metrics.reduce((sum, m) => sum + m.utilizationPercentage, 0) / metrics.length;
      
      const useCaseBreakdown: Record<string, number> = {};
      metrics.forEach(metric => {
        useCaseBreakdown[metric.useCase] = metric.utilizationPercentage;
      });

      return {
        timestamp,
        totalUtilization,
        useCaseBreakdown: useCaseBreakdown as Record<UseCase, number>
      };
    });

    return {
      provider,
      dataPoints: dataPoints.sort((a, b) => a.timestamp - b.timestamp)
    };
  }

  /**
   * Start health monitoring with periodic checks
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, MONITORING.HEALTH_CHECK_INTERVAL_MS);

    console.log(`[RateBudgetMonitor] Health monitoring started (${MONITORING.HEALTH_CHECK_INTERVAL_MS}ms interval)`);
  }

  /**
   * Perform periodic health checks
   */
  private performHealthCheck(): void {
    const healthReport = this.generateHealthReport();
    
    // Emit health report for other systems to consume
    this.emit('healthReport', healthReport);
    
    // Check for system-level alerts
    if (healthReport.overall_health === 'critical') {
      this.emitAlert({
        type: 'system_degraded',
        severity: 'critical',
        message: `System health critical: ${healthReport.recommendations.join(', ')}`,
        timestamp: Date.now()
      });
    } else if (healthReport.overall_health === 'degraded') {
      this.emitAlert({
        type: 'system_degraded',
        severity: 'warning',
        message: `System health degraded: ${healthReport.recommendations.join(', ')}`,
        timestamp: Date.now()
      });
    }

    // Log health status
    if (MONITORING.ENABLE_RATE_LIMIT_LOGGING) {
      console.log(`[RateBudgetMonitor] Health: ${healthReport.overall_health} - Violations(24h): ${healthReport.violations_last_24h}`);
    }
  }

  /**
   * Check individual metric for alert conditions
   */
  private checkAlertConditions(metric: RateBudgetMetrics): void {
    const utilization = metric.utilizationPercentage / 100;

    // Low budget alert
    if (utilization >= (1 - MONITORING.LOW_BUDGET_THRESHOLD) && utilization < (1 - MONITORING.CRITICAL_BUDGET_THRESHOLD)) {
      this.emitAlert({
        type: 'low_budget',
        severity: 'warning',
        message: `Low budget warning: ${metric.provider}:${metric.useCase} at ${metric.utilizationPercentage.toFixed(1)}% utilization`,
        provider: metric.provider,
        useCase: metric.useCase,
        metadata: { utilization: metric.utilizationPercentage, remaining: metric.budgetRemaining },
        timestamp: metric.timestamp
      });
    }

    // Critical budget alert
    if (utilization >= (1 - MONITORING.CRITICAL_BUDGET_THRESHOLD)) {
      this.emitAlert({
        type: 'critical_budget',
        severity: 'critical',
        message: `Critical budget alert: ${metric.provider}:${metric.useCase} at ${metric.utilizationPercentage.toFixed(1)}% utilization`,
        provider: metric.provider,
        useCase: metric.useCase,
        metadata: { utilization: metric.utilizationPercentage, remaining: metric.budgetRemaining },
        timestamp: metric.timestamp
      });
    }
  }

  /**
   * Calculate health status for a specific provider
   */
  private calculateProviderHealth(
    provider: Provider,
    allStatuses: BudgetStatus[],
    recentViolations: RateLimitViolation[]
  ): SystemHealthReport['providers'][Provider] {
    const providerStatuses = allStatuses.filter(s => s.provider === provider);
    const providerViolations = recentViolations.filter(v => v.provider === provider);
    
    const hourAgo = Date.now() - (60 * 60 * 1000);
    const violations_last_hour = providerViolations.filter(v => v.timestamp > hourAgo).length;

    const totalUsed = providerStatuses.reduce((sum, s) => sum + s.used, 0);
    const totalAllocated = providerStatuses.reduce((sum, s) => sum + s.allocated, 0);
    const utilization = totalAllocated > 0 ? (totalUsed / totalAllocated) : 0;
    const budget_remaining = providerStatuses.reduce((sum, s) => sum + s.remaining, 0);

    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    
    if (violations_last_hour >= MONITORING.VIOLATION_ALERT_THRESHOLD || utilization >= 0.9) {
      status = 'critical';
    } else if (violations_last_hour >= Math.ceil(MONITORING.VIOLATION_ALERT_THRESHOLD / 2) || utilization >= 0.75) {
      status = 'degraded';
    }

    return {
      status,
      utilization,
      violations_last_hour,
      budget_remaining
    };
  }

  /**
   * Generate actionable recommendations based on system state
   */
  private generateRecommendations(
    providers: SystemHealthReport['providers'],
    stats: any,
    topViolations: Array<{ provider: Provider; useCase: UseCase; violations: number }>
  ): string[] {
    const recommendations: string[] = [];

    // High utilization recommendations
    Object.entries(providers).forEach(([provider, health]) => {
      if (health.utilization > 0.8) {
        recommendations.push(`Consider increasing rate limit allocation for ${provider} (currently ${(health.utilization * 100).toFixed(1)}% utilized)`);
      }
    });

    // Violation pattern recommendations
    if (topViolations.length > 0) {
      const topViolator = topViolations[0];
      recommendations.push(`Review ${topViolator.provider}:${topViolator.useCase} - ${topViolator.violations} violations detected`);
    }

    // Overall health recommendations
    if (stats.violationsLast24h > 20) {
      recommendations.push('High violation rate detected - consider reviewing rate limit configurations');
    }

    if (recommendations.length === 0) {
      recommendations.push('System operating within normal parameters');
    }

    return recommendations;
  }

  /**
   * Emit standardized alert events
   */
  private emitAlert(alert: AlertEvent): void {
    this.emit('alert', alert);

    // Log critical alerts
    if (alert.severity === 'critical') {
      console.error(`[RateBudgetMonitor] CRITICAL ALERT: ${alert.message}`);
    } else if (alert.severity === 'error') {
      console.warn(`[RateBudgetMonitor] ERROR ALERT: ${alert.message}`);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.removeAllListeners();
  }
}

// Global monitor instance
let globalMonitor: RateBudgetMonitor | null = null;

/**
 * Get the global rate budget monitor instance
 */
export function getRateBudgetMonitor(): RateBudgetMonitor {
  if (!globalMonitor) {
    globalMonitor = new RateBudgetMonitor();
    
    // Set up rate budget manager event listeners
    const rateBudgetManager = getRateBudgetManager();
    
    rateBudgetManager.on('quotaConsumed', ({ provider, useCase, status }) => {
      globalMonitor?.recordUsage(provider, useCase, status);
    });

    rateBudgetManager.on('rateLimitViolation', (violation: RateLimitViolation) => {
      globalMonitor?.emitAlert({
        type: 'rate_violation',
        severity: 'error',
        message: `Rate limit violation: ${violation.provider}:${violation.useCase} - requested ${violation.requestedQuota}, available ${violation.availableQuota}`,
        provider: violation.provider,
        useCase: violation.useCase,
        metadata: violation,
        timestamp: violation.timestamp
      });
    });
  }

  return globalMonitor;
}

// Export types
export type { Provider, UseCase, BudgetStatus, RateLimitViolation };