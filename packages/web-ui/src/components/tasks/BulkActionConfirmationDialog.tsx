'use client'

import React, { useState } from 'react'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import { Badge } from '../ui/Badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/Dialog'
import {
  BULK_TEST_IDS,
  CONFIRMATION_CONFIG,
  type BulkActionConfirmationDialogProps,
  type BulkOperationType,
} from '@/types/bulk-operations'
import { cn, truncateId } from '@/lib/utils'
import type { Task } from '@apexcli/core'
import {
  AlertTriangle,
  XCircle,
  RotateCcw,
  Trash2,
  Clock,
  Hash,
} from 'lucide-react'

/**
 * Get icon for operation type
 */
function getOperationIcon(operationType: BulkOperationType) {
  switch (operationType) {
    case 'cancel':
      return XCircle
    case 'retry':
      return RotateCcw
    case 'delete':
      return Trash2
    default:
      return AlertTriangle
  }
}

/**
 * Task list item component for confirmation dialog
 */
function TaskListItem({ task, compact = false }: { task: Task; compact?: boolean }) {
  return (
    <div className={cn(
      'flex items-center justify-between gap-3 p-3 bg-background-secondary/50 rounded-md',
      compact && 'p-2'
    )}>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-medium text-foreground truncate',
          compact ? 'text-sm' : 'text-base'
        )}>
          {task.description}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-foreground-secondary">
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3" />
            {truncateId(task.id, 8)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(task.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
      <Badge status={task.status} />
    </div>
  )
}

/**
 * BulkActionConfirmationDialog component
 * Shows a confirmation dialog for destructive bulk operations
 * with a list of affected tasks and options.
 */
export function BulkActionConfirmationDialog({
  isOpen,
  operationType,
  affectedTasks,
  isSubmitting = false,
  error,
  onConfirm,
  onCancel,
  className,
}: BulkActionConfirmationDialogProps) {
  const [dontAskAgain, setDontAskAgain] = useState(false)

  const config = CONFIRMATION_CONFIG[operationType]
  const Icon = getOperationIcon(operationType)

  // Get warning message based on operation type
  const getWarningMessage = () => {
    switch (operationType) {
      case 'cancel':
        return 'Tasks that are currently running may leave work in an incomplete state.'
      case 'delete':
        return 'This action cannot be undone. All task history will be permanently lost.'
      case 'retry':
        return 'Failed or cancelled tasks will be restarted from the beginning.'
      default:
        return ''
    }
  }

  const warningMessage = getWarningMessage()

  const handleConfirm = () => {
    // Store "don't ask again" preference in sessionStorage if checked
    if (dontAskAgain) {
      sessionStorage.setItem(`bulk-${operationType}-no-confirm`, 'true')
    }
    onConfirm()
  }

  const handleCancel = () => {
    setDontAskAgain(false) // Reset state
    onCancel()
  }

  // Don't render if not open
  if (!isOpen) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent
        className={cn('max-w-2xl max-h-[80vh] flex flex-col', className)}
        data-testid={BULK_TEST_IDS.confirmationDialog}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={cn(
              'w-5 h-5',
              config.confirmVariant === 'danger' && 'text-red-500',
              config.confirmVariant === 'secondary' && 'text-foreground',
              config.confirmVariant === 'primary' && 'text-primary',
              config.confirmVariant === 'ghost' && 'text-foreground'
            )} />
            {config.title}
            <span className="text-base font-normal text-foreground-secondary">
              ({affectedTasks.length} task{affectedTasks.length !== 1 ? 's' : ''})
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-hidden">
          {/* Description */}
          <p className="text-foreground-secondary">
            {config.description}
          </p>

          {/* Warning message */}
          {warningMessage && (
            <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                {warningMessage}
              </p>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
          )}

          {/* Task list */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">
              Affected Tasks:
            </h4>
            <div className="max-h-60 border border-border rounded-md overflow-y-auto">
              <div className="p-2 space-y-2">
                {affectedTasks.map(task => (
                  <TaskListItem
                    key={task.id}
                    task={task}
                    compact={affectedTasks.length > 5}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Don't ask again option (only for destructive actions) */}
          {(operationType === 'cancel' || operationType === 'delete') && (
            <div className="flex items-center gap-2">
              <Checkbox
                checked={dontAskAgain}
                onChange={setDontAskAgain}
                label="Don't ask again for this session"
                disabled={isSubmitting}
                data-testid="dont-ask-again-checkbox"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={isSubmitting}
            data-testid={BULK_TEST_IDS.cancelDialogButton}
          >
            Cancel
          </Button>
          <Button
            variant={config.confirmVariant}
            onClick={handleConfirm}
            disabled={isSubmitting}
            data-testid={BULK_TEST_IDS.confirmButton}
            className="min-w-24"
          >
            {isSubmitting ? 'Processing...' : config.confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Hook to check if confirmation should be skipped for an operation type
 */
export function useSkipConfirmation(operationType: BulkOperationType): boolean {
  if (typeof window === 'undefined') return false

  const key = `bulk-${operationType}-no-confirm`
  return sessionStorage.getItem(key) === 'true'
}

/**
 * Clear all "don't ask again" preferences
 */
export function clearConfirmationPreferences(): void {
  if (typeof window === 'undefined') return

  const keys = ['bulk-cancel-no-confirm', 'bulk-delete-no-confirm']
  keys.forEach(key => sessionStorage.removeItem(key))
}