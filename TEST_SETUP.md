# APEX Test Configuration and Utilities

This document describes the comprehensive test configuration and utilities available in the APEX monorepo.

## Overview

APEX has a complete shared test configuration with:
- **Vitest** as the primary test runner
- **Shared configuration** at monorepo root level
- **Test utilities package** with comprehensive helpers
- **TypeScript support** with proper type definitions
- **Multiple test environments** (unit, integration, e2e, browser)

## Test Configuration Structure

```
/
├── vitest.config.ts              # Main Vitest config
├── vitest.shared.config.ts       # Shared config factory functions
├── vitest.unit.config.ts         # Unit test specific config
├── vitest.e2e.config.ts          # E2E test specific config
├── test-setup.ts                 # Global test setup utilities
├── tsconfig.json                 # Root TypeScript config
└── tests/
    └── test-utils/               # Shared test utilities package
        ├── package.json          # Test utils package definition
        ├── tsconfig.json         # TypeScript config for test utils
        ├── index.ts              # Main export with convenience functions
        ├── async.ts              # Async testing utilities
        ├── assertions.ts         # Enhanced assertion helpers
        ├── context.ts            # Test context management
        └── cleanup.ts            # Resource cleanup utilities
```

## Available Test Configurations

### 1. Shared Base Configuration (`vitest.shared.config.ts`)

Provides factory functions for different test types:

- `createSharedConfig()` - Base configuration
- `createUnitTestConfig()` - Fast unit tests
- `createIntegrationTestConfig()` - Integration tests with extended timeouts
- `createE2ETestConfig()` - End-to-end tests
- `createBrowserTestConfig()` - Browser/UI tests with jsdom/happy-dom

### 2. Global Test Setup (`test-setup.ts`)

Provides global utilities like:
- Console mocking
- Common environment setup
- Timeout helpers (`withTimeout`, `waitFor`)
- Async utilities (`flushPromises`, `nextTick`, `sleep`)

## Test Utilities Package (`@apex/test-utils`)

### Core Features

#### Test Context Management (`context.ts`)
```typescript
import { createTestContext, createExtendedTestContext } from '@apex/test-utils/context';

// Basic context with temp directory
const context = await createTestContext();

// Extended context with mocks
const extendedContext = await createExtendedTestContext();

// Database context for tests needing SQLite
const dbContext = await createDatabaseTestContext();
```

#### Async Utilities (`async.ts`)
```typescript
import { wait, waitFor, retry, createDeferred } from '@apex/test-utils/async';

// Wait for condition
await waitFor(() => someCondition(), { timeout: 5000 });

// Retry flaky operations
const result = await retry(async () => flakyOperation(), {
  maxAttempts: 3,
  delay: 100
});

// External promise control
const { promise, resolve, reject } = createDeferred<string>();
```

#### Enhanced Assertions (`assertions.ts`)
```typescript
import {
  expectToThrow,
  expectObjectShape,
  expectArrayToContain,
  expectToBeWithinRange
} from '@apex/test-utils/assertions';

// Test error throwing
const error = await expectToThrow(
  () => riskyFunction(),
  'Expected error message'
);

// Test object structure
expectObjectShape(result, {
  id: expect.any(String),
  status: 'completed'
});
```

#### Resource Cleanup (`cleanup.ts`)
```typescript
import { createCleanupManager, withCleanup } from '@apex/test-utils/cleanup';

// Manual cleanup management
const cleanup = createCleanupManager();
cleanup.fileSystem.track('/tmp/test-file');
cleanup.mocks.trackSpy(spy, 'test spy');
await cleanup.cleanup();

// Automatic cleanup wrapper
const result = await withCleanup(async (cleanup) => {
  const tempFile = await cleanup.fileSystem.createTempFile('test.txt');
  // ... test operations
  return result;
}); // Automatic cleanup
```

### Convenience Functions

#### Quick Test Setup
```typescript
import { setupTest, createTestEnvironment, runWithCleanup } from '@apex/test-utils';

// Minimal setup
const { context, cleanup } = await setupTest();

// Complete environment
const env = await createTestEnvironment({
  withDatabase: true,
  withMocks: true
});

// Auto-cleanup test wrapper
const result = await runWithCleanup(async (env) => {
  // Test operations with automatic cleanup
}, { withDatabase: true });
```

## Package Integration

### Adding to Package Tests

1. **Update package.json dependencies**:
```json
{
  "devDependencies": {
    "@apex/test-utils": "workspace:*"
  }
}
```

2. **Use shared config in package vitest.config.ts**:
```typescript
import { defineConfig, mergeConfig } from 'vitest/config';
import { createUnitTestConfig } from '../../vitest.shared.config.js';

export default mergeConfig(
  createUnitTestConfig(),
  defineConfig({
    // Package-specific overrides
  })
);
```

3. **Import utilities in tests**:
```typescript
import { describe, it, expect, createTestEnvironment } from '@apex/test-utils';

describe('MyFeature', () => {
  it('should work correctly', async () => {
    const { context, cleanup } = await createTestEnvironment();

    try {
      // Test implementation
      expect(result).toBeDefined();
    } finally {
      await cleanup.cleanup();
    }
  });
});
```

## Test Commands

### Root Level Commands
```bash
npm test                     # Run all tests
npm run test:unit           # Unit tests only
npm run test:integration    # Integration tests only
npm run test:e2e           # E2E tests only
npm run test:coverage      # Tests with coverage
npm run test:watch         # Watch mode
```

### Package Level Commands
```bash
# In any package directory
npm test                    # Run package tests
npm run test:watch         # Watch mode
npm run test:coverage      # Package coverage
```

## Configuration Benefits

✅ **Shared Configuration**: Consistent settings across all packages
✅ **TypeScript Support**: Full type safety in tests
✅ **Multiple Environments**: Unit, integration, e2e, browser testing
✅ **Comprehensive Utilities**: Context, cleanup, assertions, async helpers
✅ **Workspace Integration**: Proper npm workspace configuration
✅ **Extensible**: Easy to add package-specific test configurations

## Best Practices

1. **Use appropriate test config** for your test type (unit vs integration vs e2e)
2. **Import shared utilities** instead of recreating common test logic
3. **Use cleanup managers** to prevent resource leaks
4. **Leverage test context** for consistent temp directory and resource management
5. **Use enhanced assertions** for more descriptive test failures
6. **Follow test naming conventions**: `*.test.ts`, `*.integration.test.ts`, `*.e2e.test.ts`

This test setup provides a robust, scalable foundation for testing across the APEX monorepo while maintaining consistency and reducing duplication.