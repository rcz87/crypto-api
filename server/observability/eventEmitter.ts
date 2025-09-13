/**
 * Event Logging System - Event Emitter
 * 
 * Provides 4 lifecycle methods for signal tracking:
 * - published: Signal creation/publishing
 * - triggered: Entry fill/trigger
 * - invalidated: Signal invalidation (SL/expiry/hard invalidation)
 * - closed: Position closure (TP/manual/other)
 * 
 * Safety: All methods are safe when FEATURE_EVENT_LOGGING=false
 */

import { insertPublished, insertTriggered, insertInvalidated, insertClosed } from './eventIngestor.js';
import { eventPublishedSchema, eventTriggeredSchema, eventInvalidatedSchema, eventClosedSchema } from '@shared/schema.js';
import type { EventPublished, EventTriggered, EventInvalidated, EventClosed } from '@shared/schema.js';

export class EventEmitter {
  private static isEnabled(): boolean {
    return process.env.FEATURE_EVENT_LOGGING === 'true';
  }

  private static validateRequired(obj: Record<string, any>, required: string[], eventType: string): void {
    for (const field of required) {
      if (obj[field] === undefined || obj[field] === null) {
        throw new Error(`EventEmitter.${eventType}: missing required field '${field}'`);
      }
    }
  }

  /**
   * Signal Published Event - When a new signal is generated and published
   */
  static async published(evt: EventPublished): Promise<void> {
    if (!this.isEnabled()) return;
    
    try {
      // Validate schema
      const validated = eventPublishedSchema.parse(evt);
      
      // Required fields validation
      const required = ['signal_id', 'symbol', 'confluence_score', 'rr', 'scenarios', 'expiry_minutes', 'rules_version'];
      this.validateRequired(validated, required, 'published');
      
      await insertPublished(validated);
    } catch (error) {
      console.error('EventEmitter.published failed:', error);
      // Don't throw - logging failures should not break signal generation
    }
  }

  /**
   * Signal Triggered Event - When entry gets filled
   */
  static async triggered(evt: EventTriggered): Promise<void> {
    if (!this.isEnabled()) return;
    
    try {
      // Validate schema
      const validated = eventTriggeredSchema.parse(evt);
      
      // Required fields validation
      const required = ['signal_id', 'symbol', 'entry_fill', 'time_to_trigger_ms'];
      this.validateRequired(validated, required, 'triggered');
      
      await insertTriggered(validated);
    } catch (error) {
      console.error('EventEmitter.triggered failed:', error);
      // Don't throw - logging failures should not break signal processing
    }
  }

  /**
   * Signal Invalidated Event - When signal becomes invalid (SL/expiry/invalidation)
   */
  static async invalidated(evt: EventInvalidated): Promise<void> {
    if (!this.isEnabled()) return;
    
    try {
      // Validate schema
      const validated = eventInvalidatedSchema.parse(evt);
      
      // Required fields validation
      const required = ['signal_id', 'symbol', 'reason'];
      this.validateRequired(validated, required, 'invalidated');
      
      await insertInvalidated(validated);
    } catch (error) {
      console.error('EventEmitter.invalidated failed:', error);
      // Don't throw - logging failures should not break signal processing
    }
  }

  /**
   * Signal Closed Event - When position is closed (TP/manual/other)
   */
  static async closed(evt: EventClosed): Promise<void> {
    if (!this.isEnabled()) return;
    
    try {
      // Validate schema
      const validated = eventClosedSchema.parse(evt);
      
      // Required fields validation
      const required = ['signal_id', 'symbol', 'rr_realized', 'time_in_trade_ms', 'exit_reason'];
      this.validateRequired(validated, required, 'closed');
      
      await insertClosed(validated);
    } catch (error) {
      console.error('EventEmitter.closed failed:', error);
      // Don't throw - logging failures should not break signal processing
    }
  }

  /**
   * Health check - verify event logging is working
   */
  static async healthCheck(): Promise<{ enabled: boolean; database: boolean }> {
    const enabled = this.isEnabled();
    let database = false;
    
    if (enabled) {
      try {
        // Try a simple database operation to verify connectivity
        const { testDatabaseConnection } = await import('./eventIngestor.js');
        database = await testDatabaseConnection();
      } catch (error) {
        console.error('EventEmitter healthCheck database test failed:', error);
        database = false;
      }
    }
    
    return { enabled, database };
  }

  /**
   * Get status for monitoring
   */
  static getStatus(): { 
    feature_enabled: boolean; 
    environment_variable: string | undefined;
    timezone: string | undefined;
  } {
    return {
      feature_enabled: this.isEnabled(),
      environment_variable: process.env.FEATURE_EVENT_LOGGING,
      timezone: process.env.TZ,
    };
  }
}

// Export both class and individual methods for flexibility
export const eventEmitter = EventEmitter;

// Named exports for direct usage
export const publishedEvent = EventEmitter.published.bind(EventEmitter);
export const triggeredEvent = EventEmitter.triggered.bind(EventEmitter);
export const invalidatedEvent = EventEmitter.invalidated.bind(EventEmitter);
export const closedEvent = EventEmitter.closed.bind(EventEmitter);