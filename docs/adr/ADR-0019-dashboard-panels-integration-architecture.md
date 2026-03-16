# ADR-0019: Dashboard Panels Integration Architecture

## Status
Proposed

## Date
2026-03-15

## Context

We need to integrate all 4 dashboard panels into the main Dashboard page (`packages/web-ui/src/app/page.tsx`) with:

1. **Acceptance Criteria**:
   - Dashboard page updated to include all 4 panels in a responsive grid layout
   - Panels work together with shared WebSocket connection
   - Loading states handled gracefully
   - Dashboard is visually cohesive and matches existing design patterns

### Current State Analysis

#### Existing Dashboard Page (`page.tsx`)
The current dashboard already has:
1. **Summary Stats Cards** (6 small cards: Pending, Active, Paused, Completed, Failed, Total Cost)
2. **BudgetWidget** - Integrated with real-time updates via `useRealtimeUpdates`
3. **AgentUtilizationWidget** - Integrated with real-time updates via `useAgentMetrics`
4. **ActiveTasksPanelRealtime** - Integrated with real-time updates via `useRealtimeUpdates`

#### Available Panels for Integration
1. **ProjectHealthPanel** (`components/dashboard/ProjectHealthPanel.tsx`)
   - Shows overall health status (healthy/warning/critical)
   - Displays: Success Rate, Avg Duration, System Health
   - Accepts `metrics: ProjectHealthMetrics` prop
   - Supports loading, error, and refresh states

2. **PerformanceMetricsPanel** (`components/dashboard/PerformanceMetricsPanel.tsx`)
   - Shows: Token Usage Chart, Task Completion Rate Chart, Cost Trend Chart
   - Accepts `data: AggregatedPerformanceMetrics` prop
   - Has time range selector and auto-refresh support
   - Responsive grid layout for charts

#### WebSocket Infrastructure
- **Single Client Pattern**: `ApexWebSocketClient` singleton in `wsClient`
- **Shared Hooks**:
  - `useRealtimeUpdates`: Health metrics, activity events, performance data
  - `useWebSocketConnection`: Connection health state
  - `useAgentMetrics`: Agent-specific metrics

## Decision

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Dashboard Page                                  │
│                    packages/web-ui/src/app/page.tsx                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │          DashboardProvider (Context for shared state)                  │ │
│  │          - Single WebSocket connection                                  │ │
│  │          - Unified loading/error handling                               │ │
│  │          - Shared refresh mechanism                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Stats Row (6 cards: Pending, Active, Paused, Completed, Failed, Cost)  │ │
│  │ [Existing - No changes needed]                                          │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Row 2: Project Health + Budget (2-column responsive)                   │ │
│  │ ┌─────────────────────────────┬────────────────────────────────────┐   │ │
│  │ │ ProjectHealthPanel [NEW]   │  BudgetWidget [EXISTS]              │   │ │
│  │ │ - Health status indicator  │  - Budget gauge                     │   │ │
│  │ │ - Success rate, duration   │  - Current spend vs limit           │   │ │
│  │ │ - System health metrics    │  - Warning/danger thresholds        │   │ │
│  │ └─────────────────────────────┴────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Row 3: Agent Utilization (Full width)                                  │ │
│  │ ┌────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ AgentUtilizationWidget [EXISTS - move to own row]                  │ │ │
│  │ │ - Horizontal bar chart                                              │ │ │
│  │ │ - Per-agent token breakdown                                         │ │ │
│  │ └────────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Row 4: Performance Metrics [NEW - Full width, collapsible]            │ │
│  │ ┌────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ PerformanceMetricsPanel                                             │ │ │
│  │ │ - Token Usage Over Time Chart                                       │ │ │
│  │ │ - Task Completion Rate Chart                                        │ │ │
│  │ │ - Cost Trend Chart                                                  │ │ │
│  │ │ - Time range selector                                               │ │ │
│  │ └────────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Row 5: Active Tasks (Full width)                                       │ │
│  │ ┌────────────────────────────────────────────────────────────────────┐ │ │
│  │ │ ActiveTasksPanelRealtime [EXISTS]                                   │ │ │
│  │ │ - Task list with real-time updates                                  │ │ │
│  │ │ - Filter and action controls                                        │ │ │
│  │ └────────────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

#### 1. Shared WebSocket Connection via Context

**Problem**: Each widget currently creates its own `useRealtimeUpdates` instance, which can lead to multiple WebSocket connections.

**Solution**: Create a `DashboardProvider` context that:
- Initializes a single `useRealtimeUpdates` hook at the dashboard level
- Provides data streams to child components via React Context
- Centralizes connection state management

```typescript
// packages/web-ui/src/context/DashboardContext.tsx
interface DashboardContextValue {
  // Connection state
  connectionState: RealtimeConnectionState
  isConnected: boolean
  error: Error | null

  // Shared data
  health: DashboardHealthMetrics | null
  performance: DashboardPerformanceData | null
  events: DashboardActivityEvent[]

  // Actions
  refresh: () => void
  connect: () => void
  disconnect: () => void
}
```

#### 2. Data Flow Architecture

```
                    WebSocket Server
                          │
                          ▼
               ┌──────────────────────┐
               │  ApexWebSocketClient │ (Singleton)
               │  (websocket-client)  │
               └──────────────────────┘
                          │
                          ▼
               ┌──────────────────────┐
               │  useRealtimeUpdates  │ (Dashboard-level hook)
               │                      │
               │  state: {            │
               │    health,           │
               │    performance,      │
               │    events,           │
               │    connectionState   │
               │  }                   │
               └──────────────────────┘
                          │
                          ▼
               ┌──────────────────────┐
               │  DashboardProvider   │ (React Context)
               └──────────────────────┘
                          │
            ┌─────────────┼─────────────┬─────────────┐
            ▼             ▼             ▼             ▼
   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
   │ProjectHealth │ │ BudgetWidget │ │ Performance  │ │ ActiveTasks  │
   │    Panel     │ │              │ │ MetricsPanel │ │    Panel     │
   │              │ │              │ │              │ │              │
   │useDashboard()│ │useDashboard()│ │useDashboard()│ │useDashboard()│
   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

#### 3. Data Transformation Layer

Each panel receives raw data from the context and transforms it:

```typescript
// ProjectHealthPanel transformation
function transformToHealthMetrics(
  health: DashboardHealthMetrics,
  performance: DashboardPerformanceData
): ProjectHealthMetrics {
  const tasks = performance?.tasks || { completedTasks: 0, failedTasks: 0 }
  const total = tasks.completedTasks + tasks.failedTasks

  return {
    status: health.status,
    successRate: total > 0 ? (tasks.completedTasks / total) * 100 : 100,
    averageDurationMs: tasks.avgDurationMs || 0,
    systemHealth: health.server?.successRate || 100,
    tasks: {
      activeTasks: health.tasks?.activeTasks || 0,
      pendingTasks: health.tasks?.pendingTasks || 0,
      completedTasks: tasks.completedTasks,
      failedTasks: tasks.failedTasks,
    },
    connection: health.connection,
    lastUpdated: health.lastUpdated || new Date(),
  }
}

// PerformanceMetricsPanel transformation
function transformToAggregatedMetrics(
  performance: DashboardPerformanceData
): AggregatedPerformanceMetrics {
  // Transform timeSeries data to chart formats
  return {
    tokenUsage: transformToTokenUsageData(performance),
    taskCompletion: transformToTaskCompletionData(performance),
    costTrend: transformToCostTrendData(performance),
    timeRange: performance.timeRange || '24h',
    generatedAt: performance.generatedAt || new Date(),
  }
}
```

#### 4. Loading State Coordination

**Pattern**: Skeleton loading with progressive disclosure

```typescript
// Dashboard-level loading orchestration
function DashboardContent() {
  const { connectionState, health, performance } = useDashboard()

  // Initial connection loading
  if (connectionState === 'connecting') {
    return <DashboardSkeleton />
  }

  // Progressive loading - show panels as data becomes available
  return (
    <>
      {/* Stats always show - can use cached/initial data */}
      <StatsGrid stats={stats} isLoading={!health} />

      {/* Health panel - show skeleton until health data arrives */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ProjectHealthPanel
          metrics={healthMetrics}
          isLoading={!health}
        />
        <BudgetWidget {...} />
      </div>

      {/* Performance panel - deferred loading */}
      <PerformanceMetricsPanel
        data={performanceMetrics}
        loading={!performance}
      />

      {/* Tasks panel - loads independently */}
      <ActiveTasksPanelRealtime {...} />
    </>
  )
}
```

#### 5. Responsive Grid Layout

```css
/* Row 1: Stats - 6 columns on XL, 3 on LG, 2 on MD, 1 on SM */
.stats-grid {
  grid-template-columns: repeat(1, 1fr);
}
@media (min-width: 640px) {
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1024px) {
  .stats-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 1280px) {
  .stats-grid { grid-template-columns: repeat(6, 1fr); }
}

/* Row 2: Health + Budget - 2 columns on MD+, 1 on SM */
.health-budget-row {
  grid-template-columns: 1fr;
}
@media (min-width: 768px) {
  .health-budget-row { grid-template-columns: repeat(2, 1fr); }
}

/* Row 3-5: Full width panels */
.panel-row {
  grid-template-columns: 1fr;
}
```

### Component Integration

#### Dashboard Page Structure

```typescript
// packages/web-ui/src/app/page.tsx
export default function DashboardPage() {
  return (
    <DashboardProvider>
      <div className="p-8">
        <DashboardHeader />
        <DashboardContent />
      </div>
    </DashboardProvider>
  )
}

function DashboardContent() {
  const {
    connectionState,
    isConnected,
    health,
    performance,
    refresh
  } = useDashboard()

  // Transform data for panels
  const healthMetrics = useMemo(() =>
    health ? transformToHealthMetrics(health, performance) : null
  , [health, performance])

  const performanceMetrics = useMemo(() =>
    performance ? transformToAggregatedMetrics(performance) : null
  , [performance])

  const isInitialLoading = connectionState === 'connecting'

  return (
    <>
      {/* Row 1: Summary Stats */}
      <StatsGrid className="mt-8" isLoading={isInitialLoading} />

      {/* Row 2: Health + Budget */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <ProjectHealthPanel
          metrics={healthMetrics}
          isLoading={isInitialLoading && !healthMetrics}
          showDetails={false}
          onRefresh={refresh}
        />
        <BudgetWidget
          budgetLimit={1000}
          size="md"
          onRefresh={refresh}
        />
      </div>

      {/* Row 3: Agent Utilization */}
      <div className="mt-8">
        <AgentUtilizationWidget
          maxAgents={6}
          height={300}
          showCost={true}
          showTokenBreakdown={true}
          onRefresh={refresh}
        />
      </div>

      {/* Row 4: Performance Metrics */}
      <div className="mt-8">
        <PerformanceMetricsPanel
          data={performanceMetrics}
          timeRange="24h"
          loading={isInitialLoading && !performanceMetrics}
          showTimeRangeSelector={true}
          chartSize="md"
          onRefresh={refresh}
        />
      </div>

      {/* Row 5: Active Tasks */}
      <div className="mt-8">
        <ActiveTasksPanelRealtime
          initialTasks={tasks}
          onViewDetails={handleViewDetails}
          showConnectionIndicator={true}
          autoConnect={false} // Use shared connection
        />
      </div>
    </>
  )
}
```

### Error Handling Strategy

```typescript
// Unified error boundary for dashboard
<ErrorBoundary
  fallback={<DashboardErrorFallback />}
  onReset={() => refresh()}
>
  <DashboardContent />
</ErrorBoundary>

// Panel-level error handling
function ProjectHealthPanel({ error, onRefresh, ...props }) {
  if (error) {
    return (
      <Card className="border-red-900">
        <CardContent className="p-6">
          <ErrorDisplay
            title="Health Metrics Unavailable"
            message={error.message}
            onRetry={onRefresh}
          />
        </CardContent>
      </Card>
    )
  }
  // ... normal render
}
```

### File Structure

```
packages/web-ui/src/
├── app/
│   └── page.tsx                    # Dashboard page (MODIFY)
├── context/
│   ├── index.ts                    # Exports
│   └── DashboardContext.tsx        # NEW: Shared dashboard context
├── components/
│   ├── dashboard/
│   │   ├── index.ts                # Exports (MODIFY)
│   │   ├── ProjectHealthPanel.tsx  # EXISTS (integrate)
│   │   ├── PerformanceMetricsPanel.tsx # EXISTS (integrate)
│   │   ├── BudgetWidget.tsx        # EXISTS (keep)
│   │   ├── AgentUtilizationWidget.tsx # EXISTS (keep)
│   │   ├── DashboardSkeleton.tsx   # NEW: Loading skeleton
│   │   └── StatsGrid.tsx           # NEW: Extract stats to component
│   └── tasks/
│       └── ActiveTasksPanelRealtime.tsx # EXISTS (modify props)
├── hooks/
│   └── useDashboard.ts             # NEW: Context consumer hook
└── lib/
    ├── useRealtimeUpdates.ts       # EXISTS (use)
    └── dashboard-transformers.ts   # NEW: Data transformations
```

## Implementation Plan

### Phase 1: Create Dashboard Context
1. Create `DashboardContext.tsx` with shared state
2. Create `useDashboard.ts` hook for consuming context
3. Create data transformation functions

### Phase 2: Refactor Dashboard Page
1. Wrap dashboard with `DashboardProvider`
2. Extract `StatsGrid` component from inline code
3. Integrate `ProjectHealthPanel` with transformed data
4. Integrate `PerformanceMetricsPanel` with transformed data

### Phase 3: Optimize Shared Connection
1. Update `BudgetWidget` to use shared context (optional)
2. Update `AgentUtilizationWidget` to use shared context (optional)
3. Update `ActiveTasksPanelRealtime` to use shared context (optional)

### Phase 4: Add Loading States
1. Create `DashboardSkeleton` component
2. Implement progressive loading pattern
3. Add error boundaries

## Consequences

### Positive
- Single WebSocket connection reduces resource usage
- Consistent loading and error states across all panels
- Centralized state management simplifies debugging
- Responsive layout works across all viewports
- Visual cohesion with existing design patterns

### Negative
- Additional abstraction layer (context provider)
- Need to coordinate data transformations
- Migration effort for existing widgets to use shared context

### Neutral
- Existing panel components remain unchanged
- Dashboard layout requires CSS grid understanding

## Testing Strategy

### Unit Tests
- Test `DashboardContext` provider and consumer
- Test data transformation functions
- Test individual panel rendering with various states

### Integration Tests
- Test WebSocket data flow through context
- Test loading state coordination
- Test error propagation

### Visual Tests
- Test responsive layout breakpoints
- Test loading skeleton appearance
- Test panel visual consistency

## Dependencies

- No new external dependencies
- Uses existing: React Context, useRealtimeUpdates, existing components

## References

- [ADR-0016: Dashboard Budget Agent Widgets Integration](./ADR-0016-dashboard-budget-agent-widgets-integration.md)
- [ADR-ProjectHealthPanel](../architecture/adr/ADR-ProjectHealthPanel.md)
- [useRealtimeUpdates Implementation](../../packages/web-ui/src/lib/useRealtimeUpdates.ts)
