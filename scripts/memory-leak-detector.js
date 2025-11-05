#!/usr/bin/env node

/**
 * Memory Leak Detection System
 * 
 * Detects exponential memory growth patterns and sends critical alerts
 * Integrates with existing Telegram alerting system
 * 
 * Features:
 * - Real-time memory monitoring for Node.js and Python processes
 * - Exponential growth detection algorithm
 * - Historical trend analysis
 * - Automatic Telegram alerts for critical leaks
 * - Process cleanup recommendations
 * - Memory usage statistics and reporting
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { sendTelegramAlert } from './telegram-alerter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  // Memory thresholds (in MB)
  CRITICAL_MEMORY_THRESHOLD: 500,  // Alert if any process exceeds 500MB
  WARNING_MEMORY_THRESHOLD: 200,   // Warning if any process exceeds 200MB
  
  // Growth detection settings
  GROWTH_CHECK_INTERVAL: 60000,   // Check every 1 minute (in ms)
  EXTERNAL_GROWTH_RATE: 5.0,      // MB/min - Alert if growth exceeds this
  EXPONENTIAL_THRESHOLD: 1.5,      // Growth acceleration factor
  
  // Data retention
  HISTORY_SIZE: 60,               // Keep 60 data points (1 hour of data)
  DATA_FILE: '/tmp/memory-leak-data.json',
  
  // Process monitoring
  MONITORED_PROCESSES: ['node', 'python3', 'uvicorn'],
  EXCLUDE_PATTERNS: ['vscode-server', 'grep', 'systemd'],
  
  // Alert settings
  ALERT_COOLDOWN: 300000,         // 5 minutes between alerts
  MAX_ALERTS_PER_HOUR: 3,
  
  // Auto-cleanup settings
  AUTO_CLEANUP_ENABLED: false,    // Set to true to enable automatic process termination
  AUTO_CLEANUP_THRESHOLD: 1000,   // MB - Auto-terminate if process exceeds this
};

class MemoryLeakDetector {
  constructor() {
    this.memoryHistory = [];
    this.lastAlertTime = 0;
    this.alertCount = 0;
    this.alertCountReset = Date.now();
    this.loadData();
  }

  // Load historical data
  loadData() {
    try {
      if (fs.existsSync(CONFIG.DATA_FILE)) {
        const data = fs.readFileSync(CONFIG.DATA_FILE, 'utf8');
        const parsed = JSON.parse(data);
        this.memoryHistory = parsed.memoryHistory || [];
        this.lastAlertTime = parsed.lastAlertTime || 0;
        this.alertCount = parsed.alertCount || 0;
        this.alertCountReset = parsed.alertCountReset || Date.now();
        
        // Clean old data
        const cutoff = Date.now() - (CONFIG.HISTORY_SIZE * CONFIG.GROWTH_CHECK_INTERVAL);
        this.memoryHistory = this.memoryHistory.filter(entry => entry.timestamp > cutoff);
        
        console.log(`📊 Loaded ${this.memoryHistory.length} historical data points`);
      }
    } catch (error) {
      console.warn('⚠️  Failed to load historical data:', error.message);
    }
  }

  // Save current data
  saveData() {
    try {
      const data = {
        memoryHistory: this.memoryHistory,
        lastAlertTime: this.lastAlertTime,
        alertCount: this.alertCount,
        alertCountReset: this.alertCountReset,
        lastUpdate: new Date().toISOString()
      };
      fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.warn('⚠️  Failed to save data:', error.message);
    }
  }

  // Get current memory usage for all monitored processes
  getCurrentMemoryUsage() {
    try {
      const output = execSync('ps aux --sort=-%mem | head -20', { encoding: 'utf8' });
      const lines = output.split('\n').slice(1); // Skip header
      
      const processes = [];
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        const parts = line.trim().split(/\s+/);
        if (parts.length < 11) continue;
        
        const user = parts[0];
        const pid = parts[1];
        const cpu = parseFloat(parts[2]);
        const mem = parseFloat(parts[3]);
        const vsz = parseInt(parts[4]);
        const rss = parseInt(parts[5]);
        const tty = parts[6];
        const stat = parts[7];
        const start = parts[8];
        const time = parts[9];
        const command = parts.slice(10).join(' ');
        
        // Check if this is a monitored process
        const isMonitored = CONFIG.MONITORED_PROCESSES.some(proc => 
          command.includes(proc) && !CONFIG.EXCLUDE_PATTERNS.some(pattern => 
            command.includes(pattern)
          )
        );
        
        if (isMonitored) {
          processes.push({
            pid,
            user,
            cpu,
            mem,
            vsz,
            rss,
            tty,
            stat,
            start,
            time,
            command,
            memoryMB: Math.round(rss / 1024),
            timestamp: Date.now()
          });
        }
      }
      
      return processes;
    } catch (error) {
      console.error('❌ Failed to get memory usage:', error.message);
      return [];
    }
  }

  // Analyze memory growth patterns
  analyzeGrowthTrends() {
    if (this.memoryHistory.length < 3) {
      return { hasLeak: false, reason: 'Insufficient data' };
    }

    const latest = this.memoryHistory[this.memoryHistory.length - 1];
    const previous = this.memoryHistory[this.memoryHistory.length - 2];
    const older = this.memoryHistory[this.memoryHistory.length - 3];

    // Calculate growth rates
    const recentGrowth = this.calculateGrowthRate(previous, latest);
    const previousGrowth = this.calculateGrowthRate(older, previous);
    
    // Check for exponential growth (acceleration)
    const acceleration = recentGrowth.rate / previousGrowth.rate;
    
    // Check total memory usage
    const totalMemory = latest.totalMemoryMB;
    
    const issues = [];
    
    // Critical memory threshold
    if (totalMemory > CONFIG.CRITICAL_MEMORY_THRESHOLD) {
      issues.push({
        severity: 'CRITICAL',
        type: 'threshold',
        message: `Total memory usage ${totalMemory}MB exceeds critical threshold ${CONFIG.CRITICAL_MEMORY_THRESHOLD}MB`
      });
    }
    
    // Warning memory threshold
    if (totalMemory > CONFIG.WARNING_MEMORY_THRESHOLD) {
      issues.push({
        severity: 'WARNING',
        type: 'threshold',
        message: `Total memory usage ${totalMemory}MB exceeds warning threshold ${CONFIG.WARNING_MEMORY_THRESHOLD}MB`
      });
    }
    
    // Exponential growth detection
    if (acceleration > CONFIG.EXPONENTIAL_THRESHOLD && recentGrowth.rate > CONFIG.EXTERNAL_GROWTH_RATE) {
      issues.push({
        severity: 'CRITICAL',
        type: 'exponential',
        message: `Exponential memory growth detected! Acceleration: ${acceleration.toFixed(2)}x, Growth rate: ${recentGrowth.rate.toFixed(2)}MB/min`
      });
    }
    
    // High growth rate
    if (recentGrowth.rate > CONFIG.EXTERNAL_GROWTH_RATE) {
      issues.push({
        severity: 'WARNING',
        type: 'growth_rate',
        message: `High memory growth rate: ${recentGrowth.rate.toFixed(2)}MB/min`
      });
    }
    
    return {
      hasLeak: issues.length > 0,
      issues,
      growthRate: recentGrowth.rate,
      acceleration,
      totalMemory,
      processes: latest.processes
    };
  }

  // Calculate growth rate between two data points
  calculateGrowthRate(older, newer) {
    if (!older || !newer) return { rate: 0, change: 0 };
    
    const timeDiff = (newer.timestamp - older.timestamp) / 60000; // Convert to minutes
    const memoryDiff = newer.totalMemoryMB - older.totalMemoryMB;
    
    return {
      rate: timeDiff > 0 ? memoryDiff / timeDiff : 0,
      change: memoryDiff,
      timeDiff
    };
  }

  // Check if we should send an alert
  shouldSendAlert(severity) {
    const now = Date.now();
    
    // Reset hourly counter if needed
    if (now - this.alertCountReset > 3600000) { // 1 hour
      this.alertCount = 0;
      this.alertCountReset = now;
    }
    
    // Check hourly limit
    if (this.alertCount >= CONFIG.MAX_ALERTS_PER_HOUR) {
      return false;
    }
    
    // Check cooldown
    if (now - this.lastAlertTime < CONFIG.ALERT_COOLDOWN) {
      return false;
    }
    
    return true;
  }

  // Send memory leak alert
  async sendMemoryLeakAlert(analysis) {
    if (!this.shouldSendAlert(analysis.issues[0]?.severity)) {
      console.log('⏰ Alert suppressed due to cooldown or rate limit');
      return false;
    }

    const criticalIssues = analysis.issues.filter(i => i.severity === 'CRITICAL');
    const warnings = analysis.issues.filter(i => i.severity === 'WARNING');
    
    let message = `🔬 <b>Memory Leak Detection Alert</b>\n\n`;
    
    if (criticalIssues.length > 0) {
      message += `🚨 <b>CRITICAL ISSUES DETECTED:</b>\n`;
      criticalIssues.forEach(issue => {
        message += `• ${issue.message}\n`;
      });
    }
    
    if (warnings.length > 0) {
      message += `⚠️ <b>WARNINGS:</b>\n`;
      warnings.forEach(issue => {
        message += `• ${issue.message}\n`;
      });
    }
    
    message += `\n📊 <b>Memory Statistics:</b>\n`;
    message += `• Total Memory: ${analysis.totalMemory}MB\n`;
    message += `• Growth Rate: ${analysis.growthRate.toFixed(2)}MB/min\n`;
    message += `• Acceleration: ${analysis.acceleration.toFixed(2)}x\n`;
    
    // Top memory-consuming processes
    const topProcesses = analysis.processes
      .sort((a, b) => b.memoryMB - a.memoryMB)
      .slice(0, 5);
    
    if (topProcesses.length > 0) {
      message += `\n🔍 <b>Top Processes:</b>\n`;
      topProcesses.forEach((proc, index) => {
        message += `${index + 1}. ${proc.command.substring(0, 50)}... - ${proc.memoryMB}MB (PID: ${proc.pid})\n`;
      });
    }
    
    message += `\n💡 <b>Recommended Actions:</b>\n`;
    message += `• Review heap snapshots and memory profiles\n`;
    message += `• Consider restarting services if critical\n`;
    message += `• Check for unclosed connections or event listeners\n`;
    message += `• Monitor for memory-intensive operations\n`;
    
    message += `\n🕐 <b>Time:</b> ${new Date().toLocaleString()}`;
    
    const success = await sendTelegramAlert(message, { priority: 'high' });
    
    if (success) {
      this.lastAlertTime = Date.now();
      this.alertCount++;
      this.saveData();
    }
    
    return success;
  }

  // Auto-cleanup problematic processes
  async autoCleanup(processes) {
    if (!CONFIG.AUTO_CLEANUP_ENABLED) {
      return { cleaned: 0, skipped: processes.length };
    }
    
    let cleaned = 0;
    
    for (const proc of processes) {
      if (proc.memoryMB > CONFIG.AUTO_CLEANUP_THRESHOLD) {
        try {
          console.log(`🧹 Auto-cleaning process ${proc.pid} (${proc.memoryMB}MB)`);
          execSync(`kill -TERM ${proc.pid}`, { encoding: 'utf8' });
          
          // Wait a bit and check if it's still running
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            execSync(`kill -0 ${proc.pid}`, { encoding: 'utf8' });
            // Still running, force kill
            execSync(`kill -KILL ${proc.pid}`, { encoding: 'utf8' });
          } catch (e) {
            // Process is already dead
          }
          
          cleaned++;
          console.log(`✅ Successfully terminated process ${proc.pid}`);
        } catch (error) {
          console.error(`❌ Failed to terminate process ${proc.pid}:`, error.message);
        }
      }
    }
    
    return { cleaned, skipped: processes.length - cleaned };
  }

  // Run memory check
  async runMemoryCheck() {
    console.log(`🔍 Running memory leak detection at ${new Date().toLocaleString()}`);
    
    // Get current memory usage
    const processes = this.getCurrentMemoryUsage();
    const totalMemoryMB = processes.reduce((sum, proc) => sum + proc.memoryMB, 0);
    
    // Add to history
    const dataPoint = {
      timestamp: Date.now(),
      totalMemoryMB,
      processCount: processes.length,
      processes: processes.map(p => ({
        pid: p.pid,
        command: p.command,
        memoryMB: p.memoryMB,
        cpu: p.cpu
      }))
    };
    
    this.memoryHistory.push(dataPoint);
    
    // Keep only recent history
    if (this.memoryHistory.length > CONFIG.HISTORY_SIZE) {
      this.memoryHistory = this.memoryHistory.slice(-CONFIG.HISTORY_SIZE);
    }
    
    // Analyze trends
    const analysis = this.analyzeGrowthTrends();
    
    console.log(`📊 Memory Usage: ${totalMemoryMB}MB across ${processes.length} processes`);
    console.log(`📈 Growth Rate: ${analysis.growthRate.toFixed(2)}MB/min`);
    console.log(`🚀 Acceleration: ${analysis.acceleration.toFixed(2)}x`);
    
    if (analysis.hasLeak) {
      console.log(`🚨 Memory leak detected!`);
      
      // Send alert
      await this.sendMemoryLeakAlert(analysis);
      
      // Auto-cleanup if enabled
      const problematicProcesses = processes.filter(p => p.memoryMB > CONFIG.AUTO_CLEANUP_THRESHOLD);
      if (problematicProcesses.length > 0) {
        const cleanupResult = await this.autoCleanup(problematicProcesses);
        console.log(`🧹 Cleanup result: ${cleanupResult.cleaned} terminated, ${cleanupResult.skipped} skipped`);
      }
    } else {
      console.log(`✅ No memory leaks detected`);
    }
    
    // Save data
    this.saveData();
    
    return analysis;
  }

  // Print current status
  printStatus() {
    console.log('\n' + '='.repeat(60));
    console.log('🔬 MEMORY LEAK DETECTOR STATUS');
    console.log('='.repeat(60));
    
    if (this.memoryHistory.length > 0) {
      const latest = this.memoryHistory[this.memoryHistory.length - 1];
      console.log(`📊 Current Memory Usage: ${latest.totalMemoryMB}MB`);
      console.log(`🔢 Active Processes: ${latest.processCount}`);
      console.log(`📈 Data Points: ${this.memoryHistory.length}`);
      
      if (this.memoryHistory.length >= 2) {
        const analysis = this.analyzeGrowthTrends();
        console.log(`📊 Growth Rate: ${analysis.growthRate.toFixed(2)}MB/min`);
        console.log(`🚀 Acceleration: ${analysis.acceleration.toFixed(2)}x`);
      }
    } else {
      console.log('📊 No data available yet');
    }
    
    console.log(`🚨 Alerts Sent: ${this.alertCount} (last: ${this.lastAlertTime ? new Date(this.lastAlertTime).toLocaleString() : 'Never'})`);
    console.log('='.repeat(60) + '\n');
  }

  // Start continuous monitoring
  async startMonitoring() {
    console.log('🚀 Starting memory leak monitoring...');
    console.log(`⏰ Check interval: ${CONFIG.GROWTH_CHECK_INTERVAL / 1000} seconds`);
    console.log(`📊 History size: ${CONFIG.HISTORY_SIZE} data points`);
    console.log(`🚨 Critical threshold: ${CONFIG.CRITICAL_MEMORY_THRESHOLD}MB`);
    console.log(`⚠️  Warning threshold: ${CONFIG.WARNING_MEMORY_THRESHOLD}MB`);
    
    // Run initial check
    await this.runMemoryCheck();
    
    // Set up interval
    setInterval(async () => {
      try {
        await this.runMemoryCheck();
      } catch (error) {
        console.error('❌ Error during memory check:', error.message);
      }
    }, CONFIG.GROWTH_CHECK_INTERVAL);
  }
}

// CLI interface
async function main() {
  const detector = new MemoryLeakDetector();
  const command = process.argv[2];
  
  switch (command) {
    case 'monitor':
      await detector.startMonitoring();
      break;
      
    case 'check':
      await detector.runMemoryCheck();
      break;
      
    case 'status':
      detector.printStatus();
      break;
      
    case 'test':
      console.log('🧪 Running test memory check...');
      const result = await detector.runMemoryCheck();
      console.log('\n📋 Test Results:');
      console.log(JSON.stringify(result, null, 2));
      break;
      
    default:
      console.log('Usage:');
      console.log('  node memory-leak-detector.js monitor  - Start continuous monitoring');
      console.log('  node memory-leak-detector.js check    - Run single check');
      console.log('  node memory-leak-detector.js status   - Show current status');
      console.log('  node memory-leak-detector.js test     - Run test check');
      process.exit(1);
  }
}

// Handle signals gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Memory leak detector shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Memory leak detector shutting down...');
  process.exit(0);
});

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Memory leak detector failed:', error);
    process.exit(1);
  });
}

export default MemoryLeakDetector;
