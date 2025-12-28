# ADR-014: Cross-Platform Shell Execution Integration Tests

## Status

Proposed

## Context

APEX needs comprehensive cross-platform shell execution integration tests to validate that shell operations work correctly on both Windows and Unix-like systems. The existing codebase has:

1. **Core shell utilities** (`packages/core/src/shell-utils.ts`) with unit tests
2. **Component-level cross-platform tests** (e.g., `worktree-manager.shell.test.ts`, `workspace-manager-cross-platform.test.ts`)
3. **Windows compatibility tests** (e.g., `service-manager-windows-compatibility.test.ts`)

However, there's no dedicated integration test file that comprehensively tests shell execution integration across all orchestrator components that use shell operations.

## Decision

Create a new integration test file at `packages/orchestrator/src/__tests__/cross-platform-shell.integration.test.ts` that provides comprehensive testing of shell execution behavior across mocked Windows and Unix environments.

### 1. Test Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│              cross-platform-shell.integration.test.ts                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Test Categories                           │    │
│  │                                                              │    │
│  │  1. Process Signals                                          │    │
│  │     - Windows: taskkill /f /pid                             │    │
│  │     - Unix: kill -9                                          │    │
│  │     - Signal handling integration                            │    │
│  │                                                              │    │
│  │  2. Executable Resolution                                    │    │
│  │     - Windows: .exe, .cmd, .bat extensions                  │    │
│  │     - Unix: no extensions                                    │    │
│  │     - Package manager commands (npm, yarn, pnpm)            │    │
│  │                                                              │    │
│  │  3. Command Execution                                        │    │
│  │     - Shell selection (cmd.exe vs /bin/sh)                  │    │
│  │     - Argument escaping                                      │    │
│  │     - Special character handling                            │    │
│  │     - Command chaining                                       │    │
│  │                                                              │    │
│  │  4. File Path Handling                                       │    │
│  │     - Windows paths (C:\, UNC paths)                        │    │
│  │     - Unix paths (/home, ~)                                 │    │
│  │     - Paths with spaces                                     │    │
│  │     - Mixed separators                                       │    │
│  │                                                              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                         Mock Strategy                                │
│                                                                      │
│  - Mock `os.platform()` for platform simulation                     │
│  - Mock `child_process.exec` for command execution                  │
│  - Mock `@apexcli/core` shell utilities for integration testing     │
│  - Mock filesystem operations when needed                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2. Test Structure

```typescript
describe('Cross-Platform Shell Execution Integration', () => {
  describe('Process Signals', () => {
    describe('Windows platform', () => {
      // taskkill-based process termination
    });
    describe('Unix platform', () => {
      // kill -9 based process termination
    });
    describe('signal integration', () => {
      // Cross-platform signal handling
    });
  });

  describe('Executable Resolution', () => {
    describe('Windows platform', () => {
      // .exe, .cmd, .bat resolution
    });
    describe('Unix platform', () => {
      // No extension changes
    });
    describe('package manager commands', () => {
      // npm, yarn, pnpm resolution
    });
  });

  describe('Command Execution', () => {
    describe('shell selection', () => {
      // cmd.exe vs /bin/sh
    });
    describe('argument escaping', () => {
      // Platform-specific escaping
    });
    describe('special characters', () => {
      // &|<>^$`"' handling
    });
  });

  describe('File Path Handling', () => {
    describe('Windows paths', () => {
      // Drive letters, UNC paths
    });
    describe('Unix paths', () => {
      // Absolute, relative, home directory
    });
    describe('paths with spaces', () => {
      // Quoting and escaping
    });
  });

  describe('Integration Scenarios', () => {
    // Real-world workflow scenarios
  });
});
```

### 3. Mocking Strategy

#### 3.1 Platform Detection Mocking

```typescript
// Mock os.platform()
vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return {
    ...actual,
    platform: vi.fn()
  };
});

import * as os from 'os';
const mockPlatform = vi.mocked(os.platform);

// Usage in tests
beforeEach(() => {
  mockPlatform.mockReturnValue('win32'); // or 'linux' or 'darwin'
});
```

#### 3.2 Shell Utilities Mocking

```typescript
vi.mock('@apexcli/core', () => ({
  getPlatformShell: vi.fn(),
  isWindows: vi.fn(),
  resolveExecutable: vi.fn(),
  getKillCommand: vi.fn(),
  createShellCommand: vi.fn(),
  createEnvironmentConfig: vi.fn(),
}));
```

#### 3.3 Child Process Mocking

```typescript
vi.mock('child_process');

const mockExec = vi.mocked(exec);

mockExec.mockImplementation((command, options, callback) => {
  // Handle overloaded signature
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }

  // Simulate async execution
  process.nextTick(() => {
    callback(null, { stdout: 'output', stderr: '' });
  });

  return {} as ChildProcess;
});
```

### 4. Acceptance Criteria Coverage

| Acceptance Criterion | Test Category | Test Cases |
|---------------------|---------------|------------|
| Process signals | Process Signals | taskkill/kill command generation, error handling |
| Executable resolution | Executable Resolution | .exe/.cmd/.bat extensions, no-extension Unix |
| Command execution | Command Execution | shell selection, escaping, special chars |
| File path handling | File Path Handling | Windows/Unix paths, spaces, UNC paths |

### 5. Key Test Scenarios

#### 5.1 Process Signal Tests

```typescript
describe('Process Signals', () => {
  it('should generate correct Windows kill command', () => {
    mockPlatform.mockReturnValue('win32');
    expect(getKillCommand(1234)).toEqual(['taskkill', '/f', '/pid', '1234']);
  });

  it('should generate correct Unix kill command', () => {
    mockPlatform.mockReturnValue('linux');
    expect(getKillCommand(1234)).toEqual(['kill', '-9', '1234']);
  });

  it('should integrate with command execution', async () => {
    // Test full workflow: get kill command -> execute
  });
});
```

#### 5.2 Executable Resolution Tests

```typescript
describe('Executable Resolution', () => {
  it('should resolve npm to npm.cmd on Windows', () => {
    mockPlatform.mockReturnValue('win32');
    mockResolveExecutable.mockImplementation(name =>
      name === 'npm' ? 'npm.cmd' : name + '.exe'
    );
    expect(resolveExecutable('npm')).toBe('npm.cmd');
  });

  it('should not modify npm on Unix', () => {
    mockPlatform.mockReturnValue('linux');
    mockResolveExecutable.mockImplementation(name => name);
    expect(resolveExecutable('npm')).toBe('npm');
  });
});
```

#### 5.3 Command Execution Tests

```typescript
describe('Command Execution', () => {
  it('should use cmd.exe on Windows', async () => {
    mockPlatform.mockReturnValue('win32');
    mockGetPlatformShell.mockReturnValue({
      shell: 'cmd.exe',
      shellArgs: ['/d', '/s', '/c']
    });

    // Execute command and verify shell used
    await executeCommand('git status');

    expect(mockExec).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ shell: 'cmd.exe' }),
      expect.any(Function)
    );
  });

  it('should escape arguments with spaces on Windows', () => {
    mockPlatform.mockReturnValue('win32');
    expect(createShellCommand(['git', 'commit', '-m', 'hello world']))
      .toBe('git commit -m "hello world"');
  });
});
```

#### 5.4 File Path Handling Tests

```typescript
describe('File Path Handling', () => {
  it('should handle Windows drive letter paths', async () => {
    mockPlatform.mockReturnValue('win32');
    const projectPath = 'C:\\Users\\Test\\Projects\\apex';

    // Execute command with Windows path
    await executeInPath(projectPath, 'npm install');

    expect(mockExec).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cwd: projectPath }),
      expect.any(Function)
    );
  });

  it('should handle paths with spaces on Windows', async () => {
    mockPlatform.mockReturnValue('win32');
    const projectPath = 'C:\\Users\\Test User\\My Projects\\apex';

    await executeInPath(projectPath, 'npm install');

    // Verify path is properly quoted or handled
  });

  it('should handle UNC paths on Windows', async () => {
    mockPlatform.mockReturnValue('win32');
    const uncPath = '\\\\server\\share\\project';

    await executeInPath(uncPath, 'git status');

    expect(mockExec).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ cwd: uncPath }),
      expect.any(Function)
    );
  });
});
```

### 6. Integration with Existing Components

The integration tests will verify shell execution works correctly when used by:

1. **WorktreeManager** - Git worktree operations
2. **WorkspaceManager** - Workspace setup and teardown
3. **ServiceManager** - Service file generation
4. **Daemon** - Process management

### 7. Error Handling Scenarios

```typescript
describe('Error Handling', () => {
  it('should handle shell execution errors on Windows', async () => {
    mockPlatform.mockReturnValue('win32');
    mockExec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      cb(new Error('Access denied'), null);
      return {} as any;
    });

    await expect(executeCommand('git status')).rejects.toThrow('Access denied');
  });

  it('should handle command not found errors', async () => {
    mockPlatform.mockReturnValue('linux');
    mockExec.mockImplementation((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      const error = new Error('command not found') as any;
      error.code = 127;
      cb(error, null);
      return {} as any;
    });

    await expect(executeCommand('nonexistent')).rejects.toThrow();
  });

  it('should handle timeout scenarios', async () => {
    // Test command timeout handling
  });
});
```

### 8. Cross-Platform Consistency Validation

```typescript
describe('Cross-Platform Consistency', () => {
  it('should provide consistent API across platforms', () => {
    for (const platform of ['win32', 'linux', 'darwin']) {
      mockPlatform.mockReturnValue(platform);

      const shellConfig = getPlatformShell();
      expect(shellConfig).toHaveProperty('shell');
      expect(shellConfig).toHaveProperty('shellArgs');
      expect(typeof shellConfig.shell).toBe('string');
      expect(Array.isArray(shellConfig.shellArgs)).toBe(true);
    }
  });

  it('should handle same commands on all platforms', async () => {
    const testCommands = ['git status', 'npm install', 'node --version'];

    for (const platform of ['win32', 'linux', 'darwin']) {
      mockPlatform.mockReturnValue(platform);

      for (const command of testCommands) {
        await expect(executeCommand(command)).resolves.not.toThrow();
      }
    }
  });
});
```

## Consequences

### Positive

- Comprehensive test coverage for cross-platform shell execution
- Catches platform-specific bugs before they reach production
- Documents expected behavior across platforms
- Provides integration test patterns for future components
- Validates acceptance criteria systematically

### Negative

- Additional test maintenance overhead
- Mocking complexity for platform simulation
- Tests may not catch all real-world edge cases

### Neutral

- Follows existing test patterns in the codebase
- Uses established mocking strategies
- Integrates with existing CI/CD pipeline

## Files to Create

1. `packages/orchestrator/src/__tests__/cross-platform-shell.integration.test.ts`

## Implementation Notes

### Test File Organization

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'child_process';
import type { ChildProcess } from 'child_process';
import {
  getPlatformShell,
  isWindows,
  resolveExecutable,
  getKillCommand,
  createShellCommand,
  createEnvironmentConfig,
} from '@apexcli/core';

// Mock setup at module level
vi.mock('os', async () => {
  const actual = await vi.importActual('os');
  return { ...actual, platform: vi.fn() };
});

vi.mock('child_process');
vi.mock('@apexcli/core');

// Import after mocks
import * as os from 'os';

const mockPlatform = vi.mocked(os.platform);
const mockExec = vi.mocked(exec);
const mockGetPlatformShell = vi.mocked(getPlatformShell);
// ... other mocks
```

### Helper Functions

```typescript
/**
 * Execute a command with current mock configuration
 */
async function executeCommand(command: string, options?: { cwd?: string }): Promise<string> {
  return new Promise((resolve, reject) => {
    const shellConfig = getPlatformShell();
    exec(command, { ...options, shell: shellConfig.shell }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

/**
 * Configure mocks for Windows platform
 */
function setupWindowsPlatform(): void {
  mockPlatform.mockReturnValue('win32');
  mockGetPlatformShell.mockReturnValue({
    shell: 'cmd.exe',
    shellArgs: ['/d', '/s', '/c']
  });
  mockIsWindows.mockReturnValue(true);
}

/**
 * Configure mocks for Unix platform
 */
function setupUnixPlatform(platform: 'linux' | 'darwin' = 'linux'): void {
  mockPlatform.mockReturnValue(platform);
  mockGetPlatformShell.mockReturnValue({
    shell: '/bin/sh',
    shellArgs: ['-c']
  });
  mockIsWindows.mockReturnValue(false);
}
```

## References

- ADR-010: Shell Command for Interactive Container Intervention
- `packages/core/src/shell-utils.ts` - Core shell utilities
- `packages/core/src/__tests__/shell-utils.test.ts` - Shell utilities unit tests
- `packages/orchestrator/src/worktree-manager.shell.test.ts` - Existing shell test patterns
- `packages/orchestrator/src/__tests__/service-manager-windows-compatibility.test.ts` - Windows compatibility patterns
