import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BulkActionToolbar } from '../BulkActionToolbar'
import { BulkSelectionProvider, BulkSelectionContext } from '../BulkSelectionContext'
import type { Task } from '@apexcli/core'
import { BULK_TEST_IDS, BULK_ARIA_LABELS } from '@/types/bulk-operations'

// Mock tasks for testing
const mockTasks: Task[] = [
  {
    id: 'task-1',
    description: 'Task 1 - In Progress',
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
    createdAt: new Date('2024-01-01T10:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T10:30:00Z').toISOString(),
  },
  {
    id: 'task-2',
    description: 'Task 2 - Completed',
    workflow: 'testing',
    autonomy: 'medium',
    status: 'completed',
    priority: 'medium',
    effort: 'small',
    projectPath: '/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T09:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T09:30:00Z').toISOString(),
  },
  {
    id: 'task-3',
    description: 'Task 3 - Failed',
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
    createdAt: new Date('2024-01-01T08:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T08:15:00Z').toISOString(),
  },
]

// Helper component that provides context and allows selection manipulation
const TestWrapper = ({
  children,
  initialSelected = [],
}: {
  children: React.ReactNode
  initialSelected?: string[]
}) => {
  return (
    <BulkSelectionProvider>
      {children}
      <TestControls initialSelected={initialSelected} />
    </BulkSelectionProvider>
  )
}

const TestControls = ({ initialSelected }: { initialSelected: string[] }) => {
  const { dispatch } = React.useContext(BulkSelectionContext)!

  React.useEffect(() => {
    if (initialSelected.length > 0) {
      dispatch({ type: 'SELECT_TASKS', taskIds: initialSelected })
    }
  }, [dispatch, initialSelected])

  return null
}

describe('BulkActionToolbar - Export Functionality', () => {
  const defaultProps = {
    tasks: mockTasks,
    visibleTaskIds: mockTasks.map(t => t.id),
    onBulkCancel: vi.fn(),
    onBulkRetry: vi.fn(),
    onBulkDelete: vi.fn(),
    isOperating: false,
    progress: null,
  }

  describe('Export Button Visibility', () => {
    it('renders export button when onBulkExport prop is provided', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      expect(screen.getByTestId(BULK_TEST_IDS.exportButton)).toBeInTheDocument()
      expect(screen.getByText('Export')).toBeInTheDocument()
    })

    it('does not render export button when onBulkExport prop is not provided', () => {
      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar {...defaultProps} />
        </TestWrapper>
      )

      expect(screen.queryByTestId(BULK_TEST_IDS.exportButton)).not.toBeInTheDocument()
    })

    it('does not render export button when onBulkExport is undefined', () => {
      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={undefined}
          />
        </TestWrapper>
      )

      expect(screen.queryByTestId(BULK_TEST_IDS.exportButton)).not.toBeInTheDocument()
    })
  })

  describe('Export Button States', () => {
    it('is enabled when tasks are selected and not operating', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1', 'task-2']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
            isOperating={false}
          />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      expect(exportButton).not.toBeDisabled()
    })

    it('is disabled when no tasks are selected', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={[]}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      // Toolbar should not be visible when no tasks are selected
      expect(screen.queryByTestId(BULK_TEST_IDS.exportButton)).not.toBeInTheDocument()
    })

    it('is disabled when operation is in progress', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1', 'task-2']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
            isOperating={true}
          />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      expect(exportButton).toBeDisabled()
    })
  })

  describe('Export Button Appearance', () => {
    it('displays selected task count badge', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1', 'task-2', 'task-3']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      // Should show count badge with 3
      const badge = screen.getByText('3')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('px-1.5', 'py-0.5', 'text-xs', 'bg-blue-500/20', 'text-blue-600', 'rounded')
    })

    it('displays different count badges for different selections', () => {
      const onBulkExport = vi.fn()

      const { rerender } = render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      expect(screen.getByText('1')).toBeInTheDocument()

      rerender(
        <TestWrapper initialSelected={['task-1', 'task-2']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('has correct styling for hover state', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      expect(exportButton).toHaveClass('hover:bg-blue-50', 'hover:border-blue-200', 'hover:text-blue-600')
    })

    it('shows download icon', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      // Check for Download icon (lucide-react Download component)
      const icon = screen.getByTestId(BULK_TEST_IDS.exportButton).querySelector('svg')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('Export Button Interactions', () => {
    it('calls onBulkExport with selected task IDs when clicked', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1', 'task-3']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      fireEvent.click(exportButton)

      expect(onBulkExport).toHaveBeenCalledWith(['task-1', 'task-3'])
    })

    it('calls onBulkExport with single task ID when one task selected', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-2']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      fireEvent.click(exportButton)

      expect(onBulkExport).toHaveBeenCalledWith(['task-2'])
    })

    it('calls onBulkExport with all selected task IDs', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={mockTasks.map(t => t.id)}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      fireEvent.click(exportButton)

      expect(onBulkExport).toHaveBeenCalledWith(['task-1', 'task-2', 'task-3'])
    })

    it('does not call onBulkExport when button is disabled', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
            isOperating={true}
          />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      fireEvent.click(exportButton)

      expect(onBulkExport).not.toHaveBeenCalled()
    })

    it('handles multiple clicks gracefully', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1', 'task-2']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)

      fireEvent.click(exportButton)
      fireEvent.click(exportButton)
      fireEvent.click(exportButton)

      expect(onBulkExport).toHaveBeenCalledTimes(3)
      expect(onBulkExport).toHaveBeenNthCalledWith(1, ['task-1', 'task-2'])
      expect(onBulkExport).toHaveBeenNthCalledWith(2, ['task-1', 'task-2'])
      expect(onBulkExport).toHaveBeenNthCalledWith(3, ['task-1', 'task-2'])
    })
  })

  describe('Export Button Accessibility', () => {
    it('has correct aria-label for single task selection', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      expect(exportButton).toHaveAttribute('aria-label', BULK_ARIA_LABELS.exportSelected(1))
    })

    it('has correct aria-label for multiple task selection', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1', 'task-2', 'task-3']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      expect(exportButton).toHaveAttribute('aria-label', BULK_ARIA_LABELS.exportSelected(3))
    })

    it('is focusable with keyboard navigation', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      exportButton.focus()
      expect(exportButton).toHaveFocus()
    })

    it('responds to keyboard activation', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      exportButton.focus()

      fireEvent.keyDown(exportButton, { key: 'Enter', code: 'Enter' })
      expect(onBulkExport).toHaveBeenCalledWith(['task-1'])
    })
  })

  describe('Export Button in Compact Mode', () => {
    it('renders correctly in compact mode', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
            compact={true}
          />
        </TestWrapper>
      )

      const exportButton = screen.getByTestId(BULK_TEST_IDS.exportButton)
      expect(exportButton).toBeInTheDocument()

      // In compact mode, button text should not be visible
      expect(screen.queryByText('Export')).not.toBeInTheDocument()

      // But icon and count should still be visible
      const icon = exportButton.querySelector('svg')
      expect(icon).toBeInTheDocument()
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('still shows task count badge in compact mode', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1', 'task-2']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
            compact={true}
          />
        </TestWrapper>
      )

      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  describe('Export Button Position', () => {
    it('appears before other action buttons', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      const toolbar = screen.getByTestId(BULK_TEST_IDS.toolbar)
      const buttons = toolbar.querySelectorAll('button')

      // Find export and other action buttons
      const exportButton = Array.from(buttons).find(btn => btn.getAttribute('data-testid') === BULK_TEST_IDS.exportButton)
      const cancelButton = Array.from(buttons).find(btn => btn.getAttribute('data-testid') === BULK_TEST_IDS.cancelButton)

      expect(exportButton).toBeInTheDocument()
      expect(cancelButton).toBeInTheDocument()

      // Export button should come before cancel button in DOM order
      const exportIndex = Array.from(buttons).indexOf(exportButton!)
      const cancelIndex = Array.from(buttons).indexOf(cancelButton!)
      expect(exportIndex).toBeLessThan(cancelIndex)
    })
  })

  describe('Edge Cases', () => {
    it('handles rapid selection changes', async () => {
      const onBulkExport = vi.fn()

      const { rerender } = render(
        <TestWrapper initialSelected={['task-1']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      // Verify initial state
      expect(screen.getByText('1')).toBeInTheDocument()

      // Change selection rapidly
      rerender(
        <TestWrapper initialSelected={['task-1', 'task-2']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('2')).toBeInTheDocument()
      })

      rerender(
        <TestWrapper initialSelected={['task-1', 'task-2', 'task-3']}>
          <BulkActionToolbar
            {...defaultProps}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      await waitFor(() => {
        expect(screen.getByText('3')).toBeInTheDocument()
      })
    })

    it('works with empty task list', () => {
      const onBulkExport = vi.fn()

      render(
        <TestWrapper>
          <BulkActionToolbar
            {...defaultProps}
            tasks={[]}
            visibleTaskIds={[]}
            onBulkExport={onBulkExport}
          />
        </TestWrapper>
      )

      // Toolbar should not be visible with empty task list
      expect(screen.queryByTestId(BULK_TEST_IDS.exportButton)).not.toBeInTheDocument()
    })
  })
})