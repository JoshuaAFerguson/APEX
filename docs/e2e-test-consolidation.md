# E2E Test Consolidation Documentation

## Overview

The APEX project now has a fully consolidated E2E test configuration that provides a unified test runner capable of discovering and executing all End-to-End tests across the entire monorepo, including all marketplace-specific E2E tests.

## Unified Test Runner

### Location
- **Script**: `scripts/unified-test-runner.js`
- **Validation**: `scripts/validate-e2e-consolidation.js`

### Key Features

1. **Comprehensive Test Discovery**: Discovers all E2E tests using extensive patterns
2. **Single Command Interface**: Run all E2E tests with one command
3. **Marketplace Test Support**: Specialized patterns for marketplace E2E tests
4. **Filtering Capabilities**: Filter by package, pattern, or test type
5. **Multiple Execution Modes**: Run, watch, list, and validation modes

### Test Discovery Patterns

The unified test runner uses comprehensive patterns to discover all E2E tests:

```javascript
// Standard E2E test patterns
'packages/*/src/**/*.e2e.test.ts'
'tests/e2e/**/*.test.ts'
'tests/e2e/**/*.e2e.test.ts'

// Additional E2E test patterns
'**/*e2e*.test.ts'                    // Files with e2e in the name
'**/e2e-*.test.ts'                    // Files starting with e2e-

// Marketplace-specific E2E tests
'tests/e2e/**/mcp-*.test.ts'
'tests/e2e/**/marketplace*.test.ts'
'tests/e2e/**/browse-marketplace.*.test.ts'
'tests/e2e/**/mcp-marketplace*.test.ts'

// Package-level E2E tests
'packages/orchestrator/src/**/*e2e*.test.ts'
'packages/core/src/__tests__/**/*e2e*.test.ts'
'packages/cli/src/__tests__/**/*e2e*.test.ts'
```

## Available Commands

### Basic E2E Test Execution

```bash
# Run all E2E tests
npm run test:unified:e2e

# Run E2E tests in watch mode
npm run test:unified:e2e -- --watch

# Run with coverage
npm run test:unified:e2e -- --coverage
```

### Marketplace-Specific E2E Tests

```bash
# Run only marketplace E2E tests
npm run test:unified:marketplace

# List marketplace E2E tests without running
npm run test:unified:marketplace -- --list
```

### Package-Specific E2E Tests

```bash
# Run E2E tests for specific packages
npm run test:unified:cli
npm run test:unified:orchestrator
npm run test:unified:core
npm run test:unified:api
```

### Test Discovery and Validation

```bash
# List all discoverable E2E tests
npm run test:unified:list:e2e

# Validate E2E test discovery
npm run test:unified:e2e -- --validate

# Comprehensive consolidation validation
npm run validate:e2e-consolidation
```

## Configuration Files

### Root Level Configurations

1. **`vitest.e2e.config.ts`** - Primary E2E test configuration
   - Extended timeouts (60s tests, 30s hooks)
   - Forked process pool with max 4 concurrent processes
   - Global setup/teardown for resource management
   - Comprehensive include patterns for E2E test discovery

2. **`vitest.shared.config.ts`** - Shared base configuration
   - `createE2ETestConfig()` function for E2E-specific settings
   - Common timeout and environment configurations

3. **`vitest.config.ts`** - Main monorepo test configuration
   - Includes all test types (unit, integration, e2e)

### Package-Level Configurations

Each package has its own `vitest.config.ts` that extends the shared configuration:

- `packages/cli/vitest.config.ts`
- `packages/orchestrator/vitest.config.ts`
- `packages/core/vitest.config.ts`
- `packages/api/vitest.config.ts`

## E2E Test Directory Structure

```
tests/e2e/
├── setup.ts                                    # Global setup
├── teardown.ts                                # Global teardown
├── README.md                                  # E2E testing documentation
├── helpers/
│   ├── mcp-e2e-helpers.ts                    # High-level MCP workflow helpers
│   ├── api-e2e-test-server.ts               # Fastify test server wrapper
│   └── cli-test-helpers.ts                   # CLI execution utilities
├── utils/
│   ├── mcp-test-utils.ts                     # Low-level utilities
│   ├── ws-test-client.ts                     # WebSocket test client
│   └── test-utilities.ts                     # General test utilities
├── mocks/
│   └── mock-marketplace-server.ts            # Marketplace server mock
├── fixtures/
│   └── marketplace-data.ts                   # Test data fixtures
└── [test files]
    ├── cli.e2e.test.ts                       # CLI command execution tests
    ├── git-commands.e2e.test.ts              # Git operations tests
    ├── service-management.e2e.test.ts        # Service lifecycle tests
    ├── browse-marketplace.e2e.test.ts        # MCP marketplace browsing
    ├── mcp-marketplace.e2e.test.ts           # Basic MCP marketplace flows
    ├── mcp-marketplace-complete-flow.e2e.test.ts # Full CLI workflow
    ├── mcp-marketplace-api-flow.e2e.test.ts  # API endpoint testing
    └── mcp-marketplace-error-scenarios.e2e.test.ts # Error handling
```

## Marketplace E2E Tests

The consolidated configuration includes comprehensive marketplace E2E test coverage:

### Available Marketplace E2E Tests

1. **browse-marketplace.e2e.test.ts** - MCP marketplace browsing functionality
2. **mcp-marketplace.e2e.test.ts** - Basic MCP marketplace flows
3. **mcp-marketplace-complete-flow.e2e.test.ts** - Complete CLI workflow (browse → search → install → configure → verify)
4. **mcp-marketplace-api-flow.e2e.test.ts** - API endpoint testing with WebSocket
5. **mcp-marketplace-error-scenarios.e2e.test.ts** - Error handling scenarios
6. **mcp-test-infrastructure-integration.test.ts** - Infrastructure integration

### Marketplace Test Architecture

The marketplace E2E tests follow a three-tier architecture:

1. **Low-Level Utilities** (`utils/mcp-test-utils.ts`)
   - CLI execution via `child_process`
   - APEX config file I/O
   - Output assertion helpers
   - Retry mechanisms

2. **Fixtures & Mocks** (`fixtures/marketplace-data.ts`, `mocks/mock-marketplace-server.ts`)
   - Test marketplace data
   - Mock server behaviors
   - Test catalog creation

3. **High-Level Helpers** (`helpers/mcp-e2e-helpers.ts`)
   - Workflow composition
   - Result assertion helpers
   - Complete test context management

## Test Environment Configuration

### Timeouts and Retry Configuration

| Test Type | Timeout | Hook Timeout | Retry (CI) | Pool |
|-----------|---------|-------------|-----------|------|
| E2E | 60s | 30s | 2x | forks (max 4) |
| Integration | 30s | 20s | - | forks (max 4) |
| Unit | 5s | 10s | - | default |
| Browser | 60s | 30s | 2x | forks |

### Global E2E Test Infrastructure

**Setup (`tests/e2e/setup.ts`)**:
- Temporary directory creation and cleanup
- Git repository scaffolding (initialized and bare repos)
- Resource tracking for orchestrators, servers, and databases
- `globalThis.apexE2EHelpers` with utilities

**Teardown (`tests/e2e/teardown.ts`)**:
- Orphaned temp directory cleanup
- Process termination (Unix-like systems)
- SQLite database lock verification
- Global state reset

## Dependencies

The consolidated E2E test configuration requires:

- `vitest`: ^4.0.15
- `fast-glob`: ^3.3.2 (for test discovery)
- `@vitest/coverage-v8`: ^4.0.15 (for coverage)

## Validation

### Automated Validation

Run the consolidation validation to ensure everything is working:

```bash
npm run validate:e2e-consolidation
```

This validates:
- All test configuration files exist
- E2E test discovery is working
- All marketplace E2E tests are included
- Dependencies are available
- Required npm scripts are present

### Manual Testing

Test the unified runner manually:

```bash
# List all E2E tests to verify discovery
npm run test:unified:list:e2e

# Run a specific subset
npm run test:unified:marketplace -- --list

# Validate specific test types
npm run test:unified:e2e -- --validate
```

## Benefits of Consolidation

1. **Single Command Interface**: All E2E tests can be run with `npm run test:unified:e2e`
2. **Comprehensive Discovery**: No E2E tests are missed due to inconsistent patterns
3. **Marketplace Coverage**: All marketplace E2E tests are guaranteed to be included
4. **Consistent Configuration**: All test configurations use shared base settings
5. **Easy Filtering**: Filter tests by package, pattern, or test type
6. **Validation Support**: Built-in validation ensures the configuration works
7. **Documentation**: Clear documentation of all available commands and configurations

## Usage Examples

```bash
# Run all E2E tests
npm run test:unified:e2e

# Run only marketplace tests
npm run test:unified:marketplace

# Run CLI package E2E tests only
npm run test:unified:cli

# List all E2E tests without running them
npm run test:unified:list:e2e

# Run with pattern filter
npm run test:unified:e2e -- --pattern=git

# Watch mode for development
npm run test:unified:e2e -- --watch

# Generate coverage report
npm run test:unified:e2e -- --coverage

# Validate the configuration is working
npm run validate:e2e-consolidation
```

The E2E test consolidation is complete and provides a robust, unified interface for running all End-to-End tests across the APEX monorepo.