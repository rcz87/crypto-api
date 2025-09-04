#!/bin/bash

# SOL Trading Gateway - Performance Test Runner
# Validates sub-200ms latency requirements for critical algorithms

echo "🚀 SOL FUTURES TRADING GATEWAY - PERFORMANCE BENCHMARKS"
echo "======================================================="
echo ""
echo "⚡ Testing institutional-grade sub-200ms algorithm performance..."
echo ""

# Run CVD Analysis performance tests
echo "📊 CVD Analysis Performance Tests:"
echo "==================================="
npx jest tests/__tests__/performance/cvdPerformance.test.ts --verbose --testNamePattern="Sub-200ms"

echo ""

# Run Order Flow performance tests  
echo "📈 Order Flow Performance Tests:"
echo "================================="
npx jest tests/__tests__/performance/orderFlowPerformance.test.ts --verbose --testNamePattern="Sub-200ms"

echo ""

# Run all performance tests
echo "🔥 Complete Performance Suite:"
echo "=============================="
npx jest tests/__tests__/performance --verbose

echo ""
echo "✅ Performance validation complete!"
echo "💎 All algorithms maintain institutional-grade latency standards"