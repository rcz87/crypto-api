#!/usr/bin/env node

/**
 * Test Backup Configuration
 *
 * Validates backup setup without creating actual backup
 *
 * Usage:
 *   npm run backup:test
 *   node scripts/test-backup.js
 */

import { existsSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const CONFIG = {
  DATABASE_URL: process.env.DATABASE_URL,
  BACKUP_DIR: process.env.BACKUP_DIR || '/root/crypto-api-backups',
  S3_BUCKET: process.env.BACKUP_S3_BUCKET,
  ENABLE_S3: process.env.BACKUP_ENABLE_S3 === 'true',
  TELEGRAM_ENABLED: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
};

console.log('🧪 Testing Backup Configuration\n');
console.log('='.repeat(50));

let hasErrors = false;

// Test 1: DATABASE_URL
console.log('\n📋 Test 1: Database Connection');
if (!CONFIG.DATABASE_URL) {
  console.error('❌ DATABASE_URL not set in environment');
  hasErrors = true;
} else {
  try {
    const dbUrl = new URL(CONFIG.DATABASE_URL);
    console.log('✅ DATABASE_URL configured');
    console.log(`   Host: ${dbUrl.hostname}`);
    console.log(`   Port: ${dbUrl.port || '5432'}`);
    console.log(`   Database: ${dbUrl.pathname.slice(1).split('?')[0]}`);
    console.log(`   User: ${dbUrl.username}`);
  } catch (error) {
    console.error('❌ Invalid DATABASE_URL format');
    hasErrors = true;
  }
}

// Test 2: pg_dump availability
console.log('\n📋 Test 2: PostgreSQL Tools');
try {
  const { stdout } = await execAsync('which pg_dump');
  console.log('✅ pg_dump found:', stdout.trim());

  const { stdout: version } = await execAsync('pg_dump --version');
  console.log('   Version:', version.trim());
} catch (error) {
  console.error('❌ pg_dump not found! Install with: apt-get install postgresql-client');
  hasErrors = true;
}

// Test 3: Backup directory
console.log('\n📋 Test 3: Backup Directory');
if (existsSync(CONFIG.BACKUP_DIR)) {
  console.log('✅ Backup directory exists:', CONFIG.BACKUP_DIR);

  // Check write permissions
  try {
    const { stdout } = await execAsync(`test -w ${CONFIG.BACKUP_DIR} && echo "writable"`);
    if (stdout.trim() === 'writable') {
      console.log('✅ Directory is writable');
    }
  } catch (error) {
    console.error('❌ Directory is not writable');
    hasErrors = true;
  }
} else {
  console.log('⚠️  Backup directory does not exist (will be created)');
  console.log('   Path:', CONFIG.BACKUP_DIR);
}

// Test 4: S3 Configuration
console.log('\n📋 Test 4: S3 Backup (Optional)');
if (CONFIG.ENABLE_S3) {
  if (!CONFIG.S3_BUCKET) {
    console.error('❌ S3 enabled but BACKUP_S3_BUCKET not set');
    hasErrors = true;
  } else {
    console.log('✅ S3 backup enabled');
    console.log(`   Bucket: ${CONFIG.S3_BUCKET}`);

    // Check AWS CLI
    try {
      const { stdout } = await execAsync('which aws');
      console.log('✅ AWS CLI found:', stdout.trim());

      const { stdout: version } = await execAsync('aws --version');
      console.log('   Version:', version.trim());

      // Test AWS credentials
      try {
        await execAsync('aws sts get-caller-identity', { timeout: 5000 });
        console.log('✅ AWS credentials configured');
      } catch (error) {
        console.error('❌ AWS credentials not configured or invalid');
        hasErrors = true;
      }
    } catch (error) {
      console.error('❌ AWS CLI not found! Install with: apt-get install awscli');
      hasErrors = true;
    }
  }
} else {
  console.log('ℹ️  S3 backup disabled');
  console.log('   To enable: Set BACKUP_ENABLE_S3=true in .env');
}

// Test 5: Telegram Alerts
console.log('\n📋 Test 5: Telegram Alerts (Optional)');
if (CONFIG.TELEGRAM_ENABLED) {
  console.log('✅ Telegram configured');
  console.log(`   Bot Token: ${process.env.TELEGRAM_BOT_TOKEN.slice(0, 10)}...`);
  console.log(`   Chat ID: ${process.env.TELEGRAM_CHAT_ID}`);
} else {
  console.log('ℹ️  Telegram alerts disabled');
  console.log('   To enable: Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env');
}

// Test 6: Disk space
console.log('\n📋 Test 6: Disk Space');
try {
  const { stdout } = await execAsync('df -h /');
  const lines = stdout.split('\n');
  console.log('✅ Disk space check:');
  console.log('   ' + lines[0]);
  console.log('   ' + lines[1]);

  // Parse available space
  const parts = lines[1].split(/\s+/);
  const availableGB = parseFloat(parts[3]);
  if (availableGB < 5) {
    console.warn('⚠️  Low disk space! Less than 5GB available');
  }
} catch (error) {
  console.error('⚠️  Could not check disk space');
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.error('\n❌ Backup configuration has errors!');
  console.error('   Fix the issues above before running backups.\n');
  process.exit(1);
} else {
  console.log('\n✅ Backup configuration is valid!');
  console.log('   You can now run: npm run backup:db\n');

  console.log('📝 Recommended cron schedule (daily at 2 AM):');
  console.log('   0 2 * * * cd /root/crypto-api && npm run backup:db >> /var/log/crypto-backup.log 2>&1\n');

  process.exit(0);
}
