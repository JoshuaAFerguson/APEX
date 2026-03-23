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
  EMPTY_PANEL_STATE_MAP
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

      // If registering with maximized state, ensure mutual exclusivity
      const newMaximizedPanelId = initialState === 'maximized'
        ? panelId
        : state.maximizedPanelId

      return {
        panels: newPanels,
        maximizedPanelId: newMaximizedPanelId,
      }
    }

    case 'UNREGISTER': {
      const { panelId } = action
      if (!state.panels.has(panelId)) {
        return state // Panel not registered
      }

      const newPanels = new Map(state.panels)
      newPanels.delete(panelId)

      const newMaximizedPanelId = state.maximizedPanelId === panelId
        ? null
        : state.maximizedPanelId

      return {
        panels: newPanels,
        maximizedPanelId: newMaximizedPanelId,
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
  } = options

  // Initialize state with any provided initial states
  const initialStateMap = useMemo(() => {
    try {
      return recordToPanelStateMap(initialStates)
    } catch (error) {
      if (debug) {
        console.warn('Invalid initial states, using empty state:', error)
      }
      return EMPTY_PANEL_STATE_MAP
    }
  }, [initialStates, debug])

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

  const maximizedPanelId = isControlled
    ? Object.entries(controlledStates!).find(([, panelState]) => panelState === 'maximized')?.[0] || null
    : state.maximizedPanelId

  const hasMaximizedPanel = maximizedPanelId !== null

  const panelCount = isControlled
    ? Object.keys(controlledStates!).length
    : state.panels.size

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
  }
}

export default useAgentTerminalPanelState