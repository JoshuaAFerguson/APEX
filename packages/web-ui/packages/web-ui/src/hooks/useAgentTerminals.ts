/**
 * useAgentTerminals Hook
 *
 * Coordinates WebSocket log streaming for multiple agents (up to 12).
 * Provides per-agent log buffering, connection status tracking,
 * and bulk control operations while sharing a single WebSocket connection.
 *
 * @packageDocumentation
 */

'use client'

import { useState, useEffect, useCallback, useReducer, useMemo, useRef } from 'react'
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
  AgentTerminalsAction,
  AggregateStats,
} from '@/types/agent-terminals'
import {
  MAX_AGENTS,
  DEFAULT_LOGS_PER_AGENT,
  STALE_EVENT_THRESHOLD_MS,
  EMPTY_AGENT_TERMINALS_STATE,
  createEmptyAgentTerminalState,
  calculateAggregateStats,
  validateAgentLimit,
  validateAgentConfig,
} from '@/types/agent-terminals'
import type { AgentLogEntry, LogFilter } from '@/types/agent-log-stream'
import {
  filterLogs,
  exportLogs,
  calculateLogStreamStats,
  DEFAULT_LOG_FILTER,
} from '@/types/agent-log-stream'
import type { WebSocketConnectionHealth } from '@/types/websocket-connection'

/**
 * Transform WebSocket events to AgentLogEntry (reusing from useAgentLogStream)
 */
function transformEventToLogEntry(event: ApexEvent, agentId: string): AgentLogEntry | null {
  // Map event type to log level and source
  const logMapping: Record<string, { level: 'debug' | 'info' | 'warn' | 'error'; source: 'agent' | 'system' | 'user' | 'tool' | 'error' }> = {
    'agent:log': { level: 'info', source: 'agent' },
    'agent:output': { level: 'info', source: 'agent' },
    'agent:error': { level: 'error', source: 'error' },
    'agent:started': { level: 'info', source: 'system' },
    'agent:completed': { level: 'info', source: 'system' },
    'agent:failed': { level: 'error', source: 'error' },
    'agent:progress': { level: 'info', source: 'agent' },
    'tool:start': { level: 'info', source: 'tool' },
    'tool:complete': { level: 'info', source: 'tool' },
    'tool:error': { level: 'error', source: 'tool' },
  }

  const mapping = logMapping[event.type]
  if (!mapping) return null

  // Extract message from event data
  const extractMessage = (event: ApexEvent): string => {
    if (event.data.message) return String(event.data.message)
    if (event.data.output) return String(event.data.output)
    if (event.data.error) return String(event.data.error)

    switch (event.type) {
      case 'agent:started':
        return `Agent ${event.data.agentName || agentId} started`
      case 'agent:completed':
        return `Agent ${event.data.agentName || agentId} completed`
      case 'agent:failed':
        return `Agent ${event.data.agentName || agentId} failed: ${event.data.error || 'Unknown error'}`
      case 'tool:start':
        return `Tool ${event.data.toolName || 'unknown'} started`
      case 'tool:complete':
        return `Tool ${event.data.toolName || 'unknown'} completed`
      case 'tool:error':
        return `Tool ${event.data.toolName || 'unknown'} failed: ${event.data.error || 'Unknown error'}`
      default:
        return JSON.stringify(event.data)
    }
  }

  // Extract metadata from event
  const extractMetadata = (event: ApexEvent) => {
    return {
      agentId,
      agentName: event.data.agentName as string | undefined,
      executionId: event.taskId,
      stage: event.data.stage as string | undefined,
      toolName: event.data.toolName as string | undefined,
      durationMs: event.data.durationMs as number | undefined,
      tokens: event.data.tokens as { input: number; output: number; total: number } | undefined,
      cost: event.data.cost as number | undefined,
      error: event.data.error ? {
        message: String(event.data.error),
        code: event.data.errorCode as string | undefined,
        stack: event.data.stack as string | undefined,
      } : undefined,
      extra: event.data.metadata as Record<string, unknown> | undefined,
    }
  }

  // Generate sequence number (simple incrementing counter)
  const generateSequenceNumber = (): number => {
    if (typeof window !== 'undefined') {
      if (!window.__agentLogSequenceCounter) {
        window.__agentLogSequenceCounter = 0
      }
      return ++window.__agentLogSequenceCounter
    }
    // Fallback for SSR
    return Date.now()
  }

  return {
    id: crypto.randomUUID(),
    timestamp: event.timestamp,
    level: mapping.level,
    source: mapping.source,
    message: extractMessage(event),
    metadata: extractMetadata(event),
    sequenceNumber: generateSequenceNumber(),
    isStreaming: true,
  }
}

/**
 * Reducer for managing agent terminals state
 */
function agentTerminalsReducer(
  state: AgentTerminalsState,
  action: AgentTerminalsAction
): AgentTerminalsState {
  switch (action.type) {
    case 'REGISTER_AGENT': {
      // Validate that we can add another agent
      try {
        validateAgentLimit(state.agents.size)
        validateAgentConfig(action.config)
      } catch (error) {
        console.error('[useAgentTerminals] Registration validation failed:', error)
        return state
      }

      // Check if agent already exists
      if (state.agents.has(action.config.agentId)) {
        console.warn('[useAgentTerminals] Agent already registered:', action.config.agentId)
        return state
      }

      const newAgents = new Map(state.agents)
      newAgents.set(action.config.agentId, createEmptyAgentTerminalState(action.config))

      return {
        ...state,
        agents: newAgents,
        aggregateStats: calculateAggregateStats(newAgents),
      }
    }

    case 'UNREGISTER_AGENT': {
      const newAgents = new Map(state.agents)
      newAgents.delete(action.agentId)

      return {
        ...state,
        agents: newAgents,
        aggregateStats: calculateAggregateStats(newAgents),
      }
    }

    case 'ADD_LOGS': {
      const agentState = state.agents.get(action.agentId)
      if (!agentState) return state

      const maxLogs = agentState.config.maxLogs || DEFAULT_LOGS_PER_AGENT
      const newLogs = [...agentState.logs, ...action.logs]

      // FIFO trimming - remove oldest logs when buffer is full
      const trimmedLogs = newLogs.length > maxLogs
        ? newLogs.slice(-maxLogs)
        : newLogs

      // Filter logs based on current filter
      const filteredLogs = filterLogs(trimmedLogs, agentState.filter)

      // Calculate new stats
      const streamStartedAt = agentState.streamState.streamStartedAt || new Date()
      const stats = calculateLogStreamStats(trimmedLogs, streamStartedAt)

      // Estimate bytes for new logs (rough estimate: ~500 bytes per log)
      const bytesReceived = action.logs.length * 500

      const updatedAgentState: AgentTerminalState = {
        ...agentState,
        logs: trimmedLogs,
        filteredLogs,
        stats,
        streamState: {
          ...agentState.streamState,
          logsReceivedCount: agentState.streamState.logsReceivedCount + action.logs.length,
          lastLogAt: new Date(),
          bytesReceived: agentState.streamState.bytesReceived + bytesReceived,
          isReceiving: true,
          streamStartedAt: streamStartedAt,
        }
      }

      const newAgents = new Map(state.agents)
      newAgents.set(action.agentId, updatedAgentState)

      return {
        ...state,
        agents: newAgents,
        aggregateStats: calculateAggregateStats(newAgents),
      }
    }

    case 'CLEAR_LOGS': {
      const agentState = state.agents.get(action.agentId)
      if (!agentState) return state

      const updatedAgentState: AgentTerminalState = {
        ...agentState,
        logs: [],
        filteredLogs: [],
        streamState: {
          ...agentState.streamState,
          logsReceivedCount: 0,
          lastLogAt: null,
          bytesReceived: 0,
        }
      }

      const newAgents = new Map(state.agents)
      newAgents.set(action.agentId, updatedAgentState)

      return {
        ...state,
        agents: newAgents,
        aggregateStats: calculateAggregateStats(newAgents),
      }
    }

    case 'CLEAR_ALL_LOGS': {
      const newAgents = new Map<string, AgentTerminalState>()

      state.agents.forEach((agentState, agentId) => {
        newAgents.set(agentId, {
          ...agentState,
          logs: [],
          filteredLogs: [],
          streamState: {
            ...agentState.streamState,
            logsReceivedCount: 0,
            lastLogAt: null,
            bytesReceived: 0,
          }
        })
      })

      return {
        ...state,
        agents: newAgents,
        aggregateStats: calculateAggregateStats(newAgents),
      }
    }

    case 'PAUSE_AGENT': {
      const agentState = state.agents.get(action.agentId)
      if (!agentState) return state

      const updatedAgentState: AgentTerminalState = {
        ...agentState,
        isPaused: true,
        streamState: {
          ...agentState.streamState,
          state: 'paused'
        }
      }

      const newAgents = new Map(state.agents)
      newAgents.set(action.agentId, updatedAgentState)

      return {
        ...state,
        agents: newAgents,
        aggregateStats: calculateAggregateStats(newAgents),
      }
    }

    case 'RESUME_AGENT': {
      const agentState = state.agents.get(action.agentId)
      if (!agentState) return state

      const updatedAgentState: AgentTerminalState = {
        ...agentState,
        isPaused: false,
        streamState: {
          ...agentState.streamState,
          state: 'streaming'
        }
      }

      const newAgents = new Map(state.agents)
      newAgents.set(action.agentId, updatedAgentState)

      return {
        ...state,
        agents: newAgents,
        aggregateStats: calculateAggregateStats(newAgents),
      }
    }

    case 'PAUSE_ALL': {
      const newAgents = new Map<string, AgentTerminalState>()

      state.agents.forEach((agentState, agentId) => {
        newAgents.set(agentId, {
          ...agentState,
          isPaused: true,
          streamState: {
            ...agentState.streamState,
            state: 'paused'
          }
        })
      })

      return {
        ...state,
        agents: newAgents,
        aggregateStats: calculateAggregateStats(newAgents),
      }
    }

    case 'RESUME_ALL': {
      const newAgents = new Map<string, AgentTerminalState>()

      state.agents.forEach((agentState, agentId) => {
        newAgents.set(agentId, {
          ...agentState,
          isPaused: false,
          streamState: {
            ...agentState.streamState,
            state: 'streaming'
          }
        })
      })

      return {
        ...state,
        agents: newAgents,
        aggregateStats: calculateAggregateStats(newAgents),
      }
    }

    case 'SET_AGENT_FILTER': {
      const agentState = state.agents.get(action.agentId)
      if (!agentState) return state

      const newFilter = { ...agentState.filter, ...action.filter }
      const filteredLogs = filterLogs(agentState.logs, newFilter)

      const updatedAgentState: AgentTerminalState = {
        ...agentState,
        filter: newFilter,
        filteredLogs
      }

      const newAgents = new Map(state.agents)
      newAgents.set(action.agentId, updatedAgentState)

      return {
        ...state,
        agents: newAgents,
      }
    }

    case 'RESET_AGENT_FILTER': {
      const agentState = state.agents.get(action.agentId)
      if (!agentState) return state

      const defaultFilter = { ...DEFAULT_LOG_FILTER }
      const filteredLogs = filterLogs(agentState.logs, defaultFilter)

      const updatedAgentState: AgentTerminalState = {
        ...agentState,
        filter: defaultFilter,
        filteredLogs
      }

      const newAgents = new Map(state.agents)
      newAgents.set(action.agentId, updatedAgentState)

      return {
        ...state,
        agents: newAgents,
      }
    }

    case 'UPDATE_CONNECTION_HEALTH': {
      return {
        ...state,
        connectionHealth: action.health,
      }
    }

    case 'UPDATE_AGENT_LAST_EVENT': {
      const agentState = state.agents.get(action.agentId)
      if (!agentState) return state

      const updatedAgentState: AgentTerminalState = {
        ...agentState,
        streamState: {
          ...agentState.streamState,
          lastLogAt: action.timestamp,
          isReceiving: true,
        }
      }

      const newAgents = new Map(state.agents)
      newAgents.set(action.agentId, updatedAgentState)

      return {
        ...state,
        agents: newAgents,
        aggregateStats: calculateAggregateStats(newAgents),
      }
    }

    case 'SET_AGENT_ERROR': {
      const agentState = state.agents.get(action.agentId)
      if (!agentState) return state

      const updatedAgentState: AgentTerminalState = {
        ...agentState,
        error: action.error,
        streamState: {
          ...agentState.streamState,
          state: action.error ? 'error' : agentState.streamState.state,
          error: action.error,
        }
      }

      const newAgents = new Map(state.agents)
      newAgents.set(action.agentId, updatedAgentState)

      return {
        ...state,
        agents: newAgents,
        aggregateStats: calculateAggregateStats(newAgents),
      }
    }

    case 'UPDATE_AGENT_STATS': {
      const agentState = state.agents.get(action.agentId)
      if (!agentState) return state

      const updatedAgentState: AgentTerminalState = {
        ...agentState,
        stats: { ...agentState.stats, ...action.stats }
      }

      const newAgents = new Map(state.agents)
      newAgents.set(action.agentId, updatedAgentState)

      return {
        ...state,
        agents: newAgents,
      }
    }

    default:
      return state
  }
}

/**
 * Hook to coordinate WebSocket log streaming for multiple agents.
 *
 * Manages up to 12 concurrent agent log streams using a shared WebSocket connection,
 * with per-agent log buffering, connection status tracking, and bulk operations.
 *
 * @example
 * ```tsx
 * function ParallelAgentDashboard({ agentIds }: { agentIds: string[] }) {
 *   const {
 *     agents,
 *     connectionHealth,
 *     registerAgent,
 *     getAgentFilteredLogs,
 *     pauseAgent,
 *     resumeAgent,
 *     clearAgentLogs,
 *   } = useAgentTerminals({
 *     agents: agentIds.map(id => ({ agentId: id })),
 *     autoConnect: true,
 *   })
 *
 *   return (
 *     <div className="grid grid-cols-3 gap-4">
 *       {Array.from(agents.entries()).map(([agentId, state]) => (
 *         <AgentTerminalPanel
 *           key={agentId}
 *           agentId={agentId}
 *           logs={state.filteredLogs}
 *           streamState={state.streamState}
 *           onPause={() => pauseAgent(agentId)}
 *           onResume={() => resumeAgent(agentId)}
 *           onClear={() => clearAgentLogs(agentId)}
 *         />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useAgentTerminals(
  options: UseAgentTerminalsOptions = {}
): UseAgentTerminalsReturn {
  const {
    agents: initialAgents = [],
    autoConnect = true,
    defaultMaxLogs = DEFAULT_LOGS_PER_AGENT,
    onLogs,
    onAgentStatusChange,
    onConnectionChange,
    onError,
    debug = false,
  } = options

  // State management with reducer
  const [state, dispatch] = useReducer(agentTerminalsReducer, EMPTY_AGENT_TERMINALS_STATE)

  // Get global WebSocket connection health
  const connectionHealth = useWebSocketConnection()

  // Refs for stable callbacks
  const agentsRef = useRef<Map<string, AgentTerminalState>>(new Map())
  const statsUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Log debug messages if debug mode is enabled
   */
  const debugLog = useCallback(
    (message: string, ...args: unknown[]) => {
      if (debug) {
        console.log(`[useAgentTerminals] ${message}`, ...args)
      }
    },
    [debug]
  )

  // Update agents ref whenever state changes
  useEffect(() => {
    agentsRef.current = state.agents
  }, [state.agents])

  // Update connection health in state whenever it changes
  useEffect(() => {
    dispatch({ type: 'UPDATE_CONNECTION_HEALTH', health: connectionHealth })
    onConnectionChange?.(connectionHealth)
  }, [connectionHealth, onConnectionChange])

  /**
   * Handle WebSocket events and route to appropriate agents
   */
  const handleWebSocketEvent = useCallback(
    (event: ApexEvent) => {
      // Extract agentId from event (check multiple possible locations)
      const eventAgentId = (event.data.agentId || event.data.agent || event.taskId) as string | undefined

      if (!eventAgentId) {
        debugLog('Event has no agentId, skipping:', event.type)
        return
      }

      // Only process if we're tracking this agent
      const agentState = agentsRef.current.get(eventAgentId)
      if (!agentState) {
        debugLog('Event for unregistered agent, skipping:', eventAgentId, event.type)
        return
      }

      // Check if agent is paused
      if (agentState.isPaused) {
        debugLog('Agent is paused, skipping event:', eventAgentId, event.type)
        return
      }

      debugLog('Processing event for agent:', eventAgentId, event.type)

      // Update last event timestamp
      dispatch({
        type: 'UPDATE_AGENT_LAST_EVENT',
        agentId: eventAgentId,
        timestamp: event.timestamp
      })

      // Transform and dispatch to specific agent
      try {
        const logEntry = transformEventToLogEntry(event, eventAgentId)
        if (logEntry) {
          dispatch({ type: 'ADD_LOGS', agentId: eventAgentId, logs: [logEntry] })
          onLogs?.(eventAgentId, [logEntry])
        }
      } catch (error) {
        console.warn('[useAgentTerminals] Error transforming event:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        dispatch({ type: 'SET_AGENT_ERROR', agentId: eventAgentId, error: errorMessage })
        onError?.(eventAgentId, errorMessage)
      }
    },
    [onLogs, onError, debugLog]
  )

  // Set up WebSocket event subscriptions
  useEffect(() => {
    debugLog('Setting up WebSocket event subscriptions')

    // Subscribe to agent log-related events
    const agentLogEvents = [
      'agent:log',
      'agent:output',
      'agent:error',
      'agent:started',
      'agent:completed',
      'agent:failed',
      'agent:progress',
      'tool:start',
      'tool:complete',
      'tool:error',
    ]

    agentLogEvents.forEach((eventType) => {
      wsClient.on(eventType, handleWebSocketEvent)
    })

    // Auto-connect if enabled
    if (autoConnect && !wsClient.isConnected()) {
      debugLog('Auto-connecting to WebSocket')
      wsClient.connect()
    }

    // Cleanup
    return () => {
      debugLog('Cleaning up WebSocket event subscriptions')
      agentLogEvents.forEach((eventType) => {
        wsClient.off(eventType, handleWebSocketEvent)
      })
    }
  }, [handleWebSocketEvent, autoConnect, debugLog])

  // Register initial agents
  useEffect(() => {
    debugLog('Registering initial agents:', initialAgents.length)
    initialAgents.forEach((agentConfig) => {
      dispatch({ type: 'REGISTER_AGENT', config: agentConfig })
    })
  }, [initialAgents, debugLog])

  // Set up periodic stats updates
  useEffect(() => {
    debugLog('Setting up stats update interval')

    statsUpdateIntervalRef.current = setInterval(() => {
      // Update stats for each agent
      agentsRef.current.forEach((agentState, agentId) => {
        const newStats = calculateLogStreamStats(
          agentState.logs,
          agentState.streamState.streamStartedAt
        )
        dispatch({ type: 'UPDATE_AGENT_STATS', agentId, stats: newStats })
      })
    }, 5000) // Update every 5 seconds

    return () => {
      if (statsUpdateIntervalRef.current) {
        clearInterval(statsUpdateIntervalRef.current)
        statsUpdateIntervalRef.current = null
      }
    }
  }, [debugLog])

  // Per-agent accessor methods
  const getAgentState = useCallback((agentId: string) => {
    return state.agents.get(agentId)
  }, [state.agents])

  const getAgentLogs = useCallback((agentId: string) => {
    return state.agents.get(agentId)?.logs || []
  }, [state.agents])

  const getAgentFilteredLogs = useCallback((agentId: string) => {
    return state.agents.get(agentId)?.filteredLogs || []
  }, [state.agents])

  const getAgentConnectionStatus = useCallback((agentId: string): AgentConnectionStatus => {
    const agentState = state.agents.get(agentId)
    const now = Date.now()

    const status: AgentConnectionStatus = {
      agentId,
      status: connectionHealth.status,
      isReceivingEvents: agentState?.streamState.isReceiving ?? false,
      lastEventAt: agentState?.streamState.lastLogAt ?? null,
      timeSinceLastEvent: agentState?.streamState.lastLogAt
        ? now - agentState.streamState.lastLogAt.getTime()
        : null,
      isStale: agentState?.streamState.lastLogAt
        ? now - agentState.streamState.lastLogAt.getTime() > STALE_EVENT_THRESHOLD_MS
        : false,
      reconnectAttempts: connectionHealth.reconnectAttempts,
    }

    return status
  }, [state.agents, connectionHealth])

  // Registration methods
  const registerAgent = useCallback((config: AgentTerminalConfig) => {
    debugLog('Registering agent:', config.agentId)
    // Set default maxLogs if not provided
    const configWithDefaults = {
      ...config,
      maxLogs: config.maxLogs ?? defaultMaxLogs,
    }
    dispatch({ type: 'REGISTER_AGENT', config: configWithDefaults })
  }, [defaultMaxLogs, debugLog])

  const unregisterAgent = useCallback((agentId: string) => {
    debugLog('Unregistering agent:', agentId)
    dispatch({ type: 'UNREGISTER_AGENT', agentId })
  }, [debugLog])

  const isAgentRegistered = useCallback((agentId: string) => {
    return state.agents.has(agentId)
  }, [state.agents])

  // Per-agent control methods
  const pauseAgent = useCallback((agentId: string) => {
    debugLog('Pausing agent:', agentId)
    dispatch({ type: 'PAUSE_AGENT', agentId })
  }, [debugLog])

  const resumeAgent = useCallback((agentId: string) => {
    debugLog('Resuming agent:', agentId)
    dispatch({ type: 'RESUME_AGENT', agentId })
  }, [debugLog])

  const clearAgentLogs = useCallback((agentId: string) => {
    debugLog('Clearing logs for agent:', agentId)
    dispatch({ type: 'CLEAR_LOGS', agentId })
  }, [debugLog])

  const setAgentFilter = useCallback((agentId: string, filter: Partial<LogFilter>) => {
    debugLog('Setting filter for agent:', agentId, filter)
    dispatch({ type: 'SET_AGENT_FILTER', agentId, filter })
  }, [debugLog])

  const resetAgentFilter = useCallback((agentId: string) => {
    debugLog('Resetting filter for agent:', agentId)
    dispatch({ type: 'RESET_AGENT_FILTER', agentId })
  }, [debugLog])

  const exportAgentLogs = useCallback((agentId: string, format: 'json' | 'text' | 'csv') => {
    debugLog('Exporting logs for agent:', agentId, format)
    const logs = getAgentLogs(agentId)
    return exportLogs(logs, format)
  }, [getAgentLogs, debugLog])

  const addAgentLogs = useCallback((agentId: string, logs: AgentLogEntry[]) => {
    debugLog('Adding logs for agent:', agentId, logs.length)
    dispatch({ type: 'ADD_LOGS', agentId, logs })
    onLogs?.(agentId, logs)
  }, [onLogs, debugLog])

  // Bulk control methods
  const pauseAll = useCallback(() => {
    debugLog('Pausing all agents')
    dispatch({ type: 'PAUSE_ALL' })
  }, [debugLog])

  const resumeAll = useCallback(() => {
    debugLog('Resuming all agents')
    dispatch({ type: 'RESUME_ALL' })
  }, [debugLog])

  const clearAll = useCallback(() => {
    debugLog('Clearing logs for all agents')
    dispatch({ type: 'CLEAR_ALL_LOGS' })
  }, [debugLog])

  const reconnect = useCallback(() => {
    debugLog('Reconnecting WebSocket')
    wsClient.disconnect()
    wsClient.connect()
  }, [debugLog])

  // Connection methods
  const connect = useCallback(() => {
    debugLog('Connecting to WebSocket')
    wsClient.connect()
  }, [debugLog])

  const disconnect = useCallback(() => {
    debugLog('Disconnecting from WebSocket')
    wsClient.disconnect()
  }, [debugLog])

  // Derived state
  const agentIds = useMemo(() => Array.from(state.agents.keys()), [state.agents])
  const isConnected = useMemo(() => connectionHealth.status === 'connected', [connectionHealth.status])
  const isReconnecting = useMemo(() => connectionHealth.status === 'reconnecting', [connectionHealth.status])

  return {
    // State
    state,
    agents: state.agents,
    connectionHealth,
    agentIds,
    aggregateStats: state.aggregateStats,

    // Per-agent accessors
    getAgentState,
    getAgentLogs,
    getAgentFilteredLogs,
    getAgentConnectionStatus,

    // Registration methods
    registerAgent,
    unregisterAgent,
    isAgentRegistered,

    // Per-agent control methods
    pauseAgent,
    resumeAgent,
    clearAgentLogs,
    setAgentFilter,
    resetAgentFilter,
    exportAgentLogs,
    addAgentLogs,

    // Bulk control methods
    pauseAll,
    resumeAll,
    clearAll,
    reconnect,

    // Connection methods
    connect,
    disconnect,
    isConnected,
    isReconnecting,
  }
}