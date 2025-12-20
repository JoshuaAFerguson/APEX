#!/bin/bash

# Multi-Agent Visualization Documentation Test Execution Script
#
# This script runs all tests related to the Multi-Agent Visualization documentation
# and generates a comprehensive coverage report.

echo "🧪 Running Multi-Agent Visualization Documentation Tests..."

# Change to project root
cd "$(dirname "$0")"

echo "📋 Running documentation validation tests..."
npx vitest run packages/cli/src/__tests__/multi-agent-visualization.test.ts --reporter=verbose

echo "🏗️ Running component structure validation tests..."
npx vitest run packages/cli/src/__tests__/multi-agent-components-structure.test.ts --reporter=verbose

echo "🎨 Running visual examples validation tests..."
npx vitest run packages/cli/src/__tests__/multi-agent-visual-examples.test.ts --reporter=verbose

echo "💭 Running /thoughts command documentation tests..."
npx vitest run packages/cli/src/__tests__/thoughts-command-documentation.test.ts --reporter=verbose

echo "📊 Generating coverage report..."
npx vitest run packages/cli/src/__tests__/multi-agent-*.test.ts packages/cli/src/__tests__/thoughts-command-*.test.ts --coverage --reporter=verbose

echo "✅ All Multi-Agent Visualization documentation tests completed!"
echo ""
echo "📄 Test Files Created:"
echo "  - packages/cli/src/__tests__/multi-agent-visualization.test.ts"
echo "  - packages/cli/src/__tests__/multi-agent-components-structure.test.ts"
echo "  - packages/cli/src/__tests__/multi-agent-visual-examples.test.ts"
echo "  - packages/cli/src/__tests__/thoughts-command-documentation.test.ts"
echo ""
echo "🎯 Coverage Areas:"
echo "  ✓ Documentation structure and completeness"
echo "  ✓ Component API definitions and TypeScript interfaces"
echo "  ✓ Visual examples and ASCII art quality"
echo "  ✓ /thoughts command functionality and integration"
echo "  ✓ Agent panel visualization components"
echo "  ✓ Handoff animations and parallel execution views"
echo "  ✓ Subtask tree visualization"
echo "  ✓ Real-time streaming and event integration"
echo "  ✓ Responsive design and accessibility features"
echo ""