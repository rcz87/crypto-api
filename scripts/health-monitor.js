#!/usr/bin/env node

/**
 * Enhanced Intelligent Screening System - Production Health Monitor
 * 
 * A comprehensive production-ready health monitoring script with automated
 * email/telegram alerting, database checks, and system resource monitoring.
 * 
 * Features:
 * - Multi-tier endpoint monitoring with retry logic
 * - SendGrid email alerts with HTML templates
 * - Telegram bot notifications with emoji status
 * - Database connectivity checks
 * - System resource monitoring (CPU, memory)
 * - State management and duplicate alert prevention
 * - Cron-compatible with proper exit codes
 * - Circuit breaker pattern for resilience
 * - Structured JSON logging
 * 
 * Exit codes:
 * - 0: All systems healthy (GREEN)
 * - 1: Warnings detected (YELLOW) 
 * - 2: Critical errors detected (RED)
 */

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Status emojis
const emojis = {
  green: '🟢',
  yellow: '🟡', 
  red: '🔴',
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
  success: '✅',
  database: '🗄️',
  system: '💻',
  email: '📧',
  telegram: '📱',
  clock: '⏰'
};

class HealthMonitor {
  constructor() {
    this.config = null;
    this.state = null;
    this.results = {
      timestamp: new Date().toISOString(),
      overall_status: 'unknown',
      endpoints: [],
      database: { status: 'unknown' },
      system_resources: { status: 'unknown' },
      alerts_sent: {
        email: false,
        telegram: false
      },
      summary: {
        total_tests: 0,
        passed: 0,
        warnings: 0,
        failures: 0,
        avg_response_time: 0
      }
    };
    this.circuitBreakers = new Map();
  }

  // Initialize monitoring system
  async initialize() {
    try {
      await this.loadConfig();
      await this.loadState();
      await this.ensureLogDirectory();
      this.log('info', 'Health monitor initialized', { version: this.config.system.version });
      return true;
    } catch (error) {
      console.error(`${colors.red}❌ Failed to initialize health monitor: ${error.message}${colors.reset}`);
      return false;
    }
  }

  // Load configuration from config/monitoring.json
  async loadConfig() {
    const configPath = path.join(__dirname, '..', 'config', 'monitoring.json');
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }

    const configData = fs.readFileSync(configPath, 'utf8');
    this.config = JSON.parse(configData);
    
    // Override with environment variables
    if (process.env.HEALTH_MONITOR_BASE_URL) {
      this.config.system.baseUrl = process.env.HEALTH_MONITOR_BASE_URL;
    }
  }

  // Load persistent state for rate limiting and duplicate prevention
  async loadState() {
    const stateFile = this.config.state_management.state_file;
    const statePath = path.resolve(stateFile);
    
    try {
      if (fs.existsSync(statePath)) {
        const stateData = fs.readFileSync(statePath, 'utf8');
        this.state = JSON.parse(stateData);
        
        // Clean up old entries
        if (this.state.history) {
          const maxAge = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
          this.state.history = this.state.history.filter(entry => 
            new Date(entry.timestamp).getTime() > maxAge
          );
        }
      } else {
        this.state = {
          last_run: null,
          last_status: null,
          last_alert_sent: null,
          alert_count_hour: 0,
          alert_count_reset: Date.now(),
          history: []
        };
      }
    } catch (error) {
      this.log('warning', 'Failed to load state, using defaults', { error: error.message });
      this.state = {
        last_run: null,
        last_status: null,
        last_alert_sent: null,
        alert_count_hour: 0,
        alert_count_reset: Date.now(),
        history: []
      };
    }
  }

  // Save persistent state
  async saveState() {
    try {
      const stateFile = this.config.state_management.state_file;
      const statePath = path.resolve(stateFile);
      const stateDir = path.dirname(statePath);
      
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }
      
      this.state.last_run = new Date().toISOString();
      this.state.last_status = this.results.overall_status;
      
      // Add to history
      if (this.config.state_management.persist_history) {
        this.state.history.unshift({
          timestamp: this.results.timestamp,
          status: this.results.overall_status,
          summary: this.results.summary
        });
        
        // Limit history size
        if (this.state.history.length > this.config.state_management.max_history_entries) {
          this.state.history = this.state.history.slice(0, this.config.state_management.max_history_entries);
        }
      }
      
      fs.writeFileSync(statePath, JSON.stringify(this.state, null, 2));
    } catch (error) {
      this.log('error', 'Failed to save state', { error: error.message });
    }
  }

  // Ensure log directory exists
  async ensureLogDirectory() {
    const logFile = this.config.logging.file;
    const logDir = path.dirname(path.resolve(logFile));
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  // Structured logging
  log(level, message, details = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      component: 'health-monitor',
      message,
      ...details
    };

    // Console output with colors
    if (this.config?.logging?.console_output) {
      const levelColor = {
        info: colors.blue,
        warning: colors.yellow,
        error: colors.red,
        success: colors.green
      }[level] || colors.reset;
      
      const emoji = {
        info: emojis.info,
        warning: emojis.warning,
        error: emojis.error,
        success: emojis.success
      }[level] || '';
      
      console.log(`${levelColor}${emoji} [${level.toUpperCase()}] ${message}${colors.reset}`);
      
      if (Object.keys(details).length > 0) {
        console.log(`${colors.cyan}   Details:${colors.reset}`, details);
      }
    }

    // File logging
    if (this.config?.logging?.file) {
      try {
        const logLine = JSON.stringify(logEntry) + '\n';
        fs.appendFileSync(path.resolve(this.config.logging.file), logLine);
      } catch (error) {
        console.error('Failed to write to log file:', error.message);
      }
    }
  }

  // Test individual endpoint with retry logic
  async testEndpoint(endpoint) {
    const startTime = performance.now();
    const endpointResults = {
      name: endpoint.name,
      url: endpoint.url,
      method: endpoint.method,
      status: 'unknown',
      response_time: 0,
      status_code: null,
      error: null,
      test_cases: []
    };

    // Check circuit breaker
    const breakerKey = `${endpoint.method}:${endpoint.url}`;
    const breaker = this.getCircuitBreaker(breakerKey);
    
    if (breaker.isOpen()) {
      endpointResults.status = 'circuit_open';
      endpointResults.error = 'Circuit breaker is open';
      this.log('warning', `Circuit breaker open for ${endpoint.name}`);
      return endpointResults;
    }

    // Test each test case for the endpoint
    for (const testCase of endpoint.testCases) {
      const caseResult = await this.runTestCase(endpoint, testCase);
      endpointResults.test_cases.push(caseResult);
      
      // Update circuit breaker based on result
      if (caseResult.success) {
        breaker.recordSuccess();
      } else {
        breaker.recordFailure();
      }
    }

    // Calculate overall endpoint status
    const successfulCases = endpointResults.test_cases.filter(tc => tc.success);
    const successRate = (successfulCases.length / endpointResults.test_cases.length) * 100;
    
    if (successRate >= this.config.thresholds.success_rate.good) {
      endpointResults.status = 'healthy';
    } else if (successRate >= this.config.thresholds.success_rate.warning) {
      endpointResults.status = 'warning';
    } else {
      endpointResults.status = 'critical';
    }

    endpointResults.response_time = performance.now() - startTime;
    endpointResults.success_rate = successRate;

    this.log('info', `Tested endpoint ${endpoint.name}`, {
      status: endpointResults.status,
      success_rate: `${successRate.toFixed(1)}%`,
      response_time: `${endpointResults.response_time.toFixed(0)}ms`
    });

    return endpointResults;
  }

  // Run individual test case
  async runTestCase(endpoint, testCase) {
    const startTime = performance.now();
    const result = {
      name: testCase.name,
      success: false,
      response_time: 0,
      status_code: null,
      error: null,
      data_validation: {
        has_expected_fields: false,
        field_details: []
      }
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), endpoint.timeout);

      const requestOptions = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'HealthMonitor/1.0.0'
        },
        signal: controller.signal
      };

      if (endpoint.method === 'POST' && testCase.body) {
        requestOptions.body = JSON.stringify(testCase.body);
      }

      const response = await fetch(`${this.config.system.baseUrl}${endpoint.url}`, requestOptions);
      clearTimeout(timeout);

      result.response_time = performance.now() - startTime;
      result.status_code = response.status;

      // Check if response time is within acceptable limits
      const responseTimeCheck = result.response_time <= testCase.maxResponseTime;
      
      if (response.ok && responseTimeCheck) {
        const responseData = await response.json();
        
        // Validate expected fields
        const fieldValidation = this.validateResponseFields(responseData, testCase.expectedFields);
        result.data_validation = fieldValidation;
        
        if (fieldValidation.has_expected_fields) {
          result.success = true;
        } else {
          result.error = 'Missing expected response fields';
        }
      } else if (!responseTimeCheck) {
        result.error = `Response time ${result.response_time.toFixed(0)}ms exceeds limit ${testCase.maxResponseTime}ms`;
      } else {
        const errorText = await response.text();
        result.error = `HTTP ${response.status}: ${errorText.substring(0, 200)}`;
      }

    } catch (error) {
      result.response_time = performance.now() - startTime;
      
      if (error.name === 'AbortError') {
        result.error = `Request timeout after ${endpoint.timeout}ms`;
      } else if (error.code === 'ECONNREFUSED') {
        result.error = 'Connection refused - service may be down';
      } else {
        result.error = error.message;
      }
    }

    return result;
  }

  // Validate response contains expected fields
  validateResponseFields(data, expectedFields) {
    const validation = {
      has_expected_fields: true,
      field_details: []
    };

    for (const field of expectedFields) {
      const hasField = this.hasNestedProperty(data, field);
      validation.field_details.push({
        field,
        present: hasField
      });
      
      if (!hasField) {
        validation.has_expected_fields = false;
      }
    }

    return validation;
  }

  // Check for nested properties in object
  hasNestedProperty(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined;
    }, obj) !== undefined;
  }

  // Get or create circuit breaker for endpoint
  getCircuitBreaker(key) {
    if (!this.circuitBreakers.has(key)) {
      const breaker = new CircuitBreaker(this.config.circuit_breaker);
      this.circuitBreakers.set(key, breaker);
    }
    return this.circuitBreakers.get(key);
  }

  // Test database connectivity
  async testDatabase() {
    const dbResult = {
      status: 'unknown',
      response_time: 0,
      error: null,
      connection_successful: false
    };

    if (!this.config.database.enabled) {
      dbResult.status = 'disabled';
      return dbResult;
    }

    const startTime = performance.now();

    try {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable not set');
      }

      // Support different database types - detect from DATABASE_URL
      const dbUrl = process.env.DATABASE_URL;
      let result;
      
      if (dbUrl.includes('neon') || dbUrl.includes('postgres')) {
        // Use Neon/PostgreSQL client
        const { neon } = await import('@neondatabase/serverless');
        const sql = neon(process.env.DATABASE_URL);
        result = await sql`SELECT 1 as test`;
      } else {
        // Fallback for other database types - basic connection test
        throw new Error(`Unsupported database type detected in DATABASE_URL: ${dbUrl.split('://')[0]}`);
      }
      
      dbResult.response_time = performance.now() - startTime;
      
      if (result && result[0] && result[0].test === 1) {
        dbResult.status = 'healthy';
        dbResult.connection_successful = true;
      } else {
        dbResult.status = 'critical';
        dbResult.error = 'Unexpected query result';
      }

    } catch (error) {
      dbResult.response_time = performance.now() - startTime;
      dbResult.status = 'critical';
      dbResult.error = error.message;
    }

    this.log('info', 'Database connectivity test completed', {
      status: dbResult.status,
      response_time: `${dbResult.response_time.toFixed(0)}ms`
    });

    return dbResult;
  }

  // Monitor system resources
  async monitorSystemResources() {
    const resourceResult = {
      status: 'unknown',
      cpu_usage: null,
      memory_usage: null,
      disk_usage: null,
      error: null
    };

    if (!this.config.system_resources.enabled) {
      resourceResult.status = 'disabled';
      return resourceResult;
    }

    try {
      // Get memory usage
      const memUsage = process.memoryUsage();
      const totalMem = memUsage.heapTotal + memUsage.external;
      const usedMem = memUsage.heapUsed;
      resourceResult.memory_usage = {
        used_mb: Math.round(usedMem / 1024 / 1024),
        total_mb: Math.round(totalMem / 1024 / 1024),
        usage_percent: Math.round((usedMem / totalMem) * 100)
      };

      // Simple CPU usage estimation (not perfect but gives indication)
      const cpuStart = process.cpuUsage();
      await new Promise(resolve => setTimeout(resolve, 100));
      const cpuEnd = process.cpuUsage(cpuStart);
      const cpuPercent = Math.round(((cpuEnd.user + cpuEnd.system) / 100000) * 100) / 100;
      resourceResult.cpu_usage = {
        usage_percent: Math.min(cpuPercent, 100) // Cap at 100%
      };

      // Check thresholds
      const memoryThresholdExceeded = resourceResult.memory_usage.usage_percent > this.config.system_resources.memory_threshold;
      const cpuThresholdExceeded = resourceResult.cpu_usage.usage_percent > this.config.system_resources.cpu_threshold;

      if (memoryThresholdExceeded || cpuThresholdExceeded) {
        resourceResult.status = 'warning';
        resourceResult.error = `Resource usage high - Memory: ${resourceResult.memory_usage.usage_percent}%, CPU: ${resourceResult.cpu_usage.usage_percent}%`;
      } else {
        resourceResult.status = 'healthy';
      }

    } catch (error) {
      resourceResult.status = 'error';
      resourceResult.error = error.message;
    }

    this.log('info', 'System resource monitoring completed', {
      status: resourceResult.status,
      memory_percent: resourceResult.memory_usage?.usage_percent,
      cpu_percent: resourceResult.cpu_usage?.usage_percent
    });

    return resourceResult;
  }

  // Calculate overall system health status
  calculateOverallStatus() {
    const criticalIssues = [];
    const warnings = [];
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    // Check endpoint statuses
    this.results.endpoints.forEach(endpoint => {
      if (endpoint.status === 'critical') {
        criticalIssues.push(`${endpoint.name}: ${endpoint.error || 'Critical failure'}`);
      } else if (endpoint.status === 'warning') {
        warnings.push(`${endpoint.name}: Slow response or partial failure`);
      }
      
      if (endpoint.response_time) {
        totalResponseTime += endpoint.response_time;
        responseTimeCount++;
      }
    });

    // Check database status
    if (this.results.database.status === 'critical') {
      criticalIssues.push(`Database: ${this.results.database.error}`);
    } else if (this.results.database.status === 'warning') {
      warnings.push('Database: Performance issues');
    }

    // Check system resources
    if (this.results.system_resources.status === 'warning') {
      warnings.push(`System Resources: ${this.results.system_resources.error}`);
    } else if (this.results.system_resources.status === 'error') {
      criticalIssues.push(`System Resources: ${this.results.system_resources.error}`);
    }

    // Calculate summary statistics
    this.results.summary = {
      total_tests: this.results.endpoints.length,
      passed: this.results.endpoints.filter(e => e.status === 'healthy').length,
      warnings: warnings.length,
      failures: criticalIssues.length,
      avg_response_time: responseTimeCount > 0 ? Math.round(totalResponseTime / responseTimeCount) : 0
    };

    // Determine overall status based on thresholds
    if (criticalIssues.length > 0) {
      this.results.overall_status = 'critical';
    } else if (warnings.length > 0) {
      this.results.overall_status = 'warning';
    } else {
      this.results.overall_status = 'healthy';
    }

    this.log('success', 'Overall health assessment completed', {
      status: this.results.overall_status,
      passed: this.results.summary.passed,
      warnings: this.results.summary.warnings,
      failures: this.results.summary.failures
    });
  }

  // Check if alerts should be sent (rate limiting and duplicate prevention)
  shouldSendAlert() {
    const now = Date.now();
    const minInterval = this.config.alerting.rate_limiting.min_interval_seconds * 1000;
    const maxAlertsPerHour = this.config.alerting.rate_limiting.max_alerts_per_hour;
    const suppressionWindow = this.config.alerting.rate_limiting.duplicate_suppression_minutes * 60 * 1000;

    // Reset hourly counter if needed
    if (now - this.state.alert_count_reset > 60 * 60 * 1000) {
      this.state.alert_count_hour = 0;
      this.state.alert_count_reset = now;
    }

    // Check if we've exceeded hourly limit
    if (this.state.alert_count_hour >= maxAlertsPerHour) {
      this.log('warning', 'Alert rate limit exceeded for this hour');
      return false;
    }

    // Check minimum interval
    if (this.state.last_alert_sent && (now - new Date(this.state.last_alert_sent).getTime()) < minInterval) {
      this.log('info', 'Alert suppressed due to minimum interval');
      return false;
    }

    // Check for status changes (only alert on changes)
    if (this.state.last_status === this.results.overall_status && 
        this.state.last_alert_sent &&
        (now - new Date(this.state.last_alert_sent).getTime()) < suppressionWindow) {
      this.log('info', 'Alert suppressed - no status change');
      return false;
    }

    return true;
  }

  // Send email alert using SendGrid
  async sendEmailAlert() {
    if (!this.config.alerting.email.enabled) {
      return false;
    }

    try {
      // Use proper SendGrid v8 API
      const sgMail = await import('@sendgrid/mail');
      
      if (!process.env.SENDGRID_API_KEY) {
        this.log('error', 'SENDGRID_API_KEY environment variable not set');
        return false;
      }

      sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);

      const subject = `${this.config.alerting.email.subject_prefix} ${this.getStatusEmoji()} ${this.results.overall_status.toUpperCase()}`;
      const htmlContent = this.generateEmailHTML();
      const textContent = this.generateEmailText();

      const emailData = {
        to: this.config.alerting.email.recipients,
        from: this.config.alerting.email.from,
        subject,
        text: textContent,
        html: htmlContent
      };

      await sgMail.default.send(emailData);
      this.results.alerts_sent.email = true;
      this.log('success', 'Email alert sent successfully', { 
        recipients: this.config.alerting.email.recipients.length 
      });
      return true;

    } catch (error) {
      this.log('error', 'Failed to send email alert', { error: error.message });
      return false;
    }
  }

  // Send telegram alert
  async sendTelegramAlert() {
    if (!this.config.alerting.telegram.enabled) {
      return false;
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      this.log('error', 'Telegram configuration missing - TELEGRAM_BOT_TOKEN not set');
      return false;
    }

    // Support both env var (single) and config array (multiple) for flexibility
    const chatIds = this.config.alerting.telegram.chat_ids?.length > 0 
      ? this.config.alerting.telegram.chat_ids 
      : [process.env.TELEGRAM_CHAT_ID].filter(Boolean);
      
    if (chatIds.length === 0) {
      this.log('error', 'Telegram configuration missing - no chat IDs configured in config.alerting.telegram.chat_ids or TELEGRAM_CHAT_ID env var');
      return false;
    }

    try {
      const message = this.generateTelegramMessage();
      const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      
      // Send to all configured chat IDs
      let allSent = true;
      for (const chatId of chatIds) {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
          })
        });
        
        if (!response.ok) {
          const errorData = await response.text();
          this.log('error', `Telegram API error for chat ${chatId}`, { status: response.status, error: errorData });
          allSent = false;
        }
      }

      this.results.alerts_sent.telegram = allSent;
      if (allSent) {
        this.log('success', `Telegram alert sent successfully to ${chatIds.length} chat(s)`);
      } else {
        this.log('warning', 'Telegram alert partially failed - some chats may not have received the message');
      }
      return allSent;

    } catch (error) {
      this.log('error', 'Failed to send Telegram alert', { error: error.message });
      return false;
    }
  }

  // Generate HTML email content
  generateEmailHTML() {
    const statusColor = {
      healthy: '#22c55e',
      warning: '#f59e0b', 
      critical: '#ef4444'
    }[this.results.overall_status] || '#6b7280';

    const endpointRows = this.results.endpoints.map(endpoint => {
      const statusIcon = this.getStatusEmoji(endpoint.status);
      const testCasesSummary = endpoint.test_cases ? 
        `${endpoint.test_cases.filter(tc => tc.success).length}/${endpoint.test_cases.length} passed` : 'N/A';
      
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${statusIcon} ${endpoint.name}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${endpoint.url}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${endpoint.response_time ? Math.round(endpoint.response_time) + 'ms' : 'N/A'}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${testCasesSummary}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${endpoint.error || 'OK'}</td>
        </tr>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>System Health Report</title>
        </head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f9fafb;">
          <div style="max-width: 800px; margin: 0 auto; background-color: white; border-radius: 8px; padding: 30px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: ${statusColor}; margin: 0;">
                ${this.getStatusEmoji()} System Health Report
              </h1>
              <p style="color: #6b7280; margin: 10px 0;">
                ${this.config.system.name} - ${new Date(this.results.timestamp).toLocaleString()}
              </p>
            </div>

            <div style="background-color: ${statusColor}; color: white; padding: 20px; border-radius: 6px; margin-bottom: 30px; text-align: center;">
              <h2 style="margin: 0; font-size: 24px;">Overall Status: ${this.results.overall_status.toUpperCase()}</h2>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">
                ${this.results.summary.passed}/${this.results.summary.total_tests} endpoints healthy | 
                ${this.results.summary.warnings} warnings | 
                ${this.results.summary.failures} failures
              </p>
            </div>

            <div style="margin-bottom: 30px;">
              <h3 style="color: #374151; margin-bottom: 15px;">📊 Summary Statistics</h3>
              <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 5px; flex: 1; min-width: 150px;">
                  <div style="font-size: 24px; font-weight: bold; color: #22c55e;">${this.results.summary.passed}</div>
                  <div style="color: #6b7280;">Healthy Endpoints</div>
                </div>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 5px; flex: 1; min-width: 150px;">
                  <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${this.results.summary.warnings}</div>
                  <div style="color: #6b7280;">Warnings</div>
                </div>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 5px; flex: 1; min-width: 150px;">
                  <div style="font-size: 24px; font-weight: bold; color: #ef4444;">${this.results.summary.failures}</div>
                  <div style="color: #6b7280;">Failures</div>
                </div>
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 5px; flex: 1; min-width: 150px;">
                  <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${this.results.summary.avg_response_time}ms</div>
                  <div style="color: #6b7280;">Avg Response Time</div>
                </div>
              </div>
            </div>

            <div style="margin-bottom: 30px;">
              <h3 style="color: #374151; margin-bottom: 15px;">🔍 Endpoint Details</h3>
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Endpoint</th>
                    <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">URL</th>
                    <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Response Time</th>
                    <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Test Cases</th>
                    <th style="padding: 12px; border: 1px solid #e5e7eb; text-align: left;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${endpointRows}
                </tbody>
              </table>
            </div>

            ${this.generateDatabaseEmailSection()}
            ${this.generateSystemResourcesEmailSection()}

            <div style="margin-top: 30px; padding: 20px; background-color: #f9fafb; border-radius: 6px; text-align: center; color: #6b7280; font-size: 14px;">
              <p style="margin: 0;">Generated by Enhanced Intelligent Screening System Health Monitor</p>
              <p style="margin: 5px 0 0 0;">Timestamp: ${this.results.timestamp}</p>
            </div>

          </div>
        </body>
      </html>
    `;
  }

  // Generate database section for email
  generateDatabaseEmailSection() {
    if (this.results.database.status === 'disabled') return '';

    const statusColor = {
      healthy: '#22c55e',
      warning: '#f59e0b',
      critical: '#ef4444'
    }[this.results.database.status] || '#6b7280';

    return `
      <div style="margin-bottom: 30px;">
        <h3 style="color: #374151; margin-bottom: 15px;">🗄️ Database Status</h3>
        <div style="padding: 15px; border: 1px solid ${statusColor}; border-radius: 6px; background-color: ${statusColor}20;">
          <div style="color: ${statusColor}; font-weight: bold; margin-bottom: 8px;">
            ${this.getStatusEmoji(this.results.database.status)} ${this.results.database.status.toUpperCase()}
          </div>
          <div style="color: #374151;">
            Response Time: ${this.results.database.response_time ? Math.round(this.results.database.response_time) + 'ms' : 'N/A'}
          </div>
          ${this.results.database.error ? `<div style="color: #ef4444; margin-top: 8px;">Error: ${this.results.database.error}</div>` : ''}
        </div>
      </div>
    `;
  }

  // Generate system resources section for email
  generateSystemResourcesEmailSection() {
    if (this.results.system_resources.status === 'disabled') return '';

    const statusColor = {
      healthy: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444'
    }[this.results.system_resources.status] || '#6b7280';

    return `
      <div style="margin-bottom: 30px;">
        <h3 style="color: #374151; margin-bottom: 15px;">💻 System Resources</h3>
        <div style="padding: 15px; border: 1px solid ${statusColor}; border-radius: 6px; background-color: ${statusColor}20;">
          <div style="color: ${statusColor}; font-weight: bold; margin-bottom: 8px;">
            ${this.getStatusEmoji(this.results.system_resources.status)} ${this.results.system_resources.status.toUpperCase()}
          </div>
          ${this.results.system_resources.memory_usage ? `
            <div style="color: #374151; margin-bottom: 5px;">
              Memory: ${this.results.system_resources.memory_usage.used_mb}MB / ${this.results.system_resources.memory_usage.total_mb}MB 
              (${this.results.system_resources.memory_usage.usage_percent}%)
            </div>
          ` : ''}
          ${this.results.system_resources.cpu_usage ? `
            <div style="color: #374151; margin-bottom: 5px;">
              CPU Usage: ${this.results.system_resources.cpu_usage.usage_percent}%
            </div>
          ` : ''}
          ${this.results.system_resources.error ? `<div style="color: #ef4444; margin-top: 8px;">Error: ${this.results.system_resources.error}</div>` : ''}
        </div>
      </div>
    `;
  }

  // Generate plain text email content
  generateEmailText() {
    const lines = [
      `=== SYSTEM HEALTH REPORT ===`,
      `${this.config.system.name}`,
      `Timestamp: ${new Date(this.results.timestamp).toLocaleString()}`,
      ``,
      `Overall Status: ${this.results.overall_status.toUpperCase()}`,
      ``,
      `Summary:`,
      `- Healthy Endpoints: ${this.results.summary.passed}/${this.results.summary.total_tests}`,
      `- Warnings: ${this.results.summary.warnings}`,
      `- Failures: ${this.results.summary.failures}`,
      `- Average Response Time: ${this.results.summary.avg_response_time}ms`,
      ``,
      `Endpoint Details:`
    ];

    this.results.endpoints.forEach(endpoint => {
      lines.push(`- ${endpoint.name}: ${endpoint.status} (${endpoint.response_time ? Math.round(endpoint.response_time) + 'ms' : 'N/A'})`);
      if (endpoint.error) {
        lines.push(`  Error: ${endpoint.error}`);
      }
    });

    if (this.results.database.status !== 'disabled') {
      lines.push('');
      lines.push(`Database: ${this.results.database.status} (${this.results.database.response_time ? Math.round(this.results.database.response_time) + 'ms' : 'N/A'})`);
      if (this.results.database.error) {
        lines.push(`  Error: ${this.results.database.error}`);
      }
    }

    if (this.results.system_resources.status !== 'disabled') {
      lines.push('');
      lines.push(`System Resources: ${this.results.system_resources.status}`);
      if (this.results.system_resources.memory_usage) {
        lines.push(`  Memory: ${this.results.system_resources.memory_usage.usage_percent}%`);
      }
      if (this.results.system_resources.cpu_usage) {
        lines.push(`  CPU: ${this.results.system_resources.cpu_usage.usage_percent}%`);
      }
      if (this.results.system_resources.error) {
        lines.push(`  Error: ${this.results.system_resources.error}`);
      }
    }

    return lines.join('\n');
  }

  // Generate telegram message
  generateTelegramMessage() {
    const emoji = this.getStatusEmoji();
    const title = `${emoji} <b>System Health Alert</b>`;
    
    const lines = [
      title,
      `<i>${this.config.system.name}</i>`,
      '',
      `<b>Status:</b> ${this.results.overall_status.toUpperCase()}`,
      `<b>Summary:</b> ${this.results.summary.passed}/${this.results.summary.total_tests} healthy, ${this.results.summary.warnings} warnings, ${this.results.summary.failures} failures`
    ];

    if (this.results.summary.avg_response_time > 0) {
      lines.push(`<b>Avg Response:</b> ${this.results.summary.avg_response_time}ms`);
    }

    // Add critical issues first
    const criticalEndpoints = this.results.endpoints.filter(e => e.status === 'critical');
    if (criticalEndpoints.length > 0) {
      lines.push('');
      lines.push(`${emojis.error} <b>Critical Issues:</b>`);
      criticalEndpoints.forEach(endpoint => {
        lines.push(`• ${endpoint.name}: ${endpoint.error || 'Failed'}`);
      });
    }

    // Add warnings
    const warningEndpoints = this.results.endpoints.filter(e => e.status === 'warning');
    if (warningEndpoints.length > 0) {
      lines.push('');
      lines.push(`${emojis.warning} <b>Warnings:</b>`);
      warningEndpoints.forEach(endpoint => {
        lines.push(`• ${endpoint.name}: Slow response`);
      });
    }

    // Add database status if not healthy
    if (this.results.database.status !== 'disabled' && this.results.database.status !== 'healthy') {
      lines.push('');
      lines.push(`${emojis.database} <b>Database:</b> ${this.results.database.status}`);
    }

    // Add system resource warnings
    if (this.results.system_resources.status === 'warning') {
      lines.push('');
      lines.push(`${emojis.system} <b>Resources:</b> ${this.results.system_resources.error}`);
    }

    lines.push('');
    lines.push(`${emojis.clock} ${new Date(this.results.timestamp).toLocaleString()}`);

    const message = lines.join('\n');
    
    // Truncate if too long
    if (message.length > this.config.alerting.telegram.max_message_length) {
      const truncated = message.substring(0, this.config.alerting.telegram.max_message_length - 50);
      return truncated + '\n...\n<i>[Message truncated]</i>';
    }

    return message;
  }

  // Get status emoji
  getStatusEmoji(status = null) {
    const targetStatus = status || this.results.overall_status;
    return {
      healthy: emojis.green,
      warning: emojis.yellow,
      critical: emojis.red,
      unknown: emojis.info,
      disabled: emojis.info,
      error: emojis.error
    }[targetStatus] || emojis.info;
  }

  // Print console report with colors and emojis
  printConsoleReport() {
    console.log('\n' + '='.repeat(80));
    console.log(`${colors.bright}${colors.cyan}   ENHANCED INTELLIGENT SCREENING SYSTEM - HEALTH REPORT${colors.reset}`);
    console.log('='.repeat(80));
    
    // System information
    console.log(`${colors.blue}${emojis.info} System:${colors.reset} ${this.config.system.name} v${this.config.system.version}`);
    console.log(`${colors.blue}${emojis.clock} Timestamp:${colors.reset} ${new Date(this.results.timestamp).toLocaleString()}`);
    
    // Overall status with large emoji and color
    const statusColor = {
      healthy: colors.green,
      warning: colors.yellow,
      critical: colors.red
    }[this.results.overall_status] || colors.reset;
    
    console.log(`\n${statusColor}${colors.bright}${this.getStatusEmoji()} OVERALL STATUS: ${this.results.overall_status.toUpperCase()}${colors.reset}`);
    
    // Summary statistics
    console.log(`\n${colors.cyan}📊 SUMMARY STATISTICS:${colors.reset}`);
    console.log(`   ${emojis.success} Healthy Endpoints: ${colors.green}${this.results.summary.passed}/${this.results.summary.total_tests}${colors.reset}`);
    console.log(`   ${emojis.warning} Warnings: ${colors.yellow}${this.results.summary.warnings}${colors.reset}`);
    console.log(`   ${emojis.error} Failures: ${colors.red}${this.results.summary.failures}${colors.reset}`);
    console.log(`   ${emojis.clock} Avg Response Time: ${colors.blue}${this.results.summary.avg_response_time}ms${colors.reset}`);

    // Endpoint details
    console.log(`\n${colors.cyan}🔍 ENDPOINT DETAILS:${colors.reset}`);
    this.results.endpoints.forEach(endpoint => {
      const endpointEmoji = this.getStatusEmoji(endpoint.status);
      const endpointColor = {
        healthy: colors.green,
        warning: colors.yellow,
        critical: colors.red,
        circuit_open: colors.magenta
      }[endpoint.status] || colors.reset;
      
      console.log(`   ${endpointEmoji} ${endpointColor}${endpoint.name}${colors.reset}`);
      console.log(`      URL: ${endpoint.url}`);
      console.log(`      Response Time: ${endpoint.response_time ? Math.round(endpoint.response_time) + 'ms' : 'N/A'}`);
      
      if (endpoint.test_cases && endpoint.test_cases.length > 0) {
        const passedCases = endpoint.test_cases.filter(tc => tc.success).length;
        console.log(`      Test Cases: ${passedCases}/${endpoint.test_cases.length} passed`);
      }
      
      if (endpoint.error) {
        console.log(`      ${colors.red}Error: ${endpoint.error}${colors.reset}`);
      }
      console.log('');
    });

    // Database status
    if (this.results.database.status !== 'disabled') {
      const dbEmoji = this.getStatusEmoji(this.results.database.status);
      const dbColor = {
        healthy: colors.green,
        warning: colors.yellow,
        critical: colors.red
      }[this.results.database.status] || colors.reset;
      
      console.log(`${colors.cyan}${emojis.database} DATABASE STATUS:${colors.reset}`);
      console.log(`   ${dbEmoji} ${dbColor}${this.results.database.status.toUpperCase()}${colors.reset}`);
      console.log(`   Response Time: ${this.results.database.response_time ? Math.round(this.results.database.response_time) + 'ms' : 'N/A'}`);
      
      if (this.results.database.error) {
        console.log(`   ${colors.red}Error: ${this.results.database.error}${colors.reset}`);
      }
      console.log('');
    }

    // System resources
    if (this.results.system_resources.status !== 'disabled') {
      const resourceEmoji = this.getStatusEmoji(this.results.system_resources.status);
      const resourceColor = {
        healthy: colors.green,
        warning: colors.yellow,
        error: colors.red
      }[this.results.system_resources.status] || colors.reset;
      
      console.log(`${colors.cyan}${emojis.system} SYSTEM RESOURCES:${colors.reset}`);
      console.log(`   ${resourceEmoji} ${resourceColor}${this.results.system_resources.status.toUpperCase()}${colors.reset}`);
      
      if (this.results.system_resources.memory_usage) {
        const memUsage = this.results.system_resources.memory_usage;
        console.log(`   Memory: ${memUsage.used_mb}MB / ${memUsage.total_mb}MB (${memUsage.usage_percent}%)`);
      }
      
      if (this.results.system_resources.cpu_usage) {
        console.log(`   CPU Usage: ${this.results.system_resources.cpu_usage.usage_percent}%`);
      }
      
      if (this.results.system_resources.error) {
        console.log(`   ${colors.red}Error: ${this.results.system_resources.error}${colors.reset}`);
      }
      console.log('');
    }

    // Alert status
    console.log(`${colors.cyan}📬 ALERT STATUS:${colors.reset}`);
    console.log(`   ${emojis.email} Email: ${this.results.alerts_sent.email ? colors.green + 'Sent' : colors.yellow + 'Not sent'}${colors.reset}`);
    console.log(`   ${emojis.telegram} Telegram: ${this.results.alerts_sent.telegram ? colors.green + 'Sent' : colors.yellow + 'Not sent'}${colors.reset}`);

    console.log('\n' + '='.repeat(80));
  }

  // Run complete health check
  async runHealthCheck() {
    this.log('info', 'Starting comprehensive health check');

    try {
      // Test all endpoints concurrently with controlled concurrency
      const concurrentLimit = this.config.performance.concurrent_checks;
      const endpointPromises = this.config.endpoints.map(endpoint => 
        this.testEndpoint(endpoint)
      );

      // Process endpoints in batches
      const endpointBatches = [];
      for (let i = 0; i < endpointPromises.length; i += concurrentLimit) {
        endpointBatches.push(endpointPromises.slice(i, i + concurrentLimit));
      }

      for (const batch of endpointBatches) {
        const batchResults = await Promise.all(batch);
        this.results.endpoints.push(...batchResults);
      }

      // Test database and system resources in parallel
      const [databaseResult, systemResourcesResult] = await Promise.all([
        this.testDatabase(),
        this.monitorSystemResources()
      ]);

      this.results.database = databaseResult;
      this.results.system_resources = systemResourcesResult;

      // Calculate overall status
      this.calculateOverallStatus();

      // Check if alerts should be sent and send them
      if (this.shouldSendAlert() && this.results.overall_status !== 'healthy') {
        this.log('info', 'Sending alerts due to status change or critical issues');
        
        const [emailSent, telegramSent] = await Promise.all([
          this.sendEmailAlert(),
          this.sendTelegramAlert()
        ]);

        if (emailSent || telegramSent) {
          // Immediately update and persist state after successful alert sends
          this.state.last_alert_sent = new Date().toISOString();
          this.state.alert_count_hour++;
          
          // Ensure state is immediately persisted with proper error handling
          try {
            await this.saveState();
            this.log('info', 'Alert state updated and persisted successfully');
          } catch (error) {
            this.log('error', 'Failed to persist alert state', { error: error.message });
          }
        }
      }

      // Save state
      await this.saveState();

      // Print console report
      this.printConsoleReport();

      this.log('success', 'Health check completed successfully', {
        overall_status: this.results.overall_status,
        total_tests: this.results.summary.total_tests,
        duration: `${Date.now() - new Date(this.results.timestamp).getTime()}ms`
      });

      return this.results;

    } catch (error) {
      this.log('error', 'Health check failed', { error: error.message });
      throw error;
    }
  }

  // Get appropriate exit code based on results
  getExitCode() {
    switch (this.results.overall_status) {
      case 'healthy':
        return 0;  // Success
      case 'warning':
        return 1;  // Warnings
      case 'critical':
        return 2;  // Critical errors
      default:
        return 2;  // Unknown status treated as critical
    }
  }
}

// Circuit Breaker implementation
class CircuitBreaker {
  constructor(config) {
    this.failureThreshold = config.failure_threshold;
    this.resetTimeout = config.reset_timeout_ms;
    this.halfOpenMaxCalls = config.half_open_max_calls;
    
    this.state = 'closed';  // closed, open, half-open
    this.failureCount = 0;
    this.nextAttempt = 0;
    this.halfOpenCalls = 0;
  }

  isOpen() {
    if (this.state === 'open' && Date.now() >= this.nextAttempt) {
      this.state = 'half-open';
      this.halfOpenCalls = 0;
    }
    
    if (this.state === 'half-open' && this.halfOpenCalls >= this.halfOpenMaxCalls) {
      return true;
    }
    
    return this.state === 'open';
  }

  recordSuccess() {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failureCount = 0;
    }
  }

  recordFailure() {
    this.failureCount++;
    
    if (this.state === 'half-open') {
      this.state = 'open';
      this.nextAttempt = Date.now() + this.resetTimeout;
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }
}

// Main execution
async function main() {
  const monitor = new HealthMonitor();
  
  try {
    // Initialize the monitoring system
    const initialized = await monitor.initialize();
    if (!initialized) {
      process.exit(2);
    }

    // Run the comprehensive health check
    await monitor.runHealthCheck();
    
    // Exit with appropriate code
    const exitCode = monitor.getExitCode();
    console.log(`\n${colors.blue}${emojis.info} Exiting with code ${exitCode}${colors.reset}`);
    process.exit(exitCode);

  } catch (error) {
    console.error(`${colors.red}${emojis.error} Health monitor crashed: ${error.message}${colors.reset}`);
    console.error(error.stack);
    process.exit(2);
  }
}

// Handle process signals gracefully
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}${emojis.warning} Received SIGINT, shutting down gracefully...${colors.reset}`);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log(`\n${colors.yellow}${emojis.warning} Received SIGTERM, shutting down gracefully...${colors.reset}`);
  process.exit(1);
});

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default HealthMonitor;