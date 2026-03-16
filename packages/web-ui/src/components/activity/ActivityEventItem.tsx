/**
 * ActivityEventItem Component
 *
 * Renders individual activity event rows with appropriate icons, styling,
 * and severity-based visual indicators. Supports both compact and full modes.
 */

import React from 'react'
import { ActivityCategoryIcon } from './ActivityCategoryIcon'
import { cn, getRelativeTime, truncateId } from '../../lib/utils'
import { MoreHorizontal } from 'lucide-react'
import type { ActivityEventItemProps, SeverityStylesMap } from '../../types/activity-feed'

/**
 * Severity-based styling configuration
 * Matches the existing Badge component styling patterns
 */
const SEVERITY_STYLES: SeverityStylesMap = {
  info: {
    bg: 'bg-apex-950/50',
    text: 'text-apex-400',
    border: 'border-apex-900',
    icon: 'text-apex-500',
    dot: 'bg-apex-500',
  },
  success: {
    bg: 'bg-green-950/50',
    text: 'text-green-400',
    border: 'border-green-900',
    icon: 'text-green-500',
    dot: 'bg-green-500',
  },
  warning: {
    bg: 'bg-yellow-950/50',
    text: 'text-yellow-400',
    border: 'border-yellow-900',
    icon: 'text-yellow-500',
    dot: 'bg-yellow-500',
  },
  error: {
    bg: 'bg-red-950/50',
    text: 'text-red-400',
    border: 'border-red-900',
    icon: 'text-red-500',
    dot: 'bg-red-500',
  },
} as const

/**
 * ActivityEventItem component displays a single activity event
 */
export function ActivityEventItem({
  event,
  compact = false,
  onClick,
  onMarkRead,
  showReadIndicator = true
}: ActivityEventItemProps) {
  const severityStyles = SEVERITY_STYLES[event.severity]
  const relativeTime = getRelativeTime(event.timestamp)
  const isClickable = Boolean(onClick)

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-md border transition-all',
        severityStyles.bg,
        severityStyles.border,
        // Hover effects for clickable items
        isClickable && 'cursor-pointer hover:bg-opacity-70',
        // Read state styling
        !event.isRead && 'ring-1 ring-opacity-30',
        !event.isRead && severityStyles.icon && `ring-${severityStyles.icon.replace('text-', '')}`,
        compact && 'p-2'
      )}
      onClick={() => onClick?.(event)}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick?.(event)
        }
      }}
      data-testid="activity-event"
    >
      {/* Category Icon */}
      <div className="flex-shrink-0 pt-0.5">
        <ActivityCategoryIcon
          category={event.category}
          className={cn(severityStyles.icon, compact ? 'w-4 h-4' : 'w-5 h-5')}
          size={compact ? 16 : 20}
        />
      </div>

      {/* Event Content */}
      <div className="flex-1 min-w-0">
        {/* Event Title and Timestamp */}
        <div className="flex items-center justify-between gap-2">
          <h4 className={cn(
            'font-medium truncate',
            severityStyles.text,
            compact ? 'text-sm' : 'text-base'
          )}>
            {event.title}
          </h4>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={cn(
              'text-xs text-foreground-secondary',
              compact && 'text-xs'
            )}>
              {relativeTime}
            </span>
            {/* Read/Unread indicator */}
            {showReadIndicator && !event.isRead && (
              <div
                className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  severityStyles.dot
                )}
                data-testid="unread-dot"
              />
            )}

            {/* Mark as read button */}
            {onMarkRead && !event.isRead && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onMarkRead(event.id)
                }}
                className="p-1 text-foreground-tertiary hover:text-foreground transition-colors"
                title="Mark as read"
              >
                <MoreHorizontal className="w-3 h-3" data-testid="icon-more" />
              </button>
            )}
          </div>
        </div>

        {/* Event Description (only in non-compact mode) */}
        {!compact && event.description && (
          <p className={cn(
            'text-sm text-foreground-secondary mt-1 line-clamp-2',
            'break-words'
          )}>
            {event.description}
          </p>
        )}

        {/* Task ID and Agent/Tool info (only in non-compact mode) */}
        {!compact && (
          <div className="flex items-center gap-4 mt-2 text-xs text-foreground-tertiary">
            {event.taskId && (
              <span>
                Task: {truncateId(event.taskId, 8)}
              </span>
            )}
            {event.agentName && (
              <span>
                Agent: {event.agentName}
              </span>
            )}
            {event.toolName && (
              <span>
                Tool: {event.toolName}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}