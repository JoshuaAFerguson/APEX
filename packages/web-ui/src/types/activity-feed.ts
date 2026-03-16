/**
 * Activity Feed Types
 *
 * Extended type definitions for the RecentActivityFeed component.
 * These types extend the dashboard types for UI-specific functionality.
 *
 * @packageDocumentation
 */

import type {
  DashboardActivityEvent,
  ActivityEventCategory,
  ActivityEventSeverity,
  ActivityFeedFilters,
} from './dashboard'

/**
 * Props for RecentActivityFeed component
 */
export interface RecentActivityFeedProps {
  /** Array of activity events to display (used when not using real-time updates) */
  events?: DashboardActivityEvent[]

  /** Maximum number of events to display (default: 20 per acceptance criteria) */
  maxEvents?: number

  /** Maximum height of the scrollable area (default: 400) */
  maxHeight?: number | string

  /** Whether to show category filter tabs (default: true) */
  showFilters?: boolean

  /** Whether to enable auto-scroll to newest events (default: true) */
  autoScroll?: boolean

  /** Compact display mode */
  compact?: boolean

  /** Whether to show loading state */
  loading?: boolean

  /** Custom title for the feed */
  title?: string

  /** Whether to use real-time WebSocket updates */
  useRealTimeUpdates?: boolean

  /** Show WebSocket connection indicator in header (default: true) */
  showConnectionIndicator?: boolean

  /** Whether to auto-connect WebSocket on mount (default: true) */
  autoConnect?: boolean

  /** Initial filters to apply */
  initialFilters?: Partial<ActivityFeedFilters>

  /** Callback when event is clicked */
  onEventClick?: (event: DashboardActivityEvent) => void

  /** Callback when event is marked as read */
  onMarkRead?: (eventId: string) => void

  /** Custom className */
  className?: string
}

/**
 * Props for ActivityEventItem component
 */
export interface ActivityEventItemProps {
  /** The event to display */
  event: DashboardActivityEvent

  /** Whether to show the task ID */
  showTaskId?: boolean

  /** Whether to show the timestamp */
  showTimestamp?: boolean

  /** Whether to show the agent/tool name */
  showSource?: boolean

  /** Compact display mode */
  compact?: boolean

  /** Whether the event is read */
  isRead?: boolean

  /** Whether to show the read/unread indicator dot */
  showReadIndicator?: boolean

  /** Callback when event is clicked */
  onClick?: (event: DashboardActivityEvent) => void

  /** Callback when mark as read is clicked */
  onMarkRead?: (eventId: string) => void

  /** Custom className */
  className?: string
}

/**
 * Props for ActivityCategoryIcon component
 */
export interface ActivityCategoryIconProps {
  /** Event category to display icon for */
  category: ActivityEventCategory

  /** Optional className for styling */
  className?: string

  /** Icon size (default: 16) */
  size?: number
}

/**
 * Icon mapping for event categories
 */
export type CategoryIconMap = Record<ActivityEventCategory, React.ComponentType<any>>

/**
 * Filter tab configuration
 */
export interface FilterTab {
  type: ActivityEventCategory | 'all'
  label: string
  icon: React.ComponentType<any>
}

/**
 * Severity styling configuration
 */
export interface SeverityStyles {
  bg: string
  text: string
  border: string
  icon: string
  dot: string
}

/**
 * Severity styles mapping
 */
export type SeverityStylesMap = Record<ActivityEventSeverity, SeverityStyles>