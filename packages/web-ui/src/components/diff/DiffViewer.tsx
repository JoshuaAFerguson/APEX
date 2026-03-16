/**
 * Diff Viewer Component
 *
 * Main component for displaying diffs with syntax highlighting and multiple view modes.
 * Supports unified, split, and inline viewing with interactive features.
 */

'use client'

import React, { useMemo, useCallback, useState, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/Spinner'
import { useDiffParser } from './hooks/useDiffParser'
import { DiffViewerUnified } from './DiffViewerUnified'
import { DiffViewerSplit } from './DiffViewerSplit'
import { DiffViewerInline } from './DiffViewerInline'
import { DiffModeSelector } from './DiffModeSelector'
import { DiffCopyButton } from './DiffCopyButton'
import { DiffHeader } from './DiffHeader'
import {
  DEFAULT_VIEW_MODE,
  DEFAULT_MAX_HEIGHT,
  DEFAULT_EMPTY_MESSAGE,
  DEFAULT_HIGHLIGHT_CONFIG,
} from './constants'
import type { DiffViewerProps, DiffViewMode, DiffLineData } from './types'

export const DiffViewer = forwardRef<HTMLDivElement, DiffViewerProps>(
  (
    {
      diff,
      filePath,
      mode: initialMode = DEFAULT_VIEW_MODE,
      showModeSelector = true,
      showLineNumbers = true,
      highlighting = true,
      showCopyButton = true,
      maxHeight = DEFAULT_MAX_HEIGHT,
      onLineClick,
      onSelectionChange,
      onCopy,
      className,
      loading = false,
      error = null,
      emptyMessage = DEFAULT_EMPTY_MESSAGE,
      showFileHeader = true,
      collapsible = false,
      defaultCollapsed = false,
    },
    ref
  ) => {
    const [mode, setMode] = useState<DiffViewMode>(initialMode)
    const [selectedLines, setSelectedLines] = useState<Set<number>>(new Set())

    // Parse diff content
    const { fileDiff, parseError, isEmpty } = useDiffParser(diff, filePath)

    // Handle line selection
    const handleLineClick = useCallback(
      (line: DiffLineData, index: number) => {
        setSelectedLines(prev => {
          const next = new Set(prev)
          if (next.has(index)) {
            next.delete(index)
          } else {
            next.add(index)
          }

          // Notify parent of selection change
          if (onSelectionChange) {
            const selectedLinesArray = Array.from(next)
              .sort((a, b) => a - b)
              .map(idx => {
                // Find the line by global index
                let globalIdx = 0
                for (const hunk of fileDiff?.hunks || []) {
                  for (const hunkLine of hunk.lines) {
                    if (globalIdx === idx) return hunkLine
                    globalIdx++
                  }
                }
                return line // Fallback
              })
              .filter(Boolean)
            onSelectionChange(selectedLinesArray)
          }

          return next
        })

        onLineClick?.(line, index)
      },
      [onLineClick, onSelectionChange, fileDiff]
    )

    // Get selected lines content for copy
    const selectedContent = useMemo(() => {
      if (!fileDiff || selectedLines.size === 0) return diff

      const allLines = fileDiff.hunks.flatMap(h => h.lines)
      return Array.from(selectedLines)
        .sort((a, b) => a - b)
        .map(idx => allLines[idx]?.content ?? '')
        .join('\n')
    }, [fileDiff, selectedLines, diff])

    // Get appropriate view component
    const ViewComponent = useMemo(() => {
      switch (mode) {
        case 'split':
          return DiffViewerSplit
        case 'inline':
          return DiffViewerInline
        default:
          return DiffViewerUnified
      }
    }, [mode])

    // Handle copy functionality
    const handleCopy = useCallback(
      (content: string) => {
        onCopy?.(content)
      },
      [onCopy]
    )

    // Get highlighting configuration
    const highlightConfig = useMemo(() => {
      if (typeof highlighting === 'boolean') {
        return { ...DEFAULT_HIGHLIGHT_CONFIG, enabled: highlighting }
      }
      return { ...DEFAULT_HIGHLIGHT_CONFIG, ...highlighting }
    }, [highlighting])

    // Loading state
    if (loading) {
      return (
        <div
          ref={ref}
          className={cn('flex items-center justify-center p-8 rounded-lg border border-border', className)}
        >
          <Spinner size="lg" />
          <span className="ml-2 text-muted-foreground">Loading diff...</span>
        </div>
      )
    }

    // Error state
    if (error || parseError) {
      return (
        <div
          ref={ref}
          className={cn(
            'p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400',
            className
          )}
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="font-medium text-sm">Error loading diff</p>
              <p className="text-xs mt-1 text-red-300">{error || parseError}</p>
            </div>
          </div>
        </div>
      )
    }

    // Empty state
    if (isEmpty || !fileDiff || fileDiff.hunks.length === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            'p-8 text-center text-muted-foreground rounded-lg border border-dashed border-border',
            className
          )}
        >
          <div className="flex flex-col items-center gap-2">
            <svg className="w-8 h-8 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>{emptyMessage}</p>
          </div>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-border bg-background overflow-hidden',
          className
        )}
      >
        {/* Header with controls */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex-1 min-w-0">
            {showFileHeader && (
              <DiffHeader
                oldPath={fileDiff.oldPath}
                newPath={fileDiff.newPath}
                isNew={fileDiff.isNew}
                isDeleted={fileDiff.isDeleted}
                isRenamed={fileDiff.isRenamed}
              />
            )}
          </div>

          <div className="flex items-center gap-2 ml-4">
            {selectedLines.size > 0 && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                {selectedLines.size} line{selectedLines.size !== 1 ? 's' : ''} selected
              </span>
            )}

            {showCopyButton && (
              <DiffCopyButton
                content={selectedContent}
                onCopy={handleCopy}
                variant="icon"
              />
            )}

            {showModeSelector && (
              <DiffModeSelector value={mode} onChange={setMode} />
            )}
          </div>
        </div>

        {/* Diff content */}
        <div
          className="overflow-auto font-mono text-sm bg-background"
          style={{ maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight }}
        >
          <ViewComponent
            fileDiff={fileDiff}
            showLineNumbers={showLineNumbers}
            highlighting={highlightConfig.enabled}
            highlightConfig={highlightConfig}
            selectedLines={selectedLines}
            onLineClick={handleLineClick}
            collapsible={collapsible}
            defaultCollapsed={defaultCollapsed}
          />
        </div>

        {/* Footer with stats */}
        <div className="px-4 py-2 border-t border-border bg-muted/30 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>
                {fileDiff.hunks.length} chunk{fileDiff.hunks.length !== 1 ? 's' : ''}
              </span>
              <span className="text-green-400">
                +{fileDiff.hunks.reduce((acc, h) => acc + h.lines.filter(l => l.type === 'added').length, 0)}
              </span>
              <span className="text-red-400">
                -{fileDiff.hunks.reduce((acc, h) => acc + h.lines.filter(l => l.type === 'removed').length, 0)}
              </span>
            </div>
            {fileDiff.language !== 'unknown' && (
              <span>Language: {fileDiff.language}</span>
            )}
          </div>
        </div>
      </div>
    )
  }
)

DiffViewer.displayName = 'DiffViewer'