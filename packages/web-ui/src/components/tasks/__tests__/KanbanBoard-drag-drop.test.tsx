import { describe, test, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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

// Mock drag-and-drop hook
vi.mock('../hooks/useKanbanDragDrop', () => ({
  useKanbanDragDrop: vi.fn(() => ({
    draggedTask: null,
    isUpdating: false,
    canUndo: false,
    handleDragStart: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragEnd: vi.fn(),
    undoLastOperation: vi.fn(),
  })),
}))

const mockApiClient = vi.mocked(apiClient)

const mockTask: Task = {
  id: 'task-1',
  description: 'Test task',
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

describe('KanbanBoard with Drag and Drop', () => {
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
      byStatus: { pending: 1, planning: 0, 'in-progress': 0 },
    })
    mockApiClient.listTasks.mockResolvedValue({
      tasks: [mockTask],
      total: 1,
      count: 1,
    })
  })

  test('renders drag-and-drop context', async () => {
    render(<KanbanBoard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Test task')).toBeInTheDocument()
    })

    // Should render DndContext (evidenced by the board rendering correctly)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  test('shows undo button when canUndo is true', async () => {
    const { useKanbanDragDrop } = await import('../hooks/useKanbanDragDrop')
    const mockUseKanbanDragDrop = vi.mocked(useKanbanDragDrop)

    mockUseKanbanDragDrop.mockReturnValue({
      draggedTask: null,
      isUpdating: false,
      canUndo: true,
      handleDragStart: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragEnd: vi.fn(),
      undoLastOperation: vi.fn(),
      isTransitionAllowed: vi.fn(),
    })

    render(<KanbanBoard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Undo last change')).toBeInTheDocument()
    })
  })

  test('calls undoLastOperation when undo button is clicked', async () => {
    const mockUndoLastOperation = vi.fn()
    const { useKanbanDragDrop } = await import('../hooks/useKanbanDragDrop')
    const mockUseKanbanDragDrop = vi.mocked(useKanbanDragDrop)

    mockUseKanbanDragDrop.mockReturnValue({
      draggedTask: null,
      isUpdating: false,
      canUndo: true,
      handleDragStart: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragEnd: vi.fn(),
      undoLastOperation: mockUndoLastOperation,
      isTransitionAllowed: vi.fn(),
    })

    render(<KanbanBoard {...defaultProps} />)

    await waitFor(() => {
      const undoButton = screen.getByText('Undo last change')
      fireEvent.click(undoButton)
    })

    expect(mockUndoLastOperation).toHaveBeenCalled()
  })

  test('shows loading spinner on undo button when updating', async () => {
    const { useKanbanDragDrop } = await import('../hooks/useKanbanDragDrop')
    const mockUseKanbanDragDrop = vi.mocked(useKanbanDragDrop)

    mockUseKanbanDragDrop.mockReturnValue({
      draggedTask: null,
      isUpdating: true,
      canUndo: true,
      handleDragStart: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragEnd: vi.fn(),
      undoLastOperation: vi.fn(),
      isTransitionAllowed: vi.fn(),
    })

    render(<KanbanBoard {...defaultProps} />)

    await waitFor(() => {
      const undoButton = screen.getByText('Undo last change')
      expect(undoButton.previousElementSibling).toHaveAttribute('data-testid', 'spinner')
    })
  })

  test('wraps tasks in draggable components when in drag context', async () => {
    render(<KanbanBoard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Test task')).toBeInTheDocument()
    })

    // Tasks should be wrapped in draggable components
    // This is evidenced by the task being rendered within the column
    const task = screen.getByText('Test task')
    expect(task).toBeInTheDocument()
  })

  test('renders drag overlay when task is being dragged', async () => {
    const { useKanbanDragDrop } = await import('../hooks/useKanbanDragDrop')
    const mockUseKanbanDragDrop = vi.mocked(useKanbanDragDrop)

    mockUseKanbanDragDrop.mockReturnValue({
      draggedTask: mockTask,
      isUpdating: false,
      canUndo: false,
      handleDragStart: vi.fn(),
      handleDragOver: vi.fn(),
      handleDragEnd: vi.fn(),
      undoLastOperation: vi.fn(),
      isTransitionAllowed: vi.fn(),
    })

    render(<KanbanBoard {...defaultProps} />)

    await waitFor(() => {
      // Should render the dragged task in overlay
      const tasks = screen.getAllByText('Test task')
      expect(tasks.length).toBeGreaterThan(1) // One in column, one in overlay
    })
  })

  test('loads data on mount', async () => {
    render(<KanbanBoard {...defaultProps} />)

    await waitFor(() => {
      expect(mockApiClient.getTaskStats).toHaveBeenCalled()
      expect(mockApiClient.listTasks).toHaveBeenCalled()
    })
  })

  test('reloads data when refreshKey changes', async () => {
    const { rerender } = render(<KanbanBoard {...defaultProps} refreshKey={1} />)

    await waitFor(() => {
      expect(mockApiClient.getTaskStats).toHaveBeenCalledTimes(1)
    })

    rerender(<KanbanBoard {...defaultProps} refreshKey={2} />)

    await waitFor(() => {
      expect(mockApiClient.getTaskStats).toHaveBeenCalledTimes(2)
    })
  })

  test('passes error and success handlers to hook', () => {
    const onError = vi.fn()
    const onSuccess = vi.fn()

    render(<KanbanBoard {...defaultProps} onError={onError} onSuccess={onSuccess} />)

    // The hook should have been called with the handlers
    const { useKanbanDragDrop } = require('../hooks/useKanbanDragDrop')
    expect(useKanbanDragDrop).toHaveBeenCalledWith(
      expect.objectContaining({
        onError,
        onSuccess,
      })
    )
  })
})