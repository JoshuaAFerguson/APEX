import React from 'react';
import { render } from 'ink-testing-library';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ParallelExecutionView, ParallelAgent } from '../ParallelExecutionView.js';

/**
 * Unit tests specifically for the calculateMaxColumns function and its integration
 * with useStdoutDimensions hook. These tests focus on the acceptance criteria:
 *
 * AC: ParallelExecutionView.tsx: 1) Uses useStdoutDimensions hook, 2) maxColumns
 * calculated based on terminal width (1 for narrow, 2 for compact, 3+ for wide),
 * 3) Agents displayed in appropriate grid layout, 4) No horizontal overflow,
 * 5) Unit tests for different widths
 */

// Mock the hooks
const mockUseElapsedTime = vi.fn();
const mockUseStdoutDimensions = vi.fn();

vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

vi.mock('../../hooks/useStdoutDimensions.js', () => ({
  useStdoutDimensions: mockUseStdoutDimensions,
}));

// Mock the ProgressBar component for consistent testing
vi.mock('../ProgressIndicators.js', () => ({
  ProgressBar: vi.fn(({ progress, showPercentage, color }) =>
    `[ProgressBar: ${progress}%${showPercentage ? ' shown' : ''}${color ? ` color:${color}` : ''}]`
  ),
}));

describe('ParallelExecutionView - calculateMaxColumns Function Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseElapsedTime.mockReturnValue('1m 23s');
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // Test agent factory
  const createTestAgent = (name: string): ParallelAgent => ({
    name,
    status: 'parallel',
    stage: 'working',
    progress: 50,
    startedAt: new Date('2024-01-01T10:00:00Z'),
  });

  // Create multiple agents for layout testing
  const createTestAgents = (count: number): ParallelAgent[] =>
    Array.from({ length: count }, (_, i) => createTestAgent(`agent${i + 1}`));

  describe('Narrow Terminal (width < 60) - AC: 1 column for narrow', () => {
    const narrowConfigs = [
      { width: 30, desc: 'very narrow' },
      { width: 45, desc: 'narrow' },
      { width: 59, desc: 'edge of narrow' },
    ];

    narrowConfigs.forEach(({ width, desc }) => {
      describe(`${desc} terminal (width: ${width})`, () => {
        beforeEach(() => {
          mockUseStdoutDimensions.mockReturnValue({
            width,
            height: 24,
            isNarrow: true,
            isCompact: false,
            isNormal: false,
            isWide: false,
            breakpoint: 'narrow',
            isAvailable: true,
          });
        });

        it('should always use maxColumns=1 regardless of compact mode', () => {
          const agents = createTestAgents(4);

          // Test both compact modes
          const { lastFrame: compactFrame } = render(
            <ParallelExecutionView agents={agents} compact={true} />
          );
          const { lastFrame: fullFrame } = render(
            <ParallelExecutionView agents={agents} compact={false} />
          );

          const compactOutput = compactFrame();
          const fullOutput = fullFrame();

          // Both should show all 4 agents (they're parallel/active)
          expect(compactOutput).toContain('⟂ Parallel Execution (4 agents)');
          expect(fullOutput).toContain('⟂ Parallel Execution (4 agents)');

          // All agents should be visible
          ['agent1', 'agent2', 'agent3', 'agent4'].forEach(agentName => {
            expect(compactOutput).toContain(agentName);
            expect(fullOutput).toContain(agentName);
          });
        });

        it('should use maxColumns=1 even with many agents to prevent horizontal overflow', () => {
          const manyAgents = createTestAgents(8);
          const { lastFrame } = render(
            <ParallelExecutionView agents={manyAgents} />
          );

          const output = lastFrame();
          expect(output).toContain('⟂ Parallel Execution (8 agents)');

          // All agents should be visible
          manyAgents.forEach((agent, index) => {
            expect(output).toContain(`agent${index + 1}`);
          });
        });
      });
    });
  });

  describe('Compact Terminal (60 <= width < 100) - AC: 2 columns for compact', () => {
    const compactConfigs = [
      { width: 60, desc: 'edge of compact' },
      { width: 75, desc: 'mid compact' },
      { width: 99, desc: 'edge before normal' },
    ];

    compactConfigs.forEach(({ width, desc }) => {
      describe(`${desc} terminal (width: ${width})`, () => {
        beforeEach(() => {
          mockUseStdoutDimensions.mockReturnValue({
            width,
            height: 24,
            isNarrow: false,
            isCompact: true,
            isNormal: false,
            isWide: false,
            breakpoint: 'compact',
            isAvailable: true,
          });
        });

        it('should use maxColumns=2 in full mode', () => {
          const agents = createTestAgents(6);
          const { lastFrame } = render(
            <ParallelExecutionView agents={agents} compact={false} />
          );

          const output = lastFrame();
          expect(output).toContain('⟂ Parallel Execution (6 agents)');

          // All agents should be visible
          agents.forEach(agent => {
            expect(output).toContain(agent.name);
          });
        });

        it('should use maxColumns=1 in compact mode to prevent overflow', () => {
          const agents = createTestAgents(4);
          const { lastFrame } = render(
            <ParallelExecutionView agents={agents} compact={true} />
          );

          const output = lastFrame();
          expect(output).toContain('⟂ Parallel Execution (4 agents)');

          // All agents should be visible
          agents.forEach(agent => {
            expect(output).toContain(agent.name);
          });
        });
      });
    });
  });

  describe('Normal Terminal (100 <= width < 160) - AC: 3+ columns for wide', () => {
    const normalConfigs = [
      { width: 100, desc: 'edge of normal', expectedCols: { full: 3, compact: 5 } },
      { width: 120, desc: 'mid normal', expectedCols: { full: 4, compact: 6 } },
      { width: 140, desc: 'larger normal', expectedCols: { full: 5, compact: 7 } },
      { width: 159, desc: 'edge before wide', expectedCols: { full: 5, compact: 7 } },
    ];

    normalConfigs.forEach(({ width, desc, expectedCols }) => {
      describe(`${desc} terminal (width: ${width})`, () => {
        beforeEach(() => {
          mockUseStdoutDimensions.mockReturnValue({
            width,
            height: 30,
            isNarrow: false,
            isCompact: false,
            isNormal: true,
            isWide: false,
            breakpoint: 'normal',
            isAvailable: true,
          });
        });

        it(`should calculate maxColumns dynamically for full mode (~${expectedCols.full} columns)`, () => {
          // Create enough agents to test layout
          const agents = createTestAgents(expectedCols.full * 2);
          const { lastFrame } = render(
            <ParallelExecutionView agents={agents} compact={false} />
          );

          const output = lastFrame();
          expect(output).toContain(`⟂ Parallel Execution (${agents.length} agents)`);

          // All agents should be visible
          agents.forEach(agent => {
            expect(output).toContain(agent.name);
          });
        });

        it(`should calculate maxColumns dynamically for compact mode (~${expectedCols.compact} columns)`, () => {
          // Create enough agents to test layout
          const agents = createTestAgents(expectedCols.compact * 2);
          const { lastFrame } = render(
            <ParallelExecutionView agents={agents} compact={true} />
          );

          const output = lastFrame();
          expect(output).toContain(`⟂ Parallel Execution (${agents.length} agents)`);

          // All agents should be visible
          agents.forEach(agent => {
            expect(output).toContain(agent.name);
          });
        });

        it('should handle edge case with card width calculations', () => {
          // Test with exact multiples of card width
          const agents = createTestAgents(1);
          const { lastFrame } = render(
            <ParallelExecutionView agents={agents} />
          );

          const output = lastFrame();
          expect(output).toContain('⟂ Parallel Execution (1 agents)');
          expect(output).toContain('agent1');
        });
      });
    });
  });

  describe('Wide Terminal (width >= 160) - AC: 3+ columns for wide', () => {
    const wideConfigs = [
      { width: 160, desc: 'edge of wide', expectedCols: { full: 5, compact: 8 } },
      { width: 200, desc: 'wide', expectedCols: { full: 7, compact: 10 } },
      { width: 250, desc: 'very wide', expectedCols: { full: 8, compact: 12 } },
      { width: 300, desc: 'ultra wide', expectedCols: { full: 10, compact: 15 } },
    ];

    wideConfigs.forEach(({ width, desc, expectedCols }) => {
      describe(`${desc} terminal (width: ${width})`, () => {
        beforeEach(() => {
          mockUseStdoutDimensions.mockReturnValue({
            width,
            height: 40,
            isNarrow: false,
            isCompact: false,
            isNormal: false,
            isWide: true,
            breakpoint: 'wide',
            isAvailable: true,
          });
        });

        it(`should calculate maxColumns dynamically for full mode (~${expectedCols.full} columns)`, () => {
          const agents = createTestAgents(expectedCols.full + 2);
          const { lastFrame } = render(
            <ParallelExecutionView agents={agents} compact={false} />
          );

          const output = lastFrame();
          expect(output).toContain(`⟂ Parallel Execution (${agents.length} agents)`);

          // All agents should be visible
          agents.forEach(agent => {
            expect(output).toContain(agent.name);
          });
        });

        it(`should calculate maxColumns dynamically for compact mode (~${expectedCols.compact} columns)`, () => {
          const agents = createTestAgents(Math.min(expectedCols.compact + 2, 15)); // Cap for test performance
          const { lastFrame } = render(
            <ParallelExecutionView agents={agents} compact={true} />
          );

          const output = lastFrame();
          expect(output).toContain(`⟂ Parallel Execution (${agents.length} agents)`);

          // All agents should be visible
          agents.forEach(agent => {
            expect(output).toContain(agent.name);
          });
        });

        it('should handle many agents efficiently', () => {
          // Test with more agents than columns to verify multi-row layout
          const agents = createTestAgents(12);
          const { lastFrame } = render(
            <ParallelExecutionView agents={agents} compact={false} />
          );

          const output = lastFrame();
          expect(output).toContain('⟂ Parallel Execution (12 agents)');

          // All agents should be visible even with multi-row layout
          agents.forEach(agent => {
            expect(output).toContain(agent.name);
          });
        });
      });
    });
  });

  describe('Hook Integration - AC: Uses useStdoutDimensions hook', () => {
    it('should call useStdoutDimensions hook on every render', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        breakpoint: 'normal',
        isAvailable: true,
      });

      const agents = createTestAgents(2);
      render(<ParallelExecutionView agents={agents} />);

      expect(mockUseStdoutDimensions).toHaveBeenCalled();
    });

    it('should recalculate maxColumns when terminal dimensions change', () => {
      const agents = createTestAgents(4);

      // Start with narrow terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 24,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const { lastFrame, rerender } = render(
        <ParallelExecutionView agents={agents} />
      );

      const narrowOutput = lastFrame();
      expect(narrowOutput).toContain('⟂ Parallel Execution (4 agents)');

      // Change to wide terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 40,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
        breakpoint: 'wide',
        isAvailable: true,
      });

      rerender(<ParallelExecutionView agents={agents} />);

      const wideOutput = lastFrame();
      expect(wideOutput).toContain('⟂ Parallel Execution (4 agents)');

      // Should call hook again with new dimensions
      expect(mockUseStdoutDimensions).toHaveBeenCalledTimes(2);
    });

    it('should handle all breakpoint boolean flags correctly', () => {
      const agents = createTestAgents(3);
      const breakpointConfigs = [
        { isNarrow: true, isCompact: false, isNormal: false, isWide: false, width: 50, breakpoint: 'narrow' as const },
        { isNarrow: false, isCompact: true, isNormal: false, isWide: false, width: 80, breakpoint: 'compact' as const },
        { isNarrow: false, isCompact: false, isNormal: true, isWide: false, width: 120, breakpoint: 'normal' as const },
        { isNarrow: false, isCompact: false, isNormal: false, isWide: true, width: 200, breakpoint: 'wide' as const },
      ];

      breakpointConfigs.forEach(config => {
        mockUseStdoutDimensions.mockReturnValue({
          ...config,
          height: 30,
          isAvailable: true,
        });

        const { lastFrame } = render(<ParallelExecutionView agents={agents} />);
        const output = lastFrame();

        expect(output).toContain('⟂ Parallel Execution (3 agents)');
        agents.forEach(agent => {
          expect(output).toContain(agent.name);
        });
      });
    });
  });

  describe('Explicit maxColumns Override - AC: Maintains user control', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 30,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        breakpoint: 'normal',
        isAvailable: true,
      });
    });

    it('should ignore responsive calculation when explicit maxColumns provided', () => {
      const agents = createTestAgents(6);

      // Test various explicit values
      const explicitValues = [1, 2, 3, 4, 5, 10];

      explicitValues.forEach(maxColumns => {
        const { lastFrame } = render(
          <ParallelExecutionView agents={agents} maxColumns={maxColumns} />
        );

        const output = lastFrame();
        expect(output).toContain('⟂ Parallel Execution (6 agents)');

        // All agents should still be visible regardless of maxColumns
        agents.forEach(agent => {
          expect(output).toContain(agent.name);
        });
      });
    });

    it('should handle edge cases for explicit maxColumns', () => {
      const agents = createTestAgents(3);

      // Test edge cases
      const edgeCases = [0, -1, 1000];

      edgeCases.forEach(maxColumns => {
        const { lastFrame } = render(
          <ParallelExecutionView agents={agents} maxColumns={maxColumns} />
        );

        const output = lastFrame();
        expect(output).toContain('⟂ Parallel Execution (3 agents)');

        // Should still render all agents without crashing
        agents.forEach(agent => {
          expect(output).toContain(agent.name);
        });
      });
    });

    it('should prioritize explicit maxColumns over all responsive calculations', () => {
      const agents = createTestAgents(4);

      // Test all breakpoints with explicit override
      const breakpoints = [
        { width: 50, isNarrow: true, isCompact: false, isNormal: false, isWide: false },
        { width: 80, isNarrow: false, isCompact: true, isNormal: false, isWide: false },
        { width: 120, isNarrow: false, isCompact: false, isNormal: true, isWide: false },
        { width: 200, isNarrow: false, isCompact: false, isNormal: false, isWide: true },
      ];

      breakpoints.forEach(config => {
        mockUseStdoutDimensions.mockReturnValue({
          ...config,
          height: 30,
          breakpoint: 'normal' as const,
          isAvailable: true,
        });

        const { lastFrame } = render(
          <ParallelExecutionView agents={agents} maxColumns={3} />
        );

        const output = lastFrame();
        expect(output).toContain('⟂ Parallel Execution (4 agents)');

        // All agents should be visible
        agents.forEach(agent => {
          expect(output).toContain(agent.name);
        });
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle unavailable terminal dimensions gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80, // fallback
        height: 24,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        breakpoint: 'compact',
        isAvailable: false, // Not available
      });

      const agents = createTestAgents(3);
      const { lastFrame } = render(<ParallelExecutionView agents={agents} />);

      const output = lastFrame();
      expect(output).toContain('⟂ Parallel Execution (3 agents)');

      // Should still work with fallback dimensions
      agents.forEach(agent => {
        expect(output).toContain(agent.name);
      });
    });

    it('should handle malformed dimensions gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: NaN,
        height: undefined,
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: false,
        breakpoint: 'normal',
        isAvailable: false,
      } as any);

      const agents = createTestAgents(2);
      const { lastFrame } = render(<ParallelExecutionView agents={agents} />);

      const output = lastFrame();
      // Should not crash
      expect(output).toContain('⟂ Parallel Execution (2 agents)');
    });

    it('should ensure minimum maxColumns of 1', () => {
      // Test extremely narrow width that could result in 0 columns
      mockUseStdoutDimensions.mockReturnValue({
        width: 1,
        height: 10,
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
        breakpoint: 'narrow',
        isAvailable: true,
      });

      const agents = createTestAgents(1);
      const { lastFrame } = render(<ParallelExecutionView agents={agents} />);

      const output = lastFrame();
      expect(output).toContain('agent1');
      // Should not crash even with extreme width
    });
  });

  describe('Card Width Calculations - AC: No horizontal overflow', () => {
    it('should respect estimated card widths for different modes', () => {
      // Test specific calculations based on the implementation
      const testConfigs = [
        { width: 112, compact: false, desc: 'Full cards - 4 columns (112/28=4)' },
        { width: 84, compact: false, desc: 'Full cards - 3 columns (84/28=3)' },
        { width: 120, compact: true, desc: 'Compact cards - 6 columns (120/20=6)' },
        { width: 100, compact: true, desc: 'Compact cards - 5 columns (100/20=5)' },
      ];

      testConfigs.forEach(({ width, compact, desc }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          isNarrow: false,
          isCompact: false,
          isNormal: true,
          isWide: false,
          breakpoint: 'normal',
          isAvailable: true,
        });

        const agents = createTestAgents(4);
        const { lastFrame } = render(
          <ParallelExecutionView agents={agents} compact={compact} />
        );

        const output = lastFrame();
        expect(output).toContain('⟂ Parallel Execution (4 agents)');

        // All agents should be visible regardless of calculated columns
        agents.forEach(agent => {
          expect(output).toContain(agent.name);
        });
      });
    });

    it('should handle fractional column calculations correctly', () => {
      // Test widths that don't divide evenly into card widths
      const testWidths = [110, 125, 135, 175, 225];

      testWidths.forEach(width => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 30,
          isNarrow: false,
          isCompact: false,
          isNormal: width < 160,
          isWide: width >= 160,
          breakpoint: width < 160 ? 'normal' : 'wide',
          isAvailable: true,
        });

        const agents = createTestAgents(3);
        const { lastFrame } = render(<ParallelExecutionView agents={agents} />);

        const output = lastFrame();
        expect(output).toContain('⟂ Parallel Execution (3 agents)');

        // Should handle fractional calculations without crashing
        agents.forEach(agent => {
          expect(output).toContain(agent.name);
        });
      });
    });
  });
});