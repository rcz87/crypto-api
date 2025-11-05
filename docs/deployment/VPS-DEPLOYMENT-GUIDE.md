# 🚀 Crypto Trading Dashboard - VPS Hostinger Deployment Guide

## 📋 Overview
Deploy professional multi-coin crypto trading dashboard dengan Enhanced AI Signal Engine ke VPS Hostinger.

**Features:**
- ✅ Multi-coin support (SOL, BTC, ETH)
- ✅ Real-time WebSocket streaming
- ✅ Enhanced AI Signal Engine dengan 13 patterns
- ✅ TradingView widget integration
- ✅ Professional dashboard UI
- ✅ Production-ready dengan PM2

---

## 🛠️ VPS Requirements

### Minimum Specifications:
- **CPU**: 2 vCPU cores
- **RAM**: 4GB minimum (8GB recommended)
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04+ / CentOS 8+
- **Network**: Good bandwidth untuk real-time data

### Hostinger VPS Plans:
- **VPS 1**: 1 vCPU, 4GB RAM, 50GB SSD (✅ Minimum)
- **VPS 2**: 2 vCPU, 8GB RAM, 100GB SSD (⭐ Recommended)
- **VPS 3**: 4 vCPU, 16GB RAM, 200GB SSD (🚀 Optimal)

---

## 📦 Pre-deployment Setup

### 1. Prepare VPS Server
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git nginx postgresql postgresql-contrib

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Docker (optional)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

### 2. Setup Database
```bash
# Configure PostgreSQL
sudo -u postgres createuser --createdb --pwprompt crypto_user
sudo -u postgres createdb -O crypto_user crypto_trading_db

# Set database credentials (remember these!)
# Database: crypto_trading_db
# User: crypto_user  
# Password: [your-secure-password]
```

### 3. Setup Application Directory
```bash
# Create app directory
sudo mkdir -p /var/www/crypto-trading
sudo chown $USER:$USER /var/www/crypto-trading
cd /var/www/crypto-trading
```

---

## 🚀 Application Deployment

### Method 1: Direct Upload (Recommended)

#### Step 1: Create Production Build
```bash
# Di Replit, jalankan build
npm run build

# Download/copy files ke VPS:
# - dist/ folder (built server)
# - client/dist/ folder (built frontend)  
# - package.json
# - ecosystem.config.js
# - node_modules/ (atau install fresh)
```

#### Step 2: Upload ke VPS
```bash
# Via scp/sftp upload ke /var/www/crypto-trading:
scp -r dist/ root@your-vps-ip:/var/www/crypto-trading/
scp -r client/dist/ root@your-vps-ip:/var/www/crypto-trading/
scp package.json ecosystem.config.js root@your-vps-ip:/var/www/crypto-trading/
```

#### Step 3: Install Dependencies
```bash
cd /var/www/crypto-trading
npm install --only=production
```

### Method 2: Git Clone (Alternative)
```bash
# Clone repository
git clone [your-repo-url] /var/www/crypto-trading
cd /var/www/crypto-trading

# Install dependencies
npm install

# Build application
npm run build
```

---

## 🔧 Environment Configuration

### Create Production Environment File
```bash
# Create .env file
nano /var/www/crypto-trading/.env
```

**Environment Variables:**
```bash
# Application
NODE_ENV=production
PORT=5000

# Database
DATABASE_URL=postgresql://crypto_user:your-password@localhost:5432/crypto_trading_db
PGHOST=localhost
PGPORT=5432
PGDATABASE=crypto_trading_db
PGUSER=crypto_user
PGPASSWORD=your-secure-password

# API Configuration
API_BASE_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com

# Security
SESSION_SECRET=your-super-secure-random-string-here
CORS_ORIGIN=https://yourdomain.com

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Production Optimizations
ENABLE_COMPRESSION=true
ENABLE_HELMET=true
```

---

## 🔄 PM2 Process Management

### Start Application
```bash
cd /var/www/crypto-trading

# Start dengan PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs sol-trading-platform
```

### PM2 Commands
```bash
# Restart application
pm2 restart sol-trading-platform

# Stop application  
pm2 stop sol-trading-platform

# Monitor logs
pm2 logs sol-trading-platform --lines 50

# Monitor resources
pm2 monit
```

---

## 🌐 Nginx Configuration

### Create Nginx Config
```bash
sudo nano /etc/nginx/sites-available/crypto-trading
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL Configuration (akan disetup dengan certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Main application
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_buffering off;
    }
    
    # WebSocket endpoint
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Enable Nginx Config
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/crypto-trading /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

---

## 🔒 SSL Certificate Setup

### Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Get SSL Certificate
```bash
# Replace yourdomain.com dengan domain Anda
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Setup auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

## 📊 Monitoring & Maintenance

### System Monitoring
```bash
# Monitor application logs
pm2 logs sol-trading-platform

# Check system resources
htop
df -h
free -m

# Check nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Database Maintenance
```bash
# Backup database
pg_dump -U crypto_user crypto_trading_db > backup_$(date +%Y%m%d).sql

# Monitor database size
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('crypto_trading_db'));"
```

### Performance Optimization
```bash
# Enable swap (if needed)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Add to /etc/fstab for permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Check what's using port 5000
sudo netstat -tlnp | grep :5000
sudo kill -9 [PID]
```

#### 2. Database Connection Error
```bash
# Check PostgreSQL status
sudo systemctl status postgresql
sudo systemctl restart postgresql

# Test database connection
psql -U crypto_user -d crypto_trading_db -h localhost
```

#### 3. Nginx Configuration Error
```bash
# Test nginx config
sudo nginx -t

# Check nginx status
sudo systemctl status nginx
```

#### 4. SSL Certificate Issues
```bash
# Renew certificate
sudo certbot renew --dry-run
sudo certbot renew
```

---

## 📈 Post-Deployment Testing

### 1. Application Health Check
```bash
# Test main endpoints
curl https://yourdomain.com/health
curl https://yourdomain.com/api/sol/complete
curl https://yourdomain.com/api/metrics
```

### 2. WebSocket Testing
```javascript
// Browser console test
const ws = new WebSocket('wss://yourdomain.com/ws');
ws.onopen = () => console.log('WebSocket connected');
ws.onmessage = (event) => console.log('Data:', JSON.parse(event.data));
```

### 3. Performance Testing
```bash
# Load testing (optional)
npm install -g autocannon
autocannon -c 10 -d 30 https://yourdomain.com/api/sol/complete
```

---

## 🎯 Final Checklist

- [ ] ✅ VPS server setup complete
- [ ] ✅ Database configured
- [ ] ✅ Application deployed
- [ ] ✅ Environment variables set
- [ ] ✅ PM2 running application
- [ ] ✅ Nginx configured
- [ ] ✅ SSL certificate installed
- [ ] ✅ Domain pointing to VPS
- [ ] ✅ Health checks passing
- [ ] ✅ WebSocket working
- [ ] ✅ Multi-coin data flowing
- [ ] ✅ AI Signal Engine active

---

## 🌟 Success! 

Your **Professional Crypto Trading Dashboard** is now live at:
- **URL**: https://yourdomain.com
- **API**: https://yourdomain.com/api/sol/complete
- **WebSocket**: wss://yourdomain.com/ws
- **Health**: https://yourdomain.com/health

**Dashboard Features Active:**
- 🚀 Multi-coin support (SOL/BTC/ETH)
- 📊 Real-time WebSocket streaming
- 🧠 Enhanced AI Signal Engine
- 📈 TradingView widget integration
- ⚡ Professional UI/UX
- 🔒 Production security

---

## 📞 Support

Jika ada masalah deployment, check:
1. PM2 logs: `pm2 logs`
2. Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Application logs: Check `/var/www/crypto-trading/logs/`
4. Database connection: Test with `psql`

**Happy Trading!** 🎯💰