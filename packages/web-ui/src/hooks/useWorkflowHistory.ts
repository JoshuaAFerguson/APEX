/**
 * useWorkflowHistory Hook
 *
 * Provides undo/redo functionality for the workflow editor.
 * Maintains a history stack of workflow states with configurable
 * maximum size and supports both imperative and functional updates.
 */

import { useCallback, useRef, useState } from 'react'
import type { UseWorkflowHistoryOptions, UseWorkflowHistoryReturn } from '@/types/workflow-editor'

const DEFAULT_MAX_HISTORY_SIZE = 50

/**
 * Hook for managing undo/redo history of workflow states
 *
 * @template T - The type of state being tracked
 * @param options - Configuration options
 * @returns History management functions and state
 */
export function useWorkflowHistory<T>({
  initialState,
  maxHistorySize = DEFAULT_MAX_HISTORY_SIZE,
}: UseWorkflowHistoryOptions<T>): UseWorkflowHistoryReturn<T> {
  // Current state
  const [state, setStateInternal] = useState<T>(initialState)

  // History stacks
  const undoStack = useRef<T[]>([])
  const redoStack = useRef<T[]>([])

  // Track if we're in the middle of an undo/redo operation
  const isHistoryOperation = useRef(false)

  /**
   * Set the state and update history
   */
  const setState = useCallback(
    (newState: T | ((prev: T) => T)) => {
      // Don't add to history if this is part of an undo/redo operation
      if (isHistoryOperation.current) {
        setStateInternal(newState)
        return
      }

      const resolvedState = typeof newState === 'function'
        ? (newState as (prev: T) => T)(state)
        : newState

      // Don't add to history if state hasn't actually changed
      if (JSON.stringify(resolvedState) === JSON.stringify(state)) {
        return
      }

      // Add current state to undo stack
      undoStack.current.push(state)

      // Limit undo stack size
      if (undoStack.current.length > maxHistorySize) {
        undoStack.current.shift()
      }

      // Clear redo stack when new state is set
      redoStack.current = []

      // Update state
      setStateInternal(resolvedState)
    },
    [state, maxHistorySize]
  )

  /**
   * Undo the last operation
   */
  const undo = useCallback(() => {
    if (undoStack.current.length === 0) {
      return
    }

    isHistoryOperation.current = true

    // Move current state to redo stack
    redoStack.current.push(state)

    // Restore previous state from undo stack
    const previousState = undoStack.current.pop()!
    setStateInternal(previousState)

    isHistoryOperation.current = false
  }, [state])

  /**
   * Redo the last undone operation
   */
  const redo = useCallback(() => {
    if (redoStack.current.length === 0) {
      return
    }

    isHistoryOperation.current = true

    // Move current state to undo stack
    undoStack.current.push(state)

    // Restore next state from redo stack
    const nextState = redoStack.current.pop()!
    setStateInternal(nextState)

    isHistoryOperation.current = false
  }, [state])

  /**
   * Clear all history
   */
  const clear = useCallback(() => {
    undoStack.current = []
    redoStack.current = []
  }, [])

  /**
   * Check if undo is available
   */
  const canUndo = undoStack.current.length > 0

  /**
   * Check if redo is available
   */
  const canRedo = redoStack.current.length > 0

  return {
    state,
    setState,
    undo,
    redo,
    canUndo,
    canRedo,
    clear,
  }
}