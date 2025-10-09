/**
 * 🔄 Adaptive Scheduler with Exponential Backoff
 * 
 * Replaces fixed cron intervals with dynamic scheduling that adapts to:
 * - HTTP 429 rate limit errors
 * - API failures and timeouts
 * - Rate budget constraints
 * 
 * Features:
 * - Exponential backoff (5s → 2min max)
 * - Jitter randomization (5-15s)
 * - Self-healing recovery
 * - Budget-aware scheduling
 */

export interface AdaptiveSchedulerConfig {
  name: string;
  baseInterval: number;          // Normal interval in ms (e.g. 5min = 300000)
  minInterval?: number;          // Minimum interval between runs in ms (e.g. 1500ms)
  minBackoff: number;            // Minimum backoff time in ms (e.g. 5s = 5000)
  maxBackoff: number;            // Maximum backoff time in ms (e.g. 2min = 120000)
  jitterRange: [number, number]; // Jitter range in ms (e.g. [5000, 15000])
  maxConsecutiveFailures: number; // Max failures before circuit break
  backoffMultiplier: number;     // Exponential multiplier (e.g. 2.0)
}

export interface SchedulerState {
  currentBackoff: number;
  consecutiveFailures: number;
  lastRunAt: number | null;
  nextRunAt: number | null;
  isHealthy: boolean;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  rateLimitErrors: number;
}

export type SchedulerResult = {
  success: boolean;
  error?: Error;
  isRateLimit?: boolean;
  shouldBackoff?: boolean;
  data?: any;
};

export class AdaptiveScheduler {
  private config: AdaptiveSchedulerConfig;
  private state: SchedulerState;
  private timeoutHandle: NodeJS.Timeout | null = null;
  private isRunning = false;
  private taskFn: () => Promise<SchedulerResult>;
  
  constructor(config: AdaptiveSchedulerConfig, taskFn: () => Promise<SchedulerResult>) {
    this.config = config;
    this.taskFn = taskFn;
    
    // Initialize state
    this.state = {
      currentBackoff: 0,
      consecutiveFailures: 0,
      lastRunAt: null,
      nextRunAt: null,
      isHealthy: true,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      rateLimitErrors: 0
    };
    
    console.log(`🔄 [${config.name}] Adaptive Scheduler initialized:`, {
      baseInterval: `${config.baseInterval/1000}s`,
      backoffRange: `${config.minBackoff/1000}s-${config.maxBackoff/1000}s`,
      jitterRange: `${config.jitterRange[0]/1000}s-${config.jitterRange[1]/1000}s`
    });
  }

  /**
   * Start the adaptive scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.warn(`⚠️ [${this.config.name}] Scheduler already running`);
      return;
    }
    
    this.isRunning = true;
    console.log(`🚀 [${this.config.name}] Adaptive Scheduler started`);
    
    // Schedule first run immediately (with small delay)
    this.scheduleNext(1000);
  }

  /**
   * Stop the adaptive scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
    
    console.log(`🛑 [${this.config.name}] Adaptive Scheduler stopped`);
  }

  /**
   * Get current scheduler state
   */
  getState(): SchedulerState & { config: AdaptiveSchedulerConfig } {
    return {
      ...this.state,
      config: this.config
    };
  }

  /**
   * Force reset the scheduler state (useful for recovery)
   */
  reset(): void {
    this.state.currentBackoff = 0;
    this.state.consecutiveFailures = 0;
    this.state.isHealthy = true;
    console.log(`🔄 [${this.config.name}] Scheduler state reset`);
  }

  /**
   * Execute the scheduled task
   */
  private async executeTask(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.state.lastRunAt = Date.now();
    this.state.totalRuns++;
    
    console.log(`⚡ [${this.config.name}] Executing task (run ${this.state.totalRuns})`);

    try {
      const result = await this.taskFn();
      
      if (result.success) {
        this.handleSuccess(result);
      } else {
        this.handleFailure(result);
      }
      
    } catch (error: any) {
      // Convert uncaught errors to SchedulerResult format
      const result: SchedulerResult = {
        success: false,
        error,
        isRateLimit: error?.status === 429 || error?.isRateLimit,
        shouldBackoff: true
      };
      
      this.handleFailure(result);
    }
    
    // Schedule the next run
    if (this.isRunning) {
      this.scheduleNext();
    }
  }

  /**
   * Handle successful task execution
   */
  private handleSuccess(result: SchedulerResult): void {
    this.state.successfulRuns++;
    this.state.consecutiveFailures = 0;
    this.state.isHealthy = true;
    
    // Gradually reduce backoff on success
    if (this.state.currentBackoff > 0) {
      this.state.currentBackoff = Math.max(0, this.state.currentBackoff * 0.5);
      console.log(`✅ [${this.config.name}] Success! Reducing backoff to ${this.state.currentBackoff/1000}s`);
    } else {
      console.log(`✅ [${this.config.name}] Task completed successfully`);
    }
  }

  /**
   * Handle failed task execution
   */
  private handleFailure(result: SchedulerResult): void {
    this.state.failedRuns++;
    this.state.consecutiveFailures++;
    
    // Track rate limit errors specifically
    if (result.isRateLimit) {
      this.state.rateLimitErrors++;
      console.warn(`⚠️ [${this.config.name}] Rate limit error detected (total: ${this.state.rateLimitErrors})`);
    }
    
    // Calculate new backoff if needed
    if (result.shouldBackoff !== false) {
      this.calculateBackoff(result.isRateLimit || false);
    }
    
    // Update health status
    this.state.isHealthy = this.state.consecutiveFailures < this.config.maxConsecutiveFailures;
    
    const errorMsg = result.error?.message || 'Unknown error';
    console.error(`❌ [${this.config.name}] Task failed (${this.state.consecutiveFailures} consecutive): ${errorMsg}`);
    
    if (!this.state.isHealthy) {
      console.error(`🚨 [${this.config.name}] Scheduler unhealthy! ${this.state.consecutiveFailures} consecutive failures`);
    }
  }

  /**
   * Calculate exponential backoff with jitter
   */
  private calculateBackoff(isRateLimit: boolean): void {
    // For rate limits, use more aggressive backoff
    const baseBackoff = isRateLimit ? this.config.minBackoff * 2 : this.config.minBackoff;
    
    // Exponential backoff calculation
    const exponentialBackoff = baseBackoff * Math.pow(this.config.backoffMultiplier, this.state.consecutiveFailures - 1);
    
    // Cap at maximum backoff
    const cappedBackoff = Math.min(exponentialBackoff, this.config.maxBackoff);
    
    // Add jitter to avoid thundering herd
    const jitter = this.generateJitter();
    
    this.state.currentBackoff = cappedBackoff + jitter;
    
    console.log(`🕒 [${this.config.name}] Backoff calculated: ${this.state.currentBackoff/1000}s (base: ${cappedBackoff/1000}s, jitter: +${jitter/1000}s)`);
  }

  /**
   * Generate random jitter within configured range
   */
  private generateJitter(): number {
    const [minJitter, maxJitter] = this.config.jitterRange;
    return minJitter + Math.random() * (maxJitter - minJitter);
  }

  /**
   * Schedule the next task execution
   */
  private scheduleNext(overrideDelay?: number): void {
    if (!this.isRunning) {
      return;
    }
    
    // Calculate next run delay
    let delay: number;
    
    if (overrideDelay !== undefined) {
      delay = overrideDelay;
    } else if (this.state.currentBackoff > 0) {
      delay = this.state.currentBackoff;
    } else {
      delay = this.config.baseInterval + this.generateJitter();
    }
    
    // CRITICAL FIX: Always enforce minInterval, even for overrides (prevents rate limit bursts)
    if (this.config.minInterval && delay < this.config.minInterval) {
      const originalDelay = delay;
      delay = this.config.minInterval;
      if (overrideDelay !== undefined) {
        console.log(`⚠️ [${this.config.name}] Override ${originalDelay}ms capped to minInterval ${delay}ms`);
      }
    }
    
    this.state.nextRunAt = Date.now() + delay;
    
    console.log(`⏰ [${this.config.name}] Next run scheduled in ${delay/1000}s (at ${new Date(this.state.nextRunAt).toLocaleTimeString()})`);
    
    this.timeoutHandle = setTimeout(() => {
      this.executeTask();
    }, delay);
  }
}

/**
 * Factory function to create pre-configured schedulers
 */
export function createInstitutionalScheduler(taskFn: () => Promise<SchedulerResult>): AdaptiveScheduler {
  return new AdaptiveScheduler({
    name: 'InstitutionalBias',
    baseInterval: 5 * 60 * 1000,  // 5 minutes
    minInterval: 1500,            // 1.5s minimum to prevent rate depletion
    minBackoff: 5 * 1000,         // 5 seconds
    maxBackoff: 2 * 60 * 1000,    // 2 minutes  
    jitterRange: [5000, 15000],   // 5-15 seconds
    maxConsecutiveFailures: 5,    // Circuit break after 5 failures
    backoffMultiplier: 2.0        // Double backoff each failure
  }, taskFn);
}

export function createSniperScheduler(taskFn: () => Promise<SchedulerResult>): AdaptiveScheduler {
  return new AdaptiveScheduler({
    name: 'SOLSniper',
    baseInterval: 3 * 60 * 1000,  // 3 minutes
    minBackoff: 3 * 1000,         // 3 seconds
    maxBackoff: 90 * 1000,        // 90 seconds
    jitterRange: [3000, 10000],   // 3-10 seconds
    maxConsecutiveFailures: 4,    // Circuit break after 4 failures
    backoffMultiplier: 1.8        // Less aggressive backoff
  }, taskFn);
}