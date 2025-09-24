/**
 * Event Logging System - Main Orchestrator
 * 
 * Initializes the event logging system and provides coordination between components.
 * Handles:
 * - Database migration
 * - Scheduler setup
 * - Health monitoring
 * - System status reporting
 */

import { migrate, testDatabaseConnection, getDatabaseStats } from './eventIngestor.js';
import { scheduleWeeklyScorecard, generateWeeklyScorecard, getScorecardStatus } from './weeklyScorecard.js';
import { sendTestMessage, isTelegramConfigured, getTelegramStatus, sendSystemAlert } from './telegram.js';
import { EventEmitter } from './eventEmitter.js';

export interface ObservabilitySystemStatus {
  initialized: boolean;
  feature_enabled: boolean;
  database: {
    connected: boolean;
    migrated: boolean;
    stats?: {
      total_signals: number;
      triggered_signals: number;
      closed_signals: number;
      invalidated_signals: number;
      current_week_signals: number;
    };
  };
  telegram: {
    configured: boolean;
    botToken: boolean;
    chatId: boolean;
  };
  scheduler: {
    running: boolean;
    next_run?: string;
    timezone: string;
  };
  environment: {
    timezone?: string;
    feature_logging?: string;
    database_url: boolean;
  };
}

class ObservabilitySystem {
  private initialized = false;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private migrationCompleted = false;

  /**
   * Initialize the observability system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('⚠️ Observability system already initialized');
      return;
    }

    console.log('🚀 Initializing Event Logging System...');

    try {
      // Check if feature is enabled
      if (process.env.FEATURE_EVENT_LOGGING !== 'true') {
        console.log('ℹ️ Event logging disabled (FEATURE_EVENT_LOGGING != true)');
        this.initialized = true;
        return;
      }

      // Test database connection
      console.log('🔍 Testing database connection...');
      const dbConnected = await testDatabaseConnection();
      if (!dbConnected) {
        throw new Error('Database connection failed');
      }
      console.log('✅ Database connection OK');

      // Run migration
      console.log('🔄 Running database migration...');
      await migrate();
      this.migrationCompleted = true;
      console.log('✅ Database migration completed');

      // Test Telegram configuration
      console.log('📱 Checking Telegram configuration...');
      const telegramConfigured = isTelegramConfigured();
      if (telegramConfigured) {
        console.log('✅ Telegram configuration OK');
        
        // Send initialization notification
        await sendSystemAlert(
          'Event Logging System Initialized',
          'Event Logging System has been successfully initialized and is ready to track signal lifecycle events.',
          'info'
        );
      } else {
        console.warn('⚠️ Telegram not configured - reports will be logged only');
      }

      // Start scheduler
      console.log('📅 Starting weekly scorecard scheduler...');
      this.startScheduler();

      this.initialized = true;
      console.log('✅ Event Logging System initialization completed');

    } catch (error) {
      console.error('❌ Event Logging System initialization failed:', error);
      
      // Try to send error alert if Telegram is configured
      try {
        await sendSystemAlert(
          'Event Logging System Initialization Failed',
          `Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'critical'
        );
      } catch (telegramError) {
        console.error('Failed to send initialization error alert:', telegramError);
      }
      
      throw error;
    }
  }

  /**
   * Start the weekly scorecard scheduler
   */
  private startScheduler(): void {
    if (this.schedulerInterval) {
      console.warn('⚠️ Scheduler already running');
      return;
    }

    this.schedulerInterval = scheduleWeeklyScorecard((result) => {
      console.log('📊 Weekly scorecard generated:', {
        week_start: result.week_start,
        monotonic_ok: result.monotonic_ok,
        total_signals: result.total_signals,
      });
    });

    console.log('✅ Weekly scorecard scheduler started');
  }

  /**
   * Stop the scheduler
   */
  stopScheduler(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log('🛑 Weekly scorecard scheduler stopped');
    }
  }

  /**
   * Manual scorecard generation
   */
  async generateManualScorecard(): Promise<any> {
    console.log('🔧 Generating manual weekly scorecard...');
    
    if (!this.initialized) {
      throw new Error('Observability system not initialized');
    }

    return await generateWeeklyScorecard();
  }

  /**
   * Run health check
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const eventEmitterHealth = await EventEmitter.healthCheck();
      const dbConnected = await testDatabaseConnection();
      const telegramStatus = getTelegramStatus();
      const schedulerStatus = getScorecardStatus();

      const isHealthy = eventEmitterHealth.enabled && 
                       eventEmitterHealth.database && 
                       dbConnected && 
                       this.migrationCompleted;

      const isDegraded = (!telegramStatus.configured) || (!this.schedulerInterval);

      return {
        status: isHealthy ? (isDegraded ? 'degraded' : 'healthy') : 'unhealthy',
        details: {
          event_emitter: eventEmitterHealth,
          database_connected: dbConnected,
          migration_completed: this.migrationCompleted,
          telegram: telegramStatus,
          scheduler: {
            running: !!this.schedulerInterval,
            ...schedulerStatus,
          },
        },
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Get comprehensive system status
   */
  async getStatus(): Promise<ObservabilitySystemStatus> {
    try {
      const dbStats = await getDatabaseStats();
      const telegramStatus = getTelegramStatus();
      const schedulerStatus = getScorecardStatus();
      const dbConnected = await testDatabaseConnection();

      return {
        initialized: this.initialized,
        feature_enabled: process.env.FEATURE_EVENT_LOGGING === 'true',
        database: {
          connected: dbConnected,
          migrated: this.migrationCompleted,
          stats: dbStats,
        },
        telegram: telegramStatus,
        scheduler: {
          running: !!this.schedulerInterval,
          next_run: schedulerStatus.next_run,
          timezone: schedulerStatus.timezone,
        },
        environment: {
          timezone: process.env.TZ,
          feature_logging: process.env.FEATURE_EVENT_LOGGING,
          database_url: !!process.env.DATABASE_URL,
        },
      };

    } catch (error) {
      console.error('Failed to get observability status:', error);
      
      return {
        initialized: this.initialized,
        feature_enabled: process.env.FEATURE_EVENT_LOGGING === 'true',
        database: {
          connected: false,
          migrated: this.migrationCompleted,
        },
        telegram: getTelegramStatus(),
        scheduler: {
          running: !!this.schedulerInterval,
          timezone: 'Asia/Jakarta',
        },
        environment: {
          timezone: process.env.TZ,
          feature_logging: process.env.FEATURE_EVENT_LOGGING,
          database_url: !!process.env.DATABASE_URL,
        },
      };
    }
  }

  /**
   * Test all components
   */
  async testSystem(): Promise<{
    eventEmitter: boolean;
    database: boolean;
    telegram: boolean;
    scorecard: boolean;
  }> {
    const results = {
      eventEmitter: false,
      database: false,
      telegram: false,
      scorecard: false,
    };

    try {
      // Test EventEmitter
      const emitterHealth = await EventEmitter.healthCheck();
      results.eventEmitter = emitterHealth.enabled && emitterHealth.database;

      // Test database
      results.database = await testDatabaseConnection();

      // Test Telegram
      if (isTelegramConfigured()) {
        results.telegram = await sendTestMessage();
      }

      // Test scorecard generation (dry run)
      try {
        await this.generateManualScorecard();
        results.scorecard = true;
      } catch (error) {
        console.error('Scorecard test failed:', error);
        results.scorecard = false;
      }

    } catch (error) {
      console.error('System test failed:', error);
    }

    return results;
  }

  /**
   * Shutdown gracefully
   */
  shutdown(): void {
    console.log('🔄 Shutting down Event Logging System...');
    
    this.stopScheduler();
    this.initialized = false;
    
    console.log('✅ Event Logging System shutdown completed');
  }
}

// Create singleton instance
export const observabilitySystem = new ObservabilitySystem();

// Export all components for direct access
export { EventEmitter } from './eventEmitter.js';
export { sendTelegram, sendWeeklyScorecardReport, sendSystemAlert } from './telegram.js';
export { generateWeeklyScorecard, scheduleWeeklyScorecard } from './weeklyScorecard.js';
export * from './eventIngestor.js';

// Auto-initialize if feature is enabled
if (process.env.FEATURE_EVENT_LOGGING === 'true') {
  observabilitySystem.initialize().catch(error => {
    console.error('Failed to auto-initialize observability system:', error);
  });
}

// Graceful shutdown handler
process.on('SIGTERM', () => {
  observabilitySystem.shutdown();
});

process.on('SIGINT', () => {
  observabilitySystem.shutdown();
});

export default observabilitySystem;