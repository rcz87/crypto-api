/**
 * CoinGlass Circuit Breaker Singleton
 * Eliminates circular import between index.ts and routes/system.ts
 */

export interface CircuitBreakerState {
  failures: number;
  lastFailure: number | null;
  isOpen: boolean;
}

class CoinGlassCircuitBreaker {
  private state: CircuitBreakerState = {
    failures: 0,
    lastFailure: null,
    isOpen: false
  };

  private readonly FAILURE_THRESHOLD = 5;
  private readonly RESET_TIMEOUT = 60000; // 1 minute

  // Get current state (thread-safe read)
  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  // Check if circuit is open before allowing requests
  isCircuitOpen(): boolean {
    return this.state.isOpen;
  }

  // Record a failure and potentially open the circuit
  recordFailure(): void {
    this.state.failures++;
    this.state.lastFailure = Date.now();
    
    if (this.state.failures >= this.FAILURE_THRESHOLD) {
      this.state.isOpen = true;
    }
  }

  // Record a success and reset the circuit
  recordSuccess(): void {
    if (this.state.failures > 0) {
      // Circuit breaker reset
      this.state.failures = 0;
      this.state.isOpen = false;
    }
  }

  // Auto-reset circuit breaker after timeout
  checkAutoReset(): boolean {
    if (this.state.isOpen && this.state.lastFailure) {
      const timeSinceFailure = Date.now() - this.state.lastFailure;
      if (timeSinceFailure > this.RESET_TIMEOUT) {
        this.state.isOpen = false;
        return true; // Circuit was reset
      }
    }
    return false;
  }

  // Force reset (for manual intervention)
  forceReset(): void {
    this.state.failures = 0;
    this.state.isOpen = false;
    this.state.lastFailure = null;
  }

  // Update state from external source (for metrics sync)
  updateState(failures: number, isOpen: boolean, lastFailure: number | null): void {
    this.state.failures = failures;
    this.state.isOpen = isOpen;
    this.state.lastFailure = lastFailure;
  }
}

// Export singleton instance
export const coinglassCircuitBreaker = new CoinGlassCircuitBreaker();