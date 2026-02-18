# ADR: MCP Connection Manager Events - Orchestrator Integration

## Status
Proposed

## Context

The `MCPConnectionManager` class in `packages/orchestrator/src/mcp/connection-manager.ts` emits several connection lifecycle events that are not currently propagated through the `ApexOrchestrator` event system. This means consumers of orchestrator events (CLI, API, UI components) cannot observe MCP connection state changes.

### Current MCPConnectionManager Events

The `MCPConnectionManager` extends `EventEmitter<MCPConnectionManagerEvents>` and emits:

1. **`connected`** - When a server is successfully connected
   - Payload: `MCPConnection` (serverId, serverName, config, state, etc.)

2. **`disconnected`** - When a server is disconnected
   - Payload: `(serverId: string, reason?: string)`

3. **`error`** - When a connection error occurs
   - Payload: `(serverId: string, error: Error)`

4. **`reconnecting`** - When attempting to reconnect
   - Payload: `(serverId: string, attempt: number, maxAttempts: number)`

5. **`healthCheck`** - When a health check is performed
   - Payload: `(serverId: string, result: HealthCheckResult)`

6. **`stateChange`** - When connection state changes
   - Payload: `(serverId: string, previousState: MCPConnectionState, newState: MCPConnectionState)`

7. **`poolChange`** - When connection pool size changes
   - Payload: `(serverId: string, poolSize: number, activeConnections: number)`

### Existing Pattern

The codebase follows an established pattern for event integration, exemplified by `setupBrowserEventIntegration()` (line 8923 of `index.ts`):

1. A private method `setupXxxEventIntegration()` is created
2. The method subscribes to source events and re-emits them through `this.emit()`
3. Events are enriched with task/agent context when available
4. The method is called from `initialize()` after the source manager is created
5. Event types are defined in the `OrchestratorEvents` interface

## Decision

### Event Naming Convention

Following the existing naming pattern (e.g., `browser:console`, `container:created`, `worktree:cleaned`), MCP connection events will use the prefix `mcp:`:

| MCPConnectionManager Event | Orchestrator Event |
|---------------------------|-------------------|
| `connected` | `mcp:connected` |
| `disconnected` | `mcp:disconnected` |
| `error` | `mcp:error` |
| `reconnecting` | `mcp:reconnecting` |
| `healthCheck` | `mcp:health-check` |
| `stateChange` | `mcp:state-change` |
| `poolChange` | `mcp:pool-change` |

### Event Data Structures

Each event will include:
- Original event data from MCPConnectionManager
- Task context when available (`taskId`, `agentName`)
- Timestamp

```typescript
// MCP Connection Events (to be added to OrchestratorEvents interface)
export interface MCPConnectedEventData {
  taskId: string;        // Current task ID or 'unknown'
  agentName: string;     // Current agent name or 'unknown'
  serverId: string;
  serverName: string;
  timestamp: Date;
}

export interface MCPDisconnectedEventData {
  taskId: string;
  agentName: string;
  serverId: string;
  reason?: string;
  timestamp: Date;
}

export interface MCPErrorEventData {
  taskId: string;
  agentName: string;
  serverId: string;
  error: {
    message: string;
    name: string;
    stack?: string;
  };
  timestamp: Date;
}

export interface MCPReconnectingEventData {
  taskId: string;
  agentName: string;
  serverId: string;
  attempt: number;
  maxAttempts: number;
  timestamp: Date;
}

export interface MCPHealthCheckEventData {
  taskId: string;
  agentName: string;
  serverId: string;
  result: {
    success: boolean;
    latencyMs?: number;
    consecutiveFailures: number;
    isHealthy: boolean;
    error?: string;
  };
  timestamp: Date;
}

export interface MCPStateChangeEventData {
  taskId: string;
  agentName: string;
  serverId: string;
  previousState: MCPConnectionState;
  newState: MCPConnectionState;
  timestamp: Date;
}

export interface MCPPoolChangeEventData {
  taskId: string;
  agentName: string;
  serverId: string;
  poolSize: number;
  activeConnections: number;
  timestamp: Date;
}
```

### Implementation Approach

1. **Add event types to `OrchestratorEvents` interface** in `packages/orchestrator/src/index.ts`

2. **Add event data interfaces** for each MCP event

3. **Create `setupMCPConnectionEventHandlers()` method** following the pattern of `setupBrowserEventIntegration()`:
   ```typescript
   private setupMCPConnectionEventHandlers(): void {
     if (!this.mcpConnectionManager) return;

     this.mcpConnectionManager.on('connected', (connection) => {
       const event: MCPConnectedEventData = {
         taskId: this.currentTaskId || 'unknown',
         agentName: this.currentAgentName || 'unknown',
         serverId: connection.serverId,
         serverName: connection.serverName,
         timestamp: new Date(),
       };
       this.emit('mcp:connected', event);
     });

     // ... similar handlers for other events
   }
   ```

4. **Call `setupMCPConnectionEventHandlers()` from `initialize()`** after `mcpConnectionManager` is created (line ~1180)

### File Changes Required

1. **`packages/orchestrator/src/index.ts`**:
   - Add 7 new event types to `OrchestratorEvents` interface (around line 375)
   - Add 7 new event data interfaces (after existing event interfaces)
   - Add `setupMCPConnectionEventHandlers()` private method
   - Call `setupMCPConnectionEventHandlers()` in `initialize()` after line 1180

2. **Re-export types** if needed in `packages/orchestrator/src/index.ts` exports

### Event Usage Examples

```typescript
// CLI consumer
orchestrator.on('mcp:connected', (event) => {
  console.log(`MCP server ${event.serverName} connected`);
});

orchestrator.on('mcp:reconnecting', (event) => {
  console.log(`Reconnecting to ${event.serverId}: attempt ${event.attempt}/${event.maxAttempts}`);
});

orchestrator.on('mcp:error', (event) => {
  console.error(`MCP error on ${event.serverId}: ${event.error.message}`);
});
```

## Consequences

### Positive
- Unified event system for all orchestrator subsystems
- CLI/API can display MCP connection status to users
- Consistent event naming with existing patterns (`browser:*`, `container:*`, etc.)
- Task context correlation enables debugging connection issues per-task

### Negative
- Slight increase in event volume during connection state changes
- Additional interface definitions increase type complexity

### Neutral
- No breaking changes to existing code
- Events are opt-in (consumers only subscribe to events they need)

## Implementation Checklist

- [ ] Define event data interfaces in `index.ts`
- [ ] Add event types to `OrchestratorEvents` interface
- [ ] Implement `setupMCPConnectionEventHandlers()` method
- [ ] Call setup method from `initialize()`
- [ ] Export new event data types
- [ ] Add unit tests for event propagation
- [ ] Verify build and existing tests pass
