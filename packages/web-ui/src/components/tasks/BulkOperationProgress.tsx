'use client'

import React, { useState } from 'react'
import { Button } from '../ui/Button'
import { ProgressIndicator } from '../ui/ProgressIndicator'
import { Badge } from '../ui/Badge'
import {
  BULK_TEST_IDS,
  BULK_ARIA_LABELS,
  CONFIRMATION_CONFIG,
  type BulkOperationProgress as BulkOperationProgressType,
  type BulkOperationType,
  type BulkOperationTaskResult,
} from '@/types/bulk-operations'
import { cn, truncateId } from '@/lib/utils'
import type { Task } from '@apexcli/core'
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Hash,
  X,
  AlertCircle,
} from 'lucide-react'

/**
 * Props for BulkOperationProgress component
 */
export interface BulkOperationProgressProps {
  /** Progress state for the bulk operation */
  progress: BulkOperationProgressType
  /** Type of operation being performed */
  operationType: BulkOperationType
  /** Callback when user closes the progress indicator */
  onClose?: () => void
  /** Whether to show detailed results */
  showDetails?: boolean
  /** Compact mode for smaller displays */
  compact?: boolean
  /** Optional className */
  className?: string
}

/**
 * Component to display individual task result
 */
function TaskResultItem({
  result,
  task,
  compact = false,
}: {
  result: BulkOperationTaskResult
  task?: Task
  compact?: boolean
}) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-3 p-3 rounded-md border',
      result.success
        ? 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800'
        : 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800',
      compact && 'p-2'
    )}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {result.success ? (
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'font-medium truncate',
            compact ? 'text-sm' : 'text-base',
            result.success ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
          )}>
            {task?.description || `Task ${truncateId(result.taskId, 8)}`}
          </p>
          {result.error && (
            <p className={cn(
              'text-red-600 dark:text-red-400 truncate',
              compact ? 'text-xs' : 'text-sm'
            )} title={result.error}>
              {result.error}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1 text-xs text-foreground-secondary">
            <span className="flex items-center gap-1">
              <Hash className="w-3 h-3" />
              {truncateId(result.taskId, 8)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * BulkOperationProgress component
 * Shows progress and results of a bulk operation
 */
export function BulkOperationProgress({
  progress,
  operationType,
  onClose,
  showDetails = false,
  compact = false,
  className,
}: BulkOperationProgressProps) {
  const [isExpanded, setIsExpanded] = useState(showDetails)

  const config = CONFIRMATION_CONFIG[operationType]
  const isComplete = progress.completedAt !== undefined
  const hasErrors = progress.failed > 0
  const hasResults = progress.results.length > 0

  // Calculate timing
  const duration = progress.completedAt
    ? Math.round((new Date(progress.completedAt).getTime() - new Date(progress.startedAt).getTime()) / 1000)
    : Math.round((new Date().getTime() - new Date(progress.startedAt).getTime()) / 1000)

  // Get status text
  const getStatusText = () => {
    if (progress.aborted) {
      return 'Operation aborted'
    }
    if (isComplete) {
      const successCount = progress.completed
      const failedCount = progress.failed
      if (failedCount === 0) {
        return `Successfully ${operationType === 'retry' ? 'restarted' : operationType === 'cancel' ? 'cancelled' : 'deleted'} ${successCount} task${successCount !== 1 ? 's' : ''}`
      } else if (successCount === 0) {
        return `Failed to ${operationType} ${failedCount} task${failedCount !== 1 ? 's' : ''}`
      } else {
        return `${successCount} succeeded, ${failedCount} failed`
      }
    }
    return `${config.title.replace('Tasks', '').trim()}ing ${progress.inProgress > 0 ? `${progress.inProgress} of ` : ''}${progress.total} task${progress.total !== 1 ? 's' : ''}...`
  }

  return (
    <div
      data-testid={BULK_TEST_IDS.progressBar}
      aria-label={BULK_ARIA_LABELS.operationProgress(progress.completed + progress.failed, progress.total)}
      className={cn(
        'bg-background border border-border rounded-lg shadow-sm animate-in slide-in-from-bottom-1 fade-in-0 duration-200',
        compact ? 'p-3' : 'p-4',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={cn(
            'w-2 h-2 rounded-full flex-shrink-0',
            progress.aborted
              ? 'bg-yellow-500'
              : isComplete
                ? hasErrors ? 'bg-red-500' : 'bg-green-500'
                : 'bg-blue-500 animate-pulse'
          )} />
          <p className={cn(
            'font-medium text-foreground truncate',
            compact ? 'text-sm' : 'text-base'
          )}>
            {getStatusText()}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {hasResults && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="gap-1 text-xs"
            >
              Details
              {isExpanded ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </Button>
          )}
          {onClose && isComplete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-1"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!isComplete && (
        <div className="mb-3">
          <ProgressIndicator
            value={progress.percentage}
            indeterminate={progress.inProgress > 0}
            variant={hasErrors ? 'warning' : 'default'}
            size={compact ? 'sm' : 'md'}
          />
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-foreground-secondary">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {duration}s
        </span>
        {progress.completed > 0 && (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-3 h-3" />
            {progress.completed} completed
          </span>
        )}
        {progress.failed > 0 && (
          <span className="flex items-center gap-1 text-red-600">
            <AlertCircle className="w-3 h-3" />
            {progress.failed} failed
          </span>
        )}
        {progress.inProgress > 0 && (
          <span className="flex items-center gap-1 text-blue-600">
            <Clock className="w-3 h-3" />
            {progress.inProgress} in progress
          </span>
        )}
      </div>

      {/* Detailed results */}
      {isExpanded && hasResults && (
        <div className="mt-4 space-y-2">
          <h4 className={cn(
            'font-medium text-foreground',
            compact ? 'text-sm' : 'text-base'
          )}>
            Results:
          </h4>
          <div className={cn(
            'max-h-60 space-y-2 overflow-y-auto',
            'border border-border rounded-md p-2'
          )}>
            {progress.results.map(result => (
              <TaskResultItem
                key={result.taskId}
                result={result}
                task={result.task}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Compact version of BulkOperationProgress
 */
export function CompactBulkOperationProgress(
  props: Omit<BulkOperationProgressProps, 'compact'>
) {
  return <BulkOperationProgress {...props} compact={true} />
}