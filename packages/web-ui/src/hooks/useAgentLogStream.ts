'use client'

import { useState, useEffect, useCallback, useRef, useReducer, useMemo } from 'react'
import { wsClient } from '@/lib/websocket-client'
import type { ApexEvent } from '@/lib/websocket-client'
import { getConnectionStatus } from '@/types/websocket-connection'
import type { WebSocketConnectionStatus } from '@/types/websocket-connection'
import type { LogLevel, LogFilter } from '@/types/log-viewer'
import type {
  AgentLogEntry,
  LogSource,
  AgentLogMetadata,
  UseAgentLogStreamOptions,
  UseAgentLogStreamReturn,
  LogStreamState,
  LogStreamStats,
  StreamingState,
  AgentLogStreamAction,
} from '@/types/agent-log-stream'
import {
  DEFAULT_AGENT_LOG_STREAM_OPTIONS,
  EMPTY_LOG_STREAM_STATE,
  EMPTY_LOG_STREAM_STATS,
  DEFAULT_LOG_FILTER,
  createAgentLogEntry,
  calculateLogStreamStats,
  filterLogs,
  exportLogs,
} from '@/types/agent-log-stream'

/**
 * Internal state type for the hook
 */
interface UseAgentLogStreamState {
  logs: AgentLogEntry[]
  filter: LogFilter
  streamState: LogStreamState
  stats: LogStreamStats
  isPaused: boolean
  maxLogs: number
}

/**
 * Reducer for managing agent log stream state
 */
function agentLogStreamReducer(
  state: UseAgentLogStreamState,
  action: AgentLogStreamAction
): UseAgentLogStreamState {
  switch (action.type) {
    case 'ADD_LOGS': {
      const newLogs = [...state.logs, ...action.payload]

      // Trim to maxLogs (FIFO - remove oldest)
      const trimmedLogs = newLogs.length > state.maxLogs
        ? newLogs.slice(-state.maxLogs)
        : newLogs

      // Estimate bytes for new logs (rough estimate: ~500 bytes per log)
      const bytesReceived = action.payload.length * 500

      return {
        ...state,
        logs: trimmedLogs,
        streamState: {
          ...state.streamState,
          logsReceivedCount: state.streamState.logsReceivedCount + action.payload.length,
          lastLogAt: new Date(),
          bytesReceived: state.streamState.bytesReceived + bytesReceived,
          isReceiving: true,
        }
      }
    }

    case 'CLEAR_LOGS': {
      return {
        ...state,
        logs: [],
        streamState: {
          ...state.streamState,
          logsReceivedCount: 0,
          lastLogAt: null,
          bytesReceived: 0,
        },
        stats: { ...EMPTY_LOG_STREAM_STATS }
      }
    }

    case 'SET_FILTER': {
      return {
        ...state,
        filter: {
          ...state.filter,
          ...action.payload
        }
      }
    }

    case 'RESET_FILTER': {
      return {
        ...state,
        filter: { ...DEFAULT_LOG_FILTER }
      }
    }

    case 'SET_STREAM_STATE': {
      return {
        ...state,
        streamState: {
          ...state.streamState,
          ...action.payload
        }
      }
    }

    case 'SET_STREAMING': {
      return {
        ...state,
        streamState: {
          ...state.streamState,
          state: action.payload,
          streamStartedAt: action.payload === 'streaming' && !state.streamState.streamStartedAt
            ? new Date()
            : state.streamState.streamStartedAt
        }
      }
    }

    case 'SET_ERROR': {
      return {
        ...state,
        streamState: {
          ...state.streamState,
          error: action.payload,
          state: action.payload ? 'error' : state.streamState.state
        }
      }
    }

    case 'PAUSE': {
      return {
        ...state,
        isPaused: true,
        streamState: {
          ...state.streamState,
          state: 'paused'
        }
      }
    }

    case 'RESUME': {
      return {
        ...state,
        isPaused: false,
        streamState: {
          ...state.streamState,
          state: 'streaming'
        }
      }
    }

    case 'UPDATE_STATS': {
      return {
        ...state,
        stats: {
          ...state.stats,
          ...action.payload
        }
      }
    }

    default:
      return state
  }
}

/**
 * Transform WebSocket events to AgentLogEntry
 */
function transformEventToLogEntry(event: ApexEvent, agentId: string): AgentLogEntry | null {
  // Map event type to log level and source
  const logMapping: Record<string, { level: LogLevel; source: LogSource }> = {
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
  const extractMetadata = (event: ApexEvent): AgentLogMetadata => {
    return {
      agentId,
      agentName: event.data.agentName as string | undefined,
      executionId: event.taskId,
      stage: event.data.stage as string | undefined,
      toolName: event.data.toolName as string | undefined,
      durationMs: event.data.durationMs as number | undefined,
      tokens: event.data.tokens as AgentLogMetadata['tokens'],
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

  return createAgentLogEntry({
    id: crypto.randomUUID(),
    timestamp: event.timestamp,
    level: mapping.level,
    source: mapping.source,
    message: extractMessage(event),
    metadata: extractMetadata(event),
    sequenceNumber: generateSequenceNumber(),
    isStreaming: true,
  })
}

// Global sequence counter for log entries
declare global {
  interface Window {
    __agentLogSequenceCounter?: number
  }
}

if (typeof window !== 'undefined') {
  window.__agentLogSequenceCounter = window.__agentLogSequenceCounter || 0
}

/**
 * Hook to subscribe to agent log events via WebSocket, buffer logs, handle connection state,
 * and provide log entries and streaming status.
 *
 * Integrates with existing wsClient infrastructure and provides real-time log streaming
 * with filtering, pause/resume, and export capabilities.
 *
 * @example
 * ```tsx
 * function AgentTerminalPanel({ agentId }: { agentId: string }) {
 *   const {
 *     filteredLogs,
 *     streamState,
 *     stats,
 *     isStreaming,
 *     isPaused,
 *     connect,
 *     disconnect,
 *     pause,
 *     resume,
 *     clearLogs,
 *     setFilter,
 *     scrollToBottom,
 *   } = useAgentLogStream({
 *     agentId,
 *     maxLogs: 1000,
 *     autoConnect: true,
 *   })
 *
 *   return (
 *     <div>
 *       <LogStreamHeader
 *         state={streamState}
 *         stats={stats}
 *         onPause={pause}
 *         onResume={resume}
 *         onClear={clearLogs}
 *       />
 *       <LogFilterBar onFilterChange={setFilter} />
 *       <VirtualLogList logs={filteredLogs} />
 *       {isStreaming && <StreamingIndicator />}
 *     </div>
 *   )
 * }
 * ```
 */
export function useAgentLogStream(options: UseAgentLogStreamOptions): UseAgentLogStreamReturn {
  const {
    agentId,
    autoConnect = DEFAULT_AGENT_LOG_STREAM_OPTIONS.autoConnect,
    maxLogs = DEFAULT_AGENT_LOG_STREAM_OPTIONS.maxLogs,
    filter: initialFilter,
    onLogs,
    onConnectionChange,
    onError,
    debug = DEFAULT_AGENT_LOG_STREAM_OPTIONS.debug,
  } = options

  // State management with reducer
  const [state, dispatch] = useReducer(agentLogStreamReducer, {
    logs: [],
    filter: initialFilter ? { ...DEFAULT_LOG_FILTER, ...initialFilter } : { ...DEFAULT_LOG_FILTER },
    streamState: { ...EMPTY_LOG_STREAM_STATE },
    stats: { ...EMPTY_LOG_STREAM_STATS },
    isPaused: false,
    maxLogs, // Store maxLogs in state for reducer access
  })

  // Connection status tracking
  const [connectionStatus, setConnectionStatus] = useState<WebSocketConnectionStatus>('disconnected')

  // Refs for stable callbacks and state
  const isPausedRef = useRef(false)
  const scrollContainerRef = useRef<HTMLElement | null>(null)
  const logElementsRef = useRef<Map<string, HTMLElement>>(new Map())
  const connectionCheckRef = useRef<NodeJS.Timeout | null>(null)
  const statsUpdateRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Log debug messages if debug mode is enabled
   */
  const debugLog = useCallback(
    (message: string, ...args: unknown[]) => {
      if (debug) {
        console.log(`[useAgentLogStream] ${message}`, ...args)
      }
    },
    [debug]
  )

  /**
   * Update connection status based on wsClient state
   */
  const updateConnectionStatus = useCallback(() => {
    const isConnected = wsClient.isConnected()
    const healthState = wsClient.getHealthState()

    // Get reconnector stats safely
    let isReconnecting = false
    try {
      if ('reconnector' in wsClient) {
        const stats = (wsClient as any).reconnector?.getStats()
        isReconnecting = stats?.state === 'reconnecting' || stats?.state === 'connecting'
      }
    } catch {
      // Silently handle reconnector access issues
    }

    const status = getConnectionStatus(
      isConnected,
      isReconnecting,
      healthState.isHealthy,
      healthState.consecutiveFailures
    )

    setConnectionStatus(status)
    dispatch({
      type: 'SET_STREAM_STATE',
      payload: { connectionStatus: status }
    })

    // Update streaming state based on connection
    if (status === 'connected' && state.streamState.state === 'connecting') {
      dispatch({ type: 'SET_STREAMING', payload: 'streaming' })
    } else if (status === 'disconnected' && state.streamState.state === 'streaming') {
      dispatch({ type: 'SET_STREAMING', payload: 'disconnected' })
    }

    onConnectionChange?.(status)
  }, [onConnectionChange, state.streamState.state])

  /**
   * Handle WebSocket events for this agent
   */
  const handleWebSocketEvent = useCallback(
    (event: ApexEvent) => {
      // Skip processing if paused
      if (isPausedRef.current) {
        debugLog('Skipping event (paused)', event.type)
        return
      }

      // Filter by agentId - check multiple possible locations
      const eventAgentId = event.data.agentId || event.data.agent || event.taskId
      if (eventAgentId !== agentId) {
        return
      }

      debugLog('Received agent event', event.type, eventAgentId)

      // Transform and dispatch
      try {
        const logEntry = transformEventToLogEntry(event, agentId)
        if (logEntry) {
          dispatch({ type: 'ADD_LOGS', payload: [logEntry] })
          onLogs?.([logEntry])
        }
      } catch (error) {
        console.warn('[useAgentLogStream] Error transforming event:', error)
        // Don't break stream for transform errors
      }
    },
    [agentId, onLogs, debugLog]
  )

  /**
   * Update statistics periodically
   */
  const updateStats = useCallback(() => {
    const newStats = calculateLogStreamStats(state.logs, state.streamState.streamStartedAt)
    dispatch({ type: 'UPDATE_STATS', payload: newStats })
  }, [state.logs, state.streamState.streamStartedAt])

  /**
   * Control methods
   */
  const connect = useCallback(() => {
    debugLog('Connecting to log stream')
    dispatch({ type: 'SET_STREAMING', payload: 'connecting' })
    if (!wsClient.isConnected()) {
      wsClient.connect()
    }
  }, [debugLog])

  const disconnect = useCallback(() => {
    debugLog('Disconnecting from log stream')
    dispatch({ type: 'SET_STREAMING', payload: 'disconnected' })
    // Don't disconnect the entire wsClient as other hooks might be using it
  }, [debugLog])

  const pause = useCallback(() => {
    debugLog('Pausing log stream')
    isPausedRef.current = true
    dispatch({ type: 'PAUSE' })
  }, [debugLog])

  const resume = useCallback(() => {
    debugLog('Resuming log stream')
    isPausedRef.current = false
    dispatch({ type: 'RESUME' })
  }, [debugLog])

  const clearLogs = useCallback(() => {
    debugLog('Clearing logs')
    dispatch({ type: 'CLEAR_LOGS' })
  }, [debugLog])

  const addLogs = useCallback((logs: AgentLogEntry[]) => {
    debugLog('Adding logs programmatically', logs.length)
    dispatch({ type: 'ADD_LOGS', payload: logs })
    onLogs?.(logs)
  }, [onLogs, debugLog])

  const setFilter = useCallback((filter: Partial<LogFilter>) => {
    debugLog('Setting filter', filter)
    dispatch({ type: 'SET_FILTER', payload: filter })
  }, [debugLog])

  const resetFilter = useCallback(() => {
    debugLog('Resetting filter')
    dispatch({ type: 'RESET_FILTER' })
  }, [debugLog])

  const exportLogsMethod = useCallback((format: 'json' | 'text' | 'csv') => {
    debugLog('Exporting logs', format, state.logs.length)
    return exportLogs(state.logs, format)
  }, [state.logs, debugLog])

  const scrollToLog = useCallback((logId: string) => {
    debugLog('Scrolling to log', logId)
    const element = logElementsRef.current.get(logId)
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [debugLog])

  const scrollToBottom = useCallback(() => {
    debugLog('Scrolling to bottom')
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [debugLog])

  // Memoized computed values
  const filteredLogs = useMemo(() => {
    return filterLogs(state.logs, state.filter)
  }, [state.logs, state.filter])

  const isConnecting = useMemo(() => state.streamState.state === 'connecting', [state.streamState.state])
  const isStreaming = useMemo(() => state.streamState.state === 'streaming', [state.streamState.state])
  const isPaused = useMemo(() => state.streamState.state === 'paused', [state.streamState.state])
  const error = useMemo(() => state.streamState.error, [state.streamState.error])

  // Set up WebSocket subscriptions
  useEffect(() => {
    debugLog('Setting up WebSocket subscriptions for agent:', agentId)

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

    // Also subscribe to wildcard to catch any missed events
    wsClient.on('*', (event: ApexEvent) => {
      if (event.type.startsWith('agent:') || event.type.startsWith('tool:')) {
        handleWebSocketEvent(event)
      }
    })

    // Auto-connect if enabled
    if (autoConnect && !wsClient.isConnected()) {
      connect()
    }

    // Set up connection status polling
    connectionCheckRef.current = setInterval(updateConnectionStatus, 1000)
    updateConnectionStatus() // Initial check

    // Cleanup
    return () => {
      debugLog('Cleaning up WebSocket subscriptions')

      agentLogEvents.forEach((eventType) => {
        wsClient.off(eventType, handleWebSocketEvent)
      })

      // Note: We can't easily unsubscribe from wildcard without affecting other components
      // This is a limitation of the current wsClient design

      if (connectionCheckRef.current) {
        clearInterval(connectionCheckRef.current)
        connectionCheckRef.current = null
      }
    }
  }, [agentId, autoConnect, handleWebSocketEvent, updateConnectionStatus, connect, debugLog])

  // Set up stats updates
  useEffect(() => {
    if (isStreaming) {
      debugLog('Setting up stats update interval')
      statsUpdateRef.current = setInterval(updateStats, 5000) // Update every 5 seconds
      return () => {
        if (statsUpdateRef.current) {
          clearInterval(statsUpdateRef.current)
          statsUpdateRef.current = null
        }
      }
    }
  }, [isStreaming, updateStats, debugLog])

  // Handle errors
  useEffect(() => {
    if (error) {
      onError?.(error)
    }
  }, [error, onError])

  return {
    // Data
    logs: state.logs,
    filteredLogs,
    filter: state.filter,
    streamState: state.streamState,
    stats: state.stats,

    // Status flags (derived)
    isConnecting,
    isStreaming,
    isPaused,
    error,

    // Control methods
    connect,
    disconnect,
    pause,
    resume,
    clearLogs,
    addLogs,
    setFilter,
    resetFilter,
    exportLogs: exportLogsMethod,
    scrollToLog,
    scrollToBottom,
  }
}