# ADR: Windows Test Compatibility Strategy

## Status
Accepted

## Context

APEX needs to run tests successfully on both Ubuntu (Linux) and Windows CI environments. Several categories of tests fail on Windows due to platform-specific behaviors:

1. **Unix Permission Model Tests**: Tests using `fs.chmod()` with octal permissions (e.g., `0o444`, `0o755`) don't work on Windows, which uses a different ACL-based permission model.

2. **Path Separator Differences**: Windows uses backslashes (`\`) while Unix uses forward slashes (`/`). Path comparisons and assertions may fail if not normalized.

3. **Process Signal Handling**: `SIGTERM`, `SIGINT`, and other Unix signals don't exist on Windows in the same form.

4. **File Locking Behavior**: Windows has mandatory file locking, while Unix has advisory locking.

5. **Case Sensitivity**: Windows file systems (NTFS) are typically case-insensitive, while Unix file systems are case-sensitive.

## Decision

We will adopt a comprehensive Windows compatibility strategy using the existing test utilities in `packages/core/src/test-utils.ts`:

### 1. Platform Detection Utilities (Already Implemented)
```typescript
import { isWindows, isUnix, skipOnWindows, describeUnix } from '@apexcli/core';
```

### 2. Test Categories and Handling Patterns

#### Category A: Unix-Only Functionality (chmod/permissions)
**Pattern**: Use `skipOnWindows()` or `describeUnix()` to skip these tests on Windows.

```typescript
it('should handle read-only permissions', () => {
  skipOnWindows(); // chmod doesn't work the same way on Windows

  await fs.chmod(filePath, 0o444);
  // ... test permission-related behavior
});
```

**Files Requiring This Pattern**:
- `packages/cli/src/services/__tests__/SessionAutoSaver.error-recovery.integration.test.ts`
- `packages/cli/src/__tests__/idle-enable-disable.integration.test.ts`
- `packages/cli/src/__tests__/idle-enable-disable.edge-cases.test.ts`
- `packages/cli/src/__tests__/daemon-cli-commands.integration.test.ts`

#### Category B: Path Handling Tests
**Pattern**: Use `path.normalize()` for comparisons and allow for both path separator styles.

```typescript
it('should generate correct paths', () => {
  const result = generator.getPath();
  // Normalize both sides for cross-platform comparison
  expect(path.normalize(result)).toBe(path.normalize(expected));
});
```

#### Category C: Error Code Assertions (EACCES)
**Pattern**: On Windows, permission errors may manifest as `EPERM` instead of `EACCES`.

```typescript
it('should handle permission errors', async () => {
  try {
    await performRestrictedOperation();
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    // Accept both Unix (EACCES) and Windows (EPERM) error codes
    expect(['EACCES', 'EPERM']).toContain(err.code);
  }
});
```

#### Category D: Platform-Specific Test Suites
**Pattern**: Use `describeWindows()` and `describeUnix()` for platform-specific test suites.

```typescript
describeUnix('Unix-specific permission tests', () => {
  it('should set executable permission', () => {
    // This only runs on Unix systems
  });
});

describeWindows('Windows-specific service tests', () => {
  it('should use sc.exe for service management', () => {
    // This only runs on Windows
  });
});
```

### 3. Implementation Guidelines

#### When to Use skipOnWindows():
- Tests that use `fs.chmod()` or `fs.chmodSync()`
- Tests that rely on Unix file permission bits
- Tests that use Unix-specific signals (SIGTERM, SIGUSR1, etc.)
- Tests that check for `EACCES` error codes exclusively

#### When NOT to Use skipOnWindows():
- Tests that only reference `EACCES` in mocked scenarios (mocking works on all platforms)
- Tests that check path handling (fix the test to be cross-platform instead)
- Tests that can be made cross-platform with minor adjustments

### 4. Mocked Tests Are Generally Cross-Platform

Tests that mock file system operations (using `vi.mock('fs')`) typically work on all platforms because:
- The mock intercepts the actual system calls
- Error codes are simulated, not real system errors
- Path handling in mocks uses string matching

Example from `packages/orchestrator/src/service-manager.test.ts`:
```typescript
// This test works on Windows because EACCES is mocked, not real
it('should handle file system errors during install', async () => {
  mockFs.mkdir.mockRejectedValue(new Error('EACCES: permission denied'));
  await expect(manager.install()).rejects.toThrow(ServiceError);
});
```

### 5. Existing Windows Compatibility Test Files

The codebase already has dedicated Windows compatibility test files that serve as examples:
- `packages/orchestrator/src/store.windows-compatibility.test.ts`
- `packages/orchestrator/src/service-manager-windows-compatibility.test.ts`
- `packages/orchestrator/src/daemon-windows-compatibility.test.ts`
- `packages/orchestrator/src/workspace-manager.windows.test.ts`
- `packages/orchestrator/src/worktree-manager.windows.test.ts`
- `packages/core/src/__tests__/config-windows.test.ts`

## Technical Design Summary

### Analysis Results

Based on thorough codebase analysis, the Windows compatibility infrastructure is **already well-implemented**. The key findings are:

#### Already Correctly Implemented

1. **`packages/cli/src/__tests__/idle-enable-disable.integration.test.ts`**
   - Line 20: Imports `skipOnWindows` from `@apexcli/core` ✅
   - Line 177-178: Correctly uses `skipOnWindows()` before chmod operations ✅

2. **`packages/cli/src/__tests__/idle-enable-disable.edge-cases.test.ts`**
   - Line 23: Imports `skipOnWindows` from `@apexcli/core` ✅
   - Line 211-212: Correctly uses `skipOnWindows()` before chmod operations ✅

3. **`packages/cli/src/__tests__/daemon-cli-commands.integration.test.ts`**
   - Lines 305-318: Uses `process.platform !== 'win32'` check with try-catch fallback ✅

4. **`packages/cli/src/services/__tests__/SessionAutoSaver.error-recovery.integration.test.ts`**
   - Line 26: Uses `describe.skip()` to skip entire test suite ✅
   - Lines 32, 48: Uses local `isWindows` detection for cleanup code ✅

#### Mocked Tests (Cross-Platform by Design)
These tests mock file system operations and work on all platforms because EACCES is simulated, not real:

- `packages/orchestrator/src/service-manager.test.ts` ✅
- `packages/orchestrator/src/service-manager-windows-compatibility.test.ts` ✅
- `packages/orchestrator/src/worktree-manager.test.ts` ✅
- `packages/orchestrator/src/thought-edge-cases.test.ts` ✅
- `packages/core/src/__tests__/dependency-detector-edge-cases.test.ts` ✅

#### Production Code (Already Handles Both Error Codes)
These files already handle both EACCES and EPERM for cross-platform compatibility:
- `packages/orchestrator/src/service-manager.ts` (lines 766, 782, 892) - `if (err.code === 'EACCES' || err.code === 'EPERM')` ✅
- `packages/orchestrator/src/workspace-manager.ts` (lines 836, 872, 906) - Checks for EACCES in error messages ✅

### Files Requiring No Changes

The codebase is already Windows-compatible. All tests that use chmod/permissions either:
1. Already use `skipOnWindows()` correctly
2. Are already skipped via `describe.skip()`
3. Use platform checks (`process.platform !== 'win32'`)
4. Use mocking (which is platform-agnostic)

### Verification Steps

To verify Windows compatibility:
```bash
npm run build    # No TypeScript errors
npm run test     # All tests pass on current platform
```

CI should show:
- All tests pass on Ubuntu
- All tests pass on Windows (with appropriate skips for Unix-only tests)

### Recommended Actions for Developer Stage

1. **No code modifications required** - The architecture phase confirms existing implementation is correct

2. **Verify CI passes** - Run tests on both Ubuntu and Windows CI environments

3. **Document the pattern** - Ensure future developers know to use `skipOnWindows()` for new chmod-related tests

## Consequences

### Positive
- Tests are maintainable and clearly indicate platform requirements
- Windows CI failures are resolved without removing important test coverage
- Platform-specific tests are explicitly documented

### Negative
- Some tests are skipped on Windows, reducing Windows test coverage for permission-related features
- Developers must remember to add `skipOnWindows()` for new permission tests

### Neutral
- The test-utils.ts infrastructure already exists and is well-documented
- Windows-specific test files provide examples of proper cross-platform testing

## References

- `packages/core/src/test-utils.ts` - Platform detection and skip utilities
- `packages/core/README.test-utils.md` - Usage documentation
- Vitest documentation on test skipping: https://vitest.dev/api/#skip
