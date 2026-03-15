'use client'

import React, { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { WebSocketConnectionTooltipProps } from '@/types/websocket-connection'
import {
  CONNECTION_STATUS_LABELS,
  formatLatency,
  formatUptime
} from '@/types/websocket-connection'
import { getRelativeTime } from '@/lib/utils'

/**
 * WebSocketConnectionTooltip - Detailed health information tooltip
 *
 * Displays comprehensive connection health information when hovering over
 * the connection indicator. Shows status, latency, uptime, and health metrics.
 *
 * @example
 * ```tsx
 * <WebSocketConnectionTooltip health={health}>
 *   <WebSocketConnectionIndicator />
 * </WebSocketConnectionTooltip>
 * ```
 */
export const WebSocketConnectionTooltip: React.FC<WebSocketConnectionTooltipProps> = ({
  health,
  className,
  children,
}) => {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Calculate tooltip position
  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const viewport = { width: window.innerWidth, height: window.innerHeight }

    let top = triggerRect.bottom + 8
    let left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2)

    // Adjust if tooltip would overflow viewport
    if (left < 8) {
      left = 8
    } else if (left + tooltipRect.width > viewport.width - 8) {
      left = viewport.width - tooltipRect.width - 8
    }

    // Show above trigger if it would overflow bottom
    if (top + tooltipRect.height > viewport.height - 8) {
      top = triggerRect.top - tooltipRect.height - 8
    }

    setPosition({ top, left })
  }

  useEffect(() => {
    if (isVisible) {
      updatePosition()
      const handleResize = () => updatePosition()
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [isVisible])

  // Calculate success rate from health data
  const calculateSuccessRate = (): number => {
    // Simple heuristic based on consecutive failures
    if (health.consecutiveFailures === 0) return 100
    if (health.consecutiveFailures < 3) return 95
    if (health.consecutiveFailures < 5) return 85
    return Math.max(50, 100 - (health.consecutiveFailures * 10))
  }

  const handleMouseEnter = () => {
    setIsVisible(true)
  }

  const handleMouseLeave = () => {
    setIsVisible(false)
  }

  return (
    <div className="relative inline-block">
      {/* Trigger element */}
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        className="focus:outline-none"
        tabIndex={0}
        role="button"
        aria-describedby={isVisible ? 'websocket-tooltip' : undefined}
      >
        {children}
      </div>

      {/* Tooltip content */}
      {isVisible && (
        <div
          ref={tooltipRef}
          id="websocket-tooltip"
          role="tooltip"
          className="fixed z-50 pointer-events-none"
          style={{ top: position.top, left: position.left }}
        >
          <div
            className={cn(
              'bg-background-secondary border border-border-secondary rounded-lg shadow-lg shadow-black/10',
              'max-w-xs p-4 space-y-3',
              'text-sm text-foreground-primary',
              className
            )}
          >
            {/* Header */}
            <div className="border-b border-border-secondary pb-2">
              <h4 className="font-semibold text-foreground-primary">Connection Health</h4>
            </div>

            {/* Status section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-foreground-secondary">Status:</span>
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      health.status === 'connected' && 'bg-green-500',
                      health.status === 'disconnected' && 'bg-red-500',
                      health.status === 'connecting' && 'bg-apex-500',
                      health.status === 'reconnecting' && 'bg-yellow-500',
                      health.status === 'error' && 'bg-red-500'
                    )}
                  />
                  <span className="font-medium">
                    {CONNECTION_STATUS_LABELS[health.status]}
                  </span>
                </div>
              </div>

              {health.status === 'connected' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-foreground-secondary">Latency:</span>
                    <span className="font-medium">
                      {formatLatency(health.latencyMs)}
                      {health.averageLatencyMs && health.latencyMs !== health.averageLatencyMs && (
                        <span className="text-foreground-secondary ml-1">
                          (avg: {formatLatency(health.averageLatencyMs)})
                        </span>
                      )}
                    </span>
                  </div>

                  {health.connectionUptime !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-foreground-secondary">Uptime:</span>
                      <span className="font-medium">{formatUptime(health.connectionUptime)}</span>
                    </div>
                  )}
                </>
              )}

              {health.status === 'reconnecting' && health.reconnectAttempts > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Attempts:</span>
                  <span className="font-medium">
                    {health.reconnectAttempts}/{health.maxReconnectAttempts}
                  </span>
                </div>
              )}

              {health.lastCheckAt && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Last Check:</span>
                  <span className="font-medium">{getRelativeTime(health.lastCheckAt)}</span>
                </div>
              )}
            </div>

            {/* Health metrics section */}
            <div className="border-t border-border-secondary pt-2 space-y-2">
              <h5 className="font-medium text-foreground-primary">Health Checks</h5>

              <div className="flex items-center justify-between">
                <span className="text-foreground-secondary">Success Rate:</span>
                <span className="font-medium">
                  {formatPercentage(calculateSuccessRate(), 1)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-foreground-secondary">Consecutive Failures:</span>
                <span className={cn(
                  'font-medium',
                  health.consecutiveFailures > 0 ? 'text-red-400' : 'text-green-400'
                )}>
                  {health.consecutiveFailures}
                </span>
              </div>

              {health.lastHealthyAt && (
                <div className="flex items-center justify-between">
                  <span className="text-foreground-secondary">Last Healthy:</span>
                  <span className="font-medium">{getRelativeTime(health.lastHealthyAt)}</span>
                </div>
              )}
            </div>

            {/* Arrow pointer */}
            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2">
              <div className="w-2 h-2 bg-background-secondary border border-border-secondary transform rotate-45" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

WebSocketConnectionTooltip.displayName = 'WebSocketConnectionTooltip'

export default WebSocketConnectionTooltip