# ADR-0016: WebSocket Client Health Check Mechanism

## Status
Proposed

## Date
2025-01-15

## Context

The `ApexWebSocketClient` in `packages/web-ui/src/lib/websocket-client.ts` currently:
- Manages WebSocket connections to the APEX API server
- Uses `ExponentialBackoffReconnector` from `@apexcli/core` for reconnection logic
- Provides `isConnected()` method that checks `WebSocket.readyState === OPEN`
- Has no active health monitoring - only detects disconnection when a send fails or WebSocket events fire

### Current Limitations

1. **Passive Connection Detection**: The `isConnected()` method only checks the WebSocket's `readyState` property, which may not reflect the true health of the connection (e.g., half-open connections, server-side issues)

2. **No Heartbeat**: There's no periodic mechanism to verify the connection is truly alive and responsive

3. **Silent Failures**: Network issues that don't immediately close the WebSocket (e.g., network timeouts, load balancer disconnections) may go undetected for extended periods

4. **React Hook Polling**: The `useTaskStream` and `useTaskList` hooks use a 1-second interval to poll `isConnected()`, which is inefficient and doesn't detect true connection health

### Reference Implementation

The `MCPConnectionManager` in `packages/orchestrator/src/mcp/connection-manager.ts` already implements a comprehensive health check system with:
- Configurable ping/pong heartbeat (`heartbeatEnabled`, `heartbeatIntervalMs`)
- Health check intervals (`healthCheckIntervalMs`, `healthCheckTimeoutMs`)
- Failure thresholds (`healthCheckFailureThreshold`)
- Automatic reconnection on health failure
- Health state tracking (`HealthState` interface)
- Health events (`healthCheck` event emission)

## Decision

Implement a health check mechanism for `ApexWebSocketClient` that provides:

### 1. Configuration Interface

```typescript
export interface WebSocketHealthConfig {
  /** Enable/disable health checks (default: true) */
  healthCheckEnabled: boolean;

  /** Interval between health checks in milliseconds (default: 30000) */
  healthCheckIntervalMs: number;

  /** Timeout for health check response in milliseconds (default: 5000) */
  healthCheckTimeoutMs: number;

  /** Number of consecutive failures before marking unhealthy (default: 3) */
  healthCheckFailureThreshold: number;

  /** Whether to use ping/pong frames or custom heartbeat messages (default: 'message') */
  healthCheckMethod: 'ping' | 'message';
}
```

### 2. Health State Interface

```typescript
export interface WebSocketHealthState {
  /** Whether the connection is currently healthy */
  isHealthy: boolean;

  /** Last successful health check timestamp */
  lastHealthyAt?: Date;

  /** Last health check timestamp (regardless of result) */
  lastCheckAt?: Date;

  /** Number of consecutive health check failures */
  consecutiveFailures: number;

  /** Average round-trip time in milliseconds */
  averageLatencyMs: number;

  /** Last ping sent timestamp */
  lastPingAt?: Date;

  /** Last pong received timestamp */
  lastPongAt?: Date;
}
```

### 3. Health Events

```typescript
export type HealthEventType =
  | 'health:check'      // Health check performed
  | 'health:healthy'    // Connection became healthy
  | 'health:unhealthy'  // Connection became unhealthy
  | 'health:recovered'; // Connection recovered from unhealthy state

export interface HealthCheckEvent {
  type: HealthEventType;
  timestamp: Date;
  isHealthy: boolean;
  latencyMs?: number;
  consecutiveFailures: number;
  error?: string;
}
```

### 4. Enhanced ApexWebSocketClient API

```typescript
export class ApexWebSocketClient {
  // Existing methods
  connect(): void;
  disconnect(): void;
  isConnected(): boolean;
  on(eventType: string, handler: WebSocketEventHandler): void;
  off(eventType: string, handler: WebSocketEventHandler): void;
  onState(handler: StateEventHandler): void;
  offState(handler: StateEventHandler): void;

  // NEW: Health check methods
  isHealthy(): boolean;
  getHealthState(): WebSocketHealthState;
  onHealth(handler: (event: HealthCheckEvent) => void): void;
  offHealth(handler: (event: HealthCheckEvent) => void): void;

  // NEW: Manual health check trigger
  checkHealth(): Promise<HealthCheckEvent>;
}
```

### 5. Health Check Implementation Strategy

#### Option A: WebSocket Ping/Pong Frames (Preferred for browser support)
- Use native WebSocket ping/pong if available (Node.js `ws` library)
- In browsers, native ping/pong is not exposed to JavaScript
- Browsers handle ping/pong at the protocol level, not accessible via API

#### Option B: Custom Heartbeat Messages (Selected)
- Send a custom JSON message: `{ type: 'ping', timestamp: Date.now() }`
- Server responds with: `{ type: 'pong', timestamp: <original>, serverTimestamp: Date.now() }`
- Calculate round-trip latency from timestamps
- Works in all environments (browser and Node.js)

**Decision**: Use **Option B (Custom Heartbeat Messages)** as the primary method because:
1. Browser WebSocket API doesn't expose native ping/pong
2. Allows measurement of application-level latency
3. Server can include additional health metadata in pong response
4. Consistent behavior across all JavaScript environments

### 6. Server-Side Support

The API server (`packages/api/src/index.ts`) needs to handle heartbeat messages:

```typescript
// In WebSocket message handler
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'ping') {
    // Respond with pong immediately
    ws.send(JSON.stringify({
      type: 'pong',
      timestamp: data.timestamp,
      serverTimestamp: Date.now()
    }));
    return;
  }

  // ... existing message handling
};
```

### 7. Health Check Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                    HEALTH CHECK LIFECYCLE                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   ┌─────────┐  healthCheckIntervalMs  ┌─────────────┐             │
│   │  IDLE   │ ──────────────────────► │ SEND PING   │             │
│   └─────────┘                         └──────┬──────┘             │
│        ▲                                     │                    │
│        │                                     ▼                    │
│        │                              ┌─────────────┐             │
│        │                              │ WAIT PONG   │             │
│        │                              └──────┬──────┘             │
│        │                                     │                    │
│        │              ┌──────────────────────┴───────────────┐    │
│        │              │                                      │    │
│        │              ▼                                      ▼    │
│   ┌─────────┐   ┌─────────────┐                      ┌──────────┐ │
│   │ SUCCESS │◄──│ PONG RECV   │                      │ TIMEOUT  │ │
│   └────┬────┘   └─────────────┘                      └────┬─────┘ │
│        │                                                  │       │
│        │    consecutiveFailures = 0                       │       │
│        │    isHealthy = true                              │       │
│        │    emit 'health:check'                           │       │
│        │                                                  │       │
│        │                                  consecutiveFailures++   │
│        │                                                  │       │
│        │                                  ┌───────────────┴─┐     │
│        │                                  │                 │     │
│        │                                  ▼                 ▼     │
│        │                          failures <        failures >=   │
│        │                          threshold         threshold     │
│        │                                  │                 │     │
│        │                                  │                 ▼     │
│        │                                  │         ┌───────────┐ │
│        │                                  │         │ UNHEALTHY │ │
│        │                                  │         └─────┬─────┘ │
│        │                                  │               │       │
│        │                                  │    emit 'health:unhealthy'
│        │                                  │    trigger reconnection
│        │                                  │               │       │
│        └──────────────────────────────────┴───────────────┘       │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 8. Integration with ExponentialBackoffReconnector

When health check fails beyond threshold:
1. Mark connection as unhealthy
2. Emit `health:unhealthy` event
3. Call `reconnector.notifyDisconnected('Health check failed')`
4. Close existing WebSocket
5. Trigger reconnection via `scheduleReconnect()`

On successful reconnection:
1. Reset health state
2. Emit `health:recovered` event
3. Resume health check interval

### 9. React Hook Updates

Update `useTaskStream` and `useTaskList` hooks to use health state:

```typescript
export function useTaskStream(taskId?: string) {
  const [events, setEvents] = useState<ApexEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isHealthy, setIsHealthy] = useState(false);  // NEW
  const [healthState, setHealthState] = useState<WebSocketHealthState | null>(null);  // NEW
  const clientRef = useRef<ApexWebSocketClient | null>(null);

  useEffect(() => {
    const client = clientRef.current || new ApexWebSocketClient();
    clientRef.current = client;

    // Subscribe to health events
    const healthHandler = (event: HealthCheckEvent) => {
      setIsHealthy(event.isHealthy);
      setHealthState(client.getHealthState());
    };

    client.onHealth(healthHandler);

    // Remove 1-second polling interval
    // Health state updates via events now

    return () => {
      client.offHealth(healthHandler);
    };
  }, [taskId]);

  return {
    events,
    tasks,
    isConnected,
    isHealthy,      // NEW
    healthState,    // NEW
    clearEvents,
  };
}
```

## Implementation Plan

### Phase 1: Core Health Check Infrastructure
1. Add `WebSocketHealthConfig` and `WebSocketHealthState` types to `websocket-client.ts`
2. Implement health check timer management
3. Implement custom ping/pong message handling
4. Add `isHealthy()`, `getHealthState()` methods
5. Add health event subscription (`onHealth`, `offHealth`)

### Phase 2: Server-Side Heartbeat Support
1. Add ping/pong message handling to API server WebSocket routes
2. Include server health metadata in pong responses (optional)

### Phase 3: React Hook Integration
1. Update `useTaskStream` and `useTaskList` to expose health state
2. Remove polling-based connection checking
3. Add health indicators to UI components

### Phase 4: Testing
1. Unit tests for health check timing and state transitions
2. Integration tests for reconnection on health failure
3. Mock server tests for ping/pong protocol

## Consequences

### Positive
- **Proactive Failure Detection**: Detects connection issues before operations fail
- **Consistent Architecture**: Aligns with `MCPConnectionManager` health check patterns
- **Better User Experience**: UI can show health status and respond to degraded connections
- **Reduced Latency**: Eliminates 1-second polling in React hooks
- **Measurable Latency**: Can track and display connection latency

### Negative
- **Increased Network Traffic**: Periodic ping/pong messages add overhead (minimal: ~50 bytes every 30s)
- **Server Changes Required**: API server must handle heartbeat messages
- **Complexity**: Additional state management and event handling

### Neutral
- **Configuration Required**: Health check parameters should be tunable per deployment
- **Backward Compatible**: Existing code continues to work; health features are additive

## File Changes

```
packages/web-ui/src/lib/
├── websocket-client.ts           # Add health check implementation
└── __tests__/
    ├── websocket-client.test.ts  # Add health check unit tests
    └── websocket-client.integration.test.ts  # Update integration tests

packages/api/src/
└── index.ts                      # Add ping/pong handler to WebSocket routes

packages/core/src/
└── types.ts                      # Add WebSocketHealthConfig, WebSocketHealthState types (optional)
```

## Alternatives Considered

### 1. Server-Initiated Pings
- Server sends periodic pings, client responds with pongs
- **Rejected**: More complex to implement, requires tracking client-specific state on server

### 2. Browser Native Ping/Pong
- Use WebSocket protocol-level ping/pong frames
- **Rejected**: Not accessible in browser JavaScript API

### 3. Polling-Based Health Checks (Current Approach)
- Continue using 1-second interval to check `isConnected()`
- **Rejected**: Doesn't detect true connection health, wasteful

### 4. Single-Direction Heartbeat
- Client sends heartbeat, no response expected
- **Rejected**: Can't confirm server received message or calculate latency

## References

- [RFC 6455 - WebSocket Protocol (Ping/Pong)](https://tools.ietf.org/html/rfc6455#section-5.5.2)
- [ADR-0015: Exponential Backoff Reconnector](./ADR-0015-exponential-backoff-reconnector.md)
- [MCPConnectionManager Health Implementation](../packages/orchestrator/src/mcp/connection-manager.ts)
- [Current WebSocket Client](../packages/web-ui/src/lib/websocket-client.ts)
