#!/usr/bin/env node

/**
 * @fileoverview Validation script for unified test configuration
 *
 * This script performs comprehensive validation of:
 * - Test configuration files exist and are valid
 * - Test discovery patterns work correctly
 * - All test types can be executed
 * - npm scripts are properly configured
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(message, 'blue');
  log('='.repeat(60), 'blue');
}

function logSection(message) {
  log(`\n${'-'.repeat(40)}`, 'cyan');
  log(message, 'cyan');
  log('-'.repeat(40), 'cyan');
}

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    log(`✅ ${description}: ${filePath}`, 'green');
    return true;
  } else {
    log(`❌ ${description}: ${filePath} (NOT FOUND)`, 'red');
    return false;
  }
}

function runCommand(command, description, options = {}) {
  const { silent = false, timeout = 30000 } = options;

  try {
    if (!silent) log(`🔄 ${description}...`, 'yellow');

    const result = execSync(command, {
      encoding: 'utf8',
      timeout,
      cwd: process.cwd()
    });

    if (!silent) log(`✅ ${description} - SUCCESS`, 'green');
    return { success: true, output: result };
  } catch (error) {
    if (!silent) log(`❌ ${description} - FAILED`, 'red');
    if (!silent && error.stdout) log(error.stdout, 'yellow');
    if (!silent && error.stderr) log(error.stderr, 'red');
    return { success: false, error: error.message, output: error.stdout || error.stderr };
  }
}

async function main() {
  let totalChecks = 0;
  let passedChecks = 0;

  logHeader('APEX Unified Test Configuration Validation');

  // 1. Check configuration files
  logSection('Configuration Files');
  const configFiles = [
    { path: 'vitest.config.ts', desc: 'Main Vitest config' },
    { path: 'vitest.shared.config.ts', desc: 'Shared config utilities' },
    { path: 'vitest.unit.config.ts', desc: 'Unit test config' },
    { path: 'vitest.integration.config.ts', desc: 'Integration test config' },
    { path: 'vitest.e2e.config.ts', desc: 'E2E test config' },
    { path: 'vitest.browser.config.ts', desc: 'Browser test config' },
    { path: 'scripts/unified-test-runner.js', desc: 'Unified test runner' },
    { path: 'package.json', desc: 'Package configuration' }
  ];

  for (const { path: filePath, desc } of configFiles) {
    totalChecks++;
    if (checkFile(path.join(process.cwd(), filePath), desc)) {
      passedChecks++;
    }
  }

  // 2. Check npm scripts
  logSection('npm Scripts Configuration');
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const requiredScripts = [
    'test:unified',
    'test:unified:e2e',
    'test:unified:unit',
    'test:unified:integration',
    'test:unified:validate',
    'test:unified:list',
    'test:unified:marketplace'
  ];

  for (const script of requiredScripts) {
    totalChecks++;
    if (packageJson.scripts[script]) {
      log(`✅ npm script: ${script}`, 'green');
      passedChecks++;
    } else {
      log(`❌ npm script: ${script} (MISSING)`, 'red');
    }
  }

  // 3. Test discovery validation
  logSection('Test Discovery Validation');

  const testTypes = ['e2e', 'unit', 'integration'];
  for (const type of testTypes) {
    totalChecks++;
    const result = runCommand(
      `node scripts/unified-test-runner.js --type=${type} --validate`,
      `${type} test discovery validation`,
      { timeout: 45000 }
    );

    if (result.success && result.output.includes('test discovery is working correctly')) {
      passedChecks++;
    }
  }

  // 4. List functionality validation
  logSection('Test Listing Functionality');

  for (const type of testTypes) {
    totalChecks++;
    const result = runCommand(
      `node scripts/unified-test-runner.js --type=${type} --list`,
      `${type} test listing`,
      { timeout: 30000 }
    );

    if (result.success && result.output.includes('Found')) {
      passedChecks++;
    }
  }

  // 5. Package filtering validation
  logSection('Package Filtering Validation');

  const packages = ['core', 'cli', 'orchestrator', 'api'];
  for (const pkg of packages.slice(0, 2)) { // Test just a couple to save time
    totalChecks++;
    const result = runCommand(
      `node scripts/unified-test-runner.js --package=${pkg} --list`,
      `Package filtering for ${pkg}`,
      { timeout: 20000 }
    );

    if (result.success) {
      passedChecks++;
    }
  }

  // 6. Pattern filtering validation
  logSection('Pattern Filtering Validation');

  totalChecks++;
  const marketplaceResult = runCommand(
    'node scripts/unified-test-runner.js --type=e2e --pattern=marketplace --list',
    'Marketplace pattern filtering',
    { timeout: 20000 }
  );

  if (marketplaceResult.success && marketplaceResult.output.includes('marketplace')) {
    passedChecks++;
  }

  // 7. Help system validation
  logSection('Help System Validation');

  totalChecks++;
  const helpResult = runCommand(
    'node scripts/unified-test-runner.js --help',
    'Help system',
    { timeout: 10000 }
  );

  if (helpResult.success && helpResult.output.includes('APEX Unified Test Runner')) {
    passedChecks++;
  }

  // 8. Error handling validation
  logSection('Error Handling Validation');

  totalChecks++;
  const errorResult = runCommand(
    'node scripts/unified-test-runner.js --type=invalid',
    'Invalid type error handling',
    { silent: true, timeout: 10000 }
  );

  if (!errorResult.success && errorResult.output.includes('Unknown test type')) {
    log('✅ Error handling for invalid test type - SUCCESS', 'green');
    passedChecks++;
  } else {
    log('❌ Error handling for invalid test type - FAILED', 'red');
  }

  // Final results
  logHeader('Validation Results Summary');

  const successRate = ((passedChecks / totalChecks) * 100).toFixed(1);

  log(`Total Checks: ${totalChecks}`);
  log(`Passed: ${passedChecks}`, passedChecks === totalChecks ? 'green' : 'yellow');
  log(`Failed: ${totalChecks - passedChecks}`, totalChecks === passedChecks ? 'green' : 'red');
  log(`Success Rate: ${successRate}%`, successRate === '100.0' ? 'green' : 'yellow');

  if (passedChecks === totalChecks) {
    log('\n🎉 All validation checks passed! The unified test configuration is working correctly.', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some validation checks failed. Please review the output above.', 'yellow');
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    log(`💥 Validation script failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { main };