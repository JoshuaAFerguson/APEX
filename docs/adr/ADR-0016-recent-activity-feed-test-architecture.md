# ADR-0016: RecentActivityFeed Component Test Architecture

## Status

Accepted

## Date

2026-03-15

## Context

The RecentActivityFeed component is a planned v0.7.0 feature for the web dashboard that displays real-time activity events. This ADR defines the test architecture following TDD principles - tests are written first to define component behavior before implementation.

### Acceptance Criteria (from Task)

**Unit Tests**:
- Event rendering with correct structure
- Icon mapping for different event types
- Timestamp formatting (relative time display)
- 20-event limit enforcement
- Scrolling behavior (scrollable container)

**Integration Tests**:
- Real-time WebSocket updates
- Event filtering functionality

## Decision

### 1. Component Interface Design

Based on existing dashboard types in `src/types/dashboard.ts` and patterns from similar components (ActiveTasksPanel, WebSocketConnectionIndicator), the RecentActivityFeed will use:

```typescript
// RecentActivityFeedProps interface
interface RecentActivityFeedProps {
  /** Activity events to display (most recent first) */
  events: DashboardActivityEvent[]

  /** Maximum number of events to display (default: 20) */
  maxEvents?: number

  /** Optional callback when an event is clicked */
  onEventClick?: (eventId: string) => void

  /** Optional callback to mark event as read */
  onMarkRead?: (eventId: string) => void

  /** Optional callback to mark all events as read */
  onMarkAllRead?: () => void

  /** Optional callback to clear all events */
  onClear?: () => void

  /** Active filter by category */
  activeFilter?: ActivityEventCategory | 'all'

  /** Callback when filter changes */
  onFilterChange?: (filter: ActivityEventCategory | 'all') => void

  /** Whether the panel is loading */
  loading?: boolean

  /** Whether to show the panel in compact mode */
  compact?: boolean

  /** Optional class name for styling */
  className?: string
}
```

### 2. Test Architecture

#### 2.1 Test File Structure

```
packages/web-ui/src/components/dashboard/__tests__/
├── RecentActivityFeed.test.tsx           # Unit tests (core functionality)
├── RecentActivityFeed.integration.test.tsx # Integration tests (WebSocket)
├── RecentActivityFeed.edge-cases.test.tsx  # Edge cases and error handling
└── RecentActivityFeed.accessibility.test.tsx # Accessibility tests (optional)
```

#### 2.2 Unit Test Categories

**Event Rendering Tests** (`RecentActivityFeed.test.tsx`):
- Renders activity events with correct structure (title, timestamp, icon)
- Displays event details: title, description, taskId
- Shows event severity styling (info, success, warning, error)
- Handles empty event list with appropriate message
- Renders loading state correctly

**Icon Mapping Tests**:
- Maps event categories to correct icons (task → CheckCircle, agent → Bot, etc.)
- Maps event severities to icon colors
- Falls back to default icon for unknown event types

**Timestamp Formatting Tests**:
- Displays relative time for recent events ("just now", "5m ago", "2h ago")
- Displays formatted date for older events
- Updates timestamp display (if component implements auto-refresh)

**20-Event Limit Tests**:
- Enforces maxEvents limit (default 20)
- Accepts custom maxEvents prop
- Displays most recent events first
- Shows "showing N of M events" message when limited

**Scrolling Behavior Tests**:
- Container has scrollable overflow styles
- Maintains scroll position on new events
- Scrolls to top when filter changes
- Shows scroll indicators when content overflows

#### 2.3 Integration Test Categories

**WebSocket Updates Tests** (`RecentActivityFeed.integration.test.tsx`):
- Receives and displays new events from WebSocket
- Updates UI in real-time without full re-render
- Handles rapid event updates without UI flickering
- Maintains event order (most recent first)
- Preserves read/unread state across updates
- Handles connection loss/reconnection gracefully

**Event Filtering Tests**:
- Filters events by category (task, agent, tool, gate, permission, system, error)
- Shows "All" filter option
- Maintains filter selection across WebSocket updates
- Shows empty state when no events match filter
- Filter counts update in real-time

### 3. Test Patterns and Utilities

#### 3.1 Mock Event Factory

```typescript
// Test utility: Create mock DashboardActivityEvent
const createMockEvent = (overrides: Partial<DashboardActivityEvent> = {}): DashboardActivityEvent => ({
  id: `event-${Math.random().toString(36).substring(2, 9)}`,
  type: 'task:created',
  category: 'task',
  severity: 'info',
  taskId: 'test-task-123',
  title: 'Task created',
  description: 'A test task was created',
  timestamp: new Date(),
  data: {},
  isRead: false,
  ...overrides,
})
```

#### 3.2 WebSocket Mock Pattern

Following the pattern established in `ActiveTasksPanel.websocket-integration.test.tsx`:

```typescript
// Mock WebSocket infrastructure
class MockWebSocket extends EventTarget {
  public readyState: number = WebSocket.CLOSED
  // ... connection management

  simulateMessage(data: any) {
    const event = new MessageEvent('message', {
      data: JSON.stringify(data)
    })
    this.onmessage?.(event)
    this.dispatchEvent(event)
  }
}
```

#### 3.3 Test Data Patterns

```typescript
// Event type varieties for comprehensive testing
const eventTypes: Array<{ type: DashboardEventType; category: ActivityEventCategory }> = [
  { type: 'task:created', category: 'task' },
  { type: 'task:completed', category: 'task' },
  { type: 'task:failed', category: 'task' },
  { type: 'agent:message', category: 'agent' },
  { type: 'agent:tool-use', category: 'agent' },
  { type: 'tool:complete', category: 'tool' },
  { type: 'gate:required', category: 'gate' },
  { type: 'permission:request', category: 'permission' },
  { type: 'mcp:connected', category: 'system' },
]
```

### 4. Icon Mapping Specification

Based on existing UI patterns and lucide-react icons used in the codebase:

| Category    | Icon            | Color (severity-based)                    |
|-------------|-----------------|-------------------------------------------|
| task        | CheckSquare     | info=blue, success=green, error=red       |
| agent       | Bot             | info=blue, warning=yellow                 |
| tool        | Wrench          | info=blue, success=green, error=red       |
| gate        | Shield          | warning=yellow, success=green, error=red  |
| permission  | Lock/Unlock     | warning=yellow, success=green, error=red  |
| system      | Settings        | info=blue, warning=yellow                 |
| error       | AlertCircle     | error=red                                 |

### 5. Component Dependencies

**Internal Dependencies**:
- `@/lib/utils` - `cn()`, `getRelativeTime()`, `formatDate()`
- `@/types/dashboard` - `DashboardActivityEvent`, `ActivityEventCategory`, `ActivityEventSeverity`
- `@/components/ui/Card` - Container styling
- `@/components/ui/Badge` - Category/severity badges
- `@/components/ui/Button` - Filter buttons, actions

**External Dependencies**:
- `lucide-react` - Icons
- `@testing-library/react` - Test rendering
- `vitest` - Test framework

### 6. Test Configuration

Tests will use the existing `packages/web-ui/vitest.config.ts` configuration with jsdom environment. Setup files:
- `./src/__tests__/setup.ts` - React/DOM setup
- `../../test-setup.ts` - Global test setup

### 7. Performance Considerations

**Test Performance**:
- Use `vi.useFakeTimers()` for time-dependent tests
- Mock expensive operations (DOM measurements)
- Batch multiple assertions to reduce render cycles

**Component Performance** (tested via integration tests):
- Handle 50+ rapid WebSocket events in <1s
- Render 100+ events without performance degradation
- Efficient re-rendering (only changed events update)

## Consequences

### Positive

1. **TDD Approach**: Tests define expected behavior before implementation
2. **Comprehensive Coverage**: Unit, integration, and edge case tests ensure quality
3. **Pattern Consistency**: Follows existing patterns from ActiveTasksPanel tests
4. **Type Safety**: Interface defined upfront ensures consistent implementation
5. **Maintainability**: Clear test structure makes debugging easier

### Negative

1. **Initial Overhead**: Writing tests before implementation requires more upfront design
2. **Potential Refactoring**: Implementation may require test adjustments

### Neutral

1. **Test-First Discipline**: Requires commitment to TDD methodology
2. **Mock Complexity**: WebSocket mocking adds test infrastructure overhead

## Implementation Plan

1. **Phase 1**: Create unit test file with rendering, icon mapping, timestamp tests
2. **Phase 2**: Create integration test file with WebSocket and filtering tests
3. **Phase 3**: Run tests (expect all to fail - TDD red phase)
4. **Phase 4**: Implementation team creates component to pass tests

## Related Documents

- [ADR-0015: ActiveTasksPanel Dashboard Integration](./ADR-0015-active-tasks-panel-dashboard-integration.md)
- [Dashboard Types](../packages/web-ui/src/types/dashboard.ts)
- [ActiveTasksPanel Tests](../packages/web-ui/src/components/tasks/__tests__/ActiveTasksPanel.test.tsx)
