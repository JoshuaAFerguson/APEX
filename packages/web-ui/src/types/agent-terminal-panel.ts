/**
 * Agent Terminal Panel State Types
 *
 * Type definitions for managing minimize/maximize state of agent terminal panels.
 * Supports both controlled and uncontrolled patterns with mutual exclusivity
 * (only one panel can be maximized at a time).
 *
 * @packageDocumentation
 */

// ============================================================================
// Panel State Types
// ============================================================================

/**
 * Possible display states for a terminal panel
 */
export type PanelDisplayState = 'normal' | 'minimized' | 'maximized'

/**
 * State for a single panel
 */
export interface PanelState {
  /** Unique identifier for the panel */
  panelId: string
  /** Current display state */
  displayState: PanelDisplayState
  /** Previous state (for restore operations) */
  previousState: PanelDisplayState
  /** Timestamp of last state change */
  lastChanged: Date
}

/**
 * Complete state for all panels (internal representation)
 */
export interface AgentTerminalPanelStateMap {
  /** Map of panel ID to panel state */
  panels: Map<string, PanelState>
  /** ID of the currently maximized panel (null if none) */
  maximizedPanelId: string | null
}

/**
 * Default panel state factory
 */
export function createDefaultPanelState(
  panelId: string,
  initialState: PanelDisplayState = 'normal'
): PanelState {
  return {
    panelId,
    displayState: initialState,
    previousState: 'normal',
    lastChanged: new Date(),
  }
}

/**
 * Empty state constant
 */
export const EMPTY_PANEL_STATE_MAP: AgentTerminalPanelStateMap = {
  panels: new Map(),
  maximizedPanelId: null,
}

// ============================================================================
// Hook Options and Return Types
// ============================================================================

/**
 * Options for the useAgentTerminalPanelState hook
 */
export interface UseAgentTerminalPanelStateOptions {
  /**
   * Initial panel states (uncontrolled pattern)
   * Keys are panel IDs, values are initial display states
   */
  initialStates?: Record<string, PanelDisplayState>

  /**
   * Controlled panel states (controlled pattern)
   * When provided, the hook becomes controlled and internal state
   * is synchronized with these values
   */
  controlledStates?: Record<string, PanelDisplayState>

  /**
   * Callback when state changes (required for controlled pattern)
   * Called with the panel ID that changed, its new state, and all current states
   */
  onStateChange?: (
    panelId: string,
    newState: PanelDisplayState,
    allStates: Record<string, PanelDisplayState>
  ) => void

  /**
   * Callback when a panel is maximized
   * Useful for notifications about mutual exclusivity
   */
  onMaximize?: (panelId: string, previousMaximizedId: string | null) => void

  /**
   * Callback when a panel is minimized
   */
  onMinimize?: (panelId: string) => void

  /**
   * Callback when a panel is restored
   */
  onRestore?: (panelId: string, restoredState: PanelDisplayState) => void

  /**
   * Callback when all panels are restored
   */
  onRestoreAll?: () => void

  /**
   * Enable debug logging
   * @default false
   */
  debug?: boolean
}

/**
 * Return type for the useAgentTerminalPanelState hook
 */
export interface UseAgentTerminalPanelStateReturn {
  /**
   * Minimize a panel
   * Stores the current state as previousState for later restoration
   * @param panelId - The panel to minimize
   */
  minimize: (panelId: string) => void

  /**
   * Maximize a panel
   * Will automatically restore any currently maximized panel to normal state
   * (mutual exclusivity constraint)
   * @param panelId - The panel to maximize
   */
  maximize: (panelId: string) => void

  /**
   * Restore a panel to its previous state
   * If no previous state exists, restores to 'normal'
   * @param panelId - The panel to restore
   */
  restore: (panelId: string) => void

  /**
   * Restore all panels to normal state
   * Clears all previous states and maximized panel tracking
   */
  restoreAll: () => void

  /**
   * Get the current state of a specific panel
   * @param panelId - The panel to query
   * @returns The panel's display state, or 'normal' if not tracked
   */
  getPanelState: (panelId: string) => PanelDisplayState

  /**
   * Get all panel states as a record
   * Useful for serialization or controlled pattern sync
   */
  getAllStates: () => Record<string, PanelDisplayState>

  /**
   * The ID of the currently maximized panel
   * Returns null if no panel is maximized
   */
  maximizedPanelId: string | null

  /**
   * Check if any panel is currently maximized
   */
  hasMaximizedPanel: boolean

  /**
   * Register a new panel with the state manager
   * Creates an entry in the internal state
   * @param panelId - The panel to register
   * @param initialState - Initial state for the panel (default: 'normal')
   */
  registerPanel: (panelId: string, initialState?: PanelDisplayState) => void

  /**
   * Unregister a panel from the state manager
   * Removes the panel from internal state
   * If the panel was maximized, clears maximizedPanelId
   * @param panelId - The panel to unregister
   */
  unregisterPanel: (panelId: string) => void

  /**
   * Check if a panel is registered
   * @param panelId - The panel to check
   */
  isPanelRegistered: (panelId: string) => boolean

  /**
   * Get the count of registered panels
   */
  panelCount: number
}

// ============================================================================
// Reducer Action Types
// ============================================================================

/**
 * Action types for the panel state reducer
 */
export type PanelStateAction =
  | { type: 'MINIMIZE'; panelId: string }
  | { type: 'MAXIMIZE'; panelId: string }
  | { type: 'RESTORE'; panelId: string }
  | { type: 'RESTORE_ALL' }
  | { type: 'REGISTER'; panelId: string; initialState?: PanelDisplayState }
  | { type: 'UNREGISTER'; panelId: string }
  | { type: 'SYNC_CONTROLLED'; states: Record<string, PanelDisplayState> }

// ============================================================================
// Validation and Type Guards
// ============================================================================

/**
 * Valid panel display states
 */
export const VALID_PANEL_DISPLAY_STATES: readonly PanelDisplayState[] = [
  'normal',
  'minimized',
  'maximized',
]

/**
 * Type guard for PanelDisplayState
 */
export function isPanelDisplayState(value: unknown): value is PanelDisplayState {
  return (
    typeof value === 'string' &&
    VALID_PANEL_DISPLAY_STATES.includes(value as PanelDisplayState)
  )
}

/**
 * Type guard for PanelState
 */
export function isPanelState(value: unknown): value is PanelState {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.panelId === 'string' &&
    isPanelDisplayState(v.displayState) &&
    isPanelDisplayState(v.previousState) &&
    v.lastChanged instanceof Date
  )
}

/**
 * Validate a record of panel states
 */
export function validatePanelStates(
  states: unknown
): states is Record<string, PanelDisplayState> {
  if (!states || typeof states !== 'object') return false
  const s = states as Record<string, unknown>
  return Object.entries(s).every(
    ([key, value]) => typeof key === 'string' && isPanelDisplayState(value)
  )
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert panel state map to a simple record
 */
export function panelStateMapToRecord(
  stateMap: AgentTerminalPanelStateMap
): Record<string, PanelDisplayState> {
  const record: Record<string, PanelDisplayState> = {}
  stateMap.panels.forEach((state, panelId) => {
    record[panelId] = state.displayState
  })
  return record
}

/**
 * Convert a record to panel state map
 *
 * @throws Error if multiple panels have displayState === 'maximized'
 * (violates mutual exclusivity constraint)
 */
export function recordToPanelStateMap(
  record: Record<string, PanelDisplayState>
): AgentTerminalPanelStateMap {
  const panels = new Map<string, PanelState>()
  let maximizedPanelId: string | null = null
  let maximizedCount = 0

  Object.entries(record).forEach(([panelId, displayState]) => {
    panels.set(panelId, createDefaultPanelState(panelId, displayState))
    if (displayState === 'maximized') {
      maximizedPanelId = panelId
      maximizedCount++
    }
  })

  if (maximizedCount > 1) {
    throw new Error(
      `Invalid state: multiple panels are maximized. Only one panel can be maximized at a time.`
    )
  }

  return { panels, maximizedPanelId }
}

/**
 * Merge two panel state records, with second taking precedence
 */
export function mergePanelStates(
  base: Record<string, PanelDisplayState>,
  override: Record<string, PanelDisplayState>
): Record<string, PanelDisplayState> {
  return { ...base, ...override }
}
