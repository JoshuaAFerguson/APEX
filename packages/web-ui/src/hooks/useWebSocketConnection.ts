'use client'

import { useState, useEffect, useRef } from 'react'
import { wsClient } from '@/lib/websocket-client'
import type {
  WebSocketConnectionHealth,
  WebSocketConnectionStatus
} from '@/types/websocket-connection'
import { getConnectionStatus } from '@/types/websocket-connection'
import type { HealthCheckEvent } from '@/lib/websocket-client'

/**
 * Hook to manage WebSocket connection health state
 *
 * Wraps the existing WebSocket infrastructure to provide a React-friendly
 * interface for monitoring connection status, health, and reconnection attempts.
 */
export function useWebSocketConnection(): WebSocketConnectionHealth {
  // Initial state matching the architecture design
  const [health, setHealth] = useState<WebSocketConnectionHealth>(() => {
    const isConnected = wsClient.isConnected()
    const healthState = wsClient.getHealthState()
    const reconnectorStats = wsClient instanceof Object && 'reconnector' in wsClient
      ? (wsClient as any).reconnector?.getStats()
      : { currentAttempt: 0, state: 'idle' }

    return {
      status: getConnectionStatus(isConnected, false, healthState.isHealthy, healthState.consecutiveFailures),
      isHealthy: healthState.isHealthy && isConnected,
      latencyMs: null,
      averageLatencyMs: healthState.averageLatencyMs || null,
      reconnectAttempts: reconnectorStats?.currentAttempt || 0,
      maxReconnectAttempts: 10, // Default from architecture
      consecutiveFailures: healthState.consecutiveFailures,
      lastHealthyAt: healthState.lastHealthyAt || null,
      lastCheckAt: healthState.lastCheckAt || null,
      connectionUptime: null,
    }
  })

  // Track connection start time for uptime calculation
  const connectionStartRef = useRef<Date | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Health event handler
    const handleHealthEvent = (event: HealthCheckEvent) => {
      setHealth(prevHealth => {
        const isConnected = wsClient.isConnected()
        const healthState = wsClient.getHealthState()

        // Get reconnector stats safely
        let reconnectorStats = { currentAttempt: 0, state: 'idle' as const }
        try {
          if (wsClient instanceof Object && 'reconnector' in wsClient) {
            reconnectorStats = (wsClient as any).reconnector?.getStats() || reconnectorStats
          }
        } catch (error) {
          console.warn('[WebSocket Hook] Could not get reconnector stats:', error)
        }

        const isReconnecting = reconnectorStats.state === 'reconnecting' || reconnectorStats.state === 'connecting'

        // Update connection start time
        if (isConnected && !connectionStartRef.current) {
          connectionStartRef.current = new Date()
        } else if (!isConnected) {
          connectionStartRef.current = null
        }

        // Calculate uptime
        let connectionUptime: number | null = null
        if (isConnected && connectionStartRef.current) {
          connectionUptime = Date.now() - connectionStartRef.current.getTime()
        }

        const newStatus = getConnectionStatus(
          isConnected,
          isReconnecting,
          healthState.isHealthy,
          healthState.consecutiveFailures
        )

        return {
          status: newStatus,
          isHealthy: healthState.isHealthy && isConnected,
          latencyMs: event.latencyMs || null,
          averageLatencyMs: healthState.averageLatencyMs || null,
          reconnectAttempts: reconnectorStats.currentAttempt,
          maxReconnectAttempts: 10,
          consecutiveFailures: healthState.consecutiveFailures,
          lastHealthyAt: healthState.lastHealthyAt || null,
          lastCheckAt: healthState.lastCheckAt || new Date(),
          connectionUptime,
        }
      })
    }

    // Poll for reconnector stats every second
    const pollStats = () => {
      const isConnected = wsClient.isConnected()
      const healthState = wsClient.getHealthState()

      // Get reconnector stats safely
      let reconnectorStats = { currentAttempt: 0, state: 'idle' as const }
      try {
        if (wsClient instanceof Object && 'reconnector' in wsClient) {
          reconnectorStats = (wsClient as any).reconnector?.getStats() || reconnectorStats
        }
      } catch (error) {
        // Silently handle reconnector access issues
      }

      const isReconnecting = reconnectorStats.state === 'reconnecting' || reconnectorStats.state === 'connecting'

      // Update connection start time
      if (isConnected && !connectionStartRef.current) {
        connectionStartRef.current = new Date()
      } else if (!isConnected) {
        connectionStartRef.current = null
      }

      // Calculate uptime
      let connectionUptime: number | null = null
      if (isConnected && connectionStartRef.current) {
        connectionUptime = Date.now() - connectionStartRef.current.getTime()
      }

      const newStatus = getConnectionStatus(
        isConnected,
        isReconnecting,
        healthState.isHealthy,
        healthState.consecutiveFailures
      )

      setHealth(prevHealth => {
        // Only update if something meaningful changed
        if (
          prevHealth.status !== newStatus ||
          prevHealth.isHealthy !== (healthState.isHealthy && isConnected) ||
          prevHealth.reconnectAttempts !== reconnectorStats.currentAttempt ||
          prevHealth.consecutiveFailures !== healthState.consecutiveFailures ||
          Math.abs((prevHealth.connectionUptime || 0) - (connectionUptime || 0)) > 1000 // Update uptime every second
        ) {
          return {
            ...prevHealth,
            status: newStatus,
            isHealthy: healthState.isHealthy && isConnected,
            averageLatencyMs: healthState.averageLatencyMs || prevHealth.averageLatencyMs,
            reconnectAttempts: reconnectorStats.currentAttempt,
            consecutiveFailures: healthState.consecutiveFailures,
            lastHealthyAt: healthState.lastHealthyAt || prevHealth.lastHealthyAt,
            lastCheckAt: healthState.lastCheckAt || prevHealth.lastCheckAt,
            connectionUptime,
          }
        }
        return prevHealth
      })
    }

    // Subscribe to health events
    wsClient.onHealth(handleHealthEvent)

    // Set up polling for stats
    pollingIntervalRef.current = setInterval(pollStats, 1000)

    // Initial poll
    pollStats()

    // Cleanup
    return () => {
      wsClient.offHealth(handleHealthEvent)
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [])

  return health
}