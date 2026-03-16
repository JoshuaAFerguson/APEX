/**
 * Execution Timeline Types
 *
 * Type definitions for the ExecutionTimeline component which provides
 * Visual Kanban execution timeline visualization. Shows agent execution
 * history over time with segments representing different execution phases,
 * events marking key milestones, and configurable display options.
 *
 * @packageDocumentation
 */

// ============================================================================
// Core Enums and Type Unions
// ============================================================================

/**
 * Type of timeline event marking key execution milestones
 *
 * @remarks
 * - `start` - Execution started
 * - `complete` - Execution completed successfully
 * - `error` - An error occurred during execution
 * - `warning` - A warning was raised during execution
 * - `checkpoint` - A checkpoint or milestone was reached
 * - `user_action` - User intervention occurred (approval, pause, etc.)
 * - `stage_change` - Agent transitioned to a new execution stage
 * - `dependency_resolved` - A task dependency was resolved
 */
export type TimelineEventType =
  | 'start'
  | 'complete'
  | 'error'
  | 'warning'
  | 'checkpoint'
  | 'user_action'
  | 'stage_change'
  | 'dependency_resolved'

/**
 * Type of timeline segment representing execution phases
 *
 * @remarks
 * - `planning` - Agent is planning the implementation approach
 * - `executing` - Agent is actively executing work
 * - `waiting` - Agent is waiting for dependencies or resources
 * - `reviewing` - Agent is reviewing or validating work
 * - `paused` - Execution is temporarily paused
 * - `idle` - Agent is idle between tasks
 * - `error` - Segment represents an error state
 */
export type TimelineSegmentType =
  | 'planning'
  | 'executing'
  | 'waiting'
  | 'reviewing'
  | 'paused'
  | 'idle'
  | 'error'

/**
 * Time scale for the timeline display
 *
 * @remarks
 * - `seconds` - Show individual seconds (for short executions)
 * - `minutes` - Show minute increments
 * - `hours` - Show hour increments
 * - `auto` - Automatically determine scale based on duration
 */
export type TimelineScale = 'seconds' | 'minutes' | 'hours' | 'auto'

/**
 * Layout orientation for the timeline
 *
 * @remarks
 * - `horizontal` - Timeline flows left to right
 * - `vertical` - Timeline flows top to bottom
 */
export type TimelineOrientation = 'horizontal' | 'vertical'

/**
 * Size variant for timeline component
 */
export type TimelineSize = 'sm' | 'md' | 'lg'

/**
 * Zoom level presets for the timeline
 */
export type TimelineZoomLevel = 'fit' | '50%' | '100%' | '150%' | '200%'

// ============================================================================
// Core Data Types
// ============================================================================

/**
 * Represents a single event marker on the timeline
 *
 * @remarks
 * Events mark specific points in time during execution, such as
 * starts, completions, errors, or user actions.
 */
export interface TimelineEvent {
  /**
   * Unique identifier for this event
   */
  id: string

  /**
   * Type of event
   */
  type: TimelineEventType

  /**
   * Timestamp when the event occurred
   */
  timestamp: Date

  /**
   * Human-readable label for the event
   */
  label: string

  /**
   * Optional detailed description of the event
   */
  description?: string

  /**
   * Associated task ID (if applicable)
   */
  taskId?: string

  /**
   * Associated agent ID (if applicable)
   */
  agentId?: string

  /**
   * Error message (for error events)
   */
  error?: string | null

  /**
   * Custom metadata for the event
   */
  metadata?: Record<string, unknown>
}

/**
 * Represents a time segment on the timeline showing a phase of execution
 *
 * @remarks
 * Segments represent continuous periods of a specific execution phase,
 * displayed as colored bars on the timeline.
 */
export interface TimelineSegment {
  /**
   * Unique identifier for this segment
   */
  id: string

  /**
   * Type of segment (execution phase)
   */
  type: TimelineSegmentType

  /**
   * Start timestamp of the segment
   */
  startTime: Date

  /**
   * End timestamp of the segment (undefined if ongoing)
   */
  endTime?: Date

  /**
   * Human-readable label for the segment
   */
  label: string

  /**
   * Optional detailed description
   */
  description?: string

  /**
   * Progress within this segment (0-100, for partial completion)
   */
  progress?: number

  /**
   * Associated task ID
   */
  taskId?: string

  /**
   * Associated agent ID
   */
  agentId?: string

  /**
   * Agent name for display
   */
  agentName?: string

  /**
   * Whether this segment is currently active
   */
  isActive?: boolean

  /**
   * Custom color override (CSS color value)
   */
  color?: string

  /**
   * Custom metadata for the segment
   */
  metadata?: Record<string, unknown>
}

/**
 * Represents a complete execution timeline with events and segments
 *
 * @remarks
 * The ExecutionTimeline aggregates all timeline data for visualization,
 * including segments representing execution phases and events marking
 * key milestones.
 */
export interface ExecutionTimeline {
  /**
   * Unique identifier for this timeline
   */
  id: string

  /**
   * Human-readable title for the timeline
   */
  title: string

  /**
   * Optional description of the timeline
   */
  description?: string

  /**
   * Start time of the timeline (earliest point)
   */
  startTime: Date

  /**
   * End time of the timeline (latest point, undefined if ongoing)
   */
  endTime?: Date

  /**
   * Total duration in milliseconds
   */
  durationMs: number

  /**
   * Timeline segments representing execution phases
   */
  segments: TimelineSegment[]

  /**
   * Timeline events marking key milestones
   */
  events: TimelineEvent[]

  /**
   * Number of agents represented in this timeline
   */
  agentCount: number

  /**
   * Number of tasks represented in this timeline
   */
  taskCount: number

  /**
   * Whether the timeline is currently active (has ongoing segments)
   */
  isActive: boolean

  /**
   * Associated project or workflow ID
   */
  projectId?: string

  /**
   * Timestamp when timeline data was last updated
   */
  lastUpdated: Date

  /**
   * Custom metadata for the timeline
   */
  metadata?: Record<string, unknown>
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Color configuration for timeline segments by type
 */
export interface TimelineSegmentColorConfig {
  /**
   * Color for planning segments
   */
  planning: string

  /**
   * Color for executing segments
   */
  executing: string

  /**
   * Color for waiting segments
   */
  waiting: string

  /**
   * Color for reviewing segments
   */
  reviewing: string

  /**
   * Color for paused segments
   */
  paused: string

  /**
   * Color for idle segments
   */
  idle: string

  /**
   * Color for error segments
   */
  error: string
}

/**
 * Color configuration for timeline events by type
 */
export interface TimelineEventColorConfig {
  /**
   * Color for start events
   */
  start: string

  /**
   * Color for complete events
   */
  complete: string

  /**
   * Color for error events
   */
  error: string

  /**
   * Color for warning events
   */
  warning: string

  /**
   * Color for checkpoint events
   */
  checkpoint: string

  /**
   * Color for user action events
   */
  user_action: string

  /**
   * Color for stage change events
   */
  stage_change: string

  /**
   * Color for dependency resolved events
   */
  dependency_resolved: string
}

/**
 * Configuration options for the execution timeline
 */
export interface ExecutionTimelineConfig {
  /**
   * Time scale for the timeline display
   * @default 'auto'
   */
  scale: TimelineScale

  /**
   * Layout orientation
   * @default 'horizontal'
   */
  orientation: TimelineOrientation

  /**
   * Size variant
   * @default 'md'
   */
  size: TimelineSize

  /**
   * Zoom level
   * @default '100%'
   */
  zoomLevel: TimelineZoomLevel

  /**
   * Whether to show event markers
   * @default true
   */
  showEvents: boolean

  /**
   * Whether to show segment labels
   * @default true
   */
  showLabels: boolean

  /**
   * Whether to show time axis
   * @default true
   */
  showTimeAxis: boolean

  /**
   * Whether to show tooltips on hover
   * @default true
   */
  showTooltips: boolean

  /**
   * Whether to show grid lines
   * @default true
   */
  showGrid: boolean

  /**
   * Whether to show duration labels
   * @default true
   */
  showDurations: boolean

  /**
   * Whether to animate segment transitions
   * @default true
   */
  animated: boolean

  /**
   * Whether to enable interactive features (hover, click)
   * @default true
   */
  interactive: boolean

  /**
   * Auto-refresh interval in milliseconds (0 = disabled)
   * @default 1000
   */
  refreshIntervalMs: number

  /**
   * Minimum segment width in pixels
   * @default 20
   */
  minSegmentWidth: number

  /**
   * Custom segment color configuration
   */
  segmentColors?: Partial<TimelineSegmentColorConfig>

  /**
   * Custom event color configuration
   */
  eventColors?: Partial<TimelineEventColorConfig>
}

// ============================================================================
// Props Interface
// ============================================================================

/**
 * Props for the ExecutionTimeline component
 */
export interface ExecutionTimelineProps {
  /**
   * Timeline data to display
   */
  data: ExecutionTimeline

  /**
   * Configuration options
   */
  config?: Partial<ExecutionTimelineConfig>

  /**
   * Callback when a segment is clicked
   */
  onSegmentClick?: (segment: TimelineSegment) => void

  /**
   * Callback when a segment is hovered
   */
  onSegmentHover?: (segment: TimelineSegment | null) => void

  /**
   * Callback when an event marker is clicked
   */
  onEventClick?: (event: TimelineEvent) => void

  /**
   * Callback when an event marker is hovered
   */
  onEventHover?: (event: TimelineEvent | null) => void

  /**
   * Callback when zoom level changes
   */
  onZoomChange?: (zoomLevel: TimelineZoomLevel) => void

  /**
   * Callback when a time range is selected (for filtering)
   */
  onTimeRangeSelect?: (startTime: Date, endTime: Date) => void

  /**
   * Whether the component is in a loading state
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
   * Empty state message when no data is present
   * @default 'No execution timeline data available'
   */
  emptyMessage?: string

  /**
   * Height of the timeline container
   * @default 200
   */
  height?: number | string

  /**
   * Width of the timeline container
   * @default '100%'
   */
  width?: number | string

  /**
   * Test ID for testing purposes
   */
  testId?: string
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Processed segment data ready for rendering
 */
export interface ProcessedTimelineSegment extends TimelineSegment {
  /**
   * Calculated width in pixels
   */
  width: number

  /**
   * Calculated left/top offset in pixels
   */
  offset: number

  /**
   * Calculated duration in milliseconds
   */
  calculatedDurationMs: number

  /**
   * Formatted duration string for display
   */
  durationDisplay: string

  /**
   * Assigned display color
   */
  displayColor: string

  /**
   * Truncated label for compact display
   */
  truncatedLabel: string
}

/**
 * Processed event data ready for rendering
 */
export interface ProcessedTimelineEvent extends TimelineEvent {
  /**
   * Calculated position in pixels
   */
  position: number

  /**
   * Assigned display color
   */
  displayColor: string

  /**
   * Icon character for the event type
   */
  icon: string

  /**
   * Formatted timestamp string
   */
  timestampDisplay: string
}

/**
 * Tooltip data for segment hover
 */
export interface TimelineSegmentTooltipData {
  /**
   * The segment being hovered
   */
  segment: TimelineSegment

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
 * Tooltip data for event hover
 */
export interface TimelineEventTooltipData {
  /**
   * The event being hovered
   */
  event: TimelineEvent

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
 * Summary statistics for an execution timeline
 */
export interface ExecutionTimelineSummary {
  /**
   * Total number of segments
   */
  segmentCount: number

  /**
   * Total number of events
   */
  eventCount: number

  /**
   * Counts by segment type
   */
  segmentTypeCounts: Record<TimelineSegmentType, number>

  /**
   * Counts by event type
   */
  eventTypeCounts: Record<TimelineEventType, number>

  /**
   * Total duration in milliseconds
   */
  totalDurationMs: number

  /**
   * Active time (excluding idle/paused) in milliseconds
   */
  activeTimeMs: number

  /**
   * Idle time in milliseconds
   */
  idleTimeMs: number

  /**
   * Efficiency ratio (active time / total time)
   */
  efficiencyRatio: number

  /**
   * Number of errors encountered
   */
  errorCount: number

  /**
   * Average segment duration in milliseconds
   */
  averageSegmentDurationMs: number
}

/**
 * Size configuration for different timeline sizes
 */
export interface TimelineSizeConfig {
  /**
   * Track height in pixels
   */
  trackHeight: number

  /**
   * Event marker size in pixels
   */
  eventMarkerSize: number

  /**
   * Label font size in pixels
   */
  labelFontSize: number

  /**
   * Time axis height in pixels
   */
  timeAxisHeight: number

  /**
   * Padding between tracks in pixels
   */
  trackPadding: number

  /**
   * Minimum segment width in pixels
   */
  minSegmentWidth: number
}

// ============================================================================
// Default Values and Constants
// ============================================================================

/**
 * Default color configuration for timeline segments
 */
export const DEFAULT_TIMELINE_SEGMENT_COLORS: TimelineSegmentColorConfig = {
  planning: 'var(--color-apex-400)',
  executing: 'var(--color-apex-500)',
  waiting: 'var(--color-yellow-500)',
  reviewing: 'var(--color-purple-500)',
  paused: 'var(--color-gray-500)',
  idle: 'var(--color-gray-400)',
  error: 'var(--color-red-500)',
}

/**
 * Default color configuration for timeline events
 */
export const DEFAULT_TIMELINE_EVENT_COLORS: TimelineEventColorConfig = {
  start: 'var(--color-green-500)',
  complete: 'var(--color-green-600)',
  error: 'var(--color-red-500)',
  warning: 'var(--color-yellow-500)',
  checkpoint: 'var(--color-apex-500)',
  user_action: 'var(--color-purple-500)',
  stage_change: 'var(--color-apex-400)',
  dependency_resolved: 'var(--color-teal-500)',
}

/**
 * Default configuration for execution timeline
 */
export const DEFAULT_EXECUTION_TIMELINE_CONFIG: ExecutionTimelineConfig = {
  scale: 'auto',
  orientation: 'horizontal',
  size: 'md',
  zoomLevel: '100%',
  showEvents: true,
  showLabels: true,
  showTimeAxis: true,
  showTooltips: true,
  showGrid: true,
  showDurations: true,
  animated: true,
  interactive: true,
  refreshIntervalMs: 1000,
  minSegmentWidth: 20,
}

/**
 * Default props for ExecutionTimeline component
 */
export const DEFAULT_EXECUTION_TIMELINE_PROPS: Required<
  Pick<
    ExecutionTimelineProps,
    'loading' | 'emptyMessage' | 'height' | 'width'
  >
> = {
  loading: false,
  emptyMessage: 'No execution timeline data available',
  height: 200,
  width: '100%',
}

/**
 * Size configurations for different timeline sizes
 */
export const TIMELINE_SIZE_CONFIGS: Record<TimelineSize, TimelineSizeConfig> = {
  sm: {
    trackHeight: 24,
    eventMarkerSize: 8,
    labelFontSize: 10,
    timeAxisHeight: 20,
    trackPadding: 4,
    minSegmentWidth: 16,
  },
  md: {
    trackHeight: 32,
    eventMarkerSize: 12,
    labelFontSize: 12,
    timeAxisHeight: 28,
    trackPadding: 8,
    minSegmentWidth: 20,
  },
  lg: {
    trackHeight: 48,
    eventMarkerSize: 16,
    labelFontSize: 14,
    timeAxisHeight: 36,
    trackPadding: 12,
    minSegmentWidth: 24,
  },
}

/**
 * Empty execution timeline data
 */
export const EMPTY_EXECUTION_TIMELINE: ExecutionTimeline = {
  id: '',
  title: '',
  startTime: new Date(),
  durationMs: 0,
  segments: [],
  events: [],
  agentCount: 0,
  taskCount: 0,
  isActive: false,
  lastUpdated: new Date(),
}

/**
 * Icons for each event type
 */
export const TIMELINE_EVENT_ICONS: Record<TimelineEventType, string> = {
  start: '▶',
  complete: '✓',
  error: '✗',
  warning: '⚠',
  checkpoint: '◆',
  user_action: '👤',
  stage_change: '→',
  dependency_resolved: '🔗',
}

/**
 * Labels for each event type
 */
export const TIMELINE_EVENT_LABELS: Record<TimelineEventType, string> = {
  start: 'Started',
  complete: 'Completed',
  error: 'Error',
  warning: 'Warning',
  checkpoint: 'Checkpoint',
  user_action: 'User Action',
  stage_change: 'Stage Change',
  dependency_resolved: 'Dependency Resolved',
}

/**
 * Labels for each segment type
 */
export const TIMELINE_SEGMENT_LABELS: Record<TimelineSegmentType, string> = {
  planning: 'Planning',
  executing: 'Executing',
  waiting: 'Waiting',
  reviewing: 'Reviewing',
  paused: 'Paused',
  idle: 'Idle',
  error: 'Error',
}

/**
 * Styling classes for segment types (Tailwind classes)
 */
export const TIMELINE_SEGMENT_STYLES = {
  planning: {
    bg: 'bg-apex-400/80',
    text: 'text-apex-100',
    border: 'border-apex-500',
    hoverBg: 'hover:bg-apex-400',
  },
  executing: {
    bg: 'bg-apex-500/80',
    text: 'text-white',
    border: 'border-apex-600',
    hoverBg: 'hover:bg-apex-500',
  },
  waiting: {
    bg: 'bg-yellow-500/80',
    text: 'text-yellow-900',
    border: 'border-yellow-600',
    hoverBg: 'hover:bg-yellow-500',
  },
  reviewing: {
    bg: 'bg-purple-500/80',
    text: 'text-purple-100',
    border: 'border-purple-600',
    hoverBg: 'hover:bg-purple-500',
  },
  paused: {
    bg: 'bg-gray-500/80',
    text: 'text-gray-100',
    border: 'border-gray-600',
    hoverBg: 'hover:bg-gray-500',
  },
  idle: {
    bg: 'bg-gray-400/50',
    text: 'text-gray-600',
    border: 'border-gray-500',
    hoverBg: 'hover:bg-gray-400',
  },
  error: {
    bg: 'bg-red-500/80',
    text: 'text-red-100',
    border: 'border-red-600',
    hoverBg: 'hover:bg-red-500',
  },
} as const

/**
 * Styling classes for event types (Tailwind classes)
 */
export const TIMELINE_EVENT_STYLES = {
  start: {
    bg: 'bg-green-500',
    text: 'text-green-100',
    border: 'border-green-600',
    ring: 'ring-green-500/30',
  },
  complete: {
    bg: 'bg-green-600',
    text: 'text-green-100',
    border: 'border-green-700',
    ring: 'ring-green-600/30',
  },
  error: {
    bg: 'bg-red-500',
    text: 'text-red-100',
    border: 'border-red-600',
    ring: 'ring-red-500/30',
  },
  warning: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-900',
    border: 'border-yellow-600',
    ring: 'ring-yellow-500/30',
  },
  checkpoint: {
    bg: 'bg-apex-500',
    text: 'text-apex-100',
    border: 'border-apex-600',
    ring: 'ring-apex-500/30',
  },
  user_action: {
    bg: 'bg-purple-500',
    text: 'text-purple-100',
    border: 'border-purple-600',
    ring: 'ring-purple-500/30',
  },
  stage_change: {
    bg: 'bg-apex-400',
    text: 'text-apex-100',
    border: 'border-apex-500',
    ring: 'ring-apex-400/30',
  },
  dependency_resolved: {
    bg: 'bg-teal-500',
    text: 'text-teal-100',
    border: 'border-teal-600',
    ring: 'ring-teal-500/30',
  },
} as const

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate summary statistics from execution timeline data
 *
 * @param timeline - The execution timeline to summarize
 * @returns Summary statistics for the timeline
 */
export function calculateTimelineSummary(timeline: ExecutionTimeline): ExecutionTimelineSummary {
  const segmentTypeCounts: Record<TimelineSegmentType, number> = {
    planning: 0,
    executing: 0,
    waiting: 0,
    reviewing: 0,
    paused: 0,
    idle: 0,
    error: 0,
  }

  const eventTypeCounts: Record<TimelineEventType, number> = {
    start: 0,
    complete: 0,
    error: 0,
    warning: 0,
    checkpoint: 0,
    user_action: 0,
    stage_change: 0,
    dependency_resolved: 0,
  }

  let activeTimeMs = 0
  let idleTimeMs = 0
  let totalSegmentDuration = 0
  let errorCount = 0

  for (const segment of timeline.segments) {
    segmentTypeCounts[segment.type]++

    const segmentDuration = segment.endTime
      ? segment.endTime.getTime() - segment.startTime.getTime()
      : Date.now() - segment.startTime.getTime()

    totalSegmentDuration += segmentDuration

    if (segment.type === 'idle' || segment.type === 'paused') {
      idleTimeMs += segmentDuration
    } else {
      activeTimeMs += segmentDuration
    }

    if (segment.type === 'error') {
      errorCount++
    }
  }

  for (const event of timeline.events) {
    eventTypeCounts[event.type]++
    if (event.type === 'error') {
      errorCount++
    }
  }

  const totalDurationMs = timeline.durationMs || totalSegmentDuration

  return {
    segmentCount: timeline.segments.length,
    eventCount: timeline.events.length,
    segmentTypeCounts,
    eventTypeCounts,
    totalDurationMs,
    activeTimeMs,
    idleTimeMs,
    efficiencyRatio: totalDurationMs > 0 ? activeTimeMs / totalDurationMs : 0,
    errorCount,
    averageSegmentDurationMs: timeline.segments.length > 0
      ? totalSegmentDuration / timeline.segments.length
      : 0,
  }
}

/**
 * Format duration in human-readable format
 *
 * @param durationMs - Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatTimelineDuration(durationMs: number): string {
  if (durationMs < 0) return '0s'

  const seconds = Math.floor(durationMs / 1000)
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

  if (seconds > 0) {
    return `${seconds}s`
  }

  return `${durationMs}ms`
}

/**
 * Format timestamp for timeline display
 *
 * @param timestamp - The timestamp to format
 * @param includeDate - Whether to include the date
 * @returns Formatted timestamp string
 */
export function formatTimelineTimestamp(timestamp: Date, includeDate: boolean = false): string {
  if (!timestamp || isNaN(timestamp.getTime())) {
    return 'N/A'
  }

  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }

  if (includeDate) {
    options.month = 'short'
    options.day = 'numeric'
  }

  return timestamp.toLocaleTimeString('en-US', options)
}

/**
 * Truncate segment label for compact display
 *
 * @param label - Label to truncate
 * @param maxLength - Maximum length
 * @returns Truncated label
 */
export function truncateSegmentLabel(label: string | undefined | null, maxLength: number = 20): string {
  if (!label || typeof label !== 'string') {
    return 'Segment'
  }

  if (label.length <= maxLength) {
    return label
  }

  return `${label.substring(0, maxLength - 3)}...`
}

/**
 * Get segment color from configuration
 *
 * @param segmentType - The segment type
 * @param colors - Custom color configuration
 * @returns CSS color value
 */
export function getSegmentColor(
  segmentType: TimelineSegmentType,
  colors: Partial<TimelineSegmentColorConfig> = {}
): string {
  const mergedColors = { ...DEFAULT_TIMELINE_SEGMENT_COLORS, ...colors }
  return mergedColors[segmentType]
}

/**
 * Get event color from configuration
 *
 * @param eventType - The event type
 * @param colors - Custom color configuration
 * @returns CSS color value
 */
export function getEventColor(
  eventType: TimelineEventType,
  colors: Partial<TimelineEventColorConfig> = {}
): string {
  const mergedColors = { ...DEFAULT_TIMELINE_EVENT_COLORS, ...colors }
  return mergedColors[eventType]
}

/**
 * Determine optimal time scale based on duration
 *
 * @param durationMs - Duration in milliseconds
 * @returns Optimal time scale
 */
export function determineTimeScale(durationMs: number): Exclude<TimelineScale, 'auto'> {
  if (durationMs < 60000) {
    return 'seconds' // Less than 1 minute
  }

  if (durationMs < 3600000) {
    return 'minutes' // Less than 1 hour
  }

  return 'hours'
}

/**
 * Sort segments by start time
 *
 * @param segments - Segments to sort
 * @param direction - Sort direction
 * @returns Sorted segments (new array, does not mutate input)
 */
export function sortSegmentsByTime(
  segments: TimelineSegment[],
  direction: 'asc' | 'desc' = 'asc'
): TimelineSegment[] {
  return [...segments].sort((a, b) => {
    const comparison = a.startTime.getTime() - b.startTime.getTime()
    return direction === 'asc' ? comparison : -comparison
  })
}

/**
 * Sort events by timestamp
 *
 * @param events - Events to sort
 * @param direction - Sort direction
 * @returns Sorted events (new array, does not mutate input)
 */
export function sortEventsByTime(
  events: TimelineEvent[],
  direction: 'asc' | 'desc' = 'asc'
): TimelineEvent[] {
  return [...events].sort((a, b) => {
    const comparison = a.timestamp.getTime() - b.timestamp.getTime()
    return direction === 'asc' ? comparison : -comparison
  })
}

/**
 * Filter segments by time range
 *
 * @param segments - Segments to filter
 * @param startTime - Range start time
 * @param endTime - Range end time
 * @returns Filtered segments
 */
export function filterSegmentsByTimeRange(
  segments: TimelineSegment[],
  startTime: Date,
  endTime: Date
): TimelineSegment[] {
  return segments.filter(segment => {
    const segmentEnd = segment.endTime || new Date()
    return segment.startTime <= endTime && segmentEnd >= startTime
  })
}

/**
 * Filter events by time range
 *
 * @param events - Events to filter
 * @param startTime - Range start time
 * @param endTime - Range end time
 * @returns Filtered events
 */
export function filterEventsByTimeRange(
  events: TimelineEvent[],
  startTime: Date,
  endTime: Date
): TimelineEvent[] {
  return events.filter(event =>
    event.timestamp >= startTime && event.timestamp <= endTime
  )
}
