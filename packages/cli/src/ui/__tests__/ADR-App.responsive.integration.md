# ADR: App.tsx Responsive Layout Integration Tests

## Status
Proposed

## Date
2024-12-18

## Context

We need comprehensive integration tests for `App.tsx` that verify responsive layout behavior across various terminal widths. The acceptance criteria require:

1. Testing App.tsx rendering at various terminal widths (40, 60, 100, 160, 200 cols)
2. Verifying no visual overflow/truncation at any width
3. Confirming all components adapt correctly together
4. Testing width resize scenarios if possible

### Current Testing Infrastructure

The project uses:
- **Vitest** as the test runner
- **@testing-library/react** for component testing
- **ink-testing-library** for terminal-specific output testing
- **vitest mocks** for hooks and dependencies

### Responsive System Analysis

**Breakpoint Thresholds** (from `useStdoutDimensions`):
| Breakpoint | Width Range | Boolean Helper |
|-----------|-------------|----------------|
| narrow    | < 60 cols   | `isNarrow`     |
| compact   | 60-99 cols  | `isCompact`    |
| normal    | 100-159 cols| `isNormal`     |
| wide      | >= 160 cols | `isWide`       |

**App.tsx Component Tree**:
```
App
├── Banner (version, project path, initialization)
├── ServicesPanel (API/Web URLs - conditional)
├── PreviewPanel (conditional, preview mode)
├── Help Overlay (conditional)
├── Messages Area
│   ├── ResponseStream (text messages)
│   ├── ToolCall (tool invocations)
│   └── ThoughtDisplay (AI reasoning)
├── TaskProgress (current task status)
├── AgentPanel (active/parallel agents)
├── InputPrompt (user input)
└── StatusBar (metrics, status indicators)
```

### Test File Locations

Existing responsive tests:
- `packages/cli/src/ui/components/__tests__/Banner.responsive.test.tsx`
- `packages/cli/src/ui/components/__tests__/TaskProgress.responsive.test.tsx`
- `packages/cli/src/ui/components/__tests__/StatusBar.responsive.test.tsx`

Integration tests location:
- `packages/cli/src/ui/__tests__/` (for App-level tests)

## Decision

### 1. Test File Structure

Create a new test file: `packages/cli/src/ui/__tests__/App.responsive.integration.test.tsx`

The test file will follow the established pattern from existing responsive tests:
- Mock `useStdoutDimensions` at module level
- Create helper function for dimension mocking
- Organize tests by width breakpoints and scenarios

### 2. Testing Approach

**A. Width-Based Testing Matrix**

Test at these specific widths to cover all acceptance criteria:
| Width | Breakpoint | Purpose |
|-------|-----------|---------|
| 40    | narrow    | Minimum usable width, extreme constraint |
| 60    | compact   | Boundary between narrow/compact |
| 100   | normal    | Boundary between compact/normal |
| 160   | wide      | Boundary between normal/wide |
| 200   | wide      | Very wide terminal |

**B. Component Integration Verification**

For each width, verify:
1. All child components render without errors
2. `displayMode` propagates correctly to all children
3. Components use appropriate layouts for breakpoint
4. No content overflow or truncation issues
5. Critical content remains visible

**C. Resize Scenario Testing**

Using `rerender()` with updated mock values to simulate:
- Narrow → Wide transitions
- Wide → Narrow transitions
- Crossing breakpoint boundaries
- Rapid sequential resizes

### 3. Mock Strategy

**Module-Level Mocks Required**:
```typescript
// useStdoutDimensions - Core responsive hook
vi.mock('../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: vi.fn(),
}));

// ink - Terminal UI framework
vi.mock('ink', async () => {
  const actual = await vi.importActual('ink');
  return {
    ...actual,
    useInput: vi.fn(),
    useApp: () => ({ exit: vi.fn() }),
    useStdout: () => ({ stdout: { columns: 80 } }),
  };
});

// Services - ConversationManager, ShortcutManager, CompletionEngine
```

**Helper Function Pattern**:
```typescript
const mockDimensions = (width: number, height = 24) => {
  const breakpoint = width < 60 ? 'narrow'
    : width < 100 ? 'compact'
    : width < 160 ? 'normal'
    : 'wide';

  mockUseStdoutDimensions.mockReturnValue({
    width,
    height,
    breakpoint,
    isNarrow: width < 60,
    isCompact: width >= 60 && width < 100,
    isNormal: width >= 100 && width < 160,
    isWide: width >= 160,
    isAvailable: true,
  });
};
```

### 4. Test Categories

#### Category 1: Width Breakpoint Tests
Test that components render correctly at each target width:
- `40 columns (narrow)`: All components adapt to minimal layout
- `60 columns (compact)`: Components switch from narrow to compact
- `100 columns (normal)`: Components use standard layout
- `160 columns (wide)`: Components expand to full layout
- `200 columns (wide)`: Very wide, no issues

#### Category 2: Component Adaptation Tests
For each breakpoint, verify:
- Banner: ASCII art vs compact box vs text-only
- StatusBar: Full labels vs abbreviated vs minimal
- TaskProgress: Full vs truncated task info
- AgentPanel: Expanded vs compact agent list
- Messages: Full content vs truncated

#### Category 3: Transition Tests
- Test crossing each breakpoint boundary
- Test rerender behavior on width change
- Verify components update correctly

#### Category 4: Edge Case Tests
- Zero width handling
- Very narrow (< 20)
- Very wide (> 300)
- Missing/unavailable dimensions

#### Category 5: DisplayMode + Width Interaction
- Test width adaptation in each displayMode (normal, compact, verbose)
- Verify auto-compact behavior (narrow width forces compact layout)

### 5. Assertion Strategy

**A. Render Verification**
```typescript
expect(() => render(<App {...props} />)).not.toThrow();
```

**B. Component Presence**
```typescript
expect(screen.getByTestId('status-bar')).toBeInTheDocument();
expect(screen.getByTestId('banner')).toBeInTheDocument();
```

**C. Breakpoint Props**
```typescript
expect(mockStatusBar).toHaveBeenCalledWith(
  expect.objectContaining({ displayMode: 'normal' }),
  {}
);
```

**D. Content Adaptation**
```typescript
// In narrow mode, abbreviated labels
expect(screen.getByText('$0.05')).toBeInTheDocument();
expect(screen.queryByText('Cost: $0.05')).not.toBeInTheDocument();
```

**E. Transition Verification**
```typescript
const { rerender } = render(<App {...props} />);
// Verify initial state
expect(screen.getByTestId('compact-layout')).toBeInTheDocument();

// Resize
mockDimensions(160);
rerender(<App {...props} />);

// Verify updated state
expect(screen.getByTestId('full-layout')).toBeInTheDocument();
```

### 6. Height Considerations

While the primary focus is width, also test:
- Standard height (24 rows)
- Short terminals (12 rows) - may limit visible content
- Tall terminals (50 rows) - may show more subtasks

### 7. Performance Considerations

- Use `vi.useFakeTimers()` to control timing-dependent behavior
- Clear mocks between tests to prevent interference
- Limit message array size to prevent slow renders

## Alternatives Considered

### A. Using ink-testing-library exclusively
**Rejected**: While `ink-testing-library` provides `lastFrame()` for terminal output, it's better suited for output format testing. For integration tests verifying component interactions, `@testing-library/react` with mocked components provides better control.

### B. Testing each component in isolation
**Rejected**: Component-level responsive tests already exist. This task specifically requires integration testing to verify components work together correctly.

### C. Snapshot testing for each width
**Rejected**: Snapshots are brittle for responsive tests and don't clearly communicate intent. Explicit assertions are more maintainable.

## Consequences

### Positive
- Comprehensive coverage of responsive behavior at App level
- Clear regression detection for layout issues
- Tests serve as documentation for responsive behavior
- Consistent with existing test patterns in codebase

### Negative
- Additional test file to maintain
- Mocking overhead for complex component tree
- Tests may need updating when component API changes

### Neutral
- Test file size will be substantial (~400-600 lines)
- Run time ~2-5 seconds for full suite

## Implementation Notes

### File Location
```
packages/cli/src/ui/__tests__/App.responsive.integration.test.tsx
```

### Test Execution
```bash
npm test --workspace=@apex/cli -- App.responsive
```

### Dependencies
- vitest
- @testing-library/react
- Existing test utilities from `test-utils.tsx`

## Related Documents
- `packages/cli/src/ui/hooks/ADR-useStdoutDimensions.md`
- `packages/cli/src/ui/components/__tests__/Banner.responsive.test.tsx` (reference pattern)
- `packages/cli/src/ui/components/__tests__/TaskProgress.responsive.test.tsx` (reference pattern)
