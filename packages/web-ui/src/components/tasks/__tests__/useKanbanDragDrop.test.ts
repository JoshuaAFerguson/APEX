import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useKanbanDragDrop } from '../hooks/useKanbanDragDrop'
import { apiClient } from '@/lib/api-client'
import type { Task } from '@apexcli/core'

// Mock API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    updateTaskStatus: vi.fn(),
  },
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

const mockQueuedTask: Task = {
  ...mockTask,
  status: 'queued',
}

const initialColumnData = {
  pending: {
    tasks: [mockTask],
    total: 1,
  },
  planning: {
    tasks: [],
    total: 0,
  },
  'in-progress': {
    tasks: [],
    total: 0,
  },
}

describe('useKanbanDragDrop', () => {
  let setColumnData: ReturnType<typeof vi.fn>
  let onError: ReturnType<typeof vi.fn>
  let onSuccess: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setColumnData = vi.fn()
    onError = vi.fn()
    onSuccess = vi.fn()
    vi.clearAllMocks()
  })

  const renderUseKanbanDragDrop = (columnData = initialColumnData) => {
    return renderHook(() =>
      useKanbanDragDrop({
        columnData,
        setColumnData,
        onError,
        onSuccess,
      })
    )
  }

  describe('isTransitionAllowed', () => {
    test('allows same status transition', () => {
      const { result } = renderUseKanbanDragDrop()
      expect(result.current.isTransitionAllowed('pending', 'pending')).toBe(true)
    })

    test('allows valid transitions', () => {
      const { result } = renderUseKanbanDragDrop()
      expect(result.current.isTransitionAllowed('pending', 'queued')).toBe(true)
      expect(result.current.isTransitionAllowed('queued', 'planning')).toBe(true)
      expect(result.current.isTransitionAllowed('planning', 'in-progress')).toBe(true)
    })

    test('disallows invalid transitions', () => {
      const { result } = renderUseKanbanDragDrop()
      expect(result.current.isTransitionAllowed('completed', 'pending')).toBe(false)
      expect(result.current.isTransitionAllowed('pending', 'completed')).toBe(false)
    })
  })

  describe('handleDragStart', () => {
    test('sets dragged task correctly', () => {
      const { result } = renderUseKanbanDragDrop()

      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      expect(result.current.draggedTask).toEqual(mockTask)
    })

    test('handles non-existent task', () => {
      const { result } = renderUseKanbanDragDrop()

      act(() => {
        result.current.handleDragStart({
          active: { id: 'non-existent', data: {} },
          activatorEvent: {} as any,
        })
      })

      expect(result.current.draggedTask).toBeNull()
    })
  })

  describe('handleDragEnd', () => {
    test('handles valid drag and drop operation', async () => {
      // Use queued task which can transition to planning
      const queuedColumnData = {
        pending: {
          tasks: [mockQueuedTask],
          total: 1,
        },
        planning: {
          tasks: [],
          total: 0,
        },
        'in-progress': {
          tasks: [],
          total: 0,
        },
      }

      mockApiClient.updateTaskStatus.mockResolvedValue({
        ...mockQueuedTask,
        status: 'planning',
        updatedAt: new Date(),
      })

      const { result } = renderUseKanbanDragDrop(queuedColumnData)

      // Start drag
      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      // End drag - queued to planning is valid
      await act(async () => {
        await result.current.handleDragEnd({
          active: { id: 'task-1', data: {} },
          over: { id: 'planning', data: {} },
          activatorEvent: {} as any,
          collisions: [],
          delta: { x: 0, y: 0 },
        })
      })

      expect(mockApiClient.updateTaskStatus).toHaveBeenCalledWith('task-1', {
        status: 'planning',
        message: 'Status updated via kanban drag-and-drop',
      })
      expect(setColumnData).toHaveBeenCalled()
      expect(onSuccess).toHaveBeenCalledWith('Task moved to "planning" successfully')
    })

    test('handles invalid transition', async () => {
      const { result } = renderUseKanbanDragDrop({
        completed: {
          tasks: [{ ...mockTask, status: 'completed' }],
          total: 1,
        },
        pending: {
          tasks: [],
          total: 0,
        },
      })

      // Start drag
      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      // End drag - invalid transition
      await act(async () => {
        await result.current.handleDragEnd({
          active: { id: 'task-1', data: {} },
          over: { id: 'pending', data: {} },
          activatorEvent: {} as any,
          collisions: [],
          delta: { x: 0, y: 0 },
        })
      })

      expect(mockApiClient.updateTaskStatus).not.toHaveBeenCalled()
      expect(onError).toHaveBeenCalledWith(
        'Cannot move task from "completed" to "pending". Invalid transition.'
      )
    })

    test('handles API error', async () => {
      // Use queued task which can transition to planning
      const queuedColumnData = {
        pending: {
          tasks: [mockQueuedTask],
          total: 1,
        },
        planning: {
          tasks: [],
          total: 0,
        },
        'in-progress': {
          tasks: [],
          total: 0,
        },
      }

      mockApiClient.updateTaskStatus.mockRejectedValue(new Error('API Error'))

      const { result } = renderUseKanbanDragDrop(queuedColumnData)

      // Start drag
      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      // End drag
      await act(async () => {
        await result.current.handleDragEnd({
          active: { id: 'task-1', data: {} },
          over: { id: 'planning', data: {} },
          activatorEvent: {} as any,
          collisions: [],
          delta: { x: 0, y: 0 },
        })
      })

      expect(onError).toHaveBeenCalledWith('Failed to update task status')
      // Should revert optimistic update
      expect(setColumnData).toHaveBeenCalledTimes(2) // Once for optimistic, once for revert
    })

    test('ignores drop in same column', async () => {
      const { result } = renderUseKanbanDragDrop()

      // Start drag
      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      // End drag in same column
      await act(async () => {
        await result.current.handleDragEnd({
          active: { id: 'task-1', data: {} },
          over: { id: 'pending', data: {} },
          activatorEvent: {} as any,
          collisions: [],
          delta: { x: 0, y: 0 },
        })
      })

      expect(mockApiClient.updateTaskStatus).not.toHaveBeenCalled()
      expect(setColumnData).not.toHaveBeenCalled()
    })
  })

  describe('undo functionality', () => {
    test('can undo after successful operation', async () => {
      // Use queued task which can transition to planning
      const queuedColumnData = {
        pending: {
          tasks: [mockQueuedTask],
          total: 1,
        },
        planning: {
          tasks: [],
          total: 0,
        },
        'in-progress': {
          tasks: [],
          total: 0,
        },
      }

      mockApiClient.updateTaskStatus
        .mockResolvedValueOnce({
          ...mockQueuedTask,
          status: 'planning',
          updatedAt: new Date(),
        })
        .mockResolvedValueOnce({
          ...mockQueuedTask,
          status: 'queued',
          updatedAt: new Date(),
        })

      const { result } = renderUseKanbanDragDrop(queuedColumnData)

      // Perform drag and drop
      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      await act(async () => {
        await result.current.handleDragEnd({
          active: { id: 'task-1', data: {} },
          over: { id: 'planning', data: {} },
          activatorEvent: {} as any,
          collisions: [],
          delta: { x: 0, y: 0 },
        })
      })

      // Wait a bit for undo stack to populate
      await waitFor(() => {
        expect(result.current.canUndo).toBe(true)
      })

      // Perform undo
      await act(async () => {
        await result.current.undoLastOperation()
      })

      expect(mockApiClient.updateTaskStatus).toHaveBeenCalledTimes(2)
      expect(mockApiClient.updateTaskStatus).toHaveBeenLastCalledWith('task-1', {
        status: 'queued',
        message: 'Status updated via kanban drag-and-drop',
      })
      expect(onSuccess).toHaveBeenCalledWith('Task status reverted successfully')
    })

    test('handles undo API error', async () => {
      // Use queued task which can transition to planning
      const queuedColumnData = {
        pending: {
          tasks: [mockQueuedTask],
          total: 1,
        },
        planning: {
          tasks: [],
          total: 0,
        },
        'in-progress': {
          tasks: [],
          total: 0,
        },
      }

      mockApiClient.updateTaskStatus
        .mockResolvedValueOnce({
          ...mockQueuedTask,
          status: 'planning',
          updatedAt: new Date(),
        })
        .mockRejectedValueOnce(new Error('Undo failed'))

      const { result } = renderUseKanbanDragDrop(queuedColumnData)

      // Perform drag and drop
      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      await act(async () => {
        await result.current.handleDragEnd({
          active: { id: 'task-1', data: {} },
          over: { id: 'planning', data: {} },
          activatorEvent: {} as any,
          collisions: [],
          delta: { x: 0, y: 0 },
        })
      })

      // Wait for canUndo to be true
      await waitFor(() => {
        expect(result.current.canUndo).toBe(true)
      })

      // Attempt undo
      await act(async () => {
        await result.current.undoLastOperation()
      })

      expect(onError).toHaveBeenCalledWith('Failed to undo status change')
    })
  })

  describe('drag state management', () => {
    test('shows updating state during operation', async () => {
      // Use queued task which can transition to planning
      const queuedColumnData = {
        pending: {
          tasks: [mockQueuedTask],
          total: 1,
        },
        planning: {
          tasks: [],
          total: 0,
        },
        'in-progress': {
          tasks: [],
          total: 0,
        },
      }

      let resolveApiCall: (value: any) => void
      const apiPromise = new Promise((resolve) => {
        resolveApiCall = resolve
      })
      mockApiClient.updateTaskStatus.mockReturnValue(apiPromise)

      const { result } = renderUseKanbanDragDrop(queuedColumnData)

      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      let dragEndPromise: Promise<void>
      await act(async () => {
        dragEndPromise = result.current.handleDragEnd({
          active: { id: 'task-1', data: {} },
          over: { id: 'planning', data: {} },
          activatorEvent: {} as any,
          collisions: [],
          delta: { x: 0, y: 0 },
        })

        // Check immediately after starting the operation
        await waitFor(() => {
          expect(result.current.isUpdating).toBe(true)
        }, { timeout: 100 })
      })

      // Resolve API call
      resolveApiCall!({ ...mockQueuedTask, status: 'planning' })
      await act(async () => {
        await dragEndPromise!
      })

      expect(result.current.isUpdating).toBe(false)
    })
  })
})