/**
 * Activity Components Barrel Export
 *
 * Centralized exports for the activity feed components.
 * These components provide real-time WebSocket integration for dashboard activity events.
 *
 * @packageDocumentation
 */

// Main components
export { RecentActivityFeed } from './RecentActivityFeed'
export { ActivityEventItem } from './ActivityEventItem'
export { ActivityEventFilters } from './ActivityEventFilters'
export { ActivityCategoryIcon } from './ActivityCategoryIcon'

// Type exports
export type {
  RecentActivityFeedProps,
  ActivityEventItemProps,
  ActivityCategoryIconProps,
  FilterTab,
  SeverityStyles,
  SeverityStylesMap,
  CategoryIconMap
} from '../../types/activity-feed'