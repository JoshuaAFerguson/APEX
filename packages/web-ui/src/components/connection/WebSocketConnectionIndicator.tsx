'use client'

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type {
  WebSocketConnectionIndicatorProps,
  WebSocketConnectionStatus,
  WebSocketConnectionHealth
} from '@/types/websocket-connection'
import {
  CONNECTION_STATUS_STYLES,
  CONNECTION_STATUS_LABELS,
  formatLatency
} from '@/types/websocket-connection'
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection'
import { WebSocketConnectionTooltip } from './WebSocketConnectionTooltip'

/**
 * Status icon components
 */
const CheckCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const XCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="m15 9-6 6m0-6 6 6" />
  </svg>
)

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0V9a8.002 8.002 0 0115.356 2M4.582 9H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

const AlertCircleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
)

const SpinnerIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
)

/**
 * Get the icon component for a connection status
 */
function getStatusIcon(status: WebSocketConnectionStatus) {
  switch (status) {
    case 'connected':
      return CheckCircleIcon
    case 'disconnected':
      return XCircleIcon
    case 'connecting':
      return SpinnerIcon
    case 'reconnecting':
      return RefreshIcon
    case 'error':
    default:
      return AlertCircleIcon
  }
}

/**
 * Size configurations
 */
const SIZE_CONFIG = {
  sm: {
    container: 'px-2 py-1 text-xs gap-1',
    icon: 'w-3 h-3',
    dot: 'w-2 h-2',
  },
  md: {
    container: 'px-3 py-1.5 text-sm gap-1.5',
    icon: 'w-4 h-4',
    dot: 'w-2.5 h-2.5',
  },
  lg: {
    container: 'px-4 py-2 text-base gap-2',
    icon: 'w-5 h-5',
    dot: 'w-3 h-3',
  },
} as const

/**
 * WebSocketConnectionIndicator - Visual indicator for WebSocket connection status
 *
 * Displays a badge with icon and status text indicating the current connection state.
 * Shows latency when connected, reconnection attempts when reconnecting, and provides
 * detailed health information via tooltip.
 *
 * @example
 * ```tsx
 * <WebSocketConnectionIndicator />
 * <WebSocketConnectionIndicator size="lg" showLatency />
 * <WebSocketConnectionIndicator showTooltip animated />
 * ```
 */
export const WebSocketConnectionIndicator: React.FC<WebSocketConnectionIndicatorProps> = ({
  size = 'md',
  showLatency = false,
  showReconnectAttempts = true,
  showTooltip = true,
  animated = true,
  className,
  healthOverride,
  ...props
}) => {
  const hookHealth = useWebSocketConnection()

  // Use override if provided, otherwise use hook data
  const health: WebSocketConnectionHealth = useMemo(() => ({
    ...hookHealth,
    ...healthOverride,
  }), [hookHealth, healthOverride])

  const { status } = health
  const styles = CONNECTION_STATUS_STYLES[status]
  const sizeConfig = SIZE_CONFIG[size]
  const Icon = getStatusIcon(status)

  // Determine display text based on status and props
  const displayText = useMemo(() => {
    switch (status) {
      case 'connected':
        if (showLatency && health.latencyMs !== null) {
          return formatLatency(health.latencyMs)
        }
        return CONNECTION_STATUS_LABELS[status]

      case 'reconnecting':
        if (showReconnectAttempts && health.reconnectAttempts > 0) {
          return `${CONNECTION_STATUS_LABELS[status]} (${health.reconnectAttempts}/${health.maxReconnectAttempts})`
        }
        return CONNECTION_STATUS_LABELS[status]

      default:
        return CONNECTION_STATUS_LABELS[status]
    }
  }, [status, showLatency, showReconnectAttempts, health])

  // Animation classes
  const animationClass = useMemo(() => {
    if (!animated) return ''

    switch (status) {
      case 'connecting':
      case 'reconnecting':
        return 'animate-pulse'
      case 'disconnected':
      case 'error':
        return 'animate-pulse'
      default:
        return ''
    }
  }, [animated, status])

  // Spinning animation for icons
  const iconAnimationClass = useMemo(() => {
    if (!animated) return ''

    switch (status) {
      case 'connecting':
      case 'reconnecting':
        return 'animate-spin'
      default:
        return ''
    }
  }, [animated, status])

  const indicator = (
    <div
      role="status"
      aria-label={`Connection status: ${displayText}`}
      className={cn(
        'inline-flex items-center rounded-full border font-medium transition-all duration-300',
        sizeConfig.container,
        styles.bg,
        styles.text,
        styles.border,
        animationClass,
        className
      )}
      {...props}
    >
      {/* Status dot (always visible for quick recognition) */}
      <span
        className={cn(
          'rounded-full transition-all duration-300',
          sizeConfig.dot,
          styles.dot,
          animated && (status === 'disconnected' || status === 'error') && 'animate-ping'
        )}
        aria-hidden="true"
      />

      {/* Icon */}
      <Icon
        className={cn(
          sizeConfig.icon,
          styles.icon,
          iconAnimationClass
        )}
        aria-hidden="true"
      />

      {/* Status text */}
      <span className="font-semibold whitespace-nowrap">
        {displayText}
      </span>
    </div>
  )

  // Wrap with tooltip if enabled
  if (showTooltip) {
    return (
      <WebSocketConnectionTooltip health={health}>
        {indicator}
      </WebSocketConnectionTooltip>
    )
  }

  return indicator
}

WebSocketConnectionIndicator.displayName = 'WebSocketConnectionIndicator'

export default WebSocketConnectionIndicator