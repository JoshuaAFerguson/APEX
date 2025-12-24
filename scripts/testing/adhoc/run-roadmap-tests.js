#!/usr/bin/env node

/**
 * Simple test runner to validate our ROADMAP tests
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Running ROADMAP validation tests...\n');

const testCommand = spawn('npx', ['vitest', 'run', 'tests/roadmap.validation.test.ts', 'tests/roadmap.icon-accuracy.test.ts', '--reporter=verbose'], {
  cwd: __dirname,
  stdio: 'inherit'
});

testCommand.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ ROADMAP validation tests passed!');

    // Run coverage report
    console.log('\n📊 Generating coverage report...');
    const coverageCommand = spawn('npx', ['vitest', 'run', '--coverage'], {
      cwd: __dirname,
      stdio: 'inherit'
    });

    coverageCommand.on('close', (coverageCode) => {
      console.log(`\n📋 Test execution completed with code ${coverageCode}`);
    });
  } else {
    console.log(`\n❌ Tests failed with code ${code}`);
  }
});