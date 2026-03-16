'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { wsClient } from '@/lib/websocket-client'
import { apiClient } from '@/lib/api-client'
import type {
  PendingApprovalGate,
  ResolvedApprovalGate,
  ApprovalGateWebSocketEvent,
  isGateRequiredEvent,
  isGateResolvedEvent,
  GateRequiredEvent,
  GateApprovedEvent,
  GateRejectedEvent,
  ApprovalResolvedEvent,
} from '@/types/approval-gate-panel'
import type { WebSocketConnectionStatus } from '@/types/websocket-connection'
import type { ApexEvent } from '@/lib/websocket-client'

/**
 * Options for the useApprovalGateWebSocket hook
 */
export interface UseApprovalGateWebSocketOptions {
  /** Filter by specific task ID */
  taskId?: string
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean
  /** Auto-reconnect on errors (default: true) */
  reconnectOnError?: boolean
  /** Initial pending gates */
  initialPendingGates?: PendingApprovalGate[]
  /** Initial resolved gates */
  initialResolvedGates?: ResolvedApprovalGate[]
}

/**
 * Return type for the useApprovalGateWebSocket hook
 */
export interface UseApprovalGateWebSocketReturn {
  // State
  pendingGates: PendingApprovalGate[]
  resolvedGates: ResolvedApprovalGate[]
  isConnected: boolean
  connectionStatus: WebSocketConnectionStatus
  isLoading: boolean
  error: Error | null

  // Actions
  approveGate: (gateId: string, comment?: string) => Promise<void>
  rejectGate: (gateId: string, comment: string) => Promise<void>
  refresh: () => Promise<void>
  connect: () => void
  disconnect: () => void

  // Event handlers
  onGateReceived: (handler: (gate: PendingApprovalGate) => void) => void
  onGateResolved: (handler: (gate: ResolvedApprovalGate) => void) => void
}

/**
 * Hook for managing approval gates with WebSocket real-time updates
 *
 * Provides comprehensive approval gate management with:
 * - Real-time WebSocket updates for new and resolved gates
 * - Local state management for pending and resolved gates
 * - API integration for approval/rejection actions
 * - Connection status monitoring
 * - Automatic reconnection handling
 */
export function useApprovalGateWebSocket(
  options: UseApprovalGateWebSocketOptions = {}
): UseApprovalGateWebSocketReturn {
  const {
    taskId,
    autoConnect = true,
    reconnectOnError = true,
    initialPendingGates = [],
    initialResolvedGates = [],
  } = options

  // State management
  const [pendingGates, setPendingGates] = useState<PendingApprovalGate[]>(initialPendingGates)
  const [resolvedGates, setResolvedGates] = useState<ResolvedApprovalGate[]>(initialResolvedGates)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<WebSocketConnectionStatus>('disconnected')

  // Event handlers refs for external callbacks
  const gateReceivedHandlers = useRef(new Set<(gate: PendingApprovalGate) => void>())
  const gateResolvedHandlers = useRef(new Set<(gate: ResolvedApprovalGate) => void>())

  // Connection state tracking
  const isConnected = connectionStatus === 'connected'

  /**
   * Handle incoming WebSocket events
   */
  const handleWebSocketEvent = useCallback((event: ApexEvent) => {
    try {
      // Filter by task ID if specified
      if (taskId && event.taskId !== taskId) {
        return
      }

      // Type the event as an approval gate event
      const gateEvent = event as unknown as ApprovalGateWebSocketEvent

      if (isGateRequiredEvent(gateEvent)) {
        // New gate required
        const newGate = gateEvent.data.gate
        setPendingGates(prev => {
          // Check if gate already exists to prevent duplicates
          const exists = prev.some(g => g.id === newGate.id)
          if (!exists) {
            // Add to beginning for priority ordering
            return [newGate, ...prev]
          }
          return prev
        })

        // Notify external handlers
        gateReceivedHandlers.current.forEach(handler => {
          try {
            handler(newGate)
          } catch (err) {
            console.warn('[ApprovalGateWebSocket] Error in gate received handler:', err)
          }
        })
      } else if (isGateResolvedEvent(gateEvent) || gateEvent.type === 'approval-resolved') {
        // Gate resolved - handle all resolution types
        let resolvedGate: ResolvedApprovalGate

        if (gateEvent.type === 'approval-resolved') {
          const resolvedEvent = gateEvent as ApprovalResolvedEvent
          resolvedGate = resolvedEvent.data.gate
        } else {
          resolvedGate = (gateEvent as GateApprovedEvent | GateRejectedEvent).data.gate
        }

        // Move from pending to resolved
        setPendingGates(prev => prev.filter(g => g.id !== resolvedGate.id))
        setResolvedGates(prev => {
          // Check if already exists to prevent duplicates
          const exists = prev.some(g => g.id === resolvedGate.id)
          if (!exists) {
            // Add to beginning for newest-first ordering
            return [resolvedGate, ...prev]
          }
          return prev
        })

        // Notify external handlers
        gateResolvedHandlers.current.forEach(handler => {
          try {
            handler(resolvedGate)
          } catch (err) {
            console.warn('[ApprovalGateWebSocket] Error in gate resolved handler:', err)
          }
        })
      }
    } catch (err) {
      console.warn('[ApprovalGateWebSocket] Error processing WebSocket event:', err)
      setError(err instanceof Error ? err : new Error('Error processing WebSocket event'))
    }
  }, [taskId])

  /**
   * Update connection status based on WebSocket state
   */
  const updateConnectionStatus = useCallback(() => {
    const connected = wsClient.isConnected()
    const healthState = wsClient.getHealthState()

    if (connected && healthState.isHealthy) {
      setConnectionStatus('connected')
    } else if (connected && !healthState.isHealthy) {
      setConnectionStatus('error')
    } else if (!connected) {
      // When disconnected, we assume reconnecting if health check was recent
      // The health state timing helps us infer reconnection attempts
      const timeSinceLastCheck = Date.now() - (healthState.lastCheckTime || 0)
      const isLikelyReconnecting = timeSinceLastCheck < 5000 // Within 5 seconds indicates active reconnection

      setConnectionStatus(isLikelyReconnecting ? 'reconnecting' : 'disconnected')
    }
  }, [])

  /**
   * Approve a gate
   */
  const approveGate = useCallback(async (gateId: string, comment?: string): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)

      // Find the gate to get task and gate name
      const gate = pendingGates.find(g => g.id === gateId)
      if (!gate) {
        throw new Error('Gate not found')
      }

      // Use the existing API client method
      await apiClient.approveGate(gate.taskId, gate.name, {
        approver: 'user', // In a real app, this would be the authenticated user
        comment,
      })

      // The WebSocket event will handle state updates
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to approve gate')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [pendingGates])

  /**
   * Reject a gate
   */
  const rejectGate = useCallback(async (gateId: string, comment: string): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)

      // Find the gate to get task and gate name
      const gate = pendingGates.find(g => g.id === gateId)
      if (!gate) {
        throw new Error('Gate not found')
      }

      // Use the existing API client method
      await apiClient.rejectGate(gate.taskId, gate.name, {
        approver: 'user',
        comment,
      })

      // The WebSocket event will handle state updates
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to reject gate')
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [pendingGates])

  /**
   * Refresh gates list from API
   */
  const refresh = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true)
      setError(null)

      // Fetch tasks with approval gates
      const tasks = await apiClient.listTasks({
        status: 'awaiting-approval',
        ...(taskId && { taskId }),
      })

      // Extract gates from tasks
      // Note: In a real implementation, there would be a dedicated API endpoint
      // for gates. For now, we rely on WebSocket updates for real-time changes
      // and this refresh provides a fallback re-sync with the backend.
      const newPendingGates: PendingApprovalGate[] = []
      const newResolvedGates: ResolvedApprovalGate[] = []

      tasks.forEach(task => {
        // Extract approval gates from task if available
        if ('gates' in task && Array.isArray(task.gates)) {
          task.gates.forEach((gate: PendingApprovalGate | ResolvedApprovalGate) => {
            if (gate.status === 'pending') {
              newPendingGates.push(gate as PendingApprovalGate)
            } else {
              newResolvedGates.push(gate as ResolvedApprovalGate)
            }
          })
        }
      })

      // Update state with refreshed data - this re-syncs with backend
      // without replacing WebSocket updates
      setPendingGates(prev => {
        // Merge: keep WebSocket updates, add any from API refresh
        const merged = [...prev]
        newPendingGates.forEach(newGate => {
          const exists = merged.some(g => g.id === newGate.id)
          if (!exists) {
            merged.push(newGate)
          }
        })
        return merged
      })

      setResolvedGates(prev => {
        // Merge: keep existing history, add any from API refresh
        const merged = [...prev]
        newResolvedGates.forEach(newGate => {
          const exists = merged.some(g => g.id === newGate.id)
          if (!exists) {
            merged.push(newGate)
          }
        })
        return merged
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      const error = new Error(`Failed to refresh gates${taskId ? ` for task ${taskId}` : ''}: ${errorMsg}`)
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [taskId])

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    wsClient.connect()
    updateConnectionStatus()
  }, [updateConnectionStatus])

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    wsClient.disconnect()
    setConnectionStatus('disconnected')
  }, [])

  /**
   * Register external gate received handler
   */
  const onGateReceived = useCallback((handler: (gate: PendingApprovalGate) => void) => {
    gateReceivedHandlers.current.add(handler)
    return () => {
      gateReceivedHandlers.current.delete(handler)
    }
  }, [])

  /**
   * Register external gate resolved handler
   */
  const onGateResolved = useCallback((handler: (gate: ResolvedApprovalGate) => void) => {
    gateResolvedHandlers.current.add(handler)
    return () => {
      gateResolvedHandlers.current.delete(handler)
    }
  }, [])

  /**
   * Set up WebSocket event listeners
   */
  useEffect(() => {
    // Listen for approval-related events
    const eventTypes = [
      'gate:required',
      'gate:approved',
      'gate:rejected',
      'gate:timeout',
      'gate:skipped',
      'approval-required',
      'approval-resolved',
    ]

    eventTypes.forEach(eventType => {
      wsClient.on(eventType, handleWebSocketEvent)
    })

    // Set up connection status monitoring
    const statusInterval = setInterval(updateConnectionStatus, 1000)

    // Auto-connect if enabled
    if (autoConnect && !isConnected) {
      connect()
    }

    // Initial connection status update
    updateConnectionStatus()

    // Cleanup
    return () => {
      eventTypes.forEach(eventType => {
        wsClient.off(eventType, handleWebSocketEvent)
      })
      clearInterval(statusInterval)
    }
  }, [handleWebSocketEvent, updateConnectionStatus, connect, autoConnect, isConnected])

  return {
    // State
    pendingGates,
    resolvedGates,
    isConnected,
    connectionStatus,
    isLoading,
    error,

    // Actions
    approveGate,
    rejectGate,
    refresh,
    connect,
    disconnect,

    // Event handlers
    onGateReceived,
    onGateResolved,
  }
}