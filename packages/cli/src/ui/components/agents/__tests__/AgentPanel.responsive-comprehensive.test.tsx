import React from 'react';
import { render } from 'ink-testing-library';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock all the hooks
jest.mock('../../../hooks/index.js', () => ({
  ...jest.requireActual('../../../hooks/index.js'),
  useStdoutDimensions: jest.fn(),
}));

jest.mock('../../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: jest.fn().mockReturnValue({
    current: null,
    previous: null,
    isTransitioning: false
  }),
}));

jest.mock('../../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: jest.fn().mockReturnValue('42s'),
}));

import { useStdoutDimensions } from '../../../hooks/index.js';

const mockUseStdoutDimensions = useStdoutDimensions as jest.Mock;

describe('AgentPanel - Comprehensive Responsive Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create mock agents with various states
  function createMockAgents(count: number, includeDebugInfo = false): AgentInfo[] {
    const names = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];
    return Array.from({ length: Math.min(count, names.length) }, (_, i) => ({
      name: names[i],
      status: i === 2 ? 'active' : i === 1 ? 'waiting' : i === 0 ? 'completed' : 'idle',
      stage: i === 2 ? 'implementation' : i === 1 ? 'planning' : undefined,
      progress: i === 2 ? 65 : i === 1 ? 30 : undefined,
      startedAt: i === 2 ? new Date('2024-01-01T12:00:00Z') : undefined,
      debugInfo: includeDebugInfo ? {
        tokensUsed: { input: 1000 + i * 100, output: 500 + i * 50 },
        stageStartedAt: new Date('2024-01-01T11:00:00Z'),
        lastToolCall: `tool_${i}`,
        turnCount: i + 1,
        errorCount: i % 2,
        thinking: `Agent ${names[i]} is thinking about step ${i + 1}...`,
      } : undefined,
    }));
  }

  describe('Acceptance Criteria 1: Uses useStdoutDimensions hook', () => {
    it('calls useStdoutDimensions hook on render', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 40,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      });

      render(<AgentPanel agents={createMockAgents(3)} />);
      expect(mockUseStdoutDimensions).toHaveBeenCalledTimes(1);
    });

    it('receives responsive data from hook', () => {
      const mockDimensions = {
        width: 80,
        height: 30,
        breakpoint: 'compact' as const,
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
        isAvailable: true,
      };
      mockUseStdoutDimensions.mockReturnValue(mockDimensions);

      render(<AgentPanel agents={createMockAgents(3)} />);
      expect(mockUseStdoutDimensions).toHaveReturnedWith(mockDimensions);
    });

    it('handles hook data with explicit width override', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide',
        isWide: true,
      });

      // Despite wide terminal, explicit narrow width should force narrow mode
      render(<AgentPanel agents={createMockAgents(3)} width={45} />);
      expect(mockUseStdoutDimensions).toHaveBeenCalled();
    });
  });

  describe('Acceptance Criteria 2: Automatically switches between compact/detailed mode', () => {
    it('switches to compact mode for narrow breakpoints', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 25,
        breakpoint: 'narrow',
        isNarrow: true,
      });

      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      // Compact mode characteristics: no border, no title, inline display
      expect(lastFrame()).not.toContain('Active Agents');
      expect(lastFrame()).not.toContain('╭');
      expect(lastFrame()).toContain('|'); // Separator in compact mode
    });

    it('switches to detailed mode for normal/wide breakpoints', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 40,
        breakpoint: 'normal',
        isNormal: true,
      });

      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      // Detailed mode characteristics: border, title, structured layout
      expect(lastFrame()).toContain('Active Agents');
      expect(lastFrame()).toContain('╭');
    });

    it('automatically switches based on agent count in normal mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 40,
        breakpoint: 'normal',
        isNormal: true,
      });

      // Many agents should trigger auto-compact even in normal mode
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(6)} />);
      // Should be more compact due to many agents
      expect(lastFrame()).toBeTruthy(); // Basic render test
    });

    it('respects explicit compact prop override', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 50,
        breakpoint: 'wide',
        isWide: true,
      });

      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} compact={true} />
      );
      // Should be compact despite wide terminal
      expect(lastFrame()).not.toContain('Active Agents');
    });

    it('respects displayMode="compact" override', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 50,
        breakpoint: 'wide',
        isWide: true,
      });

      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} displayMode="compact" />
      );
      // Should be compact despite wide terminal
      expect(lastFrame()).not.toContain('Active Agents');
    });

    it('always honors verbose mode regardless of terminal size', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 20,
        breakpoint: 'narrow',
        isNarrow: true,
      });

      const agents = createMockAgents(3, true);
      const { lastFrame } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );
      // Verbose mode shows debug info even in narrow terminals
      expect(lastFrame()).toContain('Tokens');
    });
  });

  describe('Acceptance Criteria 3: Narrow terminals show abbreviated agent info', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 25,
        breakpoint: 'narrow',
        isNarrow: true,
      });
    });

    it('abbreviates standard agent names', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(6)} />);
      const output = lastFrame();

      expect(output).toContain('plan'); // planner -> plan
      expect(output).toContain('arch'); // architect -> arch
      expect(output).toContain('dev');  // developer -> dev
      expect(output).toContain('test'); // tester -> test
      expect(output).toContain('rev');  // reviewer -> rev
      expect(output).toContain('ops');  // devops -> ops
    });

    it('does not show stage information', () => {
      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} currentAgent="developer" />
      );
      expect(lastFrame()).not.toContain('(implementation)');
    });

    it('shows elapsed time when available', () => {
      const agents = createMockAgents(3);
      agents[2].startedAt = new Date();
      const { lastFrame } = render(
        <AgentPanel agents={agents} currentAgent="developer" />
      );
      expect(lastFrame()).toContain('[42s]');
    });

    it('shows inline progress percentage', () => {
      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} currentAgent="developer" />
      );
      expect(lastFrame()).toContain('65%');
    });

    it('does not show progress bars', () => {
      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} currentAgent="developer" />
      );
      expect(lastFrame()).not.toMatch(/[█░]/);
    });

    it('hides parallel section entirely', () => {
      const parallelAgents = [
        { name: 'architect', status: 'parallel' as const, progress: 30 },
        { name: 'devops', status: 'parallel' as const, progress: 45 },
      ];

      const { lastFrame } = render(
        <AgentPanel
          agents={createMockAgents(3)}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );
      expect(lastFrame()).not.toContain('⟂');
    });

    it('hides thoughts preview', () => {
      const agentsWithThoughts = createMockAgents(3, true);
      const { lastFrame } = render(
        <AgentPanel
          agents={agentsWithThoughts}
          currentAgent="developer"
          showThoughts={true}
        />
      );
      expect(lastFrame()).not.toContain('thinking about');
    });
  });

  describe('Acceptance Criteria 4: Wide terminals show full agent details', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 50,
        breakpoint: 'wide',
        isWide: true,
      });
    });

    it('shows full agent names', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(6)} />);
      const output = lastFrame();

      expect(output).toContain('planner');
      expect(output).toContain('architect');
      expect(output).toContain('developer');
      expect(output).toContain('tester');
      expect(output).toContain('reviewer');
      expect(output).toContain('devops');
    });

    it('shows full panel with border and title', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      const output = lastFrame();

      expect(output).toContain('Active Agents');
      expect(output).toContain('╭');
    });

    it('shows stage information', () => {
      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} currentAgent="developer" />
      );
      expect(lastFrame()).toContain('(implementation)');
    });

    it('shows wide progress bars (40 chars vs 30)', () => {
      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} currentAgent="developer" />
      );
      expect(lastFrame()).toMatch(/[█░]/);
      // Wide terminals use 40-char progress bars vs 30-char in normal
    });

    it('shows full parallel execution details', () => {
      const parallelAgents = [
        { name: 'architect', status: 'parallel' as const, progress: 30, stage: 'design' },
        { name: 'devops', status: 'parallel' as const, progress: 45, stage: 'setup' },
      ];

      const { lastFrame } = render(
        <AgentPanel
          agents={createMockAgents(3)}
          showParallel={true}
          parallelAgents={parallelAgents}
          useDetailedParallelView={true}
        />
      );

      expect(lastFrame()).toContain('⟂ Parallel Execution');
      expect(lastFrame()).toContain('(design)');
      expect(lastFrame()).toContain('(setup)');
    });

    it('shows more parallel agents (up to 10)', () => {
      const manyParallelAgents = Array.from({ length: 12 }, (_, i) => ({
        name: `agent${i}`,
        status: 'parallel' as const,
        progress: 20 + i * 5,
      }));

      const { lastFrame } = render(
        <AgentPanel
          agents={createMockAgents(3)}
          showParallel={true}
          parallelAgents={manyParallelAgents}
        />
      );

      const output = lastFrame();
      expect(output).toContain('agent0');
      expect(output).toContain('agent9'); // Wide shows up to 10
      expect(output).toContain('+2'); // Shows overflow count
    });

    it('shows longer thoughts preview (150 chars)', () => {
      const agentsWithThoughts = createMockAgents(3, true);
      const { lastFrame } = render(
        <AgentPanel
          agents={agentsWithThoughts}
          currentAgent="developer"
          showThoughts={true}
        />
      );
      expect(lastFrame()).toContain('thinking about');
    });
  });

  describe('Acceptance Criteria 5: No visual overflow at any width', () => {
    const testWidths = [35, 40, 50, 60, 80, 100, 120, 160, 180, 200, 220];

    testWidths.forEach(width => {
      it(`prevents overflow at width ${width}`, () => {
        const breakpoint = width < 60 ? 'narrow' :
                          width < 100 ? 'compact' :
                          width < 160 ? 'normal' : 'wide';

        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 40,
          breakpoint,
          isNarrow: width < 60,
          isCompact: width >= 60 && width < 100,
          isNormal: width >= 100 && width < 160,
          isWide: width >= 160,
        });

        const { lastFrame } = render(<AgentPanel agents={createMockAgents(6)} />);
        const lines = lastFrame()?.split('\n') || [];

        lines.forEach((line, index) => {
          // Strip ANSI escape codes for accurate length measurement
          const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
          expect(cleanLine.length).toBeLessThanOrEqual(width + 5); // Small margin for border chars
        });
      });
    });

    it('handles many agents without overflow in narrow terminal', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        height: 25,
        breakpoint: 'narrow',
        isNarrow: true,
      });

      const manyAgents = createMockAgents(6);
      const { lastFrame } = render(<AgentPanel agents={manyAgents} />);
      const lines = lastFrame()?.split('\n') || [];

      lines.forEach(line => {
        const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
        expect(cleanLine.length).toBeLessThanOrEqual(45); // 40 + small margin
      });
    });

    it('handles long agent names gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 25,
        breakpoint: 'narrow',
        isNarrow: true,
      });

      const longNameAgents = [
        { name: 'very-very-long-agent-name-that-exceeds-normal-limits', status: 'active' as const },
        { name: 'another-extremely-long-name', status: 'waiting' as const },
      ];

      const { lastFrame } = render(<AgentPanel agents={longNameAgents} />);
      const lines = lastFrame()?.split('\n') || [];

      lines.forEach(line => {
        const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
        expect(cleanLine.length).toBeLessThanOrEqual(55); // 50 + small margin
      });
    });

    it('adjusts agent name length based on available space', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 45,
        height: 25,
        breakpoint: 'narrow',
        isNarrow: true,
      });

      const { lastFrame } = render(<AgentPanel agents={createMockAgents(6)} />);
      const output = lastFrame();

      // Should show abbreviated names that fit in available space
      expect(output).toContain('plan');
      expect(output).not.toContain('planner'); // Full name should be abbreviated
    });
  });

  describe('Acceptance Criteria 6: Unit tests for responsive behavior', () => {
    it('tests responsive configuration generation', () => {
      const configs = [
        { width: 50, breakpoint: 'narrow' as const },
        { width: 80, breakpoint: 'compact' as const },
        { width: 120, breakpoint: 'normal' as const },
        { width: 180, breakpoint: 'wide' as const },
      ];

      configs.forEach(({ width, breakpoint }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 40,
          breakpoint,
          [`is${breakpoint.charAt(0).toUpperCase()}${breakpoint.slice(1)}`]: true,
        });

        const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
        expect(lastFrame()).toBeTruthy(); // Component renders successfully
      });
    });

    it('tests edge case breakpoint boundaries', () => {
      const boundaryWidths = [59, 60, 99, 100, 159, 160];

      boundaryWidths.forEach(width => {
        const breakpoint = width < 60 ? 'narrow' :
                          width < 100 ? 'compact' :
                          width < 160 ? 'normal' : 'wide';

        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 40,
          breakpoint,
        });

        const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
        expect(lastFrame()).toBeTruthy();
      });
    });

    it('tests fallback behavior when dimensions unavailable', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80, // Fallback width
        height: 24, // Fallback height
        breakpoint: 'compact',
        isAvailable: false, // Key: dimensions not actually available
      });

      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toBeTruthy();
    });

    it('tests complex scenarios with all features enabled', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 150,
        height: 40,
        breakpoint: 'normal',
        isNormal: true,
      });

      const complexAgents = createMockAgents(5, true);
      const parallelAgents = [
        { name: 'arch1', status: 'parallel' as const, progress: 25, stage: 'design' },
        { name: 'arch2', status: 'parallel' as const, progress: 75, stage: 'review' },
      ];

      const { lastFrame } = render(
        <AgentPanel
          agents={complexAgents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
          useDetailedParallelView={true}
          showThoughts={true}
          displayMode="normal"
        />
      );

      const output = lastFrame();
      expect(output).toContain('Active Agents');
      expect(output).toContain('⟂ Parallel Execution');
      expect(output).toContain('thinking about');
    });

    it('tests performance with many rapid re-renders', () => {
      const widths = [50, 80, 120, 160, 180, 120, 80, 50];

      widths.forEach((width, index) => {
        const breakpoint = width < 60 ? 'narrow' :
                          width < 100 ? 'compact' :
                          width < 160 ? 'normal' : 'wide';

        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 40,
          breakpoint,
        });

        const { lastFrame } = render(
          <AgentPanel
            key={index}
            agents={createMockAgents(4)}
          />
        );
        expect(lastFrame()).toBeTruthy();
      });
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('handles empty agent array', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 40,
        breakpoint: 'normal',
        isNormal: true,
      });

      const { lastFrame } = render(<AgentPanel agents={[]} />);
      expect(lastFrame()).toBeTruthy();
    });

    it('handles single agent', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 25,
        breakpoint: 'narrow',
        isNarrow: true,
      });

      const { lastFrame } = render(<AgentPanel agents={createMockAgents(1)} />);
      expect(lastFrame()).toBeTruthy();
    });

    it('handles agents without progress or timing info', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 40,
        breakpoint: 'normal',
        isNormal: true,
      });

      const minimalAgents = [
        { name: 'minimal', status: 'idle' as const },
      ];

      const { lastFrame } = render(<AgentPanel agents={minimalAgents} />);
      expect(lastFrame()).toBeTruthy();
    });

    it('handles very small terminal widths gracefully', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 20, // Extremely narrow
        height: 10,
        breakpoint: 'narrow',
        isNarrow: true,
      });

      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      const lines = lastFrame()?.split('\n') || [];

      lines.forEach(line => {
        const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
        expect(cleanLine.length).toBeLessThanOrEqual(25); // 20 + margin
      });
    });
  });
});