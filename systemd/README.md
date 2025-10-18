# 📦 Systemd Unit Files - Crypto API

Unit files production-grade untuk deployment Crypto API dengan systemd.

## 📋 File yang Tersedia

### 1. **python_service.service**
Service utama untuk Python FastAPI (CoinGlass engine)
- **Port**: 8000
- **Workers**: 4 (Uvicorn)
- **Auto-restart**: Ya
- **Watchdog**: 60 detik
- **Memory limit**: 2GB
- **CPU quota**: 200%

### 2. **node_service.service**
Service untuk Node.js Express gateway
- **Port**: 5000
- **Depends on**: python_service
- **Auto-restart**: Ya
- **Watchdog**: 60 detik
- **Memory limit**: 2GB
- **CPU quota**: 200%

### 3. **env-watcher.path**
Path-based monitoring untuk file .env
- **Monitors**: `/root/crypto-api/.env`
- **Triggers**: env-reload.service saat file berubah

### 4. **env-watcher.service**
Service alternatif untuk monitoring .env (polling-based)
- **Check interval**: 5 detik
- **Action**: Reload services saat .env berubah

### 5. **env-reload.service**
Service yang di-trigger untuk reload services
- **Type**: oneshot
- **Action**: Reload python_service dan node_service

## 🚀 Quick Start

```bash
# Install semua services
sudo bash ../scripts/install-services.sh

# Start services
sudo systemctl start python_service node_service

# Enable auto-start on boot
sudo systemctl enable python_service node_service

# Enable environment auto-reload
sudo systemctl start env-watcher.path
sudo systemctl enable env-watcher.path
```

## 🔧 Konfigurasi

### Environment Variables
Semua services membaca dari: `/root/crypto-api/.env`

Required variables:
```bash
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
COINGLASS_API_KEY="your_key"
COINAPI_KEY="your_key"
NODE_ENV="production"
```

### Resource Limits
Default limits (dapat diubah dengan `systemctl edit`):
- **Memory**: 2GB per service
- **CPU**: 200% (2 cores)
- **File descriptors**: 65536
- **Processes**: 4096

### Log Configuration
- **Output**: systemd journal
- **Identifier**: python_service / node_service
- **Rotation**: Daily, keep 14 days
- **Location**: `/var/log/crypto-api/`

## 📊 Monitoring

```bash
# Check status
sudo systemctl status python_service node_service

# View logs
sudo journalctl -u python_service -u node_service -f

# Check resource usage
sudo systemctl show python_service | grep -E "Memory|CPU"
```

## 🔄 Maintenance

### Graceful Reload
```bash
# Zero-downtime reload
sudo systemctl reload-or-restart python_service
sudo systemctl reload-or-restart node_service
```

### Update Configuration
```bash
# Edit service file
sudo systemctl edit python_service

# Reload daemon
sudo systemctl daemon-reload

# Restart service
sudo systemctl restart python_service
```

## 🛡️ Security Features

- ✅ **NoNewPrivileges**: Prevent privilege escalation
- ✅ **PrivateTmp**: Isolated temporary files
- ✅ **ProtectSystem**: Read-only system directories
- ✅ **ProtectKernelTunables**: Protect kernel parameters
- ✅ **ProtectKernelModules**: Prevent kernel module loading
- ✅ **ProtectControlGroups**: Protect cgroup filesystem

## 📖 Documentation

Lihat dokumentasi lengkap di: [SYSTEMD_DEPLOYMENT_GUIDE.md](../SYSTEMD_DEPLOYMENT_GUIDE.md)

## 🆘 Troubleshooting

### Service tidak start
```bash
# Check logs
sudo journalctl -u python_service -n 50

# Check port
sudo lsof -i :8000

# Verify .env
ls -la /root/crypto-api/.env
```

### Environment tidak terbaca
```bash
# Verify EnvironmentFile
sudo systemctl show python_service | grep EnvironmentFile

# Reload daemon
sudo systemctl daemon-reload
sudo systemctl restart python_service
```

### Service crash loop
```bash
# Check restart count
sudo systemctl show python_service | grep NRestarts

# Increase restart delay
sudo systemctl edit python_service
# Add: RestartSec=30
```

## 📝 Notes

- Services akan auto-restart jika crash
- Graceful shutdown timeout: 30 detik
- Watchdog akan restart service jika hang > 60 detik
- Environment auto-reload membutuhkan env-watcher.path aktif
- Log rotation otomatis setiap hari

---

**Production-ready systemd configuration untuk Crypto API** 🚀
