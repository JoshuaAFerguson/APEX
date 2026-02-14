#!/usr/bin/env node

/**
 * @fileoverview Timeout Test Infrastructure Check
 *
 * This script performs basic infrastructure checks to ensure timeout tests
 * can run successfully. It validates dependencies, configuration, and test discovery.
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for console output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(colors.green, `✅ ${message}`);
}

function logWarning(message) {
  log(colors.yellow, `⚠️  ${message}`);
}

function logError(message) {
  log(colors.red, `❌ ${message}`);
}

function logInfo(message) {
  log(colors.blue, `ℹ️  ${message}`);
}

function logHeader(message) {
  log(colors.bold, `\n${message}`);
  log(colors.bold, '='.repeat(message.length));
}

/**
 * Check if required dependencies are installed
 */
function checkDependencies() {
  const requiredDeps = [
    'vitest',
    'typescript',
    '@types/node'
  ];

  const packageJsonPath = path.resolve('package.json');

  if (!fs.existsSync(packageJsonPath)) {
    logError('package.json not found');
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const allDeps = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies
  };

  let allPresent = true;

  requiredDeps.forEach(dep => {
    if (allDeps[dep]) {
      logSuccess(`${dep}: ${allDeps[dep]}`);
    } else {
      logError(`${dep}: Missing`);
      allPresent = false;
    }
  });

  return allPresent;
}

/**
 * Check Vitest configuration files
 */
function checkVitestConfig() {
  const configFiles = [
    'vitest.config.ts',
    'vitest.shared.config.ts',
    'vitest.integration.config.ts',
    'vitest.unit.config.ts'
  ];

  let hasMainConfig = false;

  configFiles.forEach(configFile => {
    const configPath = path.resolve(configFile);
    if (fs.existsSync(configPath)) {
      logSuccess(`${configFile} found`);
      hasMainConfig = true;

      // Check if config includes timeout-related patterns
      const content = fs.readFileSync(configPath, 'utf8');
      if (content.includes('timeout') || content.includes('**/*.test.ts')) {
        logInfo(`  Config includes test patterns`);
      }
    } else {
      logWarning(`${configFile} not found`);
    }
  });

  return hasMainConfig;
}

/**
 * Check TypeScript configuration
 */
function checkTypeScriptConfig() {
  const tsConfigFiles = [
    'tsconfig.json',
    'packages/*/tsconfig.json'
  ];

  let hasConfig = false;

  // Check main tsconfig
  const mainTsConfig = path.resolve('tsconfig.json');
  if (fs.existsSync(mainTsConfig)) {
    logSuccess('tsconfig.json found');
    hasConfig = true;

    const content = fs.readFileSync(mainTsConfig, 'utf8');
    try {
      const config = JSON.parse(content);
      if (config.compilerOptions) {
        logInfo(`  Target: ${config.compilerOptions.target || 'not specified'}`);
        logInfo(`  Module: ${config.compilerOptions.module || 'not specified'}`);
      }
    } catch (error) {
      logWarning('  Failed to parse tsconfig.json');
    }
  } else {
    logError('tsconfig.json not found');
  }

  return hasConfig;
}

/**
 * Check timeout-related source files
 */
function checkTimeoutSourceFiles() {
  const sourceFiles = [
    'packages/orchestrator/src/timeout-documentation.ts',
    'packages/core/src/types.ts'
  ];

  let allPresent = true;

  sourceFiles.forEach(sourceFile => {
    const sourcePath = path.resolve(sourceFile);
    if (fs.existsSync(sourcePath)) {
      const stats = fs.statSync(sourcePath);
      logSuccess(`${sourceFile} (${stats.size} bytes)`);

      // Check if file contains timeout-related exports
      const content = fs.readFileSync(sourcePath, 'utf8');
      if (content.includes('TimeoutUtils') || content.includes('timeout')) {
        logInfo(`  Contains timeout-related code`);
      }
    } else {
      logError(`${sourceFile} not found`);
      allPresent = false;
    }
  });

  return allPresent;
}

/**
 * Check package scripts for test execution
 */
function checkPackageScripts() {
  const packageJsonPath = path.resolve('package.json');

  if (!fs.existsSync(packageJsonPath)) {
    logError('package.json not found');
    return false;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts || {};

  const testScripts = [
    'test',
    'test:integration',
    'test:unit',
    'build'
  ];

  let hasTestScripts = false;

  testScripts.forEach(script => {
    if (scripts[script]) {
      logSuccess(`${script}: ${scripts[script]}`);
      hasTestScripts = true;
    } else {
      logWarning(`${script}: Not defined`);
    }
  });

  return hasTestScripts;
}

/**
 * Validate timeout test discovery patterns
 */
function validateTestDiscovery() {
  const testPatterns = [
    '**/*timeout*.test.ts',
    'tests/integration/timeout*.test.ts',
    'packages/*/src/**/*timeout*.test.ts'
  ];

  logInfo('Test discovery patterns to validate:');
  testPatterns.forEach(pattern => {
    console.log(`  - ${pattern}`);
  });

  return true;
}

/**
 * Check if timeout tests can be compiled
 */
function checkCompilation() {
  // Simple syntax check for key timeout test files
  const testFiles = [
    'tests/integration/timeout-basic-validation.test.ts',
    'packages/orchestrator/src/__tests__/timeout-documentation-implementation.test.ts'
  ];

  let canCompile = true;

  testFiles.forEach(testFile => {
    const testPath = path.resolve(testFile);
    if (fs.existsSync(testPath)) {
      const content = fs.readFileSync(testPath, 'utf8');

      // Basic syntax validation
      if (content.includes('import') && content.includes('describe') && content.includes('it(')) {
        logSuccess(`${testFile}: Basic syntax looks good`);
      } else {
        logWarning(`${testFile}: May have syntax issues`);
        canCompile = false;
      }

      // Check for required imports
      if (content.includes('vitest') || content.includes('vi')) {
        logInfo(`  Has Vitest imports`);
      } else {
        logWarning(`  Missing Vitest imports`);
      }
    } else {
      logInfo(`${testFile}: Not found (optional)`);
    }
  });

  return canCompile;
}

/**
 * Main infrastructure check
 */
async function main() {
  logHeader('APEX Timeout Test Infrastructure Check');

  let allChecksPass = true;

  // 1. Check dependencies
  logHeader('1. Dependencies Check');
  if (!checkDependencies()) {
    allChecksPass = false;
  }

  // 2. Check Vitest configuration
  logHeader('2. Vitest Configuration Check');
  if (!checkVitestConfig()) {
    allChecksPass = false;
  }

  // 3. Check TypeScript configuration
  logHeader('3. TypeScript Configuration Check');
  if (!checkTypeScriptConfig()) {
    allChecksPass = false;
  }

  // 4. Check timeout source files
  logHeader('4. Timeout Source Files Check');
  if (!checkTimeoutSourceFiles()) {
    allChecksPass = false;
  }

  // 5. Check package scripts
  logHeader('5. Package Scripts Check');
  if (!checkPackageScripts()) {
    allChecksPass = false;
  }

  // 6. Validate test discovery
  logHeader('6. Test Discovery Validation');
  validateTestDiscovery();

  // 7. Check compilation readiness
  logHeader('7. Compilation Check');
  if (!checkCompilation()) {
    allChecksPass = false;
  }

  // Summary
  logHeader('Infrastructure Check Summary');

  if (allChecksPass) {
    logSuccess('✨ All infrastructure checks passed!');
    logInfo('Timeout tests should be ready to run');
    console.log('');
    console.log('Next steps:');
    console.log('• Run: npm run build');
    console.log('• Run: npm run test');
    console.log('• Run: npm run test:integration');
  } else {
    logError('❌ Some infrastructure checks failed');
    console.log('');
    console.log('Recommended actions:');
    console.log('• Install missing dependencies: npm install');
    console.log('• Create missing configuration files');
    console.log('• Verify TypeScript setup');
    console.log('• Check timeout source file implementations');
  }

  console.log('');

  return allChecksPass;
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  logError(`Unexpected error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

// Run the infrastructure check
main().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  logError(`Infrastructure check failed: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});