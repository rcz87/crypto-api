import { adaptiveThresholdManager } from '../services/adaptiveThreshold';

export class AdaptiveThresholdScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private readonly EVALUATION_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Start daily evaluation scheduler
   */
  async start(): Promise<void> {
    // Initialize threshold manager
    await adaptiveThresholdManager.initialize();

    // Run initial evaluation
    console.log('🎯 [AdaptiveThreshold] Starting daily evaluation scheduler...');
    await this.runEvaluation();

    // Schedule daily evaluations
    this.intervalId = setInterval(async () => {
      await this.runEvaluation();
    }, this.EVALUATION_INTERVAL);

    console.log(`✅ [AdaptiveThreshold] Scheduler started (evaluates every 24h)`);
  }

  /**
   * Stop scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('⏹️ [AdaptiveThreshold] Scheduler stopped');
    }
  }

  /**
   * Run evaluation and adjustment
   */
  private async runEvaluation(): Promise<void> {
    try {
      console.log('📊 [AdaptiveThreshold] Running daily evaluation...');
      const result = await adaptiveThresholdManager.evaluateAndAdjust();
      
      if (result.adjusted) {
        console.log(`✅ [AdaptiveThreshold] Threshold adjusted: ${result.oldThreshold}% → ${result.newThreshold}%`);
      } else {
        console.log(`📊 [AdaptiveThreshold] Threshold unchanged: ${result.newThreshold}%`);
      }
    } catch (error) {
      console.error('❌ [AdaptiveThreshold] Evaluation failed:', error);
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerEvaluation(): Promise<void> {
    console.log('🔧 [AdaptiveThreshold] Manual evaluation triggered...');
    await this.runEvaluation();
  }
}

// Singleton instance
export const adaptiveThresholdScheduler = new AdaptiveThresholdScheduler();
