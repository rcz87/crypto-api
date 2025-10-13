#!/bin/bash
# 🔧 MEMORY FIX STARTUP SCRIPT
# This sets NODE_OPTIONS and starts the server with GC enabled

export NODE_OPTIONS="--expose-gc --max-old-space-size=512"

echo "🚀 Starting server with memory optimizations:"
echo "   ✅ GC enabled (--expose-gc)"
echo "   ✅ Heap size: 512MB (--max-old-space-size=512)"
echo ""

# Run development server
NODE_ENV=development tsx server/index.ts
