# ADR 063: ContainerManager Core Class Architecture

## Status
Proposed

## Date
2024-12-25

## Context

APEX needs a `ContainerManager` class to handle container lifecycle operations for isolated task execution. This builds on the existing `ContainerRuntime` (detection) and `ContainerConfig` (configuration schema) infrastructure.

### Requirements from Acceptance Criteria
1. Use `ContainerRuntime` for detection
2. Create containers with `ContainerConfig` options (image, volumes, environment, resource limits, network mode)
3. Generate proper docker/podman CLI commands
4. Handle container naming conventions for APEX tasks
5. Include unit tests with mocked docker/podman commands

### Existing Infrastructure
- `ContainerRuntime` class in `packages/core/src/container-runtime.ts` - handles runtime detection
- `ContainerConfig` type in `packages/core/src/types.ts` - Zod schema for configuration
- `ContainerInfo` and `ContainerStats` types for container state tracking

## Decision

### Architecture Overview

We will implement a `ContainerManager` class in `packages/core/src/container-manager.ts` that:
1. Uses `ContainerRuntime` for runtime detection
2. Generates CLI commands from `ContainerConfig`
3. Manages container lifecycle (create, start, exec, stop, remove)
4. Follows APEX naming conventions for task containers

### Type Definitions

```typescript
/**
 * Options for creating a container
 */
export interface ContainerCreateOptions {
  /** Container configuration */
  config: ContainerConfig;
  /** Task ID for naming convention */
  taskId?: string;
  /** Custom container name (overrides taskId-based naming) */
  name?: string;
}

/**
 * Result of container creation
 */
export interface ContainerCreateResult {
  /** Container ID */
  containerId: string;
  /** Container name */
  name: string;
  /** Command that was executed */
  command: string;
}

/**
 * Options for executing a command in a container
 */
export interface ContainerExecOptions {
  /** Container ID or name */
  container: string;
  /** Command to execute */
  command: string[];
  /** Working directory inside container */
  workingDir?: string;
  /** Environment variables for the command */
  environment?: Record<string, string>;
  /** Whether to run interactively */
  interactive?: boolean;
  /** Whether to allocate a TTY */
  tty?: boolean;
  /** User to run as */
  user?: string;
}

/**
 * Result of command execution in a container
 */
export interface ContainerExecResult {
  /** Exit code */
  exitCode: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
}

/**
 * Container lifecycle events
 */
export type ContainerEvent =
  | { type: 'created'; containerId: string; name: string }
  | { type: 'started'; containerId: string }
  | { type: 'stopped'; containerId: string; exitCode: number }
  | { type: 'removed'; containerId: string }
  | { type: 'error'; containerId?: string; error: Error };

/**
 * Container manager error codes
 */
export type ContainerManagerErrorCode =
  | 'NO_RUNTIME'
  | 'CREATE_FAILED'
  | 'START_FAILED'
  | 'EXEC_FAILED'
  | 'STOP_FAILED'
  | 'REMOVE_FAILED'
  | 'CONTAINER_NOT_FOUND'
  | 'IMAGE_PULL_FAILED'
  | 'INVALID_CONFIG';
```

### Class Design

```typescript
import { EventEmitter } from 'eventemitter3';
import { ContainerRuntime, ContainerRuntimeType } from './container-runtime';
import { ContainerConfig, ContainerInfo, ContainerStatus } from './types';

export class ContainerManager extends EventEmitter {
  private runtime: ContainerRuntime;
  private cachedRuntimeType: ContainerRuntimeType | null = null;

  constructor(options?: ContainerManagerOptions);

  // Runtime detection
  async getRuntime(): Promise<ContainerRuntimeType>;
  async ensureRuntime(): Promise<ContainerRuntimeType>;

  // Container lifecycle
  async create(options: ContainerCreateOptions): Promise<ContainerCreateResult>;
  async start(containerId: string): Promise<void>;
  async stop(containerId: string, options?: { timeout?: number }): Promise<void>;
  async remove(containerId: string, options?: { force?: boolean }): Promise<void>;

  // Command execution
  async exec(options: ContainerExecOptions): Promise<ContainerExecResult>;

  // Container inspection
  async inspect(containerId: string): Promise<ContainerInfo>;
  async getStatus(containerId: string): Promise<ContainerStatus>;
  async list(options?: { all?: boolean; labels?: Record<string, string> }): Promise<ContainerInfo[]>;

  // Image operations
  async pullImage(image: string): Promise<void>;
  async imageExists(image: string): Promise<boolean>;

  // Command generation (for testing/debugging)
  buildCreateCommand(options: ContainerCreateOptions): string[];
  buildExecCommand(options: ContainerExecOptions): string[];

  // Utility
  generateContainerName(taskId: string): string;
  static parseContainerId(output: string): string | null;
}
```

### Container Naming Convention

APEX containers follow a specific naming convention for traceability:

```
apex-task-{taskId}-{timestamp}
```

Example: `apex-task-abc123-1703500000`

This enables:
- Easy identification of APEX-managed containers
- Cleanup of orphaned containers
- Correlation with task logs

### CLI Command Generation

The manager generates CLI commands compatible with both Docker and Podman:

#### Create Command
```bash
# Docker/Podman create command structure
{runtime} create \
  --name {name} \
  --label apex.task.id={taskId} \
  --label apex.managed=true \
  -e KEY=VALUE \                    # environment
  -v /host:/container \             # volumes
  --cpus {cpu} \                    # resource limits
  --memory {memory} \
  --network {networkMode} \
  --workdir {workingDir} \
  --user {user} \
  --rm                              # autoRemove
  --privileged                      # if privileged
  --security-opt {opt} \            # securityOpts
  --cap-add {cap} \                 # capAdd
  --cap-drop {cap} \                # capDrop
  --entrypoint {entrypoint} \
  {image} \
  {command}
```

#### Implementation Details

```typescript
buildCreateCommand(options: ContainerCreateOptions): string[] {
  const { config, taskId, name } = options;
  const containerName = name || this.generateContainerName(taskId || generateTaskId());

  const args: string[] = ['create'];

  // Name and labels
  args.push('--name', containerName);
  if (taskId) {
    args.push('--label', `apex.task.id=${taskId}`);
  }
  args.push('--label', 'apex.managed=true');

  // Custom labels
  if (config.labels) {
    for (const [key, value] of Object.entries(config.labels)) {
      args.push('--label', `${key}=${value}`);
    }
  }

  // Environment variables
  if (config.environment) {
    for (const [key, value] of Object.entries(config.environment)) {
      args.push('-e', `${key}=${value}`);
    }
  }

  // Volume mounts
  if (config.volumes) {
    for (const [hostPath, containerPath] of Object.entries(config.volumes)) {
      args.push('-v', `${hostPath}:${containerPath}`);
    }
  }

  // Resource limits
  if (config.resourceLimits) {
    if (config.resourceLimits.cpu !== undefined) {
      args.push('--cpus', String(config.resourceLimits.cpu));
    }
    if (config.resourceLimits.memory) {
      args.push('--memory', config.resourceLimits.memory);
    }
    if (config.resourceLimits.memoryReservation) {
      args.push('--memory-reservation', config.resourceLimits.memoryReservation);
    }
    if (config.resourceLimits.memorySwap) {
      args.push('--memory-swap', config.resourceLimits.memorySwap);
    }
    if (config.resourceLimits.cpuShares !== undefined) {
      args.push('--cpu-shares', String(config.resourceLimits.cpuShares));
    }
    if (config.resourceLimits.pidsLimit !== undefined) {
      args.push('--pids-limit', String(config.resourceLimits.pidsLimit));
    }
  }

  // Network mode
  if (config.networkMode) {
    args.push('--network', config.networkMode);
  }

  // Working directory
  if (config.workingDir) {
    args.push('--workdir', config.workingDir);
  }

  // User
  if (config.user) {
    args.push('--user', config.user);
  }

  // Auto-remove
  if (config.autoRemove) {
    args.push('--rm');
  }

  // Privileged mode
  if (config.privileged) {
    args.push('--privileged');
  }

  // Security options
  if (config.securityOpts) {
    for (const opt of config.securityOpts) {
      args.push('--security-opt', opt);
    }
  }

  // Capabilities
  if (config.capAdd) {
    for (const cap of config.capAdd) {
      args.push('--cap-add', cap);
    }
  }
  if (config.capDrop) {
    for (const cap of config.capDrop) {
      args.push('--cap-drop', cap);
    }
  }

  // Entrypoint
  if (config.entrypoint && config.entrypoint.length > 0) {
    args.push('--entrypoint', config.entrypoint.join(' '));
  }

  // Image
  args.push(config.image);

  // Command
  if (config.command && config.command.length > 0) {
    args.push(...config.command);
  }

  return args;
}
```

### Error Handling

Custom error class for container operations:

```typescript
export class ContainerManagerError extends Error {
  constructor(
    message: string,
    public readonly code: ContainerManagerErrorCode,
    public readonly containerId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ContainerManagerError';
  }
}
```

### Event Emission

The manager emits events for container lifecycle:

```typescript
// On container creation
this.emit('container:created', { containerId, name });

// On container start
this.emit('container:started', { containerId });

// On container stop
this.emit('container:stopped', { containerId, exitCode });

// On error
this.emit('container:error', { containerId, error });
```

### File Structure

```
packages/core/src/
├── container-manager.ts       # Main implementation
├── container-runtime.ts       # Existing runtime detection
├── types.ts                   # Existing types (ContainerConfig, etc.)
└── __tests__/
    ├── container-manager.test.ts          # Unit tests
    ├── container-manager.integration.test.ts  # Integration tests
    └── container-runtime.test.ts          # Existing tests
```

### Test Strategy

Following the existing `container-runtime.test.ts` pattern:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { ContainerManager, ContainerManagerError } from '../container-manager';
import { ContainerRuntime } from '../container-runtime';

vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('../container-runtime', () => ({
  ContainerRuntime: vi.fn().mockImplementation(() => ({
    getBestRuntime: vi.fn().mockResolvedValue('docker'),
    isRuntimeAvailable: vi.fn().mockResolvedValue(true),
  })),
  containerRuntime: {
    getBestRuntime: vi.fn().mockResolvedValue('docker'),
  },
}));

describe('ContainerManager', () => {
  let manager: ContainerManager;
  const mockExec = vi.mocked(exec);

  beforeEach(() => {
    manager = new ContainerManager();
    vi.clearAllMocks();
  });

  describe('buildCreateCommand', () => {
    it('should generate basic create command', () => {
      const command = manager.buildCreateCommand({
        config: { image: 'node:20-alpine' },
        taskId: 'task-123',
      });

      expect(command).toContain('create');
      expect(command).toContain('node:20-alpine');
      expect(command).toContain('--label');
      expect(command).toContain('apex.task.id=task-123');
    });

    it('should include volume mounts', () => {
      const command = manager.buildCreateCommand({
        config: {
          image: 'node:20',
          volumes: { '/host/path': '/container/path' },
        },
      });

      expect(command).toContain('-v');
      expect(command).toContain('/host/path:/container/path');
    });

    it('should include resource limits', () => {
      const command = manager.buildCreateCommand({
        config: {
          image: 'node:20',
          resourceLimits: { cpu: 2, memory: '1g' },
        },
      });

      expect(command).toContain('--cpus');
      expect(command).toContain('2');
      expect(command).toContain('--memory');
      expect(command).toContain('1g');
    });

    it('should handle all ContainerConfig options', () => {
      const command = manager.buildCreateCommand({
        config: {
          image: 'node:20',
          volumes: { '/data': '/app/data' },
          environment: { NODE_ENV: 'production' },
          resourceLimits: { cpu: 2, memory: '2g', pidsLimit: 100 },
          networkMode: 'bridge',
          workingDir: '/app',
          user: '1000:1000',
          labels: { version: '1.0' },
          entrypoint: ['/bin/sh'],
          command: ['-c', 'npm start'],
          autoRemove: true,
          privileged: false,
          securityOpts: ['no-new-privileges:true'],
          capDrop: ['ALL'],
        },
        taskId: 'full-config-task',
      });

      expect(command).toContain('--network');
      expect(command).toContain('bridge');
      expect(command).toContain('--workdir');
      expect(command).toContain('/app');
      expect(command).toContain('--user');
      expect(command).toContain('--rm');
      expect(command).toContain('--security-opt');
      expect(command).toContain('--cap-drop');
    });
  });

  describe('create', () => {
    it('should create container and return container ID', async () => {
      mockExec.mockImplementation((cmd, opts, callback) => {
        callback(null, { stdout: 'abc123def456\n', stderr: '' });
        return {} as any;
      });

      const result = await manager.create({
        config: { image: 'node:20' },
        taskId: 'test-task',
      });

      expect(result.containerId).toBe('abc123def456');
      expect(result.name).toMatch(/^apex-task-test-task-/);
    });

    it('should throw error when no runtime available', async () => {
      vi.mocked(ContainerRuntime).mockImplementation(() => ({
        getBestRuntime: vi.fn().mockResolvedValue('none'),
      }) as any);

      const noRuntimeManager = new ContainerManager();

      await expect(noRuntimeManager.create({
        config: { image: 'node:20' },
      })).rejects.toThrow(ContainerManagerError);
    });
  });

  describe('generateContainerName', () => {
    it('should generate valid container name', () => {
      const name = manager.generateContainerName('task-abc123');

      expect(name).toMatch(/^apex-task-task-abc123-\d+$/);
    });

    it('should sanitize invalid characters in task ID', () => {
      const name = manager.generateContainerName('task/with:special@chars');

      expect(name).not.toContain('/');
      expect(name).not.toContain(':');
      expect(name).not.toContain('@');
    });
  });

  describe('exec', () => {
    it('should execute command in container', async () => {
      mockExec.mockImplementation((cmd, opts, callback) => {
        callback(null, { stdout: 'command output\n', stderr: '' });
        return {} as any;
      });

      const result = await manager.exec({
        container: 'my-container',
        command: ['npm', 'test'],
      });

      expect(result.stdout).toContain('command output');
      expect(result.exitCode).toBe(0);
    });

    it('should include environment variables in exec', async () => {
      mockExec.mockImplementation((cmd, opts, callback) => {
        expect(cmd).toContain('-e');
        expect(cmd).toContain('TEST_VAR=value');
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      await manager.exec({
        container: 'my-container',
        command: ['env'],
        environment: { TEST_VAR: 'value' },
      });
    });
  });
});
```

### Integration with Orchestrator

The `ContainerManager` will be used by `ApexOrchestrator` for container-isolated task execution:

```typescript
// In ApexOrchestrator
import { ContainerManager } from '@apexcli/core';

class ApexOrchestrator {
  private containerManager: ContainerManager;

  constructor(options: OrchestratorOptions) {
    this.containerManager = new ContainerManager();
  }

  async executeContainerTask(task: Task): Promise<void> {
    if (!task.workspace?.container) {
      throw new Error('No container configuration for task');
    }

    const result = await this.containerManager.create({
      config: task.workspace.container,
      taskId: task.id,
    });

    this.emit('container:created', task.id, result.containerId);

    try {
      await this.containerManager.start(result.containerId);
      // Execute task workflow in container
      await this.executeWorkflowInContainer(task, result.containerId);
    } finally {
      if (task.workspace.cleanup) {
        await this.containerManager.remove(result.containerId, { force: true });
      }
    }
  }
}
```

### Docker vs Podman Compatibility

Both Docker and Podman CLI follow similar patterns, with minor differences handled by the manager:

| Feature | Docker | Podman | Manager Handling |
|---------|--------|--------|------------------|
| Create | `docker create` | `podman create` | Same |
| Exec | `docker exec` | `podman exec` | Same |
| Resource limits | `--cpus`, `--memory` | Same | Same |
| Rootless | Requires setup | Default | Detection via runtime |
| Compose | `docker compose` | `podman-compose` | Future extension |

## Consequences

### Positive
- Clean abstraction over container operations
- Consistent naming convention for traceability
- Testable with mocked command execution
- Reuses existing `ContainerRuntime` for detection
- Generates CLI commands for transparency/debugging
- Event-driven for integration with orchestrator

### Negative
- Dependency on shell command execution
- Command-line parsing complexity
- No Docker API/SDK integration (by design)

### Risks
- CLI differences between Docker/Podman versions (mitigated by testing)
- Permission issues in container operations (documented in error handling)
- Volume mount path handling on different OSes

## Alternatives Considered

1. **Docker SDK/API direct integration**: Heavier dependency, less portable to Podman
2. **Kubernetes integration**: Overkill for local task isolation
3. **Nix/Flakes for isolation**: Different paradigm, steeper learning curve
4. **Firecracker microVMs**: Too heavyweight for development tasks

## Implementation Notes

1. Place in `packages/core/src/container-manager.ts`
2. Export from `packages/core/src/index.ts`
3. Use existing `ContainerRuntime` instance via injection or singleton
4. Follow existing patterns from `worktree-manager.ts` for command execution
5. Emit events compatible with orchestrator event system
