#!/bin/bash

# Browser Tool Test Runner Script
# This script runs all browser tool related tests and generates reports

echo "🧪 Browser Tool Test Suite Runner"
echo "=================================="

# Change to orchestrator package directory
cd "$(dirname "$0")/../../.." || exit 1

echo "📁 Current directory: $(pwd)"
echo ""

# Check if required dependencies are installed
echo "🔍 Checking dependencies..."
if ! npm list vitest &>/dev/null; then
    echo "❌ Vitest not found. Installing dependencies..."
    npm install
fi

echo "✅ Dependencies verified"
echo ""

# Run TypeScript compilation check
echo "🔨 Checking TypeScript compilation..."
if npx tsc --noEmit --project .; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi
echo ""

# Run specific browser tool tests
echo "🧪 Running Browser Tool Tests..."
echo ""

echo "1️⃣  Running main browser tool tests..."
if npx vitest run src/tools/browser-tool.test.ts; then
    echo "✅ Main tests passed"
else
    echo "❌ Main tests failed"
fi
echo ""

echo "2️⃣  Running integration tests..."
if npx vitest run src/tools/browser-tool.integration.test.ts; then
    echo "✅ Integration tests passed"
else
    echo "❌ Integration tests failed"
fi
echo ""

echo "3️⃣  Running console tests..."
if npx vitest run src/tools/browser-tool-console.test.ts; then
    echo "✅ Console tests passed"
else
    echo "❌ Console tests failed"
fi
echo ""

echo "4️⃣  Running edge cases tests..."
if npx vitest run src/tools/browser-tool.edge-cases.test.ts; then
    echo "✅ Edge cases tests passed"
else
    echo "❌ Edge cases tests failed"
fi
echo ""

echo "5️⃣  Running performance tests..."
if npx vitest run src/tools/browser-tool.performance.test.ts; then
    echo "✅ Performance tests passed"
else
    echo "❌ Performance tests failed"
fi
echo ""

echo "6️⃣  Running security tests..."
if npx vitest run src/tools/browser-tool.security.test.ts; then
    echo "✅ Security tests passed"
else
    echo "❌ Security tests failed"
fi
echo ""

# Generate coverage report
echo "📊 Generating test coverage report..."
if npx vitest run src/tools/browser-tool*.test.ts --coverage --reporter=verbose; then
    echo "✅ Coverage report generated"
else
    echo "❌ Coverage report generation failed"
fi
echo ""

# Run all orchestrator tests to ensure no regressions
echo "🔄 Running full orchestrator test suite..."
if npx vitest run; then
    echo "✅ All tests passed"
else
    echo "❌ Some tests failed"
    echo ""
    echo "🔍 Running tests with detailed output..."
    npx vitest run --reporter=verbose
fi
echo ""

echo "🎉 Browser Tool Test Suite Complete!"
echo ""
echo "📋 Test Summary:"
echo "  - Main unit tests"
echo "  - Integration tests"
echo "  - Console streaming tests"
echo "  - Edge cases and error scenarios"
echo "  - Performance and stress tests"
echo "  - Security and permission tests"
echo ""
echo "📈 Coverage areas:"
echo "  - All browser operations"
echo "  - Permission management"
echo "  - Backend compatibility"
echo "  - Resource lifecycle"
echo "  - Error handling"
echo "  - Security validation"
echo ""