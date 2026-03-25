import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportDialog, type ExportDialogProps } from '../ExportDialog'
import type { Task } from '@apexcli/core'
import { EXPORT_DIALOG_TEST_IDS } from '@/types/export-dialog'

// Mock Task data for testing
const mockTasks: Task[] = [
  {
    id: '1',
    description: 'First task',
    status: 'completed',
    createdAt: '2023-12-01T10:00:00Z',
    updatedAt: '2023-12-01T10:00:00Z',
    archivedAt: null,
    trashedAt: null,
  },
  {
    id: '2',
    description: 'Second task',
    status: 'in_progress',
    createdAt: '2023-12-02T10:00:00Z',
    updatedAt: '2023-12-02T10:00:00Z',
    archivedAt: null,
    trashedAt: null,
  },
  {
    id: '3',
    description: 'Archived task',
    status: 'completed',
    createdAt: '2023-12-03T10:00:00Z',
    updatedAt: '2023-12-03T10:00:00Z',
    archivedAt: '2023-12-03T12:00:00Z',
    trashedAt: null,
  },
  {
    id: '4',
    description: 'Trashed task',
    status: 'cancelled',
    createdAt: '2023-12-04T10:00:00Z',
    updatedAt: '2023-12-04T10:00:00Z',
    archivedAt: null,
    trashedAt: '2023-12-04T12:00:00Z',
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

describe('ExportDialog', () => {
  const user = userEvent.setup()
  let mockOnClose: ReturnType<typeof vi.fn>
  let mockOnExport: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnClose = vi.fn()
    mockOnExport = vi.fn().mockResolvedValue(undefined)
  })

  describe('Rendering', () => {
    it('renders when isOpen is true', () => {
      renderExportDialog({ isOpen: true })

      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).toBeInTheDocument()
      expect(screen.getByText('Export Tasks')).toBeInTheDocument()
      expect(screen.getByText('Choose format and filtering options for your task data export.')).toBeInTheDocument()
    })

    it('does not render when isOpen is false', () => {
      renderExportDialog({ isOpen: false })

      expect(screen.queryByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).not.toBeInTheDocument()
    })

    it('renders all format options', () => {
      renderExportDialog()

      expect(screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-json`)).toBeInTheDocument()
      expect(screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-csv`)).toBeInTheDocument()
      expect(screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-markdown`)).toBeInTheDocument()

      expect(screen.getByText('JSON')).toBeInTheDocument()
      expect(screen.getByText('CSV')).toBeInTheDocument()
      expect(screen.getByText('Markdown')).toBeInTheDocument()
    })

    it('renders date range preset selector', () => {
      renderExportDialog()

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      expect(presetSelect).toBeInTheDocument()
      expect(presetSelect).toHaveValue('all')
    })

    it('renders task selection when tasks are available', () => {
      renderExportDialog({ availableTasks: mockTasks })

      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)).toBeInTheDocument()
      expect(screen.getByText('Filter by specific tasks')).toBeInTheDocument()
    })

    it('does not render task selection when no tasks available', () => {
      renderExportDialog({ availableTasks: [] })

      expect(screen.queryByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)).not.toBeInTheDocument()
      expect(screen.queryByText('Filter by specific tasks')).not.toBeInTheDocument()
    })

    it('renders additional options checkboxes', () => {
      renderExportDialog()

      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeArchivedCheckbox)).toBeInTheDocument()
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeTrashedCheckbox)).toBeInTheDocument()
      expect(screen.getByText('Include archived tasks')).toBeInTheDocument()
      expect(screen.getByText('Include trashed tasks')).toBeInTheDocument()
    })

    it('renders action buttons', () => {
      renderExportDialog()

      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.cancelButton)).toBeInTheDocument()
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
    })
  })

  describe('Format Selection', () => {
    it('defaults to JSON format', () => {
      renderExportDialog()

      const jsonButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-json`)
      expect(jsonButton).toHaveClass('border-apex-500', 'bg-apex-500/10')
    })

    it('allows changing format selection', async () => {
      renderExportDialog()

      const csvButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-csv`)
      await user.click(csvButton)

      expect(csvButton).toHaveClass('border-apex-500', 'bg-apex-500/10')

      const jsonButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-json`)
      expect(jsonButton).not.toHaveClass('border-apex-500', 'bg-apex-500/10')
    })

    it('shows format descriptions', () => {
      renderExportDialog()

      expect(screen.getByText('Full task data with all fields and nested structures')).toBeInTheDocument()
      expect(screen.getByText('Tabular format for spreadsheet applications')).toBeInTheDocument()
      expect(screen.getByText('Human-readable documentation format')).toBeInTheDocument()
    })
  })

  describe('Date Range Selection', () => {
    it('shows all preset options', () => {
      renderExportDialog()

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      const options = Array.from(presetSelect.querySelectorAll('option'))

      expect(options).toHaveLength(8)
      expect(options.map(opt => opt.textContent)).toEqual([
        'All time',
        'Today',
        'Yesterday',
        'Last 7 days',
        'Last 30 days',
        'This month',
        'Last month',
        'Custom range',
      ])
    })

    it('shows custom date inputs when custom preset is selected', async () => {
      renderExportDialog()

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)).toBeInTheDocument()
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)).toBeInTheDocument()
      expect(screen.getByText('Start Date')).toBeInTheDocument()
      expect(screen.getByText('End Date')).toBeInTheDocument()
    })

    it('hides custom date inputs for non-custom presets', async () => {
      renderExportDialog()

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)

      // First select custom to show inputs
      await user.selectOptions(presetSelect, 'custom')
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)).toBeInTheDocument()

      // Then select a different preset
      await user.selectOptions(presetSelect, 'today')
      expect(screen.queryByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)).not.toBeInTheDocument()
      expect(screen.queryByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)).not.toBeInTheDocument()
    })
  })

  describe('Task Selection', () => {
    it('shows task list when filter checkbox is checked', async () => {
      renderExportDialog({ availableTasks: mockTasks })

      const filterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(filterCheckbox)

      // Should show task selection UI
      expect(screen.getByText('0 of 4 tasks selected')).toBeInTheDocument()
      expect(screen.getByText('Select All')).toBeInTheDocument()

      // Should show individual task checkboxes
      mockTasks.forEach(task => {
        expect(screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-${task.id}`)).toBeInTheDocument()
        expect(screen.getByText(task.description)).toBeInTheDocument()
      })
    })

    it('hides task list when filter checkbox is unchecked', async () => {
      renderExportDialog({ availableTasks: mockTasks })

      const filterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)

      // Check and then uncheck
      await user.click(filterCheckbox)
      expect(screen.getByText('0 of 4 tasks selected')).toBeInTheDocument()

      await user.click(filterCheckbox)
      expect(screen.queryByText('0 of 4 tasks selected')).not.toBeInTheDocument()
    })

    it('allows selecting individual tasks', async () => {
      renderExportDialog({ availableTasks: mockTasks })

      const filterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(filterCheckbox)

      const firstTaskCheckbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-1`)
      await user.click(firstTaskCheckbox)

      expect(screen.getByText('1 of 4 tasks selected')).toBeInTheDocument()
      expect(firstTaskCheckbox).toBeChecked()
    })

    it('allows select all functionality', async () => {
      renderExportDialog({ availableTasks: mockTasks })

      const filterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(filterCheckbox)

      const selectAllButton = screen.getByText('Select All')
      await user.click(selectAllButton)

      expect(screen.getByText('4 of 4 tasks selected')).toBeInTheDocument()
      expect(screen.getByText('Deselect All')).toBeInTheDocument()

      // All checkboxes should be checked
      mockTasks.forEach(task => {
        const checkbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-${task.id}`)
        expect(checkbox).toBeChecked()
      })
    })

    it('allows deselect all functionality', async () => {
      renderExportDialog({ availableTasks: mockTasks })

      const filterCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)
      await user.click(filterCheckbox)

      // Select all first
      const selectAllButton = screen.getByText('Select All')
      await user.click(selectAllButton)
      expect(screen.getByText('4 of 4 tasks selected')).toBeInTheDocument()

      // Then deselect all
      const deselectAllButton = screen.getByText('Deselect All')
      await user.click(deselectAllButton)

      expect(screen.getByText('0 of 4 tasks selected')).toBeInTheDocument()
      expect(screen.getByText('Select All')).toBeInTheDocument()

      // No checkboxes should be checked
      mockTasks.forEach(task => {
        const checkbox = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.taskSelect}-${task.id}`)
        expect(checkbox).not.toBeChecked()
      })
    })
  })

  describe('Additional Options', () => {
    it('allows toggling include archived checkbox', async () => {
      renderExportDialog()

      const archivedCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeArchivedCheckbox)
      expect(archivedCheckbox).not.toBeChecked()

      await user.click(archivedCheckbox)
      expect(archivedCheckbox).toBeChecked()

      await user.click(archivedCheckbox)
      expect(archivedCheckbox).not.toBeChecked()
    })

    it('allows toggling include trashed checkbox', async () => {
      renderExportDialog()

      const trashedCheckbox = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeTrashedCheckbox)
      expect(trashedCheckbox).not.toBeChecked()

      await user.click(trashedCheckbox)
      expect(trashedCheckbox).toBeChecked()

      await user.click(trashedCheckbox)
      expect(trashedCheckbox).not.toBeChecked()
    })
  })

  describe('Error Display', () => {
    it('shows error message when error prop is provided', () => {
      const errorMessage = 'Export failed due to network error'
      renderExportDialog({ error: errorMessage })

      const errorAlert = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.errorMessage)
      expect(errorAlert).toBeInTheDocument()
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })

    it('hides error message when error prop is null', () => {
      renderExportDialog({ error: null })

      expect(screen.queryByTestId(EXPORT_DIALOG_TEST_IDS.errorMessage)).not.toBeInTheDocument()
    })
  })

  describe('Loading States', () => {
    it('shows loading state when isExporting is true', () => {
      renderExportDialog({ isExporting: true })

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      expect(exportButton).toHaveTextContent('Exporting...')
      expect(exportButton).toBeDisabled()

      const cancelButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.cancelButton)
      expect(cancelButton).toBeDisabled()
    })

    it('shows normal state when isExporting is false', () => {
      renderExportDialog({ isExporting: false })

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      expect(exportButton).toHaveTextContent('Export')
      expect(exportButton).not.toBeDisabled()

      const cancelButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.cancelButton)
      expect(cancelButton).not.toBeDisabled()
    })
  })

  describe('Button Interactions', () => {
    it('calls onClose when cancel button is clicked', async () => {
      renderExportDialog({ onClose: mockOnClose })

      const cancelButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.cancelButton)
      await user.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalledOnce()
    })

    it('calls onExport with default options when export button is clicked', async () => {
      renderExportDialog({ onExport: mockOnExport })

      const exportButton = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)
      await user.click(exportButton)

      await waitFor(() => {
        expect(mockOnExport).toHaveBeenCalledWith({
          format: 'json',
          dateRange: { startDate: null, endDate: null },
          datePreset: 'all',
          filterByTasks: false,
          selectedTaskIds: [],
          includeArchived: false,
          includeTrashed: false,
        })
      })
    })
  })

  describe('State Reset', () => {
    it('resets state when dialog is closed and reopened', async () => {
      const { rerender } = renderExportDialog()

      // Modify some state
      const csvButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-csv`)
      await user.click(csvButton)
      expect(csvButton).toHaveClass('border-apex-500')

      // Close dialog
      rerender(<ExportDialog isOpen={false} onClose={mockOnClose} onExport={mockOnExport} />)

      // Reopen dialog
      rerender(<ExportDialog isOpen={true} onClose={mockOnClose} onExport={mockOnExport} availableTasks={mockTasks} />)

      // Should be back to default JSON format
      const jsonButton = screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-json`)
      expect(jsonButton).toHaveClass('border-apex-500', 'bg-apex-500/10')
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      renderExportDialog()

      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.dialog)).toHaveAttribute('aria-label', 'Export tasks dialog')
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)).toHaveAttribute('aria-label', 'Select date range preset')
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.taskFilterCheckbox)).toHaveAttribute('aria-label', 'Filter export by specific tasks')
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeArchivedCheckbox)).toHaveAttribute('aria-label', 'Include archived tasks in export')
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.includeTrashedCheckbox)).toHaveAttribute('aria-label', 'Include trashed tasks in export')
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.exportButton)).toHaveAttribute('aria-label', 'Export tasks')
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.cancelButton)).toHaveAttribute('aria-label', 'Cancel export')
    })

    it('has proper format selection ARIA labels', () => {
      renderExportDialog()

      expect(screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-json`)).toHaveAttribute('aria-label', 'Select export format - JSON')
      expect(screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-csv`)).toHaveAttribute('aria-label', 'Select export format - CSV')
      expect(screen.getByTestId(`${EXPORT_DIALOG_TEST_IDS.formatSelect}-markdown`)).toHaveAttribute('aria-label', 'Select export format - Markdown')
    })

    it('shows custom date ARIA labels when custom preset is selected', async () => {
      renderExportDialog()

      const presetSelect = screen.getByTestId(EXPORT_DIALOG_TEST_IDS.datePresetSelect)
      await user.selectOptions(presetSelect, 'custom')

      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.startDateInput)).toHaveAttribute('aria-label', 'Start date for export range')
      expect(screen.getByTestId(EXPORT_DIALOG_TEST_IDS.endDateInput)).toHaveAttribute('aria-label', 'End date for export range')
    })
  })
})