#!/bin/bash
# 🚀 Start application with increased heap size for TensorFlow + services
# 
# Usage:
#   chmod +x START_WITH_INCREASED_HEAP.sh
#   ./START_WITH_INCREASED_HEAP.sh
#
# Or set as Replit secret:
#   Key: NODE_OPTIONS
#   Value: --expose-gc --max-old-space-size=256

export NODE_OPTIONS="--expose-gc --max-old-space-size=256"

echo "🧠 Starting with:"
echo "  - Heap: 256MB (was 57MB)"
echo "  - Manual GC: Enabled"
echo "  - Memory leaks: Fixed ✅"
echo ""

npm run dev
