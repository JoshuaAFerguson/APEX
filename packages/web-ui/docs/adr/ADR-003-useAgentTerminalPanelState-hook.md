# ADR-003: useAgentTerminalPanelState Hook Design

## Status
**Accepted**

## Context

The APEX web dashboard needs to manage minimize/maximize states of multiple agent terminal panels simultaneously. The key requirements are:

1. **Mutual Exclusivity**: Only one panel can be maximized at a time
2. **State Persistence**: Panels should remember their previous state for restoration
3. **Controlled/Uncontrolled Patterns**: Support both React patterns for flexibility
4. **Dynamic Panel Management**: Panels can be registered/unregistered dynamically
5. **Type Safety**: Full TypeScript support with existing type definitions

The existing type definitions in `types/agent-terminal-panel.ts` provide:
- `PanelDisplayState`: 'normal' | 'minimized' | 'maximized'
- `PanelState`: Contains displayState, previousState, lastChanged
- `AgentTerminalPanelStateMap`: Internal state representation
- `UseAgentTerminalPanelStateOptions/Return`: Hook interfaces
- `PanelStateAction`: Reducer action types

## Decision

### Architecture Overview

Implement `useAgentTerminalPanelState` as a React hook using the useReducer pattern, consistent with other hooks in the codebase (`useAgentLogStream`, `useAgentMetrics`).

```
┌─────────────────────────────────────────────────────────────────┐
│                useAgentTerminalPanelState Hook                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐     ┌───────────────────────────────┐    │
│  │   Options        │────▶│   useReducer                  │    │
│  │  - initialStates │     │   (panelStateReducer)         │    │
│  │  - controlled    │     │                               │    │
│  │  - callbacks     │     │   State:                      │    │
│  └──────────────────┘     │   - panels: Map<id, state>    │    │
│                           │   - maximizedPanelId: string  │    │
│                           └───────────────────────────────┘    │
│                                        │                        │
│  ┌─────────────────────────────────────▼────────────────────┐  │
│  │                   Action Dispatch                         │  │
│  │  MINIMIZE | MAXIMIZE | RESTORE | RESTORE_ALL |           │  │
│  │  REGISTER | UNREGISTER | SYNC_CONTROLLED                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                        │                        │
│  ┌─────────────────────────────────────▼────────────────────┐  │
│  │                   Returned API                            │  │
│  │  minimize(id) | maximize(id) | restore(id) | restoreAll()│  │
│  │  getPanelState(id) | getAllStates() | registerPanel(id)  │  │
│  │  unregisterPanel(id) | isPanelRegistered(id) | panelCount│  │
│  │  maximizedPanelId | hasMaximizedPanel                     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Core State Machine

```
                    ┌──────────────┐
                    │   normal     │◀─────────────────┐
                    └──────┬───────┘                  │
                           │                          │
             minimize()    │    maximize()           restore()
                           │                          │
            ┌──────────────┼──────────────┐          │
            ▼              │              ▼          │
     ┌──────────────┐      │       ┌──────────────┐  │
     │  minimized   │      │       │  maximized   │──┘
     └──────────────┘      │       └──────────────┘
            │              │              ▲
            │              │              │
            └──────────────┴──────────────┘
              restore() sets previousState

Note: When maximize(panelX) is called while panelY is maximized,
      panelY is automatically restored to its previousState (normal)
```

### Implementation Details

#### 1. Reducer Pattern

```typescript
function panelStateReducer(
  state: AgentTerminalPanelStateMap,
  action: PanelStateAction
): AgentTerminalPanelStateMap {
  switch (action.type) {
    case 'MINIMIZE':
      // Store current state as previousState
      // Set displayState to 'minimized'

    case 'MAXIMIZE':
      // If another panel is maximized, restore it first
      // Store current state as previousState
      // Set displayState to 'maximized'
      // Track maximizedPanelId

    case 'RESTORE':
      // Return to previousState
      // Clear maximizedPanelId if this was maximized

    case 'RESTORE_ALL':
      // Set all panels to 'normal'
      // Clear previousStates
      // Clear maximizedPanelId

    case 'REGISTER':
      // Add new panel with initial state

    case 'UNREGISTER':
      // Remove panel from state
      // Clear maximizedPanelId if this was maximized

    case 'SYNC_CONTROLLED':
      // Synchronize with external controlled state
  }
}
```

#### 2. Mutual Exclusivity Enforcement

The maximize action enforces mutual exclusivity:

```typescript
case 'MAXIMIZE': {
  const { panelId } = action
  const newPanels = new Map(state.panels)

  // Step 1: Restore currently maximized panel (if any)
  if (state.maximizedPanelId && state.maximizedPanelId !== panelId) {
    const currentMax = newPanels.get(state.maximizedPanelId)
    if (currentMax) {
      newPanels.set(state.maximizedPanelId, {
        ...currentMax,
        displayState: currentMax.previousState,
        previousState: 'normal',
        lastChanged: new Date(),
      })
    }
  }

  // Step 2: Maximize the requested panel
  const panel = newPanels.get(panelId) ?? createDefaultPanelState(panelId)
  newPanels.set(panelId, {
    ...panel,
    previousState: panel.displayState,
    displayState: 'maximized',
    lastChanged: new Date(),
  })

  return {
    panels: newPanels,
    maximizedPanelId: panelId,
  }
}
```

#### 3. Controlled/Uncontrolled Pattern

**Uncontrolled Mode** (default):
- Hook manages all state internally
- Consumer provides optional `initialStates`
- State changes trigger optional callbacks

**Controlled Mode**:
- Consumer provides `controlledStates` record
- Hook synchronizes internal state via `SYNC_CONTROLLED` action
- All mutations still go through reducer but notify via `onStateChange`

```typescript
// Detect controlled mode
const isControlled = controlledStates !== undefined

// Sync effect for controlled mode
useEffect(() => {
  if (isControlled && controlledStates) {
    dispatch({ type: 'SYNC_CONTROLLED', states: controlledStates })
  }
}, [isControlled, controlledStates])

// Action handlers call callbacks
const maximize = useCallback((panelId: string) => {
  const prevMaximized = state.maximizedPanelId
  dispatch({ type: 'MAXIMIZE', panelId })

  if (isControlled) {
    onStateChange?.(panelId, 'maximized', getAllStates())
  }
  onMaximize?.(panelId, prevMaximized)
}, [state.maximizedPanelId, isControlled, onStateChange, onMaximize])
```

### File Structure

```
packages/web-ui/src/
├── hooks/
│   ├── useAgentTerminalPanelState.ts      # Hook implementation
│   ├── __tests__/
│   │   └── useAgentTerminalPanelState.test.tsx  # Unit tests
│   └── index.ts                            # Export (update)
└── types/
    └── agent-terminal-panel.ts             # Types (existing)
```

### Test Coverage Requirements

1. **State Transitions**
   - minimize() changes state to 'minimized'
   - maximize() changes state to 'maximized'
   - restore() returns to previousState
   - restoreAll() sets all panels to 'normal'

2. **Mutual Exclusivity**
   - Only one panel can be maximized at a time
   - Maximizing panel B when A is maximized restores A
   - maximizedPanelId tracks current maximized panel

3. **Controlled/Uncontrolled**
   - Uncontrolled: internal state management works
   - Controlled: syncs with external state
   - Callbacks fire appropriately

4. **Dynamic Registration**
   - registerPanel() adds panel with initial state
   - unregisterPanel() removes panel
   - Unregistering maximized panel clears maximizedPanelId

5. **Edge Cases**
   - Minimizing already minimized panel (no-op or update timestamp)
   - Maximizing already maximized panel (no-op)
   - Restore on panel with no previous state (defaults to 'normal')
   - Empty state handling

## Consequences

### Positive
- **Consistent Pattern**: Follows existing hook patterns in codebase
- **Type Safety**: Full TypeScript support via existing types
- **Testable**: Reducer pattern enables isolated unit testing
- **Flexible**: Controlled/uncontrolled pattern supports various use cases
- **Predictable**: Clear state machine with enforced mutual exclusivity

### Negative
- **Complexity**: Controlled mode adds complexity
- **Map Usage**: Internal Map type requires serialization for persistence

### Risks & Mitigations
- **Performance**: Large panel counts could slow down - mitigate with Map structure O(1) lookups
- **Race Conditions**: Multiple rapid state changes - reducer serializes updates naturally

## Implementation Checklist

- [ ] Create `useAgentTerminalPanelState.ts` with reducer implementation
- [ ] Implement all actions: MINIMIZE, MAXIMIZE, RESTORE, RESTORE_ALL, REGISTER, UNREGISTER, SYNC_CONTROLLED
- [ ] Add controlled mode synchronization
- [ ] Export from hooks/index.ts
- [ ] Create comprehensive test suite with 100% acceptance criteria coverage
- [ ] Verify build passes
- [ ] Verify all tests pass
