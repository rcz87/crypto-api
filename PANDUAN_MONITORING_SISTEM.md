# 📊 Panduan Lengkap Monitoring Sistem Crypto API

> **Dokumentasi Komprehensif untuk Monitoring, Troubleshooting, dan Maintenance**

## 📋 Daftar Isi

1. [Pengenalan](#pengenalan)
2. [Quick Start](#quick-start)
3. [Monitoring Manual](#monitoring-manual)
4. [Monitoring Otomatis](#monitoring-otomatis)
5. [Telegram Bot Monitoring](#telegram-bot-monitoring)
6. [Auto-Restart System](#auto-restart-system)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

---

## 🎯 Pengenalan

Sistem Crypto API memiliki beberapa komponen yang perlu dimonitor:

- **Node.js API** (Port 8080) - Main API Gateway
- **Python FastAPI** (Port 8000) - CoinGlass Service
- **NGINX** (Port 80/443) - Reverse Proxy
- **Telegram Bot** - Notification System
- **Database** - PostgreSQL
- **Memory & Disk** - System Resources

---

## 🚀 Quick Start

### Monitoring Cepat (One-Liner)

```bash
# Jalankan monitoring script
bash monitor-system.sh

# Dengan domain check
bash monitor-system.sh --domain yourdomain.com

# Tanpa auto-restart
bash monitor-system.sh --no-restart
```

### Checklist Monitoring Dasar

| Tujuan                         | Command                                           |
| ------------------------------ | ------------------------------------------------- |
| Cek koneksi API & database     | `curl -s http://localhost:8080/health`            |
| Cek port server (8080) aktif   | `ss -tulpn \| grep 8080`                          |
| Cek Python service (8000)      | `ss -tulpn \| grep 8000`                          |
| Cek akses via domain/subdomain | Buka di browser: `https://domain_kamu/health`     |
| Pantau RAM terus-menerus       | `htop` atau `pm2 monit`                           |

---

## 🔍 Monitoring Manual

### 1. Cek Status Port

#### Port 8080 (Node.js API - Production)

```bash
# Cek apakah port 8080 listening
ss -tulpn | grep 8080

# Output yang diharapkan:
# tcp   LISTEN 0      511          0.0.0.0:8080       0.0.0.0:*    users:(("node",pid=1234,fd=18))
```

**Interpretasi:**
- ✅ **LISTEN** = Port aktif dan siap menerima koneksi
- ❌ **Tidak ada output** = Service tidak berjalan

#### Port 8000 (Python FastAPI)

```bash
# Cek apakah port 8000 listening
ss -tulpn | grep 8000

# Atau gunakan netstat
netstat -tulpn | grep 8000
```

#### Port 80 & 443 (NGINX)

```bash
# Cek NGINX ports
ss -tulpn | grep -E ':(80|443) '

# Cek status NGINX
sudo systemctl status nginx
```

### 2. Cek Health Endpoints

#### Node.js API Health

```bash
# Basic health check
curl -s http://localhost:8080/health | jq .

# Output yang diharapkan:
{
  "success": true,
  "data": {
    "status": "operational",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "services": {
      "okx": "connected",
      "api": "operational",
      "coinglass": "connected"
    },
    "metrics": {
      "responseTime": 45,
      "uptime": "123456s"
    }
  }
}
```

**Status yang Valid:**
- ✅ `"status": "operational"` - Semua sistem normal
- ⚠️ `"status": "degraded"` - Ada service yang bermasalah tapi masih berjalan
- ❌ `"status": "down"` - Service critical down

#### Python Service Health

```bash
# Cek Python FastAPI health
curl -s http://localhost:8000/health | jq .

# Output yang diharapkan:
{
  "status": "healthy",
  "coinglass": {
    "status": "connected",
    "has_key": true
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Enhanced Health Check (Institutional Grade)

```bash
# Cek health dengan detail lengkap
curl -s http://localhost:8080/healthz | jq .

# Cek metrics
curl -s http://localhost:8080/api/metrics | jq .
```

### 3. Monitoring RAM

#### Cek RAM Usage Sekali

```bash
# Tampilkan RAM usage
free -h

# Output:
#               total        used        free      shared  buff/cache   available
# Mem:           7.8G        2.1G        3.2G        100M        2.5G        5.4G
```

#### Monitor RAM Terus-Menerus

```bash
# Gunakan htop (interactive)
htop

# Atau gunakan watch + free
watch -n 2 free -h

# Atau gunakan PM2 monitoring
pm2 monit
```

**Threshold RAM:**
- ✅ **< 70%** - Healthy
- ⚠️ **70-85%** - Warning (perlu diperhatikan)
- ❌ **> 85%** - Critical (perlu action)

#### Cek Top Memory Consumers

```bash
# Tampilkan 10 proses dengan memory tertinggi
ps aux --sort=-%mem | head -11

# Atau dengan format lebih readable
ps aux --sort=-%mem | awk 'NR<=11{printf "%-20s %6s%%  %s\n", $11, $4, $2}'
```

### 4. Monitoring Disk Space

```bash
# Cek disk usage
df -h /

# Output:
# Filesystem      Size  Used Avail Use% Mounted on
# /dev/vda1        50G   15G   33G  32% /

# Cek disk usage semua partisi
df -h

# Cek folder yang paling besar
du -sh /* 2>/dev/null | sort -hr | head -10
```

**Threshold Disk:**
- ✅ **< 70%** - Healthy
- ⚠️ **70-85%** - Warning
- ❌ **> 85%** - Critical

### 5. Cek PM2 Processes

```bash
# List semua PM2 processes
pm2 list

# Output:
# ┌─────┬──────────────────────┬─────────┬─────────┬──────────┬────────┐
# │ id  │ name                 │ mode    │ ↺       │ status   │ cpu    │
# ├─────┼──────────────────────┼─────────┼─────────┼──────────┼────────┤
# │ 0   │ sol-trading-platform │ fork    │ 0       │ online   │ 0.5%   │
# └─────┴──────────────────────┴─────────┴─────────┴──────────┴────────┘

# Cek logs PM2
pm2 logs --lines 50

# Cek logs specific app
pm2 logs sol-trading-platform --lines 50

# Monitor PM2 real-time
pm2 monit
```

### 6. Cek Domain Access

```bash
# Cek apakah domain accessible
curl -I https://yourdomain.com/health

# Output yang diharapkan:
# HTTP/2 200
# content-type: application/json
# ...

# Cek dengan detail
curl -s https://yourdomain.com/health | jq .
```

---

## 🤖 Monitoring Otomatis

### Menggunakan monitor-system.sh

Script `monitor-system.sh` melakukan monitoring komprehensif secara otomatis.

#### Basic Usage

```bash
# Jalankan monitoring
bash monitor-system.sh

# Output akan menampilkan:
# - Status semua ports (8080, 8000, 80, 443)
# - Health check semua endpoints
# - Telegram bot status
# - RAM & Disk usage
# - PM2 processes status
```

#### Advanced Usage

```bash
# Dengan domain check
bash monitor-system.sh --domain yourdomain.com

# Tanpa auto-restart (monitoring only)
bash monitor-system.sh --no-restart

# Custom threshold untuk auto-restart
bash monitor-system.sh --threshold 5

# Kombinasi
bash monitor-system.sh --domain yourdomain.com --threshold 5
```

#### Environment Variables

```bash
# Set Telegram credentials untuk notifikasi
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"

# Set domain untuk monitoring
export DOMAIN="yourdomain.com"

# Jalankan monitoring
bash monitor-system.sh
```

### Setup Cron Job untuk Monitoring Berkala

```bash
# Edit crontab
crontab -e

# Tambahkan monitoring setiap 5 menit
*/5 * * * * /root/crypto-api/monitor-system.sh >> /var/log/crypto-api-monitor.log 2>&1

# Atau setiap 15 menit
*/15 * * * * /root/crypto-api/monitor-system.sh >> /var/log/crypto-api-monitor.log 2>&1

# Monitoring dengan domain check setiap jam
0 * * * * DOMAIN=yourdomain.com /root/crypto-api/monitor-system.sh >> /var/log/crypto-api-monitor.log 2>&1
```

### Setup Systemd Timer (Recommended)

Lebih reliable daripada cron untuk monitoring.

#### 1. Buat Service File

```bash
sudo nano /etc/systemd/system/crypto-api-monitor.service
```

```ini
[Unit]
Description=Crypto API System Monitor
After=network.target

[Service]
Type=oneshot
User=root
WorkingDirectory=/root/crypto-api
ExecStart=/bin/bash /root/crypto-api/monitor-system.sh
StandardOutput=append:/var/log/crypto-api-monitor.log
StandardError=append:/var/log/crypto-api-monitor.log

# Environment variables
Environment="TELEGRAM_BOT_TOKEN=your_token_here"
Environment="TELEGRAM_CHAT_ID=your_chat_id_here"
Environment="DOMAIN=yourdomain.com"

[Install]
WantedBy=multi-user.target
```

#### 2. Buat Timer File

```bash
sudo nano /etc/systemd/system/crypto-api-monitor.timer
```

```ini
[Unit]
Description=Crypto API Monitor Timer
Requires=crypto-api-monitor.service

[Timer]
# Jalankan setiap 5 menit
OnBootSec=2min
OnUnitActiveSec=5min
AccuracySec=1s

[Install]
WantedBy=timers.target
```

#### 3. Enable dan Start Timer

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable timer (auto-start on boot)
sudo systemctl enable crypto-api-monitor.timer

# Start timer
sudo systemctl start crypto-api-monitor.timer

# Cek status timer
sudo systemctl status crypto-api-monitor.timer

# List semua timers
systemctl list-timers
```

---

## 📱 Telegram Bot Monitoring

### Setup Telegram Bot

#### 1. Buat Bot Baru

1. Buka Telegram dan cari **@BotFather**
2. Kirim command: `/newbot`
3. Ikuti instruksi untuk membuat bot
4. Simpan **Bot Token** yang diberikan

#### 2. Dapatkan Chat ID

```bash
# Kirim pesan ke bot Anda di Telegram
# Kemudian jalankan:
curl -s "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates" | jq .

# Cari "chat":{"id": XXXXXXX} di output
# Itu adalah Chat ID Anda
```

#### 3. Set Environment Variables

```bash
# Tambahkan ke ~/.bashrc atau ~/.profile
export TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
export TELEGRAM_CHAT_ID="123456789"

# Reload
source ~/.bashrc
```

#### 4. Test Telegram Bot

```bash
# Test koneksi bot
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe" | jq .

# Kirim test message
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=✅ Test message from monitoring system"
```

### Telegram Notifications

Monitoring script akan otomatis mengirim notifikasi Telegram untuk:

- ✅ **System startup** - Konfirmasi monitoring dimulai
- ⚠️ **Warnings** - Service degraded atau resource tinggi
- ❌ **Critical alerts** - Service down atau auto-restart triggered
- 🔄 **Auto-restart** - Notifikasi sebelum dan sesudah restart

---

## 🔄 Auto-Restart System

### Cara Kerja Auto-Restart

Script monitoring akan otomatis restart PM2 services jika:

1. **Failure threshold tercapai** (default: 3 failures)
2. **Critical services down** (API, Database, dll)
3. **Memory usage critical** (> 85%)

### Konfigurasi Auto-Restart

#### Disable Auto-Restart

```bash
# Monitoring only, tanpa restart
bash monitor-system.sh --no-restart
```

#### Custom Threshold

```bash
# Restart setelah 5 failures
bash monitor-system.sh --threshold 5

# Restart setelah 1 failure (aggressive)
bash monitor-system.sh --threshold 1
```

### Manual Restart Commands

```bash
# Restart semua PM2 processes
pm2 restart all

# Restart specific app
pm2 restart sol-trading-platform

# Restart dengan zero-downtime
pm2 reload all

# Stop dan start ulang
pm2 stop all
pm2 start all
```

### Emergency Restart Procedure

Jika sistem completely down:

```bash
# 1. Stop semua services
pm2 stop all
sudo systemctl stop nginx

# 2. Clear PM2 logs (optional)
pm2 flush

# 3. Start services
pm2 start ecosystem.config.cjs
sudo systemctl start nginx

# 4. Verify
pm2 list
sudo systemctl status nginx
bash monitor-system.sh
```

---

## 🔧 Troubleshooting

### Problem: Port 8080 Tidak Listening

**Diagnosis:**
```bash
# Cek apakah ada proses di port 8080
ss -tulpn | grep 8080

# Cek PM2 status
pm2 list

# Cek logs
pm2 logs sol-trading-platform --lines 100
```

**Solusi:**
```bash
# Restart PM2 app
pm2 restart sol-trading-platform

# Jika masih gagal, cek error di logs
pm2 logs sol-trading-platform --err --lines 50

# Cek apakah port digunakan proses lain
sudo lsof -i :8080

# Kill proses yang menggunakan port (jika perlu)
sudo kill -9 <PID>
```

### Problem: Health Endpoint Return 503

**Diagnosis:**
```bash
# Cek detail error
curl -v http://localhost:8080/health

# Cek service dependencies
curl -s http://localhost:8000/health  # Python service
```

**Solusi:**
```bash
# Restart services
pm2 restart all

# Cek database connection
# (sesuaikan dengan database Anda)

# Cek external API connectivity
curl -I https://api.okx.com/api/v5/public/time
```

### Problem: RAM Usage Tinggi

**Diagnosis:**
```bash
# Cek memory usage detail
free -h

# Cek proses dengan memory tertinggi
ps aux --sort=-%mem | head -20

# Cek PM2 memory usage
pm2 list
```

**Solusi:**
```bash
# Restart PM2 dengan memory limit
pm2 restart sol-trading-platform --max-memory-restart 500M

# Atau edit ecosystem.config.cjs
# Tambahkan: max_memory_restart: '500M'

# Clear system cache (hati-hati!)
sudo sync && sudo sysctl -w vm.drop_caches=3
```

### Problem: Telegram Bot Tidak Terkoneksi

**Diagnosis:**
```bash
# Cek environment variables
echo $TELEGRAM_BOT_TOKEN
echo $TELEGRAM_CHAT_ID

# Test bot API
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
```

**Solusi:**
```bash
# Set ulang environment variables
export TELEGRAM_BOT_TOKEN="your_token"
export TELEGRAM_CHAT_ID="your_chat_id"

# Tambahkan ke ~/.bashrc untuk permanent
echo 'export TELEGRAM_BOT_TOKEN="your_token"' >> ~/.bashrc
echo 'export TELEGRAM_CHAT_ID="your_chat_id"' >> ~/.bashrc
source ~/.bashrc
```

### Problem: Python Service (Port 8000) Down

**Diagnosis:**
```bash
# Cek apakah service running
ps aux | grep uvicorn

# Cek logs
journalctl -u python-api -n 100  # jika menggunakan systemd
```

**Solusi:**
```bash
# Restart Python service
# (sesuaikan dengan setup Anda)
sudo systemctl restart python-api

# Atau jika manual:
cd /path/to/python/service
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 &
```

---

## 📚 Best Practices

### 1. Regular Monitoring Schedule

```bash
# Setup monitoring setiap 5 menit
*/5 * * * * /root/crypto-api/monitor-system.sh

# Daily comprehensive check
0 9 * * * /root/crypto-api/check-system-health.sh
```

### 2. Log Rotation

```bash
# Setup logrotate untuk monitoring logs
sudo nano /etc/logrotate.d/crypto-api-monitor

# Tambahkan:
/var/log/crypto-api-monitor.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

### 3. Backup Before Restart

```bash
# Backup database sebelum restart
pg_dump crypto_db > /backup/crypto_db_$(date +%Y%m%d_%H%M%S).sql

# Backup configuration
tar -czf /backup/config_$(date +%Y%m%d_%H%M%S).tar.gz /root/crypto-api/.env
```

### 4. Monitoring Dashboard

Pertimbangkan setup monitoring dashboard:

- **Grafana** + **Prometheus** - Metrics visualization
- **PM2 Plus** - PM2 monitoring dashboard
- **Netdata** - Real-time system monitoring

### 5. Alert Thresholds

Sesuaikan threshold berdasarkan kebutuhan:

```bash
# Conservative (lebih banyak alert)
bash monitor-system.sh --threshold 2

# Balanced (default)
bash monitor-system.sh --threshold 3

# Relaxed (kurang alert)
bash monitor-system.sh --threshold 5
```

---

## 📞 Emergency Contacts

Jika terjadi masalah critical:

1. **Check monitoring logs**: `/var/log/crypto-api-monitor.log`
2. **Check PM2 logs**: `pm2 logs`
3. **Check system logs**: `journalctl -xe`
4. **Telegram alerts**: Cek notifikasi di Telegram bot

---

## 📝 Checklist Harian

- [ ] Jalankan `bash monitor-system.sh`
- [ ] Cek PM2 status: `pm2 list`
- [ ] Cek RAM usage: `free -h`
- [ ] Cek disk space: `df -h`
- [ ] Review logs: `pm2 logs --lines 50`
- [ ] Test health endpoint: `curl http://localhost:8080/health`
- [ ] Verify Telegram bot: Cek notifikasi

---

## 🎓 Kesimpulan

Dengan mengikuti panduan ini, Anda dapat:

✅ Monitor sistem secara manual dan otomatis
✅ Deteksi masalah sebelum menjadi critical
✅ Auto-restart services saat diperlukan
✅ Menerima notifikasi real-time via Telegram
✅ Troubleshoot masalah dengan cepat

**Happy Monitoring! 🚀**
