# ADR-068: Container Isolation Architecture

## Status
Accepted

## Date
2024-12-26

## Context

APEX needs to provide secure, reproducible, and isolated execution environments for AI agents running development tasks. Container isolation offers OS-level sandboxing that ensures:

1. **Security**: Tasks run in isolated environments with controlled access to host resources
2. **Reproducibility**: Consistent execution environment across different machines
3. **Resource Control**: CPU, memory, and process limits prevent runaway tasks
4. **Dependency Isolation**: Project dependencies don't conflict with host system

This ADR documents the complete technical architecture for container isolation in APEX, covering the components, data flow, and integration points.

## Decision

### Architecture Overview

The container isolation system consists of four main components in the `@apex/core` package:

```
                                  ┌─────────────────────────────────────────────────────────────────┐
                                  │                        APEX Architecture                          │
                                  └─────────────────────────────────────────────────────────────────┘
                                                              │
                         ┌────────────────────────────────────┼────────────────────────────────────┐
                         │                                    │                                    │
                         ▼                                    ▼                                    ▼
                  ┌─────────────┐                    ┌─────────────────┐                   ┌─────────────┐
                  │  CLI/API    │                    │  Orchestrator   │                   │  Web UI     │
                  │  @apex/cli  │                    │ @apex/orchestr. │                   │ @apex/web-ui│
                  └─────────────┘                    └─────────────────┘                   └─────────────┘
                         │                                    │
                         │                    ┌───────────────┼───────────────┐
                         │                    │               │               │
                         ▼                    ▼               ▼               ▼
                  ┌─────────────────────────────────────────────────────────────────────┐
                  │                           @apex/core                                  │
                  │  ┌────────────────┐  ┌──────────────────┐  ┌────────────────────┐   │
                  │  │ ContainerRuntime│  │ ContainerManager │  │ ContainerHealth    │   │
                  │  │   (Detection)  │  │   (Lifecycle)    │  │   Monitor          │   │
                  │  └────────────────┘  └──────────────────┘  └────────────────────┘   │
                  │           │                    │                      │              │
                  │           │          ┌────────┴────────┐             │              │
                  │           │          ▼                 ▼             │              │
                  │           │   ┌─────────────┐  ┌─────────────┐       │              │
                  │           │   │ImageBuilder │  │  LogStream  │       │              │
                  │           │   └─────────────┘  └─────────────┘       │              │
                  │           │          │                               │              │
                  │           └──────────┼───────────────────────────────┘              │
                  │                      │                                               │
                  │                      ▼                                               │
                  │           ┌──────────────────────────────┐                          │
                  │           │      Container Runtime       │                          │
                  │           │       Docker / Podman        │                          │
                  │           └──────────────────────────────┘                          │
                  └─────────────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. ContainerRuntime (`container-runtime.ts`)

Responsible for detecting and validating available container runtimes.

```typescript
// Key interfaces
interface RuntimeDetectionResult {
  type: ContainerRuntimeType;      // 'docker' | 'podman' | 'none'
  available: boolean;              // Whether runtime is functional
  versionInfo?: RuntimeVersionInfo; // Version details
  error?: string;                  // Error if detection failed
}

interface RuntimeVersionInfo {
  version: string;                 // e.g., "24.0.7"
  fullVersion: string;             // Complete version output
  apiVersion?: string;             // Docker API version
  buildInfo?: string;              // Build information
}
```

**Detection Priority:**
1. Docker (preferred if available)
2. Podman (fallback)
3. None (container features disabled)

**Capabilities:**
- Detect available runtimes via CLI (`docker --version`, `podman --version`)
- Verify runtime is functional via `docker info` / `podman info`
- Cache detection results (5-minute TTL)
- Validate version compatibility against requirements

#### 2. ContainerManager (`container-manager.ts`)

Central class managing container lifecycle operations.

```typescript
// Extends EventEmitter3 for typed events
class ContainerManager extends TypedEventEmitter<ContainerManagerEvents> {
  // Lifecycle operations
  async createContainer(options: CreateContainerOptions): Promise<ContainerOperationResult>;
  async startContainer(containerId: string): Promise<ContainerOperationResult>;
  async stopContainer(containerId: string, timeout?: number): Promise<ContainerOperationResult>;
  async removeContainer(containerId: string, force?: boolean): Promise<ContainerOperationResult>;

  // Command execution
  async execCommand(containerId: string, command: string | string[], options?: ExecCommandOptions): Promise<ExecCommandResult>;

  // Inspection and monitoring
  async inspect(containerId: string): Promise<ContainerInfo | null>;
  async getStats(containerId: string): Promise<ContainerStats | null>;
  async streamLogs(containerId: string, options?: ContainerLogStreamOptions): Promise<ContainerLogStream>;

  // Docker events monitoring
  async startEventsMonitoring(options?: DockerEventsMonitorOptions): Promise<void>;
  async stopEventsMonitoring(): Promise<void>;
}
```

**Naming Convention:**
```
apex-{taskId}[-{timestamp}]
```
Example: `apex-task123-1703516400`

**Event Emission:**
- `container:created` - When container is created
- `container:started` - When container starts running
- `container:stopped` - When container is gracefully stopped
- `container:died` - When container terminates unexpectedly
- `container:removed` - When container is removed
- `container:lifecycle` - General lifecycle event

#### 3. ImageBuilder (`image-builder.ts`)

Handles Docker image building from Dockerfiles with caching.

```typescript
interface ImageBuildConfig {
  dockerfilePath: string;      // Path to Dockerfile
  buildContext?: string;       // Build context directory
  imageTag?: string;           // Custom image tag
  buildArgs?: Record<string, string>;
  target?: string;             // Multi-stage build target
  platform?: string;           // Target platform
  noCache?: boolean;           // Disable build cache
  forceRebuild?: boolean;      // Force rebuild
}

interface ImageBuildResult {
  success: boolean;
  imageInfo?: ImageInfo;
  error?: string;
  buildOutput: string;
  buildDuration: number;
  rebuilt: boolean;            // false if used from cache
}
```

**Caching Strategy:**
- Cache stored in `.apex/image-cache.json`
- Content-based cache key (Dockerfile hash)
- LRU cleanup with configurable max entries
- Automatic cache invalidation on Dockerfile changes

#### 4. ContainerHealthMonitor (`container-health-monitor.ts`)

Monitors container health status and emits health events.

```typescript
interface ContainerHealthMonitorOptions {
  interval?: number;           // Check interval (default: 30s)
  maxFailures?: number;        // Failures before unhealthy (default: 3)
  timeout?: number;            // Check timeout (default: 5s)
  containerPrefix?: string;    // Containers to monitor (default: 'apex')
  autoStart?: boolean;         // Auto-start monitoring (default: true)
}

type ContainerHealthStatus = 'starting' | 'healthy' | 'unhealthy' | 'none';
```

**Health Evaluation Criteria:**
- Container is running
- Memory usage < 95%
- PID count < 10000 (configurable)
- Stats are retrievable

### Container Lifecycle Flow

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          Container Lifecycle State Machine                         │
└──────────────────────────────────────────────────────────────────────────────────┘

     ┌──────────┐     create()     ┌──────────┐     start()     ┌──────────┐
     │  INIT    │ ───────────────▶ │ CREATED  │ ───────────────▶ │ RUNNING  │
     └──────────┘                  └──────────┘                  └──────────┘
                                        │                              │
                                        │ (error)                      │ stop() / die
                                        ▼                              ▼
                                   ┌──────────┐                  ┌──────────┐
                                   │  ERROR   │                  │ STOPPED  │
                                   └──────────┘                  └──────────┘
                                                                       │
                                                                       │ remove()
                                                                       ▼
                                                                 ┌──────────┐
                                                                 │ REMOVED  │
                                                                 └──────────┘
```

### Data Flow: Task Execution in Container

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Task Execution Flow                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘

   User                CLI                 Orchestrator           ContainerManager        Runtime
    │                   │                      │                        │                   │
    │  apex run "task"  │                      │                        │                   │
    ├──────────────────▶│                      │                        │                   │
    │                   │  createTask(task)    │                        │                   │
    │                   ├─────────────────────▶│                        │                   │
    │                   │                      │                        │                   │
    │                   │                      │ [workspace: container] │                   │
    │                   │                      │                        │                   │
    │                   │                      │  createContainer(...)  │                   │
    │                   │                      ├───────────────────────▶│                   │
    │                   │                      │                        │                   │
    │                   │                      │                        │  docker create    │
    │                   │                      │                        ├──────────────────▶│
    │                   │                      │                        │                   │
    │                   │                      │                        │◀──── containerId ─┤
    │                   │                      │                        │                   │
    │                   │                      │◀───── result ──────────┤                   │
    │                   │                      │                        │                   │
    │                   │     emit: container:created                   │                   │
    │◀──────────────────┼──────────────────────┤                        │                   │
    │                   │                      │                        │                   │
    │                   │                      │  startContainer(id)    │                   │
    │                   │                      ├───────────────────────▶│                   │
    │                   │                      │                        │  docker start     │
    │                   │                      │                        ├──────────────────▶│
    │                   │                      │                        │                   │
    │                   │                      │   execCommand(...)     │                   │
    │                   │                      ├───────────────────────▶│                   │
    │                   │                      │                        │  docker exec      │
    │                   │                      │                        ├──────────────────▶│
    │                   │                      │                        │                   │
    │                   │      agent output / events                    │                   │
    │◀──────────────────┼──────────────────────┼◀───────────────────────┼◀──────────────────┤
    │                   │                      │                        │                   │
    │                   │                      │  [cleanup on complete] │                   │
    │                   │                      │  stopContainer(id)     │                   │
    │                   │                      ├───────────────────────▶│                   │
    │                   │                      │  removeContainer(id)   │                   │
    │                   │                      ├───────────────────────▶│                   │
    │                   │                      │                        │                   │
    │                   │     emit: task:completed                      │                   │
    │◀──────────────────┼──────────────────────┤                        │                   │
    │                   │                      │                        │                   │
```

### Configuration Schema

The container configuration is defined in `types.ts` using Zod schemas:

```typescript
// Resource limits
export const ResourceLimitsSchema = z.object({
  cpu: z.number().min(0.1).max(64).optional(),
  memory: z.string().regex(/^\d+[kmgKMG]?$/).optional(),
  memoryReservation: z.string().optional(),
  memorySwap: z.string().optional(),
  cpuShares: z.number().min(2).max(262144).optional(),
  pidsLimit: z.number().min(1).optional(),
});

// Full container configuration
export const ContainerConfigSchema = z.object({
  image: z.string().min(1),
  dockerfile: z.string().optional(),
  buildContext: z.string().optional(),
  imageTag: z.string().optional(),
  volumes: z.record(z.string(), z.string()).optional(),
  environment: z.record(z.string(), z.string()).optional(),
  resourceLimits: ResourceLimitsSchema.optional(),
  networkMode: z.enum(['bridge', 'host', 'none', 'container']).optional(),
  workingDir: z.string().optional(),
  user: z.string().optional(),
  labels: z.record(z.string(), z.string()).optional(),
  entrypoint: z.array(z.string()).optional(),
  command: z.array(z.string()).optional(),
  autoRemove: z.boolean().optional().default(true),
  privileged: z.boolean().optional().default(false),
  securityOpts: z.array(z.string()).optional(),
  capAdd: z.array(z.string()).optional(),
  capDrop: z.array(z.string()).optional(),
  autoDependencyInstall: z.boolean().optional().default(true),
  customInstallCommand: z.string().optional(),
  useFrozenLockfile: z.boolean().optional().default(true),
  installTimeout: z.number().positive().optional(),
  installRetries: z.number().int().min(0).optional(),
});

// Workspace defaults (project-level config)
export const WorkspaceDefaultsSchema = z.object({
  defaultStrategy: WorkspaceStrategySchema.optional().default('none'),
  cleanupOnComplete: z.boolean().optional().default(true),
  container: ContainerDefaultsSchema.optional(),
});
```

### Workspace Isolation Strategies Comparison

| Feature | Container | Worktree | Directory | None |
|---------|-----------|----------|-----------|------|
| **Isolation Level** | Full (OS-level) | Git-level | File-level | None |
| **Performance** | Moderate | Fast | Slow (copy) | Fastest |
| **Resource Control** | Yes (CPU/memory) | No | No | No |
| **Environment Isolation** | Complete | Shared host | Shared host | Shared host |
| **Dependency Isolation** | Yes | No | Partial | No |
| **Reproducibility** | High | Medium | Medium | Low |
| **Setup Overhead** | Docker required | Git required | Disk space | None |
| **Network Isolation** | Optional | No | No | No |
| **Use Case** | CI/CD, security, reproducibility | Parallel branches | Simple isolation | Quick tasks |

### Event System Integration

Container events integrate with the APEX event system:

```typescript
// Event types in types.ts
export type ApexEventType =
  | 'container:created'
  | 'container:started'
  | 'container:stopped'
  | 'container:died'
  | 'container:removed'
  | 'container:health'
  // ... other event types
;

// Typed event data interfaces
export interface ContainerCreatedEventData extends ContainerEventDataBase {
  config?: ContainerConfig;
  labels?: Record<string, string>;
}

export interface ContainerDiedEventData extends ContainerEventDataBase {
  exitCode: number;
  signal?: string;
  oomKilled: boolean;
  error?: string;
  runDuration?: number;
}
```

### Configuration Validation

Config loading validates container workspace settings at startup:

```typescript
// In config.ts
export async function validateContainerWorkspaceConfig(config: ApexConfig): Promise<ContainerValidationResult> {
  const result: ContainerValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  if (config.workspace?.defaultStrategy === 'container') {
    // Check runtime availability
    const runtimes = await containerRuntime.detectRuntimes();
    if (!runtimes.some(r => r.available)) {
      result.valid = false;
      result.errors.push({
        type: 'missing_runtime',
        message: 'Container strategy selected but no runtime available',
        suggestion: 'Install Docker or Podman, or use worktree/directory strategy',
      });
    }

    // Check image specification
    if (!config.workspace.container?.image) {
      result.warnings.push({
        type: 'no_image_specified',
        message: 'No default container image specified',
        suggestion: 'Set workspace.container.image for reliability',
      });
    }
  }

  return result;
}
```

### Security Considerations

1. **Default Security Posture:**
   - `privileged: false` by default
   - Recommend `capDrop: ["ALL"]` with minimal `capAdd`
   - `securityOpts: ["no-new-privileges:true"]` recommended

2. **Resource Limits:**
   - Prevent runaway tasks with CPU/memory limits
   - PID limits prevent fork bombs

3. **Network Isolation:**
   - Default to `bridge` mode
   - Optional `none` mode for complete network isolation

4. **Volume Mounts:**
   - Only mount necessary paths
   - Use read-only mounts where possible

### Error Handling

```typescript
// Container operation errors include:
// - NO_RUNTIME: No container runtime available
// - CREATE_FAILED: Container creation failed
// - START_FAILED: Container start failed
// - EXEC_FAILED: Command execution failed
// - STOP_FAILED: Container stop failed
// - REMOVE_FAILED: Container removal failed
// - CONTAINER_NOT_FOUND: Container doesn't exist
// - IMAGE_PULL_FAILED: Image pull failed

// Errors are propagated via:
// 1. Return values (ContainerOperationResult.success = false)
// 2. Events (container:died with exitCode and error)
// 3. Throws for unrecoverable errors
```

### File Structure

```
packages/core/src/
├── container-runtime.ts          # Runtime detection
├── container-manager.ts          # Lifecycle management
├── container-health-monitor.ts   # Health monitoring
├── image-builder.ts              # Image building and caching
├── config.ts                     # Config loading with validation
├── types.ts                      # All type definitions
└── __tests__/
    ├── container-runtime.test.ts
    ├── container-runtime.integration.test.ts
    ├── container-manager.test.ts
    ├── container-manager.integration.test.ts
    ├── container-health-monitor.test.ts
    ├── container-health-monitor.integration.test.ts
    ├── image-builder.test.ts
    └── image-builder-cache.test.ts
```

## Consequences

### Positive

1. **Complete OS-level isolation** - Tasks run in sandboxed environments
2. **Reproducible builds** - Same environment across all machines
3. **Resource control** - Prevent runaway tasks from affecting the host
4. **Multi-runtime support** - Works with Docker or Podman
5. **Comprehensive event system** - Full visibility into container lifecycle
6. **Flexible configuration** - Per-task or project-level defaults
7. **Built-in health monitoring** - Automatic detection of unhealthy containers

### Negative

1. **Requires container runtime** - Docker or Podman must be installed
2. **Startup overhead** - Container creation adds ~1-3 seconds
3. **Disk space** - Container images consume storage
4. **Complexity** - More moving parts than simple execution

### Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Runtime not available | Graceful fallback with clear error messages |
| Image pull failures | Retry logic, offline-first with cached images |
| OOM kills | Health monitoring, resource limits, events |
| Permission issues | User configuration, documentation |
| Network issues | Configurable network mode, bridge default |

## Related ADRs

- [ADR-063: Container Manager Architecture](./ADR-063-container-manager-architecture.md)
- [ADR-064: Container Manager EventEmitter3 Refactoring](./ADR-064-container-manager-eventemitter3-refactoring.md)
- [ADR-065: Workspace Manager Dockerfile Detection](./ADR-065-workspace-manager-dockerfile-detection.md)
- [ADR-066: Container Workspace Config Validation](./ADR-066-container-workspace-config-validation.md)
- [ADR-067: Container ID Workspace Info](./ADR-067-container-id-workspace-info.md)

## References

- [Container Isolation User Guide](../container-isolation.md)
- [Docker Documentation](https://docs.docker.com/)
- [Podman Documentation](https://podman.io/docs)
