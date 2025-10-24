# ✅ Post-Deployment Verification Checklist

Gunakan checklist ini setelah menjalankan `./fix-ram-crash-deploy.sh`

---

## 🔍 Immediate Checks (0-5 minutes)

### ☑️ 1. PM2 Process Status
```bash
sudo pm2 status
```

**Check:**
- [ ] Status shows `online` (not `errored` or `stopped`)
- [ ] Uptime > 30 seconds
- [ ] Restarts = 0 (or very low)
- [ ] CPU < 50%
- [ ] Memory < 500MB

**If Failed**: Check logs with `sudo pm2 logs sol-trading-platform --lines 50`

---

### ☑️ 2. Error Logs Check
```bash
sudo pm2 logs sol-trading-platform --lines 50 --err
```

**Check:**
- [ ] NO `(void 0) is not a function` error
- [ ] NO `require is not defined` error
- [ ] NO `Dynamic require of "path"` error
- [ ] NO `Cannot find module` errors
- [ ] NO `ERR_REQUIRE_ESM` errors

**If Failed**: Review `FIX_RAM_CRASH_DOCUMENTATION.md` troubleshooting section

---

### ☑️ 3. Startup Logs Check
```bash
sudo pm2 logs sol-trading-platform --lines 30
```

**Check:**
- [ ] Server started successfully
- [ ] Port 8080 listening
- [ ] Database connected (if applicable)
- [ ] No error messages
- [ ] Clean startup sequence

---

### ☑️ 4. File Verification
```bash
ls -lh /var/www/sol-trading/dist/index.cjs
cat /var/www/sol-trading/package.json | grep '"type"'
```

**Check:**
- [ ] `dist/index.cjs` exists
- [ ] File size reasonable (not 0 bytes, not > 50MB)
- [ ] package.json shows `"type": "commonjs"`

---

## 💻 System Health Checks (5-10 minutes)

### ☑️ 5. RAM Usage
```bash
free -h
```

**Check:**
- [ ] Used memory < 50% of total
- [ ] Available memory > 1GB
- [ ] NOT showing 94%+ usage
- [ ] Swap usage minimal

**Monitor over time:**
```bash
watch -n 5 'free -h'
```
- [ ] RAM stays stable (not increasing)

---

### ☑️ 6. CPU Usage
```bash
top -bn1 | grep "node"
htop
```

**Check:**
- [ ] Node process CPU < 50%
- [ ] No CPU spikes
- [ ] Stable over time

---

### ☑️ 7. Process Stability
```bash
# Wait 5 minutes, then check again
sleep 300
sudo pm2 status
```

**Check:**
- [ ] Still showing `online`
- [ ] Uptime increased (now > 5 minutes)
- [ ] Restarts still 0
- [ ] No crashes

---

## 🌐 API Functionality Checks (10-15 minutes)

### ☑️ 8. Health Endpoint
```bash
curl -i http://localhost:8080/health
```

**Check:**
- [ ] HTTP 200 OK
- [ ] Response time < 1 second
- [ ] Valid JSON response

---

### ☑️ 9. Status Endpoint
```bash
curl -i http://localhost:8080/api/status
```

**Check:**
- [ ] HTTP 200 OK
- [ ] Returns system status
- [ ] No error messages

---

### ☑️ 10. Main API Endpoints
```bash
# Test your main endpoints
curl -i http://localhost:8080/api/signals
curl -i http://localhost:8080/api/market-data
```

**Check:**
- [ ] All endpoints responding
- [ ] HTTP 200 responses
- [ ] Valid data returned
- [ ] No 502/503 errors

---

## 📊 Extended Monitoring (15-30 minutes)

### ☑️ 11. Log Monitoring
```bash
sudo pm2 logs sol-trading-platform --lines 0
# Let it run for 10 minutes, watch for errors
```

**Check:**
- [ ] No recurring errors
- [ ] Normal operation logs
- [ ] No memory warnings
- [ ] No crash attempts

---

### ☑️ 12. Memory Leak Test
```bash
# Monitor RAM over 15 minutes
watch -n 60 'free -h && echo "---" && sudo pm2 status'
```

**Check:**
- [ ] RAM usage stable (not increasing)
- [ ] No gradual memory growth
- [ ] Process memory stable

---

### ☑️ 13. Stress Test (Optional)
```bash
# Send multiple requests
for i in {1..100}; do
  curl -s http://localhost:8080/health > /dev/null &
done
wait

# Check status after
sudo pm2 status
free -h
```

**Check:**
- [ ] Server handled load
- [ ] Still online
- [ ] RAM didn't spike
- [ ] No crashes

---

## 🎯 Success Criteria

### ✅ All Green = SUCCESS!

If ALL of these are true, the fix is successful:

- ✅ PM2 status: `online`
- ✅ Uptime: > 15 minutes without restart
- ✅ Restarts: 0
- ✅ RAM: < 50%
- ✅ No error logs
- ✅ API endpoints working
- ✅ No module errors
- ✅ Stable over time

**Congratulations! 🎉 The fix is working perfectly.**

---

## ⚠️ If Any Check Fails

### Red Flags to Watch For:

1. **Status shows `errored`**
   - Check logs: `sudo pm2 logs sol-trading-platform --lines 100 --err`
   - Verify package.json: `cat /var/www/sol-trading/package.json | grep type`

2. **RAM still high (>70%)**
   - Check for memory leaks
   - Review running processes: `htop`
   - Check if old process still running

3. **Module errors still appearing**
   - Verify `.cjs` file exists: `ls -lh /var/www/sol-trading/dist/`
   - Check package.json type field
   - Restart PM2: `sudo pm2 restart sol-trading-platform`

4. **API not responding**
   - Check if port 8080 is listening: `netstat -tlnp | grep 8080`
   - Check firewall: `sudo ufw status`
   - Check nginx config if using reverse proxy

---

## 🔄 Rollback Procedure

If multiple checks fail and server is unstable:

```bash
# 1. Stop current process
sudo pm2 stop sol-trading-platform

# 2. Restore backup
cd /var/www/sol-trading
sudo rm -rf dist
sudo mv dist.backup.* dist

# 3. Restart
sudo pm2 restart sol-trading-platform

# 4. Report issue with logs
sudo pm2 logs sol-trading-platform --lines 100 > rollback-logs.txt
```

---

## 📞 Support

If issues persist:

1. **Collect Information:**
   ```bash
   sudo pm2 logs sol-trading-platform --lines 200 > deployment-logs.txt
   sudo pm2 status > pm2-status.txt
   free -h > memory-status.txt
   ```

2. **Review Documentation:**
   - `FIX_RAM_CRASH_DOCUMENTATION.md` - Full troubleshooting guide
   - `QUICK_FIX_GUIDE.md` - Quick fixes

3. **Check Files:**
   - Verify all changes were applied correctly
   - Compare with original plan in `TODO.md`

---

## 📝 Completion Report

After all checks pass, document the results:

```
Deployment Date: [DATE]
Deployment Time: [TIME]
Deployed By: [NAME]

✅ All checks passed
✅ Server stable
✅ RAM usage: [X]%
✅ Uptime: [X] minutes
✅ No errors in logs
✅ API endpoints working

Status: SUCCESS ✅
```

---

**Remember**: The goal is 100% green checkmarks. Don't skip any checks!
