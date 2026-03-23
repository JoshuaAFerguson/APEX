/**
 * ChangelogDiffPreview Component
 *
 * Displays expandable file changes with diff content using the existing DiffViewer.
 * Provides a collapsible file list with individual diff previews.
 */

'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Plus,
  Minus
} from 'lucide-react'
import { DiffViewer } from '@/components/diff/DiffViewer'
import { CHANGE_TYPE_STYLES, A11Y_LABELS } from './constants'
import type {
  ChangelogDiffPreviewProps,
  ChangelogFileChange
} from '@/types/changelog'

interface FileChangeItemProps {
  change: ChangelogFileChange
  isExpanded: boolean
  onToggleExpand: () => void
  showFileHeader: boolean
  maxHeight?: number
}

/**
 * Individual file change item with collapsible diff
 */
function FileChangeItem({
  change,
  isExpanded,
  onToggleExpand,
  showFileHeader,
  maxHeight = 300,
}: FileChangeItemProps) {
  const changeStyle = CHANGE_TYPE_STYLES[change.type]
  const ChangeIcon = changeStyle.icon

  const displayPath = change.type === 'renamed' && change.originalPath
    ? `${change.originalPath} → ${change.path}`
    : change.path

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      {/* File header */}
      {showFileHeader && (
        <div className="px-3 py-2 bg-muted/30 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <ChangeIcon className={cn('w-4 h-4', changeStyle.color)} />
              <span className="font-mono text-sm truncate" title={displayPath}>
                {displayPath}
              </span>
              <Badge variant="secondary" className={cn('text-xs', changeStyle.badge)}>
                {change.type}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              {/* File stats */}
              <div className="flex items-center gap-1 text-xs text-foreground-secondary">
                {change.stats.additions > 0 && (
                  <span className="flex items-center gap-1 text-green-500">
                    <Plus className="w-3 h-3" />
                    {change.stats.additions}
                  </span>
                )}
                {change.stats.deletions > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <Minus className="w-3 h-3" />
                    {change.stats.deletions}
                  </span>
                )}
              </div>

              {/* Expand/collapse toggle */}
              {change.diff && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onToggleExpand}
                  className="h-6 w-6 p-0"
                  title={isExpanded ? 'Collapse diff' : 'Expand diff'}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3" />
                  ) : (
                    <ChevronRight className="w-3 h-3" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Diff content */}
      {isExpanded && change.diff && (
        <div className="relative">
          <DiffViewer
            diff={change.diff}
            filePath={change.path}
            mode="unified"
            showModeSelector={false}
            showLineNumbers={true}
            highlighting={true}
            showCopyButton={false}
            maxHeight={maxHeight}
            collapsible={false}
            showFileHeader={false}
            className="border-0"
          />
        </div>
      )}

      {/* Empty state for files without diff content */}
      {isExpanded && !change.diff && (
        <div className="px-4 py-6 text-center text-sm text-foreground-secondary">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No diff content available for this file</p>
          {change.type === 'deleted' && (
            <p className="mt-1">File was deleted</p>
          )}
          {change.type === 'added' && (
            <p className="mt-1">File was added</p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * ChangelogDiffPreview displays a list of file changes with expandable diffs
 */
export function ChangelogDiffPreview({
  changes,
  showFileHeaders = true,
  maxHeight = 300,
  className,
  defaultCollapsed = true,
}: ChangelogDiffPreviewProps) {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(
    defaultCollapsed ? new Set() : new Set(changes.map(c => c.path))
  )

  // Toggle expansion for a specific file
  const toggleFileExpansion = (filePath: string) => {
    setExpandedFiles(prev => {
      const next = new Set(prev)
      if (next.has(filePath)) {
        next.delete(filePath)
      } else {
        next.add(filePath)
      }
      return next
    })
  }

  // Expand/collapse all files
  const toggleAllFiles = () => {
    const allExpanded = expandedFiles.size === changes.length
    if (allExpanded) {
      setExpandedFiles(new Set())
    } else {
      setExpandedFiles(new Set(changes.map(c => c.path)))
    }
  }

  if (changes.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-foreground-secondary">
        No file changes to display
      </div>
    )
  }

  const allExpanded = expandedFiles.size === changes.length
  const totalAdditions = changes.reduce((sum, c) => sum + c.stats.additions, 0)
  const totalDeletions = changes.reduce((sum, c) => sum + c.stats.deletions, 0)

  return (
    <div className={cn('space-y-2', className)}>
      {/* Header with expand/collapse all */}
      <div className="flex items-center justify-between py-2">
        <div className="text-sm text-foreground-secondary">
          {changes.length} file{changes.length !== 1 ? 's' : ''} changed
          {(totalAdditions > 0 || totalDeletions > 0) && (
            <span className="ml-2">
              {totalAdditions > 0 && (
                <span className="text-green-500">+{totalAdditions}</span>
              )}
              {totalAdditions > 0 && totalDeletions > 0 && ' '}
              {totalDeletions > 0 && (
                <span className="text-red-500">-{totalDeletions}</span>
              )}
            </span>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleAllFiles}
          className="text-xs"
        >
          {allExpanded ? 'Collapse all' : 'Expand all'}
        </Button>
      </div>

      {/* File changes list */}
      <div className="space-y-2">
        {changes.map((change) => (
          <FileChangeItem
            key={change.path}
            change={change}
            isExpanded={expandedFiles.has(change.path)}
            onToggleExpand={() => toggleFileExpansion(change.path)}
            showFileHeader={showFileHeaders}
            maxHeight={maxHeight}
          />
        ))}
      </div>
    </div>
  )
}