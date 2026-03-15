'use client'

/**
 * useRealtimeUpdates Hook
 *
 * React hook for subscribing to real-time WebSocket updates from the APEX server.
 * Provides health metrics, activity events, and performance data for dashboard components.
 *
 * @packageDocumentation
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { ApexWebSocketClient, type ApexEvent, type Task } from './websocket-client'
import type { ApexEventType } from '@apexcli/core'
import {
  type DashboardHealthMetrics,
  type DashboardActivityEvent,
  type DashboardPerformanceData,
  type RealtimeConnectionState,
  type RealtimeSubscriptionOptions,
  type RealtimeUpdatesState,
  type UseRealtimeUpdatesReturn,
  type TokenUsageMetrics,
  type TaskPerformanceMetrics,
  type AgentPerformanceMetrics,
  type ToolPerformanceMetrics,
  INITIAL_REALTIME_STATE,
  DEFAULT_SUBSCRIPTION_OPTIONS,
  transformApexEvent,
  calculateHealthStatus,
  DEFAULT_HEALTH_THRESHOLDS,
} from '../types/dashboard'

// Maximum number of events to keep in memory
const MAX_EVENTS = 500

// Performance data aggregation interval
const PERFORMANCE_AGGREGATION_INTERVAL = 5000

/**
 * Hook options
 */
export interface UseRealtimeUpdatesOptions {
  /** Auto-connect on mount */
  autoConnect?: boolean
  /** WebSocket URL (defaults to API server) */
  url?: string
  /** Subscription options */
  subscription?: RealtimeSubscriptionOptions
  /** Health check interval in ms */
  healthCheckInterval?: number
  /** Maximum events to keep */
  maxEvents?: number
}

/**
 * Default hook options
 */
const DEFAULT_OPTIONS: Required<UseRealtimeUpdatesOptions> = {
  autoConnect: true,
  url: '',
  subscription: DEFAULT_SUBSCRIPTION_OPTIONS,
  healthCheckInterval: 30000,
  maxEvents: MAX_EVENTS,
}

/**
 * React hook for real-time dashboard updates
 *
 * @param options - Hook configuration options
 * @returns Real-time updates state and control functions
 *
 * @example
 * ```tsx
 * function Dashboard() {
 *   const {
 *     state,
 *     connect,
 *     disconnect,
 *     markEventRead,
 *   } = useRealtimeUpdates({
 *     autoConnect: true,
 *     subscription: {
 *       includeHealth: true,
 *       includePerformance: true,
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       <ConnectionStatus status={state.connectionState} />
 *       <HealthMetrics metrics={state.health} />
 *       <ActivityFeed events={state.events} onRead={markEventRead} />
 *       <PerformanceCharts data={state.performance} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useRealtimeUpdates(
  options: UseRealtimeUpdatesOptions = {}
): UseRealtimeUpdatesReturn {
  const opts = useMemo(() => ({
    ...DEFAULT_OPTIONS,
    ...options,
    subscription: {
      ...DEFAULT_SUBSCRIPTION_OPTIONS,
      ...options.subscription,
    },
  }), [options])

  // State
  const [state, setState] = useState<RealtimeUpdatesState>(INITIAL_REALTIME_STATE)

  // Refs for mutable data that shouldn't trigger re-renders
  const clientRef = useRef<ApexWebSocketClient | null>(null)
  const subscriptionRef = useRef<RealtimeSubscriptionOptions>(opts.subscription)
  const performanceAggregatorRef = useRef<PerformanceAggregator | null>(null)
  const healthCheckTimerRef = useRef<NodeJS.Timeout | null>(null)
  const tasksRef = useRef<Map<string, Task>>(new Map())

  // Update subscription ref when options change
  useEffect(() => {
    subscriptionRef.current = opts.subscription
  }, [opts.subscription])

  // Initialize performance aggregator
  useEffect(() => {
    performanceAggregatorRef.current = new PerformanceAggregator()
    return () => {
      performanceAggregatorRef.current = null
    }
  }, [])

  /**
   * Update connection state
   */
  const updateConnectionState = useCallback((connectionState: RealtimeConnectionState) => {
    setState(prev => ({
      ...prev,
      connectionState,
      isConnected: connectionState === 'connected',
    }))
  }, [])

  /**
   * Update health metrics
   */
  const updateHealthMetrics = useCallback(() => {
    const client = clientRef.current
    if (!client) return

    const healthState = client.getHealthState()
    const stats = client.getHealthStatistics()

    // Count tasks by status
    const tasks = Array.from(tasksRef.current.values())
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)

    const activeTasks = tasks.filter(t => t.status === 'running').length
    const pendingTasks = tasks.filter(t => t.status === 'pending').length
    const completedLastHour = tasks.filter(t =>
      t.status === 'completed' &&
      t.updatedAt.getTime() > oneHourAgo
    ).length
    const failedLastHour = tasks.filter(t =>
      t.status === 'failed' &&
      t.updatedAt.getTime() > oneHourAgo
    ).length

    // Calculate average duration for completed tasks
    const completedTasks = tasks.filter(t => t.status === 'completed')
    const avgDurationMs = completedTasks.length > 0
      ? completedTasks.reduce((sum, t) => sum + (t.updatedAt.getTime() - t.createdAt.getTime()), 0) / completedTasks.length
      : 0

    const health: DashboardHealthMetrics = {
      status: 'healthy',
      connection: {
        isConnected: client.isConnected(),
        connectedSince: healthState.lastHealthyAt,
        reconnectAttempts: 0, // Would need to track this
        latencyMs: healthState.averageLatencyMs,
        averageLatencyMs: healthState.averageLatencyMs,
      },
      server: {
        uptimeMs: stats?.timeSinceLastSuccessMs ?? 0,
        lastHealthCheck: healthState.lastCheckAt,
        successRate: stats?.uptimePercentage ?? 100,
      },
      tasks: {
        activeTasks,
        pendingTasks,
        completedLastHour,
        failedLastHour,
        averageDurationMs: avgDurationMs,
      },
      lastUpdated: new Date(),
    }

    // Calculate overall status
    health.status = calculateHealthStatus(health, DEFAULT_HEALTH_THRESHOLDS)

    setState(prev => ({
      ...prev,
      health,
      lastUpdate: new Date(),
    }))
  }, [])

  /**
   * Handle incoming event
   */
  const handleEvent = useCallback((event: ApexEvent) => {
    const subscription = subscriptionRef.current

    // Filter by task ID if specified
    if (subscription.taskIds && subscription.taskIds.length > 0) {
      if (!event.taskId || !subscription.taskIds.includes(event.taskId)) {
        return
      }
    }

    // Filter by event type if specified
    if (subscription.eventTypes && subscription.eventTypes.length > 0) {
      if (!subscription.eventTypes.includes(event.type as ApexEventType)) {
        return
      }
    }

    // Transform and add event (cast to core ApexEvent type)
    const dashboardEvent = transformApexEvent(event as unknown as Parameters<typeof transformApexEvent>[0])

    setState(prev => {
      // Add event at the beginning (most recent first)
      const newEvents = [dashboardEvent, ...prev.events]

      // Limit events to max
      if (newEvents.length > opts.maxEvents) {
        newEvents.length = opts.maxEvents
      }

      return {
        ...prev,
        events: newEvents,
        lastUpdate: new Date(),
      }
    })

    // Update performance aggregator
    if (subscription.includePerformance && performanceAggregatorRef.current) {
      performanceAggregatorRef.current.processEvent(event)
    }
  }, [opts.maxEvents])

  /**
   * Handle task state updates
   */
  const handleTaskState = useCallback((tasks: Task[]) => {
    // Update tasks map
    tasks.forEach(task => {
      tasksRef.current.set(task.id, task)
    })

    // Update health metrics with task counts
    updateHealthMetrics()
  }, [updateHealthMetrics])

  /**
   * Update performance data
   */
  const updatePerformanceData = useCallback(() => {
    if (!performanceAggregatorRef.current) return
    if (!subscriptionRef.current.includePerformance) return

    const performanceData = performanceAggregatorRef.current.aggregate()

    setState(prev => ({
      ...prev,
      performance: performanceData,
      lastUpdate: new Date(),
    }))
  }, [])

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (clientRef.current?.isConnected()) {
      return
    }

    updateConnectionState('connecting')

    // Create new client if needed
    if (!clientRef.current) {
      clientRef.current = new ApexWebSocketClient(opts.url || undefined)
    }

    const client = clientRef.current

    // Subscribe to events
    client.on('*', handleEvent)
    client.onState(handleTaskState)

    // Subscribe to health events
    client.onHealth((event) => {
      if (event.type === 'health:check' || event.type === 'health:healthy' || event.type === 'health:recovered') {
        updateHealthMetrics()
      }
    })

    // Connect
    client.connect()

    // Update state on successful connection
    const checkConnection = setInterval(() => {
      if (client.isConnected()) {
        clearInterval(checkConnection)
        updateConnectionState('connected')
        updateHealthMetrics()
      }
    }, 100)

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkConnection)
      if (!client.isConnected()) {
        updateConnectionState('error')
        setState(prev => ({
          ...prev,
          error: new Error('Connection timeout'),
        }))
      }
    }, 10000)

    // Start health check timer
    if (opts.subscription.includeHealth) {
      healthCheckTimerRef.current = setInterval(() => {
        updateHealthMetrics()
      }, opts.healthCheckInterval)
    }

    // Start performance aggregation timer
    if (opts.subscription.includePerformance) {
      const perfTimer = setInterval(() => {
        updatePerformanceData()
      }, opts.subscription.performanceUpdateInterval ?? PERFORMANCE_AGGREGATION_INTERVAL)

      // Store timer for cleanup
      return () => clearInterval(perfTimer)
    }
  }, [opts.url, opts.subscription, opts.healthCheckInterval, handleEvent, handleTaskState, updateConnectionState, updateHealthMetrics, updatePerformanceData])

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect()
      clientRef.current = null
    }

    if (healthCheckTimerRef.current) {
      clearInterval(healthCheckTimerRef.current)
      healthCheckTimerRef.current = null
    }

    updateConnectionState('disconnected')
  }, [updateConnectionState])

  /**
   * Mark an event as read
   */
  const markEventRead = useCallback((eventId: string) => {
    setState(prev => ({
      ...prev,
      events: prev.events.map(e =>
        e.id === eventId ? { ...e, isRead: true } : e
      ),
    }))
  }, [])

  /**
   * Mark all events as read
   */
  const markAllEventsRead = useCallback(() => {
    setState(prev => ({
      ...prev,
      events: prev.events.map(e => ({ ...e, isRead: true })),
    }))
  }, [])

  /**
   * Clear all events
   */
  const clearEvents = useCallback(() => {
    setState(prev => ({
      ...prev,
      events: [],
    }))
  }, [])

  /**
   * Update subscription options
   */
  const updateSubscription = useCallback((newOptions: Partial<RealtimeSubscriptionOptions>) => {
    subscriptionRef.current = {
      ...subscriptionRef.current,
      ...newOptions,
    }
  }, [])

  /**
   * Force refresh performance data
   */
  const refreshPerformance = useCallback(() => {
    updatePerformanceData()
  }, [updatePerformanceData])

  /**
   * Force health check
   */
  const checkHealth = useCallback(async () => {
    const client = clientRef.current
    if (!client) return

    await client.checkHealth()
    updateHealthMetrics()
  }, [updateHealthMetrics])

  // Auto-connect on mount
  useEffect(() => {
    if (opts.autoConnect) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [opts.autoConnect]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    state,
    connect,
    disconnect,
    markEventRead,
    markAllEventsRead,
    clearEvents,
    updateSubscription,
    refreshPerformance,
    checkHealth,
  }
}

// ============================================================================
// Performance Aggregator Helper Class
// ============================================================================

/**
 * Aggregates performance metrics from events
 */
class PerformanceAggregator {
  private tokenUsage: TokenUsageMetrics = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0,
    tokensPerMinute: 0,
    cacheHitRate: 0,
    byAgent: {},
    byTool: {},
  }

  private taskMetrics: TaskPerformanceMetrics = {
    completedTasks: 0,
    failedTasks: 0,
    avgDurationMs: 0,
    medianDurationMs: 0,
    p95DurationMs: 0,
    successRate: 1,
    byStatus: {} as Record<string, number>,
    byStage: {},
  }

  private agentMetrics: Map<string, AgentPerformanceMetrics> = new Map()
  private toolMetrics: Map<string, ToolPerformanceMetrics> = new Map()
  private taskDurations: number[] = []
  private startTime: Date = new Date()

  processEvent(event: ApexEvent): void {
    const data = event.data

    // Process usage events
    if (event.type === 'usage:updated') {
      const usage = data as { inputTokens?: number; outputTokens?: number; totalTokens?: number; estimatedCost?: number }
      if (usage.inputTokens) this.tokenUsage.inputTokens += usage.inputTokens
      if (usage.outputTokens) this.tokenUsage.outputTokens += usage.outputTokens
      if (usage.totalTokens) this.tokenUsage.totalTokens = usage.totalTokens
      if (usage.estimatedCost) this.tokenUsage.estimatedCost += usage.estimatedCost

      // Track by agent
      const agentName = (data.agentName || data.agent) as string
      if (agentName) {
        if (!this.tokenUsage.byAgent[agentName]) {
          this.tokenUsage.byAgent[agentName] = { inputTokens: 0, outputTokens: 0, estimatedCost: 0 }
        }
        if (usage.inputTokens) this.tokenUsage.byAgent[agentName].inputTokens += usage.inputTokens
        if (usage.outputTokens) this.tokenUsage.byAgent[agentName].outputTokens += usage.outputTokens
        if (usage.estimatedCost) this.tokenUsage.byAgent[agentName].estimatedCost += usage.estimatedCost
      }
    }

    // Process task events
    if (event.type === 'task:completed') {
      this.taskMetrics.completedTasks++
      const duration = data.duration as number | undefined
      if (duration) {
        this.taskDurations.push(duration)
      }
    }

    if (event.type === 'task:failed') {
      this.taskMetrics.failedTasks++
    }

    // Process tool events
    if (event.type === 'tool:complete') {
      const toolName = (data.toolName || data.tool) as string
      const timing = data.timing as { duration?: number } | undefined
      const result = data.result as { success?: boolean } | undefined

      if (toolName) {
        if (!this.toolMetrics.has(toolName)) {
          this.toolMetrics.set(toolName, {
            toolName,
            invocations: 0,
            avgExecutionTimeMs: 0,
            successRate: 1,
            failures: 0,
            avgInputSize: 0,
            avgOutputSize: 0,
          })
        }

        const metrics = this.toolMetrics.get(toolName)!
        metrics.invocations++

        if (timing?.duration) {
          metrics.avgExecutionTimeMs =
            (metrics.avgExecutionTimeMs * (metrics.invocations - 1) + timing.duration) / metrics.invocations
        }

        if (result?.success === false) {
          metrics.failures++
        }

        metrics.successRate = (metrics.invocations - metrics.failures) / metrics.invocations

        // Track in token usage byTool
        if (!this.tokenUsage.byTool[toolName]) {
          this.tokenUsage.byTool[toolName] = { callCount: 0, avgDurationMs: 0, successRate: 1 }
        }
        this.tokenUsage.byTool[toolName].callCount++
        this.tokenUsage.byTool[toolName].avgDurationMs = metrics.avgExecutionTimeMs
        this.tokenUsage.byTool[toolName].successRate = metrics.successRate
      }
    }

    // Process agent events
    if (event.type === 'agent:message' || event.type === 'agent:tool-use') {
      const agentName = (data.agentName || data.agent) as string
      if (agentName) {
        if (!this.agentMetrics.has(agentName)) {
          this.agentMetrics.set(agentName, {
            agentName,
            invocations: 0,
            avgResponseTimeMs: 0,
            tokenUsage: { inputTokens: 0, outputTokens: 0, estimatedCost: 0 },
            toolCalls: {},
            errorCount: 0,
            successRate: 1,
          })
        }

        const metrics = this.agentMetrics.get(agentName)!
        metrics.invocations++

        if (event.type === 'agent:tool-use') {
          const toolName = (data.toolName || data.tool) as string
          if (toolName) {
            metrics.toolCalls[toolName] = (metrics.toolCalls[toolName] || 0) + 1
          }
        }
      }
    }
  }

  aggregate(): DashboardPerformanceData {
    // Calculate task metrics
    const totalTasks = this.taskMetrics.completedTasks + this.taskMetrics.failedTasks
    this.taskMetrics.successRate = totalTasks > 0
      ? this.taskMetrics.completedTasks / totalTasks
      : 1

    // Calculate duration statistics
    if (this.taskDurations.length > 0) {
      const sorted = [...this.taskDurations].sort((a, b) => a - b)
      this.taskMetrics.avgDurationMs = sorted.reduce((a, b) => a + b, 0) / sorted.length
      this.taskMetrics.medianDurationMs = sorted[Math.floor(sorted.length / 2)]
      this.taskMetrics.p95DurationMs = sorted[Math.floor(sorted.length * 0.95)]
    }

    // Calculate tokens per minute
    const elapsedMinutes = (Date.now() - this.startTime.getTime()) / 60000
    this.tokenUsage.tokensPerMinute = elapsedMinutes > 0
      ? this.tokenUsage.totalTokens / elapsedMinutes
      : 0

    return {
      timeRange: '1h',
      tokenUsage: { ...this.tokenUsage },
      tasks: { ...this.taskMetrics },
      agents: Array.from(this.agentMetrics.values()),
      tools: Array.from(this.toolMetrics.values()),
      timeSeries: [], // Time series would require more sophisticated tracking
      generatedAt: new Date(),
    }
  }
}

export default useRealtimeUpdates