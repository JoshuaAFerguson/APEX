#!/bin/bash

#
# Browser Permission Tests Runner
#
# This script runs the comprehensive browser permission integration tests
# with proper setup and reporting.
#

set -e

echo "🚀 Running Browser Permission Integration Tests"
echo "=============================================="

# Check if required dependencies are available
echo "📋 Checking dependencies..."

if ! command -v npm &> /dev/null; then
    echo "❌ npm is required but not installed"
    exit 1
fi

if ! npm list vitest &> /dev/null; then
    echo "❌ vitest is not installed"
    exit 1
fi

echo "✅ Dependencies check passed"
echo ""

# Set up test environment
echo "🔧 Setting up test environment..."
export NODE_ENV=test
export TEST_TYPE=browser-permissions

# Create test results directory
mkdir -p test-results/browser-permissions

echo "✅ Environment setup complete"
echo ""

# Run the build first to ensure everything is compiled
echo "🏗️  Building project..."
if ! npm run build; then
    echo "❌ Build failed. Cannot run tests."
    exit 1
fi
echo "✅ Build successful"
echo ""

# Run the browser permission tests
echo "🧪 Running browser permission integration tests..."
echo ""

# Test configuration
TEST_CONFIG="tests/integration/vitest.browser-permissions.config.ts"
TEST_PATTERN="tests/integration/browser-*permission*.test.ts"

# Check if configuration exists
if [ ! -f "$TEST_CONFIG" ]; then
    echo "⚠️  Custom test configuration not found, using default vitest config"
    TEST_CONFIG=""
fi

# Run tests with different options based on environment
if [ "$CI" = "true" ]; then
    echo "🤖 Running in CI mode..."

    # CI mode: run with coverage and detailed reporting
    if [ -n "$TEST_CONFIG" ]; then
        npx vitest run --config "$TEST_CONFIG" --coverage --reporter=verbose --reporter=json --outputFile=test-results/browser-permissions/results.json
    else
        npx vitest run "$TEST_PATTERN" --coverage --reporter=verbose --reporter=json --outputFile=test-results/browser-permissions/results.json
    fi
else
    echo "💻 Running in local mode..."

    # Local mode: run with basic reporting
    if [ -n "$TEST_CONFIG" ]; then
        npx vitest run --config "$TEST_CONFIG" --reporter=verbose
    else
        npx vitest run "$TEST_PATTERN" --reporter=verbose
    fi
fi

# Capture test result
TEST_EXIT_CODE=$?

echo ""
echo "=============================================="

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "🎉 All browser permission tests passed!"
    echo ""
    echo "📊 Test Summary:"
    echo "   ✅ Comprehensive permission integration tests"
    echo "   ✅ Browser operation edge cases"
    echo "   ✅ MCP integration scenarios"
    echo "   ✅ Common browser operations"
    echo ""
    echo "🔍 Coverage Report:"
    if [ -d "coverage/browser-permissions" ]; then
        echo "   📁 HTML report: coverage/browser-permissions/index.html"
        echo "   📄 JSON report: coverage/browser-permissions/coverage-final.json"
    else
        echo "   ⚠️  Coverage report not generated"
    fi
    echo ""
    echo "📋 Test Results:"
    if [ -f "test-results/browser-permissions/results.json" ]; then
        echo "   📄 JSON results: test-results/browser-permissions/results.json"
    fi
else
    echo "❌ Some browser permission tests failed!"
    echo ""
    echo "🔍 To debug:"
    echo "   1. Check the test output above for specific failures"
    echo "   2. Run individual test files:"
    echo "      npm test -- tests/integration/browser-permission-integration-comprehensive.test.ts"
    echo "      npm test -- tests/integration/browser-permission-edge-cases.test.ts"
    echo "      npm test -- tests/integration/browser-mcp-permission-integration.test.ts"
    echo "      npm test -- tests/integration/browser-common-operations-permission.test.ts"
    echo "   3. Run with debug output:"
    echo "      DEBUG=* npm test -- tests/integration/browser-*permission*.test.ts"
    echo ""
fi

echo "🏁 Test run completed with exit code: $TEST_EXIT_CODE"

exit $TEST_EXIT_CODE