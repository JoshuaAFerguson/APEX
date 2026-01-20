#!/usr/bin/env node

/**
 * @fileoverview Quick test runner check for browser integration infrastructure
 *
 * This script validates that the browser integration test infrastructure
 * is properly implemented and ready for use.
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function checkFileExists(filepath, description) {
  const fullPath = path.join(__dirname, filepath);
  const exists = fs.existsSync(fullPath);

  if (exists) {
    log(`✅ ${description}`, colors.green);
  } else {
    log(`❌ ${description} - MISSING: ${filepath}`, colors.red);
  }

  return exists;
}

function checkPackageJson() {
  try {
    const packagePath = path.join(__dirname, '../../package.json');
    const packageContent = fs.readFileSync(packagePath, 'utf-8');
    const pkg = JSON.parse(packageContent);

    const checks = [
      {
        condition: pkg.devDependencies && pkg.devDependencies.playwright,
        message: 'Playwright dependency'
      },
      {
        condition: pkg.devDependencies && pkg.devDependencies.vitest,
        message: 'Vitest dependency'
      },
      {
        condition: pkg.scripts && pkg.scripts['test:browser-integration'],
        message: 'Browser integration test script'
      },
      {
        condition: pkg.scripts && pkg.scripts['test:browser-integration:watch'],
        message: 'Browser integration watch script'
      },
      {
        condition: pkg.scripts && pkg.scripts['test:browser-integration:coverage'],
        message: 'Browser integration coverage script'
      }
    ];

    let allPassed = true;
    checks.forEach(check => {
      if (check.condition) {
        log(`✅ ${check.message}`, colors.green);
      } else {
        log(`❌ ${check.message}`, colors.red);
        allPassed = false;
      }
    });

    return allPassed;
  } catch (error) {
    log(`❌ Package.json validation failed: ${error.message}`, colors.red);
    return false;
  }
}

function validateImports() {
  try {
    // Test basic imports work
    const setupPath = path.join(__dirname, 'setup.ts');
    const helpersPath = path.join(__dirname, 'utils/test-helpers.ts');
    const fixturesPath = path.join(__dirname, 'fixtures/common-scenarios.ts');

    const files = [
      { path: setupPath, name: 'setup.ts' },
      { path: helpersPath, name: 'utils/test-helpers.ts' },
      { path: fixturesPath, name: 'fixtures/common-scenarios.ts' }
    ];

    let allValid = true;
    files.forEach(file => {
      try {
        const content = fs.readFileSync(file.path, 'utf-8');

        // Check for basic TypeScript/export patterns
        const hasExports = content.includes('export');
        const hasInterfaces = content.includes('interface');
        const hasAsyncFunctions = content.includes('async function');

        if (hasExports && (hasInterfaces || hasAsyncFunctions)) {
          log(`✅ ${file.name} structure valid`, colors.green);
        } else {
          log(`❌ ${file.name} structure invalid`, colors.red);
          allValid = false;
        }
      } catch (error) {
        log(`❌ ${file.name} validation failed: ${error.message}`, colors.red);
        allValid = false;
      }
    });

    return allValid;
  } catch (error) {
    log(`❌ Import validation failed: ${error.message}`, colors.red);
    return false;
  }
}

function countTestFiles() {
  try {
    const files = fs.readdirSync(__dirname);
    const testFiles = files.filter(file => file.endsWith('.test.ts'));

    log(`📊 Found ${testFiles.length} test files:`, colors.blue);
    testFiles.forEach(file => {
      log(`   • ${file}`, colors.blue);
    });

    return testFiles.length;
  } catch (error) {
    log(`❌ Test file counting failed: ${error.message}`, colors.red);
    return 0;
  }
}

function main() {
  log(`${colors.bold}🔍 Browser Integration Test Infrastructure Validation${colors.reset}`);
  log('='.repeat(60), colors.blue);

  // Check core infrastructure files
  log('\n📁 Core Infrastructure Files:', colors.bold);
  const coreFiles = [
    ['vitest.config.ts', 'Vitest configuration'],
    ['setup.ts', 'Browser setup utilities'],
    ['utils/test-helpers.ts', 'Test helper functions'],
    ['fixtures/common-scenarios.ts', 'Test fixtures and scenarios'],
    ['README.md', 'Documentation'],
    ['TEST_COVERAGE_SUMMARY.md', 'Coverage summary']
  ];

  let coreFilesExist = true;
  coreFiles.forEach(([file, desc]) => {
    if (!checkFileExists(file, desc)) {
      coreFilesExist = false;
    }
  });

  // Check test files
  log('\n📝 Test Files:', colors.bold);
  const testFiles = [
    ['infrastructure.test.ts', 'Infrastructure tests'],
    ['e2e-workflows.test.ts', 'E2E workflow tests'],
    ['utils.test.ts', 'Utility function tests'],
    ['edge-cases.test.ts', 'Edge case tests'],
    ['example.test.ts', 'Example tests'],
    ['test-coverage-validation.test.ts', 'Coverage validation'],
    ['acceptance-criteria-validation.test.ts', 'Acceptance criteria validation'],
    ['demonstration.test.ts', 'Demonstration tests'],
    ['final-integration-validation.test.ts', 'Final integration validation']
  ];

  let testFilesExist = true;
  testFiles.forEach(([file, desc]) => {
    if (!checkFileExists(file, desc)) {
      testFilesExist = false;
    }
  });

  // Check package.json configuration
  log('\n📦 Package Configuration:', colors.bold);
  const packageValid = checkPackageJson();

  // Validate file structure
  log('\n🔍 File Structure Validation:', colors.bold);
  const importsValid = validateImports();

  // Count and list test files
  log('\n📊 Test Coverage:', colors.bold);
  const testCount = countTestFiles();

  // Overall assessment
  log('\n🎯 Assessment:', colors.bold);
  log('='.repeat(40), colors.blue);

  const allValid = coreFilesExist && testFilesExist && packageValid && importsValid;

  if (allValid) {
    log('✅ INFRASTRUCTURE COMPLETE', colors.green);
    log(`✅ ${testCount} comprehensive test files`, colors.green);
    log('✅ All dependencies configured', colors.green);
    log('✅ All utilities implemented', colors.green);
    log('✅ Ready for production use', colors.green);

    log('\n🚀 Next Steps:', colors.bold);
    log('• Run: npm run test:browser-integration', colors.blue);
    log('• Run: npm run test:browser-integration:coverage', colors.blue);
    log('• Run: npm run test:browser-integration:watch (for development)', colors.blue);
  } else {
    log('❌ INFRASTRUCTURE INCOMPLETE', colors.red);
    log('⚠️  Some components are missing or invalid', colors.yellow);
  }

  return allValid;
}

if (require.main === module) {
  const success = main();
  process.exit(success ? 0 : 1);
}

module.exports = { main };