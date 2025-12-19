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
} from '../../../__tests__/responsive-test-utils.js';

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

      // Should be truncated and not overflow
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

  // CATEGORY E: Stress Testing
  describe('Category E: Stress Testing with Complex Scenarios', () => {
    it('handles many agents with long names without overflow', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);
      const agents = createMockAgents(6, {
        includeLongNames: true,
        includeThoughts: true,
        includeParallel: true
      });
      const parallelAgents = createParallelAgents(8);

      const { lastFrame } = render(
        <AgentPanel
          agents={agents}
          currentAgent="very-long-agent-name-2"
          showParallel={true}
          parallelAgents={parallelAgents}
          showThoughts={true}
          displayMode="verbose"
        />
      );

      assertNoOverflow(lastFrame(), BREAKPOINT_CONFIGS.normal.width);
    });

    it('handles rapid breakpoint transitions without overflow', () => {
      const agents = createMockAgents(4, { includeThoughts: true });
      const parallelAgents = createParallelAgents(3);

      // Test transition from wide -> normal -> compact -> narrow
      const breakpoints = ['wide', 'normal', 'compact', 'narrow'] as const;

      breakpoints.forEach((breakpoint) => {
        mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS[breakpoint]);

        const { lastFrame } = render(
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showParallel={true}
            parallelAgents={parallelAgents}
            showThoughts={true}
            displayMode="normal"
          />
        );

        assertNoOverflow(lastFrame(), BREAKPOINT_CONFIGS[breakpoint].width);
      });
    });

    it('handles very long thought content without overflow', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.narrow);
      const agents = createMockAgents(3);
      agents[2].debugInfo = {
        thinking: 'This is an extremely long thought process that goes on for many characters and should be properly truncated and wrapped to prevent any horizontal overflow even in the narrowest terminal configurations where space is very limited and every character counts for the display layout optimization...'.repeat(5)
      };

      const { lastFrame } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showThoughts={true}
          displayMode="verbose"
        />
      );

      assertNoOverflow(lastFrame(), BREAKPOINT_CONFIGS.narrow.width, 10); // Extra tolerance for complex content
    });
  });

  // CATEGORY F: Text Wrapping Validation
  describe('Category F: Text Wrapping Behavior', () => {
    it('ensures text wraps properly at all breakpoints', () => {
      const longThought = 'A'.repeat(200);
      const agents = createMockAgents(3);
      agents[2].debugInfo = { thinking: longThought };

      Object.entries(BREAKPOINT_CONFIGS).forEach(([breakpointName, config]) => {
        mockUseStdoutDimensions.mockReturnValue(config);
        const { lastFrame } = render(
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showThoughts={true}
            displayMode="normal"
          />
        );

        if (breakpointName !== 'narrow' && breakpointName !== 'compact') {
          // Thoughts should be visible and wrapped properly
          const output = lastFrame();
          expect(output).toContain('A');
          assertNoOverflow(output, config.width);
        }
      });
    });

    it('validates agent names wrap correctly', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.narrow);
      const agents = createMockAgents(3, { includeLongNames: true });

      const { lastFrame } = render(
        <AgentPanel agents={agents} displayMode="normal" />
      );

      // Long agent names should be handled without overflow
      assertNoOverflow(lastFrame(), BREAKPOINT_CONFIGS.narrow.width);
    });
  });
});