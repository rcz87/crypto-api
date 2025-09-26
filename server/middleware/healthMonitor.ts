import axios from 'axios';
import { Request, Response, NextFunction } from 'express';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  services: {
    python: {
      status: 'up' | 'down';
      responseTime?: number;
      lastCheck: number;
    };
    node: {
      status: 'up' | 'down';
      uptime: number;
    };
  };
  timestamp: number;
}

class HealthMonitor {
  private pythonServiceUrl: string;
  private lastPythonCheck: number = 0;
  private pythonStatus: 'up' | 'down' = 'down';
  private pythonResponseTime: number = 0;
  private checkInterval: number = 30000; // 30 seconds
  private timeout: number = 5000; // 5 seconds
  
  constructor() {
    this.pythonServiceUrl = process.env.PY_BASE || 'http://127.0.0.1:8000';
    this.startMonitoring();
  }

  private async checkPythonHealth(): Promise<{ status: 'up' | 'down'; responseTime: number }> {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${this.pythonServiceUrl}/health`, {
        timeout: this.timeout,
        headers: { 'User-Agent': 'HealthMonitor/1.0' }
      });
      
      const responseTime = Date.now() - startTime;
      
      if (response.status === 200) {
        this.pythonStatus = 'up';
        this.pythonResponseTime = responseTime;
        this.lastPythonCheck = Date.now();
        return { status: 'up', responseTime };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('[HealthMonitor] Python service check failed:', error);
      this.pythonStatus = 'down';
      this.pythonResponseTime = 0;
      this.lastPythonCheck = Date.now();
      return { status: 'down', responseTime: 0 };
    }
  }

  private startMonitoring(): void {
    // Initial check
    this.checkPythonHealth();
    
    // Periodic health checks
    setInterval(async () => {
      await this.checkPythonHealth();
    }, this.checkInterval);
    
    console.log(`[HealthMonitor] Started monitoring Python service every ${this.checkInterval/1000}s`);
  }

  public getHealthStatus(): HealthStatus {
    return {
      status: this.pythonStatus === 'up' ? 'healthy' : 'unhealthy',
      services: {
        python: {
          status: this.pythonStatus,
          responseTime: this.pythonResponseTime,
          lastCheck: this.lastPythonCheck
        },
        node: {
          status: 'up', // Node is up if this code is running
          uptime: process.uptime()
        }
      },
      timestamp: Date.now()
    };
  }

  public isPythonHealthy(): boolean {
    // Consider service unhealthy if last check was more than 2 minutes ago
    const maxAge = 2 * 60 * 1000; // 2 minutes
    const isRecent = (Date.now() - this.lastPythonCheck) < maxAge;
    return this.pythonStatus === 'up' && isRecent;
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor();

// Health check endpoint middleware
export function healthCheckMiddleware(req: Request, res: Response): void {
  const health = healthMonitor.getHealthStatus();
  const status = health.status === 'healthy' ? 200 : 503;
  
  res.status(status).json({
    ...health,
    endpoint: '/health/python',
    message: health.status === 'healthy' 
      ? 'All services operational' 
      : 'Python service unavailable'
  });
}

// Circuit breaker middleware for Python service endpoints
export function pythonServiceGuard(req: Request, res: Response, next: NextFunction): void {
  if (!healthMonitor.isPythonHealthy()) {
    res.status(503).json({
      error: 'python_service_unavailable',
      message: 'Python service is currently down. Please try again later.',
      details: {
        status: healthMonitor.getHealthStatus(),
        suggestion: 'This prevents 502 Bad Gateway errors by failing fast.'
      },
      timestamp: new Date().toISOString()
    });
    return;
  }
  
  next();
}

export default healthMonitor;