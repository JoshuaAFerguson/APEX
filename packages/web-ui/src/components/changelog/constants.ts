/**
 * Constants for Changelog Display Components
 *
 * Defines styling configurations, default values, and status mappings
 * following established patterns from other APEX components.
 */

import { CheckCircle, XCircle, MinusCircle, FileText, FileDiff, FileX, FilePlus } from 'lucide-react'

/**
 * Status-based styling following existing patterns
 */
export const STATUS_STYLES = {
  completed: {
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    badge: 'bg-green-500/20 text-green-400',
  },
  failed: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    badge: 'bg-red-500/20 text-red-400',
  },
  cancelled: {
    icon: MinusCircle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    badge: 'bg-yellow-500/20 text-yellow-400',
  },
} as const

/**
 * File change type styling
 */
export const CHANGE_TYPE_STYLES = {
  added: {
    icon: FilePlus,
    color: 'text-green-500',
    prefix: '+',
    badge: 'bg-green-500/20 text-green-400',
  },
  modified: {
    icon: FileDiff,
    color: 'text-blue-500',
    prefix: '~',
    badge: 'bg-blue-500/20 text-blue-400',
  },
  deleted: {
    icon: FileX,
    color: 'text-red-500',
    prefix: '-',
    badge: 'bg-red-500/20 text-red-400',
  },
  renamed: {
    icon: FileText,
    color: 'text-purple-500',
    prefix: '→',
    badge: 'bg-purple-500/20 text-purple-400',
  },
} as const

/**
 * Default component configuration
 */
export const DEFAULT_CHANGELOG_CONFIG = {
  /** Maximum entries to show initially */
  maxEntries: 20,
  /** Default page size for pagination */
  pageSize: 10,
  /** Maximum height for scrollable container */
  maxHeight: 600,
  /** Auto-refresh interval in ms (0 = disabled) */
  refreshInterval: 0,
  /** Default empty state message */
  emptyMessage: 'No changelog entries found',
  /** Default title */
  title: 'Changelog',
} as const

/**
 * Filter preset configurations
 */
export const FILTER_PRESETS = {
  last7Days: {
    label: 'Last 7 days',
    startDate: () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    endDate: () => new Date(),
  },
  last30Days: {
    label: 'Last 30 days',
    startDate: () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: () => new Date(),
  },
  lastWeek: {
    label: 'Last week',
    startDate: () => {
      const date = new Date()
      const day = date.getDay()
      const diff = date.getDate() - day + (day === 0 ? -6 : 1) - 7 // Previous Monday
      return new Date(date.setDate(diff))
    },
    endDate: () => {
      const date = new Date()
      const day = date.getDay()
      const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Monday
      return new Date(date.setDate(diff))
    },
  },
  lastMonth: {
    label: 'Last month',
    startDate: () => {
      const date = new Date()
      date.setMonth(date.getMonth() - 1, 1)
      return date
    },
    endDate: () => {
      const date = new Date()
      date.setDate(0) // Last day of previous month
      return date
    },
  },
} as const

/**
 * Animation and transition settings
 */
export const ANIMATION_CONFIG = {
  /** Duration for expand/collapse animations */
  expandDuration: 200,
  /** Easing function for animations */
  easing: 'ease-in-out',
  /** Stagger delay for list animations */
  staggerDelay: 50,
} as const

/**
 * Accessibility labels and descriptions
 */
export const A11Y_LABELS = {
  expandEntry: 'Expand changelog entry to show file changes',
  collapseEntry: 'Collapse changelog entry to hide file changes',
  statusIcon: (status: string) => `Task status: ${status}`,
  fileChangeIcon: (type: string) => `File change type: ${type}`,
  diffStats: (added: number, removed: number) =>
    `${added} additions, ${removed} deletions`,
  timeAgo: (time: string) => `Completed ${time} ago`,
  filterBy: (type: string) => `Filter by ${type}`,
  clearFilters: 'Clear all filters',
  loadMore: 'Load more changelog entries',
} as const

export type ChangelogStatus = keyof typeof STATUS_STYLES
export type ChangelogChangeType = keyof typeof CHANGE_TYPE_STYLES