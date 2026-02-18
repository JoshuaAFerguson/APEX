#!/bin/bash

# Test Runner Validation Script for ApprovalGateController
# This script validates that the test files are ready for execution

echo "🧪 Validating ApprovalGateController Test Suite"
echo "=============================================="

# Check if we're in the correct directory
if [[ ! -f "package.json" ]]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Check if test files exist
TEST_FILES=(
    "packages/orchestrator/src/__tests__/approval-gate-controller.test.ts"
    "packages/orchestrator/src/__tests__/approval-gate-controller.edge-cases.test.ts"
    "packages/orchestrator/src/__tests__/approval-gate-controller.integration.test.ts"
    "packages/orchestrator/src/__tests__/approval-gate-controller.performance.test.ts"
    "packages/orchestrator/src/__tests__/approval-gate-test-validation.ts"
)

echo "📁 Checking test files..."
for file in "${TEST_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file"
        # Check file size to ensure it's not empty
        size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
        if [[ $size -lt 1000 ]]; then
            echo "⚠️  Warning: $file is smaller than expected (${size} bytes)"
        fi
    else
        echo "❌ $file"
        exit 1
    fi
done

# Check implementation file exists
IMPL_FILE="packages/orchestrator/src/approval-gate-controller.ts"
if [[ -f "$IMPL_FILE" ]]; then
    echo "✅ Implementation file: $IMPL_FILE"
else
    echo "❌ Implementation file missing: $IMPL_FILE"
    exit 1
fi

echo ""
echo "🔍 Validating test file structure..."

# Function to validate test file structure
validate_test_file() {
    local file=$1
    local filename=$(basename "$file")

    echo "  Checking $filename..."

    # Check for required imports
    if ! grep -q "import.*vitest" "$file"; then
        echo "    ❌ Missing vitest imports"
        return 1
    fi

    if ! grep -q "ApprovalGateController" "$file"; then
        echo "    ❌ Missing ApprovalGateController import/usage"
        return 1
    fi

    # Check for test structure
    if ! grep -q "describe(" "$file"; then
        echo "    ❌ Missing describe blocks"
        return 1
    fi

    if ! grep -q "it(" "$file"; then
        echo "    ❌ Missing test cases"
        return 1
    fi

    # Check for proper async handling
    if ! grep -q "async\|await" "$file"; then
        echo "    ⚠️  Warning: No async/await patterns found"
    fi

    # Check for cleanup patterns
    if grep -q "beforeEach\|afterEach" "$file"; then
        echo "    ✅ Setup/cleanup patterns found"
    fi

    echo "    ✅ $filename structure looks good"
    return 0
}

# Validate each test file
for file in "${TEST_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        validate_test_file "$file"
        if [[ $? -ne 0 ]]; then
            echo "❌ Validation failed for $file"
            exit 1
        fi
    fi
done

echo ""
echo "📊 Test Suite Statistics:"

# Count test cases
total_tests=0
total_describes=0

for file in "${TEST_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        tests=$(grep -c "it(" "$file" || echo "0")
        describes=$(grep -c "describe(" "$file" || echo "0")
        total_tests=$((total_tests + tests))
        total_describes=$((total_describes + describes))
        echo "  $(basename "$file"): $tests tests, $describes describe blocks"
    fi
done

echo "  Total: $total_tests tests across $total_describes describe blocks"

echo ""
echo "🚀 Running TypeScript compilation check..."
if command -v npx &> /dev/null; then
    if npx tsc --noEmit --skipLibCheck; then
        echo "✅ TypeScript compilation check passed"
    else
        echo "❌ TypeScript compilation check failed"
        echo "   Please run 'npm run build' to see detailed errors"
        exit 1
    fi
else
    echo "⚠️  npx not available, skipping TypeScript check"
fi

echo ""
echo "🎯 Ready to run tests!"
echo ""
echo "To run the tests, use one of these commands:"
echo "  npm test                                           # Run all tests"
echo "  npm test -- approval-gate-controller             # Run ApprovalGateController tests"
echo "  npm test -- approval-gate-controller.test.ts     # Run main test file only"
echo "  npm test -- approval-gate-controller.edge-cases  # Run edge case tests"
echo "  npm test -- approval-gate-controller.integration # Run integration tests"
echo "  npm test -- approval-gate-controller.performance # Run performance tests"
echo ""
echo "For coverage reports:"
echo "  npm test -- --coverage                           # Run with coverage"
echo ""
echo "✅ All validations passed! Test suite is ready for execution."