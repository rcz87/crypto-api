/**
 * Recovery Queue with Rate Limiting
 * 
 * Prevents REST API storms by:
 * 1. Queuing recovery requests
 * 2. Processing max 2 concurrent requests
 * 3. Adding 1 second delay between batches
 * 4. Deduplicating requests for same symbol
 */

export interface RecoveryMetrics {
  queueSize: number;
  processing: boolean;
  totalRecovered: number;
  totalFailed: number;
  averageRecoveryTimeMs: number;
}

export class RecoveryQueue {
  private queue: string[] = [];
  private processing = false;
  private readonly maxConcurrent: number;
  private readonly delayMs: number;
  private totalRecovered = 0;
  private totalFailed = 0;
  private recoveryTimes: number[] = [];
  private recoveryCallback: ((symbolId: string) => Promise<void>) | null = null;
  
  constructor(maxConcurrent: number = 2, delayMs: number = 1000) {
    this.maxConcurrent = maxConcurrent;
    this.delayMs = delayMs;
  }
  
  /**
   * Set the recovery callback function
   */
  setRecoveryCallback(callback: (symbolId: string) => Promise<void>): void {
    this.recoveryCallback = callback;
  }
  
  /**
   * Add symbol to recovery queue (deduplicated)
   */
  async addRecovery(symbolId: string): Promise<void> {
    // Deduplicate: don't add if already in queue
    if (!this.queue.includes(symbolId)) {
      this.queue.push(symbolId);
      console.log(`🔄 [RecoveryQueue] Added ${symbolId} to recovery queue (size: ${this.queue.length})`);
    }
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }
  
  /**
   * Process recovery queue with rate limiting
   */
  private async processQueue(): Promise<void> {
    this.processing = true;
    
    while (this.queue.length > 0) {
      // Take batch of symbols (max maxConcurrent)
      const batch = this.queue.splice(0, this.maxConcurrent);
      
      console.log(`⚙️ [RecoveryQueue] Processing batch of ${batch.length} symbols`);
      
      // Process batch concurrently
      const results = await Promise.allSettled(
        batch.map(symbolId => this.recoverSymbol(symbolId))
      );
      
      // Track results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          this.totalRecovered++;
        } else {
          this.totalFailed++;
          console.error(`❌ [RecoveryQueue] Recovery failed for ${batch[index]}:`, result.reason);
        }
      });
      
      // Rate limiting: wait before next batch
      if (this.queue.length > 0) {
        console.log(`⏳ [RecoveryQueue] Waiting ${this.delayMs}ms before next batch (${this.queue.length} remaining)`);
        await this.delay(this.delayMs);
      }
    }
    
    this.processing = false;
    console.log(`✅ [RecoveryQueue] Queue processing complete (recovered: ${this.totalRecovered}, failed: ${this.totalFailed})`);
  }
  
  /**
   * Recover single symbol with timing
   */
  private async recoverSymbol(symbolId: string): Promise<void> {
    if (!this.recoveryCallback) {
      throw new Error('Recovery callback not set');
    }
    
    const startTime = Date.now();
    
    try {
      await this.recoveryCallback(symbolId);
      
      const duration = Date.now() - startTime;
      this.recoveryTimes.push(duration);
      
      // Keep only last 100 recovery times for average calculation
      if (this.recoveryTimes.length > 100) {
        this.recoveryTimes.shift();
      }
      
      console.log(`✅ [RecoveryQueue] Recovered ${symbolId} in ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [RecoveryQueue] Failed to recover ${symbolId} after ${duration}ms:`, error);
      throw error;
    }
  }
  
  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Get recovery metrics
   */
  getMetrics(): RecoveryMetrics {
    const avgTime = this.recoveryTimes.length > 0
      ? this.recoveryTimes.reduce((sum, time) => sum + time, 0) / this.recoveryTimes.length
      : 0;
    
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      totalRecovered: this.totalRecovered,
      totalFailed: this.totalFailed,
      averageRecoveryTimeMs: Math.round(avgTime)
    };
  }
  
  /**
   * Clear queue (emergency stop)
   */
  clear(): void {
    this.queue = [];
    console.log('🛑 [RecoveryQueue] Queue cleared');
  }
  
  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.totalRecovered = 0;
    this.totalFailed = 0;
    this.recoveryTimes = [];
  }
}
