# ADR-0015: AgentTerminalPanel Keyboard Accessibility Tests Architecture

## Status
Accepted

## Date
2024-12-19

## Context

The CLI AgentTerminalPanel component requires comprehensive keyboard accessibility tests to ensure users can effectively interact with agent terminal panels using keyboard-only navigation. This is critical for accessibility compliance and for terminal-based workflows where keyboard is the primary input method.

### Current State

1. **AgentTerminalPanel** (`packages/cli/src/ui/components/agents/AgentTerminalPanel.tsx`) is an Ink-based React component
2. **State Management Hook** (`useAgentTerminalPanelState.ts`) provides minimize/maximize/restore functionality
3. **Type Definitions** define keyboard props: `allowKeyboardInput`, `onMinimize`, `onMaximize`, `onRestore`, `panelState`
4. **Existing tests** cover rendering, visual states, and basic functionality but NOT keyboard accessibility

### Acceptance Criteria

Tests must cover:
- All keyboard shortcuts (Enter, Space, M, Escape, Minus, Plus)
- State transitions (normal -> minimized, normal -> maximized, etc.)
- Edge cases (rapid key presses, boundary conditions)
- Controlled vs uncontrolled mode
- Terminal feedback

## Decision

We will implement a comprehensive keyboard accessibility test suite following the established patterns in the codebase, specifically mirroring the approach used in:
- `CollapsibleSection.keyboard-accessibility.test.tsx`
- `SubtaskTree.keyboard.test.tsx`
- `AgentThoughts.keyboard-integration.test.tsx`

### Test Architecture

```
AgentTerminalPanel.keyboard-accessibility.test.tsx
├── Keyboard Input Registration
│   ├── registers useInput hook when allowKeyboardInput=true
│   ├── disables useInput hook when allowKeyboardInput=false
│   └── provides keyboard handler function to useInput
│
├── Keyboard Shortcuts
│   ├── Enter Key
│   │   ├── triggers onSelect when panel is focused
│   │   └── works in both controlled and uncontrolled mode
│   ├── Space Key
│   │   ├── toggles panel state (maximize/restore)
│   │   └── works with focused panels
│   ├── M Key (Maximize)
│   │   ├── triggers onMaximize callback
│   │   └── changes panel state to maximized
│   ├── Escape Key
│   │   ├── triggers onRestore callback
│   │   ├── restores panel to normal state from maximized
│   │   └── restores panel to normal state from minimized
│   ├── Minus Key (-)
│   │   ├── triggers onMinimize callback
│   │   └── changes panel state to minimized
│   └── Plus Key (+)
│       ├── triggers onMaximize callback
│       └── alternative maximize shortcut
│
├── State Transitions
│   ├── normal -> minimized (via - key)
│   ├── normal -> maximized (via M or + key)
│   ├── minimized -> normal (via Escape)
│   ├── minimized -> maximized (via M or +)
│   ├── maximized -> normal (via Escape)
│   └── maximized -> minimized (via -)
│
├── Controlled Mode
│   ├── respects external panelState prop
│   ├── calls appropriate callbacks without managing internal state
│   ├── reflects state changes from parent
│   └── handles state transitions correctly
│
├── Uncontrolled Mode
│   ├── manages internal panel state
│   ├── tracks state transitions internally
│   └── notifies parent via callbacks
│
├── Terminal Feedback
│   ├── visual state changes reflect keyboard actions
│   ├── border color changes for focused state
│   └── animation state updates
│
└── Edge Cases
    ├── rapid key press handling
    ├── multiple panels with same shortcuts
    ├── keyboard disabled during transitions
    ├── special key combinations (Shift, Ctrl modifiers)
    └── empty execution data handling
```

### Technical Implementation

#### File Structure

```
packages/cli/src/ui/components/agents/__tests__/
├── AgentTerminalPanel.keyboard-accessibility.test.tsx  # NEW
├── AgentTerminalPanel.test.tsx                         # Existing
├── AgentTerminalPanel.acceptance.test.tsx              # Existing
├── AgentTerminalPanel.types.test.ts                    # Existing
└── test-utils/
    └── fixtures.ts                                     # Reusable fixtures
```

#### Key Design Decisions

1. **Mock `useInput` from Ink**: Following established pattern in `CollapsibleSection.keyboard-accessibility.test.tsx`
   ```typescript
   vi.mock('ink', () => ({
     ...vi.importActual('ink'),
     useInput: vi.fn(),
   }));
   ```

2. **Capture Keyboard Handler**: Extract the handler function from `useInput` mock calls
   ```typescript
   const [keyboardHandler, options] = mockUseInput.mock.calls[0];
   ```

3. **Simulate Key Presses**: Use the captured handler to test keyboard interactions
   ```typescript
   keyboardHandler('m', {}); // M key
   keyboardHandler('-', {}); // Minus key
   keyboardHandler('', { return: true }); // Enter key
   keyboardHandler('', { escape: true }); // Escape key
   ```

4. **Test Both Modes**: Separate test suites for controlled and uncontrolled behavior

5. **State Verification**: Assert both callback invocations and state changes

#### Keyboard Shortcut Mapping

| Key | Action | Key Object | Notes |
|-----|--------|------------|-------|
| Enter | Select/Activate | `{ return: true }` | Primary activation |
| Space | Toggle Maximize | `' '` (character) | Secondary toggle |
| M | Maximize | `'m'` or `'M'` | Case insensitive |
| Escape | Restore | `{ escape: true }` | Return to normal |
| - | Minimize | `'-'` | Reduce panel |
| + | Maximize | `'+' or '='` | Expand panel |

### Test Categories and Coverage

#### 1. Keyboard Input Registration Tests
- Verify `useInput` hook registration with correct `isActive` state
- Test keyboard handler function presence
- Verify cleanup on unmount

#### 2. Individual Keyboard Shortcut Tests
Each shortcut requires:
- Basic functionality test
- Callback invocation test
- State change verification
- Focus/unfocus behavior

#### 3. State Transition Tests
Complete transition matrix testing:
```
From/To    | Normal | Minimized | Maximized
-----------|--------|-----------|----------
Normal     |   -    | - key     | M/+ key
Minimized  | Escape |    -      | M/+ key
Maximized  | Escape | - key     |    -
```

#### 4. Controlled Mode Tests
- External `panelState` prop respected
- Callbacks fire without internal state changes
- Parent component integration

#### 5. Uncontrolled Mode Tests
- Internal state management
- Default state handling
- State persistence across re-renders

#### 6. Terminal Feedback Tests
- Visual indicators update
- Border style changes
- Animation state changes

#### 7. Edge Case Tests
- Rapid sequential key presses
- Modifier key combinations
- Invalid state handling
- Empty/null execution data

### Integration Points

The test suite integrates with:

1. **`useAgentTerminalPanelState` hook**: State management
2. **`AgentTerminalPanel` component**: UI rendering
3. **Ink's `useInput` hook**: Keyboard event handling
4. **Theme context**: Visual styling
5. **`ink-testing-library`**: Rendering and assertions

### Dependencies

```json
{
  "devDependencies": {
    "vitest": "^4.0.18",
    "@testing-library/react": "*",
    "ink-testing-library": "*"
  }
}
```

## Consequences

### Positive

1. **Comprehensive Coverage**: All keyboard shortcuts and state transitions tested
2. **Pattern Consistency**: Follows established codebase testing patterns
3. **Accessibility Assurance**: Guarantees keyboard-only usability
4. **Regression Prevention**: Catches keyboard behavior changes
5. **Documentation**: Tests serve as specification for keyboard behavior

### Negative

1. **Test Maintenance**: More tests to maintain
2. **Mocking Complexity**: useInput mocking requires careful setup
3. **Test Duration**: Additional tests increase CI time

### Risks

1. **Ink Version Changes**: useInput API changes may break tests
2. **Mock Drift**: Mocked behavior may diverge from real implementation

## Alternatives Considered

### 1. Integration Testing Only
**Rejected**: Too slow and doesn't provide granular shortcut testing

### 2. E2E Testing with Real Terminal
**Rejected**: Complex setup, platform-specific issues, slow execution

### 3. Snapshot Testing
**Rejected**: Doesn't capture keyboard interaction behavior

## Implementation Checklist

- [ ] Create `AgentTerminalPanel.keyboard-accessibility.test.tsx`
- [ ] Implement useInput mock infrastructure
- [ ] Add keyboard shortcut tests (Enter, Space, M, Escape, -, +)
- [ ] Add state transition matrix tests
- [ ] Add controlled mode tests
- [ ] Add uncontrolled mode tests
- [ ] Add terminal feedback tests
- [ ] Add edge case tests
- [ ] Verify all tests pass
- [ ] Update test coverage metrics

## References

- `packages/cli/src/ui/components/__tests__/CollapsibleSection.keyboard-accessibility.test.tsx`
- `packages/cli/src/ui/components/agents/__tests__/SubtaskTree.keyboard.test.tsx`
- `packages/cli/src/ui/components/__tests__/AgentThoughts.keyboard-integration.test.tsx`
- Ink useInput documentation: https://github.com/vadimdemedes/ink#useinputinputhandler-options
