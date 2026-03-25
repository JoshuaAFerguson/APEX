import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TaskListWithExport } from '../TaskListWithExport'
import { TaskCard } from '../TaskCard'
import type { Task } from '@apexcli/core'
import type { ExportDialogOptions } from '@/types/export-dialog'
import { BULK_TEST_IDS } from '@/types/bulk-operations'
import { EXPORT_DIALOG_TEST_IDS } from '@/types/export-dialog'

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    exportTasks: vi.fn(),
  },
}))

import { apiClient } from '@/lib/api-client'

// Mock tasks for testing
const mockTasks: Task[] = [
  {
    id: 'task-1',
    description: 'Task 1 - Implement authentication',
    workflow: 'development',
    autonomy: 'medium',
    status: 'in-progress',
    priority: 'high',
    effort: 'medium',
    currentStage: 'implementation',
    projectPath: '/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:30:00Z',
  },
  {
    id: 'task-2',
    description: 'Task 2 - Write unit tests',
    workflow: 'testing',
    autonomy: 'medium',
    status: 'completed',
    priority: 'medium',
    effort: 'small',
    projectPath: '/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: '2024-01-01T09:00:00Z',
    updatedAt: '2024-01-01T09:30:00Z',
  },
  {
    id: 'task-3',
    description: 'Task 3 - Deploy to production',
    workflow: 'deployment',
    autonomy: 'high',
    status: 'failed',
    priority: 'low',
    effort: 'large',
    error: 'Deployment failed',
    projectPath: '/project',
    retryCount: 1,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:15:00Z',
  },
]

// Mock successful export result
const mockExportResult = {
  success: true,
  filename: 'apex-tasks-export-2024-01-01.json',
  content: JSON.stringify(mockTasks, null, 2),
  mimeType: 'application/json',
  taskCount: 3,
}

describe('TaskListWithExport Integration Tests', () => {
  const user = userEvent.setup()

  const defaultProps = {
    tasks: mockTasks,
    visibleTaskIds: mockTasks.map(t => t.id),
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock successful export by default
    ;(apiClient.exportTasks as any).mockResolvedValue(mockExportResult)

    // Mock document methods for file download
    global.URL.createObjectURL = vi.fn(() => 'mock-blob-url')
    global.URL.revokeObjectURL = vi.fn()

    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    } as any

    document.createElement = vi.fn().mockReturnValue(mockLink)
    document.body.appendChild = vi.fn()
    document.body.removeChild = vi.fn()
  })

  describe('Task Selection and Export Flow', () => {
    it('allows selecting tasks and exporting them', async () => {
      render(
        <TaskListWithExport {...defaultProps}>
          <div>
            {mockTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </TaskListWithExport>
      )

      // Initially no toolbar should be visible
      expect(screen.queryByTestId(BULK_TEST_IDS.toolbar)).not.toBeInTheDocument()

      // Select a task (need to click on the actual task card to trigger selection)
      const firstTaskCard = screen.getByText('Task 1 - Implement authentication')
      await user.click(firstTaskCard)

      // Toolbar should now be visible
      await waitFor(() => {
        expect(screen.getByTestId(BULK_TEST_IDS.toolbar)).toBeInTheDocument()
      })

      // Export button should be visible
      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      expect(exportButton).toBeInTheDocument()

      // Click export button
      await user.click(exportButton)

      // Export dialog should open
      await waitFor(() => {
        expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).toBeInTheDocument()
      })

      // Submit the export dialog
      const exportDialogButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportDialogButton)

      // API should be called with export options
      await waitFor(() => {
        expect(apiClient.exportTasks).toHaveBeenCalled()
      })

      // File download should be triggered
      expect(global.URL.createObjectURL).toHaveBeenCalled()
      expect(document.createElement).toHaveBeenCalledWith('a')
    })

    it('exports all visible tasks when no specific tasks are selected in dialog', async () => {
      render(
        <TaskListWithExport {...defaultProps}>
          <div>
            {mockTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </TaskListWithExport>
      )

      // Select one task to show toolbar
      const firstTaskCard = screen.getByText('Task 1 - Implement authentication')
      await user.click(firstTaskCard)

      await waitFor(() => {
        expect(screen.getByTestId(BULK_TEST_IDS.toolbar)).toBeInTheDocument()
      })

      // Click export button
      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Export dialog should open
      await waitFor(() => {
        expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).toBeInTheDocument()
      })

      // Submit without selecting specific tasks in dialog (should export the bulk selected task)
      const exportDialogButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportDialogButton)

      await waitFor(() => {
        expect(apiClient.exportTasks).toHaveBeenCalledWith(
          expect.objectContaining({
            selectedTaskIds: ['task-1'], // Only the bulk-selected task
            filterByTasks: true,
          })
        )
      })
    })

    it('exports dialog-selected tasks when filterByTasks is enabled', async () => {
      render(
        <TaskListWithExport {...defaultProps}>
          <div>
            {mockTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </TaskListWithExport>
      )

      // Select a task to show toolbar
      const firstTaskCard = screen.getByText('Task 1 - Implement authentication')
      await user.click(firstTaskCard)

      await waitFor(() => {
        expect(screen.getByTestId(BULK_TEST_IDS.toolbar)).toBeInTheDocument()
      })

      // Click export button
      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Export dialog should open
      await waitFor(() => {
        expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).toBeInTheDocument()
      })

      // Enable task filtering in dialog
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      // Select specific tasks in dialog
      const task2Checkbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-task-2`)
      const task3Checkbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-task-3`)

      await user.click(task2Checkbox)
      await user.click(task3Checkbox)

      // Submit the export
      const exportDialogButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportDialogButton)

      await waitFor(() => {
        expect(apiClient.exportTasks).toHaveBeenCalledWith(
          expect.objectContaining({
            selectedTaskIds: ['task-2', 'task-3'], // Dialog-selected tasks override bulk selection
            filterByTasks: true,
          })
        )
      })
    })
  })

  describe('Export Dialog Configuration', () => {
    it('passes correct export options to API', async () => {
      render(
        <TaskListWithExport {...defaultProps}>
          <div>
            {mockTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </TaskListWithExport>
      )

      // Select a task and open export dialog
      const firstTaskCard = screen.getByText('Task 1 - Implement authentication')
      await user.click(firstTaskCard)

      await waitFor(() => {
        expect(screen.getByTestId(BULK_TEST_IDS.toolbar)).toBeInTheDocument()
      })

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      await user.click(exportButton)

      await waitFor(() => {
        expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).toBeInTheDocument()
      })

      // Change format to CSV
      const csvFormatButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-csv`)
      await user.click(csvFormatButton)

      // Enable include archived
      const includeArchivedCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeArchivedCheckbox)
      await user.click(includeArchivedCheckbox)

      // Enable include trashed
      const includeTrashedCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeTrashedCheckbox)
      await user.click(includeTrashedCheckbox)

      // Submit the export
      const exportDialogButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportDialogButton)

      await waitFor(() => {
        expect(apiClient.exportTasks).toHaveBeenCalledWith(
          expect.objectContaining({
            format: 'csv',
            includeArchived: true,
            includeTrashed: true,
            selectedTaskIds: ['task-1'],
            filterByTasks: true,
          })
        )
      })
    })

    it('handles custom date range selection', async () => {
      render(
        <TaskListWithExport {...defaultProps}>
          <div>
            {mockTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </TaskListWithExport>
      )

      // Select a task and open export dialog
      const firstTaskCard = screen.getByText('Task 1 - Implement authentication')
      await user.click(firstTaskCard)

      await waitFor(() => {
        const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
        await user.click(exportButton)
      })

      await waitFor(() => {
        expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).toBeInTheDocument()
      })

      // Select custom date range
      const datePresetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(datePresetSelect, 'custom')

      // Set start and end dates
      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      await user.type(startDateInput, '2024-01-01')
      await user.type(endDateInput, '2024-01-31')

      // Submit the export
      const exportDialogButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportDialogButton)

      await waitFor(() => {
        expect(apiClient.exportTasks).toHaveBeenCalledWith(
          expect.objectContaining({
            dateRange: {
              startDate: new Date('2024-01-01'),
              endDate: new Date('2024-01-31'),
            },
            datePreset: 'custom',
          })
        )
      })
    })
  })

  describe('File Download Process', () => {
    it('creates and triggers download for successful export', async () => {
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      } as any

      document.createElement = vi.fn().mockReturnValue(mockLink)

      render(
        <TaskListWithExport {...defaultProps}>
          <div>
            {mockTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </TaskListWithExport>
      )

      // Select task, open dialog, and export
      const firstTaskCard = screen.getByText('Task 1 - Implement authentication')
      await user.click(firstTaskCard)

      await waitFor(() => {
        const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
        fireEvent.click(exportButton)
      })

      await waitFor(() => {
        const exportDialogButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
        fireEvent.click(exportDialogButton)
      })

      await waitFor(() => {
        expect(apiClient.exportTasks).toHaveBeenCalled()
      })

      // File download should be set up correctly
      expect(mockLink.href).toBe('mock-blob-url')
      expect(mockLink.download).toBe('apex-tasks-export-2024-01-01.json')
      expect(mockLink.click).toHaveBeenCalled()
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink)
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink)
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('mock-blob-url')
    })

    it('creates blob with correct content and MIME type', async () => {
      global.Blob = vi.fn().mockImplementation((content, options) => ({
        content,
        type: options.type,
      })) as any

      render(
        <TaskListWithExport {...defaultProps}>
          <div>
            {mockTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </TaskListWithExport>
      )

      // Complete export flow
      const firstTaskCard = screen.getByText('Task 1 - Implement authentication')
      await user.click(firstTaskCard)

      await waitFor(() => {
        const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
        fireEvent.click(exportButton)
      })

      await waitFor(() => {
        const exportDialogButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
        fireEvent.click(exportDialogButton)
      })

      await waitFor(() => {
        expect(apiClient.exportTasks).toHaveBeenCalled()
      })

      // Blob should be created with correct content and MIME type
      expect(global.Blob).toHaveBeenCalledWith(
        [mockExportResult.content],
        { type: mockExportResult.mimeType }
      )
    })
  })

  describe('Error Handling', () => {
    it('displays error when export fails', async () => {
      const exportError = new Error('Export failed due to server error')
      ;(apiClient.exportTasks as any).mockRejectedValue(exportError)

      render(
        <TaskListWithExport {...defaultProps}>
          <div>
            {mockTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </TaskListWithExport>
      )

      // Complete export flow
      const firstTaskCard = screen.getByText('Task 1 - Implement authentication')
      await user.click(firstTaskCard)

      await waitFor(() => {
        const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
        fireEvent.click(exportButton)
      })

      await waitFor(() => {
        const exportDialogButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
        fireEvent.click(exportDialogButton)
      })

      // Error should be displayed in dialog
      await waitFor(() => {
        const errorMessage = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.errorMessage)
        expect(errorMessage).toBeInTheDocument()
        expect(errorMessage).toHaveTextContent('Export failed due to server error')
      })

      // Dialog should remain open
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).toBeInTheDocument()
    })

    it('handles no matching tasks error', async () => {
      render(
        <TaskListWithExport {...defaultProps}>
          <div>
            {mockTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </TaskListWithExport>
      )

      // Select task and open dialog
      const firstTaskCard = screen.getByText('Task 1 - Implement authentication')
      await user.click(firstTaskCard)

      await waitFor(() => {
        const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
        fireEvent.click(exportButton)
      })

      // Enable task filtering and deselect all tasks (should trigger no tasks error)
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      // Don't select any tasks, then submit
      const exportDialogButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportDialogButton)

      // Should show error for no matching tasks
      await waitFor(() => {
        const errorMessage = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.errorMessage)
        expect(errorMessage).toBeInTheDocument()
        expect(errorMessage).toHaveTextContent('No tasks match the selected filters')
      })
    })

    it('clears error when dialog is reopened', async () => {
      const exportError = new Error('Previous export failed')
      ;(apiClient.exportTasks as any).mockRejectedValue(exportError)

      render(
        <TaskListWithExport {...defaultProps}>
          <div>
            {mockTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </TaskListWithExport>
      )

      // Complete export flow with error
      const firstTaskCard = screen.getByText('Task 1 - Implement authentication')
      await user.click(firstTaskCard)

      await waitFor(() => {
        const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
        fireEvent.click(exportButton)
      })

      await waitFor(() => {
        const exportDialogButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
        fireEvent.click(exportDialogButton)
      })

      // Error should be displayed
      await waitFor(() => {
        expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.errorMessage)).toBeInTheDocument()
      })

      // Close dialog
      const cancelButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.cancelButton)
      await user.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).not.toBeInTheDocument()
      })

      // Reopen dialog
      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      await user.click(exportButton)

      await waitFor(() => {
        expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).toBeInTheDocument()
      })

      // Error should be cleared
      expect(screen.queryByTestId(EXPORT_DIALOG_TEST_IDS.errorMessage)).not.toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('shows loading state during export', async () => {
      // Make the export promise hang to test loading state
      let resolveExport: (value: any) => void
      const exportPromise = new Promise(resolve => {
        resolveExport = resolve
      })
      ;(apiClient.exportTasks as any).mockReturnValue(exportPromise)

      render(
        <TaskListWithExport {...defaultProps}>
          <div>
            {mockTasks.map(task => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </TaskListWithExport>
      )

      // Complete flow up to export submission
      const firstTaskCard = screen.getByText('Task 1 - Implement authentication')
      await user.click(firstTaskCard)

      await waitFor(() => {
        const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
        fireEvent.click(exportButton)
      })

      await waitFor(() => {
        const exportDialogButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
        fireEvent.click(exportDialogButton)
      })

      // Should show loading state
      await waitFor(() => {
        const exportDialogButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
        expect(exportDialogButton).toBeDisabled()
        expect(exportDialogButton).toHaveTextContent('Exporting...')
      })

      const cancelButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.cancelButton)
      expect(cancelButton).toBeDisabled()

      // Resolve the export to clean up
      resolveExport!(mockExportResult)
    })
  })
})