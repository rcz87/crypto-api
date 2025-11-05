#!/bin/bash
# Production startup script - Start both Node.js and Python services

echo "🚀 Starting production services..."

# Start Python service in background
echo "🐍 Starting Python service on port 8000..."
cd coinglass-system
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1 --timeout-keep-alive 75 &
PYTHON_PID=$!
cd ..

# Wait for Python service to be ready
echo "⏳ Waiting for Python service..."
sleep 5

# Start Node.js service (foreground)
echo "🟢 Starting Node.js service on port 5000..."
NODE_ENV=production node dist/index.js

# If Node.js exits, kill Python service
kill $PYTHON_PID 2>/dev/null
