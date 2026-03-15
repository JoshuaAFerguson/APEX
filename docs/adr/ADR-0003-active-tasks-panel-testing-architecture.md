# ADR-0003: ActiveTasksPanel and WebSocketConnectionIndicator Testing Architecture

## Status
Proposed

## Date
2026-03-15

## Context

The APEX web-ui requires comprehensive test coverage for the `ActiveTasksPanel` and `WebSocketConnectionIndicator` components. These components are critical for real-time task monitoring and connection status visualization in the dashboard.

### Current Implementation Analysis

**Components Under Test:**

1. **ActiveTasksPanel** (`packages/web-ui/src/components/tasks/ActiveTasksPanel.tsx`)
   - Static task panel with filtering capabilities
   - Props: tasks, onViewDetails, onRefresh, loading, defaultShowActiveOnly, maxTasks, compact, onCancel, onRetry
   - Features: Task filtering (all/active/completed/failed/paused), task statistics, sorting by update time

2. **ActiveTasksPanelRealtime** (`packages/web-ui/src/components/tasks/ActiveTasksPanelRealtime.tsx`)
   - Real-time enabled version with WebSocket integration
   - Uses `useRealtimeUpdates` hook for live task updates
   - Integrates `WebSocketConnectionIndicator` in header
   - Processes task events: task:created, task:started, task:stage-changed, task:completed, task:failed, task:paused

3. **WebSocketConnectionIndicator** (`packages/web-ui/src/components/connection/WebSocketConnectionIndicator.tsx`)
   - Visual badge showing connection status
   - Size variants: sm, md, lg
   - Status states: connected, disconnected, connecting, reconnecting, error
   - Features: latency display, reconnection attempts, tooltip with health details

### Existing Test Coverage Analysis

| Component | Unit Tests | Integration Tests | Edge Cases | Coverage |
|-----------|-----------|-------------------|------------|----------|
| ActiveTasksPanel | ✅ Basic (224 lines) | ❌ Missing | ❌ Missing | ~70% |
| ActiveTasksPanelRealtime | ✅ Basic (479 lines) | ⚠️ Limited | ❌ Missing | ~60% |
| WebSocketConnectionIndicator | ✅ Comprehensive (431 lines) | ✅ Good (355 lines) | ✅ Good (695 lines) | ~85% |

### Test Gaps Identified

**ActiveTasksPanel:**
- Missing task card variant tests (different task statuses rendering)
- Missing empty state edge cases
- Missing loading state transitions
- Missing error handling scenarios
- Missing accessibility tests
- Missing performance tests with large task lists

**ActiveTasksPanelRealtime:**
- Limited WebSocket event handling tests
- Missing event processing verification for UI updates
- Missing reconnection scenario tests
- Missing error recovery tests
- Missing state synchronization tests

**WebSocketConnectionIndicator:**
- Good coverage exists but some edge cases need attention:
  - Rapid state transitions
  - Memory leak prevention
  - Animation state management

## Decision

### Testing Architecture

#### 1. Test Layering Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                     E2E Tests (Playwright)                       │
│  Full user workflows, real WebSocket connections                 │
└─────────────────────────────────────────────────────────────────┘
                               ▲
┌─────────────────────────────────────────────────────────────────┐
│                 Integration Tests (Vitest + RTL)                 │
│  Component interactions, mocked WebSocket, event processing      │
└─────────────────────────────────────────────────────────────────┘
                               ▲
┌─────────────────────────────────────────────────────────────────┐
│                     Unit Tests (Vitest + RTL)                    │
│  Component rendering, prop handling, state management            │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Test File Structure

```
packages/web-ui/src/
├── components/
│   ├── tasks/
│   │   └── __tests__/
│   │       ├── ActiveTasksPanel.test.tsx           # Unit tests
│   │       ├── ActiveTasksPanel.edge-cases.test.tsx # Edge cases
│   │       ├── ActiveTasksPanelRealtime.test.tsx   # Unit tests
│   │       ├── ActiveTasksPanelRealtime.integration.test.tsx # Integration
│   │       └── TaskCard.variants.test.tsx          # Task card variants
│   │
│   └── connection/
│       └── __tests__/
│           ├── WebSocketConnectionIndicator.test.tsx
│           ├── WebSocketConnectionIndicator.integration.test.tsx
│           ├── WebSocketConnectionIndicator.edge-cases.test.tsx
│           └── WebSocketConnectionIndicator.transitions.test.tsx
│
└── __tests__/
    └── integration/
        └── websocket-ui-sync.integration.test.tsx  # Cross-component integration
```

#### 3. Test Categories and Coverage

##### ActiveTasksPanel Unit Tests (Enhancement)

```typescript
describe('ActiveTasksPanel', () => {
  describe('Component Rendering', () => {
    // - Renders with default props
    // - Renders all task cards correctly
    // - Renders empty state when no tasks
    // - Renders loading state
    // - Renders compact mode
  });

  describe('Task Card Variants', () => {
    // - Running task with progress
    // - Completed task with completion time
    // - Failed task with error message
    // - Paused task with resume option
    // - Queued task
    // - Pending task
    // - Awaiting approval task
  });

  describe('Filter Functionality', () => {
    // - Filter by all
    // - Filter by active (running/queued/pending)
    // - Filter by completed
    // - Filter by failed (failed/cancelled)
    // - Filter by paused (paused/awaiting-approval)
    // - Filter counts update correctly
    // - Filter button styling reflects selection
  });

  describe('Task Statistics', () => {
    // - Calculates total count
    // - Calculates active count
    // - Calculates completed count
    // - Calculates failed count
    // - Calculates paused count
    // - Updates when tasks change
  });

  describe('Sorting and Limiting', () => {
    // - Sorts by most recently updated
    // - Respects maxTasks limit
    // - Shows "more tasks" indicator
  });

  describe('User Interactions', () => {
    // - Calls onViewDetails when task clicked
    // - Calls onRefresh when refresh clicked
    // - Calls onCancel when cancel clicked
    // - Calls onRetry when retry clicked
    // - Shows action loading state
  });

  describe('Accessibility', () => {
    // - Filter buttons are keyboard accessible
    // - Task cards have proper ARIA labels
    // - Loading state is announced
    // - Empty state is properly announced
  });
});
```

##### ActiveTasksPanelRealtime Integration Tests (New)

```typescript
describe('ActiveTasksPanelRealtime Integration', () => {
  describe('WebSocket Event Handling', () => {
    // - task:created adds new task to UI
    // - task:started updates task status to running
    // - task:stage-changed updates current stage
    // - task:completed marks task as completed
    // - task:failed marks task as failed with error
    // - task:paused updates task status to paused
    // - Multiple rapid events processed correctly
    // - Events for unknown tasks are handled gracefully
  });

  describe('Connection State Integration', () => {
    // - Shows connection indicator when connected
    // - Shows connecting state during connection
    // - Shows disconnected state with refresh button
    // - Shows error state with error message
    // - Reconnection attempts displayed
    // - Manual refresh triggers reconnection
  });

  describe('State Synchronization', () => {
    // - Initial tasks render correctly
    // - WebSocket updates merge with initial tasks
    // - Duplicate task IDs handled correctly
    // - Task order maintained after updates
    // - Filter state preserved during updates
  });

  describe('Error Recovery', () => {
    // - Connection timeout shows error
    // - Network error shows error state
    // - Reconnection recovers state
    // - Tasks preserved during reconnection
  });

  describe('Performance', () => {
    // - Handles 100+ task updates efficiently
    // - Re-renders minimized during updates
    // - Event processing doesn't block UI
  });
});
```

##### WebSocketConnectionIndicator Tests (Enhance State Transitions)

```typescript
describe('WebSocketConnectionIndicator Transitions', () => {
  describe('State Machine Transitions', () => {
    // - disconnected → connecting → connected
    // - connected → disconnected
    // - connected → reconnecting → connected
    // - reconnecting → error (max attempts)
    // - error → connecting → connected (retry)
  });

  describe('Animation States', () => {
    // - Pulse animation on connecting
    // - Spin animation on reconnecting icon
    // - No animation when connected
    // - Pulse on disconnected/error
    // - Animation disabled when animated=false
  });

  describe('Latency Display', () => {
    // - Shows latency when connected and enabled
    // - Shows "Connected" when latency disabled
    // - Formats milliseconds correctly
    // - Formats seconds for high latency
    // - Handles null latency gracefully
  });

  describe('Reconnection Display', () => {
    // - Shows attempt count (X/Y)
    // - Updates during reconnection
    // - Hidden when showReconnectAttempts=false
    // - Shows "Reconnecting" when attempts=0
  });
});
```

#### 4. Mock Strategies

```typescript
// Mock useRealtimeUpdates hook
vi.mock('@/lib/useRealtimeUpdates', () => ({
  useRealtimeUpdates: vi.fn(() => ({
    state: {
      connectionState: 'connected',
      events: [],
      isConnected: true,
      error: null,
      health: {} as any,
      performance: {} as any,
      lastUpdate: new Date(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    markEventRead: vi.fn(),
    markAllEventsRead: vi.fn(),
    clearEvents: vi.fn(),
    updateSubscription: vi.fn(),
    refreshPerformance: vi.fn(),
    checkHealth: vi.fn(),
  })),
}));

// Mock useWebSocketConnection hook
vi.mock('@/hooks/useWebSocketConnection', () => ({
  useWebSocketConnection: vi.fn(() => ({
    status: 'connected',
    isHealthy: true,
    latencyMs: 45,
    averageLatencyMs: 52,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    consecutiveFailures: 0,
    lastHealthyAt: new Date(),
    lastCheckAt: new Date(),
    connectionUptime: 3600000,
  })),
}));

// Mock WebSocketConnectionIndicator for isolation
vi.mock('@/components/connection/WebSocketConnectionIndicator', () => ({
  WebSocketConnectionIndicator: ({ size, showLatency }) => (
    <div data-testid="connection-indicator" data-size={size}>
      Connection Indicator
    </div>
  ),
}));

// Mock TaskCard for isolation
vi.mock('@/components/tasks/TaskCard', () => ({
  TaskCard: ({ task, onViewDetails }) => (
    <div
      data-testid={`task-card-${task.id}`}
      data-status={task.status}
      onClick={() => onViewDetails?.(task.id)}
    >
      {task.description}
    </div>
  ),
}));
```

#### 5. Test Data Factories

```typescript
// Factory for creating test tasks
function createMockTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Math.random().toString(36).substr(2, 9)}`,
    description: 'Test Task',
    workflow: 'development',
    autonomy: 'medium',
    status: 'in-progress',
    priority: 'medium',
    effort: 'medium',
    projectPath: '/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// Factory for WebSocket events
function createTaskEvent(
  type: 'task:created' | 'task:started' | 'task:completed' | 'task:failed' | 'task:paused' | 'task:stage-changed',
  taskId: string,
  data: Record<string, any> = {}
): DashboardActivityEvent {
  return {
    id: `event-${Date.now()}`,
    type,
    taskId,
    timestamp: new Date(),
    data,
    isRead: false,
    severity: 'info',
    agentName: 'test-agent',
    category: 'task',
    title: `Task ${type.split(':')[1]}`,
  };
}

// Factory for connection health states
function createHealthState(
  status: WebSocketConnectionStatus,
  overrides: Partial<WebSocketConnectionHealth> = {}
): WebSocketConnectionHealth {
  const baseStates: Record<WebSocketConnectionStatus, Partial<WebSocketConnectionHealth>> = {
    connected: { isHealthy: true, latencyMs: 45, reconnectAttempts: 0 },
    disconnected: { isHealthy: false, latencyMs: null, reconnectAttempts: 0 },
    connecting: { isHealthy: false, latencyMs: null, reconnectAttempts: 0 },
    reconnecting: { isHealthy: false, latencyMs: null, reconnectAttempts: 3 },
    error: { isHealthy: false, latencyMs: null, consecutiveFailures: 5 },
  };

  return {
    status,
    isHealthy: false,
    latencyMs: null,
    averageLatencyMs: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    consecutiveFailures: 0,
    lastHealthyAt: new Date(),
    lastCheckAt: new Date(),
    connectionUptime: null,
    ...baseStates[status],
    ...overrides,
  };
}
```

#### 6. Integration Test Patterns

```typescript
describe('WebSocket UI Synchronization', () => {
  it('updates ActiveTasksPanel when task events received', async () => {
    const mockUseRealtimeUpdates = vi.mocked(useRealtimeUpdates);

    // Initial render with no tasks
    const { rerender } = render(<ActiveTasksPanelRealtime />);

    // Simulate task:created event
    mockUseRealtimeUpdates.mockReturnValueOnce({
      state: {
        connectionState: 'connected',
        events: [createTaskEvent('task:created', 'task-1', { task: createMockTask({ id: 'task-1' }) })],
        isConnected: true,
        error: null,
        health: {},
        performance: {},
        lastUpdate: new Date(),
      },
      // ... other methods
    });

    rerender(<ActiveTasksPanelRealtime />);

    // Verify task appears in UI
    await waitFor(() => {
      expect(screen.getByTestId('task-card-task-1')).toBeInTheDocument();
    });
  });

  it('shows connection indicator state transitions', async () => {
    const mockUseWebSocketConnection = vi.mocked(useWebSocketConnection);

    // Start disconnected
    mockUseWebSocketConnection.mockReturnValue(createHealthState('disconnected'));
    const { rerender } = render(<WebSocketConnectionIndicator />);
    expect(screen.getByText('Disconnected')).toBeInTheDocument();

    // Transition to connecting
    mockUseWebSocketConnection.mockReturnValue(createHealthState('connecting'));
    rerender(<WebSocketConnectionIndicator />);
    expect(screen.getByText('Connecting...')).toBeInTheDocument();

    // Transition to connected
    mockUseWebSocketConnection.mockReturnValue(createHealthState('connected'));
    rerender(<WebSocketConnectionIndicator />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });
});
```

### Implementation Plan

#### Phase 1: Enhance Unit Test Coverage
1. Add task card variant tests to ActiveTasksPanel.test.tsx
2. Add empty state edge case tests
3. Add accessibility tests for both components
4. Fix existing failing tests (ThoughtDisplay React import issue)

#### Phase 2: Add Integration Tests
1. Create ActiveTasksPanelRealtime.integration.test.tsx
2. Create websocket-ui-sync.integration.test.tsx
3. Add state transition tests for WebSocketConnectionIndicator

#### Phase 3: Add Edge Case Tests
1. Create ActiveTasksPanel.edge-cases.test.tsx
2. Enhance WebSocketConnectionIndicator.edge-cases.test.tsx
3. Add performance tests for large task lists

#### Phase 4: Verification
1. Run all tests to verify passing
2. Check coverage meets thresholds (60%)
3. Run build to verify no type errors

## Consequences

### Positive
- Comprehensive test coverage for critical UI components
- Clear testing patterns for WebSocket-driven components
- Reusable test utilities and factories
- Better confidence in real-time functionality

### Negative
- Increased test maintenance burden
- Mock complexity for WebSocket state management
- Some tests require timing-sensitive assertions

### Risks
- Flaky tests due to WebSocket event timing
- Mock drift if underlying APIs change
- Performance tests may vary across environments

## Test Coverage Targets

| Component | Target Coverage |
|-----------|----------------|
| ActiveTasksPanel | 80% |
| ActiveTasksPanelRealtime | 80% |
| WebSocketConnectionIndicator | 90% |
| Integration (cross-component) | 70% |

## References

- ADR-0002: WebSocketConnectionIndicator Component Architecture
- Existing test files in packages/web-ui/src/components/tasks/__tests__/
- Existing test files in packages/web-ui/src/components/connection/__tests__/
- Vitest configuration: packages/web-ui/vitest.config.ts
