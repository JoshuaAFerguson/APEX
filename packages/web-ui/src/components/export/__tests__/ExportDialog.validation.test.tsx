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
    description: 'Task for validation testing',
    status: 'completed',
    createdAt: '2023-12-01T10:00:00Z',
    updatedAt: '2023-12-01T10:00:00Z',
    archivedAt: null,
    trashedAt: null,
  },
  {
    id: '2',
    description: 'Second validation task',
    status: 'in_progress',
    createdAt: '2023-12-02T10:00:00Z',
    updatedAt: '2023-12-02T10:00:00Z',
    archivedAt: null,
    trashedAt: null,
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

describe('ExportDialog Validation Tests', () => {
  const user = userEvent.setup()
  let mockOnClose: ReturnType<typeof vi.fn>
  let mockOnExport: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnClose = vi.fn()
    mockOnExport = vi.fn().mockResolvedValue(undefined)
  })

  describe('Date Range Validation', () => {
    it('validates that start date is before end date', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Select custom date range
      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      // Set end date before start date
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

      // Date inputs should have error styling
      expect(startDateInput).toHaveClass('border-red-500')
      expect(endDateInput).toHaveClass('border-red-500')
    })

    it('allows equal start and end dates', async () => {
      renderExportDialog({ onExport: mockOnExport })

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      // Set same date for start and end
      await user.clear(startDateInput)
      await user.type(startDateInput, '2023-12-15')
      await user.clear(endDateInput)
      await user.type(endDateInput, '2023-12-15')

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Should not show validation error
      expect(screen.queryByText('Start date must be before end date')).not.toBeInTheDocument()

      // Should call onExport
      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalled()
      })
    })

    it('allows valid date range', async () => {
      renderExportDialog({ onExport: mockOnExport })

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      // Set valid date range
      await user.clear(startDateInput)
      await user.type(startDateInput, '2023-12-01')
      await user.clear(endDateInput)
      await user.type(endDateInput, '2023-12-31')

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Should not show validation error
      expect(screen.queryByText('Start date must be before end date')).not.toBeInTheDocument()

      // Should call onExport with correct dates
      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith(
          expect.objectContaining({
            dateRange: {
              startDate: new Date('2023-12-01'),
              endDate: new Date('2023-12-31'),
            },
          })
        )
      })
    })

    it('allows empty dates for custom range', async () => {
      renderExportDialog({ onExport: mockOnExport })

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      // Leave dates empty
      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Should not show validation error for empty dates
      expect(screen.queryByText('Start date must be before end date')).not.toBeInTheDocument()

      // Should call onExport with null dates
      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith(
          expect.objectContaining({
            dateRange: {
              startDate: null,
              endDate: null,
            },
          })
        )
      })
    })

    it('allows partial date ranges', async () => {
      renderExportDialog({ onExport: mockOnExport })

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)

      // Set only start date
      await user.clear(startDateInput)
      await user.type(startDateInput, '2023-12-01')

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Should not show validation error
      expect(screen.queryByText('Start date must be before end date')).not.toBeInTheDocument()

      // Should call onExport
      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith(
          expect.objectContaining({
            dateRange: {
              startDate: new Date('2023-12-01'),
              endDate: null,
            },
          })
        )
      })
    })

    it('clears date validation errors when fixing the range', async () => {
      renderExportDialog({ onExport: mockOnExport })

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      // Set invalid range first
      await user.clear(startDateInput)
      await user.type(startDateInput, '2023-12-31')
      await user.clear(endDateInput)
      await user.type(endDateInput, '2023-12-01')

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Error should appear
      await waitFor(() => {
        expect(screen.getByText('Start date must be before end date')).toBeInTheDocument()
      })

      // Fix the range
      await user.clear(endDateInput)
      await user.type(endDateInput, '2023-12-31')

      // Error should clear immediately
      await waitFor(() => {
        expect(screen.queryByText('Start date must be before end date')).not.toBeInTheDocument()
      })

      // Error styling should be removed
      expect(startDateInput).not.toHaveClass('border-red-500')
      expect(endDateInput).not.toHaveClass('border-red-500')
    })
  })

  describe('Task Selection Validation', () => {
    it('requires at least one task when filtering is enabled', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Enable task filtering without selecting any tasks
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      expect(screen.getByText('0 of 2 tasks selected')).toBeInTheDocument()

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

    it('allows export when task filtering is disabled', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Keep task filtering disabled
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      expect(taskFilterCheckbox).not.toBeChecked()

      // Export should work
      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Should not show validation error
      expect(screen.queryByText('Please select at least one task')).not.toBeInTheDocument()

      // Should call onExport
      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith(
          expect.objectContaining({
            filterByTasks: false,
            selectedTaskIds: [],
          })
        )
      })
    })

    it('allows export when tasks are selected', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Enable task filtering and select tasks
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const firstTaskCheckbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-1`)
      await user.click(firstTaskCheckbox)

      expect(screen.getByText('1 of 2 tasks selected')).toBeInTheDocument()

      // Export should work
      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Should not show validation error
      expect(screen.queryByText('Please select at least one task')).not.toBeInTheDocument()

      // Should call onExport
      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith(
          expect.objectContaining({
            filterByTasks: true,
            selectedTaskIds: ['1'],
          })
        )
      })
    })

    it('clears task validation errors when selecting tasks', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Enable filtering without selecting tasks
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Error should appear
      await waitFor(() => {
        expect(screen.getByText('Please select at least one task')).toBeInTheDocument()
      })

      // Select a task
      const firstTaskCheckbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-1`)
      await user.click(firstTaskCheckbox)

      // Error should clear immediately
      await waitFor(() => {
        expect(screen.queryByText('Please select at least one task')).not.toBeInTheDocument()
      })
    })

    it('clears task validation errors when disabling task filter', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Enable filtering without selecting tasks and trigger error
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Error should appear
      await waitFor(() => {
        expect(screen.getByText('Please select at least one task')).toBeInTheDocument()
      })

      // Disable task filtering
      await user.click(taskFilterCheckbox)

      // Error should clear immediately
      await waitFor(() => {
        expect(screen.queryByText('Please select at least one task')).not.toBeInTheDocument()
      })
    })
  })

  describe('Combined Validation', () => {
    it('shows multiple validation errors simultaneously', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Set up multiple invalid conditions

      // 1. Invalid date range
      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      await user.clear(startDateInput)
      await user.type(startDateInput, '2023-12-31')
      await user.clear(endDateInput)
      await user.type(endDateInput, '2023-12-01')

      // 2. Task filtering without selection
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      // Try to export
      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Both errors should show
      await waitFor(() => {
        expect(screen.getByText('Start date must be before end date')).toBeInTheDocument()
        expect(screen.getByText('Please select at least one task')).toBeInTheDocument()
      })

      // Should not call onExport
      expect(mockOnExport).not.toHaveBeenCalled()
    })

    it('requires all validation errors to be fixed before allowing export', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Set up multiple invalid conditions
      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      await user.clear(startDateInput)
      await user.type(startDateInput, '2023-12-31')
      await user.clear(endDateInput)
      await user.type(endDateInput, '2023-12-01')

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Both errors should show
      await waitFor(() => {
        expect(screen.getByText('Start date must be before end date')).toBeInTheDocument()
        expect(screen.getByText('Please select at least one task')).toBeInTheDocument()
      })

      // Fix only one error (date range)
      await user.clear(endDateInput)
      await user.type(endDateInput, '2023-12-31')

      await waitFor(() => {
        expect(screen.queryByText('Start date must be before end date')).not.toBeInTheDocument()
        expect(screen.getByText('Please select at least one task')).toBeInTheDocument()
      })

      // Try export again - should still fail
      await user.click(exportButton)
      expect(mockOnExport).not.toHaveBeenCalled()

      // Fix remaining error
      const firstTaskCheckbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-1`)
      await user.click(firstTaskCheckbox)

      await waitFor(() => {
        expect(screen.queryByText('Please select at least one task')).not.toBeInTheDocument()
      })

      // Now export should work
      await user.click(exportButton)
      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalled()
      })
    })

    it('validates on every form submission attempt', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Set up invalid state
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)

      // First submission - should show error
      await user.click(exportButton)
      await waitFor(() => {
        expect(screen.getByText('Please select at least one task')).toBeInTheDocument()
      })
      expect(mockOnExport).not.toHaveBeenCalled()

      // Second submission without fixing - should show error again
      await user.click(exportButton)
      await waitFor(() => {
        expect(screen.getByText('Please select at least one task')).toBeInTheDocument()
      })
      expect(mockOnExport).not.toHaveBeenCalled()

      // Fix error and submit - should work
      const firstTaskCheckbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-1`)
      await user.click(firstTaskCheckbox)

      await user.click(exportButton)
      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalled()
      })
    })
  })

  describe('Validation Error Cleanup', () => {
    it('clears all validation errors when dialog is closed and reopened', async () => {
      const { rerender } = renderExportDialog({ onExport: mockOnExport })

      // Create validation errors
      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      await user.clear(startDateInput)
      await user.type(startDateInput, '2023-12-31')
      await user.clear(endDateInput)
      await user.type(endDateInput, '2023-12-01')

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Errors should be present
      await waitFor(() => {
        expect(screen.getByText('Start date must be before end date')).toBeInTheDocument()
        expect(screen.getByText('Please select at least one task')).toBeInTheDocument()
      })

      // Close dialog
      rerender(<ExportDialog isOpen={false} onClose={mockOnClose} onExport={mockOnExport} />)

      // Reopen dialog
      rerender(<ExportDialog isOpen={true} onClose={mockOnClose} onExport={mockOnExport} availableTasks={mockTasks} />)

      // Errors should be gone
      expect(screen.queryByText('Start date must be before end date')).not.toBeInTheDocument()
      expect(screen.queryByText('Please select at least one task')).not.toBeInTheDocument()
    })

    it('does not show validation errors on initial load', () => {
      renderExportDialog()

      // No validation errors should be visible initially
      expect(screen.queryByText('Start date must be before end date')).not.toBeInTheDocument()
      expect(screen.queryByText('Please select at least one task')).not.toBeInTheDocument()
    })

    it('only shows validation errors after first submission attempt', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Set up invalid state but don't submit yet
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      // No error should show before submission
      expect(screen.queryByText('Please select at least one task')).not.toBeInTheDocument()

      // Submit to trigger validation
      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Now error should show
      await waitFor(() => {
        expect(screen.getByText('Please select at least one task')).toBeInTheDocument()
      })
    })
  })
})