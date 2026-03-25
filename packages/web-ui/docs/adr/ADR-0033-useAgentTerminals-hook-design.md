# ADR-0033: useAgentTerminals Hook for Multi-Agent WebSocket Log Streaming

## Status
Proposed

## Date
2024-03-23

## Context

The APEX web UI needs to support viewing logs from up to 12 concurrent agents in a parallel agent execution dashboard. Currently, the `useAgentLogStream` hook manages WebSocket connection for a single agent. We need a coordinating hook that:

1. Manages WebSocket connections for multiple agents (up to 12)
2. Handles log buffering per agent
3. Provides connection status per agent
4. Supports reconnection on failure
5. Coordinates with existing infrastructure (`wsClient`, `useAgentLogStream`, `useAgentTerminalPanelState`)

## Decision

### Architecture Overview

We will create a new `useAgentTerminals` hook that acts as a **coordinator** for multiple agent log streams. Rather than creating 12 separate WebSocket connections (which would be resource-intensive), the hook will:

1. **Share a single WebSocket connection** via the existing `wsClient` singleton
2. **Multiplex agent events** through event filtering based on `agentId`
3. **Maintain per-agent state** for logs, connection status, and buffering
4. **Provide coordinated reconnection** that benefits all agents

### Design Principles

1. **Composition over Duplication**: Build on top of existing primitives (`wsClient`, event types)
2. **Resource Efficiency**: Single WebSocket connection, shared infrastructure
3. **Per-Agent Isolation**: Each agent has isolated log buffer and status
4. **Graceful Degradation**: Individual agent failures don't affect others
5. **Memory Safety**: Bounded buffers, cleanup on unmount

### Type Definitions

```typescript
// packages/web-ui/src/types/agent-terminals.ts

import type { AgentLogEntry, LogStreamState, LogStreamStats, LogFilter } from './agent-log-stream'
import type { WebSocketConnectionStatus, WebSocketConnectionHealth } from './websocket-connection'

/**
 * Maximum number of agents that can be tracked simultaneously
 */
export const MAX_AGENTS = 12

/**
 * Default log buffer size per agent
 */
export const DEFAULT_LOGS_PER_AGENT = 500

/**
 * Configuration for a single agent terminal
 */
export interface AgentTerminalConfig {
  /** Unique agent identifier */
  agentId: string

  /** Display name for the agent */
  agentName?: string

  /** Maximum logs to buffer (default: 500) */
  maxLogs?: number

  /** Initial filter state */
  initialFilter?: Partial<LogFilter>

  /** Whether to auto-start streaming (default: true) */
  autoStart?: boolean
}

/**
 * State for a single agent's terminal
 */
export interface AgentTerminalState {
  /** Agent configuration */
  config: AgentTerminalConfig

  /** Current logs in buffer */
  logs: AgentLogEntry[]

  /** Filtered logs based on current filter */
  filteredLogs: AgentLogEntry[]

  /** Current filter configuration */
  filter: LogFilter

  /** Stream state (idle, streaming, paused, etc.) */
  streamState: LogStreamState

  /** Stream statistics */
  stats: LogStreamStats

  /** Whether this agent's stream is paused */
  isPaused: boolean

  /** Error specific to this agent */
  error: string | null
}

/**
 * Connection status for an individual agent
 */
export interface AgentConnectionStatus {
  /** Agent identifier */
  agentId: string

  /** WebSocket connection status */
  status: WebSocketConnectionStatus

  /** Whether receiving events for this agent */
  isReceivingEvents: boolean

  /** Last event timestamp for this agent */
  lastEventAt: Date | null

  /** Time since last event (ms) */
  timeSinceLastEvent: number | null

  /** Number of reconnection attempts for this agent's stream */
  reconnectAttempts: number
}

/**
 * Global state for all agent terminals
 */
export interface AgentTerminalsState {
  /** Map of agent ID to terminal state */
  agents: Map<string, AgentTerminalState>

  /** Global WebSocket connection health */
  connectionHealth: WebSocketConnectionHealth

  /** IDs of agents currently registered */
  registeredAgentIds: string[]

  /** Overall stats aggregated across all agents */
  aggregateStats: {
    totalLogs: number
    totalAgents: number
    activeAgents: number
    errorCount: number
  }
}

/**
 * Options for useAgentTerminals hook
 */
export interface UseAgentTerminalsOptions {
  /**
   * Initial agent configurations
   * Can also be added dynamically via registerAgent
   */
  agents?: AgentTerminalConfig[]

  /**
   * Whether to auto-connect to WebSocket on mount
   * @default true
   */
  autoConnect?: boolean

  /**
   * Default max logs per agent (can be overridden per-agent)
   * @default 500
   */
  defaultMaxLogs?: number

  /**
   * Callback when logs are received for any agent
   */
  onLogs?: (agentId: string, logs: AgentLogEntry[]) => void

  /**
   * Callback when an agent's connection status changes
   */
  onAgentStatusChange?: (agentId: string, status: AgentConnectionStatus) => void

  /**
   * Callback when global connection status changes
   */
  onConnectionChange?: (health: WebSocketConnectionHealth) => void

  /**
   * Callback when any error occurs
   */
  onError?: (agentId: string | null, error: string) => void

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean
}

/**
 * Return type for useAgentTerminals hook
 */
export interface UseAgentTerminalsReturn {
  // === State ===

  /** Full state for all agents */
  state: AgentTerminalsState

  /** Map of agent ID to terminal state (convenience accessor) */
  agents: Map<string, AgentTerminalState>

  /** Global WebSocket connection health */
  connectionHealth: WebSocketConnectionHealth

  /** List of all registered agent IDs */
  agentIds: string[]

  // === Per-Agent Accessors ===

  /** Get state for a specific agent */
  getAgentState: (agentId: string) => AgentTerminalState | undefined

  /** Get logs for a specific agent */
  getAgentLogs: (agentId: string) => AgentLogEntry[]

  /** Get filtered logs for a specific agent */
  getAgentFilteredLogs: (agentId: string) => AgentLogEntry[]

  /** Get connection status for a specific agent */
  getAgentConnectionStatus: (agentId: string) => AgentConnectionStatus

  // === Registration Methods ===

  /**
   * Register a new agent terminal
   * @throws Error if MAX_AGENTS limit is reached
   */
  registerAgent: (config: AgentTerminalConfig) => void

  /**
   * Unregister an agent terminal and clean up resources
   */
  unregisterAgent: (agentId: string) => void

  /**
   * Check if an agent is registered
   */
  isAgentRegistered: (agentId: string) => boolean

  // === Per-Agent Control Methods ===

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

  // === Bulk Control Methods ===

  /** Pause all agent streams */
  pauseAll: () => void

  /** Resume all agent streams */
  resumeAll: () => void

  /** Clear all agent logs */
  clearAll: () => void

  /** Reconnect the WebSocket connection (affects all agents) */
  reconnect: () => void

  // === Connection Methods ===

  /** Connect to WebSocket (starts receiving events) */
  connect: () => void

  /** Disconnect from WebSocket (stops all streams) */
  disconnect: () => void

  /** Check if WebSocket is connected */
  isConnected: boolean

  /** Check if currently reconnecting */
  isReconnecting: boolean
}
```

### Hook Implementation Structure

```typescript
// packages/web-ui/src/hooks/useAgentTerminals.ts

'use client'

import { useReducer, useCallback, useEffect, useMemo, useRef } from 'react'
import { wsClient } from '@/lib/websocket-client'
import type { ApexEvent } from '@/lib/websocket-client'
import { useWebSocketConnection } from './useWebSocketConnection'
import type {
  UseAgentTerminalsOptions,
  UseAgentTerminalsReturn,
  AgentTerminalConfig,
  AgentTerminalState,
  AgentTerminalsState,
  AgentConnectionStatus,
} from '@/types/agent-terminals'
import {
  MAX_AGENTS,
  DEFAULT_LOGS_PER_AGENT,
  createEmptyAgentTerminalState,
  agentTerminalsReducer,
} from '@/types/agent-terminals'

export function useAgentTerminals(
  options: UseAgentTerminalsOptions = {}
): UseAgentTerminalsReturn {
  // Implementation details...
}
```

### State Management

The hook uses a reducer pattern (consistent with `useAgentLogStream`) with the following action types:

```typescript
export type AgentTerminalsAction =
  // Agent registration
  | { type: 'REGISTER_AGENT'; config: AgentTerminalConfig }
  | { type: 'UNREGISTER_AGENT'; agentId: string }

  // Log management
  | { type: 'ADD_LOGS'; agentId: string; logs: AgentLogEntry[] }
  | { type: 'CLEAR_LOGS'; agentId: string }
  | { type: 'CLEAR_ALL_LOGS' }

  // Stream control
  | { type: 'PAUSE_AGENT'; agentId: string }
  | { type: 'RESUME_AGENT'; agentId: string }
  | { type: 'PAUSE_ALL' }
  | { type: 'RESUME_ALL' }

  // Filter management
  | { type: 'SET_AGENT_FILTER'; agentId: string; filter: Partial<LogFilter> }
  | { type: 'RESET_AGENT_FILTER'; agentId: string }

  // Connection status
  | { type: 'UPDATE_CONNECTION_HEALTH'; health: WebSocketConnectionHealth }
  | { type: 'UPDATE_AGENT_LAST_EVENT'; agentId: string; timestamp: Date }

  // Error handling
  | { type: 'SET_AGENT_ERROR'; agentId: string; error: string | null }
```

### Event Multiplexing

The hook subscribes to WebSocket events once and routes them to appropriate agents:

```typescript
useEffect(() => {
  const handleEvent = (event: ApexEvent) => {
    // Extract agentId from event (check multiple possible locations)
    const eventAgentId =
      event.data.agentId ||
      event.data.agent ||
      event.taskId

    // Only process if we're tracking this agent
    if (!eventAgentId || !state.agents.has(eventAgentId)) {
      return
    }

    // Check if agent is paused
    const agentState = state.agents.get(eventAgentId)
    if (agentState?.isPaused) {
      return
    }

    // Transform and dispatch to specific agent
    const logEntry = transformEventToLogEntry(event, eventAgentId)
    if (logEntry) {
      dispatch({ type: 'ADD_LOGS', agentId: eventAgentId, logs: [logEntry] })
    }
  }

  // Subscribe to relevant event types
  const eventTypes = [
    'agent:log', 'agent:output', 'agent:error',
    'agent:started', 'agent:completed', 'agent:failed',
    'agent:progress', 'tool:start', 'tool:complete', 'tool:error'
  ]

  eventTypes.forEach(type => wsClient.on(type, handleEvent))

  return () => {
    eventTypes.forEach(type => wsClient.off(type, handleEvent))
  }
}, [state.agents])
```

### Memory Management

Each agent has a bounded log buffer:

```typescript
// In reducer ADD_LOGS handling
case 'ADD_LOGS': {
  const agentState = state.agents.get(action.agentId)
  if (!agentState) return state

  const maxLogs = agentState.config.maxLogs || DEFAULT_LOGS_PER_AGENT
  const newLogs = [...agentState.logs, ...action.logs]

  // FIFO trimming - remove oldest logs when buffer is full
  const trimmedLogs = newLogs.length > maxLogs
    ? newLogs.slice(-maxLogs)
    : newLogs

  // Update state...
}
```

### Reconnection Strategy

The hook leverages the existing `wsClient` reconnection infrastructure:

```typescript
// The wsClient already handles reconnection with exponential backoff
// The hook monitors connection health via useWebSocketConnection
const connectionHealth = useWebSocketConnection()

// Track reconnection state
const isReconnecting = connectionHealth.status === 'reconnecting'

// Provide manual reconnect capability
const reconnect = useCallback(() => {
  wsClient.disconnect()
  wsClient.connect()
}, [])
```

### Per-Agent Connection Status

Since all agents share one WebSocket, "connection status per agent" tracks event flow:

```typescript
const getAgentConnectionStatus = useCallback((agentId: string): AgentConnectionStatus => {
  const agentState = state.agents.get(agentId)
  const now = Date.now()

  return {
    agentId,
    status: connectionHealth.status,
    isReceivingEvents: agentState?.streamState.isReceiving ?? false,
    lastEventAt: agentState?.streamState.lastLogAt ?? null,
    timeSinceLastEvent: agentState?.streamState.lastLogAt
      ? now - agentState.streamState.lastLogAt.getTime()
      : null,
    reconnectAttempts: connectionHealth.reconnectAttempts,
  }
}, [state.agents, connectionHealth])
```

### Integration with Existing Components

The hook integrates with:

1. **`useAgentTerminalPanelState`**: For panel minimize/maximize coordination
2. **`AgentTerminalPanel`**: Can use per-agent state from this hook
3. **`wsClient`**: Shared WebSocket connection
4. **`useWebSocketConnection`**: Global connection health monitoring

### File Structure

```
packages/web-ui/src/
  types/
    agent-terminals.ts          # Type definitions and constants
  hooks/
    useAgentTerminals.ts        # Main hook implementation
    index.ts                    # Add export
  hooks/__tests__/
    useAgentTerminals.test.tsx  # Unit tests
    useAgentTerminals.integration.test.tsx  # Integration tests
```

## Consequences

### Positive

1. **Resource Efficient**: Single WebSocket connection shared across all agents
2. **Consistent Patterns**: Follows established hooks patterns in the codebase
3. **Scalable**: Supports up to 12 agents with bounded memory usage
4. **Composable**: Can be used alongside existing hooks
5. **Testable**: Reducer-based state management enables easy testing

### Negative

1. **Complexity**: More complex than 12 independent `useAgentLogStream` instances
2. **Single Point of Failure**: WebSocket disconnect affects all agents (mitigated by reconnection)
3. **Event Routing Overhead**: All events must be checked against all registered agents

### Neutral

1. **Breaking Change**: None - this is a new hook
2. **Migration**: Existing components can gradually adopt this hook

## Implementation Notes

### Phase 1: Core Implementation
- Type definitions
- Reducer and state management
- Basic hook with agent registration

### Phase 2: Event Handling
- WebSocket event subscription
- Event routing to agents
- Log transformation and buffering

### Phase 3: Control Methods
- Pause/resume per agent
- Filter management
- Export functionality

### Phase 4: Testing
- Unit tests for reducer
- Integration tests for WebSocket handling
- Edge case testing (max agents, reconnection)

## Test Strategy

```typescript
// Example test structure
describe('useAgentTerminals', () => {
  describe('agent registration', () => {
    it('registers agents up to MAX_AGENTS limit')
    it('throws error when exceeding MAX_AGENTS')
    it('unregisters agents and cleans up state')
  })

  describe('log streaming', () => {
    it('routes events to correct agent by agentId')
    it('respects per-agent pause state')
    it('enforces per-agent maxLogs buffer limit')
  })

  describe('connection management', () => {
    it('provides accurate connection status per agent')
    it('handles reconnection gracefully')
  })
})
```

## References

- Existing `useAgentLogStream` hook
- Existing `useWebSocketConnection` hook
- Existing `useAgentTerminalPanelState` hook
- `wsClient` WebSocket implementation
- ADR-0032: Agent Terminal Panel three-state architecture
