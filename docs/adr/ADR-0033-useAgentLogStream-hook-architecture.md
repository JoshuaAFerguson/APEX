# ADR-0033: useAgentLogStream Hook Architecture

## Status
**Proposed**

## Date
2026-03-22

## Context

The APEX web-ui requires a specialized React hook (`useAgentLogStream`) to subscribe to agent log events via WebSocket, buffer logs, handle connection state, and provide log entries with streaming status. This hook will power the `AgentTerminalPanel` component for real-time terminal-like log viewing.

### Requirements Analysis

From the acceptance criteria:
1. **Subscribe to agent log events via WebSocket**: Stream logs for a specific agent
2. **Buffer logs in memory**: Manage log entries with configurable limits
3. **Handle connection state**: Monitor WebSocket health and provide status
4. **Provide log entries**: Return buffered logs with filtering capabilities
5. **Provide streaming status**: Indicate active streaming, paused, or disconnected states
6. **Integrate with existing wsClient infrastructure**: Use the singleton `ApexWebSocketClient`

### Existing Infrastructure

The codebase provides mature building blocks:

1. **`ApexWebSocketClient`** (`packages/web-ui/src/lib/websocket-client.ts`)
   - Full WebSocket client with health monitoring
   - Event subscription via `on(eventType, handler)` / `off(eventType, handler)`
   - Health state via `getHealthState()`, connection check via `isConnected()`
   - Singleton instance: `wsClient`

2. **Type Definitions** (`packages/web-ui/src/types/agent-log-stream.ts`)
   - `AgentLogEntry`: Individual log record with metadata
   - `UseAgentLogStreamOptions`: Hook configuration
   - `UseAgentLogStreamReturn`: Hook return interface
   - `LogStreamState`: Connection and streaming state
   - `LogStreamStats`: Stream statistics
   - `StreamingState`: `'idle' | 'connecting' | 'streaming' | 'paused' | 'disconnected' | 'error'`
   - Utility functions: `filterLogs()`, `calculateLogStreamStats()`, `exportLogs()`
   - Constants: `DEFAULT_AGENT_LOG_STREAM_OPTIONS`, `EMPTY_LOG_STREAM_STATE`, etc.

3. **Log Filter Types** (`packages/web-ui/src/types/log-viewer.ts`)
   - `LogLevel`: `'debug' | 'info' | 'warn' | 'error'`
   - `LogFilter`: Filter configuration with levels, searchText, stage, agent

4. **WebSocket Connection Types** (`packages/web-ui/src/types/websocket-connection.ts`)
   - `WebSocketConnectionStatus`
   - `getConnectionStatus()` helper

5. **Similar Hooks for Reference**
   - `useAgentMetrics`: Agent metrics aggregation via WebSocket
   - `useApprovalGateWebSocket`: Approval gate management with callbacks
   - `useWebSocketConnection`: Connection health monitoring

## Decision

### Architecture Overview

```
+-----------------------------------------------------------------------+
|                       useAgentLogStream                                |
+-----------------------------------------------------------------------+
|                                                                        |
|  +--------------+      +------------------+      +------------------+  |
|  |   Options    |----> |  Hook Internal   |----> |  Return Value    |  |
|  |  (agentId,   |      |   State Mgmt     |      |   (logs, state,  |  |
|  |   maxLogs,   |      |                  |      |    controls)     |  |
|  |   filter)    |      |  +------------+  |      +------------------+  |
|  +--------------+      |  | logs[]     |  |                            |
|                        |  +------------+  |                            |
|                        |  +------------+  |                            |
|                        |  | streamState|  |                            |
|                        |  +------------+  |                            |
|                        |  +------------+  |                            |
|                        |  | stats      |  |                            |
|                        |  +------------+  |                            |
|                        +--------+---------+                            |
|                                 |                                      |
|  +------------------------------v------------------------------------+ |
|  |                    Event Sources                                  | |
|  |                                                                   | |
|  |  +---------------+        +---------------+        +------------+ | |
|  |  |   wsClient    |        | Log Buffer    |        |  Health    | | |
|  |  |  (WebSocket)  |        | (Ring Buffer) |        |  Monitor   | | |
|  |  +---------------+        +---------------+        +------------+ | |
|  +-------------------------------------------------------------------+ |
+------------------------------------------------------------------------+
```

### File Structure

```
packages/web-ui/src/
+-- hooks/
|   +-- useAgentLogStream.ts           # Main hook implementation
|   +-- index.ts                       # Export barrel (add new hook)
|   +-- __tests__/
|       +-- useAgentLogStream.test.tsx # Unit tests
+-- types/
    +-- agent-log-stream.ts            # (Existing) Type definitions
```

### Interface Design

The types are already defined in `agent-log-stream.ts`. The hook will implement:

#### Options Interface (Existing)

```typescript
export interface UseAgentLogStreamOptions {
  agentId: string                                    // Required
  autoConnect?: boolean                              // Default: true
  maxLogs?: number                                   // Default: 1000
  filter?: Partial<LogFilter>                        // Optional initial filter
  onLogs?: (logs: AgentLogEntry[]) => void          // Callback on new logs
  onConnectionChange?: (status: WebSocketConnectionStatus) => void
  onError?: (error: string) => void
  debug?: boolean                                    // Default: false
}
```

#### Return Interface (Existing)

```typescript
export interface UseAgentLogStreamReturn {
  // Data
  logs: AgentLogEntry[]                    // All logs in buffer
  filteredLogs: AgentLogEntry[]            // Logs after filter applied
  filter: LogFilter                        // Current filter state
  streamState: LogStreamState              // Connection/streaming state
  stats: LogStreamStats                    // Stream statistics

  // Status flags (derived)
  isConnecting: boolean
  isStreaming: boolean
  isPaused: boolean
  error: string | null

  // Control methods
  connect: () => void
  disconnect: () => void
  pause: () => void
  resume: () => void
  clearLogs: () => void
  addLogs: (logs: AgentLogEntry[]) => void
  setFilter: (filter: Partial<LogFilter>) => void
  resetFilter: () => void
  exportLogs: (format: 'json' | 'text' | 'csv') => string
  scrollToLog: (logId: string) => void
  scrollToBottom: () => void
}
```

### Event Subscription Model

The hook subscribes to agent log-related WebSocket events:

| Event Type | Condition | Action |
|------------|-----------|--------|
| `agent:log` | `agentId` matches | Add to logs buffer |
| `agent:output` | `agentId` matches | Add to logs (as 'agent' source) |
| `agent:error` | `agentId` matches | Add to logs (as 'error' level) |
| `agent:started` | `agentId` matches | Add system log, set streaming state |
| `agent:completed` | `agentId` matches | Add system log, may stop streaming |
| `agent:failed` | `agentId` matches | Add error log, set error state |
| `tool:complete` | `agentId` matches | Add tool log if relevant |
| `*` (wildcard) | Filter for agent events | Catch any missed events |

### Implementation Design

#### 1. State Management via useReducer

Use `useReducer` for complex state management matching the `AgentLogStreamAction` type:

```typescript
type AgentLogStreamAction =
  | { type: 'ADD_LOGS'; payload: AgentLogEntry[] }
  | { type: 'CLEAR_LOGS' }
  | { type: 'SET_FILTER'; payload: Partial<LogFilter> }
  | { type: 'RESET_FILTER' }
  | { type: 'SET_STREAM_STATE'; payload: Partial<LogStreamState> }
  | { type: 'SET_STREAMING'; payload: StreamingState }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'UPDATE_STATS'; payload: Partial<LogStreamStats> }
```

#### 2. Ring Buffer Pattern for Logs

Implement efficient log buffering with `maxLogs` limit:

```typescript
// In ADD_LOGS reducer case
case 'ADD_LOGS': {
  const newLogs = [...state.logs, ...action.payload]
  // Trim to maxLogs (FIFO - remove oldest)
  const trimmedLogs = newLogs.length > maxLogs
    ? newLogs.slice(-maxLogs)
    : newLogs

  return {
    ...state,
    logs: trimmedLogs,
    filteredLogs: filterLogs(trimmedLogs, state.filter),
    streamState: {
      ...state.streamState,
      logsReceivedCount: state.streamState.logsReceivedCount + action.payload.length,
      lastLogAt: new Date(),
      bytesReceived: state.streamState.bytesReceived + estimateBytes(action.payload),
    }
  }
}
```

#### 3. Log Entry Transformation

Transform WebSocket events to `AgentLogEntry`:

```typescript
function transformEventToLogEntry(event: ApexEvent, agentId: string): AgentLogEntry | null {
  // Map event type to log level and source
  const logMapping = {
    'agent:log': { level: 'info', source: 'agent' },
    'agent:output': { level: 'info', source: 'agent' },
    'agent:error': { level: 'error', source: 'error' },
    'agent:started': { level: 'info', source: 'system' },
    'agent:completed': { level: 'info', source: 'system' },
    'agent:failed': { level: 'error', source: 'error' },
    'tool:complete': { level: 'info', source: 'tool' },
  }

  const mapping = logMapping[event.type as keyof typeof logMapping]
  if (!mapping) return null

  return createAgentLogEntry({
    id: crypto.randomUUID(),
    timestamp: event.timestamp,
    level: mapping.level as LogLevel,
    source: mapping.source as LogSource,
    message: extractMessage(event),
    metadata: {
      agentId,
      executionId: event.taskId,
      toolName: event.data?.toolName as string | undefined,
      ...extractMetadata(event),
    },
    sequenceNumber: generateSequenceNumber(),
  })
}
```

#### 4. Pause/Resume Mechanism

Track paused state separately from connection state:

```typescript
const isPausedRef = useRef(false)

const handleWebSocketEvent = useCallback((event: ApexEvent) => {
  // Skip processing if paused
  if (isPausedRef.current) return

  // Filter by agentId
  if (event.data?.agentId !== agentId) return

  // Transform and dispatch
  const logEntry = transformEventToLogEntry(event, agentId)
  if (logEntry) {
    dispatch({ type: 'ADD_LOGS', payload: [logEntry] })
    options.onLogs?.([logEntry])
  }
}, [agentId, options.onLogs])

const pause = useCallback(() => {
  isPausedRef.current = true
  dispatch({ type: 'PAUSE' })
}, [])

const resume = useCallback(() => {
  isPausedRef.current = false
  dispatch({ type: 'RESUME' })
}, [])
```

#### 5. Scroll Control Refs

Expose scroll control via refs for parent component integration:

```typescript
const scrollContainerRef = useRef<HTMLElement | null>(null)
const logElementsRef = useRef<Map<string, HTMLElement>>(new Map())

const scrollToLog = useCallback((logId: string) => {
  const element = logElementsRef.current.get(logId)
  element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}, [])

const scrollToBottom = useCallback(() => {
  if (scrollContainerRef.current) {
    scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
  }
}, [])

// Note: Consumer registers elements via returned ref callbacks
```

#### 6. Statistics Calculation

Calculate stats periodically and on demand:

```typescript
const updateStats = useCallback(() => {
  const newStats = calculateLogStreamStats(logs, streamStartedAt)
  dispatch({ type: 'UPDATE_STATS', payload: newStats })
}, [logs, streamStartedAt])

// Update stats every 5 seconds when streaming
useEffect(() => {
  if (isStreaming) {
    const interval = setInterval(updateStats, 5000)
    return () => clearInterval(interval)
  }
}, [isStreaming, updateStats])
```

### Data Flow Diagram

```
WebSocket Event Received (agent:log, agent:output, etc.)
         |
         v
+---------------------+
| Filter by agentId   |---- No match ----> [Skip]
+---------------------+
         |
       Match
         v
+---------------------+
| Check if paused     |---- Paused ------> [Skip, buffer not updated]
+---------------------+
         |
     Not Paused
         v
+---------------------+
| Transform to        |
| AgentLogEntry       |
+---------------------+
         |
         v
+---------------------+
| Dispatch ADD_LOGS   |
| (Ring buffer trim)  |
+---------------------+
         |
         v
+---------------------+
| Apply filter        |-----> filteredLogs updated
+---------------------+
         |
         v
+---------------------+
| Update stream state |
| (count, bytes, ts)  |
+---------------------+
         |
         v
+---------------------+
| Call onLogs         |
| callback if present |
+---------------------+
         |
         v
+---------------------+
| Recalculate stats   |
| (periodic or manual)|
+---------------------+
```

### Connection State Machine

```
                     +-------------+
        +----------->|    IDLE     |<-----------+
        |            +------+------+            |
        |                   |                   |
        |            connect()                  |
        |                   |                   |
        |                   v                   |
        |            +------+------+            |
   disconnect()      | CONNECTING  |            |
        |            +------+------+            |
        |                   |                   |
        |        +----------+----------+        |
        |        |                     |        |
        |     success               failure     |
        |        |                     |        |
        |        v                     v        |
        |  +-----+-----+        +------+------+ |
        +--| STREAMING |        |    ERROR    |-+
        |  +-----+-----+        +------+------+ |
        |        |                     ^        |
        |   pause()                    |        |
        |        |              ws error        |
        |        v                     |        |
        |  +-----+-----+               |        |
        +--|  PAUSED   |---------------+        |
        |  +-----+-----+                        |
        |        |                              |
        |   resume()                            |
        |        |                              |
        |        v                              |
        |  +-----+-----+                        |
        +--| STREAMING |---------ws close-------+
           +-----------+
                 |
           disconnect()
                 |
                 v
           +-----------+
           |DISCONNECTED|
           +-----------+
```

### Error Handling Strategy

1. **WebSocket Errors**: Set `streamState.state = 'error'` and `streamState.error`
2. **Transform Errors**: Log warning, skip invalid events, don't break stream
3. **Callback Errors**: Catch and log, don't affect hook state
4. **Connection Loss**: Update state to `'disconnected'`, track reconnect attempts

### Performance Optimizations

1. **Memoized Selectors**: Use `useMemo` for `filteredLogs` and `stats`
2. **Batched Updates**: Accumulate rapid log events and batch dispatch
3. **Ref-based Pausing**: Use ref instead of state for pause check (no re-render)
4. **Ring Buffer**: Efficient O(1) log trimming with slice
5. **Debounced Stats**: Calculate stats at intervals, not per-log

### Integration Points

#### With AgentTerminalPanel

```typescript
function AgentTerminalPanel({ agentId, maxHeight }: Props) {
  const {
    filteredLogs,
    streamState,
    stats,
    isStreaming,
    isPaused,
    connect,
    disconnect,
    pause,
    resume,
    clearLogs,
    setFilter,
    scrollToBottom,
  } = useAgentLogStream({
    agentId,
    maxLogs: 1000,
    autoConnect: true,
  })

  return (
    <div>
      <LogStreamHeader
        state={streamState}
        stats={stats}
        onPause={pause}
        onResume={resume}
        onClear={clearLogs}
      />
      <LogFilterBar onFilterChange={setFilter} />
      <VirtualLogList logs={filteredLogs} />
      {isStreaming && <StreamingIndicator />}
    </div>
  )
}
```

## Test Coverage

### Unit Test Categories

1. **Initialization**
   - Default state values match constants
   - Options properly applied
   - Auto-connect behavior
   - Initial filter applied

2. **WebSocket Subscription**
   - Subscribes to correct event types on mount
   - Unsubscribes on unmount
   - Filters by agentId

3. **Log Management**
   - Adds logs on events
   - Respects maxLogs limit (ring buffer)
   - Clears logs
   - Adds logs programmatically

4. **Filtering**
   - Level filtering
   - Text search
   - Stage/agent filtering
   - Filter reset

5. **Stream Control**
   - Connect/disconnect
   - Pause/resume (stops log processing)
   - State transitions

6. **Callbacks**
   - onLogs called on new logs
   - onConnectionChange called on status change
   - onError called on errors

7. **Statistics**
   - Correct log counts
   - Logs per second calculation
   - By-level breakdown

8. **Export**
   - JSON format
   - Text format
   - CSV format

## Consequences

### Positive

1. **Complete Solution**: All type definitions already exist, hook implements spec
2. **Consistent Patterns**: Follows existing hook patterns (useAgentMetrics, useApprovalGateWebSocket)
3. **Flexible**: Supports filtering, pausing, callbacks
4. **Performant**: Ring buffer, batching, memoization
5. **Testable**: Clear interface, pure functions for transforms

### Negative

1. **Memory Usage**: 1000 logs * ~1KB = ~1MB max buffer per instance
2. **Complexity**: Multiple concerns (streaming, filtering, stats) in one hook

### Trade-offs

1. **Buffering vs Memory**: maxLogs limits memory but loses history
2. **Real-time vs Performance**: Stats calculated periodically, not per-log
3. **Hook vs Context**: Could use context for multi-component sharing, but hook is simpler

## Alternatives Considered

### 1. Use Existing useRealtimeUpdates Hook
**Rejected**: Too generic, doesn't provide log-specific features (filtering, pause/resume, buffering).

### 2. Create LogStream Context Provider
**Rejected**: Adds complexity for single-component use case. Can be added later if needed for multi-panel scenarios.

### 3. Use External Log Library (pino, winston-browser)
**Rejected**: Overkill for UI display, doesn't integrate with WebSocket transport.

## Implementation Checklist

- [ ] Create hook implementation at `hooks/useAgentLogStream.ts`
- [ ] Implement reducer with all action types
- [ ] Implement WebSocket event subscription
- [ ] Implement log transformation from events
- [ ] Implement ring buffer for log limiting
- [ ] Implement filtering with existing utilities
- [ ] Implement pause/resume mechanism
- [ ] Implement statistics calculation
- [ ] Implement export functionality
- [ ] Implement scroll control refs
- [ ] Add hook to `hooks/index.ts` exports
- [ ] Create comprehensive unit tests
- [ ] Verify build passes
- [ ] Verify tests pass

## References

- Types: `packages/web-ui/src/types/agent-log-stream.ts`
- WebSocket Client: `packages/web-ui/src/lib/websocket-client.ts`
- Similar Hooks:
  - `packages/web-ui/src/hooks/useAgentMetrics.ts`
  - `packages/web-ui/src/components/approval/hooks/useApprovalGateWebSocket.ts`
- Related ADR: `ADR-0004-useApprovalGateWebSocket-hook-architecture.md`
