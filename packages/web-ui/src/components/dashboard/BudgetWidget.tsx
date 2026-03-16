'use client'

import React, { useMemo, useState, useCallback } from 'react'
import { Card, CardHeader, CardContent } from '@/components/ui'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { BudgetGauge, type BudgetGaugeProps } from '@/components/ui/BudgetGauge'
import { useRealtimeUpdates } from '@/lib/useRealtimeUpdates'
import { cn } from '@/lib/utils'
import { RefreshCw, AlertTriangle } from 'lucide-react'

/**
 * Props for the BudgetWidget dashboard component
 */
export interface BudgetWidgetProps {
  /** Budget limit in USD */
  budgetLimit: number
  /** Size variant for the gauge */
  size?: BudgetGaugeProps['size']
  /** Custom class name */
  className?: string
  /** Callback when refresh is requested */
  onRefresh?: () => void
  /** Custom thresholds for warning/danger states */
  thresholds?: BudgetGaugeProps['thresholds']
  /** Auto-refresh interval in seconds (0 to disable) */
  autoRefreshInterval?: number
}

/**
 * Default props for BudgetWidget
 */
const DEFAULT_PROPS: Required<Omit<BudgetWidgetProps, 'budgetLimit' | 'onRefresh'>> = {
  size: 'md',
  className: '',
  thresholds: {
    warning: 75,
    danger: 90,
  },
  autoRefreshInterval: 0,
}

/**
 * BudgetWidget - Dashboard component for real-time budget monitoring
 *
 * Wraps the BudgetGauge component in a Card with real-time data updates
 * from the useRealtimeUpdates hook. Shows current spend vs budget limit
 * with status indicators and refresh controls.
 *
 * Features:
 * - Real-time cost tracking via WebSocket
 * - Responsive design with customizable gauge sizes
 * - Error and loading states
 * - Manual refresh capability
 * - Connection status indicator
 * - Threshold-based warning states
 */
export function BudgetWidget({
  budgetLimit,
  size = DEFAULT_PROPS.size,
  className = DEFAULT_PROPS.className,
  onRefresh,
  thresholds = DEFAULT_PROPS.thresholds,
  autoRefreshInterval = DEFAULT_PROPS.autoRefreshInterval,
}: BudgetWidgetProps) {
  // State for manual refresh
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Real-time updates hook
  const {
    state,
    connect,
    disconnect,
    checkHealth,
  } = useRealtimeUpdates({
    autoConnect: true,
    subscription: {
      includeHealth: true,
      includePerformance: true,
    },
    healthCheckInterval: autoRefreshInterval > 0 ? autoRefreshInterval * 1000 : 30000,
  })

  // Extract current spend from performance data
  const currentSpend = useMemo(() => {
    if (!state.performance?.tokenUsage) {
      return 0
    }
    return state.performance.tokenUsage.estimatedCost || 0
  }, [state.performance])

  // Calculate spending percentage
  const spendingPercentage = useMemo(() => {
    if (budgetLimit <= 0) return 0
    return (currentSpend / budgetLimit) * 100
  }, [currentSpend, budgetLimit])

  // Determine status for display
  const budgetStatus = useMemo(() => {
    if (spendingPercentage >= (thresholds?.danger ?? 90)) {
      return { level: 'danger', message: 'Over budget', icon: AlertTriangle }
    }
    if (spendingPercentage >= (thresholds?.warning ?? 75)) {
      return { level: 'warning', message: 'Approaching limit', icon: AlertTriangle }
    }
    return { level: 'safe', message: 'Within budget', icon: null }
  }, [spendingPercentage, thresholds])

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      // Trigger health check to refresh data
      await checkHealth()
      // Call external refresh callback if provided
      onRefresh?.()
    } catch (error) {
      console.warn('Budget widget refresh failed:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [checkHealth, onRefresh])

  // Connection status indicator
  const connectionStatus = useMemo(() => {
    switch (state.connectionState) {
      case 'connected':
        return { color: 'text-green-500', label: 'Connected' }
      case 'connecting':
        return { color: 'text-yellow-500', label: 'Connecting...' }
      case 'reconnecting':
        return { color: 'text-yellow-500', label: 'Reconnecting...' }
      case 'error':
        return { color: 'text-red-500', label: 'Connection Error' }
      case 'disconnected':
      default:
        return { color: 'text-gray-500', label: 'Disconnected' }
    }
  }, [state.connectionState])

  // Loading state
  const isLoading = state.connectionState === 'connecting' && !state.performance

  // Error state
  const hasError = state.error || state.connectionState === 'error'

  return (
    <Card className={cn('relative', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold">Budget Monitor</h3>
          {budgetStatus.icon && (
            <budgetStatus.icon
              className={cn(
                'h-4 w-4',
                budgetStatus.level === 'danger' && 'text-red-500',
                budgetStatus.level === 'warning' && 'text-yellow-500'
              )}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Connection status */}
          <div className="flex items-center gap-1">
            <div
              className={cn('h-2 w-2 rounded-full', connectionStatus.color.replace('text-', 'bg-'))}
              title={connectionStatus.label}
            />
            <span className="sr-only">{connectionStatus.label}</span>
          </div>
          {/* Refresh button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            title="Refresh budget data"
          >
            <RefreshCw className={cn('h-4 w-4', (isRefreshing || isLoading) && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <Spinner size="md" />
              <p className="text-sm text-foreground-secondary">
                Loading budget data...
              </p>
            </div>
          </div>
        )}

        {/* Error state */}
        {hasError && !isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
              <p className="text-sm font-medium text-red-600">
                Unable to load budget data
              </p>
              <p className="text-xs text-foreground-secondary">
                {state.error?.message || 'Connection error'}
              </p>
              <Button variant="secondary" size="sm" onClick={handleRefresh}>
                Try Again
              </Button>
            </div>
          </div>
        )}

        {/* Budget gauge */}
        {!isLoading && !hasError && (
          <div className="space-y-4">
            <BudgetGauge
              currentSpend={currentSpend}
              budgetLimit={budgetLimit}
              size={size}
              thresholds={thresholds}
              showPercentage={true}
              showAmounts={true}
              className="mx-auto"
            />

            {/* Status message */}
            <div className="text-center">
              <p
                className={cn(
                  'text-sm font-medium',
                  budgetStatus.level === 'danger' && 'text-red-600',
                  budgetStatus.level === 'warning' && 'text-yellow-600',
                  budgetStatus.level === 'safe' && 'text-green-600'
                )}
              >
                {budgetStatus.message}
              </p>
            </div>

            {/* Last updated timestamp */}
            {state.lastUpdate && (
              <div className="text-center">
                <p className="text-xs text-foreground-secondary">
                  Last updated: {state.lastUpdate.toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Connection status badge for debugging */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2">
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
              connectionStatus.color,
              'bg-background-secondary border border-border'
            )}
            title={`WebSocket: ${connectionStatus.label}`}
          >
            {connectionStatus.label}
          </span>
        </div>
      )}
    </Card>
  )
}

BudgetWidget.displayName = 'BudgetWidget'

export default BudgetWidget