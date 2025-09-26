import { Request, Response, NextFunction } from 'express';

interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
}

export class CircuitBreaker {
  private failures: Map<string, CircuitBreakerState> = new Map();
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenMaxCalls: number;

  constructor(
    failureThreshold: number = 5,
    resetTimeout: number = 60000, // 1 minute
    halfOpenMaxCalls: number = 3
  ) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
    this.halfOpenMaxCalls = halfOpenMaxCalls;
  }

  private getState(service: string): CircuitBreakerState {
    if (!this.failures.has(service)) {
      this.failures.set(service, {
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        successCount: 0
      });
    }
    return this.failures.get(service)!;
  }

  private shouldAttemptCall(service: string): boolean {
    const state = this.getState(service);
    const now = Date.now();

    switch (state.state) {
      case 'CLOSED':
        return true;
      
      case 'OPEN':
        // Check if reset timeout has passed
        if (now - state.lastFailureTime > this.resetTimeout) {
          state.state = 'HALF_OPEN';
          state.successCount = 0;
          console.log(`[CircuitBreaker] ${service}: OPEN → HALF_OPEN (reset timeout)`);
          return true;
        }
        return false;
      
      case 'HALF_OPEN':
        return state.successCount < this.halfOpenMaxCalls;
      
      default:
        return false;
    }
  }

  public recordSuccess(service: string): void {
    const state = this.getState(service);
    
    if (state.state === 'HALF_OPEN') {
      state.successCount++;
      if (state.successCount >= this.halfOpenMaxCalls) {
        state.state = 'CLOSED';
        state.failureCount = 0;
        console.log(`[CircuitBreaker] ${service}: HALF_OPEN → CLOSED (success threshold)`);
      }
    } else if (state.state === 'CLOSED') {
      // Reset failure count on success
      state.failureCount = Math.max(0, state.failureCount - 1);
    }
  }

  public recordFailure(service: string): void {
    const state = this.getState(service);
    state.failureCount++;
    state.lastFailureTime = Date.now();

    if (state.state === 'CLOSED' && state.failureCount >= this.failureThreshold) {
      state.state = 'OPEN';
      console.log(`[CircuitBreaker] ${service}: CLOSED → OPEN (failure threshold: ${state.failureCount})`);
    } else if (state.state === 'HALF_OPEN') {
      state.state = 'OPEN';
      console.log(`[CircuitBreaker] ${service}: HALF_OPEN → OPEN (failure in half-open)`);
    }
  }

  public createMiddleware(serviceName: string = 'python') {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!this.shouldAttemptCall(serviceName)) {
        const state = this.getState(serviceName);
        res.status(503).json({
          error: 'circuit_breaker_open',
          message: `${serviceName} service circuit breaker is OPEN`,
          details: {
            state: state.state,
            failureCount: state.failureCount,
            lastFailureTime: new Date(state.lastFailureTime).toISOString(),
            resetIn: Math.max(0, this.resetTimeout - (Date.now() - state.lastFailureTime))
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Wrap response to record success/failure
      const originalSend = res.send;
      const originalJson = res.json;
      
      let responseSent = false;
      
      const recordResult = () => {
        if (!responseSent) {
          responseSent = true;
          if (res.statusCode >= 200 && res.statusCode < 400) {
            this.recordSuccess(serviceName);
          } else if (res.statusCode >= 500) {
            this.recordFailure(serviceName);
          }
        }
      };

      res.send = function(data) {
        recordResult();
        return originalSend.call(this, data);
      };

      res.json = function(data) {
        recordResult();
        return originalJson.call(this, data);
      };

      next();
    };
  }

  public getStatus(): { [service: string]: CircuitBreakerState } {
    const status: { [service: string]: CircuitBreakerState } = {};
    this.failures.forEach((state, service) => {
      status[service] = { ...state };
    });
    return status;
  }
}

// Global circuit breaker instance
export const circuitBreaker = new CircuitBreaker(
  5,      // 5 failures to open
  60000,  // 1 minute reset timeout
  3       // 3 success calls in half-open
);

export default circuitBreaker;