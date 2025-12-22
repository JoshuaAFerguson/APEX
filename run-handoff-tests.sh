#!/bin/bash

# Script to run AgentPanel handoff animation tests with coverage

echo "========================================"
echo "AgentPanel Handoff Animation Test Suite"
echo "========================================"
echo ""

# Change to the project root
cd /Users/s0v3r1gn/APEX

echo "Step 1: Running all tests to verify they pass..."
echo "------------------------------------------------"
npm test --workspace=@apexcli/cli 2>&1

TEST_EXIT_CODE=$?

echo ""
echo "Step 2: Running tests with coverage..."
echo "---------------------------------------"
npm run test:coverage --workspace=@apexcli/cli 2>&1

COVERAGE_EXIT_CODE=$?

echo ""
echo "========================================"
echo "Test Execution Summary"
echo "========================================"
echo ""

if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "✓ All tests passed successfully"
else
  echo "✗ Some tests failed (exit code: $TEST_EXIT_CODE)"
fi

if [ $COVERAGE_EXIT_CODE -eq 0 ]; then
  echo "✓ Coverage report generated successfully"
  echo ""
  echo "Coverage reports available at:"
  echo "  - HTML: packages/cli/coverage/index.html"
  echo "  - JSON: packages/cli/coverage/coverage-final.json"
else
  echo "✗ Coverage generation failed (exit code: $COVERAGE_EXIT_CODE)"
fi

echo ""
echo "Test files for handoff animation feature:"
echo "  - packages/cli/src/ui/components/agents/__tests__/HandoffIndicator.test.tsx"
echo "  - packages/cli/src/ui/components/agents/__tests__/HandoffIndicator.edge-cases.test.tsx"
echo "  - packages/cli/src/ui/components/agents/__tests__/AgentPanel.test.tsx"
echo "  - packages/cli/src/ui/components/agents/__tests__/AgentPanel.integration.test.tsx"
echo ""

exit $TEST_EXIT_CODE
