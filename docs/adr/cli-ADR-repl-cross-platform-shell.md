# ADR: Cross-Platform Shell Commands in REPL

## Status
Proposed

## Context

The APEX CLI REPL (`packages/cli/src/repl.tsx`) contains two functions that use platform-specific shell commands:

1. **`getGitBranch()` (lines 75-86)**: Uses `execSync('git branch --show-current')` without specifying the shell option, which may not work correctly on Windows.

2. **`killProcessOnPort()` (lines 1788-1803)**: Uses `lsof -ti :${port}` which is macOS/Linux-only. This function is called from `cleanupProcesses()` as a fallback to kill orphaned APEX processes.

The core package already provides cross-platform shell utilities in `packages/core/src/shell-utils.ts` which exports:
- `getPlatformShell()`: Returns `{ shell, shellArgs }` for the current platform
- `isWindows()`: Platform detection
- `getKillCommand()`: Cross-platform process kill commands
- `createShellCommand()`: Cross-platform command string building

### Current Code Issues

```typescript
// Issue 1: getGitBranch() - no shell option specified
function getGitBranch(): string | undefined {
  try {
    const branch = execSync('git branch --show-current', {
      cwd: ctx.cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return branch || undefined;
  } catch {
    return undefined;
  }
}

// Issue 2: killProcessOnPort() - lsof is Unix-only
function killProcessOnPort(port: number): void {
  try {
    const result = execSync(`lsof -ti :${port} 2>/dev/null || true`, { encoding: 'utf-8' });
    const pids = result.trim().split('\n').filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(parseInt(pid, 10), 'SIGTERM');
      } catch {
        // Process already dead
      }
    }
  } catch {
    // lsof not available or other error
  }
}
```

## Decision

### 1. Update `getGitBranch()` to use cross-platform shell

Use `getPlatformShell()` from `@apexcli/core` to specify the correct shell for the current platform:

```typescript
import { getPlatformShell } from '@apexcli/core';

function getGitBranch(): string | undefined {
  try {
    const { shell } = getPlatformShell();
    const branch = execSync('git branch --show-current', {
      cwd: ctx.cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell,  // Use platform-appropriate shell
    }).trim();
    return branch || undefined;
  } catch {
    return undefined;
  }
}
```

### 2. Replace `killProcessOnPort()` with cross-platform implementation

Create a new cross-platform function that:
- On Unix (macOS/Linux): Uses `lsof -ti :${port}`
- On Windows: Uses `netstat -ano | findstr :${port}` to find PIDs

```typescript
import { isWindows, getPlatformShell } from '@apexcli/core';

/**
 * Get PIDs of processes listening on a specific port (cross-platform)
 * @param port - Port number to check
 * @returns Array of PIDs listening on the port
 */
function getProcessesOnPort(port: number): number[] {
  const { shell } = getPlatformShell();

  try {
    if (isWindows()) {
      // Windows: Use netstat to find processes on port
      // Format: TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    12345
      const result = execSync(
        `netstat -ano | findstr :${port} | findstr LISTENING`,
        { encoding: 'utf-8', shell, stdio: ['pipe', 'pipe', 'pipe'] }
      );

      const pids = new Set<number>();
      for (const line of result.trim().split('\n')) {
        // Last column is the PID
        const parts = line.trim().split(/\s+/);
        const pid = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(pid) && pid > 0) {
          pids.add(pid);
        }
      }
      return Array.from(pids);
    } else {
      // Unix: Use lsof to find processes on port
      const result = execSync(
        `lsof -ti :${port} 2>/dev/null || true`,
        { encoding: 'utf-8', shell, stdio: ['pipe', 'pipe', 'pipe'] }
      );

      return result.trim().split('\n')
        .filter(Boolean)
        .map(pid => parseInt(pid, 10))
        .filter(pid => !isNaN(pid) && pid > 0);
    }
  } catch {
    return [];
  }
}

/**
 * Kill processes listening on a specific port (cross-platform)
 * @param port - Port number
 */
function killProcessOnPort(port: number): void {
  const pids = getProcessesOnPort(port);

  for (const pid of pids) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      // Process already dead or permission denied
    }
  }
}
```

### 3. Add utility function to `@apexcli/core` (optional enhancement)

For future use, consider adding `getProcessesOnPort()` to `packages/core/src/shell-utils.ts` as this is a common cross-platform need. However, for this immediate task, the implementation can remain in `repl.tsx`.

## Technical Design

### File Changes

1. **`packages/cli/src/repl.tsx`**:
   - Add import: `import { getPlatformShell, isWindows } from '@apexcli/core';`
   - Update `getGitBranch()` to use shell option
   - Replace `killProcessOnPort()` with cross-platform implementation
   - Add helper function `getProcessesOnPort()`

2. **`packages/cli/src/__tests__/repl-cross-platform.test.ts`** (new file):
   - Unit tests for `getGitBranch()` with mocked platform
   - Unit tests for `getProcessesOnPort()` with mocked platform
   - Unit tests for `killProcessOnPort()` with mocked platform

### Cross-Platform Command Reference

| Function | Unix (macOS/Linux) | Windows |
|----------|-------------------|---------|
| Get git branch | `git branch --show-current` | `git branch --show-current` |
| Find processes on port | `lsof -ti :${port}` | `netstat -ano \| findstr :${port} \| findstr LISTENING` |
| Kill process | `process.kill(pid, 'SIGTERM')` | `process.kill(pid, 'SIGTERM')` |

### Shell Option for execSync

When using `execSync`, the `shell` option determines which shell executes the command:
- Windows: `cmd.exe` (default from `getPlatformShell()`)
- Unix: `/bin/sh` (default from `getPlatformShell()`)

This is important for:
- Proper path resolution
- Environment variable expansion
- Pipe and redirection handling

### Testing Strategy

1. **Unit Tests** (`repl-cross-platform.test.ts`):
   - Mock `os.platform()` to test both Windows and Unix paths
   - Mock `execSync` to verify correct commands are constructed
   - Test edge cases: empty results, malformed output, process.kill failures

2. **Test Cases**:
   ```typescript
   describe('getGitBranch', () => {
     it('should use platform shell option', () => { ... });
     it('should return branch name on success', () => { ... });
     it('should return undefined when not in git repo', () => { ... });
     it('should handle errors gracefully', () => { ... });
   });

   describe('getProcessesOnPort', () => {
     describe('Windows', () => {
       it('should parse netstat output correctly', () => { ... });
       it('should return empty array when no processes found', () => { ... });
       it('should handle malformed output', () => { ... });
     });

     describe('Unix', () => {
       it('should parse lsof output correctly', () => { ... });
       it('should return empty array when no processes found', () => { ... });
       it('should handle lsof not available', () => { ... });
     });
   });

   describe('killProcessOnPort', () => {
     it('should call process.kill for each PID found', () => { ... });
     it('should handle process.kill errors gracefully', () => { ... });
     it('should do nothing when no processes found', () => { ... });
   });
   ```

### Dependencies

- Uses existing `@apexcli/core` exports: `getPlatformShell`, `isWindows`
- No new external dependencies required
- Built-in Node.js `child_process.execSync` for shell execution

## Consequences

### Positive
- REPL commands will work correctly on Windows
- Consistent use of `shell-utils.ts` across the codebase
- Better error handling for cross-platform edge cases
- Clear separation of platform-specific logic

### Negative
- Slightly more complex port detection on Windows (netstat parsing)
- Windows netstat output format may vary between Windows versions

### Neutral
- Git commands work identically on all platforms (git is cross-platform)
- The `cleanupProcesses()` fallback behavior remains the same functionally

## Implementation Checklist

1. [ ] Import `getPlatformShell` and `isWindows` from `@apexcli/core`
2. [ ] Update `getGitBranch()` to use shell option
3. [ ] Implement `getProcessesOnPort()` with cross-platform support
4. [ ] Update `killProcessOnPort()` to use `getProcessesOnPort()`
5. [ ] Create unit tests in `repl-cross-platform.test.ts`
6. [ ] Verify `npm run build` passes
7. [ ] Verify `npm run test` passes

## References

- ADR: Cross-Platform Shell Utilities Module (`packages/core/docs/ADR-shell-utils.md`)
- Shell utilities implementation (`packages/core/src/shell-utils.ts`)
- Shell utilities tests (`packages/core/src/__tests__/shell-utils.test.ts`)
- Node.js `execSync` documentation
