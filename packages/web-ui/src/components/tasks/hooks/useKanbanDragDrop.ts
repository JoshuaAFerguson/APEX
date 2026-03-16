import { useState, useCallback, useRef } from 'react'
import { DragEndEvent, DragStartEvent, DragOverEvent } from '@dnd-kit/core'
import { apiClient } from '@/lib/api-client'
import type { Task, TaskStatus } from '@apexcli/core'

// Define status transition rules based on business logic
const STATUS_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  'pending': ['queued', 'cancelled'],
  'queued': ['planning', 'cancelled'],
  'planning': ['in-progress', 'failed', 'cancelled'],
  'in-progress': ['completed', 'failed', 'paused', 'cancelled'],
  'waiting-approval': ['in-progress', 'failed', 'cancelled'],
  'awaiting-approval': ['in-progress', 'failed', 'cancelled'],
  'paused': ['in-progress', 'cancelled'],
  'completed': [], // Completed tasks generally shouldn't be moved
  'failed': ['queued', 'cancelled'], // Failed tasks can be retried
  'cancelled': ['queued'], // Cancelled tasks can be restarted
}

// Map column IDs to their primary status for drops
const COLUMN_TO_STATUS: Record<string, TaskStatus> = {
  'pending': 'pending',
  'planning': 'planning',
  'in-progress': 'in-progress',
  'waiting': 'waiting-approval',
  'completed': 'completed',
  'failed': 'failed',
}

interface UndoOperation {
  taskId: string
  originalStatus: TaskStatus
  newStatus: TaskStatus
  timestamp: number
}

interface UseKanbanDragDropProps {
  columnData: Record<string, { tasks: Task[]; total: number }>
  setColumnData: React.Dispatch<React.SetStateAction<Record<string, { tasks: Task[]; total: number }>>>
  onError?: (error: string) => void
  onSuccess?: (message: string) => void
}

export function useKanbanDragDrop({
  columnData,
  setColumnData,
  onError,
  onSuccess
}: UseKanbanDragDropProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const undoStackRef = useRef<UndoOperation[]>([])
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Check if a status transition is allowed
  const isTransitionAllowed = useCallback((fromStatus: TaskStatus, toStatus: TaskStatus): boolean => {
    // Allow same status (for reordering within column)
    if (fromStatus === toStatus) return true

    const allowedTransitions = STATUS_TRANSITIONS[fromStatus] || []
    return allowedTransitions.includes(toStatus)
  }, [])

  // Find the column ID for a given task
  const findColumnForTask = useCallback((taskId: string): string | null => {
    for (const [columnId, data] of Object.entries(columnData)) {
      if (data.tasks.some(task => task.id === taskId)) {
        return columnId
      }
    }
    return null
  }, [columnData])

  // Optimistically update task status in local state
  const updateTaskStatusOptimistic = useCallback((taskId: string, newStatus: TaskStatus, targetColumnId: string) => {
    setColumnData(prev => {
      const newData = { ...prev }

      // Find and remove task from current column
      let task: Task | null = null
      for (const [columnId, data] of Object.entries(newData)) {
        const taskIndex = data.tasks.findIndex(t => t.id === taskId)
        if (taskIndex !== -1) {
          task = data.tasks[taskIndex]
          newData[columnId] = {
            ...data,
            tasks: data.tasks.filter(t => t.id !== taskId),
            total: Math.max(0, data.total - 1)
          }
          break
        }
      }

      // Add task to target column with updated status
      if (task && newData[targetColumnId]) {
        const updatedTask = { ...task, status: newStatus, updatedAt: new Date() }
        newData[targetColumnId] = {
          ...newData[targetColumnId],
          tasks: [updatedTask, ...newData[targetColumnId].tasks],
          total: newData[targetColumnId].total + 1
        }
      }

      return newData
    })
  }, [setColumnData])

  // Revert optimistic update
  const revertOptimisticUpdate = useCallback((taskId: string, originalStatus: TaskStatus, originalColumnId: string) => {
    setColumnData(prev => {
      const newData = { ...prev }

      // Find and remove task from current column
      let task: Task | null = null
      for (const [columnId, data] of Object.entries(newData)) {
        const taskIndex = data.tasks.findIndex(t => t.id === taskId)
        if (taskIndex !== -1) {
          task = data.tasks[taskIndex]
          newData[columnId] = {
            ...data,
            tasks: data.tasks.filter(t => t.id !== taskId),
            total: Math.max(0, data.total - 1)
          }
          break
        }
      }

      // Restore task to original column with original status
      if (task && newData[originalColumnId]) {
        const revertedTask = { ...task, status: originalStatus }
        newData[originalColumnId] = {
          ...newData[originalColumnId],
          tasks: [...newData[originalColumnId].tasks, revertedTask],
          total: newData[originalColumnId].total + 1
        }
      }

      return newData
    })
  }, [setColumnData])

  // Persist status change to API
  const persistStatusChange = useCallback(async (taskId: string, newStatus: TaskStatus): Promise<boolean> => {
    try {
      await apiClient.updateTaskStatus(taskId, {
        status: newStatus,
        message: 'Status updated via kanban drag-and-drop'
      })
      return true
    } catch (error) {
      console.error('Failed to update task status:', error)
      return false
    }
  }, [])

  // Undo the last operation
  const undoLastOperation = useCallback(async () => {
    const lastOperation = undoStackRef.current.pop()
    if (!lastOperation) return

    const { taskId, originalStatus, newStatus } = lastOperation
    const originalColumnId = Object.keys(COLUMN_TO_STATUS).find(
      colId => COLUMN_TO_STATUS[colId] === originalStatus
    )

    if (!originalColumnId) return

    // Clear any pending timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current)
      undoTimeoutRef.current = null
    }

    setIsUpdating(true)

    try {
      // Revert in API first
      const success = await persistStatusChange(taskId, originalStatus)

      if (success) {
        // Revert optimistic update
        revertOptimisticUpdate(taskId, originalStatus, originalColumnId)
        onSuccess?.('Task status reverted successfully')
      } else {
        // Put operation back if API call failed
        undoStackRef.current.push(lastOperation)
        onError?.('Failed to undo status change')
      }
    } catch (error) {
      // Put operation back if something went wrong
      undoStackRef.current.push(lastOperation)
      onError?.('Failed to undo status change')
    } finally {
      setIsUpdating(false)
    }
  }, [persistStatusChange, revertOptimisticUpdate, onError, onSuccess])

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const taskId = event.active.id as string

    // Find the task being dragged
    for (const data of Object.values(columnData)) {
      const task = data.tasks.find(t => t.id === taskId)
      if (task) {
        setDraggedTask(task)
        break
      }
    }
  }, [columnData])

  // Handle drag over (for visual feedback)
  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Could add visual feedback here if needed
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setDraggedTask(null)

    if (!over || !draggedTask) return

    const taskId = active.id as string
    const targetColumnId = over.id as string
    const targetStatus = COLUMN_TO_STATUS[targetColumnId]
    const currentStatus = draggedTask.status
    const currentColumnId = findColumnForTask(taskId)

    // No-op if dropped in same column
    if (targetColumnId === currentColumnId) return

    // Check if transition is allowed
    if (!targetStatus || !isTransitionAllowed(currentStatus, targetStatus)) {
      onError?.(`Cannot move task from "${currentStatus}" to "${targetStatus}". Invalid transition.`)
      return
    }

    setIsUpdating(true)

    try {
      // Apply optimistic update immediately
      updateTaskStatusOptimistic(taskId, targetStatus, targetColumnId)

      // Persist to API
      const success = await persistStatusChange(taskId, targetStatus)

      if (success) {
        // Add to undo stack
        undoStackRef.current.push({
          taskId,
          originalStatus: currentStatus,
          newStatus: targetStatus,
          timestamp: Date.now()
        })

        // Set timeout to auto-clear undo option after 10 seconds
        if (undoTimeoutRef.current) {
          clearTimeout(undoTimeoutRef.current)
        }
        undoTimeoutRef.current = setTimeout(() => {
          undoStackRef.current = undoStackRef.current.filter(
            op => Date.now() - op.timestamp < 10000
          )
        }, 10000)

        onSuccess?.(`Task moved to "${targetStatus}" successfully`)
      } else {
        // Revert optimistic update if API call failed
        if (currentColumnId) {
          revertOptimisticUpdate(taskId, currentStatus, currentColumnId)
        }
        onError?.('Failed to update task status')
      }
    } catch (error) {
      // Revert optimistic update if something went wrong
      if (currentColumnId) {
        revertOptimisticUpdate(taskId, currentStatus, currentColumnId)
      }
      onError?.('Failed to update task status')
    } finally {
      setIsUpdating(false)
    }
  }, [
    draggedTask,
    findColumnForTask,
    isTransitionAllowed,
    updateTaskStatusOptimistic,
    persistStatusChange,
    revertOptimisticUpdate,
    onError,
    onSuccess
  ])

  // Check if there are any operations that can be undone
  const canUndo = undoStackRef.current.length > 0

  return {
    draggedTask,
    isUpdating,
    canUndo,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    undoLastOperation,
    isTransitionAllowed,
  }
}