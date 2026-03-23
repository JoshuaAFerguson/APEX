# Architecture Decision Record: AgentTerminalPanel Component

**Status:** Accepted
**Date:** 2026-03-22
**Author:** Architecture Stage Agent

## Context

The APEX platform requires an AgentTerminalPanel component that displays real-time log output from agent executions. This component needs to:
- Render an agent header with name and status
- Display scrollable log entries with timestamps and log levels
- Implement intelligent auto-scroll behavior (pause on manual scroll up, resume on scroll to bottom)
- Show connection status indicator for WebSocket streaming

## Existing Infrastructure

### Already Implemented

The codebase already has substantial infrastructure in place:

1. **Types (fully defined):**
   - `AgentTerminalPanelProps` in `src/types/agent-log-stream.ts` (lines 184-338)
   - `AgentLogEntry` interface with id, timestamp, level, message, source, metadata
   - `LogStreamState`, `LogStreamStats`, `StreamingState` for state management
   - `UseAgentLogStreamOptions` and `UseAgentLogStreamReturn` hook types

2. **Hooks (implemented):**
   - `useAgentLogStream` in `src/hooks/useAgentLogStream.ts` - Full implementation with WebSocket integration
   - `useWebSocketConnection` in `src/hooks/useWebSocketConnection.ts` - Connection health monitoring

3. **Supporting Types:**
   - `AgentStatusIndicator` types in `src/types/agent-status-indicator.ts` with styles and configurations
   - `PanelDisplayState` types for minimize/maximize state management
   - Style constants: `LOG_LEVEL_STYLES`, `LOG_SOURCE_STYLES`, `STREAMING_STATE_STYLES`

4. **Acceptance Tests:**
   - `src/types/__tests__/agent-terminal-panel.acceptance.test.ts` - Comprehensive type coverage tests

## Design Decisions

### Decision 1: Component Architecture

**Option A (Chosen): Single Component with Sub-components**

```
AgentTerminalPanel/
├── AgentTerminalPanel.tsx       # Main container component
├── AgentTerminalHeader.tsx      # Header with name, status, controls
├── AgentTerminalLogEntry.tsx    # Individual log row
├── AgentTerminalToolbar.tsx     # Filter/search toolbar
├── index.ts                     # Exports
└── __tests__/                   # Test files
```

**Rationale:**
- Follows established patterns in `src/components/activity/` and `src/components/agents/`
- Enables code reuse and independent testing
- Supports virtualization of log entries for performance

### Decision 2: Auto-Scroll Implementation

**Implementation Pattern:**

```typescript
// Scroll container ref management
const containerRef = useRef<HTMLDivElement>(null);
const [autoScroll, setAutoScroll] = useState(true);

// Detect manual scroll up
const handleScroll = useCallback(() => {
  if (!containerRef.current) return;
  const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
  const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
  setAutoScroll(isAtBottom);
}, []);

// Auto-scroll on new logs when enabled
useEffect(() => {
  if (autoScroll && containerRef.current) {
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }
}, [filteredLogs, autoScroll]);
```

**Pattern Reference:** This follows the exact pattern used in:
- `src/components/tasks/LogViewer.tsx` (lines 54-72)
- `src/components/activity/RecentActivityFeed.tsx` (lines 137-156)

### Decision 3: Connection Status Indicator

**Approach:** Compose `WebSocketConnectionIndicator` from `src/components/connection/`

```typescript
import { WebSocketConnectionIndicator } from '../connection/WebSocketConnectionIndicator';

// In header:
<WebSocketConnectionIndicator
  size="sm"
  showLatency={false}
  showTooltip={true}
  healthOverride={{ status: streamState.connectionStatus }}
/>
```

**Rationale:**
- Reuses existing, tested component
- Consistent UX across the application
- Supports all connection states: connected, disconnected, connecting, reconnecting, error

### Decision 4: Agent Status Display

**Approach:** New `AgentStatusIndicator` component

Based on types in `src/types/agent-status-indicator.ts`:

```typescript
// Status styles from AGENT_STATUS_STYLES constant
const statusConfig = {
  idle: { dot: 'bg-gray-500', text: 'text-gray-400', animation: '' },
  active: { dot: 'bg-green-500', text: 'text-green-400', animation: 'animate-pulse' },
  error: { dot: 'bg-red-500', text: 'text-red-400', animation: '' },
};
```

### Decision 5: Log Entry Rendering

**Structure:**

```typescript
// Single log entry layout
<div className="flex gap-3 px-3 py-1.5">
  <span className="text-foreground-tertiary shrink-0">{timestamp}</span>
  <span className={cn('w-12 shrink-0 uppercase text-xs font-semibold', levelColor)}>
    {level}
  </span>
  {metadata.agentName && (
    <span className="text-apex-400 shrink-0">[{metadata.agentName}]</span>
  )}
  <span className="flex-1 break-all">{message}</span>
</div>
```

**Styling:** Uses existing `LOG_LEVEL_STYLES` from `src/types/agent-log-stream.ts`:
- debug: gray
- info: blue
- warn: yellow
- error: red

### Decision 6: State Management

**Approach:** Leverage existing `useAgentLogStream` hook

The hook already provides:
- `logs`, `filteredLogs` - Log data
- `streamState` - Connection and streaming status
- `stats` - Real-time statistics
- `isConnecting`, `isStreaming`, `isPaused`, `error` - Status flags
- `connect`, `disconnect`, `pause`, `resume` - Control methods
- `setFilter`, `resetFilter` - Filter management
- `clearLogs`, `addLogs` - Log manipulation
- `scrollToLog`, `scrollToBottom` - Scroll control

## Component Interface

```typescript
interface AgentTerminalPanelProps {
  // Required
  panelId: string;
  agentId: string;

  // Display
  title?: string;                    // Default: agentId
  agentStatus?: AgentStatus;         // 'idle' | 'processing' | 'error' | 'offline'
  maxHeight?: string;                // Default: '400px'
  minHeight?: string;                // Default: '200px'

  // Streaming
  autoConnect?: boolean;             // Default: true
  autoScroll?: boolean;              // Default: true
  maxLogs?: number;                  // Default: 1000

  // Filters
  showFilters?: boolean;             // Default: true
  showSearch?: boolean;              // Default: true
  initialFilter?: Partial<LogFilter>;
  visibleLevels?: LogLevel[];

  // UI Options
  showTimestamps?: boolean;          // Default: true
  showLevelBadges?: boolean;         // Default: true
  showSourceBadges?: boolean;        // Default: false
  wrapLines?: boolean;               // Default: true
  fontSize?: 'xs' | 'sm' | 'md';     // Default: 'sm'
  theme?: 'dark' | 'light' | 'system'; // Default: 'dark'

  // Callbacks
  onLogSelect?: (log: AgentLogEntry) => void;
  onFilterChange?: (filter: Partial<LogFilter>) => void;
  onStreamStateChange?: (state: StreamingState) => void;
  onError?: (error: string) => void;
  onClear?: () => void;

  // Styling
  className?: string;
}
```

## Implementation Files

### New Files to Create

1. **`src/components/terminal/AgentTerminalPanel.tsx`** - Main component
2. **`src/components/terminal/AgentTerminalHeader.tsx`** - Header sub-component
3. **`src/components/terminal/AgentTerminalLogEntry.tsx`** - Log entry sub-component
4. **`src/components/terminal/AgentStatusIndicator.tsx`** - Status indicator
5. **`src/components/terminal/index.ts`** - Exports

### Test Files

1. **`src/components/terminal/__tests__/AgentTerminalPanel.test.tsx`** - Unit tests
2. **`src/components/terminal/__tests__/AgentTerminalPanel.integration.test.tsx`** - Integration tests
3. **`src/components/terminal/__tests__/AgentTerminalPanel.autoscroll.test.tsx`** - Auto-scroll behavior tests

## Dependencies

### Internal Dependencies
- `@/hooks/useAgentLogStream` - Log streaming hook
- `@/hooks/useWebSocketConnection` - Connection status
- `@/components/connection/WebSocketConnectionIndicator` - Connection indicator
- `@/components/ui/Card` - Container styling
- `@/components/ui/Badge` - Level badges
- `@/components/ui/Button` - Action buttons
- `@/components/ui/Spinner` - Loading states
- `@/lib/utils` - cn() utility, formatters

### Type Dependencies
- `@/types/agent-log-stream` - All log types
- `@/types/agent-status-indicator` - Status types
- `@/types/agent-terminal-panel` - Panel state types
- `@/types/websocket-connection` - Connection types

### External Dependencies
- `lucide-react` - Icons (Terminal, Search, Filter, ChevronDown, etc.)
- `react` - Core React hooks

## Performance Considerations

1. **Virtualization:** For >100 logs, consider `react-virtual` or similar
2. **Memoization:** Log entries should be memoized to prevent re-renders
3. **Throttling:** Scroll event handlers should be throttled
4. **Max Logs:** Default 1000 log buffer prevents memory issues

## Accessibility

1. **ARIA Labels:** Log container has `role="log"` and `aria-live="polite"`
2. **Keyboard Navigation:** Focus management for log selection
3. **Screen Readers:** Meaningful labels for status indicators
4. **Color Contrast:** Log levels meet WCAG 2.1 AA contrast requirements

## Testing Strategy

### Unit Tests
- Component renders with minimal props
- Header displays agent name and status
- Log entries render with correct formatting
- Filter controls work correctly

### Integration Tests
- Auto-scroll behavior (pause on scroll up, resume on scroll to bottom)
- WebSocket connection state transitions
- Log filtering and search
- Real-time log streaming simulation

### Edge Cases
- Empty log state
- Connection error handling
- Large log volume (1000+ entries)
- Rapid log updates

## Migration Path

No migration needed - this is a new component. The existing types and hooks were designed with this component in mind.

## Alternatives Considered

1. **Using existing LogViewer directly:** Rejected because LogViewer lacks agent-specific features (status indicator, agent header, connection status)

2. **Monolithic component:** Rejected in favor of composable sub-components for testability

3. **Custom WebSocket handling:** Rejected - reuse existing `useAgentLogStream` hook

## Acceptance Criteria Mapping

| Acceptance Criteria | Implementation |
|---------------------|----------------|
| React component renders agent header with name/status | `AgentTerminalHeader` with `AgentStatusIndicator` |
| Displays scrollable log entries with timestamps and levels | `AgentTerminalLogEntry` with timestamp + level badge |
| Auto-scroll behavior (pause on scroll up, resume at bottom) | `handleScroll` + `autoScroll` state pattern |
| Connection status indicator | Reuse `WebSocketConnectionIndicator` component |

## Sequence Diagram

```
User Interaction Flow:
┌────────┐      ┌─────────────────────┐      ┌────────────────────┐
│  User  │      │ AgentTerminalPanel  │      │  useAgentLogStream │
└───┬────┘      └──────────┬──────────┘      └─────────┬──────────┘
    │                      │                           │
    │  Scrolls Up          │                           │
    ├─────────────────────►│                           │
    │                      │  setAutoScroll(false)     │
    │                      │─────────────────────────► │
    │                      │                           │
    │                      │  New Logs Arrive          │
    │                      │◄──────────────────────────│
    │                      │  (Auto-scroll disabled)   │
    │                      │                           │
    │  "New logs" button   │                           │
    │  appears             │                           │
    │◄─────────────────────│                           │
    │                      │                           │
    │  Clicks "New logs"   │                           │
    ├─────────────────────►│                           │
    │                      │  scrollToBottom()         │
    │                      │  setAutoScroll(true)      │
    │                      │─────────────────────────► │
    │                      │                           │
```

## Conclusion

This design leverages the existing well-designed type system and hooks while adding the UI layer needed for the AgentTerminalPanel. The component follows established patterns in the codebase, ensuring consistency and maintainability.
