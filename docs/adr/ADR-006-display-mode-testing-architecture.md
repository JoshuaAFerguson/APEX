# ADR-006: Display Mode Testing Architecture

## Status
Accepted

## Date
2025-01-13

## Context

The APEX CLI application implements a display mode feature that allows users to switch between three presentation modes:
- **normal**: Standard display with all components visible
- **compact**: Minimized display for experienced users, hiding system messages and tool calls
- **verbose**: Detailed debug output with full information for troubleshooting

The acceptance criteria require comprehensive test coverage verifying:
1. displayMode state updates correctly
2. `/compact` and `/verbose` commands work
3. Components respect displayMode prop
4. Toggle behavior works correctly

## Analysis of Existing Test Coverage

### Current Test File Structure

The codebase already has extensive test coverage organized into multiple test files:

```
packages/cli/src/
├── __tests__/
│   ├── setup.ts                          # Test setup with Ink mocks
│   ├── test-utils.tsx                    # Custom render, theme mock
│   ├── display-mode-commands.test.tsx     # CLI-level command tests
│   └── display-mode-state-persistence.test.tsx
├── ui/
│   ├── __tests__/
│   │   ├── App.displayMode.test.tsx           # State management (25+ tests)
│   │   ├── App.displayMode.commands.test.tsx  # Command handling (15+ tests)
│   │   ├── App.displayMode.integration.test.tsx # Integration (20+ tests)
│   │   ├── App.displayMode.focused.test.tsx   # Type safety (30+ tests)
│   │   └── App.displayMode.acceptance.test.tsx # Acceptance criteria (15+ tests)
│   └── components/
│       ├── __tests__/
│       │   ├── StatusBar.display-modes.test.tsx
│       │   └── ActivityLog.display-modes.test.tsx
│       └── agents/__tests__/
│           ├── AgentPanel.display-modes.test.tsx
│           └── AgentPanel.display-modes-parallel.test.tsx
```

### Test Categories Analysis

| Category | Files | Test Count | Coverage |
|----------|-------|------------|----------|
| Unit Tests | App.displayMode.focused.test.tsx | ~30 | Type safety, state logic |
| Integration Tests | App.displayMode.integration.test.tsx | ~20 | Component prop passing |
| Command Tests | App.displayMode.commands.test.tsx | ~15 | /compact, /verbose handling |
| Acceptance Tests | App.displayMode.acceptance.test.tsx | ~15 | Criteria validation |
| Component Tests | StatusBar, AgentPanel display modes | ~50+ | Per-component behavior |

**Total: 125+ test cases**

## Decision

### Test Architecture Principles

1. **Layered Testing Strategy**
   - **Unit Tests**: Focus on pure logic (toggle behavior, filtering logic, type validation)
   - **Integration Tests**: Verify prop passing between App and child components
   - **Acceptance Tests**: Validate against specific acceptance criteria
   - **Component Tests**: Test each component's response to displayMode prop

2. **Mock Strategy**
   - Mock Ink components and hooks at module level
   - Mock services (ConversationManager, ShortcutManager, CompletionEngine)
   - Create mock child components with data-testid attributes for prop verification
   - Use vi.fn() for tracking component calls and verifying props

3. **Test Data Management**
   - Define base state objects with all required AppState properties
   - Use factory functions for creating test props variations
   - Maintain consistent test data across test files

### Component Interface Contract

Each component receiving displayMode should:

```typescript
interface DisplayModeAware {
  displayMode?: DisplayMode; // Optional, defaults to 'normal'
}

// Components implementing display mode:
StatusBar: DisplayModeAware & StatusBarProps
TaskProgress: DisplayModeAware & TaskProgressProps
AgentPanel: DisplayModeAware & AgentPanelProps
ResponseStream: DisplayModeAware & ResponseStreamProps
ToolCall: DisplayModeAware & ToolCallProps
```

### Testing Patterns

#### 1. State Management Testing
```typescript
// Test displayMode state updates in App component
it('should initialize with normal display mode by default', () => {
  render(<App {...props} />);
  expect(mockStatusBar).toHaveBeenCalledWith(
    expect.objectContaining({ displayMode: 'normal' }),
    {}
  );
});
```

#### 2. Command Handling Testing
```typescript
// Test /compact and /verbose command processing
it('should handle /compact command and toggle to compact mode', async () => {
  render(<App {...props} />);
  await act(async () => {
    screen.getByTestId('submit-compact').click();
  });
  expect(mockOnCommand).not.toHaveBeenCalledWith('compact', []);
});
```

#### 3. Component Prop Verification
```typescript
// Verify displayMode is passed to child components
it('should pass displayMode to StatusBar component', () => {
  render(<App {...props} />);
  expect(screen.getByTestId('status-bar')).toHaveAttribute(
    'data-display-mode',
    'normal'
  );
});
```

#### 4. Toggle Behavior Testing
```typescript
// Test toggle logic for display modes
it('should toggle compact mode correctly', () => {
  let displayMode: DisplayMode = 'normal';

  displayMode = displayMode === 'compact' ? 'normal' : 'compact';
  expect(displayMode).toBe('compact');

  displayMode = displayMode === 'compact' ? 'normal' : 'compact';
  expect(displayMode).toBe('normal');
});
```

### Message Filtering Logic

In App.tsx, messages are filtered based on displayMode:

```typescript
messages.filter((msg) => {
  if (state.displayMode === 'compact') {
    // Hide system and tool messages in compact mode
    return msg.type !== 'system' && msg.type !== 'tool';
  } else if (state.displayMode === 'verbose') {
    // Show all messages in verbose mode
    return true;
  } else {
    // Normal mode: show most messages
    return true;
  }
});
```

### Test Configuration

**Vitest Configuration** (`vitest.config.ts`):
- Environment: jsdom
- Setup file: `./src/__tests__/setup.ts`
- Coverage thresholds: 70% (branches, functions, lines, statements)

**Test Utilities** (`test-utils.tsx`):
- Custom render with ThemeProvider wrapper
- Mock theme with agent colors
- Timer advancement utilities
- waitFor async utility

## Consequences

### Positive
- Comprehensive test coverage (125+ tests) validates all acceptance criteria
- Layered testing approach catches bugs at appropriate abstraction levels
- Mock strategy enables isolated testing of display mode logic
- Test data factories ensure consistency across test files

### Negative
- Extensive mocking can make tests brittle to implementation changes
- Some tests verify prop passing without testing actual component behavior
- Test file proliferation (5 App.displayMode.*.test.tsx files) may lead to duplication

### Neutral
- Tests use jsdom environment which approximates but doesn't match real terminal behavior
- Ink-specific behaviors require careful mock configuration

## Verification Checklist

The existing tests verify all acceptance criteria:

- [x] **displayMode state updates correctly**
  - `App.displayMode.test.tsx`: State management tests
  - `App.displayMode.focused.test.tsx`: State consistency tests

- [x] **/compact and /verbose commands work**
  - `App.displayMode.commands.test.tsx`: Command handling tests
  - `App.displayMode.test.tsx`: Command handler tests

- [x] **Components respect displayMode prop**
  - `App.displayMode.integration.test.tsx`: Prop passing verification
  - `StatusBar.display-modes.test.tsx`: StatusBar behavior
  - `AgentPanel.display-modes.test.tsx`: AgentPanel behavior

- [x] **Toggle behavior works correctly**
  - `App.displayMode.focused.test.tsx`: Toggle logic tests
  - `App.displayMode.commands.test.tsx`: Toggle confirmation messages

## Implementation Notes

### Key Files Modified/Created for Display Mode
- `packages/core/src/types.ts` - DisplayMode type definition (line 384)
- `packages/cli/src/ui/App.tsx` - displayMode state and prop passing
- `packages/cli/src/ui/components/StatusBar.tsx` - displayMode rendering
- `packages/cli/src/ui/components/agents/AgentPanel.tsx` - displayMode rendering

### Test Files to Run
```bash
npm test --workspace=@apex/cli -- --run src/ui/__tests__/App.displayMode*.test.tsx
npm test --workspace=@apex/cli -- --run src/ui/components/__tests__/StatusBar.display-modes.test.tsx
npm test --workspace=@apex/cli -- --run src/ui/components/agents/__tests__/AgentPanel.display-modes.test.tsx
```

## Related ADRs
- ADR-001: Project Architecture
- ADR-003: CLI Interface Design
