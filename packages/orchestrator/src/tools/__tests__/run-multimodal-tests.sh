#!/bin/bash

# MultimodalInputHandler Test Runner Script
# Runs all tests for the MultimodalInputHandler implementation

set -e  # Exit on any error

echo "🧪 MultimodalInputHandler Test Suite Runner"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to run a test file
run_test() {
    local test_file=$1
    local description=$2

    print_status $YELLOW "Running: $description"
    if npx vitest run "$test_file" --reporter=verbose; then
        print_status $GREEN "✅ PASSED: $description"
        return 0
    else
        print_status $RED "❌ FAILED: $description"
        return 1
    fi
}

# Change to orchestrator directory
cd "$(dirname "$0")/../../../.."

echo "📁 Working directory: $(pwd)"
echo ""

# Test execution order (fast to slow)
test_files=(
    "src/tools/multimodal-input-handler.test.ts:Unit Tests (Core Logic)"
    "src/tools/__tests__/multimodal-input-handler-edge-cases.test.ts:Edge Case Tests"
    "src/tools/multimodal-input-handler.integration.test.ts:Integration Tests (Real Files)"
    "src/tools/__tests__/multimodal-input-handler-performance.test.ts:Performance Tests"
)

# Initialize counters
total_tests=0
passed_tests=0
failed_tests=0

# Run each test file
for test_entry in "${test_files[@]}"; do
    IFS=':' read -r test_file description <<< "$test_entry"
    echo "----------------------------------------"

    total_tests=$((total_tests + 1))

    if run_test "$test_file" "$description"; then
        passed_tests=$((passed_tests + 1))
    else
        failed_tests=$((failed_tests + 1))
    fi

    echo ""
done

echo "=========================================="
echo "📊 Test Summary:"
echo "   Total Test Suites: $total_tests"
print_status $GREEN "   Passed: $passed_tests"
if [ $failed_tests -gt 0 ]; then
    print_status $RED "   Failed: $failed_tests"
else
    print_status $GREEN "   Failed: $failed_tests"
fi

# Run coverage report if all tests pass
if [ $failed_tests -eq 0 ]; then
    echo ""
    echo "🎯 All tests passed! Generating coverage report..."
    if npm run test:coverage -- --reporter=json --reporter=text; then
        print_status $GREEN "✅ Coverage report generated successfully"
    else
        print_status $YELLOW "⚠️  Coverage report generation failed (tests still passed)"
    fi

    echo ""
    print_status $GREEN "🎉 MultimodalInputHandler is READY FOR PRODUCTION! 🎉"
else
    print_status $RED "❌ Some tests failed. Please review and fix before proceeding."
    exit 1
fi