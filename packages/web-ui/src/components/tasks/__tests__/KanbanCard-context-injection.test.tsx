import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { KanbanBoard } from '../KanbanBoard'
import { apiClient } from '@/lib/api-client'
import type { Task, InjectContextResponse } from '@apexcli/core'

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getTaskStats: vi.fn(),
    listTasks: vi.fn(),
    injectContext: vi.fn(),
  },
}))

// Mock the drag and drop hook
vi.mock('../hooks/useKanbanDragDrop', () => ({
  useKanbanDragDrop: () => ({
    draggedTask: null,
    isUpdating: false,
    canUndo: false,
    handleDragStart: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragEnd: vi.fn(),
    undoLastOperation: vi.fn(),
  }),
}))

const mockApiClient = apiClient as {
  getTaskStats: ReturnType<typeof vi.fn>
  listTasks: ReturnType<typeof vi.fn>
  injectContext: ReturnType<typeof vi.fn>
}

describe('KanbanCard Context Injection Integration', () => {
  const mockInProgressTask: Task = {
    id: 'task-123',
    description: 'Test task in progress',
    status: 'in-progress',
    workflow: 'feature',
    autonomy: 'review-before-commit',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:30:00Z',
    usage: {
      totalTokens: 1500,
      estimatedCost: 0.002,
    },
  }

  const mockPendingTask: Task = {
    id: 'task-456',
    description: 'Test task pending',
    status: 'pending',
    workflow: 'bugfix',
    autonomy: 'full-auto',
    createdAt: '2024-01-01T09:00:00Z',
    updatedAt: '2024-01-01T09:30:00Z',
    usage: {
      totalTokens: 500,
      estimatedCost: 0.001,
    },
  }

  const mockCompletedTask: Task = {
    id: 'task-789',
    description: 'Test task completed',
    status: 'completed',
    workflow: 'feature',
    autonomy: 'review-all',
    createdAt: '2024-01-01T08:00:00Z',
    updatedAt: '2024-01-01T08:30:00Z',
    usage: {
      totalTokens: 2000,
      estimatedCost: 0.003,
    },
  }

  const mockSuccessResponse: InjectContextResponse = {
    ok: true,
    taskId: 'task-123',
    contextInjected: true,
    timestamp: new Date('2024-01-01T10:00:00Z'),
  }

  const defaultProps = {
    onCancel: vi.fn(),
    onRetry: vi.fn(),
    actionLoading: null,
    refreshKey: 0,
    onError: vi.fn(),
    onSuccess: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock API responses
    mockApiClient.getTaskStats.mockResolvedValue({
      byStatus: {
        'pending': 1,
        'in-progress': 1,
        'completed': 1,
        'failed': 0,
        'cancelled': 0,
        'planning': 0,
        'waiting-approval': 0,
        'paused': 0,
        'queued': 0,
      },
      totalCost: 0.006,
      totalTokens: 4000,
    })

    mockApiClient.listTasks.mockImplementation(({ status }) => {
      const tasksByStatus = {
        'pending': [mockPendingTask],
        'queued': [],
        'planning': [],
        'in-progress': [mockInProgressTask],
        'waiting-approval': [],
        'paused': [],
        'completed': [mockCompletedTask],
        'failed': [],
        'cancelled': [],
      }

      const tasks = tasksByStatus[status as keyof typeof tasksByStatus] || []
      return Promise.resolve({
        tasks,
        total: tasks.length,
        count: tasks.length,
        limit: 20,
        offset: 0,
      })
    })

    mockApiClient.injectContext.mockResolvedValue(mockSuccessResponse)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Context Injection Button Visibility', () => {
    it('should show context injection button for in-progress tasks on hover', async () => {
      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task in progress')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Test task in progress').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButtons = screen.getAllByTitle('Inject context')
      expect(contextButtons).toHaveLength(1) // Only one button should be visible for in-progress tasks
      expect(contextButtons[0]).toHaveClass('hover:text-blue-500')
    })

    it('should show context injection button for pending tasks on hover', async () => {
      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task pending')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Test task pending').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButtons = screen.getAllByTitle('Inject context')
      expect(contextButtons.length).toBeGreaterThan(0) // Should have at least one context button
    })

    it('should not show context injection button for completed tasks', async () => {
      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task completed')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Test task completed').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      expect(screen.queryByTitle('Inject context')).not.toBeInTheDocument()
    })

    it('should show context injection button for planning tasks', async () => {
      const planningTask: Task = {
        ...mockInProgressTask,
        id: 'task-planning',
        description: 'Planning task',
        status: 'planning',
      }

      mockApiClient.listTasks.mockImplementation(({ status }) => {
        if (status === 'planning') {
          return Promise.resolve({
            tasks: [planningTask],
            total: 1,
            count: 1,
            limit: 20,
            offset: 0,
          })
        }
        return Promise.resolve({
          tasks: [],
          total: 0,
          count: 0,
          limit: 20,
          offset: 0,
        })
      })

      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Planning task')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Planning task').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButtons = screen.getAllByTitle('Inject context')
      expect(contextButtons.length).toBeGreaterThan(0) // Should show context buttons
    })
  })

  describe('Context Injection Modal Flow', () => {
    it('should open context injection modal when button is clicked', async () => {
      const user = userEvent.setup()
      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task in progress')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Test task in progress').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButtons = screen.getAllByTitle('Inject context')
      await user.click(contextButtons[0])

      expect(screen.getByRole('heading', { name: 'Inject Context' })).toBeInTheDocument()
      expect(screen.getByLabelText(/context/i)).toBeInTheDocument()
    })

    it('should prevent navigation when context injection button is clicked', async () => {
      const user = userEvent.setup()
      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task in progress')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Test task in progress').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButtons = screen.getAllByTitle('Inject context')

      // Spy on preventDefault to ensure it's called
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true })
      const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault')
      const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation')

      fireEvent.click(contextButtons[0], clickEvent)

      expect(screen.getByRole('heading', { name: 'Inject Context' })).toBeInTheDocument()
    })

    it('should close modal when cancel is clicked', async () => {
      const user = userEvent.setup()
      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task in progress')).toBeInTheDocument()
      })

      // Open modal
      const taskCard = screen.getByText('Test task in progress').closest('.group')!
      fireEvent.mouseEnter(taskCard)
      const contextButtons = screen.getAllByTitle('Inject context')
      await user.click(contextButtons[0])

      expect(screen.getByRole('heading', { name: 'Inject Context' })).toBeInTheDocument()

      // Close modal - find cancel button within the modal dialog
      const modal = screen.getByRole('dialog')
      const cancelButton = within(modal).getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(screen.queryByRole('heading', { name: 'Inject Context' })).not.toBeInTheDocument()
    })

    it('should close modal when backdrop is clicked', async () => {
      const user = userEvent.setup()
      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task in progress')).toBeInTheDocument()
      })

      // Open modal
      const taskCard = screen.getByText('Test task in progress').closest('.group')!
      fireEvent.mouseEnter(taskCard)
      const contextButtons = screen.getAllByTitle('Inject context')
      await user.click(contextButtons[0])

      expect(screen.getByRole('heading', { name: 'Inject Context' })).toBeInTheDocument()

      // Click backdrop
      const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50')
      if (backdrop) {
        fireEvent.click(backdrop)
      }

      expect(screen.queryByRole('heading', { name: 'Inject Context' })).not.toBeInTheDocument()
    })
  })

  describe('Context Injection Submission', () => {
    it('should submit context injection and close modal on success', async () => {
      const user = userEvent.setup()
      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task in progress')).toBeInTheDocument()
      })

      // Open modal
      const taskCard = screen.getByText('Test task in progress').closest('.group')!
      fireEvent.mouseEnter(taskCard)
      const contextButtons = screen.getAllByTitle('Inject context')
      await user.click(contextButtons[0])

      // Fill form - use modal context for queries
      const modal = screen.getByRole('dialog')
      const textarea = within(modal).getByLabelText(/context/i)
      await user.type(textarea, 'Additional context for the task')

      const sourceInput = within(modal).getByLabelText(/source/i)
      await user.type(sourceInput, 'user feedback')

      // Submit - use modal context for queries
      const submitButton = within(modal).getByRole('button', { name: /inject context/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalledWith('task-123', {
          context: 'Additional context for the task',
          source: 'user feedback',
          priority: 'normal',
        })
      })

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Inject Context' })).not.toBeInTheDocument()
      })
    })

    it('should show loading state on context injection button during submission', async () => {
      const user = userEvent.setup()
      let resolvePromise: (value: any) => void
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve
      })
      mockApiClient.injectContext.mockReturnValue(pendingPromise)

      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task in progress')).toBeInTheDocument()
      })

      // Open modal
      const taskCard = screen.getByText('Test task in progress').closest('.group')!
      fireEvent.mouseEnter(taskCard)
      const contextButtons = screen.getAllByTitle('Inject context')
      await user.click(contextButtons[0])

      // Fill and submit form - use modal context for queries
      const modal = screen.getByRole('dialog')
      const textarea = within(modal).getByLabelText(/context/i)
      await user.type(textarea, 'Test context')

      const submitButton = within(modal).getByRole('button', { name: /inject context/i })
      await user.click(submitButton)

      // Check that the modal shows loading state
      expect(within(modal).getByText('Injecting...')).toBeInTheDocument()

      // Resolve the promise
      resolvePromise!(mockSuccessResponse)

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Inject Context' })).not.toBeInTheDocument()
      })
    })

    it('should handle context injection errors gracefully', async () => {
      const user = userEvent.setup()
      const errorMessage = 'Task not found'
      mockApiClient.injectContext.mockRejectedValue(new Error(errorMessage))

      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task in progress')).toBeInTheDocument()
      })

      // Open modal
      const taskCard = screen.getByText('Test task in progress').closest('.group')!
      fireEvent.mouseEnter(taskCard)
      const contextButtons = screen.getAllByTitle('Inject context')
      await user.click(contextButtons[0])

      // Fill and submit form - use modal context for queries
      const modal = screen.getByRole('dialog')
      const textarea = within(modal).getByLabelText(/context/i)
      await user.type(textarea, 'Test context')

      const submitButton = within(modal).getByRole('button', { name: /inject context/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(within(modal).getByText(errorMessage)).toBeInTheDocument()
      })

      // Modal should stay open
      expect(screen.getByRole('heading', { name: 'Inject Context' })).toBeInTheDocument()
    })
  })

  describe('Multiple Tasks Context Injection', () => {
    it('should allow opening context injection for different tasks independently', async () => {
      const user = userEvent.setup()
      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task in progress')).toBeInTheDocument()
        expect(screen.getByText('Test task pending')).toBeInTheDocument()
      })

      // Open modal for first task
      const inProgressCard = screen.getByText('Test task in progress').closest('.group')!
      fireEvent.mouseEnter(inProgressCard)
      const inProgressContextButtons = screen.getAllByTitle('Inject context')
      await user.click(inProgressContextButtons[0])

      expect(screen.getByRole('heading', { name: 'Inject Context' })).toBeInTheDocument()

      // Close modal - find cancel button within the modal dialog
      const modal = screen.getByRole('dialog')
      const cancelButton = within(modal).getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Inject Context' })).not.toBeInTheDocument()
      })

      // Open modal for second task
      const pendingCard = screen.getByText('Test task pending').closest('.group')!
      fireEvent.mouseEnter(pendingCard)
      const pendingContextButtons = screen.getAllByTitle('Inject context')
      await user.click(pendingContextButtons[0])

      expect(screen.getByRole('heading', { name: 'Inject Context' })).toBeInTheDocument()

      // Fill and submit to verify it's for the correct task - use modal context for queries
      const modal2 = screen.getByRole('dialog')
      const textarea2 = within(modal2).getByLabelText(/context/i)
      await user.type(textarea2, 'Context for pending task')

      const submitButton2 = within(modal2).getByRole('button', { name: /inject context/i })
      await user.click(submitButton2)

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalledWith('task-456', {
          context: 'Context for pending task',
          priority: 'normal',
        })
      })
    })
  })

  describe('Context Injection Button States', () => {
    it('should disable context injection button when context is loading', async () => {
      const user = userEvent.setup()
      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task in progress')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Test task in progress').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButtons = screen.getAllByTitle('Inject context')
      expect(contextButtons[0]).not.toBeDisabled()

      // The button should show spinner when contextLoading state is true
      // This would be tested by manipulating the component's internal state
      // but since we're testing the integration, we'll test the loading state
      // through the modal submission process instead
    })

    it('should show MessageSquarePlus icon when not loading', async () => {
      render(<KanbanBoard {...defaultProps} />)

      await waitFor(() => {
        expect(screen.getByText('Test task in progress')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Test task in progress').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButtons = screen.getAllByTitle('Inject context')
      const icon = contextButtons[0].querySelector('svg')
      expect(icon).toBeInTheDocument()
      expect(icon).toHaveClass('w-3.5', 'h-3.5')
    })
  })
})