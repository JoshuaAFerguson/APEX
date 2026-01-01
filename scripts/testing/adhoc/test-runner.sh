#!/bin/bash

# Simple test execution script for Windows compatibility analysis
cd packages/cli

echo "=== Checking Node and NPM versions ==="
node --version
npm --version

echo ""
echo "=== Checking if dependencies are installed ==="
if [ -d "node_modules" ]; then
    echo "✓ Dependencies installed"
else
    echo "✗ Dependencies not found, running npm install..."
    npm install
fi

echo ""
echo "=== Building the package ==="
npm run build

echo ""
echo "=== Running TypeScript type check ==="
npm run typecheck

echo ""
echo "=== Attempting to run tests ==="
npm test

echo ""
echo "=== Test execution completed ==="