# ⚡ Quick Start - Systemd Production Deployment

Panduan cepat untuk deploy Crypto API dengan systemd production-grade.

## 🎯 Instalasi dalam 3 Langkah

### 1️⃣ Persiapan

```bash
cd /root/crypto-api

# Pastikan .env sudah ada
ls -la .env

# Build aplikasi
npm run build
```

### 2️⃣ Install Services

```bash
# Install semua systemd services
sudo bash scripts/install-services.sh
```

Output yang diharapkan:
```
🚀 Installing Crypto API Services...
📁 Creating log directory...
🔧 Making scripts executable...
🛑 Stopping existing services...
📦 Installing service files...
🔄 Reloading systemd daemon...
✅ Enabling services...
📊 Setting up log rotation...
✅ Installation complete!
```

### 3️⃣ Start Services

```bash
# Start semua services
sudo bash scripts/service-manager.sh start
```

Output yang diharapkan:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Starting Services
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Starting Python service...
✅ Python service started
🚀 Starting Node service...
✅ Node service started
🚀 Starting environment watcher...
✅ Environment watcher started

✅ All services started successfully!
```

## ✅ Verifikasi

```bash
# Check status
sudo bash scripts/service-manager.sh status

# Health check
sudo bash scripts/service-manager.sh health

# Test endpoints
curl http://localhost:8000/health
curl http://localhost:5000/api/status
```

## 🎮 Perintah Penting

```bash
# Status semua services
sudo bash scripts/service-manager.sh status

# Start services
sudo bash scripts/service-manager.sh start

# Stop services
sudo bash scripts/service-manager.sh stop

# Restart services
sudo bash scripts/service-manager.sh restart

# Graceful reload (zero-downtime)
sudo bash scripts/service-manager.sh reload

# View logs
sudo bash scripts/service-manager.sh logs all

# Health check
sudo bash scripts/service-manager.sh health
```

## 🔄 Update .env File

Setelah instalasi, setiap kali Anda update file `.env`:

```bash
# Edit .env
nano /root/crypto-api/.env

# Services akan auto-reload dalam 5 detik!
# Atau reload manual:
sudo bash scripts/service-manager.sh reload
```

## 📊 Monitoring

```bash
# Real-time logs
sudo bash scripts/service-manager.sh logs all

# Python service logs
sudo bash scripts/service-manager.sh logs python

# Node service logs
sudo bash scripts/service-manager.sh logs node

# Check resource usage
sudo systemctl status python_service | grep -E "Memory|CPU"
```

## 🆘 Troubleshooting

### Service tidak start?

```bash
# Check logs
sudo journalctl -u python_service -n 50

# Check port
sudo lsof -i :8000
sudo lsof -i :5000

# Verify .env
cat /root/crypto-api/.env
```

### Port sudah digunakan?

```bash
# Kill process yang menggunakan port
sudo lsof -ti:8000 | xargs kill -9
sudo lsof -ti:5000 | xargs kill -9

# Restart services
sudo bash scripts/service-manager.sh restart
```

### Environment tidak terbaca?

```bash
# Reload daemon
sudo systemctl daemon-reload

# Restart services
sudo bash scripts/service-manager.sh restart
```

## 📖 Dokumentasi Lengkap

Untuk dokumentasi lengkap, lihat:
- [SYSTEMD_DEPLOYMENT_GUIDE.md](./SYSTEMD_DEPLOYMENT_GUIDE.md) - Panduan lengkap
- [systemd/README.md](./systemd/README.md) - Detail unit files

## 🎯 Fitur Production-Grade

✅ **Auto-restart** - Service otomatis restart jika crash  
✅ **Graceful shutdown** - Shutdown yang aman dengan timeout 30 detik  
✅ **Log rotation** - Otomatis rotate logs setiap hari  
✅ **Environment auto-reload** - Auto-reload saat .env berubah  
✅ **Resource limits** - Memory 2GB, CPU 200% per service  
✅ **Security hardening** - Multiple security layers  
✅ **Watchdog** - Auto-restart jika service hang  
✅ **Health monitoring** - Built-in health checks  

## 🚀 Production Ready!

Sistem Anda sekarang production-ready dengan:
- ✅ Systemd services yang robust
- ✅ Auto-restart dan recovery
- ✅ Log management yang proper
- ✅ Environment auto-reload
- ✅ Security hardening
- ✅ Resource limits

**Selamat! Crypto API Anda sudah siap untuk production! 🎉**

---

Need help? Check logs: `sudo bash scripts/service-manager.sh logs all`
