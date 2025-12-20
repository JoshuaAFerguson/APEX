# ADR-053: Daemon Config Integration

## Status
Proposed

## Context

APEX has a daemon configuration system defined in `DaemonConfigSchema` in `packages/core/src/types.ts` with the following properties:

```typescript
export const DaemonConfigSchema = z.object({
  pollInterval: z.number().optional().default(5000),
  autoStart: z.boolean().optional().default(false),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
});
```

This configuration is loaded via `getEffectiveConfig()` in `packages/core/src/config.ts` (lines 324-328). However, the daemon components (`DaemonRunner`, `DaemonManager`, and `daemon-entry.ts`) do not currently use these config values:

### Current State Analysis

1. **`DaemonRunner`** (`packages/orchestrator/src/runner.ts`):
   - Accepts `DaemonRunnerOptions` with `pollIntervalMs` and `logToStdout`
   - Does NOT read from config - requires explicit values
   - Has a hardcoded default of 5000ms for poll interval
   - Log level is binary (`logToStdout: boolean`) not configurable

2. **`DaemonManager`** (`packages/orchestrator/src/daemon.ts`):
   - Accepts `DaemonOptions` with `pollIntervalMs`
   - Passes `pollIntervalMs` to child process via env var `APEX_POLL_INTERVAL`
   - Uses hardcoded default of 5000ms
   - Does NOT read config values

3. **`daemon-entry.ts`** (`packages/orchestrator/src/daemon-entry.ts`):
   - Reads `APEX_POLL_INTERVAL` from environment (defaults to '5000')
   - Reads `APEX_DAEMON_DEBUG` for log level (only supports 'debug' or 'off')
   - Does NOT load project config to get daemon settings

### Problems

1. Configuration defined but unused - users cannot configure daemon via config.yaml
2. `logLevel` has 4 levels in config but only 2 modes are supported in implementation
3. Hardcoded defaults scattered across multiple files
4. No single source of truth for daemon configuration

## Decision

Integrate the daemon configuration from `.apex/config.yaml` into all daemon components while preserving backward compatibility with explicit option overrides.

### Design Principles

1. **Config as Default, Options as Override**: When options are not explicitly passed, read from config. Explicit options take precedence.
2. **Preserve Existing Interfaces**: No breaking changes to existing APIs
3. **Single Source of Truth**: Config defaults defined in `DaemonConfigSchema`, applied via `getEffectiveConfig()`
4. **Graceful Fallback**: If config loading fails, fall back to hardcoded defaults

### Architecture Changes

#### 1. Add Config-Aware Factory to DaemonRunner

Add a static factory method that loads config automatically:

```typescript
// packages/orchestrator/src/runner.ts

export interface DaemonRunnerOptions {
  projectPath: string;
  pollIntervalMs?: number;      // Optional - reads from config if not set
  maxConcurrentTasks?: number;
  logFile?: string;
  logToStdout?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';  // NEW: Full log level support
}

export class DaemonRunner {
  // NEW: Static factory that loads config
  static async create(projectPath: string, overrides?: Partial<DaemonRunnerOptions>): Promise<DaemonRunner> {
    const config = await loadConfig(projectPath);
    const effectiveConfig = getEffectiveConfig(config);

    return new DaemonRunner({
      projectPath,
      pollIntervalMs: overrides?.pollIntervalMs ?? effectiveConfig.daemon.pollInterval,
      logLevel: overrides?.logLevel ?? effectiveConfig.daemon.logLevel,
      logToStdout: overrides?.logToStdout,
      maxConcurrentTasks: overrides?.maxConcurrentTasks,
      logFile: overrides?.logFile,
    });
  }

  // Existing constructor unchanged for backward compatibility
  constructor(options: DaemonRunnerOptions) { ... }
}
```

#### 2. Enhance DaemonManager to Read Config

```typescript
// packages/orchestrator/src/daemon.ts

export interface DaemonOptions {
  projectPath?: string;
  pidFile?: string;
  logFile?: string;
  pollIntervalMs?: number;    // Optional - reads from config if not set
  logLevel?: 'debug' | 'info' | 'warn' | 'error';  // NEW
  onOutput?: (data: string) => void;
  onError?: (error: Error) => void;
}

export class DaemonManager {
  private daemonConfig: DaemonConfig | null = null;

  // Lazy-load config when starting daemon
  private async loadDaemonConfig(): Promise<void> {
    if (this.daemonConfig) return;

    try {
      const config = await loadConfig(this.projectPath);
      const effective = getEffectiveConfig(config);
      this.daemonConfig = effective.daemon;
    } catch {
      // Fall back to defaults if config unavailable
      this.daemonConfig = {
        pollInterval: 5000,
        autoStart: false,
        logLevel: 'info',
      };
    }
  }

  async startDaemon(): Promise<number> {
    await this.loadDaemonConfig();

    // Use options if provided, otherwise use config
    const pollInterval = this.options.pollIntervalMs ?? this.daemonConfig!.pollInterval;
    const logLevel = this.options.logLevel ?? this.daemonConfig!.logLevel;

    const child = fork(entryPoint, [], {
      env: {
        ...process.env,
        APEX_DAEMON_MODE: '1',
        APEX_PROJECT_PATH: this.projectPath,
        APEX_POLL_INTERVAL: String(pollInterval),
        APEX_LOG_LEVEL: logLevel,  // NEW env var
        APEX_DAEMON_DEBUG: process.env.APEX_DAEMON_DEBUG || '0',
      },
    });
    // ...
  }
}
```

#### 3. Update daemon-entry.ts to Load Config

```typescript
// packages/orchestrator/src/daemon-entry.ts

import { loadConfig, getEffectiveConfig, DaemonConfig } from '@apexcli/core';

async function getDaemonConfig(projectPath: string): Promise<{
  pollInterval: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  logToStdout: boolean;
}> {
  // Environment variables override config (for DaemonManager passing values)
  const envPollInterval = process.env.APEX_POLL_INTERVAL;
  const envLogLevel = process.env.APEX_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error' | undefined;
  const logToStdout = process.env.APEX_DAEMON_DEBUG === '1';

  // If env vars provided by DaemonManager, use them
  if (envPollInterval && envLogLevel) {
    return {
      pollInterval: parseInt(envPollInterval, 10),
      logLevel: envLogLevel,
      logToStdout,
    };
  }

  // Otherwise load from config
  try {
    const config = await loadConfig(projectPath);
    const effective = getEffectiveConfig(config);
    return {
      pollInterval: effective.daemon.pollInterval,
      logLevel: effective.daemon.logLevel,
      logToStdout: logToStdout || effective.daemon.logLevel === 'debug',
    };
  } catch {
    // Fallback defaults
    return {
      pollInterval: 5000,
      logLevel: 'info',
      logToStdout,
    };
  }
}

async function main(): Promise<void> {
  const projectPath = process.env.APEX_PROJECT_PATH;
  if (!projectPath) {
    console.error('APEX_PROJECT_PATH environment variable is required');
    process.exit(1);
  }

  const { pollInterval, logLevel, logToStdout } = await getDaemonConfig(projectPath);

  console.log('Starting APEX daemon...');
  console.log(`Project path: ${projectPath}`);
  console.log(`Poll interval: ${pollInterval}ms`);
  console.log(`Log level: ${logLevel}`);

  const runner = await DaemonRunner.create(projectPath, {
    pollIntervalMs: pollInterval,
    logLevel,
    logToStdout,
  });

  await runner.start();
}
```

#### 4. Enhance DaemonRunner Log Filtering

Add proper log level filtering to respect the configured level:

```typescript
// packages/orchestrator/src/runner.ts

private readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
private readonly logLevelPriority = { debug: 0, info: 1, warn: 2, error: 3 };

constructor(options: DaemonRunnerOptions) {
  this.logLevel = options.logLevel ?? 'info';
  // ...
}

private log(level: DaemonLogEntry['level'], message: string, metadata?: { taskId?: string }): void {
  // Filter based on configured log level
  if (this.logLevelPriority[level] < this.logLevelPriority[this.logLevel]) {
    return;  // Skip logs below configured level
  }

  // ... existing logging code
}
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Configuration Flow                               │
└─────────────────────────────────────────────────────────────────────────┘

.apex/config.yaml                CLI Command                   Environment
       │                              │                             │
       ▼                              ▼                             │
┌──────────────┐             ┌────────────────┐                     │
│ loadConfig() │◄────────────│ daemon-handlers│                     │
└──────────────┘             │   --poll-interval                    │
       │                     │   --log-level  │                     │
       ▼                     └───────┬────────┘                     │
┌───────────────────┐                │                              │
│ getEffectiveConfig│                │                              │
│  daemon:          │                │                              │
│    pollInterval   │◄───────────────┘                              │
│    logLevel       │                                               │
│    autoStart      │                                               │
└───────────────────┘                                               │
       │                                                            │
       ├──────────────────────────────────────────────────────────▶│
       ▼                                                            ▼
┌──────────────────┐     Fork + Env Vars      ┌──────────────────────┐
│  DaemonManager   │─────────────────────────▶│    daemon-entry.ts   │
│  • pollIntervalMs│  APEX_POLL_INTERVAL      │    • Load config     │
│  • logLevel      │  APEX_LOG_LEVEL          │    • Or use env vars │
└──────────────────┘                          └──────────────────────┘
                                                         │
                                                         ▼
                                              ┌──────────────────────┐
                                              │    DaemonRunner      │
                                              │    • pollIntervalMs  │
                                              │    • logLevel        │
                                              │    • maxConcurrent   │
                                              └──────────────────────┘
```

### Priority Resolution (Highest to Lowest)

1. **Explicit CLI arguments** (`--poll-interval`, `--log-level`)
2. **DaemonManager options** passed to constructor
3. **Environment variables** (`APEX_POLL_INTERVAL`, `APEX_LOG_LEVEL`)
4. **Project config** (`.apex/config.yaml` → `daemon` section)
5. **Schema defaults** (5000ms, 'info')

### Interface Changes Summary

| Component | Change | Breaking? |
|-----------|--------|-----------|
| `DaemonRunnerOptions` | Add optional `logLevel` field | No |
| `DaemonRunner` | Add static `create()` factory | No |
| `DaemonRunner.log()` | Add level filtering | No |
| `DaemonOptions` | Add optional `logLevel` field | No |
| `DaemonManager.startDaemon()` | Add `APEX_LOG_LEVEL` env var | No |
| `daemon-entry.ts` | Load config before creating runner | No |

### Config File Example

```yaml
# .apex/config.yaml
version: '1.0'
project:
  name: my-project

daemon:
  pollInterval: 3000     # Poll every 3 seconds
  logLevel: debug        # Enable debug logging
  autoStart: false       # Don't auto-start daemon on CLI launch
```

## Consequences

### Positive

- **Unified Configuration**: Users can configure daemon behavior via familiar config.yaml
- **No Breaking Changes**: All existing code paths work unchanged
- **Proper Log Levels**: Full 4-level logging support (debug, info, warn, error)
- **Single Source of Truth**: Defaults in Zod schema, applied everywhere
- **Flexible Overrides**: CLI args > Options > Env vars > Config > Defaults

### Negative

- **Added Complexity**: Config loading in multiple places
- **Async Factory**: `DaemonRunner.create()` is async, slight usage change
- **Potential Race Condition**: Config could change between read and use (unlikely)

### Risks & Mitigations

- **Risk**: Config file read errors during daemon startup
  - **Mitigation**: Graceful fallback to hardcoded defaults with warning log

- **Risk**: Inconsistent state if config changes while daemon runs
  - **Mitigation**: Config read once at startup; restart required for changes

## Implementation Plan

### Phase 1: Core Integration (packages/orchestrator)

1. **runner.ts**:
   - Add `logLevel` to `DaemonRunnerOptions`
   - Implement log level filtering in `log()` method
   - Add static `DaemonRunner.create()` factory method

2. **daemon.ts**:
   - Add `logLevel` to `DaemonOptions`
   - Load config in `startDaemon()` for defaults
   - Pass `APEX_LOG_LEVEL` environment variable to child

3. **daemon-entry.ts**:
   - Add `getDaemonConfig()` helper function
   - Load config if env vars not provided
   - Use `DaemonRunner.create()` for config-aware instantiation

### Phase 2: CLI Integration (packages/cli)

4. **daemon-handlers.ts**:
   - Add `--log-level` option to start command
   - Pass through to DaemonManager options
   - Display configured values in status output

### Phase 3: Testing

5. **Unit Tests**:
   - Test config loading in DaemonRunner.create()
   - Test log level filtering
   - Test priority resolution

6. **Integration Tests**:
   - Test full flow from config.yaml → running daemon
   - Test CLI override of config values

## Files to Modify

```
packages/orchestrator/src/runner.ts       # Add logLevel, create() factory
packages/orchestrator/src/daemon.ts       # Add logLevel, load config
packages/orchestrator/src/daemon-entry.ts # Load config, use factory
packages/cli/src/handlers/daemon-handlers.ts # Add --log-level option
```

## References

- ADR-051: Daemon Process Manager (original daemon architecture)
- ADR-052: Daemon CLI Commands
- `packages/core/src/types.ts` - DaemonConfigSchema definition
- `packages/core/src/config.ts` - getEffectiveConfig implementation
