#!/bin/bash

# WebFetch Test Execution Script
# This script runs all WebFetch-related tests to verify the integration

echo "🧪 Running WebFetch Integration Tests"
echo "====================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to run a test and capture result
run_test() {
    local test_file=$1
    local test_name=$2

    echo -e "\n${YELLOW}Running: $test_name${NC}"
    echo "File: $test_file"

    if npx vitest run "$test_file" --reporter=verbose; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        return 1
    fi
}

# Build the project first
echo -e "\n${YELLOW}Building project...${NC}"
if npm run build; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Initialize test results
passed=0
failed=0

# Run WebFetch core tests
if run_test "packages/orchestrator/src/tools/webfetch.test.ts" "WebFetch Core Functionality"; then
    ((passed++))
else
    ((failed++))
fi

# Run WebFetch hooks tests
if run_test "packages/orchestrator/src/hooks.test.ts" "WebFetch Hooks Integration"; then
    ((passed++))
else
    ((failed++))
fi

# Run WebFetch integration tests
if run_test "packages/orchestrator/src/webfetch.integration.test.ts" "WebFetch Orchestrator Integration"; then
    ((passed++))
else
    ((failed++))
fi

# Run WebFetch edge cases tests
if run_test "packages/orchestrator/src/webfetch.hooks.edge-cases.test.ts" "WebFetch Hooks Edge Cases"; then
    ((passed++))
else
    ((failed++))
fi

# Run additional WebFetch tests if they exist
additional_tests=(
    "packages/orchestrator/src/tools/webfetch.unit.test.ts"
    "packages/orchestrator/src/tools/webfetch.cache.test.ts"
    "packages/orchestrator/src/tools/webfetch.ai-analysis.test.ts"
    "packages/orchestrator/src/tools/webfetch.performance.test.ts"
    "packages/orchestrator/src/tools/webfetch.edge-cases.test.ts"
)

for test_file in "${additional_tests[@]}"; do
    if [ -f "$test_file" ]; then
        test_name=$(basename "$test_file" .test.ts)
        if run_test "$test_file" "WebFetch $test_name"; then
            ((passed++))
        else
            ((failed++))
        fi
    fi
done

# Run coverage report
echo -e "\n${YELLOW}Generating coverage report...${NC}"
if npx vitest run --coverage packages/orchestrator/src/tools/webfetch*.ts packages/orchestrator/src/hooks.test.ts; then
    echo -e "${GREEN}✅ Coverage report generated${NC}"
else
    echo -e "${YELLOW}⚠️  Coverage report failed (optional)${NC}"
fi

# Summary
echo -e "\n${YELLOW}Test Summary${NC}"
echo "============"
echo -e "Passed: ${GREEN}$passed${NC}"
echo -e "Failed: ${RED}$failed${NC}"
total=$((passed + failed))
echo -e "Total:  $total"

if [ $failed -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All WebFetch tests passed!${NC}"
    exit 0
else
    echo -e "\n${RED}💥 Some WebFetch tests failed${NC}"
    exit 1
fi