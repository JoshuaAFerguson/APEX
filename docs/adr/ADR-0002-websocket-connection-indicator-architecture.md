# ADR-0002: WebSocketConnectionIndicator Component Architecture

## Status
Proposed

## Date
2024-03-15

## Context

The APEX web-ui requires a visual indicator component to display WebSocket connection health status. This component will help users understand the real-time connection state, including:
- Connection status (connected/disconnected/reconnecting)
- Latency metrics when connected
- Reconnection attempt information
- Detailed health information via tooltip

### Existing Infrastructure

The codebase already has mature WebSocket infrastructure:

1. **`ApexWebSocketClient`** (`packages/web-ui/src/lib/websocket-client.ts`)
   - Full WebSocket client with health monitoring
   - Exposes `getHealthState()`, `getHealthStatistics()`, `isConnected()`, `isHealthy()`
   - Emits health events via `onHealth()` handler

2. **`ConnectionHealthManager`** (`packages/web-ui/src/lib/connection-health.ts`)
   - Unified health management
   - Tracks latency history, consecutive failures, ping/pong metrics

3. **`ExponentialBackoffReconnector`** (`packages/web-ui/src/lib/exponential-backoff.ts`)
   - Handles reconnection logic with stats
   - Exposes `getStats()` with `currentAttempt`, `state`, `lastDelayMs`

4. **`useRealtimeUpdates`** hook (`packages/web-ui/src/lib/useRealtimeUpdates.ts`)
   - Already subscribes to health events
   - Maintains `connectionState` and health metrics

5. **Existing UI Patterns**
   - `HealthStatusIndicator` component in dashboard
   - `Badge`, `ProgressIndicator`, `Spinner` components
   - Consistent styling with `STATUS_STYLES` and `cn()` utility

## Decision

### Component Architecture

Create a **WebSocketConnectionIndicator** component following the established patterns:

```
packages/web-ui/src/
├── components/
│   └── connection/
│       ├── WebSocketConnectionIndicator.tsx    # Main component
│       ├── WebSocketConnectionTooltip.tsx      # Tooltip with health details
│       ├── index.ts                            # Exports
│       └── __tests__/
│           ├── WebSocketConnectionIndicator.test.tsx
│           └── WebSocketConnectionIndicator.integration.test.tsx
├── types/
│   └── websocket-connection.ts                 # Type definitions
└── hooks/
    └── useWebSocketConnection.ts               # Hook for connection state
```

### Type Definitions

```typescript
// types/websocket-connection.ts

/**
 * WebSocket connection states matching existing infrastructure
 */
export type WebSocketConnectionStatus =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'reconnecting'
  | 'error';

/**
 * Connection health details for display
 */
export interface WebSocketConnectionHealth {
  status: WebSocketConnectionStatus;
  isHealthy: boolean;
  latencyMs: number | null;
  averageLatencyMs: number | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  consecutiveFailures: number;
  lastHealthyAt: Date | null;
  lastCheckAt: Date | null;
  connectionUptime: number | null; // milliseconds since connected
}

/**
 * Props for WebSocketConnectionIndicator
 */
export interface WebSocketConnectionIndicatorProps {
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Show latency when connected */
  showLatency?: boolean;
  /** Show reconnection attempts when reconnecting */
  showReconnectAttempts?: boolean;
  /** Enable tooltip with detailed health info */
  showTooltip?: boolean;
  /** Enable pulse animation for status changes */
  animated?: boolean;
  /** Custom className */
  className?: string;
  /** Override health data (for testing/storybook) */
  healthOverride?: Partial<WebSocketConnectionHealth>;
}
```

### Component Design

#### 1. Visual States

| State | Color | Icon | Text | Animation |
|-------|-------|------|------|-----------|
| Connected | Green | Check Circle | "Connected" | None |
| Connected (with latency) | Green | Check Circle | "45ms" | None |
| Disconnected | Red | X Circle | "Disconnected" | Pulse (if animated) |
| Connecting | Blue | Spinner | "Connecting..." | Spinner |
| Reconnecting | Yellow | Refresh | "Reconnecting (2/10)" | Spinner + Pulse |
| Error | Red | Alert Circle | "Connection Error" | Pulse |

#### 2. Color Palette (Using existing STATUS_STYLES pattern)

```typescript
const CONNECTION_STATUS_STYLES = {
  connected: {
    bg: 'bg-green-950/50',
    text: 'text-green-400',
    border: 'border-green-900',
    icon: 'text-green-500',
    dot: 'bg-green-500',
  },
  disconnected: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-900',
    icon: 'text-red-500',
    dot: 'bg-red-500',
  },
  connecting: {
    bg: 'bg-apex-950/50',
    text: 'text-apex-400',
    border: 'border-apex-900',
    icon: 'text-apex-500',
    dot: 'bg-apex-500',
  },
  reconnecting: {
    bg: 'bg-yellow-950/50',
    text: 'text-yellow-400',
    border: 'border-yellow-900',
    icon: 'text-yellow-500',
    dot: 'bg-yellow-500',
  },
  error: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-900',
    icon: 'text-red-500',
    dot: 'bg-red-500',
  },
} as const;
```

#### 3. Hook Design

The `useWebSocketConnection` hook wraps existing infrastructure:

```typescript
export function useWebSocketConnection(): WebSocketConnectionHealth {
  const [health, setHealth] = useState<WebSocketConnectionHealth>(initialState);

  useEffect(() => {
    const client = wsClient; // Use existing singleton

    // Subscribe to health events
    const handleHealth = (event: HealthCheckEvent) => {
      // Map to WebSocketConnectionHealth
    };

    // Poll for stats (for reconnect attempts)
    const interval = setInterval(() => {
      const healthState = client.getHealthState();
      const stats = client.getHealthStatistics();
      // Update health
    }, 1000);

    client.onHealth(handleHealth);

    return () => {
      client.offHealth(handleHealth);
      clearInterval(interval);
    };
  }, []);

  return health;
}
```

### Tooltip Content Structure

```
┌─────────────────────────────────────┐
│ Connection Health                    │
├─────────────────────────────────────┤
│ Status: ● Connected                  │
│ Latency: 45ms (avg: 52ms)           │
│ Uptime: 1h 23m                      │
│ Last Check: 5s ago                  │
├─────────────────────────────────────┤
│ Health Checks                        │
│ Success Rate: 99.5%                  │
│ Consecutive Failures: 0             │
└─────────────────────────────────────┘
```

### Integration Points

1. **Header Component**: Primary placement for global connection status
2. **Dashboard**: Via existing `useRealtimeUpdates` hook
3. **Task Detail Pages**: Show connection status for real-time updates

### Accessibility Considerations

- Use `role="status"` with `aria-live="polite"` for status changes
- Include descriptive `aria-label` with full status text
- Ensure color is not the only indicator (use icons + text)
- Support keyboard navigation for tooltip

## Implementation Plan

### Phase 1: Types and Hook
1. Create `types/websocket-connection.ts` with type definitions
2. Create `hooks/useWebSocketConnection.ts` hook
3. Add unit tests for hook

### Phase 2: Component Implementation
1. Create `components/connection/WebSocketConnectionIndicator.tsx`
2. Create `components/connection/WebSocketConnectionTooltip.tsx`
3. Add component exports to index

### Phase 3: Testing
1. Unit tests for all states
2. Integration tests with mock WebSocket client
3. Visual regression tests (optional)

### Phase 4: Integration
1. Add to Header component
2. Update exports in ui/index.ts
3. Document usage

## Consequences

### Positive
- Unified connection status display across the application
- Reuses existing WebSocket infrastructure
- Follows established component patterns
- Provides actionable information to users

### Negative
- Adds polling interval (1s) for reconnection stats
- Tooltip implementation adds complexity

### Risks
- Health check interval must be balanced with performance
- State transitions must be debounced to avoid UI flickering

## Alternatives Considered

### 1. Extend HealthStatusIndicator
**Rejected**: The existing component is for project/system health, not connection status. Different visual language and data sources.

### 2. Use only RealtimeConnectionState
**Rejected**: Doesn't provide enough detail for reconnection attempts and latency.

### 3. Inline implementation without hook
**Rejected**: Would duplicate logic across multiple usage sites.

## References

- Existing files analyzed:
  - `packages/web-ui/src/lib/websocket-client.ts`
  - `packages/web-ui/src/lib/connection-health.ts`
  - `packages/web-ui/src/lib/exponential-backoff.ts`
  - `packages/web-ui/src/lib/useRealtimeUpdates.ts`
  - `packages/web-ui/src/components/dashboard/HealthStatusIndicator.tsx`
  - `packages/web-ui/src/types/dashboard.ts`
  - `packages/web-ui/src/types/project-health.ts`
