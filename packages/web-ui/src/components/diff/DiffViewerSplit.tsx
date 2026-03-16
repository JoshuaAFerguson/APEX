/**
 * Diff Viewer Split Component
 *
 * Renders diff in split view mode with side-by-side old and new files.
 */

'use client'

import React, { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { DiffLine } from './DiffLine'
import type { DiffViewModeProps, DiffLineData as DiffLineType } from './types'

interface SideBySidePair {
  left: DiffLineType | null
  right: DiffLineType | null
  leftIndex: number
  rightIndex: number
}

export function DiffViewerSplit({
  fileDiff,
  showLineNumbers,
  highlighting,
  selectedLines,
  onLineClick,
}: DiffViewModeProps) {
  // Transform hunks into side-by-side pairs
  const pairs = useMemo(() => {
    const result: SideBySidePair[] = []
    let leftIndex = 0
    let rightIndex = 0

    for (const hunk of fileDiff.hunks) {
      // Add hunk header as special pair
      const headerLine: DiffLineType = {
        type: 'header',
        content: hunk.header,
        oldLineNumber: null,
        newLineNumber: null,
      }

      result.push({
        left: headerLine,
        right: null,
        leftIndex: -1,
        rightIndex: -1,
      })

      // Process lines in hunk
      let i = 0
      while (i < hunk.lines.length) {
        const line = hunk.lines[i]

        if (line.type === 'unchanged' || line.type === 'context') {
          // Unchanged lines appear on both sides
          result.push({
            left: line,
            right: line,
            leftIndex: leftIndex++,
            rightIndex: rightIndex++,
          })
          i++
        } else if (line.type === 'removed') {
          // Look ahead for corresponding added line
          let addedLine: DiffLineType | null = null
          let j = i + 1

          // Find next added line (could be immediate next or after other removed lines)
          while (j < hunk.lines.length && hunk.lines[j].type === 'removed') {
            j++
          }

          if (j < hunk.lines.length && hunk.lines[j].type === 'added') {
            addedLine = hunk.lines[j]
          }

          if (addedLine) {
            // Pair removed and added lines
            result.push({
              left: line,
              right: addedLine,
              leftIndex: leftIndex++,
              rightIndex: rightIndex++,
            })
            // Skip the added line in the main loop
            i = j + 1
          } else {
            // Removed line without corresponding addition
            result.push({
              left: line,
              right: null,
              leftIndex: leftIndex++,
              rightIndex: -1,
            })
            i++
          }
        } else if (line.type === 'added') {
          // Added line without corresponding removal (shouldn't happen if above logic is correct)
          result.push({
            left: null,
            right: line,
            leftIndex: -1,
            rightIndex: rightIndex++,
          })
          i++
        }
      }
    }

    return result
  }, [fileDiff.hunks])

  return (
    <div className="grid grid-cols-2 divide-x divide-border min-h-0">
      {/* Left side (old file) */}
      <div className="min-w-0 overflow-hidden">
        <div className="sticky top-0 px-3 py-2 bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium">
          <span className="truncate">{fileDiff.oldPath}</span>
        </div>
        <div className="divide-y divide-border/30">
          {pairs.map((pair, index) => {
            if (pair.left?.type === 'header') {
              return (
                <div key={`left-header-${index}`} className="px-3 py-1.5 bg-blue-500/10 text-blue-400 text-xs font-medium">
                  <span className="font-mono">{pair.left.content}</span>
                </div>
              )
            }

            return pair.left ? (
              <DiffLine
                key={`left-${index}`}
                line={pair.left}
                index={pair.leftIndex}
                language={fileDiff.language}
                showLineNumbers={showLineNumbers}
                highlighting={highlighting}
                onClick={pair.leftIndex >= 0 ? onLineClick : undefined}
                isSelected={pair.leftIndex >= 0 && selectedLines.has(pair.leftIndex)}
                mode="split-left"
              />
            ) : (
              <div
                key={`left-empty-${index}`}
                className="h-6 bg-muted/30"
                aria-hidden="true"
              />
            )
          })}
        </div>
      </div>

      {/* Right side (new file) */}
      <div className="min-w-0 overflow-hidden">
        <div className="sticky top-0 px-3 py-2 bg-muted/50 border-b border-border text-xs text-muted-foreground font-medium">
          <span className="truncate">{fileDiff.newPath}</span>
        </div>
        <div className="divide-y divide-border/30">
          {pairs.map((pair, index) => {
            if (pair.left?.type === 'header') {
              return (
                <div key={`right-header-${index}`} className="px-3 py-1.5 bg-blue-500/10 text-blue-400 text-xs font-medium">
                  <span className="opacity-0" aria-hidden="true">
                    {pair.left.content}
                  </span>
                </div>
              )
            }

            return pair.right ? (
              <DiffLine
                key={`right-${index}`}
                line={pair.right}
                index={pair.rightIndex}
                language={fileDiff.language}
                showLineNumbers={showLineNumbers}
                highlighting={highlighting}
                onClick={pair.rightIndex >= 0 ? onLineClick : undefined}
                isSelected={pair.rightIndex >= 0 && selectedLines.has(pair.rightIndex)}
                mode="split-right"
              />
            ) : (
              <div
                key={`right-empty-${index}`}
                className="h-6 bg-muted/30"
                aria-hidden="true"
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}