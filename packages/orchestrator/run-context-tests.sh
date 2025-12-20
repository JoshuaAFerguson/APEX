#!/bin/bash

# Enhanced Context Summary Test Runner
# This script runs all tests related to the enhanced createContextSummary functionality

echo "🧪 Running Enhanced Context Summary Tests"
echo "========================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the orchestrator package directory"
    exit 1
fi

# Run the specific context tests
echo "📋 Running unit tests..."
npx vitest run src/context.test.ts --reporter=verbose

echo ""
echo "🔧 Running integration tests..."
npx vitest run src/context.integration.test.ts --reporter=verbose

echo ""
echo "📊 Generating coverage report..."
npx vitest run src/context*.test.ts --coverage --reporter=verbose

echo ""
echo "✅ All context summary tests completed!"
echo "📄 Check test-summary.md for detailed coverage information"