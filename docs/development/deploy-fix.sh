#!/bin/bash

echo "🔧 Menerapkan perbaikan CORS dan WebSocket untuk guardiansofthetoken.id"

# Backup file asli
echo "📦 Backup file asli..."
cp server/index.ts server/index_backup.ts

# Terapkan perbaikan
echo "🚀 Menerapkan perbaikan..."
cp server/index_fixed.ts server/index.ts

# Restart aplikasi di Replit
echo "🔄 Restart aplikasi..."
pkill -f "npm run dev" || true
sleep 2

# Start aplikasi dengan perbaikan
echo "▶️ Memulai aplikasi dengan perbaikan..."
npm run dev &

echo "✅ Perbaikan berhasil diterapkan!"
echo ""
echo "🌐 Website: https://guardiansofthetoken.id"
echo "🔗 API: https://bb4178d3-c004-4cff-b3e0-e4d013c0e884-00-1n57odq2i0nbm.kirk.replit.dev"
echo "🧪 Test CORS: https://bb4178d3-c004-4cff-b3e0-e4d013c0e884-00-1n57odq2i0nbm.kirk.replit.dev/api/cors-test"
echo ""
echo "📋 Perbaikan yang diterapkan:"
echo "   ✓ CORS dikonfigurasi untuk guardiansofthetoken.id"
echo "   ✓ WebSocket CSP diperbaiki"
echo "   ✓ Cross-Origin-Resource-Policy diubah ke cross-origin"
echo "   ✓ Endpoint debugging ditambahkan"
echo ""
echo "🔧 Untuk mengembalikan ke versi asli:"
echo "   cp server/index_backup.ts server/index.ts"
