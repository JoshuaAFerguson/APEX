'use client'

import React, { useState } from 'react'
import { BulkSelectionProvider } from './BulkSelectionContext'
import { BulkActionToolbar } from './BulkActionToolbar'
import { ExportDialog } from '../export/ExportDialog'
import { useBulkTaskOperations } from '@/hooks/useBulkTaskOperations'
import { apiClient } from '@/lib/api-client'
import type { Task } from '@apexcli/core'
import type { ExportDialogOptions } from '@/types/export-dialog'
import { applyExportFilters } from '@/types/export-dialog'

export interface TaskListWithExportProps {
  /** Array of tasks to display */
  tasks: Task[]
  /** Currently visible/filtered task IDs (for select all) */
  visibleTaskIds: string[]
  /** Callback for bulk cancel operation */
  onBulkCancel?: (taskIds: string[]) => Promise<void>
  /** Callback for bulk retry operation */
  onBulkRetry?: (taskIds: string[]) => Promise<void>
  /** Callback for bulk delete operation */
  onBulkDelete?: (taskIds: string[]) => Promise<void>
  /** Whether any operation is in progress */
  isOperating?: boolean
  /** Children components (task list content) */
  children: React.ReactNode
  /** Optional className for styling */
  className?: string
}

/**
 * TaskListWithExport component that provides bulk operations and export functionality
 * Wraps task list content with bulk selection context and export capabilities
 */
export function TaskListWithExport({
  tasks,
  visibleTaskIds,
  onBulkCancel,
  onBulkRetry,
  onBulkDelete,
  isOperating = false,
  children,
  className,
}: TaskListWithExportProps) {
  // Export dialog state
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [selectedTasksForExport, setSelectedTasksForExport] = useState<string[]>([])
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Bulk operations hook
  const bulkOperations = useBulkTaskOperations()

  // Handle export button click from bulk toolbar
  const handleBulkExport = (taskIds: string[]) => {
    setSelectedTasksForExport(taskIds)
    setIsExportDialogOpen(true)
    setExportError(null)
  }

  // Handle export dialog close
  const handleCloseExportDialog = () => {
    setIsExportDialogOpen(false)
    setSelectedTasksForExport([])
    setExportError(null)
  }

  // Handle export operation
  const handleExport = async (options: ExportDialogOptions) => {
    try {
      setIsExporting(true)
      setExportError(null)

      // Get the tasks to export based on options
      let tasksToExport: Task[]

      if (options.filterByTasks && options.selectedTaskIds.length > 0) {
        // Export specific selected tasks from dialog
        tasksToExport = tasks.filter(task => options.selectedTaskIds.includes(task.id))
      } else if (selectedTasksForExport.length > 0) {
        // Export tasks selected from bulk action
        tasksToExport = tasks.filter(task => selectedTasksForExport.includes(task.id))
      } else {
        // Export all visible tasks
        tasksToExport = tasks.filter(task => visibleTaskIds.includes(task.id))
      }

      // Apply additional filters
      const filteredTasks = applyExportFilters(tasksToExport, options)

      if (filteredTasks.length === 0) {
        throw new Error('No tasks match the selected filters')
      }

      // Call the API to export tasks
      const result = await apiClient.exportTasks({
        ...options,
        // Override selectedTaskIds to match our filtered tasks
        selectedTaskIds: filteredTasks.map(task => task.id),
        filterByTasks: true, // Always filter by the specific tasks we want
      })

      // Create and download the file
      const blob = new Blob([result.content], { type: result.mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Close dialog on success
      handleCloseExportDialog()
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  // Get tasks available for export dialog (all tasks, not just selected)
  const availableTasks = tasks

  return (
    <BulkSelectionProvider>
      <div className={className}>
        {children}

        {/* Bulk Action Toolbar */}
        <BulkActionToolbar
          visibleTaskIds={visibleTaskIds}
          tasks={tasks}
          onBulkCancel={onBulkCancel || (async (taskIds: string[]) => {
            await bulkOperations.bulkCancel(taskIds)
          })}
          onBulkRetry={onBulkRetry || (async (taskIds: string[]) => {
            await bulkOperations.bulkRetry(taskIds)
          })}
          onBulkDelete={onBulkDelete || (async (taskIds: string[]) => {
            await bulkOperations.bulkDelete(taskIds)
          })}
          onBulkExport={handleBulkExport}
          progress={bulkOperations.progress}
          isOperating={isOperating || bulkOperations.isOperating}
        />

        {/* Export Dialog */}
        <ExportDialog
          isOpen={isExportDialogOpen}
          onClose={handleCloseExportDialog}
          onExport={handleExport}
          availableTasks={availableTasks}
          isExporting={isExporting}
          error={exportError}
        />
      </div>
    </BulkSelectionProvider>
  )
}