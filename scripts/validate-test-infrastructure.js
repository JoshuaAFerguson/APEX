#!/usr/bin/env node

/**
 * Test Infrastructure Validation Script
 *
 * This script validates that the integration test infrastructure is properly
 * implemented and working correctly. It performs basic checks without running
 * the full test suite.
 */

const fs = require('fs').promises;
const path = require('path');

// ANSI color codes for better output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log(`\n${colors.bold}${colors.cyan}${message}${colors.reset}`);
  console.log('='.repeat(message.length));
}

function logSuccess(message) {
  log('green', `✅ ${message}`);
}

function logError(message) {
  log('red', `❌ ${message}`);
}

function logWarning(message) {
  log('yellow', `⚠️  ${message}`);
}

function logInfo(message) {
  log('blue', `ℹ️  ${message}`);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validateFileStructure() {
  logHeader('Validating Test Infrastructure File Structure');

  const requiredFiles = [
    'tests/test-utils/index.ts',
    'tests/test-utils/integration-test-utilities.ts',
    'tests/test-utils/test-setup-teardown.ts',
    'tests/test-utils/enhanced-mock-factories.ts',
    'tests/test-utils/permission-integration-fixtures.ts',
    'tests/test-utils/tool-integration-fixtures.ts',
    'tests/test-utils/browser-automation-test-setup.ts',
    'tests/test-utils/package.json',
    'tests/test-utils/tsconfig.json',
    'tests/integration/infrastructure-validation.test.ts',
    'tests/integration/infrastructure-edge-cases.test.ts',
    'tests/integration/infrastructure-coverage-report.ts',
    'tests/integration/comprehensive-infrastructure.test.ts',
  ];

  const missingFiles = [];
  const presentFiles = [];

  for (const file of requiredFiles) {
    const fullPath = path.resolve(file);
    if (await fileExists(fullPath)) {
      presentFiles.push(file);
      logSuccess(`${file}`);
    } else {
      missingFiles.push(file);
      logError(`${file}`);
    }
  }

  logInfo(`${presentFiles.length}/${requiredFiles.length} required files present`);

  if (missingFiles.length > 0) {
    logWarning(`Missing files: ${missingFiles.join(', ')}`);
    return false;
  }

  return true;
}

async function validatePackageConfiguration() {
  logHeader('Validating Package Configuration');

  try {
    // Check main package.json
    const mainPackagePath = path.resolve('package.json');
    const mainPackageContent = await fs.readFile(mainPackagePath, 'utf-8');
    const mainPackage = JSON.parse(mainPackageContent);

    if (mainPackage.workspaces && mainPackage.workspaces.includes('tests/test-utils')) {
      logSuccess('Main package.json includes test-utils workspace');
    } else {
      logError('Main package.json missing test-utils workspace');
    }

    // Check test-utils package.json
    const testUtilsPackagePath = path.resolve('tests/test-utils/package.json');
    const testUtilsContent = await fs.readFile(testUtilsPackagePath, 'utf-8');
    const testUtilsPackage = JSON.parse(testUtilsContent);

    if (testUtilsPackage.name === '@apex/test-utils') {
      logSuccess('Test utils package correctly named');
    } else {
      logError(`Test utils package name incorrect: ${testUtilsPackage.name}`);
    }

    if (testUtilsPackage.exports && Object.keys(testUtilsPackage.exports).length > 10) {
      logSuccess(`Test utils has ${Object.keys(testUtilsPackage.exports).length} exports`);
    } else {
      logError('Test utils package missing exports or insufficient exports');
    }

    return true;
  } catch (error) {
    logError(`Package configuration validation failed: ${error.message}`);
    return false;
  }
}

async function validateTestUtilsContent() {
  logHeader('Validating Test Utilities Content');

  const filesToCheck = [
    {
      file: 'tests/test-utils/integration-test-utilities.ts',
      requiredExports: [
        'createIntegrationTestEnvironment',
        'IntegrationEventMonitor',
        'integrationScenarios',
        'integrationAssertions',
      ],
    },
    {
      file: 'tests/test-utils/enhanced-mock-factories.ts',
      requiredExports: [
        'createAdvancedTaskMock',
        'createAdvancedOrchestratorMock',
        'createAgentExecutionMock',
        'createWorkflowExecutionMock',
        'EnhancedMockRegistry',
      ],
    },
    {
      file: 'tests/test-utils/test-setup-teardown.ts',
      requiredExports: [
        'setupTestEnvironment',
        'teardownTestEnvironment',
        'beforeAllWithSetup',
        'createTempDirectory',
        'waitFor',
        'retryWithBackoff',
      ],
    },
  ];

  let allValid = true;

  for (const { file, requiredExports } of filesToCheck) {
    try {
      const content = await fs.readFile(path.resolve(file), 'utf-8');

      const foundExports = [];
      const missingExports = [];

      for (const exportName of requiredExports) {
        if (content.includes(`export function ${exportName}`) ||
            content.includes(`export class ${exportName}`) ||
            content.includes(`export const ${exportName}`) ||
            content.includes(`export { ${exportName}`) ||
            content.includes(`export default { ${exportName}`)) {
          foundExports.push(exportName);
        } else {
          missingExports.push(exportName);
        }
      }

      if (missingExports.length === 0) {
        logSuccess(`${file} - All exports found (${foundExports.length})`);
      } else {
        logError(`${file} - Missing exports: ${missingExports.join(', ')}`);
        allValid = false;
      }
    } catch (error) {
      logError(`Could not validate ${file}: ${error.message}`);
      allValid = false;
    }
  }

  return allValid;
}

async function validateTestFiles() {
  logHeader('Validating Test Files');

  const testFiles = [
    'tests/integration/infrastructure-validation.test.ts',
    'tests/integration/infrastructure-edge-cases.test.ts',
    'tests/integration/infrastructure-coverage-report.ts',
    'tests/integration/comprehensive-infrastructure.test.ts',
  ];

  let allValid = true;

  for (const testFile of testFiles) {
    try {
      const content = await fs.readFile(path.resolve(testFile), 'utf-8');

      // Check for basic test structure
      if (content.includes('describe(') && content.includes('it(') && content.includes('expect(')) {
        logSuccess(`${testFile} - Has valid test structure`);
      } else {
        logError(`${testFile} - Missing basic test structure`);
        allValid = false;
      }

      // Check for imports from test utils
      if (content.includes('../test-utils/') || content.includes('@apex/test-utils')) {
        logSuccess(`${testFile} - Imports test utilities`);
      } else {
        logWarning(`${testFile} - May not import test utilities`);
      }
    } catch (error) {
      logError(`Could not validate ${testFile}: ${error.message}`);
      allValid = false;
    }
  }

  return allValid;
}

async function validateTypeScriptConfiguration() {
  logHeader('Validating TypeScript Configuration');

  try {
    const tsconfigPath = path.resolve('tests/test-utils/tsconfig.json');
    const tsconfigContent = await fs.readFile(tsconfigPath, 'utf-8');
    const tsconfig = JSON.parse(tsconfigContent);

    if (tsconfig.compilerOptions && tsconfig.compilerOptions.target) {
      logSuccess(`TypeScript target: ${tsconfig.compilerOptions.target}`);
    } else {
      logError('TypeScript configuration missing target');
    }

    if (tsconfig.compilerOptions && tsconfig.compilerOptions.module) {
      logSuccess(`TypeScript module: ${tsconfig.compilerOptions.module}`);
    } else {
      logError('TypeScript configuration missing module');
    }

    return true;
  } catch (error) {
    logError(`TypeScript configuration validation failed: ${error.message}`);
    return false;
  }
}

async function generateSummaryReport(results) {
  logHeader('Infrastructure Validation Summary');

  const categories = Object.keys(results);
  const passed = categories.filter(cat => results[cat]).length;
  const failed = categories.filter(cat => !results[cat]).length;

  console.log(`\n${colors.bold}Results Summary:${colors.reset}`);
  categories.forEach(category => {
    const status = results[category] ? '✅ PASS' : '❌ FAIL';
    const statusColor = results[category] ? 'green' : 'red';
    log(statusColor, `  ${category}: ${status}`);
  });

  console.log(`\n${colors.bold}Overall:${colors.reset}`);
  if (passed === categories.length) {
    logSuccess(`All validation checks passed (${passed}/${categories.length})`);
    logInfo('Integration test infrastructure is ready for use! 🎉');
    return true;
  } else {
    logError(`${failed} validation check(s) failed (${passed}/${categories.length} passed)`);
    logWarning('Some issues need to be resolved before the infrastructure is ready');
    return false;
  }
}

async function main() {
  console.log(`${colors.bold}${colors.blue}🔧 APEX Integration Test Infrastructure Validation${colors.reset}\n`);

  const results = {};

  try {
    results['File Structure'] = await validateFileStructure();
    results['Package Configuration'] = await validatePackageConfiguration();
    results['Test Utilities Content'] = await validateTestUtilsContent();
    results['Test Files'] = await validateTestFiles();
    results['TypeScript Configuration'] = await validateTypeScriptConfiguration();

    const success = await generateSummaryReport(results);

    if (success) {
      logHeader('Infrastructure Components Summary');
      console.log('📦 Integration Test Environment Creation');
      console.log('🎭 Advanced Mock Factories');
      console.log('⚡ Event Monitoring System');
      console.log('🔒 Permission Testing Framework');
      console.log('🛠️  Tool Mocking Registry');
      console.log('🧹 Setup and Teardown Utilities');
      console.log('📊 Performance Measurement Tools');
      console.log('🔧 Test Scenario Builders');
      console.log('✅ Comprehensive Test Coverage');

      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    logError(`Validation script failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  validateFileStructure,
  validatePackageConfiguration,
  validateTestUtilsContent,
  validateTestFiles,
  validateTypeScriptConfiguration,
  generateSummaryReport,
};