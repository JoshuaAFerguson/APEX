'use client'

import { useState, useCallback, useRef } from 'react'
import type {
  BulkOperationType,
  BulkOperationOptions,
  BulkOperationTaskResult,
  BulkOperationProgress,
  UseBulkTaskOperationsReturn,
} from '@/types/bulk-operations'
import { BULK_OPERATION_DEFAULTS } from '@/types/bulk-operations'
import { ApexApiClient } from '@/lib/api-client'

/**
 * Create default progress state
 */
function createInitialProgress(taskIds: string[], operationType: BulkOperationType): BulkOperationProgress {
  return {
    total: taskIds.length,
    completed: 0,
    failed: 0,
    inProgress: 0,
    percentage: 0,
    results: [],
    aborted: false,
    startedAt: new Date(),
  }
}

/**
 * Calculate percentage from progress state
 */
function calculatePercentage(completed: number, failed: number, total: number): number {
  if (total === 0) return 0
  return Math.round(((completed + failed) / total) * 100)
}

/**
 * Delay execution for rate limiting
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Execute operations with controlled concurrency
 */
async function executeWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
  delayBetweenOps: number = 0,
  signal?: AbortSignal
): Promise<R[]> {
  const results: R[] = []
  const executing: Promise<void>[] = []

  for (let i = 0; i < items.length; i++) {
    if (signal?.aborted) {
      throw new Error('Operation aborted')
    }

    const item = items[i]
    const execute = async (): Promise<void> => {
      try {
        const result = await fn(item)
        results[i] = result
      } catch (error) {
        // Individual errors are handled by the caller
        throw error
      }
    }

    const promise = execute()
    executing.push(promise)

    // If we've reached the concurrency limit, wait for one to complete
    if (executing.length >= concurrency) {
      await Promise.race(executing)
      // Remove completed promises
      for (let j = executing.length - 1; j >= 0; j--) {
        const exec = executing[j]
        if (await Promise.race([exec.then(() => true), Promise.resolve(false)])) {
          executing.splice(j, 1)
        }
      }
    }

    // Add delay between operations if specified
    if (delayBetweenOps > 0 && i < items.length - 1) {
      await delay(delayBetweenOps)
    }
  }

  // Wait for all remaining operations
  await Promise.allSettled(executing)
  return results
}

/**
 * Custom hook for bulk task operations
 * Provides methods to perform bulk cancel, retry, and delete operations
 * with progress tracking and error handling.
 */
export function useBulkTaskOperations(
  apiClient?: ApexApiClient
): UseBulkTaskOperationsReturn {
  const [isOperating, setIsOperating] = useState(false)
  const [progress, setProgress] = useState<BulkOperationProgress | null>(null)
  const [currentOperation, setCurrentOperation] = useState<BulkOperationType | null>(null)
  const [lastError, setLastError] = useState<Error | null>(null)

  // Use ref to track abort controller for current operation
  const abortControllerRef = useRef<AbortController | null>(null)
  const clientRef = useRef(apiClient || new ApexApiClient())

  // Update API client reference if provided
  if (apiClient) {
    clientRef.current = apiClient
  }

  /**
   * Execute a bulk operation with progress tracking
   */
  const executeBulkOperation = useCallback(async (
    taskIds: string[],
    operationType: BulkOperationType,
    operationFn: (taskId: string, signal?: AbortSignal) => Promise<any>,
    options: BulkOperationOptions = {}
  ): Promise<BulkOperationTaskResult[]> => {
    if (isOperating) {
      throw new Error('Another bulk operation is already in progress')
    }

    if (taskIds.length === 0) {
      return []
    }

    const {
      concurrency = BULK_OPERATION_DEFAULTS.concurrency,
      delayBetweenOps = BULK_OPERATION_DEFAULTS.delayBetweenOps,
      stopOnError = BULK_OPERATION_DEFAULTS.stopOnError,
      onProgress,
      signal,
    } = options

    // Create abort controller if not provided
    const abortController = signal ? null : new AbortController()
    const operationSignal = signal || abortController?.signal
    abortControllerRef.current = abortController

    setIsOperating(true)
    setCurrentOperation(operationType)
    setLastError(null)

    const initialProgress = createInitialProgress(taskIds, operationType)
    setProgress(initialProgress)
    onProgress?.(initialProgress)

    const results: BulkOperationTaskResult[] = []

    try {
      // Execute operations with controlled concurrency
      await executeWithConcurrency(
        taskIds,
        async (taskId) => {
          if (operationSignal?.aborted) {
            throw new Error('Operation aborted')
          }

          // Update progress to show this task as in progress
          setProgress(prev => {
            if (!prev) return prev
            const updated = {
              ...prev,
              inProgress: prev.inProgress + 1,
            }
            onProgress?.(updated)
            return updated
          })

          try {
            const result = await operationFn(taskId, operationSignal)
            const taskResult: BulkOperationTaskResult = {
              taskId,
              success: true,
              task: result,
            }
            results.push(taskResult)

            // Update progress
            setProgress(prev => {
              if (!prev) return prev
              const completed = prev.completed + 1
              const inProgress = Math.max(0, prev.inProgress - 1)
              const percentage = calculatePercentage(completed, prev.failed, prev.total)
              const updated = {
                ...prev,
                completed,
                inProgress,
                percentage,
                results: [...prev.results, taskResult],
              }
              onProgress?.(updated)
              return updated
            })

            return taskResult
          } catch (error) {
            const taskResult: BulkOperationTaskResult = {
              taskId,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            }
            results.push(taskResult)

            // Update progress
            setProgress(prev => {
              if (!prev) return prev
              const failed = prev.failed + 1
              const inProgress = Math.max(0, prev.inProgress - 1)
              const percentage = calculatePercentage(prev.completed, failed, prev.total)
              const updated = {
                ...prev,
                failed,
                inProgress,
                percentage,
                results: [...prev.results, taskResult],
              }
              onProgress?.(updated)
              return updated
            })

            if (stopOnError) {
              throw error
            }

            return taskResult
          }
        },
        concurrency,
        delayBetweenOps,
        operationSignal
      )

      // Mark progress as complete
      setProgress(prev => {
        if (!prev) return prev
        const updated = {
          ...prev,
          completedAt: new Date(),
          percentage: 100,
        }
        onProgress?.(updated)
        return updated
      })

      return results
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error))
      setLastError(errorObj)

      // Mark progress as aborted if it was an abort
      if (errorObj.message.includes('aborted')) {
        setProgress(prev => {
          if (!prev) return prev
          const updated = {
            ...prev,
            aborted: true,
            completedAt: new Date(),
          }
          onProgress?.(updated)
          return updated
        })
      }

      throw errorObj
    } finally {
      setIsOperating(false)
      setCurrentOperation(null)
      abortControllerRef.current = null
    }
  }, [isOperating])

  /**
   * Cancel multiple tasks
   */
  const bulkCancel = useCallback(async (
    taskIds: string[],
    options?: BulkOperationOptions
  ): Promise<BulkOperationTaskResult[]> => {
    return executeBulkOperation(
      taskIds,
      'cancel',
      (taskId, signal) => clientRef.current.cancelTask(taskId),
      options
    )
  }, [executeBulkOperation])

  /**
   * Retry multiple tasks
   */
  const bulkRetry = useCallback(async (
    taskIds: string[],
    options?: BulkOperationOptions
  ): Promise<BulkOperationTaskResult[]> => {
    return executeBulkOperation(
      taskIds,
      'retry',
      (taskId, signal) => clientRef.current.retryTask(taskId),
      options
    )
  }, [executeBulkOperation])

  /**
   * Delete multiple tasks
   */
  const bulkDelete = useCallback(async (
    taskIds: string[],
    options?: BulkOperationOptions
  ): Promise<BulkOperationTaskResult[]> => {
    return executeBulkOperation(
      taskIds,
      'delete',
      async (taskId, signal) => {
        // Note: Assuming there's a deleteTask method on the API client
        // If not available, this will need to be implemented
        if ('deleteTask' in clientRef.current && typeof clientRef.current.deleteTask === 'function') {
          return await (clientRef.current as any).deleteTask(taskId)
        }
        throw new Error('Delete operation not implemented in API client')
      },
      options
    )
  }, [executeBulkOperation])

  /**
   * Abort the current operation
   */
  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  /**
   * Reset operation state
   */
  const reset = useCallback(() => {
    setProgress(null)
    setLastError(null)
    setCurrentOperation(null)
    if (!isOperating) {
      setIsOperating(false)
    }
  }, [isOperating])

  return {
    // State
    isOperating,
    progress,
    currentOperation,
    lastError,

    // Actions
    bulkCancel,
    bulkRetry,
    bulkDelete,
    abort,
    reset,
  }
}