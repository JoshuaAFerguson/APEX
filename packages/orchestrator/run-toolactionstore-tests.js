#!/usr/bin/env node

/**
 * Test runner script for ToolActionStore tests
 * This script runs the ToolActionStore tests directly with vitest
 */

const { spawn } = require('child_process');
const path = require('path');

async function runTests() {
  console.log('Running ToolActionStore tests...\n');

  const vitestArgs = [
    'run',
    '--reporter=verbose',
    'src/toolActionStore.test.ts',
    'src/toolActionStore.integration.test.ts'
  ];

  const child = spawn('npx', ['vitest', ...vitestArgs], {
    stdio: 'inherit',
    cwd: __dirname
  });

  child.on('error', (error) => {
    console.error('Failed to start test process:', error);
    process.exit(1);
  });

  child.on('close', (code) => {
    console.log(`\nTest process exited with code ${code}`);
    process.exit(code);
  });
}

runTests().catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});