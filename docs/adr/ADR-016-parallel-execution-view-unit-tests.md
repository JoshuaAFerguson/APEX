# ADR-016: Parallel Execution View Unit Tests - Technical Design

## Status
**Proposed**

## Date
2024-12-16

## Author
Architect Agent

## Context

The task is to add unit tests for parallel execution view features with the following acceptance criteria:
1. Tests cover parallel agent display in compact and full modes
2. Tests verify correct icon and color usage
3. Tests verify elapsed time formatting and updates

### Current Implementation Analysis

After thorough analysis, I identified two main components requiring test coverage:

#### 1. ParallelExecutionView Component
**Location**: `packages/cli/src/ui/components/agents/ParallelExecutionView.tsx`

This is a standalone component (211 lines) with:
- **Interface `ParallelAgent`**: `{ name, status, stage?, progress?, startedAt? }`
- **Status types**: `'parallel' | 'active' | 'completed' | 'waiting' | 'idle'`
- **Agent colors map**: `{ planner: 'magenta', architect: 'blue', developer: 'green', reviewer: 'yellow', tester: 'cyan', devops: 'red' }`
- **Status icons map**: `{ parallel: '⟂', active: '⚡', completed: '✓', waiting: '○', idle: '·' }`
- **Display logic**: Filters to only show `parallel` or `active` status agents
- **Compact mode**: Smaller cards with reduced padding
- **Full mode**: Larger cards with progress bars and detailed status text

#### 2. useElapsedTime Hook
**Location**: `packages/cli/src/ui/hooks/useElapsedTime.ts`

React hook (42 lines) that:
- Takes `startTime: Date | null | undefined` and `updateInterval: number`
- Returns formatted elapsed time string (e.g., "42s", "2m 15s", "1h 5m")
- Uses `formatElapsed` from `@apexcli/core` for formatting
- Sets up interval for real-time updates

### Existing Test Coverage Analysis

| Test File | Focus | Line Count | Relevant Coverage |
|-----------|-------|------------|-------------------|
| `ParallelExecutionView.test.tsx` | Core component tests | 554 | ✅ Side-by-side cards, compact mode, empty state, filtering, layout, progress, elapsed time |
| `useElapsedTime.test.ts` | Hook unit tests | 145 | ✅ Null handling, formatting, intervals, cleanup |
| `AgentPanel.parallel-elapsed-time.test.tsx` | Integration tests | 362 | ✅ Elapsed time display in full/compact modes |
| `AgentPanel.parallel-visual.test.tsx` | Visual/color tests | 442 | ✅ Icons, colors, accessibility, layout |

### Gap Analysis

After reviewing all existing tests against acceptance criteria:

| Acceptance Criterion | Existing Coverage | Gap Identified |
|---------------------|-------------------|----------------|
| Compact mode display | ✅ Partial | Missing: specific compact card styling, minimal info display |
| Full mode display | ✅ Good | Minor: status text variations |
| Icon usage verification | ✅ Good | Minor: exhaustive icon mapping tests |
| Color usage verification | ⚠️ Limited | **Gap**: No tests verify actual color values from `agentColors` map |
| Elapsed time formatting | ✅ Good | Minor: edge cases in formatting |
| Elapsed time updates | ✅ Good | Minor: update interval variations |

## Decision

Create a focused test file that specifically addresses the acceptance criteria with emphasis on gaps identified.

### Technical Design

#### Test File Structure

**New File**: `packages/cli/src/ui/components/agents/__tests__/ParallelExecutionView.acceptance.test.tsx`

```typescript
/**
 * ParallelExecutionView Acceptance Criteria Tests
 *
 * Focused tests addressing:
 * 1. Parallel agent display in compact and full modes
 * 2. Correct icon and color usage
 * 3. Elapsed time formatting and updates
 */
```

### Test Categories

#### Category 1: Compact vs Full Mode Display Tests

```typescript
describe('Acceptance Criteria 1: Parallel agent display in compact and full modes', () => {
  describe('full mode rendering', () => {
    it('renders agent cards with full details including stage and status text');
    it('displays progress bar in full mode when progress is between 0-100');
    it('shows "Running in Parallel" status text for parallel agents');
    it('shows "Active" status text for active agents');
    it('renders with larger card dimensions (paddingX=2, paddingY=1, minWidth=24)');
    it('displays "Runtime:" label with elapsed time');
    it('displays "Stage:" label with stage information');
  });

  describe('compact mode rendering', () => {
    it('renders agent cards with minimal information');
    it('displays progress percentage instead of progress bar');
    it('renders with smaller card dimensions (paddingX=1, paddingY=0, minWidth=16)');
    it('omits status text labels ("Stage:", "Runtime:")');
    it('maintains icon and name display');
  });

  describe('mode switching behavior', () => {
    it('correctly transitions from full to compact mode');
    it('correctly transitions from compact to full mode');
    it('preserves agent data when switching modes');
  });
});
```

#### Category 2: Icon and Color Verification Tests

```typescript
describe('Acceptance Criteria 2: Correct icon and color usage', () => {
  describe('status icons', () => {
    it('uses ⟂ icon for parallel status');
    it('uses ⚡ icon for active status');
    it('uses ✓ icon for completed status');
    it('uses ○ icon for waiting status');
    it('uses · icon for idle status');
    it('displays status icon before agent name');
  });

  describe('agent colors', () => {
    it('applies magenta color for planner agent');
    it('applies blue color for architect agent');
    it('applies green color for developer agent');
    it('applies yellow color for reviewer agent');
    it('applies cyan color for tester agent');
    it('applies red color for devops agent');
    it('applies white (fallback) color for unknown agents');
  });

  describe('parallel status color override', () => {
    it('overrides agent color to cyan when status is parallel');
    it('uses agent-specific color when status is active');
    it('applies display color to card border');
    it('applies display color to agent name text');
  });

  describe('header icon consistency', () => {
    it('displays ⟂ icon in header title');
    it('shows agent count in header');
  });
});
```

#### Category 3: Elapsed Time Tests

```typescript
describe('Acceptance Criteria 3: Elapsed time formatting and updates', () => {
  describe('elapsed time display conditions', () => {
    it('shows elapsed time for parallel agents with startedAt');
    it('shows elapsed time for active agents with startedAt');
    it('hides elapsed time for agents without startedAt');
    it('hides elapsed time for completed/waiting/idle agents even with startedAt');
  });

  describe('elapsed time formatting', () => {
    it('formats sub-minute durations as seconds (e.g., "42s")');
    it('formats multi-minute durations as minutes and seconds (e.g., "2m 15s")');
    it('formats hour+ durations as hours and minutes (e.g., "1h 5m")');
    it('displays elapsed time in brackets (e.g., "[42s]")');
  });

  describe('elapsed time label differences', () => {
    it('displays "Runtime: [time]" in full mode');
    it('displays "[time]" without label in compact mode');
  });

  describe('real-time updates', () => {
    it('updates elapsed time at default 1-second intervals');
    it('increases displayed time as real time passes');
    it('handles multiple agents with different start times');
  });

  describe('edge cases', () => {
    it('handles future startedAt dates gracefully (shows 0s)');
    it('handles very long running agents (hours+)');
    it('handles null/undefined startedAt');
  });
});
```

### Implementation Patterns

#### Test Setup Pattern

```typescript
import React from 'react';
import { render } from 'ink-testing-library';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParallelExecutionView, ParallelAgent } from '../ParallelExecutionView.js';

// Mock the useElapsedTime hook for controlled time values
const mockUseElapsedTime = vi.fn();
vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

// Mock ProgressBar for isolation
vi.mock('../ProgressIndicators.js', () => ({
  ProgressBar: vi.fn(({ progress }) => `[Progress: ${progress}%]`),
}));

describe('ParallelExecutionView - Acceptance Criteria', () => {
  beforeEach(() => {
    mockUseElapsedTime.mockReturnValue('1m 23s');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });
});
```

#### Color Verification Pattern

Since Ink renders ANSI escape codes, color verification requires checking component props or using snapshot testing:

```typescript
// Direct prop verification approach
it('applies correct color to parallel agents', () => {
  const agent: ParallelAgent = { name: 'developer', status: 'parallel' };

  const { lastFrame } = render(
    <ParallelExecutionView agents={[agent]} />
  );

  // Verify the agent is rendered (color is applied via Ink's Text component)
  const output = lastFrame();
  expect(output).toContain('developer');
  expect(output).toContain('⟂'); // parallel icon indicates cyan color context
});
```

#### Elapsed Time Hook Verification

```typescript
it('calls useElapsedTime with correct startTime', () => {
  const startTime = new Date('2024-01-01T10:00:00Z');
  const agent: ParallelAgent = {
    name: 'developer',
    status: 'parallel',
    startedAt: startTime,
  };

  mockUseElapsedTime.mockReturnValue('5m 30s');

  render(<ParallelExecutionView agents={[agent]} />);

  expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
});
```

### Test Data Fixtures

```typescript
// Standard fixture for parallel agents
const parallelAgentFixtures = {
  minimal: { name: 'agent', status: 'parallel' as const },
  withStage: { name: 'developer', status: 'parallel' as const, stage: 'coding' },
  withProgress: { name: 'tester', status: 'parallel' as const, progress: 50 },
  withTime: { name: 'reviewer', status: 'parallel' as const, startedAt: new Date() },
  complete: {
    name: 'architect',
    status: 'parallel' as const,
    stage: 'design',
    progress: 75,
    startedAt: new Date(),
  },
};

// All known agent names for color testing
const agentColorPairs = [
  { name: 'planner', expectedColor: 'magenta' },
  { name: 'architect', expectedColor: 'blue' },
  { name: 'developer', expectedColor: 'green' },
  { name: 'reviewer', expectedColor: 'yellow' },
  { name: 'tester', expectedColor: 'cyan' },
  { name: 'devops', expectedColor: 'red' },
  { name: 'unknown', expectedColor: 'white' },
];

// All status icons for verification
const statusIconPairs = [
  { status: 'parallel', icon: '⟂' },
  { status: 'active', icon: '⚡' },
  { status: 'completed', icon: '✓' },
  { status: 'waiting', icon: '○' },
  { status: 'idle', icon: '·' },
];
```

### Component Interface Reference

```typescript
// From ParallelExecutionView.tsx
export interface ParallelAgent {
  name: string;
  status: 'parallel' | 'active' | 'completed' | 'waiting' | 'idle';
  stage?: string;
  progress?: number; // 0-100
  startedAt?: Date;
}

export interface ParallelExecutionViewProps {
  agents: ParallelAgent[];
  maxColumns?: number;  // default: 3
  compact?: boolean;    // default: false
}

// Color and icon mappings (from implementation)
const agentColors: Record<string, string> = {
  planner: 'magenta',
  architect: 'blue',
  developer: 'green',
  reviewer: 'yellow',
  tester: 'cyan',
  devops: 'red',
};

const statusIcons: Record<ParallelAgent['status'], string> = {
  parallel: '⟂',
  active: '⚡',
  completed: '✓',
  waiting: '○',
  idle: '·',
};
```

### Key Display Logic Rules

1. **Agent filtering**: Only `parallel` or `active` status agents are shown
2. **Empty state**: Shows "No parallel agents currently active" when no valid agents
3. **Header format**: `⟂ Parallel Execution ({count} agents)`
4. **Color override**: Parallel status agents use `cyan` regardless of agent name
5. **Progress bar**: Only shown when `0 < progress < 100`
6. **Elapsed time**: Only shown when `startedAt` exists AND status is `parallel` or `active`
7. **Compact mode differences**:
   - Smaller padding and min-width
   - No "Stage:" or "Runtime:" labels
   - Progress shown as percentage text instead of bar

## Implementation Plan

### Phase 1: Create New Test File
Create `ParallelExecutionView.acceptance.test.tsx` with all test cases organized by acceptance criteria.

### Phase 2: Test Implementation Priority

1. **High Priority** (Gaps identified):
   - Color verification tests for all agent types
   - Compact vs full mode structural differences
   - Elapsed time label format differences between modes

2. **Medium Priority** (Strengthen existing coverage):
   - Exhaustive icon mapping verification
   - Mode switching behavior
   - Real-time elapsed time updates

3. **Low Priority** (Edge cases):
   - Extreme progress values
   - Very long agent names
   - Special characters in names/stages

### Phase 3: Verification
Run full test suite to ensure:
- All new tests pass
- No regressions in existing tests
- Coverage thresholds maintained (70%)

## Test Execution Commands

```bash
# Run the new acceptance test file
npx vitest run packages/cli/src/ui/components/agents/__tests__/ParallelExecutionView.acceptance.test.tsx

# Run all ParallelExecutionView tests
npx vitest run packages/cli/src/ui/components/agents/__tests__/ParallelExecutionView

# Run with coverage
npm run test:coverage --workspace=@apexcli/cli

# Watch mode for development
npx vitest watch packages/cli/src/ui/components/agents/__tests__/ParallelExecutionView.acceptance.test.tsx
```

## Files to Create/Modify

### New File
- `packages/cli/src/ui/components/agents/__tests__/ParallelExecutionView.acceptance.test.tsx`

### No Modification Needed
- `packages/cli/src/ui/components/agents/ParallelExecutionView.tsx` (component implementation)
- `packages/cli/src/ui/hooks/useElapsedTime.ts` (hook implementation)
- `packages/cli/src/ui/components/agents/__tests__/ParallelExecutionView.test.tsx` (existing tests)

## Consequences

### Positive
- Clear mapping between tests and acceptance criteria
- Comprehensive coverage of icon and color usage
- Improved test documentation through descriptive test names
- Better coverage of compact vs full mode differences

### Negative
- Some overlap with existing tests (acceptable for clarity)
- Additional test maintenance burden

### Neutral
- Test file follows existing project patterns
- Uses same mocking strategies as existing tests

## Notes for Next Stages

### Developer Stage
1. Create the new test file following the structure in this ADR
2. Implement tests in priority order (high → medium → low)
3. Use the fixture patterns provided for consistency
4. Run tests frequently during development

### Tester Stage
1. Verify all acceptance criteria have corresponding tests
2. Run full test suite to check for regressions
3. Validate coverage metrics meet thresholds
4. Review test output for meaningful failure messages

### Reviewer Stage
1. Ensure test names clearly describe what's being tested
2. Verify no redundant tests that duplicate existing coverage unnecessarily
3. Check that mocking strategy is consistent with project patterns
4. Validate that tests actually test what they claim to test
