# ADR-065: Windows Skip Annotations for E2E and Documentation Service Tests

## Status

Proposed

## Date

2025-01-28

## Context

The APEX project has established a consistent pattern for Windows compatibility in tests using Vitest's `it.skipIf()` and `describe.skipIf()` APIs. However, two test files use inconsistent patterns:

1. **`tests/e2e/service-management.e2e.test.ts`**: Uses a custom `skipOnWindows` variable pattern that wraps `it.skip`:
   ```typescript
   const skipOnWindows = process.platform === 'win32' ? it.skip : it;
   skipOnWindows('should install service', async () => { ... });
   ```

2. **`tests/documentation/service-management-documentation.test.ts`**: Does not have any Windows skip annotations, but the test reads documentation files which exist cross-platform and should work on Windows.

### Current State Analysis

**Established Pattern in Codebase:**
The rest of the codebase uses a consistent pattern with `it.skipIf()` and `describe.skipIf()`:
```typescript
const isWindows = process.platform === 'win32';

// Windows compatibility: Skip Unix-specific service tests
describe.skipIf(isWindows)('ServiceManager - Linux', () => { ... });
it.skipIf(isWindows)('should install systemd service', () => { ... });
```

This pattern is used in:
- `packages/orchestrator/src/service-manager.test.ts` (15+ describe blocks)
- `packages/orchestrator/src/service-manager.integration.test.ts` (11 tests)
- `packages/orchestrator/src/service-manager-acceptance.test.ts` (8 tests)
- `packages/orchestrator/src/service-manager-enableonboot.test.ts` (7 tests)
- `packages/cli/src/handlers/__tests__/service-handlers.test.ts`
- `packages/cli/src/handlers/__tests__/SessionAutoSaver.error-recovery.integration.test.ts`
- And many more files...

**Available Utilities in `@apex/core`:**
The `packages/core/src/test-utils.ts` provides:
- `isWindows()`: Returns `true` if on Windows
- `skipOnWindows()`: Calls `vi.skip()` if on Windows
- `describeWindows()` / `describeUnix()`: Platform-specific describe blocks
- `mockPlatform()`: For mocking platform in tests

## Decision

### For `tests/e2e/service-management.e2e.test.ts`

Convert from the custom `skipOnWindows` variable pattern to the standard `it.skipIf(isWindows)` pattern:

**Before:**
```typescript
const skipOnWindows = process.platform === 'win32' ? it.skip : it;

skipOnWindows('should install service successfully', async () => { ... });
```

**After:**
```typescript
// Windows compatibility: Skip service management tests on Windows
// as systemd/launchd service management is Unix-only functionality
const isWindows = process.platform === 'win32';

it.skipIf(isWindows)('should install service successfully', async () => { ... });
```

### For `tests/documentation/service-management-documentation.test.ts`

**No changes needed.** After analysis:
- This test only reads and validates the content of `docs/service-management.md`
- The documentation file exists and is readable on all platforms
- The tests check for string content within markdown files
- There are no platform-specific operations that would fail on Windows
- The test correctly asserts that Windows is not mentioned in supported platforms (`expect(docContent).not.toContain('Windows')`)

### For `packages/core` Tests

After reviewing the packages/core tests, most already follow the correct pattern or don't need Windows skip annotations:
- `packages/core/src/__tests__/shell-utils.test.ts`: Already has platform-conditional checks
- `packages/core/src/__tests__/path-utils.test.ts`: Already has platform-conditional checks
- Other core tests are platform-agnostic

The core package's `test-utils.ts` itself exports the platform utilities but tests for these utilities handle mocking appropriately.

## Implementation Plan

### Step 1: Update E2E Test File (High Priority)

File: `tests/e2e/service-management.e2e.test.ts`

1. Replace line 11:
   ```typescript
   // FROM:
   const skipOnWindows = process.platform === 'win32' ? it.skip : it;

   // TO:
   // Windows compatibility: Skip service management tests on Windows
   // Service management (systemd/launchd) is Unix-only functionality
   const isWindows = process.platform === 'win32';
   ```

2. Replace all `skipOnWindows(` with `it.skipIf(isWindows)(`:
   - Line 56: `skipOnWindows('should install service successfully'` → `it.skipIf(isWindows)('should install service successfully'`
   - Line 65: `skipOnWindows('should show service status'` → `it.skipIf(isWindows)('should show service status'`
   - Line 75: `skipOnWindows('should uninstall service'` → `it.skipIf(isWindows)('should uninstall service'`
   - Line 96: `skipOnWindows('should handle force installation'` → `it.skipIf(isWindows)('should handle force installation'`
   - Line 117: `skipOnWindows('should handle custom service name'` → `it.skipIf(isWindows)('should handle custom service name'`
   - Line 162: `skipOnWindows('should provide helpful error messages'` → `it.skipIf(isWindows)('should provide helpful error messages'`
   - Line 181: `skipOnWindows('should respect configuration file settings'` → `it.skipIf(isWindows)('should respect configuration file settings'`
   - Line 211: `skipOnWindows('should handle CLI flags overriding config'` → `it.skipIf(isWindows)('should handle CLI flags overriding config'`
   - Line 243: `skipOnWindows('should work on Linux'` → `it.skipIf(isWindows)('should work on Linux'`
   - Line 257: `skipOnWindows('should work on macOS'` → `it.skipIf(isWindows)('should work on macOS'`
   - Line 293: `skipOnWindows('should provide clear installation feedback'` → `it.skipIf(isWindows)('should provide clear installation feedback'`
   - Line 322: `skipOnWindows('should provide clear uninstallation feedback'` → `it.skipIf(isWindows)('should provide clear uninstallation feedback'`
   - Line 369: `skipOnWindows('should handle complete install-status-uninstall cycle'` → `it.skipIf(isWindows)('should handle complete install-status-uninstall cycle'`
   - Line 390: `skipOnWindows('should handle reinstallation gracefully'` → `it.skipIf(isWindows)('should handle reinstallation gracefully'`

### Step 2: Review Documentation Test File (No Changes)

File: `tests/documentation/service-management-documentation.test.ts`

- **No changes required** - tests are reading documentation files which are cross-platform
- The test correctly validates that Windows is NOT mentioned as a supported platform

### Step 3: Review packages/core Tests (Already Compliant)

Files reviewed:
- `packages/core/src/__tests__/shell-utils.test.ts` - Uses conditional platform checks appropriately
- `packages/core/src/__tests__/path-utils.test.ts` - Uses conditional platform checks appropriately
- `packages/core/src/__tests__/path-utils-windows.test.ts` - Uses `const isActualWindows = process.platform === 'win32'` pattern
- `packages/core/src/__tests__/shell-utils-windows.test.ts` - Uses appropriate pattern

These files are already using the correct patterns or are platform-agnostic.

## Consequences

### Positive

1. **Consistency**: All service-related tests will use the same `it.skipIf(isWindows)` pattern
2. **Clarity**: The explanatory comments make the reason for skipping explicit
3. **Maintainability**: Easier to find and update Windows-skipped tests using grep/search
4. **Vitest Native**: Uses Vitest's built-in `skipIf` API rather than custom wrappers
5. **Verification**: The existing `verify-windows-skip-annotations.mjs` script can be extended to verify e2e tests

### Negative

1. **Slight Verbosity**: `it.skipIf(isWindows)` is slightly longer than `skipOnWindows`
2. **Breaking Pattern**: The e2e file had a valid working pattern; this is a refactor for consistency

### Neutral

1. **No Behavioral Change**: Tests will skip on Windows exactly as before
2. **Documentation Tests Unchanged**: They work cross-platform by design

## Verification

After implementation:
1. Run `npm run build` - should pass with no errors
2. Run `npm test` - all tests should pass
3. Run `node verify-windows-skip-annotations.mjs` - should continue to pass for orchestrator tests
4. Optionally extend verification script to include e2e tests

## Alternatives Considered

### Alternative 1: Use `@apex/core` test utilities

```typescript
import { skipOnWindows } from '@apex/core';

it('should install service', () => {
  skipOnWindows();
  // test code
});
```

**Rejected because:**
- This uses `vi.skip()` inside the test body, not `it.skipIf()` in the test declaration
- Less visible in test output (test starts then skips vs. marked as skipped from start)
- Not consistent with the pattern used in orchestrator tests

### Alternative 2: Keep custom `skipOnWindows` pattern

**Rejected because:**
- Inconsistent with the established pattern in the rest of the codebase
- Makes it harder to search/grep for all Windows-skipped tests
- Custom wrapper vs. using Vitest's native API

## References

- ADR-006: Cross-Platform Test Utilities
- ADR-051: Windows Platform Support
- `packages/core/src/test-utils.ts`: Platform detection utilities
- `verify-windows-skip-annotations.mjs`: Existing verification script
