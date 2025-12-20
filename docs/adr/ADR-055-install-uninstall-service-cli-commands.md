# ADR-055: CLI Commands for install-service and uninstall-service

## Status
Proposed

## Context

The task requires adding `apex install-service` and `apex uninstall-service` CLI commands that integrate with the existing `ServiceManager` class in `@apex/orchestrator`.

### Current State
1. **ServiceManager exists** (`packages/orchestrator/src/service-manager.ts`):
   - Full `install()` method with options (`enableAfterInstall`, `force`)
   - Full `uninstall()` method with options (`force`, `stopTimeout`)
   - Platform detection (Linux systemd, macOS launchd)
   - Already exported from `@apex/orchestrator`

2. **Existing CLI stub** (`packages/cli/src/index.ts`, lines 771-802):
   - A `/service` command exists but is unimplemented
   - Uses subcommand pattern: `/service [install|uninstall|status]`

3. **Acceptance Criteria**:
   - `apex install-service` command available in CLI
   - Generates and installs service for current platform
   - `apex uninstall-service` removes service registration
   - Both commands provide clear output and error messages

## Decision

### Architecture Choice: Standalone Commands vs Subcommand

**Decision**: Implement as standalone commands (`apex install-service`, `apex uninstall-service`) rather than updating the existing `/service` subcommand stub.

**Rationale**:
1. Acceptance criteria explicitly mentions `apex install-service` and `apex uninstall-service` as command names
2. Consistent with how other important operations are exposed (e.g., `apex init`, `apex serve`)
3. The existing `/service` stub can remain for interactive REPL use with its subcommand pattern
4. Standalone commands are clearer for CI/CD automation and scripting

### Technical Design

#### 1. Command Handlers Location

Create a new handler file: `packages/cli/src/handlers/service-handlers.ts`

This follows the existing pattern established by `daemon-handlers.ts`.

#### 2. Handler Interface Design

```typescript
// packages/cli/src/handlers/service-handlers.ts

import chalk from 'chalk';
import {
  ServiceManager,
  ServiceError,
  type Platform,
  type InstallResult,
  type UninstallResult
} from '@apex/orchestrator';

interface ApexContext {
  cwd: string;
  initialized: boolean;
}

interface ServiceCommandOptions {
  enable?: boolean;     // For install: enable service after install
  force?: boolean;      // For install: overwrite existing; For uninstall: force remove
  timeout?: number;     // For uninstall: graceful stop timeout
}

export async function handleInstallService(
  ctx: ApexContext,
  args: string[]
): Promise<void>;

export async function handleUninstallService(
  ctx: ApexContext,
  args: string[]
): Promise<void>;
```

#### 3. install-service Command Specification

**Command**: `apex install-service [options]`

**Options**:
| Option | Description | Default |
|--------|-------------|---------|
| `--enable` | Enable service to start on boot after installation | `false` |
| `--force` | Overwrite existing service file if present | `false` |
| `--name <name>` | Custom service name | `apex-daemon` |

**Output Messages**:
```
Success:
  ✓ Service installed successfully
    Platform: macOS (launchd)
    Service file: ~/Library/LaunchAgents/com.apex.daemon.plist
    [Enabled: yes/no]

  To start the service: launchctl start com.apex.daemon
  To check status: apex service status

Errors:
  ✗ Platform not supported
    Service installation is only available on Linux (systemd) and macOS (launchd).
    Current platform: [platform]

  ✗ Service already exists
    A service file already exists at [path].
    Use --force to overwrite.

  ✗ Permission denied
    Could not write to [path].
    [Suggestion based on platform]

  ✗ APEX not initialized
    Run 'apex init' first to initialize APEX in this directory.
```

**Implementation Flow**:
```
1. Validate context (initialized?)
2. Parse command arguments
3. Create ServiceManager with projectPath
4. Check platform support (isSupported())
5. Call install({ enableAfterInstall, force })
6. Display success message with platform-specific details
7. Handle errors with user-friendly messages
```

#### 4. uninstall-service Command Specification

**Command**: `apex uninstall-service [options]`

**Options**:
| Option | Description | Default |
|--------|-------------|---------|
| `--force` | Force uninstall even if graceful stop fails | `false` |
| `--timeout <ms>` | Timeout for graceful service stop | `5000` |

**Output Messages**:
```
Success:
  ✓ Service uninstalled successfully
    Platform: macOS (launchd)
    Removed: ~/Library/LaunchAgents/com.apex.daemon.plist
    [Was running: yes/no]

Errors:
  ✗ Service not found
    No service file found at [path].
    The service may not be installed.

  ✗ Could not stop service gracefully
    Service did not stop within [timeout]ms.
    Use --force to continue anyway.

  ✗ Permission denied
    Could not remove [path].
    [Suggestion based on platform]
```

**Implementation Flow**:
```
1. Validate context (need not be initialized - service may exist from old install)
2. Parse command arguments
3. Create ServiceManager with projectPath
4. Call uninstall({ force, stopTimeout })
5. Display success message with cleanup details
6. Handle errors with user-friendly messages
```

#### 5. CLI Integration Points

**Non-interactive mode** (lines 1684-1698 in index.ts):
Add mappings for direct command execution:

```typescript
// In executeNonInteractiveCommand or command routing
if (cmdName === 'install-service') {
  await handleInstallService(ctx, args);
  return;
}
if (cmdName === 'uninstall-service') {
  await handleUninstallService(ctx, args);
  return;
}
```

**Help text update** (lines 1639-1674):
Add to command documentation:

```
${chalk.bold('Service Commands:')}
  install-service    Install APEX daemon as system service
  uninstall-service  Remove APEX daemon system service
```

**REPL mode** (commands array, lines 81-953):
Update existing `/service` command stub to call the handlers:

```typescript
{
  name: 'service',
  aliases: ['svc'],
  description: 'Manage daemon as system service',
  usage: '/service [install|uninstall|status]',
  handler: async (ctx, args) => {
    const action = args[0]?.toLowerCase();
    switch (action) {
      case 'install':
        await handleInstallService(ctx, args.slice(1));
        break;
      case 'uninstall':
        await handleUninstallService(ctx, args.slice(1));
        break;
      case 'status':
        await handleServiceStatus(ctx);
        break;
      default:
        // Show usage
    }
  },
}
```

#### 6. Error Code Mapping

Map `ServiceError` codes to user-friendly messages:

```typescript
const SERVICE_ERROR_MESSAGES: Record<ServiceErrorCode, string> = {
  PLATFORM_UNSUPPORTED: 'Service installation is only available on Linux (systemd) and macOS (launchd).',
  SERVICE_EXISTS: 'A service file already exists. Use --force to overwrite.',
  SERVICE_NOT_FOUND: 'No service file found. The service may not be installed.',
  PERMISSION_DENIED: 'Permission denied. Check directory permissions or run with elevated privileges.',
  INSTALL_FAILED: 'Failed to install service. Check logs for details.',
  UNINSTALL_FAILED: 'Failed to uninstall service. Check logs for details.',
  GENERATION_FAILED: 'Failed to generate service file.',
};
```

#### 7. Platform-Specific Hints

Provide helpful next steps based on platform:

**Linux (systemd)**:
```
To start the service: systemctl --user start apex-daemon
To check status: systemctl --user status apex-daemon
To view logs: journalctl --user -u apex-daemon -f
```

**macOS (launchd)**:
```
To start the service: launchctl start com.apex.daemon
To check status: launchctl list | grep apex
To view logs: tail -f .apex/daemon.out.log
```

### File Structure

```
packages/cli/src/
├── handlers/
│   ├── daemon-handlers.ts     # Existing
│   └── service-handlers.ts    # NEW - Service management handlers
└── index.ts                   # Updated with new commands
```

### Dependencies

No new dependencies required. Uses existing:
- `@apex/orchestrator` - ServiceManager, ServiceError
- `chalk` - Terminal formatting

## Implementation Checklist

### Developer Stage Tasks

1. **Create service-handlers.ts**:
   - [ ] `handleInstallService()` function
   - [ ] `handleUninstallService()` function
   - [ ] `handleServiceStatus()` function
   - [ ] Error message formatting helper
   - [ ] Platform-specific hint helper

2. **Update index.ts**:
   - [ ] Import handlers from `./handlers/service-handlers`
   - [ ] Add `install-service` and `uninstall-service` to non-interactive command routing
   - [ ] Update `/service` REPL command to use handlers
   - [ ] Update help text with service commands

3. **Update exports** (if needed):
   - Handlers are internal, no public exports needed

### Testing Stage Tasks

1. **Unit tests for handlers**:
   - [ ] Test install with --enable flag
   - [ ] Test install with --force flag
   - [ ] Test uninstall with --force flag
   - [ ] Test error handling for each error code
   - [ ] Test platform detection messages

2. **Integration tests**:
   - [ ] Mock ServiceManager to test CLI flow
   - [ ] Verify output formatting

## Consequences

### Positive
- Clean separation of CLI command handling from ServiceManager logic
- Consistent with existing daemon-handlers pattern
- User-friendly error messages and platform-specific guidance
- Supports both interactive REPL (`/service install`) and CLI (`apex install-service`) modes

### Negative
- Two ways to invoke (REPL vs CLI) may cause minor confusion
- Cannot test actual service installation without root/sudo on most systems

### Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| User runs install without init | Clear error message directing to `apex init` |
| Platform not supported | Clear message explaining supported platforms |
| Permission issues | Suggest user-level installation or sudo |
| Service already running during uninstall | Graceful stop with configurable timeout |

## References

- [ADR-054: ServiceManager Platform Integration](./ADR-054-service-manager-platform-integration.md)
- [Existing daemon-handlers.ts](../packages/cli/src/handlers/daemon-handlers.ts)
- [ServiceManager implementation](../packages/orchestrator/src/service-manager.ts)
