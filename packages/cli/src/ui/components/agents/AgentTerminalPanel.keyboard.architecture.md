# Architecture Decision Record: Keyboard Handling for CLI AgentTerminalPanel

**Status:** Proposed
**Date:** 2026-03-23
**Author:** Architecture Stage Agent
**Task:** Implement keyboard handling in CLI AgentTerminalPanel using useInput

## Context

The CLI AgentTerminalPanel component needs keyboard handling capabilities to enable user interaction for panel state management (minimize, maximize, restore, toggle). The component already has:

1. **Defined props for keyboard interaction** in `AgentTerminalPanel.types.ts`:
   - `allowKeyboardInput?: boolean` (default: true)
   - `onMinimize?: (execution: AgentExecution) => void`
   - `onMaximize?: (execution: AgentExecution) => void`
   - `onRestore?: (execution: AgentExecution) => void`
   - `onSelect?: (execution: AgentExecution) => void`
   - `panelState?: PanelState` - for controlled mode

2. **Existing `PanelState` enum** in `useAgentTerminalPanelState.ts`:
   - `PanelState.Normal`
   - `PanelState.Minimized`
   - `PanelState.Maximized`

3. **Established patterns** for keyboard handling using Ink's `useInput` hook (see `CollapsibleSection.tsx`, `SubtaskTree.tsx`)

## Acceptance Criteria

Component uses Ink's `useInput` hook to handle:
- **Enter/Space**: Toggle (select/activate)
- **M (uppercase)**: Maximize panel
- **Escape**: Restore from maximized state
- **Minus (-)**: Minimize panel
- **Plus (+)**: Restore from minimized state

**Constraint:** Keyboard is only active when `allowKeyboardInput=true`.

## Design Decisions

### Decision 1: Key Binding Strategy

**Chosen Approach:** Context-Aware Key Bindings

The key bindings will behave differently based on the current `panelState`:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Key        │ Panel State   │ Action                  │ Callback              │
├────────────┼───────────────┼─────────────────────────┼───────────────────────┤
│ Enter/Space│ Any           │ Toggle/Select panel     │ onSelect(execution)   │
│ M          │ Normal/Min    │ Maximize panel          │ onMaximize(execution) │
│ Escape     │ Maximized     │ Restore to normal       │ onRestore(execution)  │
│ -          │ Normal/Max    │ Minimize panel          │ onMinimize(execution) │
│ +          │ Minimized     │ Restore to normal       │ onRestore(execution)  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Rationale:**
- Intuitive mapping: `+` restores from minimized (expand), `-` minimizes (shrink)
- `Escape` is universally understood as "exit/restore from special state"
- `M` for maximize follows common window manager conventions
- Enter/Space for toggle is standard accessibility pattern

### Decision 2: Hook Implementation Pattern

**Chosen Approach:** Custom Hook `useKeyboardShortcuts`

Extract keyboard handling into a dedicated custom hook for:
1. Reusability across similar components
2. Testability in isolation
3. Separation of concerns
4. Type safety

```typescript
interface UseKeyboardShortcutsOptions {
  isActive: boolean;
  panelState?: PanelState;
  execution: AgentExecution;
  onSelect?: (execution: AgentExecution) => void;
  onMinimize?: (execution: AgentExecution) => void;
  onMaximize?: (execution: AgentExecution) => void;
  onRestore?: (execution: AgentExecution) => void;
}

function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  useInput((input, key) => {
    // Handle keyboard shortcuts based on state
  }, { isActive: options.isActive });
}
```

**Alternative Considered:** Inline `useInput` in component
- Rejected because it reduces testability and reusability
- However, for simplicity in initial implementation, inline usage is acceptable

### Decision 3: Focus Management Strategy

**Chosen Approach:** Rely on `focused` and `allowKeyboardInput` Props

The component already has a `focused` prop. Keyboard handling activation will be determined by:

```typescript
const isKeyboardActive = allowKeyboardInput && focused;
```

**Rationale:**
- `focused` indicates visual focus state (parent controls which panel is focused)
- `allowKeyboardInput` is a user/parent override to disable keyboard entirely
- Both must be true for keyboard to be active
- This follows the established pattern in `SubtaskTree.tsx` and `CollapsibleSection.tsx`

### Decision 4: State-Aware Actions

**Chosen Approach:** Validate Actions Against Current State

Some key bindings should only trigger actions when they make sense:

```typescript
// In useInput callback:
if (input === 'm' || input === 'M') {
  // Only maximize if not already maximized
  if (panelState !== PanelState.Maximized) {
    onMaximize?.(execution);
  }
}

if (key.escape) {
  // Only restore if currently maximized
  if (panelState === PanelState.Maximized) {
    onRestore?.(execution);
  }
}

if (input === '-') {
  // Only minimize if not already minimized
  if (panelState !== PanelState.Minimized) {
    onMinimize?.(execution);
  }
}

if (input === '+' || input === '=') {
  // Only restore if currently minimized
  // Support both '+' and '=' (shift+= on most keyboards)
  if (panelState === PanelState.Minimized) {
    onRestore?.(execution);
  }
}
```

**Rationale:**
- Prevents redundant callback invocations
- Clearer mental model for users
- Supports both controlled and uncontrolled state patterns

### Decision 5: Implementation Location

**Chosen Approach:** Add `useInput` Directly to AgentTerminalPanel Component

Rather than creating a separate hook file initially, implement keyboard handling directly in the component following the established patterns in `CollapsibleSection.tsx`:

```typescript
// In AgentTerminalPanel.tsx
import { useInput } from 'ink';

// Inside the component:
const isKeyboardActive = (allowKeyboardInput ?? true) && focused;

useInput((input, key) => {
  if (!isKeyboardActive) return;

  // Toggle/Select
  if (key.return || input === ' ') {
    onSelect?.(execution);
    return;
  }

  // Maximize
  if (input === 'm' || input === 'M') {
    if (panelState !== PanelState.Maximized) {
      onMaximize?.(execution);
    }
    return;
  }

  // Restore from maximized
  if (key.escape) {
    if (panelState === PanelState.Maximized) {
      onRestore?.(execution);
    }
    return;
  }

  // Minimize
  if (input === '-') {
    if (panelState !== PanelState.Minimized) {
      onMinimize?.(execution);
    }
    return;
  }

  // Restore from minimized
  if (input === '+' || input === '=') {
    if (panelState === PanelState.Minimized) {
      onRestore?.(execution);
    }
    return;
  }
}, { isActive: isKeyboardActive });
```

**Rationale:**
- Follows established patterns in the codebase
- Simpler initial implementation
- Can be extracted to a hook later if reuse is needed
- Keeps all component logic in one file

## Implementation Plan

### Files to Modify

1. **`AgentTerminalPanel.tsx`**
   - Import `useInput` from 'ink'
   - Import `PanelState` from types
   - Add `useInput` hook with keyboard handler
   - Update component to use the new props

2. **`AgentTerminalPanel.types.ts`**
   - No changes needed (props already defined)

### Files to Create

1. **`__tests__/AgentTerminalPanel.keyboard.test.tsx`**
   - Unit tests for keyboard handling
   - Tests for each key binding
   - Tests for `allowKeyboardInput` gating
   - Tests for state-aware action validation

## Component Interface (Updated)

The existing props already support keyboard handling:

```typescript
interface AgentTerminalPanelProps {
  execution: AgentExecution;

  // Existing props (unchanged)
  displayMode?: TerminalPanelDisplayMode;
  focused?: boolean;
  animated?: boolean;
  width?: number;
  borderStyle?: TerminalPanelBorderStyle;
  borderColor?: string;
  showElapsedTime?: boolean;
  showProgress?: boolean;
  testId?: string;

  // Keyboard props (already defined)
  allowKeyboardInput?: boolean;  // Default: true
  onSelect?: (execution: AgentExecution) => void;
  onMinimize?: (execution: AgentExecution) => void;
  onMaximize?: (execution: AgentExecution) => void;
  onRestore?: (execution: AgentExecution) => void;
  panelState?: PanelState;  // For controlled mode
}
```

## Keyboard Shortcut Reference

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AgentTerminalPanel Keyboard Shortcuts                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ Key           │ Description                                                 │
├───────────────┼─────────────────────────────────────────────────────────────┤
│ Enter / Space │ Select/toggle the panel (triggers onSelect callback)        │
│ M             │ Maximize the panel (when normal/minimized)                  │
│ Escape        │ Restore panel from maximized state                          │
│ - (Minus)     │ Minimize the panel (when normal/maximized)                  │
│ + (Plus)      │ Restore panel from minimized state                          │
└─────────────────────────────────────────────────────────────────────────────┘

Note: Keyboard shortcuts are only active when:
  - allowKeyboardInput prop is true (default)
  - focused prop is true
```

## Testing Strategy

### Unit Tests

```typescript
describe('AgentTerminalPanel Keyboard Handling', () => {
  describe('when allowKeyboardInput=true and focused=true', () => {
    it('calls onSelect when Enter is pressed', () => {});
    it('calls onSelect when Space is pressed', () => {});
    it('calls onMaximize when M is pressed (from normal state)', () => {});
    it('calls onMaximize when M is pressed (from minimized state)', () => {});
    it('does not call onMaximize when M is pressed (from maximized state)', () => {});
    it('calls onRestore when Escape is pressed (from maximized state)', () => {});
    it('does not call onRestore when Escape is pressed (from normal state)', () => {});
    it('calls onMinimize when - is pressed (from normal state)', () => {});
    it('calls onMinimize when - is pressed (from maximized state)', () => {});
    it('does not call onMinimize when - is pressed (from minimized state)', () => {});
    it('calls onRestore when + is pressed (from minimized state)', () => {});
    it('does not call onRestore when + is pressed (from normal state)', () => {});
  });

  describe('when allowKeyboardInput=false', () => {
    it('does not respond to any keyboard input', () => {});
  });

  describe('when focused=false', () => {
    it('does not respond to keyboard input', () => {});
  });
});
```

### Integration Tests

- Test keyboard navigation between multiple panels
- Test state transitions through keyboard shortcuts
- Test with `useAgentTerminalPanelState` hook integration

## Accessibility Considerations

1. **Keyboard-Only Operation:** All panel controls accessible via keyboard
2. **Focus Indication:** Panel border color changes when focused (existing behavior)
3. **State Feedback:** Visual representation of minimized/maximized state
4. **Consistent Shortcuts:** Key bindings follow common conventions

## Performance Considerations

1. **Event Handler Memoization:** The `useInput` hook manages this internally
2. **Callback Stability:** Parent should memoize callbacks (`useCallback`)
3. **No Re-renders:** Keyboard handling doesn't cause unnecessary re-renders

## Migration/Compatibility

This is a new feature addition with no breaking changes:
- All new props are optional with sensible defaults
- Existing usage continues to work without modification
- Keyboard handling is opt-out (enabled by default)

## Conclusion

This design adds keyboard handling to the AgentTerminalPanel following established patterns in the codebase. It leverages the existing props defined in the types file and the `PanelState` enum from the state management hook. The implementation is straightforward, testable, and provides a consistent user experience with other keyboard-enabled components in the CLI.
