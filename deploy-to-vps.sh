#!/bin/bash

# 🚀 Crypto Trading Dashboard - VPS Deployment Script
# Automated deployment script untuk VPS Hostinger

set -e  # Exit on any error

echo "🚀 Starting Crypto Trading Dashboard deployment..."
echo "================================================="

# Configuration
APP_NAME="crypto-trading-dashboard"
APP_DIR="/var/www/crypto-trading"
DOMAIN="${1:-yourdomain.com}"
DB_NAME="crypto_trading_db"
DB_USER="crypto_user"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

print_status "Step 1: System update and dependencies..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git nginx postgresql postgresql-contrib htop ufw

print_status "Step 2: Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

print_status "Step 3: Installing PM2..."
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

print_status "Step 4: Setting up PostgreSQL..."
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    print_warning "Creating database and user..."
    echo "Please enter a secure password for database user '$DB_USER':"
    read -s DB_PASSWORD
    
    sudo -u postgres createuser --createdb --pwprompt $DB_USER
    sudo -u postgres createdb -O $DB_USER $DB_NAME
    
    print_status "Database '$DB_NAME' created successfully"
else
    print_status "Database '$DB_NAME' already exists"
fi

print_status "Step 5: Creating application directory..."
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

print_status "Step 6: Setting up firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable

print_status "Step 7: Creating environment file template..."
cat > $APP_DIR/.env.template << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=5000

# Database Configuration
DATABASE_URL=postgresql://$DB_USER:YOUR_DB_PASSWORD@localhost:5432/$DB_NAME
PGHOST=localhost
PGPORT=5432
PGDATABASE=$DB_NAME
PGUSER=$DB_USER
PGPASSWORD=YOUR_DB_PASSWORD

# Application Configuration
API_BASE_URL=https://$DOMAIN
ALLOWED_ORIGINS=https://$DOMAIN

# Security
SESSION_SECRET=GENERATE_RANDOM_SECRET_HERE
CORS_ORIGIN=https://$DOMAIN

# Performance
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
ENABLE_COMPRESSION=true
ENABLE_HELMET=true
EOF

print_status "Step 8: Creating Nginx configuration..."
sudo tee /etc/nginx/sites-available/$APP_NAME > /dev/null << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;
    
    # SSL will be configured by certbot
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_buffering off;
    }
    
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable Nginx site
sudo ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

print_status "Step 9: Installing Certbot for SSL..."
if ! command -v certbot &> /dev/null; then
    sudo apt install -y certbot python3-certbot-nginx
fi

print_status "Step 10: Setting up SSL certificate..."
print_warning "Please ensure your domain '$DOMAIN' is pointing to this server's IP"
read -p "Press Enter when ready to configure SSL..."

sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN

# Setup auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

print_status "Step 11: Creating deployment directories..."
mkdir -p $APP_DIR/logs
mkdir -p $APP_DIR/backups

print_status "Step 12: Creating backup script..."
cat > $APP_DIR/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/www/crypto-trading/backups"
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump -U crypto_user crypto_trading_db > $BACKUP_DIR/db_backup_$DATE.sql
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete
echo "Database backup completed: db_backup_$DATE.sql"
EOF

chmod +x $APP_DIR/backup.sh

print_status "Step 13: Setting up log rotation..."
sudo tee /etc/logrotate.d/$APP_NAME > /dev/null << EOF
$APP_DIR/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    notifempty
    create 0644 $USER $USER
    postrotate
        pm2 reload $APP_NAME
    endscript
}
EOF

print_status "Deployment preparation completed! 🎉"
echo "================================================="
echo ""
echo "📋 Next Steps:"
echo "1. Upload your application files to: $APP_DIR"
echo "2. Edit environment file: $APP_DIR/.env (use .env.template as guide)"
echo "3. Install dependencies: cd $APP_DIR && npm install"
echo "4. Start application: pm2 start ecosystem.config.js --env production"
echo ""
echo "🔧 Useful Commands:"
echo "- Check app status: pm2 status"
echo "- View logs: pm2 logs"
echo "- Test SSL: curl -I https://$DOMAIN"
echo "- Backup database: $APP_DIR/backup.sh"
echo ""
echo "🌐 Your application will be available at: https://$DOMAIN"
echo ""
print_status "VPS is now ready for deployment!"