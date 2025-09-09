module.exports = {
  apps: [{
    name: 'sol-trading-simple',
    script: 'simple-server.js',
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
    log_file: '/var/log/pm2/sol-trading-simple.log',
    error_file: '/var/log/pm2/sol-trading-simple-error.log',
    out_file: '/var/log/pm2/sol-trading-simple-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};