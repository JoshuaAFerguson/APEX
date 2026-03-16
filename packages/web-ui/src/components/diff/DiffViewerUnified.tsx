/**
 * Diff Viewer Unified Component
 *
 * Renders diff in unified view mode with single column and +/- indicators.
 */

'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { DiffLine } from './DiffLine'
import type { DiffViewModeProps } from './types'

export function DiffViewerUnified({
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
          {/* Hunk header */}
          <div className="px-4 py-1.5 bg-blue-500/10 text-blue-400 text-xs font-medium border-b border-blue-500/20">
            <span className="font-mono">{hunk.header}</span>
            <span className="ml-2 text-blue-300">
              ({hunk.oldStart},{hunk.oldLines} → {hunk.newStart},{hunk.newLines})
            </span>
          </div>

          {/* Lines */}
          <div>
            {hunk.lines.map((line, lineIndex) => {
              const index = globalIndex++
              return (
                <DiffLine
                  key={`${hunkIndex}-${lineIndex}`}
                  line={line}
                  index={index}
                  language={fileDiff.language}
                  showLineNumbers={showLineNumbers}
                  highlighting={highlighting}
                  onClick={onLineClick}
                  isSelected={selectedLines.has(index)}
                  mode="unified"
                />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}