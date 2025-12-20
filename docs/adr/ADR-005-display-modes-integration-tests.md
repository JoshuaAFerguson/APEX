# ADR-005: Display Modes v0.3.0 Integration Tests Architecture

## Status
**Proposed** - December 2024

## Context

The display modes feature (v0.3.0) introduces `/compact` and `/verbose` commands that toggle between three display modes: `normal`, `compact`, and `verbose`. The acceptance criteria for integration tests are:

1. Integration tests exist covering `/compact` and `/verbose` command toggling
2. Display mode state persistence in session
3. Component rendering changes in compact vs verbose vs normal modes
4. StatusBar/ActivityLog/AgentPanel mode-aware rendering

After analyzing the existing codebase, we found **comprehensive test coverage already exists**:

### Existing Test Files
| File | Lines | Coverage Area |
|------|-------|---------------|
| `display-modes.integration.test.ts` | ~850 | Command execution, state management, component adaptation, edge cases |
| `display-mode-acceptance.test.ts` | ~607 | All 4 acceptance criteria validation |
| `display-mode-edge-cases.test.ts` | ~800 | Input validation, memory constraints, concurrency, error recovery |
| `display-mode-session-persistence.test.ts` | ~580 | Session storage, restoration, lifecycle |
| `repl-display-modes-integration.test.ts` | ~630 | REPL integration, event handling, error recovery |
| `AgentPanel.display-modes.test.tsx` | ~570 | Component-level display mode transitions |

**Total: ~4,000 lines of display mode tests**

## Decision

**No new integration tests are required.** The existing test suite comprehensively covers all acceptance criteria.

### Test Architecture Analysis

#### 1. Command Toggling (`/compact` and `/verbose`)
**Coverage Location**:
- `display-modes.integration.test.ts` (lines 57-250)
- `display-mode-acceptance.test.ts` (lines 185-298)
- `repl-display-modes-integration.test.ts` (lines 77-248)

**Test Patterns**:
```typescript
// Toggle from normal to compact
mockApp.getState.mockReturnValue({ displayMode: 'normal' });
await handleCompactCommand();
expect(mockApp.updateState).toHaveBeenCalledWith({ displayMode: 'compact' });

// Toggle from compact back to normal
mockApp.getState.mockReturnValue({ displayMode: 'compact' });
await handleCompactCommand();
expect(mockApp.updateState).toHaveBeenCalledWith({ displayMode: 'normal' });

// Cross-mode transitions (verbose -> compact)
mockApp.getState.mockReturnValue({ displayMode: 'verbose' });
await handleCompactCommand();
expect(mockApp.updateState).toHaveBeenCalledWith({ displayMode: 'compact' });
```

#### 2. Session State Persistence
**Coverage Location**:
- `display-mode-session-persistence.test.ts` (complete file)
- `display-mode-acceptance.test.ts` (lines 300-364)
- `display-modes.integration.test.ts` (lines 487-565)

**Test Patterns**:
```typescript
// Save and restore display mode
await displayModeManager.setDisplayMode('compact');
const savedMode = await sessionStore.getDisplayMode();
expect(savedMode).toBe('compact');

// Restore on initialization
await sessionStore.setDisplayMode('verbose');
const newManager = new DisplayModeManager(sessionStore);
await newManager.initialize();
expect(newManager.getDisplayMode()).toBe('verbose');

// Handle invalid/corrupted data
mockSessionStore.loadSession.mockReturnValue({ displayMode: 'invalid' });
sessionManager.load();
expect(sessionManager.getDisplayMode()).toBe('normal'); // Fallback
```

#### 3. Component Rendering by Mode
**Coverage Location**:
- `display-mode-acceptance.test.ts` (lines 366-534)
- `display-modes.integration.test.ts` (lines 313-485)
- `AgentPanel.display-modes.test.tsx` (complete file)

**Test Patterns**:
```typescript
// StatusBar adaptation
const statusBar = StatusBarComponent({ displayMode: 'compact' });
expect(statusBar.layout).toBe('single-line');
expect(statusBar.showDetails).toBe(false);
expect(statusBar.elements).toEqual(['model', 'status']);

// ActivityLog filtering
const activityLog = ActivityLogComponent({ displayMode: 'compact', entries });
expect(activityLog.entries).toHaveLength(2); // High priority only
expect(activityLog.entries.every(e => !e.showTimestamp)).toBe(true);

// AgentPanel transitions
rerender(<AgentPanel displayMode="verbose" />);
expect(screen.getByText('🔢 Tokens: 15.0k→12.0k')).toBeInTheDocument();
```

#### 4. Mode-Aware Component Rendering
**Coverage Location**:
- `AgentPanel.display-modes.test.tsx` (lines 83-386)
- `display-mode-acceptance.test.ts` (lines 491-534)

**Test Patterns**:
```typescript
// Cross-component consistency
const modes: DisplayMode[] = ['normal', 'compact', 'verbose'];
modes.forEach(mode => {
  const statusBar = StatusBarComponent({ displayMode: mode });
  const activityLog = ActivityLogComponent({ displayMode: mode, entries: [] });
  expect(activityLog.mode).toBe(mode);
  // Mode-specific assertions...
});

// Rapid mode switching
const modes: DisplayMode[] = ['normal', 'verbose', 'compact', 'normal', 'verbose'];
modes.forEach((mode) => {
  component.rerender(<AgentPanel displayMode={mode} />);
  expect(screen.getByText('developer')).toBeInTheDocument();
  // Mode-specific feature checks...
});
```

### Test Infrastructure

#### Test Utilities (`test-utils.tsx`)
- Custom `render` function with ThemeProvider wrapper
- Mock Ink hooks (`mockUseInput`, `mockUseStdout`)
- Timer utilities (`advanceTimers`, `waitFor`)
- Re-exports from `@testing-library/react`

#### Vitest Configuration
```typescript
{
  globals: true,
  environment: 'node',
  include: [
    'packages/*/src/**/*.test.ts',
    'packages/*/src/**/*.integration.test.ts'
  ]
}
```

#### Mocking Patterns
```typescript
// App context mock
const mockApp = {
  getState: vi.fn(() => ({ displayMode: 'normal' })),
  updateState: vi.fn(),
  addMessage: vi.fn(),
};

// Session store mock
const mockSessionStore = {
  save: vi.fn(),
  load: vi.fn(),
  getDisplayMode: vi.fn(),
  setDisplayMode: vi.fn(),
};

// Hook mocks for component tests
vi.doMock('../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: mockUseAgentHandoff,
}));
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Display Mode Test Architecture               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Integration Test Suite                        │   │
│  │  display-modes.integration.test.ts (command + state)       │   │
│  │  repl-display-modes-integration.test.ts (REPL + events)   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                      │
│           ┌───────────────┼───────────────┐                     │
│           ▼               ▼               ▼                     │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Acceptance  │  │   Session    │  │  Edge Cases  │           │
│  │   Tests     │  │ Persistence  │  │   & Errors   │           │
│  └─────────────┘  └──────────────┘  └──────────────┘           │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Component Test Suite                          │   │
│  │  AgentPanel.display-modes.test.tsx                         │   │
│  │  StatusBar + ActivityLog (via integration tests)          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Shared Test Infrastructure                    │   │
│  │  test-utils.tsx (render, mocks, utilities)                │   │
│  │  vitest.config.ts (configuration)                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Consequences

### Positive
- All acceptance criteria are already fully covered
- Tests follow established patterns (Vitest, mock-based, AAA pattern)
- Good separation between unit, integration, and component tests
- Comprehensive edge case coverage including:
  - Input validation and sanitization
  - Memory constraints and performance
  - Concurrent operations and race conditions
  - System failures and recovery
  - Malformed data handling

### Negative
- Some test files duplicate mock implementations (could be consolidated)
- Component tests in `AgentPanel.display-modes.test.tsx` require JSX/TSX (different from pure TS tests)

### Neutral
- Tests use mock implementations rather than actual component rendering
- This is acceptable for integration testing focused on behavior, not visual output

## Recommendations

1. **Run existing tests to verify coverage**:
   ```bash
   npm test --workspace=@apex/cli
   ```

2. **Consider consolidating mocks** into shared fixtures if adding new tests

3. **For visual testing** of actual component output, consider adding:
   - Snapshot tests for rendered output
   - Visual regression testing (optional)

## References

- [Vitest Documentation](https://vitest.dev/)
- [Testing Library](https://testing-library.com/)
- Existing test files in `packages/cli/src/__tests__/`
