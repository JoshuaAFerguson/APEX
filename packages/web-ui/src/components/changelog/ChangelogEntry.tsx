/**
 * ChangelogEntry Component
 *
 * Displays a single changelog entry in git-style format with expandable diff preview.
 * Follows the design patterns from RecentActivityFeed and ActivityEventItem components.
 */

'use client'

import React, { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  Clock
} from 'lucide-react'
import { STATUS_STYLES, CHANGE_TYPE_STYLES, A11Y_LABELS } from './constants'
import { ChangelogDiffPreview } from './ChangelogDiffPreview'
import type { ChangelogEntryProps, ChangelogEntry } from '@/types/changelog'

/**
 * Format timestamp to relative time string
 */
function formatTimeAgo(timestamp: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - timestamp.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHour < 24) return `${diffHour}h ago`
  if (diffDay === 1) return 'yesterday'
  if (diffDay < 7) return `${diffDay}d ago`

  // Use locale date for older entries
  return timestamp.toLocaleDateString()
}

/**
 * Format file changes summary
 */
function formatChangesSummary(entry: ChangelogEntry): string {
  const { filesModified, linesAdded, linesRemoved } = entry.stats
  const changes = []

  if (linesAdded > 0) changes.push(`+${linesAdded}`)
  if (linesRemoved > 0) changes.push(`-${linesRemoved}`)

  return `${changes.join(' ')} across ${filesModified} file${filesModified !== 1 ? 's' : ''}`
}

export function ChangelogEntry({
  entry,
  isExpanded = false,
  onToggleExpand,
  showDiffToggle = true,
  onClick,
  compact = false,
  className,
}: ChangelogEntryProps) {
  const [localExpanded, setLocalExpanded] = useState(isExpanded)

  // Use controlled or local expansion state
  const expanded = onToggleExpand ? isExpanded : localExpanded
  const toggleExpanded = onToggleExpand || (() => setLocalExpanded(!localExpanded))

  // Get status styling
  const statusStyle = STATUS_STYLES[entry.status]
  const StatusIcon = statusStyle.icon

  // Handle entry click
  const handleEntryClick = useCallback((event: React.MouseEvent) => {
    // Don't trigger if clicking on interactive elements
    if ((event.target as Element).closest('button')) return

    onClick?.()
  }, [onClick])

  // Handle expand toggle
  const handleToggleExpand = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
    toggleExpanded()
  }, [toggleExpanded])

  // Format commit-style prefix based on workflow
  const getCommitPrefix = (workflow: string, status: string) => {
    if (status === 'failed') return 'fix'
    if (workflow.includes('feature')) return 'feat'
    if (workflow.includes('bug')) return 'fix'
    if (workflow.includes('refactor')) return 'refactor'
    if (workflow.includes('test')) return 'test'
    if (workflow.includes('docs')) return 'docs'
    return 'chore'
  }

  const commitPrefix = getCommitPrefix(entry.workflow, entry.status)
  const timeAgo = formatTimeAgo(entry.timestamp)
  const changesSummary = formatChangesSummary(entry)

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all duration-200',
        'hover:shadow-sm border-l-4',
        statusStyle.border,
        statusStyle.bg,
        compact && 'p-3',
        !compact && 'p-4',
        onClick && 'cursor-pointer hover:bg-muted/50',
        className
      )}
      onClick={handleEntryClick}
    >
      <div className="space-y-3">
        {/* Header with commit-style title and metadata */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Commit-style title with status icon */}
            <div className="flex items-center gap-2 mb-1">
              <StatusIcon
                className={cn('w-4 h-4', statusStyle.color)}
                aria-label={A11Y_LABELS.statusIcon(entry.status)}
              />
              <span className={cn('text-sm font-mono', statusStyle.color)}>
                {commitPrefix}
              </span>
              <h3 className="font-medium text-foreground truncate">
                {entry.title}
              </h3>
            </div>

            {/* Workflow and timing metadata */}
            <div className="flex items-center gap-3 text-sm text-foreground-secondary">
              <Badge variant="secondary" className={statusStyle.badge}>
                {entry.workflow}
              </Badge>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo}
              </span>
              {entry.git?.branchName && (
                <span className="flex items-center gap-1">
                  <GitBranch className="w-3 h-3" />
                  {entry.git.branchName}
                </span>
              )}
            </div>
          </div>

          {/* Status badge and PR link */}
          <div className="flex items-center gap-2">
            {entry.git?.prUrl && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(entry.git!.prUrl!, '_blank')
                }}
                title="View Pull Request"
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
            <Badge
              variant={entry.status === 'completed' ? 'success' : 'danger'}
              className="text-xs"
            >
              {entry.status}
            </Badge>
          </div>
        </div>

        {/* Changes summary and expand toggle */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-foreground-secondary">
            {changesSummary}
          </div>

          {showDiffToggle && entry.changes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleExpand}
              className="text-xs h-7"
              aria-label={expanded ? A11Y_LABELS.collapseEntry : A11Y_LABELS.expandEntry}
            >
              {expanded ? (
                <>
                  <ChevronDown className="w-3 h-3 mr-1" />
                  Hide changes
                </>
              ) : (
                <>
                  <ChevronRight className="w-3 h-3 mr-1" />
                  Show changes
                </>
              )}
            </Button>
          )}
        </div>

        {/* Expandable diff preview */}
        {expanded && entry.changes.length > 0 && (
          <div className="border-t pt-3">
            <ChangelogDiffPreview
              changes={entry.changes}
              showFileHeaders={true}
              maxHeight={300}
              defaultCollapsed={false}
            />
          </div>
        )}

        {/* File list when collapsed (compact view) */}
        {!expanded && entry.changes.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {entry.changes.slice(0, 3).map((change, index) => {
              const changeStyle = CHANGE_TYPE_STYLES[change.type]
              const ChangeIcon = changeStyle.icon

              return (
                <div
                  key={index}
                  className="flex items-center gap-1 text-xs text-foreground-secondary"
                  title={`${change.type}: ${change.path}`}
                >
                  <ChangeIcon className={cn('w-3 h-3', changeStyle.color)} />
                  <span className="truncate max-w-32">
                    {change.path.split('/').pop()}
                  </span>
                  {change.stats.additions > 0 && (
                    <span className="text-green-500">+{change.stats.additions}</span>
                  )}
                  {change.stats.deletions > 0 && (
                    <span className="text-red-500">-{change.stats.deletions}</span>
                  )}
                </div>
              )
            })}
            {entry.changes.length > 3 && (
              <span className="text-xs text-foreground-secondary">
                +{entry.changes.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}