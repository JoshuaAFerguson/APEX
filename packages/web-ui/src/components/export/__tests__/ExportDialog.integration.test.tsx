import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportDialog, type ExportDialogProps } from '../ExportDialog'
import type { Task } from '@apexcli/core'
import { EXPORT_DIALOG_TEST_IDS } from '@/types/export-dialog'

// Mock Task data for testing
const mockTasks: Task[] = [
  {
    id: '1',
    description: 'Task from last month',
    status: 'completed',
    createdAt: '2023-11-15T10:00:00Z',
    updatedAt: '2023-11-15T10:00:00Z',
    archivedAt: null,
    trashedAt: null,
  },
  {
    id: '2',
    description: 'Recent task',
    status: 'in_progress',
    createdAt: '2023-12-10T10:00:00Z',
    updatedAt: '2023-12-10T10:00:00Z',
    archivedAt: null,
    trashedAt: null,
  },
  {
    id: '3',
    description: 'Today task',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archivedAt: null,
    trashedAt: null,
  },
  {
    id: '4',
    description: 'Archived task',
    status: 'completed',
    createdAt: '2023-12-05T10:00:00Z',
    updatedAt: '2023-12-05T10:00:00Z',
    archivedAt: '2023-12-05T12:00:00Z',
    trashedAt: null,
  },
  {
    id: '5',
    description: 'Trashed task',
    status: 'cancelled',
    createdAt: '2023-12-08T10:00:00Z',
    updatedAt: '2023-12-08T10:00:00Z',
    archivedAt: null,
    trashedAt: '2023-12-08T12:00:00Z',
  },
]

// Helper function to render ExportDialog with default props
const renderExportDialog = (props: Partial<ExportDialogProps> = {}) => {
  const defaultProps: ExportDialogProps = {
    isOpen: true,
    onClose: vi.fn(),
    onExport: vi.fn().mockResolvedValue(undefined),
    availableTasks: mockTasks,
    isExporting: false,
    error: null,
    ...props,
  }
  return render(<ExportDialog {...defaultProps} />)
}

describe('ExportDialog Integration Tests', () => {
  const user = userEvent.setup()
  let mockOnClose: ReturnType<typeof vi.fn>
  let mockOnExport: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnClose = vi.fn()
    mockOnExport = vi.fn().mockResolvedValue(undefined)
  })

  describe('End-to-End Export Workflow', () => {
    it('completes full export with JSON format and specific tasks', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // 1. Keep JSON format (default)
      const jsonButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-json`)
      expect(jsonButton).toHaveClass('border-apex-500')

      // 2. Select last 7 days preset
      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'last7days')

      // 3. Enable task filtering
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      // 4. Select specific tasks
      const task2Checkbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-2`)
      const task3Checkbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-3`)
      await user.click(task2Checkbox)
      await user.click(task3Checkbox)

      // 5. Include archived tasks
      const includeArchivedCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeArchivedCheckbox)
      await user.click(includeArchivedCheckbox)

      // 6. Submit export
      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Verify export was called with correct options
      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith({
          format: 'json',
          datePreset: 'last7days',
          dateRange: expect.objectContaining({
            startDate: expect.any(Date),
            endDate: expect.any(Date),
          }),
          filterByTasks: true,
          selectedTaskIds: ['2', '3'],
          includeArchived: true,
          includeTrashed: false,
        })
      })
    })

    it('completes CSV export with custom date range', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // 1. Change to CSV format
      const csvButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-csv`)
      await user.click(csvButton)

      // 2. Select custom date range
      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      // 3. Set custom dates
      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      await user.clear(startDateInput)
      await user.type(startDateInput, '2023-12-01')
      await user.clear(endDateInput)
      await user.type(endDateInput, '2023-12-31')

      // 4. Include trashed tasks
      const includeTrashedCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeTrashedCheckbox)
      await user.click(includeTrashedCheckbox)

      // 5. Submit export
      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Verify export was called with correct options
      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith({
          format: 'csv',
          datePreset: 'custom',
          dateRange: {
            startDate: new Date('2023-12-01'),
            endDate: new Date('2023-12-31'),
          },
          filterByTasks: false,
          selectedTaskIds: [],
          includeArchived: false,
          includeTrashed: true,
        })
      })
    })

    it('completes Markdown export with all tasks selected', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // 1. Change to Markdown format
      const markdownButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-markdown`)
      await user.click(markdownButton)

      // 2. Select today preset
      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'today')

      // 3. Enable task filtering and select all
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const selectAllButton = screen.getByText('Select All')
      await user.click(selectAllButton)

      // Verify all tasks are selected
      expect(screen.getByText('5 of 5 tasks selected')).toBeInTheDocument()

      // 4. Include both archived and trashed
      const includeArchivedCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeArchivedCheckbox)
      const includeTrashedCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeTrashedCheckbox)
      await user.click(includeArchivedCheckbox)
      await user.click(includeTrashedCheckbox)

      // 5. Submit export
      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Verify export was called with all tasks
      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith({
          format: 'markdown',
          datePreset: 'today',
          dateRange: expect.objectContaining({
            startDate: expect.any(Date),
            endDate: expect.any(Date),
          }),
          filterByTasks: true,
          selectedTaskIds: ['1', '2', '3', '4', '5'],
          includeArchived: true,
          includeTrashed: true,
        })
      })
    })
  })

  describe('Form State Management', () => {
    it('maintains state between format changes', async () => {
      renderExportDialog()

      // Set up some state
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const task1Checkbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-1`)
      await user.click(task1Checkbox)
      expect(screen.getByText('1 of 5 tasks selected')).toBeInTheDocument()

      // Change format
      const csvButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-csv`)
      await user.click(csvButton)

      // State should be maintained
      expect(screen.getByText('1 of 5 tasks selected')).toBeInTheDocument()
      expect(task1Checkbox).toBeChecked()
    })

    it('updates task selection count correctly', async () => {
      renderExportDialog()

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      // Initial state
      expect(screen.getByText('0 of 5 tasks selected')).toBeInTheDocument()

      // Select first task
      const task1Checkbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-1`)
      await user.click(task1Checkbox)
      expect(screen.getByText('1 of 5 tasks selected')).toBeInTheDocument()

      // Select second task
      const task2Checkbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-2`)
      await user.click(task2Checkbox)
      expect(screen.getByText('2 of 5 tasks selected')).toBeInTheDocument()

      // Deselect first task
      await user.click(task1Checkbox)
      expect(screen.getByText('1 of 5 tasks selected')).toBeInTheDocument()
    })

    it('resets custom dates when changing from custom preset', async () => {
      renderExportDialog()

      // Select custom preset and set dates
      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      await user.clear(startDateInput)
      await user.type(startDateInput, '2023-12-01')

      // Change to different preset
      await user.selectOptions(presetSelect, 'today')

      // Change back to custom - fields should be empty
      await user.selectOptions(presetSelect, 'custom')

      const newStartDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      expect(newStartDateInput).toHaveValue('')
    })
  })

  describe('Task Display and Interaction', () => {
    it('displays task information correctly', async () => {
      renderExportDialog({ availableTasks: mockTasks })

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      // Check task descriptions are displayed
      mockTasks.forEach(task => {
        expect(screen.getByText(task.description)).toBeInTheDocument()
      })

      // Check status and date info is displayed
      expect(screen.getByText(/completed/)).toBeInTheDocument()
      expect(screen.getByText(/in_progress/)).toBeInTheDocument()
      expect(screen.getByText(/pending/)).toBeInTheDocument()
    })

    it('handles task selection in scrollable list', async () => {
      // Create many tasks to test scrolling
      const manyTasks = Array.from({ length: 20 }, (_, i) => ({
        id: `task-${i}`,
        description: `Task ${i + 1}`,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        archivedAt: null,
        trashedAt: null,
      }))

      renderExportDialog({ availableTasks: manyTasks })

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      // Check scrollable container exists
      const taskContainer = screen.getByText('0 of 20 tasks selected').closest('div')?.querySelector('.max-h-40')
      expect(taskContainer).toBeInTheDocument()
      expect(taskContainer).toHaveClass('overflow-y-auto')

      // Select a task
      const firstTaskCheckbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-task-0`)
      await user.click(firstTaskCheckbox)

      expect(screen.getByText('1 of 20 tasks selected')).toBeInTheDocument()
    })
  })

  describe('Error Handling and Recovery', () => {
    it('handles export errors gracefully', async () => {
      const errorMessage = 'Network error during export'
      const failingOnExport = vi.fn().mockRejectedValue(new Error(errorMessage))

      renderExportDialog({ onExport: failingOnExport, error: null })

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // The component should catch the error and log it
      // Error display is handled by parent component via error prop
      await waitFor(() => {
        expect(failingOnExport).toHaveBeenCalled()
      })
    })

    it('shows validation errors for invalid date range', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Select custom preset and set invalid date range
      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      await user.clear(startDateInput)
      await user.type(startDateInput, '2023-12-31')
      await user.clear(endDateInput)
      await user.type(endDateInput, '2023-12-01') // End before start

      // Try to export
      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Start date must be before end date')).toBeInTheDocument()
      })

      // Should not call onExport
      expect(mockOnExport).not.toHaveBeenCalled()
    })

    it('shows validation error for task filtering without selection', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Enable task filtering but don't select any tasks
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      expect(screen.getByText('0 of 5 tasks selected')).toBeInTheDocument()

      // Try to export
      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Please select at least one task')).toBeInTheDocument()
      })

      // Should not call onExport
      expect(mockOnExport).not.toHaveBeenCalled()
    })

    it('clears validation errors when fixing invalid input', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Set invalid date range and trigger validation
      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      await user.clear(startDateInput)
      await user.type(startDateInput, '2023-12-31')
      await user.clear(endDateInput)
      await user.type(endDateInput, '2023-12-01')

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Error should be shown
      await waitFor(() => {
        expect(screen.getByText('Start date must be before end date')).toBeInTheDocument()
      })

      // Fix the date range
      await user.clear(endDateInput)
      await user.type(endDateInput, '2023-12-31')

      // Error should clear immediately after fixing
      await waitFor(() => {
        expect(screen.queryByText('Start date must be before end date')).not.toBeInTheDocument()
      })
    })
  })

  describe('Dialog State Management', () => {
    it('resets all state when dialog is closed and reopened', async () => {
      const { rerender } = renderExportDialog({ availableTasks: mockTasks })

      // Set up complex state
      const csvButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-csv`)
      await user.click(csvButton)

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const task1Checkbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-1`)
      await user.click(task1Checkbox)

      const includeArchivedCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeArchivedCheckbox)
      await user.click(includeArchivedCheckbox)

      // Close dialog
      rerender(<ExportDialog isOpen={false} onClose={mockOnClose} onExport={mockOnExport} />)

      // Reopen dialog
      rerender(<ExportDialog isOpen={true} onClose={mockOnClose} onExport={mockOnExport} availableTasks={mockTasks} />)

      // All state should be reset to defaults
      const jsonButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-json`)
      expect(jsonButton).toHaveClass('border-apex-500') // Back to default JSON

      const resetTaskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      expect(resetTaskFilterCheckbox).not.toBeChecked()

      const resetIncludeArchivedCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeArchivedCheckbox)
      expect(resetIncludeArchivedCheckbox).not.toBeChecked()
    })
  })
})