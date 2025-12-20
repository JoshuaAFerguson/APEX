# ADR-051: Daemon Process Manager

## Status
Proposed

## Context

APEX needs the ability to run long-lived background processes (daemon mode) for the API server and task processing. Currently, the CLI uses `spawn` with `detached: true` for the Web UI, but there's no proper daemon management with PID file locking, single-instance enforcement, or graceful shutdown capabilities.

A `DaemonManager` class is needed to:
1. Start APEX processes in the background (daemonize)
2. Ensure only one instance runs at a time (single-instance enforcement)
3. Track running processes via PID files
4. Provide graceful shutdown capabilities
5. Enable status checks for running daemons

## Decision

### Architecture Overview

Create a `DaemonManager` class in `packages/orchestrator/src/daemon.ts` that manages background process lifecycle using Node.js native modules (`child_process`, `fs`, `process`).

### Class Interface

```typescript
export interface DaemonOptions {
  /** Path to the project directory (default: process.cwd()) */
  projectPath?: string;
  /** Custom PID file path (default: .apex/daemon.pid) */
  pidFile?: string;
  /** Custom log file path (default: .apex/daemon.log) */
  logFile?: string;
  /** Callback for daemon output */
  onOutput?: (data: string) => void;
  /** Callback for daemon errors */
  onError?: (error: Error) => void;
}

export interface DaemonStatus {
  running: boolean;
  pid?: number;
  startedAt?: Date;
  uptime?: number; // milliseconds
}

export class DaemonManager {
  constructor(options?: DaemonOptions);

  /** Start the daemon process. Returns the child PID. */
  startDaemon(): Promise<number>;

  /** Stop the daemon gracefully. Returns true if stopped. */
  stopDaemon(): Promise<boolean>;

  /** Check if the daemon is currently running. */
  isDaemonRunning(): Promise<boolean>;

  /** Get detailed daemon status. */
  getStatus(): Promise<DaemonStatus>;

  /** Force kill the daemon (SIGKILL). */
  killDaemon(): Promise<boolean>;
}
```

### Implementation Details

#### 1. PID File Location
- Default location: `.apex/daemon.pid`
- Contains JSON: `{ "pid": <number>, "startedAt": <ISO timestamp> }`
- Located in project's `.apex` directory for project-scoped daemon management

#### 2. Single-Instance Enforcement

```typescript
private async acquireLock(): Promise<boolean> {
  const pidPath = this.getPidFilePath();

  // Check if PID file exists
  if (await this.fileExists(pidPath)) {
    const existingPid = await this.readPidFile();

    // Check if process is actually running
    if (existingPid && this.isProcessRunning(existingPid)) {
      return false; // Another instance is running
    }

    // Stale PID file - remove it
    await this.removePidFile();
  }

  return true;
}
```

The lock mechanism:
1. Reads existing PID file if present
2. Sends signal 0 to check if process exists (`process.kill(pid, 0)`)
3. Cleans up stale PID files from crashed processes
4. Prevents race conditions with synchronous file locking

#### 3. Process Forking Strategy

```typescript
async startDaemon(): Promise<number> {
  // Verify single instance
  if (await this.isDaemonRunning()) {
    throw new DaemonError('Daemon is already running', 'ALREADY_RUNNING');
  }

  // Fork a detached child process
  const child = fork(DAEMON_SCRIPT_PATH, [], {
    detached: true,
    stdio: ['ignore', logFd, logFd, 'ipc'],
    env: {
      ...process.env,
      APEX_DAEMON_MODE: '1',
      APEX_PROJECT_PATH: this.projectPath,
    },
  });

  // Write PID file
  await this.writePidFile(child.pid!, new Date());

  // Detach child
  child.unref();

  return child.pid!;
}
```

Key decisions:
- Use `child_process.fork()` for Node.js processes (enables IPC if needed)
- `detached: true` ensures process survives parent exit
- `child.unref()` allows parent to exit independently
- Redirect stdout/stderr to log file for debugging
- Pass environment variables for daemon context

#### 4. Graceful Shutdown

```typescript
async stopDaemon(): Promise<boolean> {
  const status = await this.getStatus();
  if (!status.running || !status.pid) {
    return true; // Already stopped
  }

  // Send SIGTERM for graceful shutdown
  process.kill(status.pid, 'SIGTERM');

  // Wait for process to exit (with timeout)
  const stopped = await this.waitForExit(status.pid, 10000);

  if (stopped) {
    await this.removePidFile();
    return true;
  }

  // Force kill if graceful shutdown failed
  return this.killDaemon();
}
```

Shutdown sequence:
1. `SIGTERM` (graceful) - allows cleanup handlers
2. Wait up to 10 seconds for exit
3. `SIGKILL` (force) - if graceful fails
4. Clean up PID file

#### 5. Process Liveness Check

```typescript
private isProcessRunning(pid: number): boolean {
  try {
    // Signal 0 doesn't kill, just checks existence
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // ESRCH = process doesn't exist
    // EPERM = exists but no permission (still running)
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}
```

### Error Handling

Custom error class for daemon-specific errors:

```typescript
export class DaemonError extends Error {
  constructor(
    message: string,
    public readonly code: DaemonErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DaemonError';
  }
}

export type DaemonErrorCode =
  | 'ALREADY_RUNNING'
  | 'NOT_RUNNING'
  | 'PERMISSION_DENIED'
  | 'LOCK_FAILED'
  | 'START_FAILED'
  | 'STOP_FAILED'
  | 'PID_FILE_CORRUPTED';
```

### File Structure

```
packages/orchestrator/src/
├── daemon.ts          # DaemonManager class
├── daemon.test.ts     # Unit tests
└── index.ts           # Export DaemonManager
```

### PID File Format

```json
{
  "pid": 12345,
  "startedAt": "2025-01-15T10:30:00.000Z",
  "version": "0.4.0",
  "projectPath": "/path/to/project"
}
```

### Integration Points

1. **CLI Integration**: The `/serve` and `/web` commands will use `DaemonManager`
2. **API Package**: Server can check daemon status via orchestrator
3. **Config**: Daemon settings can be added to `.apex/config.yaml`

### Cross-Platform Considerations

- **Unix**: Use `fork()` with `detached: true` - works natively
- **Windows**: Node.js `detached` works but signal handling differs
  - Use `SIGTERM` which maps to `TerminateProcess` on Windows
  - PID file approach works on all platforms

### Dependencies

No new dependencies required. Uses only Node.js built-in modules:
- `child_process` (fork, spawn)
- `fs/promises` (file operations)
- `path` (path resolution)
- `process` (signal handling)

## Consequences

### Positive
- Enables true background daemon mode for APEX services
- Single-instance enforcement prevents resource conflicts
- Graceful shutdown ensures clean state
- Status checks enable monitoring and health checks
- PID file provides debugging/recovery capability

### Negative
- PID files can become stale if process crashes
- Signal handling differs slightly on Windows
- Additional complexity in process management

### Risks & Mitigations
- **Risk**: Stale PID files after crash
  - **Mitigation**: Always verify process existence before trusting PID file
- **Risk**: Race condition on startup
  - **Mitigation**: Use synchronous file operations for PID file creation
- **Risk**: Orphaned processes on unclean shutdown
  - **Mitigation**: Document manual cleanup procedure, provide `--force` flag

## Implementation Plan

1. Create `DaemonManager` class with basic structure
2. Implement PID file read/write operations
3. Implement `startDaemon()` with process forking
4. Implement `stopDaemon()` with graceful shutdown
5. Implement `isDaemonRunning()` and `getStatus()`
6. Add unit tests with mocked child processes
7. Export from orchestrator package
8. Integration with CLI (separate task)

## References

- [Node.js child_process.fork()](https://nodejs.org/api/child_process.html#child_processforkmodulepath-args-options)
- [Unix signal handling](https://man7.org/linux/man-pages/man7/signal.7.html)
- [PID file best practices](https://www.freedesktop.org/software/systemd/man/daemon.html)
