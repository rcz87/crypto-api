# 🚀 Fix Deployment Memory Error - Step by Step

## ❌ Error Yang Terjadi:
```
Build process ran out of memory during vite build step with heap limit error at 254MB
NODE_OPTIONS not configured with required memory flags (--max-old-space-size)
```

---

## ✅ SOLUTION - 3 Cara Fix Deployment:

### **Option 1: Via Replit Secrets (RECOMMENDED - PALING MUDAH)**

1. **Buka Replit Secrets**
   - Click ⚙️ icon di sidebar kiri
   - Pilih tab "Secrets"

2. **Add Build Memory Secret**
   - Click "New Secret"
   - **Key:** `NODE_OPTIONS`
   - **Value:** `--max-old-space-size=512`
   - Click "Add Secret"

3. **Deploy Ulang**
   - Click "Deploy" button lagi
   - Vite build sekarang punya 512MB heap (bukan 254MB)

**Why this works:** Replit deployment automatically uses secrets as environment variables, termasuk untuk build process!

---

### **Option 2: Via Deployment Settings UI**

1. **Open Deployment Settings**
   - Di Replit, click tab "Deployments"
   - Click "⚙️ Configure" pada active deployment

2. **Edit Build Command**
   - Di "Build Command" field, ganti dari:
     ```
     npm run build
     ```
   - Jadi:
     ```bash
     NODE_OPTIONS='--max-old-space-size=512' npm run build
     ```

3. **Edit Run Command** (untuk runtime)
   - Di "Run Command" field, ganti dari:
     ```
     npm start
     ```
   - Jadi:
     ```bash
     NODE_OPTIONS='--expose-gc --max-old-space-size=256' npm start
     ```

4. **Save & Redeploy**
   - Click "Save"
   - Click "Deploy" ulang

---

### **Option 3: Via .replit File (Manual Edit - Advanced)**

⚠️ **WARNING:** File ini protected by system, tapi jika Anda punya akses:

1. **Edit .replit file**, tambahkan:

```toml
[deployment]
build = ["sh", "-c", "NODE_OPTIONS='--max-old-space-size=512' npm run build"]
run = ["sh", "-c", "NODE_OPTIONS='--expose-gc --max-old-space-size=256' npm start"]
```

2. **Save dan deploy ulang**

---

## 🔍 Verification - Cek Apakah Sudah Fix:

### **Test Build Locally (Optional):**

```bash
# Test build dengan increased memory
NODE_OPTIONS='--max-old-space-size=512' npm run build
```

**Expected:** Build success tanpa "heap out of memory" error!

### **After Deployment Success:**

```bash
# Check runtime memory
curl https://YOUR-REPL-URL.replit.dev/api/debug/memory
```

**Expected response:**
```json
{
  "heap": {
    "total": "201.45 MB",  // Runtime heap (256MB allocated)
    "used": "~85 MB",
    "percent": "~40%"
  }
}
```

---

## 📊 Memory Allocation Summary:

| Process | Before Fix | After Fix | Purpose |
|---------|-----------|-----------|---------|
| **Vite Build** | 254MB (default) | **512MB** | Compile frontend without OOM |
| **Runtime** | 57MB | **256MB** | Run app with TensorFlow + services |

---

## 🎯 Quick Fix Steps (FASTEST WAY):

**30 SECONDS FIX:**

1. ⚙️ Buka Replit Settings → Secrets
2. ➕ Add secret: `NODE_OPTIONS` = `--max-old-space-size=512`
3. 🚀 Deploy ulang
4. ✅ Done!

---

## ❓ Troubleshooting:

### Problem: Build masih OOM setelah set secret

**Solution:**
- Restart Repl sepenuhnya (Stop → Run)
- Verify secret dengan: `echo $NODE_OPTIONS` di Shell
- Deploy ulang dengan fresh build

### Problem: Deployment settings tidak ada

**Solution:**
- Gunakan Option 1 (Secrets) - always works!
- Atau edit build script manual (lihat build.sh file)

### Problem: Runtime masih low memory

**Solution:**
- Set 2 secrets terpisah (akan explain di bawah)

---

## 🔧 Advanced: Separate Build vs Runtime Memory

Jika Option 1 tidak cukup, set 2 environment variables terpisah:

**Via Replit Secrets:**

1. **BUILD_NODE_OPTIONS** = `--max-old-space-size=512`
2. **RUN_NODE_OPTIONS** = `--expose-gc --max-old-space-size=256`

**Update package.json scripts** (need permission):
```json
{
  "scripts": {
    "build": "NODE_OPTIONS=$BUILD_NODE_OPTIONS vite build && ...",
    "start": "NODE_OPTIONS=$RUN_NODE_OPTIONS node dist/index.js"
  }
}
```

---

## ✅ Files Created untuk Anda:

1. **`.npmrc`** - NPM config dengan node-options
2. **`build.sh`** - Memory-optimized build script (manual execution)
3. **`DEPLOYMENT_FIX.md`** - Guide ini

---

## 🚀 RECOMMENDED DEPLOYMENT FLOW:

```bash
# 1. Set secret via Replit UI
NODE_OPTIONS = --max-old-space-size=512

# 2. Deploy ulang
# Build process automatically uses 512MB

# 3. Runtime uses separate memory config
# (dari NODE_OPTIONS secret yang sudah ada)

# 4. Verify
curl YOUR-URL/api/debug/memory
```

---

## 📝 Summary:

**ROOT CAUSE:** Vite build process hitting 254MB default heap limit

**FIX:** Increase NODE_OPTIONS to 512MB for build, 256MB for runtime

**FASTEST WAY:** Option 1 - Set via Replit Secrets (30 seconds!)

**STATUS:** Ready to deploy setelah follow Option 1! 🎉
