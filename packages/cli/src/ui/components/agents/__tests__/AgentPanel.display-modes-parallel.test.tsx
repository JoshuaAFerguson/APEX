import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';
import {
  parallelScenarios,
  standardWorkflowAgents,
  animationStates,
} from './test-utils/fixtures';

describe('AgentPanel - Display Modes with Parallel Agents', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Compact Mode + Parallel Execution', () => {
    it('renders single-line agent display', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={true}
        />
      );

      // Should not show "Active Agents" header in compact mode
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();

      // Should show all agents in line
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('shows parallel indicator (⟂) before parallel agents', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelScenarios.twoAgents}
        />
      );

      // Should show ⟂ indicator for parallel section
      expect(screen.getByText(/⟂/)).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('displays progress inline as percentage', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelScenarios.twoAgents}
        />
      );

      // Progress should be shown inline in compact mode
      expect(screen.getByText(/30%/)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();
    });

    it('does not render "Active Agents" header', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={true}
        />
      );

      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
    });

    it('shows handoff animation in compact format', () => {
      const mockHandoffState = animationStates.active;

      // Mock the useAgentHandoff hook
      vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
        useAgentHandoff: vi.fn(() => mockHandoffState),
      }));

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={true}
          currentAgent="developer"
        />
      );

      // Should show agents inline
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('separates agents with pipe character', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={true}
        />
      );

      // Should show pipe separators between agents
      const pipes = screen.getAllByText('│');
      expect(pipes.length).toBeGreaterThan(0);
    });

    it('shows elapsed time in brackets for active agents', () => {
      const agentsWithElapsedTime: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          progress: 50,
          startedAt: new Date(Date.now() - 5000), // 5 seconds ago
        },
      ];

      render(
        <AgentPanel
          agents={agentsWithElapsedTime}
          compact={true}
        />
      );

      // Should show elapsed time in brackets
      expect(screen.getByText(/\[\d+s\]/)).toBeInTheDocument();
    });

    it('handles single agent in compact mode', () => {
      const singleAgent: AgentInfo[] = [
        { name: 'planner', status: 'active' }
      ];

      render(
        <AgentPanel
          agents={singleAgent}
          compact={true}
        />
      );

      expect(screen.getByText('planner')).toBeInTheDocument();
      // No pipe separators for single agent
      expect(screen.queryByText('│')).not.toBeInTheDocument();
    });

    it('shows parallel agents separated by commas in compact mode', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelScenarios.threeAgents}
        />
      );

      // Three parallel agents should have 2 commas between them
      const commas = screen.getAllByText(',');
      expect(commas).toHaveLength(2);
    });
  });

  describe('Full Mode + Parallel Execution', () => {
    it('renders "Active Agents" header', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('renders AgentRow for each main agent', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // All main agents should be rendered as rows
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
    });

    it('renders ParallelSection with "⟂ Parallel Execution" header', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={parallelScenarios.twoAgents}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });

    it('shows full-width progress bars in full mode', () => {
      const agentsWithProgress: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          progress: 75,
        },
      ];

      render(
        <AgentPanel
          agents={agentsWithProgress}
        />
      );

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('shows handoff indicator with full display', () => {
      const mockHandoffState = animationStates.active;

      // Mock the useAgentHandoff hook
      vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
        useAgentHandoff: vi.fn(() => mockHandoffState),
      }));

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          currentAgent="developer"
        />
      );

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('shows elapsed time for active agents with timestamps', () => {
      const agentsWithElapsedTime: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          progress: 50,
          startedAt: new Date(Date.now() - 10000), // 10 seconds ago
        },
      ];

      render(
        <AgentPanel
          agents={agentsWithElapsedTime}
        />
      );

      // Should show elapsed time
      expect(screen.getByText(/\[\d+s\]/)).toBeInTheDocument();
    });
  });

  describe('Mode Switching During Parallel', () => {
    it('preserves parallelAgents on compact → full switch', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelScenarios.twoAgents}
        />
      );

      // Initially compact mode
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Switch to full mode
      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            compact={false}
            showParallel={true}
            parallelAgents={parallelScenarios.twoAgents}
          />
        );
      });

      // Now full mode should be active
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('preserves parallelAgents on full → compact switch', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={false}
          showParallel={true}
          parallelAgents={parallelScenarios.twoAgents}
        />
      );

      // Initially full mode
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Switch to compact mode
      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            compact={true}
            showParallel={true}
            parallelAgents={parallelScenarios.twoAgents}
          />
        );
      });

      // Now compact mode should be active
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      expect(screen.getByText(/⟂/)).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('preserves progress values on mode switch', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={false}
          showParallel={true}
          parallelAgents={parallelScenarios.twoAgents}
        />
      );

      expect(screen.getByText(/30%/)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();

      // Switch to compact mode
      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            compact={true}
            showParallel={true}
            parallelAgents={parallelScenarios.twoAgents}
          />
        );
      });

      // Progress should still be visible
      expect(screen.getByText(/30%/)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();
    });

    it('handles mode switch during handoff animation', async () => {
      const mockHandoffState = animationStates.active;

      // Mock the useAgentHandoff hook
      const mockUseAgentHandoff = vi.fn(() => mockHandoffState);
      vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
        useAgentHandoff: mockUseAgentHandoff,
      }));

      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={false}
          currentAgent="developer"
        />
      );

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');

      // Switch to compact mode during animation
      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            compact={true}
            currentAgent="developer"
          />
        );
      });

      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
    });

    it('handles rapid mode switching', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={false}
          showParallel={true}
          parallelAgents={parallelScenarios.twoAgents}
        />
      );

      // Rapidly switch modes multiple times
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          rerender(
            <AgentPanel
              agents={standardWorkflowAgents}
              compact={i % 2 === 0}
              showParallel={true}
              parallelAgents={parallelScenarios.twoAgents}
            />
          );
        });
      }

      // Should handle rapid switching gracefully
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });

  describe('useDetailedParallelView Toggle', () => {
    it('renders ParallelExecutionView cards when true', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={parallelScenarios.twoAgents}
          useDetailedParallelView={true}
        />
      );

      // Should use ParallelExecutionView component
      // Note: Exact implementation depends on ParallelExecutionView
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('renders simple ParallelSection when false', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={parallelScenarios.twoAgents}
          useDetailedParallelView={false}
        />
      );

      // Should use simple ParallelSection
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles toggle during execution', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={parallelScenarios.twoAgents}
          useDetailedParallelView={false}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Toggle to detailed view
      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            showParallel={true}
            parallelAgents={parallelScenarios.twoAgents}
            useDetailedParallelView={true}
          />
        );
      });

      // Should still show parallel agents
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('shows agent count in detailed view header', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={parallelScenarios.threeAgents}
          useDetailedParallelView={true}
        />
      );

      // ParallelExecutionView should show all three agents
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('security')).toBeInTheDocument();
    });
  });

  describe('Edge Cases with Mode Switching', () => {
    it('handles empty parallelAgents array in both modes', () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={false}
          showParallel={true}
          parallelAgents={[]}
        />
      );

      // No parallel section should show
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Switch to compact mode
      rerender(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={true}
          showParallel={true}
          parallelAgents={[]}
        />
      );

      // Still no parallel indicator
      expect(screen.queryByText(/⟂/)).not.toBeInTheDocument();
    });

    it('handles single parallel agent in both modes', () => {
      const singleParallelAgent = [parallelScenarios.twoAgents[0]];

      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={false}
          showParallel={true}
          parallelAgents={singleParallelAgent}
        />
      );

      // Single agent should not show parallel section
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Switch to compact mode
      rerender(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={true}
          showParallel={true}
          parallelAgents={singleParallelAgent}
        />
      );

      // Still no parallel indicator
      expect(screen.queryByText(/⟂/)).not.toBeInTheDocument();
    });

    it('handles mode switch with large number of parallel agents', () => {
      const manyAgents = Array.from({ length: 8 }, (_, i) => ({
        name: `agent-${i + 1}`,
        status: 'parallel' as const,
        progress: (i + 1) * 10,
      }));

      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={false}
          showParallel={true}
          parallelAgents={manyAgents}
        />
      );

      // Should show all agents in full mode
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('agent-1')).toBeInTheDocument();
      expect(screen.getByText('agent-8')).toBeInTheDocument();

      // Switch to compact mode
      rerender(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={true}
          showParallel={true}
          parallelAgents={manyAgents}
        />
      );

      // Should handle all agents in compact mode
      expect(screen.getByText('agent-1')).toBeInTheDocument();
      expect(screen.getByText('agent-8')).toBeInTheDocument();
    });

    it('preserves agent state information during mode switches', async () => {
      const complexParallelAgents: AgentInfo[] = [
        {
          name: 'reviewer',
          status: 'parallel',
          stage: 'code-review',
          progress: 65,
          startedAt: new Date(Date.now() - 3000),
        },
        {
          name: 'tester',
          status: 'parallel',
          stage: 'unit-testing',
          progress: 80,
          startedAt: new Date(Date.now() - 5000),
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={false}
          showParallel={true}
          parallelAgents={complexParallelAgents}
        />
      );

      expect(screen.getByText(/\(code-review\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(unit-testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/65%/)).toBeInTheDocument();
      expect(screen.getByText(/80%/)).toBeInTheDocument();

      // Switch to compact mode
      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            compact={true}
            showParallel={true}
            parallelAgents={complexParallelAgents}
          />
        );
      });

      // All information should still be present in compact mode
      expect(screen.getByText(/65%/)).toBeInTheDocument();
      expect(screen.getByText(/80%/)).toBeInTheDocument();
      expect(screen.getByText(/\[\d+s\]/)).toBeInTheDocument();
    });
  });
});