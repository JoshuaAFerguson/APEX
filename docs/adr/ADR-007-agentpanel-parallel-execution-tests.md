# ADR-007: AgentPanel Parallel Execution Tests - Technical Design

## Status
**Accepted**

## Date
2024-12-16

## Author
Architect Agent

## Context

The task is to add AgentPanel parallel execution tests and update the existing test suite. After thorough analysis of the codebase, I discovered that **extensive parallel execution test coverage already exists**.

### Current Test Infrastructure

- **Test Framework**: Vitest with jsdom environment
- **Testing Library**: React Testing Library
- **Test Utils**: Custom render wrapper at `packages/cli/src/__tests__/test-utils.tsx`
- **Coverage Thresholds**: 70% for branches, functions, lines, and statements

### Existing Parallel Execution Test Coverage

The AgentPanel component already has **7 dedicated parallel execution test files** plus core tests in the main test file:

| File | Purpose | Test Count |
|------|---------|------------|
| `AgentPanel.test.tsx` | Core parallel execution tests (lines 573-712) | 11 tests |
| `AgentPanel.parallel-integration.test.tsx` | Real-world workflow scenarios | 3+ tests |
| `AgentPanel.parallel-complete.test.tsx` | Comprehensive display functionality | Multiple |
| `AgentPanel.parallel-timing.test.tsx` | Elapsed time for parallel agents | 4+ tests |
| `AgentPanel.parallel-edge-cases.test.tsx` | Edge cases with mixed states | 20+ tests |
| `AgentPanel.parallel-visual.test.tsx` | Visual layout and terminal compatibility | 4+ tests |
| `AgentPanel.parallel-handoff-integration.test.tsx` | Parallel + handoff interaction | Multiple |
| `AgentPanel.parallel-elapsed-time.test.tsx` | Timing display in parallel mode | Multiple |

**Total: 30+ dedicated parallel execution tests**

### Coverage Analysis Against Acceptance Criteria

| Acceptance Criterion | Current Coverage |
|---------------------|------------------|
| Unit tests cover parallel execution rendering | ✅ Fully covered in multiple files |
| Tests verify `parallelAgents` prop handling | ✅ Extensive coverage including undefined, null, empty array |
| Edge cases tested (empty array, single agent, many agents) | ✅ All scenarios covered in `parallel-edge-cases.test.tsx` |
| All existing AgentPanel tests still pass | ⚠️ Needs verification |

## Decision

Given the comprehensive existing test coverage, the architecture approach is to:

### 1. **Verify and Consolidate** (Primary Focus)

Rather than adding redundant tests, we should:

1. **Run existing test suite** to verify all tests pass
2. **Identify any gaps** not currently covered by existing tests
3. **Add only missing tests** for any uncovered scenarios

### 2. **Technical Design for Test Organization**

The existing test structure follows a well-organized pattern:

```
packages/cli/src/ui/components/agents/__tests__/
├── AgentPanel.test.tsx                          # Core functionality
├── AgentPanel.parallel-*.test.tsx               # Parallel execution (7 files)
├── AgentPanel.handoff-*.test.tsx               # Handoff animations
├── AgentPanel.progress-*.test.tsx              # Progress bars
├── AgentPanel.elapsed-time-*.test.tsx          # Time tracking
├── AgentPanel.acceptance-*.test.tsx            # Acceptance criteria
└── AgentPanel.*.integration.test.tsx           # Integration tests
```

### 3. **Testing Patterns to Follow**

Based on existing code, new tests should follow these patterns:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel - [Feature]', () => {
  describe('[Category]', () => {
    it('[specific behavior]', () => {
      // Arrange
      const parallelAgents: AgentInfo[] = [...];

      // Act
      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Assert
      expect(screen.getByText('...')).toBeInTheDocument();
    });
  });
});
```

### 4. **Identified Coverage Gaps** (To Be Implemented)

After thorough analysis, I identified these potentially missing test scenarios:

#### A. Stress Testing Scenarios
- Rendering with maximum practical agent count (50+ agents)
- Rapid state transitions (mounting/unmounting)

#### B. Concurrent State Transitions
- Multiple simultaneous agent status changes
- Parallel agents completing at different rates

#### C. Memory/Performance Regression
- Component cleanup on unmount
- No memory leaks with frequent rerenders

#### D. Snapshot Testing (Optional)
- Visual regression tests for parallel section layout

## Implementation Plan

### Phase 1: Verification (Required)
1. Run `npm test --workspace=@apex/cli` to verify all existing tests pass
2. Run `npm run test:coverage --workspace=@apex/cli` to check coverage metrics
3. Document any failing tests

### Phase 2: Gap Analysis (If Needed)
1. Review coverage report for untested branches
2. Identify any missing edge cases
3. Create minimal test additions only where needed

### Phase 3: Test Additions (If Coverage Gaps Found)
Create new test file: `AgentPanel.parallel-stress.test.tsx`

```typescript
// Only create if stress testing is not already covered
describe('AgentPanel - Parallel Execution Stress Tests', () => {
  describe('performance under load', () => {
    it('handles 50+ parallel agents without performance degradation');
    it('handles rapid mount/unmount cycles');
    it('cleans up resources on unmount');
  });

  describe('concurrent state transitions', () => {
    it('handles multiple agents completing simultaneously');
    it('handles rapid progress updates across all agents');
  });
});
```

## Consequences

### Positive
- Avoids test duplication and maintenance burden
- Leverages existing comprehensive test infrastructure
- Follows established project patterns
- Ensures test suite remains maintainable

### Negative
- Less "new code" to show for the task
- Requires careful gap analysis

### Neutral
- Existing tests may need minor updates for consistency

## Component Interface Reference

```typescript
export interface AgentInfo {
  name: string;
  status: 'active' | 'waiting' | 'completed' | 'idle' | 'parallel';
  stage?: string;
  progress?: number; // 0-100
  startedAt?: Date;
}

export interface AgentPanelProps {
  agents: AgentInfo[];
  currentAgent?: string;
  compact?: boolean;
  showParallel?: boolean;
  parallelAgents?: AgentInfo[];
}
```

## Display Logic Rules

1. **Parallel section visibility**: `showParallel && parallelAgents.length > 1`
2. **Progress display**: Only shown when `0 < progress < 100`
3. **Elapsed time**: Shown only when `startedAt` is set and status is `active` or `parallel`
4. **Color scheme**: All parallel agents use cyan color
5. **Icon**: Parallel agents use `⟂` (box drawing character)

## Test Execution Commands

```bash
# Run all CLI tests
npm test --workspace=@apex/cli

# Run specific test file
npx vitest run packages/cli/src/ui/components/agents/__tests__/AgentPanel.test.tsx

# Run with coverage
npm run test:coverage --workspace=@apex/cli

# Watch mode for development
npm run test:watch --workspace=@apex/cli
```

## Files Involved

### Existing (No Modification Needed)
- `packages/cli/src/ui/components/agents/AgentPanel.tsx` - Component
- `packages/cli/src/ui/components/agents/__tests__/AgentPanel.test.tsx` - Core tests
- `packages/cli/src/ui/components/agents/__tests__/AgentPanel.parallel-*.test.tsx` - 7 test files
- `packages/cli/src/__tests__/test-utils.tsx` - Test utilities

### Potentially New (Only If Gaps Found)
- `packages/cli/src/ui/components/agents/__tests__/AgentPanel.parallel-stress.test.tsx`

## Recommended Implementation Approach

### Primary Recommendation: Verification-First Approach

Given the comprehensive existing coverage, the implementation should follow this strategy:

```bash
# Step 1: Verify existing tests pass
npm test --workspace=@apex/cli

# Step 2: Check coverage metrics
npm run test:coverage --workspace=@apex/cli

# Step 3: Only add tests if gaps identified
```

### Test Matrix for Acceptance Criteria Verification

| Criterion | Test File(s) | Test Names |
|-----------|--------------|------------|
| Parallel rendering | `AgentPanel.parallel-complete.test.tsx` | "shows parallel section with multiple agents" |
| `parallelAgents` prop | `AgentPanel.parallel-edge-cases.test.tsx` | Multiple tests for undefined, null, empty |
| Empty array edge case | `AgentPanel.test.tsx:621-631` | "hides parallel execution section when no parallel agents" |
| Single agent edge case | `AgentPanel.test.tsx:607-619` | "hides parallel execution section when only one parallel agent" |
| Many agents | `AgentPanel.parallel-edge-cases.test.tsx:408-435` | "handles large number of parallel agents efficiently" |

### If Adding New Tests

If gaps are found, create a new consolidated test file:

**File**: `packages/cli/src/ui/components/agents/__tests__/AgentPanel.parallel-acceptance.test.tsx`

```typescript
/**
 * AgentPanel Parallel Execution - Acceptance Criteria Tests
 * Consolidates tests for specific acceptance criteria
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel - Parallel Execution Acceptance Criteria', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('AC1: Unit tests cover parallel execution rendering', () => {
    it('renders parallel section header with correct icon and title', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', stage: 'working' },
        { name: 'agent2', status: 'parallel', stage: 'working' },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });

    it('renders each parallel agent with icon, name, stage, and progress', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding', progress: 50 },
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 30 },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Agent names
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Stages
      expect(screen.getByText(/\(coding\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(testing\)/)).toBeInTheDocument();

      // Progress
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/30%/)).toBeInTheDocument();
    });

    it('renders parallel section in compact mode', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel' },
        { name: 'tester', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={[{ name: 'planner', status: 'active' }]}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('⟂')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });

  describe('AC2: Tests verify parallelAgents prop handling', () => {
    it('handles parallelAgents as undefined', () => {
      render(
        <AgentPanel
          agents={[{ name: 'planner', status: 'active' }]}
          showParallel={true}
          parallelAgents={undefined}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    it('handles parallelAgents with showParallel=false', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel' },
        { name: 'tester', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={false}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('handles parallelAgents with various agent properties', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', stage: 'stage1', progress: 25, startedAt: new Date() },
        { name: 'agent2', status: 'parallel', stage: undefined, progress: undefined },
        { name: 'agent3', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
    });
  });

  describe('AC3: Edge cases tested (empty array, single agent, many agents)', () => {
    it('edge case: empty parallelAgents array', () => {
      render(
        <AgentPanel
          agents={[{ name: 'planner', status: 'active' }]}
          showParallel={true}
          parallelAgents={[]}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('edge case: single parallel agent (threshold: >1 required)', () => {
      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={[{ name: 'developer', status: 'parallel' }]}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('edge case: exactly two parallel agents (minimum threshold)', () => {
      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={[
            { name: 'developer', status: 'parallel' },
            { name: 'tester', status: 'parallel' },
          ]}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });

    it('edge case: many parallel agents (20+)', () => {
      const manyAgents: AgentInfo[] = Array.from({ length: 25 }, (_, i) => ({
        name: `agent-${i}`,
        status: 'parallel' as const,
        stage: `stage-${i}`,
        progress: (i * 4) % 100,
      }));

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={manyAgents}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('agent-0')).toBeInTheDocument();
      expect(screen.getByText('agent-12')).toBeInTheDocument();
      expect(screen.getByText('agent-24')).toBeInTheDocument();
    });

    it('edge case: null parallelAgents prop (defensive)', () => {
      render(
        <AgentPanel
          agents={[{ name: 'planner', status: 'active' }]}
          showParallel={true}
          parallelAgents={null as any}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });
  });
});
```

## Notes for Next Stages

1. **Developer Stage**:
   - Run test suite first: `npm test --workspace=@apex/cli`
   - Check coverage: `npm run test:coverage --workspace=@apex/cli`
   - Only add tests if specific gaps are identified
   - If adding tests, use the template above for `AgentPanel.parallel-acceptance.test.tsx`

2. **Tester Stage**:
   - Validate test assertions match component behavior
   - Run full test suite to ensure no regressions
   - Verify coverage meets 70% threshold

3. **Reviewer Stage**:
   - Ensure no redundant tests are added
   - Check that test names are descriptive
   - Verify acceptance criteria are met by existing or new tests
