# ADR-001: Integration Test Architecture for Agent Components Responsive Composition

## Status
Proposed

## Date
2024-01-01

## Context

The APEX CLI includes several agent-related UI components that need comprehensive integration testing for responsive composition:

1. **AgentPanel** (`packages/cli/src/ui/components/agents/AgentPanel.tsx`)
   - Main component orchestrating agent status display
   - Implements responsive layout via breakpoint system (narrow < 60, compact 60-100, normal 100-160, wide >= 160)
   - Contains nested components: CompactAgentPanel, DetailedAgentPanel, ResponsiveAgentRow, ResponsiveParallelSection
   - Uses `useStdoutDimensions` hook for terminal width detection

2. **AgentThoughts** (`packages/cli/src/ui/components/AgentThoughts.tsx`)
   - Collapsible section for displaying agent reasoning
   - Uses CollapsibleSection wrapper for expand/collapse functionality
   - Hidden in compact display mode
   - Implements text truncation (500 chars normal, 1000 chars verbose)

3. **ThoughtDisplay** (`packages/cli/src/ui/components/ThoughtDisplay.tsx`)
   - Simpler thought display without collapsible functionality
   - Hidden in compact mode
   - Text wrapping via `wrap="wrap"` attribute
   - Truncation limits: 300 chars (normal), 1000 chars (verbose)

4. **ParallelExecutionView** (`packages/cli/src/ui/components/agents/ParallelExecutionView.tsx`)
   - Grid layout for parallel agent execution visualization
   - Dynamic column calculation: `calculateMaxColumns(width, isNarrow, isCompact, isNormal, isWide, compact)`
   - Card-based layout with minWidth constraints (16px compact, 24px full)

### Current Testing Gaps

Existing tests cover:
- Basic responsive behavior per-breakpoint
- Hook mocking for `useStdoutDimensions`
- Display mode switching

Missing integration tests for:
1. **Cross-component composition** - How components work together at different breakpoints
2. **Overflow prevention validation** - Systematic verification across all breakpoints
3. **Column calculation correctness** - ParallelExecutionView's column math
4. **Thought wrap behavior** - Proper text wrapping in constrained widths
5. **Responsive composition under stress** - Many agents, long text, edge cases

## Decision

Create a new integration test file: `AgentPanel.responsive-composition-integration.test.tsx`

### Test Architecture

#### 1. Test Harness Setup

```typescript
// Centralized mock configuration for responsive testing
interface ResponsiveMockConfig {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isNarrow: boolean;
  isCompact: boolean;
  isNormal: boolean;
  isWide: boolean;
  isAvailable: boolean;
}

const BREAKPOINT_CONFIGS: Record<Breakpoint, ResponsiveMockConfig> = {
  narrow: { width: 50, height: 24, breakpoint: 'narrow', isNarrow: true, isCompact: false, isNormal: false, isWide: false, isAvailable: true },
  compact: { width: 80, height: 24, breakpoint: 'compact', isNarrow: false, isCompact: true, isNormal: false, isWide: false, isAvailable: true },
  normal: { width: 120, height: 30, breakpoint: 'normal', isNarrow: false, isCompact: false, isNormal: true, isWide: false, isAvailable: true },
  wide: { width: 180, height: 40, breakpoint: 'wide', isNarrow: false, isCompact: false, isNormal: false, isWide: true, isAvailable: true },
};
```

#### 2. Test Categories

**Category A: No Overflow at All Breakpoints**
- Parametric tests across all 4 breakpoints
- Line width verification against terminal width
- ANSI code stripping for accurate measurement
- Margin tolerance for edge cases (5 chars)

**Category B: ParallelExecutionView Column Calculations**
- Test column calculation formula: `Math.floor(width / cardWidth)`
- Verify minimum of 1 column guarantee
- Test card width constants (compact: 20, full: 28)
- Boundary testing at breakpoint transitions

**Category C: Thought Display Wrap Behavior**
- Text wrapping attribute verification
- Truncation at correct limits per display mode
- Hidden in compact mode verification
- Long text handling without horizontal overflow

**Category D: Component Composition Integration**
- AgentPanel + AgentThoughts integration
- AgentPanel + ParallelExecutionView composition
- Nested responsive behavior verification
- Display mode propagation through component tree

### Test Implementation Structure

```
packages/cli/src/ui/components/agents/__tests__/
├── AgentPanel.responsive-composition-integration.test.tsx  (NEW - main integration tests)
├── AgentThoughts.responsive.test.tsx                       (NEW - dedicated AgentThoughts tests)
├── ThoughtDisplay.responsive.test.tsx                      (NEW - dedicated ThoughtDisplay tests)
└── ParallelExecutionView.columns-integration.test.tsx      (NEW - column calculation tests)
```

### Key Test Patterns

#### Pattern 1: Overflow Prevention Matrix

```typescript
describe.each([
  ['narrow', 50],
  ['compact', 80],
  ['normal', 120],
  ['wide', 180],
] as const)('Breakpoint: %s (%d cols)', (breakpoint, width) => {
  it('renders AgentPanel without horizontal overflow', () => {
    mockUseStdoutDimensions(BREAKPOINT_CONFIGS[breakpoint]);
    const { lastFrame } = render(<AgentPanel agents={testAgents} />);
    assertNoOverflow(lastFrame(), width);
  });
});
```

#### Pattern 2: Column Calculation Verification

```typescript
describe('ParallelExecutionView column calculations', () => {
  it.each([
    // [width, compact, expectedColumns]
    [50, false, 1],   // narrow always 1
    [80, false, 2],   // compact: 2 for full
    [80, true, 1],    // compact: 1 for compact mode
    [120, false, 4],  // normal: 120/28 = 4
    [120, true, 6],   // normal: 120/20 = 6
    [200, false, 7],  // wide: 200/28 = 7
    [200, true, 10],  // wide: 200/20 = 10
  ])('width=%d, compact=%s -> columns=%d', (width, compact, expected) => {
    mockBreakpointForWidth(width);
    const { lastFrame } = render(
      <ParallelExecutionView agents={testAgents} compact={compact} />
    );
    assertColumnCount(lastFrame(), expected);
  });
});
```

#### Pattern 3: Thought Wrap Integration

```typescript
describe('ThoughtDisplay wrap behavior', () => {
  it('wraps text properly at all breakpoints', () => {
    const longThought = 'A'.repeat(200);
    BREAKPOINTS.forEach(bp => {
      mockUseStdoutDimensions(BREAKPOINT_CONFIGS[bp]);
      const { lastFrame } = render(
        <ThoughtDisplay thinking={longThought} agent="developer" />
      );
      if (bp !== 'narrow') { // Hidden in narrow/compact
        assertNoOverflow(lastFrame(), BREAKPOINT_CONFIGS[bp].width);
      }
    });
  });
});
```

### Mock Strategy

All tests should use Vitest mocking (consistent with existing codebase):

```typescript
vi.mock('../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: vi.fn(),
}));

vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: vi.fn(() => '1m 23s'),
}));

vi.mock('../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: vi.fn(() => ({
    currentAgent: null,
    handoffState: 'idle',
    timeInState: 0,
    isTransitioning: false,
  })),
}));
```

### Helper Functions

```typescript
// Strip ANSI codes for accurate width measurement
function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

// Assert no line exceeds terminal width
function assertNoOverflow(frame: string | undefined, maxWidth: number, tolerance = 5): void {
  if (!frame) throw new Error('Empty frame');
  const lines = frame.split('\n');
  lines.forEach((line, index) => {
    const cleanLength = stripAnsi(line).length;
    expect(cleanLength, `Line ${index + 1} overflow: ${cleanLength} > ${maxWidth}`).toBeLessThanOrEqual(maxWidth + tolerance);
  });
}

// Count visible columns in ParallelExecutionView output
function countColumns(frame: string): number {
  // Implementation based on parsing agent card layout
}
```

## Acceptance Criteria Mapping

| Criteria | Test Coverage |
|----------|---------------|
| Agent components render without overflow at all breakpoints | Category A tests with parametric breakpoint matrix |
| Parallel view column calculations work correctly | Category B tests with calculation verification |
| Thought displays wrap properly | Category C tests with wrap attribute and overflow checks |

## Consequences

### Positive
- Comprehensive coverage of responsive behavior
- Regression prevention for overflow issues
- Documentation of expected behavior at each breakpoint
- Consistent testing patterns for future responsive components

### Negative
- Increased test execution time due to parametric tests
- Maintenance burden for mock configurations
- Test coupling to specific implementation details (breakpoint thresholds)

### Mitigations
- Use `describe.each` for efficient parametric testing
- Centralize mock configurations for easy maintenance
- Document threshold values as constants matching source code

## Implementation Plan

1. Create test helper utilities in `packages/cli/src/ui/__tests__/responsive-test-utils.ts`
2. Implement `AgentPanel.responsive-composition-integration.test.tsx`
3. Implement `AgentThoughts.responsive.test.tsx`
4. Implement `ThoughtDisplay.responsive.test.tsx`
5. Implement `ParallelExecutionView.columns-integration.test.tsx`
6. Verify all acceptance criteria pass
7. Update test documentation

## References

- Existing responsive tests: `AgentPanel.responsive.test.tsx`, `TaskProgress.responsive.test.tsx`
- Hook implementation: `useStdoutDimensions.ts`
- Breakpoint system: `RESPONSIVE_CONFIGS` in `AgentPanel.tsx`
- Column calculation: `calculateMaxColumns` in `ParallelExecutionView.tsx`
