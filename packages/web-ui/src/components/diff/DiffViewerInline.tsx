/**
 * Diff Viewer Inline Component
 *
 * Renders diff in inline view mode with changes mixed within context.
 * Similar to unified but with enhanced context grouping.
 */

'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { DiffLine } from './DiffLine'
import type { DiffViewModeProps } from './types'

export function DiffViewerInline({
  fileDiff,
  showLineNumbers,
  highlighting,
  selectedLines,
  onLineClick,
}: DiffViewModeProps) {
  let globalIndex = 0

  return (
    <div className="divide-y divide-border/50">
      {fileDiff.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex}>
          {/* Hunk header with context information */}
          <div className="px-4 py-1.5 bg-blue-500/10 text-blue-400 text-xs font-medium border-b border-blue-500/20">
            <div className="flex items-center justify-between">
              <span className="font-mono">{hunk.header}</span>
              <span className="text-blue-300 text-xs">
                {hunk.lines.filter(l => l.type === 'added').length} additions,{' '}
                {hunk.lines.filter(l => l.type === 'removed').length} deletions
              </span>
            </div>
          </div>

          {/* Lines with enhanced grouping */}
          <div className="relative">
            {hunk.lines.map((line, lineIndex) => {
              const index = globalIndex++
              const prevLine = lineIndex > 0 ? hunk.lines[lineIndex - 1] : null
              const nextLine = lineIndex < hunk.lines.length - 1 ? hunk.lines[lineIndex + 1] : null

              // Add visual separation for change blocks
              const isStartOfChangeBlock =
                (line.type === 'added' || line.type === 'removed') &&
                prevLine?.type === 'unchanged'

              const isEndOfChangeBlock =
                (line.type === 'added' || line.type === 'removed') &&
                nextLine?.type === 'unchanged'

              return (
                <div
                  key={`${hunkIndex}-${lineIndex}`}
                  className={cn(
                    isStartOfChangeBlock && 'border-t border-border/30 mt-1',
                    isEndOfChangeBlock && 'border-b border-border/30 mb-1'
                  )}
                >
                  <DiffLine
                    line={line}
                    index={index}
                    language={fileDiff.language}
                    showLineNumbers={showLineNumbers}
                    highlighting={highlighting}
                    onClick={onLineClick}
                    isSelected={selectedLines.has(index)}
                    mode="inline"
                  />
                </div>
              )
            })}
          </div>

          {/* Hunk summary */}
          {hunkIndex === fileDiff.hunks.length - 1 && (
            <div className="px-4 py-2 bg-muted/30 text-xs text-muted-foreground border-t border-border/30">
              <div className="flex items-center justify-between">
                <span>
                  {fileDiff.hunks.length} chunk{fileDiff.hunks.length !== 1 ? 's' : ''}
                </span>
                <span>
                  {fileDiff.hunks.reduce((acc, h) => acc + h.lines.filter(l => l.type === 'added').length, 0)} additions,{' '}
                  {fileDiff.hunks.reduce((acc, h) => acc + h.lines.filter(l => l.type === 'removed').length, 0)} deletions
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}