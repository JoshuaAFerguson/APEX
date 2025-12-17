#!/bin/bash

# Display Modes Feature Test Runner
# Runs all tests related to display modes functionality

echo "🧪 Running Display Modes Feature Tests"
echo "======================================"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test files to run
TEST_FILES=(
    "src/__tests__/display-modes-comprehensive.e2e.test.tsx"
    "src/__tests__/display-mode-commands.test.tsx"
    "src/__tests__/display-mode-state-persistence.test.tsx"
    "src/ui/__tests__/component-display-modes.integration.test.tsx"
    "src/ui/components/__tests__/ActivityLog.display-modes.test.tsx"
    "src/ui/components/__tests__/StatusBar.display-modes.test.tsx"
    "src/ui/__tests__/App.displayMode.test.tsx"
)

# Function to run a test file
run_test() {
    local test_file="$1"
    echo -e "${BLUE}Running:${NC} $test_file"

    if npx vitest run "$test_file" --reporter=verbose; then
        echo -e "${GREEN}✅ PASSED:${NC} $test_file"
        return 0
    else
        echo -e "${RED}❌ FAILED:${NC} $test_file"
        return 1
    fi
    echo ""
}

# Function to run all tests
run_all_tests() {
    local passed=0
    local failed=0
    local total=${#TEST_FILES[@]}

    echo -e "${YELLOW}Running $total display mode test files...${NC}"
    echo ""

    for test_file in "${TEST_FILES[@]}"; do
        if run_test "$test_file"; then
            ((passed++))
        else
            ((failed++))
        fi
    done

    echo "======================================"
    echo -e "${BLUE}Test Summary${NC}"
    echo "======================================"
    echo -e "Total tests: $total"
    echo -e "${GREEN}Passed: $passed${NC}"
    echo -e "${RED}Failed: $failed${NC}"

    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}🎉 All display mode tests passed!${NC}"
        return 0
    else
        echo -e "${RED}💥 Some tests failed${NC}"
        return 1
    fi
}

# Function to run with coverage
run_with_coverage() {
    echo -e "${YELLOW}Running display mode tests with coverage...${NC}"

    npx vitest run \
        --coverage \
        --reporter=verbose \
        "${TEST_FILES[@]}"
}

# Function to show help
show_help() {
    echo "Display Modes Test Runner"
    echo ""
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  -a, --all       Run all display mode tests (default)"
    echo "  -c, --coverage  Run tests with coverage report"
    echo "  -w, --watch     Run tests in watch mode"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Individual test categories:"
    echo "  --e2e          Run end-to-end tests only"
    echo "  --commands     Run command tests only"
    echo "  --persistence  Run state persistence tests only"
    echo "  --integration  Run integration tests only"
    echo "  --components   Run component tests only"
    echo ""
}

# Function to run specific test category
run_category() {
    local category="$1"

    case "$category" in
        "e2e")
            run_test "src/__tests__/display-modes-comprehensive.e2e.test.tsx"
            ;;
        "commands")
            run_test "src/__tests__/display-mode-commands.test.tsx"
            ;;
        "persistence")
            run_test "src/__tests__/display-mode-state-persistence.test.tsx"
            ;;
        "integration")
            run_test "src/ui/__tests__/component-display-modes.integration.test.tsx"
            ;;
        "components")
            run_test "src/ui/components/__tests__/ActivityLog.display-modes.test.tsx"
            run_test "src/ui/components/__tests__/StatusBar.display-modes.test.tsx"
            run_test "src/ui/__tests__/App.displayMode.test.tsx"
            ;;
        *)
            echo -e "${RED}Unknown category: $category${NC}"
            return 1
            ;;
    esac
}

# Function to run in watch mode
run_watch() {
    echo -e "${YELLOW}Running display mode tests in watch mode...${NC}"
    echo -e "${BLUE}Press 'q' to quit, 'a' to run all tests${NC}"

    npx vitest \
        --watch \
        --reporter=verbose \
        "${TEST_FILES[@]}"
}

# Main script logic
case "${1:-}" in
    -h|--help)
        show_help
        ;;
    -c|--coverage)
        run_with_coverage
        ;;
    -w|--watch)
        run_watch
        ;;
    --e2e)
        run_category "e2e"
        ;;
    --commands)
        run_category "commands"
        ;;
    --persistence)
        run_category "persistence"
        ;;
    --integration)
        run_category "integration"
        ;;
    --components)
        run_category "components"
        ;;
    -a|--all|"")
        run_all_tests
        ;;
    *)
        echo -e "${RED}Unknown option: $1${NC}"
        echo "Use --help for usage information"
        exit 1
        ;;
esac

exit $?