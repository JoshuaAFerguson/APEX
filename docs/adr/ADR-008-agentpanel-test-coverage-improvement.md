# ADR-008: AgentPanel Test Coverage Improvement for Handoff and Parallel Features

## Status
Proposed

## Date
2024-12-12

## Context

The AgentPanel component has been enhanced with two major features:
1. **Handoff Animations** - Visual transitions when agents change
2. **Parallel Execution View** - Display of concurrent agent operations

The acceptance criteria require comprehensive test coverage for:
- Handoff animation display/hide timing
- Parallel execution view rendering
- New props (`previousAgent`, `showParallel`, `parallelAgents`)
- Edge cases (single parallel agent, no parallel agents)

### Current Test Coverage Analysis

After analyzing the existing test files, the current coverage is already quite comprehensive:

#### AgentPanel.test.tsx (Main Unit Tests)
- Basic rendering (full panel and compact mode)
- Agent status handling (all 5 status types including `parallel`)
- Agent colors (known and unknown agents)
- Progress handling (0%, 50%, 100%, undefined)
- Stage display
- Edge cases (long names, special characters, missing currentAgent)
- Accessibility
- Handoff hook integration (vi.doMock pattern)
- Parallel execution functionality

#### AgentPanel.integration.test.tsx
- Agent transition workflow with timing
- Mode switching during animation
- Performance and memory (cleanup on unmount)
- Accessibility during animation

#### AgentPanel.visual-integration.test.tsx
- Visual animation timing phases
- Complex transition scenarios
- Error recovery and robustness

#### AgentPanel.parallel-edge-cases.test.tsx
- Mixed agent states with parallel
- Progress edge cases (0%, 100%, undefined)
- Stage edge cases (empty, long, special chars)
- Color handling for parallel agents
- Handoff animation with parallel execution

#### AgentPanel.parallel-integration.test.tsx
- Real-world workflow scenarios
- State transitions (sequential to parallel, parallel completion)
- Error and recovery scenarios

#### AgentPanel.parallel-visual.test.tsx
- Visual layout and spacing
- Compact mode formatting
- Unicode and special character handling
- Color accessibility
- Responsive layout

#### HandoffIndicator.test.tsx
- Rendering conditions
- Compact vs full mode
- Fade threshold behavior
- Agent color handling
- Progress edge cases
- Accessibility

## Analysis: Gaps in Current Coverage

Based on acceptance criteria review, the following gaps or improvements were identified:

### 1. Missing `previousAgent` Prop Tests
**Current State:** The `previousAgent` is part of the `HandoffAnimationState` from the hook, not a direct prop on `AgentPanel`. The component uses `useAgentHandoff(currentAgent)` internally.

**Gap Assessment:** The acceptance criteria mentions `previousAgent` as a new prop, but examining the implementation shows it's derived from the hook state. Tests already cover this through `mockUseAgentHandoff` patterns.

**Recommendation:** No new tests needed - the current mock-based testing adequately covers this. However, we should document this architectural decision.

### 2. Handoff Animation Timing Tests
**Current Coverage:**
- Animation start/end verification ✅
- Fade phase timing ✅
- 2-second duration ✅

**Potential Gaps:**
- Animation timing precision at exact millisecond boundaries
- Animation interruption and restart timing
- Timing behavior when rapidly switching agents

**Recommendation:** Add specific timing boundary tests in integration test file.

### 3. Parallel Execution Edge Cases
**Current Coverage:**
- Single parallel agent ✅
- No parallel agents ✅
- Empty parallelAgents array ✅

**Potential Gaps:**
- `parallelAgents` with exactly 2 agents (boundary)
- `showParallel=true` with undefined `parallelAgents`
- Transition from 1 to 2+ parallel agents during render

**Recommendation:** Add specific boundary tests.

### 4. Combined Handoff + Parallel Scenarios
**Current Coverage:**
- Basic combined scenarios ✅

**Potential Gaps:**
- Handoff animation to/from a parallel agent
- Multiple rapid handoffs during parallel execution
- Parallel section visibility during handoff animation phases

**Recommendation:** Add comprehensive combined scenario tests.

## Decision

### Test Architecture

The test structure should follow a layered approach:

```
AgentPanel Tests/
├── AgentPanel.test.tsx           # Unit tests (props, rendering, state)
├── AgentPanel.integration.test.tsx      # Component integration
├── AgentPanel.visual-integration.test.tsx # Visual behavior
├── AgentPanel.parallel-*.test.tsx       # Parallel-specific tests
└── AgentPanel.handoff-timing.test.tsx   # NEW: Precise timing tests
```

### Proposed New Tests

#### File: AgentPanel.handoff-timing.test.tsx

```typescript
describe('AgentPanel - Handoff Animation Timing Precision', () => {
  describe('animation timing boundaries', () => {
    it('verifies animation starts at exactly 0ms after agent change');
    it('verifies fade phase begins at exactly 1500ms (duration - fadeDuration)');
    it('verifies animation completes at exactly 2000ms');
    it('verifies progress values at 100ms intervals');
  });

  describe('animation interruption timing', () => {
    it('interrupts and restarts animation when agent changes mid-animation');
    it('preserves timing accuracy after interruption');
    it('handles sub-100ms agent changes');
  });

  describe('animation with parallel execution timing', () => {
    it('maintains handoff timing when showParallel changes during animation');
    it('maintains handoff timing when parallelAgents updates during animation');
  });
});
```

#### Updates to AgentPanel.parallel-edge-cases.test.tsx

Add boundary tests:
```typescript
describe('parallel execution boundary cases', () => {
  it('handles exactly 2 parallel agents (minimum for display)');
  it('handles undefined parallelAgents prop with showParallel=true');
  it('handles transition from 1 to 2 parallel agents');
  it('handles transition from 2+ to 1 parallel agent');
});
```

### Test Implementation Guidelines

1. **Use vi.useFakeTimers()** for all timing-related tests
2. **Use vi.doMock()** pattern for hook mocking (already established)
3. **Use act()** for timer advancement and re-renders
4. **Use waitFor()** for async assertions

### Mock Strategy

```typescript
// Standard mock for useAgentHandoff
const mockUseAgentHandoff = vi.fn().mockReturnValue({
  isAnimating: false,
  previousAgent: null,
  currentAgent: null,
  progress: 0,
  isFading: false,
});

vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: mockUseAgentHandoff,
}));
```

## Implementation Plan

### Phase 1: Audit Existing Tests
1. Review all existing test files for completeness
2. Identify any test assertions that may be weak or incomplete
3. Document coverage gaps

### Phase 2: Add Missing Tests
1. Create `AgentPanel.handoff-timing.test.tsx` with precise timing tests
2. Add boundary tests to `AgentPanel.parallel-edge-cases.test.tsx`
3. Add combined handoff+parallel tests

### Phase 3: Strengthen Existing Tests
1. Add more specific assertions where tests only verify "renders without crash"
2. Add progress value assertions at specific time points
3. Add animation state transition assertions

## Consequences

### Positive
- Comprehensive coverage ensures regression protection
- Precise timing tests catch animation timing bugs
- Edge case coverage prevents UI glitches

### Negative
- More tests increase CI run time
- Complex mocking patterns require maintenance
- Timing tests can be flaky if not properly isolated

### Mitigations
- Use consistent fake timer patterns to prevent flakiness
- Document mock patterns for future maintainers
- Group related tests to minimize setup overhead

## Test File Summary

| File | Purpose | Priority |
|------|---------|----------|
| AgentPanel.test.tsx | Core unit tests | Existing - Review |
| AgentPanel.integration.test.tsx | Component integration | Existing - Review |
| AgentPanel.handoff-timing.test.tsx | Precise timing tests | NEW - Create |
| AgentPanel.parallel-edge-cases.test.tsx | Parallel boundaries | Existing - Extend |
| AgentPanel.parallel-integration.test.tsx | Parallel workflows | Existing - Review |

## Technical Notes

### AgentPanel Props Interface
```typescript
interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;        // Drives handoff animation via hook
  compact?: boolean;            // Layout mode
  showParallel?: boolean;       // Toggle parallel section
  parallelAgents?: AgentInfo[]; // Agents in parallel execution
}
```

### Key Implementation Details
- `previousAgent` is NOT a prop - it's derived from `useAgentHandoff` hook state
- Parallel section only shows when `showParallel=true` AND `parallelAgents.length > 1`
- Handoff animation uses 2000ms total duration with 500ms fade phase
- Both full and compact modes support handoff animation and parallel execution

## Conclusion

The current test coverage is already quite comprehensive. The main additions needed are:
1. A new timing precision test file
2. Additional boundary tests for parallel execution
3. Strengthening of some existing assertions

All tests should pass with the current implementation.
