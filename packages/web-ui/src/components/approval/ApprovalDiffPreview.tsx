'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DiffViewer, DEFAULT_VIEW_MODE } from '@/components/diff'
import {
  DIFF_PREVIEW_DEFAULTS,
  TEST_IDS,
} from '@/types/approval-gate-panel-constants'
import type { ApprovalDiffPreviewProps, ApprovalDiffData } from '@/types/approval-gate-panel'
import { cn } from '@/lib/utils'
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Code,
  Terminal,
  Files,
  Copy,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
} from 'lucide-react'

/**
 * ApprovalDiffPreview component for displaying diff data within approval gates
 *
 * Features:
 * - Wraps the existing DiffViewer component
 * - Handles different change types (file-write, file-edit, command-execution, etc.)
 * - Collapsible preview with expand/collapse controls
 * - Summary information (files changed, lines added/removed)
 * - Command preview for command-execution types
 * - Loading and error states
 * - Copy functionality
 */
export function ApprovalDiffPreview({
  diffData,
  viewMode = DIFF_PREVIEW_DEFAULTS.viewMode,
  showLineNumbers = DIFF_PREVIEW_DEFAULTS.showLineNumbers,
  highlighting = DIFF_PREVIEW_DEFAULTS.highlighting,
  maxHeight = DIFF_PREVIEW_DEFAULTS.maxHeight,
  collapsible = DIFF_PREVIEW_DEFAULTS.collapsible,
  defaultCollapsed = DIFF_PREVIEW_DEFAULTS.defaultCollapsed,
  loading = false,
  error = null,
  onCopy,
  className,
}: ApprovalDiffPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed)
  const [localViewMode, setLocalViewMode] = useState(viewMode)

  /**
   * Get icon for change type
   */
  const getChangeTypeIcon = (changeType: ApprovalDiffData['changeType']) => {
    switch (changeType) {
      case 'file-write':
        return FileText
      case 'file-edit':
        return Code
      case 'file-delete':
        return FileText
      case 'multi-file':
        return Files
      case 'command-execution':
        return Terminal
      default:
        return FileText
    }
  }

  /**
   * Get display label for change type
   */
  const getChangeTypeLabel = (changeType: ApprovalDiffData['changeType']) => {
    switch (changeType) {
      case 'file-write':
        return 'File Write'
      case 'file-edit':
        return 'File Edit'
      case 'file-delete':
        return 'File Delete'
      case 'multi-file':
        return 'Multiple Files'
      case 'command-execution':
        return 'Command Execution'
      default:
        return 'Code Changes'
    }
  }

  /**
   * Render change summary
   */
  const renderSummary = () => {
    const summary = []

    if (diffData.filesChanged !== undefined) {
      summary.push(`${diffData.filesChanged} file${diffData.filesChanged !== 1 ? 's' : ''} changed`)
    }

    if (diffData.linesAdded !== undefined) {
      summary.push(`+${diffData.linesAdded} lines added`)
    }

    if (diffData.linesRemoved !== undefined) {
      summary.push(`-${diffData.linesRemoved} lines removed`)
    }

    return summary.join(', ')
  }

  /**
   * Render command preview for command-execution type
   */
  const renderCommandPreview = () => {
    if (diffData.changeType !== 'command-execution' || !diffData.command) {
      return null
    }

    return (
      <div className="bg-background-tertiary rounded-md p-3 space-y-3">
        <div>
          <p className="text-xs font-medium text-foreground-secondary mb-2">Command</p>
          <div className="bg-black/20 rounded border p-2">
            <code className="text-sm font-mono text-foreground">{diffData.command}</code>
          </div>
        </div>

        {diffData.commandPreview && (
          <div>
            <p className="text-xs font-medium text-foreground-secondary mb-2">Expected Output Preview</p>
            <div className="bg-black/20 rounded border p-2 max-h-32 overflow-y-auto">
              <pre className="text-xs font-mono text-foreground-secondary whitespace-pre-wrap">
                {diffData.commandPreview}
              </pre>
            </div>
          </div>
        )}
      </div>
    )
  }

  /**
   * Handle copy functionality
   */
  const handleCopy = (content: string) => {
    onCopy?.(content)
  }

  /**
   * Get the diff content to display
   */
  const getDiffContent = useMemo(() => {
    if (diffData.fileDiffs && diffData.fileDiffs.length > 0) {
      // Convert FileDiff objects to raw diff format
      // This is a simplified conversion - in a real implementation,
      // you might want to convert FileDiff objects back to unified diff format
      return diffData.fileDiffs
        .map(fileDiff => {
          const header = `--- ${fileDiff.oldPath}\n+++ ${fileDiff.newPath}`
          const hunks = fileDiff.hunks
            .map(hunk => {
              const hunkHeader = hunk.header
              const lines = hunk.lines
                .map(line => {
                  switch (line.type) {
                    case 'added':
                      return `+${line.content}`
                    case 'removed':
                      return `-${line.content}`
                    case 'unchanged':
                      return ` ${line.content}`
                    default:
                      return line.content
                  }
                })
                .join('\n')
              return `${hunkHeader}\n${lines}`
            })
            .join('\n')
          return `${header}\n${hunks}`
        })
        .join('\n\n')
    }

    return diffData.rawDiff || ''
  }, [diffData])

  const ChangeIcon = getChangeTypeIcon(diffData.changeType)
  const changeTypeLabel = getChangeTypeLabel(diffData.changeType)
  const summaryText = renderSummary()

  return (
    <Card className={cn('border-border', className)} data-testid={TEST_IDS.diffPreview}>
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-md bg-background-secondary">
              <ChangeIcon className="w-4 h-4 text-foreground-secondary" />
            </div>
            <div>
              <h4 className="font-medium text-foreground text-sm">{changeTypeLabel}</h4>
              {summaryText && (
                <p className="text-xs text-foreground-secondary">{summaryText}</p>
              )}
              {diffData.summary && (
                <p className="text-xs text-foreground-secondary">{diffData.summary}</p>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Copy button */}
            {getDiffContent && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(getDiffContent)}
                className="px-2 py-1 h-auto"
              >
                <Copy className="w-3 h-3" />
              </Button>
            )}

            {/* Expand/collapse button */}
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="px-2 py-1 h-auto"
              >
                {isExpanded ? (
                  <>
                    <EyeOff className="w-3 h-3 mr-1" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="w-3 h-3 mr-1" />
                    Show
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <CardContent className="p-0">
          {/* Loading state */}
          {loading && (
            <div className="p-6 text-center">
              <Loader2 className="w-6 h-6 text-foreground-secondary animate-spin mx-auto mb-2" />
              <p className="text-sm text-foreground-secondary">Loading diff...</p>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="p-6 text-center">
              <AlertTriangle className="w-6 h-6 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-500">
                {typeof error === 'string' ? error : 'Failed to load diff'}
              </p>
            </div>
          )}

          {/* Command preview for command-execution type */}
          {!loading && !error && diffData.changeType === 'command-execution' && (
            <div className="p-4">
              {renderCommandPreview()}
            </div>
          )}

          {/* Diff viewer for file changes */}
          {!loading && !error && diffData.changeType !== 'command-execution' && getDiffContent && (
            <div className="border-t border-border">
              <DiffViewer
                diff={getDiffContent}
                mode={localViewMode}
                showModeSelector={true}
                showLineNumbers={showLineNumbers}
                highlighting={highlighting}
                maxHeight={maxHeight}
                showCopyButton={false} // We have our own copy button in the header
                onCopy={handleCopy}
                showFileHeader={false} // We have our own header
                collapsible={false} // We handle collapsible at this level
                defaultCollapsed={false}
                className="rounded-none border-0"
              />
            </div>
          )}

          {/* No diff content */}
          {!loading && !error && !getDiffContent && diffData.changeType !== 'command-execution' && (
            <div className="p-6 text-center">
              <FileText className="w-6 h-6 text-foreground-secondary mx-auto mb-2" />
              <p className="text-sm text-foreground-secondary">No diff content available</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}