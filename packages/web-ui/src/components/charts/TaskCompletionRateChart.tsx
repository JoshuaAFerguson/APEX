'use client'

import React, { useMemo } from 'react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import {
  useChartTheme,
  getTooltipStyle,
  getGridStyle,
  getAxisStyle,
  compactNumberFormatter,
} from '@/lib/chart-utils'
import {
  formatPercentage,
} from '@/types/performance-metrics'
import type {
  TaskCompletionRateChartProps,
  TaskCompletionRateData,
  TaskCompletionDataPoint,
  TaskStatusCounts,
} from '@/types/performance-metrics'

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Chart data point for pie chart segments
 */
interface PieChartDataPoint {
  /** Segment name */
  name: string
  /** Value count */
  value: number
  /** Color for the segment */
  color: string
  /** Percentage of total */
  percentage: number
}

/**
 * Status colors configuration
 */
interface StatusColors {
  completed: string
  failed: string
  cancelled: string
  inProgress: string
  pending: string
  paused: string
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default colors for task statuses - theme-aware
 */
const getStatusColors = (mode: 'light' | 'dark'): StatusColors => ({
  completed: mode === 'light' ? '#16a34a' : '#22c55e', // green
  failed: mode === 'light' ? '#dc2626' : '#ef4444', // red
  cancelled: mode === 'light' ? '#ca8a04' : '#eab308', // yellow/warning
  inProgress: mode === 'light' ? '#0284c7' : '#0ea5e9', // apex blue
  pending: mode === 'light' ? '#6b7280' : '#9ca3af', // gray
  paused: mode === 'light' ? '#7c3aed' : '#8b5cf6', // violet
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate task status breakdown for pie chart
 */
function calculateStatusBreakdown(
  statusCounts: TaskStatusCounts,
  colors: StatusColors
): PieChartDataPoint[] {
  const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0)

  if (total === 0) {
    return []
  }

  const breakdown: PieChartDataPoint[] = []

  // Add segments for non-zero counts only
  if (statusCounts.completed > 0) {
    breakdown.push({
      name: 'Completed',
      value: statusCounts.completed,
      color: colors.completed,
      percentage: (statusCounts.completed / total) * 100,
    })
  }

  if (statusCounts.failed > 0) {
    breakdown.push({
      name: 'Failed',
      value: statusCounts.failed,
      color: colors.failed,
      percentage: (statusCounts.failed / total) * 100,
    })
  }

  if (statusCounts.cancelled > 0) {
    breakdown.push({
      name: 'Cancelled',
      value: statusCounts.cancelled,
      color: colors.cancelled,
      percentage: (statusCounts.cancelled / total) * 100,
    })
  }

  if (statusCounts.inProgress > 0) {
    breakdown.push({
      name: 'In Progress',
      value: statusCounts.inProgress,
      color: colors.inProgress,
      percentage: (statusCounts.inProgress / total) * 100,
    })
  }

  if (statusCounts.pending > 0) {
    breakdown.push({
      name: 'Pending',
      value: statusCounts.pending,
      color: colors.pending,
      percentage: (statusCounts.pending / total) * 100,
    })
  }

  if (statusCounts.paused > 0) {
    breakdown.push({
      name: 'Paused',
      value: statusCounts.paused,
      color: colors.paused,
      percentage: (statusCounts.paused / total) * 100,
    })
  }

  return breakdown
}

/**
 * Custom tooltip component for task completion chart
 */
function TaskCompletionTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    color?: string
    payload?: PieChartDataPoint | { [key: string]: unknown }
  }>
}) {
  const { colors } = useChartTheme()
  const tooltipStyles = getTooltipStyle({ colors })

  if (!active || !payload || !payload.length) {
    return null
  }

  const entry = payload[0]
  const dataPoint = entry.payload as PieChartDataPoint

  return (
    <div style={tooltipStyles.contentStyle} className="p-3 space-y-2">
      <div style={tooltipStyles.labelStyle} className="text-sm font-medium flex items-center gap-2">
        <div
          className="w-3 h-3 rounded"
          style={{ backgroundColor: dataPoint.color || entry.color }}
        />
        <span>{dataPoint.name || entry.name}</span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between gap-4">
          <span className="text-foreground-secondary">Count</span>
          <span className="font-medium text-foreground">{entry.value.toLocaleString()}</span>
        </div>
        {dataPoint.percentage !== undefined && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-foreground-secondary">Percentage</span>
            <span className="font-medium text-foreground">
              {formatPercentage(dataPoint.percentage)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Loading skeleton for the chart
 */
function SkeletonChart({ height, variant }: { height: number; variant: 'pie' | 'bar' }) {
  if (variant === 'pie') {
    return (
      <div className="flex flex-col items-center justify-center" style={{ height }}>
        <div className="w-40 h-40 rounded-full bg-background-secondary animate-pulse" />
        <div className="flex gap-4 mt-4">
          <div className="w-16 h-4 bg-background-secondary animate-pulse rounded" />
          <div className="w-16 h-4 bg-background-secondary animate-pulse rounded" />
          <div className="w-16 h-4 bg-background-secondary animate-pulse rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4" style={{ height }}>
      <div className="flex-1 bg-background-secondary animate-pulse rounded-md" style={{ height: height - 40 }} />
      <div className="flex justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-background-secondary animate-pulse rounded" />
          <div className="w-16 h-4 bg-background-secondary animate-pulse rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-background-secondary animate-pulse rounded" />
          <div className="w-16 h-4 bg-background-secondary animate-pulse rounded" />
        </div>
      </div>
    </div>
  )
}

/**
 * Empty state component
 */
function EmptyState({ message, height }: { message: string; height: number }) {
  return (
    <div
      className="flex items-center justify-center text-foreground-secondary"
      style={{ height }}
    >
      <p className="text-sm">{message}</p>
    </div>
  )
}

/**
 * Success rate display component - large percentage in center
 */
function SuccessRateDisplay({
  rate,
  label,
  className,
}: {
  rate: number
  label: string
  className?: string
}) {
  // Color based on rate
  const rateColor = rate >= 80 ? 'text-success' : rate >= 60 ? 'text-warning' : 'text-error'

  return (
    <div className={cn('text-center', className)}>
      <p className={cn('text-4xl font-bold', rateColor)}>
        {formatPercentage(rate, 1)}
      </p>
      <p className="text-xs text-foreground-secondary mt-1">{label}</p>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * TaskCompletionRateChart Component
 *
 * Displays task completion statistics using either a PieChart or BarChart.
 * Shows completed/failed/cancelled breakdown with success rate percentage.
 * Responsive and theme-aware.
 */
export function TaskCompletionRateChart({
  data,
  variant = 'pie',
  height = 200,
  showLegend = true,
  showSuccessRate = true,
  showStatusDistribution = false,
  animated = true,
  colors,
  className,
  onDataPointClick,
}: TaskCompletionRateChartProps) {
  const theme = useChartTheme()
  const tooltipStyles = getTooltipStyle(theme)
  const gridProps = getGridStyle(theme)
  const axisProps = getAxisStyle(theme)

  // Get theme-aware status colors
  const statusColors = useMemo(() => {
    const baseColors = getStatusColors(theme.mode)
    // Allow custom color overrides
    if (colors?.success) baseColors.completed = colors.success
    if (colors?.danger) baseColors.failed = colors.danger
    if (colors?.warning) baseColors.cancelled = colors.warning
    if (colors?.primary) baseColors.inProgress = colors.primary
    return baseColors
  }, [theme.mode, colors])

  // Calculate pie chart data from status counts
  const pieData = useMemo(() => {
    if (!data?.statusCounts) return []
    return calculateStatusBreakdown(data.statusCounts, statusColors)
  }, [data?.statusCounts, statusColors])

  // Calculate bar chart data for time series (if available)
  const barData = useMemo(() => {
    if (!data?.data || data.data.length === 0) return []
    return data.data.map((point) => ({
      timestamp: point.timestamp.getTime(),
      timeLabel: point.timestamp.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      completed: point.completedCount,
      failed: point.failedCount,
      successRate: point.successRate,
      completionRate: point.completionRate,
    }))
  }, [data?.data])

  // Total tasks for display
  const totalTasks = useMemo(() => {
    if (!data?.statusCounts) return 0
    return Object.values(data.statusCounts).reduce((sum, count) => sum + count, 0)
  }, [data?.statusCounts])

  // Loading state
  if (!theme.mounted) {
    return <SkeletonChart height={height} variant={variant === 'bar' || variant === 'stacked-bar' ? 'bar' : 'pie'} />
  }

  // Empty state
  if (!data || totalTasks === 0) {
    return (
      <EmptyState
        message="No task completion data available"
        height={height}
      />
    )
  }

  // Render based on variant
  const renderChart = () => {
    // For pie/default variant
    if (variant === 'pie' || variant === 'area' || variant === 'line') {
      return (
        <div className="flex flex-col md:flex-row items-center justify-center gap-4">
          {/* Pie Chart */}
          <div style={{ width: Math.min(height, 200), height: Math.min(height, 200) }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={variant === 'pie' ? '60%' : 0}
                  outerRadius="80%"
                  paddingAngle={pieData.length > 1 ? 2 : 0}
                  dataKey="value"
                  animationDuration={animated ? 1000 : 0}
                  onClick={(entry) => {
                    if (onDataPointClick && entry) {
                      // Create a synthetic data point for the callback
                      const syntheticPoint: TaskCompletionDataPoint = {
                        timestamp: new Date(),
                        completionRate: data.overallCompletionRate,
                        successRate: data.overallSuccessRate,
                        completedCount: data.statusCounts.completed,
                        failedCount: data.statusCounts.failed,
                        totalProcessed: data.totalProcessed,
                      }
                      onDataPointClick(syntheticPoint)
                    }
                  }}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.color}
                      stroke={theme.colors.background}
                      strokeWidth={2}
                      style={{ cursor: onDataPointClick ? 'pointer' : 'default' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<TaskCompletionTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Success Rate & Stats */}
          {showSuccessRate && (
            <div className="flex flex-col items-center gap-4">
              <SuccessRateDisplay
                rate={data.overallSuccessRate}
                label="Success Rate"
              />
              <div className="flex gap-4 text-xs">
                <div className="text-center">
                  <p className="font-medium text-foreground">{data.totalCompleted.toLocaleString()}</p>
                  <p className="text-foreground-secondary">Completed</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">{data.totalFailed.toLocaleString()}</p>
                  <p className="text-foreground-secondary">Failed</p>
                </div>
                <div className="text-center">
                  <p className="font-medium text-foreground">{data.totalProcessed.toLocaleString()}</p>
                  <p className="text-foreground-secondary">Total</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )
    }

    // For bar/stacked-bar variant - show time series or status distribution
    if (showStatusDistribution && barData.length > 0) {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid {...gridProps} />
            <XAxis
              dataKey="timeLabel"
              {...axisProps}
              interval="preserveStartEnd"
              tickMargin={8}
            />
            <YAxis
              {...axisProps}
              tickFormatter={compactNumberFormatter}
              tickMargin={8}
              width={40}
            />
            <Tooltip
              contentStyle={tooltipStyles.contentStyle}
              labelStyle={tooltipStyles.labelStyle}
              formatter={(value: number, name: string) => [
                value.toLocaleString(),
                name === 'completed' ? 'Completed' : 'Failed',
              ]}
            />
            {showLegend && (
              <Legend
                verticalAlign="bottom"
                iconType="rect"
                wrapperStyle={{ paddingTop: 8 }}
                formatter={(value) => (
                  <span className="text-xs text-foreground-secondary">
                    {value === 'completed' ? 'Completed' : 'Failed'}
                  </span>
                )}
              />
            )}
            <Bar
              dataKey="completed"
              stackId={variant === 'stacked-bar' ? 'stack' : undefined}
              fill={statusColors.completed}
              animationDuration={animated ? 1000 : 0}
              radius={variant === 'stacked-bar' ? [0, 0, 0, 0] : [4, 4, 0, 0]}
            />
            <Bar
              dataKey="failed"
              stackId={variant === 'stacked-bar' ? 'stack' : undefined}
              fill={statusColors.failed}
              animationDuration={animated ? 1000 : 0}
              radius={variant === 'stacked-bar' ? [4, 4, 0, 0] : [4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )
    }

    // Bar variant but no time series data - show status breakdown as horizontal bars
    return (
      <div className="space-y-3">
        {pieData.map((entry, index) => {
          const barWidth = totalTasks > 0 ? (entry.value / totalTasks) * 100 : 0
          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-foreground">{entry.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground-secondary">{entry.value.toLocaleString()}</span>
                  <span className="text-foreground font-medium">
                    {formatPercentage(entry.percentage, 1)}
                  </span>
                </div>
              </div>
              <div className="h-2 bg-background-tertiary rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: entry.color,
                  }}
                />
              </div>
            </div>
          )
        })}
        {/* Show success rate below bars */}
        {showSuccessRate && (
          <div className="pt-4 border-t border-border">
            <SuccessRateDisplay
              rate={data.overallSuccessRate}
              label="Success Rate"
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn('space-y-4', className)}
      style={{ height }}
      role="img"
      aria-label={`Task completion chart showing ${formatPercentage(data.overallSuccessRate)} success rate with ${data.totalCompleted} completed and ${data.totalFailed} failed tasks`}
    >
      {/* Chart */}
      <div className="flex-1" style={{ height: showLegend && variant !== 'bar' && variant !== 'stacked-bar' ? height - 40 : height }}>
        {renderChart()}
      </div>

      {/* Legend - only for pie chart variant */}
      {showLegend && (variant === 'pie' || variant === 'area' || variant === 'line') && (
        <div className="flex items-center justify-center flex-wrap gap-4 pt-2 border-t border-border">
          {pieData.map((entry, index) => (
            <div key={index} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-foreground-secondary">{entry.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Hidden summary for screen readers */}
      <div className="sr-only">
        Task completion summary: {data.totalProcessed} tasks processed.
        {data.totalCompleted} completed ({formatPercentage(data.overallCompletionRate)} completion rate).
        {data.totalFailed} failed.
        Overall success rate: {formatPercentage(data.overallSuccessRate)}.
      </div>
    </div>
  )
}

// ============================================================================
// Mini Variant
// ============================================================================

/**
 * Mini version of TaskCompletionRateChart for dashboard cards and widgets
 */
export function TaskCompletionRateChartMini({
  data,
  height = 80,
  className,
}: {
  data: TaskCompletionRateData
  height?: number
  className?: string
}) {
  const theme = useChartTheme()
  const statusColors = getStatusColors(theme.mode)

  // Calculate pie data
  const pieData = useMemo(() => {
    if (!data?.statusCounts) return []
    return calculateStatusBreakdown(data.statusCounts, statusColors)
  }, [data?.statusCounts, statusColors])

  const totalTasks = useMemo(() => {
    if (!data?.statusCounts) return 0
    return Object.values(data.statusCounts).reduce((sum, count) => sum + count, 0)
  }, [data?.statusCounts])

  // Loading state
  if (!theme.mounted) {
    return (
      <div
        className={cn('bg-background-secondary animate-pulse rounded', className)}
        style={{ height }}
      />
    )
  }

  // Empty state
  if (!data || totalTasks === 0) {
    return (
      <div
        className={cn(
          'flex items-center justify-center text-foreground-secondary text-xs',
          className
        )}
        style={{ height }}
      >
        No data
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-4', className)} style={{ height }}>
      {/* Mini pie chart */}
      <div style={{ width: height, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="90%"
              paddingAngle={1}
              dataKey="value"
              animationDuration={500}
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="transparent"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Success rate and stats */}
      <div className="flex-1 min-w-0">
        <p className="text-lg font-bold text-foreground">
          {formatPercentage(data.overallSuccessRate, 0)}
        </p>
        <p className="text-xs text-foreground-secondary">
          {data.totalCompleted} / {data.totalProcessed} tasks
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// Exports
// ============================================================================

export default TaskCompletionRateChart
export type { TaskCompletionRateChartProps }
