#!/bin/bash
# 🔧 MEMORY FIX STARTUP SCRIPT
# Uses NODE_OPTIONS to ensure memory flags are respected

# Set NODE_OPTIONS for all child processes
export NODE_OPTIONS="--expose-gc --max-old-space-size=256"

echo "🚀 Starting server with memory optimizations:"
echo "   ✅ GC enabled (--expose-gc)"
echo "   ✅ Heap size: 256MB (reduced from 512MB for Replit limits)"
echo "   ✅ Using NODE_OPTIONS (guaranteed to work)"
echo ""

# Verify NODE_OPTIONS is set
echo "NODE_OPTIONS: $NODE_OPTIONS"
echo ""

# Run development server - tsx will inherit NODE_OPTIONS
NODE_ENV=development tsx server/index.ts
