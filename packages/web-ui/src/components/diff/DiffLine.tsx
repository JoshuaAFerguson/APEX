/**
 * Diff Line Component
 *
 * Renders a single line in a diff with syntax highlighting,
 * line numbers, and interactive selection.
 */

'use client'

import React, { useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { DiffLineNumber } from './DiffLineNumber'
import { highlightLine } from './utils/syntax-highlighter'
import { LINE_TYPE_STYLES, LINE_TYPE_INDICATOR, LINE_TYPE_INDICATOR_COLOR } from './constants'
import type { DiffLineProps, DiffLineType } from './types'

type DiffLineMode = 'unified' | 'split-left' | 'split-right' | 'inline'

interface ExtendedDiffLineProps extends DiffLineProps {
  mode?: DiffLineMode
}

export function DiffLine({
  line,
  index,
  language,
  showLineNumbers,
  highlighting,
  onClick,
  isSelected,
  className,
  mode = 'unified',
}: ExtendedDiffLineProps) {
  const handleClick = useCallback(() => {
    onClick?.(line, index)
  }, [onClick, line, index])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }, [handleClick])

  // Highlight content if enabled
  const highlightedContent = useMemo(() => {
    if (!highlighting || line.type === 'header') {
      return line.content
    }
    return highlightLine(line.content, language)
  }, [highlighting, line.content, line.type, language])

  const isInteractive = onClick && line.type !== 'header'

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? handleClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      className={cn(
        'flex items-stretch text-sm leading-6 group',
        LINE_TYPE_STYLES[line.type],
        isSelected && 'ring-2 ring-inset ring-blue-500 bg-blue-500/20',
        isInteractive && 'cursor-pointer',
        line.type === 'header' && 'font-medium',
        className
      )}
      aria-selected={isSelected}
      data-line-type={line.type}
    >
      {/* Line numbers for unified and inline modes */}
      {showLineNumbers && mode !== 'split-left' && mode !== 'split-right' && (
        <>
          <DiffLineNumber
            number={line.oldLineNumber}
            type={line.type === 'added' ? 'empty' : 'normal'}
          />
          <DiffLineNumber
            number={line.newLineNumber}
            type={line.type === 'removed' ? 'empty' : 'normal'}
          />
        </>
      )}

      {/* Single line number for split view */}
      {showLineNumbers && (mode === 'split-left' || mode === 'split-right') && (
        <DiffLineNumber
          number={mode === 'split-left' ? line.oldLineNumber : line.newLineNumber}
          type="normal"
        />
      )}

      {/* Change indicator (for unified mode only) */}
      {mode === 'unified' && (
        <span
          className={cn(
            'w-5 flex-shrink-0 text-center select-none',
            LINE_TYPE_INDICATOR_COLOR[line.type]
          )}
          aria-hidden="true"
        >
          {LINE_TYPE_INDICATOR[line.type]}
        </span>
      )}

      {/* Content */}
      {highlighting &&
      typeof highlightedContent === 'string' &&
      highlightedContent !== line.content ? (
        <code
          className={cn(
            'flex-1 px-2 whitespace-pre overflow-x-auto',
            'font-mono text-sm',
            line.type === 'added' && 'text-green-400',
            line.type === 'removed' && 'text-red-400',
            line.type === 'header' && 'text-blue-400 font-medium',
          )}
          dangerouslySetInnerHTML={{ __html: highlightedContent }}
        />
      ) : (
        <code
          className={cn(
            'flex-1 px-2 whitespace-pre overflow-x-auto',
            'font-mono text-sm',
            line.type === 'added' && 'text-green-400',
            line.type === 'removed' && 'text-red-400',
            line.type === 'header' && 'text-blue-400 font-medium',
          )}
        >
          {line.content}
        </code>
      )}
    </div>
  )
}