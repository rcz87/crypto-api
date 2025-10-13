#!/bin/bash
# 🔧 MEMORY FIX STARTUP SCRIPT - COMPILED VERSION
# Compiles TypeScript first, then runs with proper memory flags

echo "🚀 Memory Fix: Building TypeScript..."

# Build the server (compiles TS to JS)
npm run build 2>&1 | grep -E "(Built|error|Error)" || echo "Build complete"

echo ""
echo "🚀 Starting server with 512MB heap limit:"
echo "   ✅ GC enabled (--expose-gc)"
echo "   ✅ Heap size: 512MB (--max-old-space-size=512)"
echo "   ✅ Running compiled JS (flags WILL work)"
echo ""

# Run the compiled server with memory flags
NODE_ENV=development node \
  --expose-gc \
  --max-old-space-size=512 \
  dist/index.js
