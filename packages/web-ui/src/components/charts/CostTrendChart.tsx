'use client'

import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { cn } from '@/lib/utils'
import {
  useChartTheme,
  getTooltipStyle,
  getGridStyle,
  getAxisStyle,
  currencyFormatter,
  createAxisFormatter,
  createTooltipFormatter,
} from '@/lib/chart-utils'
import {
  formatCost,
  formatPercentage,
  TIME_RANGE_CONFIGS,
} from '@/types/performance-metrics'
import type {
  CostTrendChartProps,
  CostTrendData,
  CostTrendDataPoint,
  PerformanceMetricsTimeRange,
} from '@/types/performance-metrics'

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Chart data point optimized for Recharts rendering
 */
interface ChartDataPoint {
  /** Unix timestamp for X-axis */
  timestamp: number
  /** Formatted time string for display */
  timeLabel: string
  /** Cost for this time period (USD) */
  cost: number
  /** Cumulative cost up to this point */
  cumulativeCost: number
  /** Projected cost based on current rate */
  projectedCost?: number
  /** Cost breakdown by category */
  breakdown?: {
    inputTokenCost: number
    outputTokenCost: number
    cacheCreationCost: number
    cacheReadCost: number
    otherCost: number
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format timestamp for X-axis labels based on time range
 */
function formatTimeLabel(timestamp: Date, timeRange: PerformanceMetricsTimeRange): string {
  switch (timeRange) {
    case '1h':
    case '6h':
    case '24h':
      return timestamp.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    case '7d':
      return timestamp.toLocaleDateString('en-US', { weekday: 'short' })
    case '30d':
      return timestamp.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
    default:
      return timestamp.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
  }
}

/**
 * Custom tooltip component for cost trend chart
 */
function CostTrendTooltip({
  active,
  payload,
  label,
  showBreakdown = false,
  showProjection = false,
}: any) {
  const { colors } = useChartTheme()
  const tooltipStyles = getTooltipStyle({ colors })

  if (!active || !payload || !payload.length) {
    return null
  }

  // Find the data point
  const dataPoint = payload[0]?.payload as ChartDataPoint
  const hasBreakdown = dataPoint?.breakdown

  return (
    <div style={tooltipStyles.contentStyle} className="p-3 space-y-2">
      <div style={tooltipStyles.labelStyle} className="text-sm font-medium">
        {label}
      </div>

      <div className="space-y-1">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-foreground-secondary">{entry.name}</span>
            </div>
            <span className="font-medium text-foreground">
              {formatCost(entry.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Cost breakdown */}
      {showBreakdown && hasBreakdown && dataPoint.breakdown && (
        <div className="border-t border-border pt-2 space-y-1">
          <div className="text-xs text-foreground-secondary mb-1">Breakdown:</div>
          {dataPoint.breakdown.inputTokenCost > 0 && (
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-foreground-secondary">Input Tokens</span>
              <span className="font-medium text-foreground">
                {formatCost(dataPoint.breakdown.inputTokenCost)}
              </span>
            </div>
          )}
          {dataPoint.breakdown.outputTokenCost > 0 && (
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-foreground-secondary">Output Tokens</span>
              <span className="font-medium text-foreground">
                {formatCost(dataPoint.breakdown.outputTokenCost)}
              </span>
            </div>
          )}
          {dataPoint.breakdown.cacheCreationCost > 0 && (
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-foreground-secondary">Cache Creation</span>
              <span className="font-medium text-foreground">
                {formatCost(dataPoint.breakdown.cacheCreationCost)}
              </span>
            </div>
          )}
          {dataPoint.breakdown.cacheReadCost > 0 && (
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-foreground-secondary">Cache Reads</span>
              <span className="font-medium text-foreground">
                {formatCost(dataPoint.breakdown.cacheReadCost)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Projection information */}
      {showProjection && dataPoint.projectedCost && (
        <div className="border-t border-border pt-2">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-foreground-secondary">Projected</span>
            <span className="font-medium text-orange-500">
              {formatCost(dataPoint.projectedCost)}
            </span>
          </div>
        </div>
      )}

      {/* Cumulative cost */}
      <div className="border-t border-border pt-2">
        <div className="flex items-center justify-between gap-4 text-xs font-medium">
          <span className="text-foreground">Cumulative Cost</span>
          <span className="text-foreground">
            {formatCost(dataPoint.cumulativeCost)}
          </span>
        </div>
      </div>
    </div>
  )
}

/**
 * Loading skeleton for the chart
 */
function SkeletonChart({ height }: { height: number }) {
  return (
    <div className="space-y-4" style={{ height }}>
      <div className="flex-1 bg-background-secondary animate-pulse rounded-md" />
      <div className="flex justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-background-secondary animate-pulse rounded" />
          <div className="w-16 h-4 bg-background-secondary animate-pulse rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-background-secondary animate-pulse rounded" />
          <div className="w-20 h-4 bg-background-secondary animate-pulse rounded" />
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

// ============================================================================
// Main Component
// ============================================================================

/**
 * CostTrendChart Component
 *
 * Displays cost trends over time using Recharts AreaChart or LineChart.
 * Shows costs with optional budget limits, projections, and cumulative view.
 */
export function CostTrendChart({
  data,
  variant = 'area',
  height = 200,
  showLegend = true,
  showBudgetLimit = true,
  showProjection = true,
  showBreakdown = false,
  showCumulative = false,
  animated = true,
  colors,
  className,
  onDataPointClick,
}: CostTrendChartProps) {
  const theme = useChartTheme()
  const tooltipStyles = getTooltipStyle(theme)
  const gridProps = getGridStyle(theme)
  const axisProps = getAxisStyle(theme)

  // Transform data for Recharts
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!data?.data || data.data.length === 0) {
      return []
    }

    return data.data.map((point: CostTrendDataPoint) => ({
      timestamp: point.timestamp.getTime(),
      timeLabel: formatTimeLabel(point.timestamp, data.timeRange),
      cost: point.cost,
      cumulativeCost: point.cumulativeCost,
      projectedCost: point.projectedCost,
      breakdown: point.breakdown,
    }))
  }, [data])

  // Cost color configuration
  const costColors = useMemo(() => {
    const defaultColors = {
      cost: theme.colors.categorical[0], // apex-500/600
      cumulative: theme.colors.categorical[1], // violet-500/600
      projected: theme.colors.warning,
      budgetLimit: theme.colors.error,
    }

    if (colors?.tokens) {
      return { ...defaultColors, ...colors.tokens }
    }
    return defaultColors
  }, [theme.colors, colors])

  // Loading state
  if (!theme.mounted) {
    return <SkeletonChart height={height} />
  }

  // Empty state
  if (!data?.data || data.data.length === 0) {
    return (
      <EmptyState
        message="No cost data available"
        height={height}
      />
    )
  }

  // Chart component based on variant
  const ChartComponent = variant === 'line' ? LineChart : AreaChart

  // Determine which data to display based on cumulative setting
  const primaryDataKey = showCumulative ? 'cumulativeCost' : 'cost'
  const primaryName = showCumulative ? 'Cumulative Cost' : 'Cost'

  return (
    <div
      className={cn('space-y-4', className)}
      role="img"
      aria-label={`Cost trend over ${data.timeRange} showing ${formatCost(
        showCumulative ? data.data[data.data.length - 1]?.cumulativeCost || data.totalCost : data.totalCost
      )} total cost`}
    >
      {/* Chart */}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartComponent
            data={chartData}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
          >
            <CartesianGrid {...gridProps} />

            <XAxis
              dataKey="timeLabel"
              {...axisProps}
              interval="preserveStartEnd"
              tickMargin={8}
            />

            <YAxis
              {...axisProps}
              tickFormatter={currencyFormatter}
              tickMargin={8}
              width={80}
            />

            <Tooltip
              content={(props) => (
                <CostTrendTooltip
                  {...props}
                  showBreakdown={showBreakdown}
                  showProjection={showProjection}
                />
              )}
            />

            {showLegend && (
              <Legend
                verticalAlign="bottom"
                iconType="rect"
                wrapperStyle={{ paddingTop: 8 }}
                formatter={(value) => (
                  <span className="text-xs text-foreground-secondary">{value}</span>
                )}
              />
            )}

            {/* Budget limit line */}
            {showBudgetLimit && data.budgetLimit && (
              <ReferenceLine
                y={data.budgetLimit}
                stroke={costColors.budgetLimit}
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{
                  value: `Budget: ${formatCost(data.budgetLimit)}`,
                  position: 'top',
                  style: { fill: costColors.budgetLimit, fontSize: '12px' },
                }}
              />
            )}

            {/* Primary cost series */}
            {variant === 'area' ? (
              <Area
                type="monotone"
                dataKey={primaryDataKey}
                stroke={costColors.cost}
                fill={costColors.cost}
                fillOpacity={0.6}
                strokeWidth={2}
                name={primaryName}
                animationDuration={animated ? 1000 : 0}
              />
            ) : (
              <Line
                type="monotone"
                dataKey={primaryDataKey}
                stroke={costColors.cost}
                strokeWidth={2}
                name={primaryName}
                dot={false}
                activeDot={{ r: 4 }}
                animationDuration={animated ? 1000 : 0}
              />
            )}

            {/* Projected cost line */}
            {showProjection && variant === 'line' && data.projectedTotalCost && (
              <Line
                type="monotone"
                dataKey="projectedCost"
                stroke={costColors.projected}
                strokeWidth={2}
                strokeDasharray="5 5"
                name="Projected Cost"
                dot={false}
                activeDot={{ r: 3 }}
                animationDuration={animated ? 1000 : 0}
              />
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>

      {/* Hidden summary for screen readers */}
      <div className="sr-only">
        Cost trend summary for {data.timeRange}: {formatCost(data.totalCost)} total cost,
        {formatCost(data.avgCostPerHour)} average cost per hour.
        {data.budgetLimit && ` Budget limit: ${formatCost(data.budgetLimit)}.`}
        {data.budgetUtilization && ` Budget utilization: ${formatPercentage(data.budgetUtilization)}.`}
        {data.projectedTotalCost && ` Projected total: ${formatCost(data.projectedTotalCost)}.`}
        {data.cacheSavings && data.cacheSavings > 0 && ` Cache savings: ${formatCost(data.cacheSavings)}.`}
      </div>
    </div>
  )
}

// ============================================================================
// Mini Variant
// ============================================================================

/**
 * Mini version of CostTrendChart for dashboard cards and widgets
 */
export function CostTrendChartMini({
  data,
  height = 80,
  variant = 'area',
  showCumulative = false,
  className,
}: {
  data: CostTrendData
  height?: number
  variant?: 'area' | 'line'
  showCumulative?: boolean
  className?: string
}) {
  const theme = useChartTheme()

  // Transform data for mini chart
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!data?.data || data.data.length === 0) {
      return []
    }

    return data.data.map((point: CostTrendDataPoint) => ({
      timestamp: point.timestamp.getTime(),
      timeLabel: formatTimeLabel(point.timestamp, data.timeRange),
      cost: point.cost,
      cumulativeCost: point.cumulativeCost,
    }))
  }, [data])

  // Cost colors for mini chart
  const costColor = theme.colors.categorical[0]

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
  if (!data?.data || data.data.length === 0) {
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

  const ChartComponent = variant === 'line' ? LineChart : AreaChart
  const dataKey = showCumulative ? 'cumulativeCost' : 'cost'

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          {variant === 'area' ? (
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={costColor}
              fill={costColor}
              fillOpacity={0.6}
              strokeWidth={1}
            />
          ) : (
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={costColor}
              strokeWidth={2}
              dot={false}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}

// ============================================================================
// Exports
// ============================================================================

export default CostTrendChart
export type { CostTrendChartProps }