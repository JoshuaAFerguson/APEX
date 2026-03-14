# ADR-001: MCP Error Event Broadcasting Architecture

## Status
Proposed

## Date
2025-01-16

## Context

APEX has a robust MCP (Model Context Protocol) connection management system that handles MCP server connections, health checks, reconnection attempts, and errors. The orchestrator emits various MCP-related events including:

- `mcp:connected` - Server connected successfully
- `mcp:disconnected` - Server disconnected
- `mcp:error` - Error occurred with an MCP server
- `mcp:reconnecting` - Reconnection attempt in progress
- `mcp:health-check` - Health check result
- `mcp:state-change` - Connection state changed
- `mcp:pool-change` - Connection pool changed
- `mcp:tool-start/complete/error` - MCP tool execution events

### Current State Analysis

**What Works:**
1. `MCPErrorEventData` interface is properly defined in `packages/orchestrator/src/index.ts` (lines 928-939):
   ```typescript
   export interface MCPErrorEventData {
     serverId: string;
     serverName: string;
     error: string;
     timestamp: Date;
     code?: string;
   }
   ```

2. MCP error events are correctly forwarded from `MCPConnectionManager` to `ApexOrchestrator` (lines 10789-10800):
   ```typescript
   connManager.on('error', (serverId, error) => {
     const connection = connManager.getConnection(serverId);
     const eventData: MCPErrorEventData = {
       serverId,
       serverName: connection?.serverName || serverId,
       error: error.message,
       timestamp: new Date(),
       code: error.name || 'UNKNOWN_ERROR',
     };
     this.emit('mcp:error', eventData);
   });
   ```

3. WebSocket broadcasting infrastructure exists in `packages/api/src/index.ts` with `broadcast()` and `setupEventBroadcasting()` functions.

4. MCP installation/uninstallation events ARE broadcasted:
   - `mcp:install-start`, `mcp:install-complete`, `mcp:install-error`
   - `mcp:uninstall-start`, `mcp:uninstall-complete`, `mcp:uninstall-error`

**Critical Gap:**
MCP connection lifecycle events (including `mcp:error`) are **NOT** being broadcast to WebSocket clients. The `setupEventBroadcasting()` function in `packages/api/src/index.ts` does not have handlers for:
- `mcp:connected`
- `mcp:disconnected`
- `mcp:error` (THE PRIMARY GAP)
- `mcp:reconnecting`
- `mcp:health-check`
- `mcp:state-change`
- `mcp:pool-change`
- `mcp:tool-start/complete/error`

### Additional Issues

1. **Error Serialization**: The current error handling only captures `error.message` and `error.name`. Stack traces and nested error data are not serialized.

2. **Task ID Association**: MCP errors occur at the server level, not task level. The current broadcast model is task-centric (`broadcast(taskId, event)`), but MCP errors need a different routing strategy.

3. **Recovery Information**: The `MCPErrorEventData` interface lacks recovery guidance (e.g., is this retriable? when to retry? what actions to take?).

4. **Error Display**: The CLI's `ErrorDisplay` component doesn't have MCP-specific error suggestions.

## Decision

### 1. Extend MCPErrorEventData Interface

Enhance the `MCPErrorEventData` interface to include recovery information and better error context:

```typescript
export interface MCPErrorEventData {
  /** Server identifier */
  serverId: string;
  /** Server name */
  serverName: string;
  /** Error message */
  error: string;
  /** Error timestamp */
  timestamp: Date;
  /** Error code if available */
  code?: string;

  // New fields for enhanced error handling:
  /** Category of the error for proper handling */
  category: 'connection' | 'protocol' | 'transport' | 'timeout' | 'auth' | 'unknown';
  /** Whether this error is recoverable */
  recoverable: boolean;
  /** Recovery information */
  recovery?: {
    /** Can attempt automatic retry */
    canRetry: boolean;
    /** Suggested retry delay in ms */
    retryDelayMs?: number;
    /** Current retry attempt (if reconnecting) */
    attempt?: number;
    /** Max retry attempts configured */
    maxAttempts?: number;
    /** User-actionable suggestions */
    suggestions?: string[];
  };
  /** Serialized stack trace (if available) */
  stack?: string;
  /** Additional error metadata */
  metadata?: Record<string, unknown>;
}
```

### 2. Add MCP Error Serialization Utility

Create a dedicated serialization function in `packages/core/src/utils.ts`:

```typescript
/**
 * Serializes an error for WebSocket transmission
 * Handles Error objects, stack traces, circular references, and sensitive data
 */
export function serializeMCPError(error: unknown, options?: {
  includeStack?: boolean;
  sanitize?: boolean;
}): SerializedError {
  const { includeStack = true, sanitize = true } = options ?? {};

  if (error instanceof Error) {
    return {
      message: sanitize ? sanitizeErrorMessage(error.message) : error.message,
      name: error.name,
      code: (error as any).code,
      stack: includeStack ? sanitizeStackTrace(error.stack) : undefined,
      cause: error.cause ? serializeMCPError(error.cause, options) : undefined,
    };
  }

  return {
    message: String(error),
    name: 'Error',
  };
}

export interface SerializedError {
  message: string;
  name: string;
  code?: string;
  stack?: string;
  cause?: SerializedError;
}
```

### 3. Implement MCP Event Broadcasting in API

Add MCP event handlers to `setupEventBroadcasting()` in `packages/api/src/index.ts`:

```typescript
// MCP Connection events - broadcast to global 'mcp-events' channel
const MCP_EVENTS_CHANNEL = 'mcp-events';

orchestrator.on('mcp:error', (eventData: MCPErrorEventData) => {
  // Broadcast to global MCP events channel
  broadcast(MCP_EVENTS_CHANNEL, {
    type: 'mcp:error',
    taskId: MCP_EVENTS_CHANNEL,
    timestamp: eventData.timestamp,
    data: {
      serverId: eventData.serverId,
      serverName: eventData.serverName,
      error: eventData.error,
      code: eventData.code,
      category: eventData.category,
      recoverable: eventData.recoverable,
      recovery: eventData.recovery,
      stack: eventData.stack,
    },
  });
});

orchestrator.on('mcp:connected', (eventData: MCPConnectionEventData) => {
  broadcast(MCP_EVENTS_CHANNEL, {
    type: 'mcp:connected',
    taskId: MCP_EVENTS_CHANNEL,
    timestamp: eventData.timestamp,
    data: { ...eventData },
  });
});

orchestrator.on('mcp:disconnected', (eventData: MCPDisconnectionEventData) => {
  broadcast(MCP_EVENTS_CHANNEL, {
    type: 'mcp:disconnected',
    taskId: MCP_EVENTS_CHANNEL,
    timestamp: eventData.timestamp,
    data: { ...eventData },
  });
});

orchestrator.on('mcp:reconnecting', (eventData: MCPReconnectingEventData) => {
  broadcast(MCP_EVENTS_CHANNEL, {
    type: 'mcp:reconnecting',
    taskId: MCP_EVENTS_CHANNEL,
    timestamp: eventData.timestamp,
    data: { ...eventData },
  });
});

orchestrator.on('mcp:health-check', (eventData: MCPHealthCheckEventData) => {
  // Only broadcast significant health changes (failures or recovery)
  if (!eventData.isHealthy || eventData.consecutiveFailures > 0) {
    broadcast(MCP_EVENTS_CHANNEL, {
      type: 'mcp:health-check',
      taskId: MCP_EVENTS_CHANNEL,
      timestamp: eventData.timestamp,
      data: { ...eventData },
    });
  }
});

orchestrator.on('mcp:state-change', (eventData: MCPStateChangeEventData) => {
  broadcast(MCP_EVENTS_CHANNEL, {
    type: 'mcp:state-change',
    taskId: MCP_EVENTS_CHANNEL,
    timestamp: eventData.timestamp,
    data: { ...eventData },
  });
});
```

### 4. Update Error Event Creation in Orchestrator

Enhance the error event creation in `packages/orchestrator/src/index.ts`:

```typescript
connManager.on('error', (serverId, error) => {
  const connection = connManager.getConnection(serverId);
  const serialized = serializeMCPError(error);

  const eventData: MCPErrorEventData = {
    serverId,
    serverName: connection?.serverName || serverId,
    error: serialized.message,
    timestamp: new Date(),
    code: serialized.code || error.name || 'UNKNOWN_ERROR',
    category: categorizeError(error),
    recoverable: isRecoverableError(error),
    recovery: {
      canRetry: isRecoverableError(error),
      retryDelayMs: calculateRetryDelay(error),
      suggestions: getErrorSuggestions(error),
    },
    stack: serialized.stack,
    metadata: extractErrorMetadata(error),
  };

  this.emit('mcp:error', eventData);
});
```

### 5. Add MCP Error Suggestions to ErrorDisplay Component

Extend the CLI `ErrorDisplay` component with MCP-specific suggestions:

```typescript
// In packages/cli/src/ui/components/ErrorDisplay.tsx

const generateMCPSuggestions = (error: string, context?: Record<string, unknown>): ErrorSuggestion[] => {
  const suggestions: ErrorSuggestion[] = [];

  if (error.toLowerCase().includes('connection') || error.toLowerCase().includes('transport')) {
    suggestions.push({
      title: 'MCP Connection Issue',
      description: 'Check if the MCP server is running and accessible',
      command: 'apex mcp list',
      priority: 'high',
    });
  }

  if (error.toLowerCase().includes('timeout')) {
    suggestions.push({
      title: 'MCP Timeout',
      description: 'The MCP server is not responding. Try restarting it.',
      command: 'apex mcp restart <server-name>',
      priority: 'high',
    });
  }

  if (error.toLowerCase().includes('protocol') || error.toLowerCase().includes('version')) {
    suggestions.push({
      title: 'Protocol Mismatch',
      description: 'The MCP server protocol version may be incompatible',
      action: 'update',
      priority: 'high',
    });
  }

  if (error.toLowerCase().includes('auth') || error.toLowerCase().includes('permission')) {
    suggestions.push({
      title: 'Authorization Issue',
      description: 'Check MCP server credentials and permissions',
      priority: 'high',
    });
  }

  return suggestions;
};
```

### 6. Integration Test Strategy

Create integration tests in `packages/api/src/__tests__/mcp-error-event-broadcasting.test.ts`:

```typescript
describe('MCP Error Event Broadcasting', () => {
  describe('Error Event Structure', () => {
    it('broadcasts mcp:error events to WebSocket clients');
    it('includes all required fields in error events');
    it('properly serializes Error objects');
    it('sanitizes sensitive data in error messages');
    it('includes stack traces when available');
  });

  describe('Error Recovery Information', () => {
    it('provides recovery.canRetry for recoverable errors');
    it('calculates appropriate retry delays');
    it('includes retry attempt information during reconnection');
    it('generates actionable suggestions');
  });

  describe('Event Routing', () => {
    it('broadcasts to mcp-events channel for server-level errors');
    it('allows clients to subscribe to MCP events');
    it('supports event filtering for MCP events');
  });

  describe('Error Categories', () => {
    it('categorizes connection errors correctly');
    it('categorizes protocol errors correctly');
    it('categorizes timeout errors correctly');
    it('categorizes transport errors correctly');
  });
});
```

## Consequences

### Positive

1. **Complete Error Visibility**: WebSocket clients will receive MCP error events, enabling real-time error display in UIs.

2. **Actionable Recovery**: Enhanced error data includes recovery information, helping users understand how to resolve issues.

3. **Better Debugging**: Stack traces and error metadata improve debugging capabilities.

4. **Consistent Architecture**: MCP events follow the same broadcasting pattern as other orchestrator events.

5. **Type Safety**: Extended interfaces provide better TypeScript support.

### Negative

1. **Breaking Change**: The extended `MCPErrorEventData` interface may require updates to existing consumers.

2. **Increased Payload Size**: Additional error fields increase WebSocket message size.

3. **New Channel Concept**: The `mcp-events` channel introduces a new routing paradigm separate from task-based routing.

### Mitigation

1. Make new fields optional for backward compatibility.
2. Only include stack traces in non-production or when explicitly requested.
3. Document the `mcp-events` channel in API documentation.

## Implementation Plan

### Phase 1: Core Error Serialization
- [ ] Add `serializeMCPError()` utility to `packages/core/src/utils.ts`
- [ ] Add error categorization helpers
- [ ] Update `MCPErrorEventData` interface (backward compatible)

### Phase 2: Orchestrator Integration
- [ ] Update error event creation in orchestrator
- [ ] Add recovery information calculation
- [ ] Add error suggestion generation

### Phase 3: API Broadcasting
- [ ] Add MCP event handlers to `setupEventBroadcasting()`
- [ ] Implement `mcp-events` channel routing
- [ ] Update WebSocket documentation

### Phase 4: CLI Integration
- [ ] Add MCP-specific suggestions to `ErrorDisplay`
- [ ] Create MCP error display component if needed

### Phase 5: Testing
- [ ] Add integration tests for error broadcasting
- [ ] Add unit tests for error serialization
- [ ] Add E2E tests for error display

## Files to Modify

1. `packages/orchestrator/src/index.ts` - Extend MCPErrorEventData, update error event creation
2. `packages/core/src/utils.ts` - Add serializeMCPError utility
3. `packages/api/src/index.ts` - Add MCP event handlers to setupEventBroadcasting
4. `packages/cli/src/ui/components/ErrorDisplay.tsx` - Add MCP error suggestions
5. `packages/api/src/__tests__/mcp-error-event-broadcasting.test.ts` - New test file

## References

- [ADR-0015: Exponential Backoff Reconnector](./ADR-0015-exponential-backoff-reconnector.md)
- [ADR-0016: WebSocket Client Health Check](./ADR-0016-websocket-client-health-check-mechanism.md)
- MCP WebSocket Events Test: `packages/api/src/__tests__/mcp-websocket-events.test.ts`
