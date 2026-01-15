'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { ApexEvent, Task } from '@apexcli/core'
import { ExponentialBackoffReconnector, type ExponentialBackoffConfig } from '@apexcli/core'
import { getApiUrl } from './config'

type WebSocketEventHandler = (event: ApexEvent) => void
type StateEventHandler = (tasks: Task[]) => void

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

  // Deprecated properties for backward compatibility
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectDelay = 1000
  private maxReconnectDelay = 30000
  private reconnectTimer: NodeJS.Timeout | null = null

  constructor(url?: string, reconnectConfig?: Partial<ExponentialBackoffConfig>) {
    const baseUrl = url || getApiUrl()
    this.url = toWebSocketUrl(baseUrl)

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
  }

  /**
   * Set up reconnector event handlers
   */
  private setupReconnectorHandlers(): void {
    this.reconnector.on('reconnect:attempt', (attempt, delayMs) => {
      console.log(`[APEX WS] Reconnection attempt ${attempt} in ${delayMs}ms...`)
      this.reconnectAttempts = attempt // Update for backward compatibility
    })

    this.reconnector.on('reconnect:success', (attempt, totalTime) => {
      console.log(`[APEX WS] Reconnected after ${attempt} attempts in ${totalTime}ms`)
      this.reconnectAttempts = 0 // Reset for backward compatibility
    })

    this.reconnector.on('reconnect:failure', (attempt, error) => {
      console.warn(`[APEX WS] Reconnection attempt ${attempt} failed:`, error)
    })

    this.reconnector.on('reconnect:exhausted', (totalAttempts, lastError) => {
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
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

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

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
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
