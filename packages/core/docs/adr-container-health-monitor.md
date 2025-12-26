# ADR: Container Health Monitor Architecture

## Status
Proposed

## Context

APEX needs to monitor container health status to enable proactive failure detection and automatic recovery. Docker and Podman provide built-in health check mechanisms via the `HEALTHCHECK` instruction in Dockerfiles or the `--health-cmd` flag during container creation. Currently, the `ContainerManager` class handles container lifecycle events (created, started, stopped, died) but does not monitor ongoing health status.

### Requirements
1. `ContainerHealthMonitor` class monitors container health status
2. Emits `container:health` events with status (healthy/unhealthy/starting)
3. Supports configurable health check intervals
4. Integrates with `ContainerManager`

### Existing Patterns

The codebase already establishes several relevant patterns:

1. **EventEmitter3 for typed events**: `ContainerManager` extends `TypedEventEmitter<ContainerManagerEvents>` for type-safe event emission
2. **Docker events monitoring**: `ContainerManager` already monitors Docker events via `startEventsMonitoring()`, which spawns a `docker events` process
3. **Health event types**: `ContainerHealthEventData` and `ContainerHealthStatus` are already defined in `types.ts`
4. **Naming conventions**: APEX containers follow `apex-{taskId}` naming convention

## Decision

### Design Option 1: Standalone ContainerHealthMonitor Class (Recommended)

Create a separate `ContainerHealthMonitor` class that:
- Extends `TypedEventEmitter` with health-specific events
- Uses Docker's `docker inspect` command to poll container health status
- Supports configurable polling intervals per container
- Integrates with `ContainerManager` via composition

```typescript
export interface ContainerHealthMonitorOptions {
  /** Default polling interval in milliseconds */
  defaultIntervalMs?: number;
  /** Minimum polling interval (prevents excessive API calls) */
  minIntervalMs?: number;
  /** Maximum polling interval */
  maxIntervalMs?: number;
  /** Container name prefix to filter (default: 'apex') */
  namePrefix?: string;
}

export interface ContainerHealthMonitorEvents {
  'container:health': (event: ContainerHealthEventData) => void;
}

export class ContainerHealthMonitor extends TypedEventEmitter<ContainerHealthMonitorEvents> {
  // Monitor health for specific containers
  startMonitoring(containerId: string, intervalMs?: number): void;
  stopMonitoring(containerId: string): void;

  // Bulk operations
  startMonitoringAll(options?: { intervalMs?: number }): Promise<void>;
  stopAll(): void;

  // Status queries
  isMonitoring(containerId: string): boolean;
  getHealthStatus(containerId: string): ContainerHealthStatus | null;
  getMonitoredContainers(): string[];
}
```

**Rationale for Standalone Class:**
- Single Responsibility: Separates health monitoring from container lifecycle management
- Testability: Easier to mock and test independently
- Flexibility: Can be used without full ContainerManager functionality
- Consistency: Follows existing pattern of separate classes (ContainerManager, ImageBuilder, ContainerRuntime)

### Design Option 2: Extend ContainerManager (Not Recommended)

Add health monitoring methods directly to `ContainerManager`.

**Why Not Chosen:**
- `ContainerManager` already has ~1800 lines; adding health monitoring would increase complexity
- Violates Single Responsibility Principle
- Docker events monitoring for 'die' events is fundamentally different from health polling

## Technical Design

### Class Structure

```
packages/core/src/
├── container-health-monitor.ts    # New file - ContainerHealthMonitor class
├── container-manager.ts           # Existing - container lifecycle management
├── types.ts                       # Existing - contains ContainerHealthEventData
└── index.ts                       # Export new class
```

### Health Status Retrieval

Docker containers report health status via `docker inspect`:

```bash
docker inspect --format='{{json .State.Health}}' <container_id>
```

Returns:
```json
{
  "Status": "healthy|unhealthy|starting|none",
  "FailingStreak": 0,
  "Log": [
    {
      "Start": "2024-01-01T00:00:00.000Z",
      "End": "2024-01-01T00:00:01.000Z",
      "ExitCode": 0,
      "Output": "OK"
    }
  ]
}
```

### Key Implementation Details

1. **Polling Strategy**:
   - Use `setInterval` for each monitored container
   - Store intervals in a `Map<containerId, NodeJS.Timeout>`
   - Track previous health status to emit only on changes

2. **Event Data**: Use existing `ContainerHealthEventData` interface from `types.ts`:
   ```typescript
   interface ContainerHealthEventData extends ContainerEventDataBase {
     status: ContainerHealthStatus;           // 'starting' | 'healthy' | 'unhealthy' | 'none'
     previousStatus?: ContainerHealthStatus;
     failingStreak?: number;
     lastCheckOutput?: string;
     lastCheckExitCode?: number;
     lastCheckTime?: Date;
   }
   ```

3. **Integration with ContainerManager**:
   - `ContainerHealthMonitor` accepts `ContainerRuntime` in constructor
   - Can optionally accept `ContainerManager` for container discovery
   - Shares runtime detection logic

4. **Error Handling**:
   - If container no longer exists, stop monitoring and emit event
   - If Docker API fails, log warning and retry on next interval
   - Graceful shutdown of all intervals on `stopAll()`

### Event Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ContainerHealthMonitor                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  startMonitoring(containerId, intervalMs)                       │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────┐                                            │
│  │   setInterval   │◄───────────────────────┐                   │
│  └─────────────────┘                         │                   │
│         │                                    │                   │
│         ▼                                    │                   │
│  ┌─────────────────┐                         │                   │
│  │ docker inspect  │                         │                   │
│  │ --format health │                         │                   │
│  └─────────────────┘                         │                   │
│         │                                    │                   │
│         ▼                                    │                   │
│  ┌─────────────────┐      No change         │                   │
│  │ Compare status  │──────────────────────▶─┘                   │
│  │ with previous   │                                            │
│  └─────────────────┘                                            │
│         │ Status changed                                        │
│         ▼                                                        │
│  ┌─────────────────┐                                            │
│  │ emit('container │                                            │
│  │   :health')     │──────────────────────▶ Event Listeners    │
│  └─────────────────┘                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Configuration Defaults

| Option | Default | Min | Max |
|--------|---------|-----|-----|
| `defaultIntervalMs` | 30000 (30s) | 1000 | 300000 |
| `minIntervalMs` | 1000 (1s) | - | - |
| `maxIntervalMs` | 300000 (5min) | - | - |
| `namePrefix` | 'apex' | - | - |

### Alternative Approaches Considered

1. **Docker Events Stream for Health**: Docker emits `health_status` events, but these are only triggered when status changes, not periodically. This would miss containers that become unhealthy between checks.

2. **Single Polling Loop**: One interval that checks all containers. Rejected because different containers may need different polling intervals.

3. **Webhooks/Callbacks**: More complex, requires external infrastructure.

## Consequences

### Positive
- Clean separation of concerns
- Reuses existing type definitions
- Consistent event emission pattern with `ContainerManager`
- Configurable per-container intervals
- Easy to test independently

### Negative
- Additional class to maintain
- Polling approach has inherent latency vs. push-based events
- Resource usage scales with number of monitored containers

### Risks
- Docker API rate limiting (mitigated by minimum interval)
- Orphaned intervals if not properly cleaned up (mitigated by Map-based tracking)

## Implementation Plan

1. Create `container-health-monitor.ts` with `ContainerHealthMonitor` class
2. Add `container:health` event to `ContainerManagerEvents` interface
3. Export from `index.ts`
4. Add unit tests for:
   - Start/stop monitoring individual containers
   - Event emission on status change
   - Configurable intervals
   - Bulk operations
   - Error handling
5. Add integration test with mock Docker runtime
6. Update documentation

## References

- Docker health check documentation: https://docs.docker.com/engine/reference/builder/#healthcheck
- Existing `ContainerManager` implementation: `packages/core/src/container-manager.ts`
- Existing event types: `packages/core/src/types.ts`
