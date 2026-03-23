/**
 * Changelog Components - Export Index
 *
 * Centralized exports for the Automated Changelog Display component system.
 */

export { ChangelogDisplay } from './ChangelogDisplay'
export { ChangelogEntry } from './ChangelogEntry'
export { ChangelogFilters } from './ChangelogFilters'
export { ChangelogDiffPreview } from './ChangelogDiffPreview'

// Re-export constants for external use
export {
  STATUS_STYLES,
  CHANGE_TYPE_STYLES,
  DEFAULT_CHANGELOG_CONFIG,
  FILTER_PRESETS,
  A11Y_LABELS,
} from './constants'

// Re-export types for convenience
export type {
  ChangelogDisplayProps,
  ChangelogEntryProps,
  ChangelogFiltersProps,
  ChangelogDiffPreviewProps,
} from '@/types/changelog'