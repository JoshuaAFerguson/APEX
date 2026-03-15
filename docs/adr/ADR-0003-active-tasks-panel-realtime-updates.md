# ADR-0003: ActiveTasksPanel WebSocket Real-time Updates Integration

## Status
Accepted (Implementation Complete)

## Date
2025-01-15

## Context

The `ActiveTasksPanel` component currently displays tasks using a polling-based or manual refresh approach. The task requires integrating WebSocket real-time updates using the existing `useRealtimeUpdates` hook to provide automatic live updates when task events occur, eliminating the need for page refresh.

### Requirements from Acceptance Criteria
1. ActiveTasksPanel uses `useRealtimeUpdates` hook to receive live task updates
2. Tasks update automatically when events arrive: `task:started`, `task:stage-changed`, `task:completed`, `task:failed`
3. No page refresh needed for updates
4. Connection indicator integrated into panel header

### Current Implementation Analysis

#### ActiveTasksPanel (`components/tasks/ActiveTasksPanel.tsx`)
- Stateless presentation component receiving `tasks: Task[]` as prop
- Provides filtering (all/active/completed/failed/paused)
- Has `onRefresh` callback for manual refresh
- Has `loading` state for UI feedback
- No WebSocket integration currently

#### Existing Infrastructure (from ADR-0002)

1. **`useRealtimeUpdates` hook** (`lib/useRealtimeUpdates.ts`)
   - Provides `state.events` containing transformed `DashboardActivityEvent[]`
   - Connection state management via `state.connectionState`
   - Event filtering via `subscription.eventTypes` and `subscription.taskIds`
   - Already handles `task:started`, `task:stage-changed`, `task:completed`, `task:failed` events

2. **`ApexWebSocketClient`** (`lib/websocket-client.ts`)
   - Task state synchronization via `onState()` handler receiving `Task[]`
   - Individual task updates via event handlers
   - Full health monitoring capabilities

3. **`WebSocketConnectionIndicator`** (`components/connection/`)
   - Pre-built connection status indicator component
   - Multiple sizes (sm/md/lg)
   - Tooltip with detailed health info

4. **Dashboard Types** (`types/dashboard.ts`)
   - `DashboardEventType` includes all required task events
   - `transformApexEvent()` for event enrichment
   - `RealtimeSubscriptionOptions` for filtering

## Decision

### Architecture Overview

Create an **enhanced ActiveTasksPanel** that:
1. Wraps the existing presentation component
2. Integrates `useRealtimeUpdates` for WebSocket events
3. Maintains local task state updated by events
4. Embeds connection indicator in header

```
┌─────────────────────────────────────────────────────────────┐
│ ActiveTasksPanel (Enhanced)                                  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Header                                                   │ │
│ │ ┌──────────────┐  ┌────────────┐  ┌──────────────────┐ │ │
│ │ │ Activity Icon│  │ Task Count │  │ ConnectionIndicator │ │
│ │ └──────────────┘  └────────────┘  └──────────────────┘ │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Filter Tabs: All | Active | Completed | Failed | Paused │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Task Cards (auto-updated via WebSocket)                  │ │
│ │ ┌───────────────────────────────────────────────────┐   │ │
│ │ │ TaskCard (with live progress/status updates)       │   │ │
│ │ └───────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Component Structure

```
packages/web-ui/src/
├── components/
│   └── tasks/
│       ├── ActiveTasksPanel.tsx          # Existing (modified)
│       ├── ActiveTasksPanelRealtime.tsx  # New: Enhanced wrapper with WebSocket
│       ├── TaskCard.tsx                  # Existing (unchanged)
│       ├── index.ts                      # Add new export
│       └── __tests__/
│           ├── ActiveTasksPanel.test.tsx           # Existing
│           └── ActiveTasksPanelRealtime.test.tsx   # New tests
```

### Interface Design

#### New Props for Enhanced Panel

```typescript
// ActiveTasksPanelRealtime.tsx

export interface ActiveTasksPanelRealtimeProps {
  /** Initial tasks to display (optional - will fetch via WebSocket if not provided) */
  initialTasks?: Task[]

  /** Optional callback when user wants to view task details */
  onViewDetails?: (taskId: string) => void

  /** Whether to show only active tasks by default */
  defaultShowActiveOnly?: boolean

  /** Maximum number of tasks to display */
  maxTasks?: number

  /** Whether to show the panel in compact mode */
  compact?: boolean

  /** Whether to show connection indicator in header */
  showConnectionIndicator?: boolean

  /** Filter to specific task IDs (for focused views) */
  taskIds?: string[]

  /** Connection indicator size */
  connectionIndicatorSize?: 'sm' | 'md' | 'lg'
}
```

#### Hook Configuration

```typescript
// Internal hook usage
const {
  state: { connectionState, events, isConnected },
  connect,
  disconnect,
} = useRealtimeUpdates({
  autoConnect: true,
  subscription: {
    eventTypes: [
      'task:started',
      'task:stage-changed',
      'task:completed',
      'task:failed',
      'task:created',
      'task:paused',
    ],
    taskIds: props.taskIds, // Optional filtering
    includeHealth: true,
    includePerformance: false, // Not needed for this component
  },
})
```

### Event Handling Strategy

#### Event-to-State Mapping

| Event Type | State Update Action |
|------------|---------------------|
| `task:created` | Add new task to state |
| `task:started` | Update task status to 'running', update `updatedAt` |
| `task:stage-changed` | Update `currentStage`, update `updatedAt` |
| `task:completed` | Update status to 'completed', update `updatedAt` |
| `task:failed` | Update status to 'failed', set `error`, update `updatedAt` |
| `task:paused` | Update status to 'paused', update `updatedAt` |

#### Task State Management

```typescript
// Internal state management
const [tasks, setTasks] = useState<Task[]>(initialTasks || [])

// Event processor using useEffect
useEffect(() => {
  if (events.length === 0) return

  const latestEvent = events[0] // Events are sorted most recent first
  const eventType = latestEvent.type

  setTasks(prevTasks => {
    // Handle task:created
    if (eventType === 'task:created' && latestEvent.data.task) {
      const newTask = latestEvent.data.task as Task
      if (!prevTasks.some(t => t.id === newTask.id)) {
        return [newTask, ...prevTasks]
      }
    }

    // Handle status updates
    if (eventType.startsWith('task:')) {
      return prevTasks.map(task => {
        if (task.id !== latestEvent.taskId) return task

        const updates: Partial<Task> = {
          updatedAt: latestEvent.timestamp.toISOString(),
        }

        switch (eventType) {
          case 'task:started':
            updates.status = 'in-progress'
            break
          case 'task:stage-changed':
            updates.currentStage = latestEvent.data.stageName as string
            break
          case 'task:completed':
            updates.status = 'completed'
            break
          case 'task:failed':
            updates.status = 'failed'
            updates.error = latestEvent.data.error as string
            break
          case 'task:paused':
            updates.status = 'paused'
            break
        }

        return { ...task, ...updates }
      })
    }

    return prevTasks
  })
}, [events])
```

### Connection Indicator Integration

The header modification adds the connection indicator:

```tsx
<CardHeader>
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-2">
      <Activity className="w-5 h-5 text-apex-500" />
      <h3 className="font-semibold">Active Tasks</h3>
      <Badge>{stats.total}</Badge>
    </div>

    <div className="flex items-center gap-2">
      {/* Connection Indicator - NEW */}
      {showConnectionIndicator && (
        <WebSocketConnectionIndicator
          size={connectionIndicatorSize}
          showLatency={connectionIndicatorSize !== 'sm'}
          animated
        />
      )}

      {/* Existing refresh button (optional - may be hidden when connected) */}
      {!isConnected && onRefresh && (
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      )}
    </div>
  </div>
</CardHeader>
```

### Backward Compatibility

The existing `ActiveTasksPanel` component remains unchanged:
- Components using the polling approach can continue using it
- The new `ActiveTasksPanelRealtime` is an optional upgrade
- Both are exported from `components/tasks/index.ts`

```typescript
// index.ts
export { ActiveTasksPanel } from './ActiveTasksPanel'
export { ActiveTasksPanelRealtime } from './ActiveTasksPanelRealtime'
export type { ActiveTasksPanelProps } from './ActiveTasksPanel'
export type { ActiveTasksPanelRealtimeProps } from './ActiveTasksPanelRealtime'
```

### Testing Strategy

#### Unit Tests

1. **Event Processing Tests**
   ```typescript
   describe('ActiveTasksPanelRealtime', () => {
     it('adds new task on task:created event')
     it('updates task status on task:started event')
     it('updates currentStage on task:stage-changed event')
     it('marks task completed on task:completed event')
     it('marks task failed with error on task:failed event')
     it('ignores events for non-existent tasks')
     it('shows connection indicator when showConnectionIndicator=true')
   })
   ```

2. **Connection State Tests**
   ```typescript
   describe('Connection handling', () => {
     it('shows "Connecting..." state initially')
     it('shows "Connected" when WebSocket connects')
     it('shows "Reconnecting" during reconnection')
     it('hides refresh button when connected')
     it('shows refresh button when disconnected')
   })
   ```

#### Integration Tests

```typescript
describe('Real-time integration', () => {
  it('receives and processes WebSocket task events')
  it('maintains task order after updates')
  it('applies filters to real-time updated tasks')
  it('recovers gracefully from connection loss')
})
```

### Performance Considerations

1. **Event Batching**: Process multiple events in a single state update when they arrive in quick succession
2. **Memoization**: Use `useMemo` for filtered tasks and statistics
3. **Connection Sharing**: Reuse existing WebSocket client singleton
4. **Cleanup**: Properly disconnect/unsubscribe on unmount

### Error Handling

```typescript
// Connection error display
{state.error && (
  <div className="text-red-400 text-sm p-2 bg-red-950/50 rounded">
    Connection error: {state.error.message}
  </div>
)}

// Graceful degradation
if (state.connectionState === 'error' || state.connectionState === 'disconnected') {
  // Fall back to showing initialTasks with manual refresh option
}
```

## Implementation Plan

### Phase 1: Component Implementation
1. Create `ActiveTasksPanelRealtime.tsx` with WebSocket integration
2. Implement event-to-state mapping logic
3. Add connection indicator to header
4. Export from index.ts

### Phase 2: Testing
1. Unit tests for event handling
2. Integration tests with mock WebSocket
3. Edge case testing (rapid events, reconnection)

### Phase 3: Documentation
1. Update component documentation
2. Add usage examples
3. Document migration path from polling

## Consequences

### Positive
- **Real-time Updates**: Tasks update instantly without page refresh
- **Improved UX**: Users see changes as they happen
- **Connection Visibility**: Clear indication of connection health
- **Backward Compatible**: Existing polling approach still works
- **Leverages Existing Infrastructure**: Reuses proven WebSocket code

### Negative
- **Complexity**: Additional component wrapper adds code
- **State Management**: Local state must be kept in sync with events
- **Bundle Size**: Small increase from new component

### Risks
- **Event Ordering**: Out-of-order events could cause incorrect state
- **State Drift**: Local state could diverge from server state over time
- **Connection Flapping**: Rapid connect/disconnect cycles need handling

### Mitigations
- Event timestamps for ordering
- Periodic full state sync (via `task:state` event)
- Debounced connection status updates

## Alternatives Considered

### 1. Modify Existing ActiveTasksPanel Directly
**Rejected**: Would break backward compatibility and complicate testing. Better to create wrapper.

### 2. Global Task State Management (Redux/Context)
**Rejected**: Over-engineering for current needs. Local component state is simpler and sufficient.

### 3. Server-Sent Events (SSE) Instead of WebSocket
**Rejected**: WebSocket infrastructure already exists and is battle-tested.

### 4. Polling with Short Interval
**Rejected**: Inefficient compared to WebSocket push. Higher server load and latency.

## References

- ADR-0002: WebSocketConnectionIndicator Component Architecture
- `packages/web-ui/src/lib/useRealtimeUpdates.ts`
- `packages/web-ui/src/lib/websocket-client.ts`
- `packages/web-ui/src/components/tasks/ActiveTasksPanel.tsx`
- `packages/web-ui/src/types/dashboard.ts`
