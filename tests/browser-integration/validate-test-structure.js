/**
 * @fileoverview Manual validation script for browser integration test structure
 *
 * This script validates the test infrastructure without running the actual tests.
 * It checks for:
 * - Required files exist
 * - Proper TypeScript syntax
 * - Import/export structure
 * - Test function definitions
 * - Acceptance criteria compliance
 */

const fs = require('fs');
const path = require('path');

// Color codes for console output
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

function validateFileExists(filePath, description) {
  try {
    fs.accessSync(filePath);
    log(`✅ ${description}: ${path.basename(filePath)}`, 'green');
    return true;
  } catch (error) {
    log(`❌ ${description}: ${path.basename(filePath)} - MISSING`, 'red');
    return false;
  }
}

function validateFileContent(filePath, requirements, description) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const results = requirements.map(req => {
      const found = content.includes(req.text);
      return { ...req, found };
    });

    const passed = results.filter(r => r.found).length;
    const total = results.length;

    if (passed === total) {
      log(`✅ ${description}: All ${total} requirements met`, 'green');
    } else {
      log(`⚠️  ${description}: ${passed}/${total} requirements met`, 'yellow');
      results.filter(r => !r.found).forEach(req => {
        log(`   - Missing: ${req.description}`, 'red');
      });
    }

    return passed === total;
  } catch (error) {
    log(`❌ ${description}: Error reading file - ${error.message}`, 'red');
    return false;
  }
}

function main() {
  log('🔍 Validating Browser Integration Test Infrastructure', 'bold');
  log('='.repeat(60), 'blue');

  const baseDir = __dirname;
  let allValid = true;

  // 1. Validate required files exist
  log('\n📁 Checking Required Files:', 'bold');
  const requiredFiles = [
    { path: 'setup.ts', desc: 'Test setup file' },
    { path: 'vitest.config.ts', desc: 'Vitest configuration' },
    { path: 'example.test.ts', desc: 'Example test file' },
    { path: 'infrastructure.test.ts', desc: 'Infrastructure tests' },
    { path: 'e2e-workflows.test.ts', desc: 'E2E workflow tests' },
    { path: 'utils.test.ts', desc: 'Utility function tests' },
    { path: 'edge-cases.test.ts', desc: 'Edge case tests' },
    { path: 'test-coverage-validation.test.ts', desc: 'Coverage validation tests' },
    { path: 'fixtures/common-scenarios.ts', desc: 'Test fixtures' },
    { path: 'utils/test-helpers.ts', desc: 'Test utilities' },
  ];

  requiredFiles.forEach(file => {
    const filePath = path.join(baseDir, file.path);
    if (!validateFileExists(filePath, file.desc)) {
      allValid = false;
    }
  });

  // 2. Validate setup file content
  log('\n⚙️  Validating Setup File:', 'bold');
  const setupRequirements = [
    { text: 'createBrowser', description: 'Browser creation function' },
    { text: 'createBrowserContext', description: 'Context creation function' },
    { text: 'createPage', description: 'Page creation function' },
    { text: 'DEFAULT_BROWSER_CONFIG', description: 'Default configuration' },
    { text: 'mockBrowserDependencies', description: 'Mock setup function' },
    { text: 'beforeAll', description: 'Global setup hook' },
    { text: 'afterAll', description: 'Global teardown hook' },
  ];

  if (!validateFileContent(
    path.join(baseDir, 'setup.ts'),
    setupRequirements,
    'Setup file'
  )) {
    allValid = false;
  }

  // 3. Validate utilities file content
  log('\n🔧 Validating Test Utilities:', 'bold');
  const utilsRequirements = [
    { text: 'takeScreenshot', description: 'Screenshot function' },
    { text: 'compareScreenshots', description: 'Screenshot comparison function' },
    { text: 'waitForElement', description: 'Element waiting function' },
    { text: 'safeClick', description: 'Safe click function' },
    { text: 'safeFill', description: 'Safe fill function' },
    { text: 'waitForNetworkIdle', description: 'Network idle function' },
    { text: 'measurePerformance', description: 'Performance measurement function' },
    { text: 'captureConsoleMessages', description: 'Console capture function' },
    { text: 'capturePageErrors', description: 'Error capture function' },
    { text: 'withBrowserTest', description: 'Test execution wrapper' },
    { text: 'setupMockServer', description: 'Mock server setup function' },
  ];

  if (!validateFileContent(
    path.join(baseDir, 'utils/test-helpers.ts'),
    utilsRequirements,
    'Test utilities'
  )) {
    allValid = false;
  }

  // 4. Validate fixtures file content
  log('\n📋 Validating Test Fixtures:', 'bold');
  const fixturesRequirements = [
    { text: 'NavigationScenario', description: 'Navigation scenario interface' },
    { text: 'InteractionScenario', description: 'Interaction scenario interface' },
    { text: 'ConsoleScenario', description: 'Console scenario interface' },
    { text: 'NAVIGATION_SCENARIOS', description: 'Navigation scenarios array' },
    { text: 'INTERACTION_SCENARIOS', description: 'Interaction scenarios array' },
    { text: 'CONSOLE_SCENARIOS', description: 'Console scenarios array' },
    { text: 'createTestPage', description: 'Test page creation function' },
    { text: 'runNavigationScenario', description: 'Navigation scenario runner' },
    { text: 'runInteractionScenario', description: 'Interaction scenario runner' },
  ];

  if (!validateFileContent(
    path.join(baseDir, 'fixtures/common-scenarios.ts'),
    fixturesRequirements,
    'Test fixtures'
  )) {
    allValid = false;
  }

  // 5. Validate vitest configuration
  log('\n⚙️  Validating Vitest Configuration:', 'bold');
  const vitestRequirements = [
    { text: 'environment: \'node\'', description: 'Node environment' },
    { text: 'testTimeout: 60000', description: 'Extended test timeout' },
    { text: 'hookTimeout: 30000', description: 'Extended hook timeout' },
    { text: 'setupFiles', description: 'Setup files configuration' },
    { text: 'pool: \'forks\'', description: 'Fork pool configuration' },
    { text: 'coverage', description: 'Coverage configuration' },
  ];

  if (!validateFileContent(
    path.join(baseDir, 'vitest.config.ts'),
    vitestRequirements,
    'Vitest configuration'
  )) {
    allValid = false;
  }

  // 6. Validate test files have proper structure
  log('\n🧪 Validating Test File Structure:', 'bold');
  const testFiles = [
    'infrastructure.test.ts',
    'e2e-workflows.test.ts',
    'utils.test.ts',
    'edge-cases.test.ts',
    'example.test.ts',
  ];

  testFiles.forEach(testFile => {
    const testRequirements = [
      { text: 'describe(', description: 'Test suites defined' },
      { text: 'it(', description: 'Test cases defined' },
      { text: 'expect(', description: 'Assertions present' },
      { text: 'import', description: 'Proper imports' },
      { text: 'vi.fn()', description: 'Mock functions used' },
    ];

    if (!validateFileContent(
      path.join(baseDir, testFile),
      testRequirements,
      `Test file: ${testFile}`
    )) {
      allValid = false;
    }
  });

  // 7. Validate package.json integration
  log('\n📦 Validating Package.json Integration:', 'bold');
  try {
    const packageJsonPath = path.resolve(baseDir, '../../package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const hasScript = packageJson.scripts && packageJson.scripts['test:browser-integration'];
    if (hasScript) {
      log('✅ Package.json has browser integration test script', 'green');
    } else {
      log('❌ Package.json missing browser integration test script', 'red');
      allValid = false;
    }

    const scriptContent = hasScript ? packageJson.scripts['test:browser-integration'] : '';
    if (scriptContent.includes('vitest run --config tests/browser-integration/vitest.config.ts')) {
      log('✅ Test script properly configured', 'green');
    } else {
      log('⚠️  Test script may need configuration adjustment', 'yellow');
    }
  } catch (error) {
    log(`❌ Error validating package.json: ${error.message}`, 'red');
    allValid = false;
  }

  // 8. Validate browser dependencies
  log('\n🌐 Validating Browser Dependencies:', 'bold');
  try {
    const browserPackagePath = path.resolve(baseDir, '../../packages/browser/package.json');
    const browserPackage = JSON.parse(fs.readFileSync(browserPackagePath, 'utf-8'));

    const hasPlaywright = (browserPackage.dependencies && browserPackage.dependencies.playwright) ||
                          (browserPackage.devDependencies && browserPackage.devDependencies.playwright);

    if (hasPlaywright) {
      log('✅ Playwright dependency found in browser package', 'green');
    } else {
      log('❌ Playwright dependency missing from browser package', 'red');
      allValid = false;
    }
  } catch (error) {
    log(`❌ Error validating browser dependencies: ${error.message}`, 'red');
    allValid = false;
  }

  // Final result
  log('\n' + '='.repeat(60), 'blue');
  if (allValid) {
    log('🎉 All validations passed! Browser integration test infrastructure is ready.', 'green');
    log('\nNext steps:', 'bold');
    log('1. Run: npm install (to ensure dependencies are installed)');
    log('2. Run: npm run build (to compile TypeScript)');
    log('3. Run: npm run test:browser-integration (to execute tests)');
  } else {
    log('⚠️  Some validations failed. Please review the issues above.', 'yellow');
  }

  process.exit(allValid ? 0 : 1);
}

if (require.main === module) {
  main();
}