'use client'

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type {
  HealthStatusIndicatorProps,
  ProjectHealthStatus
} from '@/types/project-health'
import { STATUS_STYLES, STATUS_LABELS } from '@/types/project-health'

/**
 * Status icon components
 */
const CheckIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const WarningIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
)

const CriticalIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const UnknownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

/**
 * Get the icon component for a status
 */
function getStatusIcon(status: ProjectHealthStatus) {
  switch (status) {
    case 'healthy':
      return CheckIcon
    case 'warning':
      return WarningIcon
    case 'critical':
      return CriticalIcon
    case 'unknown':
    default:
      return UnknownIcon
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
 * HealthStatusIndicator - Visual indicator for health status
 *
 * Displays a badge with icon and optional label indicating the current health status.
 * Uses color coding (green/yellow/red/gray) with icons for accessibility.
 *
 * @example
 * ```tsx
 * <HealthStatusIndicator status="healthy" />
 * <HealthStatusIndicator status="warning" size="lg" showLabel />
 * <HealthStatusIndicator status="critical" animated />
 * ```
 */
export const HealthStatusIndicator: React.FC<HealthStatusIndicatorProps> = ({
  status,
  size = 'md',
  showLabel = true,
  animated = false,
  className,
  ...props
}) => {
  const styles = STATUS_STYLES[status]
  const sizeConfig = SIZE_CONFIG[size]
  const Icon = getStatusIcon(status)
  const label = STATUS_LABELS[status]

  // Animation class for critical status
  const animationClass = useMemo(() => {
    if (!animated) return ''
    if (status === 'critical') return 'animate-pulse'
    return ''
  }, [animated, status])

  return (
    <div
      role="status"
      aria-label={`Health status: ${label}`}
      className={cn(
        'inline-flex items-center rounded-full border font-medium transition-colors',
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
          'rounded-full',
          sizeConfig.dot,
          status === 'healthy' && 'bg-green-500',
          status === 'warning' && 'bg-yellow-500',
          status === 'critical' && 'bg-red-500',
          status === 'unknown' && 'bg-gray-500',
          animated && status === 'critical' && 'animate-ping'
        )}
        aria-hidden="true"
      />

      {/* Icon */}
      <Icon className={cn(sizeConfig.icon, styles.icon)} aria-hidden="true" />

      {/* Label */}
      {showLabel && (
        <span className="font-semibold">{label}</span>
      )}
    </div>
  )
}

HealthStatusIndicator.displayName = 'HealthStatusIndicator'

export default HealthStatusIndicator
