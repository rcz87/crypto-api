#!/usr/bin/env node

/**
 * Event Logging System - Database Migration Script
 * 
 * This script runs the PostgreSQL migration for the event logging system.
 * Usage: node server/observability/migrate.js
 */

import { migrate } from './eventIngestor.js';

async function runMigration() {
  try {
    console.log('🚀 Starting Event Logging System database migration...');
    console.log('📍 Timezone:', process.env.TZ || 'system default');
    console.log('🔧 Feature enabled:', process.env.FEATURE_EVENT_LOGGING);
    
    await migrate();
    
    console.log('✅ Database migration completed successfully!');
    console.log('🎯 Event Logging System is ready to track signal lifecycles');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('💡 Please check your DATABASE_URL and database connectivity');
    
    process.exit(1);
  }
}

runMigration();