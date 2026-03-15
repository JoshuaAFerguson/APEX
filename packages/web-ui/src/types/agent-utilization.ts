/**
 * Agent Utilization Chart Types
 *
 * Type definitions for the AgentUtilizationChart component which displays
 * per-agent token usage, cost breakdown, and performance metrics.
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Data Types
// ============================================================================

/**
 * Single agent utilization record containing token usage and performance data
 */
export interface AgentUtilization {
  /** Unique identifier for the agent */
  agentId: string

  /** Human-readable agent name */
  agentName: string

  /** Number of input tokens consumed */
  inputTokens: number

  /** Number of output tokens generated */
  outputTokens: number

  /** Total tokens (input + output) */
  totalTokens: number

  /** Estimated cost in USD */
  estimatedCost: number

  /** Tokens processed per second (throughput metric) */
  tokensPerSecond: number

  /** Total execution duration in milliseconds */
  duration: number

  /** Number of invocations */
  invocations: number

  /** Cache tokens used (optional) */
  cacheTokens?: number

  /** Cache hit rate (0-1, optional) */
  cacheHitRate?: number

  /** Average latency per request in milliseconds */
  avgLatencyMs?: number
}

/**
 * Aggregated agent utilization data for the chart
 */
export interface AgentUtilizationData {
  /** Array of individual agent utilization records */
  agents: AgentUtilization[]

  /** Total input tokens across all agents */
  totalInputTokens: number

  /** Total output tokens across all agents */
  totalOutputTokens: number

  /** Total tokens across all agents */
  totalTokens: number

  /** Total estimated cost across all agents */
  totalEstimatedCost: number

  /** Total duration across all agents */
  totalDuration: number

  /** Average tokens per second across all agents */
  avgTokensPerSecond: number

  /** Time range for the data (ISO 8601 format) */
  timeRange?: {
    start: Date
    end: Date
  }

  /** Timestamp when data was last updated */
  lastUpdated: Date
}

// ============================================================================
// Chart Configuration Types
// ============================================================================

/**
 * Chart display variant
 */
export type AgentUtilizationChartVariant = 'bar' | 'stacked-bar' | 'pie' | 'treemap'

/**
 * Metric to display/sort by
 */
export type AgentUtilizationMetric =
  | 'tokens'
  | 'inputTokens'
  | 'outputTokens'
  | 'cost'
  | 'tokensPerSecond'
  | 'duration'
  | 'invocations'

/**
 * Sort direction for agent data
 */
export type AgentUtilizationSortDirection = 'asc' | 'desc'

/**
 * Chart color configuration
 */
export interface AgentUtilizationColorConfig {
  /** Color for input tokens */
  inputTokens: string
  /** Color for output tokens */
  outputTokens: string
  /** Color for cost indicator */
  cost: string
  /** Color for performance indicator */
  performance: string
  /** Array of colors for multiple agents */
  agentColors: string[]
}

/**
 * Default color configuration
 */
export const DEFAULT_UTILIZATION_COLORS: AgentUtilizationColorConfig = {
  inputTokens: 'var(--color-apex-500)',
  outputTokens: 'var(--color-apex-700)',
  cost: 'var(--color-warning)',
  performance: 'var(--color-success)',
  agentColors: [
    'var(--color-apex-500)',
    'var(--color-apex-600)',
    'var(--color-apex-700)',
    'var(--color-apex-800)',
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#f97316', // orange
    '#14b8a6', // teal
  ],
}

// ============================================================================
// Chart Props Interface
// ============================================================================

/**
 * Props for the AgentUtilizationChart component
 */
export interface AgentUtilizationChartProps {
  /**
   * Agent utilization data to display
   */
  data: AgentUtilizationData

  /**
   * Chart display variant
   * @default 'bar'
   */
  variant?: AgentUtilizationChartVariant

  /**
   * Primary metric to display/highlight
   * @default 'tokens'
   */
  metric?: AgentUtilizationMetric

  /**
   * Sort agents by this metric
   * @default 'tokens'
   */
  sortBy?: AgentUtilizationMetric

  /**
   * Sort direction
   * @default 'desc'
   */
  sortDirection?: AgentUtilizationSortDirection

  /**
   * Maximum number of agents to display (others grouped as "Other")
   * @default 8
   */
  maxAgents?: number

  /**
   * Chart height in pixels
   * @default 240
   */
  height?: number

  /**
   * Whether to show the legend
   * @default true
   */
  showLegend?: boolean

  /**
   * Whether to show token breakdown (input vs output)
   * @default true
   */
  showTokenBreakdown?: boolean

  /**
   * Whether to show cost information
   * @default true
   */
  showCost?: boolean

  /**
   * Whether to show performance metrics (tokens/sec)
   * @default false
   */
  showPerformance?: boolean

  /**
   * Whether to animate chart transitions
   * @default true
   */
  animated?: boolean

  /**
   * Custom color configuration
   */
  colors?: Partial<AgentUtilizationColorConfig>

  /**
   * Custom CSS class name
   */
  className?: string

  /**
   * Callback when an agent is clicked
   */
  onAgentClick?: (agent: AgentUtilization) => void

  /**
   * Callback when an agent is hovered
   */
  onAgentHover?: (agent: AgentUtilization | null) => void

  /**
   * Whether the chart is in a loading state
   * @default false
   */
  loading?: boolean

  /**
   * Error message to display
   */
  error?: string | null

  /**
   * Empty state message when no data
   * @default 'No agent utilization data available'
   */
  emptyMessage?: string
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Processed agent data ready for chart rendering
 */
export interface ProcessedAgentData extends AgentUtilization {
  /** Percentage of total tokens */
  tokenPercentage: number
  /** Percentage of total cost */
  costPercentage: number
  /** Assigned chart color */
  color: string
  /** Display label (may be truncated) */
  displayName: string
}

/**
 * Chart tooltip data
 */
export interface AgentUtilizationTooltipData {
  agent: AgentUtilization
  position: { x: number; y: number }
  visible: boolean
}

/**
 * Agent utilization summary for dashboard cards
 */
export interface AgentUtilizationSummary {
  /** Total number of active agents */
  agentCount: number
  /** Top agent by token usage */
  topAgent: {
    name: string
    tokens: number
    percentage: number
  } | null
  /** Total tokens across all agents */
  totalTokens: number
  /** Total cost across all agents */
  totalCost: number
  /** Average tokens per second */
  avgThroughput: number
}

// ============================================================================
// Chart Size Configuration
// ============================================================================

/**
 * Predefined chart sizes for responsive layouts
 */
export interface AgentUtilizationChartSizeConfig {
  height: number
  barHeight: number
  labelWidth: number
  padding: number
  fontSize: number
}

/**
 * Predefined size configurations
 */
export const AGENT_UTILIZATION_CHART_SIZES: Record<'sm' | 'md' | 'lg', AgentUtilizationChartSizeConfig> = {
  sm: { height: 160, barHeight: 16, labelWidth: 80, padding: 8, fontSize: 10 },
  md: { height: 240, barHeight: 24, labelWidth: 120, padding: 12, fontSize: 12 },
  lg: { height: 360, barHeight: 32, labelWidth: 160, padding: 16, fontSize: 14 },
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default props for AgentUtilizationChart
 */
export const DEFAULT_AGENT_UTILIZATION_CHART_PROPS: Required<
  Pick<
    AgentUtilizationChartProps,
    | 'variant'
    | 'metric'
    | 'sortBy'
    | 'sortDirection'
    | 'maxAgents'
    | 'height'
    | 'showLegend'
    | 'showTokenBreakdown'
    | 'showCost'
    | 'showPerformance'
    | 'animated'
    | 'loading'
    | 'emptyMessage'
  >
> = {
  variant: 'bar',
  metric: 'tokens',
  sortBy: 'tokens',
  sortDirection: 'desc',
  maxAgents: 8,
  height: 240,
  showLegend: true,
  showTokenBreakdown: true,
  showCost: true,
  showPerformance: false,
  animated: true,
  loading: false,
  emptyMessage: 'No agent utilization data available',
}

/**
 * Empty agent utilization data
 */
export const EMPTY_AGENT_UTILIZATION_DATA: AgentUtilizationData = {
  agents: [],
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalTokens: 0,
  totalEstimatedCost: 0,
  totalDuration: 0,
  avgTokensPerSecond: 0,
  lastUpdated: new Date(),
}
