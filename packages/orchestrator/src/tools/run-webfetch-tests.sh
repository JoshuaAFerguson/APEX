#!/bin/bash
set -e

echo "🧪 WebFetch Tool Test Runner"
echo "============================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Running WebFetch Tool Tests${NC}"
echo ""

# Check if we're in the right directory
if [[ ! -f "webfetch.ts" ]]; then
    echo -e "${RED}❌ Error: webfetch.ts not found. Please run from packages/orchestrator/src/tools/${NC}"
    exit 1
fi

# Build the project first
echo -e "${YELLOW}🔨 Building project...${NC}"
cd ../../../../..
npm run build

# Run TypeScript check
echo -e "${YELLOW}🔍 Running TypeScript check...${NC}"
npx tsc --noEmit packages/orchestrator/src/tools/webfetch*.test.ts

# Run the tests
echo -e "${YELLOW}🧪 Running WebFetch tests...${NC}"

echo -e "${BLUE}1. Integration Tests (Real Network)${NC}"
npx vitest run packages/orchestrator/src/tools/webfetch.test.ts --reporter=verbose

echo -e "${BLUE}2. Unit Tests (Mocked)${NC}"
npx vitest run packages/orchestrator/src/tools/webfetch.unit.test.ts --reporter=verbose

echo -e "${BLUE}3. Edge Cases Tests${NC}"
npx vitest run packages/orchestrator/src/tools/webfetch.edge-cases.test.ts --reporter=verbose

echo -e "${BLUE}4. Turndown Integration Tests${NC}"
npx vitest run packages/orchestrator/src/tools/webfetch.turndown.integration.test.ts --reporter=verbose

# Run coverage
echo -e "${YELLOW}📊 Generating coverage report...${NC}"
npx vitest run packages/orchestrator/src/tools/webfetch*.test.ts --coverage --reporter=verbose

echo ""
echo -e "${GREEN}✅ All WebFetch tests completed!${NC}"
echo ""
echo -e "${BLUE}📈 Test Summary:${NC}"
echo "   📋 Integration Tests: ~50 tests"
echo "   🎭 Unit Tests: ~35 tests"
echo "   🔧 Edge Cases: ~25 tests"
echo "   🔗 Turndown Integration: ~15 tests"
echo "   📊 Total: ~125 tests"
echo ""
echo -e "${BLUE}🎯 Coverage Areas:${NC}"
echo "   ✅ HTML-to-markdown conversion"
echo "   ✅ Script/style removal"
echo "   ✅ Image handling"
echo "   ✅ Form elements"
echo "   ✅ Navigation filtering"
echo "   ✅ Complex structures"
echo "   ✅ Malformed HTML"
echo "   ✅ Performance testing"
echo "   ✅ Error handling"
echo "   ✅ Fallback mechanisms"
echo ""
echo -e "${GREEN}🎉 WebFetch tool testing complete!${NC}"