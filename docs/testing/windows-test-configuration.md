# Windows Test Configuration Documentation

## Overview

This document provides comprehensive documentation for Windows-specific test configuration in the APEX project. It covers test execution, Windows CI integration, cross-module testing, and Windows-specific test patterns.

## Windows CI Configuration

### GitHub Actions Matrix

The project uses a multi-platform CI matrix in `.github/workflows/ci.yml`:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest]
    node-version: [18.x, 20.x]
```

This ensures all tests run on both Ubuntu and Windows environments across multiple Node.js versions.

### CI Steps

The CI pipeline executes the following steps on Windows:

1. **Checkout**: Code repository checkout
2. **Node.js Setup**: Node.js installation with npm cache
3. **Install**: `npm ci` for clean dependency installation
4. **Build**: `npm run build` - TypeScript compilation
5. **Type Check**: `npm run typecheck` - Type validation
6. **Lint**: `npm run lint` - ESLint validation
7. **Test**: `npm test` - Vitest test execution

## Test Configuration

### Vitest Configuration

**File**: `vitest.config.ts`

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['**/packages/orchestrator/src/**', 'node'],
      ['**/packages/core/src/**', 'node'],
      ['**/packages/api/src/**', 'node'],
      ['**/packages/cli/src/__tests__/**', 'node'],
      ['**/packages/cli/src/services/**', 'node'],
    ],
    include: [
      'packages/*/src/**/*.test.ts',
      'packages/*/src/**/*.integration.test.ts',
      'packages/*/src/**/*.e2e.test.ts',
      'tests/**/*.test.ts',
      'docs/tests/**/*.test.ts'
    ],
  },
});
```

### Environment Configuration

- **Core/Orchestrator/API**: Node.js environment for backend testing
- **CLI Services**: Node.js environment for system integration
- **CLI UI Components**: jsdom environment for React component testing

## Windows-Specific Integration Test

### Test File Location

**File**: `packages/core/src/__tests__/windows-cross-module.integration.test.ts`

### Test Execution Strategy

The Windows integration test uses a platform-aware execution strategy:

```typescript
const isActuallyWindows = process.platform === 'win32';

describe.skipIf(!isActuallyWindows)('Windows Cross-Module Integration Tests', () => {
  // Tests only run on actual Windows platforms
});
```

### Test Coverage Areas

#### 1. Windows Path Handling
- **Drive Letter Paths**: `C:\Users\Developer\Projects\apex`
- **UNC Paths**: `\\server\share\apex-project`
- **Paths with Spaces**: `C:\Program Files\APEX\workspace`
- **Path Normalization**: Backslash vs forward slash handling

#### 2. SQLite Database Integration
- **Windows File Paths**: Database path resolution with Windows separators
- **Drive Letter Validation**: Ensures proper `C:` prefix handling
- **TaskStore Operations**: Create, read, update operations with Windows paths

#### 3. Shell Command Integration
- **Platform Shell Detection**: PowerShell vs cmd.exe selection
- **Command Escaping**: Windows-specific argument escaping
- **Process Termination**: `taskkill` command generation
- **Complex Arguments**: Handling special characters and spaces

#### 4. Configuration Integration
- **Windows Environment Variables**: USERPROFILE, APPDATA handling
- **Windows Commands**: `npm.cmd` vs `npm` command selection
- **Path Configuration**: Windows-style path handling in config files

#### 5. Agent and Workflow Management
- **File System Loading**: Agent and workflow files from Windows paths
- **Windows-Safe Names**: Git branch names avoiding Windows problematic characters
- **Cross-Module Type Compatibility**: Type safety across packages

#### 6. Error Handling
- **Windows File System Errors**: ENOENT, EINVAL, EPERM, EACCES
- **Reserved Filenames**: CON, PRN, AUX, etc. handling
- **Invalid Path Characters**: `<>:"|?*` character validation

## Test Statistics

### Overall Test Coverage

- **Total Test Files**: 643
- **Package Distribution**:
  - Orchestrator: 270 tests
  - CLI: 187 tests
  - Core: 171 tests
  - API: 12 tests
  - Web UI: 3 tests

### Windows-Specific Coverage

- **Windows Integration Test**: 1 comprehensive file
- **Platform-Conditional Tests**: 60 tests skipped on Windows (Linux/macOS specific)
- **Windows-Specific Features**: Service management, path handling, shell commands
- **Cross-Platform Tests**: Tests that work on all platforms including Windows

### Test Categories

#### Unit Tests (`*.test.ts`)
- **Focus**: Individual function and class testing
- **Coverage**: Core business logic, utilities, data validation
- **Platform Handling**: Platform-agnostic where possible

#### Integration Tests (`*.integration.test.ts`)
- **Focus**: Cross-module interactions and real system integration
- **Coverage**: Database operations, file system, shell commands
- **Platform Handling**: Platform-specific behavior testing

#### End-to-End Tests (`*.e2e.test.ts`)
- **Focus**: Complete workflow and user journey testing
- **Coverage**: CLI commands, API endpoints, full application flows
- **Platform Handling**: Real environment testing

## Windows-Specific Test Patterns

### Platform Detection Pattern

```typescript
import { isWindows } from '@apex/core';

describe('Platform-specific tests', () => {
  it.skipIf(!isWindows())('should handle Windows feature', () => {
    // Windows-only test logic
  });

  it.skipIf(isWindows())('should handle Unix feature', () => {
    // Unix-only test logic
  });
});
```

### Path Handling Pattern

```typescript
describe('Path handling', () => {
  beforeEach(() => {
    if (isWindows()) {
      // Setup Windows-specific test environment
      tempDir = 'C:\\temp\\apex-test';
    } else {
      // Setup Unix test environment
      tempDir = '/tmp/apex-test';
    }
  });
});
```

### Shell Command Pattern

```typescript
describe('Shell commands', () => {
  it('should create platform-appropriate commands', () => {
    const killCommand = getKillCommand(12345);

    if (isWindows()) {
      expect(killCommand).toEqual(['taskkill', '/f', '/pid', '12345']);
    } else {
      expect(killCommand).toEqual(['kill', '-9', '12345']);
    }
  });
});
```

## Skipped Tests Analysis

### Linux/macOS Specific Tests

Tests skipped on Windows (60 total occurrences):

- **Service Management**: systemd and launchd specific functionality
- **Unix Shell Commands**: bash-specific operations
- **Unix File Permissions**: chmod, chown operations
- **Unix Process Management**: POSIX signal handling

These tests are appropriately skipped on Windows as they test Unix-specific functionality.

### Intentionally Skipped Tests

Files with `.skip` extension (5 total):

- `adr-v030-status-validation.test.ts.skip`
- `adr-status-integration.test.ts.skip`
- `jsdoc-detector.*.test.ts.skip` (3 files)

These represent incomplete or disabled test implementations.

## Coverage Exclusions

### Excluded from Coverage

Per `vitest.config.ts`:

- **CLI Package**: Mostly wiring code, tested via integration tests
- **Web UI Components**: Require browser environment (Next.js/React)
- **WebSocket Client**: Requires browser WebSocket API
- **Test Files**: `**/*.test.ts` files themselves
- **Type Definitions**: `**/*.d.ts` files

### Coverage Focus Areas

- **Core Package**: Types, utilities, configuration logic
- **Orchestrator Package**: Task execution, SQLite operations, system integration
- **API Package**: REST endpoints, WebSocket handling

## Best Practices

### Writing Windows-Compatible Tests

1. **Use Path Utilities**: Always use Node.js `path` module for path operations
2. **Platform Detection**: Use `isWindows()` utility for conditional logic
3. **Environment Isolation**: Create temporary test directories with platform-appropriate paths
4. **Command Testing**: Test both Windows and Unix command generation
5. **Error Handling**: Test Windows-specific error codes and scenarios

### Test Organization

1. **Cross-Platform First**: Write tests that work on all platforms when possible
2. **Platform-Specific Separation**: Use separate test files or conditional blocks for platform-specific features
3. **Integration Coverage**: Ensure cross-module interactions are tested on all platforms
4. **Real Environment Testing**: Use actual Windows paths and commands in integration tests

### CI Considerations

1. **Matrix Testing**: Ensure both Windows and Linux CI runners
2. **Node.js Versions**: Test multiple Node.js versions on each platform
3. **Dependency Consistency**: Use `npm ci` for reproducible installs
4. **Build Validation**: Ensure TypeScript compilation works on all platforms

## Conclusion

The APEX project has comprehensive Windows test coverage through:

- **CI Matrix**: Tests run on both Ubuntu and Windows
- **Integration Testing**: Dedicated Windows cross-module integration test
- **Platform Patterns**: Consistent patterns for platform-specific testing
- **Coverage Strategy**: Focus on core business logic with appropriate exclusions

The Windows-specific integration test ensures cross-module compatibility on Windows platforms, covering path handling, database operations, shell commands, and configuration management. The test infrastructure is well-designed to handle cross-platform development while maintaining comprehensive coverage.