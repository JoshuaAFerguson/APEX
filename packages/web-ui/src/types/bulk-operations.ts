/**
 * Type definitions for Bulk Task Operations
 *
 * This module contains all TypeScript interfaces and types used by the
 * bulk task operations feature, including selection state, operation
 * progress, and configuration options.
 */

import type { Task, TaskStatus } from '@apexcli/core'

// ============================================================================
// Selection State Types
// ============================================================================

/**
 * Selection mode indicating the current state of task selection
 */
export type SelectionMode = 'none' | 'some' | 'all'

/**
 * State for bulk task selection
 */
export interface BulkSelectionState {
  /** Set of currently selected task IDs */
  selectedTaskIds: Set<string>
  /** Current selection mode */
  selectionMode: SelectionMode
  /** Whether the "select all" checkbox is checked */
  isSelectAllChecked: boolean
  /** Whether the "select all" checkbox is in indeterminate state */
  isIndeterminate: boolean
}

/**
 * Actions available on the bulk selection context
 */
export interface BulkSelectionActions {
  /** Toggle selection for a single task */
  toggleTaskSelection: (taskId: string) => void
  /** Select all tasks from a list of IDs */
  selectAll: (taskIds: string[]) => void
  /** Deselect all tasks */
  deselectAll: () => void
  /** Check if a task is selected */
  isSelected: (taskId: string) => boolean
  /** Get array of selected task IDs */
  getSelectedTasks: () => string[]
  /** Get count of selected tasks */
  getSelectedCount: () => number
  /** Select multiple specific tasks */
  selectTasks: (taskIds: string[]) => void
  /** Deselect specific tasks */
  deselectTasks: (taskIds: string[]) => void
}

/**
 * Combined context value for bulk selection
 */
export interface BulkSelectionContextValue extends BulkSelectionActions {
  state: BulkSelectionState
}

// ============================================================================
// Bulk Operation Types
// ============================================================================

/**
 * Types of bulk operations that can be performed
 */
export type BulkOperationType = 'cancel' | 'retry' | 'delete'

/**
 * Result of a single task operation within a bulk operation
 */
export interface BulkOperationTaskResult {
  /** ID of the task that was operated on */
  taskId: string
  /** Whether the operation succeeded */
  success: boolean
  /** Error message if the operation failed */
  error?: string
  /** Updated task object if operation succeeded */
  task?: Task
}

/**
 * Progress state for a bulk operation
 */
export interface BulkOperationProgress {
  /** Total number of tasks in the operation */
  total: number
  /** Number of successfully completed operations */
  completed: number
  /** Number of failed operations */
  failed: number
  /** Number of operations currently in progress */
  inProgress: number
  /** Percentage complete (0-100) */
  percentage: number
  /** Individual results for each task */
  results: BulkOperationTaskResult[]
  /** Whether the operation was aborted */
  aborted: boolean
  /** Timestamp when the operation started */
  startedAt: Date
  /** Timestamp when the operation completed (if finished) */
  completedAt?: Date
}

/**
 * Configuration options for bulk operations
 */
export interface BulkOperationOptions {
  /** Maximum number of concurrent API calls (default: 5) */
  concurrency?: number
  /** Callback for progress updates */
  onProgress?: (progress: BulkOperationProgress) => void
  /** AbortSignal for cancellation */
  signal?: AbortSignal
  /** Delay between operations in ms (for rate limiting) */
  delayBetweenOps?: number
  /** Number of retries for failed operations */
  retryCount?: number
  /** Whether to stop on first error */
  stopOnError?: boolean
}

/**
 * State returned by useBulkTaskOperations hook
 */
export interface BulkTaskOperationsState {
  /** Whether any bulk operation is currently in progress */
  isOperating: boolean
  /** Current operation progress (null if not operating) */
  progress: BulkOperationProgress | null
  /** Type of operation currently running */
  currentOperation: BulkOperationType | null
  /** Last error encountered */
  lastError: Error | null
}

/**
 * Actions returned by useBulkTaskOperations hook
 */
export interface BulkTaskOperationsActions {
  /** Cancel multiple tasks */
  bulkCancel: (taskIds: string[], options?: BulkOperationOptions) => Promise<BulkOperationTaskResult[]>
  /** Retry multiple tasks */
  bulkRetry: (taskIds: string[], options?: BulkOperationOptions) => Promise<BulkOperationTaskResult[]>
  /** Delete multiple tasks */
  bulkDelete: (taskIds: string[], options?: BulkOperationOptions) => Promise<BulkOperationTaskResult[]>
  /** Abort the current operation */
  abort: () => void
  /** Reset operation state */
  reset: () => void
}

/**
 * Complete return type for useBulkTaskOperations hook
 */
export interface UseBulkTaskOperationsReturn extends BulkTaskOperationsState, BulkTaskOperationsActions {}

// ============================================================================
// Confirmation Dialog Types
// ============================================================================

/**
 * Props for bulk action confirmation dialog
 */
export interface BulkActionConfirmationDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Type of operation being confirmed */
  operationType: BulkOperationType
  /** Tasks that will be affected */
  affectedTasks: Task[]
  /** Whether the operation is currently in progress */
  isSubmitting?: boolean
  /** Error message if operation failed */
  error?: string | null
  /** Callback when user confirms the action */
  onConfirm: () => void
  /** Callback when user cancels/closes the dialog */
  onCancel: () => void
  /** Optional className for styling */
  className?: string
}

/**
 * Configuration for confirmation dialog behavior
 */
export interface ConfirmationDialogConfig {
  /** Whether to show confirmation for this operation type */
  requireConfirmation: boolean
  /** Title for the confirmation dialog */
  title: string
  /** Description/message for the confirmation dialog */
  description: string
  /** Text for the confirm button */
  confirmText: string
  /** Variant for the confirm button */
  confirmVariant: 'primary' | 'secondary' | 'ghost' | 'danger'
}

// ============================================================================
// Toolbar Types
// ============================================================================

/**
 * Props for bulk action toolbar
 */
export interface BulkActionToolbarProps {
  /** Currently visible/filtered task IDs (for select all) */
  visibleTaskIds: string[]
  /** All tasks for action eligibility calculation */
  tasks: Task[]
  /** Callback for bulk cancel operation */
  onBulkCancel: (taskIds: string[]) => Promise<void>
  /** Callback for bulk retry operation */
  onBulkRetry: (taskIds: string[]) => Promise<void>
  /** Callback for bulk delete operation */
  onBulkDelete: (taskIds: string[]) => Promise<void>
  /** Current operation progress */
  progress?: BulkOperationProgress | null
  /** Whether any operation is in progress */
  isOperating?: boolean
  /** Compact mode for smaller viewports */
  compact?: boolean
  /** Optional className for styling */
  className?: string
}

/**
 * Action button state
 */
export interface BulkActionButtonState {
  /** Whether the action is available */
  enabled: boolean
  /** Number of selected tasks that can receive this action */
  count: number
  /** Task IDs that can receive this action */
  eligibleTaskIds: string[]
}

// ============================================================================
// Task Selection Helpers
// ============================================================================

/**
 * Eligibility checker type for determining if a task can receive an action
 */
export type TaskActionEligibilityChecker = (task: Task) => boolean

/**
 * Map of action types to their eligibility checkers
 */
export interface ActionEligibilityMap {
  cancel: TaskActionEligibilityChecker
  retry: TaskActionEligibilityChecker
  delete: TaskActionEligibilityChecker
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default options for bulk operations
 */
export const BULK_OPERATION_DEFAULTS = {
  /** Default maximum concurrent API calls */
  concurrency: 5,
  /** Default delay between operations in ms */
  delayBetweenOps: 0,
  /** Default number of retries */
  retryCount: 0,
  /** Default stop on error behavior */
  stopOnError: false,
} as const

/**
 * Status groups for action eligibility
 */
export const CANCELLABLE_STATUSES: TaskStatus[] = [
  'pending',
  'queued',
  'in-progress',
  'planning',
]

export const RETRYABLE_STATUSES: TaskStatus[] = [
  'failed',
  'cancelled',
]

export const DELETABLE_STATUSES: TaskStatus[] = [
  'completed',
  'failed',
  'cancelled',
]

/**
 * Configuration for each operation type's confirmation dialog
 */
export const CONFIRMATION_CONFIG: Record<BulkOperationType, ConfirmationDialogConfig> = {
  cancel: {
    requireConfirmation: true,
    title: 'Cancel Tasks',
    description: 'This will stop the selected tasks. Tasks that are already running may leave work in an incomplete state.',
    confirmText: 'Cancel Tasks',
    confirmVariant: 'danger',
  },
  retry: {
    requireConfirmation: false,
    title: 'Retry Tasks',
    description: 'This will restart the selected failed or cancelled tasks.',
    confirmText: 'Retry Tasks',
    confirmVariant: 'primary',
  },
  delete: {
    requireConfirmation: true,
    title: 'Delete Tasks',
    description: 'This will permanently delete the selected tasks and their history. This action cannot be undone.',
    confirmText: 'Delete Tasks',
    confirmVariant: 'danger',
  },
}

/**
 * Test IDs for bulk operation components
 */
export const BULK_TEST_IDS = {
  toolbar: 'bulk-action-toolbar',
  selectAllCheckbox: 'bulk-select-all-checkbox',
  cancelButton: 'bulk-cancel-button',
  retryButton: 'bulk-retry-button',
  deleteButton: 'bulk-delete-button',
  progressBar: 'bulk-operation-progress',
  confirmationDialog: 'bulk-confirmation-dialog',
  confirmButton: 'bulk-confirm-button',
  cancelDialogButton: 'bulk-cancel-dialog-button',
  taskCheckbox: (taskId: string) => `task-checkbox-${taskId}`,
} as const

/**
 * ARIA labels for accessibility
 */
export const BULK_ARIA_LABELS = {
  toolbar: 'Bulk task actions',
  selectAll: 'Select all visible tasks',
  cancelSelected: (count: number) => `Cancel ${count} selected task${count !== 1 ? 's' : ''}`,
  retrySelected: (count: number) => `Retry ${count} selected task${count !== 1 ? 's' : ''}`,
  deleteSelected: (count: number) => `Delete ${count} selected task${count !== 1 ? 's' : ''}`,
  taskSelection: (description: string, selected: boolean) =>
    `${selected ? 'Deselect' : 'Select'} task: ${description}`,
  operationProgress: (completed: number, total: number) =>
    `Bulk operation progress: ${completed} of ${total} tasks completed`,
} as const
