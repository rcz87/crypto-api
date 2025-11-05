# 🔧 Fix RAM Crash & Server Error - Complete Documentation

## 📋 Executive Summary

**Problem**: Server crashes dengan RAM spike ke 94% disebabkan oleh 2 error kritis:
1. `(void 0) is not a function` - Vite dev code terbundle ke production
2. `ReferenceError: require is not defined` + `Dynamic require of "path"` - ESM/CJS module conflict

**Solution**: Convert build output dari `.js` ke `.cjs` dan enforce CommonJS mode di package.json

**Status**: ✅ **IMPLEMENTED** - Ready for deployment

---

## 🚨 Error Analysis

### Error 1: `(void 0) is not a function`
**Cause**: Vite development code ikut terbundle ke server production
**Impact**: Server crash saat startup
**Fix**: Sudah di-external di esbuild config, output ke `.cjs` memastikan tidak ada ESM code

### Error 2: `require is not defined` + `Dynamic require of "path"`
**Cause**: 
- File di-build jadi `.js` (ambiguous format)
- `"type": "module"` di package.json memaksa ESM mode
- Server code di-compile ke CJS tapi Node.js baca sebagai ESM
- Bentrok: Express, body-parser, path, fs tidak bisa load

**Impact**: 
- Module loading error
- RAM spike ke 94%
- Server crash loop

**Fix**: 
- Output ke `.cjs` (explicit CommonJS)
- Change `"type": "module"` → `"type": "commonjs"`

---

## ✅ Changes Made

### 1. **esbuild.server.config.cjs**

**Before:**
```javascript
outdir: 'dist',  // Creates dist/index.js
```

**After:**
```javascript
outfile: 'dist/index.cjs',  // Creates single dist/index.cjs file
```

**Why**: 
- `.cjs` extension explicitly tells Node.js this is CommonJS
- Single file output is cleaner and faster to load
- No ambiguity about module format

---

### 2. **package.json**

**Before:**
```json
{
  "type": "module",
  "scripts": {
    "start": "NODE_ENV=production node dist/index.js"
  }
}
```

**After:**
```json
{
  "type": "commonjs",
  "scripts": {
    "start": "NODE_ENV=production node dist/index.cjs"
  }
}
```

**Why**:
- `"type": "commonjs"` ensures Node.js treats all `.js` files as CommonJS
- Start script updated to run `.cjs` file
- Prevents ESM/CJS conflict

---

### 3. **ecosystem.config.cjs**

**Before:**
```javascript
script: 'dist/index.js',
```

**After:**
```javascript
script: 'dist/index.cjs',
```

**Why**: PM2 needs to point to the correct file

---

## 🚀 Deployment Instructions

### Quick Deploy (Automated)

```bash
cd /root/crypto-api
./fix-ram-crash-deploy.sh
```

This script will:
1. ✅ Clean old build
2. ✅ Build with new CJS config
3. ✅ Deploy to `/var/www/sol-trading`
4. ✅ Restart PM2
5. ✅ Show logs for verification

---

### Manual Deploy (Step by Step)

#### Step 1: Build
```bash
cd /root/crypto-api
npm run build
```

**Verify**: Check that `dist/index.cjs` exists
```bash
ls -lh dist/index.cjs
```

#### Step 2: Deploy Files
```bash
# Backup old deployment
sudo cp -r /var/www/sol-trading/dist /var/www/sol-trading/dist.backup.$(date +%Y%m%d_%H%M%S)

# Deploy new files
sudo cp dist/index.cjs /var/www/sol-trading/dist/
sudo cp .env /var/www/sol-trading/
sudo cp package.json /var/www/sol-trading/
sudo cp ecosystem.config.cjs /var/www/sol-trading/
```

#### Step 3: Update Production package.json (if needed)
```bash
cd /var/www/sol-trading

# Check if package.json has "type": "module"
grep '"type"' package.json

# If it shows "module", it's already updated from our copy
# If not, manually edit:
sudo nano package.json
# Change "type": "module" to "type": "commonjs"
```

#### Step 4: Restart PM2
```bash
cd /var/www/sol-trading
sudo pm2 stop sol-trading-platform
sudo pm2 delete sol-trading-platform
sudo pm2 start ecosystem.config.cjs
sudo pm2 save
```

#### Step 5: Verify
```bash
# Check logs
sudo pm2 logs sol-trading-platform --lines 30

# Check status
sudo pm2 status

# Monitor RAM usage
htop
```

---

## ✅ Verification Checklist

After deployment, verify these points:

### 1. **No Module Errors**
```bash
sudo pm2 logs sol-trading-platform --lines 50 | grep -i error
```

**Expected**: No errors related to:
- ❌ `(void 0) is not a function`
- ❌ `require is not defined`
- ❌ `Dynamic require of "path"`
- ❌ `Cannot find module`

### 2. **Server Started Successfully**
```bash
sudo pm2 status
```

**Expected**:
- Status: `online`
- Uptime: > 1 minute without restart
- Restarts: 0 (or very low)

### 3. **RAM Usage Normal**
```bash
free -h
htop
```

**Expected**:
- RAM usage: < 50% (not 94%)
- No memory leak
- Stable over time

### 4. **API Endpoints Working**
```bash
curl http://localhost:8080/health
curl http://localhost:8080/api/status
```

**Expected**: 
- HTTP 200 responses
- Valid JSON responses

---

## 🔍 Troubleshooting

### Issue: Build fails with "Cannot find module"

**Solution**:
```bash
npm install
npm run build
```

### Issue: PM2 shows "errored" status

**Check logs**:
```bash
sudo pm2 logs sol-trading-platform --lines 100
```

**Common fixes**:
1. Check if `.env` file exists in `/var/www/sol-trading`
2. Check if `node_modules` exists
3. Verify file permissions

### Issue: Still getting "require is not defined"

**Verify package.json**:
```bash
cat /var/www/sol-trading/package.json | grep type
```

Should show: `"type": "commonjs"`

If not:
```bash
cd /var/www/sol-trading
sudo nano package.json
# Change "type": "module" to "type": "commonjs"
sudo pm2 restart sol-trading-platform
```

### Issue: RAM still high

**Check for memory leaks**:
```bash
# Monitor over time
watch -n 5 'free -h && echo "---" && pm2 status'
```

**If RAM keeps growing**:
1. Check for WebSocket connection leaks
2. Check for unclosed database connections
3. Review event listeners

---

## 📊 Technical Details

### Why `.cjs` Extension?

Node.js determines module format in this order:
1. File extension (`.cjs` = CommonJS, `.mjs` = ESM)
2. `"type"` field in nearest package.json
3. Default (CommonJS)

By using `.cjs`:
- ✅ Explicit CommonJS, no ambiguity
- ✅ Works regardless of package.json `"type"` field
- ✅ Node.js knows exactly how to load it

### Why Change `"type": "module"` to `"type": "commonjs"`?

The `"type": "module"` field:
- Forces all `.js` files to be treated as ESM
- Requires `import/export` syntax
- Breaks `require()` calls

Our server uses:
- Express (CommonJS)
- Many npm packages that use `require()`
- Node.js built-ins with `require()`

Solution: Use `"type": "commonjs"` to ensure compatibility

### Build Output Comparison

**Before (with `outdir`):**
```
dist/
├── index.js          (main bundle)
├── chunk-ABC123.js   (code splitting)
└── chunk-DEF456.js   (more chunks)
```

**After (with `outfile`):**
```
dist/
└── index.cjs         (single file, all bundled)
```

Benefits:
- ✅ Faster startup (one file to load)
- ✅ No chunk loading overhead
- ✅ Clearer deployment
- ✅ Explicit CommonJS format

---

## 🎯 Expected Results

After successful deployment:

| Metric | Before | After |
|--------|--------|-------|
| **Startup Errors** | 2 critical errors | ✅ 0 errors |
| **RAM Usage** | 94% (crash) | < 50% (stable) |
| **Server Uptime** | Crashes every few seconds | ✅ Stable |
| **Module Loading** | Fails with require errors | ✅ Success |
| **API Response** | 502/503 errors | ✅ 200 OK |

---

## 📝 Files Modified

1. ✅ `/root/crypto-api/esbuild.server.config.cjs`
2. ✅ `/root/crypto-api/package.json`
3. ✅ `/root/crypto-api/ecosystem.config.cjs`

**New Files Created:**
1. ✅ `/root/crypto-api/TODO.md` - Progress tracking
2. ✅ `/root/crypto-api/fix-ram-crash-deploy.sh` - Automated deployment
3. ✅ `/root/crypto-api/FIX_RAM_CRASH_DOCUMENTATION.md` - This file

---

## 🔄 Rollback Plan

If something goes wrong:

```bash
# Stop current process
sudo pm2 stop sol-trading-platform

# Restore backup
sudo rm -rf /var/www/sol-trading/dist
sudo mv /var/www/sol-trading/dist.backup.YYYYMMDD_HHMMSS /var/www/sol-trading/dist

# Restore old config
cd /root/crypto-api
git checkout esbuild.server.config.cjs package.json ecosystem.config.cjs

# Rebuild old version
npm run build

# Restart
sudo pm2 restart sol-trading-platform
```

---

## 📞 Support

If issues persist after deployment:

1. **Check logs**: `sudo pm2 logs sol-trading-platform --lines 100`
2. **Check system resources**: `htop` or `free -h`
3. **Verify file exists**: `ls -lh /var/www/sol-trading/dist/index.cjs`
4. **Check Node.js version**: `node --version` (should be v20+)
5. **Review this documentation** for troubleshooting steps

---

## ✅ Conclusion

This fix resolves the critical ESM/CJS module conflict that was causing:
- Server crashes
- RAM spikes to 94%
- Module loading errors

By explicitly using `.cjs` extension and `"type": "commonjs"`, we ensure:
- ✅ No ambiguity in module format
- ✅ Full CommonJS compatibility
- ✅ Stable server operation
- ✅ Normal RAM usage

**Status**: Ready for production deployment

**Next Step**: Run `./fix-ram-crash-deploy.sh` to deploy the fix
