#!/bin/bash
# 🔧 MEMORY FIX STARTUP SCRIPT
# Uses NODE_OPTIONS to pass memory flags (guaranteed to work with tsx)

# Set NODE_OPTIONS for all child processes
export NODE_OPTIONS="--expose-gc --max-old-space-size=512"

echo "🚀 Starting server with memory optimizations:"
echo "   ✅ GC enabled (--expose-gc)"
echo "   ✅ Heap size: 512MB (--max-old-space-size=512)"
echo "   ✅ Using tsx with NODE_OPTIONS"
echo ""

# Run development server - tsx will inherit NODE_OPTIONS
NODE_ENV=development tsx server/index.ts
