#!/usr/bin/env node
/**
 * Quick validation script to test multimodal input schemas work correctly
 */

import { spawn } from 'child_process';

// Run typescript build first
console.log('Checking TypeScript compilation...');
const tsc = spawn('npx', ['tsc', '--noEmit'], {
  cwd: '/Users/s0v3r1gn/APEX/packages/core'
});

let buildError = '';
tsc.stderr.on('data', (data) => {
  buildError += data.toString();
});

tsc.on('close', (code) => {
  if (code !== 0) {
    console.error('❌ TypeScript compilation failed:');
    console.error(buildError);
    process.exit(1);
  }
  console.log('✓ TypeScript compilation passed');

  // If build passes, run a quick test
  console.log('\nRunning multimodal input export test...');
  const test = spawn('npx', ['vitest', 'run', 'packages/core/src/__tests__/multimodal-input-exports.test.ts'], {
    cwd: '/Users/s0v3r1gn/APEX'
  });

  test.stdout.on('data', (data) => {
    console.log(data.toString());
  });

  test.stderr.on('data', (data) => {
    console.log(data.toString());
  });

  test.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Export tests failed');
      process.exit(1);
    }
    console.log('✓ Export tests passed');
  });
});
