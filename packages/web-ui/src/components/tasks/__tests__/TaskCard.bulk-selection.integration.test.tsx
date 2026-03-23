import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TaskCard } from '../TaskCard'
import { BulkSelectionProvider } from '../BulkSelectionContext'
import type { Task } from '@apexcli/core'

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
]

// Helper component to test selection state
const SelectionStateDisplay = () => {
  const { selectedTaskIds, selectionMode } = React.useContext(BulkSelectionContext)!

  return (
    <div>
      <div data-testid="selection-count">{selectedTaskIds.size}</div>
      <div data-testid="selection-mode">{selectionMode}</div>
      <div data-testid="selected-ids">{Array.from(selectedTaskIds).join(',')}</div>
    </div>
  )
}

// Import the context for direct access
import { BulkSelectionContext } from '../BulkSelectionContext'

describe('TaskCard Bulk Selection Integration', () => {
  describe('Without Bulk Selection Context', () => {
    it('renders normally without selection checkbox', () => {
      render(<TaskCard task={mockTasks[0]} />)

      expect(screen.getByText('Task 1 - In Progress')).toBeInTheDocument()
      expect(screen.queryByTestId('task-checkbox-task-1')).not.toBeInTheDocument()
    })

    it('does not add left margin for checkbox', () => {
      render(<TaskCard task={mockTasks[0]} />)

      const taskCard = screen.getByRole('generic')
      expect(taskCard).not.toHaveClass('ml-10') // No left margin without checkbox
    })

    it('handles onViewDetails normally', () => {
      const onViewDetails = vi.fn()
      render(<TaskCard task={mockTasks[0]} onViewDetails={onViewDetails} />)

      fireEvent.click(screen.getByText('Task 1 - In Progress'))
      expect(onViewDetails).toHaveBeenCalledWith('task-1')
    })
  })

  describe('With Bulk Selection Context', () => {
    it('renders selection checkbox when context is available', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
        </BulkSelectionProvider>
      )

      expect(screen.getByTestId('task-checkbox-task-1')).toBeInTheDocument()
    })

    it('checkbox has correct accessibility attributes', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
        </BulkSelectionProvider>
      )

      const checkbox = screen.getByTestId('task-checkbox-task-1') as HTMLInputElement
      expect(checkbox).toHaveAttribute('type', 'checkbox')
      expect(checkbox).toHaveAttribute('aria-label', 'Select task: Task 1 - In Progress')
      expect(checkbox.checked).toBe(false)
    })

    it('adds left margin to accommodate checkbox', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
        </BulkSelectionProvider>
      )

      const taskCard = screen.getByRole('generic')
      expect(taskCard).toHaveClass('ml-10') // Left margin for checkbox
    })

    it('checkbox appears in top-left corner', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
        </BulkSelectionProvider>
      )

      const checkbox = screen.getByTestId('task-checkbox-task-1')
      const container = checkbox.parentElement
      expect(container).toHaveClass('absolute', 'top-3', 'left-3')
    })

    it('toggles selection when checkbox is clicked', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
          <SelectionStateDisplay />
        </BulkSelectionProvider>
      )

      expect(screen.getByTestId('selection-count')).toHaveTextContent('0')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('none')

      // Click checkbox to select
      const checkbox = screen.getByTestId('task-checkbox-task-1')
      fireEvent.click(checkbox)

      expect(screen.getByTestId('selection-count')).toHaveTextContent('1')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('some')
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('task-1')

      // Click again to deselect
      fireEvent.click(checkbox)

      expect(screen.getByTestId('selection-count')).toHaveTextContent('0')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('none')
    })

    it('updates checkbox state when selection changes externally', () => {
      const TestComponent = () => {
        const { selectedTaskIds, dispatch } = React.useContext(BulkSelectionContext)!

        return (
          <div>
            <TaskCard task={mockTasks[0]} />
            <button
              onClick={() => dispatch({ type: 'TOGGLE_TASK', taskId: 'task-1' })}
              data-testid="external-toggle"
            >
              External Toggle
            </button>
            <div data-testid="is-selected">
              {selectedTaskIds.has('task-1') ? 'selected' : 'not-selected'}
            </div>
          </div>
        )
      }

      render(
        <BulkSelectionProvider>
          <TestComponent />
        </BulkSelectionProvider>
      )

      const checkbox = screen.getByTestId('task-checkbox-task-1') as HTMLInputElement
      expect(checkbox.checked).toBe(false)
      expect(screen.getByTestId('is-selected')).toHaveTextContent('not-selected')

      // Toggle externally
      fireEvent.click(screen.getByTestId('external-toggle'))

      expect(checkbox.checked).toBe(true)
      expect(screen.getByTestId('is-selected')).toHaveTextContent('selected')
    })

    it('stops event propagation on checkbox click', () => {
      const onViewDetails = vi.fn()

      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} onViewDetails={onViewDetails} />
        </BulkSelectionProvider>
      )

      // Click checkbox - should not trigger onViewDetails
      const checkbox = screen.getByTestId('task-checkbox-task-1')
      fireEvent.click(checkbox)

      expect(onViewDetails).not.toHaveBeenCalled()

      // Click card content - should trigger onViewDetails
      fireEvent.click(screen.getByText('Task 1 - In Progress'))

      expect(onViewDetails).toHaveBeenCalledWith('task-1')
    })

    it('maintains proper z-index layering', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
        </BulkSelectionProvider>
      )

      const checkboxContainer = screen.getByTestId('task-checkbox-task-1').parentElement
      expect(checkboxContainer).toHaveClass('z-10') // Higher z-index than card content
    })

    it('updates aria-label based on selection state', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
          <SelectionStateDisplay />
        </BulkSelectionProvider>
      )

      const checkbox = screen.getByTestId('task-checkbox-task-1')

      // Initially unselected
      expect(checkbox).toHaveAttribute(
        'aria-label',
        'Select task: Task 1 - In Progress'
      )

      // After selection
      fireEvent.click(checkbox)
      expect(checkbox).toHaveAttribute(
        'aria-label',
        'Deselect task: Task 1 - In Progress'
      )
    })
  })

  describe('Multiple TaskCards Integration', () => {
    it('handles multiple cards with independent selection', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
          <TaskCard task={mockTasks[1]} />
          <SelectionStateDisplay />
        </BulkSelectionProvider>
      )

      expect(screen.getByTestId('selection-count')).toHaveTextContent('0')

      // Select first task
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      expect(screen.getByTestId('selection-count')).toHaveTextContent('1')
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('task-1')

      // Select second task
      fireEvent.click(screen.getByTestId('task-checkbox-task-2'))
      expect(screen.getByTestId('selection-count')).toHaveTextContent('2')

      const selectedIds = screen.getByTestId('selected-ids').textContent?.split(',') || []
      expect(selectedIds).toContain('task-1')
      expect(selectedIds).toContain('task-2')

      // Deselect first task
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      expect(screen.getByTestId('selection-count')).toHaveTextContent('1')
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('task-2')
    })

    it('updates all checkboxes when using select all', () => {
      const SelectAllButton = () => {
        const { dispatch } = React.useContext(BulkSelectionContext)!

        return (
          <button
            onClick={() => dispatch({
              type: 'SELECT_ALL',
              taskIds: mockTasks.map(t => t.id)
            })}
            data-testid="select-all"
          >
            Select All
          </button>
        )
      }

      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
          <TaskCard task={mockTasks[1]} />
          <SelectAllButton />
          <SelectionStateDisplay />
        </BulkSelectionProvider>
      )

      // Initially no selection
      const checkbox1 = screen.getByTestId('task-checkbox-task-1') as HTMLInputElement
      const checkbox2 = screen.getByTestId('task-checkbox-task-2') as HTMLInputElement
      expect(checkbox1.checked).toBe(false)
      expect(checkbox2.checked).toBe(false)

      // Select all
      fireEvent.click(screen.getByTestId('select-all'))

      expect(checkbox1.checked).toBe(true)
      expect(checkbox2.checked).toBe(true)
      expect(screen.getByTestId('selection-count')).toHaveTextContent('2')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('all')
    })
  })

  describe('Visual States and Styling', () => {
    it('applies correct styling when selected', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
        </BulkSelectionProvider>
      )

      const taskCard = screen.getByRole('generic')

      // Initially not selected - no selection styling
      expect(taskCard).not.toHaveClass('ring-2', 'ring-apex-500')

      // Select the task
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))

      // Should have selection styling
      expect(taskCard).toHaveClass('ring-2', 'ring-apex-500', 'bg-apex-50/50')
    })

    it('maintains hover states with selection', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
        </BulkSelectionProvider>
      )

      const taskCard = screen.getByRole('generic')

      // Hover should still work
      fireEvent.mouseEnter(taskCard)
      expect(taskCard).toHaveClass('hover:bg-gray-50')

      // Select and hover
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))
      fireEvent.mouseEnter(taskCard)
      // Should maintain both selected and hover states
    })

    it('shows checkbox with proper focus styles', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
        </BulkSelectionProvider>
      )

      const checkbox = screen.getByTestId('task-checkbox-task-1')

      checkbox.focus()
      expect(checkbox).toHaveFocus()
      expect(checkbox).toHaveClass('focus:ring-2', 'focus:ring-apex-500')
    })

    it('handles different task statuses with selection', () => {
      const failedTask = {
        ...mockTasks[0],
        status: 'failed' as const,
        error: 'Task failed'
      }

      render(
        <BulkSelectionProvider>
          <TaskCard task={failedTask} />
        </BulkSelectionProvider>
      )

      // Should show both error styling and selection capability
      expect(screen.getByTestId('task-checkbox-task-1')).toBeInTheDocument()
      expect(screen.getByText('Task failed')).toBeInTheDocument()

      // Selection should still work
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))

      const checkbox = screen.getByTestId('task-checkbox-task-1') as HTMLInputElement
      expect(checkbox.checked).toBe(true)
    })
  })

  describe('Performance and Memory', () => {
    it('handles rapid selection changes efficiently', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
          <SelectionStateDisplay />
        </BulkSelectionProvider>
      )

      const checkbox = screen.getByTestId('task-checkbox-task-1')

      // Rapidly toggle selection many times
      for (let i = 0; i < 100; i++) {
        fireEvent.click(checkbox)
      }

      // Should end up unselected (even number of clicks)
      expect(screen.getByTestId('selection-count')).toHaveTextContent('0')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('none')
    })

    it('does not re-render unnecessarily', () => {
      const renderSpy = vi.fn()

      const SpiedTaskCard = React.memo(({ task }: { task: Task }) => {
        renderSpy()
        return <TaskCard task={task} />
      })
      SpiedTaskCard.displayName = 'SpiedTaskCard'

      const OtherTaskCard = () => <TaskCard task={mockTasks[1]} />

      render(
        <BulkSelectionProvider>
          <SpiedTaskCard task={mockTasks[0]} />
          <OtherTaskCard />
        </BulkSelectionProvider>
      )

      const initialRenderCount = renderSpy.mock.calls.length

      // Select the other task - spied component should not re-render
      fireEvent.click(screen.getByTestId('task-checkbox-task-2'))

      expect(renderSpy).toHaveBeenCalledTimes(initialRenderCount)
    })

    it('cleans up properly when unmounted', () => {
      const { unmount } = render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
        </BulkSelectionProvider>
      )

      // Select task
      fireEvent.click(screen.getByTestId('task-checkbox-task-1'))

      // Unmounting should not cause errors
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Accessibility Compliance', () => {
    it('maintains proper focus order', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
        </BulkSelectionProvider>
      )

      const checkbox = screen.getByTestId('task-checkbox-task-1')

      // Checkbox should be focusable via keyboard navigation
      checkbox.focus()
      expect(checkbox).toHaveFocus()

      // Tab should move focus away from checkbox
      fireEvent.keyDown(checkbox, { key: 'Tab' })
      expect(checkbox).not.toHaveFocus()
    })

    it('supports keyboard selection', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
          <SelectionStateDisplay />
        </BulkSelectionProvider>
      )

      const checkbox = screen.getByTestId('task-checkbox-task-1')
      checkbox.focus()

      // Space key should toggle selection
      fireEvent.keyDown(checkbox, { key: ' ' })
      expect(screen.getByTestId('selection-count')).toHaveTextContent('1')

      fireEvent.keyDown(checkbox, { key: ' ' })
      expect(screen.getByTestId('selection-count')).toHaveTextContent('0')
    })

    it('provides proper screen reader context', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
        </BulkSelectionProvider>
      )

      const checkbox = screen.getByTestId('task-checkbox-task-1')

      // Should have descriptive label that includes task info
      expect(checkbox).toHaveAttribute(
        'aria-label',
        'Select task: Task 1 - In Progress'
      )
    })

    it('maintains semantic HTML structure', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
        </BulkSelectionProvider>
      )

      const checkbox = screen.getByTestId('task-checkbox-task-1')
      expect(checkbox.tagName).toBe('INPUT')
      expect(checkbox).toHaveAttribute('type', 'checkbox')
    })

    it('supports high contrast mode', () => {
      render(
        <BulkSelectionProvider>
          <TaskCard task={mockTasks[0]} />
        </BulkSelectionProvider>
      )

      const checkbox = screen.getByTestId('task-checkbox-task-1')

      // Should have proper border for high contrast visibility
      expect(checkbox).toHaveClass('border-2', 'border-gray-300')
    })
  })

  describe('Error Handling', () => {
    it('handles missing task ID gracefully', () => {
      const invalidTask = { ...mockTasks[0] }
      delete (invalidTask as any).id

      expect(() => {
        render(
          <BulkSelectionProvider>
            <TaskCard task={invalidTask as any} />
          </BulkSelectionProvider>
        )
      }).not.toThrow()

      // Should render without checkbox
      expect(screen.queryByTestId('task-checkbox-undefined')).not.toBeInTheDocument()
    })

    it('handles very long task descriptions in checkbox label', () => {
      const longDescTask = {
        ...mockTasks[0],
        description: 'This is a very long task description that should be handled gracefully in the checkbox aria-label without breaking accessibility or layout'
      }

      render(
        <BulkSelectionProvider>
          <TaskCard task={longDescTask} />
        </BulkSelectionProvider>
      )

      const checkbox = screen.getByTestId('task-checkbox-task-1')
      expect(checkbox).toHaveAttribute('aria-label')

      const label = checkbox.getAttribute('aria-label')
      expect(label).toContain('This is a very long task description')
    })

    it('recovers gracefully from selection context errors', () => {
      // Mock console.error to avoid noise in test output
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Render TaskCard with a broken context provider
      const BrokenProvider = ({ children }: { children: React.ReactNode }) => {
        const [, setState] = React.useState({})

        React.useEffect(() => {
          // Trigger an error in the context
          setState(() => {
            throw new Error('Context error')
          })
        }, [])

        return (
          <BulkSelectionProvider>
            {children}
          </BulkSelectionProvider>
        )
      }

      expect(() => {
        render(
          <BrokenProvider>
            <TaskCard task={mockTasks[0]} />
          </BrokenProvider>
        )
      }).not.toThrow()

      consoleErrorSpy.mockRestore()
    })
  })
})