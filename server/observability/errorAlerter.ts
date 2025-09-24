/**
 * 🚨 Enhanced Error Alerting System
 * Production-grade monitoring for 5xx/429 errors with Telegram alerts
 */

import { sendTelegram } from './telegram';

interface ErrorMetrics {
  count_5xx: number;
  count_429: number;
  count_total: number;
  first_error: number;
  last_error: number;
  recent_endpoints: Set<string>;
}

class ErrorAlerter {
  private metrics: ErrorMetrics = {
    count_5xx: 0,
    count_429: 0, 
    count_total: 0,
    first_error: 0,
    last_error: 0,
    recent_endpoints: new Set()
  };

  private readonly ALERT_THRESHOLDS = {
    error_5xx_rate: 10,       // Alert after 10 5xx errors in window
    error_429_rate: 20,       // Alert after 20 429 errors in window  
    total_error_rate: 25,     // Alert after 25 total errors in window
    alert_window: 5 * 60 * 1000,  // 5-minute sliding window
    cooldown_period: 15 * 60 * 1000  // 15-minute cooldown between alerts
  };

  private lastAlertTime = 0;
  private alertCooldownActive = false;

  /**
   * Record an error and check if alert threshold is met
   */
  async recordError(statusCode: number, endpoint: string, userAgent?: string, ip?: string): Promise<void> {
    const now = Date.now();
    
    // Initialize first error timestamp
    if (this.metrics.first_error === 0) {
      this.metrics.first_error = now;
    }
    
    this.metrics.last_error = now;
    this.metrics.count_total++;
    this.metrics.recent_endpoints.add(endpoint);
    
    // Categorize error types
    if (statusCode >= 500 && statusCode < 600) {
      this.metrics.count_5xx++;
    } else if (statusCode === 429) {
      this.metrics.count_429++;
    }
    
    // Check if we should send alert
    await this.checkAndSendAlert(statusCode, endpoint, userAgent, ip);
    
    // Clean up old metrics outside alert window
    this.cleanupOldMetrics();
  }

  /**
   * Check error thresholds and send alerts if needed
   */
  private async checkAndSendAlert(statusCode: number, endpoint: string, userAgent?: string, ip?: string): Promise<void> {
    const now = Date.now();
    
    // Skip if in cooldown period
    if (this.alertCooldownActive && (now - this.lastAlertTime) < this.ALERT_THRESHOLDS.cooldown_period) {
      return;
    }
    
    // Check if any threshold is exceeded
    const shouldAlert = (
      this.metrics.count_5xx >= this.ALERT_THRESHOLDS.error_5xx_rate ||
      this.metrics.count_429 >= this.ALERT_THRESHOLDS.error_429_rate ||
      this.metrics.count_total >= this.ALERT_THRESHOLDS.total_error_rate
    );
    
    if (shouldAlert) {
      await this.sendErrorAlert(statusCode, endpoint, userAgent, ip);
      this.lastAlertTime = now;
      this.alertCooldownActive = true;
      
      // Reset metrics after alert
      this.resetMetrics();
    }
  }

  /**
   * Send comprehensive error alert to Telegram
   */
  private async sendErrorAlert(statusCode: number, endpoint: string, userAgent?: string, ip?: string): Promise<void> {
    const now = Date.now();
    const windowDuration = Math.floor((now - this.metrics.first_error) / 1000 / 60); // minutes
    
    // Determine alert severity
    let severity = '⚠️ WARNING';
    if (this.metrics.count_5xx >= 15 || this.metrics.count_total >= 35) {
      severity = '🚨 CRITICAL';
    } else if (this.metrics.count_5xx >= 5 || this.metrics.count_total >= 15) {
      severity = '🔥 HIGH';
    }
    
    // Format endpoint list (limit to top 5)
    const endpointList = Array.from(this.metrics.recent_endpoints)
      .slice(0, 5)
      .map(ep => `  • ${ep}`)
      .join('\n');
    
    const alertMessage = `${severity} **HTTP Error Alert**

**Error Summary (${windowDuration}m window):**
🔴 5xx Errors: ${this.metrics.count_5xx}
🟡 429 Rate Limits: ${this.metrics.count_429}
📊 Total Errors: ${this.metrics.count_total}

**Latest Error:**
Status: **${statusCode}**
Endpoint: \`${endpoint}\`
${ip ? `IP: \`${ip}\`` : ''}

**Recent Endpoints:**
${endpointList}

**System Info:**
Time: ${new Date().toISOString()}
Environment: ${process.env.NODE_ENV || 'unknown'}
Instance: GuardiansOfTheGreenToken.com

#ErrorAlert #HTTP${statusCode} #ProductionMonitoring`;

    try {
      await sendTelegram(alertMessage, { parseMode: 'Markdown', disablePreview: true });
      console.log(`🚨 Error alert sent: ${statusCode} errors exceeded threshold`);
    } catch (error) {
      console.error('❌ Failed to send error alert:', error);
    }
  }

  /**
   * Clean up metrics outside the alert window
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const windowStart = now - this.ALERT_THRESHOLDS.alert_window;
    
    // Reset metrics if all errors are outside window
    if (this.metrics.first_error < windowStart) {
      this.resetMetrics();
    }
    
    // Reset cooldown if enough time has passed
    if (this.alertCooldownActive && (now - this.lastAlertTime) >= this.ALERT_THRESHOLDS.cooldown_period) {
      this.alertCooldownActive = false;
    }
  }

  /**
   * Reset all metrics
   */
  private resetMetrics(): void {
    this.metrics.count_5xx = 0;
    this.metrics.count_429 = 0;
    this.metrics.count_total = 0;
    this.metrics.first_error = 0;
    this.metrics.last_error = 0;
    this.metrics.recent_endpoints.clear();
  }

  /**
   * Get current metrics for monitoring
   */
  getMetrics(): ErrorMetrics & { alert_cooldown_active: boolean, last_alert: number } {
    return {
      ...this.metrics,
      recent_endpoints: new Set(this.metrics.recent_endpoints), // Clone to prevent mutation
      alert_cooldown_active: this.alertCooldownActive,
      last_alert: this.lastAlertTime
    };
  }

  /**
   * Manual test alert
   */
  async sendTestAlert(): Promise<void> {
    const testMessage = `🧪 **Test Error Alert**

This is a test of the enhanced error alerting system.

**System Status:** Operational
**Time:** ${new Date().toISOString()}
**Environment:** ${process.env.NODE_ENV || 'unknown'}

#TestAlert #ErrorMonitoring`;

    try {
      await sendTelegram(testMessage, { parseMode: 'Markdown' });
      console.log('✅ Test error alert sent successfully');
    } catch (error) {
      console.error('❌ Failed to send test alert:', error);
    }
  }
}

// Export singleton instance
export const errorAlerter = new ErrorAlerter();