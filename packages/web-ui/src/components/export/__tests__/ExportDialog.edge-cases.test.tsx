import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportDialog, type ExportDialogProps } from '../ExportDialog'
import type { Task } from '@apexcli/core'
import { EXPORT_DIALOG_TEST_IDS } from '@/types/export-dialog'

// Mock tasks with various edge case scenarios
const edgeCaseTasks: Task[] = [
  {
    id: 'task-very-long-id-that-might-cause-issues-with-url-encoding-12345678901234567890',
    description: 'Task with extremely long description that might cause issues with rendering and validation in various UI components and export formats when the text exceeds normal limits',
    status: 'completed',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  },
  {
    id: 'task-special-chars-@#$%^&*()[]{}|\\:";\'<>?,./`~',
    description: 'Task with special characters: @#$%^&*()[]{}|\\:";\'<>?,./`~',
    status: 'in-progress',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  },
  {
    id: 'task-unicode-🚀🎉💻🔥⭐',
    description: 'Task with unicode characters: 🚀🎉💻🔥⭐ and Chinese: 你好世界',
    status: 'failed',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  },
  {
    id: '',
    description: '',
    status: 'pending',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
  },
]

// Helper function to render ExportDialog with default props
const renderExportDialog = (props: Partial<ExportDialogProps> = {}) => {
  const defaultProps: ExportDialogProps = {
    isOpen: true,
    onClose: vi.fn(),
    onExport: vi.fn().mockResolvedValue(undefined),
    availableTasks: edgeCaseTasks,
    isExporting: false,
    error: null,
    ...props,
  }
  return render(<ExportDialog {...defaultProps} />)
}

describe('ExportDialog Edge Cases', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Task Selection Edge Cases', () => {
    it('handles tasks with extremely long IDs', async () => {
      renderExportDialog({ availableTasks: edgeCaseTasks })

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const longIdTaskCheckbox = screen.getByTestId(
        `${EXPORT_DIALOG_TEST_IDS.taskSelect}-task-very-long-id-that-might-cause-issues-with-url-encoding-12345678901234567890`
      )
      expect(longIdTaskCheckbox).toBeInTheDocument()

      await user.click(longIdTaskCheckbox)
      expect(longIdTaskCheckbox).toBeChecked()
    })

    it('handles tasks with special characters in IDs', async () => {
      renderExportDialog({ availableTasks: edgeCaseTasks })

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      // The test ID should be properly escaped/encoded
      const specialCharTaskCheckbox = screen.getByTestId(
        `${EXPORT_DIALOG_TEST_IDS.taskSelect}-task-special-chars-@#$%^&*()[]{}|\\:";\'<>?,./\`~`
      )
      expect(specialCharTaskCheckbox).toBeInTheDocument()

      await user.click(specialCharTaskCheckbox)
      expect(specialCharTaskCheckbox).toBeChecked()
    })

    it('handles tasks with unicode characters in IDs and descriptions', async () => {
      renderExportDialog({ availableTasks: edgeCaseTasks })

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const unicodeTaskCheckbox = screen.getByTestId(
        `${EXPORT_DIALOG_TEST_IDS.taskSelect}-task-unicode-🚀🎉💻🔥⭐`
      )
      expect(unicodeTaskCheckbox).toBeInTheDocument()

      // Check that unicode characters are displayed correctly
      expect(screen.getByText('Task with unicode characters: 🚀🎉💻🔥⭐ and Chinese: 你好世界')).toBeInTheDocument()

      await user.click(unicodeTaskCheckbox)
      expect(unicodeTaskCheckbox).toBeChecked()
    })

    it('handles tasks with empty IDs and descriptions', async () => {
      renderExportDialog({ availableTasks: edgeCaseTasks })

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const emptyIdTaskCheckbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-`)
      expect(emptyIdTaskCheckbox).toBeInTheDocument()

      await user.click(emptyIdTaskCheckbox)
      expect(emptyIdTaskCheckbox).toBeChecked()
    })

    it('handles very large numbers of tasks efficiently', async () => {
      const manyTasks: Task[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `task-${i}`,
        description: `Task ${i} with some description`,
        status: 'completed' as const,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
      }))

      const startTime = performance.now()

      renderExportDialog({ availableTasks: manyTasks })

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const renderTime = performance.now() - startTime

      // Should render within reasonable time (less than 200ms)
      expect(renderTime).toBeLessThan(200)

      // Should show correct count
      expect(screen.getByText('0 of 1000 tasks selected')).toBeInTheDocument()
    })

    it('handles select all with large number of tasks', async () => {
      const manyTasks: Task[] = Array.from({ length: 500 }, (_, i) => ({
        id: `task-${i}`,
        description: `Task ${i}`,
        status: 'completed' as const,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
      }))

      renderExportDialog({ availableTasks: manyTasks })

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const selectAllButton = screen.getByText('Select All')

      const startTime = performance.now()
      await user.click(selectAllButton)
      const operationTime = performance.now() - startTime

      // Should complete within reasonable time (less than 100ms)
      expect(operationTime).toBeLessThan(100)

      await waitFor(
        () => {
          expect(screen.getByText('500 of 500 tasks selected')).toBeInTheDocument()
        },
        { timeout: 1000 }
      )
    })
  })

  describe('Date Range Edge Cases', () => {
    it('handles invalid date inputs gracefully', async () => {
      renderExportDialog()

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      // Try to enter invalid dates
      fireEvent.change(startDateInput, { target: { value: 'invalid-date' } })
      fireEvent.change(endDateInput, { target: { value: '2024-13-40' } })

      // Dialog should still be functional
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)).toBeInTheDocument()
    })

    it('handles start date after end date', async () => {
      const mockOnExport = vi.fn()
      renderExportDialog({ onExport: mockOnExport })

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      // Set start date after end date
      await user.type(startDateInput, '2024-12-31')
      await user.type(endDateInput, '2024-01-01')

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      await waitFor(() => {
        // Should show validation error
        expect(screen.getByText('Start date must be before end date')).toBeInTheDocument()
      })

      // Should not call onExport
      expect(mockOnExport).not.toHaveBeenCalled()
    })

    it('handles extreme date values', async () => {
      const mockOnExport = vi.fn()
      renderExportDialog({ onExport: mockOnExport })

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      // Set extreme dates
      await user.type(startDateInput, '1900-01-01')
      await user.type(endDateInput, '2100-12-31')

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith(
          expect.objectContaining({
            dateRange: {
              startDate: new Date('1900-01-01'),
              endDate: new Date('2100-12-31'),
            },
          })
        )
      })
    })
  })

  describe('Memory and Performance Edge Cases', () => {
    it('handles rapid state changes without memory leaks', async () => {
      const mockOnExport = vi.fn()
      renderExportDialog({ onExport: mockOnExport })

      // Rapidly change format multiple times
      for (let i = 0; i < 20; i++) {
        const jsonButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-json`)
        const csvButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-csv`)
        const markdownButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-markdown`)

        await user.click(csvButton)
        await user.click(markdownButton)
        await user.click(jsonButton)
      }

      // Should still be functional
      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      expect(mockOnExport).toHaveBeenCalled()
    })

    it('handles repeated opening and closing', async () => {
      const onClose = vi.fn()
      const { rerender } = renderExportDialog({ onClose })

      // Rapidly open and close dialog
      for (let i = 0; i < 10; i++) {
        // Close dialog
        rerender(
          <ExportDialog
            isOpen={false}
            onClose={onClose}
            onExport={vi.fn()}
            availableTasks={edgeCaseTasks}
          />
        )

        // Open dialog
        rerender(
          <ExportDialog
            isOpen={true}
            onClose={onClose}
            onExport={vi.fn()}
            availableTasks={edgeCaseTasks}
          />
        )
      }

      // Should reset to default state
      const jsonButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-json`)
      expect(jsonButton).toHaveClass('border-apex-500', 'bg-apex-500/10')
    })
  })

  describe('Error Handling Edge Cases', () => {
    it('handles onExport function that throws synchronously', async () => {
      const mockOnExport = vi.fn().mockImplementation(() => {
        throw new Error('Synchronous error')
      })

      renderExportDialog({ onExport: mockOnExport })

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Should handle the error gracefully (error is logged to console)
      expect(mockOnExport).toHaveBeenCalled()

      // Dialog should remain open and functional
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).toBeInTheDocument()
    })

    it('handles onExport function that rejects with non-Error objects', async () => {
      const mockOnExport = vi.fn().mockRejectedValue('String error')

      renderExportDialog({ onExport: mockOnExport })

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Should handle the non-Error rejection gracefully
      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalled()
      })

      // Dialog should remain functional
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).toBeInTheDocument()
    })

    it('handles very long error messages', async () => {
      const longError = 'A'.repeat(1000) // Very long error message

      renderExportDialog({ error: longError })

      const errorAlert = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.errorMessage)
      expect(errorAlert).toBeInTheDocument()

      // Should display the long error without breaking layout
      expect(errorAlert.textContent).toBe(longError)
    })

    it('handles error messages with special characters', async () => {
      const specialError = 'Error with special chars: <script>alert("xss")</script> & unicode: 你好'

      renderExportDialog({ error: specialError })

      const errorAlert = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.errorMessage)
      expect(errorAlert).toBeInTheDocument()

      // Should display the error safely (no script execution)
      expect(errorAlert.textContent).toBe(specialError)
    })
  })

  describe('Accessibility Edge Cases', () => {
    it('maintains accessibility with very long task lists', async () => {
      const manyTasks: Task[] = Array.from({ length: 100 }, (_, i) => ({
        id: `task-${i}`,
        description: `Task ${i}`,
        status: 'completed' as const,
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
      }))

      renderExportDialog({ availableTasks: manyTasks })

      // All accessibility attributes should be present
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).toHaveAttribute('aria-label')
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)).toHaveAttribute('aria-label')
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)).toHaveAttribute('aria-label')

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      // Task checkboxes should maintain accessibility with large lists
      const firstTaskCheckbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-task-0`)
      expect(firstTaskCheckbox).toBeInTheDocument()

      // Should be focusable
      firstTaskCheckbox.focus()
      expect(firstTaskCheckbox).toHaveFocus()
    })

    it('handles keyboard navigation with complex content', async () => {
      renderExportDialog({ availableTasks: edgeCaseTasks })

      const dialog = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)

      // Find all focusable elements
      const focusableElements = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )

      expect(focusableElements.length).toBeGreaterThan(0)

      // Should be able to focus each element
      focusableElements.forEach((element) => {
        ;(element as HTMLElement).focus()
        expect(element).toHaveFocus()
      })
    })
  })

  describe('State Management Edge Cases', () => {
    it('handles concurrent state updates', async () => {
      renderExportDialog({ availableTasks: edgeCaseTasks })

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      const includeArchivedCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeArchivedCheckbox)
      const csvButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-csv`)

      // Trigger multiple state updates simultaneously
      await Promise.all([
        user.click(taskFilterCheckbox),
        user.click(includeArchivedCheckbox),
        user.click(csvButton),
      ])

      // All changes should be applied
      expect(taskFilterCheckbox).toBeChecked()
      expect(includeArchivedCheckbox).toBeChecked()
      expect(csvButton).toHaveClass('border-apex-500', 'bg-apex-500/10')
    })

    it('maintains state consistency during rapid changes', async () => {
      renderExportDialog({ availableTasks: edgeCaseTasks })

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const selectAllButton = screen.getByText('Select All')
      const deselectAllButton = screen.getByText('Deselect All')

      // Rapidly toggle select all
      for (let i = 0; i < 5; i++) {
        await user.click(selectAllButton)
        await user.click(deselectAllButton)
      }

      // Should end in consistent state
      expect(screen.getByText('0 of 4 tasks selected')).toBeInTheDocument()
      expect(screen.getByText('Select All')).toBeInTheDocument()
    })
  })
})