/**
 * Agent Log Stream Types
 *
 * Type definitions for the AgentTerminalPanel log streaming functionality.
 * Includes AgentLogEntry for individual log records, streaming state management,
 * and the useAgentLogStream hook interfaces.
 *
 * @packageDocumentation
 */

import type { LogFilter } from './log-viewer'
import type { AgentStatus } from './agent-metrics'
import type { WebSocketConnectionStatus } from './websocket-connection'

// Re-export LogLevel for external consumers
export type { LogLevel } from './log-viewer'
import type { LogLevel } from './log-viewer'

// ============================================================================
// Core Log Entry Types
// ============================================================================

/**
 * Source of a log entry
 */
export type LogSource =
  | 'agent' // From agent execution
  | 'system' // System-level events
  | 'user' // User input/commands
  | 'tool' // Tool invocations
  | 'error' // Error/exception output

/**
 * Structured metadata for an agent log entry
 */
export interface AgentLogMetadata {
  /** ID of the agent that generated the log */
  agentId?: string

  /** Human-readable name of the agent */
  agentName?: string

  /** Current execution/task ID this log belongs to */
  executionId?: string

  /** Stage or phase within the workflow */
  stage?: string

  /** Tool name if log is from tool invocation */
  toolName?: string

  /** Duration in milliseconds (for completed operations) */
  durationMs?: number

  /** Token counts if relevant */
  tokens?: {
    input: number
    output: number
    total: number
  }

  /** Cost in USD if relevant */
  cost?: number

  /** Error details if this is an error log */
  error?: {
    code?: string
    message: string
    stack?: string
  }

  /** Additional arbitrary metadata */
  extra?: Record<string, unknown>
}

/**
 * Individual log entry from an agent terminal
 *
 * Represents a single line or block of output from an agent,
 * with full metadata for filtering, grouping, and display.
 */
export interface AgentLogEntry {
  /** Unique identifier for this log entry (for React keys) */
  id: string

  /** Timestamp when the log was generated */
  timestamp: Date

  /** Severity level of the log */
  level: LogLevel

  /** The log message content */
  message: string

  /** Source of the log entry */
  source: LogSource

  /** Structured metadata */
  metadata: AgentLogMetadata

  /** Whether this log entry is part of a streaming sequence */
  isStreaming?: boolean

  /** Parent log ID for grouped/nested logs */
  parentId?: string

  /** Sequence number for ordering within a stream */
  sequenceNumber?: number
}

// ============================================================================
// Streaming State Types
// ============================================================================

/**
 * State of the log stream connection
 */
export type StreamingState =
  | 'idle' // Not streaming, no active connection
  | 'connecting' // Establishing stream connection
  | 'streaming' // Actively receiving logs
  | 'paused' // Stream connected but paused by user
  | 'disconnected' // Was streaming, now disconnected
  | 'error' // Stream encountered an error

/**
 * Current state of a log stream
 */
export interface LogStreamState {
  /** Current streaming state */
  state: StreamingState

  /** WebSocket connection status for the stream */
  connectionStatus: WebSocketConnectionStatus

  /** Whether logs are actively being received */
  isReceiving: boolean

  /** Number of logs received in current session */
  logsReceivedCount: number

  /** Timestamp of last received log */
  lastLogAt: Date | null

  /** Bytes received (for bandwidth monitoring) */
  bytesReceived: number

  /** Stream start time */
  streamStartedAt: Date | null

  /** Error message if in error state */
  error: string | null
}

/**
 * Statistics for the log stream
 */
export interface LogStreamStats {
  /** Total logs received since stream started */
  totalLogs: number

  /** Logs per second (rolling average) */
  logsPerSecond: number

  /** Breakdown by log level */
  byLevel: Record<LogLevel, number>

  /** Breakdown by source */
  bySource: Record<LogSource, number>

  /** Number of error logs */
  errorCount: number

  /** Duration the stream has been active (ms) */
  streamDurationMs: number
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Core props for AgentTerminalPanel component (ADR-0032 compliant)
 *
 * These are the core props required for the three-state architecture.
 */
export interface AgentTerminalPanelCoreProps {
  // Required props
  panelId: string
  agentId: string

  // Display state (controlled pattern)
  panelState: import('./agent-terminal-panel').PanelDisplayState  // 'minimized' | 'normal' | 'maximized'

  // Agent information for header
  title?: string
  agentStatus?: AgentStatus

  // State change callbacks
  onMinimize?: () => void
  onMaximize?: () => void
  onRestore?: () => void

  // Additional panel callbacks
  onClose?: () => void
  onPause?: () => void
  onResume?: () => void
  onClear?: () => void

  // ARIA attributes
  'aria-expanded'?: boolean
  'aria-label'?: string
  tabIndex?: number

  // Styling
  className?: string
  testId?: string
}

/**
 * Props for the AgentTerminalPanel component
 *
 * Displays a terminal-like interface for viewing agent logs
 * with filtering, search, and real-time streaming capabilities.
 */
export interface AgentTerminalPanelProps {
  // === Required Props ===

  /**
   * Unique identifier for this panel instance
   */
  panelId: string

  /**
   * ID of the agent whose logs to display
   */
  agentId: string

  // === Display Props ===

  /**
   * Title to display in the panel header
   * @default agentId or "Agent Terminal"
   */
  title?: string

  /**
   * Current operational status of the agent
   * @default 'idle'
   */
  agentStatus?: AgentStatus

  /**
   * Panel display state (three-state architecture)
   * When provided, uses controlled pattern for panel state
   * @default undefined (uses internal isMinimized for backward compatibility)
   */
  panelState?: import('./agent-terminal-panel').PanelDisplayState

  /**
   * @deprecated Use panelState instead
   * Legacy prop for backward compatibility
   * @default false
   */
  isMinimized?: boolean

  /**
   * Maximum height of the terminal viewport (CSS value)
   * @default '400px'
   */
  maxHeight?: string

  /**
   * Minimum height of the terminal viewport (CSS value)
   * @default '200px'
   */
  minHeight?: string

  // === Streaming Props ===

  /**
   * Whether to auto-connect to the log stream on mount
   * @default true
   */
  autoConnect?: boolean

  /**
   * Whether to automatically scroll to the newest logs
   * @default true
   */
  autoScroll?: boolean

  /**
   * Maximum number of logs to keep in memory
   * @default 1000
   */
  maxLogs?: number

  // === Filter Props ===

  /**
   * Whether to show the filter toolbar
   * @default true
   */
  showFilters?: boolean

  /**
   * Whether to show the search input
   * @default true
   */
  showSearch?: boolean

  /**
   * Initial filter state
   */
  initialFilter?: Partial<LogFilter>

  /**
   * Log levels to show (overrides filter)
   */
  visibleLevels?: LogLevel[]

  // === UI Props ===

  /**
   * Whether to show timestamps on each log line
   * @default true
   */
  showTimestamps?: boolean

  /**
   * Whether to show log level badges
   * @default true
   */
  showLevelBadges?: boolean

  /**
   * Whether to show source badges
   * @default false
   */
  showSourceBadges?: boolean

  /**
   * Whether to wrap long lines
   * @default true
   */
  wrapLines?: boolean

  /**
   * Font size for log content
   * @default 'sm'
   */
  fontSize?: 'xs' | 'sm' | 'md'

  /**
   * Theme variant for the terminal
   * @default 'dark'
   */
  theme?: 'dark' | 'light' | 'system'

  // === Event Callbacks ===

  /**
   * Called when a log entry is selected/clicked
   */
  onLogSelect?: (log: AgentLogEntry) => void

  /**
   * Called when filter changes
   */
  onFilterChange?: (filter: Partial<LogFilter>) => void

  /**
   * Called when streaming state changes
   */
  onStreamStateChange?: (state: StreamingState) => void

  /**
   * Called when an error occurs
   */
  onError?: (error: string) => void

  /**
   * Called when logs are cleared
   */
  onClear?: () => void

  // === Panel State Callbacks ===

  /**
   * Called when panel is minimized
   */
  onMinimize?: () => void

  /**
   * Called when panel is maximized
   */
  onMaximize?: () => void

  /**
   * Called when panel is restored
   */
  onRestore?: () => void

  /**
   * Called when panel is closed
   */
  onClose?: () => void

  /**
   * Called when streaming is paused
   */
  onPause?: () => void

  /**
   * Called when streaming is resumed
   */
  onResume?: () => void

  // === Keyboard Accessibility Props ===

  /**
   * Whether keyboard input is enabled for panel interactions
   *
   * When true, the panel can respond to keyboard events for:
   * - Minimize/maximize/restore operations (Enter/Space, M, Escape, -/+)
   * - Focus management
   * - Custom key bindings
   *
   * @default true
   */
  allowKeyboardInput?: boolean

  // === Styling ===

  /**
   * Additional CSS class name
   */
  className?: string
}

// ============================================================================
// Hook Types
// ============================================================================

/**
 * Options for the useAgentLogStream hook
 */
export interface UseAgentLogStreamOptions {
  /**
   * ID of the agent to stream logs from
   */
  agentId: string

  /**
   * Whether to auto-connect on mount
   * @default true
   */
  autoConnect?: boolean

  /**
   * Maximum number of logs to keep in memory
   * @default 1000
   */
  maxLogs?: number

  /**
   * Filter to apply to incoming logs
   */
  filter?: Partial<LogFilter>

  /**
   * Callback when new logs are received
   */
  onLogs?: (logs: AgentLogEntry[]) => void

  /**
   * Callback when connection state changes
   */
  onConnectionChange?: (status: WebSocketConnectionStatus) => void

  /**
   * Callback when an error occurs
   */
  onError?: (error: string) => void

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean
}

/**
 * Return type for the useAgentLogStream hook
 *
 * Provides access to the log stream data and control methods.
 */
export interface UseAgentLogStreamReturn {
  // === Data ===

  /**
   * Array of log entries from the stream
   */
  logs: AgentLogEntry[]

  /**
   * Filtered logs based on current filter state
   */
  filteredLogs: AgentLogEntry[]

  /**
   * Current filter configuration
   */
  filter: LogFilter

  /**
   * Current streaming state
   */
  streamState: LogStreamState

  /**
   * Stream statistics
   */
  stats: LogStreamStats

  // === Status ===

  /**
   * Whether the initial connection is being established
   */
  isConnecting: boolean

  /**
   * Whether logs are actively being received
   */
  isStreaming: boolean

  /**
   * Whether the stream is paused
   */
  isPaused: boolean

  /**
   * Current error message, if any
   */
  error: string | null

  // === Control Methods ===

  /**
   * Connect to the log stream
   */
  connect: () => void

  /**
   * Disconnect from the log stream
   */
  disconnect: () => void

  /**
   * Pause receiving logs (maintains connection)
   */
  pause: () => void

  /**
   * Resume receiving logs
   */
  resume: () => void

  /**
   * Clear all logs from memory
   */
  clearLogs: () => void

  /**
   * Add logs programmatically (for testing or manual input)
   */
  addLogs: (logs: AgentLogEntry[]) => void

  /**
   * Update the filter
   */
  setFilter: (filter: Partial<LogFilter>) => void

  /**
   * Reset filter to default state
   */
  resetFilter: () => void

  /**
   * Export logs to various formats
   */
  exportLogs: (format: 'json' | 'text' | 'csv') => string

  /**
   * Scroll to a specific log entry
   */
  scrollToLog: (logId: string) => void

  /**
   * Scroll to the bottom of the log list
   */
  scrollToBottom: () => void
}

// ============================================================================
// Reducer Action Types
// ============================================================================

/**
 * Action types for the log stream reducer
 */
export type AgentLogStreamAction =
  | { type: 'ADD_LOGS'; payload: AgentLogEntry[] }
  | { type: 'CLEAR_LOGS' }
  | { type: 'SET_FILTER'; payload: Partial<LogFilter> }
  | { type: 'RESET_FILTER' }
  | { type: 'SET_STREAM_STATE'; payload: Partial<LogStreamState> }
  | { type: 'SET_STREAMING'; payload: StreamingState }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'UPDATE_STATS'; payload: Partial<LogStreamStats> }

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default options for useAgentLogStream hook
 */
export const DEFAULT_AGENT_LOG_STREAM_OPTIONS: Required<
  Pick<UseAgentLogStreamOptions, 'autoConnect' | 'maxLogs' | 'debug'>
> = {
  autoConnect: true,
  maxLogs: 1000,
  debug: false,
}

/**
 * Empty log stream state for initial state
 */
export const EMPTY_LOG_STREAM_STATE: LogStreamState = {
  state: 'idle',
  connectionStatus: 'disconnected',
  isReceiving: false,
  logsReceivedCount: 0,
  lastLogAt: null,
  bytesReceived: 0,
  streamStartedAt: null,
  error: null,
}

/**
 * Empty log stream stats for initial state
 */
export const EMPTY_LOG_STREAM_STATS: LogStreamStats = {
  totalLogs: 0,
  logsPerSecond: 0,
  byLevel: {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  },
  bySource: {
    agent: 0,
    system: 0,
    user: 0,
    tool: 0,
    error: 0,
  },
  errorCount: 0,
  streamDurationMs: 0,
}

/**
 * Default filter state
 */
export const DEFAULT_LOG_FILTER: LogFilter = {
  levels: new Set<LogLevel>(['debug', 'info', 'warn', 'error']),
  searchText: '',
  stage: null,
  agent: null,
}

// ============================================================================
// Style Constants
// ============================================================================

/**
 * Log level badge colors
 */
export const LOG_LEVEL_STYLES: Record<
  LogLevel,
  { bg: string; text: string; border: string }
> = {
  debug: {
    bg: 'bg-gray-900/50',
    text: 'text-gray-400',
    border: 'border-gray-700',
  },
  info: {
    bg: 'bg-blue-950/50',
    text: 'text-blue-400',
    border: 'border-blue-900',
  },
  warn: {
    bg: 'bg-yellow-950/50',
    text: 'text-yellow-400',
    border: 'border-yellow-900',
  },
  error: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-900',
  },
}

/**
 * Log source badge colors
 */
export const LOG_SOURCE_STYLES: Record<
  LogSource,
  { bg: string; text: string; icon: string }
> = {
  agent: {
    bg: 'bg-apex-950/50',
    text: 'text-apex-400',
    icon: '🤖',
  },
  system: {
    bg: 'bg-gray-900/50',
    text: 'text-gray-400',
    icon: '⚙️',
  },
  user: {
    bg: 'bg-green-950/50',
    text: 'text-green-400',
    icon: '👤',
  },
  tool: {
    bg: 'bg-purple-950/50',
    text: 'text-purple-400',
    icon: '🔧',
  },
  error: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    icon: '❌',
  },
}

/**
 * Streaming state indicator styles
 */
export const STREAMING_STATE_STYLES: Record<
  StreamingState,
  { bg: string; text: string; icon: string; label: string }
> = {
  idle: {
    bg: 'bg-gray-900',
    text: 'text-gray-400',
    icon: '⏹',
    label: 'Idle',
  },
  connecting: {
    bg: 'bg-apex-900',
    text: 'text-apex-400',
    icon: '⏳',
    label: 'Connecting',
  },
  streaming: {
    bg: 'bg-green-900',
    text: 'text-green-400',
    icon: '▶',
    label: 'Streaming',
  },
  paused: {
    bg: 'bg-yellow-900',
    text: 'text-yellow-400',
    icon: '⏸',
    label: 'Paused',
  },
  disconnected: {
    bg: 'bg-red-900',
    text: 'text-red-400',
    icon: '⏏',
    label: 'Disconnected',
  },
  error: {
    bg: 'bg-red-900',
    text: 'text-red-400',
    icon: '⚠',
    label: 'Error',
  },
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Valid log levels
 */
export const VALID_LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error']

/**
 * Valid log sources
 */
export const VALID_LOG_SOURCES: readonly LogSource[] = [
  'agent',
  'system',
  'user',
  'tool',
  'error',
]

/**
 * Valid streaming states
 */
export const VALID_STREAMING_STATES: readonly StreamingState[] = [
  'idle',
  'connecting',
  'streaming',
  'paused',
  'disconnected',
  'error',
]

/**
 * Type guard for LogLevel
 */
export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && VALID_LOG_LEVELS.includes(value as LogLevel)
}

/**
 * Type guard for LogSource
 */
export function isLogSource(value: unknown): value is LogSource {
  return typeof value === 'string' && VALID_LOG_SOURCES.includes(value as LogSource)
}

/**
 * Type guard for StreamingState
 */
export function isStreamingState(value: unknown): value is StreamingState {
  return (
    typeof value === 'string' && VALID_STREAMING_STATES.includes(value as StreamingState)
  )
}

/**
 * Type guard for AgentLogEntry
 */
export function isAgentLogEntry(value: unknown): value is AgentLogEntry {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    v.timestamp instanceof Date &&
    isLogLevel(v.level) &&
    typeof v.message === 'string' &&
    isLogSource(v.source) &&
    typeof v.metadata === 'object' &&
    v.metadata !== null
  )
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a new agent log entry with defaults
 */
export function createAgentLogEntry(
  partial: Partial<AgentLogEntry> & Pick<AgentLogEntry, 'message'>
): AgentLogEntry {
  return {
    id: partial.id ?? crypto.randomUUID(),
    timestamp: partial.timestamp ?? new Date(),
    level: partial.level ?? 'info',
    message: partial.message,
    source: partial.source ?? 'agent',
    metadata: partial.metadata ?? {},
    isStreaming: partial.isStreaming,
    parentId: partial.parentId,
    sequenceNumber: partial.sequenceNumber,
  }
}

/**
 * Format a log entry timestamp for display
 */
export function formatLogTimestamp(date: Date, options?: { includeDate?: boolean }): string {
  const timeStr = date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const msStr = date.getMilliseconds().toString().padStart(3, '0')

  if (options?.includeDate) {
    const dateStr = date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
    })
    return `${dateStr} ${timeStr}.${msStr}`
  }

  return `${timeStr}.${msStr}`
}

/**
 * Calculate log stream statistics from logs
 */
export function calculateLogStreamStats(
  logs: AgentLogEntry[],
  streamStartedAt: Date | null
): LogStreamStats {
  const byLevel: Record<LogLevel, number> = {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  }

  const bySource: Record<LogSource, number> = {
    agent: 0,
    system: 0,
    user: 0,
    tool: 0,
    error: 0,
  }

  let errorCount = 0

  for (const log of logs) {
    byLevel[log.level]++
    bySource[log.source]++
    if (log.level === 'error') {
      errorCount++
    }
  }

  const streamDurationMs = streamStartedAt
    ? Date.now() - streamStartedAt.getTime()
    : 0

  const logsPerSecond =
    streamDurationMs > 0 ? (logs.length / streamDurationMs) * 1000 : 0

  return {
    totalLogs: logs.length,
    logsPerSecond: Math.round(logsPerSecond * 100) / 100,
    byLevel,
    bySource,
    errorCount,
    streamDurationMs,
  }
}

/**
 * Filter logs based on filter configuration
 */
export function filterLogs(logs: AgentLogEntry[], filter: LogFilter): AgentLogEntry[] {
  return logs.filter((log) => {
    // Level filter
    if (!filter.levels.has(log.level)) {
      return false
    }

    // Search text filter
    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase()
      const matchesMessage = log.message.toLowerCase().includes(searchLower)
      const matchesAgent = log.metadata.agentName
        ?.toLowerCase()
        .includes(searchLower)
      const matchesTool = log.metadata.toolName?.toLowerCase().includes(searchLower)

      if (!matchesMessage && !matchesAgent && !matchesTool) {
        return false
      }
    }

    // Stage filter
    if (filter.stage && log.metadata.stage !== filter.stage) {
      return false
    }

    // Agent filter
    if (filter.agent && log.metadata.agentId !== filter.agent) {
      return false
    }

    return true
  })
}

/**
 * Export logs to a specific format
 *
 * @throws Error if an unsupported format is provided (should not happen with proper typing)
 */
export function exportLogs(
  logs: AgentLogEntry[],
  format: 'json' | 'text' | 'csv'
): string {
  switch (format) {
    case 'json':
      return JSON.stringify(logs, null, 2)

    case 'text':
      return logs
        .map(
          (log) =>
            `[${formatLogTimestamp(log.timestamp)}] [${log.level.toUpperCase()}] ${log.message}`
        )
        .join('\n')

    case 'csv': {
      const headers = ['timestamp', 'level', 'source', 'message', 'agentId', 'agentName']
      const rows = logs.map((log) => [
        log.timestamp.toISOString(),
        log.level,
        log.source,
        `"${log.message.replace(/"/g, '""')}"`,
        log.metadata.agentId ?? '',
        log.metadata.agentName ?? '',
      ])
      return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
    }

    default:
      // This should never happen with proper TypeScript typing, but provides safety
      const _exhaustive: never = format
      throw new Error(`Unsupported export format: ${_exhaustive}`)
  }
}
