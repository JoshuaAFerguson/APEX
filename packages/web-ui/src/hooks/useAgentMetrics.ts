'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { wsClient } from '@/lib/websocket-client'
import type { ApexEvent } from '@/lib/websocket-client'
import { getConnectionStatus } from '@/types/websocket-connection'
import type {
  AgentMetrics,
  AgentMetricsAgent,
  UseAgentMetricsReturn,
  UseAgentMetricsOptions,
  AgentMetricsEventType,
  AgentEvent,
  UsageUpdateEvent,
} from '@/types/agent-metrics'
import {
  DEFAULT_AGENT_METRICS_OPTIONS,
  EMPTY_AGENT_METRICS,
  AGENT_METRICS_EVENTS,
  mapEventTypeToStatus,
  calculateAgentMetricsTotals,
  createEmptyAgentMetricsAgent,
} from '@/types/agent-metrics'
import type { WebSocketConnectionStatus } from '@/types/websocket-connection'

/**
 * Hook to subscribe to and aggregate real-time agent metrics via WebSocket
 *
 * Subscribes to agent:* and usage:updated WebSocket events to provide
 * real-time aggregated metrics for all agents in the system.
 *
 * @example
 * ```tsx
 * function AgentDashboard() {
 *   const { metrics, connectionStatus, isLoading, error, refresh } = useAgentMetrics()
 *
 *   if (isLoading) return <Loading />
 *   if (error) return <Error message={error} />
 *
 *   return (
 *     <div>
 *       <ConnectionIndicator status={connectionStatus} />
 *       <MetricsDisplay data={metrics} />
 *       <button onClick={refresh}>Refresh</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useAgentMetrics(options: UseAgentMetricsOptions = {}): UseAgentMetricsReturn {
  const {
    autoConnect = DEFAULT_AGENT_METRICS_OPTIONS.autoConnect,
    pollingIntervalMs = DEFAULT_AGENT_METRICS_OPTIONS.pollingIntervalMs,
    agentIds,
    timeRange,
    debug = DEFAULT_AGENT_METRICS_OPTIONS.debug,
  } = options

  // State management
  const [metrics, setMetrics] = useState<AgentMetrics>(() => ({
    ...EMPTY_AGENT_METRICS,
    lastUpdated: new Date(),
  }))
  const [connectionStatus, setConnectionStatus] = useState<WebSocketConnectionStatus>('disconnected')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Refs for stable callbacks and cleanup
  const agentsMapRef = useRef<Map<string, AgentMetricsAgent>>(new Map())
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const connectionCheckRef = useRef<NodeJS.Timeout | null>(null)
  const hasReceivedDataRef = useRef(false)

  /**
   * Log debug messages if debug mode is enabled
   */
  const debugLog = useCallback(
    (message: string, ...args: unknown[]) => {
      if (debug) {
        console.log(`[useAgentMetrics] ${message}`, ...args)
      }
    },
    [debug]
  )

  /**
   * Check if an event type is an agent metrics event
   */
  const isAgentMetricsEvent = useCallback((type: string): type is AgentMetricsEventType => {
    return AGENT_METRICS_EVENTS.includes(type as AgentMetricsEventType)
  }, [])

  /**
   * Check if an agent should be included based on filter options
   */
  const shouldIncludeAgent = useCallback(
    (agentId: string): boolean => {
      if (!agentIds || agentIds.length === 0) {
        return true
      }
      return agentIds.includes(agentId)
    },
    [agentIds]
  )

  /**
   * Update metrics state from the agents map
   */
  const updateMetricsFromMap = useCallback(() => {
    const agents = Array.from(agentsMapRef.current.values())
    const totals = calculateAgentMetricsTotals(agents)

    setMetrics((prev) => ({
      ...prev,
      agents,
      totalTokens: totals.totalTokens,
      totalCost: totals.totalCost,
      lastUpdated: new Date(),
      timeRange: timeRange,
    }))

    if (!hasReceivedDataRef.current) {
      hasReceivedDataRef.current = true
      setIsLoading(false)
    }
  }, [timeRange])

  /**
   * Handle agent events (agent:started, agent:completed, etc.)
   */
  const handleAgentEvent = useCallback(
    (event: AgentEvent) => {
      const { agentId, agentName, type, timestamp, data } = event

      if (!shouldIncludeAgent(agentId)) {
        return
      }

      debugLog(`Received agent event: ${type}`, { agentId, data })

      // Get or create agent record
      let agent = agentsMapRef.current.get(agentId)
      if (!agent) {
        agent = createEmptyAgentMetricsAgent(agentId, agentName || agentId)
        agentsMapRef.current.set(agentId, agent)
      }

      // Update agent based on event type
      const newStatus = mapEventTypeToStatus(type)
      const isActive = type === 'agent:started' || type === 'agent:progress'

      const updatedAgent: AgentMetricsAgent = {
        ...agent,
        status: newStatus,
        isActive,
        lastActivityAt: new Date(timestamp),
        invocations: type === 'agent:started' ? agent.invocations + 1 : agent.invocations,
      }

      // Update token usage if provided
      if (data.tokens) {
        updatedAgent.inputTokens = (agent.inputTokens || 0) + (data.tokens.input || 0)
        updatedAgent.outputTokens = (agent.outputTokens || 0) + (data.tokens.output || 0)
        updatedAgent.totalTokens = updatedAgent.inputTokens + updatedAgent.outputTokens
      }

      // Update cost if provided
      if (data.cost !== undefined) {
        updatedAgent.estimatedCost = (agent.estimatedCost || 0) + data.cost
      }

      // Update duration if provided
      if (data.durationMs !== undefined) {
        updatedAgent.duration = (agent.duration || 0) + data.durationMs

        // Calculate tokens per second
        if (updatedAgent.duration > 0 && updatedAgent.totalTokens > 0) {
          updatedAgent.tokensPerSecond = (updatedAgent.totalTokens / updatedAgent.duration) * 1000
        }
      }

      agentsMapRef.current.set(agentId, updatedAgent)
      updateMetricsFromMap()
    },
    [shouldIncludeAgent, updateMetricsFromMap, debugLog]
  )

  /**
   * Handle usage update events
   */
  const handleUsageUpdate = useCallback(
    (event: UsageUpdateEvent) => {
      const { data, timestamp } = event
      const { agentId, tokens, cost, performance } = data

      if (!shouldIncludeAgent(agentId)) {
        return
      }

      debugLog('Received usage update', { agentId, tokens, cost })

      // Get or create agent record
      let agent = agentsMapRef.current.get(agentId)
      if (!agent) {
        agent = createEmptyAgentMetricsAgent(agentId, agentId)
        agentsMapRef.current.set(agentId, agent)
      }

      // Update with new usage data
      const updatedAgent: AgentMetricsAgent = {
        ...agent,
        inputTokens: tokens.input,
        outputTokens: tokens.output,
        totalTokens: tokens.total,
        estimatedCost: cost,
        lastActivityAt: new Date(timestamp),
      }

      // Update cache tokens if provided
      if (tokens.cache !== undefined) {
        updatedAgent.cacheTokens = tokens.cache
      }

      // Update performance metrics if provided
      if (performance) {
        updatedAgent.tokensPerSecond = performance.tokensPerSecond
        updatedAgent.avgLatencyMs = performance.avgLatencyMs
      }

      agentsMapRef.current.set(agentId, updatedAgent)
      updateMetricsFromMap()
    },
    [shouldIncludeAgent, updateMetricsFromMap, debugLog]
  )

  /**
   * Handle WebSocket events
   */
  const handleWebSocketEvent = useCallback(
    (event: ApexEvent) => {
      setError(null)

      // Check if it's an agent event
      if (event.type.startsWith('agent:') && isAgentMetricsEvent(event.type)) {
        handleAgentEvent({
          type: event.type as AgentMetricsEventType,
          timestamp: event.timestamp,
          agentId: (event.data.agentId as string) || event.taskId || 'unknown',
          agentName: event.data.agentName as string | undefined,
          data: {
            tokens: event.data.tokens as AgentEvent['data']['tokens'],
            cost: event.data.cost as number | undefined,
            durationMs: event.data.durationMs as number | undefined,
            error: event.data.error as string | undefined,
            metadata: event.data.metadata as Record<string, unknown> | undefined,
          },
        })
        return
      }

      // Check if it's a usage update event
      if (event.type === 'usage:updated') {
        handleUsageUpdate({
          type: 'usage:updated',
          timestamp: event.timestamp,
          data: {
            agentId: (event.data.agentId as string) || event.taskId || 'unknown',
            tokens: event.data.tokens as UsageUpdateEvent['data']['tokens'],
            cost: event.data.cost as number,
            performance: event.data.performance as UsageUpdateEvent['data']['performance'],
          },
        })
      }
    },
    [isAgentMetricsEvent, handleAgentEvent, handleUsageUpdate]
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
    setMetrics((prev) => ({
      ...prev,
      connectionStatus: status,
    }))

    // Set error if disconnected with failures
    if (!isConnected && healthState.consecutiveFailures > 0) {
      setError('Connection lost. Attempting to reconnect...')
    } else if (isConnected) {
      setError(null)
    }
  }, [])

  /**
   * Refresh metrics data manually
   */
  const refresh = useCallback(() => {
    debugLog('Manual refresh triggered')
    setIsLoading(true)
    setError(null)

    // Clear existing data
    agentsMapRef.current.clear()
    hasReceivedDataRef.current = false

    // Reconnect to get fresh state
    if (!wsClient.isConnected()) {
      wsClient.connect()
    }

    // Set loading to false after a timeout if no data received
    setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setIsLoading(false)
        updateMetricsFromMap()
      }
    }, 3000)
  }, [debugLog, updateMetricsFromMap])

  // Set up WebSocket subscriptions
  useEffect(() => {
    debugLog('Setting up WebSocket subscriptions')

    // Subscribe to agent events
    AGENT_METRICS_EVENTS.forEach((eventType) => {
      wsClient.on(eventType, handleWebSocketEvent)
    })

    // Also subscribe to wildcard for any agent events we might miss
    wsClient.on('*', (event: ApexEvent) => {
      if (event.type.startsWith('agent:') || event.type === 'usage:updated') {
        handleWebSocketEvent(event)
      }
    })

    // Auto-connect if enabled
    if (autoConnect && !wsClient.isConnected()) {
      wsClient.connect()
    }

    // Set up connection status polling
    connectionCheckRef.current = setInterval(updateConnectionStatus, 1000)
    updateConnectionStatus() // Initial check

    // Set initial loading state
    setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setIsLoading(false)
      }
    }, 5000)

    // Cleanup
    return () => {
      debugLog('Cleaning up WebSocket subscriptions')

      AGENT_METRICS_EVENTS.forEach((eventType) => {
        wsClient.off(eventType, handleWebSocketEvent)
      })

      if (connectionCheckRef.current) {
        clearInterval(connectionCheckRef.current)
        connectionCheckRef.current = null
      }
    }
  }, [autoConnect, handleWebSocketEvent, updateConnectionStatus, debugLog])

  // Set up optional polling
  useEffect(() => {
    if (pollingIntervalMs > 0) {
      debugLog(`Setting up polling interval: ${pollingIntervalMs}ms`)

      pollingIntervalRef.current = setInterval(() => {
        refresh()
      }, pollingIntervalMs)

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    }
  }, [pollingIntervalMs, refresh, debugLog])

  return {
    metrics,
    connectionStatus,
    isLoading,
    error,
    refresh,
  }
}
