import React from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useBulkTaskOperations } from '../useBulkTaskOperations'
import type { Task } from '@apexcli/core'

// Mock the API client
const mockApiClient = {
  cancelTask: vi.fn(),
  retryTask: vi.fn(),
  // Note: delete operation uses cancelTask as there's no specific deleteTask method
}

// Mock the useApi hook
vi.mock('../useApi', () => ({
  useApi: () => mockApiClient,
}))

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
    description: 'Task 2 - Failed',
    workflow: 'testing',
    autonomy: 'medium',
    status: 'failed',
    priority: 'medium',
    effort: 'small',
    error: 'Test failed',
    projectPath: '/project',
    retryCount: 1,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T09:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T09:30:00Z').toISOString(),
  },
  {
    id: 'task-3',
    description: 'Task 3 - Completed',
    workflow: 'deployment',
    autonomy: 'high',
    status: 'completed',
    priority: 'low',
    effort: 'large',
    projectPath: '/project',
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    createdAt: new Date('2024-01-01T08:00:00Z').toISOString(),
    updatedAt: new Date('2024-01-01T08:15:00Z').toISOString(),
  },
]

describe('useBulkTaskOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  describe('Hook Initialization', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() => useBulkTaskOperations())

      expect(result.current.isOperating).toBe(false)
      expect(result.current.currentOperation).toBe(null)
      expect(typeof result.current.executeBulkOperation).toBe('function')
      expect(typeof result.current.abortOperation).toBe('function')
    })
  })

  describe('Cancel Operations', () => {
    it('successfully cancels multiple tasks', async () => {
      const cancelledTask1 = { ...mockTasks[0], status: 'cancelled' as const }
      const cancelledTask2 = { ...mockTasks[1], status: 'cancelled' as const }

      mockApiClient.cancelTask
        .mockResolvedValueOnce(cancelledTask1)
        .mockResolvedValueOnce(cancelledTask2)

      const onProgress = vi.fn()
      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'cancel',
          [mockTasks[0], mockTasks[1]],
          { onProgress, concurrency: 2 }
        )
      })

      // Should be operating immediately
      expect(result.current.isOperating).toBe(true)
      expect(result.current.currentOperation?.type).toBe('cancel')
      expect(result.current.currentOperation?.total).toBe(2)

      // Wait for operation to complete
      await act(async () => {
        await operationPromise!
      })

      expect(result.current.isOperating).toBe(false)
      expect(result.current.currentOperation).toBe(null)

      expect(mockApiClient.cancelTask).toHaveBeenCalledTimes(2)
      expect(mockApiClient.cancelTask).toHaveBeenCalledWith('task-1')
      expect(mockApiClient.cancelTask).toHaveBeenCalledWith('task-2')

      // Check progress callbacks
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cancel',
          completed: 2,
          failed: 0,
          percentage: 100,
        })
      )
    })

    it('handles partial failures gracefully', async () => {
      mockApiClient.cancelTask
        .mockResolvedValueOnce({ ...mockTasks[0], status: 'cancelled' })
        .mockRejectedValueOnce(new Error('Network error'))

      const onProgress = vi.fn()
      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'cancel',
          [mockTasks[0], mockTasks[1]],
          { onProgress }
        )
      })

      await act(async () => {
        await operationPromise!
      })

      expect(result.current.isOperating).toBe(false)

      // Should call progress with mixed results
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          completed: 1,
          failed: 1,
          percentage: 100,
        })
      )
    })

    it('respects concurrency limits', async () => {
      const resolvers: Array<(value: any) => void> = []

      // Mock API calls to be manually resolvable
      mockApiClient.cancelTask.mockImplementation(() => {
        return new Promise(resolve => {
          resolvers.push(resolve)
        })
      })

      const { result } = renderHook(() => useBulkTaskOperations())

      act(() => {
        result.current.executeBulkOperation(
          'cancel',
          mockTasks,
          { concurrency: 2 }
        )
      })

      // Wait a tick for promises to start
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      // Should start only 2 concurrent operations
      expect(mockApiClient.cancelTask).toHaveBeenCalledTimes(2)

      // Resolve first operation
      act(() => {
        resolvers[0]({ ...mockTasks[0], status: 'cancelled' })
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      // Should start third operation
      expect(mockApiClient.cancelTask).toHaveBeenCalledTimes(3)
    })

    it('supports operation delay between tasks', async () => {
      mockApiClient.cancelTask.mockResolvedValue({ ...mockTasks[0], status: 'cancelled' })

      const { result } = renderHook(() => useBulkTaskOperations())

      act(() => {
        result.current.executeBulkOperation(
          'cancel',
          [mockTasks[0], mockTasks[1]],
          { delay: 100 }
        )
      })

      // Wait for first task
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
      })

      expect(mockApiClient.cancelTask).toHaveBeenCalledTimes(1)

      // Advance time to trigger second task
      await act(async () => {
        vi.advanceTimersByTime(100)
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      expect(mockApiClient.cancelTask).toHaveBeenCalledTimes(2)
    })
  })

  describe('Retry Operations', () => {
    it('successfully retries multiple failed tasks', async () => {
      const retriedTask1 = { ...mockTasks[1], status: 'pending' as const, retryCount: 2 }
      const retriedTask2 = { ...mockTasks[0], status: 'pending' as const, retryCount: 1 }

      mockApiClient.retryTask
        .mockResolvedValueOnce(retriedTask1)
        .mockResolvedValueOnce(retriedTask2)

      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'retry',
          [mockTasks[1], mockTasks[0]]
        )
      })

      await act(async () => {
        await operationPromise!
      })

      expect(mockApiClient.retryTask).toHaveBeenCalledTimes(2)
      expect(mockApiClient.retryTask).toHaveBeenCalledWith('task-2')
      expect(mockApiClient.retryTask).toHaveBeenCalledWith('task-1')
    })

    it('handles retry failures', async () => {
      mockApiClient.retryTask.mockRejectedValue(new Error('Retry limit exceeded'))

      const onProgress = vi.fn()
      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'retry',
          [mockTasks[1]],
          { onProgress }
        )
      })

      await act(async () => {
        await operationPromise!
      })

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'retry',
          completed: 0,
          failed: 1,
          percentage: 100,
        })
      )
    })
  })

  describe('Delete Operations', () => {
    it('successfully deletes multiple completed tasks', async () => {
      // Delete uses cancelTask under the hood
      const deletedTask1 = { ...mockTasks[2], status: 'deleted' as any }
      const deletedTask2 = { ...mockTasks[1], status: 'deleted' as any }

      mockApiClient.cancelTask
        .mockResolvedValueOnce(deletedTask1)
        .mockResolvedValueOnce(deletedTask2)

      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'delete',
          [mockTasks[2], mockTasks[1]]
        )
      })

      await act(async () => {
        await operationPromise!
      })

      expect(mockApiClient.cancelTask).toHaveBeenCalledTimes(2)
      expect(mockApiClient.cancelTask).toHaveBeenCalledWith('task-3')
      expect(mockApiClient.cancelTask).toHaveBeenCalledWith('task-2')
    })
  })

  describe('Abort Functionality', () => {
    it('can abort ongoing operation', async () => {
      const resolvers: Array<(value: any) => void> = []

      mockApiClient.cancelTask.mockImplementation(() => {
        return new Promise(resolve => {
          resolvers.push(resolve)
        })
      })

      const onProgress = vi.fn()
      const { result } = renderHook(() => useBulkTaskOperations())

      act(() => {
        result.current.executeBulkOperation(
          'cancel',
          mockTasks,
          { onProgress }
        )
      })

      // Wait for operation to start
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      expect(result.current.isOperating).toBe(true)

      // Abort the operation
      act(() => {
        result.current.abortOperation()
      })

      expect(result.current.currentOperation?.aborted).toBe(true)

      // Complete one pending task
      act(() => {
        resolvers[0]({ ...mockTasks[0], status: 'cancelled' })
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      // Should call progress with abort flag
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          aborted: true,
        })
      )

      expect(result.current.isOperating).toBe(false)
    })

    it('does nothing when no operation is running', () => {
      const { result } = renderHook(() => useBulkTaskOperations())

      expect(() => {
        result.current.abortOperation()
      }).not.toThrow()

      expect(result.current.isOperating).toBe(false)
    })
  })

  describe('Progress Tracking', () => {
    it('tracks progress correctly during operation', async () => {
      const progressCalls: any[] = []

      mockApiClient.cancelTask
        .mockResolvedValueOnce({ ...mockTasks[0], status: 'cancelled' })
        .mockResolvedValueOnce({ ...mockTasks[1], status: 'cancelled' })
        .mockResolvedValueOnce({ ...mockTasks[2], status: 'cancelled' })

      const onProgress = vi.fn((state) => {
        progressCalls.push({ ...state })
      })

      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'cancel',
          mockTasks,
          { onProgress, concurrency: 1 } // Sequential for predictable progress
        )
      })

      await act(async () => {
        await operationPromise!
      })

      // Should have multiple progress updates
      expect(progressCalls.length).toBeGreaterThan(1)

      // First call should be initial state
      expect(progressCalls[0]).toMatchObject({
        type: 'cancel',
        total: 3,
        completed: 0,
        failed: 0,
        inProgress: 1,
        percentage: 0,
      })

      // Last call should be completion
      const lastCall = progressCalls[progressCalls.length - 1]
      expect(lastCall).toMatchObject({
        type: 'cancel',
        total: 3,
        completed: 3,
        failed: 0,
        inProgress: 0,
        percentage: 100,
      })

      expect(lastCall.completedAt).toBeDefined()
    })

    it('includes individual results in progress updates', async () => {
      const updatedTask = { ...mockTasks[0], status: 'cancelled' as const }
      mockApiClient.cancelTask.mockResolvedValueOnce(updatedTask)

      const onProgress = vi.fn()
      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'cancel',
          [mockTasks[0]],
          { onProgress }
        )
      })

      await act(async () => {
        await operationPromise!
      })

      const finalProgressCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0]
      expect(finalProgressCall.results).toEqual([
        {
          taskId: 'task-1',
          success: true,
          updatedTask,
        }
      ])
    })

    it('includes error information for failed operations', async () => {
      const error = new Error('Operation failed')
      mockApiClient.cancelTask.mockRejectedValueOnce(error)

      const onProgress = vi.fn()
      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'cancel',
          [mockTasks[0]],
          { onProgress }
        )
      })

      await act(async () => {
        await operationPromise!
      })

      const finalProgressCall = onProgress.mock.calls[onProgress.mock.calls.length - 1][0]
      expect(finalProgressCall.results).toEqual([
        {
          taskId: 'task-1',
          success: false,
          error: 'Operation failed',
        }
      ])
    })
  })

  describe('Error Handling', () => {
    it('continues operation when stopOnError is false', async () => {
      mockApiClient.cancelTask
        .mockRejectedValueOnce(new Error('First task failed'))
        .mockResolvedValueOnce({ ...mockTasks[1], status: 'cancelled' })

      const onProgress = vi.fn()
      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'cancel',
          [mockTasks[0], mockTasks[1]],
          { onProgress, stopOnError: false }
        )
      })

      await act(async () => {
        await operationPromise!
      })

      expect(mockApiClient.cancelTask).toHaveBeenCalledTimes(2)

      const finalProgress = onProgress.mock.calls[onProgress.mock.calls.length - 1][0]
      expect(finalProgress.completed).toBe(1)
      expect(finalProgress.failed).toBe(1)
    })

    it('stops operation when stopOnError is true', async () => {
      mockApiClient.cancelTask
        .mockRejectedValueOnce(new Error('First task failed'))
        .mockResolvedValue({ ...mockTasks[1], status: 'cancelled' })

      const onProgress = vi.fn()
      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'cancel',
          [mockTasks[0], mockTasks[1]],
          { onProgress, stopOnError: true, concurrency: 1 }
        )
      })

      await act(async () => {
        await operationPromise!
      })

      // Should stop after first failure
      expect(mockApiClient.cancelTask).toHaveBeenCalledTimes(1)
    })

    it('handles API client errors gracefully', async () => {
      mockApiClient.cancelTask.mockImplementation(() => {
        throw new Error('API client not available')
      })

      const onProgress = vi.fn()
      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'cancel',
          [mockTasks[0]],
          { onProgress }
        )
      })

      await act(async () => {
        await operationPromise!
      })

      const finalProgress = onProgress.mock.calls[onProgress.mock.calls.length - 1][0]
      expect(finalProgress.failed).toBe(1)
      expect(finalProgress.results[0].error).toContain('API client not available')
    })
  })

  describe('Edge Cases', () => {
    it('handles empty task array', async () => {
      const onProgress = vi.fn()
      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'cancel',
          [],
          { onProgress }
        )
      })

      await act(async () => {
        await operationPromise!
      })

      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 0,
          completed: 0,
          failed: 0,
          percentage: 100,
        })
      )

      expect(mockApiClient.cancelTask).not.toHaveBeenCalled()
    })

    it('handles tasks with missing IDs', async () => {
      const invalidTask = { ...mockTasks[0] }
      delete (invalidTask as any).id

      const onProgress = vi.fn()
      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'cancel',
          [invalidTask as any],
          { onProgress }
        )
      })

      await act(async () => {
        await operationPromise!
      })

      const finalProgress = onProgress.mock.calls[onProgress.mock.calls.length - 1][0]
      expect(finalProgress.failed).toBe(1)
    })

    it('handles very large number of tasks', async () => {
      const manyTasks = Array.from({ length: 100 }, (_, i) => ({
        ...mockTasks[0],
        id: `task-${i}`,
      }))

      mockApiClient.cancelTask.mockResolvedValue({ ...mockTasks[0], status: 'cancelled' })

      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'cancel',
          manyTasks,
          { concurrency: 10 }
        )
      })

      await act(async () => {
        await operationPromise!
      })

      expect(mockApiClient.cancelTask).toHaveBeenCalledTimes(100)
    })
  })

  describe('Concurrency Behavior', () => {
    it('defaults to 5 concurrent operations', async () => {
      const resolvers: Array<(value: any) => void> = []

      mockApiClient.cancelTask.mockImplementation(() => {
        return new Promise(resolve => {
          resolvers.push(resolve)
        })
      })

      const { result } = renderHook(() => useBulkTaskOperations())

      act(() => {
        result.current.executeBulkOperation('cancel', Array.from({ length: 10 }, (_, i) => ({
          ...mockTasks[0],
          id: `task-${i}`
        })))
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      // Should start with default concurrency of 5
      expect(mockApiClient.cancelTask).toHaveBeenCalledTimes(5)
    })

    it('respects custom concurrency setting', async () => {
      const resolvers: Array<(value: any) => void> = []

      mockApiClient.cancelTask.mockImplementation(() => {
        return new Promise(resolve => {
          resolvers.push(resolve)
        })
      })

      const { result } = renderHook(() => useBulkTaskOperations())

      act(() => {
        result.current.executeBulkOperation(
          'cancel',
          Array.from({ length: 10 }, (_, i) => ({ ...mockTasks[0], id: `task-${i}` })),
          { concurrency: 3 }
        )
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      expect(mockApiClient.cancelTask).toHaveBeenCalledTimes(3)
    })

    it('handles concurrency of 1 (sequential execution)', async () => {
      const callOrder: string[] = []

      mockApiClient.cancelTask.mockImplementation((taskId: string) => {
        callOrder.push(taskId)
        return Promise.resolve({ ...mockTasks[0], id: taskId, status: 'cancelled' })
      })

      const { result } = renderHook(() => useBulkTaskOperations())

      let operationPromise: Promise<any>

      act(() => {
        operationPromise = result.current.executeBulkOperation(
          'cancel',
          [mockTasks[0], mockTasks[1], mockTasks[2]],
          { concurrency: 1 }
        )
      })

      await act(async () => {
        await operationPromise!
      })

      expect(callOrder).toEqual(['task-1', 'task-2', 'task-3'])
    })
  })

  describe('Memory Management and Cleanup', () => {
    it('cleans up aborted operations properly', async () => {
      const resolvers: Array<(value: any) => void> = []

      mockApiClient.cancelTask.mockImplementation(() => {
        return new Promise(resolve => {
          resolvers.push(resolve)
        })
      })

      const { result, unmount } = renderHook(() => useBulkTaskOperations())

      act(() => {
        result.current.executeBulkOperation('cancel', mockTasks)
      })

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0))
      })

      // Abort and unmount
      act(() => {
        result.current.abortOperation()
      })

      unmount()

      // Completing pending promises should not cause issues
      act(() => {
        resolvers.forEach(resolve => {
          resolve({ ...mockTasks[0], status: 'cancelled' })
        })
      })

      // Should not throw or cause memory leaks
    })

    it('prevents memory leaks with rapid operations', async () => {
      mockApiClient.cancelTask.mockResolvedValue({ ...mockTasks[0], status: 'cancelled' })

      const { result } = renderHook(() => useBulkTaskOperations())

      // Start and complete many operations rapidly
      for (let i = 0; i < 10; i++) {
        let operationPromise: Promise<any>

        act(() => {
          operationPromise = result.current.executeBulkOperation('cancel', [mockTasks[0]])
        })

        await act(async () => {
          await operationPromise!
        })
      }

      // Should not accumulate memory or cause issues
      expect(result.current.isOperating).toBe(false)
    })
  })
})