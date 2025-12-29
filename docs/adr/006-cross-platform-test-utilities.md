# ADR 006: Cross-Platform Test Utilities

## Status
Accepted

## Date
2025-01-XX

## Context

The APEX project needs to support cross-platform development and testing on Windows, macOS, and Linux. Currently, platform-specific test mocking is duplicated across multiple test files:

1. `packages/core/src/__tests__/shell-utils.test.ts` - Uses `vi.mock('os')` pattern
2. `packages/core/src/__tests__/config-cross-platform-paths.test.ts` - Uses `Object.defineProperty(process, 'platform')` pattern
3. `packages/orchestrator/src/__tests__/service-manager-windows-compatibility.test.ts` - Uses similar patterns

This leads to:
- **Code duplication**: Each test file re-implements platform mocking
- **Inconsistency**: Different patterns used across files
- **Maintenance burden**: Changes to mocking patterns require updates in multiple places
- **Barrier to entry**: New contributors must understand various mocking patterns

## Decision

We will create a centralized **cross-platform test utilities module** in `packages/core/src/test-utils.ts` that provides:

### 1. Platform Detection Helpers (Runtime)
```typescript
export function isWindows(): boolean
export function isMacOS(): boolean
export function isLinux(): boolean
export function isUnix(): boolean  // macOS, Linux, FreeBSD, etc.
```

### 2. Conditional Test Execution Helpers (Vitest Integration)
```typescript
export function skipOnWindows(): void
export function skipOnUnix(): void
export function skipOnMacOS(): void
export function skipOnLinux(): void

export function describeWindows(name: string, fn: () => void): void
export function describeUnix(name: string, fn: () => void): void
export function describeMacOS(name: string, fn: () => void): void
export function describeLinux(name: string, fn: () => void): void

export function itWindows(name: string, fn: () => void | Promise<void>): void
export function itUnix(name: string, fn: () => void | Promise<void>): void
export function itMacOS(name: string, fn: () => void | Promise<void>): void
export function itLinux(name: string, fn: () => void | Promise<void>): void
```

### 3. Platform Context for Assertions
```typescript
export function getPlatformContext(): PlatformContext
export interface PlatformContext {
  platform: NodeJS.Platform
  isWindows: boolean
  isUnix: boolean
  isMacOS: boolean
  isLinux: boolean
  pathSeparator: string
  lineEnding: string
}
```

## Architecture

### Module Location
```
packages/core/src/
├── test-utils.ts          # New file - cross-platform test utilities
├── shell-utils.ts         # Existing - re-use isWindows() from here
├── index.ts               # Export test-utils
└── __tests__/
    └── test-utils.test.ts # Tests for the utilities
```

### Design Principles

1. **Leverage Existing Code**: Re-use `isWindows()` from `shell-utils.ts` internally
2. **Vitest First**: Design for Vitest's `describe.skipIf()` and `it.skipIf()` patterns
3. **No External Dependencies**: Only use Node.js built-ins (`os`) and Vitest globals
4. **Type Safety**: Full TypeScript types with JSDoc documentation
5. **Composable**: Functions can be used independently or combined

### Implementation Pattern

The utilities use Vitest's built-in conditional execution:

```typescript
import { describe, it } from 'vitest';
import * as os from 'os';

// Platform detection - evaluates at runtime
export function isWindows(): boolean {
  return os.platform() === 'win32';
}

export function isUnix(): boolean {
  const platform = os.platform();
  return platform === 'darwin' || platform === 'linux' ||
         platform === 'freebsd' || platform === 'openbsd';
}

// Skip helpers - throw SkipError when condition met
export function skipOnWindows(): void {
  if (isWindows()) {
    throw new Error('Test skipped on Windows');
  }
}

// Conditional describe/it wrappers
export const describeWindows = isWindows() ? describe : describe.skip;
export const describeUnix = isUnix() ? describe : describe.skip;

export const itWindows = isWindows() ? it : it.skip;
export const itUnix = isUnix() ? it : it.skip;
```

### Usage Examples

#### Example 1: Skip individual tests
```typescript
import { skipOnWindows, skipOnUnix } from '@apex/core';

describe('Shell Commands', () => {
  it('uses Unix shell syntax', () => {
    skipOnWindows();
    // Unix-only test
  });

  it('uses Windows shell syntax', () => {
    skipOnUnix();
    // Windows-only test
  });
});
```

#### Example 2: Platform-specific test suites
```typescript
import { describeWindows, describeUnix } from '@apex/core';

describeWindows('Windows Shell Integration', () => {
  it('executes cmd.exe commands', () => {
    // Only runs on Windows
  });
});

describeUnix('Unix Shell Integration', () => {
  it('executes bash commands', () => {
    // Only runs on macOS/Linux
  });
});
```

#### Example 3: Platform context in assertions
```typescript
import { getPlatformContext } from '@apex/core';

describe('Path handling', () => {
  it('uses correct separator', () => {
    const ctx = getPlatformContext();
    const result = buildPath('foo', 'bar');

    if (ctx.isWindows) {
      expect(result).toBe('foo\\bar');
    } else {
      expect(result).toBe('foo/bar');
    }
  });
});
```

## File Structure

### New File: `packages/core/src/test-utils.ts`

```typescript
/**
 * Cross-platform test utilities for APEX
 *
 * Provides helpers for writing platform-aware tests that can:
 * - Skip tests on specific platforms
 * - Run test suites conditionally by platform
 * - Access platform context for assertions
 *
 * @module test-utils
 */

import { describe, it } from 'vitest';
import * as os from 'os';

// ============================================================================
// Platform Detection
// ============================================================================

/** Check if running on Windows */
export function isWindows(): boolean { ... }

/** Check if running on macOS */
export function isMacOS(): boolean { ... }

/** Check if running on Linux */
export function isLinux(): boolean { ... }

/** Check if running on Unix-like system (macOS, Linux, FreeBSD, etc.) */
export function isUnix(): boolean { ... }

// ============================================================================
// Test Skipping Helpers
// ============================================================================

/** Skip the current test on Windows */
export function skipOnWindows(): void { ... }

/** Skip the current test on Unix-like systems */
export function skipOnUnix(): void { ... }

/** Skip the current test on macOS */
export function skipOnMacOS(): void { ... }

/** Skip the current test on Linux */
export function skipOnLinux(): void { ... }

// ============================================================================
// Platform-Conditional Test Suites
// ============================================================================

/** Describe block that only runs on Windows */
export const describeWindows = ...;

/** Describe block that only runs on Unix */
export const describeUnix = ...;

/** Describe block that only runs on macOS */
export const describeMacOS = ...;

/** Describe block that only runs on Linux */
export const describeLinux = ...;

// ============================================================================
// Platform-Conditional Individual Tests
// ============================================================================

/** Test that only runs on Windows */
export const itWindows = ...;

/** Test that only runs on Unix */
export const itUnix = ...;

/** Test that only runs on macOS */
export const itMacOS = ...;

/** Test that only runs on Linux */
export const itLinux = ...;

// ============================================================================
// Platform Context
// ============================================================================

/** Platform context information */
export interface PlatformContext { ... }

/** Get current platform context for assertions */
export function getPlatformContext(): PlatformContext { ... }
```

### Export from index.ts

Add to `packages/core/src/index.ts`:
```typescript
// Test Utilities (cross-platform testing helpers)
export * from './test-utils';
```

## Alternatives Considered

### 1. Separate `@apex/test-utils` Package
**Rejected**: Adds unnecessary package overhead for a small utility set. The utilities are tightly coupled to core types and platform detection.

### 2. Use `jest-platform` or Similar Library
**Rejected**: Adds external dependency. The implementation is simple enough to maintain in-house, and we use Vitest, not Jest.

### 3. Put Utilities in a `test/` Directory Outside Packages
**Rejected**: Would require special build configuration and wouldn't be easily importable by packages.

### 4. Extend Vitest Configuration with Custom Matchers
**Rejected**: More complex setup, requires vitest configuration changes across packages. Our approach is simpler and more portable.

## Consequences

### Positive
- **Single source of truth** for platform detection in tests
- **Consistent patterns** across all packages
- **Reduced duplication** in test files
- **Better discoverability** via TypeScript autocomplete
- **Easier onboarding** for new contributors
- **Re-usable** by other packages via `@apex/core` import

### Negative
- **Additional API surface** in @apex/core (minor)
- **Vitest dependency** in type signatures (acceptable - we're committed to Vitest)

### Neutral
- **No breaking changes** - existing test patterns continue to work
- **Opt-in adoption** - teams can migrate tests incrementally

## Implementation Notes

1. The `skipOn*` functions use Vitest's test skip mechanism
2. Platform detection uses `os.platform()` from Node.js
3. The `describe*/it*` variants are assigned at module load time based on current platform
4. All functions are synchronous - no async overhead
5. Full JSDoc documentation for IDE support

## Testing Strategy

The test utilities themselves will be tested in `packages/core/src/__tests__/test-utils.test.ts`:
- Verify platform detection matches `os.platform()`
- Verify skip functions work correctly
- Verify conditional describe/it wrappers
- Mock `os.platform()` to test all code paths
