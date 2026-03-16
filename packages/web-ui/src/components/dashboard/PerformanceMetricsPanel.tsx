'use client'

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card'
import { Select } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { TokenUsageOverTimeChart } from '@/components/charts/TokenUsageOverTimeChart'
import { TaskCompletionRateChart } from '@/components/charts/TaskCompletionRateChart'
import { CostTrendChart } from '@/components/charts/CostTrendChart'
import type {
  PerformanceMetricsPanelProps,
  PerformanceMetricsTimeRange,
  AggregatedPerformanceMetrics,
} from '@/types/performance-metrics'
import {
  DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS,
  DEFAULT_PERFORMANCE_TIME_RANGE,
  TIME_RANGE_CONFIGS,
  getTimeRangeOptions,
  EMPTY_AGGREGATED_METRICS,
} from '@/types/performance-metrics'
import { getRelativeTime } from '@/lib/utils'

/**
 * Icons for the panel
 */
const ChartBarIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
  </svg>
)

const RefreshIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
)

interface EmptyIconProps {
  className?: string
}

const EmptyIcon: React.FC<EmptyIconProps> = ({ className }) => (
  <svg className={cn('w-12 h-12', className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
  </svg>
)

/**
 * PerformanceMetricsPanel - Comprehensive dashboard panel for performance metrics
 *
 * Combines token usage, task completion, and cost trend charts with unified time range control.
 * Features responsive grid layout, loading/empty states, and follows ProjectHealthPanel patterns.
 *
 * @example
 * ```tsx
 * // With real-time data
 * const { metrics } = usePerformanceMetrics();
 * <PerformanceMetricsPanel
 *   data={metrics}
 *   timeRange="24h"
 *   onTimeRangeChange={setTimeRange}
 * />
 *
 * // Loading state
 * <PerformanceMetricsPanel loading={true} />
 * ```
 */
export const PerformanceMetricsPanel: React.FC<PerformanceMetricsPanelProps> = ({
  data,
  timeRange: externalTimeRange,
  onTimeRangeChange,
  showTimeRangeSelector = DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.showTimeRangeSelector,
  showTokenUsage = DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.showTokenUsage,
  showTaskCompletion = DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.showTaskCompletion,
  showCostTrend = DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.showCostTrend,
  chartVariant = DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.chartVariant,
  chartSize = DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.chartSize,
  colors,
  animated = DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.animated,
  loading = DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.loading,
  error = null,
  onRefresh,
  autoRefresh = DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.autoRefresh,
  autoRefreshInterval = DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.autoRefreshInterval,
  className,
  emptyMessage = DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS.emptyMessage,
}) => {
  // Internal time range state for uncontrolled usage
  const [internalTimeRange, setInternalTimeRange] = useState<PerformanceMetricsTimeRange>(
    externalTimeRange ?? DEFAULT_PERFORMANCE_TIME_RANGE
  )

  // Effective time range (external takes precedence)
  const effectiveTimeRange = externalTimeRange ?? internalTimeRange

  // Update internal state when external time range changes
  useEffect(() => {
    if (externalTimeRange) {
      setInternalTimeRange(externalTimeRange)
    }
  }, [externalTimeRange])

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && onRefresh && autoRefreshInterval > 0) {
      const interval = setInterval(onRefresh, autoRefreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, onRefresh, autoRefreshInterval])

  // Time range change handler
  const handleTimeRangeChange = useCallback((newRange: PerformanceMetricsTimeRange) => {
    setInternalTimeRange(newRange)
    try {
      onTimeRangeChange?.(newRange)
    } catch (error) {
      console.warn('Error in onTimeRangeChange handler:', error)
    }
  }, [onTimeRangeChange])

  // Handler for Select component (receives string, needs to convert to PerformanceMetricsTimeRange)
  const handleSelectChange = useCallback((value: string) => {
    const range = value as PerformanceMetricsTimeRange
    handleTimeRangeChange(range)
  }, [handleTimeRangeChange])

  // Memoized time range options for Select component
  const timeRangeOptions = useMemo(() => {
    return getTimeRangeOptions().map(({ value, label }) => ({
      value,
      label,
    }))
  }, [])

  // Check if we have any data to display
  const hasData = useMemo(() => {
    if (!data) return false

    const hasTokenData = showTokenUsage && data.tokenUsage?.data?.length > 0
    const hasTaskData = showTaskCompletion && data.taskCompletion?.data?.length > 0
    const hasCostData = showCostTrend && data.costTrend?.data?.length > 0

    return hasTokenData || hasTaskData || hasCostData
  }, [data, showTokenUsage, showTaskCompletion, showCostTrend])

  // Determine if we should show empty state
  const showEmpty = !loading && !error && !hasData

  // Count of visible charts
  const visibleChartCount = useMemo(() => {
    let count = 0
    if (showTokenUsage) count++
    if (showTaskCompletion) count++
    if (showCostTrend) count++
    return count
  }, [showTokenUsage, showTaskCompletion, showCostTrend])

  // Chart height based on size
  const chartHeight = useMemo(() => {
    const heights = { sm: 160, md: 240, lg: 320 }
    return heights[chartSize]
  }, [chartSize])

  // Error state
  if (error) {
    return (
      <Card className={cn('border-red-900', className)}>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 text-red-400">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-semibold">Error Loading Performance Metrics</h3>
              <p className="text-sm text-red-300">
                {typeof error === 'string' ? error : 'An error occurred while loading metrics'}
              </p>
            </div>
          </div>
          {onRefresh && (
            <button
              onClick={() => {
                try {
                  onRefresh()
                } catch (error) {
                  console.warn('Error in onRefresh handler:', error)
                }
              }}
              className="mt-4 px-3 py-1.5 text-sm rounded-md bg-red-950 text-red-400 hover:bg-red-900 transition-colors"
            >
              Try Again
            </button>
          )}
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (loading && !data) {
    return (
      <Card className={cn('animate-pulse', className)}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <Spinner size="lg" />
            <span className="ml-3 text-foreground-secondary">Loading performance metrics...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn('transition-all duration-300', className)}
      role="region"
      aria-label="Performance Metrics Panel"
    >
      {/* Header */}
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <ChartBarIcon />
          <h2 className="text-lg font-semibold text-foreground">Performance Metrics</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Time range selector */}
          {showTimeRangeSelector && (
            <Select
              options={timeRangeOptions}
              value={effectiveTimeRange}
              onChange={handleSelectChange}
              disabled={loading}
              className="w-[140px]"
              data-testid="time-range-selector"
            />
          )}

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={() => {
                try {
                  onRefresh()
                } catch (error) {
                  console.warn('Error in onRefresh handler:', error)
                }
              }}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                'hover:bg-background-tertiary text-foreground-secondary',
                loading && 'animate-spin'
              )}
              aria-label="Refresh performance metrics"
              disabled={loading}
            >
              <RefreshIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="pt-2 relative">
        {showEmpty ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <EmptyIcon className="w-12 h-12 text-foreground-secondary mb-4" />
            <p className="text-foreground-secondary text-base">{emptyMessage}</p>
            {onRefresh && (
              <button
                onClick={() => {
                  try {
                    onRefresh()
                  } catch (error) {
                    console.warn('Error in onRefresh handler:', error)
                  }
                }}
                className="mt-4 px-4 py-2 text-sm rounded-md bg-background-tertiary text-foreground hover:bg-background-secondary transition-colors"
              >
                Refresh Data
              </button>
            )}
          </div>
        ) : (
          /* Charts grid */
          <div
            className={cn(
              'grid gap-6',
              // Responsive grid based on number of visible charts
              visibleChartCount === 1 && 'grid-cols-1',
              visibleChartCount === 2 && 'grid-cols-1 md:grid-cols-2',
              visibleChartCount >= 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
            )}
          >
            {/* Token Usage Chart */}
            {showTokenUsage && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground-secondary">Token Usage Over Time</h3>
                <div className="border border-border rounded-lg p-4 bg-background-secondary">
                  <TokenUsageOverTimeChart
                    data={data?.tokenUsage ?? EMPTY_AGGREGATED_METRICS.tokenUsage}
                    variant={chartVariant}
                    height={chartHeight}
                    animated={animated}
                    colors={colors}
                    showLegend={true}
                    showBreakdown={true}
                  />
                </div>
              </div>
            )}

            {/* Task Completion Chart */}
            {showTaskCompletion && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground-secondary">Task Completion Rate</h3>
                <div className="border border-border rounded-lg p-4 bg-background-secondary">
                  <TaskCompletionRateChart
                    data={data?.taskCompletion ?? EMPTY_AGGREGATED_METRICS.taskCompletion}
                    variant={chartVariant}
                    height={chartHeight}
                    animated={animated}
                    colors={colors}
                    showLegend={true}
                    showSuccessRate={true}
                  />
                </div>
              </div>
            )}

            {/* Cost Trend Chart */}
            {showCostTrend && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-foreground-secondary">Cost Trend</h3>
                <div className="border border-border rounded-lg p-4 bg-background-secondary">
                  <CostTrendChart
                    data={data?.costTrend ?? EMPTY_AGGREGATED_METRICS.costTrend}
                    variant={chartVariant}
                    height={chartHeight}
                    animated={animated}
                    colors={colors}
                    showLegend={true}
                    showBudgetLimit={true}
                    showProjection={true}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading overlay */}
        {loading && data && (
          <div className="absolute inset-0 bg-background-primary bg-opacity-50 flex items-center justify-center rounded-lg">
            <div className="flex items-center gap-2 bg-background-secondary px-4 py-2 rounded-md border border-border">
              <Spinner size="sm" />
              <span className="text-sm text-foreground-secondary">Updating...</span>
            </div>
          </div>
        )}
      </CardContent>

      {/* Footer */}
      <CardFooter className="flex items-center justify-between pt-0 text-xs text-foreground-secondary">
        {/* Auto-refresh indicator */}
        {autoRefresh && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Auto-refresh enabled ({Math.floor(autoRefreshInterval / 1000)}s)</span>
          </div>
        )}

        {/* Last updated */}
        {data?.generatedAt && (
          <span>
            Updated {getRelativeTime(data.generatedAt)}
          </span>
        )}
      </CardFooter>
    </Card>
  )
}

PerformanceMetricsPanel.displayName = 'PerformanceMetricsPanel'

export default PerformanceMetricsPanel