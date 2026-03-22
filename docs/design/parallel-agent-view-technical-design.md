# ParallelAgentView Technical Design Specification

## Overview

This document provides the detailed technical design for implementing the ParallelAgentView component, which displays 1-12 concurrent agent terminals side-by-side with real-time log streaming.

## Requirements Summary

| Requirement | Description |
|-------------|-------------|
| Grid Layout | Display 1-12 agent panels in responsive grid |
| Real-time Streaming | WebSocket-based log streaming per agent |
| Status Indicators | Visual states: idle, active, error, completed, etc. |
| Panel Controls | Minimize/maximize functionality |
| Performance | Handle high-throughput log streams |

## Component Hierarchy

```
ParallelAgentView
├── ParallelAgentViewHeader
│   ├── Title & Agent Count
│   ├── Overall Progress
│   ├── Layout Toggle (grid/lanes)
│   └── Collapse All / Expand All
├── ParallelAgentGrid
│   └── AgentTerminalPanel (×1-12)
│       ├── AgentPanelHeader
│       │   ├── AgentStatusBadge
│       │   ├── Agent Name
│       │   ├── Stage Label
│       │   └── Control Buttons (min/max/pause/cancel)
│       ├── AgentLogStream
│       │   ├── Search Bar (optional)
│       │   ├── Virtual Log List
│       │   └── Auto-scroll Indicator
│       └── AgentPanelFooter
│           ├── Progress Bar
│           ├── Elapsed Time
│           └── Token/Cost Metrics (optional)
└── ParallelAgentViewFooter
    ├── Running/Completed/Failed Counts
    ├── Total Tokens
    └── Connection Status
```

## Detailed Component Specifications

### 1. ParallelAgentView (Container)

**File**: `components/parallel-agents/ParallelAgentView.tsx`

```typescript
'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { useParallelAgentStream } from '@/hooks/useParallelAgentStream'
import type {
  ParallelAgentViewProps,
  ParallelAgentViewConfig,
  AgentExecution,
  DEFAULT_PARALLEL_AGENT_VIEW_CONFIG,
} from '@/types/parallel-agent-view'

export interface ParallelAgentViewComponentProps extends ParallelAgentViewProps {
  /** WebSocket URL override */
  wsUrl?: string
  /** Auto-connect on mount */
  autoConnect?: boolean
  /** Allow panel maximize */
  allowMaximize?: boolean
  /** Allow panel minimize */
  allowMinimize?: boolean
  /** Maximum logs per agent buffer */
  maxLogsPerAgent?: number
  /** Enable virtual scrolling for logs */
  enableVirtualScroll?: boolean
  /** Minimum panel height in pixels */
  minPanelHeight?: number
}

// State interface for panel UI state
interface PanelUIState {
  minimizedPanels: Set<string>
  maximizedPanelId: string | null
  selectedPanelId: string | null
}
```

**Key Responsibilities**:
- Merge config with defaults
- Manage panel UI state (min/max)
- Connect to WebSocket via hook
- Distribute events to panels
- Handle global actions

### 2. AgentTerminalPanel

**File**: `components/parallel-agents/AgentTerminalPanel.tsx`

```typescript
'use client'

import React, { memo, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardContent } from '@/components/ui/Card'
import type { AgentExecution, AGENT_EXECUTION_STATUS_STYLES } from '@/types/parallel-agent-view'
import type { LogEntry } from '@/components/tasks/LogViewer'

export interface AgentTerminalPanelProps {
  /** Agent execution data */
  execution: AgentExecution
  /** Log entries for this agent */
  logs: LogEntry[]
  /** Panel is minimized (shows header only) */
  isMinimized: boolean
  /** Panel is maximized (full width) */
  isMaximized: boolean
  /** Show progress bar */
  showProgress?: boolean
  /** Show elapsed time */
  showElapsedTime?: boolean
  /** Show token usage */
  showTokenUsage?: boolean
  /** Maximum height when not minimized */
  maxHeight?: number
  /** Callbacks */
  onMinimize?: () => void
  onMaximize?: () => void
  onRestore?: () => void
  onPause?: () => void
  onResume?: () => void
  onCancel?: () => void
  onRetry?: () => void
  onClick?: () => void
  /** Styling */
  className?: string
  testId?: string
}
```

**Visual States**:

| State | Border | Background | Icon | Animation |
|-------|--------|------------|------|-----------|
| idle | gray-800 | gray-950/50 | ○ | none |
| queued | apex-800 | apex-950/50 | ◎ | none |
| running | apex-700 | apex-950/50 | ⚡ | pulse on status dot |
| paused | yellow-800 | yellow-950/50 | ⏸ | none |
| completed | green-800 | green-950/50 | ✓ | none |
| failed | red-800 | red-950/50 | ✗ | none |
| cancelled | gray-700 | gray-950/50 | ⊘ | none |

### 3. AgentLogStream

**File**: `components/parallel-agents/AgentLogStream.tsx`

```typescript
'use client'

import React, { useRef, useEffect, useState, useMemo, useCallback, memo } from 'react'
import { cn } from '@/lib/utils'
import type { LogEntry } from '@/components/tasks/LogViewer'

export interface AgentLogStreamProps {
  /** Log entries to display */
  logs: LogEntry[]
  /** Maximum visible height */
  maxHeight?: number
  /** Enable search functionality */
  enableSearch?: boolean
  /** Enable virtual scrolling */
  enableVirtualScroll?: boolean
  /** Row height for virtual scroll calculations */
  rowHeight?: number
  /** Buffer rows above/below viewport */
  overscan?: number
  /** Styling */
  className?: string
}
```

**Virtual Scrolling Implementation**:
- Use `useVirtualizer` from `@tanstack/react-virtual` for efficient rendering
- Maintain visible window of ~20 rows + overscan
- Smooth scrolling with auto-scroll to bottom

### 4. useParallelAgentStream Hook

**File**: `hooks/useParallelAgentStream.ts`

```typescript
'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { wsClient, type ApexEvent } from '@/lib/websocket-client'
import type { AgentExecution, AgentExecutionStatus } from '@/types/parallel-agent-view'
import type { LogEntry } from '@/components/tasks/LogViewer'

export interface UseParallelAgentStreamOptions {
  /** Maximum number of agents (1-12) */
  maxAgents?: number
  /** Maximum logs per agent */
  maxLogsPerAgent?: number
  /** Task ID to filter events */
  taskId?: string
  /** Auto-connect on mount */
  autoConnect?: boolean
  /** Event types to subscribe to */
  eventTypes?: string[]
}

export interface AgentStreamState {
  /** Agent execution state */
  execution: AgentExecution
  /** Buffered log entries */
  logs: LogEntry[]
  /** Whether actively streaming */
  isStreaming: boolean
  /** Last update timestamp */
  lastUpdate: Date
}

export interface UseParallelAgentStreamReturn {
  /** Map of agent ID to stream state */
  agents: Map<string, AgentStreamState>
  /** Array of agents for easier iteration */
  agentList: AgentStreamState[]
  /** WebSocket connected */
  isConnected: boolean
  /** Connection status string */
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'reconnecting' | 'error'
  /** Connect to WebSocket */
  connect: () => void
  /** Disconnect from WebSocket */
  disconnect: () => void
  /** Clear logs for specific agent or all */
  clearLogs: (agentId?: string) => void
  /** Error if any */
  error: Error | null
}
```

**Event Handling Logic**:

```typescript
// Event type to handler mapping
const EVENT_HANDLERS = {
  'agent:started': (state, event) => updateAgentStatus(state, event.agentId, 'running'),
  'agent:completed': (state, event) => updateAgentStatus(state, event.agentId, 'completed'),
  'agent:failed': (state, event) => updateAgentError(state, event.agentId, event.data.error),
  'agent:log': (state, event) => appendLog(state, event.agentId, event.data),
  'agent:progress': (state, event) => updateProgress(state, event.agentId, event.data.progress),
  'agent:message': (state, event) => appendLog(state, event.agentId, formatMessage(event)),
  'agent:tool-use': (state, event) => appendLog(state, event.agentId, formatToolUse(event)),
}
```

## Responsive Grid Layout

### Breakpoints and Columns

```typescript
const GRID_CONFIGS = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 lg:grid-cols-2 xl:grid-cols-4',
  5: 'grid-cols-2 lg:grid-cols-3',
  6: 'grid-cols-2 lg:grid-cols-3',
  7: 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  8: 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  9: 'grid-cols-2 lg:grid-cols-3',
  10: 'grid-cols-2 lg:grid-cols-4 xl:grid-cols-5',
  11: 'grid-cols-2 lg:grid-cols-4 xl:grid-cols-4',
  12: 'grid-cols-2 lg:grid-cols-4 xl:grid-cols-4',
} as const

function getGridClasses(panelCount: number): string {
  return GRID_CONFIGS[Math.min(panelCount, 12) as keyof typeof GRID_CONFIGS] || GRID_CONFIGS[12]
}
```

### Panel Sizing

```typescript
const PANEL_HEIGHT_CONFIG = {
  minimized: 48,    // Header only
  normal: 320,      // Default height
  expanded: 'auto', // Content-driven
  maximized: '100%' // Full container
}
```

## WebSocket Event Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      APEX API Server                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ WebSocket
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ApexWebSocketClient                            │
│  - Connection management                                         │
│  - Health checks                                                 │
│  - Event subscription                                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Events
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│               useParallelAgentStream Hook                        │
│  - Event filtering by taskId/agentId                             │
│  - State management per agent                                    │
│  - Log buffer management                                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │ State
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  ParallelAgentView                               │
│  - UI state (min/max)                                            │
│  - Layout management                                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Props
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│               AgentTerminalPanel (×12)                           │
│  - Individual agent display                                      │
│  - Log streaming                                                 │
│  - Status indicators                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Performance Considerations

### Log Buffer Management

```typescript
// Circular buffer implementation for logs
class LogBuffer {
  private buffer: LogEntry[]
  private maxSize: number
  private head: number = 0
  private count: number = 0

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize
    this.buffer = new Array(maxSize)
  }

  push(entry: LogEntry): void {
    this.buffer[this.head] = entry
    this.head = (this.head + 1) % this.maxSize
    this.count = Math.min(this.count + 1, this.maxSize)
  }

  toArray(): LogEntry[] {
    if (this.count < this.maxSize) {
      return this.buffer.slice(0, this.count)
    }
    // Return in chronological order
    return [
      ...this.buffer.slice(this.head),
      ...this.buffer.slice(0, this.head)
    ]
  }

  clear(): void {
    this.head = 0
    this.count = 0
  }
}
```

### Memoization Strategy

```typescript
// Memoize expensive computations
const processedAgents = useMemo(() =>
  agentList.map(agent => ({
    ...agent,
    formattedTime: formatElapsedTime(agent.execution.startedAt),
    statusStyles: AGENT_EXECUTION_STATUS_STYLES[agent.execution.status],
    filteredLogs: filterLogs(agent.logs, searchQuery),
  })),
  [agentList, searchQuery]
)

// Memoize callbacks with useCallback
const handlePanelMaximize = useCallback((panelId: string) => {
  setPanelState(prev => ({
    ...prev,
    maximizedPanelId: prev.maximizedPanelId === panelId ? null : panelId,
  }))
}, [])
```

### Virtual Scrolling Configuration

```typescript
const virtualizer = useVirtualizer({
  count: logs.length,
  getScrollElement: () => scrollRef.current,
  estimateSize: () => 24, // Estimated row height
  overscan: 5,            // Rows to render outside viewport
})
```

## Accessibility Requirements

### Keyboard Navigation

| Key | Action |
|-----|--------|
| Tab | Move between panels |
| Enter/Space | Select/focus panel |
| M | Toggle maximize on focused panel |
| Escape | Restore maximized panel |
| Arrow Up/Down | Scroll logs in focused panel |

### ARIA Attributes

```tsx
<div
  role="region"
  aria-label="Parallel Agent View"
  aria-live="polite"
>
  <div
    role="grid"
    aria-label={`${agentCount} agent panels`}
  >
    {agents.map(agent => (
      <div
        key={agent.execution.id}
        role="gridcell"
        aria-label={`${agent.execution.agentName} - ${agent.execution.status}`}
        tabIndex={0}
      >
        {/* Panel content */}
      </div>
    ))}
  </div>
</div>
```

## Testing Strategy

### Unit Tests

1. **Component rendering**
   - Renders correct number of panels
   - Displays correct status indicators
   - Shows logs correctly

2. **State management**
   - Minimize/maximize behavior
   - Log buffer limits
   - Event handling

### Integration Tests

1. **WebSocket integration**
   - Connection establishment
   - Event streaming
   - Reconnection handling

2. **End-to-end flow**
   - Multiple agent simulation
   - Real-time updates
   - Performance under load

### Test Data Generators

```typescript
// Test fixtures
export function createMockAgentExecution(
  overrides?: Partial<AgentExecution>
): AgentExecution {
  return {
    id: crypto.randomUUID(),
    agentId: 'test-agent',
    agentName: 'Test Agent',
    status: 'running',
    progress: 50,
    laneId: 'lane-1',
    startedAt: new Date(),
    ...overrides,
  }
}

export function createMockLogEntry(
  overrides?: Partial<LogEntry>
): LogEntry {
  return {
    timestamp: new Date(),
    level: 'info',
    message: 'Test log message',
    agent: 'test-agent',
    ...overrides,
  }
}
```

## Implementation Checklist

### Phase 1: Core Components
- [ ] `ParallelAgentView.tsx` - Container component
- [ ] `AgentTerminalPanel.tsx` - Individual panel
- [ ] `AgentLogStream.tsx` - Log display
- [ ] `AgentStatusBadge.tsx` - Status indicator
- [ ] `useParallelAgentStream.ts` - WebSocket hook
- [ ] Basic tests

### Phase 2: Features
- [ ] `ParallelAgentViewHeader.tsx` - Summary header
- [ ] `ParallelAgentGrid.tsx` - Responsive grid
- [ ] `AgentPanelHeader.tsx` - Panel controls
- [ ] Minimize/maximize functionality
- [ ] Log search and filtering

### Phase 3: Polish
- [ ] Keyboard navigation
- [ ] ARIA accessibility
- [ ] Virtual scrolling
- [ ] Performance optimization
- [ ] Comprehensive tests
- [ ] Documentation

## Dependencies

### Required (Already in project)
- `react` ^18.0.0
- `@/lib/websocket-client`
- `@/types/parallel-agent-view`
- `@/components/ui/Card`
- `@/components/tasks/LogViewer` (reference)
- `tailwindcss`
- `lucide-react`

### Recommended Additions
- `@tanstack/react-virtual` - For virtual scrolling (if not already present)

## Exports

```typescript
// components/parallel-agents/index.ts
export { ParallelAgentView } from './ParallelAgentView'
export { AgentTerminalPanel } from './AgentTerminalPanel'
export { AgentLogStream } from './AgentLogStream'
export { AgentStatusBadge } from './AgentStatusBadge'
export type {
  ParallelAgentViewComponentProps,
  AgentTerminalPanelProps,
  AgentLogStreamProps,
} from './types'

// hooks/index.ts (add to existing)
export { useParallelAgentStream } from './useParallelAgentStream'
export type {
  UseParallelAgentStreamOptions,
  UseParallelAgentStreamReturn,
  AgentStreamState,
} from './useParallelAgentStream'
```
