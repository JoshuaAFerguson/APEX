# APEX Unified Test Configuration

This document describes the consolidated E2E test configuration and unified test runner implementation for the APEX project.

## Overview

The APEX project now features a comprehensive unified test configuration that consolidates all E2E tests into a single, discoverable test runner while maintaining specialized configurations for different test types.

## Architecture

### Core Configuration Files

#### 1. `vitest.e2e.config.ts` - Unified E2E Test Configuration

This is the **primary E2E test configuration** that discovers and runs all E2E tests across the entire monorepo.

**Key Features:**
- **Comprehensive Discovery**: Uses extensive glob patterns to find all E2E test variations
- **Node Environment**: Optimized for CLI/backend testing
- **Extended Timeouts**: 60s test timeout, 30s hook timeout for real-world operations
- **Forked Isolation**: Process pool with fork isolation for test independence
- **Retry Policy**: 2 retries in CI, 0 in local development
- **Global Setup/Teardown**: Resource management for E2E environments

**Discovery Patterns:**
```typescript
// Standard E2E patterns
'packages/*/src/**/*.e2e.test.ts'
'tests/e2e/**/*.test.ts'
'tests/e2e/**/*.e2e.test.ts'

// Comprehensive discovery patterns
'**/*e2e*.test.ts'                    // Any file with 'e2e' in name
'**/e2e-*.test.ts'                    // Files starting with 'e2e-'
'tests/integration/**/*e2e*.test.ts'  // Integration directory E2E tests
'tests/test-utils/**/*e2e*.test.ts'   // Test utilities E2E tests

// Marketplace-specific patterns
'tests/e2e/**/mcp-*.test.ts'
'tests/e2e/**/marketplace*.test.ts'

// Package-level E2E patterns
'packages/browser/src/**/*e2e*.test.ts'
'packages/orchestrator/src/**/*e2e*.test.ts'
'packages/orchestrator/src/__tests__/**/*e2e*.test.ts'
'packages/core/src/__tests__/**/*e2e*.test.ts'
'packages/cli/src/__tests__/**/*e2e*.test.ts'
```

#### 2. `vitest.shared.config.ts` - Configuration Factory

Provides factory functions for creating standardized test configurations:

- `createE2ETestConfig()` - E2E defaults (60s timeout, comprehensive patterns)
- `createUnitTestConfig()` - Unit test defaults (5s timeout, isolated)
- `createIntegrationTestConfig()` - Integration defaults (30s timeout)
- `createBrowserTestConfig()` - Browser testing with DOM support

#### 3. Specialized Test Configurations

The unified system maintains specialized configurations for different test environments:

- `vitest.browser.config.ts` - Playwright browser automation
- `tests/browser-integration/vitest.config.ts` - Browser tool integration
- `tests/keyboard-integration/vitest.config.ts` - Keyboard/Ink component testing
- `tests/form-integration/vitest.config.ts` - Form validation and accessibility
- `tests/page-navigation/vitest.config.ts` - Navigation and routing

## Unified Test Runner

### `scripts/unified-test-runner.js`

A comprehensive test runner that provides a single entry point for all test types while leveraging the specialized configurations.

**Features:**
- **Test Type Selection**: Run specific test categories (unit, integration, e2e, browser)
- **Package Filtering**: Run tests for specific packages (`--package=cli`)
- **Pattern Filtering**: Filter tests by pattern (`--pattern=marketplace`)
- **Watch Mode**: Real-time test execution (`--watch`)
- **Coverage Reports**: Integrated coverage reporting (`--coverage`)
- **Test Discovery**: List and validate test discovery (`--list`, `--validate`)
- **Comprehensive Validation**: Verify all test configurations work correctly

**Usage Examples:**
```bash
# Run all E2E tests
npm run test:unified:e2e

# Run CLI package tests only
npm run test:unified:cli

# Run marketplace E2E tests
npm run test:unified:marketplace

# Validate E2E test discovery
npm run test:unified:validate

# Watch mode for unit tests
npm run test:unified:unit --watch

# List all discovered E2E tests
npm run test:unified:list:e2e
```

## Package.json Scripts

### Unified Test Commands

```json
{
  "test:unified": "node scripts/unified-test-runner.js",
  "test:unified:e2e": "node scripts/unified-test-runner.js --type=e2e",
  "test:unified:unit": "node scripts/unified-test-runner.js --type=unit",
  "test:unified:integration": "node scripts/unified-test-runner.js --type=integration",
  "test:unified:browser": "node scripts/unified-test-runner.js --type=browser",
  "test:unified:watch": "node scripts/unified-test-runner.js --watch",
  "test:unified:coverage": "node scripts/unified-test-runner.js --coverage",
  "test:unified:validate": "node scripts/unified-test-runner.js --validate"
}
```

### Package-Specific Commands

```json
{
  "test:unified:marketplace": "node scripts/unified-test-runner.js --type=e2e --pattern=marketplace",
  "test:unified:cli": "node scripts/unified-test-runner.js --package=cli",
  "test:unified:orchestrator": "node scripts/unified-test-runner.js --package=orchestrator",
  "test:unified:core": "node scripts/unified-test-runner.js --package=core",
  "test:unified:api": "node scripts/unified-test-runner.js --package=api",
  "test:unified:browser-package": "node scripts/unified-test-runner.js --package=browser"
}
```

### Validation Commands

```json
{
  "test:unified:list": "node scripts/unified-test-runner.js --list",
  "test:unified:list:e2e": "node scripts/unified-test-runner.js --type=e2e --list",
  "validate:unified-tests": "node scripts/unified-test-runner.js --type=e2e --validate && node scripts/unified-test-runner.js --type=unit --validate && node scripts/unified-test-runner.js --type=integration --validate"
}
```

## Test Discovery

### Current E2E Test Coverage

The unified configuration discovers **53+ E2E test files** across the monorepo:

#### Core E2E Tests (`tests/e2e/`)
- **28 test files** covering:
  - CLI command testing
  - Git workflow validation
  - Service management E2E
  - Server installation and configuration
  - Infrastructure validation
  - CI/CD pipeline testing

#### Marketplace E2E Tests
- `mcp-marketplace.e2e.test.ts` - Core marketplace workflows
- `mcp-marketplace-complete-flow.e2e.test.ts` - Complete installation flow
- `mcp-marketplace-api-flow.e2e.test.ts` - API integration testing
- `mcp-marketplace-error-scenarios.e2e.test.ts` - Error handling validation
- `browse-marketplace.e2e.test.ts` - Marketplace browsing functionality

#### Package-Level E2E Tests
- **CLI Package**: Command execution, approval workflows, validation
- **Core Package**: Configuration, autonomy settings, container limits
- **Orchestrator Package**: Browser automation, visual regression, policy enforcement
- **Browser Package**: Browser tool integration and automation

### Test Environment Configuration

#### E2E Test Environment (`vitest.e2e.config.ts`)
- **Environment**: Node.js (for CLI/server testing)
- **Timeouts**: 60s tests, 30s hooks
- **Execution**: Sequential with forked isolation
- **Retries**: 2 in CI, 0 locally
- **Coverage**: Comprehensive V8 coverage reporting

#### Browser Test Environment (`vitest.browser.config.ts`)
- **Environment**: Playwright integration
- **Browsers**: Chromium, Firefox, WebKit support
- **Features**: Screenshot capture, cross-browser testing
- **Mode**: Headless in CI, headed for debugging

#### Integration Test Environments
- **Browser Integration**: DOM automation, limited concurrency
- **Form Integration**: Accessibility testing, validation workflows
- **Keyboard Integration**: Ink components, modifier key support
- **Page Navigation**: Mock server integration, routing validation

## Validation and Monitoring

### Automated Validation

1. **Discovery Validation** (`scripts/validate-e2e-test-discovery.js`)
   - Ensures all E2E tests are discoverable
   - Validates configuration patterns
   - Compares manual vs Vitest discovery

2. **Unified Runner Validation** (`scripts/validate-unified-test-runner.js`)
   - Checks configuration file existence
   - Validates package.json scripts
   - Verifies test directory structure

3. **Infrastructure Validation**
   - Browser automation setup
   - Playwright/Puppeteer installation
   - Test environment readiness

### Continuous Validation

```bash
# Validate all test configurations
npm run validate:unified-tests

# Validate E2E discovery specifically
npm run validate:e2e-discovery

# Check infrastructure setup
npm run validate:integration-infrastructure
```

## Migration Benefits

### Before Consolidation
- **12 separate test configurations** across different directories
- **Multiple npm scripts** targeting specific runners
- **Inconsistent environments** and timeout strategies
- **Fragmented test discovery** with potential gaps
- **Complex test execution** requiring knowledge of multiple configs

### After Consolidation
- **Single unified E2E configuration** with comprehensive discovery
- **Unified test runner** with type selection and filtering
- **Consistent test execution** patterns across all environments
- **Comprehensive test discovery** with 53+ E2E tests validated
- **Simplified commands** for common testing workflows
- **Enhanced validation** and monitoring capabilities

## Usage Recommendations

### Daily Development
```bash
# Run all tests
npm run test:unified

# Focus on E2E tests for feature work
npm run test:unified:e2e

# Watch mode during development
npm run test:unified:watch
```

### Marketplace Development
```bash
# Test marketplace functionality
npm run test:unified:marketplace

# Validate marketplace E2E coverage
npm run test:unified:list:e2e | grep marketplace
```

### Package-Specific Development
```bash
# Work on CLI features
npm run test:unified:cli

# Orchestrator development
npm run test:unified:orchestrator
```

### CI/CD Integration
```bash
# Validate all test configurations
npm run validate:unified-tests

# Run comprehensive test suite
npm run test:unified:coverage

# Validate E2E test discovery
npm run validate:e2e-discovery
```

## Future Enhancements

1. **Performance Optimization**: Parallel E2E test execution with resource management
2. **Test Categorization**: Enhanced tagging and filtering capabilities
3. **Coverage Integration**: Unified coverage reporting across test types
4. **CI Integration**: Optimized test selection for different CI scenarios
5. **Test Analytics**: Enhanced reporting and test execution metrics

## Related Documentation

- [E2E Test Configuration](./E2E_TEST_CONFIGURATION.md) - Original E2E test documentation
- [Test Infrastructure](../tests/README.md) - Test setup and utilities
- [CI/CD Pipeline](../docs/CI_CD.md) - Integration with build processes