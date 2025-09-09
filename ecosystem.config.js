module.exports = {
  apps: [{
    name: 'sol-trading-platform',
    script: 'dist/index.js',
    cwd: '/var/www/sol-trading',
    env: {
      NODE_ENV: 'production',
      PORT: 8080
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    log_file: '/var/log/pm2/sol-trading.log',
    error_file: '/var/log/pm2/sol-trading-error.log',
    out_file: '/var/log/pm2/sol-trading-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};