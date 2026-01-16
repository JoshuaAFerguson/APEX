'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getApiUrl } from './config'
import {
  ExponentialBackoffReconnector,
  type ExponentialBackoffConfig
} from './exponential-backoff'
import {
  ConnectionHealthManager,
  type HealthCheckConfig,
  type HealthCheckResult
} from './connection-health'

// Types imported separately to avoid pulling in Node.js dependencies
// These are just type definitions, not runtime code
export interface ApexEvent {
  type: string;
  taskId?: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface Task {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  workflow?: string;
  createdAt: Date;
  updatedAt: Date;
  result?: unknown;
  error?: string;
}

type WebSocketEventHandler = (event: ApexEvent) => void
type StateEventHandler = (tasks: Task[]) => void

// Health check configuration interface
export interface WebSocketHealthConfig {
  /** Enable/disable health checks (default: true) */
  healthCheckEnabled: boolean;

  /** Interval between health checks in milliseconds (default: 30000) */
  healthCheckIntervalMs: number;

  /** Timeout for health check response in milliseconds (default: 5000) */
  healthCheckTimeoutMs: number;

  /** Number of consecutive failures before marking unhealthy (default: 3) */
  healthCheckFailureThreshold: number;

  /** Whether to use ping/pong frames or custom heartbeat messages (default: 'message') */
  healthCheckMethod: 'ping' | 'message';
}

// Health state interface
export interface WebSocketHealthState {
  /** Whether the connection is currently healthy */
  isHealthy: boolean;

  /** Last successful health check timestamp */
  lastHealthyAt?: Date;

  /** Last health check timestamp (regardless of result) */
  lastCheckAt?: Date;

  /** Number of consecutive health check failures */
  consecutiveFailures: number;

  /** Average round-trip time in milliseconds */
  averageLatencyMs: number;

  /** Last ping sent timestamp */
  lastPingAt?: Date;

  /** Last pong received timestamp */
  lastPongAt?: Date;
}

// Health event types
export type HealthEventType =
  | 'health:check'      // Health check performed
  | 'health:healthy'    // Connection became healthy
  | 'health:unhealthy'  // Connection became unhealthy
  | 'health:recovered'; // Connection recovered from unhealthy state

export interface HealthCheckEvent {
  type: HealthEventType;
  timestamp: Date;
  isHealthy: boolean;
  latencyMs?: number;
  consecutiveFailures: number;
  error?: string;
}

type HealthEventHandler = (event: HealthCheckEvent) => void

// Maximum number of events to keep in buffer to prevent memory leaks
const MAX_EVENT_BUFFER_SIZE = 1000

/**
 * Convert HTTP/HTTPS URL to WebSocket URL
 */
function toWebSocketUrl(baseUrl: string): string {
  try {
    const url = new URL(baseUrl)
    // Explicitly handle protocol conversion
    if (url.protocol === 'https:') {
      url.protocol = 'wss:'
    } else if (url.protocol === 'http:') {
      url.protocol = 'ws:'
    } else if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      // Default to ws for unknown protocols
      url.protocol = 'ws:'
    }
    // Add /ws path if not present
    if (!url.pathname.endsWith('/ws')) {
      url.pathname = url.pathname.replace(/\/?$/, '/ws')
    }
    return url.toString()
  } catch {
    // Fallback for invalid URLs
    return baseUrl.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:') + '/ws'
  }
}

export class ApexWebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private reconnector: ExponentialBackoffReconnector
  private eventHandlers: Map<string, Set<WebSocketEventHandler>> = new Map()
  private stateHandlers: Set<StateEventHandler> = new Set()
  private shouldReconnect = true

  // Health check properties
  private healthConfig: WebSocketHealthConfig
  private healthState: WebSocketHealthState
  private healthHandlers: Set<HealthEventHandler> = new Set()
  private healthCheckTimer: NodeJS.Timeout | null = null
  private pendingPingId: string | null = null
  private pingTimeoutTimer: NodeJS.Timeout | null = null
  private latencyHistory: number[] = []

  // Unified health manager
  private healthManager: ConnectionHealthManager
  private connectionId: string

  // Deprecated properties for backward compatibility
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000
  private reconnectTimer: NodeJS.Timeout | null = null

  constructor(
    url?: string,
    reconnectConfig?: Partial<ExponentialBackoffConfig>,
    healthConfig?: Partial<WebSocketHealthConfig>
  ) {
    const baseUrl = url || getApiUrl()
    this.url = toWebSocketUrl(baseUrl)

    // Initialize health check configuration
    this.healthConfig = {
      healthCheckEnabled: true,
      healthCheckIntervalMs: 30000, // 30 seconds
      healthCheckTimeoutMs: 5000,   // 5 seconds
      healthCheckFailureThreshold: 3,
      healthCheckMethod: 'message',
      ...healthConfig,
    }

    // Initialize health state
    this.healthState = {
      isHealthy: true,
      consecutiveFailures: 0,
      averageLatencyMs: 0,
    }

    // Initialize reconnector with optimized settings for WebSocket
    this.reconnector = new ExponentialBackoffReconnector({
      baseDelayMs: 1000,
      backoffFactor: 2,
      maxDelayMs: 30000,
      maxRetries: 10,
      jitterStrategy: 'equal', // Prevent thundering herd in browser environments
      ...reconnectConfig,
    })

    // Set up reconnector event handlers
    this.setupReconnectorHandlers()

    // Initialize unified health manager
    this.connectionId = `websocket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    this.healthManager = new ConnectionHealthManager({
      enabled: this.healthConfig.healthCheckEnabled,
      method: this.healthConfig.healthCheckMethod === 'ping' ? 'ping' : 'heartbeat',
      intervalMs: this.healthConfig.healthCheckIntervalMs,
      timeoutMs: this.healthConfig.healthCheckTimeoutMs,
      failureThreshold: this.healthConfig.healthCheckFailureThreshold,
      triggerReconnectOnFailure: true,
      customHealthCheck: async () => {
        // For WebSocket, we rely on ping/pong messages
        const now = Date.now()
        const threshold = this.healthConfig.healthCheckIntervalMs * 2

        if (this.healthState.lastPongAt) {
          const timeSinceLastPong = now - this.healthState.lastPongAt.getTime()
          return {
            success: timeSinceLastPong <= threshold,
            latencyMs: this.healthState.averageLatencyMs,
            error: timeSinceLastPong > threshold ? 'No recent pong received' : undefined,
            metadata: { timeSinceLastPong, threshold }
          }
        }

        return {
          success: false,
          error: 'No pong received yet',
          metadata: { threshold }
        }
      }
    })

    // Set up health manager event handlers
    this.setupHealthManagerHandlers()
  }

  /**
   * Set up unified health manager event handlers
   */
  private setupHealthManagerHandlers(): void {
    this.healthManager.on('health:check', (result: HealthCheckResult) => {
      const event: HealthCheckEvent = {
        type: 'health:check',
        timestamp: result.startedAt,
        isHealthy: result.isHealthy,
        latencyMs: result.latencyMs,
        consecutiveFailures: result.consecutiveFailures,
        error: result.error instanceof Error ? result.error.message : String(result.error || '')
      }
      this.emitHealthEvent(event)
    })

    this.healthManager.on('health:healthy', () => {
      const event: HealthCheckEvent = {
        type: 'health:healthy',
        timestamp: new Date(),
        isHealthy: true,
        consecutiveFailures: 0
      }
      this.emitHealthEvent(event)
    })

    this.healthManager.on('health:unhealthy', () => {
      const event: HealthCheckEvent = {
        type: 'health:unhealthy',
        timestamp: new Date(),
        isHealthy: false,
        consecutiveFailures: this.healthState.consecutiveFailures
      }
      this.emitHealthEvent(event)
    })

    this.healthManager.on('health:recovered', () => {
      const event: HealthCheckEvent = {
        type: 'health:recovered',
        timestamp: new Date(),
        isHealthy: true,
        consecutiveFailures: 0
      }
      this.emitHealthEvent(event)
    })

    this.healthManager.on('health:reconnect-required', () => {
      console.warn('[APEX WS] Health check failed repeatedly, triggering reconnection')
      if (this.shouldReconnect && this.ws) {
        this.ws.close(1006, 'Health check failed')
      }
    })
  }

  /**
   * Set up reconnector event handlers
   */
  private setupReconnectorHandlers(): void {
    this.reconnector.on('reconnect:attempt', (attempt: number, delayMs: number) => {
      console.log(`[APEX WS] Reconnection attempt ${attempt} in ${delayMs}ms...`)
      this.reconnectAttempts = attempt // Update for backward compatibility
    })

    this.reconnector.on('reconnect:success', (attempt: number, totalTime: number) => {
      console.log(`[APEX WS] Reconnected after ${attempt} attempts in ${totalTime}ms`)
      this.reconnectAttempts = 0 // Reset for backward compatibility
    })

    this.reconnector.on('reconnect:failure', (attempt: number, error: string) => {
      console.warn(`[APEX WS] Reconnection attempt ${attempt} failed:`, error)
    })

    this.reconnector.on('reconnect:exhausted', (totalAttempts: number, lastError: string) => {
      console.error(`[APEX WS] Max reconnection attempts (${totalAttempts}) reached:`, lastError)
    })
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('[APEX WS] Connected')
        this.reconnectAttempts = 0
        this.reconnectDelay = 1000
        this.reconnector.notifyConnected()

        // Reset health state on successful connection
        this.resetHealthState()

        // Register with health manager
        this.healthManager.register(this.connectionId, {
          enabled: this.healthConfig.healthCheckEnabled,
          method: this.healthConfig.healthCheckMethod === 'ping' ? 'ping' : 'heartbeat',
          intervalMs: this.healthConfig.healthCheckIntervalMs,
          timeoutMs: this.healthConfig.healthCheckTimeoutMs,
          failureThreshold: this.healthConfig.healthCheckFailureThreshold,
        })

        // Start health check timer if enabled (legacy support)
        if (this.healthConfig.healthCheckEnabled) {
          this.startHealthCheckTimer()
        }
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          // Handle ping/pong health check messages
          if (data.type === 'ping') {
            // Server sent a ping, respond with pong
            this.sendPongMessage(data.timestamp)
            return
          }

          if (data.type === 'pong') {
            // Server responded to our ping
            this.handlePongMessage(data)
            return
          }

          // Handle initial state event
          if (data.type === 'task:state') {
            this.stateHandlers.forEach((handler) => {
              handler(data.tasks || [])
            })
            return
          }

          // Handle regular events
          const apexEvent: ApexEvent = {
            ...data,
            timestamp: new Date(data.timestamp),
          }

          // Notify specific event handlers
          const handlers = this.eventHandlers.get(apexEvent.type)
          if (handlers) {
            handlers.forEach((handler) => handler(apexEvent))
          }

          // Notify wildcard handlers
          const wildcardHandlers = this.eventHandlers.get('*')
          if (wildcardHandlers) {
            wildcardHandlers.forEach((handler) => handler(apexEvent))
          }
        } catch (error) {
          console.error('[APEX WS] Error parsing message:', error)
        }
      }

      this.ws.onerror = () => {
        console.error('[APEX WS] Connection error - is the API server running? Start with: apex serve')
      }

      this.ws.onclose = (event) => {
        console.log('[APEX WS] Disconnected')
        this.ws = null

        // Stop health checks on disconnect
        this.stopHealthCheckTimer()
        this.clearPingTimeout()

        // Mark as unhealthy
        this.markUnhealthy('Connection closed')

        if (this.shouldReconnect && !this.reconnector.isExhausted()) {
          const reason = event.reason || `Connection closed with code ${event.code}`
          this.reconnector.notifyDisconnected(reason)
          this.scheduleReconnect()
        }
      }
    } catch (error) {
      console.error('[APEX WS] Connection error:', error)
      if (this.shouldReconnect && !this.reconnector.isExhausted()) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.reconnector.notifyConnectionFailed(errorMessage)
        this.scheduleReconnect()
      }
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false

    // Unregister from health manager
    this.healthManager.unregister(this.connectionId)

    // Stop health checks
    this.stopHealthCheckTimer()
    this.clearPingTimeout()

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    // Clean up health manager
    this.healthManager.destroy()
  }

  /**
   * Subscribe to a specific event type
   */
  on(eventType: string, handler: WebSocketEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set())
    }
    this.eventHandlers.get(eventType)!.add(handler)
  }

  /**
   * Unsubscribe from a specific event type
   */
  off(eventType: string, handler: WebSocketEventHandler): void {
    const handlers = this.eventHandlers.get(eventType)
    if (handlers) {
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType)
      }
    }
  }

  /**
   * Subscribe to initial state events
   */
  onState(handler: StateEventHandler): void {
    this.stateHandlers.add(handler)
  }

  /**
   * Unsubscribe from initial state events
   */
  offState(handler: StateEventHandler): void {
    this.stateHandlers.delete(handler)
  }

  /**
   * Schedule a reconnection attempt using exponential backoff
   */
  private scheduleReconnect(): void {
    this.reconnector.scheduleReconnect(async () => {
      try {
        this.connect()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.reconnector.notifyConnectionFailed(errorMessage)
        throw error // Re-throw to let reconnector handle retry logic
      }
    })
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * Check if connection is healthy
   */
  isHealthy(): boolean {
    return this.healthState.isHealthy && this.isConnected()
  }

  /**
   * Get current health state
   */
  getHealthState(): WebSocketHealthState {
    return { ...this.healthState }
  }

  /**
   * Subscribe to health events
   */
  onHealth(handler: HealthEventHandler): void {
    this.healthHandlers.add(handler)
  }

  /**
   * Unsubscribe from health events
   */
  offHealth(handler: HealthEventHandler): void {
    this.healthHandlers.delete(handler)
  }

  /**
   * Get unified health state from health manager
   */
  getUnifiedHealthState() {
    return this.healthManager.getHealthState(this.connectionId)
  }

  /**
   * Get health statistics from health manager
   */
  getHealthStatistics() {
    return this.healthManager.getHealthStats(this.connectionId)
  }

  /**
   * Manual health check trigger
   */
  async checkHealth(): Promise<HealthCheckEvent> {
    return new Promise((resolve) => {
      if (!this.isConnected()) {
        const event: HealthCheckEvent = {
          type: 'health:check',
          timestamp: new Date(),
          isHealthy: false,
          consecutiveFailures: this.healthState.consecutiveFailures,
          error: 'Not connected'
        }
        this.emitHealthEvent(event)
        resolve(event)
        return
      }

      // Send a ping and wait for response
      this.sendPingMessage()

      // Set up a one-time listener for the result
      const originalHandler = this.handlePongMessage.bind(this)
      this.handlePongMessage = (data) => {
        originalHandler(data)
        const event: HealthCheckEvent = {
          type: 'health:check',
          timestamp: new Date(),
          isHealthy: this.healthState.isHealthy,
          latencyMs: this.healthState.averageLatencyMs,
          consecutiveFailures: this.healthState.consecutiveFailures
        }
        resolve(event)
      }

      // Timeout the check
      setTimeout(() => {
        this.handlePongMessage = originalHandler
        const event: HealthCheckEvent = {
          type: 'health:check',
          timestamp: new Date(),
          isHealthy: false,
          consecutiveFailures: this.healthState.consecutiveFailures + 1,
          error: 'Health check timeout'
        }
        this.markUnhealthy('Health check timeout')
        resolve(event)
      }, this.healthConfig.healthCheckTimeoutMs)
    })
  }

  // Private health check methods

  /**
   * Reset health state on connection
   */
  private resetHealthState(): void {
    this.healthState = {
      isHealthy: true,
      consecutiveFailures: 0,
      averageLatencyMs: this.healthState.averageLatencyMs, // Preserve latency history
      lastHealthyAt: new Date(),
    }

    this.emitHealthEvent({
      type: this.healthState.consecutiveFailures > 0 ? 'health:recovered' : 'health:healthy',
      timestamp: new Date(),
      isHealthy: true,
      consecutiveFailures: 0
    })
  }

  /**
   * Mark connection as unhealthy
   */
  private markUnhealthy(error: string): void {
    const wasHealthy = this.healthState.isHealthy
    this.healthState.isHealthy = false
    this.healthState.consecutiveFailures++
    this.healthState.lastCheckAt = new Date()

    const event: HealthCheckEvent = {
      type: wasHealthy ? 'health:unhealthy' : 'health:check',
      timestamp: new Date(),
      isHealthy: false,
      consecutiveFailures: this.healthState.consecutiveFailures,
      error
    }

    this.emitHealthEvent(event)

    // Trigger reconnection if threshold exceeded
    if (this.healthState.consecutiveFailures >= this.healthConfig.healthCheckFailureThreshold) {
      console.warn(`[APEX WS] Health check failed ${this.healthState.consecutiveFailures} times, triggering reconnection`)
      if (this.shouldReconnect) {
        this.reconnector.notifyDisconnected('Health check failed')
        if (this.ws) {
          this.ws.close(1006, 'Health check failed')
        }
      }
    }
  }

  /**
   * Emit health event to subscribers
   */
  private emitHealthEvent(event: HealthCheckEvent): void {
    this.healthHandlers.forEach(handler => {
      try {
        handler(event)
      } catch (error) {
        console.error('[APEX WS] Error in health event handler:', error)
      }
    })
  }

  /**
   * Send ping message for health check
   */
  private sendPingMessage(): void {
    if (!this.isConnected()) return

    const pingId = crypto.randomUUID()
    const timestamp = Date.now()

    this.pendingPingId = pingId
    this.healthState.lastPingAt = new Date(timestamp)

    // Notify health manager about ping being sent
    this.healthManager.notifyPingSent(this.connectionId, pingId, timestamp)

    try {
      this.ws!.send(JSON.stringify({
        type: 'ping',
        id: pingId,
        timestamp
      }))

      // Set timeout for pong response
      this.clearPingTimeout()
      this.pingTimeoutTimer = setTimeout(() => {
        if (this.pendingPingId === pingId) {
          this.markUnhealthy('Ping timeout')
          this.healthManager.notifyPingTimeout(this.connectionId, pingId)
          this.pendingPingId = null
        }
      }, this.healthConfig.healthCheckTimeoutMs)

    } catch (error) {
      this.markUnhealthy(`Failed to send ping: ${error}`)
    }
  }

  /**
   * Send pong response message
   */
  private sendPongMessage(originalTimestamp: number): void {
    if (!this.isConnected()) return

    try {
      this.ws!.send(JSON.stringify({
        type: 'pong',
        timestamp: originalTimestamp,
        serverTimestamp: Date.now()
      }))
    } catch (error) {
      console.error('[APEX WS] Failed to send pong:', error)
    }
  }

  /**
   * Handle pong message response
   */
  private handlePongMessage(data: any): void {
    const now = Date.now()

    if (this.pendingPingId && data.id === this.pendingPingId) {
      // Calculate latency
      const latencyMs = now - data.timestamp
      this.updateLatencyMetrics(latencyMs)

      // Notify health manager about pong received
      this.healthManager.notifyPongReceived(this.connectionId, data.id, latencyMs)

      // Clear pending ping
      this.pendingPingId = null
      this.clearPingTimeout()

      // Update health state
      const wasUnhealthy = !this.healthState.isHealthy
      this.healthState.isHealthy = true
      this.healthState.consecutiveFailures = 0
      this.healthState.lastHealthyAt = new Date()
      this.healthState.lastPongAt = new Date()
      this.healthState.lastCheckAt = new Date()

      this.emitHealthEvent({
        type: wasUnhealthy ? 'health:recovered' : 'health:check',
        timestamp: new Date(),
        isHealthy: true,
        latencyMs,
        consecutiveFailures: 0
      })
    }
  }

  /**
   * Update latency metrics with new measurement
   */
  private updateLatencyMetrics(latencyMs: number): void {
    // Keep a rolling window of latency measurements
    this.latencyHistory.push(latencyMs)
    if (this.latencyHistory.length > 10) {
      this.latencyHistory.shift() // Keep only last 10 measurements
    }

    // Calculate average latency
    this.healthState.averageLatencyMs = Math.round(
      this.latencyHistory.reduce((sum, lat) => sum + lat, 0) / this.latencyHistory.length
    )
  }

  /**
   * Start health check timer
   */
  private startHealthCheckTimer(): void {
    this.stopHealthCheckTimer()

    if (this.healthConfig.healthCheckEnabled && this.healthConfig.healthCheckIntervalMs > 0) {
      this.healthCheckTimer = setInterval(() => {
        if (this.isConnected()) {
          this.sendPingMessage()
        }
      }, this.healthConfig.healthCheckIntervalMs)
    }
  }

  /**
   * Stop health check timer
   */
  private stopHealthCheckTimer(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }

  /**
   * Clear ping timeout
   */
  private clearPingTimeout(): void {
    if (this.pingTimeoutTimer) {
      clearTimeout(this.pingTimeoutTimer)
      this.pingTimeoutTimer = null
    }
  }
}

/**
 * React hook to stream task events
 */
export function useTaskStream(taskId?: string) {
  const [events, setEvents] = useState<ApexEvent[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const clientRef = useRef<ApexWebSocketClient | null>(null)

  useEffect(() => {
    // Create client if it doesn't exist
    if (!clientRef.current) {
      clientRef.current = new ApexWebSocketClient()
    }

    const client = clientRef.current

    // Event handler with bounded buffer
    const handleEvent = (event: ApexEvent) => {
      // Filter by taskId if provided
      if (taskId && event.taskId !== taskId) {
        return
      }

      setEvents((prev) => {
        const newEvents = [...prev, event]
        // Keep only the most recent events to prevent memory leaks
        if (newEvents.length > MAX_EVENT_BUFFER_SIZE) {
          return newEvents.slice(-MAX_EVENT_BUFFER_SIZE)
        }
        return newEvents
      })
    }

    // State handler
    const handleState = (newTasks: Task[]) => {
      setTasks(newTasks)
    }

    // Connection state tracking
    const checkConnection = setInterval(() => {
      setIsConnected(client.isConnected())
    }, 1000)

    // Subscribe to events
    client.onState(handleState)
    client.on('*', handleEvent)

    // Connect
    client.connect()

    // Cleanup
    return () => {
      clearInterval(checkConnection)
      client.offState(handleState)
      client.off('*', handleEvent)
    }
  }, [taskId])

  const clearEvents = useCallback(() => {
    setEvents([])
  }, [])

  return {
    events,
    tasks,
    isConnected,
    clearEvents,
  }
}

/**
 * React hook to connect to WebSocket and get all tasks
 */
export function useTaskList() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const clientRef = useRef<ApexWebSocketClient | null>(null)

  useEffect(() => {
    // Create client if it doesn't exist
    if (!clientRef.current) {
      clientRef.current = new ApexWebSocketClient()
    }

    const client = clientRef.current

    // State handler
    const handleState = (newTasks: Task[]) => {
      setTasks(newTasks)
    }

    // Event handler to update tasks
    const handleEvent = (event: ApexEvent) => {
      // Update task in list based on event
      if (event.type.startsWith('task:')) {
        setTasks((prev) => {
          const index = prev.findIndex((t) => t.id === event.taskId)
          if (index === -1) return prev

          const updated = [...prev]
          // Update task based on event data
          if (event.data.task) {
            updated[index] = event.data.task as Task
          }
          return updated
        })
      }
    }

    // Connection state tracking
    const checkConnection = setInterval(() => {
      setIsConnected(client.isConnected())
    }, 1000)

    // Subscribe
    client.onState(handleState)
    client.on('*', handleEvent)

    // Connect
    client.connect()

    // Cleanup
    return () => {
      clearInterval(checkConnection)
      client.offState(handleState)
      client.off('*', handleEvent)
    }
  }, [])

  return {
    tasks,
    isConnected,
  }
}

/**
 * Default WebSocket client instance
 */
export const wsClient = new ApexWebSocketClient()
