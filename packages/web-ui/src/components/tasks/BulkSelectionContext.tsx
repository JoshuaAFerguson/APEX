'use client'

import React, { createContext, useContext, useCallback, useReducer } from 'react'
import type {
  BulkSelectionState,
  BulkSelectionContextValue,
  SelectionMode,
} from '@/types/bulk-operations'

/**
 * Action types for the bulk selection reducer
 */
type BulkSelectionAction =
  | { type: 'TOGGLE_TASK'; payload: string }
  | { type: 'SELECT_ALL'; payload: string[] }
  | { type: 'DESELECT_ALL' }
  | { type: 'SELECT_TASKS'; payload: string[] }
  | { type: 'DESELECT_TASKS'; payload: string[] }

/**
 * Reducer to manage bulk selection state
 */
function bulkSelectionReducer(
  state: BulkSelectionState,
  action: BulkSelectionAction
): BulkSelectionState {
  switch (action.type) {
    case 'TOGGLE_TASK': {
      const newSelectedTaskIds = new Set(state.selectedTaskIds)
      if (newSelectedTaskIds.has(action.payload)) {
        newSelectedTaskIds.delete(action.payload)
      } else {
        newSelectedTaskIds.add(action.payload)
      }
      return {
        ...state,
        selectedTaskIds: newSelectedTaskIds,
        ...calculateSelectionMode(newSelectedTaskIds, []),
      }
    }

    case 'SELECT_ALL': {
      const newSelectedTaskIds = new Set(action.payload)
      return {
        ...state,
        selectedTaskIds: newSelectedTaskIds,
        ...calculateSelectionMode(newSelectedTaskIds, action.payload),
      }
    }

    case 'DESELECT_ALL': {
      return {
        ...state,
        selectedTaskIds: new Set(),
        selectionMode: 'none',
        isSelectAllChecked: false,
        isIndeterminate: false,
      }
    }

    case 'SELECT_TASKS': {
      const newSelectedTaskIds = new Set([...state.selectedTaskIds, ...action.payload])
      return {
        ...state,
        selectedTaskIds: newSelectedTaskIds,
        ...calculateSelectionMode(newSelectedTaskIds, []),
      }
    }

    case 'DESELECT_TASKS': {
      const newSelectedTaskIds = new Set(state.selectedTaskIds)
      action.payload.forEach(taskId => newSelectedTaskIds.delete(taskId))
      return {
        ...state,
        selectedTaskIds: newSelectedTaskIds,
        ...calculateSelectionMode(newSelectedTaskIds, []),
      }
    }

    default:
      return state
  }
}

/**
 * Calculate selection mode based on selected tasks and visible tasks
 */
function calculateSelectionMode(
  selectedTaskIds: Set<string>,
  visibleTaskIds: string[]
): {
  selectionMode: SelectionMode
  isSelectAllChecked: boolean
  isIndeterminate: boolean
} {
  const selectedCount = selectedTaskIds.size
  const visibleCount = visibleTaskIds.length

  if (selectedCount === 0) {
    return {
      selectionMode: 'none',
      isSelectAllChecked: false,
      isIndeterminate: false,
    }
  }

  if (visibleCount > 0) {
    const visibleSelectedCount = visibleTaskIds.filter(id => selectedTaskIds.has(id)).length
    if (visibleSelectedCount === visibleCount) {
      return {
        selectionMode: 'all',
        isSelectAllChecked: true,
        isIndeterminate: false,
      }
    }
    if (visibleSelectedCount > 0) {
      return {
        selectionMode: 'some',
        isSelectAllChecked: false,
        isIndeterminate: true,
      }
    }
  }

  return {
    selectionMode: 'some',
    isSelectAllChecked: false,
    isIndeterminate: false,
  }
}

/**
 * Initial state for bulk selection
 */
const initialState: BulkSelectionState = {
  selectedTaskIds: new Set(),
  selectionMode: 'none',
  isSelectAllChecked: false,
  isIndeterminate: false,
}

/**
 * Context for bulk task selection state
 */
const BulkSelectionContext = createContext<BulkSelectionContextValue | null>(null)

/**
 * Props for BulkSelectionProvider
 */
export interface BulkSelectionProviderProps {
  children: React.ReactNode
  /** Optional initial selection */
  initialSelection?: string[]
}

/**
 * Provider component for bulk selection state
 * Manages selection state across TaskCard components and provides actions
 * for selection manipulation.
 */
export function BulkSelectionProvider({
  children,
  initialSelection = [],
}: BulkSelectionProviderProps) {
  const [state, dispatch] = useReducer(bulkSelectionReducer, {
    ...initialState,
    selectedTaskIds: new Set(initialSelection),
  })

  // Actions
  const toggleTaskSelection = useCallback((taskId: string) => {
    dispatch({ type: 'TOGGLE_TASK', payload: taskId })
  }, [])

  const selectAll = useCallback((taskIds: string[]) => {
    dispatch({ type: 'SELECT_ALL', payload: taskIds })
  }, [])

  const deselectAll = useCallback(() => {
    dispatch({ type: 'DESELECT_ALL' })
  }, [])

  const selectTasks = useCallback((taskIds: string[]) => {
    dispatch({ type: 'SELECT_TASKS', payload: taskIds })
  }, [])

  const deselectTasks = useCallback((taskIds: string[]) => {
    dispatch({ type: 'DESELECT_TASKS', payload: taskIds })
  }, [])

  // Getters
  const isSelected = useCallback((taskId: string): boolean => {
    return state.selectedTaskIds.has(taskId)
  }, [state.selectedTaskIds])

  const getSelectedTasks = useCallback((): string[] => {
    return Array.from(state.selectedTaskIds)
  }, [state.selectedTaskIds])

  const getSelectedCount = useCallback((): number => {
    return state.selectedTaskIds.size
  }, [state.selectedTaskIds])

  const contextValue: BulkSelectionContextValue = {
    state,
    toggleTaskSelection,
    selectAll,
    deselectAll,
    selectTasks,
    deselectTasks,
    isSelected,
    getSelectedTasks,
    getSelectedCount,
  }

  return (
    <BulkSelectionContext.Provider value={contextValue}>
      {children}
    </BulkSelectionContext.Provider>
  )
}

/**
 * Hook to access bulk selection context
 * Must be used within a BulkSelectionProvider
 */
export function useBulkSelection(): BulkSelectionContextValue {
  const context = useContext(BulkSelectionContext)
  if (!context) {
    throw new Error('useBulkSelection must be used within a BulkSelectionProvider')
  }
  return context
}

/**
 * Hook to check if bulk selection is available
 * Returns null if not within a BulkSelectionProvider, otherwise returns the context
 */
export function useBulkSelectionOptional(): BulkSelectionContextValue | null {
  return useContext(BulkSelectionContext)
}