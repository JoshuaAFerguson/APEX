#!/bin/bash

# Getting Started Documentation Validation Runner
# This script runs all validation tests for the getting-started.md documentation

echo "🧪 APEX Getting Started Documentation Validation"
echo "================================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [[ ! -f "docs/getting-started.md" ]]; then
    echo -e "${RED}❌ Error: Must run from APEX project root${NC}"
    echo "   Current directory: $(pwd)"
    echo "   Expected: docs/getting-started.md should exist"
    exit 1
fi

echo -e "${BLUE}📋 Running Documentation Validation Tests...${NC}"
echo

# Test 1: Content Validation
echo -e "${YELLOW}1. Content Validation Test${NC}"
if npx vitest run docs/tests/getting-started-content.test.ts --reporter=verbose; then
    echo -e "${GREEN}✅ Content validation passed${NC}"
else
    echo -e "${RED}❌ Content validation failed${NC}"
    exit 1
fi
echo

# Test 2: Comprehensive Validation
echo -e "${YELLOW}2. Comprehensive Validation Test${NC}"
if npx vitest run docs/tests/comprehensive-validation.test.ts --reporter=verbose; then
    echo -e "${GREEN}✅ Comprehensive validation passed${NC}"
else
    echo -e "${RED}❌ Comprehensive validation failed${NC}"
    exit 1
fi
echo

# Test 3: Standalone Validation Script
echo -e "${YELLOW}3. Standalone Validation Script${NC}"
if node docs/tests/validate-getting-started.js; then
    echo -e "${GREEN}✅ Standalone validation passed${NC}"
else
    echo -e "${RED}❌ Standalone validation failed${NC}"
    exit 1
fi
echo

# Check for test report
if [[ -f "docs/tests/getting-started-validation-report.json" ]]; then
    echo -e "${BLUE}📊 Validation Report Generated:${NC}"
    echo "   Location: docs/tests/getting-started-validation-report.json"
    echo
fi

# Summary
echo -e "${GREEN}🎉 All Documentation Validation Tests Passed!${NC}"
echo
echo -e "${BLUE}Summary:${NC}"
echo "✅ Content structure and formatting validated"
echo "✅ v0.3.0 features coverage confirmed"
echo "✅ Acceptance criteria met:"
echo "   - Rich terminal UI features documented"
echo "   - Session management basics included"
echo "   - Tab completion and keyboard shortcuts covered"
echo "   - Link to cli-guide.md provided"
echo
echo -e "${BLUE}Coverage Reports:${NC}"
echo "📋 docs/tests/getting-started-coverage-report.md"
echo "📋 docs/tests/README.md"
echo
echo -e "${GREEN}Documentation is ready for production use! 🚀${NC}"