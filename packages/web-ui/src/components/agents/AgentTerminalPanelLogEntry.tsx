'use client'

import React, { memo } from 'react'
import { cn } from '@/lib/utils'
import type { AgentLogEntry, LogLevel, LogSource } from '@/types/agent-log-stream'
import {
  LOG_LEVEL_STYLES,
  LOG_SOURCE_STYLES,
  formatLogTimestamp,
} from '@/types/agent-log-stream'

/**
 * Props for AgentTerminalPanelLogEntry component
 */
export interface AgentTerminalPanelLogEntryProps {
  /** The log entry to display */
  log: AgentLogEntry

  /** Whether to show timestamps */
  showTimestamps?: boolean

  /** Whether to show log level badges */
  showLevelBadges?: boolean

  /** Whether to show source badges */
  showSourceBadges?: boolean

  /** Whether to wrap long lines */
  wrapLines?: boolean

  /** Font size variant */
  fontSize?: 'xs' | 'sm' | 'md'

  /** Whether this entry is selected */
  isSelected?: boolean

  /** Callback when the entry is clicked */
  onClick?: (log: AgentLogEntry) => void

  /** Additional CSS class */
  className?: string

  /** Element ref for scrolling */
  elementRef?: (element: HTMLElement | null) => void
}

/**
 * Font size configurations
 */
const FONT_SIZE_CLASSES = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
} as const

/**
 * Source badge component
 */
const SourceBadge: React.FC<{ source: LogSource }> = memo(({ source }) => {
  const styles = LOG_SOURCE_STYLES[source]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded border',
        styles.bg,
        styles.text,
        'border-current/20'
      )}
      title={`Source: ${source}`}
    >
      <span aria-hidden="true">{styles.icon}</span>
      {source.toUpperCase()}
    </span>
  )
})

SourceBadge.displayName = 'SourceBadge'

/**
 * Level badge component
 */
const LevelBadge: React.FC<{ level: LogLevel }> = memo(({ level }) => {
  const styles = LOG_LEVEL_STYLES[level]

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border',
        styles.bg,
        styles.text,
        styles.border
      )}
      title={`Level: ${level}`}
    >
      {level.toUpperCase()}
    </span>
  )
})

LevelBadge.displayName = 'LevelBadge'

/**
 * Metadata info component
 */
const MetadataInfo: React.FC<{ log: AgentLogEntry }> = memo(({ log }) => {
  const { metadata } = log
  const hasMetadata = metadata.agentName || metadata.stage || metadata.toolName

  if (!hasMetadata) return null

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      {metadata.agentName && (
        <span className="bg-gray-900/50 px-1.5 py-0.5 rounded">
          Agent: {metadata.agentName}
        </span>
      )}
      {metadata.stage && (
        <span className="bg-gray-900/50 px-1.5 py-0.5 rounded">
          Stage: {metadata.stage}
        </span>
      )}
      {metadata.toolName && (
        <span className="bg-purple-900/50 px-1.5 py-0.5 rounded text-purple-400">
          Tool: {metadata.toolName}
        </span>
      )}
      {metadata.durationMs && (
        <span className="bg-gray-900/50 px-1.5 py-0.5 rounded">
          {metadata.durationMs}ms
        </span>
      )}
    </div>
  )
})

MetadataInfo.displayName = 'MetadataInfo'

/**
 * Individual log entry component for AgentTerminalPanel
 *
 * Renders a single log entry with timestamp, level badge, source badge,
 * and message content. Supports selection, different font sizes, and
 * configurable display options.
 *
 * @example
 * ```tsx
 * <AgentTerminalPanelLogEntry
 *   log={logEntry}
 *   showTimestamps
 *   showLevelBadges
 *   showSourceBadges
 *   wrapLines
 *   fontSize="sm"
 *   onClick={(log) => console.log('Selected:', log)}
 * />
 * ```
 */
export const AgentTerminalPanelLogEntry: React.FC<AgentTerminalPanelLogEntryProps> = memo(
  ({
    log,
    showTimestamps = true,
    showLevelBadges = true,
    showSourceBadges = false,
    wrapLines = true,
    fontSize = 'sm',
    isSelected = false,
    onClick,
    className,
    elementRef,
  }) => {
    const levelStyles = LOG_LEVEL_STYLES[log.level]
    const fontSizeClass = FONT_SIZE_CLASSES[fontSize]

    // Error logs might have expanded details
    const hasErrorDetails = log.level === 'error' && log.metadata.error

    const handleClick = () => {
      onClick?.(log)
    }

    return (
      <div
        ref={elementRef}
        className={cn(
          // Base styling
          'group relative border-b border-gray-800/50 transition-colors duration-150',
          fontSizeClass,

          // Hover and interaction
          onClick && 'cursor-pointer hover:bg-gray-900/30',
          isSelected && 'bg-apex-950/30 border-apex-800',

          // Level-specific background tint
          !isSelected && levelStyles.bg,

          className
        )}
        onClick={handleClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleClick()
                }
              }
            : undefined
        }
      >
        {/* Main log content */}
        <div className="flex items-start gap-3 px-3 py-2">
          {/* Timestamp */}
          {showTimestamps && (
            <span
              className="text-gray-500 font-mono text-xs shrink-0 select-text"
              title={log.timestamp.toISOString()}
            >
              {formatLogTimestamp(log.timestamp)}
            </span>
          )}

          {/* Level badge */}
          {showLevelBadges && (
            <div className="shrink-0">
              <LevelBadge level={log.level} />
            </div>
          )}

          {/* Source badge */}
          {showSourceBadges && (
            <div className="shrink-0">
              <SourceBadge source={log.source} />
            </div>
          )}

          {/* Message content */}
          <div className="flex-1 min-w-0">
            <div
              className={cn(
                'font-mono select-text',
                wrapLines ? 'whitespace-pre-wrap break-words' : 'whitespace-pre truncate',
                levelStyles.text
              )}
            >
              {log.message}
            </div>

            {/* Extended error details */}
            {hasErrorDetails && (
              <details className="mt-2 group/details">
                <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-300">
                  Error details
                </summary>
                <div className="mt-1 p-2 bg-red-950/20 border border-red-900/50 rounded text-xs">
                  {log.metadata.error?.code && (
                    <div className="text-red-400">
                      <strong>Code:</strong> {log.metadata.error.code}
                    </div>
                  )}
                  {log.metadata.error?.stack && (
                    <div className="mt-1 text-red-300">
                      <strong>Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap text-xs text-gray-300">
                        {log.metadata.error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Metadata info */}
            <MetadataInfo log={log} />
          </div>

          {/* Selection indicator */}
          {isSelected && (
            <div className="shrink-0 w-1 bg-apex-500 rounded-full" aria-hidden="true" />
          )}
        </div>

        {/* Streaming indicator */}
        {log.isStreaming && (
          <div className="absolute top-2 right-2">
            <div
              className="w-2 h-2 bg-green-500 rounded-full animate-pulse"
              title="Live stream"
              aria-label="This log entry is from a live stream"
            />
          </div>
        )}
      </div>
    )
  }
)

AgentTerminalPanelLogEntry.displayName = 'AgentTerminalPanelLogEntry'

export default AgentTerminalPanelLogEntry