# ADR-0015: Exponential Backoff Reconnector

## Status
Accepted

## Date
2025-01-15

## Context

APEX requires robust reconnection logic for various network connections including:
- WebSocket connections (client-side in `@apexcli/web-ui`)
- MCP server connections (in `@apexcli/orchestrator`)
- API server connections

Currently, reconnection logic is implemented inline in multiple places:
1. `packages/web-ui/src/lib/websocket-client.ts` - Has basic exponential backoff
2. `packages/orchestrator/src/mcp/connection-manager.ts` - Has more sophisticated backoff with jitter
3. `packages/core/src/utils.ts` - Has a simple `retry()` function

Each implementation has slightly different:
- Configuration options
- Jitter algorithms
- State management
- Event emission patterns

This leads to:
- Code duplication
- Inconsistent behavior across the codebase
- Harder maintenance and testing
- Missing features in some implementations (e.g., jitter, proper state management)

## Decision

Create a dedicated, reusable `ExponentialBackoffReconnector` class in `packages/core/src/exponential-backoff.ts` that provides:

### 1. Configurable Parameters

```typescript
export interface ExponentialBackoffConfig {
  /** Base delay in milliseconds for the first retry (default: 1000) */
  baseDelayMs: number;

  /** Maximum delay in milliseconds (caps exponential growth) (default: 30000) */
  maxDelayMs: number;

  /** Maximum number of retry attempts before giving up (default: 10) */
  maxRetries: number;

  /** Backoff factor/multiplier (default: 2) */
  backoffFactor: number;

  /**
   * Jitter configuration to prevent thundering herd
   * - 'none': No jitter applied
   * - 'full': Random value between 0 and calculated delay
   * - 'equal': delay/2 + random(0, delay/2)
   * - 'decorrelated': More sophisticated decorrelated jitter
   * (default: 'equal')
   */
  jitterStrategy: 'none' | 'full' | 'equal' | 'decorrelated';

  /**
   * Jitter factor (0-1) controlling how much randomness to apply
   * Only used with 'full' and 'equal' strategies (default: 0.25)
   */
  jitterFactor: number;
}
```

### 2. Connection State Machine

The reconnector manages connection state transitions:

```
┌─────────────┐
│   IDLE      │◄──────────────────────────────────────┐
└──────┬──────┘                                       │
       │ connect()                                    │
       ▼                                              │
┌─────────────┐                                       │
│ CONNECTING  │                                       │
└──────┬──────┘                                       │
       │                                              │
       ├─────── success ──────┐                       │
       │                      ▼                       │
       │               ┌─────────────┐                │
       │               │ CONNECTED   │────disconnect()
       │               └──────┬──────┘                │
       │                      │ connection lost       │
       │                      ▼                       │
       ├─────── failure ┌─────────────┐               │
       │                │ DISCONNECTED│               │
       │                └──────┬──────┘               │
       │                       │ (auto-reconnect)     │
       ▼                       ▼                      │
┌─────────────┐         ┌─────────────┐               │
│   FAILED    │         │RECONNECTING │───────────────┤
└─────────────┘         └──────┬──────┘               │
                               │                      │
                               ├── success ───► CONNECTED
                               │
                               └── max retries ─► FAILED
```

```typescript
export type ConnectionState =
  | 'idle'        // Not yet connected
  | 'connecting'  // Initial connection attempt
  | 'connected'   // Successfully connected
  | 'disconnected'// Connection lost, may reconnect
  | 'reconnecting'// Attempting to reconnect
  | 'failed';     // Max retries exceeded or fatal error
```

### 3. Event-Driven Architecture

```typescript
export interface ReconnectorEvents {
  /** Emitted when state changes */
  'state:changed': (previousState: ConnectionState, newState: ConnectionState) => void;

  /** Emitted before a reconnection attempt */
  'reconnect:attempt': (attempt: number, maxAttempts: number, delayMs: number) => void;

  /** Emitted when reconnection succeeds */
  'reconnect:success': (attempts: number) => void;

  /** Emitted when a reconnection attempt fails */
  'reconnect:failure': (attempt: number, error: Error) => void;

  /** Emitted when max retries exceeded */
  'reconnect:exhausted': (totalAttempts: number, lastError?: Error) => void;

  /** Emitted when backoff delay is calculated */
  'backoff:delay': (delayMs: number, attempt: number) => void;
}
```

### 4. Core API

```typescript
export class ExponentialBackoffReconnector extends EventEmitter<ReconnectorEvents> {
  constructor(config?: Partial<ExponentialBackoffConfig>);

  /** Get current connection state */
  get state(): ConnectionState;

  /** Get current attempt count */
  get attempts(): number;

  /** Get time until next retry (0 if not waiting) */
  get timeUntilNextRetry(): number;

  /**
   * Calculate delay for the next attempt
   * @param attempt - The attempt number (1-based)
   * @returns Delay in milliseconds with jitter applied
   */
  calculateDelay(attempt?: number): number;

  /**
   * Schedule a reconnection attempt
   * @param connectFn - Async function that performs the connection
   * @returns Promise resolving when connected or rejecting when exhausted
   */
  scheduleReconnect<T>(connectFn: () => Promise<T>): Promise<T>;

  /**
   * Notify that connection was lost (triggers reconnection if configured)
   * @param error - Optional error that caused the disconnection
   */
  notifyDisconnected(error?: Error): void;

  /**
   * Notify that connection succeeded (resets retry state)
   */
  notifyConnected(): void;

  /**
   * Reset all state (stop pending reconnections, reset counters)
   */
  reset(): void;

  /**
   * Get detailed statistics about reconnection history
   */
  getStats(): ReconnectorStats;
}

export interface ReconnectorStats {
  /** Total connection attempts made */
  totalAttempts: number;
  /** Total successful connections */
  successfulConnections: number;
  /** Total failed connection attempts */
  failedAttempts: number;
  /** Current consecutive failures */
  consecutiveFailures: number;
  /** Average delay between retries */
  averageDelayMs: number;
  /** Last error encountered */
  lastError?: Error;
  /** Timestamp of last state change */
  lastStateChange: Date;
}
```

### 5. Backoff Algorithm

The delay calculation follows this formula:

```typescript
function calculateDelay(attempt: number, config: ExponentialBackoffConfig): number {
  // Base exponential backoff
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffFactor, attempt - 1);

  // Cap at maximum
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Apply jitter based on strategy
  switch (config.jitterStrategy) {
    case 'none':
      return cappedDelay;

    case 'full':
      // Random between 0 and cappedDelay
      return Math.random() * cappedDelay;

    case 'equal':
      // 50% base + 50% random (reduces variance while preventing collision)
      const half = cappedDelay / 2;
      return half + Math.random() * half;

    case 'decorrelated':
      // AWS-style decorrelated jitter
      // newDelay = min(maxDelay, random(baseDelay, previousDelay * 3))
      const prevDelay = this.lastDelay || config.baseDelayMs;
      return Math.min(
        config.maxDelayMs,
        config.baseDelayMs + Math.random() * (prevDelay * 3 - config.baseDelayMs)
      );
  }
}
```

### 6. Integration Patterns

#### Pattern A: Direct Usage (WebSocket Client)
```typescript
const reconnector = new ExponentialBackoffReconnector({
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  maxRetries: 10,
  jitterStrategy: 'equal',
});

reconnector.on('reconnect:attempt', (attempt, max, delay) => {
  console.log(`Reconnecting in ${delay}ms (attempt ${attempt}/${max})`);
});

// When connection is lost
ws.onclose = () => {
  reconnector.scheduleReconnect(async () => {
    const newWs = new WebSocket(url);
    await waitForOpen(newWs);
    return newWs;
  });
};
```

#### Pattern B: Composition with Connection Manager
```typescript
class MCPConnectionManager {
  private reconnector: ExponentialBackoffReconnector;

  constructor(config: MCPConnectionConfig) {
    this.reconnector = new ExponentialBackoffReconnector({
      baseDelayMs: config.retryDelayMs,
      maxDelayMs: config.maxRetryDelayMs,
      maxRetries: config.maxRetries,
      backoffFactor: config.backoffFactor,
    });

    // Forward events
    this.reconnector.on('reconnect:attempt', (attempt, max, delay) => {
      this.emit('reconnecting', serverId, attempt, max);
    });
  }
}
```

## File Structure

```
packages/core/src/
├── exponential-backoff.ts          # Main implementation
├── __tests__/
│   └── exponential-backoff.test.ts # Unit tests
└── index.ts                        # Add export
```

## Consequences

### Positive
- **Consistency**: All reconnection logic uses the same well-tested implementation
- **Testability**: Pure calculation functions + clear state machine = easy testing
- **Flexibility**: Configurable for different use cases (aggressive retry vs. conservative)
- **Observability**: Event-driven design enables logging and monitoring
- **Reusability**: Can be used for WebSocket, MCP, HTTP, or any reconnectable resource

### Negative
- **Migration Effort**: Existing code needs to be refactored to use the new class
- **Bundle Size**: Adds ~2KB to the core package (acceptable)
- **Learning Curve**: Developers need to understand the API

### Neutral
- The existing `retry()` function in `utils.ts` remains for simple one-shot retry scenarios
- Connection-specific logic (WebSocket, MCP protocol) stays in respective packages

## Compatibility

The `ExponentialBackoffReconnector` is designed to be compatible with:
- Existing `MCPConnectionConfig` schema (uses same field names)
- Browser environments (no Node.js-specific APIs)
- Node.js environments
- React hooks (via event subscriptions)

## Testing Strategy

1. **Unit Tests** for:
   - Delay calculation with various configurations
   - Jitter distribution (statistical tests)
   - State transitions
   - Event emission
   - Edge cases (0 retries, max delay capping)

2. **Integration Tests** for:
   - Actual reconnection with mock servers
   - Timer-based behavior
   - Cancellation and reset

## Implementation Notes

### Thread Safety
- State changes are atomic
- Pending timers are tracked and can be cancelled
- Multiple calls to `scheduleReconnect` while already reconnecting are handled

### Memory Management
- No memory leaks from abandoned timers
- Stats history is bounded
- Event listeners can be removed

### Error Handling
- All errors are captured and emitted as events
- Fatal vs. retryable errors can be distinguished
- Original errors are preserved in the chain

## References

- [Exponential Backoff And Jitter (AWS)](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Existing MCP Connection Manager](../packages/orchestrator/src/mcp/connection-manager.ts)
- [WebSocket Client](../packages/web-ui/src/lib/websocket-client.ts)
- [Core Utils Retry Function](../packages/core/src/utils.ts)
