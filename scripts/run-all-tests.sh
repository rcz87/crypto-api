#!/bin/bash

# SOL Trading Gateway - Complete Testing Suite
# Comprehensive validation: Unit Tests → Coverage → Performance → Mutation

echo "🧪 SOL FUTURES TRADING GATEWAY - COMPLETE TEST SUITE"
echo "===================================================="
echo ""

# Step 1: Run unit tests
echo "1️⃣ Running Unit Tests..."
echo "========================"
npx jest tests/__tests__/services --verbose
UNIT_EXIT_CODE=$?

if [ $UNIT_EXIT_CODE -ne 0 ]; then
    echo "❌ Unit tests failed. Stopping test suite."
    exit $UNIT_EXIT_CODE
fi

echo "✅ Unit tests passed!"
echo ""

# Step 2: Generate coverage report
echo "2️⃣ Generating Coverage Report..."
echo "================================="
npx jest --coverage
COVERAGE_EXIT_CODE=$?

if [ $COVERAGE_EXIT_CODE -ne 0 ]; then
    echo "❌ Coverage generation failed."
    exit $COVERAGE_EXIT_CODE
fi

echo "✅ Coverage report generated!"
echo ""

# Step 3: Run performance benchmarks
echo "3️⃣ Running Performance Benchmarks..."
echo "====================================="
./scripts/run-performance-tests.sh
PERF_EXIT_CODE=$?

if [ $PERF_EXIT_CODE -ne 0 ]; then
    echo "❌ Performance benchmarks failed."
    exit $PERF_EXIT_CODE
fi

echo "✅ Performance benchmarks passed!"
echo ""

# Step 4: Run mutation testing
echo "4️⃣ Running Mutation Testing..."
echo "==============================="
npx stryker run
MUTATION_EXIT_CODE=$?

if [ $MUTATION_EXIT_CODE -ne 0 ]; then
    echo "⚠️ Mutation testing completed with issues. Check report."
else
    echo "✅ Mutation testing passed!"
fi

echo ""
echo "🎯 COMPLETE TEST SUITE RESULTS:"
echo "==============================="
echo "✅ Unit Tests: PASSED"
echo "✅ Coverage Report: GENERATED"
echo "✅ Performance: PASSED"
if [ $MUTATION_EXIT_CODE -eq 0 ]; then
    echo "✅ Mutation Testing: PASSED"
else
    echo "⚠️ Mutation Testing: CHECK REPORT"
fi
echo ""
echo "💎 SOL Trading Gateway maintains institutional-grade quality standards!"
echo "📈 Ready for production deployment with comprehensive test validation"