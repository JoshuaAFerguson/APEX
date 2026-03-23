'use client'

import React, { useMemo } from 'react'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import { useBulkSelection } from './BulkSelectionContext'
import {
  BULK_TEST_IDS,
  BULK_ARIA_LABELS,
  CANCELLABLE_STATUSES,
  RETRYABLE_STATUSES,
  DELETABLE_STATUSES,
  type BulkActionToolbarProps,
  type BulkActionButtonState,
  type TaskActionEligibilityChecker,
} from '@/types/bulk-operations'
import { cn } from '@/lib/utils'
import type { Task } from '@apexcli/core'
import {
  Square,
  SquareCheck,
  SquareCheckBig,
  XCircle,
  RotateCcw,
  Trash2,
} from 'lucide-react'

/**
 * Action eligibility checkers
 */
const actionEligibilityCheckers: Record<string, TaskActionEligibilityChecker> = {
  cancel: (task: Task) => CANCELLABLE_STATUSES.includes(task.status as any),
  retry: (task: Task) => RETRYABLE_STATUSES.includes(task.status as any),
  delete: (task: Task) => DELETABLE_STATUSES.includes(task.status as any),
}

/**
 * Calculate button states based on selected tasks
 */
function calculateButtonStates(
  selectedTasks: Task[],
  allTasks: Task[]
): Record<string, BulkActionButtonState> {
  const states: Record<string, BulkActionButtonState> = {}

  for (const [actionType, checker] of Object.entries(actionEligibilityCheckers)) {
    const eligibleTasks = selectedTasks.filter(checker)
    states[actionType] = {
      enabled: eligibleTasks.length > 0,
      count: eligibleTasks.length,
      eligibleTaskIds: eligibleTasks.map(task => task.id),
    }
  }

  return states
}

/**
 * BulkActionToolbar component
 * Shows when tasks are selected and provides bulk action buttons
 */
export function BulkActionToolbar({
  visibleTaskIds,
  tasks,
  onBulkCancel,
  onBulkRetry,
  onBulkDelete,
  progress,
  isOperating = false,
  compact = false,
  className,
}: BulkActionToolbarProps) {
  const bulkSelection = useBulkSelection()
  const {
    state: { selectedTaskIds, isSelectAllChecked, isIndeterminate },
    selectAll,
    deselectAll,
    getSelectedCount,
  } = bulkSelection

  const selectedCount = getSelectedCount()

  // Get selected and visible tasks
  const selectedTasks = useMemo(() => {
    return tasks.filter(task => selectedTaskIds.has(task.id))
  }, [tasks, selectedTaskIds])

  const visibleTasks = useMemo(() => {
    const visibleSet = new Set(visibleTaskIds)
    return tasks.filter(task => visibleSet.has(task.id))
  }, [tasks, visibleTaskIds])

  // Calculate button states
  const buttonStates = useMemo(() => {
    return calculateButtonStates(selectedTasks, tasks)
  }, [selectedTasks, tasks])

  // Handle select all toggle
  const handleSelectAllToggle = () => {
    if (isSelectAllChecked || isIndeterminate) {
      deselectAll()
    } else {
      selectAll(visibleTaskIds)
    }
  }

  // Handle bulk operations
  const handleBulkCancel = async () => {
    if (buttonStates.cancel.enabled) {
      await onBulkCancel(buttonStates.cancel.eligibleTaskIds)
    }
  }

  const handleBulkRetry = async () => {
    if (buttonStates.retry.enabled) {
      await onBulkRetry(buttonStates.retry.eligibleTaskIds)
    }
  }

  const handleBulkDelete = async () => {
    if (buttonStates.delete.enabled) {
      await onBulkDelete(buttonStates.delete.eligibleTaskIds)
    }
  }

  // Don't show toolbar if no tasks are selected and not operating
  if (selectedCount === 0 && !isOperating) {
    return null
  }

  return (
    <div
      data-testid={BULK_TEST_IDS.toolbar}
      aria-label={BULK_ARIA_LABELS.toolbar}
      className={cn(
        'flex items-center justify-between gap-4 p-3 bg-background border border-border rounded-md',
        'shadow-sm animate-in slide-in-from-bottom-1 fade-in-0 duration-200',
        compact && 'p-2 gap-2',
        className
      )}
    >
      {/* Left side - Selection controls */}
      <div className="flex items-center gap-3">
        {/* Select All Checkbox */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSelectAllToggle}
            disabled={isOperating || visibleTaskIds.length === 0}
            data-testid={BULK_TEST_IDS.selectAllCheckbox}
            aria-label={BULK_ARIA_LABELS.selectAll}
            className={cn(
              'flex items-center justify-center w-5 h-5 rounded border',
              'hover:bg-background-secondary transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isSelectAllChecked && 'bg-primary border-primary text-primary-foreground',
              isIndeterminate && 'bg-primary/10 border-primary'
            )}
          >
            {isSelectAllChecked ? (
              <SquareCheckBig className="w-4 h-4" />
            ) : isIndeterminate ? (
              <SquareCheck className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
          <span className={cn('text-sm font-medium text-foreground', compact && 'text-xs')}>
            {selectedCount > 0 ? `${selectedCount} selected` : 'Select all'}
          </span>
        </div>
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center gap-2">
        {/* Cancel Button */}
        <Button
          variant="secondary"
          size={compact ? 'sm' : 'md'}
          disabled={!buttonStates.cancel.enabled || isOperating}
          onClick={handleBulkCancel}
          data-testid={BULK_TEST_IDS.cancelButton}
          aria-label={BULK_ARIA_LABELS.cancelSelected(buttonStates.cancel.count)}
          className="gap-1"
        >
          <XCircle className="w-4 h-4" />
          {!compact && 'Cancel'}
          {buttonStates.cancel.count > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-600 rounded">
              {buttonStates.cancel.count}
            </span>
          )}
        </Button>

        {/* Retry Button */}
        <Button
          variant="secondary"
          size={compact ? 'sm' : 'md'}
          disabled={!buttonStates.retry.enabled || isOperating}
          onClick={handleBulkRetry}
          data-testid={BULK_TEST_IDS.retryButton}
          aria-label={BULK_ARIA_LABELS.retrySelected(buttonStates.retry.count)}
          className="gap-1"
        >
          <RotateCcw className="w-4 h-4" />
          {!compact && 'Retry'}
          {buttonStates.retry.count > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-600 rounded">
              {buttonStates.retry.count}
            </span>
          )}
        </Button>

        {/* Delete Button */}
        <Button
          variant="secondary"
          size={compact ? 'sm' : 'md'}
          disabled={!buttonStates.delete.enabled || isOperating}
          onClick={handleBulkDelete}
          data-testid={BULK_TEST_IDS.deleteButton}
          aria-label={BULK_ARIA_LABELS.deleteSelected(buttonStates.delete.count)}
          className="gap-1 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
        >
          <Trash2 className="w-4 h-4" />
          {!compact && 'Delete'}
          {buttonStates.delete.count > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-red-500/20 text-red-600 rounded">
              {buttonStates.delete.count}
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}

/**
 * Compact version of BulkActionToolbar for smaller spaces
 */
export function CompactBulkActionToolbar(props: BulkActionToolbarProps) {
  return <BulkActionToolbar {...props} compact={true} />
}