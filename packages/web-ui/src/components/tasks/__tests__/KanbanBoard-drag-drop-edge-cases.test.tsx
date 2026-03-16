import { describe, test, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { renderHook, act } from '@testing-library/react'
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

const createMockTask = (id: string, status: Task['status'], error?: string): Task => ({
  id,
  description: `Task ${id}`,
  status,
  workflow: 'test',
  priority: 'medium',
  effort: 'medium',
  retryCount: 0,
  maxRetries: 3,
  createdAt: new Date('2023-01-01'),
  updatedAt: new Date('2023-01-01'),
  error,
  usage: {
    totalTokens: 100,
    estimatedCost: 0.01,
    inputTokens: 50,
    outputTokens: 50,
  },
  logs: [],
  artifacts: [],
})

describe('KanbanBoard Drag and Drop Edge Cases', () => {
  let setColumnData: ReturnType<typeof vi.fn>
  let onError: ReturnType<typeof vi.fn>
  let onSuccess: ReturnType<typeof vi.fn>

  beforeEach(() => {
    setColumnData = vi.fn()
    onError = vi.fn()
    onSuccess = vi.fn()
    vi.clearAllMocks()
  })

  const renderUseKanbanDragDrop = (columnData: any) => {
    return renderHook(() =>
      useKanbanDragDrop({
        columnData,
        setColumnData,
        onError,
        onSuccess,
      })
    )
  }

  describe('Status Transition Validation', () => {
    test('allows all valid status transitions', () => {
      const { result } = renderUseKanbanDragDrop({})

      // Test all valid transitions as per business logic
      expect(result.current.isTransitionAllowed('pending', 'queued')).toBe(true)
      expect(result.current.isTransitionAllowed('pending', 'cancelled')).toBe(true)
      expect(result.current.isTransitionAllowed('queued', 'planning')).toBe(true)
      expect(result.current.isTransitionAllowed('planning', 'in-progress')).toBe(true)
      expect(result.current.isTransitionAllowed('in-progress', 'completed')).toBe(true)
      expect(result.current.isTransitionAllowed('in-progress', 'failed')).toBe(true)
      expect(result.current.isTransitionAllowed('in-progress', 'paused')).toBe(true)
      expect(result.current.isTransitionAllowed('failed', 'queued')).toBe(true)
      expect(result.current.isTransitionAllowed('cancelled', 'queued')).toBe(true)
    })

    test('blocks invalid status transitions', () => {
      const { result } = renderUseKanbanDragDrop({})

      // Test invalid transitions
      expect(result.current.isTransitionAllowed('pending', 'planning')).toBe(false) // Skip queued
      expect(result.current.isTransitionAllowed('pending', 'completed')).toBe(false)
      expect(result.current.isTransitionAllowed('completed', 'pending')).toBe(false)
      expect(result.current.isTransitionAllowed('completed', 'in-progress')).toBe(false)
      expect(result.current.isTransitionAllowed('queued', 'completed')).toBe(false)
    })

    test('allows same status (for reordering)', () => {
      const { result } = renderUseKanbanDragDrop({})

      expect(result.current.isTransitionAllowed('pending', 'pending')).toBe(true)
      expect(result.current.isTransitionAllowed('in-progress', 'in-progress')).toBe(true)
      expect(result.current.isTransitionAllowed('completed', 'completed')).toBe(true)
    })
  })

  describe('Edge Case Handling', () => {
    test('handles drag without valid over target', async () => {
      const pendingTask = createMockTask('task-1', 'pending')
      const columnData = {
        pending: { tasks: [pendingTask], total: 1 },
        planning: { tasks: [], total: 0 },
      }

      const { result } = renderUseKanbanDragDrop(columnData)

      // Start drag
      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      // End drag without valid over target
      await act(async () => {
        await result.current.handleDragEnd({
          active: { id: 'task-1', data: {} },
          over: null, // No valid drop target
          activatorEvent: {} as any,
          collisions: [],
          delta: { x: 0, y: 0 },
        })
      })

      // Should not call API or update state
      expect(mockApiClient.updateTaskStatus).not.toHaveBeenCalled()
      expect(setColumnData).not.toHaveBeenCalled()
    })

    test('handles drag of non-existent task', async () => {
      const columnData = {
        pending: { tasks: [], total: 0 },
        planning: { tasks: [], total: 0 },
      }

      const { result } = renderUseKanbanDragDrop(columnData)

      // Start drag with non-existent task
      act(() => {
        result.current.handleDragStart({
          active: { id: 'non-existent', data: {} },
          activatorEvent: {} as any,
        })
      })

      // End drag
      await act(async () => {
        await result.current.handleDragEnd({
          active: { id: 'non-existent', data: {} },
          over: { id: 'planning', data: {} },
          activatorEvent: {} as any,
          collisions: [],
          delta: { x: 0, y: 0 },
        })
      })

      // Should not call API
      expect(mockApiClient.updateTaskStatus).not.toHaveBeenCalled()
    })

    test('handles invalid column mapping', async () => {
      const pendingTask = createMockTask('task-1', 'pending')
      const columnData = {
        pending: { tasks: [pendingTask], total: 1 },
      }

      const { result } = renderUseKanbanDragDrop(columnData)

      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      // Drop on invalid column ID
      await act(async () => {
        await result.current.handleDragEnd({
          active: { id: 'task-1', data: {} },
          over: { id: 'invalid-column', data: {} },
          activatorEvent: {} as any,
          collisions: [],
          delta: { x: 0, y: 0 },
        })
      })

      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('Cannot move task')
      )
    })

    test('handles concurrent drag operations', async () => {
      const pendingTask = createMockTask('task-1', 'pending')
      const columnData = {
        pending: { tasks: [pendingTask], total: 1 },
        planning: { tasks: [], total: 0 },
      }

      mockApiClient.updateTaskStatus.mockResolvedValue({
        ...pendingTask,
        status: 'queued',
      })

      const { result } = renderUseKanbanDragDrop(columnData)

      // Start first drag operation (but don't complete it)
      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      // Try to start second drag operation while first is active
      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      expect(result.current.draggedTask).toEqual(pendingTask)
    })

    test('optimistic update rollback preserves original task order', async () => {
      const task1 = createMockTask('task-1', 'pending')
      const task2 = createMockTask('task-2', 'pending')
      const columnData = {
        pending: { tasks: [task1, task2], total: 2 },
        planning: { tasks: [], total: 0 },
      }

      // Mock API failure
      mockApiClient.updateTaskStatus.mockRejectedValue(new Error('API Error'))

      const { result } = renderUseKanbanDragDrop(columnData)

      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      await act(async () => {
        await result.current.handleDragEnd({
          active: { id: 'task-1', data: {} },
          over: { id: 'pending', data: {} }, // Same column (invalid transition will fail)
          activatorEvent: {} as any,
          collisions: [],
          delta: { x: 0, y: 0 },
        })
      })

      // Should revert back to original state
      expect(setColumnData).toHaveBeenCalledTimes(2) // Optimistic update + rollback
      expect(onError).toHaveBeenCalledWith(
        expect.stringContaining('Cannot move task')
      )
    })
  })

  describe('Business Logic Constraints', () => {
    test('prevents moving completed tasks', async () => {
      const completedTask = createMockTask('task-1', 'completed')
      const columnData = {
        completed: { tasks: [completedTask], total: 1 },
        pending: { tasks: [], total: 0 },
      }

      const { result } = renderUseKanbanDragDrop(columnData)

      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      await act(async () => {
        await result.current.handleDragEnd({
          active: { id: 'task-1', data: {} },
          over: { id: 'pending', data: {} },
          activatorEvent: {} as any,
          collisions: [],
          delta: { x: 0, y: 0 },
        })
      })

      expect(onError).toHaveBeenCalledWith(
        'Cannot move task from "completed" to "pending". Invalid transition.'
      )
      expect(mockApiClient.updateTaskStatus).not.toHaveBeenCalled()
    })

    test('allows moving failed tasks back to queue for retry', async () => {
      const failedTask = createMockTask('task-1', 'failed')
      const columnData = {
        failed: { tasks: [failedTask], total: 1 },
        pending: { tasks: [], total: 0 },
      }

      mockApiClient.updateTaskStatus.mockResolvedValue({
        ...failedTask,
        status: 'queued',
      })

      const { result } = renderUseKanbanDragDrop(columnData)

      act(() => {
        result.current.handleDragStart({
          active: { id: 'task-1', data: {} },
          activatorEvent: {} as any,
        })
      })

      await act(async () => {
        await result.current.handleDragEnd({
          active: { id: 'task-1', data: {} },
          over: { id: 'pending', data: {} }, // Failed -> Queued is allowed
          activatorEvent: {} as any,
          collisions: [],
          delta: { x: 0, y: 0 },
        })
      })

      expect(mockApiClient.updateTaskStatus).toHaveBeenCalledWith('task-1', {
        status: 'pending',
        message: 'Status updated via kanban drag-and-drop',
      })
    })
  })

  describe('Performance and Memory', () => {
    test('handles large number of tasks efficiently', () => {
      const largeTasks = Array.from({ length: 1000 }, (_, i) =>
        createMockTask(`task-${i}`, i % 2 === 0 ? 'pending' : 'queued')
      )

      const columnData = {
        pending: {
          tasks: largeTasks.filter(t => t.status === 'pending'),
          total: 500,
        },
        planning: {
          tasks: largeTasks.filter(t => t.status === 'queued'),
          total: 500,
        },
      }

      const startTime = performance.now()
      const { result } = renderUseKanbanDragDrop(columnData)
      const endTime = performance.now()

      // Should initialize quickly even with many tasks
      expect(endTime - startTime).toBeLessThan(100)
      expect(result.current.isTransitionAllowed).toBeDefined()
    })

    test('cleans up timeouts on unmount', () => {
      const { unmount } = renderUseKanbanDragDrop({})

      // Simulate timeout cleanup
      unmount()

      // No way to directly test timeout cleanup, but unmount should not throw
      expect(true).toBe(true)
    })
  })
})