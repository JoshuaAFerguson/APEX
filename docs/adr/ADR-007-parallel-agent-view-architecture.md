# ADR-007: Parallel Agent View Component Architecture

## Status
**Accepted**

## Context

The APEX platform needs a ParallelAgentView component that displays 1-12 concurrent agent terminals side-by-side with real-time log streaming via WebSocket. Each agent panel must show:
- Real-time log streaming
- Status indicators (idle/active/error states)
- Minimize/maximize panel controls
- Responsive grid layout

### Existing Infrastructure

The codebase already provides:
1. **Type System** (`parallel-agent-view.ts`) - Comprehensive types including `AgentExecution`, `AgentLane`, `ParallelAgentViewProps`, status enums, and styling constants
2. **WebSocket Client** (`websocket-client.ts`) - Full-featured client with health checks, reconnection, and event subscription
3. **LogViewer Component** - Displays logs with search, filtering, and auto-scroll
4. **Status Indicators** - `HealthStatusIndicator`, `WebSocketConnectionIndicator`
5. **UI Components** - Card, ProgressIndicator, and other foundational components
6. **Hooks** - `useWebSocketConnection`, `useRealtimeUpdates`, `useTaskStream`

## Decision

### Component Architecture

We will implement a **Compound Component Pattern** with the following structure:

```
ParallelAgentView (Container)
├── ParallelAgentViewHeader (Summary & Controls)
├── ParallelAgentGrid (Responsive Grid Layout)
│   └── AgentTerminalPanel (1-12 instances)
│       ├── AgentPanelHeader (Status, Controls)
│       ├── AgentLogStream (Real-time Logs)
│       └── AgentPanelFooter (Metrics)
└── ParallelAgentViewFooter (Global Metrics)
```

### Key Architectural Decisions

#### 1. State Management: Centralized Container Pattern

The `ParallelAgentView` container manages all state and passes down via props/context:
- Uses a single WebSocket subscription per view
- Event-driven updates from existing `useTaskStream` hook
- Local state for UI concerns (minimize/maximize, selected panel)

**Rationale**: Centralizing WebSocket subscriptions prevents connection proliferation and ensures consistent data across all panels.

#### 2. Log Streaming: Virtual Scrolling with Bounded Buffers

Each `AgentLogStream` component will:
- Use a bounded circular buffer (configurable, default 1000 entries per agent)
- Implement virtual scrolling for performance with large log volumes
- Leverage existing `LogViewer` patterns for consistency

**Rationale**: Prevents memory issues with long-running agents while maintaining smooth scrolling.

#### 3. Responsive Grid: CSS Grid with Tailwind

```css
/* Responsive breakpoints */
1 panel:   grid-cols-1
2 panels:  grid-cols-1 md:grid-cols-2
3 panels:  grid-cols-1 md:grid-cols-2 lg:grid-cols-3
4 panels:  grid-cols-2 lg:grid-cols-2 xl:grid-cols-4
5-6:       grid-cols-2 lg:grid-cols-3
7-9:       grid-cols-2 lg:grid-cols-3 xl:grid-cols-3
10-12:     grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
```

When a panel is maximized, it spans the full container and other panels collapse.

**Rationale**: CSS Grid provides native responsive behavior without JavaScript calculations.

#### 4. Real-time Updates: Event-Based Architecture

```typescript
// Events handled by ParallelAgentView
type AgentStreamEvent = {
  type: 'agent:log' | 'agent:status' | 'agent:progress' | 'agent:error'
  agentId: string
  timestamp: Date
  data: LogEntry | StatusChange | ProgressUpdate | ErrorInfo
}
```

The container subscribes to `*` events and distributes to relevant panels based on `agentId`.

#### 5. Panel Minimize/Maximize: Local UI State

Panel expansion state is managed locally:
- Minimized panels show only header (agent name + status)
- Maximized panel takes full container width
- Other panels become minimized when one is maximized
- Keyboard shortcuts: `Escape` to restore, `M` to toggle maximize

### Component Interfaces

```typescript
// Main component props (extends existing ParallelAgentViewProps)
interface ParallelAgentViewComponentProps extends ParallelAgentViewProps {
  // WebSocket connection
  wsUrl?: string
  autoConnect?: boolean

  // Panel behavior
  allowMaximize?: boolean
  allowMinimize?: boolean
  defaultMinimized?: boolean

  // Log streaming
  maxLogsPerAgent?: number
  enableVirtualScroll?: boolean

  // Layout
  minPanelHeight?: number
  maxColumns?: number
}

// Individual panel props
interface AgentTerminalPanelProps {
  execution: AgentExecution
  logs: LogEntry[]
  isMinimized: boolean
  isMaximized: boolean
  onMinimize: () => void
  onMaximize: () => void
  onRestore: () => void
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  className?: string
}
```

### New Hook: useParallelAgentStream

```typescript
interface UseParallelAgentStreamOptions {
  maxAgents?: number  // 1-12
  maxLogsPerAgent?: number
  taskId?: string
}

interface UseParallelAgentStreamReturn {
  agents: Map<string, AgentStreamState>
  connectionStatus: WebSocketConnectionStatus
  isConnected: boolean
  connect: () => void
  disconnect: () => void
  pauseAgent: (agentId: string) => void
  resumeAgent: (agentId: string) => void
  cancelAgent: (agentId: string) => void
  clearLogs: (agentId?: string) => void
}

interface AgentStreamState {
  execution: AgentExecution
  logs: LogEntry[]
  isStreaming: boolean
  lastUpdate: Date
}
```

### File Structure

```
packages/web-ui/src/
├── components/
│   └── parallel-agents/
│       ├── index.ts                          # Public exports
│       ├── ParallelAgentView.tsx             # Main container
│       ├── ParallelAgentViewHeader.tsx       # Summary header
│       ├── ParallelAgentGrid.tsx             # Responsive grid
│       ├── AgentTerminalPanel.tsx            # Individual panel
│       ├── AgentPanelHeader.tsx              # Panel header with controls
│       ├── AgentLogStream.tsx                # Log display
│       ├── AgentStatusBadge.tsx              # Status indicator
│       └── __tests__/
│           ├── ParallelAgentView.test.tsx
│           ├── AgentTerminalPanel.test.tsx
│           └── ParallelAgentView.integration.test.tsx
├── hooks/
│   └── useParallelAgentStream.ts             # WebSocket hook for parallel agents
└── types/
    └── parallel-agent-view.ts                # Already exists, may need minor additions
```

## Consequences

### Positive
- Reuses existing WebSocket infrastructure and type system
- Consistent UI patterns with existing components
- Scalable to 12 agents without performance degradation
- Accessible with keyboard navigation support
- Responsive design for all screen sizes

### Negative
- Additional complexity from compound component pattern
- Memory usage increases with agent count
- WebSocket event filtering adds minor overhead

### Mitigations
- Log buffer limits prevent unbounded memory growth
- Virtual scrolling handles large log volumes
- Event filtering is O(1) with Map-based agent lookup

## Implementation Phases

### Phase 1: Core Components
1. `ParallelAgentView` container
2. `AgentTerminalPanel` component
3. `useParallelAgentStream` hook
4. Basic grid layout

### Phase 2: Features
1. Minimize/maximize functionality
2. Log search and filtering
3. Agent controls (pause/resume/cancel)

### Phase 3: Polish
1. Keyboard shortcuts
2. Accessibility improvements
3. Performance optimizations
4. Comprehensive tests

## References

- Existing types: `packages/web-ui/src/types/parallel-agent-view.ts`
- WebSocket client: `packages/web-ui/src/lib/websocket-client.ts`
- LogViewer: `packages/web-ui/src/components/tasks/LogViewer.tsx`
- Status indicators: `packages/web-ui/src/components/dashboard/HealthStatusIndicator.tsx`
