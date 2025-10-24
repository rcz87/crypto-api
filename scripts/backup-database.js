#!/usr/bin/env node

/**
 * Database Backup Script
 *
 * Features:
 * - Creates PostgreSQL dump
 * - Compresses with gzip
 * - Uploads to S3 (optional)
 * - Sends Telegram notification
 * - Automatic cleanup of old backups
 *
 * Usage:
 *   npm run backup:db
 *   node scripts/backup-database.js
 *
 * Cron example (daily at 2 AM):
 *   0 2 * * * cd /root/crypto-api && npm run backup:db >> /var/log/crypto-backup.log 2>&1
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import { sendTelegramAlert } from './telegram-alerter.js';

const execAsync = promisify(exec);

// Configuration
const CONFIG = {
  DATABASE_URL: process.env.DATABASE_URL,
  BACKUP_DIR: process.env.BACKUP_DIR || '/root/crypto-api-backups',
  RETENTION_DAYS: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
  S3_BUCKET: process.env.BACKUP_S3_BUCKET,
  AWS_REGION: process.env.AWS_REGION || 'us-east-1',
  ENABLE_S3: process.env.BACKUP_ENABLE_S3 === 'true',
  ENABLE_TELEGRAM: process.env.TELEGRAM_BOT_TOKEN ? true : false,
};

// Parse DATABASE_URL
function parseDatabaseUrl(url) {
  try {
    const dbUrl = new URL(url);
    return {
      host: dbUrl.hostname,
      port: dbUrl.port || '5432',
      database: dbUrl.pathname.slice(1).split('?')[0],
      user: dbUrl.username,
      password: dbUrl.password,
    };
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL: ${error.message}`);
  }
}

// Create backup directory if not exists
function ensureBackupDir() {
  if (!existsSync(CONFIG.BACKUP_DIR)) {
    mkdirSync(CONFIG.BACKUP_DIR, { recursive: true });
    console.log(`✅ Created backup directory: ${CONFIG.BACKUP_DIR}`);
  }
}

// Generate backup filename with timestamp
function generateBackupFilename() {
  const timestamp = new Date().toISOString()
    .replace(/:/g, '-')
    .replace(/\..+/, '');
  return `crypto-api-backup-${timestamp}.sql.gz`;
}

// Create PostgreSQL backup
async function createBackup() {
  const startTime = Date.now();

  try {
    console.log('🔄 Starting database backup...');

    // Validate DATABASE_URL
    if (!CONFIG.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable not set');
    }

    const dbConfig = parseDatabaseUrl(CONFIG.DATABASE_URL);
    ensureBackupDir();

    const backupFilename = generateBackupFilename();
    const backupPath = join(CONFIG.BACKUP_DIR, backupFilename);

    // Create pg_dump command
    const pgDumpCmd = `PGPASSWORD="${dbConfig.password}" pg_dump \\
      -h ${dbConfig.host} \\
      -p ${dbConfig.port} \\
      -U ${dbConfig.user} \\
      -d ${dbConfig.database} \\
      --no-password \\
      --verbose \\
      --format=plain \\
      | gzip > ${backupPath}`;

    console.log(`📦 Creating backup: ${backupFilename}`);
    console.log(`🎯 Target: ${backupPath}`);

    // Execute backup
    await execAsync(pgDumpCmd, {
      maxBuffer: 100 * 1024 * 1024, // 100MB buffer
      timeout: 600000 // 10 minutes timeout
    });

    // Get file size
    const stats = statSync(backupPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`✅ Backup created successfully!`);
    console.log(`   File: ${backupFilename}`);
    console.log(`   Size: ${sizeInMB} MB`);
    console.log(`   Duration: ${duration}s`);

    // Upload to S3 if enabled
    let s3Url = null;
    if (CONFIG.ENABLE_S3 && CONFIG.S3_BUCKET) {
      s3Url = await uploadToS3(backupPath, backupFilename);
    }

    // Send Telegram notification
    if (CONFIG.ENABLE_TELEGRAM) {
      await sendTelegramAlert(
        `✅ Database Backup Success\n\n` +
        `📦 File: ${backupFilename}\n` +
        `💾 Size: ${sizeInMB} MB\n` +
        `⏱️ Duration: ${duration}s\n` +
        `📍 Location: ${CONFIG.BACKUP_DIR}\n` +
        (s3Url ? `☁️ S3: ${s3Url}\n` : '') +
        `🕐 Time: ${new Date().toISOString()}`
      );
    }

    // Cleanup old backups
    await cleanupOldBackups();

    return {
      success: true,
      filename: backupFilename,
      path: backupPath,
      size: sizeInMB,
      duration,
      s3Url,
    };

  } catch (error) {
    console.error('❌ Backup failed:', error.message);

    if (CONFIG.ENABLE_TELEGRAM) {
      await sendTelegramAlert(
        `❌ Database Backup Failed\n\n` +
        `Error: ${error.message}\n` +
        `Time: ${new Date().toISOString()}`
      );
    }

    throw error;
  }
}

// Upload backup to S3
async function uploadToS3(filePath, filename) {
  try {
    console.log('☁️  Uploading to S3...');

    const s3Key = `database-backups/${filename}`;
    const s3Cmd = `aws s3 cp ${filePath} s3://${CONFIG.S3_BUCKET}/${s3Key} \\
      --region ${CONFIG.AWS_REGION} \\
      --storage-class STANDARD_IA \\
      --metadata "backup-date=$(date -u +%Y-%m-%d),backup-type=database"`;

    await execAsync(s3Cmd);

    const s3Url = `s3://${CONFIG.S3_BUCKET}/${s3Key}`;
    console.log(`✅ Uploaded to S3: ${s3Url}`);

    return s3Url;
  } catch (error) {
    console.error('⚠️  S3 upload failed:', error.message);
    return null;
  }
}

// Cleanup old backups
async function cleanupOldBackups() {
  try {
    console.log(`🧹 Cleaning up backups older than ${CONFIG.RETENTION_DAYS} days...`);

    const now = Date.now();
    const cutoffTime = now - (CONFIG.RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const files = readdirSync(CONFIG.BACKUP_DIR);
    let deletedCount = 0;
    let freedSpace = 0;

    for (const file of files) {
      if (!file.startsWith('crypto-api-backup-')) continue;

      const filePath = join(CONFIG.BACKUP_DIR, file);
      const stats = statSync(filePath);

      if (stats.mtimeMs < cutoffTime) {
        const sizeInMB = stats.size / (1024 * 1024);
        unlinkSync(filePath);
        deletedCount++;
        freedSpace += sizeInMB;
        console.log(`   🗑️  Deleted: ${file} (${sizeInMB.toFixed(2)} MB)`);
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ Cleaned up ${deletedCount} old backup(s), freed ${freedSpace.toFixed(2)} MB`);
    } else {
      console.log(`✅ No old backups to clean up`);
    }

    // Cleanup S3 if enabled
    if (CONFIG.ENABLE_S3 && CONFIG.S3_BUCKET) {
      await cleanupS3Backups();
    }

  } catch (error) {
    console.error('⚠️  Cleanup failed:', error.message);
  }
}

// Cleanup old S3 backups
async function cleanupS3Backups() {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CONFIG.RETENTION_DAYS);
    const isoDate = cutoffDate.toISOString().split('T')[0];

    const listCmd = `aws s3api list-objects-v2 \\
      --bucket ${CONFIG.S3_BUCKET} \\
      --prefix database-backups/ \\
      --query "Contents[?LastModified<'${isoDate}'].Key" \\
      --output text`;

    const { stdout } = await execAsync(listCmd);
    const oldFiles = stdout.trim().split('\n').filter(Boolean);

    if (oldFiles.length > 0) {
      for (const key of oldFiles) {
        await execAsync(`aws s3 rm s3://${CONFIG.S3_BUCKET}/${key}`);
        console.log(`   🗑️  S3 deleted: ${key}`);
      }
      console.log(`✅ Cleaned up ${oldFiles.length} old S3 backup(s)`);
    }
  } catch (error) {
    console.error('⚠️  S3 cleanup failed:', error.message);
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  createBackup()
    .then(result => {
      console.log('\n✅ Backup completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Backup failed!');
      console.error(error);
      process.exit(1);
    });
}

export { createBackup };
