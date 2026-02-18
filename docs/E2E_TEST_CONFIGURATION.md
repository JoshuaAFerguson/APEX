# APEX E2E Test Configuration

This document describes the unified end-to-end (E2E) test configuration for the APEX monorepo.

## Overview

The APEX project now has a consolidated E2E test runner that can discover and run all E2E tests across the entire monorepo with a single command. This ensures comprehensive test coverage and prevents E2E tests from being missed due to inconsistent naming patterns or locations.

## Unified E2E Test Runner

### Running All E2E Tests

```bash
# Run all E2E tests once
npm run test:e2e

# Run E2E tests in watch mode
npm run test:e2e:watch

# Validate E2E test discovery
npm run validate:e2e-discovery
```

### Configuration Files

- **`vitest.e2e.config.ts`** - Primary E2E test configuration
- **`vitest.shared.config.ts`** - Shared configuration utilities with `createE2ETestConfig()`
- **`vitest.config.ts`** - Main configuration that includes E2E tests in general test runs

## E2E Test Discovery Patterns

The unified E2E test runner discovers tests using these patterns:

### Standard Patterns
```
packages/*/src/**/*.e2e.test.ts     # Package-level E2E tests
tests/e2e/**/*.test.ts              # Main E2E test directory
tests/e2e/**/*.e2e.test.ts         # E2E-specific naming
```

### Extended Patterns
```
**/*e2e*.test.ts                    # Any file with 'e2e' in the name
**/e2e-*.test.ts                   # Files starting with 'e2e-'
tests/integration/**/*e2e*.test.ts  # Integration directory E2E tests
tests/test-utils/**/*e2e*.test.ts   # Test utilities E2E tests
```

### Marketplace-Specific Patterns
```
tests/e2e/**/mcp-*.test.ts         # MCP marketplace tests
tests/e2e/**/marketplace*.test.ts   # Marketplace functionality tests
```

### Browser Automation Patterns
```
packages/browser/src/**/*e2e*.test.ts        # Browser package E2E tests
packages/orchestrator/src/**/*e2e*.test.ts   # Orchestrator E2E tests
```

### Workflow and Integration Patterns
```
packages/orchestrator/src/__tests__/**/*e2e*.test.ts  # Orchestrator workflow E2E tests
packages/core/src/__tests__/**/*e2e*.test.ts         # Core package E2E tests
packages/cli/src/__tests__/**/*e2e*.test.ts          # CLI package E2E tests
```

## E2E Test Types Discovered

The configuration currently discovers these categories of E2E tests:

### Marketplace Tests (16 tests)
- `browse-marketplace.e2e.test.ts` - Marketplace browsing functionality
- `mcp-marketplace*.e2e.test.ts` - Complete marketplace workflows
- Server installation, configuration, and verification flows
- Git workflow lifecycle tests
- CLI command validation

### Package-Level E2E Tests (6+ tests)
- CLI command tests (`init`, `run`, `checkout`, `inspect`, `push`)
- Core functionality tests (autonomy config, container limits)
- Orchestrator workflow tests (TDD executor, browser automation)

### Infrastructure and Validation Tests
- Browser automation integration
- Permission system workflows
- Visual regression testing
- Test infrastructure validation

## Configuration Features

### Timeouts
- **Test timeout**: 60 seconds (for real-world operations)
- **Hook timeout**: 30 seconds (for setup/teardown)

### Execution Model
- **Sequential execution**: Prevents resource conflicts
- **Forked process pool**: Isolates tests (max 4 forks, min 1)
- **Retry policy**: 2 retries in CI environments
- **Verbose reporting**: For debugging failures

### Global Setup/Teardown
- **Setup**: `tests/e2e/setup.ts` - Resource initialization
- **Teardown**: `tests/e2e/teardown.ts` - Cleanup operations

## Exclusion Patterns

The configuration excludes:

```
**/node_modules/**      # Dependencies
**/dist/**             # Build artifacts
**/build/**            # Build output
**/coverage/**         # Coverage reports
**/*.d.ts              # TypeScript declarations
**/*.unit.test.ts      # Unit tests
**/*.spec.ts           # Spec files
tests/*/helpers/**     # Test helper utilities
tests/*/mocks/**       # Mock implementations
tests/*/fixtures/**    # Test fixture data
tests/*/utils/**       # Utility functions
```

## Validation and Monitoring

### Discovery Validation Script

Use the validation script to ensure all E2E tests are being discovered:

```bash
npm run validate:e2e-discovery
```

This script:
1. Manually discovers all E2E test files using glob patterns
2. Validates the vitest configuration syntax and patterns
3. Tests vitest's actual discovery using a dry run
4. Compares manual vs vitest discovery for consistency

### Expected Output

When running the validation script, you should see:
- List of all discovered E2E test files
- Validation of configuration elements
- Comparison of manual vs vitest discovery
- Success/failure summary

## Adding New E2E Tests

### Naming Conventions

To ensure your E2E tests are discovered, use one of these naming patterns:

1. **Standard**: `my-feature.e2e.test.ts`
2. **Prefixed**: `e2e-my-feature.test.ts`
3. **Embedded**: `my-e2e-feature.test.ts`

### Recommended Locations

1. **Package-specific**: `packages/{package}/src/__tests__/{feature}.e2e.test.ts`
2. **System-wide**: `tests/e2e/{category}/{feature}.e2e.test.ts`
3. **Marketplace**: `tests/e2e/mcp-{feature}.e2e.test.ts`

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestProject, cleanupTestProject } from '../utils/mcp-test-utils';

describe('My Feature E2E Tests', () => {
  let testProject: string;

  beforeEach(async () => {
    testProject = await createTestProject();
  });

  afterEach(async () => {
    await cleanupTestProject(testProject);
  });

  it('should perform end-to-end feature testing', async () => {
    // Test implementation
  });
});
```

## Integration with Other Test Types

### Test Command Hierarchy

```bash
npm test                    # All tests (unit, integration, E2E)
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e           # E2E tests only
npm run playwright:test    # Browser automation tests
```

### Coverage Integration

E2E tests contribute to overall coverage reports but are excluded from individual package coverage calculations to focus on unit test coverage metrics.

## Troubleshooting

### Test Not Being Discovered

1. Check if your test file matches one of the naming patterns
2. Verify the file location is not in an excluded directory
3. Run `npm run validate:e2e-discovery` to debug discovery issues

### Performance Issues

1. E2E tests run sequentially to avoid resource conflicts
2. Use `npm run test:e2e:watch` for faster feedback during development
3. Consider breaking large test files into smaller, focused files

### CI/CD Integration

1. E2E tests automatically retry up to 2 times in CI environments
2. Tests fail fast (bail on first error) in CI to save resources
3. Verbose reporting helps debug CI failures

## Migration Guide

If you have existing E2E tests that aren't being discovered:

1. Rename files to follow the naming conventions above
2. Move files to appropriate locations as recommended
3. Run `npm run validate:e2e-discovery` to verify discovery
4. Update any package-specific test scripts to use the unified runner

This unified configuration ensures all E2E tests in the APEX monorepo are discoverable and runnable through a single, consistent interface.