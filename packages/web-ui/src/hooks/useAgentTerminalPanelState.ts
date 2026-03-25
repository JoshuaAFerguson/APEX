'use client'

import { useState, useCallback, useMemo, useReducer, useRef, useEffect } from 'react'
import type {
  UseAgentTerminalPanelStateOptions,
  UseAgentTerminalPanelStateReturn,
  PanelStateAction,
  AgentTerminalPanelStateMap,
  PanelDisplayState,
  PanelState,
} from '@/types/agent-terminal-panel'
import {
  createDefaultPanelState,
  panelStateMapToRecord,
  recordToPanelStateMap,
  EMPTY_PANEL_STATE_MAP,
  calculateNextFocusIndex
} from '@/types/agent-terminal-panel'

/**
 * Reducer for managing panel state
 */
function panelStateReducer(
  state: AgentTerminalPanelStateMap,
  action: PanelStateAction
): AgentTerminalPanelStateMap {
  switch (action.type) {
    case 'REGISTER': {
      const { panelId, initialState = 'normal' } = action
      if (state.panels.has(panelId)) {
        return state // Panel already registered
      }

      const newPanels = new Map(state.panels)
      newPanels.set(panelId, createDefaultPanelState(panelId, initialState))

      // Add to panel order if not already there
      const newPanelOrder = state.panelOrder.includes(panelId)
        ? state.panelOrder
        : [...state.panelOrder, panelId]

      // If registering with maximized state, ensure mutual exclusivity
      const newMaximizedPanelId = initialState === 'maximized'
        ? panelId
        : state.maximizedPanelId

      return {
        ...state,
        panels: newPanels,
        maximizedPanelId: newMaximizedPanelId,
        panelOrder: newPanelOrder,
      }
    }

    case 'UNREGISTER': {
      const { panelId } = action
      if (!state.panels.has(panelId)) {
        return state // Panel not registered
      }

      const newPanels = new Map(state.panels)
      newPanels.delete(panelId)

      // Remove from panel order
      const newPanelOrder = state.panelOrder.filter(id => id !== panelId)

      const newMaximizedPanelId = state.maximizedPanelId === panelId
        ? null
        : state.maximizedPanelId

      const newFocusedPanelId = state.focusedPanelId === panelId
        ? null
        : state.focusedPanelId

      return {
        panels: newPanels,
        maximizedPanelId: newMaximizedPanelId,
        focusedPanelId: newFocusedPanelId,
        panelOrder: newPanelOrder,
      }
    }

    case 'MINIMIZE': {
      const { panelId } = action
      const currentPanel = state.panels.get(panelId)
      if (!currentPanel) {
        return state // Panel not found
      }

      const newPanels = new Map(state.panels)
      newPanels.set(panelId, {
        ...currentPanel,
        previousState: currentPanel.displayState,
        displayState: 'minimized',
        lastChanged: new Date(),
      })

      const newMaximizedPanelId = state.maximizedPanelId === panelId
        ? null
        : state.maximizedPanelId

      return {
        panels: newPanels,
        maximizedPanelId: newMaximizedPanelId,
        focusedPanelId: state.focusedPanelId,
        panelOrder: state.panelOrder,
      }
    }

    case 'MAXIMIZE': {
      const { panelId } = action
      const currentPanel = state.panels.get(panelId)
      if (!currentPanel) {
        return state // Panel not found
      }

      const newPanels = new Map(state.panels)

      // First restore currently maximized panel if any
      if (state.maximizedPanelId && state.maximizedPanelId !== panelId) {
        const currentMaximized = newPanels.get(state.maximizedPanelId)
        if (currentMaximized) {
          newPanels.set(state.maximizedPanelId, {
            ...currentMaximized,
            previousState: currentMaximized.displayState,
            displayState: 'normal',
            lastChanged: new Date(),
          })
        }
      }

      // Then maximize the target panel
      newPanels.set(panelId, {
        ...currentPanel,
        previousState: currentPanel.displayState,
        displayState: 'maximized',
        lastChanged: new Date(),
      })

      return {
        panels: newPanels,
        maximizedPanelId: panelId,
        focusedPanelId: state.focusedPanelId,
        panelOrder: state.panelOrder,
      }
    }

    case 'RESTORE': {
      const { panelId } = action
      const currentPanel = state.panels.get(panelId)
      if (!currentPanel) {
        return state // Panel not found
      }

      const newPanels = new Map(state.panels)
      newPanels.set(panelId, {
        ...currentPanel,
        displayState: currentPanel.previousState === 'maximized' ? 'normal' : currentPanel.previousState,
        previousState: 'normal',
        lastChanged: new Date(),
      })

      const newMaximizedPanelId = state.maximizedPanelId === panelId
        ? null
        : state.maximizedPanelId

      return {
        ...state,
        panels: newPanels,
        maximizedPanelId: newMaximizedPanelId,
      }
    }

    case 'RESTORE_ALL': {
      const newPanels = new Map<string, PanelState>()

      state.panels.forEach((panel, panelId) => {
        newPanels.set(panelId, {
          ...panel,
          displayState: 'normal',
          previousState: 'normal',
          lastChanged: new Date(),
        })
      })

      return {
        ...state,
        panels: newPanels,
        maximizedPanelId: null,
      }
    }

    case 'SYNC_CONTROLLED': {
      try {
        return recordToPanelStateMap(action.states)
      } catch (error) {
        console.warn('Failed to sync controlled states:', error)
        return state
      }
    }

    case 'FOCUS_NEXT': {
      const currentIndex = state.focusedPanelId
        ? state.panelOrder.indexOf(state.focusedPanelId)
        : -1
      const nextIndex = calculateNextFocusIndex(currentIndex, state.panelOrder.length, 'next')

      return {
        ...state,
        focusedPanelId: nextIndex >= 0 ? state.panelOrder[nextIndex] : null,
      }
    }

    case 'FOCUS_PREVIOUS': {
      const currentIndex = state.focusedPanelId
        ? state.panelOrder.indexOf(state.focusedPanelId)
        : -1
      const prevIndex = calculateNextFocusIndex(currentIndex, state.panelOrder.length, 'previous')

      return {
        ...state,
        focusedPanelId: prevIndex >= 0 ? state.panelOrder[prevIndex] : null,
      }
    }

    case 'FOCUS_PANEL': {
      const { panelId } = action
      if (state.panelOrder.includes(panelId)) {
        return {
          ...state,
          focusedPanelId: panelId,
        }
      }
      return state
    }

    case 'CLEAR_FOCUS': {
      return {
        ...state,
        focusedPanelId: null,
      }
    }

    case 'SET_PANEL_ORDER': {
      const { panelIds } = action
      const newState = {
        ...state,
        panelOrder: [...panelIds],
      }

      // Clear focus if currently focused panel is not in the new order
      if (state.focusedPanelId && !panelIds.includes(state.focusedPanelId)) {
        newState.focusedPanelId = null
      }

      return newState
    }

    default:
      return state
  }
}

/**
 * Custom hook for managing agent terminal panel state
 *
 * Supports three display states: minimized, normal, maximized
 * with mutual exclusivity (only one panel can be maximized at a time).
 *
 * Supports both controlled and uncontrolled patterns.
 */
export function useAgentTerminalPanelState(
  options: UseAgentTerminalPanelStateOptions = {}
): UseAgentTerminalPanelStateReturn {
  const {
    initialStates = {},
    controlledStates,
    onStateChange,
    onMaximize,
    onMinimize,
    onRestore,
    onRestoreAll,
    debug = false,
    initialPanelOrder = [],
    initialFocusedPanelId = null,
    onFocusChange,
  } = options

  // Initialize state with any provided initial states
  const initialStateMap = useMemo(() => {
    try {
      const baseState = recordToPanelStateMap(initialStates)

      // Set up focus and panel order
      const panelOrder = initialPanelOrder.length > 0
        ? initialPanelOrder
        : Object.keys(initialStates)

      const focusedPanelId = initialFocusedPanelId && panelOrder.includes(initialFocusedPanelId)
        ? initialFocusedPanelId
        : null

      return {
        ...baseState,
        panelOrder,
        focusedPanelId,
      }
    } catch (error) {
      if (debug) {
        console.warn('Invalid initial states, using empty state:', error)
      }
      return {
        ...EMPTY_PANEL_STATE_MAP,
        panelOrder: [...initialPanelOrder],
        focusedPanelId: initialFocusedPanelId && initialPanelOrder.includes(initialFocusedPanelId)
          ? initialFocusedPanelId
          : null,
      }
    }
  }, [initialStates, debug, initialPanelOrder, initialFocusedPanelId])

  const [state, dispatch] = useReducer(panelStateReducer, initialStateMap)

  // Track if we're in controlled mode
  const isControlled = controlledStates !== undefined
  const prevControlledStatesRef = useRef(controlledStates)

  // Sync controlled states when they change
  useEffect(() => {
    if (isControlled && controlledStates !== prevControlledStatesRef.current) {
      dispatch({ type: 'SYNC_CONTROLLED', states: controlledStates })
      prevControlledStatesRef.current = controlledStates
    }
  }, [isControlled, controlledStates])

  // Get current states for external consumers
  const currentStates = useMemo(() => {
    return isControlled ? controlledStates! : panelStateMapToRecord(state)
  }, [isControlled, controlledStates, state])

  // Helper to call onStateChange if in controlled mode
  const notifyStateChange = useCallback((
    panelId: string,
    newState: PanelDisplayState
  ) => {
    if (isControlled && onStateChange) {
      onStateChange(panelId, newState, currentStates)
    }
  }, [isControlled, onStateChange, currentStates])

  const minimize = useCallback((panelId: string) => {
    if (debug) {
      console.log(`[useAgentTerminalPanelState] Minimizing panel: ${panelId}`)
    }

    if (!isControlled) {
      dispatch({ type: 'MINIMIZE', panelId })
    }

    notifyStateChange(panelId, 'minimized')
    onMinimize?.(panelId)
  }, [isControlled, notifyStateChange, onMinimize, debug])

  const maximize = useCallback((panelId: string) => {
    if (debug) {
      console.log(`[useAgentTerminalPanelState] Maximizing panel: ${panelId}`)
    }

    const previousMaximizedId = isControlled
      ? Object.entries(controlledStates!).find(([, state]) => state === 'maximized')?.[0] || null
      : state.maximizedPanelId

    if (!isControlled) {
      dispatch({ type: 'MAXIMIZE', panelId })
    }

    notifyStateChange(panelId, 'maximized')
    onMaximize?.(panelId, previousMaximizedId)
  }, [isControlled, controlledStates, state.maximizedPanelId, notifyStateChange, onMaximize, debug])

  const restore = useCallback((panelId: string) => {
    if (debug) {
      console.log(`[useAgentTerminalPanelState] Restoring panel: ${panelId}`)
    }

    const currentPanel = isControlled
      ? null // Can't determine previous state in controlled mode
      : state.panels.get(panelId)

    const restoredState = currentPanel?.previousState === 'maximized' ? 'normal' : (currentPanel?.previousState || 'normal')

    if (!isControlled) {
      dispatch({ type: 'RESTORE', panelId })
    }

    notifyStateChange(panelId, restoredState)
    onRestore?.(panelId, restoredState)
  }, [isControlled, state.panels, notifyStateChange, onRestore, debug])

  const restoreAll = useCallback(() => {
    if (debug) {
      console.log('[useAgentTerminalPanelState] Restoring all panels')
    }

    if (!isControlled) {
      dispatch({ type: 'RESTORE_ALL' })
    }

    // Notify for each non-normal panel
    Object.entries(currentStates).forEach(([panelId, panelState]) => {
      if (panelState !== 'normal') {
        notifyStateChange(panelId, 'normal')
      }
    })

    onRestoreAll?.()
  }, [isControlled, currentStates, notifyStateChange, onRestoreAll, debug])

  const getPanelState = useCallback((panelId: string): PanelDisplayState => {
    return currentStates[panelId] || 'normal'
  }, [currentStates])

  const getAllStates = useCallback(() => {
    return { ...currentStates }
  }, [currentStates])

  const registerPanel = useCallback((panelId: string, initialState: PanelDisplayState = 'normal') => {
    if (debug) {
      console.log(`[useAgentTerminalPanelState] Registering panel: ${panelId} with state: ${initialState}`)
    }

    if (!isControlled) {
      dispatch({ type: 'REGISTER', panelId, initialState })
    }
  }, [isControlled, debug])

  const unregisterPanel = useCallback((panelId: string) => {
    if (debug) {
      console.log(`[useAgentTerminalPanelState] Unregistering panel: ${panelId}`)
    }

    if (!isControlled) {
      dispatch({ type: 'UNREGISTER', panelId })
    }
  }, [isControlled, debug])

  const isPanelRegistered = useCallback((panelId: string): boolean => {
    return isControlled
      ? panelId in currentStates
      : state.panels.has(panelId)
  }, [isControlled, currentStates, state.panels])

  // Helper to call onFocusChange if provided
  const notifyFocusChange = useCallback((
    newFocusedPanelId: string | null,
    previousFocusedPanelId: string | null
  ) => {
    if (onFocusChange && newFocusedPanelId !== previousFocusedPanelId) {
      onFocusChange(newFocusedPanelId, previousFocusedPanelId)
    }
  }, [onFocusChange])

  const focusNext = useCallback(() => {
    if (debug) {
      console.log('[useAgentTerminalPanelState] Focusing next panel')
    }

    const previousFocusedPanelId = state.focusedPanelId
    const currentIndex = previousFocusedPanelId
      ? state.panelOrder.indexOf(previousFocusedPanelId)
      : -1
    const nextIndex = calculateNextFocusIndex(currentIndex, state.panelOrder.length, 'next')
    const nextPanelId = nextIndex >= 0 ? state.panelOrder[nextIndex] : null

    if (!isControlled) {
      dispatch({ type: 'FOCUS_NEXT' })
    }

    notifyFocusChange(nextPanelId, previousFocusedPanelId)
  }, [isControlled, state.focusedPanelId, state.panelOrder, notifyFocusChange, debug])

  const focusPrevious = useCallback(() => {
    if (debug) {
      console.log('[useAgentTerminalPanelState] Focusing previous panel')
    }

    const previousFocusedPanelId = state.focusedPanelId
    const currentIndex = previousFocusedPanelId
      ? state.panelOrder.indexOf(previousFocusedPanelId)
      : -1
    const prevIndex = calculateNextFocusIndex(currentIndex, state.panelOrder.length, 'previous')
    const prevPanelId = prevIndex >= 0 ? state.panelOrder[prevIndex] : null

    if (!isControlled) {
      dispatch({ type: 'FOCUS_PREVIOUS' })
    }

    notifyFocusChange(prevPanelId, previousFocusedPanelId)
  }, [isControlled, state.focusedPanelId, state.panelOrder, notifyFocusChange, debug])

  const focusPanel = useCallback((panelId: string) => {
    if (debug) {
      console.log(`[useAgentTerminalPanelState] Focusing panel: ${panelId}`)
    }

    const previousFocusedPanelId = state.focusedPanelId

    if (!isControlled) {
      dispatch({ type: 'FOCUS_PANEL', panelId })
    }

    notifyFocusChange(panelId, previousFocusedPanelId)
  }, [isControlled, state.focusedPanelId, notifyFocusChange, debug])

  const clearFocus = useCallback(() => {
    if (debug) {
      console.log('[useAgentTerminalPanelState] Clearing focus')
    }

    const previousFocusedPanelId = state.focusedPanelId

    if (!isControlled) {
      dispatch({ type: 'CLEAR_FOCUS' })
    }

    notifyFocusChange(null, previousFocusedPanelId)
  }, [isControlled, state.focusedPanelId, notifyFocusChange, debug])

  const isPanelFocused = useCallback((panelId: string): boolean => {
    return isControlled
      ? false // Focus state not supported in controlled mode yet
      : state.focusedPanelId === panelId
  }, [isControlled, state.focusedPanelId])

  const setPanelOrder = useCallback((panelIds: string[]) => {
    if (debug) {
      console.log(`[useAgentTerminalPanelState] Setting panel order:`, panelIds)
    }

    if (!isControlled) {
      dispatch({ type: 'SET_PANEL_ORDER', panelIds })
    }
  }, [isControlled, debug])

  const maximizedPanelId = isControlled
    ? Object.entries(controlledStates!).find(([, panelState]) => panelState === 'maximized')?.[0] || null
    : state.maximizedPanelId

  const hasMaximizedPanel = maximizedPanelId !== null

  const panelCount = isControlled
    ? Object.keys(controlledStates!).length
    : state.panels.size

  // Focus state
  const focusedPanelId = isControlled
    ? null // Focus tracking not yet supported in controlled mode
    : state.focusedPanelId

  const panelOrder = isControlled
    ? Object.keys(controlledStates!)
    : state.panelOrder

  const focusedIndex = useMemo(() => {
    if (!focusedPanelId || panelOrder.length === 0) return -1
    return panelOrder.indexOf(focusedPanelId)
  }, [focusedPanelId, panelOrder])

  return {
    minimize,
    maximize,
    restore,
    restoreAll,
    getPanelState,
    getAllStates,
    maximizedPanelId,
    hasMaximizedPanel,
    registerPanel,
    unregisterPanel,
    isPanelRegistered,
    panelCount,
    focusNext,
    focusPrevious,
    focusPanel,
    clearFocus,
    isPanelFocused,
    focusedPanelId,
    focusedIndex,
    panelOrder,
    setPanelOrder,
  }
}

export default useAgentTerminalPanelState