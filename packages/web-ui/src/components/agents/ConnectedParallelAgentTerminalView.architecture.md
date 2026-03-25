# ConnectedParallelAgentTerminalView - Architecture Design

## Overview

The `ConnectedParallelAgentTerminalView` is an integration wrapper component that connects the existing `ParallelAgentTerminalView` grid layout component to the `useAgentTerminals` WebSocket log streaming hook. It provides a fully-integrated, data-connected experience for monitoring multiple parallel agent executions with automatic agent registration/unregistration, log data streaming, and imperative controls.

## Acceptance Criteria

> New component or HOC that wraps ParallelAgentTerminalView and uses useAgentTerminals for data. Component auto-registers/unregisters agents, passes log data to panels, and exposes hook controls through ref API.

## Architecture Decision Records

### ADR-001: Integration Pattern - Wrapper Component vs HOC

**Decision**: Implement as a **wrapper component** rather than a Higher-Order Component (HOC).

**Rationale**:
- Wrapper components are more explicit and easier to reason about in React 18+
- Better TypeScript inference for props and ref types
- Aligns with React team's recommendation to favor composition over HOCs
- Easier to test in isolation
- HOCs add complexity with prop forwarding and ref handling that wrappers avoid
- Modern React patterns favor hooks + composition over HOCs

**Alternatives Considered**:
- **HOC (withAgentTerminals)**: Would wrap ParallelAgentTerminalView but adds indirection and prop forwarding complexity
- **Render Props**: Would require more boilerplate from consumers
- **Context Provider**: Would require more setup and doesn't fit the single-component use case

### ADR-002: Component Naming

**Decision**: Name the component `ConnectedParallelAgentTerminalView`

**Rationale**:
- "Connected" prefix follows Redux/MobX conventions for data-connected components
- Clearly indicates this is the ParallelAgentTerminalView + data source
- Distinguishes from the presentational `ParallelAgentTerminalView`
- Alternative names considered:
  - `IntegratedParallelAgentTerminalView` - more verbose
  - `ParallelAgentTerminalViewConnected` - suffix pattern less common
  - `LiveParallelAgentTerminalView` - could confuse with streaming state

### ADR-003: Data Flow Architecture

**Decision**: Implement one-way data flow from `useAgentTerminals` to `ParallelAgentTerminalView`.

```
┌──────────────────────────────────────────────────────────────────────┐
│                  ConnectedParallelAgentTerminalView                  │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                      useAgentTerminals()                        │ │
│  │  ┌─────────────┐  ┌─────────────────┐  ┌──────────────────────┐ │ │
│  │  │ WebSocket   │->│ Agent State Map │->│ Control Methods      │ │ │
│  │  │ Connection  │  │ (logs, status)  │  │ (pause, clear, etc)  │ │ │
│  │  └─────────────┘  └─────────────────┘  └──────────────────────┘ │ │
│  └───────────────────────────────┬─────────────────────────────────┘ │
│                                  │                                   │
│  ┌───────────────────────────────▼─────────────────────────────────┐ │
│  │                  ParallelAgentTerminalView                       │ │
│  │  ┌─────────────────────────────────────────────────────────────┐ │ │
│  │  │ Panels array with injected log data from hook state         │ │ │
│  │  └─────────────────────────────────────────────────────────────┘ │ │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐     │ │
│  │  │  Panel 1  │  │  Panel 2  │  │  Panel 3  │  │  Panel N  │     │ │
│  │  │AgentTermi │  │AgentTermi │  │AgentTermi │  │AgentTermi │     │ │
│  │  │nalPanel   │  │nalPanel   │  │nalPanel   │  │nalPanel   │     │ │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘     │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

**Rationale**:
- Single source of truth for agent data (useAgentTerminals hook)
- Clear separation between data management (hook) and presentation (component)
- Enables predictable state updates through hook actions
- Avoids prop drilling by computing panel configs from hook state

### ADR-004: Automatic Agent Registration Strategy

**Decision**: Implement automatic agent registration using `useEffect` with dependency tracking on the `agents` prop array.

**Registration Flow**:
1. On mount: Register all agents from `agents` prop
2. On agents array change:
   - Register newly added agents (set difference: new - existing)
   - Unregister removed agents (set difference: existing - new)
3. On unmount: Unregister all agents

**Rationale**:
- Declarative API - consumers just provide agent configs, no imperative registration needed
- Handles dynamic agent additions/removals automatically
- Clean cleanup on unmount prevents memory leaks
- Uses stable identity comparison via agentId strings

**Implementation**:
```typescript
useEffect(() => {
  const currentAgentIds = new Set(agents.map(a => a.agentId))
  const registeredAgentIds = new Set(agentIds)

  // Register new agents
  agents.forEach(agent => {
    if (!isAgentRegistered(agent.agentId)) {
      registerAgent({
        agentId: agent.agentId,
        agentName: agent.title,
        maxLogs: agent.panelProps?.maxLogs,
      })
    }
  })

  // Unregister removed agents
  registeredAgentIds.forEach(id => {
    if (!currentAgentIds.has(id)) {
      unregisterAgent(id)
    }
  })

  // Cleanup on unmount
  return () => {
    currentAgentIds.forEach(id => unregisterAgent(id))
  }
}, [agents, agentIds, registerAgent, unregisterAgent, isAgentRegistered])
```

### ADR-005: Ref API Design

**Decision**: Expose a combined ref API that includes both `ParallelAgentTerminalViewRef` methods AND `useAgentTerminals` control methods.

**Rationale**:
- Single ref access point for all operations
- Consistent with existing patterns in the codebase
- Allows external control of both view state and data streams

**Interface**:
```typescript
export interface ConnectedParallelAgentTerminalViewRef {
  // From ParallelAgentTerminalViewRef
  minimizeAll: () => void
  restoreAll: () => void
  getAllStates: () => Record<string, PanelDisplayState>
  maximizePanel: (panelId: string) => void
  focusPanel: (panelId: string) => void

  // From useAgentTerminals (selected controls)
  pauseAgent: (agentId: string) => void
  resumeAgent: (agentId: string) => void
  clearAgentLogs: (agentId: string) => void
  pauseAll: () => void
  resumeAll: () => void
  clearAll: () => void
  reconnect: () => void

  // Additional integration controls
  registerAgent: (config: AgentTerminalConfig) => void
  unregisterAgent: (agentId: string) => void
  getAgentLogs: (agentId: string) => AgentLogEntry[]
  exportAgentLogs: (agentId: string, format: 'json' | 'text' | 'csv') => string
}
```

### ADR-006: Panel Data Injection Pattern

**Decision**: Transform `AgentTerminalPanelConfig[]` input by injecting log data from `useAgentTerminals` state into `panelProps`.

**Current AgentTerminalPanelConfig**:
```typescript
interface AgentTerminalPanelConfig {
  panelId: string
  agentId: string
  title?: string
  agentStatus?: AgentStatus
  initialState?: PanelDisplayState
  autoConnect?: boolean
  panelProps?: Partial<AgentTerminalPanelProps>
}
```

**Problem**: The existing `AgentTerminalPanel` uses its own `useAgentLogStream` hook internally. We need to override this with data from `useAgentTerminals`.

**Solution**: Create enriched panel configs that disable internal streaming and inject logs via props:

```typescript
const enrichedPanels = useMemo(() => {
  return agents.map(agentConfig => {
    const agentState = getAgentState(agentConfig.agentId)

    return {
      ...agentConfig,
      // Override autoConnect since we manage connections centrally
      autoConnect: false,
      panelProps: {
        ...agentConfig.panelProps,
        // Inject logs from hook state
        // Note: AgentTerminalPanel needs to accept these overrides
        // This may require modification to AgentTerminalPanel
      }
    }
  })
}, [agents, getAgentState])
```

**Challenge Identified**: The current `AgentTerminalPanel` doesn't accept pre-loaded logs as props - it always uses `useAgentLogStream` internally. We have two options:

**Option A**: Modify `AgentTerminalPanel` to accept optional `logs` prop that bypasses internal streaming
**Option B**: Create a new `ControlledAgentTerminalPanel` variant
**Option C**: Use render prop pattern to inject logs into the display portion only

**Recommended**: **Option A** - Minimal change, follows controlled/uncontrolled pattern already in component.

### ADR-007: Connection Management

**Decision**: Centralize WebSocket connection management in the wrapper component.

**Rationale**:
- Single WebSocket connection shared across all panels (already handled by useAgentTerminals)
- Individual panels don't need to manage their own connections
- Reduces WebSocket connection count
- Enables bulk pause/resume operations
- Consistent connection status across all panels

**Implementation**:
- Set `autoConnect: false` on all panel configs
- Manage connection via useAgentTerminals hook
- Pass `connectionHealth` status to panels for display

## Component Interface

### Props Interface

```typescript
import type { AgentTerminalPanelConfig, GridGap, PanelDisplayMode } from './ParallelAgentTerminalView.types'
import type { AgentTerminalConfig, UseAgentTerminalsOptions } from '@/types/agent-terminals'
import type { PanelDisplayState } from '@/types/agent-terminal-panel'

/**
 * Agent configuration for ConnectedParallelAgentTerminalView
 * Extends AgentTerminalPanelConfig with streaming options
 */
export interface ConnectedAgentConfig extends Omit<AgentTerminalPanelConfig, 'autoConnect'> {
  /**
   * Maximum logs to buffer for this agent
   * @default from useAgentTerminals defaultMaxLogs
   */
  maxLogs?: number

  /**
   * Initial log filter for this agent
   */
  initialFilter?: Partial<LogFilter>

  /**
   * Whether to auto-start streaming for this agent
   * @default true
   */
  autoStart?: boolean
}

/**
 * Props for ConnectedParallelAgentTerminalView
 */
export interface ConnectedParallelAgentTerminalViewProps {
  /**
   * Array of agent configurations (1-12 agents)
   * Agents will be automatically registered/unregistered
   */
  agents: ConnectedAgentConfig[]

  /**
   * Gap size between panels
   * @default 'md'
   */
  gap?: GridGap

  /**
   * Maximum height for the container
   * @default 'auto'
   */
  maxHeight?: string | 'auto' | 'none'

  /**
   * Controlled panel states (optional)
   */
  panelStates?: Record<string, PanelDisplayState>

  /**
   * Callback when any panel state changes
   */
  onPanelStateChange?: (
    panelId: string,
    newState: PanelDisplayState,
    allStates: Record<string, PanelDisplayState>
  ) => void

  /**
   * Callback when a panel is closed
   * Note: This also unregisters the agent from streaming
   */
  onPanelClose?: (panelId: string) => void

  /**
   * CSS class name for the container
   */
  className?: string

  /**
   * Test ID for testing
   */
  testId?: string

  /**
   * Display mode applied to all panels
   * @default 'normal'
   */
  displayMode?: PanelDisplayMode

  /**
   * Whether to show loading skeleton during initial connection
   * @default false
   */
  showLoadingSkeleton?: boolean

  // === Streaming Options ===

  /**
   * Whether to auto-connect to WebSocket on mount
   * @default true
   */
  autoConnect?: boolean

  /**
   * Default max logs per agent
   * @default 500
   */
  defaultMaxLogs?: number

  /**
   * Callback when logs are received for any agent
   */
  onLogs?: (agentId: string, logs: AgentLogEntry[]) => void

  /**
   * Callback when any error occurs
   */
  onError?: (agentId: string | null, error: string) => void

  /**
   * Callback when connection status changes
   */
  onConnectionChange?: (health: WebSocketConnectionHealth) => void

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean
}
```

### Ref Interface

```typescript
import type { PanelDisplayState } from '@/types/agent-terminal-panel'
import type { AgentLogEntry, LogFilter } from '@/types/agent-log-stream'
import type { AgentTerminalConfig, AggregateStats } from '@/types/agent-terminals'

/**
 * Imperative handle interface for ConnectedParallelAgentTerminalView
 */
export interface ConnectedParallelAgentTerminalViewRef {
  // === Panel View Controls (from ParallelAgentTerminalViewRef) ===

  /** Minimize all panels */
  minimizeAll: () => void

  /** Restore all panels to normal state */
  restoreAll: () => void

  /** Get current state of all panels */
  getAllStates: () => Record<string, PanelDisplayState>

  /** Maximize a specific panel */
  maximizePanel: (panelId: string) => void

  /** Focus a specific panel */
  focusPanel: (panelId: string) => void

  // === Per-Agent Stream Controls (from useAgentTerminals) ===

  /** Pause log streaming for a specific agent */
  pauseAgent: (agentId: string) => void

  /** Resume log streaming for a specific agent */
  resumeAgent: (agentId: string) => void

  /** Clear logs for a specific agent */
  clearAgentLogs: (agentId: string) => void

  /** Set filter for a specific agent */
  setAgentFilter: (agentId: string, filter: Partial<LogFilter>) => void

  /** Reset filter for a specific agent */
  resetAgentFilter: (agentId: string) => void

  /** Export logs for a specific agent */
  exportAgentLogs: (agentId: string, format: 'json' | 'text' | 'csv') => string

  /** Get logs for a specific agent */
  getAgentLogs: (agentId: string) => AgentLogEntry[]

  /** Get filtered logs for a specific agent */
  getAgentFilteredLogs: (agentId: string) => AgentLogEntry[]

  // === Bulk Stream Controls ===

  /** Pause all agent streams */
  pauseAll: () => void

  /** Resume all agent streams */
  resumeAll: () => void

  /** Clear all agent logs */
  clearAll: () => void

  /** Reconnect WebSocket connection */
  reconnect: () => void

  // === Agent Registration ===

  /** Register a new agent */
  registerAgent: (config: AgentTerminalConfig) => void

  /** Unregister an agent */
  unregisterAgent: (agentId: string) => void

  /** Check if agent is registered */
  isAgentRegistered: (agentId: string) => boolean

  // === Status ===

  /** Get aggregate stats across all agents */
  getAggregateStats: () => AggregateStats

  /** Check if WebSocket is connected */
  isConnected: boolean

  /** Check if currently reconnecting */
  isReconnecting: boolean
}
```

## Component Structure

```
ConnectedParallelAgentTerminalView/
├── ConnectedParallelAgentTerminalView.tsx           # Main wrapper component
├── ConnectedParallelAgentTerminalView.types.ts      # Type definitions
├── ConnectedParallelAgentTerminalView.architecture.md  # This document
├── __tests__/
│   ├── ConnectedParallelAgentTerminalView.test.tsx  # Unit tests
│   ├── ConnectedParallelAgentTerminalView.integration.test.tsx
│   └── ConnectedParallelAgentTerminalView.registration.test.tsx
└── index.ts                                         # Barrel export (update existing)
```

## Implementation Outline

```tsx
'use client'

import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useEffect,
  useRef,
  useCallback
} from 'react'
import { ParallelAgentTerminalView } from './ParallelAgentTerminalView'
import type { ParallelAgentTerminalViewRef } from './ParallelAgentTerminalView.types'
import { useAgentTerminals } from '@/hooks/useAgentTerminals'
import type {
  ConnectedParallelAgentTerminalViewProps,
  ConnectedParallelAgentTerminalViewRef,
} from './ConnectedParallelAgentTerminalView.types'

export const ConnectedParallelAgentTerminalView = forwardRef<
  ConnectedParallelAgentTerminalViewRef,
  ConnectedParallelAgentTerminalViewProps
>(({
  agents,
  gap = 'md',
  maxHeight = 'auto',
  panelStates,
  onPanelStateChange,
  onPanelClose,
  className,
  testId = 'connected-parallel-agent-terminal-view',
  displayMode = 'normal',
  showLoadingSkeleton = false,
  autoConnect = true,
  defaultMaxLogs = 500,
  onLogs,
  onError,
  onConnectionChange,
  debug = false,
}, ref) => {
  // Ref to the underlying ParallelAgentTerminalView
  const viewRef = useRef<ParallelAgentTerminalViewRef>(null)

  // Initialize useAgentTerminals hook with options
  const {
    agents: agentStates,
    agentIds,
    connectionHealth,
    aggregateStats,
    getAgentState,
    getAgentLogs,
    getAgentFilteredLogs,
    getAgentConnectionStatus,
    registerAgent,
    unregisterAgent,
    isAgentRegistered,
    pauseAgent,
    resumeAgent,
    clearAgentLogs,
    setAgentFilter,
    resetAgentFilter,
    exportAgentLogs,
    pauseAll,
    resumeAll,
    clearAll,
    reconnect,
    connect,
    disconnect,
    isConnected,
    isReconnecting,
  } = useAgentTerminals({
    autoConnect,
    defaultMaxLogs,
    onLogs,
    onError,
    onConnectionChange,
    debug,
  })

  // Track previous agents for registration diff
  const prevAgentIdsRef = useRef<Set<string>>(new Set())

  // Auto-register/unregister agents when agents prop changes
  useEffect(() => {
    const currentAgentIds = new Set(agents.map(a => a.agentId))
    const prevAgentIds = prevAgentIdsRef.current

    // Register new agents
    agents.forEach(agent => {
      if (!prevAgentIds.has(agent.agentId) && !isAgentRegistered(agent.agentId)) {
        registerAgent({
          agentId: agent.agentId,
          agentName: agent.title,
          maxLogs: agent.maxLogs,
          initialFilter: agent.initialFilter,
          autoStart: agent.autoStart,
        })
      }
    })

    // Unregister removed agents
    prevAgentIds.forEach(id => {
      if (!currentAgentIds.has(id)) {
        unregisterAgent(id)
      }
    })

    prevAgentIdsRef.current = currentAgentIds

    // Cleanup on unmount
    return () => {
      currentAgentIds.forEach(id => {
        if (isAgentRegistered(id)) {
          unregisterAgent(id)
        }
      })
    }
  }, [agents, registerAgent, unregisterAgent, isAgentRegistered])

  // Transform agents to panel configs with injected state
  const panelConfigs = useMemo(() => {
    return agents.map(agent => {
      const agentState = getAgentState(agent.agentId)

      return {
        panelId: agent.panelId,
        agentId: agent.agentId,
        title: agent.title,
        agentStatus: agent.agentStatus,
        initialState: agent.initialState,
        autoConnect: false, // Managed centrally
        panelProps: {
          ...agent.panelProps,
          // Note: Logs injection happens in AgentTerminalPanel
          // when we support controlled log data
        },
      }
    })
  }, [agents, getAgentState])

  // Handle panel close - also unregister agent
  const handlePanelClose = useCallback((panelId: string) => {
    const agent = agents.find(a => a.panelId === panelId)
    if (agent) {
      unregisterAgent(agent.agentId)
    }
    onPanelClose?.(panelId)
  }, [agents, unregisterAgent, onPanelClose])

  // Expose combined ref API
  useImperativeHandle(ref, () => ({
    // Panel view controls (delegated to ParallelAgentTerminalView)
    minimizeAll: () => viewRef.current?.minimizeAll(),
    restoreAll: () => viewRef.current?.restoreAll(),
    getAllStates: () => viewRef.current?.getAllStates() ?? {},
    maximizePanel: (panelId) => viewRef.current?.maximizePanel(panelId),
    focusPanel: (panelId) => viewRef.current?.focusPanel(panelId),

    // Per-agent stream controls
    pauseAgent,
    resumeAgent,
    clearAgentLogs,
    setAgentFilter,
    resetAgentFilter,
    exportAgentLogs,
    getAgentLogs,
    getAgentFilteredLogs,

    // Bulk stream controls
    pauseAll,
    resumeAll,
    clearAll,
    reconnect,

    // Agent registration
    registerAgent,
    unregisterAgent,
    isAgentRegistered,

    // Status
    getAggregateStats: () => aggregateStats,
    isConnected,
    isReconnecting,
  }), [
    pauseAgent,
    resumeAgent,
    clearAgentLogs,
    setAgentFilter,
    resetAgentFilter,
    exportAgentLogs,
    getAgentLogs,
    getAgentFilteredLogs,
    pauseAll,
    resumeAll,
    clearAll,
    reconnect,
    registerAgent,
    unregisterAgent,
    isAgentRegistered,
    aggregateStats,
    isConnected,
    isReconnecting,
  ])

  return (
    <ParallelAgentTerminalView
      ref={viewRef}
      panels={panelConfigs}
      gap={gap}
      maxHeight={maxHeight}
      panelStates={panelStates}
      onPanelStateChange={onPanelStateChange}
      onPanelClose={handlePanelClose}
      className={className}
      testId={testId}
      displayMode={displayMode}
      showLoadingSkeleton={showLoadingSkeleton}
    />
  )
})

ConnectedParallelAgentTerminalView.displayName = 'ConnectedParallelAgentTerminalView'
```

## Dependencies

### Internal Dependencies
- `@/components/agents/ParallelAgentTerminalView` - Grid layout component
- `@/hooks/useAgentTerminals` - WebSocket log streaming hook
- `@/types/agent-terminals` - Agent terminal types
- `@/types/agent-log-stream` - Log entry types
- `@/types/agent-terminal-panel` - Panel state types

### External Dependencies
- `react` - Core React library

## Testing Strategy

### Unit Tests
1. Auto-registers agents on mount
2. Auto-unregisters agents when removed from props
3. Auto-unregisters all agents on unmount
4. Correctly transforms agent configs to panel configs
5. Exposes all ref methods correctly
6. Calls onPanelClose and unregisters agent when panel closed
7. Passes streaming options to useAgentTerminals

### Integration Tests
1. Full data flow from WebSocket to panel display
2. Panel controls work (minimize/maximize/restore)
3. Stream controls work (pause/resume/clear)
4. Multiple agents register and receive independent log streams
5. Dynamic agent addition/removal works correctly

### Edge Cases
1. Empty agents array
2. Rapidly changing agents array
3. Duplicate agent IDs
4. Maximum 12 agents limit
5. WebSocket disconnection/reconnection

## Performance Considerations

1. **Memoization**: Use `useMemo` for panel config transformation
2. **Stable Callbacks**: Use `useCallback` for all handlers
3. **Registration Diffing**: Only register/unregister changed agents
4. **Ref Stability**: Use `useRef` for tracking previous state
5. **Avoid Unnecessary Renders**: Panel configs only update when agents change

## Future Enhancements

1. **Log Data Injection**: Modify `AgentTerminalPanel` to accept controlled log data
2. **Connection Status Overlay**: Show global connection status
3. **Error Boundary**: Wrap with error boundary for graceful failures
4. **Persistence**: Save/restore panel states and filters
5. **Real-time Stats Display**: Show aggregate stats in header

## File Outputs

This architecture will produce the following files:

1. `packages/web-ui/src/components/agents/ConnectedParallelAgentTerminalView.tsx`
2. `packages/web-ui/src/components/agents/ConnectedParallelAgentTerminalView.types.ts`
3. `packages/web-ui/src/components/agents/__tests__/ConnectedParallelAgentTerminalView.test.tsx`
4. `packages/web-ui/src/components/agents/__tests__/ConnectedParallelAgentTerminalView.integration.test.tsx`
5. `packages/web-ui/src/components/agents/index.ts` (update exports)
6. `packages/web-ui/src/hooks/index.ts` (ensure useAgentTerminals exported)

## Summary

The `ConnectedParallelAgentTerminalView` provides a clean integration between the presentation-focused `ParallelAgentTerminalView` and the data-focused `useAgentTerminals` hook. It follows React best practices with:

- Declarative API for consumers
- Automatic lifecycle management
- Combined ref API for imperative control
- Clear separation of concerns
- Comprehensive type safety
