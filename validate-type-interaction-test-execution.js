#!/usr/bin/env node

/**
 * @fileoverview Type Interaction Test Execution Validation
 *
 * This script validates that the type interaction tests can be executed properly:
 * - Verifies test runner configuration
 * - Checks dependencies are available
 * - Simulates test execution without actually running browser tests
 * - Validates all components are ready for testing
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

console.log('🧪 VALIDATING TYPE INTERACTION TEST EXECUTION\n');

const testConfig = {
  baseDir: process.cwd(),
  testDir: path.join(process.cwd(), 'tests', 'browser-integration'),
  testFiles: [
    'type-interactions.integration.test.ts',
    'type-interactions-validation.test.ts'
  ],
  dependencies: [
    'vitest',
    'playwright',
    '@types/node'
  ]
};

let validationResults = {
  configuration: [],
  dependencies: [],
  testability: [],
  execution: []
};

function logResult(category, test, passed, details = null) {
  const status = passed ? '✅' : '❌';
  console.log(`  ${status} ${test}`);

  if (details && !passed) {
    console.log(`    ${details}`);
  }

  validationResults[category].push({
    test,
    passed,
    details
  });
}

async function runCommand(command, args = [], timeout = 10000) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => stdout += data.toString());
    child.stderr?.on('data', (data) => stderr += data.toString());

    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
        success: code === 0
      });
    });

    setTimeout(() => {
      child.kill();
      resolve({
        code: -1,
        stdout,
        stderr: stderr + '\nTimeout',
        success: false
      });
    }, timeout);
  });
}

// 1. Test Configuration Validation
async function validateConfiguration() {
  console.log('\n⚙️  Validating Test Configuration...');

  // Check package.json scripts
  const packagePath = path.join(testConfig.baseDir, 'package.json');
  let packageContent;

  try {
    packageContent = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  } catch (error) {
    logResult('configuration', 'package.json readable', false, error.message);
    return;
  }

  const scripts = packageContent.scripts || {};
  const requiredScripts = [
    'test:browser-integration',
    'test:browser-integration:watch',
    'test:browser-integration:coverage'
  ];

  requiredScripts.forEach(script => {
    logResult('configuration', `NPM script '${script}'`, !!scripts[script]);
  });

  // Check Vitest configuration
  const vitestConfigPath = path.join(testConfig.testDir, 'vitest.config.ts');
  const vitestConfigExists = fs.existsSync(vitestConfigPath);
  logResult('configuration', 'Vitest configuration exists', vitestConfigExists);

  if (vitestConfigExists) {
    const configContent = fs.readFileSync(vitestConfigPath, 'utf8');
    const hasRequiredSettings = [
      'testTimeout',
      'environment: \'node\'',
      'setupFiles'
    ].every(setting => configContent.includes(setting));

    logResult('configuration', 'Vitest config properly configured', hasRequiredSettings);
  }

  // Check setup file
  const setupPath = path.join(testConfig.testDir, 'setup.ts');
  logResult('configuration', 'Test setup file exists', fs.existsSync(setupPath));
}

// 2. Dependencies Validation
async function validateDependencies() {
  console.log('\n📦 Validating Dependencies...');

  for (const dep of testConfig.dependencies) {
    try {
      require.resolve(dep);
      logResult('dependencies', `${dep} available`, true);
    } catch (error) {
      logResult('dependencies', `${dep} missing`, false, 'Run npm install');
    }
  }

  // Test Playwright installation specifically
  try {
    const playwrightResult = await runCommand('npx', ['playwright', '--version']);
    logResult('dependencies', 'Playwright executable available', playwrightResult.success);
  } catch {
    logResult('dependencies', 'Playwright executable', false, 'May need playwright install');
  }

  // Test Vitest availability
  try {
    const vitestResult = await runCommand('npx', ['vitest', '--version']);
    logResult('dependencies', 'Vitest executable available', vitestResult.success);
  } catch {
    logResult('dependencies', 'Vitest executable', false, 'Check Vitest installation');
  }
}

// 3. Test File Validation
async function validateTestability() {
  console.log('\n📝 Validating Test Files...');

  testConfig.testFiles.forEach(testFile => {
    const filePath = path.join(testConfig.testDir, testFile);
    const exists = fs.existsSync(filePath);

    logResult('testability', `${testFile} exists`, exists);

    if (exists) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Check for basic test structure
        const hasImports = content.includes('import') || content.includes('require');
        logResult('testability', `${testFile} has imports`, hasImports);

        const hasTests = content.includes('it(') || content.includes('test(');
        logResult('testability', `${testFile} contains tests`, hasTests);

        const hasDescribe = content.includes('describe(');
        logResult('testability', `${testFile} is organized`, hasDescribe);

        // Check for async/await usage
        const hasAsyncTests = content.includes('async') && content.includes('await');
        logResult('testability', `${testFile} uses async/await`, hasAsyncTests);

      } catch (error) {
        logResult('testability', `${testFile} readable`, false, error.message);
      }
    }
  });

  // Check helper utilities
  const helpersPath = path.join(testConfig.testDir, 'utils', 'type-interaction-helpers.ts');
  const helpersExist = fs.existsSync(helpersPath);
  logResult('testability', 'Helper utilities exist', helpersExist);

  if (helpersExist) {
    const helpersContent = fs.readFileSync(helpersPath, 'utf8');
    const hasExports = helpersContent.includes('export');
    logResult('testability', 'Helper utilities export functions', hasExports);
  }

  // Check HTML fixtures
  const fixturesPath = path.join(testConfig.testDir, 'fixtures', 'type-interaction-test-page.html');
  const fixturesExist = fs.existsSync(fixturesPath);
  logResult('testability', 'HTML test fixtures exist', fixturesExist);

  if (fixturesExist) {
    const htmlContent = fs.readFileSync(fixturesPath, 'utf8');
    const hasInputs = htmlContent.includes('<input') || htmlContent.includes('<textarea');
    logResult('testability', 'HTML fixtures contain input elements', hasInputs);
  }
}

// 4. Execution Readiness Validation
async function validateExecution() {
  console.log('\n🚀 Validating Execution Readiness...');

  // Test TypeScript compilation
  console.log('  🔧 Testing TypeScript compilation...');
  const tscResult = await runCommand('npx', ['tsc', '--noEmit', '--skipLibCheck']);

  if (tscResult.success) {
    logResult('execution', 'TypeScript compilation', true);
  } else {
    // Try compiling just the test files
    const testFileResult = await runCommand('npx', ['tsc', '--noEmit',
      path.join(testConfig.testDir, 'type-interactions.integration.test.ts')]);
    logResult('execution', 'Test file TypeScript compilation', testFileResult.success);
  }

  // Test dry-run of vitest configuration
  console.log('  ⚡ Testing Vitest configuration...');
  const vitestDryRun = await runCommand('npx', [
    'vitest',
    'run',
    '--config',
    path.join(testConfig.testDir, 'vitest.config.ts'),
    '--reporter=verbose',
    '--run',
    '--passWithNoTests'
  ]);

  logResult('execution', 'Vitest configuration loads', vitestDryRun.success);

  // Check if we can load the test environment
  console.log('  🌐 Testing environment setup...');
  const envTest = `
    try {
      const { defineConfig } = require('vitest/config');
      console.log('✅ Vitest config can be loaded');
      process.exit(0);
    } catch (error) {
      console.error('❌ Failed to load vitest config:', error.message);
      process.exit(1);
    }
  `;

  const envResult = await runCommand('node', ['-e', envTest]);
  logResult('execution', 'Test environment can be loaded', envResult.success);
}

// Generate final report
function generateReport() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 VALIDATION SUMMARY');
  console.log('='.repeat(70));

  let totalPassed = 0;
  let totalFailed = 0;

  Object.entries(validationResults).forEach(([category, results]) => {
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(`\n${category.toUpperCase()}:`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);

    if (failed > 0) {
      console.log(`  Issues:`);
      results.filter(r => !r.passed).forEach(result => {
        console.log(`    - ${result.test}${result.details ? ': ' + result.details : ''}`);
      });
    }

    totalPassed += passed;
    totalFailed += failed;
  });

  console.log('\n' + '-'.repeat(50));
  console.log(`🎯 OVERALL VALIDATION:`);
  console.log(`  ✅ Total Passed: ${totalPassed}`);
  console.log(`  ❌ Total Failed: ${totalFailed}`);
  console.log(`  📊 Success Rate: ${Math.round((totalPassed / (totalPassed + totalFailed)) * 100)}%`);

  const readinessScore = Math.round((totalPassed / (totalPassed + totalFailed)) * 100);

  console.log('\n🏁 TEST EXECUTION READINESS:');
  if (readinessScore >= 90) {
    console.log('  🎉 EXCELLENT - Tests are ready to execute');
  } else if (readinessScore >= 75) {
    console.log('  ✅ GOOD - Tests should execute successfully');
  } else if (readinessScore >= 50) {
    console.log('  ⚠️  ACCEPTABLE - Tests may execute with minor issues');
  } else {
    console.log('  ❌ POOR - Significant issues need resolution');
  }

  return readinessScore >= 75;
}

// Main execution
async function main() {
  console.log(`📂 Base Directory: ${testConfig.baseDir}`);
  console.log(`🧪 Test Directory: ${testConfig.testDir}`);
  console.log(`📋 Test Files: ${testConfig.testFiles.length}`);

  try {
    await validateConfiguration();
    await validateDependencies();
    await validateTestability();
    await validateExecution();

    const success = generateReport();

    if (success) {
      console.log('\n✨ The type interaction test infrastructure is ready for execution!');
      console.log('You can run tests with: npm run test:browser-integration');
    }

    return success;

  } catch (error) {
    console.error('\n💥 Validation failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  main().then(success => {
    process.exit(success ? 0 : 1);
  });
}

module.exports = { validateConfiguration, validateDependencies, validateTestability, validateExecution };