import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@shared/schema';

// 🛡️ GRACEFUL DEGRADATION: Make DATABASE_URL optional
// If not set, system will work without database features (watchlist, portfolio, etc.)
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set - database features disabled (watchlist, portfolio, signals storage)');
  console.warn('   Set DATABASE_URL in .env to enable database features');
}

// Create Neon database connection only if URL is available
const sql = DATABASE_URL ? neon(DATABASE_URL) : null;

// Create Drizzle database instance with schema (null if no DATABASE_URL)
export const db = sql ? drizzle(sql, { schema }) : null;

// Database health check
export async function checkDatabaseConnection(): Promise<boolean> {
  if (!sql) {
    return false;
  }
  
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Initialize database connection
export async function initializeDatabase(): Promise<void> {
  if (!sql) {
    console.log('⚠️  Database initialization skipped (no DATABASE_URL)');
    return;
  }
  
  const isConnected = await checkDatabaseConnection();
  if (isConnected) {
    console.log('✅ Database connection established successfully');
  } else {
    console.error('❌ Failed to establish database connection');
    throw new Error('Database connection failed');
  }
}

// Helper to check if database is available
export function isDatabaseAvailable(): boolean {
  return db !== null;
}
