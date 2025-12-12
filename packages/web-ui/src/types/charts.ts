/**
 * Chart Component Types
 *
 * Types for TokenUsageChart and BudgetGauge components.
 */

import type { TaskUsage } from '@apex/core'

/**
 * Token usage breakdown by category
 */
export interface TokenBreakdown {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

/**
 * Time-series data point for usage over time
 */
export interface UsageDataPoint {
  timestamp: Date
  tokens: number
  cost: number
}

/**
 * Budget thresholds for visual indicators
 */
export interface BudgetThresholds {
  /** Percentage at which to show warning color (e.g., 75) */
  warning: number
  /** Percentage at which to show danger color (e.g., 90) */
  danger: number
}

/**
 * Chart color scheme (theme-aware)
 */
export interface ChartColorScheme {
  primary: string
  secondary: string
  warning: string
  danger: string
  background: string
  text: string
  grid: string
}

/**
 * Props for TokenUsageChart component
 */
export interface TokenUsageChartProps {
  /**
   * Current task usage data
   */
  usage: TaskUsage

  /**
   * Historical usage data points for trend line
   */
  history?: UsageDataPoint[]

  /**
   * Maximum tokens allowed (for limit indicator)
   */
  maxTokens?: number

  /**
   * Chart display variant
   * @default 'bar'
   */
  variant?: 'bar' | 'donut' | 'area'

  /**
   * Whether to show legend
   * @default true
   */
  showLegend?: boolean

  /**
   * Chart height in pixels
   * @default 180
   */
  height?: number

  /**
   * Custom class name
   */
  className?: string

  /**
   * Whether to animate value changes
   * @default true
   */
  animated?: boolean
}

/**
 * Props for BudgetGauge component
 */
export interface BudgetGaugeProps {
  /**
   * Current spent amount
   */
  spent: number

  /**
   * Budget limit
   */
  limit: number

  /**
   * Optional daily budget for secondary indicator
   */
  dailyLimit?: number

  /**
   * Today's spending
   */
  dailySpent?: number

  /**
   * Threshold percentages for color changes
   * @default { warning: 75, danger: 90 }
   */
  thresholds?: BudgetThresholds

  /**
   * Whether to show numeric values
   * @default true
   */
  showValues?: boolean

  /**
   * Gauge size
   * @default 'md'
   */
  size?: 'sm' | 'md' | 'lg'

  /**
   * Custom class name
   */
  className?: string

  /**
   * Label to display below the gauge
   */
  label?: string

  /**
   * Whether to animate value changes
   * @default true
   */
  animated?: boolean
}

/**
 * Chart size configuration
 */
export interface ChartSizeConfig {
  height: number
  labelSize: number
  strokeWidth: number
  padding: number
}

/**
 * Predefined chart sizes
 */
export const CHART_SIZES: Record<'sm' | 'md' | 'lg', ChartSizeConfig> = {
  sm: { height: 120, labelSize: 10, strokeWidth: 8, padding: 8 },
  md: { height: 180, labelSize: 12, strokeWidth: 12, padding: 12 },
  lg: { height: 240, labelSize: 14, strokeWidth: 16, padding: 16 },
}

/**
 * Default budget thresholds
 */
export const DEFAULT_THRESHOLDS: BudgetThresholds = {
  warning: 75,
  danger: 90,
}

/**
 * Props for chart legend component
 */
export interface ChartLegendProps {
  items: Array<{
    label: string
    value: number | string
    color: string
  }>
  className?: string
}

/**
 * Props for mini sparkline chart
 */
export interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
}
