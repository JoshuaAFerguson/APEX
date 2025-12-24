#!/bin/bash

echo "=== Running Thoughts Feature Tests ==="
echo

# Change to CLI package directory
cd packages/cli

echo "Running all thoughts-related tests..."
echo

# Run specific test files
npm test -- src/__tests__/thoughts-command.test.tsx
npm test -- src/__tests__/thoughts-command.integration.test.tsx
npm test -- src/__tests__/thoughts-help-integration.test.tsx
npm test -- src/__tests__/thoughts-statusbar-integration.test.tsx
npm test -- src/__tests__/thoughts-e2e.test.tsx
npm test -- src/__tests__/thoughts-performance.test.tsx
npm test -- src/__tests__/thoughts-repl-integration.test.tsx

echo
echo "=== Running Test Coverage for Thoughts Feature ==="
npm run test:coverage -- src/__tests__/thoughts-*

echo
echo "=== Test Summary ==="
echo "✅ All tests completed"
echo "📊 Check coverage report above"