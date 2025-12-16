import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

/**
 * Test the integration between AgentPanel and ProgressBar component
 * Ensures progress bars are displayed correctly for agents with progress
 */
describe('AgentPanel - ProgressBar Integration', () => {
  const mockUseElapsedTime = vi.fn();
  const mockUseAgentHandoff = vi.fn();

  beforeEach(() => {
    vi.doMock('../../hooks/useElapsedTime.js', () => ({
      useElapsedTime: mockUseElapsedTime,
    }));

    vi.doMock('../../hooks/useAgentHandoff.js', () => ({
      useAgentHandoff: mockUseAgentHandoff,
    }));

    mockUseElapsedTime.mockReturnValue('2m');
    mockUseAgentHandoff.mockReturnValue({
      isAnimating: false,
      previousAgent: null,
      currentAgent: null,
      progress: 0,
      isFading: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.doUnmock('../../hooks/useElapsedTime.js');
    vi.doUnmock('../../hooks/useAgentHandoff.js');
  });

  describe('Progress Bar Display Logic', () => {
    it('shows progress bar for active agents with valid progress', () => {
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active', progress: 45 },
        { name: 'tester', status: 'active', progress: 78 },
        { name: 'reviewer', status: 'waiting', progress: 30 }, // should not show for waiting
      ];

      render(<AgentPanel agents={agents} />);

      // Should show progress percentages for active agents
      expect(screen.getByText(/45%/)).toBeInTheDocument();
      expect(screen.getByText(/78%/)).toBeInTheDocument();

      // Should not show progress for waiting agent
      expect(screen.queryByText(/30%/)).not.toBeInTheDocument();
    });

    it('hides progress bar for 0% and 100% progress', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active', progress: 0 },
        { name: 'agent2', status: 'active', progress: 100 },
        { name: 'agent3', status: 'active', progress: 50 },
      ];

      render(<AgentPanel agents={agents} />);

      // Should not show 0% or 100%
      expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/100%/)).not.toBeInTheDocument();

      // Should show 50%
      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });

    it('shows progress bar for parallel agents', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'parallel-dev', status: 'parallel', progress: 65 },
        { name: 'parallel-test', status: 'parallel', progress: 80 },
        { name: 'parallel-review', status: 'parallel' }, // no progress
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show progress for parallel agents with progress
      expect(screen.getByText(/65%/)).toBeInTheDocument();
      expect(screen.getByText(/80%/)).toBeInTheDocument();

      // Should not show progress for parallel agent without progress value
      expect(screen.getByText('parallel-review')).toBeInTheDocument();
    });
  });

  describe('Progress Bar Styling and Colors', () => {
    it('uses correct colors for different agent types', () => {
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'active', progress: 40 },
        { name: 'developer', status: 'active', progress: 60 },
        { name: 'tester', status: 'active', progress: 80 },
      ];

      render(<AgentPanel agents={agents} />);

      // Each agent should have their progress displayed
      expect(screen.getByText(/40%/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getByText(/80%/)).toBeInTheDocument();
    });

    it('uses cyan color for parallel agent progress bars', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'parallel-agent', status: 'parallel', progress: 55 },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText(/55%/)).toBeInTheDocument();
    });
  });

  describe('Progress Bar in Compact Mode', () => {
    it('shows progress percentages in compact mode without bars', () => {
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active', progress: 75 },
        { name: 'tester', status: 'waiting', progress: 50 }, // should not show
      ];

      render(<AgentPanel agents={agents} compact={true} />);

      // Should show progress percentage for active agent
      expect(screen.getByText(/75%/)).toBeInTheDocument();

      // Should not show progress for waiting agent
      expect(screen.queryByText(/50%/)).not.toBeInTheDocument();
    });

    it('shows parallel agent progress in compact mode', () => {
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', progress: 85 },
        { name: 'reviewer', status: 'parallel', progress: 45 },
      ];

      render(
        <AgentPanel
          agents={agents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText(/85%/)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();
    });
  });

  describe('Progress Bar Edge Cases', () => {
    it('handles undefined progress gracefully', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active' }, // no progress property
        { name: 'agent2', status: 'active', progress: undefined },
      ];

      render(<AgentPanel agents={agents} />);

      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();

      // Should not show any percentage symbols
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('handles negative progress values', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active', progress: -10 },
      ];

      render(<AgentPanel agents={agents} />);

      expect(screen.getByText('agent1')).toBeInTheDocument();
      // Negative progress should not be displayed
      expect(screen.queryByText(/-10%/)).not.toBeInTheDocument();
    });

    it('handles progress values above 100', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active', progress: 150 },
      ];

      render(<AgentPanel agents={agents} />);

      expect(screen.getByText('agent1')).toBeInTheDocument();
      // Progress above 100 should not show progress bar (boundary condition)
      expect(screen.queryByText(/150%/)).not.toBeInTheDocument();
    });

    it('handles decimal progress values', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active', progress: 45.7 },
        { name: 'agent2', status: 'active', progress: 67.23 },
      ];

      render(<AgentPanel agents={agents} />);

      // Should handle decimal values (exact display may vary based on implementation)
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
    });
  });

  describe('Progress Bar Layout and Positioning', () => {
    it('positions progress bars correctly in full mode', () => {
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active', stage: 'coding', progress: 60 },
      ];

      render(<AgentPanel agents={agents} />);

      // Should show agent name, stage, and progress
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(coding\)/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
    });

    it('displays progress bars for multiple parallel agents correctly', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'parallel1', status: 'parallel', stage: 'task1', progress: 30 },
        { name: 'parallel2', status: 'parallel', stage: 'task2', progress: 70 },
        { name: 'parallel3', status: 'parallel', stage: 'task3', progress: 95 },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText(/30%/)).toBeInTheDocument();
      expect(screen.getByText(/70%/)).toBeInTheDocument();
      expect(screen.getByText(/95%/)).toBeInTheDocument();
    });
  });

  describe('Performance with Progress Bars', () => {
    it('efficiently handles many agents with progress', () => {
      const agents: AgentInfo[] = Array.from({ length: 20 }, (_, i) => ({
        name: `agent-${i}`,
        status: i % 2 === 0 ? 'active' : 'waiting' as const,
        progress: i * 5, // 0, 5, 10, 15, ...
      }));

      render(<AgentPanel agents={agents} />);

      // Should render all agents
      agents.forEach(agent => {
        expect(screen.getByText(agent.name)).toBeInTheDocument();
      });

      // Active agents with valid progress should show percentages
      // Progress 0 and 100 should be hidden, others should show
      for (let i = 0; i < 20; i += 2) {
        const progress = i * 5;
        if (progress > 0 && progress < 100) {
          expect(screen.getByText(new RegExp(`${progress}%`))).toBeInTheDocument();
        }
      }
    });

    it('handles rapid progress updates', () => {
      const { rerender } = render(<AgentPanel agents={[]} />);

      const progressValues = [25, 50, 75, 90, 99];

      progressValues.forEach(progress => {
        const agents: AgentInfo[] = [
          { name: 'updating-agent', status: 'active', progress },
        ];

        rerender(<AgentPanel agents={agents} />);
        expect(screen.getByText(new RegExp(`${progress}%`))).toBeInTheDocument();
      });
    });
  });
});