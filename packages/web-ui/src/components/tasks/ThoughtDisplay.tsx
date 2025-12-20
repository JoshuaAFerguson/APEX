'use client'

import { useState, useCallback, useId, KeyboardEvent } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ThoughtDisplayProps {
  /** The thought content to display */
  content: string
  /** Optional label/title for the thought (e.g., "Thinking...", "Reasoning") */
  label?: string
  /** Whether the thought is initially expanded (default: false - collapsed) */
  defaultExpanded?: boolean
  /** Optional timestamp for when the thought occurred */
  timestamp?: Date | string
  /** Optional className for additional styling */
  className?: string
  /** Optional callback when expand/collapse state changes */
  onToggle?: (isExpanded: boolean) => void
}

/**
 * ThoughtDisplay component renders thought content with gray/dimmed styling,
 * supports collapsed/expanded states with chevron indicator,
 * and animates expand/collapse transitions.
 */
export function ThoughtDisplay({
  content,
  label = 'Thinking...',
  defaultExpanded = false,
  timestamp,
  className,
  onToggle,
}: ThoughtDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const contentId = useId()
  const headerId = useId()

  const handleToggle = useCallback(() => {
    const newState = !isExpanded
    setIsExpanded(newState)
    onToggle?.(newState)
  }, [isExpanded, onToggle])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleToggle()
    }
  }, [handleToggle])

  const formatTimestamp = (ts: Date | string): string => {
    const date = typeof ts === 'string' ? new Date(ts) : ts
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div
      className={cn(
        'border border-border rounded-lg bg-background-tertiary/50',
        className
      )}
    >
      {/* Header - Toggle Button */}
      <button
        id={headerId}
        type="button"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className={cn(
          'w-full p-3 flex items-center gap-2',
          'cursor-pointer hover:bg-background-tertiary transition-colors',
          'text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-apex-500'
        )}
      >
        <ChevronRight
          className={cn(
            'w-4 h-4 text-foreground-tertiary transition-transform duration-200 flex-shrink-0',
            isExpanded && 'rotate-90'
          )}
        />
        <span className="text-sm text-foreground-secondary italic flex-1">
          {label}
        </span>
        {timestamp && (
          <span className="text-xs text-foreground-tertiary">
            {formatTimestamp(timestamp)}
          </span>
        )}
      </button>

      {/* Content - Animated Collapse */}
      <div
        id={contentId}
        role="region"
        aria-labelledby={headerId}
        className="animate-collapse"
        data-expanded={isExpanded}
      >
        <div className="animate-collapse-inner">
          <div className="px-3 pb-3 pt-0">
            <p className="text-sm text-foreground-tertiary leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}