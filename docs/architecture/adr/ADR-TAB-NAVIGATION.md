# ADR: Tab Navigation Between Panels in useAgentTerminalPanelState

## Status
Proposed

## Context

The APEX project has two implementations of `useAgentTerminalPanelState`:
1. **CLI version** (`packages/cli/src/ui/hooks/useAgentTerminalPanelState.ts`) - Simpler implementation for Ink-based terminal UI
2. **Web-UI version** (`packages/web-ui/src/hooks/useAgentTerminalPanelState.ts`) - More feature-rich implementation with reducer pattern for React/Next.js

The task requires implementing Tab navigation between panels:
- **Tab** key moves focus to the next panel
- **Shift+Tab** moves focus to the previous panel
- Focus wraps around when reaching the end/beginning
- Navigation must work in both web-ui and CLI contexts

### Current State Analysis

**Existing Focus Management:**
- Web-UI: `ParallelAgentTerminalView` has `focusPanel(panelId)` method via imperative handle
- CLI: Uses Ink's `useInput` hook with `focused` prop to determine keyboard activity
- Panels have `tabIndex="0"` and ARIA attributes for accessibility

**Existing Keyboard Handling:**
- Both implementations support minimize/maximize/restore via keyboard (M, -, +, Escape)
- CLI uses Ink's `useInput((input, key) => ...)` pattern
- Web-UI uses `onKeyDown` event handlers on panel containers

**Missing Capabilities:**
- No centralized focus index tracking
- No Tab/Shift+Tab navigation handlers
- No focus wrapping logic
- No coordination between panel state and focus state

## Decision

### Architectural Approach

We will extend `useAgentTerminalPanelState` in both packages to include focus navigation capabilities:

1. **Add focus state tracking** - Track the currently focused panel index and panel IDs
2. **Add navigation actions** - `focusNext()`, `focusPrevious()`, `focusPanel(id)`
3. **Add Tab key handling** - Integrate with existing keyboard handlers
4. **Maintain separation of concerns** - Focus management is distinct from panel display state

### Design: Focus Navigation State Extension

```typescript
// New types to add to both implementations

/**
 * Focus navigation state
 */
interface PanelFocusState {
  /** Ordered array of panel IDs for navigation */
  panelIds: string[]
  /** Currently focused panel ID (null if no focus) */
  focusedPanelId: string | null
  /** Index of focused panel (-1 if no focus) */
  focusedIndex: number
}

/**
 * Focus navigation actions
 */
interface PanelFocusActions {
  /** Move focus to next panel, wraps to first */
  focusNext: () => void
  /** Move focus to previous panel, wraps to last */
  focusPrevious: () => void
  /** Focus a specific panel by ID */
  focusPanel: (panelId: string) => void
  /** Clear focus (no panel focused) */
  clearFocus: () => void
  /** Check if a specific panel is focused */
  isPanelFocused: (panelId: string) => boolean
}
```

### Implementation Strategy

#### 1. CLI Implementation (`packages/cli/src/ui/hooks/useAgentTerminalPanelState.ts`)

```typescript
// Extended hook options
export interface UseAgentTerminalPanelStateOptions {
  // ... existing options ...

  /**
   * Ordered list of panel IDs for Tab navigation
   * Order determines Tab sequence
   */
  panelIds?: string[]

  /**
   * Initially focused panel ID
   */
  initialFocusedPanelId?: string | null

  /**
   * Callback when focus changes
   */
  onFocusChange?: (panelId: string | null, previousPanelId: string | null) => void
}

// Extended return type
export interface PanelStateManager {
  // ... existing functions ...

  // Focus navigation
  focusNext: () => void
  focusPrevious: () => void
  focusPanel: (panelId: string) => void
  clearFocus: () => void
  isPanelFocused: (panelId: string) => boolean
  focusedPanelId: string | null
  focusedIndex: number
}
```

**Key Implementation Details:**
- Use `useState` for focus tracking (separate from panel state)
- Navigation wraps around using modulo arithmetic
- `focusNext()` and `focusPrevious()` skip over non-existent panels
- Focus changes trigger optional callback for external synchronization

#### 2. Web-UI Implementation (`packages/web-ui/src/hooks/useAgentTerminalPanelState.ts`)

```typescript
// New reducer actions
export type PanelStateAction =
  | { type: 'FOCUS_NEXT' }
  | { type: 'FOCUS_PREVIOUS' }
  | { type: 'FOCUS_PANEL'; panelId: string }
  | { type: 'CLEAR_FOCUS' }
  | { type: 'SET_PANEL_ORDER'; panelIds: string[] }
  // ... existing actions ...

// Extended state map
export interface AgentTerminalPanelStateMap {
  panels: Map<string, PanelState>
  maximizedPanelId: string | null
  // New focus state
  focusedPanelId: string | null
  panelOrder: string[]  // Ordered list for Tab navigation
}
```

**Key Implementation Details:**
- Add focus actions to reducer for state consistency
- Derive `focusedIndex` from `focusedPanelId` and `panelOrder`
- Auto-update panel order when panels are registered/unregistered
- Handle DOM focus synchronization via callback

#### 3. Tab Key Integration

**CLI (Ink useInput):**
```typescript
// In the consuming component (AgentTerminalPanel or parent)
useInput((input, key) => {
  if (key.tab) {
    if (key.shift) {
      panelStateManager.focusPrevious()
    } else {
      panelStateManager.focusNext()
    }
  }
}, { isActive: true })
```

**Web-UI (React keyDown):**
```typescript
// In ParallelAgentTerminalView or grid component
const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
  if (event.key === 'Tab') {
    event.preventDefault() // Prevent default tab behavior
    if (event.shiftKey) {
      focusPrevious()
    } else {
      focusNext()
    }
  }
}, [focusNext, focusPrevious])
```

### Focus Wrapping Algorithm

```typescript
function calculateNextIndex(
  currentIndex: number,
  totalPanels: number,
  direction: 'next' | 'previous'
): number {
  if (totalPanels === 0) return -1
  if (currentIndex === -1) {
    // No current focus, start at first or last
    return direction === 'next' ? 0 : totalPanels - 1
  }

  if (direction === 'next') {
    // Wrap from last to first
    return (currentIndex + 1) % totalPanels
  } else {
    // Wrap from first to last
    return (currentIndex - 1 + totalPanels) % totalPanels
  }
}
```

### Component Integration

**ParallelAgentTerminalView (Web-UI):**
```tsx
// Focus management integration
const {
  focusNext,
  focusPrevious,
  focusedPanelId,
  // ... existing
} = useAgentTerminalPanelState({ ... })

// Handle keyboard at grid level
<div
  onKeyDown={handleKeyDown}
  tabIndex={0}  // Make container focusable
>
  {panels.map(config => (
    <AgentTerminalPanel
      {...config}
      isFocused={focusedPanelId === config.panelId}
    />
  ))}
</div>
```

**ParallelAgentGrid (Web-UI):**
- Pass focus state down to children
- Handle Tab navigation at grid container level

**CLI Integration:**
- Parent component manages focus index
- Individual panels receive `focused` prop
- Tab navigation at application level

## Type Definitions Update

### `packages/web-ui/src/types/agent-terminal-panel.ts`

```typescript
// Add to UseAgentTerminalPanelStateOptions
export interface UseAgentTerminalPanelStateOptions {
  // ... existing ...

  /**
   * Initial panel order for Tab navigation
   * If not provided, panels are ordered by registration time
   */
  initialPanelOrder?: string[]

  /**
   * Initially focused panel ID
   */
  initialFocusedPanelId?: string | null

  /**
   * Callback when panel focus changes
   */
  onFocusChange?: (
    focusedPanelId: string | null,
    previousFocusedPanelId: string | null
  ) => void
}

// Add to UseAgentTerminalPanelStateReturn
export interface UseAgentTerminalPanelStateReturn {
  // ... existing ...

  /** Move focus to next panel (wraps around) */
  focusNext: () => void

  /** Move focus to previous panel (wraps around) */
  focusPrevious: () => void

  /** Focus a specific panel by ID */
  focusPanel: (panelId: string) => void

  /** Clear current focus */
  clearFocus: () => void

  /** Check if a specific panel is focused */
  isPanelFocused: (panelId: string) => boolean

  /** Currently focused panel ID (null if none) */
  focusedPanelId: string | null

  /** Index of focused panel in panel order (-1 if none) */
  focusedIndex: number

  /** Current panel order for navigation */
  panelOrder: readonly string[]

  /** Update panel order for Tab navigation */
  setPanelOrder: (panelIds: string[]) => void
}
```

## Accessibility Considerations

1. **ARIA attributes**: Focused panels should have `aria-selected="true"` or appropriate focus indicators
2. **Focus visibility**: Visual focus indicators (ring, border) for keyboard users
3. **Screen reader announcement**: Focus changes should be announced
4. **Skip links**: Consider adding skip links for large panel counts

## Testing Strategy

### Unit Tests

```typescript
// packages/cli/src/ui/hooks/__tests__/useAgentTerminalPanelState.focus.test.ts
describe('Tab Navigation', () => {
  it('focusNext moves to next panel', () => { ... })
  it('focusNext wraps from last to first panel', () => { ... })
  it('focusPrevious moves to previous panel', () => { ... })
  it('focusPrevious wraps from first to last panel', () => { ... })
  it('focusPanel focuses specific panel by ID', () => { ... })
  it('clearFocus removes current focus', () => { ... })
  it('handles empty panel list gracefully', () => { ... })
  it('updates focus when panel is unregistered', () => { ... })
})
```

### Integration Tests

```typescript
// packages/web-ui/src/components/agents/__tests__/ParallelAgentTerminalView.tab-navigation.test.tsx
describe('Tab Navigation Integration', () => {
  it('Tab key moves focus to next panel', () => { ... })
  it('Shift+Tab moves focus to previous panel', () => { ... })
  it('focus wraps around panel list', () => { ... })
  it('visual focus indicator follows keyboard focus', () => { ... })
})
```

## File Changes Summary

### Files to Modify

1. **`packages/cli/src/ui/hooks/useAgentTerminalPanelState.ts`**
   - Add focus state (`focusedPanelId`, `focusedIndex`)
   - Add `panelIds` tracking
   - Implement `focusNext()`, `focusPrevious()`, `focusPanel()`, `clearFocus()`
   - Add `onFocusChange` callback support

2. **`packages/web-ui/src/hooks/useAgentTerminalPanelState.ts`**
   - Add focus state to reducer
   - Add focus actions (FOCUS_NEXT, FOCUS_PREVIOUS, FOCUS_PANEL, CLEAR_FOCUS)
   - Add `panelOrder` state management
   - Implement focus navigation functions

3. **`packages/web-ui/src/types/agent-terminal-panel.ts`**
   - Add focus-related types to options and return interfaces
   - Add focus action types to PanelStateAction

4. **`packages/web-ui/src/components/agents/ParallelAgentTerminalView.tsx`**
   - Add keyboard event handler for Tab navigation
   - Pass focus state to child panels

5. **`packages/web-ui/src/components/agents/ParallelAgentGrid.tsx`**
   - Add Tab navigation support at grid level

### Files to Create

1. **`packages/cli/src/ui/hooks/__tests__/useAgentTerminalPanelState.focus.test.ts`**
   - Unit tests for CLI focus navigation

2. **`packages/web-ui/src/hooks/__tests__/useAgentTerminalPanelState.focus.test.ts`**
   - Unit tests for Web-UI focus navigation

3. **`packages/web-ui/src/components/agents/__tests__/ParallelAgentTerminalView.tab-navigation.test.tsx`**
   - Integration tests for Tab navigation

## Consequences

### Positive
- Unified keyboard navigation across CLI and Web-UI
- Improved accessibility for keyboard users
- Consistent API for focus management
- Backward compatible (new features are additive)
- Enables future keyboard shortcut enhancements

### Negative
- Increased complexity in state management
- Need to coordinate focus state with DOM focus (Web-UI)
- Additional testing surface area

### Risks
- DOM focus synchronization may have edge cases
- Performance impact with many panels (mitigated by efficient state updates)

## Implementation Order

1. Add types to `agent-terminal-panel.ts`
2. Implement CLI hook focus features
3. Add CLI hook tests
4. Implement Web-UI hook focus features
5. Add Web-UI hook tests
6. Update ParallelAgentTerminalView
7. Add integration tests
8. Update ParallelAgentGrid
9. Final acceptance testing

## References

- Ink useInput documentation: https://github.com/vadimdemedes/ink#useinput
- WAI-ARIA Tab Pattern: https://www.w3.org/WAI/ARIA/apg/patterns/tabpanel/
- React Keyboard Events: https://react.dev/reference/react-dom/components/common#keyboardevent-handler
