import { AxiosError } from 'axios';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to close
        this.state = CircuitBreakerState.CLOSED;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      successCount: this.successCount
    };
  }
}

export class RetryHandler {
  constructor(private config: RetryConfig) {}

  async execute<T>(operation: () => Promise<T>, context?: string): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await operation();
        if (attempt > 0) {
          console.log(`${context || 'Operation'} succeeded on attempt ${attempt + 1}`);
        }
        return result;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === this.config.maxRetries) {
          console.error(`${context || 'Operation'} failed after ${this.config.maxRetries + 1} attempts:`, lastError.message);
          break;
        }

        if (!this.isRetryableError(error)) {
          console.error(`${context || 'Operation'} failed with non-retryable error:`, lastError.message);
          break;
        }

        const delay = this.calculateDelay(attempt);
        console.warn(`${context || 'Operation'} failed on attempt ${attempt + 1}, retrying in ${delay}ms:`, lastError.message);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private isRetryableError(error: any): boolean {
    if (error.code && this.config.retryableErrors.includes(error.code)) {
      return true;
    }
    
    if (error.response?.status) {
      // Retry on 5xx server errors and specific 4xx errors
      const status = error.response.status;
      return status >= 500 || status === 408 || status === 429;
    }

    // Retry on network errors
    return error.code === 'ECONNABORTED' || 
           error.code === 'ETIMEDOUT' || 
           error.code === 'ECONNRESET' ||
           error.code === 'ENOTFOUND' ||
           error.message?.includes('timeout');
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt);
    const jitteredDelay = exponentialDelay * (0.5 + Math.random() * 0.5); // Add jitter
    return Math.min(jitteredDelay, this.config.maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Default configurations
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['ECONNABORTED', 'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND']
};

export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  monitoringPeriod: 10000 // 10 seconds
};

// Health check utilities
export class HealthChecker {
  private static instance: HealthChecker;
  private healthStatus: Map<string, { status: 'healthy' | 'unhealthy', lastCheck: number, error?: string }> = new Map();

  static getInstance(): HealthChecker {
    if (!HealthChecker.instance) {
      HealthChecker.instance = new HealthChecker();
    }
    return HealthChecker.instance;
  }

  async checkHealth(serviceName: string, healthCheck: () => Promise<boolean>): Promise<boolean> {
    try {
      const isHealthy = await healthCheck();
      this.healthStatus.set(serviceName, {
        status: isHealthy ? 'healthy' : 'unhealthy',
        lastCheck: Date.now(),
        error: isHealthy ? undefined : 'Health check returned false'
      });
      return isHealthy;
    } catch (error) {
      this.healthStatus.set(serviceName, {
        status: 'unhealthy',
        lastCheck: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  getHealthStatus(serviceName: string) {
    return this.healthStatus.get(serviceName);
  }

  getAllHealthStatus() {
    return Object.fromEntries(this.healthStatus);
  }
}

// Network diagnostics
export class NetworkDiagnostics {
  static async pingHost(hostname: string, timeout: number = 5000): Promise<{ success: boolean, latency?: number, error?: string }> {
    const start = Date.now();
    
    try {
      // Simple HTTP ping to check connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(`https://${hostname}`, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-cache'
      });
      
      clearTimeout(timeoutId);
      const latency = Date.now() - start;
      
      return {
        success: response.ok || response.status < 500,
        latency
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  static async diagnoseConnectivity(hosts: string[]): Promise<{ [host: string]: any }> {
    const results: { [host: string]: any } = {};
    
    for (const host of hosts) {
      results[host] = await this.pingHost(host);
    }
    
    return results;
  }
}
