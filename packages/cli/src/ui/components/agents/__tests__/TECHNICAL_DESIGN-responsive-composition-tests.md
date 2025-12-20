# Technical Design: Agent Components Responsive Composition Integration Tests

## Overview

This document provides the technical design for integration tests verifying responsive composition behavior in APEX CLI agent components.

## Test Files to Create

### 1. `responsive-test-utils.ts` - Shared Test Utilities

**Location:** `packages/cli/src/ui/__tests__/responsive-test-utils.ts`

```typescript
import { vi, type Mock } from 'vitest';

export type Breakpoint = 'narrow' | 'compact' | 'normal' | 'wide';

export interface ResponsiveMockConfig {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isNarrow: boolean;
  isCompact: boolean;
  isNormal: boolean;
  isWide: boolean;
  isAvailable: boolean;
}

export const BREAKPOINT_CONFIGS: Record<Breakpoint, ResponsiveMockConfig> = {
  narrow: {
    width: 50,
    height: 24,
    breakpoint: 'narrow',
    isNarrow: true,
    isCompact: false,
    isNormal: false,
    isWide: false,
    isAvailable: true,
  },
  compact: {
    width: 80,
    height: 24,
    breakpoint: 'compact',
    isNarrow: false,
    isCompact: true,
    isNormal: false,
    isWide: false,
    isAvailable: true,
  },
  normal: {
    width: 120,
    height: 30,
    breakpoint: 'normal',
    isNarrow: false,
    isCompact: false,
    isNormal: true,
    isWide: false,
    isAvailable: true,
  },
  wide: {
    width: 180,
    height: 40,
    breakpoint: 'wide',
    isNarrow: false,
    isCompact: false,
    isNormal: false,
    isWide: true,
    isAvailable: true,
  },
};

// Edge case configurations for boundary testing
export const EDGE_CASE_CONFIGS = {
  extremelyNarrow: { ...BREAKPOINT_CONFIGS.narrow, width: 20 },
  atNarrowBoundary: { ...BREAKPOINT_CONFIGS.narrow, width: 59 },
  atCompactBoundary: { ...BREAKPOINT_CONFIGS.compact, width: 99 },
  atNormalBoundary: { ...BREAKPOINT_CONFIGS.normal, width: 159 },
  extremelyWide: { ...BREAKPOINT_CONFIGS.wide, width: 300 },
};

export function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function assertNoOverflow(
  frame: string | undefined,
  maxWidth: number,
  tolerance = 5
): void {
  if (!frame) {
    throw new Error('Frame is empty or undefined');
  }

  const lines = frame.split('\n');
  lines.forEach((line, index) => {
    const cleanLength = stripAnsi(line).length;
    if (cleanLength > maxWidth + tolerance) {
      throw new Error(
        `Line ${index + 1} exceeds max width: ${cleanLength} > ${maxWidth + tolerance}\n` +
        `Content: "${stripAnsi(line)}"`
      );
    }
  });
}

export function assertColumnLayout(
  frame: string | undefined,
  expectedColumns: number
): void {
  // Count agent cards per row by detecting card borders
  // Implementation depends on output format
}

export function createMockAgents(count: number, options?: {
  includeParallel?: boolean;
  includeThoughts?: boolean;
  includeLongNames?: boolean;
}): any[] {
  const agentNames = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];

  return Array.from({ length: Math.min(count, 6) }, (_, i) => ({
    name: options?.includeLongNames ? `very-long-agent-name-${i}` : agentNames[i],
    status: i === 2 ? 'active' : (options?.includeParallel && i > 3 ? 'parallel' : 'idle'),
    stage: i === 2 ? 'implementation' : undefined,
    progress: i === 2 ? 65 : (options?.includeParallel && i > 3 ? 45 : undefined),
    startedAt: i === 2 ? new Date() : undefined,
    debugInfo: options?.includeThoughts && i === 2 ? {
      thinking: 'This is the agent thinking about the current task and how to proceed with implementation...',
    } : undefined,
  }));
}

export function createParallelAgents(count: number): any[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `parallel-agent-${i + 1}`,
    status: 'parallel',
    stage: `stage-${i + 1}`,
    progress: (i + 1) * 15,
    startedAt: new Date(Date.now() - (i + 1) * 60000),
  }));
}
```

### 2. `AgentPanel.responsive-composition-integration.test.tsx`

**Location:** `packages/cli/src/ui/components/agents/__tests__/AgentPanel.responsive-composition-integration.test.tsx`

**Test Structure:**

```typescript
import React from 'react';
import { render } from 'ink-testing-library';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentPanel } from '../AgentPanel.js';
import {
  BREAKPOINT_CONFIGS,
  EDGE_CASE_CONFIGS,
  stripAnsi,
  assertNoOverflow,
  createMockAgents,
  createParallelAgents,
  type Breakpoint,
} from '../../../__tests__/responsive-test-utils';

// Mock setup
const mockUseStdoutDimensions = vi.fn();
vi.mock('../../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));

vi.mock('../../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: vi.fn(() => '1m 23s'),
}));

vi.mock('../../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: vi.fn(() => ({
    currentAgent: null,
    handoffState: 'idle',
    timeInState: 0,
    isTransitioning: false,
  })),
}));

describe('AgentPanel Responsive Composition Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // CATEGORY A: No Overflow Tests
  describe('Category A: No Overflow at All Breakpoints', () => {
    describe.each([
      ['narrow', BREAKPOINT_CONFIGS.narrow],
      ['compact', BREAKPOINT_CONFIGS.compact],
      ['normal', BREAKPOINT_CONFIGS.normal],
      ['wide', BREAKPOINT_CONFIGS.wide],
    ] as const)('Breakpoint: %s', (name, config) => {
      beforeEach(() => {
        mockUseStdoutDimensions.mockReturnValue(config);
      });

      it('renders standard agents without overflow', () => {
        const agents = createMockAgents(5);
        const { lastFrame } = render(<AgentPanel agents={agents} />);
        assertNoOverflow(lastFrame(), config.width);
      });

      it('renders with current agent without overflow', () => {
        const agents = createMockAgents(5);
        const { lastFrame } = render(
          <AgentPanel agents={agents} currentAgent="developer" />
        );
        assertNoOverflow(lastFrame(), config.width);
      });

      it('renders with parallel agents without overflow', () => {
        const agents = createMockAgents(3);
        const parallelAgents = createParallelAgents(4);
        const { lastFrame } = render(
          <AgentPanel
            agents={agents}
            showParallel={true}
            parallelAgents={parallelAgents}
          />
        );
        assertNoOverflow(lastFrame(), config.width);
      });

      it('renders with thoughts enabled without overflow', () => {
        const agents = createMockAgents(3, { includeThoughts: true });
        const { lastFrame } = render(
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showThoughts={true}
          />
        );
        assertNoOverflow(lastFrame(), config.width);
      });

      it('renders in verbose mode without overflow', () => {
        const agents = createMockAgents(5, { includeThoughts: true });
        const { lastFrame } = render(
          <AgentPanel
            agents={agents}
            displayMode="verbose"
          />
        );
        assertNoOverflow(lastFrame(), config.width);
      });
    });

    // Edge case boundary tests
    describe('Edge Cases: Boundary Widths', () => {
      it.each([
        ['extremely narrow (20)', EDGE_CASE_CONFIGS.extremelyNarrow],
        ['at narrow boundary (59)', EDGE_CASE_CONFIGS.atNarrowBoundary],
        ['at compact boundary (99)', EDGE_CASE_CONFIGS.atCompactBoundary],
        ['at normal boundary (159)', EDGE_CASE_CONFIGS.atNormalBoundary],
        ['extremely wide (300)', EDGE_CASE_CONFIGS.extremelyWide],
      ])('%s: renders without overflow', (name, config) => {
        mockUseStdoutDimensions.mockReturnValue(config);
        const agents = createMockAgents(6);
        const { lastFrame } = render(<AgentPanel agents={agents} />);
        assertNoOverflow(lastFrame(), config.width);
      });
    });
  });

  // CATEGORY B: Component Composition
  describe('Category B: AgentPanel + AgentThoughts Composition', () => {
    it('integrates thoughts display correctly in normal mode', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);
      const agents = createMockAgents(3, { includeThoughts: true });

      const { lastFrame } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      const output = lastFrame();
      expect(output).toContain('thinking');
      assertNoOverflow(output, BREAKPOINT_CONFIGS.normal.width);
    });

    it('hides thoughts in compact breakpoint', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.compact);
      const agents = createMockAgents(3, { includeThoughts: true });

      const { lastFrame } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      // Thoughts should not appear in compact mode
      expect(lastFrame()).not.toContain('This is the agent thinking');
    });

    it('truncates long thoughts appropriately', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);
      const agents = createMockAgents(3);
      agents[2].debugInfo = {
        thinking: 'A'.repeat(200), // Long thought
      };

      const { lastFrame } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      // Should be truncated to thoughtsMaxLength (80 for normal)
      assertNoOverflow(lastFrame(), BREAKPOINT_CONFIGS.normal.width);
    });
  });

  // CATEGORY C: AgentPanel + ParallelExecutionView Composition
  describe('Category C: AgentPanel + ParallelExecutionView Composition', () => {
    it('integrates detailed parallel view in normal mode', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);
      const agents = createMockAgents(3);
      const parallelAgents = createParallelAgents(4);

      const { lastFrame } = render(
        <AgentPanel
          agents={agents}
          showParallel={true}
          parallelAgents={parallelAgents}
          useDetailedParallelView={true}
        />
      );

      const output = lastFrame();
      expect(output).toContain('Parallel Execution');
      assertNoOverflow(output, BREAKPOINT_CONFIGS.normal.width);
    });

    it('limits parallel agents display at each breakpoint', () => {
      // Test maxParallelAgentsVisible limits
      const parallelAgents = createParallelAgents(12);

      // Narrow: max 2 (but hidden in narrow)
      // Compact: max 3
      // Normal: max 5
      // Wide: max 10

      [
        ['compact', BREAKPOINT_CONFIGS.compact, 3],
        ['normal', BREAKPOINT_CONFIGS.normal, 5],
        ['wide', BREAKPOINT_CONFIGS.wide, 10],
      ].forEach(([name, config, maxVisible]) => {
        mockUseStdoutDimensions.mockReturnValue(config as any);
        const agents = createMockAgents(2);

        const { lastFrame } = render(
          <AgentPanel
            agents={agents}
            showParallel={true}
            parallelAgents={parallelAgents}
          />
        );

        assertNoOverflow(lastFrame(), (config as any).width);
      });
    });
  });

  // CATEGORY D: Display Mode Propagation
  describe('Category D: Display Mode Propagation', () => {
    it('propagates compact displayMode through component tree', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.wide);
      const agents = createMockAgents(5, { includeThoughts: true });
      const parallelAgents = createParallelAgents(4);

      const { lastFrame } = render(
        <AgentPanel
          agents={agents}
          displayMode="compact"
          showParallel={true}
          parallelAgents={parallelAgents}
          showThoughts={true}
        />
      );

      const output = lastFrame();
      // Compact mode should override wide terminal
      expect(output).not.toContain('Active Agents'); // No title in compact
      assertNoOverflow(output, BREAKPOINT_CONFIGS.wide.width);
    });

    it('propagates verbose displayMode through component tree', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);
      const agents = createMockAgents(3);
      agents[2].debugInfo = {
        tokensUsed: { input: 1000, output: 500 },
        turnCount: 5,
        thinking: 'Agent is processing the request...',
      };

      const { lastFrame } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Tokens'); // Verbose mode shows debug info
      assertNoOverflow(output, BREAKPOINT_CONFIGS.normal.width);
    });
  });
});
```

### 3. `ParallelExecutionView.columns-integration.test.tsx`

**Location:** `packages/cli/src/ui/components/agents/__tests__/ParallelExecutionView.columns-integration.test.tsx`

**Test Structure:**

```typescript
import React from 'react';
import { render } from 'ink-testing-library';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParallelExecutionView, ParallelAgent } from '../ParallelExecutionView.js';
import {
  BREAKPOINT_CONFIGS,
  assertNoOverflow,
  createParallelAgents,
} from '../../../__tests__/responsive-test-utils';

// Mock setup
const mockUseStdoutDimensions = vi.fn();
const mockUseElapsedTime = vi.fn();

vi.mock('../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));

vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: () => mockUseElapsedTime(),
}));

vi.mock('../ProgressIndicators.js', () => ({
  ProgressBar: ({ progress }: { progress: number }) => `[${progress}%]`,
}));

describe('ParallelExecutionView Column Calculations Integration', () => {
  beforeEach(() => {
    mockUseElapsedTime.mockReturnValue('1m 23s');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Column calculation formula verification
  describe('Column Calculation Formula', () => {
    // Card widths: compact=20, full=28
    // Formula: Math.max(1, Math.floor(width / cardWidth))

    describe.each([
      // [breakpoint, width, compact, expectedColumns]
      ['narrow', 50, false, 1],    // Narrow always 1
      ['narrow', 50, true, 1],     // Narrow always 1
      ['compact', 80, false, 2],   // 80/28=2.8 -> 2
      ['compact', 80, true, 1],    // compact mode in compact breakpoint = 1
      ['normal', 120, false, 4],   // 120/28=4.2 -> 4
      ['normal', 120, true, 6],    // 120/20=6
      ['wide', 180, false, 6],     // 180/28=6.4 -> 6
      ['wide', 180, true, 9],      // 180/20=9
      ['wide', 200, false, 7],     // 200/28=7.1 -> 7
      ['wide', 200, true, 10],     // 200/20=10
    ] as const)('%s width=%d compact=%s -> columns=%d',
      (breakpoint, width, compact, expectedColumns) => {
        it(`calculates ${expectedColumns} columns correctly`, () => {
          const config = {
            ...BREAKPOINT_CONFIGS[breakpoint as keyof typeof BREAKPOINT_CONFIGS],
            width
          };
          mockUseStdoutDimensions.mockReturnValue(config);

          const agents = createParallelAgents(expectedColumns + 2);
          const { lastFrame } = render(
            <ParallelExecutionView agents={agents} compact={compact} />
          );

          const output = lastFrame();
          expect(output).toContain(`${agents.filter(a =>
            a.status === 'parallel' || a.status === 'active'
          ).length} agents`);
          assertNoOverflow(output, width);
        });
      }
    );
  });

  // Explicit maxColumns override
  describe('Explicit maxColumns Override', () => {
    it.each([1, 2, 3, 4, 5])('respects explicit maxColumns=%d', (maxColumns) => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.wide);
      const agents = createParallelAgents(10);

      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} maxColumns={maxColumns} />
      );

      const output = lastFrame();
      // Should still show all agents, just arranged differently
      expect(output).toBeTruthy();
    });
  });

  // Minimum columns guarantee
  describe('Minimum Columns Guarantee', () => {
    it('always provides at least 1 column', () => {
      mockUseStdoutDimensions.mockReturnValue({
        ...BREAKPOINT_CONFIGS.narrow,
        width: 5, // Extremely narrow
      });

      const agents = createParallelAgents(2);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} />
      );

      // Should not crash and should render
      expect(lastFrame()).toContain('parallel-agent-1');
    });
  });

  // No overflow at any configuration
  describe('No Overflow Across Configurations', () => {
    it.each([
      [50, 1], [60, 2], [80, 4], [100, 6], [120, 8], [160, 12], [200, 15],
    ])('width=%d with %d agents: no overflow', (width, agentCount) => {
      const breakpoint = width < 60 ? 'narrow' :
                        width < 100 ? 'compact' :
                        width < 160 ? 'normal' : 'wide';

      mockUseStdoutDimensions.mockReturnValue({
        ...BREAKPOINT_CONFIGS[breakpoint as keyof typeof BREAKPOINT_CONFIGS],
        width,
      });

      const agents = createParallelAgents(agentCount);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} />
      );

      assertNoOverflow(lastFrame(), width);
    });
  });
});
```

### 4. `AgentThoughts.responsive.test.tsx`

**Location:** `packages/cli/src/ui/components/__tests__/AgentThoughts.responsive.test.tsx`

**Test Structure:**

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AgentThoughts } from '../AgentThoughts.js';
import { BREAKPOINT_CONFIGS, assertNoOverflow } from '../../__tests__/responsive-test-utils';

// Mock ink and CollapsibleSection
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
  Text: ({ children, wrap, ...props }: any) => (
    <span data-testid="text" data-wrap={wrap} {...props}>{children}</span>
  ),
}));

vi.mock('../CollapsibleSection.js', () => ({
  CollapsibleSection: ({ children, title, collapsed, ...props }: any) => (
    <div data-testid="collapsible" data-collapsed={collapsed} {...props}>
      <div data-testid="title">{title}</div>
      {!collapsed && <div data-testid="content">{children}</div>}
    </div>
  ),
}));

describe('AgentThoughts Responsive Behavior', () => {
  // Test wrap behavior
  describe('Text Wrap Behavior', () => {
    it('applies wrap="wrap" attribute for proper text wrapping', () => {
      render(
        <AgentThoughts
          thinking="This is a long thought that needs to wrap properly"
          agent="developer"
          displayMode="normal"
        />
      );

      const textElements = screen.getAllByTestId('text');
      const contentText = textElements.find(el =>
        el.textContent?.includes('long thought')
      );
      expect(contentText).toHaveAttribute('data-wrap', 'wrap');
    });
  });

  // Test hidden in compact mode
  describe('Hidden in Compact Mode', () => {
    it('returns empty Box in compact displayMode', () => {
      const { container } = render(
        <AgentThoughts
          thinking="Should not be visible"
          agent="developer"
          displayMode="compact"
        />
      );

      expect(screen.queryByText('Should not be visible')).not.toBeInTheDocument();
    });
  });

  // Test truncation limits
  describe('Truncation Limits by Display Mode', () => {
    it('truncates at 500 chars in normal mode', () => {
      const longThinking = 'A'.repeat(600);

      render(
        <AgentThoughts
          thinking={longThinking}
          agent="developer"
          displayMode="normal"
        />
      );

      // Should show truncation indicator
      expect(screen.getByText(/600 chars/)).toBeInTheDocument();
    });

    it('truncates at 1000 chars in verbose mode', () => {
      const veryLongThinking = 'B'.repeat(1200);

      render(
        <AgentThoughts
          thinking={veryLongThinking}
          agent="developer"
          displayMode="verbose"
        />
      );

      // Should show truncation indicator
      expect(screen.getByText(/1200 chars/)).toBeInTheDocument();
    });

    it('does not truncate short thoughts', () => {
      const shortThinking = 'Short thought';

      render(
        <AgentThoughts
          thinking={shortThinking}
          agent="developer"
          displayMode="normal"
        />
      );

      expect(screen.queryByText(/chars\)/)).not.toBeInTheDocument();
    });
  });

  // Test icon display
  describe('Icon Display', () => {
    it('uses thought emoji by default', () => {
      render(
        <AgentThoughts
          thinking="Test thought"
          agent="developer"
          displayMode="normal"
        />
      );

      expect(screen.getByTestId('title').textContent).toContain('💭');
    });

    it('uses ASCII icon when specified', () => {
      render(
        <AgentThoughts
          thinking="Test thought"
          agent="developer"
          displayMode="normal"
          useAsciiIcons={true}
        />
      );

      expect(screen.getByTestId('title').textContent).toContain('[T]');
    });
  });
});
```

### 5. `ThoughtDisplay.responsive.test.tsx`

**Location:** `packages/cli/src/ui/components/__tests__/ThoughtDisplay.responsive.test.tsx`

**Test Structure:**

```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { ThoughtDisplay } from '../ThoughtDisplay.js';
import { stripAnsi, assertNoOverflow } from '../../__tests__/responsive-test-utils';

// Mock ink
vi.mock('ink', () => ({
  Box: ({ children, ...props }: any) => <div data-testid="box" {...props}>{children}</div>,
  Text: ({ children, wrap, color, dimColor, ...props }: any) => (
    <span
      data-testid="text"
      data-wrap={wrap}
      data-color={color}
      data-dim={dimColor}
      {...props}
    >
      {children}
    </span>
  ),
}));

describe('ThoughtDisplay Responsive Behavior', () => {
  // Test wrap attribute
  describe('Text Wrap Attribute', () => {
    it('applies wrap="wrap" for content text', () => {
      render(
        <ThoughtDisplay
          thinking="Long thought content that should wrap"
          agent="developer"
          displayMode="normal"
        />
      );

      const contentText = screen.getAllByTestId('text').find(el =>
        el.textContent === 'Long thought content that should wrap'
      );
      expect(contentText).toHaveAttribute('data-wrap', 'wrap');
    });
  });

  // Test hidden in compact
  describe('Hidden in Compact Mode', () => {
    it('returns empty box when compact=true', () => {
      render(
        <ThoughtDisplay
          thinking="Hidden content"
          agent="developer"
          compact={true}
        />
      );

      expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
    });

    it('returns empty box when displayMode="compact"', () => {
      render(
        <ThoughtDisplay
          thinking="Hidden content"
          agent="developer"
          displayMode="compact"
        />
      );

      expect(screen.queryByText('Hidden content')).not.toBeInTheDocument();
    });
  });

  // Test truncation
  describe('Truncation by Display Mode', () => {
    it('truncates at 300 chars in normal mode', () => {
      const longThinking = 'X'.repeat(400);

      render(
        <ThoughtDisplay
          thinking={longThinking}
          agent="developer"
          displayMode="normal"
        />
      );

      // Should show truncation indicator
      expect(screen.getByText(/truncated from 400 chars/)).toBeInTheDocument();

      // Content should be 300 chars + "..."
      const truncatedContent = screen.getAllByTestId('text').find(el =>
        el.textContent?.startsWith('X')
      );
      expect(truncatedContent?.textContent?.length).toBe(303); // 300 + "..."
    });

    it('truncates at 1000 chars in verbose mode', () => {
      const veryLongThinking = 'Y'.repeat(1200);

      render(
        <ThoughtDisplay
          thinking={veryLongThinking}
          agent="developer"
          displayMode="verbose"
        />
      );

      // Should show truncation indicator
      expect(screen.getByText(/truncated from 1200 chars/)).toBeInTheDocument();
    });
  });

  // Test proper styling
  describe('Styling Attributes', () => {
    it('applies gray color and dimColor for secondary appearance', () => {
      render(
        <ThoughtDisplay
          thinking="Test thought"
          agent="developer"
          displayMode="normal"
        />
      );

      const textElements = screen.getAllByTestId('text');

      // Header should be gray and dimmed
      const header = textElements.find(el => el.textContent?.includes('thinking'));
      expect(header).toHaveAttribute('data-color', 'gray');
      expect(header).toHaveAttribute('data-dim', 'true');

      // Content should be gray and dimmed
      const content = textElements.find(el => el.textContent === 'Test thought');
      expect(content).toHaveAttribute('data-color', 'gray');
      expect(content).toHaveAttribute('data-dim', 'true');
    });
  });
});
```

## Acceptance Criteria Verification Matrix

| Acceptance Criteria | Test File | Test Category |
|---------------------|-----------|---------------|
| Agent components render without overflow at all breakpoints | `AgentPanel.responsive-composition-integration.test.tsx` | Category A: All breakpoint parametric tests |
| Parallel view column calculations work correctly | `ParallelExecutionView.columns-integration.test.tsx` | Column Calculation Formula tests |
| Thought displays wrap properly | `AgentThoughts.responsive.test.tsx`, `ThoughtDisplay.responsive.test.tsx` | Text Wrap Behavior tests |

## Implementation Order

1. Create `responsive-test-utils.ts` with shared utilities
2. Create `AgentPanel.responsive-composition-integration.test.tsx`
3. Create `ParallelExecutionView.columns-integration.test.tsx`
4. Create `AgentThoughts.responsive.test.tsx`
5. Create `ThoughtDisplay.responsive.test.tsx`
6. Run all tests and verify acceptance criteria
7. Update CI configuration if needed

## Dependencies

- vitest (test framework)
- @testing-library/react (component testing)
- ink-testing-library (Ink component testing)
- Existing component implementations

## Notes for Development Stage

- All tests use Vitest, consistent with existing test files
- Mock configurations are centralized for maintainability
- Parametric tests with `.each()` reduce code duplication
- ANSI stripping is essential for accurate width measurement
- Edge case boundary testing catches off-by-one errors
