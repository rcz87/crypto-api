# 🚀 Panduan Deployment Production-Grade dengan Systemd

Dokumentasi lengkap untuk deployment Crypto API menggunakan systemd dengan fitur production-grade.

## 📋 Daftar Isi

1. [Fitur Utama](#fitur-utama)
2. [Struktur File](#struktur-file)
3. [Instalasi](#instalasi)
4. [Penggunaan](#penggunaan)
5. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
6. [Maintenance](#maintenance)

---

## ✨ Fitur Utama

### 🔄 Auto-Restart & Recovery
- ✅ Automatic restart jika service crash
- ✅ Graceful shutdown dengan timeout 30 detik
- ✅ Watchdog untuk deteksi service hang (60 detik)
- ✅ Rate limiting untuk mencegah restart loop

### 📊 Log Management
- ✅ Log rotation otomatis (daily, keep 14 days)
- ✅ Journald integration dengan retention 30 hari
- ✅ Structured logging dengan syslog identifier
- ✅ Separate logs untuk setiap service

### 🔐 Security Hardening
- ✅ NoNewPrivileges untuk mencegah privilege escalation
- ✅ PrivateTmp untuk isolasi temporary files
- ✅ ProtectSystem untuk read-only system directories
- ✅ Resource limits (Memory: 2GB, CPU: 200%)

### ⚡ Environment Auto-Reload
- ✅ Monitoring .env file secara real-time
- ✅ Auto-reload services saat .env berubah
- ✅ Zero-downtime reload dengan graceful restart
- ✅ Logging setiap perubahan environment

---

## 📁 Struktur File

```
/root/crypto-api/
├── systemd/                          # Systemd unit files
│   ├── python_service.service        # Python FastAPI service
│   ├── node_service.service          # Node.js Express gateway
│   ├── env-watcher.service           # Environment file watcher
│   ├── env-watcher.path              # Path-based activation
│   └── env-reload.service            # Reload trigger service
│
├── scripts/                          # Management scripts
│   ├── install-services.sh           # Installation script
│   ├── service-manager.sh            # Unified service manager
│   ├── watch-env.sh                  # Environment monitoring
│   └── setup-logrotate.sh            # Log rotation setup
│
└── .env                              # Environment variables
```

---

## 🚀 Instalasi

### 1. Persiapan Awal

```bash
# Masuk ke direktori project
cd /root/crypto-api

# Pastikan .env file sudah ada dan terisi
ls -la .env

# Build aplikasi Node.js
npm run build
```

### 2. Install Services

```bash
# Jalankan script instalasi (butuh sudo)
sudo bash scripts/install-services.sh
```

Script ini akan:
- ✅ Membuat direktori log `/var/log/crypto-api/`
- ✅ Install semua unit files ke `/etc/systemd/system/`
- ✅ Setup log rotation
- ✅ Enable services untuk auto-start
- ✅ Configure journald

### 3. Verifikasi Instalasi

```bash
# Check apakah services sudah terdaftar
systemctl list-unit-files | grep -E "python_service|node_service|env-watcher"

# Output yang diharapkan:
# python_service.service    enabled
# node_service.service      enabled
# env-watcher.path          enabled
```

---

## 🎮 Penggunaan

### Service Manager (Recommended)

Gunakan script `service-manager.sh` untuk management yang mudah:

```bash
# Buat script executable
chmod +x scripts/service-manager.sh

# Lihat status semua services
sudo bash scripts/service-manager.sh status

# Start semua services
sudo bash scripts/service-manager.sh start

# Stop semua services
sudo bash scripts/service-manager.sh stop

# Restart semua services
sudo bash scripts/service-manager.sh restart

# Graceful reload (zero-downtime)
sudo bash scripts/service-manager.sh reload

# View logs
sudo bash scripts/service-manager.sh logs all      # Semua logs
sudo bash scripts/service-manager.sh logs python   # Python saja
sudo bash scripts/service-manager.sh logs node     # Node saja

# Health check
sudo bash scripts/service-manager.sh health
```

### Manual Commands

Jika ingin menggunakan systemctl langsung:

```bash
# Start services
sudo systemctl start python_service
sudo systemctl start node_service

# Stop services
sudo systemctl stop python_service
sudo systemctl stop node_service

# Restart services
sudo systemctl restart python_service
sudo systemctl restart node_service

# Reload (graceful restart)
sudo systemctl reload-or-restart python_service
sudo systemctl reload-or-restart node_service

# Check status
sudo systemctl status python_service
sudo systemctl status node_service

# Enable auto-start on boot
sudo systemctl enable python_service
sudo systemctl enable node_service

# Disable auto-start
sudo systemctl disable python_service
sudo systemctl disable node_service
```

### Environment Auto-Reload

```bash
# Enable environment watcher
sudo systemctl start env-watcher.path
sudo systemctl enable env-watcher.path

# Check watcher status
sudo systemctl status env-watcher.path

# View watcher logs
sudo journalctl -u env-watcher.service -f

# Disable watcher
sudo systemctl stop env-watcher.path
sudo systemctl disable env-watcher.path
```

**Cara Kerja:**
1. Edit file `.env`
2. Watcher mendeteksi perubahan
3. Trigger `env-reload.service`
4. Services di-reload secara graceful
5. Log perubahan tersimpan di `/var/log/crypto-api/env-reload.log`

---

## 📊 Monitoring & Troubleshooting

### View Logs

```bash
# Real-time logs (semua services)
sudo journalctl -u python_service -u node_service -f

# Real-time logs (Python saja)
sudo journalctl -u python_service -f

# Real-time logs (Node saja)
sudo journalctl -u node_service -f

# Last 100 lines
sudo journalctl -u python_service -n 100

# Logs hari ini
sudo journalctl -u python_service --since today

# Logs dalam 1 jam terakhir
sudo journalctl -u python_service --since "1 hour ago"

# Logs dengan priority ERROR
sudo journalctl -u python_service -p err

# Export logs ke file
sudo journalctl -u python_service --since today > python_logs.txt
```

### Health Checks

```bash
# Check service status
sudo systemctl is-active python_service
sudo systemctl is-active node_service

# Check if services are enabled
sudo systemctl is-enabled python_service
sudo systemctl is-enabled node_service

# Detailed status
sudo systemctl status python_service --no-pager -l

# Check listening ports
sudo netstat -tlnp | grep -E "8000|5000"
# atau
sudo ss -tlnp | grep -E "8000|5000"

# Test endpoints
curl http://localhost:8000/health
curl http://localhost:5000/api/status
```

### Common Issues

#### Service Gagal Start

```bash
# Check error logs
sudo journalctl -u python_service -n 50 --no-pager

# Check if port already in use
sudo lsof -i :8000
sudo lsof -i :5000

# Check file permissions
ls -la /root/crypto-api/.env
ls -la /root/crypto-api/coinglass-system/

# Verify environment variables
sudo systemctl show python_service | grep EnvironmentFile
```

#### Service Crash/Restart Loop

```bash
# Check restart count
sudo systemctl show python_service | grep NRestarts

# View crash logs
sudo journalctl -u python_service --since "10 minutes ago"

# Check resource usage
sudo systemctl status python_service | grep -E "Memory|CPU"

# Increase restart delay if needed
sudo systemctl edit python_service
# Add: RestartSec=30
```

#### Environment Variables Tidak Terbaca

```bash
# Verify .env file exists
ls -la /root/crypto-api/.env

# Check if service can read .env
sudo -u root cat /root/crypto-api/.env

# Reload systemd and restart
sudo systemctl daemon-reload
sudo systemctl restart python_service
```

---

## 🔧 Maintenance

### Update Application

```bash
# 1. Pull latest code
cd /root/crypto-api
git pull

# 2. Install dependencies
npm install
pip install -r requirements-dev.txt

# 3. Build application
npm run build

# 4. Graceful reload (zero-downtime)
sudo bash scripts/service-manager.sh reload

# 5. Verify
sudo bash scripts/service-manager.sh health
```

### Update Environment Variables

```bash
# 1. Edit .env file
nano /root/crypto-api/.env

# 2. Services akan auto-reload jika env-watcher aktif
# Atau reload manual:
sudo systemctl reload-or-restart python_service
sudo systemctl reload-or-restart node_service

# 3. Verify
sudo journalctl -u env-reload.service -n 10
```

### Log Rotation

Log rotation sudah dikonfigurasi otomatis:

```bash
# Manual rotation (jika diperlukan)
sudo logrotate -f /etc/logrotate.d/crypto-api

# Check rotation status
sudo cat /var/lib/logrotate/status | grep crypto-api

# View rotated logs
ls -lh /var/log/crypto-api/

# Clean old logs manually
sudo find /var/log/crypto-api/ -name "*.gz" -mtime +30 -delete
```

### Backup & Restore

```bash
# Backup configuration
sudo tar -czf crypto-api-config-backup.tar.gz \
    /etc/systemd/system/python_service.service \
    /etc/systemd/system/node_service.service \
    /etc/systemd/system/env-*.service \
    /etc/logrotate.d/crypto-api \
    /root/crypto-api/.env

# Restore configuration
sudo tar -xzf crypto-api-config-backup.tar.gz -C /
sudo systemctl daemon-reload
```

### Performance Tuning

```bash
# Increase memory limit
sudo systemctl edit python_service
# Add: MemoryMax=4G

# Increase CPU quota
sudo systemctl edit python_service
# Add: CPUQuota=400%

# Increase file descriptors
sudo systemctl edit python_service
# Add: LimitNOFILE=131072

# Apply changes
sudo systemctl daemon-reload
sudo systemctl restart python_service
```

---

## 📈 Best Practices

### 1. Monitoring
- ✅ Setup monitoring tools (Prometheus, Grafana)
- ✅ Configure alerts untuk service failures
- ✅ Monitor resource usage (CPU, Memory, Disk)
- ✅ Track response times dan error rates

### 2. Security
- ✅ Regularly update dependencies
- ✅ Review dan rotate API keys
- ✅ Monitor access logs untuk suspicious activity
- ✅ Keep system packages updated

### 3. Backup
- ✅ Daily backup .env file
- ✅ Weekly backup database
- ✅ Monthly backup full application
- ✅ Test restore procedures regularly

### 4. Documentation
- ✅ Document semua perubahan configuration
- ✅ Maintain runbook untuk common issues
- ✅ Keep deployment notes updated
- ✅ Document API changes

---

## 🆘 Support

Jika mengalami masalah:

1. **Check logs**: `sudo bash scripts/service-manager.sh logs all`
2. **Run health check**: `sudo bash scripts/service-manager.sh health`
3. **Check status**: `sudo bash scripts/service-manager.sh status`
4. **Review documentation**: Baca bagian troubleshooting di atas

---

## 📝 Changelog

### Version 1.0.0 (Current)
- ✅ Initial production-grade systemd setup
- ✅ Auto-restart dan recovery
- ✅ Log rotation
- ✅ Environment auto-reload
- ✅ Security hardening
- ✅ Resource limits
- ✅ Unified service manager

---

**Dibuat dengan ❤️ untuk Crypto API Production Deployment**
