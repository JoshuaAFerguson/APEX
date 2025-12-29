# Windows Compatibility Documentation

This document provides comprehensive information about Windows compatibility in the APEX project, including test compatibility patterns, platform-specific utilities, and guidelines for cross-platform development.

## Overview

APEX is designed to be cross-platform compatible, supporting Windows, macOS, and Linux. However, certain Unix-specific functionality is intentionally skipped on Windows platforms to ensure reliable test execution and proper platform isolation.

## Table of Contents

1. [Unix-Only Tests and Skip Patterns](#unix-only-tests-and-skip-patterns)
2. [Platform-Specific Test Utilities](#platform-specific-test-utilities)
3. [Guidelines for Writing Cross-Platform Tests](#guidelines-for-writing-cross-platform-tests)
4. [Windows-Specific Implementation Status](#windows-specific-implementation-status)
5. [Build and Test Execution on Windows](#build-and-test-execution-on-windows)

## Unix-Only Tests and Skip Patterns

The following categories of tests are intentionally skipped on Windows due to platform-specific limitations or different implementation requirements.

### 1. Service Management Tests

**Location**: `packages/orchestrator/src/service-manager*.test.ts`, `packages/cli/src/handlers/__tests__/service-*.test.ts`

**Skip Pattern**: `describe.skipIf(isWindows)`

**Reason**: Service management functionality uses platform-specific APIs (systemd for Linux, launchd for macOS) that are not available on Windows. Windows service implementation is planned but not yet implemented.

**Examples**:
```typescript
// packages/orchestrator/src/service-manager.test.ts
describe.skipIf(isWindows)('ServiceManager - Linux', () => {
  // Linux-specific systemd service tests
});

describe.skipIf(isWindows)('ServiceManager - macOS', () => {
  // macOS-specific launchd service tests
});

// packages/cli/src/handlers/__tests__/service-handlers.integration.test.ts
describe.skipIf(isWindows)('Service Handlers Integration Tests', () => {
  // Service installation and management tests
});
```

**Files Affected**:
- `packages/orchestrator/src/service-manager.test.ts`
- `packages/orchestrator/src/service-manager-cross-platform.test.ts`
- `packages/orchestrator/src/service-manager-integration.test.ts`
- `packages/orchestrator/src/service-manager-enableonboot.test.ts`
- `packages/cli/src/handlers/__tests__/service-handlers.test.ts`
- `packages/cli/src/handlers/__tests__/service-handlers.integration.test.ts`
- `packages/cli/src/handlers/__tests__/service-management-integration.test.ts`
- `tests/e2e/service-management.e2e.test.ts`

### 2. File Permission Tests

**Location**: `packages/cli/src/services/__tests__/SessionAutoSaver.error-recovery.integration.test.ts`

**Skip Pattern**: `it.skipIf(isWindows)`

**Reason**: Windows has a different permission model than Unix systems. Tests using `fs.chmod()` to create read-only files or modify Unix file permissions don't work the same way on Windows.

**Examples**:
```typescript
// File permission manipulation tests
it.skipIf(isWindows)('should handle read-only sessions directory', async () => {
  // Creates read-only directory with chmod - Unix only
  await fs.chmod(sessionDir, 0o555);
  // Test behavior with permission restrictions
});

it.skipIf(isWindows)('should recover when permissions are restored', async () => {
  // Tests permission recovery - Unix only
  await fs.chmod(sessionFile, 0o644);
});
```

### 3. Unix File Operations Tests

**Location**: `packages/cli/src/__tests__/idle-enable-disable*.test.ts`, `tests/e2e/cli.e2e.test.ts`, `tests/e2e/git-commands.e2e.test.ts`

**Skip Pattern**: `skipOnWindows()` function call

**Reason**: Tests that modify file permissions (`fs.chmod`) or create symbolic links (`fs.symlink`) use Unix-specific APIs that behave differently on Windows.

**Examples**:
```typescript
// packages/cli/src/__tests__/idle-enable-disable.integration.test.ts
it('should handle permission errors gracefully', async () => {
  // Unix-only: chmod permission model doesn't apply to Windows
  skipOnWindows();

  await fs.chmod(apexConfigPath, 0o444); // Read-only
  // Test permission error handling
});

// tests/e2e/cli.e2e.test.ts
it('should handle file permissions correctly', () => {
  // Unix-only: File permission bits don't work the same on Windows
  skipOnWindows();

  await fs.chmod(scriptPath, 0o755); // Make executable
  // Test execution with specific permissions
});
```

### 4. Git Hook Tests

**Location**: `tests/e2e/git-commands.e2e.test.ts`

**Skip Pattern**: `skipOnWindows()` function call

**Reason**: Git hooks on Windows require different handling and the tests use Unix-specific chmod operations to make hook files executable.

**Examples**:
```typescript
// tests/e2e/git-commands.e2e.test.ts
it('should install git hooks with correct permissions', async () => {
  // Unix-only: Git hooks and chmod permissions don't work the same on Windows
  skipOnWindows();

  // Test git hook installation and executable permissions
});
```

## Platform-Specific Test Utilities

APEX provides comprehensive platform detection and test skipping utilities in `@apex/core`.

### Platform Detection Functions

Located in: `packages/core/src/test-utils.ts`

```typescript
import {
  isWindows,
  isUnix,
  isMacOS,
  isLinux,
  getPlatform
} from '@apex/core';

// Platform detection
isWindows()   // true on Windows (win32)
isUnix()      // true on Unix-like systems (Linux, macOS, FreeBSD, etc.)
isMacOS()     // true on macOS (darwin)
isLinux()     // true on Linux
getPlatform() // Returns process.platform string
```

### Test Skipping Functions

```typescript
import {
  skipOnWindows,
  skipOnUnix,
  skipOnMacOS,
  skipOnLinux,
  skipUnlessWindows,
  skipUnlessUnix
} from '@apex/core';

// Skip individual tests
it('Unix-only test', () => {
  skipOnWindows(); // Must be first line in test
  // Unix-specific test logic
});

it('Windows-only test', () => {
  skipUnlessWindows(); // Only runs on Windows
  // Windows-specific test logic
});

// Alternative: Vitest conditional skipping
it.skipIf(isWindows)('Unix-only test', () => {
  // Unix-specific test logic
});

it.skipIf(!isWindows)('Windows-only test', () => {
  // Windows-specific test logic
});
```

### Platform-Specific Test Suites

```typescript
import {
  describeWindows,
  describeUnix,
  describeMacOS,
  describeLinux
} from '@apex/core';

// Platform-specific describe blocks
describeWindows('Windows-specific features', () => {
  // Only runs on Windows
  it('should handle Windows paths', () => {
    // Windows-only tests
  });
});

describeUnix('Unix-specific features', () => {
  // Only runs on Unix-like systems
  it('should handle Unix permissions', () => {
    // Unix-only tests
  });
});

// Alternative: Vitest conditional describes
describe.skipIf(isWindows)('Unix service management', () => {
  // Unix-only test suite
});

describe.skipIf(!isWindows)('Windows service management', () => {
  // Windows-only test suite (when implemented)
});
```

### Platform Mocking for Testing

```typescript
import { mockPlatform, testOnAllPlatforms } from '@apex/core';

// Mock platform for cross-platform testing
it('should work on different platforms', () => {
  const restore = mockPlatform('win32');
  expect(isWindows()).toBe(true);
  // Test Windows-specific behavior
  restore();
});

// Test on all platforms automatically
testOnAllPlatforms('cross-platform feature', (platform) => {
  // Test runs once for each platform (win32, darwin, linux, freebsd)
  expect(myFunction()).toBeTruthy();
});
```

## Guidelines for Writing Cross-Platform Tests

### 1. Use Appropriate Skip Patterns

**For individual tests that use Unix-only APIs**:
```typescript
import { skipOnWindows } from '@apex/core';

it('should handle file permissions', () => {
  skipOnWindows(); // Must be first line

  await fs.chmod(filePath, 0o755);
  // Rest of test logic
});
```

**For Vitest conditional skipping**:
```typescript
import { isWindows } from '@apex/core';

it.skipIf(isWindows)('should handle Unix permissions', () => {
  await fs.chmod(filePath, 0o755);
  // Unix-specific test logic
});
```

**For entire test suites**:
```typescript
import { isWindows } from '@apex/core';

describe.skipIf(isWindows)('Unix service management', () => {
  // All tests in this block skip on Windows

  it('should install systemd service', () => {
    // Linux-specific test
  });

  it('should install launchd service', () => {
    // macOS-specific test
  });
});
```

### 2. Add Inline Comments Explaining Skip Reasons

Always include clear comments explaining why tests are skipped:

```typescript
it('should modify file permissions', () => {
  // Unix-only: chmod permission model doesn't apply to Windows
  skipOnWindows();

  await fs.chmod(configFile, 0o644);
});

it.skipIf(isWindows)('should create executable script', () => {
  // Windows doesn't use Unix permission bits for executability
  await fs.chmod(scriptPath, 0o755);
});

describe.skipIf(isWindows)('Service Management Tests', () => {
  // Windows service management not yet implemented
  // Uses systemd (Linux) and launchd (macOS) which are Unix-only
});
```

### 3. Import Platform Utilities Consistently

**Recommended import pattern**:
```typescript
// For skipOnWindows() function
import { skipOnWindows } from '@apex/core';

// For multiple utilities
import { isWindows, skipOnWindows, mockPlatform } from '@apex/core';

// For conditional skipping
import { isWindows } from '@apex/core';
```

### 4. Choose the Right Skip Pattern

| Use Case | Pattern | Example |
|----------|---------|---------|
| Single test with Unix-only operations | `skipOnWindows()` | File permissions, symlinks |
| Multiple related tests | `it.skipIf(isWindows)` | When you need fine control |
| Entire test suite | `describe.skipIf(isWindows)` | Service management, platform-specific features |
| Windows-only features | `skipUnlessWindows()` or `it.skipIf(!isWindows)` | Windows-specific APIs |

### 5. Test Cross-Platform Behavior When Possible

**Good**: Test both platforms where functionality differs
```typescript
describe('path utilities', () => {
  it('should handle Windows paths', () => {
    const restore = mockPlatform('win32');
    expect(normalizePath('C:\\test\\path')).toBe('C:/test/path');
    restore();
  });

  it('should handle Unix paths', () => {
    const restore = mockPlatform('linux');
    expect(normalizePath('/home/user/test')).toBe('/home/user/test');
    restore();
  });
});
```

**Good**: Use cross-platform APIs when available
```typescript
import path from 'node:path';

// Good: Cross-platform path operations
const configPath = path.join(homeDir, '.apex', 'config.yaml');

// Avoid: Platform-specific path separators
const configPath = homeDir + '/.apex/config.yaml'; // Unix-only
```

## Windows-Specific Implementation Status

### ✅ Implemented and Working on Windows

1. **Core Utilities**: Configuration loading, path utilities, shell command building
2. **CLI Interface**: All command-line functionality except service management
3. **Task Orchestration**: Full workflow execution and agent coordination
4. **API Server**: WebSocket and REST API functionality
5. **Database Operations**: SQLite-based task storage
6. **File Operations**: Reading, writing, and basic file system operations
7. **Git Operations**: All git commands and repository management
8. **Build System**: npm scripts, TypeScript compilation, and testing

### ⚠️ Partially Implemented

1. **Path Utilities**: Cross-platform but with Windows-specific handling
2. **Shell Commands**: Uses platform-specific escaping and command joining
3. **Process Management**: Basic process spawning works, advanced features vary

### ❌ Not Yet Implemented on Windows

1. **Service Management**: No Windows service installation/management
   - **Impact**: Service-related CLI commands are not functional
   - **Workaround**: Use manual process management or alternative deployment methods
   - **Status**: Planned for future implementation

2. **Advanced File Permissions**: Unix permission model not applicable
   - **Impact**: Some security-related features may behave differently
   - **Workaround**: Use Windows-specific security APIs when needed

## Build and Test Execution on Windows

### Building on Windows

All build commands work identically on Windows:

```bash
npm install          # Install dependencies
npm run build        # Build all packages
npm run dev          # Development mode
npm run typecheck    # TypeScript checking
npm run lint         # ESLint
npm run format       # Prettier formatting
```

### Running Tests on Windows

**Full test suite**:
```bash
npm run test
```

**Expected results on Windows**:
- ✅ **~85-90% of tests pass**: All cross-platform functionality
- ⏭️ **~10% of tests skipped**: Unix-only functionality (service management, file permissions)
- ❌ **~0-5% may fail**: Platform-specific edge cases or missing Windows implementations

**Test categories on Windows**:

| Category | Status | Count (approx) |
|----------|--------|----------------|
| Core utilities | ✅ Pass | ~200 tests |
| CLI commands | ✅ Pass | ~150 tests |
| API functionality | ✅ Pass | ~100 tests |
| Database operations | ✅ Pass | ~80 tests |
| Service management | ⏭️ Skip | ~50 tests |
| File permissions | ⏭️ Skip | ~20 tests |
| Git operations | ✅ Pass | ~75 tests |

### Verifying Windows Compatibility

**Check for Unix-only operations**:
```bash
# Search for potential Windows compatibility issues
npm run test 2>&1 | grep -i "skip\|windows\|permission denied"
```

**Verify skip annotations**:
```bash
# Run verification script (if available)
node verify-windows-skip-test.mjs
```

## Troubleshooting Windows Issues

### Common Issues and Solutions

1. **Path Separators**: Use `path.join()` and `path.resolve()` instead of hardcoded `/` or `\`

2. **File Permissions**: Use `skipOnWindows()` for tests that use `fs.chmod()`

3. **Symlinks**: May require Administrator privileges or Developer Mode on Windows

4. **Service Management**: Not yet implemented - skip related tests with `describe.skipIf(isWindows)`

5. **Case Sensitivity**: Windows filesystem is case-insensitive by default

### Development Recommendations

1. **Test on Windows**: Regularly test changes on Windows development environments

2. **Use Cross-Platform APIs**: Prefer Node.js cross-platform APIs over platform-specific ones

3. **Add Skip Annotations**: Always add `skipOnWindows()` for Unix-only functionality

4. **Document Platform Differences**: Add clear comments explaining Windows limitations

5. **Consider Windows Alternatives**: When implementing new features, consider Windows-equivalent APIs

---

## Summary

APEX has excellent Windows compatibility for its core functionality. The test suite properly isolates Unix-specific operations using comprehensive skip patterns, ensuring reliable test execution on Windows. While service management is not yet implemented on Windows, all other major features work cross-platform.

**Key Points**:
- ✅ **85-90% test compatibility** on Windows with appropriate skips
- ✅ **Comprehensive platform utilities** available in `@apex/core`
- ✅ **Consistent skip patterns** across the codebase
- ✅ **Clear documentation** of platform-specific behavior
- ⚠️ **Service management** planned for future Windows implementation

For developers working with APEX on Windows, the platform detection and skip utilities make it straightforward to write cross-platform tests while properly handling platform-specific functionality.