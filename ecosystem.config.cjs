// PM2 Ecosystem Configuration for crypto-api (CommonJS)
// This ensures PM2 properly loads .env file and manages the process
// 🔧 OPTIMIZED: Enhanced graceful shutdown to prevent EADDRINUSE crashes

require('dotenv').config(); // Load .env file BEFORE exporting config

module.exports = {
  apps: [
    {
      name: 'crypto-api',
      script: 'node_modules/.bin/tsx',
      args: 'server/index.ts',
      instances: 1,
      exec_mode: 'fork',
      
      // Environment variables from .env
      env: {
        NODE_ENV: process.env.NODE_ENV || 'production',
        PORT: process.env.PORT || '5000',
        DATABASE_URL: process.env.DATABASE_URL,
        COINAPI_KEY: process.env.COINAPI_KEY,
        OKX_API_KEY: process.env.OKX_API_KEY,
        OKX_SECRET_KEY: process.env.OKX_SECRET_KEY,
        OKX_PASSPHRASE: process.env.OKX_PASSPHRASE,
        BYBIT_API_KEY: process.env.BYBIT_API_KEY,
        BYBIT_SECRET_KEY: process.env.BYBIT_SECRET_KEY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        COINGLASS_API_KEY: process.env.COINGLASS_API_KEY,
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
        SESSION_SECRET: process.env.SESSION_SECRET,
        JWT_SECRET: process.env.JWT_SECRET,
        PY_BASE: process.env.PY_BASE || 'http://127.0.0.1:8000',
        ENABLE_TELEMETRY: process.env.ENABLE_TELEMETRY || 'false',
        
        // Node.js optimization flags
        NODE_OPTIONS: '--expose-gc --max-old-space-size=512',
      },
      
      // 🔧 FIX: Enhanced restart configuration to prevent cascading crashes
      watch: false,
      max_memory_restart: '600M', // Restart if memory exceeds 600MB
      min_uptime: '10s', // Minimum uptime before considering process stable
      max_restarts: 5, // Reduced from 10 to prevent crash storms
      restart_delay: 8000, // Increased from 4s to 8s - allow port release
      exp_backoff_restart_delay: 100, // Exponential backoff starting at 100ms
      
      // Logging
      error_file: '/var/log/pm2/crypto-api-error-0.log',
      out_file: '/var/log/pm2/crypto-api-out-0.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // 🔧 FIX: Enhanced graceful shutdown to prevent EADDRINUSE
      kill_timeout: 10000, // Increased from 5s to 10s - ensure complete cleanup
      shutdown_with_message: true, // Send shutdown message to process
      wait_ready: true, // Wait for process to emit 'ready' signal
      listen_timeout: 15000, // Increased from 10s to 15s
      
      // Auto-restart on crashes
      autorestart: true,
      
      // 🔧 NEW: Stop app after max_restarts reached (prevent endless crash loops)
      stop_exit_codes: [1], // Don't restart on exit code 1 (EADDRINUSE)
      
      // Cron restart (optional - restart every night at 3 AM)
      // cron_restart: '0 3 * * *',
    }
  ]
};
