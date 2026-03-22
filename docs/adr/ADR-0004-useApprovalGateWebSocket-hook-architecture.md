# ADR-0004: useApprovalGateWebSocket Hook Architecture

## Status
**Implemented**

## Date
2026-03-16

## Context

The APEX web-ui requires a specialized React hook to manage approval gates with real-time WebSocket updates. This hook enables the approval workflow system where:

- Tasks can require approval before proceeding (gates)
- Gates can be approved, rejected, timed out, or skipped
- Real-time updates are essential for responsive approval workflows
- Connection status must be monitored for reliability

### Requirements Analysis

From the acceptance criteria:
1. **Subscribe to WebSocket gate events**: `gate:approved` and `gate:rejected`
2. **Provide pending/resolved gates state**: Track gates awaiting approval and resolved ones
3. **Handle connection status**: Monitor WebSocket health and reconnection
4. **Emit callbacks on gate resolution**: Allow external handlers to react to gate changes
5. **Unit tests**: Cover event handling, reconnection, and state management

### Existing Infrastructure

The codebase already has mature infrastructure:

1. **`ApexWebSocketClient`** (`packages/web-ui/src/lib/websocket-client.ts`)
   - Full WebSocket client with health monitoring
   - Event subscription via `on(eventType, handler)` / `off(eventType, handler)`
   - Health state via `getHealthState()`, connection check via `isConnected()`
   - Singleton instance: `wsClient`

2. **`apiClient`** (`packages/web-ui/src/lib/api-client.ts`)
   - `approveGate(taskId, gateName, request)` method
   - `rejectGate(taskId, gateName, request)` method
   - `listTasks({ status: 'awaiting-approval' })` for initial state

3. **Type Definitions** (`packages/web-ui/src/types/approval-gate-panel.ts`)
   - `PendingApprovalGate`: Gate awaiting approval
   - `ResolvedApprovalGate`: Gate that has been resolved
   - WebSocket event types: `GateRequiredEvent`, `GateApprovedEvent`, `GateRejectedEvent`, etc.
   - Type guards: `isGateRequiredEvent()`, `isGateResolvedEvent()`

4. **WebSocket Connection Types** (`packages/web-ui/src/types/websocket-connection.ts`)
   - `WebSocketConnectionStatus`: `'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'error'`
   - `WebSocketConnectionHealth` interface

## Decision

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    useApprovalGateWebSocket                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐ │
│  │   Options   │──▶   │  Hook Internal  │──▶   │  Return Value   │ │
│  │  (taskId,   │      │    State Mgmt   │      │   (State +      │ │
│  │   auto-     │      │                 │      │    Actions +    │ │
│  │   connect)  │      │  ┌───────────┐  │      │    Callbacks)   │ │
│  └─────────────┘      │  │ Pending   │  │      └─────────────────┘ │
│                       │  │ Gates[]   │  │                          │
│                       │  └───────────┘  │                          │
│                       │  ┌───────────┐  │                          │
│                       │  │ Resolved  │  │                          │
│                       │  │ Gates[]   │  │                          │
│                       │  └───────────┘  │                          │
│                       │  ┌───────────┐  │                          │
│                       │  │Connection │  │                          │
│                       │  │ Status    │  │                          │
│                       │  └───────────┘  │                          │
│                       └────────┬────────┘                          │
│                                │                                    │
│  ┌─────────────────────────────▼───────────────────────────────┐   │
│  │                    Event Sources                              │   │
│  │                                                               │   │
│  │  ┌─────────────┐        ┌─────────────┐        ┌───────────┐ │   │
│  │  │  wsClient   │        │  apiClient  │        │  Health   │ │   │
│  │  │ (WebSocket) │        │   (REST)    │        │  Monitor  │ │   │
│  │  └─────────────┘        └─────────────┘        └───────────┘ │   │
│  └───────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
packages/web-ui/src/
├── components/
│   └── approval/
│       ├── hooks/
│       │   └── useApprovalGateWebSocket.ts    # Main hook implementation
│       └── __tests__/
│           └── useApprovalGateWebSocket.test.tsx
└── types/
    └── approval-gate-panel.ts                  # Existing types
```

### Interface Design

#### Options Interface

```typescript
export interface UseApprovalGateWebSocketOptions {
  /** Filter by specific task ID */
  taskId?: string
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean
  /** Auto-reconnect on errors (default: true) */
  reconnectOnError?: boolean
  /** Initial pending gates */
  initialPendingGates?: PendingApprovalGate[]
  /** Initial resolved gates */
  initialResolvedGates?: ResolvedApprovalGate[]
}
```

#### Return Interface

```typescript
export interface UseApprovalGateWebSocketReturn {
  // State
  pendingGates: PendingApprovalGate[]
  resolvedGates: ResolvedApprovalGate[]
  isConnected: boolean
  connectionStatus: WebSocketConnectionStatus
  isLoading: boolean
  error: Error | null

  // Actions
  approveGate: (gateId: string, comment?: string) => Promise<void>
  rejectGate: (gateId: string, comment: string) => Promise<void>
  refresh: () => Promise<void>
  connect: () => void
  disconnect: () => void

  // Event handlers (callback registration)
  onGateReceived: (handler: (gate: PendingApprovalGate) => void) => void
  onGateResolved: (handler: (gate: ResolvedApprovalGate) => void) => void
}
```

### Event Subscription Model

The hook subscribes to all approval-related WebSocket events:

| Event Type | Action |
|------------|--------|
| `gate:required` | Add to pendingGates |
| `gate:approved` | Move from pendingGates to resolvedGates |
| `gate:rejected` | Move from pendingGates to resolvedGates |
| `gate:timeout` | Move from pendingGates to resolvedGates (auto-resolved) |
| `gate:skipped` | Move from pendingGates to resolvedGates |
| `approval-required` | Add to pendingGates (legacy event) |
| `approval-resolved` | Move from pendingGates to resolvedGates |

### State Management Flow

```
WebSocket Event Received
         │
         ▼
┌─────────────────────┐
│ Filter by taskId?   │──── No ───▶ [Process Event]
└─────────────────────┘             │
         │                          ▼
        Yes                 ┌───────────────┐
         │                  │ Type Guard    │
         ▼                  │ Check Event   │
┌─────────────────────┐     └───────┬───────┘
│ taskId matches?     │             │
└────────┬────────────┘     ┌───────┴───────┐
    No   │   Yes            │               │
    │    │                  ▼               ▼
    ▼    │         isGateRequiredEvent  isGateResolvedEvent
 [Skip]  │                  │               │
         │                  ▼               ▼
         └────────▶ Add to pending    Move to resolved
                    + Notify handlers   + Notify handlers
```

### Connection Status Monitoring

The hook uses a polling mechanism (1-second interval) to monitor connection status:

```typescript
const updateConnectionStatus = useCallback(() => {
  const connected = wsClient.isConnected()
  const healthState = wsClient.getHealthState()

  if (connected && healthState.isHealthy) {
    setConnectionStatus('connected')
  } else if (connected && !healthState.isHealthy) {
    setConnectionStatus('error')
  } else if (!connected) {
    // Infer reconnecting state from recent health check
    const timeSinceLastCheck = Date.now() - (healthState.lastCheckAt?.getTime() || 0)
    const isLikelyReconnecting = timeSinceLastCheck < 5000
    setConnectionStatus(isLikelyReconnecting ? 'reconnecting' : 'disconnected')
  }
}, [])
```

### External Handler Pattern

External callbacks are managed via refs to avoid stale closure issues:

```typescript
const gateReceivedHandlers = useRef(new Set<(gate: PendingApprovalGate) => void>())
const gateResolvedHandlers = useRef(new Set<(gate: ResolvedApprovalGate) => void>())

// Registration returns cleanup function
const onGateReceived = useCallback((handler) => {
  gateReceivedHandlers.current.add(handler)
  return () => gateReceivedHandlers.current.delete(handler)
}, [])
```

### Error Handling Strategy

1. **API Errors**: Captured in `error` state, re-thrown for caller handling
2. **WebSocket Event Errors**: Logged with warning, set in error state
3. **External Handler Errors**: Caught and logged, don't affect hook state

### Duplicate Prevention

Gates are deduplicated by ID to prevent duplicates from rapid events:

```typescript
setPendingGates(prev => {
  const exists = prev.some(g => g.id === newGate.id)
  if (!exists) {
    return [newGate, ...prev]  // Newest first
  }
  return prev
})
```

## Test Coverage

### Unit Test Categories

1. **Initialization**
   - Default values
   - Initial gates from props
   - Auto-connect behavior
   - Event listener setup

2. **WebSocket Event Handling**
   - `gate:required` adds pending gate
   - `gate:approved` moves to resolved
   - `gate:rejected` moves to resolved
   - Task ID filtering

3. **Gate Actions**
   - Approve success
   - Reject success
   - API error handling
   - Non-existent gate error

4. **Connection Management**
   - Status state changes
   - connect() behavior
   - disconnect() behavior

5. **External Event Handlers**
   - Handler registration
   - Handler invocation
   - Error isolation

6. **Cleanup**
   - Event listener removal on unmount

## Consequences

### Positive

1. **Separation of Concerns**: Hook manages WebSocket subscription, state, and actions
2. **Reusable**: Can be used in multiple components (ApprovalGatePanel, Dashboard, Notifications)
3. **Testable**: Clean interface allows comprehensive mocking
4. **Real-time**: Immediate updates via WebSocket events
5. **Resilient**: Connection status monitoring and reconnection support

### Negative

1. **Polling Overhead**: 1-second interval for connection status adds minor CPU usage
2. **State Duplication**: Gates stored in hook state may duplicate API state temporarily

### Trade-offs

1. **Optimistic Updates vs Consistency**: Currently waits for WebSocket confirmation rather than optimistic updates
2. **Memory Usage**: Resolved gates accumulated (consider limiting history length in future)

## Alternatives Considered

### 1. Use Global State (Redux/Zustand)
**Rejected**: Adds unnecessary complexity for approval-specific state. Hook pattern is sufficient and more localized.

### 2. Subscribe to All Events with Filter
**Rejected**: Using wildcard `*` subscription would receive unnecessary events. Explicit event types are more efficient.

### 3. Polling Instead of WebSocket
**Rejected**: Real-time requirements for approvals make polling inappropriate. User experience depends on immediate updates.

## Implementation Checklist

- [x] Create hook implementation at `components/approval/hooks/useApprovalGateWebSocket.ts`
- [x] Define options and return interfaces
- [x] Implement WebSocket event subscription
- [x] Implement state management for pending/resolved gates
- [x] Implement connection status monitoring
- [x] Implement external callback registration
- [x] Implement approve/reject actions via API client
- [x] Create unit tests covering all scenarios
- [x] Export hook from component index

## References

- Implementation: `packages/web-ui/src/components/approval/hooks/useApprovalGateWebSocket.ts`
- Tests: `packages/web-ui/src/components/approval/__tests__/useApprovalGateWebSocket.test.tsx`
- Types: `packages/web-ui/src/types/approval-gate-panel.ts`
- WebSocket Client: `packages/web-ui/src/lib/websocket-client.ts`
- API Client: `packages/web-ui/src/lib/api-client.ts`
- Related ADR: `ADR-0002-websocket-connection-indicator-architecture.md`
