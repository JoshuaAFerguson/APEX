'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/Card'
import type { MetricCardProps } from '@/types/project-health'
import { STATUS_STYLES } from '@/types/project-health'

/**
 * Trend indicator icons
 */
const TrendUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
  </svg>
)

const TrendDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
  </svg>
)

const TrendNeutralIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
  </svg>
)

/**
 * Get trend icon component and color
 */
function getTrendIndicator(trend?: -1 | 0 | 1) {
  if (trend === undefined) return null

  const config = {
    '-1': { Icon: TrendDownIcon, color: 'text-red-500' },
    '0': { Icon: TrendNeutralIcon, color: 'text-foreground-secondary' },
    '1': { Icon: TrendUpIcon, color: 'text-green-500' },
  }

  return config[String(trend) as keyof typeof config]
}

/**
 * MetricCard - Card component for displaying a single metric
 *
 * Displays a metric with title, value, optional unit, status indicator,
 * description, and trend arrow.
 *
 * @example
 * ```tsx
 * <MetricCard
 *   title="Success Rate"
 *   value={95.5}
 *   unit="%"
 *   status="healthy"
 *   trend={1}
 * />
 * ```
 */
export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  status,
  description,
  icon,
  trend,
  className,
}) => {
  const statusStyles = status ? STATUS_STYLES[status] : null
  const trendIndicator = getTrendIndicator(trend)

  return (
    <Card
      className={cn(
        'transition-all duration-200 hover:shadow-md',
        statusStyles && `border-l-4 ${statusStyles.border}`,
        className
      )}
    >
      <CardContent className="p-4">
        {/* Header row: icon, title, trend */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {icon && (
              <span className={cn('text-foreground-secondary', statusStyles?.icon)}>
                {icon}
              </span>
            )}
            <h4 className="text-sm font-medium text-foreground-secondary">
              {title}
            </h4>
          </div>

          {trendIndicator && (
            <span className={cn('flex items-center', trendIndicator.color)}>
              <trendIndicator.Icon className="w-4 h-4" aria-hidden="true" />
            </span>
          )}
        </div>

        {/* Value display */}
        <div className="flex items-baseline gap-1">
          <span
            className={cn(
              'text-2xl font-bold tabular-nums',
              statusStyles?.text ?? 'text-foreground'
            )}
            aria-live="polite"
          >
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          {unit && (
            <span className="text-sm text-foreground-secondary">{unit}</span>
          )}
        </div>

        {/* Description */}
        {description && (
          <p className="mt-1 text-xs text-foreground-secondary">
            {description}
          </p>
        )}

        {/* Status indicator bar at bottom */}
        {status && (
          <div
            className={cn(
              'mt-3 h-1 rounded-full w-full',
              status === 'healthy' && 'bg-green-500',
              status === 'warning' && 'bg-yellow-500',
              status === 'critical' && 'bg-red-500',
              status === 'unknown' && 'bg-gray-500'
            )}
            role="presentation"
            aria-hidden="true"
          />
        )}
      </CardContent>
    </Card>
  )
}

MetricCard.displayName = 'MetricCard'

export default MetricCard
