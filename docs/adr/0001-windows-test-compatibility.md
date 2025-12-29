# ADR-0001: Windows Test Compatibility Architecture

## Status

**Accepted**

## Context

APEX CI runs on both `ubuntu-latest` and `windows-latest` (see `.github/workflows/ci.yml`). Some tests use Unix-specific features that don't work on Windows:

1. **File permissions (`chmod`)** - Unix file permissions (0o755, 0o444, etc.) don't behave the same way on Windows
2. **Symlinks (`symlink`)** - Windows requires elevated permissions or Developer Mode for symlinks
3. **Process spawning** - Different shell commands and path separators on Windows vs Unix
4. **Path handling** - Backslashes vs forward slashes, drive letters, UNC paths

The codebase already has comprehensive platform test utilities in `packages/core/src/test-utils.ts` that provide:

- `skipOnWindows()`, `skipOnUnix()`, `skipOnMacOS()`, `skipOnLinux()` - Skip individual tests
- `skipUnlessWindows()`, `skipUnlessUnix()` - Only run on specific platforms
- `describeWindows()`, `describeUnix()`, `describeMacOS()`, `describeLinux()` - Skip entire test suites
- `runOnWindows()`, `runOnUnix()`, etc. - Conditionally execute code
- `mockPlatform()` - Mock platform for cross-platform testing
- `testOnAllPlatforms()` - Run the same test on all platforms

## Decision

### Architecture for Unix-Only Test Handling

We will use a **three-tier approach** for handling Unix-specific tests:

#### Tier 1: Use `skipOnWindows()` or `it.skipIf()` for Individual Tests

For individual tests that use Unix-specific features, add `skipOnWindows()` at the start:

```typescript
import { skipOnWindows } from '@apexcli/core';

it('should handle Unix file permissions', () => {
  skipOnWindows(); // Skips this test on Windows

  await fs.chmod(filePath, 0o755);
  // ... test code
});
```

Or use Vitest's built-in `skipIf`:

```typescript
const isWindows = process.platform === 'win32';

it.skipIf(isWindows)('should handle Unix file permissions', () => {
  await fs.chmod(filePath, 0o755);
  // ... test code
});
```

#### Tier 2: Use `describeUnix()` for Test Suites

For groups of Unix-specific tests, wrap them in `describeUnix()`:

```typescript
import { describeUnix } from '@apexcli/core';

describeUnix('Unix permission tests', () => {
  it('should set read-only permissions', () => {
    // All tests in this block are skipped on Windows
  });

  it('should handle symlinks', () => {
    // ...
  });
});
```

#### Tier 3: Create Platform-Specific Test Files (Optional)

For extensive platform-specific tests, consider separate files:

```
packages/
  orchestrator/src/
    store.test.ts                        # Cross-platform tests
    store.windows-compatibility.test.ts  # Windows-specific tests (already exists)
    store.unix-specific.test.ts          # Unix-specific tests
```

### Tests Requiring Platform Guards

Based on the codebase analysis, the following tests use Unix-specific features and need guards:

| Test File | Unix Feature | Recommended Solution |
|-----------|--------------|---------------------|
| `cli/src/__tests__/idle-enable-disable.edge-cases.test.ts` | `chmod`, `symlink` | Add `skipOnWindows()` to affected tests |
| `cli/src/__tests__/idle-enable-disable.integration.test.ts` | `chmod` | Add `skipOnWindows()` to line 183 test |
| `cli/src/services/__tests__/SessionAutoSaver.error-recovery.integration.test.ts` | `chmod` (multiple) | Already uses `it.skipIf(isWindows)` ✅ |

### Verification Approach

1. **Run tests locally on macOS/Linux** - All tests should pass
2. **CI on Windows** - Unix-specific tests should show as "skipped" (not failed)
3. **Test output example:**
   ```
   ✓ should handle file operations (45ms)
   ○ should handle Unix file permissions (skipped)
   ✓ should handle Windows paths (32ms)
   ```

### Implementation Pattern

For tests that currently use `chmod` or `symlink` without guards:

```typescript
// BEFORE (fails on Windows)
it('should handle read-only directory', async () => {
  await fs.chmod(path.dirname(configPath), 0o555);
  // ... test
  await fs.chmod(path.dirname(configPath), 0o755); // cleanup
});

// AFTER (skips on Windows)
it('should handle read-only directory', async () => {
  skipOnWindows(); // Add this line

  await fs.chmod(path.dirname(configPath), 0o555);
  // ... test
  await fs.chmod(path.dirname(configPath), 0o755); // cleanup
});
```

## Consequences

### Positive

- **Tests pass on all CI platforms** - No false failures on Windows
- **Clear skip reasons** - Test output shows `(skipped on win32)` for easy debugging
- **Centralized utilities** - `@apexcli/core` exports all platform utilities
- **Minimal code changes** - Just add one line per affected test
- **Already implemented** - Most Windows-specific tests already use this pattern

### Negative

- **Some tests don't run on Windows** - Unix-specific functionality not fully tested on Windows
- **Must remember to add guards** - New Unix-specific tests need manual guard addition

### Neutral

- **Test coverage remains high on Linux/macOS** - Primary development platforms
- **Windows-specific tests exist** - `*windows-compatibility.test.ts` files cover Windows behaviors

## Files to Modify

Based on the grep results, these files need platform guards added:

1. `packages/cli/src/__tests__/idle-enable-disable.edge-cases.test.ts`
   - Line 216: `fs.chmod` - add `skipOnWindows()`
   - Line 256-259: `fs.symlink` - add `skipOnWindows()`

2. `packages/cli/src/__tests__/idle-enable-disable.integration.test.ts`
   - Line 183: `fs.chmod` - add `skipOnWindows()`

## Related Files

### Already Properly Guarded
- `packages/cli/src/services/__tests__/SessionAutoSaver.error-recovery.integration.test.ts` - Uses `it.skipIf(isWindows)` ✅

### Test Utilities Reference
- `packages/core/src/test-utils.ts` - All platform utilities
- `packages/core/src/index.ts` - Exports test utilities

### CI Configuration
- `.github/workflows/ci.yml` - Runs on `ubuntu-latest` and `windows-latest`

## Notes

The test utilities are already exported from `@apexcli/core`, so any test file can import them:

```typescript
import {
  skipOnWindows,
  describeUnix,
  isWindows
} from '@apexcli/core';
```
