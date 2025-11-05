# ⚡ Quick Fix Guide - RAM Crash & Server Error

## 🎯 One-Command Fix

```bash
cd /root/crypto-api && ./fix-ram-crash-deploy.sh
```

**That's it!** Script akan otomatis:
1. Build dengan config baru
2. Deploy ke production
3. Restart PM2
4. Show logs

---

## 📋 What Was Fixed?

### Before ❌
```
❌ (void 0) is not a function
❌ require is not defined  
❌ Dynamic require of "path" is not supported
❌ RAM: 94% → Server crash
```

### After ✅
```
✅ No module errors
✅ require() works perfectly
✅ RAM: < 50% stable
✅ Server runs without crashes
```

---

## 🔧 Technical Changes

| File | Change | Why |
|------|--------|-----|
| `esbuild.server.config.cjs` | `outdir: 'dist'` → `outfile: 'dist/index.cjs'` | Explicit CommonJS format |
| `package.json` | `"type": "module"` → `"type": "commonjs"` | Force CommonJS mode |
| `ecosystem.config.cjs` | `script: 'dist/index.js'` → `script: 'dist/index.cjs'` | Point to correct file |

---

## ✅ Verification (After Deploy)

### 1. Check PM2 Status
```bash
sudo pm2 status
```
**Expected**: Status = `online`, Restarts = 0

### 2. Check Logs
```bash
sudo pm2 logs sol-trading-platform --lines 30
```
**Expected**: No error messages

### 3. Check RAM
```bash
free -h
```
**Expected**: Used < 50%

### 4. Test API
```bash
curl http://localhost:8080/health
```
**Expected**: HTTP 200 OK

---

## 🚨 If Something Goes Wrong

### Quick Rollback
```bash
cd /var/www/sol-trading
sudo pm2 stop sol-trading-platform
sudo rm -rf dist
sudo mv dist.backup.* dist
sudo pm2 restart sol-trading-platform
```

### Check Logs
```bash
sudo pm2 logs sol-trading-platform --lines 100 --err
```

### Manual Fix
```bash
# Ensure package.json has correct type
cd /var/www/sol-trading
sudo nano package.json
# Change: "type": "commonjs"

# Restart
sudo pm2 restart sol-trading-platform
```

---

## 📞 Need Help?

1. Read full documentation: `FIX_RAM_CRASH_DOCUMENTATION.md`
2. Check TODO progress: `TODO.md`
3. Review deployment script: `fix-ram-crash-deploy.sh`

---

## 🎯 Success Indicators

✅ Server uptime > 5 minutes without restart  
✅ RAM usage stable < 50%  
✅ No error logs  
✅ API endpoints responding  
✅ PM2 status shows "online"  

**If all above = SUCCESS! 🎉**
