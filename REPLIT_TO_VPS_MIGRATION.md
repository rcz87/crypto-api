# 🔄 Panduan Migrasi dari Replit ke VPS

## 📋 Ringkasan Perbedaan

Repository ini **dibuat di Replit** dan **dimigrasikan ke VPS pribadi**. Dokumen ini menjelaskan perbedaan utama dan penyesuaian yang diperlukan.

---

## 🔍 Perbedaan Utama Replit vs VPS

### 1. **Environment Management**

#### Replit:
- Environment variables via Secrets UI
- Auto-reload on changes
- Managed runtime environment

#### VPS:
- Environment variables via `.env` file
- Manual service restart
- Manual runtime configuration

**✅ Status:** Sudah dikonfigurasi dengan systemd `env-watcher.service`

---

### 2. **Process Management**

#### Replit:
- Automatic process restart
- Built-in monitoring
- Auto-sleep on inactivity (free tier)

#### VPS:
- Systemd services untuk auto-restart
- Manual monitoring setup
- Always-on (no auto-sleep)

**✅ Status:** Sudah ada `node_service.service` dan `python_service.service`

**Services:**
```bash
sudo systemctl status node_service
sudo systemctl status python_service
```

---

### 3. **Port & Networking**

#### Replit:
```
Port 5000 → Auto-mapped ke HTTPS
Port 8000 → Internal only
WebSocket → Auto-configured
```

#### VPS:
```
Port 5000 → Butuh Nginx/Apache reverse proxy
Port 8000 → Internal (127.0.0.1)
WebSocket → Manual Nginx config untuk upgrade
```

**⚠️ Action Required:**
- Setup Nginx reverse proxy
- Configure SSL dengan Let's Encrypt
- Enable WebSocket support di Nginx

---

### 4. **Database**

#### Replit:
- PostgreSQL 16 module (managed)
- Auto-backup
- Neon Database integration

#### VPS:
- Install PostgreSQL manual ATAU
- Pakai cloud database (Neon/Supabase)

**✅ Status:** Menggunakan Neon Database (cloud) - tidak perlu install PostgreSQL lokal

---

### 5. **Deployment**

#### Replit:
```
Git push → Auto build → Auto deploy
```

#### VPS:
```
Git pull → npm install → npm run build → systemctl restart
```

**⚠️ Perlu:** Setup CI/CD atau deploy script

---

## 🔧 Penyesuaian Code yang Diperlukan

### 1. Update CORS Origins

**File:** `server/index.ts` (line 86-90)

**Before (Replit):**
```typescript
const allowedOrigins = [
  'http://localhost:5000',
  'https://guardiansofthetoken.com',
  'https://bb4178d3-c004-4cff-b3e0-e4d013c0e884-00-1n57odq2i0nbm.kirk.replit.dev'
];
```

**After (VPS):**
```typescript
const allowedOrigins = [
  'http://localhost:5000',
  'https://localhost:5000',
  'https://guardiansofthetoken.com',
  'https://www.guardiansofthetoken.com',
  'https://your-vps-domain.com',           // Ganti dengan domain VPS
  'https://api.your-vps-domain.com',       // Jika ada subdomain
  process.env.FRONTEND_URL || ''            // Dari .env
];

// Enhanced check untuk production
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else if (process.env.NODE_ENV === 'development') {
    // Allow all in development
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});
```

---

### 2. Update Error Messages

**File:** `server/index.ts` (line 43-63)

**Ganti instruksi Replit dengan VPS:**

```typescript
if (missingOptions.length > 0) {
  console.error('\n❌ CRITICAL: NODE_OPTIONS not properly configured!\n');
  console.error('Missing required flags:');
  missingOptions.forEach(opt => console.error(`  - ${opt}`));
  console.error('\n📖 VPS SETUP INSTRUCTIONS:');
  console.error('   Option 1 (Recommended): Update systemd service');
  console.error('     1. Edit: /etc/systemd/system/node_service.service');
  console.error('     2. Add under [Service]:');
  console.error('        Environment="NODE_OPTIONS=--expose-gc --max-old-space-size=2048"');
  console.error('     3. Reload: sudo systemctl daemon-reload');
  console.error('     4. Restart: sudo systemctl restart node_service\n');
  console.error('   Option 2: Update .env file');
  console.error('     Add to .env:');
  console.error('     NODE_OPTIONS="--expose-gc --max-old-space-size=2048"\n');
  // ... rest of error message
}
```

---

### 3. Remove/Disable Replit Plugins (Production Build)

**File:** `vite.config.ts`

**Option A - Conditional Import:**
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path, { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Only import Replit plugins in development
const isReplit = process.env.REPL_ID !== undefined;
const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig(async () => {
  const plugins = [react(), tailwindcss()];

  // Add Replit plugins only in Replit environment
  if (isReplit && isDev) {
    const runtimeErrorOverlay = await import("@replit/vite-plugin-runtime-error-modal");
    plugins.push(runtimeErrorOverlay.default());

    const cartographer = await import("@replit/vite-plugin-cartographer");
    plugins.push(cartographer.default());
  }

  return {
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "client", "src"),
        "@db": path.resolve(__dirname, "db"),
      },
    },
    root: path.resolve(__dirname, "client"),
    build: {
      outDir: path.resolve(__dirname, "dist/public"),
      emptyOutDir: true,
    },
  };
});
```

---

### 4. Environment Variables untuk VPS

**File:** `.env` (create if not exists)

```bash
# ============================================
# VPS-SPECIFIC CONFIGURATION
# ============================================

# Environment
NODE_ENV=production

# Server Configuration
PORT=5000
PYTHON_SERVICE_PORT=8000

# Frontend URL (untuk CORS)
FRONTEND_URL=https://your-vps-domain.com

# Node.js Options
NODE_OPTIONS="--expose-gc --max-old-space-size=2048"

# Database (Neon Cloud)
DATABASE_URL="postgresql://user:password@ep-xxx.region.neon.tech/crypto_api?sslmode=require"

# Redis
REDIS_URL="redis://localhost:6379"
# Atau Redis Cloud:
# REDIS_URL="redis://default:password@redis-xxxxx.cloud.redislabs.com:12345"

# API Keys
COINGLASS_API_KEY="your_key_here"
COINAPI_KEY="your_key_here"

# Security
JWT_SECRET="generate_dengan_openssl_rand_base64_32"
SESSION_SECRET="generate_dengan_openssl_rand_base64_32"

# CORS Origins (comma-separated)
CORS_ORIGINS="https://your-vps-domain.com,https://www.your-vps-domain.com"

# Logging
LOG_LEVEL="INFO"

# Python Service
PYTHONUNBUFFERED=1
PYTHONPATH="/root/crypto-api/coinglass-system"

# TensorFlow (reduce log noise)
TF_CPP_MIN_LOG_LEVEL=2
```

---

## 🚀 Deploy Script untuk VPS

**File:** `deploy-vps.sh` (create new)

```bash
#!/bin/bash

# VPS Deployment Script
# Usage: ./deploy-vps.sh

set -e

echo "🚀 Starting VPS Deployment..."

# 1. Pull latest changes
echo "📥 Pulling latest code from Git..."
git pull origin main

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install --production

# 3. Build frontend
echo "🔨 Building frontend..."
npm run build

# 4. Restart services
echo "🔄 Restarting services..."
sudo systemctl restart python_service
sleep 2
sudo systemctl restart node_service

# 5. Check status
echo "✅ Checking service status..."
sudo systemctl status node_service --no-pager
sudo systemctl status python_service --no-pager

# 6. Check if services are running
if systemctl is-active --quiet node_service && systemctl is-active --quiet python_service; then
    echo "✅ Deployment successful!"
    echo "🌐 Application is running at:"
    echo "   - Node.js: http://localhost:5000"
    echo "   - Python: http://localhost:8000"
else
    echo "❌ Deployment failed! Check logs:"
    echo "   sudo journalctl -u node_service -n 50"
    echo "   sudo journalctl -u python_service -n 50"
    exit 1
fi
```

**Make it executable:**
```bash
chmod +x deploy-vps.sh
```

---

## 📋 VPS Setup Checklist

### Initial Setup (One-time)

- [ ] Install Node.js 20+
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

- [ ] Install PostgreSQL (optional, if not using Neon)
```bash
sudo apt install postgresql postgresql-contrib
```

- [ ] Install Redis
```bash
sudo apt install redis-server
sudo systemctl enable redis-server
```

- [ ] Install Nginx
```bash
sudo apt install nginx
sudo systemctl enable nginx
```

- [ ] Setup Firewall
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

### Application Setup

- [ ] Clone repository
```bash
cd /root
git clone <your-repo> crypto-api
cd crypto-api
```

- [ ] Install dependencies
```bash
npm install
```

- [ ] Create `.env` file
```bash
cp .env.example .env
nano .env  # Edit dengan nilai yang sesuai
```

- [ ] Build application
```bash
npm run build
```

- [ ] Setup systemd services
```bash
sudo cp systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable node_service python_service
sudo systemctl start node_service python_service
```

- [ ] Check services running
```bash
sudo systemctl status node_service
sudo systemctl status python_service
```

---

### Nginx Configuration

- [ ] Create Nginx config
```bash
sudo nano /etc/nginx/sites-available/crypto-api
```

**Config:**
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

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
    }

    # WebSocket support
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

- [ ] Enable site
```bash
sudo ln -s /etc/nginx/sites-available/crypto-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### SSL Certificate

- [ ] Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx
```

- [ ] Get SSL certificate
```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

- [ ] Enable auto-renewal
```bash
sudo systemctl enable certbot.timer
```

---

## 🧪 Testing Deployment

```bash
# 1. Test local endpoints
curl http://localhost:5000/health
curl http://localhost:8000/health

# 2. Test via Nginx (after setup)
curl http://your-domain.com/health

# 3. Test HTTPS (after SSL)
curl https://your-domain.com/health

# 4. Check logs
sudo journalctl -u node_service -f
sudo journalctl -u python_service -f
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🔄 Ongoing Maintenance

### Deploy Updates
```bash
cd /root/crypto-api
./deploy-vps.sh
```

### View Logs
```bash
# Application logs
sudo journalctl -u node_service -n 100 -f
sudo journalctl -u python_service -n 100 -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### Restart Services
```bash
sudo systemctl restart node_service
sudo systemctl restart python_service
sudo systemctl restart nginx
```

### Monitor Resources
```bash
htop
df -h
free -m
```

---

## 🆘 Troubleshooting

### Service Won't Start
```bash
# Check service status
sudo systemctl status node_service
sudo systemctl status python_service

# View detailed logs
sudo journalctl -xe -u node_service
sudo journalctl -xe -u python_service

# Check if .env file exists
ls -la /root/crypto-api/.env

# Check if port is in use
sudo netstat -tlnp | grep :5000
sudo netstat -tlnp | grep :8000
```

### CORS Errors
1. Check `allowedOrigins` in `server/index.ts`
2. Verify Nginx proxy headers
3. Check browser console for exact error

### Database Connection Failed
1. Verify `DATABASE_URL` in `.env`
2. Test connection: `psql $DATABASE_URL`
3. Check firewall if using remote database

---

## 📊 Performance Monitoring

### Setup PM2 (Alternative to systemd)
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Enable Prometheus Metrics
Already built-in! Access at:
- `/metrics` - Prometheus metrics
- `/api/status` - Application status

---

## 🎯 Summary

| Component | Replit | VPS | Status |
|-----------|--------|-----|--------|
| Process Manager | Built-in | systemd ✅ | Ready |
| Web Server | Built-in | Nginx ⚠️ | Needs setup |
| SSL | Auto | Certbot ⚠️ | Needs setup |
| Database | Managed | Neon Cloud ✅ | Ready |
| Redis | Managed | Install ⚠️ | Needs check |
| Deploy | Auto | Manual/Script ⚠️ | Script ready |
| Monitoring | Built-in | Manual ⚠️ | Prometheus ready |

---

## 📝 Notes

1. **Replit Plugins** hanya untuk development, tidak dibutuhkan di production
2. **CORS Origins** harus disesuaikan dengan domain VPS Anda
3. **systemd services** sudah siap, tinggal enable dan start
4. **Nginx + SSL** perlu di-setup untuk production
5. **Deploy script** sudah disediakan untuk memudahkan update

---

## 🔗 Related Documentation

- [VPS-DEPLOYMENT-GUIDE.md](./VPS-DEPLOYMENT-GUIDE.md) - Detailed VPS deployment
- [PERBAIKAN_VPS.md](./PERBAIKAN_VPS.md) - VPS troubleshooting
- [SYSTEMD_DEPLOYMENT_GUIDE.md](./SYSTEMD_DEPLOYMENT_GUIDE.md) - Systemd setup
- [.env.example](./.env.example) - Environment variables template
