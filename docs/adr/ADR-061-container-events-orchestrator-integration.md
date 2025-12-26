# ADR-061: Container Events Orchestrator Integration

## Status

Accepted

## Context

APEX has a comprehensive container management system with the following components:

1. **ContainerManager** (`@apex/core`) - Manages container lifecycle (create, start, stop, remove) and emits typed events via eventemitter3
2. **ContainerHealthMonitor** (`@apex/core`) - Monitors container health status and emits health change events
3. **WorkspaceManager** (`@apex/orchestrator`) - Uses ContainerManager and ContainerHealthMonitor for container-based workspaces
4. **ApexOrchestrator** (`@apex/orchestrator`) - Central orchestration component that coordinates task execution

Currently, container events are emitted at the lower levels (ContainerManager, ContainerHealthMonitor) but are not propagated to the ApexOrchestrator, making them unavailable to external consumers like the CLI and API.

### Current Event Flow Gap

```
ContainerManager ──► (events emitted but not forwarded)
       │
       ▼
ContainerHealthMonitor ──► (events emitted but not forwarded)
       │
       ▼
WorkspaceManager ──► (has references but doesn't forward events)
       │
       ▼
ApexOrchestrator ──► (does NOT receive container events)
       │
       ▼
CLI / API / WebSocket (cannot receive container events)
```

### Acceptance Criteria

1. ApexOrchestrator forwards container events from ContainerManager
2. Container events available via `orchestrator.on('container:*')`
3. Events include taskId association when available
4. WorkspaceManager container strategy emits events

## Decision

### 1. Architecture Overview

We will implement a **Bridge Pattern** where WorkspaceManager acts as the bridge between lower-level container components and the ApexOrchestrator. This maintains separation of concerns while enabling event propagation.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CONTAINER EVENT FLOW (PROPOSED)                  │
└─────────────────────────────────────────────────────────────────────┘

LAYER 1: Container Runtime (Docker/Podman)
                    │
                    ▼
LAYER 2: ContainerManager (@apex/core)
         ┌────────────────────────────────────────┐
         │ Events:                                │
         │  - container:created                   │
         │  - container:started                   │
         │  - container:stopped                   │
         │  - container:died                      │
         │  - container:removed                   │
         │  - container:lifecycle                 │
         └────────────────────────────────────────┘
                    │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
LAYER 3A: ContainerHealthMonitor    LAYER 3B: WorkspaceManager
         ┌──────────────────┐       ┌──────────────────────────┐
         │ Events:          │       │ NEW: Forward events from │
         │ - container:health│      │ ContainerManager and     │
         │ - monitoring:*   │       │ ContainerHealthMonitor   │
         │ - health:check:* │       │                          │
         └──────────────────┘       │ Events:                  │
                    │               │ - container:created      │
                    └──────────────►│ - container:started      │
                                    │ - container:stopped      │
                                    │ - container:died         │
                                    │ - container:removed      │
                                    │ - container:health       │
                                    │ - workspace-created      │
                                    │ - workspace-cleaned      │
                                    └──────────────────────────┘
                                               │
                                               ▼
LAYER 4: ApexOrchestrator
         ┌────────────────────────────────────────┐
         │ NEW: Listen to WorkspaceManager events │
         │ Forward as OrchestratorEvents:         │
         │  - container:created                   │
         │  - container:started                   │
         │  - container:stopped                   │
         │  - container:died                      │
         │  - container:removed                   │
         │  - container:health                    │
         └────────────────────────────────────────┘
                    │
                    ▼
LAYER 5: External Consumers
         ┌────────────────────────────────────────┐
         │ CLI / API / WebSocket                  │
         │ orchestrator.on('container:*', ...)    │
         └────────────────────────────────────────┘
```

### 2. Interface Changes

#### 2.1 WorkspaceManagerEvents (Extended)

```typescript
// packages/orchestrator/src/workspace-manager.ts

export interface WorkspaceManagerEvents {
  // Existing events
  'workspace-created': (taskId: string, workspacePath: string) => void;
  'workspace-cleaned': (taskId: string) => void;

  // NEW: Forwarded container events
  'container:created': (event: ContainerCreatedEventData) => void;
  'container:started': (event: ContainerStartedEventData) => void;
  'container:stopped': (event: ContainerStoppedEventData) => void;
  'container:died': (event: ContainerDiedEventData) => void;
  'container:removed': (event: ContainerRemovedEventData) => void;
  'container:health': (event: ContainerHealthEventData) => void;
}
```

#### 2.2 OrchestratorEvents (Extended)

```typescript
// packages/orchestrator/src/index.ts

export interface OrchestratorEvents {
  // ... existing events ...

  // NEW: Container lifecycle events
  'container:created': (event: ContainerCreatedEventData) => void;
  'container:started': (event: ContainerStartedEventData) => void;
  'container:stopped': (event: ContainerStoppedEventData) => void;
  'container:died': (event: ContainerDiedEventData) => void;
  'container:removed': (event: ContainerRemovedEventData) => void;
  'container:health': (event: ContainerHealthEventData) => void;
}
```

### 3. Implementation Details

#### 3.1 WorkspaceManager Event Forwarding

WorkspaceManager will set up event listeners on ContainerManager and ContainerHealthMonitor during initialization:

```typescript
// packages/orchestrator/src/workspace-manager.ts

private setupContainerEventForwarding(): void {
  // Forward ContainerManager events
  this.containerManager.on('container:created', (event) => {
    this.emit('container:created', this.transformContainerEvent(event, 'created'));
  });

  this.containerManager.on('container:started', (event) => {
    this.emit('container:started', this.transformContainerEvent(event, 'started'));
  });

  this.containerManager.on('container:stopped', (event) => {
    this.emit('container:stopped', this.transformContainerEvent(event, 'stopped'));
  });

  this.containerManager.on('container:died', (event) => {
    this.emit('container:died', this.transformContainerDiedEvent(event));
  });

  this.containerManager.on('container:removed', (event) => {
    this.emit('container:removed', this.transformContainerEvent(event, 'removed'));
  });

  // Forward ContainerHealthMonitor events
  this.healthMonitor.on('container:health', (event) => {
    this.emit('container:health', event);
  });
}

private transformContainerEvent(
  event: ContainerOperationEvent,
  type: string
): ContainerEventDataBase & Record<string, unknown> {
  return {
    containerId: event.containerId,
    containerName: event.containerInfo?.name || '',
    image: event.containerInfo?.image || '',
    taskId: event.taskId,
    timestamp: event.timestamp,
    success: event.success,
    error: event.error,
  };
}

private transformContainerDiedEvent(
  event: ContainerEvent & { exitCode: number; signal?: string; oomKilled?: boolean }
): ContainerDiedEventData {
  return {
    containerId: event.containerId,
    containerName: event.containerInfo?.name || '',
    image: event.containerInfo?.image || '',
    taskId: event.taskId,
    timestamp: event.timestamp,
    exitCode: event.exitCode,
    signal: event.signal,
    oomKilled: event.oomKilled || false,
  };
}
```

#### 3.2 ApexOrchestrator Event Subscription

ApexOrchestrator will subscribe to WorkspaceManager container events during initialization:

```typescript
// packages/orchestrator/src/index.ts

private workspaceManager?: WorkspaceManager;

async initialize(): Promise<void> {
  // ... existing initialization ...

  // Initialize workspace manager for container workspaces
  if (this.effectiveConfig.workspace?.strategy === 'container') {
    this.workspaceManager = new WorkspaceManager({
      projectPath: this.projectPath,
      defaultStrategy: this.effectiveConfig.workspace.strategy,
    });
    await this.workspaceManager.initialize();

    // Set up container event forwarding
    this.setupContainerEventForwarding();
  }
}

private setupContainerEventForwarding(): void {
  if (!this.workspaceManager) return;

  const containerEvents = [
    'container:created',
    'container:started',
    'container:stopped',
    'container:died',
    'container:removed',
    'container:health',
  ] as const;

  for (const eventName of containerEvents) {
    this.workspaceManager.on(eventName, (event) => {
      this.emit(eventName, event);
    });
  }
}
```

### 4. Event Data Types

All event data types are already defined in `@apex/core/types.ts`:

- `ContainerCreatedEventData`
- `ContainerStartedEventData`
- `ContainerStoppedEventData`
- `ContainerDiedEventData`
- `ContainerRemovedEventData`
- `ContainerHealthEventData`

These types extend `ContainerEventDataBase` which includes:
- `containerId`: string
- `containerName`: string
- `image`: string
- `taskId?`: string (optional, included when available)
- `timestamp`: Date

### 5. Task ID Association

Task ID association flows through the system as follows:

1. **Container Creation**: TaskId is passed to `ContainerManager.createContainer()` via `CreateContainerOptions.taskId`
2. **Container Labels**: TaskId is stored in container labels (`apex.task-id`)
3. **Event Emission**: ContainerManager includes taskId in all events where it was provided
4. **Health Monitor**: Extracts taskId from container name pattern (`apex-task-{taskId}`)
5. **Event Forwarding**: WorkspaceManager and ApexOrchestrator preserve taskId in forwarded events

### 6. File Changes Summary

| File | Changes |
|------|---------|
| `packages/orchestrator/src/workspace-manager.ts` | Add container event forwarding, extend WorkspaceManagerEvents |
| `packages/orchestrator/src/index.ts` | Add container event types to OrchestratorEvents, subscribe to WorkspaceManager events |
| `packages/orchestrator/src/__tests__/container-events-integration.test.ts` | New test file for event integration |

## Consequences

### Positive

1. **Unified Event Interface**: All container events accessible through a single orchestrator interface
2. **Task Correlation**: Events include taskId for correlation with task execution
3. **External Consumer Support**: CLI and API can subscribe to container lifecycle events
4. **Separation of Concerns**: Lower-level components remain unchanged; event forwarding is additive
5. **Type Safety**: Full TypeScript support with properly typed event data

### Negative

1. **Event Duplication**: Events are emitted at multiple layers (could be mitigated with event deduplication if needed)
2. **Memory Overhead**: Additional event listeners per workspace manager instance
3. **Initialization Order**: WorkspaceManager must be initialized before container events can be forwarded

### Risks

1. **Performance**: High-frequency container events could impact performance (mitigated by Docker's event batching)
2. **Memory Leaks**: Event listeners must be properly cleaned up when orchestrator is disposed

## Testing Strategy

1. **Unit Tests**: Test event transformation functions in isolation
2. **Integration Tests**: Test full event flow from ContainerManager → WorkspaceManager → ApexOrchestrator
3. **Mock-based Tests**: Use vi.fn() to verify event emission without actual container operations

## Implementation Order

1. Extend `WorkspaceManagerEvents` interface
2. Implement `setupContainerEventForwarding()` in WorkspaceManager
3. Add event transformation methods
4. Extend `OrchestratorEvents` interface
5. Implement orchestrator event subscription
6. Add integration tests
7. Verify build and test pass

## References

- ContainerManager: `packages/core/src/container-manager.ts`
- ContainerHealthMonitor: `packages/core/src/container-health-monitor.ts`
- WorkspaceManager: `packages/orchestrator/src/workspace-manager.ts`
- ApexOrchestrator: `packages/orchestrator/src/index.ts`
- Container Event Types: `packages/core/src/types.ts` (lines 834-971)
