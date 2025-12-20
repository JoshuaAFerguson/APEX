# ADR-052: Daemon CLI Commands Architecture

## Status
Accepted

## Date
2024-12-20

## Context

APEX needs CLI commands to manage the background daemon process that polls for queued tasks and executes them autonomously. Building on ADR-051 (Daemon Process Manager), the orchestrator package already provides:

1. **`DaemonManager`** (`packages/orchestrator/src/daemon.ts`) - Handles PID file management, process forking, graceful shutdown
2. **`DaemonRunner`** (`packages/orchestrator/src/runner.ts`) - The actual daemon process logic that polls for tasks
3. **`daemon-entry.ts`** - Entry point for the forked daemon process

The CLI needs a `daemon` command group with `start`, `stop`, and `status` subcommands.

## Decision

### 1. Command Structure

Add a new `daemon` command to the existing command array in `packages/cli/src/index.ts`:

```
apex daemon start [--poll-interval <ms>]   # Start background daemon
apex daemon stop [--force]                  # Stop daemon gracefully (or force kill)
apex daemon status                          # Show daemon status and metrics
```

Interactive REPL equivalents:
```
/daemon start
/daemon stop
/daemon status
```

### 2. Implementation Approach

#### 2.1 CLI Command Handler

Add a single `daemon` command with subcommand routing (similar to existing `/stop` command pattern):

```typescript
{
  name: 'daemon',
  aliases: ['d'],
  description: 'Manage background daemon process',
  usage: '/daemon <start|stop|status> [options]',
  handler: async (ctx, args) => {
    const subcommand = args[0]?.toLowerCase();

    switch (subcommand) {
      case 'start':
        await handleDaemonStart(ctx, args.slice(1));
        break;
      case 'stop':
        await handleDaemonStop(ctx, args.slice(1));
        break;
      case 'status':
        await handleDaemonStatus(ctx);
        break;
      default:
        console.log(chalk.red('Usage: /daemon <start|stop|status>'));
    }
  },
}
```

#### 2.2 Handler Functions

Create three handler functions:

**`handleDaemonStart(ctx, args)`**
- Check if APEX is initialized
- Create `DaemonManager` instance with project path
- Check if daemon is already running → show error if so
- Call `daemonManager.startDaemon()`
- Display success message with PID

**`handleDaemonStop(ctx, args)`**
- Create `DaemonManager` instance
- Check if daemon is running → show info if not running
- Parse `--force` flag
- Call `daemonManager.stopDaemon()` or `daemonManager.killDaemon()` if forced
- Display success message

**`handleDaemonStatus(ctx)`**
- Create `DaemonManager` instance
- Call `daemonManager.getStatus()` to get `DaemonStatus`
- If not running, display "Daemon is not running"
- If running, display:
  - PID
  - Started at (formatted)
  - Uptime (formatted: Xh Ym Zs)
  - For active tasks, would need to read from TaskStore (enhancement opportunity)

#### 2.3 Interface with Existing Infrastructure

The `DaemonManager` class is already exported from `@apexcli/orchestrator`:

```typescript
import {
  DaemonManager,
  DaemonError,
  DaemonStatus,
} from '@apexcli/orchestrator';
```

The `DaemonStatus` interface provides:
```typescript
interface DaemonStatus {
  running: boolean;
  pid?: number;
  startedAt?: Date;
  uptime?: number; // milliseconds
}
```

#### 2.4 Error Handling

Map `DaemonError` codes to user-friendly messages:

| Error Code | User Message |
|------------|--------------|
| `ALREADY_RUNNING` | "Daemon is already running (PID: X)" |
| `NOT_RUNNING` | "Daemon is not running" |
| `PERMISSION_DENIED` | "Permission denied. Check .apex directory permissions." |
| `START_FAILED` | "Failed to start daemon: {reason}" |
| `STOP_FAILED` | "Failed to stop daemon: {reason}" |
| `PID_FILE_CORRUPTED` | "PID file is corrupted. Try 'daemon stop --force'." |

#### 2.5 Output Format

**Start Success:**
```
✓ Daemon started (PID: 12345)
  Polling every 5000ms for queued tasks
  Logs: .apex/daemon.log
```

**Stop Success:**
```
✓ Daemon stopped
```

**Status (Running):**
```
Daemon Status
────────────────────────────────
  State:      running
  PID:        12345
  Started:    Dec 20, 2024 10:30 AM
  Uptime:     2h 15m 30s
  Log file:   .apex/daemon.log
```

**Status (Not Running):**
```
Daemon Status
────────────────────────────────
  State:      stopped

Use '/daemon start' to start the daemon.
```

### 3. File Changes

| File | Change |
|------|--------|
| `packages/cli/src/index.ts` | Add `daemon` command with handler |
| `packages/cli/src/handlers/daemon-handlers.ts` | **NEW** - Handler functions for daemon subcommands |

### 4. Detailed Interface

```typescript
// packages/cli/src/handlers/daemon-handlers.ts

import chalk from 'chalk';
import { DaemonManager, DaemonError, DaemonStatus } from '@apexcli/orchestrator';
import { formatDuration } from '@apexcli/core';
import { ApexContext } from '../types';

export async function handleDaemonStart(
  ctx: ApexContext,
  args: string[]
): Promise<void> {
  if (!ctx.initialized) {
    console.log(chalk.red('APEX not initialized. Run /init first.'));
    return;
  }

  // Parse options
  let pollInterval: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--poll-interval' || args[i] === '-i') {
      pollInterval = parseInt(args[++i], 10);
    }
  }

  const manager = new DaemonManager({
    projectPath: ctx.cwd,
    pollIntervalMs: pollInterval,
  });

  try {
    const pid = await manager.startDaemon();
    console.log(chalk.green(`✓ Daemon started (PID: ${pid})`));
    console.log(chalk.gray(`  Polling every ${pollInterval || 5000}ms for queued tasks`));
    console.log(chalk.gray(`  Logs: .apex/daemon.log`));
  } catch (error) {
    if (error instanceof DaemonError) {
      handleDaemonError(error);
    } else {
      console.log(chalk.red(`Failed to start daemon: ${(error as Error).message}`));
    }
  }
}

export async function handleDaemonStop(
  ctx: ApexContext,
  args: string[]
): Promise<void> {
  const force = args.includes('--force') || args.includes('-f');

  const manager = new DaemonManager({
    projectPath: ctx.cwd,
  });

  try {
    const status = await manager.getStatus();

    if (!status.running) {
      console.log(chalk.yellow('Daemon is not running.'));
      return;
    }

    if (force) {
      await manager.killDaemon();
      console.log(chalk.green('✓ Daemon killed (force)'));
    } else {
      await manager.stopDaemon();
      console.log(chalk.green('✓ Daemon stopped'));
    }
  } catch (error) {
    if (error instanceof DaemonError) {
      handleDaemonError(error);
    } else {
      console.log(chalk.red(`Failed to stop daemon: ${(error as Error).message}`));
    }
  }
}

export async function handleDaemonStatus(ctx: ApexContext): Promise<void> {
  const manager = new DaemonManager({
    projectPath: ctx.cwd,
  });

  const status = await manager.getStatus();

  console.log(chalk.cyan('\nDaemon Status'));
  console.log(chalk.gray('─'.repeat(36)));

  if (status.running && status.pid && status.startedAt && status.uptime) {
    console.log(`  State:      ${chalk.green('running')}`);
    console.log(`  PID:        ${status.pid}`);
    console.log(`  Started:    ${status.startedAt.toLocaleString()}`);
    console.log(`  Uptime:     ${formatDuration(status.uptime)}`);
    console.log(`  Log file:   ${chalk.gray('.apex/daemon.log')}`);
  } else {
    console.log(`  State:      ${chalk.gray('stopped')}`);
    console.log();
    console.log(chalk.gray("Use '/daemon start' to start the daemon."));
  }
  console.log();
}

function handleDaemonError(error: DaemonError): void {
  const messages: Record<string, string> = {
    ALREADY_RUNNING: 'Daemon is already running.',
    NOT_RUNNING: 'Daemon is not running.',
    PERMISSION_DENIED: 'Permission denied. Check .apex directory permissions.',
    START_FAILED: `Failed to start daemon: ${error.cause?.message || 'unknown error'}`,
    STOP_FAILED: `Failed to stop daemon: ${error.cause?.message || 'unknown error'}`,
    PID_FILE_CORRUPTED: "PID file is corrupted. Try '/daemon stop --force'.",
    LOCK_FAILED: 'Failed to acquire lock on PID file.',
  };

  console.log(chalk.red(messages[error.code] || error.message));
}
```

### 5. CLI Help Update

Update the help text in the main help section:

```
${chalk.bold('Commands:')}
  ...
  daemon <cmd>          Manage background daemon (start|stop|status)
  ...
```

### 6. Non-Interactive Mode Support

The command should work in both REPL mode (`/daemon status`) and non-interactive mode (`apex daemon status`):

```bash
# Non-interactive examples
apex daemon start
apex daemon start --poll-interval 10000
apex daemon stop
apex daemon stop --force
apex daemon status
```

## Consequences

### Positive
- Clean integration with existing `DaemonManager` infrastructure
- Consistent command pattern with existing CLI commands
- Proper error handling with user-friendly messages
- Supports both interactive and non-interactive modes

### Negative
- Adding complexity to CLI command set
- Status command shows limited info (uptime/PID) - active task count would require additional TaskStore query

### Future Enhancements
- `apex daemon logs` - Tail the daemon log file
- `apex daemon status --json` - JSON output for scripting
- Show active task count in status (requires TaskStore integration)
- `apex daemon restart` - Stop + Start convenience command

## References
- [ADR-051: Daemon Process Manager](./ADR-051-daemon-process-manager.md) - DaemonManager architecture
- `packages/orchestrator/src/daemon.ts` - DaemonManager implementation
- `packages/orchestrator/src/runner.ts` - DaemonRunner implementation
- `packages/cli/src/index.ts` - CLI command definitions
