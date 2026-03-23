# ADR-007: useAgentTerminalPanelState Hook Architecture

## Status
Proposed

## Date
2024-03-22

## Context

The APEX web UI needs a hook to manage minimize/maximize state for agent terminal panels. This hook must support:

1. **Multiple Panel Management**: Track state for multiple terminal panels simultaneously
2. **Mutual Exclusivity**: Only one panel can be maximized at a time
3. **State Transitions**: Support minimize, maximize, restore, and restoreAll operations
4. **Controlled/Uncontrolled Patterns**: Allow both patterns for flexibility

## Decision

### Architecture Overview

We will implement `useAgentTerminalPanelState` as a custom React hook following established patterns in the codebase (see `useAgentMetrics`, `useWebSocketConnection`, `useParallelAgentView`).

### Panel State Model

```typescript
/**
 * Possible states for a terminal panel
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
 * Complete state for all panels
 */
export interface AgentTerminalPanelStateMap {
  /** Map of panel ID to panel state */
  panels: Map<string, PanelState>
  /** ID of the currently maximized panel (null if none) */
  maximizedPanelId: string | null
}
```

### Hook Interface

```typescript
/**
 * Options for the hook (controlled pattern support)
 */
export interface UseAgentTerminalPanelStateOptions {
  /**
   * Initial panel states (uncontrolled pattern)
   */
  initialStates?: Record<string, PanelDisplayState>

  /**
   * Controlled panel states (controlled pattern)
   * When provided, the hook becomes controlled
   */
  controlledStates?: Record<string, PanelDisplayState>

  /**
   * Callback when state changes (required for controlled pattern)
   */
  onStateChange?: (panelId: string, newState: PanelDisplayState, allStates: Record<string, PanelDisplayState>) => void

  /**
   * Callback when a panel is maximized (for mutual exclusivity notification)
   */
  onMaximize?: (panelId: string, previousMaximizedId: string | null) => void

  /**
   * Enable debug logging
   */
  debug?: boolean
}

/**
 * Return type for the hook
 */
export interface UseAgentTerminalPanelStateReturn {
  /**
   * Minimize a panel
   * @param panelId - The panel to minimize
   */
  minimize: (panelId: string) => void

  /**
   * Maximize a panel (will minimize any currently maximized panel)
   * @param panelId - The panel to maximize
   */
  maximize: (panelId: string) => void

  /**
   * Restore a panel to its previous state (or normal if no previous state)
   * @param panelId - The panel to restore
   */
  restore: (panelId: string) => void

  /**
   * Restore all panels to normal state
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
   */
  getAllStates: () => Record<string, PanelDisplayState>

  /**
   * The ID of the currently maximized panel (null if none)
   */
  maximizedPanelId: string | null

  /**
   * Check if any panel is maximized
   */
  hasMaximizedPanel: boolean

  /**
   * Register a new panel (creates entry in state)
   * @param panelId - The panel to register
   * @param initialState - Initial state for the panel
   */
  registerPanel: (panelId: string, initialState?: PanelDisplayState) => void

  /**
   * Unregister a panel (removes from state)
   * @param panelId - The panel to unregister
   */
  unregisterPanel: (panelId: string) => void
}
```

### State Transition Rules

1. **Minimize Transition**
   - From `normal` → `minimized`: Store `normal` as previous state
   - From `maximized` → `minimized`: Store `maximized` as previous state, clear `maximizedPanelId`

2. **Maximize Transition**
   - From any state → `maximized`: Store current state as previous
   - **Mutual Exclusivity**: If another panel is maximized, restore it to `normal` first
   - Set `maximizedPanelId` to the new panel

3. **Restore Transition**
   - Return to `previousState` (default: `normal`)
   - If restoring from `maximized`, clear `maximizedPanelId`

4. **RestoreAll Transition**
   - Reset all panels to `normal`
   - Clear `maximizedPanelId`
   - Clear all `previousState` values

### Implementation Strategy

```typescript
// Reducer for state management (internal)
type PanelAction =
  | { type: 'MINIMIZE'; panelId: string }
  | { type: 'MAXIMIZE'; panelId: string }
  | { type: 'RESTORE'; panelId: string }
  | { type: 'RESTORE_ALL' }
  | { type: 'REGISTER'; panelId: string; initialState?: PanelDisplayState }
  | { type: 'UNREGISTER'; panelId: string }
  | { type: 'SYNC_CONTROLLED'; states: Record<string, PanelDisplayState> }
```

### Controlled vs Uncontrolled Pattern

**Uncontrolled Pattern** (default):
```tsx
const { minimize, maximize, getPanelState } = useAgentTerminalPanelState({
  initialStates: {
    'panel-1': 'normal',
    'panel-2': 'minimized',
  }
})
```

**Controlled Pattern**:
```tsx
const [panelStates, setPanelStates] = useState<Record<string, PanelDisplayState>>({
  'panel-1': 'normal',
  'panel-2': 'minimized',
})

const { minimize, maximize, getPanelState } = useAgentTerminalPanelState({
  controlledStates: panelStates,
  onStateChange: (panelId, newState, allStates) => {
    setPanelStates(allStates)
  }
})
```

### File Structure

```
packages/web-ui/src/
├── hooks/
│   ├── useAgentTerminalPanelState.ts     # Main hook implementation
│   ├── __tests__/
│   │   └── useAgentTerminalPanelState.test.tsx  # Unit tests
│   └── index.ts                           # Updated exports
└── types/
    └── agent-terminal-panel.ts            # Type definitions
```

### Test Coverage Requirements

1. **Initial State Tests**
   - Default state (all normal)
   - With initial states
   - Controlled vs uncontrolled

2. **State Transition Tests**
   - minimize() from normal
   - minimize() from maximized
   - maximize() from normal
   - maximize() from minimized
   - restore() to previous state
   - restoreAll()

3. **Mutual Exclusivity Tests**
   - Only one panel maximized at a time
   - Previous maximized panel restored when new one maximizes

4. **Edge Cases**
   - Minimize already minimized panel
   - Maximize already maximized panel
   - Restore panel with no previous state
   - Operations on unregistered panels

5. **Controlled Pattern Tests**
   - State changes propagate through onStateChange
   - External state changes sync correctly
   - Controlled takes precedence over internal state

## Consequences

### Positive
- Clean separation of concerns with types in dedicated file
- Follows established hook patterns in the codebase
- Supports both controlled and uncontrolled patterns for flexibility
- Mutual exclusivity enforced at hook level
- Comprehensive test coverage plan

### Negative
- Additional complexity for controlled pattern
- Need to manage panel registration/unregistration

### Risks
- Performance with many panels (mitigated by using Map)
- State synchronization in controlled mode (mitigated by clear callback contract)

## Implementation Plan

1. Create `types/agent-terminal-panel.ts` with type definitions
2. Implement `hooks/useAgentTerminalPanelState.ts` with reducer pattern
3. Create comprehensive unit tests in `__tests__/useAgentTerminalPanelState.test.tsx`
4. Update `hooks/index.ts` to export the new hook
5. Run tests and build to verify
