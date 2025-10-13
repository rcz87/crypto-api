#!/bin/bash
# Memory-Optimized Build Script for Deployment
# Prevents heap limit errors during Vite build process

set -e  # Exit on error

echo "🚀 Starting memory-optimized build process..."
echo ""

# Set NODE_OPTIONS for build process
export NODE_OPTIONS="--max-old-space-size=512 --expose-gc"

echo "📊 Memory allocation:"
echo "  - Heap size: 512MB (for build process)"
echo "  - Manual GC: Enabled"
echo ""

# Show current memory
echo "💾 Current system memory:"
free -h 2>/dev/null || echo "  (memory info not available)"
echo ""

# Run Vite build with increased memory
echo "⚙️  Step 1/2: Building frontend (Vite)..."
NODE_OPTIONS="--max-old-space-size=512" npm run build:client || {
  echo "❌ Vite build failed"
  exit 1
}

echo "✅ Frontend build complete"
echo ""

# Build server bundle
echo "⚙️  Step 2/2: Building server (esbuild)..."
NODE_OPTIONS="--max-old-space-size=512" npm run build:server || {
  echo "❌ Server build failed"
  exit 1
}

echo "✅ Server build complete"
echo ""

echo "🎉 Build process completed successfully!"
echo "📦 Output:"
echo "  - Frontend: dist/public/"
echo "  - Server: dist/index.js"
