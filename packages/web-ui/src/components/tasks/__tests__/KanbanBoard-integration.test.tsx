import { describe, test, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import userEvent from '@testing-library/user-event'
import { KanbanBoard } from '../KanbanBoard'
import { apiClient } from '@/lib/api-client'
import type { Task } from '@apexcli/core'

// Mock API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getTaskStats: vi.fn(),
    listTasks: vi.fn(),
    updateTaskStatus: vi.fn(),
  },
}))

const mockApiClient = vi.mocked(apiClient)

const mockPendingTask: Task = {
  id: 'task-pending',
  description: 'Pending task',
  status: 'pending',
  workflow: 'test',
  priority: 'medium',
  effort: 'medium',
  retryCount: 0,
  maxRetries: 3,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  usage: {
    totalTokens: 100,
    estimatedCost: 0.01,
    inputTokens: 50,
    outputTokens: 50,
  },
  logs: [],
  artifacts: [],
}

const mockQueuedTask: Task = {
  id: 'task-queued',
  description: 'Queued task',
  status: 'queued',
  workflow: 'test',
  priority: 'medium',
  effort: 'medium',
  retryCount: 0,
  maxRetries: 3,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  usage: {
    totalTokens: 200,
    estimatedCost: 0.02,
    inputTokens: 100,
    outputTokens: 100,
  },
  logs: [],
  artifacts: [],
}

const mockInProgressTask: Task = {
  id: 'task-in-progress',
  description: 'In progress task',
  status: 'in-progress',
  workflow: 'test',
  priority: 'high',
  effort: 'large',
  retryCount: 0,
  maxRetries: 3,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  currentStage: 'implementation',
  usage: {
    totalTokens: 500,
    estimatedCost: 0.05,
    inputTokens: 250,
    outputTokens: 250,
  },
  logs: [],
  artifacts: [],
}

describe('KanbanBoard Integration Tests', () => {
  const defaultProps = {
    onCancel: vi.fn(),
    onRetry: vi.fn(),
    actionLoading: null,
    onError: vi.fn(),
    onSuccess: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockApiClient.getTaskStats.mockResolvedValue({
      byStatus: {
        pending: 1,
        queued: 1,
        planning: 0,
        'in-progress': 1,
        completed: 0,
        failed: 0,
        cancelled: 0,
        'waiting-approval': 0,
        paused: 0
      },
    })

    // Mock different responses for different status queries
    mockApiClient.listTasks.mockImplementation(({ status }) => {
      const taskMap: Record<string, Task[]> = {
        'pending': [mockPendingTask],
        'queued': [mockQueuedTask],
        'planning': [],
        'in-progress': [mockInProgressTask],
        'completed': [],
        'failed': [],
        'cancelled': [],
        'waiting-approval': [],
        'paused': [],
      }

      const tasks = taskMap[status as string] || []
      return Promise.resolve({
        tasks,
        total: tasks.length,
        count: tasks.length,
      })
    })
  })

  test('loads and displays tasks in correct columns', async () => {
    render(<KanbanBoard {...defaultProps} />)

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Pending task')).toBeInTheDocument()
      expect(screen.getByText('Queued task')).toBeInTheDocument()
      expect(screen.getByText('In progress task')).toBeInTheDocument()
    })

    // Check column counts are displayed
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  test('displays task details correctly', async () => {
    render(<KanbanBoard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Pending task')).toBeInTheDocument()
    })

    // Check task metadata is displayed
    expect(screen.getByText('test')).toBeInTheDocument() // workflow
    expect(screen.getByText('0.1k')).toBeInTheDocument() // tokens
    expect(screen.getByText('$0.01')).toBeInTheDocument() // cost
  })

  test('shows current stage for running tasks', async () => {
    render(<KanbanBoard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('In progress task')).toBeInTheDocument()
    })

    // Check current stage is displayed for in-progress task
    expect(screen.getByText('implementation')).toBeInTheDocument()
  })

  test('handles loading state', () => {
    render(<KanbanBoard {...defaultProps} />)

    // Should show loading spinner initially
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
  })

  test('refreshes data when refreshKey changes', async () => {
    const { rerender } = render(<KanbanBoard {...defaultProps} refreshKey={1} />)

    await waitFor(() => {
      expect(mockApiClient.getTaskStats).toHaveBeenCalledTimes(1)
      expect(mockApiClient.listTasks).toHaveBeenCalled()
    })

    // Change refreshKey
    rerender(<KanbanBoard {...defaultProps} refreshKey={2} />)

    await waitFor(() => {
      expect(mockApiClient.getTaskStats).toHaveBeenCalledTimes(2)
    })
  })

  test('calls action handlers when buttons are clicked', async () => {
    const user = userEvent.setup()
    render(<KanbanBoard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('In progress task')).toBeInTheDocument()
    })

    // Find and hover over the in-progress task to reveal action buttons
    const taskCard = screen.getByText('In progress task').closest('.group')
    expect(taskCard).toBeInTheDocument()

    if (taskCard) {
      await user.hover(taskCard)

      // Look for cancel button (should be visible for in-progress tasks)
      const cancelButton = taskCard.querySelector('[title="Cancel task"]')
      const retryButton = taskCard.querySelector('[title="Restart task"]')

      if (cancelButton) {
        await user.click(cancelButton)
        expect(defaultProps.onCancel).toHaveBeenCalledWith('task-in-progress', expect.any(Object))
      }

      if (retryButton) {
        await user.click(retryButton)
        expect(defaultProps.onRetry).toHaveBeenCalledWith('task-in-progress', expect.any(Object))
      }
    }
  })

  test('displays task error when present', async () => {
    const errorTask: Task = {
      ...mockPendingTask,
      error: 'Something went wrong with this task'
    }

    mockApiClient.listTasks.mockImplementation(({ status }) => {
      if (status === 'pending') {
        return Promise.resolve({
          tasks: [errorTask],
          total: 1,
          count: 1,
        })
      }
      return Promise.resolve({
        tasks: [],
        total: 0,
        count: 0,
      })
    })

    render(<KanbanBoard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Pending task')).toBeInTheDocument()
      expect(screen.getByText('Something went wrong with this task')).toBeInTheDocument()
    })
  })

  test('shows empty state when no tasks', async () => {
    mockApiClient.listTasks.mockResolvedValue({
      tasks: [],
      total: 0,
      count: 0,
    })

    render(<KanbanBoard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getAllByText('No tasks')).toHaveLength(6) // One for each column
    })
  })

  test('handles API errors gracefully', async () => {
    mockApiClient.getTaskStats.mockRejectedValue(new Error('API Error'))

    // Spy on console.error to check error handling
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<KanbanBoard {...defaultProps} />)

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to load kanban data:', expect.any(Error))
    })

    consoleSpy.mockRestore()
  })
})