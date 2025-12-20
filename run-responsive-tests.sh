#!/bin/bash

echo "🧪 Running Responsive Integration Tests for Agent Components"
echo "=========================================================="

echo "📁 Test Files:"
echo "  - responsive-test-utils.ts"
echo "  - AgentPanel.responsive-composition-integration.test.tsx"
echo "  - ParallelExecutionView.columns-integration.test.tsx"
echo "  - AgentThoughts.responsive.test.tsx"
echo "  - ThoughtDisplay.responsive.test.tsx"

echo ""
echo "🔍 Running test validation..."

# Check if all test files exist
FILES_TO_CHECK=(
  "packages/cli/src/ui/__tests__/responsive-test-utils.ts"
  "packages/cli/src/ui/components/agents/__tests__/AgentPanel.responsive-composition-integration.test.tsx"
  "packages/cli/src/ui/components/agents/__tests__/ParallelExecutionView.columns-integration.test.tsx"
  "packages/cli/src/ui/components/__tests__/AgentThoughts.responsive.test.tsx"
  "packages/cli/src/ui/components/__tests__/ThoughtDisplay.responsive.test.tsx"
)

ALL_EXIST=true

for file in "${FILES_TO_CHECK[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file exists"
  else
    echo "❌ $file missing"
    ALL_EXIST=false
  fi
done

echo ""

if [ "$ALL_EXIST" = true ]; then
  echo "✅ All test files found! Running tests..."
  echo ""

  # Run specific responsive tests
  npm test -- --run \
    packages/cli/src/ui/components/agents/__tests__/AgentPanel.responsive-composition-integration.test.tsx \
    packages/cli/src/ui/components/agents/__tests__/ParallelExecutionView.columns-integration.test.tsx \
    packages/cli/src/ui/components/__tests__/AgentThoughts.responsive.test.tsx \
    packages/cli/src/ui/components/__tests__/ThoughtDisplay.responsive.test.tsx
else
  echo "❌ Some test files are missing. Please check the implementation."
  exit 1
fi