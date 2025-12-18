import React from 'react';
import { render } from 'ink-testing-library';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock modules
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
  useElapsedTime: jest.fn().mockReturnValue('1m 23s'),
}));

import { useStdoutDimensions } from '../../../hooks/index.js';
import { useElapsedTime } from '../../../hooks/useElapsedTime.js';

const mockUseStdoutDimensions = useStdoutDimensions as jest.Mock;
const mockUseElapsedTime = useElapsedTime as jest.Mock;

describe('AgentPanel - Responsive Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create realistic agent data
  function createRealisticAgents(): AgentInfo[] {
    return [
      {
        name: 'planner',
        status: 'completed',
        stage: 'planning',
        progress: 100,
        startedAt: new Date('2024-01-01T10:00:00Z'),
      },
      {
        name: 'architect',
        status: 'completed',
        stage: 'architecture',
        progress: 100,
        startedAt: new Date('2024-01-01T10:15:00Z'),
      },
      {
        name: 'developer',
        status: 'active',
        stage: 'implementation',
        progress: 75,
        startedAt: new Date('2024-01-01T10:30:00Z'),
        debugInfo: {
          tokensUsed: { input: 2500, output: 1200 },
          stageStartedAt: new Date('2024-01-01T10:30:00Z'),
          lastToolCall: 'write_file',
          turnCount: 8,
          errorCount: 1,
          thinking: 'Implementing the responsive layout functionality by creating configuration objects for different breakpoints...',
        },
      },
      {
        name: 'tester',
        status: 'waiting',
        stage: 'testing',
        progress: 0,
      },
      {
        name: 'reviewer',
        status: 'idle',
      },
      {
        name: 'devops',
        status: 'idle',
      },
    ];
  }

  function createParallelAgents(): AgentInfo[] {
    return [
      {
        name: 'arch-microservice-1',
        status: 'parallel',
        stage: 'design',
        progress: 45,
        startedAt: new Date('2024-01-01T11:00:00Z'),
      },
      {
        name: 'arch-microservice-2',
        status: 'parallel',
        stage: 'design',
        progress: 60,
        startedAt: new Date('2024-01-01T11:02:00Z'),
      },
      {
        name: 'dev-frontend',
        status: 'parallel',
        stage: 'implementation',
        progress: 30,
        startedAt: new Date('2024-01-01T11:05:00Z'),
      },
    ];
  }

  describe('Real-world responsive scenarios', () => {
    it('integrates correctly with terminal resize from wide to narrow', () => {
      const agents = createRealisticAgents();

      // Start with wide terminal
      mockUseStdoutDimensions.mockReturnValue({
        width: 200,
        height: 50,
        breakpoint: 'wide',
        isWide: true,
        isAvailable: true,
      });

      const { lastFrame, rerender } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      // Should show detailed view
      let output = lastFrame();
      expect(output).toContain('Active Agents');
      expect(output).toContain('(implementation)');
      expect(output).toContain('Implementing the responsive layout');

      // Simulate terminal resize to narrow
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 25,
        breakpoint: 'narrow',
        isNarrow: true,
        isAvailable: true,
      });

      rerender(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showThoughts={true}
        />
      );

      // Should switch to compact view
      output = lastFrame();
      expect(output).not.toContain('Active Agents'); // No title
      expect(output).not.toContain('(implementation)'); // No stage info
      expect(output).not.toContain('Implementing the responsive layout'); // No thoughts
      expect(output).toContain('dev'); // Abbreviated name
      expect(output).toContain('75%'); // Inline progress
    });

    it('handles dynamic width changes with explicit width prop', () => {
      const agents = createRealisticAgents();

      mockUseStdoutDimensions.mockReturnValue({
        width: 200, // Terminal is wide
        height: 50,
        breakpoint: 'wide',
        isWide: true,
      });

      const { lastFrame, rerender } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          width={50} // But explicit width is narrow
        />
      );

      // Should use narrow layout despite wide terminal
      let output = lastFrame();
      expect(output).not.toContain('Active Agents');
      expect(output).toContain('dev'); // Abbreviated

      // Change explicit width to wide
      rerender(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          width={180}
        />
      );

      output = lastFrame();
      expect(output).toContain('Active Agents');
      expect(output).toContain('developer'); // Full name
    });

    it('integrates with parallel execution in different terminal sizes', () => {
      const agents = createRealisticAgents();
      const parallelAgents = createParallelAgents();

      // Test in compact mode
      mockUseStdoutDimensions.mockReturnValue({
        width: 80,
        height: 30,
        breakpoint: 'compact',
        isCompact: true,
      });

      const { lastFrame, rerender } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      let output = lastFrame();
      expect(output).toContain('⟂'); // Parallel indicator
      expect(output).toContain('arch-microservice-1'); // Shows limited parallel agents

      // Switch to narrow mode
      mockUseStdoutDimensions.mockReturnValue({
        width: 50,
        height: 25,
        breakpoint: 'narrow',
        isNarrow: true,
      });

      rerender(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      output = lastFrame();
      // Narrow mode should hide parallel section
      expect(output).not.toContain('⟂');

      // Switch to wide mode
      mockUseStdoutDimensions.mockReturnValue({
        width: 180,
        height: 50,
        breakpoint: 'wide',
        isWide: true,
      });

      rerender(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
          useDetailedParallelView={true}
        />
      );

      output = lastFrame();
      expect(output).toContain('⟂ Parallel Execution'); // Full section header
      expect(output).toContain('(design)'); // Stage info in wide mode
    });

    it('integrates hook data with elapsed time updates', () => {
      const agents = createRealisticAgents();

      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 40,
        breakpoint: 'normal',
        isNormal: true,
      });

      // Mock different elapsed times for different calls
      mockUseElapsedTime
        .mockReturnValueOnce('45s')    // planner (completed, shouldn't show)
        .mockReturnValueOnce('30s')    // architect (completed, shouldn't show)
        .mockReturnValueOnce('2m 15s') // developer (active, should show)
        .mockReturnValueOnce('0s');    // tester (waiting, shouldn't show)

      const { lastFrame } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
        />
      );

      const output = lastFrame();
      expect(output).toContain('[2m 15s]'); // Active agent shows elapsed time
      expect(mockUseElapsedTime).toHaveBeenCalledWith(agents[2].startedAt); // Called for active agent
    });

    it('handles complex agent state transitions with responsive layout', () => {
      let agents = createRealisticAgents();

      mockUseStdoutDimensions.mockReturnValue({
        width: 120,
        height: 40,
        breakpoint: 'normal',
        isNormal: true,
      });

      const { lastFrame, rerender } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
        />
      );

      // Initial state
      let output = lastFrame();
      expect(output).toContain('developer');
      expect(output).toContain('75%');

      // Simulate agent completion and handoff
      agents = agents.map(agent => {
        if (agent.name === 'developer') {
          return { ...agent, status: 'completed' as const, progress: 100 };
        }
        if (agent.name === 'tester') {
          return {
            ...agent,
            status: 'active' as const,
            progress: 15,
            startedAt: new Date('2024-01-01T11:30:00Z'),
          };
        }
        return agent;
      });

      rerender(
        <AgentPanel
          agents={agents}
          currentAgent="tester"
        />
      );

      output = lastFrame();
      expect(output).toContain('tester');
      expect(output).toContain('15%');
    });

    it('verifies responsive configuration consistency across renders', () => {
      const agents = createRealisticAgents();
      const scenarios = [
        { width: 45, breakpoint: 'narrow' as const, expectedAbbreviation: true },
        { width: 75, breakpoint: 'compact' as const, expectedAbbreviation: false },
        { width: 125, breakpoint: 'normal' as const, expectedTitle: true },
        { width: 175, breakpoint: 'wide' as const, expectedFullFeatures: true },
      ];

      scenarios.forEach(({ width, breakpoint, expectedAbbreviation, expectedTitle, expectedFullFeatures }) => {
        mockUseStdoutDimensions.mockReturnValue({
          width,
          height: 40,
          breakpoint,
          [`is${breakpoint.charAt(0).toUpperCase()}${breakpoint.slice(1)}`]: true,
        });

        const { lastFrame } = render(
          <AgentPanel
            agents={agents}
            currentAgent="developer"
            showThoughts={true}
          />
        );

        const output = lastFrame();

        if (expectedAbbreviation) {
          expect(output).toContain('dev');
          expect(output).not.toContain('developer');
        }

        if (expectedTitle) {
          expect(output).toContain('Active Agents');
        }

        if (expectedFullFeatures) {
          expect(output).toContain('developer');
          expect(output).toContain('(implementation)');
        }

        // Verify no overflow
        const lines = output?.split('\n') || [];
        lines.forEach(line => {
          const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
          expect(cleanLine.length).toBeLessThanOrEqual(width + 5);
        });
      });
    });
  });

  describe('Hook integration edge cases', () => {
    it('handles hook returning undefined dimensions', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 80, // Fallback
        height: 24, // Fallback
        breakpoint: 'compact',
        isAvailable: false,
      });

      const { lastFrame } = render(
        <AgentPanel agents={createRealisticAgents()} />
      );

      expect(lastFrame()).toBeTruthy();
    });

    it('handles hook returning extreme dimensions', () => {
      mockUseStdoutDimensions.mockReturnValue({
        width: 1000, // Very wide
        height: 100,
        breakpoint: 'wide',
        isWide: true,
      });

      const { lastFrame } = render(
        <AgentPanel agents={createRealisticAgents()} />
      );

      expect(lastFrame()).toBeTruthy();

      // Test very narrow
      mockUseStdoutDimensions.mockReturnValue({
        width: 10, // Extremely narrow
        height: 5,
        breakpoint: 'narrow',
        isNarrow: true,
      });

      const { lastFrame: narrowFrame } = render(
        <AgentPanel agents={createRealisticAgents()} />
      );

      expect(narrowFrame()).toBeTruthy();
    });

    it('integrates with all hook properties', () => {
      const fullHookReturn = {
        width: 120,
        height: 40,
        breakpoint: 'normal' as const,
        isNarrow: false,
        isCompact: false,
        isNormal: true,
        isWide: false,
        isAvailable: true,
      };

      mockUseStdoutDimensions.mockReturnValue(fullHookReturn);

      const { lastFrame } = render(
        <AgentPanel agents={createRealisticAgents()} />
      );

      expect(lastFrame()).toBeTruthy();
      expect(mockUseStdoutDimensions).toHaveReturnedWith(fullHookReturn);
    });
  });

  describe('Performance and memory integration', () => {
    it('handles rapid dimension changes efficiently', () => {
      const agents = createRealisticAgents();
      const dimensionSequence = [
        { width: 50, breakpoint: 'narrow' as const },
        { width: 80, breakpoint: 'compact' as const },
        { width: 120, breakpoint: 'normal' as const },
        { width: 180, breakpoint: 'wide' as const },
        { width: 60, breakpoint: 'compact' as const },
        { width: 40, breakpoint: 'narrow' as const },
      ];

      const { rerender } = render(
        <AgentPanel agents={agents} currentAgent="developer" />
      );

      dimensionSequence.forEach((dimensions, index) => {
        mockUseStdoutDimensions.mockReturnValue({
          ...dimensions,
          height: 40,
          [`is${dimensions.breakpoint.charAt(0).toUpperCase()}${dimensions.breakpoint.slice(1)}`]: true,
        });

        rerender(
          <AgentPanel
            key={index}
            agents={agents}
            currentAgent="developer"
          />
        );
      });

      expect(mockUseStdoutDimensions).toHaveBeenCalledTimes(dimensionSequence.length);
    });

    it('maintains consistent behavior with many agents', () => {
      const manyAgents: AgentInfo[] = Array.from({ length: 20 }, (_, i) => ({
        name: `agent-${i}`,
        status: i % 4 === 0 ? 'active' : i % 4 === 1 ? 'completed' : i % 4 === 2 ? 'waiting' : 'idle',
        progress: i % 4 === 0 ? 50 + i : undefined,
        stage: i % 4 === 0 ? 'working' : undefined,
        startedAt: i % 4 === 0 ? new Date() : undefined,
      }));

      mockUseStdoutDimensions.mockReturnValue({
        width: 60,
        height: 30,
        breakpoint: 'compact',
        isCompact: true,
      });

      const { lastFrame } = render(
        <AgentPanel agents={manyAgents} currentAgent="agent-0" />
      );

      const output = lastFrame();
      expect(output).toBeTruthy();

      // Verify no overflow with many agents
      const lines = output?.split('\n') || [];
      lines.forEach(line => {
        const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
        expect(cleanLine.length).toBeLessThanOrEqual(65);
      });
    });
  });
});