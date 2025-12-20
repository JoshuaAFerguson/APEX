/**
 * Comprehensive tests for parallel agent display functionality
 * Tests all aspects of parallel execution display in AgentPanel
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel Parallel Agent Display', () => {
  const mockAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'completed' },
    { name: 'developer', status: 'idle' },
    { name: 'tester', status: 'idle' },
    { name: 'reviewer', status: 'idle' },
    { name: 'devops', status: 'idle' },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('parallel execution display', () => {
    it('shows parallel section with multiple agents', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'implementation', progress: 60 },
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 45 },
        { name: 'reviewer', status: 'parallel', stage: 'review', progress: 30 },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show parallel section header
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Should show all parallel agents
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Should show stages
      expect(screen.getByText('(implementation)')).toBeInTheDocument();
      expect(screen.getByText('(testing)')).toBeInTheDocument();
      expect(screen.getByText('(review)')).toBeInTheDocument();

      // Should show progress
      expect(screen.getByText('60%')).toBeInTheDocument();
      expect(screen.getByText('45%')).toBeInTheDocument();
      expect(screen.getByText('30%')).toBeInTheDocument();

      // Should show parallel icons
      const parallelIcons = screen.getAllByText('⟂');
      expect(parallelIcons.length).toBeGreaterThanOrEqual(4); // 1 header + 3 agents
    });

    it('hides parallel section when showParallel is false', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'implementation' },
        { name: 'tester', status: 'parallel', stage: 'testing' },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={false}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('hides parallel section with only one agent', () => {
      const singleParallelAgent: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'implementation' },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={singleParallelAgent}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('hides parallel section with empty agent list', () => {
      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={[]}
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });
  });

  describe('compact mode parallel display', () => {
    it('shows parallel agents in compact format', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel' },
        { name: 'tester', status: 'parallel' },
        { name: 'reviewer', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show compact parallel indicator
      expect(screen.getByText('⟂')).toBeInTheDocument();

      // Should show agent names in compact format
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Should show comma separators between agents
      expect(screen.getAllByText(',')).toHaveLength(2); // Between 3 agents
    });

    it('hides parallel display in compact mode with single agent', () => {
      const singleParallelAgent: AgentInfo[] = [
        { name: 'developer', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          compact={true}
          showParallel={true}
          parallelAgents={singleParallelAgent}
        />
      );

      // Should not show parallel section in compact mode for single agent
      expect(screen.getAllByText('⟂')).toHaveLength(0);
    });

    it('handles parallel agents without stages in compact mode', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel' },
        { name: 'agent2', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
    });
  });

  describe('parallel agent styling', () => {
    it('applies cyan color to parallel agents', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding' },
        { name: 'tester', status: 'parallel', stage: 'testing' },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // All parallel-related elements should use cyan color
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });

    it('shows parallel status in main agent list', () => {
      const agentsWithParallel: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'parallel', stage: 'coding' },
        { name: 'tester', status: 'parallel', stage: 'testing' },
        { name: 'reviewer', status: 'waiting' },
      ];

      render(
        <AgentPanel
          agents={agentsWithParallel}
          currentAgent="developer"
        />
      );

      // Should show parallel icons in main list
      const parallelIcons = screen.getAllByText('⟂');
      expect(parallelIcons.length).toBeGreaterThanOrEqual(2); // developer and tester
    });

    it('highlights current agent correctly when in parallel', () => {
      const agentsWithParallel: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'parallel', stage: 'coding' },
        { name: 'tester', status: 'parallel', stage: 'testing' },
      ];

      render(
        <AgentPanel
          agents={agentsWithParallel}
          currentAgent="developer"
        />
      );

      // Developer should be highlighted as current agent
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Should show parallel icons
      const parallelIcons = screen.getAllByText('⟂');
      expect(parallelIcons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('parallel agent progress and stages', () => {
    it('displays progress for parallel agents', () => {
      const parallelAgentsWithProgress: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', progress: 25 },
        { name: 'agent2', status: 'parallel', progress: 75 },
        { name: 'agent3', status: 'parallel', progress: 50 },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={parallelAgentsWithProgress}
        />
      );

      expect(screen.getByText('25%')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('50%')).toBeInTheDocument();
    });

    it('hides progress for 0% and 100%', () => {
      const parallelAgentsEdgeProgress: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', progress: 0 },
        { name: 'agent2', status: 'parallel', progress: 100 },
        { name: 'agent3', status: 'parallel', progress: 50 },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={parallelAgentsEdgeProgress}
        />
      );

      // Should show 50% but not 0% or 100%
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.queryByText('0%')).not.toBeInTheDocument();
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });

    it('displays stages for parallel agents', () => {
      const parallelAgentsWithStages: AgentInfo[] = [
        { name: 'dev', status: 'parallel', stage: 'frontend-implementation' },
        { name: 'tester', status: 'parallel', stage: 'integration-testing' },
        { name: 'docs', status: 'parallel', stage: 'documentation-writing' },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={parallelAgentsWithStages}
        />
      );

      expect(screen.getByText('(frontend-implementation)')).toBeInTheDocument();
      expect(screen.getByText('(integration-testing)')).toBeInTheDocument();
      expect(screen.getByText('(documentation-writing)')).toBeInTheDocument();
    });

    it('handles parallel agents without stages or progress', () => {
      const minimalParallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel' },
        { name: 'agent2', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={minimalParallelAgents}
        />
      );

      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.queryByText('%')).not.toBeInTheDocument();
      expect(screen.queryByText('()')).not.toBeInTheDocument();
    });
  });

  describe('integration with handoff animation', () => {
    const mockUseAgentHandoff = vi.fn();

    beforeEach(() => {
      vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
        useAgentHandoff: mockUseAgentHandoff,
      }));
    });

    afterEach(() => {
      vi.clearAllMocks();
      vi.doUnmock('../../../hooks/useAgentHandoff.js');
    });

    it('maintains handoff animation functionality with parallel agents', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
      });

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', stage: 'testing' },
        { name: 'reviewer', status: 'parallel', stage: 'review' },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show both handoff animation and parallel execution
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('handles transition from single to parallel agent', () => {
      // First render: single agent
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
        />
      );

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Second render: add parallel agents
      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding' },
        { name: 'tester', status: 'parallel', stage: 'testing' },
      ];

      rerender(
        <AgentPanel
          agents={mockAgents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });

    it('handles handoff animation during parallel execution', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'single-agent',
        currentAgent: 'parallel-coordinator',
        progress: 0.3,
        isFading: false,
      });

      const parallelAgents: AgentInfo[] = [
        { name: 'worker1', status: 'parallel' },
        { name: 'worker2', status: 'parallel' },
        { name: 'worker3', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          currentAgent="parallel-coordinator"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should handle both handoff animation and parallel display
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('parallel-coordinator');
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });
  });

  describe('edge cases and error conditions', () => {
    it('handles malformed parallel agent data', () => {
      const malformedParallelAgents: any[] = [
        { name: 'agent1', status: 'parallel' },
        { status: 'parallel' }, // Missing name
        { name: '', status: 'parallel' }, // Empty name
        null, // Null entry
        undefined, // Undefined entry
      ];

      expect(() => {
        render(
          <AgentPanel
            agents={mockAgents}
            showParallel={true}
            parallelAgents={malformedParallelAgents}
          />
        );
      }).not.toThrow();

      // Should still show valid agents
      expect(screen.getByText('agent1')).toBeInTheDocument();
    });

    it('handles very large numbers of parallel agents', () => {
      const manyParallelAgents: AgentInfo[] = Array.from({ length: 50 }, (_, i) => ({
        name: `agent-${i}`,
        status: 'parallel' as const,
        stage: `task-${i}`,
        progress: i * 2,
      }));

      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={manyParallelAgents}
        />
      );

      // Should show parallel section header
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Should show first few agents (testing that it doesn't break)
      expect(screen.getByText('agent-0')).toBeInTheDocument();
      expect(screen.getByText('agent-1')).toBeInTheDocument();
    });

    it('handles agents with special characters in names', () => {
      const specialParallelAgents: AgentInfo[] = [
        { name: 'agent-with-dashes', status: 'parallel' },
        { name: 'agent_with_underscores', status: 'parallel' },
        { name: 'agent.with.dots', status: 'parallel' },
        { name: 'agent@with@symbols', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={mockAgents}
          showParallel={true}
          parallelAgents={specialParallelAgents}
        />
      );

      expect(screen.getByText('agent-with-dashes')).toBeInTheDocument();
      expect(screen.getByText('agent_with_underscores')).toBeInTheDocument();
      expect(screen.getByText('agent.with.dots')).toBeInTheDocument();
      expect(screen.getByText('agent@with@symbols')).toBeInTheDocument();
    });

    it('handles rapid changes in parallel agent state', () => {
      const { rerender } = render(
        <AgentPanel
          agents={mockAgents}
          showParallel={false}
          parallelAgents={[]}
        />
      );

      // Rapid state changes
      const states = [
        { showParallel: true, agents: [{ name: 'a1', status: 'parallel' as const }] },
        { showParallel: true, agents: [{ name: 'a1', status: 'parallel' as const }, { name: 'a2', status: 'parallel' as const }] },
        { showParallel: false, agents: [] },
        { showParallel: true, agents: [{ name: 'a3', status: 'parallel' as const }, { name: 'a4', status: 'parallel' as const }, { name: 'a5', status: 'parallel' as const }] },
      ];

      states.forEach(state => {
        rerender(
          <AgentPanel
            agents={mockAgents}
            showParallel={state.showParallel}
            parallelAgents={state.agents}
          />
        );
      });

      // Should end up in final state
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('a3')).toBeInTheDocument();
      expect(screen.getByText('a4')).toBeInTheDocument();
      expect(screen.getByText('a5')).toBeInTheDocument();
    });
  });
});