#!/usr/bin/env node

/**
 * Simple test runner to execute the error-recovery E2E test
 */

const { spawn } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../..');
const testFile = path.resolve(__dirname, 'error-recovery.e2e.test.ts');

console.log('🧪 Running Error Recovery E2E Test');
console.log('=================================');
console.log(`Root directory: ${rootDir}`);
console.log(`Test file: ${testFile}`);
console.log('');

// Run the test using the E2E vitest config
const vitestProcess = spawn('npx', [
  'vitest',
  'run',
  '--config',
  path.resolve(rootDir, 'vitest.e2e.config.ts'),
  testFile
], {
  cwd: rootDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    APEX_TEST_MODE: 'e2e'
  }
});

vitestProcess.on('close', (code) => {
  console.log('');
  if (code === 0) {
    console.log('✅ Error Recovery E2E Test completed successfully!');
  } else {
    console.log('❌ Error Recovery E2E Test failed with exit code:', code);
  }
  process.exit(code);
});

vitestProcess.on('error', (error) => {
  console.error('❌ Failed to start test process:', error.message);
  process.exit(1);
});