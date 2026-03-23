# ADR-0016: AgentTerminalPanel Component Architecture

## Status
Accepted

## Context
We need to implement an `AgentTerminalPanel` React component for the web-ui package that:
1. Renders an agent header with name and status
2. Displays scrollable log entries with timestamps and levels
3. Implements auto-scroll behavior (pause on manual scroll up, resume on scroll to bottom)
4. Shows connection status indicator

The APEX codebase already has:
- A CLI version of `AgentTerminalPanel` in `packages/cli/src/ui/components/agents/` (Ink-based)
- Type definitions for `AgentTerminalPanelProps` in `packages/web-ui/src/types/agent-log-stream.ts`
- Supporting types in `agent-terminal-panel.ts` for panel state management
- An existing `useAgentLogStream` hook for WebSocket log streaming
- `WebSocketConnectionIndicator` component for connection status
- `LogViewer` component with similar scroll/filter behavior

## Decision

### Component Structure

We will implement the AgentTerminalPanel component with the following architecture:

```
packages/web-ui/src/components/agents/
├── AgentTerminalPanel.tsx           # Main component
├── AgentTerminalPanelHeader.tsx     # Header with name, status, connection
├── AgentTerminalPanelLogEntry.tsx   # Individual log entry row
├── AgentTerminalPanelControls.tsx   # Toolbar with filter, search, export
├── __tests__/
│   ├── AgentTerminalPanel.test.tsx
│   ├── AgentTerminalPanel.acceptance.test.tsx
│   └── AgentTerminalPanel.auto-scroll.test.tsx
└── index.ts                         # Public exports
```

### Component Hierarchy

```
AgentTerminalPanel
├── AgentTerminalPanelHeader
│   ├── AgentStatusIndicator (from existing)
│   ├── Agent Name/Title
│   ├── WebSocketConnectionIndicator (from existing)
│   └── Panel Controls (minimize/maximize/close)
├── AgentTerminalPanelControls
│   ├── Level Filter (debug/info/warn/error)
│   ├── Search Input
│   └── Export Button
└── Log Viewport (scrollable container)
    ├── AgentTerminalPanelLogEntry[] (virtualized list)
    └── Auto-scroll Indicator/Button
```

### Auto-scroll Behavior

The auto-scroll mechanism follows these rules:

1. **Default State**: Auto-scroll is enabled by default (`autoScroll: true`)
2. **Pause Trigger**: When user scrolls up (away from bottom), auto-scroll pauses
3. **Resume Trigger**: When user scrolls back to bottom (within threshold), auto-scroll resumes
4. **Visual Indicator**: "New logs" button appears when paused with new logs available
5. **Threshold**: 50px from bottom is considered "at bottom"

Implementation approach:
```typescript
// useAutoScroll hook
function useAutoScroll(containerRef: RefObject<HTMLElement>) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [newLogsSinceScroll, setNewLogsSinceScroll] = useState(0);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    setAutoScroll(isAtBottom);
    if (isAtBottom) setNewLogsSinceScroll(0);
  }, []);

  const scrollToBottom = useCallback(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth'
    });
    setAutoScroll(true);
    setNewLogsSinceScroll(0);
  }, []);

  return { autoScroll, newLogsSinceScroll, handleScroll, scrollToBottom };
}
```

### State Management

The component leverages existing infrastructure:

1. **Log Data**: Uses `useAgentLogStream` hook for WebSocket log streaming
2. **Panel State**: Uses types from `agent-terminal-panel.ts` for minimize/maximize
3. **Connection Status**: Uses `useWebSocketConnection` hook
4. **Filtering**: Built into `useAgentLogStream` (levels, search, agent filter)

### Props Interface

Following the existing pattern in `AgentTerminalPanelProps` from `agent-log-stream.ts`:

```typescript
interface AgentTerminalPanelProps {
  // === Required Props ===
  panelId: string;                    // Unique panel identifier
  agentId: string;                    // Agent to display logs for

  // === Display Props ===
  title?: string;                     // Panel title (defaults to agentId)
  agentStatus?: AgentStatus;          // Agent operational status
  maxHeight?: string;                 // CSS max-height (default: '400px')
  minHeight?: string;                 // CSS min-height (default: '200px')

  // === Streaming Props ===
  autoConnect?: boolean;              // Auto-connect on mount (default: true)
  autoScroll?: boolean;               // Auto-scroll to new logs (default: true)
  maxLogs?: number;                   // Max logs in memory (default: 1000)

  // === Filter Props ===
  showFilters?: boolean;              // Show filter toolbar (default: true)
  showSearch?: boolean;               // Show search input (default: true)
  initialFilter?: Partial<LogFilter>; // Initial filter state
  visibleLevels?: LogLevel[];         // Log levels to show

  // === UI Props ===
  showTimestamps?: boolean;           // Show timestamps (default: true)
  showLevelBadges?: boolean;          // Show level badges (default: true)
  showSourceBadges?: boolean;         // Show source badges (default: false)
  wrapLines?: boolean;                // Wrap long lines (default: true)
  fontSize?: 'xs' | 'sm' | 'md';      // Font size (default: 'sm')
  theme?: 'dark' | 'light' | 'system';// Theme variant (default: 'dark')

  // === Event Callbacks ===
  onLogSelect?: (log: AgentLogEntry) => void;
  onFilterChange?: (filter: Partial<LogFilter>) => void;
  onStreamStateChange?: (state: StreamingState) => void;
  onError?: (error: string) => void;
  onClear?: () => void;

  // === Styling ===
  className?: string;
}
```

### Styling Approach

1. **Tailwind CSS**: Following existing web-ui patterns with `cn()` utility
2. **Theme Integration**: Use existing color variables for consistency
3. **Terminal Aesthetic**: Monospace font, dark background, color-coded levels
4. **Responsive**: Adapts to container width

Log level colors (from existing `LOG_LEVEL_STYLES` in `agent-log-stream.ts`):
- debug: gray-400
- info: blue-400
- warn: yellow-400
- error: red-400

### Performance Considerations

1. **Virtualization**: For large log lists (>100 entries), consider react-window
2. **Memoization**: Memoize log entries to prevent re-renders
3. **Throttled Scroll**: Throttle scroll event handlers (16ms/frame)
4. **Max Logs**: Configurable limit with FIFO eviction

### Accessibility

1. **ARIA roles**: `role="log"` for the container, `role="listitem"` for entries
2. **Live region**: `aria-live="polite"` for new log announcements
3. **Keyboard navigation**: Focus management, keyboard shortcuts
4. **Screen reader**: Proper labeling for status indicators

## Consequences

### Positive
- Reuses existing hooks and types for consistency
- Follows established patterns from LogViewer and CLI AgentTerminalPanel
- Modular sub-components enable testing and reuse
- Auto-scroll behavior matches user expectations from terminal apps

### Negative
- Additional component to maintain in web-ui
- Need to ensure WebSocket connection management doesn't conflict with other components

### Risks
- Performance with high log volume (mitigated by virtualization and max logs)
- WebSocket connection stability (mitigated by existing reconnection logic)

## Implementation Notes

### Files to Create
1. `packages/web-ui/src/components/agents/AgentTerminalPanel.tsx`
2. `packages/web-ui/src/components/agents/AgentTerminalPanelHeader.tsx`
3. `packages/web-ui/src/components/agents/AgentTerminalPanelLogEntry.tsx`
4. `packages/web-ui/src/components/agents/AgentTerminalPanelControls.tsx`
5. `packages/web-ui/src/components/agents/index.ts`
6. `packages/web-ui/src/hooks/useAutoScroll.ts`
7. Test files for each component

### Files to Modify
1. `packages/web-ui/src/components/index.ts` (add exports)
2. `packages/web-ui/src/hooks/index.ts` (add useAutoScroll export)

### Dependencies
- Existing: `useAgentLogStream`, `WebSocketConnectionIndicator`, `AgentStatusIndicator` types
- No new external dependencies required

## Related ADRs
- ADR-0010: WebSocket Client Architecture (connection handling)
- ADR-0012: Component Testing Strategy (Vitest patterns)
