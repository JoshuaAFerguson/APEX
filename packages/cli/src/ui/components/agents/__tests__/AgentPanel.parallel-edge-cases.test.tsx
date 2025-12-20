import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel - Parallel Execution Edge Cases', () => {
  describe('parallel execution with mixed agent states', () => {
    it('correctly displays parallel agents mixed with other status types in full mode', () => {
      const mixedAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed', stage: 'planning' },
        { name: 'architect', status: 'active', stage: 'designing', progress: 50 },
        { name: 'developer', status: 'parallel', stage: 'coding', progress: 75 },
        { name: 'reviewer', status: 'waiting' },
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 30 },
        { name: 'devops', status: 'idle' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding', progress: 75 },
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 30 },
        { name: 'security', status: 'parallel', stage: 'scanning', progress: 60 },
      ];

      render(
        <AgentPanel
          agents={mixedAgents}
          currentAgent="architect"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show regular agent list
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();

      // Should show parallel execution section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Should show all parallel agents including one not in main list
      expect(screen.getByText('security')).toBeInTheDocument();
      expect(screen.getByText(/\(scanning\)/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
    });

    it('handles parallel agents in compact mode with proper separator placement', () => {
      const compactAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'architect', status: 'active' },
        { name: 'developer', status: 'waiting' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', stage: 'testing' },
        { name: 'reviewer', status: 'parallel', stage: 'reviewing' },
        { name: 'devops', status: 'parallel', stage: 'deploying' },
      ];

      render(
        <AgentPanel
          agents={compactAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show main agents with separators
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Should show parallel section separated by pipe
      const pipeElements = screen.getAllByText('│');
      expect(pipeElements.length).toBeGreaterThanOrEqual(2); // At least separators between main agents

      // Should show parallel agents with proper formatting
      expect(screen.getByText('⟂')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
    });
  });

  describe('parallel execution with progress edge cases', () => {
    it('handles parallel agents with 0% and 100% progress correctly', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', stage: 'starting', progress: 0 },
        { name: 'agent2', status: 'parallel', stage: 'completing', progress: 100 },
        { name: 'agent3', status: 'parallel', stage: 'working', progress: 50 },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Progress of 0% and 100% should be hidden according to component logic
      expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
      // Progress of 50% should be shown
      expect(screen.getByText(/50%/)).toBeInTheDocument();

      // All agents should still be displayed
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
    });

    it('handles parallel agents with undefined progress', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', stage: 'working' }, // no progress
        { name: 'agent2', status: 'parallel', stage: 'processing', progress: undefined },
        { name: 'agent3', status: 'parallel', stage: 'analyzing', progress: 42 },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Only agent3's progress should be shown
      expect(screen.getByText(/42%/)).toBeInTheDocument();
      expect(screen.queryByText(/undefined%/)).not.toBeInTheDocument();

      // All agents should be displayed
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
    });
  });

  describe('parallel execution with stage edge cases', () => {
    it('handles parallel agents without stages', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel' }, // no stage
        { name: 'agent2', status: 'parallel', stage: undefined },
        { name: 'agent3', status: 'parallel', stage: '' }, // empty stage
        { name: 'agent4', status: 'parallel', stage: 'valid-stage' },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Only agent4's stage should be shown
      expect(screen.getByText(/\(valid-stage\)/)).toBeInTheDocument();

      // No empty parentheses should be shown
      expect(screen.queryByText('()')).not.toBeInTheDocument();
      expect(screen.queryByText('(undefined)')).not.toBeInTheDocument();

      // All agents should be displayed
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
      expect(screen.getByText('agent4')).toBeInTheDocument();
    });

    it('handles parallel agents with very long stage names', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'agent1',
          status: 'parallel',
          stage: 'very-long-stage-name-that-might-cause-display-issues-in-terminal'
        },
        {
          name: 'agent2',
          status: 'parallel',
          stage: 'stage-with-special-chars-!@#$%^&*()'
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Long stage names should be displayed
      expect(screen.getByText(/\(very-long-stage-name-that-might-cause-display-issues-in-terminal\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(stage-with-special-chars-!@#\$%\^\&\*\(\)\)/)).toBeInTheDocument();

      // Agents should still be displayed
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
    });
  });

  describe('parallel execution color handling', () => {
    it('applies cyan color to parallel agents regardless of their base color', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'planner', status: 'parallel', stage: 'planning' }, // normally magenta
        { name: 'developer', status: 'parallel', stage: 'coding' }, // normally green
        { name: 'tester', status: 'parallel', stage: 'testing' }, // normally cyan (should stay cyan)
        { name: 'custom-agent', status: 'parallel', stage: 'custom' }, // unknown agent (normally white)
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // All agents should be displayed (we can't directly test color in jsdom, but we can verify rendering)
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('custom-agent')).toBeInTheDocument();

      // All should have parallel status icon
      expect(screen.getAllByText(/⟂/)).toHaveLength(5); // 1 header + 4 agents
    });

    it('handles parallel status agents in main agent list with current agent highlighting', () => {
      const mixedAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'parallel', stage: 'coding', progress: 50 },
        { name: 'tester', status: 'active' },
      ];

      render(
        <AgentPanel
          agents={mixedAgents}
          currentAgent="developer" // parallel agent is current
        />
      );

      // Should show developer as highlighted (we can verify it's rendered)
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(coding\)/)).toBeInTheDocument();
      expect(screen.getByText(/50%/)).toBeInTheDocument();

      // Should show parallel status icon
      expect(screen.getByText(/⟂/)).toBeInTheDocument();
    });
  });

  describe('parallel execution with handoff animation', () => {
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

    it('handles handoff animation when transitioning to parallel execution', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
      });

      const agents: AgentInfo[] = [
        { name: 'architect', status: 'completed' },
        { name: 'developer', status: 'active' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding' },
        { name: 'tester', status: 'parallel', stage: 'testing' },
      ];

      render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should call handoff hook with current agent
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');

      // Should show both main agent list and parallel section
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });

    it('handles handoff animation in compact mode with parallel agents', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'tester',
        progress: 0.8,
        isFading: true,
      });

      const agents: AgentInfo[] = [
        { name: 'developer', status: 'completed' },
        { name: 'tester', status: 'active' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'reviewer', status: 'parallel', stage: 'reviewing' },
        { name: 'devops', status: 'parallel', stage: 'deploying' },
      ];

      render(
        <AgentPanel
          agents={agents}
          currentAgent="tester"
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should call handoff hook
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('tester');

      // Should show compact layout (no header)
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();

      // Should show main agents and parallel agents
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
    });
  });

  describe('parallel execution accessibility and usability', () => {
    it('provides accessible text for screen readers in parallel section', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'implementation', progress: 60 },
        { name: 'tester', status: 'parallel', stage: 'test-writing', progress: 40 },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Section header should be accessible
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Agent information should be accessible
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(test-writing\)/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getByText(/40%/)).toBeInTheDocument();
    });

    it('maintains proper visual hierarchy in parallel section', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', stage: 'stage1' },
        { name: 'agent2', status: 'parallel', stage: 'stage2' },
        { name: 'agent3', status: 'parallel', stage: 'stage3' },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Header should be present
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Each agent should have their parallel icon
      expect(screen.getAllByText(/⟂/)).toHaveLength(4); // 1 header + 3 agents

      // All agent names should be present
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();

      // All stages should be present
      expect(screen.getByText(/\(stage1\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(stage2\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(stage3\)/)).toBeInTheDocument();
    });
  });

  describe('parallel execution performance scenarios', () => {
    it('handles large number of parallel agents efficiently', () => {
      // Create a large number of parallel agents to test performance
      const manyParallelAgents: AgentInfo[] = Array.from({ length: 20 }, (_, index) => ({
        name: `agent-${index}`,
        status: 'parallel' as const,
        stage: `stage-${index}`,
        progress: Math.floor(Math.random() * 100),
      }));

      const renderResult = render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={manyParallelAgents}
        />
      );

      // Should render without crashing
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Should show all agents (spot check a few)
      expect(screen.getByText('agent-0')).toBeInTheDocument();
      expect(screen.getByText('agent-10')).toBeInTheDocument();
      expect(screen.getByText('agent-19')).toBeInTheDocument();

      // Component should render quickly (this is implicit - no timeout/hanging)
      expect(renderResult.container).toBeInTheDocument();
    });

    it('handles frequent updates to parallel agents list', () => {
      const initialParallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', stage: 'initial', progress: 10 },
        { name: 'agent2', status: 'parallel', stage: 'initial', progress: 20 },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={initialParallelAgents}
        />
      );

      // Initial state
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText(/10%/)).toBeInTheDocument();
      expect(screen.getByText(/20%/)).toBeInTheDocument();

      // Update with progress changes
      const updatedParallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', stage: 'updated', progress: 50 },
        { name: 'agent2', status: 'parallel', stage: 'updated', progress: 60 },
        { name: 'agent3', status: 'parallel', stage: 'new', progress: 30 },
      ];

      rerender(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={updatedParallelAgents}
        />
      );

      // Updated state
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getByText(/30%/)).toBeInTheDocument();
      expect(screen.getByText(/\(updated\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(new\)/)).toBeInTheDocument();

      // Old progress values should be gone
      expect(screen.queryByText(/10%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/20%/)).not.toBeInTheDocument();
    });
  });

  describe('parallel execution boundary cases', () => {
    it('handles exactly 2 parallel agents (minimum for display)', () => {
      const exactlyTwoParallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding', progress: 60 },
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 40 },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={exactlyTwoParallelAgents}
        />
      );

      // Should show parallel execution section with exactly 2 agents
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText(/\(coding\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getByText(/40%/)).toBeInTheDocument();

      // Should have 3 parallel icons (1 header + 2 agents)
      expect(screen.getAllByText(/⟂/)).toHaveLength(3);
    });

    it('handles undefined parallelAgents prop with showParallel=true', () => {
      render(
        <AgentPanel
          agents={[{ name: 'planner', status: 'active' }]}
          showParallel={true}
          parallelAgents={undefined}
        />
      );

      // Should not show parallel execution section when parallelAgents is undefined
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    it('handles transition from 1 to 2 parallel agents', () => {
      const singleParallelAgent: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding' },
      ];

      const twoParallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding', progress: 75 },
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 25 },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={singleParallelAgent}
        />
      );

      // Initially should not show parallel section (only 1 agent)
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Update to 2 parallel agents
      rerender(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={twoParallelAgents}
        />
      );

      // Should now show parallel execution section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/25%/)).toBeInTheDocument();
    });

    it('handles transition from 2+ to 1 parallel agent', () => {
      const multipleParallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding' },
        { name: 'tester', status: 'parallel', stage: 'testing' },
        { name: 'reviewer', status: 'parallel', stage: 'reviewing' },
      ];

      const singleParallelAgent: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding', progress: 90 },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={multipleParallelAgents}
        />
      );

      // Initially should show parallel section (3 agents)
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Reduce to single parallel agent
      rerender(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={singleParallelAgent}
        />
      );

      // Should no longer show parallel execution section
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.queryByText('tester')).not.toBeInTheDocument();
      expect(screen.queryByText('reviewer')).not.toBeInTheDocument();
    });

    it('handles empty parallelAgents array with showParallel=true', () => {
      render(
        <AgentPanel
          agents={[{ name: 'planner', status: 'active' }]}
          showParallel={true}
          parallelAgents={[]}
        />
      );

      // Should not show parallel execution section when parallelAgents is empty
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    it('handles exactly 2 parallel agents in compact mode', () => {
      const exactlyTwoParallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding' },
        { name: 'tester', status: 'parallel', stage: 'testing' },
      ];

      render(
        <AgentPanel
          agents={[{ name: 'planner', status: 'completed' }]}
          compact={true}
          showParallel={true}
          parallelAgents={exactlyTwoParallelAgents}
        />
      );

      // Should show compact layout without header
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();

      // Should show main agent
      expect(screen.getByText('planner')).toBeInTheDocument();

      // Should show separator and parallel agents
      expect(screen.getAllByText('│')).toHaveLength(1); // Separator between main agents and parallel section
      expect(screen.getByText('⟂')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles boundary transition with showParallel toggle', () => {
      const exactlyTwoParallelAgents: AgentInfo[] = [
        { name: 'developer', status: 'parallel', stage: 'coding' },
        { name: 'tester', status: 'parallel', stage: 'testing' },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={[]}
          showParallel={false}
          parallelAgents={exactlyTwoParallelAgents}
        />
      );

      // Should not show parallel section when showParallel is false
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Enable showParallel with exactly 2 agents (boundary condition)
      rerender(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={exactlyTwoParallelAgents}
        />
      );

      // Should now show parallel section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Disable showParallel again
      rerender(
        <AgentPanel
          agents={[]}
          showParallel={false}
          parallelAgents={exactlyTwoParallelAgents}
        />
      );

      // Should hide parallel section again
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('handles null parallelAgents prop with showParallel=true', () => {
      render(
        <AgentPanel
          agents={[{ name: 'planner', status: 'active' }]}
          showParallel={true}
          parallelAgents={null as any}
        />
      );

      // Should not show parallel execution section when parallelAgents is null
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
    });
  });
});