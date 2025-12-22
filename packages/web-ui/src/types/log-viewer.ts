/**
 * LogViewer Component Types
 *
 * Types for the log viewer component with virtualization
 * and filtering capabilities.
 */

import type { TaskLog } from '@apexcli/core'

/**
 * Log level filter options
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Extended log entry with client-side generated ID for React keys
 */
export interface LogEntry extends TaskLog {
  id: string
}

/**
 * Filter configuration for log entries
 */
export interface LogFilter {
  levels: Set<LogLevel>
  searchText: string
  stage: string | null
  agent: string | null
}

/**
 * Internal state for the LogViewer component
 */
export interface LogViewerState {
  logs: LogEntry[]
  filteredLogs: LogEntry[]
  filter: LogFilter
  isAutoScroll: boolean
  selectedLogId: string | null
}

/**
 * Configuration for virtual list rendering
 */
export interface VirtualListConfig {
  /** Height of each log row in pixels */
  itemHeight: number
  /** Number of items to render outside viewport */
  overscan: number
  /** Maximum number of logs to keep in memory */
  bufferSize: number
}

/**
 * Props for the LogViewer component
 */
export interface LogViewerProps {
  /**
   * Initial logs to display
   */
  logs: TaskLog[]

  /**
   * Whether to show real-time streaming indicator
   */
  isStreaming?: boolean

  /**
   * Maximum height of the log viewer (CSS value)
   * @default '400px'
   */
  maxHeight?: string

  /**
   * Whether to enable auto-scroll to bottom on new logs
   * @default true
   */
  autoScroll?: boolean

  /**
   * Callback when user clicks a log entry
   */
  onLogSelect?: (log: LogEntry) => void

  /**
   * Custom class name for styling
   */
  className?: string

  /**
   * Whether to show the filter bar
   * @default true
   */
  showFilters?: boolean

  /**
   * Available stages for filtering (extracted from logs if not provided)
   */
  availableStages?: string[]

  /**
   * Available agents for filtering (extracted from logs if not provided)
   */
  availableAgents?: string[]
}

/**
 * Reducer action types for LogViewer state management
 */
export type LogViewerAction =
  | { type: 'ADD_LOGS'; payload: TaskLog[] }
  | { type: 'SET_FILTER'; payload: Partial<LogFilter> }
  | { type: 'TOGGLE_LEVEL'; payload: LogLevel }
  | { type: 'TOGGLE_AUTO_SCROLL' }
  | { type: 'SET_AUTO_SCROLL'; payload: boolean }
  | { type: 'SELECT_LOG'; payload: string | null }
  | { type: 'CLEAR_LOGS' }

/**
 * Handle for imperative virtual list operations
 */
export interface VirtualListHandle {
  scrollToIndex: (index: number, options?: { align: 'start' | 'center' | 'end' }) => void
  scrollToOffset: (offset: number) => void
  measureElement: (element: HTMLElement) => void
}

/**
 * Props for the LogFilterBar component
 */
export interface LogFilterBarProps {
  filter: LogFilter
  onFilterChange: (filter: Partial<LogFilter>) => void
  availableStages: string[]
  availableAgents: string[]
  logCount: number
  filteredCount: number
}

/**
 * Props for individual log row component
 */
export interface LogRowProps {
  log: LogEntry
  isSelected: boolean
  onClick: () => void
  style?: React.CSSProperties
}
