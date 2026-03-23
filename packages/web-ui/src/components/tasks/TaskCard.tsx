import React from 'react'
import { Badge } from '../ui/Badge'
import { ProgressIndicator } from '../ui/ProgressIndicator'
import { Spinner } from '../ui/Spinner'
import { Card, CardContent } from '../ui/Card'
import { Checkbox } from '../ui/Checkbox'
import {
  truncateId,
  getElapsedTime,
  isTaskRunning,
  getProgressVariant,
  cn,
} from '../../lib/utils'
import { useBulkSelectionOptional } from './BulkSelectionContext'
import { BULK_TEST_IDS, BULK_ARIA_LABELS } from '@/types/bulk-operations'
import type { Task } from '@apexcli/core'
import {
  Clock,
  Hash,
  GitBranch,
  Layers,
  Play,
  XCircle,
  RotateCcw,
  MessageSquare,
} from 'lucide-react'

export interface TaskCardProps {
  /** The task to display */
  task: Task
  /** Optional callback when user wants to view task details */
  onViewDetails?: (taskId: string) => void
  /** Whether to show a compact version of the card */
  compact?: boolean
  /** Whether to show progress indicator */
  showProgress?: boolean
  /** Optional callback to cancel a task */
  onCancel?: (taskId: string) => Promise<void>
  /** Optional callback to retry a task */
  onRetry?: (taskId: string) => Promise<void>
  /** Whether an action is currently loading for this task */
  isActionLoading?: boolean
  /** Optional callback to inject context into the task */
  onInjectContext?: (taskId: string) => void
  /** Whether bulk selection is enabled (overrides context) */
  selectable?: boolean
}

/**
 * TaskCard component displays task information including:
 * - Task description and status
 * - Progress indicator for running tasks
 * - Elapsed time for active tasks
 * - Workflow and stage information
 * - Subtask count if applicable
 */
export function TaskCard({
  task,
  onViewDetails,
  compact = false,
  showProgress = true,
  onCancel,
  onRetry,
  isActionLoading = false,
  onInjectContext,
  selectable,
}: TaskCardProps) {
  // Check if bulk selection is available and enabled
  const bulkSelection = useBulkSelectionOptional()
  const isBulkSelectionEnabled = selectable ?? (bulkSelection !== null)
  const isSelected = bulkSelection?.isSelected(task.id) ?? false

  const isRunning = isTaskRunning(task.status)
  const hasSubtasks = task.subtaskIds && task.subtaskIds.length > 0
  const progressVariant = getProgressVariant(task.status)

  // Calculate elapsed time for running tasks
  const elapsedTime = isRunning && task.createdAt
    ? getElapsedTime(task.createdAt)
    : null

  // Calculate progress percentage (placeholder logic - in real implementation this would come from task progress)
  const getProgressValue = (): number => {
    switch (task.status) {
      case 'completed':
        return 100
      case 'failed':
      case 'cancelled':
        return 0
      case 'planning':
        return 20
      case 'in-progress':
        return 50 // This would be dynamic based on actual progress
      default:
        return 0
    }
  }

  const handleCardClick = () => {
    if (onViewDetails) {
      onViewDetails(task.id)
    }
  }

  const handleSelectionChange = (selected: boolean) => {
    if (bulkSelection) {
      bulkSelection.toggleTaskSelection(task.id)
    }
  }

  const progressValue = getProgressValue()

  // Determine which actions are available for the task
  const canCancel = (task.status === 'pending' || task.status === 'queued' || isRunning) && onCancel
  const canRetry = (task.status === 'failed' || task.status === 'cancelled') && onRetry
  const canInjectContext = (
    task.status === 'in-progress' ||
    task.status === 'planning' ||
    task.status === 'pending' ||
    task.status === 'queued' ||
    task.status === 'waiting-approval' ||
    task.status === 'paused'
  ) && onInjectContext

  return (
    <Card
      data-testid={`task-card-${task.id}`}
      data-task-status={task.status}
      data-compact={compact}
      data-show-progress={showProgress}
      className={cn(
        'transition-all duration-200 hover:shadow-md cursor-pointer relative group',
        'border-l-4',
        isRunning && 'border-l-apex-500',
        task.status === 'completed' && 'border-l-green-500',
        task.status === 'failed' && 'border-l-red-500',
        compact ? 'p-3' : 'p-4'
      )}
      onClick={handleCardClick}
    >
      <CardContent className={cn('p-0', compact && 'space-y-2')}>
        {/* Selection checkbox - shows when bulk selection is enabled */}
        {isBulkSelectionEnabled && (
          <div className="absolute left-2 top-2 z-10">
            <div
              className="flex items-center justify-center w-6 h-6 bg-background/90 backdrop-blur-sm rounded border border-border/50"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={(e) => handleSelectionChange(e.target.checked)}
                data-testid={BULK_TEST_IDS.taskCheckbox(task.id)}
                aria-label={BULK_ARIA_LABELS.taskSelection(task.description, isSelected)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
              />
            </div>
          </div>
        )}

        {/* Action overlay - shows on hover */}
        {(canCancel || canRetry || canInjectContext) && (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {canInjectContext && (
              <button
                onClick={(e) => { e.stopPropagation(); onInjectContext!(task.id); }}
                className="p-1.5 rounded hover:bg-apex-500/10 text-foreground-secondary hover:text-apex-500 disabled:opacity-50"
                title="Inject context"
                disabled={isActionLoading}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            )}
            {canCancel && (
              <button
                onClick={(e) => { e.stopPropagation(); onCancel!(task.id); }}
                className="p-1.5 rounded hover:bg-red-500/10 text-foreground-secondary hover:text-red-500 disabled:opacity-50"
                title="Cancel task"
                disabled={isActionLoading}
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
            {canRetry && (
              <button
                onClick={(e) => { e.stopPropagation(); onRetry!(task.id); }}
                className="p-1.5 rounded hover:bg-green-500/10 text-foreground-secondary hover:text-green-500 disabled:opacity-50"
                title="Retry task"
                disabled={isActionLoading}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Header with title and status */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className={cn(
            'flex-1 min-w-0',
            isBulkSelectionEnabled && 'ml-8' // Add left margin when checkbox is present
          )}>
            <h4 className={cn(
              'font-medium text-foreground line-clamp-2 leading-tight',
              compact ? 'text-sm' : 'text-base'
            )}>
              {task.description}
            </h4>

            {/* Current stage for running tasks */}
            {task.currentStage && isRunning && (
              <p className="text-xs text-foreground-secondary mt-1 truncate">
                Stage: <span className="font-medium">{task.currentStage}</span>
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge status={task.status} />
            {isRunning && (
              <Spinner size="sm" />
            )}
          </div>
        </div>

        {/* Progress indicator for active tasks */}
        {showProgress && (isRunning || task.status === 'completed') && (
          <div className="mb-3">
            <ProgressIndicator
              value={progressValue}
              indeterminate={isRunning}
              variant={progressVariant}
              size={compact ? 'sm' : 'md'}
            />
          </div>
        )}

        {/* Task metadata */}
        <div className={cn(
          'flex flex-wrap items-center gap-3 text-xs text-foreground-secondary',
          compact && 'gap-2'
        )}>
          {/* Task ID */}
          <span className="flex items-center gap-1" title="Task ID">
            <Hash className="w-3 h-3" />
            {truncateId(task.id, compact ? 6 : 8)}
          </span>

          {/* Workflow */}
          <span className="flex items-center gap-1" title="Workflow">
            <GitBranch className="w-3 h-3" />
            {task.workflow}
          </span>

          {/* Subtask count */}
          {hasSubtasks && (
            <span className="flex items-center gap-1 text-apex-500" title="Subtasks">
              <Layers className="w-3 h-3" />
              {task.subtaskIds?.length}
            </span>
          )}

          {/* Elapsed time for running tasks */}
          {elapsedTime && (
            <span className="flex items-center gap-1" title="Running time">
              <Play className="w-3 h-3" />
              {elapsedTime}
            </span>
          )}

          {/* Created time for non-running tasks */}
          {!isRunning && (
            <span className="flex items-center gap-1" title="Created">
              <Clock className="w-3 h-3" />
              {getElapsedTime(task.createdAt)} ago
            </span>
          )}
        </div>

        {/* Error display */}
        {task.error && (
          <div className="mt-3 text-xs text-red-400 bg-red-500/10 rounded px-2 py-1 truncate" title={task.error}>
            Error: {task.error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}