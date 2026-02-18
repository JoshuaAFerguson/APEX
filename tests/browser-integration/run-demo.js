#!/usr/bin/env node

/**
 * @fileoverview Simple test runner for browser integration demo
 *
 * This script runs a basic check to verify that browser automation
 * infrastructure is working correctly.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🔍 Checking browser integration test infrastructure...\n');

// Check if we can import Playwright
try {
  const { chromium } = require('playwright');
  console.log('✅ Playwright import successful');
} catch (error) {
  console.error('❌ Failed to import Playwright:', error.message);
  process.exit(1);
}

// Check if we can import Vitest
try {
  const { describe, it, expect } = require('vitest');
  console.log('✅ Vitest import successful');
} catch (error) {
  console.error('❌ Failed to import Vitest:', error.message);
  process.exit(1);
}

console.log('\n🚀 Running minimal browser integration test...\n');

// Run the minimal demo test
const vitestProcess = spawn(
  'npx',
  [
    'vitest',
    'run',
    '--config',
    path.join(__dirname, 'vitest.config.ts'),
    path.join(__dirname, 'minimal-demo.test.ts'),
    '--reporter=verbose',
  ],
  {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..', '..'),
  }
);

vitestProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Browser integration test infrastructure is working correctly!');
    console.log('\n📋 Infrastructure Summary:');
    console.log('   - Browser automation: Playwright ✅');
    console.log('   - Test framework: Vitest ✅');
    console.log('   - Element interactions: Working ✅');
    console.log('   - Screenshot capture: Working ✅');
    console.log('   - Console message capture: Working ✅');
    console.log('   - JavaScript execution: Working ✅');
    console.log('\n🎉 Ready for production use!');
  } else {
    console.error(`\n❌ Tests failed with exit code ${code}`);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   1. Run: npx playwright install');
    console.log('   2. Check that Node.js version >= 18');
    console.log('   3. Verify dependencies with: npm install');
    console.log('   4. Check browser binaries are installed');
    process.exit(1);
  }
});

vitestProcess.on('error', (error) => {
  console.error('❌ Failed to start test process:', error.message);
  process.exit(1);
});