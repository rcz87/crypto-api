#!/bin/bash

# SOL Trading Gateway - Coverage Upload Script
# Uploads coverage reports to Codecov and Coveralls for dashboard visibility

set -e

echo "🧪 SOL FUTURES TRADING GATEWAY - COVERAGE UPLOAD"
echo "================================================="

# Generate coverage report
echo "📊 Generating Jest coverage report..."
npm run test:coverage

# Check if coverage directory exists
if [ ! -d "coverage" ]; then
    echo "❌ Coverage directory not found. Make sure tests ran successfully."
    exit 1
fi

echo "✅ Coverage report generated successfully!"

# Upload to Codecov (requires CODECOV_TOKEN environment variable)
if [ ! -z "$CODECOV_TOKEN" ]; then
    echo "📤 Uploading coverage to Codecov..."
    
    # Install codecov if not present
    if ! command -v codecov &> /dev/null; then
        echo "Installing Codecov uploader..."
        npm install -g codecov
    fi
    
    # Upload to Codecov
    codecov -t $CODECOV_TOKEN -f coverage/lcov.info
    echo "✅ Coverage uploaded to Codecov successfully!"
else
    echo "⚠️  CODECOV_TOKEN not found. Skipping Codecov upload."
    echo "   Set CODECOV_TOKEN environment variable to enable upload."
fi

# Upload to Coveralls (requires COVERALLS_REPO_TOKEN environment variable) 
if [ ! -z "$COVERALLS_REPO_TOKEN" ]; then
    echo "📤 Uploading coverage to Coveralls..."
    
    # Install coveralls if not present
    if ! command -v coveralls &> /dev/null; then
        echo "Installing Coveralls uploader..."
        npm install -g coveralls
    fi
    
    # Upload to Coveralls
    cat coverage/lcov.info | coveralls
    echo "✅ Coverage uploaded to Coveralls successfully!"
else
    echo "⚠️  COVERALLS_REPO_TOKEN not found. Skipping Coveralls upload."
    echo "   Set COVERALLS_REPO_TOKEN environment variable to enable upload."
fi

# Display coverage summary
echo ""
echo "📈 COVERAGE SUMMARY:"
echo "===================="
if [ -f "coverage/coverage-summary.json" ]; then
    node -e "
    const summary = require('./coverage/coverage-summary.json');
    const total = summary.total;
    console.log(\`Lines: \${total.lines.pct}% (\${total.lines.covered}/\${total.lines.total})\`);
    console.log(\`Functions: \${total.functions.pct}% (\${total.functions.covered}/\${total.functions.total})\`);
    console.log(\`Branches: \${total.branches.pct}% (\${total.branches.covered}/\${total.branches.total})\`);
    console.log(\`Statements: \${total.statements.pct}% (\${total.statements.covered}/\${total.statements.total})\`);
    "
fi

echo ""
echo "🎯 Coverage thresholds:"
echo "   • Global minimum: 80%"
echo "   • Algorithm services: 90%"
echo "   • View detailed report: coverage/index.html"
echo ""
echo "💎 Institutional-grade testing coverage complete!"