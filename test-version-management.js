#!/usr/bin/env node

// Simple test runner for version management functionality
const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('Running version management tests...');

  // Change to orchestrator directory and run the specific test
  process.chdir('./packages/orchestrator');

  const testCommand = 'npx vitest run src/__tests__/mcp-installer-version-management.test.ts --reporter=verbose';

  const result = execSync(testCommand, {
    encoding: 'utf-8',
    stdio: 'pipe'
  });

  console.log('Tests completed successfully:');
  console.log(result);

} catch (error) {
  console.error('Test execution failed:');
  console.error(error.stdout || error.message);
  process.exit(1);
}