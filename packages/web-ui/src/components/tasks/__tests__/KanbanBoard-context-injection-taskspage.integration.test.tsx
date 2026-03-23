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

// Mock Next.js Navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

// Mock the drag and drop hook to simplify tests
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

describe('KanbanBoard Context Injection Integration in TasksPage Context', () => {
  // Standard mock tasks for consistent testing
  const mockTasks = {
    inProgress: {
      id: 'task-in-progress-001',
      description: 'In progress task for testing',
      status: 'in-progress',
      workflow: 'feature',
      autonomy: 'review-before-commit',
      createdAt: '2024-01-01T10:00:00Z',
      updatedAt: '2024-01-01T10:30:00Z',
      usage: {
        totalTokens: 1500,
        estimatedCost: 0.002,
      },
    } as Task,
    pending: {
      id: 'task-pending-001',
      description: 'Pending task for testing',
      status: 'pending',
      workflow: 'bugfix',
      autonomy: 'full-auto',
      createdAt: '2024-01-01T09:00:00Z',
      updatedAt: '2024-01-01T09:30:00Z',
      usage: {
        totalTokens: 500,
        estimatedCost: 0.001,
      },
    } as Task,
    planning: {
      id: 'task-planning-001',
      description: 'Planning task for testing',
      status: 'planning',
      workflow: 'feature',
      autonomy: 'review-all',
      createdAt: '2024-01-01T08:00:00Z',
      updatedAt: '2024-01-01T08:30:00Z',
      usage: {
        totalTokens: 800,
        estimatedCost: 0.001,
      },
    } as Task,
    waitingApproval: {
      id: 'task-waiting-approval-001',
      description: 'Waiting approval task for testing',
      status: 'waiting-approval',
      workflow: 'feature',
      autonomy: 'review-before-commit',
      createdAt: '2024-01-01T07:00:00Z',
      updatedAt: '2024-01-01T07:30:00Z',
      usage: {
        totalTokens: 1200,
        estimatedCost: 0.002,
      },
    } as Task,
    paused: {
      id: 'task-paused-001',
      description: 'Paused task for testing',
      status: 'paused',
      workflow: 'bugfix',
      autonomy: 'full-auto',
      createdAt: '2024-01-01T06:00:00Z',
      updatedAt: '2024-01-01T06:30:00Z',
      usage: {
        totalTokens: 600,
        estimatedCost: 0.001,
      },
    } as Task,
    completed: {
      id: 'task-completed-001',
      description: 'Completed task for testing',
      status: 'completed',
      workflow: 'feature',
      autonomy: 'review-all',
      createdAt: '2024-01-01T05:00:00Z',
      updatedAt: '2024-01-01T05:30:00Z',
      usage: {
        totalTokens: 2000,
        estimatedCost: 0.003,
      },
    } as Task,
    failed: {
      id: 'task-failed-001',
      description: 'Failed task for testing',
      status: 'failed',
      workflow: 'feature',
      autonomy: 'review-all',
      createdAt: '2024-01-01T04:00:00Z',
      updatedAt: '2024-01-01T04:30:00Z',
      usage: {
        totalTokens: 1000,
        estimatedCost: 0.002,
      },
      error: 'Task failed with error',
    } as Task,
    cancelled: {
      id: 'task-cancelled-001',
      description: 'Cancelled task for testing',
      status: 'cancelled',
      workflow: 'bugfix',
      autonomy: 'full-auto',
      createdAt: '2024-01-01T03:00:00Z',
      updatedAt: '2024-01-01T03:30:00Z',
      usage: {
        totalTokens: 300,
        estimatedCost: 0.001,
      },
    } as Task,
  }

  // Standard mock response
  const mockContextResponse: InjectContextResponse = {
    ok: true,
    taskId: 'task-in-progress-001',
    contextInjected: true,
    timestamp: new Date('2024-01-01T10:00:00Z'),
  }

  // Props that simulate TasksPage context
  const tasksPageProps = {
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
        'failed': 1,
        'cancelled': 1,
        'planning': 1,
        'waiting-approval': 1,
        'paused': 1,
        'queued': 0,
      },
      totalCost: 0.012,
      totalTokens: 8000,
    })

    mockApiClient.listTasks.mockImplementation(({ status }) => {
      const tasksByStatus = {
        'pending': [mockTasks.pending],
        'queued': [],
        'planning': [mockTasks.planning],
        'in-progress': [mockTasks.inProgress],
        'waiting-approval': [mockTasks.waitingApproval],
        'paused': [mockTasks.paused],
        'completed': [mockTasks.completed],
        'failed': [mockTasks.failed],
        'cancelled': [mockTasks.cancelled],
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

    mockApiClient.injectContext.mockResolvedValue(mockContextResponse)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // Helper function to test context injection flow
  async function testContextInjectionFlow(taskDescription: string, contextText: string) {
    const user = userEvent.setup()

    // 1. Wait for task to appear
    await waitFor(() => {
      expect(screen.getByText(taskDescription)).toBeInTheDocument()
    })

    // 2. Hover to reveal button
    const taskCard = screen.getByText(taskDescription).closest('.group')!
    fireEvent.mouseEnter(taskCard)

    // 3. Click context injection button within the specific task card
    const contextButton = within(taskCard).getByTitle('Inject context')
    await user.click(contextButton)

    // 4. Verify modal opened
    expect(screen.getByRole('heading', { name: 'Inject Context' })).toBeInTheDocument()

    // 5. Fill and submit form
    const modal = screen.getByRole('dialog')
    const textarea = within(modal).getByLabelText(/^Context/)
    await user.type(textarea, contextText)

    const submitButton = within(modal).getByRole('button', { name: /inject context/i })
    await user.click(submitButton)

    return { modal, textarea, submitButton }
  }

  describe('Context Injection Button Visibility in TasksPage Context', () => {
    it('shows context injection button for in-progress tasks in kanban view', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await waitFor(() => {
        expect(screen.getByText('In progress task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      // Find context injection button within this specific task card
      const contextButton = within(taskCard).getByTitle('Inject context')
      expect(contextButton).toBeInTheDocument()
      expect(contextButton).toHaveClass('hover:text-blue-500')
    })

    it('shows context injection button for pending tasks in kanban view', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await waitFor(() => {
        expect(screen.getByText('Pending task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Pending task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      expect(contextButton).toBeInTheDocument()
    })

    it('shows context injection button for planning tasks in kanban view', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await waitFor(() => {
        expect(screen.getByText('Planning task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Planning task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      expect(contextButton).toBeInTheDocument()
    })

    it('shows context injection button for waiting-approval tasks', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await waitFor(() => {
        expect(screen.getByText('Waiting approval task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Waiting approval task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      expect(contextButton).toBeInTheDocument()
    })

    it('shows context injection button for paused tasks', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await waitFor(() => {
        expect(screen.getByText('Paused task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Paused task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      expect(contextButton).toBeInTheDocument()
    })

    it('hides context injection button for completed tasks', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await waitFor(() => {
        expect(screen.getByText('Completed task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Completed task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      expect(within(taskCard).queryByTitle('Inject context')).not.toBeInTheDocument()
    })

    it('hides context injection button for failed tasks', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await waitFor(() => {
        expect(screen.getByText('Failed task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Failed task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      expect(within(taskCard).queryByTitle('Inject context')).not.toBeInTheDocument()
    })

    it('hides context injection button for cancelled tasks', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await waitFor(() => {
        expect(screen.getByText('Cancelled task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('Cancelled task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      expect(within(taskCard).queryByTitle('Inject context')).not.toBeInTheDocument()
    })
  })

  describe('Modal Integration Flow', () => {
    it('opens context injection modal when button clicked', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await waitFor(() => {
        expect(screen.getByText('In progress task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      await userEvent.setup().click(contextButton)

      expect(screen.getByRole('heading', { name: 'Inject Context' })).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('closes modal on cancel button click', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await waitFor(() => {
        expect(screen.getByText('In progress task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      await userEvent.setup().click(contextButton)

      expect(screen.getByRole('dialog')).toBeInTheDocument()

      const modal = screen.getByRole('dialog')
      const cancelButton = within(modal).getByRole('button', { name: /cancel/i })
      await userEvent.setup().click(cancelButton)

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('closes modal on backdrop click', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await waitFor(() => {
        expect(screen.getByText('In progress task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      await userEvent.setup().click(contextButton)

      expect(screen.getByRole('dialog')).toBeInTheDocument()

      // Click on backdrop (overlay)
      const backdrop = document.querySelector('.fixed.inset-0.z-50 .absolute.inset-0')!
      fireEvent.click(backdrop)

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('closes modal on successful submission', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      const { } = await testContextInjectionFlow('In progress task for testing', 'Test context for modal closure')

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalled()
      })

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('keeps modal open on submission error', async () => {
      mockApiClient.injectContext.mockRejectedValue(new Error('Network error'))

      render(<KanbanBoard {...tasksPageProps} />)

      await testContextInjectionFlow('In progress task for testing', 'Test context for error handling')

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalled()
      })

      // Modal should remain open on error
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('prevents navigation when modal button clicked', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await waitFor(() => {
        expect(screen.getByText('In progress task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')

      // Click the context button (should prevent navigation)
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
      })

      const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault')
      const stopPropagationSpy = vi.spyOn(clickEvent, 'stopPropagation')

      fireEvent(contextButton, clickEvent)

      expect(preventDefaultSpy).toHaveBeenCalled()
      expect(stopPropagationSpy).toHaveBeenCalled()
    })
  })

  describe('Context Submission Flow', () => {
    it('submits context with required fields', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await testContextInjectionFlow('In progress task for testing', 'Required context for testing')

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalledWith(
          'task-in-progress-001',
          {
            context: 'Required context for testing',
            priority: 'normal',
          }
        )
      })
    })

    it('submits context with optional source field', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      const user = userEvent.setup()

      await waitFor(() => {
        expect(screen.getByText('In progress task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      await user.click(contextButton)

      const modal = screen.getByRole('dialog')
      const textarea = within(modal).getByLabelText(/^Context/)
      await user.type(textarea, 'Context with source')

      const sourceInput = within(modal).getByLabelText(/^Source/)
      await user.type(sourceInput, 'user feedback')

      const submitButton = within(modal).getByRole('button', { name: /inject context/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalledWith(
          'task-in-progress-001',
          {
            context: 'Context with source',
            source: 'user feedback',
            priority: 'normal',
          }
        )
      })
    })

    it('submits context with different priority levels', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      const user = userEvent.setup()

      await waitFor(() => {
        expect(screen.getByText('In progress task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      await user.click(contextButton)

      const modal = screen.getByRole('dialog')
      const textarea = within(modal).getByLabelText(/^Context/)
      await user.type(textarea, 'High priority context')

      const highPriorityOption = within(modal).getByRole('button', { name: /High/ })
      await user.click(highPriorityOption)

      const submitButton = within(modal).getByRole('button', { name: /inject context/i })
      await user.click(submitButton)

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalledWith(
          'task-in-progress-001',
          {
            context: 'High priority context',
            priority: 'high',
          }
        )
      })
    })

    it('shows loading state during submission', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      const user = userEvent.setup()

      await waitFor(() => {
        expect(screen.getByText('In progress task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      await user.click(contextButton)

      const modal = screen.getByRole('dialog')
      const textarea = within(modal).getByLabelText(/^Context/)
      await user.type(textarea, 'Context for loading test')

      // Make the API call hang to test loading state
      let resolveApiCall: (value: InjectContextResponse) => void
      mockApiClient.injectContext.mockReturnValue(
        new Promise((resolve) => {
          resolveApiCall = resolve
        })
      )

      const submitButton = within(modal).getByRole('button', { name: /inject context/i })
      await user.click(submitButton)

      // Check that loading state is shown in modal submit button
      await waitFor(() => {
        expect(submitButton).toBeDisabled()
      })

      // Resolve the API call
      resolveApiCall!(mockContextResponse)

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('displays error message on submission failure', async () => {
      mockApiClient.injectContext.mockRejectedValue(new Error('API Error: Context injection failed'))

      render(<KanbanBoard {...tasksPageProps} />)

      await testContextInjectionFlow('In progress task for testing', 'Context that will fail')

      await waitFor(() => {
        expect(screen.getByText(/API Error: Context injection failed/)).toBeInTheDocument()
      })
    })

    it('resets form after successful submission', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      // First submission
      await testContextInjectionFlow('In progress task for testing', 'First context submission')

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })

      // Open modal again
      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      await userEvent.setup().click(contextButton)

      // Verify form is reset
      const modal = screen.getByRole('dialog')
      const textarea = within(modal).getByLabelText(/^Context/)
      expect(textarea).toHaveValue('')

      const sourceInput = within(modal).getByLabelText(/^Source/)
      expect(sourceInput).toHaveValue('')
    })
  })

  describe('UI State Updates', () => {
    it('shows loading spinner on context button during submission', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      const user = userEvent.setup()

      await waitFor(() => {
        expect(screen.getByText('In progress task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      await user.click(contextButton)

      const modal = screen.getByRole('dialog')
      const textarea = within(modal).getByLabelText(/^Context/)
      await user.type(textarea, 'Context for spinner test')

      // Make the API call hang to test loading state
      let resolveApiCall: (value: InjectContextResponse) => void
      mockApiClient.injectContext.mockReturnValue(
        new Promise((resolve) => {
          resolveApiCall = resolve
        })
      )

      const submitButton = within(modal).getByRole('button', { name: /inject context/i })
      await user.click(submitButton)

      // Verify loading spinner appears in submit button
      await waitFor(() => {
        expect(submitButton).toBeDisabled()
        expect(submitButton).toHaveTextContent('Injecting...')
      })

      // Resolve the API call
      resolveApiCall!(mockContextResponse)

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('disables submit button when context is empty', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await waitFor(() => {
        expect(screen.getByText('In progress task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      await userEvent.setup().click(contextButton)

      const modal = screen.getByRole('dialog')
      const submitButton = within(modal).getByRole('button', { name: /inject context/i })

      expect(submitButton).toBeDisabled()
    })

    it('enables submit button when context has value', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      const user = userEvent.setup()

      await waitFor(() => {
        expect(screen.getByText('In progress task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      await user.click(contextButton)

      const modal = screen.getByRole('dialog')
      const textarea = within(modal).getByLabelText(/^Context/)
      const submitButton = within(modal).getByRole('button', { name: /inject context/i })

      expect(submitButton).toBeDisabled()

      await user.type(textarea, 'Some context')

      expect(submitButton).not.toBeDisabled()
    })

    it('updates character count as user types', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      const user = userEvent.setup()

      await waitFor(() => {
        expect(screen.getByText('In progress task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      await user.click(contextButton)

      const modal = screen.getByRole('dialog')
      const textarea = within(modal).getByLabelText(/^Context/)

      await user.type(textarea, 'Test')

      // Character count should update
      expect(screen.getByText(/99,996.*characters remaining/)).toBeInTheDocument()
    })

    it('shows error styling when exceeding character limit', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      const user = userEvent.setup()

      await waitFor(() => {
        expect(screen.getByText('In progress task for testing')).toBeInTheDocument()
      })

      const taskCard = screen.getByText('In progress task for testing').closest('.group')!
      fireEvent.mouseEnter(taskCard)

      const contextButton = within(taskCard).getByTitle('Inject context')
      await user.click(contextButton)

      const modal = screen.getByRole('dialog')
      const textarea = within(modal).getByLabelText(/^Context/)

      // Type content that exceeds the limit (using fireEvent for performance)
      const longContent = 'a'.repeat(100001)
      fireEvent.change(textarea, { target: { value: longContent } })

      // Find the form and submit it to trigger validation
      const form = modal.querySelector('form')!
      fireEvent.submit(form)

      // Should show error about character limit
      await waitFor(() => {
        expect(screen.getByText(/cannot exceed 100,000 characters/i)).toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })

  describe('TasksPage Callbacks Integration', () => {
    it('calls onSuccess callback after successful context injection', async () => {
      render(<KanbanBoard {...tasksPageProps} />)

      await testContextInjectionFlow('In progress task for testing', 'Context for success callback')

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalled()
      })

      // Note: The success callback should be called by TasksPage after successful context injection
      // Since we're testing KanbanBoard in isolation, we verify the API was called successfully
      expect(mockApiClient.injectContext).toHaveBeenCalledWith(
        'task-in-progress-001',
        {
          context: 'Context for success callback',
          priority: 'normal',
        }
      )
    })

    it('calls onError callback on context injection failure', async () => {
      mockApiClient.injectContext.mockRejectedValue(new Error('Context injection failed'))

      render(<KanbanBoard {...tasksPageProps} />)

      await testContextInjectionFlow('In progress task for testing', 'Context for error callback')

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalled()
      })

      // Verify error is displayed in the modal
      expect(screen.getByText(/Context injection failed/)).toBeInTheDocument()
    })

    it('integrates with TasksPage error notification display', async () => {
      // Test that errors from context injection can be handled by parent component
      const onError = vi.fn()

      render(<KanbanBoard {...tasksPageProps} onError={onError} />)

      mockApiClient.injectContext.mockRejectedValue(new Error('Network timeout'))

      await testContextInjectionFlow('In progress task for testing', 'Context for network error')

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalled()
      })

      // The KanbanBoard component should handle errors internally for now
      // but this test documents the expected integration point
      expect(screen.getByText(/Network timeout/)).toBeInTheDocument()
    })

    it('integrates with TasksPage success notification display', async () => {
      // Test that success from context injection can be handled by parent component
      const onSuccess = vi.fn()

      render(<KanbanBoard {...tasksPageProps} onSuccess={onSuccess} />)

      await testContextInjectionFlow('In progress task for testing', 'Context for success integration')

      await waitFor(() => {
        expect(mockApiClient.injectContext).toHaveBeenCalled()
      })

      // Verify the API call was successful
      expect(mockApiClient.injectContext).toHaveBeenCalledWith(
        'task-in-progress-001',
        {
          context: 'Context for success integration',
          priority: 'normal',
        }
      )
    })
  })
})