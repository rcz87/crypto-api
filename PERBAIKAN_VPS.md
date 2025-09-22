# 🔧 Perbaikan CORS dan WebSocket di VPS untuk guardiansofthetoken.id

## 🎯 Situasi Saat Ini
- Website: https://guardiansofthetoken.id (Frontend)
- Backend API: Di VPS Anda sendiri
- Masalah: CORS errors, WebSocket terblokir

## 🚀 Langkah Perbaikan di VPS

### 1. Akses VPS Anda
```bash
# SSH ke VPS Anda
ssh root@your-vps-ip
# atau
ssh user@your-domain.com
```

### 2. Masuk ke Direktori Project
```bash
cd /path/to/your/api-crypto-project
# Biasanya di:
# /var/www/api-crypto
# /home/user/api-crypto
# /opt/api-crypto
```

### 3. Backup File Asli
```bash
# Backup file server utama
cp server/index.ts server/index_backup_$(date +%Y%m%d_%H%M%S).ts

# Atau jika menggunakan JavaScript
cp server/index.js server/index_backup_$(date +%Y%m%d_%H%M%S).js
```

### 4. Edit File Server
```bash
# Edit dengan nano/vim
nano server/index.ts
# atau
vim server/index.ts
```

### 5. Terapkan Perbaikan CORS

Ganti bagian CORS configuration dengan:

```typescript
// PERBAIKAN CORS - Tambahkan domain yang hilang
const allowedOrigins = [
  'http://localhost:5000',
  'https://localhost:5000',
  'https://guardiansofthetoken.id',     // ✅ Domain utama
  'https://www.guardiansofthetoken.id', // ✅ Subdomain www
  'http://guardiansofthetoken.id',      // ✅ HTTP version (jika ada)
  'https://your-vps-domain.com',        // ✅ Ganti dengan domain VPS Anda
  'https://your-vps-ip',                // ✅ Ganti dengan IP VPS Anda
];

// Enhanced CORS middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  if (origin && (allowedOrigins.includes(origin) || 
      origin.includes('guardiansofthetoken.id'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Allow requests without origin (direct API calls)
    res.header('Access-Control-Allow-Origin', '*');
  } else {
    // Log rejected origins for debugging
    console.log(`CORS: Origin ditolak: ${origin}`);
    // Sementara izinkan untuk debugging
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, X-API-Key');
  res.header('Access-Control-Expose-Headers', 'Content-Length, X-JSON');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});
```

### 6. Perbaiki Content Security Policy

Ganti bagian CSP dengan:

```typescript
// Security headers dengan CSP yang mendukung WebSocket
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  
  // CSP yang mendukung WebSocket
  res.setHeader('Content-Security-Policy', 
    "default-src 'self' https: wss: 'unsafe-inline' 'unsafe-eval'; " +
    "connect-src 'self' https: wss: https://guardiansofthetoken.id wss://guardiansofthetoken.id https://your-vps-domain.com wss://your-vps-domain.com; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; " +
    "style-src 'self' 'unsafe-inline' https:; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' https: data:; " +
    "frame-src 'self' https:;"
  );
  
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

### 7. Tambahkan Endpoint Debug

Tambahkan endpoint untuk testing:

```typescript
// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    websocket: 'supported',
    origin: req.headers.origin || 'no-origin',
    server: 'vps'
  });
});

// CORS test endpoint
app.get('/api/cors-test', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'CORS working correctly on VPS',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    server: 'vps'
  });
});
```

### 8. Restart Aplikasi di VPS

```bash
# Jika menggunakan PM2
pm2 restart api-crypto
pm2 logs api-crypto

# Jika menggunakan systemd
sudo systemctl restart api-crypto
sudo systemctl status api-crypto

# Jika menggunakan Docker
docker restart api-crypto-container
docker logs api-crypto-container

# Jika manual dengan npm/node
pkill -f "node server"
npm run start
# atau
node server/index.js
```

### 9. Cek Nginx/Apache (Jika Ada)

Jika menggunakan reverse proxy, pastikan konfigurasi mendukung CORS:

#### Nginx Configuration:
```nginx
server {
    listen 80;
    server_name guardiansofthetoken.id www.guardiansofthetoken.id;
    
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # CORS headers
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization' always;
        
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE';
            add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Restart Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

## 🧪 Testing Perbaikan

### 1. Test dari VPS
```bash
# Test health
curl http://localhost:5000/health

# Test CORS
curl -H "Origin: https://guardiansofthetoken.id" http://localhost:5000/api/cors-test
```

### 2. Test dari Browser
Buka browser dan test di console:

```javascript
// Test API call
fetch('https://guardiansofthetoken.id/api/cors-test')
  .then(response => response.json())
  .then(data => console.log('✅ API working:', data))
  .catch(error => console.error('❌ API error:', error));

// Test WebSocket
const ws = new WebSocket('wss://guardiansofthetoken.id/ws');
ws.onopen = () => console.log('✅ WebSocket connected');
ws.onerror = (error) => console.error('❌ WebSocket error:', error);
```

## 📊 Monitoring

### Cek Log Aplikasi
```bash
# PM2 logs
pm2 logs api-crypto --lines 100

# Systemd logs
sudo journalctl -u api-crypto -f

# Docker logs
docker logs -f api-crypto-container

# File logs (jika ada)
tail -f /var/log/api-crypto/app.log
```

### Cek Status Server
```bash
# Cek port yang digunakan
netstat -tlnp | grep :5000

# Cek proses yang berjalan
ps aux | grep node

# Cek resource usage
htop
```

## 🔄 Rollback (Jika Diperlukan)

```bash
# Restore backup
cp server/index_backup_YYYYMMDD_HHMMSS.ts server/index.ts

# Restart aplikasi
pm2 restart api-crypto
```

## 📝 Catatan Penting

1. **Ganti Placeholder**: Ubah `your-vps-domain.com` dan `your-vps-ip` dengan nilai sebenarnya
2. **SSL Certificate**: Pastikan HTTPS sudah dikonfigurasi dengan benar
3. **Firewall**: Pastikan port 5000 (atau port yang digunakan) terbuka
4. **Domain DNS**: Pastikan DNS mengarah ke VPS yang benar

## 🆘 Troubleshooting

### Jika masih ada CORS error:
1. Cek log aplikasi untuk error detail
2. Pastikan domain exact match di allowedOrigins
3. Cek konfigurasi Nginx/Apache

### Jika WebSocket masih terblokir:
1. Pastikan wss:// digunakan (bukan ws://)
2. Cek SSL certificate untuk WebSocket
3. Verifikasi proxy configuration

### Jika API tidak merespons:
1. Cek apakah aplikasi berjalan: `pm2 status`
2. Cek port binding: `netstat -tlnp | grep :5000`
3. Cek firewall: `ufw status` atau `iptables -L`
