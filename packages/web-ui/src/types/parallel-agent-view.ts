/**
 * Parallel Agent View Types
 *
 * Type definitions for the ParallelAgentView component which displays
 * Visual Kanban parallel agent visualization with lane-based layout.
 * Shows multiple agents executing concurrently with progress tracking
 * and status indicators in a kanban-style interface.
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Enums and Type Unions
// ============================================================================

/**
 * Status of a parallel agent execution
 *
 * @remarks
 * - `idle` - Agent is waiting to be assigned work
 * - `queued` - Agent is queued for execution
 * - `running` - Agent is actively executing
 * - `paused` - Agent execution is temporarily paused
 * - `completed` - Agent has finished successfully
 * - `failed` - Agent execution encountered an error
 * - `cancelled` - Agent execution was cancelled by user
 */
export type AgentExecutionStatus =
  | 'idle'
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

/**
 * Visual layout mode for the parallel agent view
 *
 * @remarks
 * - `lanes` - Vertical swim lanes (kanban-style)
 * - `grid` - Grid layout for compact display
 * - `timeline` - Horizontal timeline view
 * - `compact` - Minimal compact view
 */
export type ParallelAgentViewLayout =
  | 'lanes'
  | 'grid'
  | 'timeline'
  | 'compact'

/**
 * Sort criteria for ordering agents
 *
 * @remarks
 * - `name` - Alphabetical by agent name
 * - `status` - By execution status
 * - `progress` - By completion percentage
 * - `startTime` - By execution start time
 * - `duration` - By elapsed execution time
 */
export type AgentSortCriteria =
  | 'name'
  | 'status'
  | 'progress'
  | 'startTime'
  | 'duration'

/**
 * Sort direction for agent ordering
 */
export type AgentSortDirection = 'asc' | 'desc'

/**
 * Size variant for the view component
 */
export type ParallelAgentViewSize = 'sm' | 'md' | 'lg'

// ============================================================================
// Core Data Types
// ============================================================================

/**
 * Represents a single agent execution instance within a parallel execution context
 *
 * @remarks
 * Contains all state and metrics for tracking an agent's execution lifecycle
 * in a parallel orchestration scenario.
 */
export interface AgentExecution {
  /**
   * Unique identifier for this execution instance
   */
  id: string

  /**
   * Unique identifier of the agent type/definition
   */
  agentId: string

  /**
   * Human-readable name of the agent
   */
  agentName: string

  /**
   * Current execution status
   */
  status: AgentExecutionStatus

  /**
   * Current stage or phase of execution
   * @example "planning", "implementing", "testing"
   */
  stage?: string

  /**
   * Progress percentage (0-100)
   */
  progress: number

  /**
   * Timestamp when execution started
   */
  startedAt?: Date

  /**
   * Timestamp when execution completed
   */
  completedAt?: Date

  /**
   * Duration of execution in milliseconds
   */
  durationMs?: number

  /**
   * Error message if execution failed
   */
  error?: string | null

  /**
   * Number of tokens consumed (input + output)
   */
  tokensUsed?: number

  /**
   * Estimated cost in USD
   */
  estimatedCost?: number

  /**
   * Task ID being processed by this agent
   */
  taskId?: string

  /**
   * Task description being processed
   */
  taskDescription?: string

  /**
   * ID of parent lane this execution belongs to
   */
  laneId: string

  /**
   * Custom metadata for the execution
   */
  metadata?: Record<string, unknown>
}

/**
 * Represents a swim lane containing agent executions
 *
 * @remarks
 * Lanes organize related agent executions and provide visual grouping
 * in the kanban-style parallel agent view.
 */
export interface AgentLane {
  /**
   * Unique identifier for the lane
   */
  id: string

  /**
   * Human-readable label for the lane
   */
  label: string

  /**
   * Optional description of the lane's purpose
   */
  description?: string

  /**
   * Agent executions within this lane
   */
  executions: AgentExecution[]

  /**
   * Display color for the lane (CSS color value)
   * @default 'var(--color-apex-500)'
   */
  color?: string

  /**
   * Lane priority for ordering (lower = higher priority)
   * @default 0
   */
  priority?: number

  /**
   * Whether the lane is collapsed in the UI
   * @default false
   */
  collapsed?: boolean

  /**
   * Maximum concurrent executions allowed in this lane
   */
  maxConcurrent?: number

  /**
   * Custom metadata for the lane
   */
  metadata?: Record<string, unknown>
}

/**
 * Aggregated data for the parallel agent view
 */
export interface ParallelAgentViewData {
  /**
   * All lanes in the parallel execution
   */
  lanes: AgentLane[]

  /**
   * Total number of executions across all lanes
   */
  totalExecutions: number

  /**
   * Number of currently running executions
   */
  runningCount: number

  /**
   * Number of completed executions
   */
  completedCount: number

  /**
   * Number of failed executions
   */
  failedCount: number

  /**
   * Overall progress percentage (0-100)
   */
  overallProgress: number

  /**
   * Total tokens consumed across all executions
   */
  totalTokensUsed: number

  /**
   * Total estimated cost across all executions
   */
  totalEstimatedCost: number

  /**
   * Timestamp when the parallel execution started
   */
  startedAt?: Date

  /**
   * Timestamp when data was last updated
   */
  lastUpdated: Date
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Color configuration for the parallel agent view
 */
export interface ParallelAgentViewColorConfig {
  /**
   * Color for idle agents
   */
  idle: string

  /**
   * Color for queued agents
   */
  queued: string

  /**
   * Color for running agents
   */
  running: string

  /**
   * Color for paused agents
   */
  paused: string

  /**
   * Color for completed agents
   */
  completed: string

  /**
   * Color for failed agents
   */
  failed: string

  /**
   * Color for cancelled agents
   */
  cancelled: string

  /**
   * Array of colors for different lanes
   */
  laneColors: string[]
}

/**
 * Configuration options for the parallel agent view
 */
export interface ParallelAgentViewConfig {
  /**
   * Layout mode for the view
   * @default 'lanes'
   */
  layout: ParallelAgentViewLayout

  /**
   * Size variant for the component
   * @default 'md'
   */
  size: ParallelAgentViewSize

  /**
   * Sort criteria for agents
   * @default 'startTime'
   */
  sortBy: AgentSortCriteria

  /**
   * Sort direction
   * @default 'asc'
   */
  sortDirection: AgentSortDirection

  /**
   * Maximum number of lanes to display
   * @default 6
   */
  maxLanes: number

  /**
   * Maximum agents per lane to display
   * @default 10
   */
  maxAgentsPerLane: number

  /**
   * Whether to show progress bars
   * @default true
   */
  showProgress: boolean

  /**
   * Whether to show elapsed time
   * @default true
   */
  showElapsedTime: boolean

  /**
   * Whether to show token usage
   * @default false
   */
  showTokenUsage: boolean

  /**
   * Whether to show cost information
   * @default false
   */
  showCost: boolean

  /**
   * Whether to show stage labels
   * @default true
   */
  showStages: boolean

  /**
   * Whether to animate status transitions
   * @default true
   */
  animated: boolean

  /**
   * Auto-refresh interval in milliseconds (0 = disabled)
   * @default 1000
   */
  refreshIntervalMs: number

  /**
   * Custom color configuration
   */
  colors?: Partial<ParallelAgentViewColorConfig>
}

// ============================================================================
// Props Interface
// ============================================================================

/**
 * Props for the ParallelAgentView component
 */
export interface ParallelAgentViewProps {
  /**
   * Parallel agent view data to display
   */
  data: ParallelAgentViewData

  /**
   * Configuration options
   */
  config?: Partial<ParallelAgentViewConfig>

  /**
   * Callback when an agent execution is clicked
   */
  onAgentClick?: (execution: AgentExecution) => void

  /**
   * Callback when an agent execution is hovered
   */
  onAgentHover?: (execution: AgentExecution | null) => void

  /**
   * Callback when a lane header is clicked
   */
  onLaneClick?: (lane: AgentLane) => void

  /**
   * Callback when a lane collapse toggle is clicked
   */
  onLaneToggle?: (laneId: string, collapsed: boolean) => void

  /**
   * Callback when an agent is paused
   */
  onAgentPause?: (executionId: string) => void

  /**
   * Callback when an agent is resumed
   */
  onAgentResume?: (executionId: string) => void

  /**
   * Callback when an agent is cancelled
   */
  onAgentCancel?: (executionId: string) => void

  /**
   * Callback when an agent is retried
   */
  onAgentRetry?: (executionId: string) => void

  /**
   * Whether the view is in a loading state
   * @default false
   */
  loading?: boolean

  /**
   * Error message to display
   */
  error?: string | null

  /**
   * Custom CSS class name
   */
  className?: string

  /**
   * Empty state message when no agents are present
   * @default 'No parallel agents currently active'
   */
  emptyMessage?: string

  /**
   * Test ID for testing purposes
   */
  testId?: string
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Processed agent execution data ready for rendering
 */
export interface ProcessedAgentExecution extends AgentExecution {
  /**
   * Formatted elapsed time string
   */
  elapsedTimeDisplay: string

  /**
   * Formatted progress string
   */
  progressDisplay: string

  /**
   * Assigned display color
   */
  color: string

  /**
   * Truncated task description for display
   */
  truncatedDescription: string

  /**
   * Status icon character
   */
  statusIcon: string
}

/**
 * Tooltip data for agent execution hover
 */
export interface AgentExecutionTooltipData {
  /**
   * The execution being hovered
   */
  execution: AgentExecution

  /**
   * Tooltip position
   */
  position: { x: number; y: number }

  /**
   * Whether the tooltip is visible
   */
  visible: boolean
}

/**
 * Summary statistics for parallel executions
 */
export interface ParallelExecutionSummary {
  /**
   * Total number of lanes
   */
  laneCount: number

  /**
   * Total number of executions
   */
  executionCount: number

  /**
   * Counts by status
   */
  statusCounts: Record<AgentExecutionStatus, number>

  /**
   * Average progress across all running executions
   */
  averageProgress: number

  /**
   * Total execution duration in milliseconds
   */
  totalDurationMs: number

  /**
   * Number of currently running executions
   */
  activeCount: number

  /**
   * Success rate (completed / (completed + failed))
   */
  successRate: number
}

/**
 * Size configuration for different view sizes
 */
export interface ParallelAgentViewSizeConfig {
  /**
   * Card width in pixels
   */
  cardWidth: number

  /**
   * Card height in pixels
   */
  cardHeight: number

  /**
   * Lane header height in pixels
   */
  laneHeaderHeight: number

  /**
   * Spacing between cards in pixels
   */
  cardSpacing: number

  /**
   * Spacing between lanes in pixels
   */
  laneSpacing: number

  /**
   * Font size in pixels
   */
  fontSize: number

  /**
   * Progress bar height in pixels
   */
  progressBarHeight: number
}

// ============================================================================
// Default Values and Constants
// ============================================================================

/**
 * Default color configuration for parallel agent view
 */
export const DEFAULT_PARALLEL_AGENT_VIEW_COLORS: ParallelAgentViewColorConfig = {
  idle: 'var(--color-gray-500)',
  queued: 'var(--color-apex-400)',
  running: 'var(--color-apex-500)',
  paused: 'var(--color-yellow-500)',
  completed: 'var(--color-green-500)',
  failed: 'var(--color-red-500)',
  cancelled: 'var(--color-gray-400)',
  laneColors: [
    'var(--color-apex-500)',
    'var(--color-apex-600)',
    'var(--color-apex-700)',
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#f97316', // orange
    '#14b8a6', // teal
    '#06b6d4', // cyan
  ],
}

/**
 * Default configuration for parallel agent view
 */
export const DEFAULT_PARALLEL_AGENT_VIEW_CONFIG: ParallelAgentViewConfig = {
  layout: 'lanes',
  size: 'md',
  sortBy: 'startTime',
  sortDirection: 'asc',
  maxLanes: 6,
  maxAgentsPerLane: 10,
  showProgress: true,
  showElapsedTime: true,
  showTokenUsage: false,
  showCost: false,
  showStages: true,
  animated: true,
  refreshIntervalMs: 1000,
}

/**
 * Default props for ParallelAgentView
 */
export const DEFAULT_PARALLEL_AGENT_VIEW_PROPS: Required<
  Pick<
    ParallelAgentViewProps,
    'loading' | 'emptyMessage'
  >
> = {
  loading: false,
  emptyMessage: 'No parallel agents currently active',
}

/**
 * Size configurations for different view sizes
 */
export const PARALLEL_AGENT_VIEW_SIZES: Record<ParallelAgentViewSize, ParallelAgentViewSizeConfig> = {
  sm: {
    cardWidth: 180,
    cardHeight: 80,
    laneHeaderHeight: 32,
    cardSpacing: 8,
    laneSpacing: 12,
    fontSize: 11,
    progressBarHeight: 4,
  },
  md: {
    cardWidth: 240,
    cardHeight: 100,
    laneHeaderHeight: 40,
    cardSpacing: 12,
    laneSpacing: 16,
    fontSize: 13,
    progressBarHeight: 6,
  },
  lg: {
    cardWidth: 320,
    cardHeight: 120,
    laneHeaderHeight: 48,
    cardSpacing: 16,
    laneSpacing: 20,
    fontSize: 14,
    progressBarHeight: 8,
  },
}

/**
 * Empty parallel agent view data
 */
export const EMPTY_PARALLEL_AGENT_VIEW_DATA: ParallelAgentViewData = {
  lanes: [],
  totalExecutions: 0,
  runningCount: 0,
  completedCount: 0,
  failedCount: 0,
  overallProgress: 0,
  totalTokensUsed: 0,
  totalEstimatedCost: 0,
  lastUpdated: new Date(),
}

/**
 * Status icons for each execution status
 */
export const AGENT_EXECUTION_STATUS_ICONS: Record<AgentExecutionStatus, string> = {
  idle: '○',
  queued: '◎',
  running: '⚡',
  paused: '⏸',
  completed: '✓',
  failed: '✗',
  cancelled: '⊘',
}

/**
 * Status labels for display
 */
export const AGENT_EXECUTION_STATUS_LABELS: Record<AgentExecutionStatus, string> = {
  idle: 'Idle',
  queued: 'Queued',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

/**
 * Status styling for UI components (Tailwind classes)
 */
export const AGENT_EXECUTION_STATUS_STYLES = {
  idle: {
    bg: 'bg-gray-950/50',
    text: 'text-gray-400',
    border: 'border-gray-800',
    icon: 'text-gray-500',
    dot: 'bg-gray-500',
    glow: 'shadow-gray-500/20',
  },
  queued: {
    bg: 'bg-apex-950/50',
    text: 'text-apex-300',
    border: 'border-apex-800',
    icon: 'text-apex-400',
    dot: 'bg-apex-400',
    glow: 'shadow-apex-500/20',
  },
  running: {
    bg: 'bg-apex-950/50',
    text: 'text-apex-400',
    border: 'border-apex-700',
    icon: 'text-apex-500',
    dot: 'bg-apex-500',
    glow: 'shadow-apex-500/30',
  },
  paused: {
    bg: 'bg-yellow-950/50',
    text: 'text-yellow-400',
    border: 'border-yellow-800',
    icon: 'text-yellow-500',
    dot: 'bg-yellow-500',
    glow: 'shadow-yellow-500/20',
  },
  completed: {
    bg: 'bg-green-950/50',
    text: 'text-green-400',
    border: 'border-green-800',
    icon: 'text-green-500',
    dot: 'bg-green-500',
    glow: 'shadow-green-500/20',
  },
  failed: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-800',
    icon: 'text-red-500',
    dot: 'bg-red-500',
    glow: 'shadow-red-500/20',
  },
  cancelled: {
    bg: 'bg-gray-950/50',
    text: 'text-gray-400',
    border: 'border-gray-700',
    icon: 'text-gray-400',
    dot: 'bg-gray-400',
    glow: 'shadow-gray-500/10',
  },
} as const

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate summary statistics from parallel agent view data
 *
 * @param data - The parallel agent view data to summarize
 * @returns Summary statistics for the parallel execution
 */
export function calculateParallelExecutionSummary(data: ParallelAgentViewData): ParallelExecutionSummary {
  const allExecutions = data.lanes.flatMap(lane => lane.executions)

  const statusCounts: Record<AgentExecutionStatus, number> = {
    idle: 0,
    queued: 0,
    running: 0,
    paused: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  }

  let totalProgress = 0
  let runningCount = 0
  let totalDurationMs = 0

  for (const execution of allExecutions) {
    statusCounts[execution.status]++

    if (execution.status === 'running') {
      totalProgress += execution.progress
      runningCount++
    }

    if (execution.durationMs !== undefined) {
      totalDurationMs += execution.durationMs
    }
  }

  const completedAndFailed = statusCounts.completed + statusCounts.failed
  const successRate = completedAndFailed > 0
    ? statusCounts.completed / completedAndFailed
    : 0

  return {
    laneCount: data.lanes.length,
    executionCount: allExecutions.length,
    statusCounts,
    averageProgress: runningCount > 0 ? totalProgress / runningCount : 0,
    totalDurationMs,
    activeCount: statusCounts.running + statusCounts.queued,
    successRate,
  }
}

/**
 * Format elapsed time in human-readable format
 *
 * @param startedAt - Start time of the execution
 * @param completedAt - End time (optional, uses current time if not provided)
 * @returns Formatted elapsed time string
 */
export function formatElapsedTime(startedAt: Date | undefined, completedAt?: Date): string {
  if (!startedAt) return 'N/A'

  const endTime = completedAt || new Date()
  const elapsedMs = endTime.getTime() - startedAt.getTime()

  if (elapsedMs < 0) return '0s'

  const seconds = Math.floor(elapsedMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  return `${seconds}s`
}

/**
 * Truncate description for display
 *
 * @param description - Description to truncate
 * @param maxLength - Maximum length (default: 40)
 * @returns Truncated description
 */
export function truncateAgentDescription(description: string | undefined | null, maxLength: number = 40): string {
  if (!description || typeof description !== 'string') {
    return 'No description'
  }

  if (description.length <= maxLength) {
    return description
  }

  return `${description.substring(0, maxLength - 3)}...`
}

/**
 * Get status color from configuration
 *
 * @param status - The execution status
 * @param colors - Color configuration (optional)
 * @returns CSS color value
 */
export function getStatusColor(
  status: AgentExecutionStatus,
  colors: Partial<ParallelAgentViewColorConfig> = {}
): string {
  const mergedColors = { ...DEFAULT_PARALLEL_AGENT_VIEW_COLORS, ...colors }
  return mergedColors[status]
}

/**
 * Sort executions by the specified criteria
 *
 * @param executions - Executions to sort
 * @param sortBy - Sort criteria
 * @param direction - Sort direction
 * @returns Sorted executions array (new array, does not mutate input)
 */
export function sortAgentExecutions(
  executions: AgentExecution[],
  sortBy: AgentSortCriteria,
  direction: AgentSortDirection
): AgentExecution[] {
  const sorted = [...executions]

  sorted.sort((a, b) => {
    let comparison = 0

    switch (sortBy) {
      case 'name':
        comparison = a.agentName.localeCompare(b.agentName)
        break
      case 'status': {
        const statusOrder: AgentExecutionStatus[] = [
          'running', 'queued', 'paused', 'idle', 'completed', 'failed', 'cancelled'
        ]
        comparison = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)
        break
      }
      case 'progress':
        comparison = a.progress - b.progress
        break
      case 'startTime':
        if (!a.startedAt && !b.startedAt) comparison = 0
        else if (!a.startedAt) comparison = 1
        else if (!b.startedAt) comparison = -1
        else comparison = a.startedAt.getTime() - b.startedAt.getTime()
        break
      case 'duration':
        comparison = (a.durationMs ?? 0) - (b.durationMs ?? 0)
        break
    }

    return direction === 'asc' ? comparison : -comparison
  })

  return sorted
}
