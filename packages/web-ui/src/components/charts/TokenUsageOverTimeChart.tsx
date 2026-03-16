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
} from 'recharts'
import { cn } from '@/lib/utils'
import {
  useChartTheme,
  getTooltipStyle,
  getGridStyle,
  getAxisStyle,
  compactNumberFormatter,
  createAxisFormatter,
  createTooltipFormatter,
} from '@/lib/chart-utils'
import {
  formatTokenCount,
  formatCost,
  formatPercentage,
  TIME_RANGE_CONFIGS,
} from '@/types/performance-metrics'
import type {
  TokenUsageOverTimeChartProps,
  TokenUsageOverTimeData,
  TokenUsageDataPoint,
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
  /** Input tokens for this time period */
  inputTokens: number
  /** Output tokens for this time period */
  outputTokens: number
  /** Total tokens (input + output) */
  totalTokens: number
  /** Cache creation tokens (if available) */
  cacheCreationTokens?: number
  /** Cache read tokens (if available) */
  cacheReadTokens?: number
  /** Associated cost for this interval */
  cost?: number
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
 * Custom tooltip component for token usage chart
 */
function TokenUsageTooltip({
  active,
  payload,
  label,
  showCost = false,
}: any) {
  const { colors } = useChartTheme()
  const tooltipStyles = getTooltipStyle({ colors })

  if (!active || !payload || !payload.length) {
    return null
  }

  // Find cost data point if available
  const dataPoint = payload[0]?.payload as ChartDataPoint
  const hasCache = dataPoint?.cacheCreationTokens || dataPoint?.cacheReadTokens

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
              {formatTokenCount(entry.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Cache information */}
      {hasCache && (
        <div className="border-t border-border pt-2 space-y-1">
          {dataPoint.cacheCreationTokens ? (
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-foreground-secondary">Cache Creation</span>
              <span className="font-medium text-foreground">
                {formatTokenCount(dataPoint.cacheCreationTokens)}
              </span>
            </div>
          ) : null}
          {dataPoint.cacheReadTokens ? (
            <div className="flex items-center justify-between gap-4 text-xs">
              <span className="text-foreground-secondary">Cache Read</span>
              <span className="font-medium text-foreground">
                {formatTokenCount(dataPoint.cacheReadTokens)}
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* Cost information */}
      {showCost && dataPoint.cost && (
        <div className="border-t border-border pt-2">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-foreground-secondary">Cost</span>
            <span className="font-medium text-foreground">
              {formatCost(dataPoint.cost)}
            </span>
          </div>
        </div>
      )}

      {/* Total tokens */}
      <div className="border-t border-border pt-2">
        <div className="flex items-center justify-between gap-4 text-xs font-medium">
          <span className="text-foreground">Total Tokens</span>
          <span className="text-foreground">
            {formatTokenCount(dataPoint.totalTokens)}
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
 * TokenUsageOverTimeChart Component
 *
 * Displays token usage patterns over time using Recharts AreaChart or LineChart.
 * Shows input vs output tokens with optional cost overlay and theme-aware styling.
 */
export function TokenUsageOverTimeChart({
  data,
  variant = 'area',
  height = 200,
  showLegend = true,
  showBreakdown = true,
  showCost = false,
  animated = true,
  colors,
  className,
  onDataPointClick,
}: TokenUsageOverTimeChartProps) {
  const theme = useChartTheme()
  const tooltipStyles = getTooltipStyle(theme)
  const gridProps = getGridStyle(theme)
  const axisProps = getAxisStyle(theme)

  // Transform data for Recharts
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!data?.data || data.data.length === 0) {
      return []
    }

    return data.data.map((point: TokenUsageDataPoint) => ({
      timestamp: point.timestamp.getTime(),
      timeLabel: formatTimeLabel(point.timestamp, data.timeRange),
      inputTokens: point.breakdown.inputTokens,
      outputTokens: point.breakdown.outputTokens,
      totalTokens: point.totalTokens,
      cacheCreationTokens: point.breakdown.cacheCreationTokens,
      cacheReadTokens: point.breakdown.cacheReadTokens,
      cost: point.cost,
    }))
  }, [data])

  // Token color configuration
  const tokenColors = useMemo(() => {
    const defaultColors = {
      input: theme.colors.categorical[0], // apex-500/600
      output: theme.colors.categorical[1], // violet-500/600
      cache: theme.colors.success,
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
        message="No token usage data available"
        height={height}
      />
    )
  }

  // Chart component based on variant
  const ChartComponent = variant === 'line' ? LineChart : AreaChart

  return (
    <div
      className={cn('space-y-4', className)}
      role="img"
      aria-label={`Token usage over ${data.timeRange} showing ${formatTokenCount(
        data.totalTokens
      )} total tokens`}
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
              tickFormatter={compactNumberFormatter}
              tickMargin={8}
              width={60}
            />

            <Tooltip
              content={(props) => (
                <TokenUsageTooltip {...props} showCost={showCost} />
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

            {/* Input tokens series */}
            {variant === 'area' ? (
              <Area
                type="monotone"
                dataKey="inputTokens"
                stackId="tokens"
                stroke={tokenColors.input}
                fill={tokenColors.input}
                fillOpacity={0.6}
                strokeWidth={2}
                name="Input Tokens"
                animationDuration={animated ? 1000 : 0}
              />
            ) : (
              <Line
                type="monotone"
                dataKey="inputTokens"
                stroke={tokenColors.input}
                strokeWidth={2}
                name="Input Tokens"
                dot={false}
                activeDot={{ r: 4 }}
                animationDuration={animated ? 1000 : 0}
              />
            )}

            {/* Output tokens series */}
            {showBreakdown && (
              variant === 'area' ? (
                <Area
                  type="monotone"
                  dataKey="outputTokens"
                  stackId="tokens"
                  stroke={tokenColors.output}
                  fill={tokenColors.output}
                  fillOpacity={0.6}
                  strokeWidth={2}
                  name="Output Tokens"
                  animationDuration={animated ? 1000 : 0}
                />
              ) : (
                <Line
                  type="monotone"
                  dataKey="outputTokens"
                  stroke={tokenColors.output}
                  strokeWidth={2}
                  name="Output Tokens"
                  dot={false}
                  activeDot={{ r: 4 }}
                  animationDuration={animated ? 1000 : 0}
                />
              )
            )}

            {/* Cache creation tokens (if available) */}
            {showBreakdown && data.totalCacheCreationTokens > 0 && (
              variant === 'area' ? (
                <Area
                  type="monotone"
                  dataKey="cacheCreationTokens"
                  stackId="tokens"
                  stroke={tokenColors.cache}
                  fill={tokenColors.cache}
                  fillOpacity={0.4}
                  strokeWidth={1}
                  name="Cache Creation"
                  animationDuration={animated ? 1000 : 0}
                />
              ) : (
                <Line
                  type="monotone"
                  dataKey="cacheCreationTokens"
                  stroke={tokenColors.cache}
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  name="Cache Creation"
                  dot={false}
                  activeDot={{ r: 3 }}
                  animationDuration={animated ? 1000 : 0}
                />
              )
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </div>

      {/* Hidden summary for screen readers */}
      <div className="sr-only">
        Token usage summary for {data.timeRange}: {formatTokenCount(data.totalInputTokens)} input tokens,
        {formatTokenCount(data.totalOutputTokens)} output tokens,
        {formatTokenCount(data.totalTokens)} total tokens.
        {data.totalCost > 0 && ` Total cost: ${formatCost(data.totalCost)}.`}
        {data.cacheHitRate > 0 && ` Cache hit rate: ${formatPercentage(data.cacheHitRate)}.`}
      </div>
    </div>
  )
}

// ============================================================================
// Mini Variant
// ============================================================================

/**
 * Mini version of TokenUsageOverTimeChart for dashboard cards and widgets
 */
export function TokenUsageOverTimeChartMini({
  data,
  height = 80,
  variant = 'area',
  className,
}: {
  data: TokenUsageOverTimeData
  height?: number
  variant?: 'area' | 'line'
  className?: string
}) {
  const theme = useChartTheme()

  // Transform data for mini chart
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!data?.data || data.data.length === 0) {
      return []
    }

    return data.data.map((point: TokenUsageDataPoint) => ({
      timestamp: point.timestamp.getTime(),
      timeLabel: formatTimeLabel(point.timestamp, data.timeRange),
      inputTokens: point.breakdown.inputTokens,
      outputTokens: point.breakdown.outputTokens,
      totalTokens: point.totalTokens,
    }))
  }, [data])

  // Token colors for mini chart
  const tokenColors = {
    input: theme.colors.categorical[0],
    output: theme.colors.categorical[1],
  }

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

  return (
    <div className={cn('w-full', className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          {variant === 'area' ? (
            <>
              <Area
                type="monotone"
                dataKey="inputTokens"
                stackId="tokens"
                stroke={tokenColors.input}
                fill={tokenColors.input}
                fillOpacity={0.6}
                strokeWidth={1}
              />
              <Area
                type="monotone"
                dataKey="outputTokens"
                stackId="tokens"
                stroke={tokenColors.output}
                fill={tokenColors.output}
                fillOpacity={0.6}
                strokeWidth={1}
              />
            </>
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="totalTokens"
                stroke={tokenColors.input}
                strokeWidth={2}
                dot={false}
              />
            </>
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  )
}

// ============================================================================
// Exports
// ============================================================================

export default TokenUsageOverTimeChart
export type { TokenUsageOverTimeChartProps }