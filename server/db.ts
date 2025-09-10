import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@shared/schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create Neon database connection
const sql = neon(process.env.DATABASE_URL);

// Create Drizzle database instance with schema
export const db = drizzle(sql, { schema });

// Database health check
export async function checkDatabaseConnection(): Promise<boolean> {
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
  const isConnected = await checkDatabaseConnection();
  if (isConnected) {
    console.log('✅ Database connection established successfully');
  } else {
    console.error('❌ Failed to establish database connection');
    throw new Error('Database connection failed');
  }
}