/**
 * Export Components Module
 *
 * This module exports components related to task data export functionality.
 *
 * @module @apex/web-ui/components/export
 */

// ExportDialog component implementation
export { ExportDialog } from './ExportDialog'

// Re-export types for convenience
export type {
  ExportDialogFormat,
  ExportFormatOption,
  ExportDateRange,
  DateRangePreset,
  DateRangePresetOption,
  ExportDialogOptions,
  ExportDialogProps,
  ExportDialogState,
  ExportDialogValidationErrors,
  ExportDialogResult,
} from '@/types/export-dialog'

export {
  EXPORT_FORMAT_OPTIONS,
  DATE_RANGE_PRESETS,
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_DIALOG_TEST_IDS,
  EXPORT_DIALOG_ARIA_LABELS,
  validateDateRange,
  validateTaskSelection,
  validateExportOptions,
  hasValidationErrors,
  getFormatOption,
  generateExportFilename,
  filterTasksByDateRange,
  filterTasksByIds,
  filterTasksByStatus,
  applyExportFilters,
} from '@/types/export-dialog'
