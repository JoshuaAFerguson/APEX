import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  BulkSelectionProvider,
  useBulkSelection,
  useBulkSelectionOptional
} from '../BulkSelectionContext'
import type { Task } from '@apexcli/core'

// Mock tasks for testing
const mockTasks: Task[] = [
  {
    id: 'task-1',
    description: 'Task 1',
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
    description: 'Task 2',
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
    description: 'Task 3',
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

// Test component that uses the context
const TestComponent = ({ onSelectionChange }: { onSelectionChange?: (selectedIds: string[]) => void }) => {
  const {
    state: { selectedTaskIds, selectionMode },
    toggleTaskSelection,
    selectAll,
    deselectAll,
    selectTasks,
    deselectTasks,
    getSelectedTasks
  } = useBulkSelection()

  React.useEffect(() => {
    onSelectionChange?.(getSelectedTasks())
  }, [selectedTaskIds, onSelectionChange, getSelectedTasks])

  return (
    <div>
      <div data-testid="selected-count">{selectedTaskIds.size}</div>
      <div data-testid="selection-mode">{selectionMode}</div>
      <div data-testid="selected-ids">{Array.from(selectedTaskIds).join(',')}</div>

      <button
        onClick={() => toggleTaskSelection('task-1')}
        data-testid="toggle-task-1"
      >
        Toggle Task 1
      </button>

      <button
        onClick={() => toggleTaskSelection('task-2')}
        data-testid="toggle-task-2"
      >
        Toggle Task 2
      </button>

      <button
        onClick={() => selectAll(mockTasks.map(t => t.id))}
        data-testid="select-all"
      >
        Select All
      </button>

      <button
        onClick={() => deselectAll()}
        data-testid="deselect-all"
      >
        Deselect All
      </button>

      <button
        onClick={() => selectTasks(['task-1', 'task-2'])}
        data-testid="select-multiple"
      >
        Select Multiple
      </button>

      <button
        onClick={() => deselectTasks(['task-1'])}
        data-testid="deselect-specific"
      >
        Deselect Specific
      </button>
    </div>
  )
}

// Test component that uses optional context
const OptionalTestComponent = () => {
  const bulkSelection = useBulkSelectionOptional()

  return (
    <div>
      <div data-testid="context-available">{bulkSelection ? 'true' : 'false'}</div>
      {bulkSelection && (
        <div data-testid="optional-selected-count">{bulkSelection.state.selectedTaskIds.size}</div>
      )}
    </div>
  )
}

describe('BulkSelectionContext', () => {
  describe('BulkSelectionProvider', () => {
    it('provides initial empty state', () => {
      render(
        <BulkSelectionProvider>
          <TestComponent />
        </BulkSelectionProvider>
      )

      expect(screen.getByTestId('selected-count')).toHaveTextContent('0')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('none')
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('')
    })

    it('toggles single task selection', () => {
      render(
        <BulkSelectionProvider>
          <TestComponent />
        </BulkSelectionProvider>
      )

      // Initially no selection
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('none')

      // Select task-1
      fireEvent.click(screen.getByTestId('toggle-task-1'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('some')
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('task-1')

      // Toggle task-1 again to deselect
      fireEvent.click(screen.getByTestId('toggle-task-1'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('none')
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('')
    })

    it('allows multiple task selection', () => {
      render(
        <BulkSelectionProvider>
          <TestComponent />
        </BulkSelectionProvider>
      )

      // Select task-1
      fireEvent.click(screen.getByTestId('toggle-task-1'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('some')

      // Select task-2
      fireEvent.click(screen.getByTestId('toggle-task-2'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('2')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('some')

      const selectedIds = screen.getByTestId('selected-ids').textContent?.split(',') || []
      expect(selectedIds).toContain('task-1')
      expect(selectedIds).toContain('task-2')
    })

    it('handles select all action', () => {
      const taskIds = mockTasks.map(t => t.id)

      render(
        <BulkSelectionProvider>
          <TestComponent />
        </BulkSelectionProvider>
      )

      fireEvent.click(screen.getByTestId('select-all'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('3')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('all')

      const selectedIds = screen.getByTestId('selected-ids').textContent?.split(',') || []
      expect(selectedIds).toEqual(expect.arrayContaining(taskIds))
    })

    it('handles deselect all action', () => {
      render(
        <BulkSelectionProvider>
          <TestComponent />
        </BulkSelectionProvider>
      )

      // First select all
      fireEvent.click(screen.getByTestId('select-all'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('3')

      // Then deselect all
      fireEvent.click(screen.getByTestId('deselect-all'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('none')
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('')
    })

    it('handles select multiple tasks action', () => {
      render(
        <BulkSelectionProvider>
          <TestComponent />
        </BulkSelectionProvider>
      )

      fireEvent.click(screen.getByTestId('select-multiple'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('2')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('some')

      const selectedIds = screen.getByTestId('selected-ids').textContent?.split(',') || []
      expect(selectedIds).toContain('task-1')
      expect(selectedIds).toContain('task-2')
    })

    it('handles deselect specific tasks action', () => {
      render(
        <BulkSelectionProvider>
          <TestComponent />
        </BulkSelectionProvider>
      )

      // First select multiple
      fireEvent.click(screen.getByTestId('select-multiple'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('2')

      // Then deselect task-1
      fireEvent.click(screen.getByTestId('deselect-specific'))
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('some')
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('task-2')
    })

    it('calculates selection mode correctly', () => {
      render(
        <BulkSelectionProvider>
          <TestComponent />
        </BulkSelectionProvider>
      )

      // None selected - mode should be 'none'
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('none')

      // Some selected - mode should be 'some'
      fireEvent.click(screen.getByTestId('toggle-task-1'))
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('some')

      // All selected - mode should be 'all'
      fireEvent.click(screen.getByTestId('select-all'))
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('all')
    })

    it('notifies selection changes', () => {
      const onSelectionChange = vi.fn()

      render(
        <BulkSelectionProvider>
          <TestComponent onSelectionChange={onSelectionChange} />
        </BulkSelectionProvider>
      )

      // Initial call with empty selection
      expect(onSelectionChange).toHaveBeenCalledWith([])

      // Select task
      fireEvent.click(screen.getByTestId('toggle-task-1'))
      expect(onSelectionChange).toHaveBeenCalledWith(['task-1'])

      // Select another task
      fireEvent.click(screen.getByTestId('toggle-task-2'))
      expect(onSelectionChange).toHaveBeenCalledWith(expect.arrayContaining(['task-1', 'task-2']))
    })
  })

  describe('useBulkSelection hook', () => {
    it('throws error when used outside provider', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(<TestComponent />)
      }).toThrow('useBulkSelection must be used within a BulkSelectionProvider')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('useBulkSelectionOptional hook', () => {
    it('returns null when used outside provider', () => {
      render(<OptionalTestComponent />)

      expect(screen.getByTestId('context-available')).toHaveTextContent('false')
      expect(screen.queryByTestId('optional-selected-count')).not.toBeInTheDocument()
    })

    it('returns context when used inside provider', () => {
      render(
        <BulkSelectionProvider>
          <OptionalTestComponent />
        </BulkSelectionProvider>
      )

      expect(screen.getByTestId('context-available')).toHaveTextContent('true')
      expect(screen.getByTestId('optional-selected-count')).toHaveTextContent('0')
    })
  })

  describe('Performance and Memory Management', () => {
    it('handles rapid selection changes without memory leaks', () => {
      render(
        <BulkSelectionProvider>
          <TestComponent />
        </BulkSelectionProvider>
      )

      // Rapidly toggle selections
      for (let i = 0; i < 100; i++) {
        fireEvent.click(screen.getByTestId('toggle-task-1'))
      }

      // Should end up unselected (even number of clicks)
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0')
    })

    it('maintains state consistency with concurrent updates', () => {
      render(
        <BulkSelectionProvider>
          <TestComponent />
        </BulkSelectionProvider>
      )

      act(() => {
        // Fire multiple actions in a single act
        fireEvent.click(screen.getByTestId('toggle-task-1'))
        fireEvent.click(screen.getByTestId('toggle-task-2'))
        fireEvent.click(screen.getByTestId('toggle-task-1')) // deselect
      })

      expect(screen.getByTestId('selected-count')).toHaveTextContent('1')
      expect(screen.getByTestId('selected-ids')).toHaveTextContent('task-2')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty task list for select all', () => {
      const EmptySelectAllTest = () => {
        const { selectAll } = useBulkSelection()

        React.useEffect(() => {
          selectAll([])
        }, [selectAll])

        return <TestComponent />
      }

      render(
        <BulkSelectionProvider>
          <EmptySelectAllTest />
        </BulkSelectionProvider>
      )

      expect(screen.getByTestId('selected-count')).toHaveTextContent('0')
      expect(screen.getByTestId('selection-mode')).toHaveTextContent('none')
    })

    it('ignores duplicate task IDs in selection', () => {
      render(
        <BulkSelectionProvider>
          <TestComponent />
        </BulkSelectionProvider>
      )

      // Select same task multiple times
      fireEvent.click(screen.getByTestId('toggle-task-1'))
      fireEvent.click(screen.getByTestId('toggle-task-1'))
      fireEvent.click(screen.getByTestId('toggle-task-1'))

      // Should toggle back to unselected
      expect(screen.getByTestId('selected-count')).toHaveTextContent('0')
    })

    it('handles invalid task IDs gracefully', () => {
      const TestComponentWithInvalid = () => {
        const { selectedTaskIds, dispatch } = useBulkSelection()

        return (
          <div>
            <div data-testid="selected-count">{selectedTaskIds.size}</div>
            <button
              onClick={() => dispatch({ type: 'TOGGLE_TASK', taskId: 'invalid-task-id' })}
              data-testid="toggle-invalid"
            >
              Toggle Invalid
            </button>
          </div>
        )
      }

      render(
        <BulkSelectionProvider>
          <TestComponentWithInvalid />
        </BulkSelectionProvider>
      )

      // Should not throw error
      expect(() => {
        fireEvent.click(screen.getByTestId('toggle-invalid'))
      }).not.toThrow()

      // Should still work normally
      expect(screen.getByTestId('selected-count')).toHaveTextContent('1')
    })
  })

  describe('Accessibility', () => {
    it('provides proper ARIA attributes for screen readers', () => {
      const AccessibilityTestComponent = () => {
        const { state: { selectedTaskIds, selectionMode } } = useBulkSelection()

        return (
          <div
            role="region"
            aria-label="Task selection"
            aria-describedby="selection-status"
          >
            <div
              id="selection-status"
              aria-live="polite"
              data-testid="selection-status"
            >
              {selectionMode === 'none' && 'No tasks selected'}
              {selectionMode === 'some' && `${selectedTaskIds.size} tasks selected`}
              {selectionMode === 'all' && 'All tasks selected'}
            </div>
          </div>
        )
      }

      render(
        <BulkSelectionProvider>
          <AccessibilityTestComponent />
          <TestComponent />
        </BulkSelectionProvider>
      )

      // Check initial accessibility state
      expect(screen.getByRole('region', { name: 'Task selection' })).toBeInTheDocument()
      expect(screen.getByTestId('selection-status')).toHaveTextContent('No tasks selected')
      expect(screen.getByTestId('selection-status')).toHaveAttribute('aria-live', 'polite')

      // Select a task and verify accessibility updates
      fireEvent.click(screen.getByTestId('toggle-task-1'))
      expect(screen.getByTestId('selection-status')).toHaveTextContent('1 tasks selected')

      // Select all and verify
      fireEvent.click(screen.getByTestId('select-all'))
      expect(screen.getByTestId('selection-status')).toHaveTextContent('All tasks selected')
    })
  })
})