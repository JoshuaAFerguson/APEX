# ADR-0004: RecentActivityFeed WebSocket Real-Time Integration

## Status
**Proposed**

## Date
2026-03-15

## Context

The RecentActivityFeed component needs to integrate with WebSocket real-time updates to display activity events without requiring page refreshes. The acceptance criteria include:

1. RecentActivityFeed uses `useRealtimeUpdates` hook to subscribe to events
2. New events appear in real-time without page refresh
3. Event list auto-updates and maintains 20-event limit
4. Connection status is properly handled (loading, error states)

### Existing Infrastructure Analysis

After analyzing the codebase, we have robust infrastructure already in place:

1. **`useRealtimeUpdates` hook** (`/packages/web-ui/src/lib/useRealtimeUpdates.ts`)
   - Fully implemented React hook for subscribing to WebSocket events
   - Manages connection state (`disconnected`, `connecting`, `connected`, `reconnecting`, `error`)
   - Provides `DashboardActivityEvent[]` through `state.events`
   - Includes `maxEvents` option (default 500)
   - Has `markEventRead`, `markAllEventsRead`, `clearEvents` functions
   - Supports subscription filtering by `taskIds` and `eventTypes`

2. **`ApexWebSocketClient`** (`/packages/web-ui/src/lib/websocket-client.ts`)
   - Robust WebSocket client with:
     - Exponential backoff reconnection
     - Health checks with ping/pong
     - Connection health management
     - Event filtering and wildcard subscription

3. **`DashboardActivityEvent` type** (`/packages/web-ui/src/types/dashboard.ts`)
   - Fully typed event structure including:
     - `id`, `type`, `category`, `severity`
     - `taskId`, `title`, `description`
     - `timestamp`, `data`, `isRead`
     - `agentName`, `toolName`

4. **`ActiveTasksPanelRealtime`** - Reference implementation demonstrating:
   - How to use `useRealtimeUpdates` hook
   - Event processing patterns
   - Connection state visualization
   - Filter/limit management

## Decision

### Architecture Overview

Create `RecentActivityFeed` component following the established patterns from `ActiveTasksPanelRealtime`, with the following architectural decisions:

```
┌──────────────────────────────────────────────────────────────────┐
│                     RecentActivityFeed                            │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Header Bar                                                 │  │
│  │  [Activity Icon] Recent Activity    [ConnectionIndicator]   │  │
│  │  [Filter Chips: All | Task | Agent | Tool | Error]          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Event List (max 20 events)                                 │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ [Icon] Event Title                        [timestamp] │  │  │
│  │  │        Description/details                  [taskId]  │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │  ... (auto-updating list)                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Footer: "Live updates active" / "Disconnected warning"    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Component Structure

```typescript
// File: packages/web-ui/src/components/activity/RecentActivityFeed.tsx

interface RecentActivityFeedProps {
  /** Maximum number of events to display (default: 20) */
  maxEvents?: number

  /** Filter to specific task IDs */
  taskIds?: string[]

  /** Filter to specific event categories */
  categories?: ActivityEventCategory[]

  /** Whether to auto-connect on mount */
  autoConnect?: boolean

  /** Show connection indicator in header */
  showConnectionIndicator?: boolean

  /** Compact mode for smaller displays */
  compact?: boolean

  /** Callback when event is clicked */
  onEventClick?: (event: DashboardActivityEvent) => void

  /** Custom className */
  className?: string
}
```

### Key Design Decisions

#### 1. Event Limit Management (20 events)

The `useRealtimeUpdates` hook already handles event limiting internally, but we'll apply our own limit for display:

```typescript
const displayEvents = useMemo(() => {
  let filtered = state.events;

  // Apply category filter
  if (categoryFilter !== 'all') {
    filtered = filtered.filter(e => e.category === categoryFilter);
  }

  // Limit to 20 events
  return filtered.slice(0, maxEvents);
}, [state.events, categoryFilter, maxEvents]);
```

#### 2. Connection State Handling

Leverage existing `WebSocketConnectionIndicator` component with fallback states:

| State | Visual | User Action |
|-------|--------|-------------|
| `connecting` | Spinner + "Connecting..." | None required |
| `connected` | Green dot + latency | None required |
| `reconnecting` | Yellow pulse + attempts | None required |
| `disconnected` | Red dot + "Disconnected" | Show refresh button |
| `error` | Red alert + message | Show retry button |

#### 3. Real-Time Update Flow

```
WebSocket Event → useRealtimeUpdates → state.events → RecentActivityFeed
                       ↓
             transformApexEvent() → DashboardActivityEvent
                       ↓
               events array (most recent first)
                       ↓
               Component re-renders with new event at top
```

#### 4. Category Filtering

Use existing `ActivityEventCategory` type with filter chips:

```typescript
type FilterType = 'all' | ActivityEventCategory
// = 'all' | 'task' | 'agent' | 'tool' | 'gate' | 'permission' | 'system' | 'error'
```

### File Structure

```
packages/web-ui/src/components/activity/
├── RecentActivityFeed.tsx          # Main component
├── ActivityEventItem.tsx           # Individual event row
├── ActivityEventFilters.tsx        # Filter chip bar
├── index.ts                        # Barrel export
└── __tests__/
    ├── RecentActivityFeed.test.tsx
    ├── RecentActivityFeed.integration.test.tsx
    └── ActivityEventItem.test.tsx
```

### Integration Points

1. **Hook Usage**:
```typescript
const {
  state: { connectionState, events, isConnected, error },
  connect,
  disconnect,
  markEventRead,
  markAllEventsRead,
  clearEvents,
} = useRealtimeUpdates({
  autoConnect,
  maxEvents: maxEvents * 2, // Buffer extra for filtering
  subscription: {
    eventTypes: [], // All events
    taskIds,
    includeHealth: showConnectionIndicator,
    includePerformance: false,
  },
});
```

2. **Reusing Existing Components**:
   - `WebSocketConnectionIndicator` for connection status
   - `Badge` for severity indicators
   - `Card`, `CardHeader`, `CardContent` for container

3. **Styling Consistency**:
   - Use `cn()` utility from `@/lib/utils`
   - Follow Tailwind patterns from `ActiveTasksPanelRealtime`
   - Match existing color scheme for severities

### Event Rendering Pattern

```typescript
function getEventIcon(event: DashboardActivityEvent) {
  switch (event.category) {
    case 'task': return <Activity />;
    case 'agent': return <Bot />;
    case 'tool': return <Wrench />;
    case 'error': return <AlertCircle />;
    case 'gate': return <ShieldCheck />;
    case 'permission': return <Lock />;
    default: return <Info />;
  }
}

function getSeverityStyle(severity: ActivityEventSeverity) {
  switch (severity) {
    case 'success': return 'text-green-400 bg-green-950/30';
    case 'warning': return 'text-yellow-400 bg-yellow-950/30';
    case 'error': return 'text-red-400 bg-red-950/30';
    default: return 'text-foreground-secondary bg-background-secondary';
  }
}
```

## Consequences

### Positive
- Leverages fully tested existing infrastructure (`useRealtimeUpdates`, `ApexWebSocketClient`)
- Consistent with `ActiveTasksPanelRealtime` patterns already in codebase
- Full type safety with existing `DashboardActivityEvent` types
- Automatic reconnection and health monitoring via existing WebSocket client
- Event transformation already handled by `transformApexEvent`

### Negative
- Adds another WebSocket subscriber (minimal overhead as client is shared)
- Filter state managed per-component (not persisted)

### Neutral
- 20-event limit is UI-only; underlying hook buffers more events
- Component must handle unmount cleanup (handled by hook's useEffect)

## Implementation Checklist

1. [ ] Create `packages/web-ui/src/components/activity/` directory
2. [ ] Implement `ActivityEventItem.tsx` - single event row component
3. [ ] Implement `ActivityEventFilters.tsx` - filter chip bar
4. [ ] Implement `RecentActivityFeed.tsx` - main component
5. [ ] Create barrel export `index.ts`
6. [ ] Add unit tests for all components
7. [ ] Add integration tests for WebSocket event handling
8. [ ] Update dashboard exports if needed

## Technical Specifications

### Props Interface (Complete)

```typescript
export interface RecentActivityFeedProps {
  /** Maximum number of events to display (default: 20 per acceptance criteria) */
  maxEvents?: number

  /** Filter to specific task IDs (empty = all) */
  taskIds?: string[]

  /** Initial category filter */
  defaultCategory?: 'all' | ActivityEventCategory

  /** Whether to auto-connect WebSocket on mount (default: true) */
  autoConnect?: boolean

  /** Show WebSocket connection indicator in header (default: true) */
  showConnectionIndicator?: boolean

  /** Connection indicator size */
  connectionIndicatorSize?: 'sm' | 'md' | 'lg'

  /** Compact display mode */
  compact?: boolean

  /** Hide filter bar */
  hideFilters?: boolean

  /** Callback when event is clicked */
  onEventClick?: (event: DashboardActivityEvent) => void

  /** Callback when "Mark all read" is clicked */
  onMarkAllRead?: () => void

  /** Custom className */
  className?: string
}
```

### State Management

```typescript
// Internal state
const [categoryFilter, setCategoryFilter] = useState<'all' | ActivityEventCategory>(
  defaultCategory ?? 'all'
);

// Derived from hook
const displayEvents = useMemo(() => {
  let filtered = events;
  if (categoryFilter !== 'all') {
    filtered = filtered.filter(e => e.category === categoryFilter);
  }
  return filtered.slice(0, maxEvents);
}, [events, categoryFilter, maxEvents]);

const unreadCount = useMemo(() =>
  displayEvents.filter(e => !e.isRead).length,
  [displayEvents]
);
```

### Testing Strategy

1. **Unit Tests**:
   - Component renders correctly with empty events
   - Events display with correct formatting
   - Category filtering works
   - Event limit (20) is enforced
   - Connection states render correctly

2. **Integration Tests**:
   - WebSocket event subscription
   - Real-time event updates
   - Reconnection handling
   - Error state recovery

3. **Mock Strategy** (following existing patterns):
   - Mock `useRealtimeUpdates` hook
   - Use test data factories for events
   - Simulate connection state transitions

## References

- `ActiveTasksPanelRealtime.tsx` - Reference implementation
- `useRealtimeUpdates.ts` - Core hook being used
- `websocket-client.ts` - WebSocket infrastructure
- `dashboard.ts` - Type definitions
- ADR-0003 - Active Tasks Panel architecture
