# 🚀 Quick Reference - Monitoring Crypto API

> **Cheat Sheet untuk Monitoring Cepat**

## 📋 Command Essentials

### ⚡ Monitoring Cepat (One-Liner)

```bash
# Monitoring lengkap otomatis
bash monitor-system.sh

# Dengan domain check
bash monitor-system.sh --domain yourdomain.com

# Tanpa auto-restart
bash monitor-system.sh --no-restart
```

---

## 🔍 Manual Checks

### 1️⃣ Cek Port Status

```bash
# Port 8080 (Node.js API)
ss -tulpn | grep 8080

# Port 8000 (Python Service)
ss -tulpn | grep 8000

# Port 80/443 (NGINX)
ss -tulpn | grep -E ':(80|443) '
```

### 2️⃣ Cek Health Endpoints

```bash
# Node.js API
curl -s http://localhost:8080/health | jq .

# Python Service
curl -s http://localhost:8000/health | jq .

# Metrics
curl -s http://localhost:8080/api/metrics | jq .
```

### 3️⃣ Cek RAM & Disk

```bash
# RAM usage
free -h

# Disk usage
df -h /

# Top memory consumers
ps aux --sort=-%mem | head -11
```

### 4️⃣ Cek PM2 Processes

```bash
# List processes
pm2 list

# Monitor real-time
pm2 monit

# View logs
pm2 logs --lines 50
```

---

## 🔄 Restart Commands

### PM2 Restart

```bash
# Restart all
pm2 restart all

# Restart specific app
pm2 restart sol-trading-platform

# Zero-downtime reload
pm2 reload all
```

### Service Restart

```bash
# NGINX
sudo systemctl restart nginx

# Python service (jika systemd)
sudo systemctl restart python-api
```

---

## 📱 Telegram Setup

### Quick Setup

```bash
# 1. Set environment variables
export TELEGRAM_BOT_TOKEN="your_bot_token"
export TELEGRAM_CHAT_ID="your_chat_id"

# 2. Test bot
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"

# 3. Send test message
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=✅ Test"
```

---

## 🚨 Emergency Procedures

### System Down - Quick Recovery

```bash
# 1. Stop all
pm2 stop all

# 2. Clear logs (optional)
pm2 flush

# 3. Start all
pm2 start ecosystem.config.cjs

# 4. Verify
pm2 list
bash monitor-system.sh
```

### High Memory - Quick Fix

```bash
# Restart with memory limit
pm2 restart sol-trading-platform --max-memory-restart 500M

# Clear cache (careful!)
sudo sync && sudo sysctl -w vm.drop_caches=3
```

---

## 📊 Status Indicators

### Health Status

| Status        | Meaning                    | Action          |
| ------------- | -------------------------- | --------------- |
| ✅ operational | All systems OK             | None            |
| ⚠️ degraded   | Some services have issues  | Monitor closely |
| ❌ down       | Critical services offline  | Immediate fix   |

### Resource Thresholds

| Resource | Healthy | Warning | Critical |
| -------- | ------- | ------- | -------- |
| RAM      | < 70%   | 70-85%  | > 85%    |
| Disk     | < 70%   | 70-85%  | > 85%    |
| CPU      | < 70%   | 70-90%  | > 90%    |

---

## 🔧 Troubleshooting Quick Fixes

### Port Not Listening

```bash
# Check what's using the port
sudo lsof -i :8080

# Kill process if needed
sudo kill -9 <PID>

# Restart service
pm2 restart sol-trading-platform
```

### Health Endpoint 503

```bash
# Check dependencies
curl http://localhost:8000/health

# Restart all services
pm2 restart all

# Check logs
pm2 logs --err --lines 50
```

### Telegram Not Working

```bash
# Verify env vars
echo $TELEGRAM_BOT_TOKEN
echo $TELEGRAM_CHAT_ID

# Test API
curl "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"

# Re-export if needed
export TELEGRAM_BOT_TOKEN="your_token"
export TELEGRAM_CHAT_ID="your_chat_id"
```

---

## ⏰ Automated Monitoring Setup

### Cron Job (Simple)

```bash
# Edit crontab
crontab -e

# Add monitoring every 5 minutes
*/5 * * * * /root/crypto-api/monitor-system.sh >> /var/log/crypto-api-monitor.log 2>&1
```

### Systemd Timer (Recommended)

```bash
# Create service
sudo nano /etc/systemd/system/crypto-api-monitor.service

# Create timer
sudo nano /etc/systemd/system/crypto-api-monitor.timer

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable crypto-api-monitor.timer
sudo systemctl start crypto-api-monitor.timer

# Check status
sudo systemctl status crypto-api-monitor.timer
```

---

## 📝 Daily Checklist

```bash
# Morning routine
pm2 list                                    # Check processes
free -h                                     # Check RAM
df -h                                       # Check disk
bash monitor-system.sh                      # Full check
pm2 logs --lines 50                         # Review logs
curl http://localhost:8080/health | jq .    # Test API
```

---

## 🔗 Useful Links

- **Full Guide**: `PANDUAN_MONITORING_SISTEM.md`
- **Health Check Script**: `check-system-health.sh`
- **Monitor Script**: `monitor-system.sh`
- **Logs**: `/var/log/crypto-api-monitor.log`

---

## 💡 Pro Tips

1. **Alias untuk command cepat:**
   ```bash
   alias mon='bash /root/crypto-api/monitor-system.sh'
   alias health='curl -s http://localhost:8080/health | jq .'
   alias pmlogs='pm2 logs --lines 50'
   ```

2. **Watch mode untuk monitoring real-time:**
   ```bash
   watch -n 5 'curl -s http://localhost:8080/health | jq .'
   ```

3. **Quick log analysis:**
   ```bash
   pm2 logs --err --lines 100 | grep -i error
   ```

---

## 📞 Emergency Contact

**Critical Issues:**
1. Check logs: `/var/log/crypto-api-monitor.log`
2. Check PM2: `pm2 logs`
3. Check system: `journalctl -xe`
4. Telegram alerts: Check bot notifications

---

**Last Updated**: 2024-01-15
**Version**: 1.0.0
