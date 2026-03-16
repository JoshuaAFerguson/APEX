/**
 * Performance Metrics Types
 *
 * Type definitions for the PerformanceMetricsPanel component and related
 * performance visualization components including token usage over time,
 * task completion rates, and cost trends.
 *
 * @packageDocumentation
 */

import type { TaskStatus } from '@apexcli/core'

// ============================================================================
// Time Range Configuration
// ============================================================================

/**
 * Available time range options for performance metrics
 * Controls the data aggregation period and granularity
 */
export type PerformanceMetricsTimeRange = '1h' | '6h' | '24h' | '7d' | '30d'

/**
 * Configuration for time range options
 */
export interface TimeRangeConfig {
  /** Time range identifier */
  value: PerformanceMetricsTimeRange
  /** Human-readable label */
  label: string
  /** Data point interval in milliseconds */
  intervalMs: number
  /** Expected number of data points */
  dataPoints: number
}

/**
 * Time range configurations with interval and data point settings
 */
export const TIME_RANGE_CONFIGS: Record<PerformanceMetricsTimeRange, TimeRangeConfig> = {
  '1h': { value: '1h', label: 'Last Hour', intervalMs: 60000, dataPoints: 60 },
  '6h': { value: '6h', label: 'Last 6 Hours', intervalMs: 360000, dataPoints: 60 },
  '24h': { value: '24h', label: 'Last 24 Hours', intervalMs: 1440000, dataPoints: 60 },
  '7d': { value: '7d', label: 'Last 7 Days', intervalMs: 10080000, dataPoints: 84 },
  '30d': { value: '30d', label: 'Last 30 Days', intervalMs: 43200000, dataPoints: 60 },
}

/**
 * Default time range for performance metrics
 */
export const DEFAULT_PERFORMANCE_TIME_RANGE: PerformanceMetricsTimeRange = '24h'

// ============================================================================
// Core Performance Metric Data Types
// ============================================================================

/**
 * Single data point in a time-series metric
 */
export interface PerformanceMetricDataPoint {
  /** Timestamp for this data point */
  timestamp: Date
  /** Primary metric value */
  value: number
  /** Optional label for the data point */
  label?: string
  /** Optional metadata for tooltips/details */
  metadata?: Record<string, unknown>
}

/**
 * Aggregated statistics for a metric series
 */
export interface MetricAggregates {
  /** Minimum value in the series */
  min: number
  /** Maximum value in the series */
  max: number
  /** Average value across all data points */
  avg: number
  /** Sum of all values */
  sum: number
  /** Number of data points */
  count: number
  /** Standard deviation (optional) */
  stdDev?: number
  /** 95th percentile value (optional) */
  p95?: number
}

/**
 * Generic performance metric data structure
 * Used for any time-series performance metric
 */
export interface PerformanceMetricData {
  /** Unique identifier for this metric */
  metricId: string
  /** Human-readable metric name */
  name: string
  /** Description of what this metric measures */
  description?: string
  /** Unit of measurement (e.g., 'tokens', 'ms', 'USD', '%') */
  unit: string
  /** Time-series data points */
  data: PerformanceMetricDataPoint[]
  /** Aggregated statistics */
  aggregates: MetricAggregates
  /** Time range this data covers */
  timeRange: PerformanceMetricsTimeRange
  /** Timestamp when this data was generated */
  generatedAt: Date
  /** Trend indicator compared to previous period (-1 = down, 0 = stable, 1 = up) */
  trend?: -1 | 0 | 1
  /** Percentage change from previous period */
  changePercent?: number
}

// ============================================================================
// Token Usage Over Time Data
// ============================================================================

/**
 * Breakdown of token usage by type
 */
export interface TokenTypeBreakdown {
  /** Number of input/prompt tokens */
  inputTokens: number
  /** Number of output/completion tokens */
  outputTokens: number
  /** Number of tokens used for cache creation */
  cacheCreationTokens?: number
  /** Number of tokens read from cache */
  cacheReadTokens?: number
}

/**
 * Single data point for token usage over time
 */
export interface TokenUsageDataPoint {
  /** Timestamp for this data point */
  timestamp: Date
  /** Total tokens used in this interval */
  totalTokens: number
  /** Breakdown by token type */
  breakdown: TokenTypeBreakdown
  /** Tokens per minute rate */
  tokensPerMinute?: number
  /** Associated cost for this interval */
  cost?: number
}

/**
 * Token usage over time data structure
 * Provides detailed token consumption metrics for charting
 */
export interface TokenUsageOverTimeData {
  /** Time-series data points */
  data: TokenUsageDataPoint[]
  /** Total input tokens across the period */
  totalInputTokens: number
  /** Total output tokens across the period */
  totalOutputTokens: number
  /** Total tokens (input + output) across the period */
  totalTokens: number
  /** Total cache creation tokens */
  totalCacheCreationTokens: number
  /** Total cache read tokens */
  totalCacheReadTokens: number
  /** Cache hit rate as a percentage (0-100) */
  cacheHitRate: number
  /** Average tokens per minute */
  avgTokensPerMinute: number
  /** Peak tokens per minute */
  peakTokensPerMinute: number
  /** Total estimated cost for the period */
  totalCost: number
  /** Time range for this data */
  timeRange: PerformanceMetricsTimeRange
  /** Timestamp when data was generated */
  generatedAt: Date
  /** Trend compared to previous period */
  trend?: -1 | 0 | 1
  /** Percentage change from previous period */
  changePercent?: number
}

/**
 * Empty token usage data constant
 */
export const EMPTY_TOKEN_USAGE_DATA: TokenUsageOverTimeData = {
  data: [],
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalTokens: 0,
  totalCacheCreationTokens: 0,
  totalCacheReadTokens: 0,
  cacheHitRate: 0,
  avgTokensPerMinute: 0,
  peakTokensPerMinute: 0,
  totalCost: 0,
  timeRange: '24h',
  generatedAt: new Date(),
}

// ============================================================================
// Task Completion Rate Data
// ============================================================================

/**
 * Task completion status counts
 */
export interface TaskStatusCounts {
  /** Number of successfully completed tasks */
  completed: number
  /** Number of failed tasks */
  failed: number
  /** Number of tasks in progress */
  inProgress: number
  /** Number of pending/queued tasks */
  pending: number
  /** Number of cancelled tasks */
  cancelled: number
  /** Number of paused tasks */
  paused: number
}

/**
 * Single data point for task completion rate
 */
export interface TaskCompletionDataPoint {
  /** Timestamp for this data point */
  timestamp: Date
  /** Completion rate as a percentage (0-100) */
  completionRate: number
  /** Success rate (completed / (completed + failed)) as percentage */
  successRate: number
  /** Number of tasks completed in this interval */
  completedCount: number
  /** Number of tasks failed in this interval */
  failedCount: number
  /** Total tasks processed in this interval */
  totalProcessed: number
  /** Average task duration in milliseconds */
  avgDurationMs?: number
}

/**
 * Task completion rate data structure
 * Provides task completion and success metrics for charting
 */
export interface TaskCompletionRateData {
  /** Time-series data points */
  data: TaskCompletionDataPoint[]
  /** Overall completion rate for the period (0-100) */
  overallCompletionRate: number
  /** Overall success rate for the period (0-100) */
  overallSuccessRate: number
  /** Total completed tasks in the period */
  totalCompleted: number
  /** Total failed tasks in the period */
  totalFailed: number
  /** Total tasks processed in the period */
  totalProcessed: number
  /** Current task status counts */
  statusCounts: TaskStatusCounts
  /** Breakdown by task status */
  byStatus: Partial<Record<TaskStatus, number>>
  /** Average task duration in milliseconds */
  avgDurationMs: number
  /** Median task duration in milliseconds */
  medianDurationMs: number
  /** 95th percentile task duration in milliseconds */
  p95DurationMs: number
  /** Time range for this data */
  timeRange: PerformanceMetricsTimeRange
  /** Timestamp when data was generated */
  generatedAt: Date
  /** Trend compared to previous period */
  trend?: -1 | 0 | 1
  /** Percentage change from previous period */
  changePercent?: number
}

/**
 * Empty task completion rate data constant
 */
export const EMPTY_TASK_COMPLETION_DATA: TaskCompletionRateData = {
  data: [],
  overallCompletionRate: 0,
  overallSuccessRate: 0,
  totalCompleted: 0,
  totalFailed: 0,
  totalProcessed: 0,
  statusCounts: {
    completed: 0,
    failed: 0,
    inProgress: 0,
    pending: 0,
    cancelled: 0,
    paused: 0,
  },
  byStatus: {},
  avgDurationMs: 0,
  medianDurationMs: 0,
  p95DurationMs: 0,
  timeRange: '24h',
  generatedAt: new Date(),
}

// ============================================================================
// Cost Trend Data
// ============================================================================

/**
 * Cost breakdown by category
 */
export interface CostBreakdown {
  /** Cost for input tokens */
  inputTokenCost: number
  /** Cost for output tokens */
  outputTokenCost: number
  /** Cost for cache creation */
  cacheCreationCost: number
  /** Cost for cache reads (typically $0 or minimal) */
  cacheReadCost: number
  /** Other costs (if applicable) */
  otherCost: number
}

/**
 * Single data point for cost trend
 */
export interface CostTrendDataPoint {
  /** Timestamp for this data point */
  timestamp: Date
  /** Total cost in this interval (USD) */
  cost: number
  /** Cumulative cost up to this point */
  cumulativeCost: number
  /** Cost breakdown by category */
  breakdown?: CostBreakdown
  /** Projected cost based on current rate */
  projectedCost?: number
}

/**
 * Cost trend data structure
 * Provides cost analysis and projection metrics for charting
 */
export interface CostTrendData {
  /** Time-series data points */
  data: CostTrendDataPoint[]
  /** Total cost for the period (USD) */
  totalCost: number
  /** Average cost per hour */
  avgCostPerHour: number
  /** Average cost per task */
  avgCostPerTask: number
  /** Peak hourly cost */
  peakHourlyCost: number
  /** Cost breakdown for the period */
  breakdown: CostBreakdown
  /** Budget limit (if configured) */
  budgetLimit?: number
  /** Daily budget limit (if configured) */
  dailyBudgetLimit?: number
  /** Budget utilization percentage (0-100) */
  budgetUtilization?: number
  /** Projected cost for the remaining period */
  projectedRemainingCost?: number
  /** Projected total cost if current rate continues */
  projectedTotalCost?: number
  /** Cost savings from cache usage */
  cacheSavings?: number
  /** Time range for this data */
  timeRange: PerformanceMetricsTimeRange
  /** Timestamp when data was generated */
  generatedAt: Date
  /** Trend compared to previous period */
  trend?: -1 | 0 | 1
  /** Percentage change from previous period */
  changePercent?: number
}

/**
 * Empty cost trend data constant
 */
export const EMPTY_COST_TREND_DATA: CostTrendData = {
  data: [],
  totalCost: 0,
  avgCostPerHour: 0,
  avgCostPerTask: 0,
  peakHourlyCost: 0,
  breakdown: {
    inputTokenCost: 0,
    outputTokenCost: 0,
    cacheCreationCost: 0,
    cacheReadCost: 0,
    otherCost: 0,
  },
  timeRange: '24h',
  generatedAt: new Date(),
}

// ============================================================================
// Aggregated Performance Metrics
// ============================================================================

/**
 * Aggregated performance metrics combining all data types
 */
export interface AggregatedPerformanceMetrics {
  /** Token usage over time data */
  tokenUsage: TokenUsageOverTimeData
  /** Task completion rate data */
  taskCompletion: TaskCompletionRateData
  /** Cost trend data */
  costTrend: CostTrendData
  /** Additional custom metrics */
  customMetrics?: PerformanceMetricData[]
  /** Time range for all metrics */
  timeRange: PerformanceMetricsTimeRange
  /** Timestamp when data was generated */
  generatedAt: Date
}

/**
 * Empty aggregated performance metrics constant
 */
export const EMPTY_AGGREGATED_METRICS: AggregatedPerformanceMetrics = {
  tokenUsage: EMPTY_TOKEN_USAGE_DATA,
  taskCompletion: EMPTY_TASK_COMPLETION_DATA,
  costTrend: EMPTY_COST_TREND_DATA,
  timeRange: '24h',
  generatedAt: new Date(),
}

// ============================================================================
// Chart Configuration Types
// ============================================================================

/**
 * Chart display variant for performance metrics
 */
export type PerformanceChartVariant = 'line' | 'area' | 'bar' | 'stacked-bar' | 'pie'

/**
 * Color scheme for performance charts
 */
export interface PerformanceChartColorScheme {
  /** Primary metric color */
  primary: string
  /** Secondary metric color */
  secondary: string
  /** Success/positive color */
  success: string
  /** Warning color */
  warning: string
  /** Error/danger color */
  danger: string
  /** Grid line color */
  grid: string
  /** Text color */
  text: string
  /** Background color */
  background: string
  /** Token-specific colors */
  tokens: {
    input: string
    output: string
    cache: string
  }
}

/**
 * Default color scheme for performance charts
 */
export const DEFAULT_PERFORMANCE_CHART_COLORS: PerformanceChartColorScheme = {
  primary: 'var(--color-apex-500)',
  secondary: 'var(--color-apex-700)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-error)',
  grid: 'var(--color-border-secondary)',
  text: 'var(--color-foreground-primary)',
  background: 'var(--color-background-secondary)',
  tokens: {
    input: 'var(--color-apex-500)',
    output: 'var(--color-apex-700)',
    cache: 'var(--color-success)',
  },
}

/**
 * Chart size configuration
 */
export interface PerformanceChartSizeConfig {
  /** Chart height in pixels */
  height: number
  /** Label font size */
  labelSize: number
  /** Stroke width for lines */
  strokeWidth: number
  /** Padding around the chart */
  padding: number
  /** Bar width (for bar charts) */
  barWidth?: number
}

/**
 * Predefined chart size configurations
 */
export const PERFORMANCE_CHART_SIZES: Record<'sm' | 'md' | 'lg', PerformanceChartSizeConfig> = {
  sm: { height: 160, labelSize: 10, strokeWidth: 1.5, padding: 8, barWidth: 8 },
  md: { height: 240, labelSize: 12, strokeWidth: 2, padding: 12, barWidth: 12 },
  lg: { height: 320, labelSize: 14, strokeWidth: 2.5, padding: 16, barWidth: 16 },
}

// ============================================================================
// Component Props Interfaces
// ============================================================================

/**
 * Props for the PerformanceMetricsPanel component
 */
export interface PerformanceMetricsPanelProps {
  /**
   * Aggregated performance metrics data
   */
  data?: AggregatedPerformanceMetrics

  /**
   * Selected time range for data display
   * @default '24h'
   */
  timeRange?: PerformanceMetricsTimeRange

  /**
   * Callback when time range is changed
   */
  onTimeRangeChange?: (range: PerformanceMetricsTimeRange) => void

  /**
   * Whether to show the time range selector
   * @default true
   */
  showTimeRangeSelector?: boolean

  /**
   * Whether to show token usage chart
   * @default true
   */
  showTokenUsage?: boolean

  /**
   * Whether to show task completion chart
   * @default true
   */
  showTaskCompletion?: boolean

  /**
   * Whether to show cost trend chart
   * @default true
   */
  showCostTrend?: boolean

  /**
   * Whether to show summary cards
   * @default true
   */
  showSummaryCards?: boolean

  /**
   * Chart display variant
   * @default 'area'
   */
  chartVariant?: PerformanceChartVariant

  /**
   * Chart size preset
   * @default 'md'
   */
  chartSize?: 'sm' | 'md' | 'lg'

  /**
   * Custom color scheme
   */
  colors?: Partial<PerformanceChartColorScheme>

  /**
   * Whether to animate chart transitions
   * @default true
   */
  animated?: boolean

  /**
   * Whether the panel is in a loading state
   * @default false
   */
  loading?: boolean

  /**
   * Error message to display
   */
  error?: string | null

  /**
   * Callback when refresh is requested
   */
  onRefresh?: () => void

  /**
   * Whether to auto-refresh data
   * @default false
   */
  autoRefresh?: boolean

  /**
   * Auto-refresh interval in milliseconds
   * @default 60000
   */
  autoRefreshInterval?: number

  /**
   * Custom CSS class name
   */
  className?: string

  /**
   * Empty state message
   * @default 'No performance data available'
   */
  emptyMessage?: string
}

/**
 * Props for the TokenUsageChart component
 */
export interface TokenUsageOverTimeChartProps {
  /**
   * Token usage data to display
   */
  data: TokenUsageOverTimeData

  /**
   * Chart display variant
   * @default 'area'
   */
  variant?: PerformanceChartVariant

  /**
   * Chart height in pixels
   * @default 200
   */
  height?: number

  /**
   * Whether to show legend
   * @default true
   */
  showLegend?: boolean

  /**
   * Whether to show breakdown by token type
   * @default true
   */
  showBreakdown?: boolean

  /**
   * Whether to show cost overlay
   * @default false
   */
  showCost?: boolean

  /**
   * Whether to animate chart
   * @default true
   */
  animated?: boolean

  /**
   * Custom color scheme
   */
  colors?: Partial<PerformanceChartColorScheme>

  /**
   * Custom CSS class name
   */
  className?: string

  /**
   * Callback when a data point is clicked
   */
  onDataPointClick?: (point: TokenUsageDataPoint) => void
}

/**
 * Props for the TaskCompletionRateChart component
 */
export interface TaskCompletionRateChartProps {
  /**
   * Task completion data to display
   */
  data: TaskCompletionRateData

  /**
   * Chart display variant
   * @default 'area'
   */
  variant?: PerformanceChartVariant

  /**
   * Chart height in pixels
   * @default 200
   */
  height?: number

  /**
   * Whether to show legend
   * @default true
   */
  showLegend?: boolean

  /**
   * Whether to show success rate alongside completion rate
   * @default true
   */
  showSuccessRate?: boolean

  /**
   * Whether to show status distribution
   * @default false
   */
  showStatusDistribution?: boolean

  /**
   * Whether to animate chart
   * @default true
   */
  animated?: boolean

  /**
   * Custom color scheme
   */
  colors?: Partial<PerformanceChartColorScheme>

  /**
   * Custom CSS class name
   */
  className?: string

  /**
   * Callback when a data point is clicked
   */
  onDataPointClick?: (point: TaskCompletionDataPoint) => void
}

/**
 * Props for the CostTrendChart component
 */
export interface CostTrendChartProps {
  /**
   * Cost trend data to display
   */
  data: CostTrendData

  /**
   * Chart display variant
   * @default 'area'
   */
  variant?: PerformanceChartVariant

  /**
   * Chart height in pixels
   * @default 200
   */
  height?: number

  /**
   * Whether to show legend
   * @default true
   */
  showLegend?: boolean

  /**
   * Whether to show budget limit line
   * @default true
   */
  showBudgetLimit?: boolean

  /**
   * Whether to show projected cost
   * @default true
   */
  showProjection?: boolean

  /**
   * Whether to show cost breakdown
   * @default false
   */
  showBreakdown?: boolean

  /**
   * Whether to show cumulative/running total view instead of per-period cost
   * @default false
   */
  showCumulative?: boolean

  /**
   * Whether to animate chart
   * @default true
   */
  animated?: boolean

  /**
   * Custom color scheme
   */
  colors?: Partial<PerformanceChartColorScheme>

  /**
   * Custom CSS class name
   */
  className?: string

  /**
   * Callback when a data point is clicked
   */
  onDataPointClick?: (point: CostTrendDataPoint) => void
}

/**
 * Props for metric summary card component
 */
export interface MetricSummaryCardProps {
  /** Card title */
  title: string
  /** Primary metric value */
  value: string | number
  /** Unit of measurement */
  unit?: string
  /** Trend indicator (-1, 0, 1) */
  trend?: -1 | 0 | 1
  /** Change percentage from previous period */
  changePercent?: number
  /** Card icon (React node) */
  icon?: React.ReactNode
  /** Sparkline data points (optional) */
  sparklineData?: number[]
  /** Whether to show sparkline */
  showSparkline?: boolean
  /** Custom CSS class name */
  className?: string
}

// ============================================================================
// Default Props Values
// ============================================================================

/**
 * Default props for PerformanceMetricsPanel
 */
export const DEFAULT_PERFORMANCE_METRICS_PANEL_PROPS: Required<
  Pick<
    PerformanceMetricsPanelProps,
    | 'timeRange'
    | 'showTimeRangeSelector'
    | 'showTokenUsage'
    | 'showTaskCompletion'
    | 'showCostTrend'
    | 'showSummaryCards'
    | 'chartVariant'
    | 'chartSize'
    | 'animated'
    | 'loading'
    | 'autoRefresh'
    | 'autoRefreshInterval'
    | 'emptyMessage'
  >
> = {
  timeRange: '24h',
  showTimeRangeSelector: true,
  showTokenUsage: true,
  showTaskCompletion: true,
  showCostTrend: true,
  showSummaryCards: true,
  chartVariant: 'area',
  chartSize: 'md',
  animated: true,
  loading: false,
  autoRefresh: false,
  autoRefreshInterval: 60000,
  emptyMessage: 'No performance data available',
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a cost value for display
 */
export function formatCost(cost: number, decimals: number = 4): string {
  if (cost < 0.0001) {
    return '<$0.0001'
  }
  if (cost < 1) {
    return `$${cost.toFixed(decimals)}`
  }
  return `$${cost.toFixed(2)}`
}

/**
 * Format a token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toString()
  }
  if (tokens < 1000000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return `${(tokens / 1000000).toFixed(2)}M`
}

/**
 * Format a percentage for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`
}

/**
 * Format duration in milliseconds for display
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`
  }
  return `${(ms / 3600000).toFixed(1)}h`
}

/**
 * Calculate trend from two values
 */
export function calculateTrend(current: number, previous: number): -1 | 0 | 1 {
  if (previous === 0) {
    return current > 0 ? 1 : 0
  }
  const change = ((current - previous) / previous) * 100
  if (Math.abs(change) < 1) {
    return 0
  }
  return change > 0 ? 1 : -1
}

/**
 * Calculate percentage change between two values
 */
export function calculateChangePercent(current: number, previous: number): number {
  if (previous === 0) {
    return current > 0 ? 100 : 0
  }
  return ((current - previous) / previous) * 100
}

/**
 * Get time range label for display
 */
export function getTimeRangeLabel(range: PerformanceMetricsTimeRange): string {
  return TIME_RANGE_CONFIGS[range].label
}

/**
 * Get all available time range options
 */
export function getTimeRangeOptions(): Array<{ value: PerformanceMetricsTimeRange; label: string }> {
  return Object.values(TIME_RANGE_CONFIGS).map(({ value, label }) => ({ value, label }))
}
