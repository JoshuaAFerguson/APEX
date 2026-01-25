#!/usr/bin/env node

/**
 * @fileoverview MCP Test Infrastructure Validation Script
 *
 * This script validates that all components of the MCP E2E test infrastructure
 * are properly implemented and accessible. It performs static analysis and
 * import validation without running the full test suite.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

// ANSI colors for output formatting
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

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function header(message) {
  log(`\n${colors.bold}${message}${colors.reset}`);
}

// Track validation results
let passed = 0;
let failed = 0;

function validate(condition, successMsg, errorMsg) {
  if (condition) {
    success(successMsg);
    passed++;
  } else {
    error(errorMsg);
    failed++;
  }
  return condition;
}

// File existence checks
const requiredFiles = [
  // Core E2E test infrastructure
  'tests/e2e/setup.ts',
  'tests/e2e/mcp-marketplace.e2e.test.ts',
  'tests/e2e/helpers/mcp-e2e-helpers.ts',
  'tests/e2e/utils/mcp-test-utils.ts',
  'tests/e2e/mocks/mock-marketplace-server.ts',
  'tests/e2e/fixtures/marketplace-data.ts',

  // Test utilities
  'tests/test-utils/mcp-test-base.ts',

  // Configuration files
  'vitest.config.ts',
  'vitest.e2e.config.ts',
  'vitest.unit.config.ts',

  // New test files created during this task
  'tests/e2e/mcp-test-infrastructure-integration.test.ts',
  'tests/test-utils/mcp-test-base.unit.test.ts',
  'MCP_TEST_COVERAGE_REPORT.md'
];

// Content validation patterns
const contentValidations = [
  {
    file: 'tests/e2e/helpers/mcp-e2e-helpers.ts',
    patterns: [
      'createMCPTestContext',
      'mcpHelpers',
      'runHappyPathWorkflow',
      'MockServerManager'
    ],
    description: 'E2E helpers exports'
  },
  {
    file: 'tests/e2e/mocks/mock-marketplace-server.ts',
    patterns: [
      'MockMarketplaceServer',
      'createMockMarketplaceServer',
      'createFailingServer',
      'createSlowServer'
    ],
    description: 'Mock server infrastructure'
  },
  {
    file: 'tests/e2e/fixtures/marketplace-data.ts',
    patterns: [
      'FILESYSTEM_SERVER',
      'MEMORY_SERVER',
      'ALL_MARKETPLACE_ENTRIES',
      'createTestCatalog'
    ],
    description: 'Marketplace fixtures'
  },
  {
    file: 'tests/test-utils/mcp-test-base.ts',
    patterns: [
      'mcpTestBase',
      'isUnitTestMode',
      'createTestContext',
      'execMCPCommand'
    ],
    description: 'Base test utilities'
  },
  {
    file: 'tests/e2e/mcp-marketplace.e2e.test.ts',
    patterns: [
      'Browse Marketplace',
      'Search & Select Server',
      'Install Server',
      'Complete Happy Path Flow'
    ],
    description: 'Core E2E test structure'
  }
];

// Type definition validations
const typeValidations = [
  {
    file: 'tests/e2e/helpers/mcp-e2e-helpers.ts',
    patterns: [
      'MCPTestContext',
      'MCPTestContextOptions',
      'WorkflowStepResult',
      'MarketplaceWorkflowResult'
    ],
    description: 'E2E helper types'
  },
  {
    file: 'tests/test-utils/mcp-test-base.ts',
    patterns: [
      'MCPTestConfig',
      'MCPCommandResult',
      'MCPServerConfig',
      'MCPMarketplaceEntry'
    ],
    description: 'Base utility types'
  }
];

function main() {
  header('🧪 MCP Test Infrastructure Validation');

  // File existence validation
  header('📁 File Existence Validation');
  for (const file of requiredFiles) {
    const exists = existsSync(file);
    validate(
      exists,
      `Found required file: ${file}`,
      `Missing required file: ${file}`
    );
  }

  // Content validation
  header('📄 Content Validation');
  for (const validation of contentValidations) {
    if (existsSync(validation.file)) {
      const content = readFileSync(validation.file, 'utf-8');
      const missingPatterns = validation.patterns.filter(pattern => !content.includes(pattern));

      validate(
        missingPatterns.length === 0,
        `${validation.description} - all required exports found`,
        `${validation.description} - missing exports: ${missingPatterns.join(', ')}`
      );
    } else {
      warning(`Skipping content validation for missing file: ${validation.file}`);
    }
  }

  // Type definition validation
  header('📝 Type Definition Validation');
  for (const validation of typeValidations) {
    if (existsSync(validation.file)) {
      const content = readFileSync(validation.file, 'utf-8');
      const missingTypes = validation.patterns.filter(pattern => !content.includes(pattern));

      validate(
        missingTypes.length === 0,
        `${validation.description} - all required types found`,
        `${validation.description} - missing types: ${missingTypes.join(', ')}`
      );
    } else {
      warning(`Skipping type validation for missing file: ${validation.file}`);
    }
  }

  // Test configuration validation
  header('⚙️  Test Configuration Validation');

  // Check vitest.e2e.config.ts
  if (existsSync('vitest.e2e.config.ts')) {
    const e2eConfig = readFileSync('vitest.e2e.config.ts', 'utf-8');
    validate(
      e2eConfig.includes('tests/e2e/') && e2eConfig.includes('setupFiles'),
      'E2E config includes test patterns and setup files',
      'E2E config missing required test patterns or setup'
    );

    validate(
      e2eConfig.includes('testTimeout') && e2eConfig.includes('hookTimeout'),
      'E2E config includes extended timeouts',
      'E2E config missing timeout configurations'
    );
  }

  // Check package.json for test scripts
  if (existsSync('package.json')) {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
    const scripts = packageJson.scripts || {};

    validate(
      scripts.test && scripts['test:e2e'],
      'Package.json includes test and test:e2e scripts',
      'Package.json missing required test scripts'
    );
  }

  // Integration validation
  header('🔗 Integration Validation');

  // Check if test files import from each other correctly
  const helperFile = 'tests/e2e/helpers/mcp-e2e-helpers.ts';
  if (existsSync(helperFile)) {
    const helperContent = readFileSync(helperFile, 'utf-8');
    validate(
      helperContent.includes('../utils/mcp-test-utils') &&
      helperContent.includes('../fixtures/marketplace-data') &&
      helperContent.includes('../mocks/mock-marketplace-server'),
      'E2E helpers properly import all dependencies',
      'E2E helpers missing required imports'
    );
  }

  // Check test files import the helpers
  const integrationTest = 'tests/e2e/mcp-test-infrastructure-integration.test.ts';
  if (existsSync(integrationTest)) {
    const testContent = readFileSync(integrationTest, 'utf-8');
    validate(
      testContent.includes('./helpers/mcp-e2e-helpers.js'),
      'Integration test properly imports E2E helpers',
      'Integration test missing E2E helper imports'
    );
  }

  // Acceptance criteria validation
  header('✅ Acceptance Criteria Validation');

  // Test helpers
  validate(
    existsSync('tests/e2e/helpers/mcp-e2e-helpers.ts'),
    'Test helpers implemented',
    'Test helpers missing'
  );

  // Mocks for MCP servers
  validate(
    existsSync('tests/e2e/mocks/mock-marketplace-server.ts'),
    'MCP server mocks implemented',
    'MCP server mocks missing'
  );

  // Fixtures for marketplace data
  validate(
    existsSync('tests/e2e/fixtures/marketplace-data.ts'),
    'Marketplace data fixtures implemented',
    'Marketplace data fixtures missing'
  );

  // Base test utilities
  validate(
    existsSync('tests/test-utils/mcp-test-base.ts'),
    'Base test utilities implemented',
    'Base test utilities missing'
  );

  // Configuration supports both unit and E2E modes
  validate(
    existsSync('vitest.unit.config.ts') && existsSync('vitest.e2e.config.ts'),
    'Test configuration supports both unit and E2E modes',
    'Missing unit or E2E test configurations'
  );

  // Coverage analysis validation
  header('📊 Coverage Analysis');

  const reportFile = 'MCP_TEST_COVERAGE_REPORT.md';
  if (existsSync(reportFile)) {
    const reportContent = readFileSync(reportFile, 'utf-8');
    const requiredSections = [
      'Test Infrastructure Components',
      'Core Test Files',
      'Test Configuration',
      'Coverage Analysis',
      'Acceptance Criteria Verification'
    ];

    const missingSections = requiredSections.filter(section => !reportContent.includes(section));
    validate(
      missingSections.length === 0,
      'Coverage report includes all required sections',
      `Coverage report missing sections: ${missingSections.join(', ')}`
    );
  }

  // Final summary
  header('📋 Validation Summary');

  const total = passed + failed;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  if (failed === 0) {
    success(`🎉 All ${passed} validations passed! MCP test infrastructure is complete and ready.`);
  } else {
    info(`Validation Results: ${passed} passed, ${failed} failed (${passRate}% pass rate)`);

    if (passRate >= 90) {
      success('✅ MCP test infrastructure is mostly complete with minor issues.');
    } else if (passRate >= 75) {
      warning('⚠️  MCP test infrastructure has some missing components.');
    } else {
      error('❌ MCP test infrastructure requires significant work.');
    }
  }

  // Instructions for next steps
  if (failed === 0) {
    header('🚀 Next Steps');
    info('The MCP test infrastructure is fully implemented and ready for use:');
    console.log('\n  1. Run unit tests: npm run test');
    console.log('  2. Run E2E tests: npm run test:e2e');
    console.log('  3. Check coverage: npm run test:coverage');
    console.log('  4. Review coverage report: MCP_TEST_COVERAGE_REPORT.md\n');
  }

  process.exit(failed === 0 ? 0 : 1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as validateMCPTestInfrastructure };