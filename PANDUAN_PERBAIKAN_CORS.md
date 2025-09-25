# 🔧 Panduan Perbaikan CORS dan WebSocket untuk guardiansofthetoken.id

## 🎯 Masalah yang Diperbaiki

1. **CORS Policy Error** - Website tidak bisa mengakses API backend
2. **WebSocket Connection Blocked** - CSP memblokir koneksi WebSocket
3. **API Endpoints Gagal** - Cross-origin requests ditolak

## 🚀 Cara Menerapkan Perbaikan

### Opsi 1: Menggunakan SSH (Rekomendasi)

```bash
# 1. Akses Replit menggunakan SSH
ssh -i %HOMEPATH%/.ssh/replit -p 22 bb4178d3-c004-4cff-b3e0-e4d013c0e884@bb4178d3-c004-4cff-b3e0-e4d013c0e884-00-1n57odq2i0nbm.kirk.replit.dev

# 2. Masuk ke direktori project
cd /home/runner/api-crypto

# 3. Jalankan script perbaikan
chmod +x deploy-fix.sh
./deploy-fix.sh
```

### Opsi 2: Manual Copy-Paste

1. **Buka Replit Console**
2. **Backup file asli:**
   ```bash
   cp server/index.ts server/index_backup.ts
   ```

3. **Edit file server/index.ts** dan ganti dengan konten dari `server/index_fixed.ts`

4. **Restart aplikasi:**
   ```bash
   npm run dev
   ```

## 🔍 Perbaikan yang Diterapkan

### 1. CORS Configuration
```typescript
const allowedOrigins = [
  'https://guardiansofthetoken.id',     // ✅ Domain utama ditambahkan
  'https://www.guardiansofthetoken.id', // ✅ Subdomain www
  'https://*.replit.dev',               // ✅ Replit domains
  // ... origins lainnya
];
```

### 2. Content Security Policy (CSP)
```typescript
// SEBELUM (Bermasalah):
"default-src 'self' https: wss: 'unsafe-inline' 'unsafe-eval'"

// SESUDAH (Diperbaiki):
"connect-src 'self' https: wss: https://*.replit.dev wss://*.replit.dev https://guardiansofthetoken.id wss://guardiansofthetoken.id"
```

### 3. Cross-Origin Resource Policy
```typescript
// SEBELUM:
'Cross-Origin-Resource-Policy': 'same-site'

// SESUDAH:
'Cross-Origin-Resource-Policy': 'cross-origin'
```

## 🧪 Testing Perbaikan

### 1. Test CORS
```bash
curl -H "Origin: https://guardiansofthetoken.id" \
     https://bb4178d3-c004-4cff-b3e0-e4d013c0e884-00-1n57odq2i0nbm.kirk.replit.dev/api/cors-test
```

### 2. Test Health Check
```bash
curl https://bb4178d3-c004-4cff-b3e0-e4d013c0e884-00-1n57odq2i0nbm.kirk.replit.dev/health
```

### 3. Test WebSocket (dari browser console)
```javascript
const ws = new WebSocket('wss://bb4178d3-c004-4cff-b3e0-e4d013c0e884-00-1n57odq2i0nbm.kirk.replit.dev/ws');
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onerror = (error) => console.error('❌ WebSocket error:', error);
```

## 📊 Monitoring

### Cek Status API
- **Health**: https://bb4178d3-c004-4cff-b3e0-e4d013c0e884-00-1n57odq2i0nbm.kirk.replit.dev/health
- **Metrics**: https://bb4178d3-c004-4cff-b3e0-e4d013c0e884-00-1n57odq2i0nbm.kirk.replit.dev/api/metrics
- **CORS Test**: https://bb4178d3-c004-4cff-b3e0-e4d013c0e884-00-1n57odq2i0nbm.kirk.replit.dev/api/cors-test

### Log Monitoring
```bash
# Lihat log real-time
tail -f /tmp/replit.log

# Atau cek console Replit
```

## 🔄 Rollback (Jika Diperlukan)

Jika ada masalah, kembalikan ke versi asli:

```bash
# Restore backup
cp server/index_backup.ts server/index.ts

# Restart
npm run dev
```

## 📝 Catatan Penting

1. **Backup Otomatis**: Script akan membuat backup di `server/index_backup.ts`
2. **Zero Downtime**: Perbaikan diterapkan dengan restart minimal
3. **Debugging**: Endpoint `/api/cors-test` dan `/health` ditambahkan untuk monitoring
4. **Logging**: Origin yang ditolak akan dicatat di console untuk debugging

## 🎉 Hasil yang Diharapkan

Setelah perbaikan:
- ✅ Website https://guardiansofthetoken.id bisa mengakses API
- ✅ WebSocket connection berfungsi normal
- ✅ Tidak ada CORS errors di browser console
- ✅ Semua endpoint API dapat diakses dari frontend

## 🆘 Troubleshooting

### Jika masih ada CORS error:
1. Cek browser console untuk error detail
2. Verifikasi origin di `/api/cors-test`
3. Pastikan domain exact match di `allowedOrigins`

### Jika WebSocket masih terblokir:
1. Cek CSP di Network tab browser
2. Verifikasi wss:// protocol digunakan
3. Test dengan browser developer tools

### Jika API tidak merespons:
1. Cek `/health` endpoint
2. Verifikasi Replit container masih running
3. Restart manual: `npm run dev`
