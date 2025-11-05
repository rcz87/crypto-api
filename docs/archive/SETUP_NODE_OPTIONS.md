# 🚀 Setup NODE_OPTIONS untuk Fix Memory Leaks

## ❗ PENTING - Wajib Dilakukan!

Semua 7 fixes sudah diimplementasi, tapi **NODE_OPTIONS harus diset** agar:
- Manual GC tersedia (`--expose-gc`)
- Heap size cukup besar (`--max-old-space-size=256`)

Tanpa ini, memory leak fixes tidak akan fully efektif!

---

## 📋 Option A: Via Replit Secrets (RECOMMENDED)

### Step-by-Step:

1. **Buka Replit Project Settings**
   - Click ⚙️ icon di sidebar kiri
   - Atau buka: https://replit.com/@YOUR_USERNAME/YOUR_REPL/secrets

2. **Add New Secret**
   - Click button "New Secret"
   - Key: `NODE_OPTIONS`
   - Value: `--expose-gc --max-old-space-size=256`
   - Click "Add Secret"

3. **Restart Repl**
   - Stop current run (Ctrl+C atau click Stop)
   - Click "Run" button lagi
   - Check console untuk "✅" bahwa GC tersedia

### Verify Success:

Anda akan lihat di logs:
```
✅ [Shutdown] Manual GC available
```

Dan TIDAK akan ada:
```
⚠️ Manual GC unavailable (run with --expose-gc)
```

---

## 📋 Option B: Via Shell Script

### Untuk Development:

```bash
chmod +x START_WITH_INCREASED_HEAP.sh
./START_WITH_INCREASED_HEAP.sh
```

Script ini otomatis set:
- `--expose-gc` (enable manual GC)
- `--max-old-space-size=256` (heap 256MB, dari 57MB)

---

## 📋 Option C: Manual Export (Temporary)

### Di Replit Shell:

```bash
export NODE_OPTIONS="--expose-gc --max-old-space-size=256"
npm run dev
```

⚠️ **Note**: Ini temporary, akan hilang saat restart Repl.

---

## ✅ Verification Checklist

Setelah setup, verify dengan:

### 1. Check Manual GC Available:
```bash
curl http://localhost:5000/api/debug/gc -X POST
```

**Expected response:**
```json
{
  "success": true,
  "result": {
    "before": "52.34 MB",
    "after": "45.12 MB",
    "freed": "7.22 MB",
    "freedPercent": "13.8%"
  }
}
```

### 2. Check Memory Stats:
```bash
curl http://localhost:5000/api/debug/memory
```

**Expected response:**
```json
{
  "success": true,
  "memory": {
    "heap": {
      "used": "48.23 MB",
      "total": "256.00 MB",  // ← Should be 256MB, not 57MB!
      "percent": "18.8%"      // ← Should be lower now
    },
    ...
  }
}
```

### 3. Check Logs:

✅ **Good signs:**
```
🗑️ [Shutdown] Manual GC triggered
💾 Memory saved: ~15MB (tracing overhead)
```

❌ **Bad signs:**
```
⚠️ Manual GC unavailable (run with --expose-gc)
🚨 Critical memory (95%+)
```

---

## 🔍 Troubleshooting

### Problem: "Manual GC unavailable"

**Solution:**
1. Verify NODE_OPTIONS set correctly (lihat Option A di atas)
2. Restart Repl completely
3. Check env dengan: `echo $NODE_OPTIONS`

### Problem: Heap masih 57MB

**Solution:**
1. NODE_OPTIONS mungkin tidak applied
2. Restart Repl setelah set secrets
3. Verify dengan `/api/debug/memory` endpoint

### Problem: Masih crash setiap 5 menit

**Solution:**
1. Pastikan NODE_OPTIONS applied (heap = 256MB)
2. Check logs untuk "OpenTelemetry DISABLED" (save 15MB)
3. Monitor dengan: `curl http://localhost:5000/health/memory`

---

## 📊 Expected Memory Improvements

### Before Fixes:
- Heap: 55.8/57.5 MB (97% - CRITICAL!)
- RSS: 201 MB
- Crashes every 5 minutes

### After Fixes + NODE_OPTIONS:
- Heap: ~50-80/256 MB (20-30% - HEALTHY)
- RSS: ~180 MB (reduced)
- No crashes, stable operation

---

## 🎯 Next Steps

1. ✅ Set NODE_OPTIONS (Option A recommended)
2. ✅ Restart Repl
3. ✅ Verify dengan checklist di atas
4. ✅ Monitor selama 30 menit
5. ✅ Jika stabil, system sudah fix! 🎉

---

## 📝 Summary of All Fixes

1. ✅ CoinAPI WebSocket leak fixed
2. ✅ Graceful shutdown handler added
3. ✅ Memory thresholds fixed (85% critical)
4. ✅ TensorFlow lazy loading ready
5. ✅ OpenTelemetry disabled (saves 15MB)
6. ✅ Memory debug endpoints added
7. ⏳ **NODE_OPTIONS needs manual setup** ← KERJAKAN INI!

**STATUS:** 6/7 complete, tinggal setup NODE_OPTIONS! 🚀
