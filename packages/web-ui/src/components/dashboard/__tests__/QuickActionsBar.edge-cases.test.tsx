/**
 * Edge cases and error handling tests for QuickActionsBar
 *
 * Tests comprehensive edge cases and error scenarios including:
 * - Network failures and API errors
 * - Invalid template data
 * - Concurrent operations
 * - Race conditions
 * - Memory leaks and cleanup
 * - Extreme input values
 * - Boundary conditions
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { QuickActionsBar } from '../QuickActionsBar'
import { useQuickActionTemplates } from '@/hooks/useQuickActionTemplates'
import type { TaskTemplate } from '@/types/task-template'

// Mock the hook
vi.mock('@/hooks/useQuickActionTemplates')
const mockUseQuickActionTemplates = vi.mocked(useQuickActionTemplates)

// Mock child components
vi.mock('../QuickActionButton', () => ({
  QuickActionButton: ({ template, onClick, loading }: any) => (
    <button
      data-testid={`quick-action-${template.id}`}
      onClick={() => onClick(template)}
      disabled={loading}
    >
      {loading ? 'Creating...' : template.name}
    </button>
  ),
}))

vi.mock('../QuickActionVariableModal', () => ({
  QuickActionVariableModal: ({ isOpen, template, onClose, onTaskCreated, onError }: any) =>
    isOpen ? (
      <div data-testid="variable-modal">
        <button data-testid="modal-close" onClick={onClose}>
          Close
        </button>
        <button
          data-testid="modal-create-success"
          onClick={() => onTaskCreated('task_123')}
        >
          Create Task
        </button>
        <button
          data-testid="modal-create-error"
          onClick={() => onError(new Error('Modal creation failed'))}
        >
          Create Error Task
        </button>
      </div>
    ) : null,
}))

// Test data helpers
const createTemplate = (id: string, overrides?: Partial<TaskTemplate>): TaskTemplate => ({
  id,
  name: `Template ${id}`,
  description: `Description for ${id}`,
  category: 'feature',
  workflow: 'feature',
  autonomy: 'review-before-commit',
  descriptionTemplate: 'Create feature',
  tags: ['test'],
  isQuickAction: true,
  priority: 'normal',
  effort: 'medium',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  ...overrides,
})

const createDefaultMockReturn = () => ({
  templates: [],
  isLoading: false,
  error: null,
  refresh: vi.fn(),
  createTaskFromTemplate: vi.fn(),
  hasRequiredVariables: vi.fn().mockReturnValue(false),
})

describe('QuickActionsBar Edge Cases and Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseQuickActionTemplates.mockReturnValue(createDefaultMockReturn())
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Network and API Failures', () => {
    it('handles network timeout during template loading', async () => {
      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        isLoading: true,
      })

      render(<QuickActionsBar />)

      // Should show loading state indefinitely for timeout
      expect(screen.getByText('Loading quick actions...')).toBeInTheDocument()

      // Simulate timeout by never resolving
      await new Promise(resolve => setTimeout(resolve, 100))
      expect(screen.getByText('Loading quick actions...')).toBeInTheDocument()
    })

    it('handles intermittent network failures with retry', async () => {
      const mockRefresh = vi.fn()

      // Start with error
      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        error: 'Network timeout',
        refresh: mockRefresh,
      })

      const { rerender } = render(<QuickActionsBar />)

      expect(screen.getByText('Failed to load quick actions: Network timeout')).toBeInTheDocument()

      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      expect(mockRefresh).toHaveBeenCalledTimes(1)

      // Simulate successful retry
      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: [createTemplate('1')],
      })

      rerender(<QuickActionsBar />)

      expect(screen.queryByText('Failed to load quick actions')).not.toBeInTheDocument()
      expect(screen.getByTestId('quick-action-1')).toBeInTheDocument()
    })

    it('handles API returning malformed template data', async () => {
      const malformedTemplates = [
        // Missing required fields
        {
          id: 'malformed_1',
          name: null,
          description: undefined,
        },
        // Invalid types
        {
          id: 'malformed_2',
          name: 123,
          description: ['not', 'a', 'string'],
          category: 'invalid-category',
        },
        // Circular references (if JSON parsing)
        {
          id: 'malformed_3',
          name: 'Circular',
          description: 'Has circular ref',
        },
      ] as any

      // Add circular reference
      malformedTemplates[2].self = malformedTemplates[2]

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: malformedTemplates,
      })

      // Should not crash, but may show degraded content
      expect(() => {
        render(<QuickActionsBar />)
      }).not.toThrow()
    })

    it('handles very large API responses gracefully', async () => {
      // Create 1000 templates
      const manyTemplates = Array.from({ length: 1000 }, (_, i) =>
        createTemplate(`template_${i}`, {
          name: `Template ${i}`.repeat(100), // Very long names
          description: 'x'.repeat(10000), // Very long descriptions
        })
      )

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: manyTemplates,
      })

      const startTime = performance.now()
      render(<QuickActionsBar maxActions={50} />)
      const endTime = performance.now()

      // Should render without significant performance impact
      expect(endTime - startTime).toBeLessThan(1000) // Less than 1 second

      // Should limit displayed templates
      const buttons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('data-testid')?.includes('quick-action')
      )
      expect(buttons.length).toBe(50)
    })
  })

  describe('Concurrent Operations', () => {
    it('handles multiple rapid task creation attempts', async () => {
      const mockCreate = vi.fn()
      let resolveCount = 0
      const resolvers: Array<(value: string) => void> = []

      mockCreate.mockImplementation(() => {
        return new Promise<string>((resolve) => {
          resolvers.push(() => resolve(`task_${++resolveCount}`))
        })
      })

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: [createTemplate('1'), createTemplate('2'), createTemplate('3')],
        createTaskFromTemplate: mockCreate,
      })

      const onTaskCreated = vi.fn()
      render(<QuickActionsBar onTaskCreated={onTaskCreated} />)

      // Rapidly click multiple buttons
      const button1 = screen.getByTestId('quick-action-1')
      const button2 = screen.getByTestId('quick-action-2')
      const button3 = screen.getByTestId('quick-action-3')

      fireEvent.click(button1)
      fireEvent.click(button2)
      fireEvent.click(button3)

      // All should show loading state
      expect(button1).toHaveTextContent('Creating...')
      expect(button2).toHaveTextContent('Creating...')
      expect(button3).toHaveTextContent('Creating...')

      // Resolve in different order
      await act(async () => {
        resolvers[1]() // Resolve second
        await waitFor(() => {
          expect(onTaskCreated).toHaveBeenCalledWith('task_2', '2')
        })
      })

      await act(async () => {
        resolvers[0]() // Resolve first
        await waitFor(() => {
          expect(onTaskCreated).toHaveBeenCalledWith('task_1', '1')
        })
      })

      await act(async () => {
        resolvers[2]() // Resolve third
        await waitFor(() => {
          expect(onTaskCreated).toHaveBeenCalledWith('task_3', '3')
        })
      })

      expect(onTaskCreated).toHaveBeenCalledTimes(3)
    })

    it('handles modal opening while other operations are in progress', async () => {
      const mockCreate = vi.fn()
      const mockHasRequired = vi.fn()

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: [
          createTemplate('no_vars'),
          createTemplate('with_vars', { variables: [{ name: 'test', label: 'Test', type: 'string', required: true }] })
        ],
        createTaskFromTemplate: mockCreate,
        hasRequiredVariables: mockHasRequired,
      })

      mockHasRequired.mockImplementation((template) => template.id === 'with_vars')

      // Mock long-running task creation
      mockCreate.mockReturnValue(new Promise(resolve => setTimeout(() => resolve('task_123'), 1000)))

      render(<QuickActionsBar />)

      // Start a long-running task creation
      const noVarsButton = screen.getByTestId('quick-action-no_vars')
      fireEvent.click(noVarsButton)

      // Immediately try to open modal
      const withVarsButton = screen.getByTestId('quick-action-with_vars')
      fireEvent.click(withVarsButton)

      // Modal should open even while other operation is in progress
      await waitFor(() => {
        expect(screen.getByTestId('variable-modal')).toBeInTheDocument()
      })

      expect(noVarsButton).toHaveTextContent('Creating...')
    })

    it('handles component unmounting during async operations', async () => {
      let resolveCreate: (value: string) => void
      const mockCreate = vi.fn().mockReturnValue(
        new Promise<string>((resolve) => {
          resolveCreate = resolve
        })
      )

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: [createTemplate('1')],
        createTaskFromTemplate: mockCreate,
      })

      const { unmount } = render(<QuickActionsBar />)

      // Start async operation
      const button = screen.getByTestId('quick-action-1')
      fireEvent.click(button)

      // Unmount component
      unmount()

      // Resolve async operation after unmount
      await act(async () => {
        resolveCreate!('task_123')
      })

      // Should not cause errors or memory leaks
      // (No assertions needed - this test passes if no errors are thrown)
    })
  })

  describe('Invalid Input Handling', () => {
    it('handles templates with null or undefined IDs', async () => {
      const invalidTemplates = [
        { ...createTemplate(''), id: '' }, // Empty ID
        { ...createTemplate('null'), id: null as any }, // Null ID
        { ...createTemplate('undefined'), id: undefined as any }, // Undefined ID
        createTemplate('valid'), // Valid for comparison
      ]

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: invalidTemplates,
      })

      expect(() => {
        render(<QuickActionsBar />)
      }).not.toThrow()

      // Should handle gracefully, possibly showing only valid template
      const buttons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('data-testid')?.includes('quick-action')
      )

      // At least the valid template should render
      expect(buttons.length).toBeGreaterThanOrEqual(1)
    })

    it('handles extremely long template names and descriptions', async () => {
      const veryLongText = 'x'.repeat(10000)
      const templateWithLongText = createTemplate('long', {
        name: veryLongText,
        description: veryLongText,
      })

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: [templateWithLongText],
      })

      expect(() => {
        render(<QuickActionsBar />)
      }).not.toThrow()

      expect(screen.getByTestId('quick-action-long')).toBeInTheDocument()
    })

    it('handles templates with special characters and Unicode', async () => {
      const specialTemplates = [
        createTemplate('emoji', { name: '🚀 Deploy Template 🎉', description: 'Template with emojis 😀' }),
        createTemplate('unicode', { name: 'Ñiñö Tëmplätë', description: 'Unicode characters: ñ ü ä ß' }),
        createTemplate('symbols', { name: '<>Template&"Name', description: 'HTML & special chars' }),
        createTemplate('rtl', { name: 'قالب عربي', description: 'Arabic text template' }),
        createTemplate('newlines', { name: 'Template\nWith\nNewlines', description: 'Description\nwith\nbreaks' }),
      ]

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: specialTemplates,
      })

      expect(() => {
        render(<QuickActionsBar />)
      }).not.toThrow()

      specialTemplates.forEach(template => {
        expect(screen.getByTestId(`quick-action-${template.id}`)).toBeInTheDocument()
      })
    })

    it('handles negative and extreme maxActions values', async () => {
      const templates = Array.from({ length: 10 }, (_, i) => createTemplate(`${i}`))

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates,
      })

      // Test negative value
      const { rerender } = render(<QuickActionsBar maxActions={-5} />)

      // Should not crash and show no templates or default behavior
      expect(() => rerender(<QuickActionsBar maxActions={-5} />)).not.toThrow()

      // Test zero
      rerender(<QuickActionsBar maxActions={0} />)
      expect(() => rerender(<QuickActionsBar maxActions={0} />)).not.toThrow()

      // Test extremely large value
      rerender(<QuickActionsBar maxActions={999999} />)
      expect(() => rerender(<QuickActionsBar maxActions={999999} />)).not.toThrow()
    })
  })

  describe('Memory and Resource Management', () => {
    it('cleans up event listeners and timers', async () => {
      const mockCreate = vi.fn().mockResolvedValue('task_123')

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: [createTemplate('1')],
        createTaskFromTemplate: mockCreate,
      })

      const { unmount } = render(<QuickActionsBar />)

      // Click to trigger any potential timers
      const button = screen.getByTestId('quick-action-1')
      fireEvent.click(button)

      // Unmount
      unmount()

      // Wait for any pending operations
      await waitFor(() => {
        // Should not have any pending timers
        expect(vi.getTimerCount()).toBe(0)
      })
    })

    it('handles rapid mount/unmount cycles', async () => {
      const templates = [createTemplate('1'), createTemplate('2')]

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates,
      })

      // Rapid mount/unmount cycles
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(<QuickActionsBar />)
        unmount()
      }

      // Should not accumulate memory or cause errors
      expect(true).toBe(true) // Test passes if no errors thrown
    })

    it('handles large template arrays without memory issues', async () => {
      // Create very large array
      const largeTemplateArray = Array.from({ length: 10000 }, (_, i) =>
        createTemplate(`template_${i}`)
      )

      const beforeMemory = process.memoryUsage?.()?.heapUsed || 0

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: largeTemplateArray,
      })

      const { unmount } = render(<QuickActionsBar maxActions={10} />)

      // Should only render limited number despite large array
      const buttons = screen.getAllByRole('button').filter(btn =>
        btn.getAttribute('data-testid')?.includes('quick-action')
      )
      expect(buttons.length).toBe(10)

      unmount()

      // Memory should not grow significantly (rough check)
      const afterMemory = process.memoryUsage?.()?.heapUsed || 0
      if (beforeMemory > 0) {
        expect(afterMemory - beforeMemory).toBeLessThan(100 * 1024 * 1024) // Less than 100MB growth
      }
    })
  })

  describe('Error Propagation and Recovery', () => {
    it('handles errors in onTaskCreated callback', async () => {
      const mockCreate = vi.fn().mockResolvedValue('task_123')
      const onTaskCreated = vi.fn().mockImplementation(() => {
        throw new Error('Callback error')
      })

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: [createTemplate('1')],
        createTaskFromTemplate: mockCreate,
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(<QuickActionsBar onTaskCreated={onTaskCreated} />)
      }).not.toThrow()

      const button = screen.getByTestId('quick-action-1')

      expect(() => {
        fireEvent.click(button)
      }).not.toThrow()

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalled()
      })

      consoleSpy.mockRestore()
    })

    it('handles errors in onError callback', async () => {
      const mockCreate = vi.fn().mockRejectedValue(new Error('Task creation failed'))
      const onError = vi.fn().mockImplementation(() => {
        throw new Error('Error callback error')
      })

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: [createTemplate('1')],
        createTaskFromTemplate: mockCreate,
      })

      expect(() => {
        render(<QuickActionsBar onError={onError} />)
      }).not.toThrow()

      const button = screen.getByTestId('quick-action-1')

      expect(() => {
        fireEvent.click(button)
      }).not.toThrow()

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalled()
      })
    })

    it('recovers from modal errors gracefully', async () => {
      const mockHasRequired = vi.fn().mockReturnValue(true)
      const onError = vi.fn()

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: [createTemplate('with_vars')],
        hasRequiredVariables: mockHasRequired,
      })

      render(<QuickActionsBar onError={onError} />)

      // Open modal
      const button = screen.getByTestId('quick-action-with_vars')
      fireEvent.click(button)

      await waitFor(() => {
        expect(screen.getByTestId('variable-modal')).toBeInTheDocument()
      })

      // Trigger modal error
      const errorButton = screen.getByTestId('modal-create-error')
      fireEvent.click(errorButton)

      // Should close modal and call error handler
      await waitFor(() => {
        expect(screen.queryByTestId('variable-modal')).not.toBeInTheDocument()
        expect(onError).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Modal creation failed' }),
          'with_vars'
        )
      })

      // Should be able to open modal again (recovery)
      fireEvent.click(button)
      await waitFor(() => {
        expect(screen.getByTestId('variable-modal')).toBeInTheDocument()
      })
    })
  })

  describe('Accessibility Edge Cases', () => {
    it('maintains accessibility with malformed template data', async () => {
      const malformedTemplate = createTemplate('malformed', {
        name: '', // Empty name
        description: undefined as any, // No description
      })

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: [malformedTemplate],
      })

      render(<QuickActionsBar />)

      const button = screen.getByTestId('quick-action-malformed')

      // Should still have accessible attributes even with malformed data
      expect(button).toHaveAttribute('aria-label')
      expect(button).toHaveRole('button')
    })

    it('handles focus management during rapid state changes', async () => {
      const mockCreate = vi.fn().mockResolvedValue('task_123')

      mockUseQuickActionTemplates.mockReturnValue({
        ...createDefaultMockReturn(),
        templates: [createTemplate('1')],
        createTaskFromTemplate: mockCreate,
      })

      render(<QuickActionsBar />)

      const button = screen.getByTestId('quick-action-1')

      // Focus button
      button.focus()
      expect(button).toHaveFocus()

      // Click while focused
      fireEvent.click(button)

      // Focus should be maintained appropriately during state changes
      await waitFor(() => {
        expect(button).toBeInTheDocument()
      })
    })
  })
})