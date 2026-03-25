/**
 * ExportDialog Type Definitions
 *
 * This module contains all TypeScript interfaces and types used by the
 * ExportDialog component for task data export functionality.
 *
 * ## Architecture Decision Record (ADR-020)
 *
 * ### Context
 * The APEX dashboard needs a user-friendly way to export task data in various
 * formats with filtering capabilities. Users should be able to:
 * - Select export format (JSON, CSV, Markdown)
 * - Filter by date range
 * - Optionally select specific tasks
 *
 * ### Decision
 * Implement an ExportDialog component with:
 * 1. Clear separation of types for format, date range, and task selection
 * 2. Integration with existing export formatters from @apexcli/core
 * 3. Consistent styling with existing dialog patterns
 * 4. Full accessibility support
 *
 * ### Consequences
 * - Unified export experience across the dashboard
 * - Type-safe configuration for export options
 * - Reusable patterns for future export functionality
 *
 * @module @apex/web-ui/types/export-dialog
 */

import type { Task } from '@apexcli/core'

// ============================================================================
// Export Format Types
// ============================================================================

/**
 * Supported export formats for the dialog
 * Limited to formats commonly used for task data export
 */
export type ExportDialogFormat = 'json' | 'csv' | 'markdown'

/**
 * Export format option for display in the UI
 */
export interface ExportFormatOption {
  /** Format identifier */
  value: ExportDialogFormat
  /** Display label */
  label: string
  /** Description of the format */
  description: string
  /** File extension (without dot) */
  extension: string
  /** MIME type for download */
  mimeType: string
}

/**
 * Available export format options with metadata
 */
export const EXPORT_FORMAT_OPTIONS: ExportFormatOption[] = [
  {
    value: 'json',
    label: 'JSON',
    description: 'Full task data with all fields and nested structures',
    extension: 'json',
    mimeType: 'application/json',
  },
  {
    value: 'csv',
    label: 'CSV',
    description: 'Tabular format for spreadsheet applications',
    extension: 'csv',
    mimeType: 'text/csv',
  },
  {
    value: 'markdown',
    label: 'Markdown',
    description: 'Human-readable documentation format',
    extension: 'md',
    mimeType: 'text/markdown',
  },
]

// ============================================================================
// Date Range Types
// ============================================================================

/**
 * Date range filter for export
 */
export interface ExportDateRange {
  /** Start date (inclusive) */
  startDate: Date | null
  /** End date (inclusive) */
  endDate: Date | null
}

/**
 * Predefined date range presets
 */
export type DateRangePreset =
  | 'all'
  | 'today'
  | 'yesterday'
  | 'last7days'
  | 'last30days'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom'

/**
 * Date range preset configuration
 */
export interface DateRangePresetOption {
  /** Preset identifier */
  value: DateRangePreset
  /** Display label */
  label: string
  /** Function to calculate date range */
  getRange: () => ExportDateRange
}

/**
 * Get today's date at start of day
 */
function getStartOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Get today's date at end of day
 */
function getEndOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/**
 * Available date range presets
 */
export const DATE_RANGE_PRESETS: DateRangePresetOption[] = [
  {
    value: 'all',
    label: 'All time',
    getRange: () => ({ startDate: null, endDate: null }),
  },
  {
    value: 'today',
    label: 'Today',
    getRange: () => {
      const today = new Date()
      return {
        startDate: getStartOfDay(today),
        endDate: getEndOfDay(today),
      }
    },
  },
  {
    value: 'yesterday',
    label: 'Yesterday',
    getRange: () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      return {
        startDate: getStartOfDay(yesterday),
        endDate: getEndOfDay(yesterday),
      }
    },
  },
  {
    value: 'last7days',
    label: 'Last 7 days',
    getRange: () => {
      const today = new Date()
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 6)
      return {
        startDate: getStartOfDay(weekAgo),
        endDate: getEndOfDay(today),
      }
    },
  },
  {
    value: 'last30days',
    label: 'Last 30 days',
    getRange: () => {
      const today = new Date()
      const monthAgo = new Date()
      monthAgo.setDate(monthAgo.getDate() - 29)
      return {
        startDate: getStartOfDay(monthAgo),
        endDate: getEndOfDay(today),
      }
    },
  },
  {
    value: 'thisMonth',
    label: 'This month',
    getRange: () => {
      const today = new Date()
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      return {
        startDate: getStartOfDay(firstDay),
        endDate: getEndOfDay(today),
      }
    },
  },
  {
    value: 'lastMonth',
    label: 'Last month',
    getRange: () => {
      const today = new Date()
      const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0)
      return {
        startDate: getStartOfDay(firstDayLastMonth),
        endDate: getEndOfDay(lastDayLastMonth),
      }
    },
  },
  {
    value: 'custom',
    label: 'Custom range',
    getRange: () => ({ startDate: null, endDate: null }),
  },
]

// ============================================================================
// Export Dialog State Types
// ============================================================================

/**
 * Export options selected by the user
 */
export interface ExportDialogOptions {
  /** Selected export format */
  format: ExportDialogFormat
  /** Date range filter */
  dateRange: ExportDateRange
  /** Selected date preset (for UI state) */
  datePreset: DateRangePreset
  /** Whether to filter by specific tasks */
  filterByTasks: boolean
  /** Selected task IDs (when filterByTasks is true) */
  selectedTaskIds: string[]
  /** Include archived tasks */
  includeArchived: boolean
  /** Include trashed tasks */
  includeTrashed: boolean
}

/**
 * Default export dialog options
 */
export const DEFAULT_EXPORT_OPTIONS: ExportDialogOptions = {
  format: 'json',
  dateRange: { startDate: null, endDate: null },
  datePreset: 'all',
  filterByTasks: false,
  selectedTaskIds: [],
  includeArchived: false,
  includeTrashed: false,
}

// ============================================================================
// Export Dialog Props
// ============================================================================

/**
 * Props for the ExportDialog component
 */
export interface ExportDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback when dialog should close */
  onClose: () => void
  /** Callback when export is initiated */
  onExport: (options: ExportDialogOptions) => Promise<void>
  /** Available tasks for selection (optional) */
  availableTasks?: Task[]
  /** Whether export is currently in progress */
  isExporting?: boolean
  /** Error message to display */
  error?: string | null
  /** Optional className for styling */
  className?: string
}

/**
 * Internal state for the ExportDialog component
 */
export interface ExportDialogState {
  /** Current export options */
  options: ExportDialogOptions
  /** Validation errors */
  validationErrors: ExportDialogValidationErrors
  /** Whether form has been submitted */
  hasSubmitted: boolean
}

/**
 * Validation errors for the export dialog
 */
export interface ExportDialogValidationErrors {
  /** Date range validation error */
  dateRange?: string
  /** Task selection validation error */
  taskSelection?: string
  /** General validation error */
  general?: string
}

// ============================================================================
// Export Result Types
// ============================================================================

/**
 * Result of an export operation from the dialog
 */
export interface ExportDialogResult {
  /** Whether the export was successful */
  success: boolean
  /** Filename for the exported file */
  filename: string
  /** Content of the exported file */
  content: string
  /** MIME type of the exported content */
  mimeType: string
  /** Number of tasks exported */
  taskCount: number
  /** Error message if export failed */
  error?: string
}

// ============================================================================
// Test IDs
// ============================================================================

/**
 * Test IDs for ExportDialog components
 */
export const EXPORT_DIALOG_TEST_IDS = {
  dialog: 'export-dialog',
  formatSelect: 'export-format-select',
  datePresetSelect: 'export-date-preset-select',
  startDateInput: 'export-start-date-input',
  endDateInput: 'export-end-date-input',
  taskFilterCheckbox: 'export-task-filter-checkbox',
  taskSelect: 'export-task-select',
  includeArchivedCheckbox: 'export-include-archived-checkbox',
  includeTrashedCheckbox: 'export-include-trashed-checkbox',
  exportButton: 'export-dialog-export-button',
  cancelButton: 'export-dialog-cancel-button',
  errorMessage: 'export-dialog-error',
} as const

/**
 * ARIA labels for accessibility
 */
export const EXPORT_DIALOG_ARIA_LABELS = {
  dialog: 'Export tasks dialog',
  formatSelect: 'Select export format',
  datePresetSelect: 'Select date range preset',
  startDateInput: 'Start date for export range',
  endDateInput: 'End date for export range',
  taskFilterCheckbox: 'Filter export by specific tasks',
  taskSelect: 'Select tasks to export',
  includeArchivedCheckbox: 'Include archived tasks in export',
  includeTrashedCheckbox: 'Include trashed tasks in export',
  exportButton: 'Export tasks',
  cancelButton: 'Cancel export',
} as const

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate date range selection
 */
export function validateDateRange(dateRange: ExportDateRange): string | undefined {
  if (dateRange.startDate && dateRange.endDate) {
    if (dateRange.startDate > dateRange.endDate) {
      return 'Start date must be before end date'
    }
  }
  return undefined
}

/**
 * Validate task selection
 */
export function validateTaskSelection(
  filterByTasks: boolean,
  selectedTaskIds: string[]
): string | undefined {
  if (filterByTasks && selectedTaskIds.length === 0) {
    return 'Please select at least one task'
  }
  return undefined
}

/**
 * Validate all export dialog options
 */
export function validateExportOptions(
  options: ExportDialogOptions
): ExportDialogValidationErrors {
  const errors: ExportDialogValidationErrors = {}

  const dateRangeError = validateDateRange(options.dateRange)
  if (dateRangeError) {
    errors.dateRange = dateRangeError
  }

  const taskSelectionError = validateTaskSelection(
    options.filterByTasks,
    options.selectedTaskIds
  )
  if (taskSelectionError) {
    errors.taskSelection = taskSelectionError
  }

  return errors
}

/**
 * Check if validation errors object has any errors
 */
export function hasValidationErrors(errors: ExportDialogValidationErrors): boolean {
  return Object.keys(errors).length > 0
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get format option by value
 */
export function getFormatOption(format: ExportDialogFormat): ExportFormatOption {
  const option = EXPORT_FORMAT_OPTIONS.find((opt) => opt.value === format)
  if (!option) {
    throw new Error(`Unknown export format: ${format}`)
  }
  return option
}

/**
 * Generate export filename with timestamp
 */
export function generateExportFilename(
  format: ExportDialogFormat,
  prefix: string = 'apex-tasks'
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const option = getFormatOption(format)
  return `${prefix}-${timestamp}.${option.extension}`
}

/**
 * Filter tasks by date range
 */
export function filterTasksByDateRange(
  tasks: Task[],
  dateRange: ExportDateRange
): Task[] {
  return tasks.filter((task) => {
    const taskDate = new Date(task.createdAt)

    if (dateRange.startDate && taskDate < dateRange.startDate) {
      return false
    }

    if (dateRange.endDate && taskDate > dateRange.endDate) {
      return false
    }

    return true
  })
}

/**
 * Filter tasks by ID list
 */
export function filterTasksByIds(tasks: Task[], taskIds: string[]): Task[] {
  if (taskIds.length === 0) {
    return tasks
  }
  const idSet = new Set(taskIds)
  return tasks.filter((task) => idSet.has(task.id))
}

/**
 * Filter tasks by archive/trash status
 */
export function filterTasksByStatus(
  tasks: Task[],
  includeArchived: boolean,
  includeTrashed: boolean
): Task[] {
  return tasks.filter((task) => {
    if (!includeArchived && task.archivedAt) {
      return false
    }
    if (!includeTrashed && task.trashedAt) {
      return false
    }
    return true
  })
}

/**
 * Apply all filters to tasks based on export options
 */
export function applyExportFilters(
  tasks: Task[],
  options: ExportDialogOptions
): Task[] {
  let filtered = tasks

  // Filter by status first
  filtered = filterTasksByStatus(
    filtered,
    options.includeArchived,
    options.includeTrashed
  )

  // Filter by date range
  filtered = filterTasksByDateRange(filtered, options.dateRange)

  // Filter by selected tasks if enabled
  if (options.filterByTasks) {
    filtered = filterTasksByIds(filtered, options.selectedTaskIds)
  }

  return filtered
}
