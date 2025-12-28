# ADR-062: Cross-Platform Daemon Logs Implementation

## Status
Proposed

## Date
2024-12-28

## Context

The `handleDaemonLogs()` function in `packages/cli/src/handlers/daemon-handlers.ts` currently uses the Unix `tail -f` command for log following. This implementation does not work on Windows because:

1. The `tail` command is not available by default on Windows
2. The command is spawned via `child_process.spawn('tail', ...)` which fails on Windows

### Current Implementation (Lines 402-425)

```typescript
if (follow) {
  // Use tail -f for following logs
  const tailArgs = ['-f'];
  if (lines > 0) {
    tailArgs.push('-n', lines.toString());
  }
  tailArgs.push(logPath);

  console.log(chalk.cyan(`Following daemon logs (${logPath})`));
  console.log(chalk.gray('Press Ctrl+C to stop following\n'));

  const tailProcess = spawn('tail', tailArgs, { stdio: 'inherit' });

  // Handle process termination
  process.on('SIGINT', () => {
    tailProcess.kill('SIGTERM');
    process.exit(0);
  });

  tailProcess.on('error', (error) => {
    console.log(chalk.red(`Failed to follow logs: ${error.message}`));
  });
}
```

### Problem Statement

- Windows users cannot use the `--follow` / `-f` flag with the daemon logs command
- No cross-platform alternative exists in the current codebase

## Decision

We will implement a **pure Node.js cross-platform log following solution** using `fs.watch()` combined with `readline` for efficient line-based reading. This approach:

1. Uses Node.js built-in modules (no external dependencies)
2. Works identically on Windows, macOS, and Linux
3. Maintains similar behavior to `tail -f`
4. Follows established patterns in the codebase (see `@apex/core/shell-utils.ts`)

### Alternative Approaches Considered

| Approach | Pros | Cons |
|----------|------|------|
| **PowerShell `Get-Content -Wait`** | Native Windows | Requires spawning PowerShell, Windows-only |
| **fs.watchFile (polling)** | Simple, reliable | CPU-intensive for large files |
| **fs.watch + readline** | Efficient, cross-platform | Slightly more complex |
| **chokidar library** | Robust file watching | External dependency |
| **Platform-specific spawn** | Direct Unix/Windows commands | Maintains two code paths |

**Selected: `fs.watch` + `readline`** - Best balance of efficiency, reliability, and cross-platform support without adding dependencies.

## Technical Design

### 1. New Helper Function: `followLogFile()`

```typescript
import * as fs from 'fs';
import * as readline from 'readline';

interface LogFollowerOptions {
  logPath: string;
  initialLines?: number;
  onLine: (line: string) => void;
  onError: (error: Error) => void;
}

interface LogFollower {
  stop: () => void;
}

/**
 * Cross-platform log file follower using fs.watch and readline
 * Works on Windows, macOS, and Linux without external dependencies
 */
function createLogFollower(options: LogFollowerOptions): LogFollower {
  const { logPath, initialLines = 20, onLine, onError } = options;

  let fileHandle: fs.promises.FileHandle | null = null;
  let watcher: fs.FSWatcher | null = null;
  let position = 0;
  let isReading = false;
  let stopped = false;

  async function readNewLines(): Promise<void> {
    if (stopped || isReading || !fileHandle) return;
    isReading = true;

    try {
      const stats = await fileHandle.stat();

      // Handle file truncation (log rotation)
      if (stats.size < position) {
        position = 0;
      }

      if (stats.size > position) {
        const buffer = Buffer.alloc(stats.size - position);
        const { bytesRead } = await fileHandle.read(buffer, 0, buffer.length, position);
        position += bytesRead;

        const text = buffer.toString('utf-8').slice(0, bytesRead);
        const lines = text.split(/\r?\n/);

        // Process complete lines only (last may be partial)
        for (let i = 0; i < lines.length - 1; i++) {
          if (lines[i]) {
            onLine(lines[i]);
          }
        }

        // Handle last line if file ends without newline
        const lastLine = lines[lines.length - 1];
        if (lastLine && text.endsWith('\n')) {
          onLine(lastLine);
        }
      }
    } catch (error) {
      if (!stopped) {
        onError(error as Error);
      }
    } finally {
      isReading = false;
    }
  }

  async function showInitialLines(): Promise<void> {
    try {
      const content = fs.readFileSync(logPath, 'utf-8');
      const allLines = content.split(/\r?\n/).filter(line => line.trim() !== '');
      const lastLines = allLines.slice(-initialLines);

      for (const line of lastLines) {
        onLine(line);
      }

      // Set position to end of file
      const stats = fs.statSync(logPath);
      position = stats.size;
    } catch (error) {
      onError(error as Error);
    }
  }

  async function initialize(): Promise<void> {
    try {
      // Show initial lines
      await showInitialLines();

      // Open file handle for reading
      fileHandle = await fs.promises.open(logPath, 'r');

      // Start watching for changes
      watcher = fs.watch(logPath, async (eventType) => {
        if (eventType === 'change') {
          await readNewLines();
        }
      });

      watcher.on('error', (error) => {
        if (!stopped) {
          onError(error);
        }
      });

    } catch (error) {
      onError(error as Error);
    }
  }

  // Start the follower
  initialize().catch(onError);

  return {
    stop: () => {
      stopped = true;
      if (watcher) {
        watcher.close();
        watcher = null;
      }
      if (fileHandle) {
        fileHandle.close().catch(() => {});
        fileHandle = null;
      }
    }
  };
}
```

### 2. Updated `handleDaemonLogs()` Function

```typescript
export async function handleDaemonLogs(
  ctx: ApexContext,
  args: string[]
): Promise<void> {
  const logPath = path.join(ctx.cwd, '.apex', 'daemon.log');

  // Parse options (unchanged)
  let follow = false;
  let lines = 20;
  let level: string | undefined;
  // ... (parsing logic unchanged)

  // Check if log file exists (unchanged)
  if (!fs.existsSync(logPath)) {
    console.log(chalk.yellow('Daemon log file not found.'));
    console.log(chalk.gray('Start the daemon to begin logging.'));
    return;
  }

  try {
    if (follow) {
      // Cross-platform log following using fs.watch + readline
      console.log(chalk.cyan(`Following daemon logs (${logPath})`));
      console.log(chalk.gray('Press Ctrl+C to stop following\n'));

      const follower = createLogFollower({
        logPath,
        initialLines: lines,
        onLine: (line) => {
          // Apply level filter if specified
          if (level) {
            const allowedLevels = getLevelHierarchy(level);
            if (!allowedLevels.some(lvl => line.includes(`] ${lvl} `) || line.includes(`] ${lvl}\t`))) {
              return;
            }
          }
          console.log(formatLogLine(line));
        },
        onError: (error) => {
          console.log(chalk.red(`Failed to follow logs: ${error.message}`));
        }
      });

      // Handle process termination
      const cleanup = () => {
        follower.stop();
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);

      // Keep the process alive
      await new Promise(() => {}); // Never resolves - waits for signal

    } else {
      // Read the file and display last N lines (unchanged)
      // ...
    }
  } catch (error) {
    console.log(chalk.red(`Failed to read daemon logs: ${(error as Error).message}`));
  }
}

// Helper function for level filtering
function getLevelHierarchy(level: string): string[] {
  const hierarchies: Record<string, string[]> = {
    'debug': ['DEBUG', 'INFO', 'WARN', 'ERROR'],
    'info': ['INFO', 'WARN', 'ERROR'],
    'warn': ['WARN', 'ERROR'],
    'error': ['ERROR']
  };
  return hierarchies[level] || [];
}
```

### 3. Code Organization

The implementation can be organized in two ways:

**Option A: Inline in daemon-handlers.ts** (Recommended for simplicity)
- Add `createLogFollower()` as a private function in the same file
- Keeps all daemon log handling logic together
- No need to update exports

**Option B: Extract to utility module**
- Create `packages/cli/src/utils/log-follower.ts`
- Export for potential reuse
- Better for testing in isolation

We recommend **Option A** for this implementation, as the log following functionality is specific to daemon logs and unlikely to be reused elsewhere.

### 4. Import Changes

```typescript
// Add to existing imports in daemon-handlers.ts
import * as fs from 'fs';
import * as fsPromises from 'fs/promises'; // For async file operations

// Note: readline is not needed for the fs.watch approach
// The original import 'readline' can be removed if not used elsewhere
```

### 5. Windows-Specific Considerations

1. **fs.watch reliability**: On Windows, `fs.watch` uses `ReadDirectoryChangesW` which is reliable for file changes
2. **File locking**: Windows may lock files for writing; using read-only access avoids conflicts
3. **Line endings**: Handle both `\n` (Unix) and `\r\n` (Windows) line endings with `/\r?\n/` regex
4. **Path handling**: Use `path.join()` consistently (already done in current implementation)

### 6. Edge Cases Handled

| Edge Case | Handling |
|-----------|----------|
| Log file rotation/truncation | Detect `stats.size < position`, reset to beginning |
| File deleted while watching | `watcher.on('error')` handles and reports |
| Partial line at end of file | Only output complete lines ending with newline |
| Large log files | Read incrementally from last position |
| SIGINT/SIGTERM signals | Proper cleanup with `follower.stop()` |
| Empty log file | Show "no entries" message after initialization |

## Test Strategy

### Unit Tests Required

1. **createLogFollower tests**:
   - Reads initial N lines correctly
   - Detects new lines appended to file
   - Handles file truncation (log rotation)
   - Properly closes resources on stop()
   - Calls onError for file access errors

2. **handleDaemonLogs follow mode tests**:
   - Sets up follower with correct options
   - Applies level filtering in follow mode
   - Formats output with colors
   - Handles SIGINT signal correctly

3. **Cross-platform tests**:
   - Mock `process.platform` for 'win32'
   - Verify no spawn('tail') calls on Windows
   - Verify fs.watch is used for following

### Integration Tests

1. Create actual log file, write lines, verify they appear
2. Test log rotation scenario
3. Test Ctrl+C handling in follow mode

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/cli/src/handlers/daemon-handlers.ts` | Modify | Replace tail-based following with fs.watch implementation |
| `packages/cli/src/handlers/__tests__/daemon-handlers.test.ts` | Modify | Add tests for cross-platform log following |
| `docs/adr/ADR-062-cross-platform-daemon-logs.md` | Add | This document |

## Migration Path

This is a **non-breaking change**:
1. Remove Unix `tail -f` spawn code
2. Add cross-platform `createLogFollower()` function
3. Update tests to verify new behavior
4. Existing CLI interface unchanged (`/daemon logs --follow` still works)

## Consequences

### Positive
- Log following works on Windows, macOS, and Linux
- No external dependencies required
- More control over output formatting
- Proper resource cleanup on exit

### Negative
- Slightly more complex implementation than simple spawn
- May have minor differences in behavior from native `tail -f` (acceptable)

### Neutral
- Different internal implementation, same external behavior
- Tests need to be updated to reflect new approach

## References

- [Node.js fs.watch documentation](https://nodejs.org/api/fs.html#fswatchfilename-options-listener)
- [ADR-051: Windows Platform Support](./ADR-051-windows-platform-support.md)
- [@apex/core/shell-utils.ts](../../packages/core/src/shell-utils.ts) - Existing cross-platform utilities
