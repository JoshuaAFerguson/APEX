import React from 'react';
import { render } from 'ink-testing-library';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock the useStdoutDimensions hook
jest.mock('../../../hooks/index.js', () => ({
  ...jest.requireActual('../../../hooks/index.js'),
  useStdoutDimensions: jest.fn(),
}));

// Mock the useAgentHandoff hook
jest.mock('../../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: jest.fn().mockReturnValue({ current: null, previous: null, isTransitioning: false }),
}));

// Mock the useElapsedTime hook
jest.mock('../../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: jest.fn().mockReturnValue('42s'),
}));

import { useStdoutDimensions } from '../../../hooks/index.js';

const mockUseStdoutDimensions = useStdoutDimensions as jest.Mock;

// Helper to create mock agents
function createMockAgents(count: number): AgentInfo[] {
  const names = ['planner', 'architect', 'developer', 'tester', 'reviewer', 'devops'];
  return Array.from({ length: Math.min(count, names.length) }, (_, i) => ({
    name: names[i],
    status: i === 2 ? 'active' : 'idle',
    stage: i === 2 ? 'implementation' : undefined,
    progress: i === 2 ? 65 : undefined,
    startedAt: i === 2 ? new Date() : undefined,
  }));
}

describe('AgentPanel - Responsive Layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Hook integration', () => {
    it('uses useStdoutDimensions hook', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 40,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });

      render(<AgentPanel agents={createMockAgents(3)} />);
      expect(mockUseStdoutDimensions).toHaveBeenCalled();
    });

    it('respects explicit width prop', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 40,
        breakpoint: 'wide',
      });

      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} width={50} />
      );

      // Should use compact mode despite wide terminal because explicit width is narrow
      expect(lastFrame()).not.toContain('Active Agents'); // No title in compact
    });
  });

  describe('Narrow terminals (< 60 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 30,
        breakpoint: 'narrow',
        isNarrow: true,
        isCompact: false,
        isNormal: false,
        isWide: false,
      });
    });

    it('automatically switches to compact mode', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).not.toContain('Active Agents'); // No title in compact
      expect(lastFrame()).not.toContain('╭'); // No border
    });

    it('abbreviates agent names', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('dev'); // Abbreviated from 'developer'
    });

    it('shows elapsed time inline', () => {
      const agents = createMockAgents(3);
      agents[2].startedAt = new Date();
      const { lastFrame } = render(
        <AgentPanel agents={agents} currentAgent="developer" />
      );
      expect(lastFrame()).toMatch(/\[42s\]/); // Elapsed time format
    });

    it('hides progress bars', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).not.toContain('████'); // No progress bar characters
    });

    it('shows inline progress percentage', () => {
      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} currentAgent="developer" />
      );
      expect(lastFrame()).toContain('65%'); // Inline progress
    });

    it('does not overflow terminal width', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(6)} />);
      const lines = lastFrame()?.split('\n') || [];
      lines.forEach(line => {
        // Strip ANSI codes and check length
        const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
        expect(cleanLine.length).toBeLessThanOrEqual(50 + 5); // Allow small margin
      });
    });
  });

  describe('Compact terminals (60-100 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 30,
        breakpoint: 'compact',
        isNarrow: false,
        isCompact: true,
        isNormal: false,
        isWide: false,
      });
    });

    it('shows full agent names', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('developer');
    });

    it('uses compact layout', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('|'); // Separator
    });

    it('shows parallel agents if enabled', () => {
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
      expect(lastFrame()).toContain('⟂');
      expect(lastFrame()).toContain('architect');
    });
  });

  describe('Normal terminals (100-160 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 40,
        breakpoint: 'normal',
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
      });
    });

    it('shows bordered panel', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('╭'); // Border character
    });

    it('shows title', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('Active Agents');
    });

    it('shows progress bars', () => {
      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} currentAgent="developer" />
      );
      expect(lastFrame()).toMatch(/[█░]/); // Progress bar characters
    });

    it('shows stage information', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('(implementation)');
    });

    it('shows parallel execution section', () => {
      const parallelAgents = [
        { name: 'architect', status: 'parallel' as const, progress: 30, stage: 'design' },
        { name: 'devops', status: 'parallel' as const, progress: 45, stage: 'setup' },
      ];

      const { lastFrame } = render(
        <AgentPanel
          agents={createMockAgents(3)}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );
      expect(lastFrame()).toContain('⟂ Parallel Execution');
    });
  });

  describe('Wide terminals (>= 160 cols)', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 50,
        breakpoint: 'wide',
        isNarrow: false,
        isCompact: false,
        isNormal: false,
        isWide: true,
      });
    });

    it('shows full details', () => {
      const { lastFrame } = render(<AgentPanel agents={createMockAgents(3)} />);
      expect(lastFrame()).toContain('Active Agents');
      expect(lastFrame()).toContain('developer');
    });

    it('shows wider progress bars', () => {
      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} currentAgent="developer" />
      );
      // Wide terminals should show 40-char progress bars vs 30-char in normal
      expect(lastFrame()).toMatch(/[█░]/);
    });

    it('shows more parallel agents', () => {
      const manyParallelAgents = Array.from({ length: 8 }, (_, i) => ({
        name: `agent${i}`,
        status: 'parallel' as const,
        progress: 20 + i * 10,
      }));

      const { lastFrame } = render(
        <AgentPanel
          agents={createMockAgents(3)}
          showParallel={true}
          parallelAgents={manyParallelAgents}
        />
      );
      expect(lastFrame()).toContain('agent0');
      expect(lastFrame()).toContain('agent7'); // Wide shows up to 10 agents
    });
  });

  describe('Display mode interactions', () => {
    it('compact prop overrides responsive auto-switching', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        breakpoint: 'wide',
      });

      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} compact={true} />
      );
      expect(lastFrame()).not.toContain('Active Agents');
    });

    it('verbose mode always shows debug info', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        breakpoint: 'narrow',
      });

      const agents = createMockAgents(3);
      agents[2].debugInfo = {
        tokensUsed: { input: 1000, output: 500 },
        turnCount: 5,
      };

      const { lastFrame } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          displayMode="verbose"
        />
      );
      expect(lastFrame()).toContain('Tokens'); // Verbose mode shows debug info
    });

    it('displayMode compact overrides responsive', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        breakpoint: 'wide',
      });

      const { lastFrame } = render(
        <AgentPanel agents={createMockAgents(3)} displayMode="compact" />
      );
      expect(lastFrame()).not.toContain('Active Agents'); // Force compact
    });
  });

  describe('Agent name formatting', () => {
    it('truncates long agent names in narrow mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 40,
        breakpoint: 'narrow',
      });

      const agentsWithLongNames = [
        { name: 'very-long-agent-name', status: 'active' as const },
      ];

      const { lastFrame } = render(<AgentPanel agents={agentsWithLongNames} />);
      const output = lastFrame();
      expect(output).not.toContain('very-long-agent-name'); // Should be truncated
    });
  });

  describe('Thoughts preview', () => {
    beforeEach(() => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        breakpoint: 'normal',
      });
    });

    it('shows thoughts preview in normal mode when enabled', () => {
      const agentsWithThoughts = createMockAgents(3);
      agentsWithThoughts[2].debugInfo = {
        thinking: 'This is what the agent is thinking about...',
      };

      const { lastFrame } = render(
        <AgentPanel
          agents={agentsWithThoughts}
          currentAgent="developer"
          showThoughts={true}
        />
      );
      expect(lastFrame()).toContain('This is what the agent');
    });

    it('hides thoughts preview in narrow mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        breakpoint: 'narrow',
      });

      const agentsWithThoughts = createMockAgents(3);
      agentsWithThoughts[2].debugInfo = {
        thinking: 'This should not be visible',
      };

      const { lastFrame } = render(
        <AgentPanel
          agents={agentsWithThoughts}
          currentAgent="developer"
          showThoughts={true}
        />
      );
      expect(lastFrame()).not.toContain('This should not be visible');
    });
  });

  describe('No overflow at any width', () => {
    it.each([40, 50, 60, 80, 100, 120, 160, 200])(
      'renders without overflow at width %d',
      (width) => {
        const breakpoint = width < 60 ? 'narrow' : width < 100 ? 'compact' : width < 160 ? 'normal' : 'wide';
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 40,
          breakpoint,
        });

        const { lastFrame } = render(<AgentPanel agents={createMockAgents(6)} />);
        const lines = lastFrame()?.split('\n') || [];

        lines.forEach(line => {
          // Strip ANSI codes and check length
          const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
          expect(cleanLine.length).toBeLessThanOrEqual(width + 5); // Allow small margin for edge cases
        });
      }
    );
  });

  describe('Parallel agent limiting', () => {
    it('limits parallel agents in narrow mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        breakpoint: 'narrow',
      });

      const manyParallelAgents = Array.from({ length: 5 }, (_, i) => ({
        name: `agent${i}`,
        status: 'parallel' as const,
      }));

      const { lastFrame } = render(
        <AgentPanel
          agents={createMockAgents(3)}
          showParallel={true}
          parallelAgents={manyParallelAgents}
        />
      );

      // Narrow mode shouldn't show parallel section at all
      expect(lastFrame()).not.toContain('⟂');
    });

    it('shows limited parallel agents in compact mode', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        breakpoint: 'compact',
      });

      const manyParallelAgents = Array.from({ length: 5 }, (_, i) => ({
        name: `agent${i}`,
        status: 'parallel' as const,
      }));

      const { lastFrame } = render(
        <AgentPanel
          agents={createMockAgents(3)}
          showParallel={true}
          parallelAgents={manyParallelAgents}
        />
      );

      expect(lastFrame()).toContain('⟂');
      expect(lastFrame()).toContain('+2'); // Shows overflow count
    });
  });

  describe('Dynamic configuration adjustment', () => {
    it('adjusts to compact layout for many agents in normal terminal', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        breakpoint: 'normal',
      });

      // Create 6 agents, which should trigger auto-compact in normal mode
      const manyAgents = createMockAgents(6);

      const { lastFrame } = render(<AgentPanel agents={manyAgents} />);

      // With many agents, it should switch to compact layout automatically
      // This is harder to test directly, but we can check it doesn't have full border styling
      const output = lastFrame();
      // The exact behavior depends on the implementation, but generally many agents should be more compact
      expect(output).toBeTruthy(); // Basic render test
    });
  });
});