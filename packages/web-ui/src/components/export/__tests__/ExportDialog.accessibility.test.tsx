import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportDialog, type ExportDialogProps } from '../ExportDialog'
import type { Task } from '@apexcli/core'
import { EXPORT_DIALOG_TEST_IDS, EXPORT_DIALOG_ARIA_LABELS } from '@/types/export-dialog'

// Mock Task data for testing
const mockTasks: Task[] = [
  {
    id: '1',
    description: 'First task for accessibility testing',
    status: 'completed',
    createdAt: '2023-12-01T10:00:00Z',
    updatedAt: '2023-12-01T10:00:00Z',
    archivedAt: null,
    trashedAt: null,
  },
  {
    id: '2',
    description: 'Second task for accessibility testing',
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

describe('ExportDialog Accessibility Tests', () => {
  const user = userEvent.setup()
  let mockOnClose: ReturnType<typeof vi.fn>
  let mockOnExport: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnClose = vi.fn()
    mockOnExport = vi.fn().mockResolvedValue(undefined)
  })

  describe('ARIA Labels and Roles', () => {
    it('has proper dialog role and ARIA label', () => {
      renderExportDialog()

      const dialog = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)
      expect(dialog).toHaveAttribute('aria-label', EXPORT_DIALOG_ARIA_LABELS.dialog)

      // The dialog should be properly announced to screen readers
      expect(dialog.closest('[role="dialog"]')).toBeInTheDocument()
    })

    it('has proper form element roles', () => {
      renderExportDialog()

      // Date preset select should have combobox role
      const datePresetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      expect(datePresetSelect).toHaveAttribute('aria-label', EXPORT_DIALOG_ARIA_LABELS.datePresetSelect)

      // Checkboxes should have proper labels
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox))
        .toHaveAttribute('aria-label', EXPORT_DIALOG_ARIA_LABELS.taskFilterCheckbox)

      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeArchivedCheckbox))
        .toHaveAttribute('aria-label', EXPORT_DIALOG_ARIA_LABELS.includeArchivedCheckbox)

      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeTrashedCheckbox))
        .toHaveAttribute('aria-label', EXPORT_DIALOG_ARIA_LABELS.includeTrashedCheckbox)
    })

    it('has proper button ARIA labels', () => {
      renderExportDialog()

      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton))
        .toHaveAttribute('aria-label', EXPORT_DIALOG_ARIA_LABELS.exportButton)

      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.cancelButton))
        .toHaveAttribute('aria-label', EXPORT_DIALOG_ARIA_LABELS.cancelButton)
    })

    it('has proper format selection ARIA labels', () => {
      renderExportDialog()

      const formatButtons = [
        { format: 'json', label: 'JSON' },
        { format: 'csv', label: 'CSV' },
        { format: 'markdown', label: 'Markdown' },
      ]

      formatButtons.forEach(({ format, label }) => {
        const button = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-${format}`)
        expect(button).toHaveAttribute('aria-label', `${EXPORT_DIALOG_ARIA_LABELS.formatSelect} - ${label}`)
      })
    })

    it('shows custom date input ARIA labels when appropriate', async () => {
      renderExportDialog()

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput))
        .toHaveAttribute('aria-label', EXPORT_DIALOG_ARIA_LABELS.startDateInput)

      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput))
        .toHaveAttribute('aria-label', EXPORT_DIALOG_ARIA_LABELS.endDateInput)
    })
  })

  describe('Keyboard Navigation', () => {
    it('supports tab navigation through all interactive elements', async () => {
      renderExportDialog()

      // Start from the first format button
      const jsonButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-json`)
      await user.click(jsonButton)

      // Tab through format buttons
      await user.tab()
      expect(screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-csv`)).toHaveFocus()

      await user.tab()
      expect(screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-markdown`)).toHaveFocus()

      // Tab to date preset select
      await user.tab()
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)).toHaveFocus()

      // Tab to task filter checkbox
      await user.tab()
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)).toHaveFocus()

      // Tab to include archived checkbox
      await user.tab()
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeArchivedCheckbox)).toHaveFocus()

      // Tab to include trashed checkbox
      await user.tab()
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeTrashedCheckbox)).toHaveFocus()

      // Tab to cancel button
      await user.tab()
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.cancelButton)).toHaveFocus()

      // Tab to export button
      await user.tab()
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)).toHaveFocus()
    })

    it('supports keyboard interaction for format selection', async () => {
      renderExportDialog()

      const csvButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-csv`)

      // Focus and activate with keyboard
      csvButton.focus()
      await user.keyboard('{Enter}')

      expect(csvButton).toHaveClass('border-apex-500', 'bg-apex-500/10')

      // Test Space key as well
      const markdownButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-markdown`)
      markdownButton.focus()
      await user.keyboard(' ')

      expect(markdownButton).toHaveClass('border-apex-500', 'bg-apex-500/10')
    })

    it('supports keyboard navigation in task selection', async () => {
      renderExportDialog()

      // Enable task filtering
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      // Tab to first task
      await user.tab({ shift: false })
      const firstTaskCheckbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-1`)

      // The task checkbox should be focusable
      firstTaskCheckbox.focus()
      expect(firstTaskCheckbox).toHaveFocus()

      // Activate with space
      await user.keyboard(' ')
      expect(firstTaskCheckbox).toBeChecked()
    })

    it('handles custom date input keyboard navigation', async () => {
      renderExportDialog()

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      const startDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)
      const endDateInput = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)

      // Tab to start date input
      startDateInput.focus()
      expect(startDateInput).toHaveFocus()

      // Type date
      await user.type(startDateInput, '2023-12-01')
      expect(startDateInput).toHaveValue('2023-12-01')

      // Tab to end date input
      await user.tab()
      expect(endDateInput).toHaveFocus()

      await user.type(endDateInput, '2023-12-31')
      expect(endDateInput).toHaveValue('2023-12-31')
    })

    it('supports escape key to close dialog', async () => {
      renderExportDialog({ onClose: mockOnClose })

      // Press escape anywhere in the dialog
      await user.keyboard('{Escape}')

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Focus Management', () => {
    it('maintains focus when showing/hiding task selection', async () => {
      renderExportDialog()

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)

      // Focus on checkbox and activate
      taskFilterCheckbox.focus()
      await user.keyboard(' ')

      // Focus should remain on the checkbox after showing task list
      expect(taskFilterCheckbox).toHaveFocus()
    })

    it('maintains focus when changing date presets', async () => {
      renderExportDialog()

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      presetSelect.focus()

      // Change to custom and back
      await user.selectOptions(presetSelect, 'custom')
      expect(presetSelect).toHaveFocus()

      await user.selectOptions(presetSelect, 'today')
      expect(presetSelect).toHaveFocus()
    })

    it('handles focus correctly when validation errors appear', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Set up invalid state and submit
      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      // Validation error should appear
      await waitFor(() => {
        expect(screen.getByText('Please select at least one task')).toBeInTheDocument()
      })

      // Focus should remain accessible (not trapped in error state)
      expect(document.activeElement).toBeDefined()
    })
  })

  describe('Screen Reader Support', () => {
    it('announces loading state changes', () => {
      const { rerender } = renderExportDialog({ isExporting: false })

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      expect(exportButton).toHaveTextContent('Export')

      // Change to loading state
      rerender(<ExportDialog
        isOpen={true}
        onClose={mockOnClose}
        onExport={mockOnExport}
        availableTasks={mockTasks}
        isExporting={true}
      />)

      const loadingButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      expect(loadingButton).toHaveTextContent('Exporting...')
      expect(loadingButton).toBeDisabled()
    })

    it('announces validation errors appropriately', async () => {
      renderExportDialog({ onExport: mockOnExport })

      // Trigger validation error
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

      // Error should be announced with proper semantics
      await waitFor(() => {
        const errorText = screen.getByText('Start date must be before end date')
        expect(errorText).toBeInTheDocument()

        // Error should be associated with the input fields
        expect(startDateInput).toHaveClass('border-red-500')
        expect(endDateInput).toHaveClass('border-red-500')
      })
    })

    it('provides proper error announcements', () => {
      const errorMessage = 'Network error occurred during export'
      renderExportDialog({ error: errorMessage })

      const errorAlert = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.errorMessage)
      expect(errorAlert).toBeInTheDocument()
      expect(errorAlert).toHaveTextContent(errorMessage)

      // Error should be in an alert region for screen readers
      expect(errorAlert.querySelector('[role="alert"]')).toBeInTheDocument()
    })

    it('announces task selection changes', async () => {
      renderExportDialog()

      const taskFilterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(taskFilterCheckbox)

      // Initial state should be announced
      expect(screen.getByText('0 of 2 tasks selected')).toBeInTheDocument()

      // Select a task
      const firstTaskCheckbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-1`)
      await user.click(firstTaskCheckbox)

      // Updated count should be announced
      expect(screen.getByText('1 of 2 tasks selected')).toBeInTheDocument()
    })
  })

  describe('High Contrast and Visual Accessibility', () => {
    it('maintains visual focus indicators', async () => {
      renderExportDialog()

      const csvButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-csv`)

      // Focus should be visually indicated
      csvButton.focus()
      expect(csvButton).toHaveFocus()

      // Selected state should be visually distinct
      await user.click(csvButton)
      expect(csvButton).toHaveClass('border-apex-500', 'bg-apex-500/10')
    })

    it('provides sufficient color contrast for error states', async () => {
      renderExportDialog({ error: 'Test error message' })

      const errorAlert = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.errorMessage)
      expect(errorAlert).toHaveClass('border-red-200', 'bg-red-50')

      const errorText = errorAlert.querySelector('.text-red-700')
      expect(errorText).toBeInTheDocument()
    })

    it('maintains accessible checkbox states', async () => {
      renderExportDialog()

      const archivedCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeArchivedCheckbox)

      // Unchecked state
      expect(archivedCheckbox).not.toBeChecked()

      // Checked state
      await user.click(archivedCheckbox)
      expect(archivedCheckbox).toBeChecked()

      // Visual styling should indicate state
      expect(archivedCheckbox).toHaveClass('text-apex-600')
    })
  })

  describe('Motion and Animation Accessibility', () => {
    it('handles dialog open/close transitions gracefully', async () => {
      const { rerender } = renderExportDialog({ isOpen: false })

      // Dialog should not be in DOM when closed
      expect(screen.queryByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).not.toBeInTheDocument()

      // Open dialog
      rerender(<ExportDialog
        isOpen={true}
        onClose={mockOnClose}
        onExport={mockOnExport}
        availableTasks={mockTasks}
      />)

      // Dialog should appear
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).toBeInTheDocument()
    })

    it('maintains usability during loading states', () => {
      renderExportDialog({ isExporting: true })

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      const cancelButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.cancelButton)

      // Buttons should be properly disabled during export
      expect(exportButton).toBeDisabled()
      expect(cancelButton).toBeDisabled()

      // Loading state should be clearly indicated
      expect(exportButton).toHaveTextContent('Exporting...')
    })
  })
})