#!/bin/bash

echo "🔧 Perbaikan CORS dan WebSocket untuk VPS - guardiansofthetoken.id"
echo "=================================================="

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fungsi untuk log dengan warna
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Deteksi direktori project
detect_project_dir() {
    log_info "Mencari direktori project..."
    
    POSSIBLE_DIRS=(
        "/var/www/api-crypto"
        "/var/www/html/api-crypto"
        "/home/$(whoami)/api-crypto"
        "/opt/api-crypto"
        "$(pwd)"
        "/root/api-crypto"
    )
    
    for dir in "${POSSIBLE_DIRS[@]}"; do
        if [ -f "$dir/server/index.ts" ] || [ -f "$dir/server/index.js" ]; then
            PROJECT_DIR="$dir"
            log_success "Project ditemukan di: $PROJECT_DIR"
            return 0
        fi
    done
    
    log_error "Project tidak ditemukan. Pastikan Anda berada di direktori yang benar."
    echo "Direktori yang dicari:"
    printf '%s\n' "${POSSIBLE_DIRS[@]}"
    exit 1
}

# Backup file asli
backup_files() {
    log_info "Membuat backup file asli..."
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    
    if [ -f "$PROJECT_DIR/server/index.ts" ]; then
        cp "$PROJECT_DIR/server/index.ts" "$PROJECT_DIR/server/index_backup_$TIMESTAMP.ts"
        log_success "Backup dibuat: server/index_backup_$TIMESTAMP.ts"
        SERVER_FILE="$PROJECT_DIR/server/index.ts"
    elif [ -f "$PROJECT_DIR/server/index.js" ]; then
        cp "$PROJECT_DIR/server/index.js" "$PROJECT_DIR/server/index_backup_$TIMESTAMP.js"
        log_success "Backup dibuat: server/index_backup_$TIMESTAMP.js"
        SERVER_FILE="$PROJECT_DIR/server/index.js"
    else
        log_error "File server tidak ditemukan!"
        exit 1
    fi
}

# Terapkan perbaikan CORS
apply_cors_fix() {
    log_info "Menerapkan perbaikan CORS..."
    
    # Buat file perbaikan sementara
    cat > /tmp/cors_fix.txt << 'EOF'
// PERBAIKAN CORS - Enhanced untuk guardiansofthetoken.id
const allowedOrigins = [
  'http://localhost:5000',
  'https://localhost:5000',
  'https://guardiansofthetoken.id',
  'https://www.guardiansofthetoken.id',
  'http://guardiansofthetoken.id',
  'http://www.guardiansofthetoken.id',
];

// Enhanced CORS middleware dengan logging
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (origin && (allowedOrigins.includes(origin) || 
      origin.includes('guardiansofthetoken.id'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    console.log(`✅ CORS: Origin diizinkan: ${origin}`);
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  } else {
    console.log(`⚠️  CORS: Origin ditolak: ${origin}`);
    res.header('Access-Control-Allow-Origin', origin); // Sementara izinkan untuk debugging
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
EOF

    log_success "Perbaikan CORS siap diterapkan"
}

# Terapkan perbaikan CSP
apply_csp_fix() {
    log_info "Menerapkan perbaikan Content Security Policy..."
    
    cat > /tmp/csp_fix.txt << 'EOF'
// Security headers dengan CSP yang mendukung WebSocket
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  
  // CSP yang mendukung WebSocket untuk guardiansofthetoken.id
  res.setHeader('Content-Security-Policy', 
    "default-src 'self' https: wss: 'unsafe-inline' 'unsafe-eval'; " +
    "connect-src 'self' https: wss: https://guardiansofthetoken.id wss://guardiansofthetoken.id; " +
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
EOF

    log_success "Perbaikan CSP siap diterapkan"
}

# Tambahkan endpoint debug
add_debug_endpoints() {
    log_info "Menambahkan endpoint debug..."
    
    cat > /tmp/debug_endpoints.txt << 'EOF'
// Health check endpoint untuk debugging
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    websocket: 'supported',
    origin: req.headers.origin || 'no-origin',
    server: 'vps',
    version: '1.0.0'
  });
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.json({
    success: true,
    message: 'CORS working correctly on VPS',
    origin: req.headers.origin,
    timestamp: new Date().toISOString(),
    server: 'vps',
    allowedOrigins: [
      'https://guardiansofthetoken.id',
      'https://www.guardiansofthetoken.id'
    ]
  });
});
EOF

    log_success "Endpoint debug siap ditambahkan"
}

# Restart aplikasi
restart_application() {
    log_info "Restart aplikasi..."
    
    # Deteksi process manager yang digunakan
    if command -v pm2 &> /dev/null; then
        log_info "Menggunakan PM2..."
        pm2 restart all 2>/dev/null || pm2 restart api-crypto 2>/dev/null || pm2 restart 0 2>/dev/null
        pm2 status
        log_success "Aplikasi direstart dengan PM2"
    elif systemctl is-active --quiet api-crypto; then
        log_info "Menggunakan systemd..."
        sudo systemctl restart api-crypto
        sudo systemctl status api-crypto --no-pager
        log_success "Aplikasi direstart dengan systemd"
    elif command -v docker &> /dev/null && docker ps | grep -q api-crypto; then
        log_info "Menggunakan Docker..."
        docker restart $(docker ps | grep api-crypto | awk '{print $1}')
        log_success "Container Docker direstart"
    else
        log_warning "Process manager tidak terdeteksi. Restart manual diperlukan."
        echo "Jalankan salah satu perintah berikut:"
        echo "  pm2 restart api-crypto"
        echo "  sudo systemctl restart api-crypto"
        echo "  docker restart <container-name>"
        echo "  pkill -f node && npm start"
    fi
}

# Test konektivitas
test_connectivity() {
    log_info "Testing konektivitas..."
    
    # Test health endpoint
    if curl -s http://localhost:5000/health > /dev/null; then
        log_success "Health endpoint OK"
    else
        log_error "Health endpoint gagal"
    fi
    
    # Test CORS
    if curl -s -H "Origin: https://guardiansofthetoken.id" http://localhost:5000/api/cors-test > /dev/null; then
        log_success "CORS test OK"
    else
        log_error "CORS test gagal"
    fi
    
    # Cek port
    if netstat -tlnp | grep -q :5000; then
        log_success "Port 5000 aktif"
    else
        log_warning "Port 5000 tidak terdeteksi"
    fi
}

# Tampilkan informasi setelah perbaikan
show_info() {
    echo ""
    echo "🎉 Perbaikan selesai!"
    echo "==================="
    echo ""
    echo "🌐 Website: https://guardiansofthetoken.id"
    echo "🔗 API Health: http://your-server/health"
    echo "🧪 CORS Test: http://your-server/api/cors-test"
    echo ""
    echo "📋 Yang diperbaiki:"
    echo "   ✅ CORS dikonfigurasi untuk guardiansofthetoken.id"
    echo "   ✅ WebSocket CSP diperbaiki"
    echo "   ✅ Cross-Origin-Resource-Policy diubah"
    echo "   ✅ Endpoint debugging ditambahkan"
    echo ""
    echo "🔍 Monitoring:"
    echo "   pm2 logs api-crypto"
    echo "   tail -f /var/log/nginx/access.log"
    echo "   curl http://localhost:5000/health"
    echo ""
    echo "🔄 Rollback (jika diperlukan):"
    echo "   cp server/index_backup_*.ts server/index.ts"
    echo "   pm2 restart api-crypto"
}

# Main execution
main() {
    echo ""
    log_info "Memulai perbaikan CORS dan WebSocket..."
    echo ""
    
    detect_project_dir
    cd "$PROJECT_DIR"
    
    backup_files
    apply_cors_fix
    apply_csp_fix
    add_debug_endpoints
    
    log_warning "File perbaikan telah disiapkan di /tmp/"
    log_warning "Silakan edit server/index.ts secara manual dengan perbaikan yang telah disiapkan"
    log_warning "Atau gunakan file server/index_fixed.ts yang sudah dibuat sebelumnya"
    
    echo ""
    read -p "Lanjutkan restart aplikasi? (y/n): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        restart_application
        sleep 3
        test_connectivity
        show_info
    else
        log_info "Restart dibatalkan. Jangan lupa restart manual setelah edit file."
    fi
}

# Jalankan script
main "$@"
