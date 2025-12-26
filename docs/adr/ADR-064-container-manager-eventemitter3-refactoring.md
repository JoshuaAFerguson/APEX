# ADR 064: ContainerManager EventEmitter3 Refactoring

## Status
Proposed

## Date
2024-12-26

## Context

The `ContainerManager` class in `packages/core/src/container-manager.ts` currently:
1. Does NOT extend EventEmitter - it has no event emission capability
2. Uses Node's built-in `EventEmitter` from `events` only for the `ContainerLogStream` class

The project has established patterns using `eventemitter3` with fully typed events in the orchestrator package:
- `ApexOrchestrator` extends `EventEmitter<OrchestratorEvents>`
- `CapacityMonitor` extends `EventEmitter<CapacityMonitorEvents>`
- `ThoughtCaptureManager` extends `EventEmitter<ThoughtCaptureManagerEvents>`
- `WorkspaceManager` extends `EventEmitter<WorkspaceManagerEvents>`
- `IdleProcessor` extends `EventEmitter<IdleProcessorEvents>`

Container event data types are already defined in `packages/core/src/types.ts`:
- `ContainerCreatedEventData`
- `ContainerStartedEventData`
- `ContainerStoppedEventData`
- `ContainerDiedEventData`
- `ContainerRemovedEventData`
- `ContainerHealthEventData`

## Decision

### 1. Add eventemitter3 Dependency to Core Package

Update `packages/core/package.json`:
```json
{
  "dependencies": {
    "eventemitter3": "^5.0.1",
    "yaml": "^2.3.4",
    "zod": "^3.22.4"
  }
}
```

### 2. Define ContainerManagerEvents Interface

Add to `packages/core/src/container-manager.ts`:

```typescript
import { EventEmitter } from 'eventemitter3';
import {
  ContainerCreatedEventData,
  ContainerStartedEventData,
  ContainerStoppedEventData,
  ContainerDiedEventData,
  ContainerRemovedEventData,
  ContainerHealthEventData,
  ContainerLogEntry,
} from './types';

/**
 * Error class for container operations
 * Provides structured error information for event emission
 */
export class ContainerOperationError extends Error {
  constructor(
    message: string,
    public readonly operation: 'create' | 'start' | 'stop' | 'remove' | 'exec' | 'inspect',
    public readonly containerId?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ContainerOperationError';
    Object.setPrototypeOf(this, ContainerOperationError.prototype);
  }
}

/**
 * Typed event interface for ContainerManager
 * Follows established patterns from ApexOrchestrator
 */
export interface ContainerManagerEvents {
  'container:created': (data: ContainerCreatedEventData) => void;
  'container:started': (data: ContainerStartedEventData) => void;
  'container:stopped': (data: ContainerStoppedEventData) => void;
  'container:died': (data: ContainerDiedEventData) => void;
  'container:removed': (data: ContainerRemovedEventData) => void;
  'container:health': (data: ContainerHealthEventData) => void;
  'container:error': (error: ContainerOperationError) => void;
}
```

### 3. Refactor ContainerManager Class

Change the class declaration to extend EventEmitter with typed events:

```typescript
export class ContainerManager extends EventEmitter<ContainerManagerEvents> {
  private runtime: ContainerRuntime;
  private defaultNamingConfig: ContainerNamingConfig;

  constructor(
    runtime?: ContainerRuntime,
    namingConfig?: Partial<ContainerNamingConfig>
  ) {
    super();  // Call EventEmitter constructor
    this.runtime = runtime || new ContainerRuntime();
    this.defaultNamingConfig = {
      prefix: 'apex',
      includeTaskId: true,
      includeTimestamp: false,
      separator: '-',
      ...namingConfig,
    };
  }
  // ... rest of implementation
}
```

### 4. Event Emission Points

#### createContainer Method
```typescript
async createContainer(options: CreateContainerOptions): Promise<ContainerOperationResult> {
  try {
    // ... existing creation logic ...

    const containerId = stdout.trim();
    const containerInfo = await this.getContainerInfo(containerId, runtimeType);

    // Emit container:created event
    const eventData: ContainerCreatedEventData = {
      containerId,
      containerName: containerName,
      image: options.config.image,
      taskId: options.taskId,
      timestamp: new Date(),
      config: options.config,
      labels: this.buildApexLabels(containerName, options.taskId),
    };
    this.emit('container:created', eventData);

    return { success: true, containerId, containerInfo, command, output: stdout };
  } catch (error) {
    // Emit error event
    const opError = new ContainerOperationError(
      `Container creation failed: ${error instanceof Error ? error.message : String(error)}`,
      'create',
      undefined,
      error instanceof Error ? error : undefined
    );
    this.emit('container:error', opError);

    return { success: false, error: opError.message };
  }
}
```

#### startContainer Method
```typescript
async startContainer(containerId: string, runtimeType?: ContainerRuntimeType): Promise<ContainerOperationResult> {
  try {
    // ... existing start logic ...

    const containerInfo = await this.getContainerInfo(containerId, runtime);

    // Emit container:started event
    const eventData: ContainerStartedEventData = {
      containerId,
      containerName: containerInfo?.name || containerId,
      image: containerInfo?.image || 'unknown',
      taskId: this.extractTaskIdFromLabels(containerId),  // Helper method
      timestamp: new Date(),
      // pid and ports would require additional inspection
    };
    this.emit('container:started', eventData);

    return { success: true, containerId, containerInfo, command, output: stdout };
  } catch (error) {
    const opError = new ContainerOperationError(
      `Container start failed: ${error instanceof Error ? error.message : String(error)}`,
      'start',
      containerId,
      error instanceof Error ? error : undefined
    );
    this.emit('container:error', opError);

    return { success: false, error: opError.message };
  }
}
```

#### stopContainer Method
```typescript
async stopContainer(
  containerId: string,
  runtimeType?: ContainerRuntimeType,
  timeout: number = 10
): Promise<ContainerOperationResult> {
  const startTime = Date.now();

  try {
    // Get container info before stopping for event data
    const containerInfo = await this.getContainerInfo(containerId, runtime);

    // ... existing stop logic ...

    // Emit container:stopped event
    const eventData: ContainerStoppedEventData = {
      containerId,
      containerName: containerInfo?.name || containerId,
      image: containerInfo?.image || 'unknown',
      taskId: this.extractTaskIdFromLabels(containerId),
      timestamp: new Date(),
      exitCode: containerInfo?.exitCode ?? 0,
      runDuration: Date.now() - (containerInfo?.startedAt?.getTime() ?? startTime),
      graceful: true,
    };
    this.emit('container:stopped', eventData);

    return { success: true, containerId, command, output: stdout };
  } catch (error) {
    const opError = new ContainerOperationError(
      `Container stop failed: ${error instanceof Error ? error.message : String(error)}`,
      'stop',
      containerId,
      error instanceof Error ? error : undefined
    );
    this.emit('container:error', opError);

    return { success: false, error: opError.message };
  }
}
```

#### removeContainer Method
```typescript
async removeContainer(
  containerId: string,
  runtimeType?: ContainerRuntimeType,
  force: boolean = false
): Promise<ContainerOperationResult> {
  try {
    // Get container info before removal for event data
    const containerInfo = await this.getContainerInfo(containerId, runtime);

    // ... existing remove logic ...

    // Emit container:removed event
    const eventData: ContainerRemovedEventData = {
      containerId,
      containerName: containerInfo?.name || containerId,
      image: containerInfo?.image || 'unknown',
      taskId: this.extractTaskIdFromLabels(containerId),
      timestamp: new Date(),
      forced: force,
      exitCode: containerInfo?.exitCode,
    };
    this.emit('container:removed', eventData);

    return { success: true, containerId, command, output: stdout };
  } catch (error) {
    const opError = new ContainerOperationError(
      `Container removal failed: ${error instanceof Error ? error.message : String(error)}`,
      'remove',
      containerId,
      error instanceof Error ? error : undefined
    );
    this.emit('container:error', opError);

    return { success: false, error: opError.message };
  }
}
```

### 5. Define ContainerLogStreamEvents Interface

Refactor `ContainerLogStream` to use eventemitter3:

```typescript
/**
 * Typed event interface for ContainerLogStream
 */
export interface ContainerLogStreamEvents {
  'data': (entry: ContainerLogEntry) => void;
  'error': (error: Error) => void;
  'exit': (code: number | null) => void;
  'end': () => void;
}

/**
 * Container log stream implementation
 * EventEmitter that streams logs from a container with async iterator support
 */
export class ContainerLogStream extends EventEmitter<ContainerLogStreamEvents> {
  private process?: ChildProcess;
  private containerId: string;
  private options: ContainerLogStreamOptions;
  private runtime: ContainerRuntimeType;
  private isStreaming: boolean = false;
  private ended: boolean = false;

  constructor(containerId: string, options: ContainerLogStreamOptions, runtime: ContainerRuntimeType) {
    super();  // EventEmitter3 constructor
    this.containerId = containerId;
    this.options = options;
    this.runtime = runtime;
    this.startStreaming();
  }

  // ... rest of implementation (unchanged except import)
}
```

### 6. Helper Method for Task ID Extraction

Add to ContainerManager:

```typescript
/**
 * Extract task ID from container labels via inspect
 * @private
 */
private async extractTaskIdFromLabels(containerId: string): Promise<string | undefined> {
  try {
    const runtime = await this.runtime.getBestRuntime();
    if (runtime === 'none') return undefined;

    const command = `${runtime} inspect --format "{{index .Config.Labels \"apex.task.id\"}}" ${containerId}`;
    const { stdout } = await execAsync(command, { timeout: 5000 });
    const taskId = stdout.trim();
    return taskId && taskId !== '<no value>' ? taskId : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Build APEX labels for container
 * @private
 */
private buildApexLabels(containerName: string, taskId?: string): Record<string, string> {
  const labels: Record<string, string> = {
    'apex.managed': 'true',
    'apex.container.name': containerName,
  };
  if (taskId) {
    labels['apex.task.id'] = taskId;
  }
  return labels;
}
```

## File Changes Required

### packages/core/package.json
Add eventemitter3 dependency:
```diff
{
  "dependencies": {
+   "eventemitter3": "^5.0.1",
    "yaml": "^2.3.4",
    "zod": "^3.22.4"
  }
}
```

### packages/core/src/container-manager.ts

1. **Import changes**:
```diff
-import { EventEmitter } from 'events';
+import { EventEmitter } from 'eventemitter3';
+import {
+  ContainerCreatedEventData,
+  ContainerStartedEventData,
+  ContainerStoppedEventData,
+  ContainerDiedEventData,
+  ContainerRemovedEventData,
+  ContainerHealthEventData,
+} from './types';
```

2. **Add ContainerOperationError class**

3. **Add ContainerManagerEvents interface**

4. **Add ContainerLogStreamEvents interface**

5. **Change ContainerManager class declaration**:
```diff
-export class ContainerManager {
+export class ContainerManager extends EventEmitter<ContainerManagerEvents> {
```

6. **Add super() call in constructor**

7. **Add event emission in lifecycle methods**

8. **Change ContainerLogStream class declaration**:
```diff
-export class ContainerLogStream extends EventEmitter {
+export class ContainerLogStream extends EventEmitter<ContainerLogStreamEvents> {
```

### packages/core/src/index.ts

Export new types:
```typescript
export {
  ContainerManager,
  ContainerLogStream,
  ContainerOperationError,
  type ContainerManagerEvents,
  type ContainerLogStreamEvents,
  // ... existing exports
} from './container-manager';
```

## Testing Strategy

### Unit Tests for Event Emission

Create/update `packages/core/src/__tests__/container-manager-events.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';
import { ContainerManager, ContainerOperationError } from '../container-manager';
import { ContainerRuntime } from '../container-runtime';
import type { ContainerCreatedEventData, ContainerStartedEventData } from '../types';

vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

vi.mock('../container-runtime');

describe('ContainerManager Events', () => {
  let manager: ContainerManager;
  let mockRuntime: ContainerRuntime;
  const mockExec = vi.mocked(exec);

  beforeEach(() => {
    mockRuntime = new ContainerRuntime();
    vi.mocked(mockRuntime.getBestRuntime).mockResolvedValue('docker');
    manager = new ContainerManager(mockRuntime);
    vi.clearAllMocks();
  });

  describe('container:created event', () => {
    it('should emit container:created with correct data on successful creation', async () => {
      const eventHandler = vi.fn();
      manager.on('container:created', eventHandler);

      mockExec.mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, 'container-abc123\n', '');
        return {} as any;
      });

      await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'task-xyz',
      });

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          containerId: 'container-abc123',
          image: 'node:20-alpine',
          taskId: 'task-xyz',
          timestamp: expect.any(Date),
        })
      );
    });

    it('should emit container:error on creation failure', async () => {
      const errorHandler = vi.fn();
      manager.on('container:error', errorHandler);

      mockExec.mockImplementationOnce((cmd, opts, callback: any) => {
        callback(new Error('Docker daemon not running'), '', 'error');
        return {} as any;
      });

      await manager.createContainer({
        config: { image: 'node:20-alpine' },
        taskId: 'task-xyz',
      });

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: 'create',
          message: expect.stringContaining('Docker daemon not running'),
        })
      );
    });
  });

  describe('container:started event', () => {
    it('should emit container:started with correct data', async () => {
      const eventHandler = vi.fn();
      manager.on('container:started', eventHandler);

      mockExec.mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, 'container-abc123\n', '');
        return {} as any;
      });

      await manager.startContainer('container-abc123');

      expect(eventHandler).toHaveBeenCalledTimes(1);
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          containerId: 'container-abc123',
          timestamp: expect.any(Date),
        })
      );
    });
  });

  describe('container:stopped event', () => {
    it('should emit container:stopped with graceful=true on successful stop', async () => {
      const eventHandler = vi.fn();
      manager.on('container:stopped', eventHandler);

      mockExec.mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, 'container-abc123\n', '');
        return {} as any;
      });

      await manager.stopContainer('container-abc123');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          containerId: 'container-abc123',
          graceful: true,
          timestamp: expect.any(Date),
        })
      );
    });
  });

  describe('container:removed event', () => {
    it('should emit container:removed with forced=false by default', async () => {
      const eventHandler = vi.fn();
      manager.on('container:removed', eventHandler);

      mockExec.mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, 'container-abc123\n', '');
        return {} as any;
      });

      await manager.removeContainer('container-abc123');

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          containerId: 'container-abc123',
          forced: false,
          timestamp: expect.any(Date),
        })
      );
    });

    it('should emit container:removed with forced=true when force option is set', async () => {
      const eventHandler = vi.fn();
      manager.on('container:removed', eventHandler);

      mockExec.mockImplementationOnce((cmd, opts, callback: any) => {
        callback(null, 'container-abc123\n', '');
        return {} as any;
      });

      await manager.removeContainer('container-abc123', undefined, true);

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          forced: true,
        })
      );
    });
  });

  describe('Type Safety', () => {
    it('should enforce typed event handlers', () => {
      // This test validates TypeScript compilation
      manager.on('container:created', (data: ContainerCreatedEventData) => {
        const containerId: string = data.containerId;
        const timestamp: Date = data.timestamp;
        expect(containerId).toBeDefined();
        expect(timestamp).toBeDefined();
      });

      manager.on('container:started', (data: ContainerStartedEventData) => {
        const networkMode = data.networkMode; // Optional property
        expect(networkMode === undefined || typeof networkMode === 'string').toBe(true);
      });
    });

    it('should allow listener removal', () => {
      const handler = vi.fn();
      manager.on('container:created', handler);
      manager.off('container:created', handler);

      // Emit should not call removed handler
      // (This is a feature of eventemitter3)
      expect(manager.listenerCount('container:created')).toBe(0);
    });
  });
});
```

### Type Validation Tests

Add to existing `container-events-type-validation.test.ts`:

```typescript
describe('ContainerManagerEvents type safety', () => {
  it('should only allow valid event names', () => {
    const manager = new ContainerManager();

    // These should compile:
    manager.on('container:created', () => {});
    manager.on('container:started', () => {});
    manager.on('container:stopped', () => {});
    manager.on('container:died', () => {});
    manager.on('container:removed', () => {});
    manager.on('container:health', () => {});
    manager.on('container:error', () => {});

    // TypeScript would prevent:
    // manager.on('invalid:event', () => {});  // Error
    // manager.on('task:created', () => {});   // Error - wrong interface

    expect(true).toBe(true);
  });
});
```

## Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ContainerManager                             │
│                                                                     │
│  createContainer() ──────► emit('container:created', data)          │
│        │                                                            │
│        ▼ (if autoStart)                                            │
│  startContainer() ───────► emit('container:started', data)          │
│        │                                                            │
│        ▼                                                            │
│  [container running]                                                │
│        │                                                            │
│        ▼                                                            │
│  stopContainer() ────────► emit('container:stopped', data)          │
│        │                                                            │
│        ▼                                                            │
│  removeContainer() ──────► emit('container:removed', data)          │
│                                                                     │
│  [on any error] ─────────► emit('container:error', error)           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       ApexOrchestrator                              │
│                                                                     │
│  containerManager.on('container:created', (data) => {               │
│    this.emit('container:created-event', data);                      │
│  });                                                                │
│                                                                     │
│  containerManager.on('container:error', (error) => {                │
│    console.error('Container operation failed:', error);             │
│    // Handle error, maybe emit task:failed                          │
│  });                                                                │
└─────────────────────────────────────────────────────────────────────┘
```

## Migration Checklist

- [ ] Add `eventemitter3@^5.0.1` to `packages/core/package.json`
- [ ] Run `npm install` to update dependencies
- [ ] Update import in `container-manager.ts` from `'events'` to `'eventemitter3'`
- [ ] Add `ContainerOperationError` class
- [ ] Add `ContainerManagerEvents` interface
- [ ] Add `ContainerLogStreamEvents` interface
- [ ] Change `ContainerManager` to extend `EventEmitter<ContainerManagerEvents>`
- [ ] Add `super()` call in `ContainerManager` constructor
- [ ] Add event emission in `createContainer()` method
- [ ] Add event emission in `startContainer()` method
- [ ] Add event emission in `stopContainer()` method
- [ ] Add event emission in `removeContainer()` method
- [ ] Add error event emission in catch blocks
- [ ] Change `ContainerLogStream` to extend `EventEmitter<ContainerLogStreamEvents>`
- [ ] Export new types from `packages/core/src/index.ts`
- [ ] Create `container-manager-events.test.ts` test file
- [ ] Run `npm run build` - verify no errors
- [ ] Run `npm run test` - verify all tests pass
- [ ] Update ADR-063 to reference this ADR

## Consequences

### Positive
- **Type Safety**: Full TypeScript support for event names and payloads
- **Consistency**: Matches established patterns in orchestrator package
- **IDE Support**: Autocomplete for event names and payload properties
- **Observability**: Container lifecycle events can be monitored by orchestrator
- **Testing**: Events can be verified in unit tests
- **Integration**: Easy wiring with ApexOrchestrator events

### Negative
- **Dependency**: Adds eventemitter3 to @apexcli/core (minimal impact, ~6KB)
- **Breaking Change**: ContainerManager now extends EventEmitter (consumers may need updates if they're extending it)

### Neutral
- **Performance**: EventEmitter3 is actually faster than Node's built-in EventEmitter
- **ContainerLogStream**: Already had EventEmitter; just changing implementation

## References

- [eventemitter3 npm package](https://www.npmjs.com/package/eventemitter3)
- [ADR-063: ContainerManager Core Class Architecture](./ADR-063-container-manager-architecture.md)
- [ApexOrchestrator OrchestratorEvents pattern](../packages/orchestrator/src/index.ts)
- [Container event data types](../packages/core/src/types.ts#L820-L965)
