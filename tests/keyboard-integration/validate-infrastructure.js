#!/usr/bin/env node

/**
 * @fileoverview Validate keyboard integration test infrastructure
 *
 * This script performs basic validation of the keyboard integration test
 * infrastructure to ensure all components are properly configured.
 */

import { pathToFileURL } from 'url';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkFile(filePath, description) {
  const exists = existsSync(filePath);
  log(`${exists ? '✅' : '❌'} ${description}: ${exists ? 'Found' : 'Missing'}`, exists ? 'green' : 'red');
  return exists;
}

async function validateInfrastructure() {
  log('\n🔍 Validating APEX Keyboard Integration Test Infrastructure\n', 'bold');

  const baseDir = resolve(process.cwd(), 'tests/keyboard-integration');
  let allValid = true;

  // Check core files
  log('📁 Core Infrastructure Files:', 'blue');
  allValid &= checkFile(resolve(baseDir, 'vitest.config.ts'), 'Vitest Configuration');
  allValid &= checkFile(resolve(baseDir, 'setup.ts'), 'Test Setup');
  allValid &= checkFile(resolve(baseDir, 'README.md'), 'Documentation');

  // Check utilities
  log('\n🛠️  Utility Files:', 'blue');
  allValid &= checkFile(resolve(baseDir, 'utils/keyboard-events.ts'), 'Keyboard Event Simulator');

  // Check fixtures
  log('\n🎯 Fixture Files:', 'blue');
  allValid &= checkFile(resolve(baseDir, 'fixtures/key-combinations.ts'), 'Key Combination Fixtures');

  // Check test files
  log('\n🧪 Test Files:', 'blue');
  allValid &= checkFile(resolve(baseDir, 'keyboard-infrastructure.test.ts'), 'Infrastructure Test');

  // Check dependencies (basic check for vitest and jsdom)
  log('\n📦 Dependencies:', 'blue');
  try {
    await import('vitest');
    log('✅ Vitest: Available', 'green');
  } catch (e) {
    log('❌ Vitest: Missing or not available', 'red');
    allValid = false;
  }

  try {
    await import('jsdom');
    log('✅ jsdom: Available', 'green');
  } catch (e) {
    log('❌ jsdom: Missing or not available', 'red');
    allValid = false;
  }

  // Validate imports (basic syntax check)
  log('\n🔗 Module Imports:', 'blue');
  try {
    const setupModule = await import(pathToFileURL(resolve(baseDir, 'setup.ts')).href);
    log('✅ Setup module: Imports successfully', 'green');
  } catch (e) {
    log('❌ Setup module: Import failed', 'red');
    log(`   Error: ${e.message}`, 'yellow');
    allValid = false;
  }

  try {
    const eventsModule = await import(pathToFileURL(resolve(baseDir, 'utils/keyboard-events.ts')).href);
    log('✅ Keyboard events module: Imports successfully', 'green');
  } catch (e) {
    log('❌ Keyboard events module: Import failed', 'red');
    log(`   Error: ${e.message}`, 'yellow');
    allValid = false;
  }

  try {
    const fixturesModule = await import(pathToFileURL(resolve(baseDir, 'fixtures/key-combinations.ts')).href);
    log('✅ Fixtures module: Imports successfully', 'green');
  } catch (e) {
    log('❌ Fixtures module: Import failed', 'red');
    log(`   Error: ${e.message}`, 'yellow');
    allValid = false;
  }

  // Final status
  log('\n📊 Validation Results:', 'bold');
  if (allValid) {
    log('🎉 All infrastructure components are valid and ready!', 'green');
    log('\nNext steps:', 'blue');
    log('  • Run: npm run test:keyboard-integration', 'reset');
    log('  • Check the example test in keyboard-infrastructure.test.ts', 'reset');
    log('  • Read the documentation in README.md', 'reset');
  } else {
    log('⚠️  Some infrastructure components are missing or invalid.', 'red');
    log('Please ensure all required files exist and dependencies are installed.', 'yellow');
  }

  return allValid;
}

// Run validation if this file is executed directly
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateInfrastructure()
    .then(valid => process.exit(valid ? 0 : 1))
    .catch(error => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}

export { validateInfrastructure };