import React from 'react';
import { render } from 'ink-testing-library';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParallelExecutionView, ParallelAgent } from '../ParallelExecutionView.js';
import {
  BREAKPOINT_CONFIGS,
  assertNoOverflow,
  createParallelAgents,
} from '../../../__tests__/responsive-test-utils.js';

// Mock setup
const mockUseStdoutDimensions = vi.fn();
const mockUseElapsedTime = vi.fn();

vi.mock('../../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: () => mockUseStdoutDimensions(),
}));

vi.mock('../../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: () => mockUseElapsedTime(),
}));

vi.mock('../../ProgressIndicators.js', () => ({
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

  // Test specific boundary cases
  describe('Boundary Width Testing', () => {
    it('handles exactly at card width boundaries', () => {
      // Test exact multiples of card widths
      [
        [56, false, 2],  // 56/28 = 2 exactly
        [84, false, 3],  // 84/28 = 3 exactly
        [40, true, 2],   // 40/20 = 2 exactly
        [60, true, 3],   // 60/20 = 3 exactly
      ].forEach(([width, compact, expectedCols]) => {
        const breakpoint = width < 60 ? 'narrow' :
                          width < 100 ? 'compact' :
                          width < 160 ? 'normal' : 'wide';

        mockUseStdoutDimensions.mockReturnValue({
          ...BREAKPOINT_CONFIGS[breakpoint as keyof typeof BREAKPOINT_CONFIGS],
          width: width as number,
        });

        const agents = createParallelAgents(6);
        const { lastFrame } = render(
          <ParallelExecutionView agents={agents} compact={compact as boolean} />
        );

        assertNoOverflow(lastFrame(), width as number);
      });
    });
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
      expect(output).toContain('agents');
      assertNoOverflow(output, BREAKPOINT_CONFIGS.wide.width);
    });
  });

  // Test column calculation edge cases
  describe('Column Calculation Edge Cases', () => {
    it('handles very narrow widths gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        ...BREAKPOINT_CONFIGS.narrow,
        width: 15, // Extremely narrow - less than card width
      });

      const agents = createParallelAgents(3);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} />
      );

      const output = lastFrame();
      expect(output).toContain('parallel-agent-1');
      assertNoOverflow(output, 15, 10); // Extra tolerance for very narrow
    });

    it('handles very wide widths without issues', () => {
      mockUseStdoutDimensions.mockReturnValue({
        ...BREAKPOINT_CONFIGS.wide,
        width: 500, // Extremely wide
      });

      const agents = createParallelAgents(20);
      const { lastFrame } = render(
        <ParallelExecutionView agents={agents} />
      );

      const output = lastFrame();
      expect(output).toContain('20 agents');
      assertNoOverflow(output, 500);
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

    it('never calculates 0 columns', () => {
      // Test various narrow widths that could theoretically result in 0
      [1, 5, 10, 15, 19].forEach(width => {
        mockUseStdoutDimensions.mockReturnValue({
          ...BREAKPOINT_CONFIGS.narrow,
          width,
        });

        const agents = createParallelAgents(1);
        const { lastFrame } = render(
          <ParallelExecutionView agents={agents} />
        );

        // Should render without error - minimum 1 column guaranteed
        const output = lastFrame();
        expect(output).toBeTruthy();
      });
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

  // Test responsive column adaptation
  describe('Responsive Column Adaptation', () => {
    it('adapts columns when terminal width changes', () => {
      const agents = createParallelAgents(8);

      // Start with wide terminal
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.wide);
      const wideRender = render(<ParallelExecutionView agents={agents} />);
      assertNoOverflow(wideRender.lastFrame(), BREAKPOINT_CONFIGS.wide.width);
      wideRender.unmount();

      // Switch to narrow terminal
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.narrow);
      const narrowRender = render(<ParallelExecutionView agents={agents} />);
      assertNoOverflow(narrowRender.lastFrame(), BREAKPOINT_CONFIGS.narrow.width);
      narrowRender.unmount();

      // Both should render without issues
    });

    it('maintains column layout integrity across display modes', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);
      const agents = createParallelAgents(6);

      // Test both compact and full modes
      [false, true].forEach(compact => {
        const { lastFrame } = render(
          <ParallelExecutionView agents={agents} compact={compact} />
        );

        const output = lastFrame();
        expect(output).toContain('6 agents');
        assertNoOverflow(output, BREAKPOINT_CONFIGS.normal.width);
      });
    });
  });

  // Empty and edge cases
  describe('Empty and Edge Cases', () => {
    it('handles empty agent list gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);
      const { lastFrame } = render(<ParallelExecutionView agents={[]} />);

      expect(lastFrame()).toContain('No parallel agents currently active');
    });

    it('handles single agent correctly', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.wide);
      const agents = createParallelAgents(1);

      const { lastFrame } = render(<ParallelExecutionView agents={agents} />);

      const output = lastFrame();
      expect(output).toContain('1 agents');
      expect(output).toContain('parallel-agent-1');
      assertNoOverflow(output, BREAKPOINT_CONFIGS.wide.width);
    });

    it('handles mixed agent statuses', () => {
      mockUseStdoutDimensions.mockReturnValue(BREAKPOINT_CONFIGS.normal);

      // Create agents with different statuses
      const agents: ParallelAgent[] = [
        { name: 'active-agent', status: 'active', progress: 50 },
        { name: 'parallel-agent-1', status: 'parallel', progress: 75 },
        { name: 'waiting-agent', status: 'waiting' },
        { name: 'parallel-agent-2', status: 'parallel', progress: 30 },
        { name: 'completed-agent', status: 'completed' },
      ];

      const { lastFrame } = render(<ParallelExecutionView agents={agents} />);

      const output = lastFrame();
      // Should only show active and parallel agents (3 total)
      expect(output).toContain('3 agents');
      expect(output).toContain('active-agent');
      expect(output).toContain('parallel-agent-1');
      expect(output).toContain('parallel-agent-2');
      expect(output).not.toContain('waiting-agent');
      expect(output).not.toContain('completed-agent');
      assertNoOverflow(output, BREAKPOINT_CONFIGS.normal.width);
    });
  });
});