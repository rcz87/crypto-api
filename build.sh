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

# Run full build with increased memory
# Note: npm run build = vite build + esbuild server bundle (from package.json)
echo "⚙️  Running build (Vite + esbuild)..."
NODE_OPTIONS="--max-old-space-size=512" npm run build || {
  echo "❌ Build failed"
  exit 1
}

echo "✅ Build complete"
echo ""

echo "🎉 Build process completed successfully!"
echo "📦 Output:"
echo "  - Frontend: dist/public/"
echo "  - Server: dist/index.js"
