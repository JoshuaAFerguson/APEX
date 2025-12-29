# ADR-017: Windows Compatibility Tests for TaskStore Module

## Status
Proposed

## Context

The `TaskStore` module in `@apex/orchestrator` uses SQLite via `better-sqlite3` for persistent task storage. While the module uses Node.js path APIs which are inherently cross-platform, Windows-specific behaviors need explicit test coverage to ensure:

1. **Windows path handling**: Paths containing backslashes, spaces, and special characters (e.g., `C:\Program Files\My App\`)
2. **SQLite on Windows file systems**: NTFS-specific behaviors with database creation and file locking
3. **Config directory resolution**: Proper use of `%APPDATA%` through `getConfigDir()` from `@apexcli/core`
4. **Database lock behavior**: Windows file locking semantics differ from Unix

The `@apexcli/core` package already provides:
- `normalizePath()` - Cross-platform path normalization
- `getConfigDir()` - Platform-aware config directory resolution (uses `%APPDATA%` on Windows)
- `getHomeDir()` - Cross-platform home directory detection

## Decision

Create a dedicated Windows compatibility test file: `packages/orchestrator/src/store.windows.test.ts`

The tests will use mocked `process.platform` to simulate Windows environments, following the established pattern in other test files like `daemon-windows-compatibility.test.ts` and `service-manager-windows-compatibility.test.ts`.

## Test Architecture

### Test File Structure

```
packages/orchestrator/src/
├── store.ts                              # Main TaskStore implementation
├── store.test.ts                         # Existing general tests
├── store.windows.test.ts                 # NEW: Windows compatibility tests
└── ...
```

### Test Categories

#### 1. SQLite Database Creation on Windows Paths

Test database creation with various Windows path formats:
- Standard Windows paths (`C:\Users\test\project\.apex\apex.db`)
- Paths with spaces (`C:\Program Files\My App\.apex\apex.db`)
- Paths with unicode characters (`C:\Users\测试用户\project\.apex\apex.db`)
- UNC paths (`\\server\share\project\.apex\apex.db`)
- Long paths (>260 characters when applicable)

```typescript
describe('SQLite database creation on Windows paths', () => {
  it('should create database with standard Windows path', async () => {
    // Mock Windows platform
    // Create store with Windows-style project path
    // Verify database is created successfully
  });

  it('should handle paths with spaces', async () => {
    // Test: C:\Program Files\My App\project
  });

  it('should handle paths with unicode characters', async () => {
    // Test: C:\Users\测试用户\Documents\project
  });
});
```

#### 2. File Path Normalization for Windows

Test that the store correctly normalizes paths using `normalizePath()`:
- Forward slash conversion to backslashes
- Mixed separator handling
- Relative path resolution
- Parent directory traversal (`..`)

```typescript
describe('File path normalization for Windows', () => {
  it('should normalize forward slashes to backslashes', async () => {
    // Verify path.join behavior on mocked Windows
  });

  it('should handle mixed path separators', async () => {
    // Test: C:/Users\test/project\.apex
  });
});
```

#### 3. Database Lock Behavior on Windows

Test NTFS-specific locking behavior:
- WAL mode operations
- Concurrent access patterns
- Lock contention handling
- Clean shutdown with held locks

```typescript
describe('Database lock behavior on Windows', () => {
  it('should enable WAL mode on Windows file system', async () => {
    // Verify WAL pragma works correctly
  });

  it('should handle database access from multiple store instances', async () => {
    // Test concurrent access patterns
  });

  it('should release locks properly on close', async () => {
    // Verify db.close() releases file handles
  });
});
```

#### 4. Config Directory Resolution Using Windows %APPDATA%

Test integration with `getConfigDir()` from `@apexcli/core`:
- Verify `%APPDATA%` is used on Windows
- Handle undefined `APPDATA` environment variable
- Fallback to `%USERPROFILE%\AppData\Roaming`

```typescript
describe('Config directory resolution with %APPDATA%', () => {
  it('should use APPDATA environment variable on Windows', async () => {
    // Mock process.platform = 'win32'
    // Mock process.env.APPDATA
    // Verify getConfigDir() returns correct path
  });

  it('should fallback when APPDATA is not set', async () => {
    // Test fallback behavior
  });
});
```

### Mocking Strategy

Following established patterns from the codebase:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('TaskStore - Windows Compatibility', () => {
  let originalPlatform: NodeJS.Platform;

  beforeEach(() => {
    originalPlatform = process.platform;
    // Mock Windows platform
    Object.defineProperty(process, 'platform', {
      value: 'win32',
      configurable: true
    });
  });

  afterEach(() => {
    // Restore original platform
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      configurable: true
    });
  });

  // Tests go here
});
```

### Test Utilities

Create helper functions for Windows path generation:

```typescript
function createWindowsPath(...segments: string[]): string {
  return segments.join('\\');
}

function createWindowsPathWithSpaces(): string {
  return 'C:\\Program Files\\My App\\project';
}
```

## Implementation Details

### Dependencies

The test file will use:
- `vitest` for test framework
- `better-sqlite3` for SQLite operations
- `@apexcli/core` for `getConfigDir`, `normalizePath`, `getHomeDir`
- Node.js `fs`, `path`, `os` modules

### Test Database Location

Tests will use `os.tmpdir()` for creating temporary test directories, ensuring cleanup after each test.

### Cross-Platform Execution

While tests mock Windows behavior, they should:
1. Run successfully on any platform (macOS, Linux, Windows)
2. Use actual better-sqlite3 operations when possible
3. Mock only platform detection, not SQLite behavior

## Alternatives Considered

### 1. Only Run Tests on Windows CI

**Rejected**: This would delay feedback for developers on macOS/Linux and reduce test reliability.

### 2. Skip Windows Tests Entirely

**Rejected**: Windows is a supported platform and needs explicit test coverage.

### 3. Use Docker for Windows Testing

**Rejected**: Adds complexity without significant benefits for unit-level path handling tests.

## Acceptance Criteria

1. New or extended tests covering:
   - SQLite database creation on Windows paths (including paths with spaces)
   - File path normalization for Windows
   - Database lock behavior on Windows
   - Config directory resolution using Windows `%APPDATA%`

2. Tests verify `better-sqlite3` works correctly on Windows file system

3. All tests pass with `npm test --workspace=@apex/orchestrator`

## Implementation Plan

### Phase 1: Create Test File Structure

1. Create `packages/orchestrator/src/store.windows.test.ts`
2. Add test utilities for Windows path generation
3. Implement platform mocking infrastructure

### Phase 2: Implement Core Tests

1. Windows path database creation tests
2. Path normalization tests
3. Database lock behavior tests
4. Config directory resolution tests

### Phase 3: Validation

1. Run tests on current platform
2. Verify no regressions in existing tests
3. Ensure build passes

## Related Documents

- `packages/core/src/path-utils.ts` - Cross-platform path utilities
- `packages/orchestrator/src/store.ts` - TaskStore implementation
- `packages/orchestrator/src/__tests__/sqlite-native-module.test.ts` - Existing SQLite tests
- `packages/orchestrator/src/daemon-windows-compatibility.test.ts` - Windows test patterns
- `packages/orchestrator/src/service-manager-windows-compatibility.test.ts` - Windows test patterns
