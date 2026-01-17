#!/bin/bash

# Test script for MCPConfigurator tests specifically
echo "🧪 Running MCPConfigurator Tests..."

# Run the specific test files
echo "Running original MCPConfigurator tests..."
npx vitest run src/mcp/configurator.test.ts

echo "Running comprehensive MCPConfigurator tests..."
npx vitest run src/mcp/configurator.comprehensive.test.ts

echo "Running integration tests..."
npx vitest run src/mcp/configurator.integration.test.ts

echo "Running performance tests..."
npx vitest run src/mcp/configurator.performance.test.ts

echo "Running edge cases tests..."
npx vitest run src/mcp/configurator.edge-cases.test.ts

echo "🎉 MCPConfigurator tests complete!"