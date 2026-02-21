# ADR: Dependency Installation Integration into WorkspaceManager Container Creation Flow

**Status:** Proposed
**Date:** 2025-01-26
**Authors:** Architect Agent

## Context

APEX needs to automatically install project dependencies when creating container workspaces for tasks. Currently, `WorkspaceManager.createContainerWorkspace()` creates and starts containers but does not install dependencies, requiring manual intervention or custom entrypoints.

### Requirements from Acceptance Criteria

1. `WorkspaceManager.createContainerWorkspace()` detects project dependencies using `DependencyDetector`
2. Runs appropriate install command after container starts
3. Installation output is logged
4. Emits `dependency-install-started` and `dependency-install-completed` events
5. Integration tests verify install runs for Node.js, Python, and Rust projects

## Decision

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        WorkspaceManager                                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              createContainerWorkspace(task, config)              │   │
│  │                                                                   │   │
│  │  1. Validate container config                                    │   │
│  │  2. Check runtime availability                                   │   │
│  │  3. Create workspace directory                                   │   │
│  │  4. Build container config                                       │   │
│  │  5. Create & start container                                     │   │
│  │  ────────────────────────────────────────────────────────────   │   │
│  │  6. [NEW] Check autoDependencyInstall flag                       │   │
│  │  7. [NEW] Detect dependencies via DependencyDetector             │   │
│  │  8. [NEW] Emit 'dependency-install-started' event                │   │
│  │  9. [NEW] Execute install command via ContainerManager.execCommand│   │
│  │ 10. [NEW] Log installation output                                │   │
│  │ 11. [NEW] Emit 'dependency-install-completed' event              │   │
│  │ 12. Return workspace path                                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Interactions

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│  WorkspaceManager │──────│ DependencyDetector│      │ ContainerManager │
│                  │      │   (@apexcli/core)  │      │   (@apexcli/core)│
│                  │      └──────────────────┘      │                  │
│                  │                                 │                  │
│  createContainer │                                 │                  │
│  Workspace()     │                                 │                  │
│        │         │                                 │                  │
│        ▼         │                                 │                  │
│  [Container      │                                 │                  │
│   Created &      │                                 │                  │
│   Started]       │                                 │                  │
│        │         │                                 │                  │
│        ▼         │                                 │                  │
│  detectPackage   │─────────detectPackageManagers──▶│                  │
│  Managers()      │◀────────DependencyDetectionResult───────────────────│
│        │         │                                 │                  │
│        ▼         │                                 │                  │
│  emit('dependency│                                 │                  │
│  -install-       │                                 │                  │
│  started')       │                                 │                  │
│        │         │                                 │                  │
│        ▼         │                                 │                  │
│  execCommand()   │─────────────────────────────────▶│  execCommand()   │
│                  │◀─────────ExecCommandResult───────│                  │
│        │         │                                 │                  │
│        ▼         │                                 │                  │
│  emit('dependency│                                 │                  │
│  -install-       │                                 │                  │
│  completed')     │                                 │                  │
└──────────────────┘                                 └──────────────────┘
```

## Technical Design

### 1. New Event Definitions

Add to `WorkspaceManagerEvents` interface in `workspace-manager.ts`:

```typescript
export interface DependencyInstallEventData {
  taskId: string;
  containerId: string;
  workspacePath: string;
  installCommand: string;
  packageManager: PackageManagerType;
  language: 'javascript' | 'python' | 'rust';
  timestamp: Date;
}

export interface DependencyInstallCompletedEventData extends DependencyInstallEventData {
  success: boolean;
  duration: number;  // milliseconds
  stdout?: string;
  stderr?: string;
  exitCode: number;
  error?: string;
}

export interface WorkspaceManagerEvents {
  'workspace-created': (taskId: string, workspacePath: string) => void;
  'workspace-cleaned': (taskId: string) => void;
  // NEW EVENTS
  'dependency-install-started': (data: DependencyInstallEventData) => void;
  'dependency-install-completed': (data: DependencyInstallCompletedEventData) => void;
}
```

### 2. New Private Method: `installDependencies()`

```typescript
/**
 * Install dependencies inside a container after it starts
 * @param task - The task associated with this workspace
 * @param containerId - The container ID where dependencies should be installed
 * @param workspacePath - Local workspace path
 * @param containerConfig - Container configuration including install settings
 */
private async installDependencies(
  task: Task,
  containerId: string,
  workspacePath: string,
  containerConfig: ContainerConfig
): Promise<void> {
  // Check if auto-install is disabled
  if (containerConfig.autoDependencyInstall === false) {
    return;
  }

  // Determine install command
  let installCommand: string | null = null;
  let packageManagerType: PackageManagerType = 'unknown';
  let language: 'javascript' | 'python' | 'rust' | undefined;

  if (containerConfig.customInstallCommand) {
    // Use custom command if provided
    installCommand = containerConfig.customInstallCommand;
    packageManagerType = 'unknown';
  } else {
    // Auto-detect using DependencyDetector
    const detection = await this.dependencyDetector.detectPackageManagers(this.projectPath);

    if (detection.primaryManager?.installCommand) {
      installCommand = detection.primaryManager.installCommand;
      packageManagerType = detection.primaryManager.type;
      language = detection.primaryManager.language;
    }
  }

  // No dependencies detected or disabled
  if (!installCommand) {
    return;
  }

  const startTime = Date.now();
  const workingDir = containerConfig.workingDir || '/workspace';
  const timeout = containerConfig.installTimeout || 300000; // Default 5 minutes

  // Emit started event
  const startedData: DependencyInstallEventData = {
    taskId: task.id,
    containerId,
    workspacePath,
    installCommand,
    packageManager: packageManagerType,
    language: language || 'javascript',
    timestamp: new Date(),
  };
  this.emit('dependency-install-started', startedData);

  try {
    // Execute install command inside container
    const result = await this.containerManager.execCommand(
      containerId,
      installCommand,
      {
        workingDir,
        timeout,
      },
      this.containerRuntimeType!
    );

    const duration = Date.now() - startTime;

    // Log output
    if (result.stdout) {
      console.log(`[${task.id}] Dependency install stdout:\n${result.stdout}`);
    }
    if (result.stderr) {
      console.warn(`[${task.id}] Dependency install stderr:\n${result.stderr}`);
    }

    // Emit completed event
    const completedData: DependencyInstallCompletedEventData = {
      ...startedData,
      success: result.success,
      duration,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      error: result.error,
    };
    this.emit('dependency-install-completed', completedData);

    if (!result.success) {
      console.warn(`[${task.id}] Dependency installation failed with exit code ${result.exitCode}`);
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[${task.id}] Dependency installation error: ${errorMessage}`);

    // Emit failed completion event
    const completedData: DependencyInstallCompletedEventData = {
      ...startedData,
      success: false,
      duration,
      exitCode: 1,
      error: errorMessage,
    };
    this.emit('dependency-install-completed', completedData);
  }
}
```

### 3. Modification to `createContainerWorkspace()`

Update the method to call `installDependencies()` after container creation:

```typescript
private async createContainerWorkspace(task: Task, config: WorkspaceConfig): Promise<string> {
  // ... existing validation and setup code (lines 343-393) ...

  // Create and start container using ContainerManager
  const result = await this.containerManager.createContainer({
    config: containerConfig,
    taskId: task.id,
    autoStart: true,
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to create container');
  }

  // NEW: Install dependencies after container starts
  if (result.containerId) {
    await this.installDependencies(
      task,
      result.containerId,
      workspacePath,
      containerConfig
    );
  }

  return workspacePath;
}
```

### 4. Add DependencyDetector as Class Member

```typescript
import { DependencyDetector } from '@apexcli/core';

export class WorkspaceManager extends EventEmitter<WorkspaceManagerEvents> {
  private projectPath: string;
  private defaultStrategy: WorkspaceConfig['strategy'];
  private workspacesDir: string;
  private activeWorkspaces: Map<string, WorkspaceInfo> = new Map();
  private containerRuntimeType: ContainerRuntimeType | null = null;
  private containerManager: ContainerManager;
  private healthMonitor: ContainerHealthMonitor;
  // NEW
  private dependencyDetector: DependencyDetector;

  constructor(options: WorkspaceManagerOptions) {
    super();
    this.projectPath = options.projectPath;
    this.defaultStrategy = options.defaultStrategy;
    this.workspacesDir = join(this.projectPath, '.apex', 'workspaces');

    // Initialize container management
    this.containerManager = new ContainerManager();
    this.healthMonitor = new ContainerHealthMonitor(this.containerManager, {
      containerPrefix: 'apex-task',
      autoStart: false,
    });
    // NEW: Initialize dependency detector
    this.dependencyDetector = new DependencyDetector();
  }
  // ...
}
```

### 5. Event Forwarding in ApexOrchestrator

Add dependency install event forwarding to `setupContainerEventForwarding()` or create new method:

```typescript
// In OrchestratorEvents interface
export interface OrchestratorEvents {
  // ... existing events ...

  // NEW: Dependency installation events
  'dependency:install-started': (event: DependencyInstallEventData) => void;
  'dependency:install-completed': (event: DependencyInstallCompletedEventData) => void;
}

// In ApexOrchestrator class
private setupDependencyEventForwarding(): void {
  this.workspaceManager.on('dependency-install-started', (event) => {
    this.emit('dependency:install-started', event);
  });

  this.workspaceManager.on('dependency-install-completed', (event) => {
    this.emit('dependency:install-completed', event);
  });
}
```

### 6. Integration Test Structure

Create `workspace-dependency-install-integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from '../index';
import { WorkspaceManager } from '../workspace-manager';
import { TaskStore } from '../store';
import { DependencyDetector } from '@apexcli/core';

vi.mock('../store');
vi.mock('@apexcli/core', async () => {
  const actual = await vi.importActual('@apexcli/core');
  return {
    ...actual,
    DependencyDetector: vi.fn(),
  };
});

describe('WorkspaceManager Dependency Installation Integration', () => {
  // Test cases:
  // 1. Node.js project (npm) - verifies npm install runs
  // 2. Node.js project (yarn) - verifies yarn install runs
  // 3. Node.js project (pnpm) - verifies pnpm install runs
  // 4. Python project (pip) - verifies pip install runs
  // 5. Python project (poetry) - verifies poetry install runs
  // 6. Rust project (cargo) - verifies cargo build runs
  // 7. autoDependencyInstall: false - skips installation
  // 8. customInstallCommand - uses custom command
  // 9. Installation timeout handling
  // 10. Installation failure handling
  // 11. Event emission verification
});
```

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `packages/orchestrator/src/workspace-manager.ts` | MODIFY | Add `DependencyDetector` member, `installDependencies()` method, new event types, modify `createContainerWorkspace()` |
| `packages/orchestrator/src/index.ts` | MODIFY | Add new event types to `OrchestratorEvents`, add `setupDependencyEventForwarding()` method |
| `packages/orchestrator/src/__tests__/workspace-dependency-install-integration.test.ts` | CREATE | Integration tests for dependency installation |

## Configuration Options

Existing `ContainerConfig` fields already support this feature:

```yaml
workspace:
  strategy: container
  container:
    image: node:20-alpine
    autoDependencyInstall: true      # Enable auto-detection (default: true)
    customInstallCommand: "npm ci"   # Override auto-detected command
    installTimeout: 300000           # 5 minute timeout (milliseconds)
```

## Error Handling Strategy

1. **Detection Failure**: If `DependencyDetector` fails, log warning and continue (container usable without dependencies)
2. **Install Command Failure**: Emit `dependency-install-completed` with `success: false`, log error, continue execution
3. **Timeout**: Use configurable timeout (default 5 minutes), emit failure event on timeout
4. **No Package Manager Detected**: Skip installation silently (not all projects have dependencies)

## Performance Considerations

1. **Caching**: `DependencyDetector` uses 10-minute cache for detection results
2. **Timeout**: Default 5-minute timeout prevents hanging on large installations
3. **Async Execution**: Installation runs after container start, before workspace is returned to caller
4. **Logging**: Stdout/stderr captured and logged for debugging

## Testing Strategy

### Unit Tests
- Mock `DependencyDetector` to return controlled results
- Mock `ContainerManager.execCommand()` to verify correct command execution
- Verify event emission with correct data

### Integration Tests
- Use mock project directories with different package manager files
- Verify detection + installation flow for each language:
  - **Node.js**: package.json with npm, yarn, pnpm variations
  - **Python**: requirements.txt (pip), pyproject.toml (poetry)
  - **Rust**: Cargo.toml

### Edge Case Tests
- No package manager files present
- Multiple package managers detected
- Installation failure scenarios
- Timeout scenarios
- Custom install command usage

## Migration Impact

**Breaking Changes**: None - feature is opt-out via `autoDependencyInstall: false`

**Default Behavior Change**: Container workspaces will now automatically install dependencies if detected. Projects that don't want this should set `autoDependencyInstall: false`.

## Future Considerations

1. **Parallel Installation**: For multi-language projects, could run multiple install commands
2. **Dependency Caching**: Mount npm/pip cache volumes for faster subsequent installs
3. **Progress Streaming**: Stream install output in real-time instead of buffering
4. **Retry Logic**: Add configurable retry for transient failures

## Consequences

### Positive
- Automatic dependency installation reduces manual setup
- Event-driven architecture allows monitoring/logging
- Follows existing patterns (EventEmitter, ContainerManager integration)
- Non-breaking change with opt-out mechanism

### Negative
- Additional latency in container workspace creation (install time)
- More complex error handling paths
- Potential for installation failures blocking tasks

### Neutral
- Adds dependency on existing `DependencyDetector` class
- Expands `WorkspaceManagerEvents` interface
