'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
} from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import {
  Download,
  Calendar,
  FileText,
  Database,
  Code,
  Filter,
  AlertCircle,
  X
} from 'lucide-react'
import type {
  ExportDialogProps,
  ExportDialogState,
  ExportDialogOptions,
  ExportDialogFormat,
  DateRangePreset,
  ExportDateRange,
} from '@/types/export-dialog'
import {
  DEFAULT_EXPORT_OPTIONS,
  EXPORT_FORMAT_OPTIONS,
  DATE_RANGE_PRESETS,
  validateExportOptions,
  hasValidationErrors,
  EXPORT_DIALOG_TEST_IDS,
  EXPORT_DIALOG_ARIA_LABELS,
} from '@/types/export-dialog'

/**
 * ExportDialog component for exporting task data in various formats
 *
 * Features:
 * - Format selection (JSON, CSV, Markdown)
 * - Date range filtering with presets and custom dates
 * - Optional task selection
 * - Archive/trash status filtering
 * - Full validation and error handling
 * - Accessibility support
 */
export function ExportDialog({
  isOpen,
  onClose,
  onExport,
  availableTasks = [],
  isExporting = false,
  error = null,
  className,
}: ExportDialogProps) {
  // Component state
  const [state, setState] = useState<ExportDialogState>({
    options: { ...DEFAULT_EXPORT_OPTIONS },
    validationErrors: {},
    hasSubmitted: false,
  })

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setState({
        options: { ...DEFAULT_EXPORT_OPTIONS },
        validationErrors: {},
        hasSubmitted: false,
      })
    }
  }, [isOpen])

  // Update options helper
  const updateOptions = (updates: Partial<ExportDialogOptions>) => {
    setState(prev => ({
      ...prev,
      options: { ...prev.options, ...updates },
      // Clear validation errors when user makes changes
      validationErrors: prev.hasSubmitted ? validateExportOptions({ ...prev.options, ...updates }) : {},
    }))
  }

  // Handle date preset change
  const handleDatePresetChange = (preset: DateRangePreset) => {
    const presetOption = DATE_RANGE_PRESETS.find(p => p.value === preset)
    if (!presetOption) return

    const dateRange = presetOption.getRange()
    updateOptions({
      datePreset: preset,
      dateRange,
    })
  }

  // Handle custom date range change
  const handleDateRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    const date = value ? new Date(value) : null
    updateOptions({
      datePreset: 'custom',
      dateRange: {
        ...state.options.dateRange,
        [field]: date,
      },
    })
  }

  // Handle task selection change
  const handleTaskSelectionChange = (taskId: string, selected: boolean) => {
    const currentIds = state.options.selectedTaskIds
    const newIds = selected
      ? [...currentIds, taskId]
      : currentIds.filter(id => id !== taskId)

    updateOptions({
      selectedTaskIds: newIds,
    })
  }

  // Handle select all tasks
  const handleSelectAllTasks = (selected: boolean) => {
    updateOptions({
      selectedTaskIds: selected ? availableTasks.map(t => t.id) : [],
    })
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setState(prev => ({ ...prev, hasSubmitted: true }))

    const validationErrors = validateExportOptions(state.options)
    setState(prev => ({ ...prev, validationErrors }))

    if (hasValidationErrors(validationErrors)) {
      return
    }

    try {
      await onExport(state.options)
    } catch (err) {
      // Error handling is done by parent component
      console.error('Export failed:', err)
    }
  }

  // Format icons
  const getFormatIcon = (format: ExportDialogFormat) => {
    switch (format) {
      case 'json':
        return <Code className="w-4 h-4" />
      case 'csv':
        return <Database className="w-4 h-4" />
      case 'markdown':
        return <FileText className="w-4 h-4" />
    }
  }

  // Format date for input
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return ''
    return date.toISOString().split('T')[0]
  }

  const { options, validationErrors } = state
  const hasTasksAvailable = availableTasks.length > 0
  const selectedTaskCount = options.selectedTaskIds.length
  const allTasksSelected = hasTasksAvailable && selectedTaskCount === availableTasks.length

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={`max-w-2xl max-h-[90vh] overflow-y-auto ${className || ''}`}
        data-testid={EXPORT_DIALOG_TEST_IDS.dialog}
        aria-label={EXPORT_DIALOG_ARIA_LABELS.dialog}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-apex-500/10">
              <Download className="w-5 h-5 text-apex-500" />
            </div>
            Export Tasks
          </DialogTitle>
          <DialogDescription>
            Choose format and filtering options for your task data export.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Error Alert */}
          {error && (
            <Alert
              className="border-red-200 bg-red-50"
              data-testid={EXPORT_DIALOG_TEST_IDS.errorMessage}
            >
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Export Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {EXPORT_FORMAT_OPTIONS.map((format) => (
                <button
                  key={format.value}
                  type="button"
                  onClick={() => updateOptions({ format: format.value })}
                  className={`p-4 rounded-lg border text-left transition-colors ${
                    options.format === format.value
                      ? 'border-apex-500 bg-apex-500/10'
                      : 'border-border hover:border-apex-500/50 hover:bg-background-tertiary'
                  }`}
                  data-testid={`${EXPORT_DIALOG_TEST_IDS.formatSelect}-${format.value}`}
                  aria-label={`${EXPORT_DIALOG_ARIA_LABELS.formatSelect} - ${format.label}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {getFormatIcon(format.value)}
                    <span className="font-medium text-sm">{format.label}</span>
                  </div>
                  <p className="text-xs text-foreground-secondary">
                    {format.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">
              <Calendar className="inline w-4 h-4 mr-1" />
              Date Range
            </label>

            {/* Date Presets */}
            <div className="space-y-3">
              <select
                value={options.datePreset}
                onChange={(e) => handleDatePresetChange(e.target.value as DateRangePreset)}
                className="w-full px-3 py-2 bg-background-tertiary border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-apex-500"
                data-testid={EXPORT_DIALOG_TEST_IDS.datePresetSelect}
                aria-label={EXPORT_DIALOG_ARIA_LABELS.datePresetSelect}
              >
                {DATE_RANGE_PRESETS.map((preset) => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>

              {/* Custom Date Inputs */}
              {options.datePreset === 'custom' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground-secondary mb-1">
                      Start Date
                    </label>
                    <Input
                      type="date"
                      value={formatDateForInput(options.dateRange.startDate)}
                      onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                      className={validationErrors.dateRange ? 'border-red-500' : ''}
                      data-testid={EXPORT_DIALOG_TEST_IDS.startDateInput}
                      aria-label={EXPORT_DIALOG_ARIA_LABELS.startDateInput}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground-secondary mb-1">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={formatDateForInput(options.dateRange.endDate)}
                      onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                      className={validationErrors.dateRange ? 'border-red-500' : ''}
                      data-testid={EXPORT_DIALOG_TEST_IDS.endDateInput}
                      aria-label={EXPORT_DIALOG_ARIA_LABELS.endDateInput}
                    />
                  </div>
                </div>
              )}

              {validationErrors.dateRange && (
                <p className="text-sm text-red-500">{validationErrors.dateRange}</p>
              )}
            </div>
          </div>

          {/* Task Selection */}
          {hasTasksAvailable && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="filter-by-tasks"
                  checked={options.filterByTasks}
                  onChange={(e) => updateOptions({ filterByTasks: e.target.checked })}
                  className="w-4 h-4 text-apex-600 border-border rounded focus:ring-apex-500"
                  data-testid={EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox}
                  aria-label={EXPORT_DIALOG_ARIA_LABELS.taskFilterCheckbox}
                />
                <label htmlFor="filter-by-tasks" className="text-sm font-medium">
                  <Filter className="inline w-4 h-4 mr-1" />
                  Filter by specific tasks
                </label>
              </div>

              {options.filterByTasks && (
                <div className="ml-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground-secondary">
                      {selectedTaskCount} of {availableTasks.length} tasks selected
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSelectAllTasks(!allTasksSelected)}
                      className="text-sm text-apex-600 hover:text-apex-700"
                    >
                      {allTasksSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  <div className="max-h-40 overflow-y-auto border border-border rounded-md p-2 space-y-2">
                    {availableTasks.map((task) => {
                      const isSelected = options.selectedTaskIds.includes(task.id)
                      return (
                        <label
                          key={task.id}
                          className="flex items-start gap-2 p-2 hover:bg-background-secondary rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleTaskSelectionChange(task.id, e.target.checked)}
                            className="mt-1 w-4 h-4 text-apex-600 border-border rounded focus:ring-apex-500 flex-shrink-0"
                            data-testid={`${EXPORT_DIALOG_TEST_IDS.taskSelect}-${task.id}`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{task.description}</p>
                            <p className="text-xs text-foreground-secondary">
                              {task.status} • {new Date(task.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </label>
                      )
                    })}
                  </div>

                  {validationErrors.taskSelection && (
                    <p className="text-sm text-red-500">{validationErrors.taskSelection}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Additional Options */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Additional Options</h3>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeArchived}
                onChange={(e) => updateOptions({ includeArchived: e.target.checked })}
                className="w-4 h-4 text-apex-600 border-border rounded focus:ring-apex-500"
                data-testid={EXPORT_DIALOG_TEST_IDS.includeArchivedCheckbox}
                aria-label={EXPORT_DIALOG_ARIA_LABELS.includeArchivedCheckbox}
              />
              <span className="text-sm">Include archived tasks</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={options.includeTrashed}
                onChange={(e) => updateOptions({ includeTrashed: e.target.checked })}
                className="w-4 h-4 text-apex-600 border-border rounded focus:ring-apex-500"
                data-testid={EXPORT_DIALOG_TEST_IDS.includeTrashedCheckbox}
                aria-label={EXPORT_DIALOG_ARIA_LABELS.includeTrashedCheckbox}
              />
              <span className="text-sm">Include trashed tasks</span>
            </label>
          </div>
        </form>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isExporting}
            data-testid={EXPORT_DIALOG_TEST_IDS.cancelButton}
            aria-label={EXPORT_DIALOG_ARIA_LABELS.cancelButton}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            onClick={handleSubmit}
            disabled={isExporting}
            data-testid={EXPORT_DIALOG_TEST_IDS.exportButton}
            aria-label={EXPORT_DIALOG_ARIA_LABELS.exportButton}
          >
            {isExporting ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export type { ExportDialogProps } from '@/types/export-dialog'