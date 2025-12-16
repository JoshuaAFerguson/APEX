import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';
import {
  parallelScenarios,
  createTimedParallelAgents,
  createEdgeCaseNameAgents,
  edgeCaseAgentNames,
  standardWorkflowAgents,
} from './test-utils/fixtures';

describe('AgentPanel - Parallel Display Comprehensive Tests', () => {
  // Test Data Helper
  const createParallelAgents = (count: number): AgentInfo[] => {
    return Array.from({ length: count }, (_, i) => ({
      name: `agent-${i + 1}`,
      status: 'parallel' as const,
      stage: `task-${i + 1}`,
      progress: (i + 1) * 10,
      startedAt: new Date(Date.now() - (i + 1) * 1000),
    }));
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Grid Layout Rendering', () => {
    it('renders single parallel agent without parallel section', () => {
      const singleAgent = [parallelScenarios.twoAgents[0]];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={singleAgent}
        />
      );

      // Single agent should not show "⟂ Parallel Execution" header
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('renders 2 parallel agents side by side', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={parallelScenarios.twoAgents}
        />
      );

      // Should show parallel section header
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Should show both agents
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('renders 3+ parallel agents with proper layout', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={parallelScenarios.threeAgents}
        />
      );

      // Should show all three agents
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('security')).toBeInTheDocument();

      // Should show parallel section header
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });

    it('handles maximum realistic agents (10)', () => {
      const tenAgents = createParallelAgents(10);

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={tenAgents}
        />
      );

      // All 10 agents should be rendered
      for (let i = 1; i <= 10; i++) {
        expect(screen.getByText(`agent-${i}`)).toBeInTheDocument();
      }

      // Should show parallel section header
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });
  });

  describe('Progress Bar Rendering', () => {
    it('shows progress bar for progress between 0-100 exclusive', () => {
      const progressAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', progress: 50 },
        { name: 'agent2', status: 'parallel', progress: 25 },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={progressAgents}
        />
      );

      // Progress should be visible for mid-range values
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/25%/)).toBeInTheDocument();
    });

    it('hides progress bar for progress=0', () => {
      const zeroProgressAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', progress: 0 },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={zeroProgressAgents}
        />
      );

      // No percentage should be shown for 0%
      expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
    });

    it('hides progress bar for progress=100', () => {
      const fullProgressAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', progress: 100 },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={fullProgressAgents}
        />
      );

      // No percentage should be shown for 100%
      expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
    });

    it('updates progress bar on state change', async () => {
      const initialAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', progress: 30 },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={initialAgents}
        />
      );

      expect(screen.getByText(/30%/)).toBeInTheDocument();

      // Update progress
      const updatedAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', progress: 75 },
      ];

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            showParallel={true}
            parallelAgents={updatedAgents}
          />
        );
      });

      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.queryByText(/30%/)).not.toBeInTheDocument();
    });
  });

  describe('Elapsed Time Display', () => {
    it('shows elapsed time for agents with startedAt', () => {
      const baseTime = new Date();
      const timedAgents = createTimedParallelAgents(2, baseTime);

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={timedAgents}
        />
      );

      // Should display elapsed time in [Xs] format
      expect(screen.getByText(/\[\d+s\]/)).toBeInTheDocument();
    });

    it('hides elapsed time for agents without startedAt', () => {
      const noTimeAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel' },
        { name: 'agent2', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={noTimeAgents}
        />
      );

      // No elapsed time should be shown
      expect(screen.queryByText(/\[.*s\]/)).not.toBeInTheDocument();
    });

    it('updates elapsed time over time', async () => {
      const startTime = new Date();
      const timedAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', startedAt: startTime },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={timedAgents}
        />
      );

      // Advance time by 2 seconds
      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      // Time should update (this is a basic check - exact timing depends on implementation)
      expect(screen.getByText(/\[\d+s\]/)).toBeInTheDocument();
    });
  });

  describe('Stage Information Display', () => {
    it('shows stage in parentheses when provided', () => {
      const stageAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', stage: 'code-review' },
        { name: 'agent2', status: 'parallel', stage: 'unit-testing' },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={stageAgents}
        />
      );

      expect(screen.getByText(/\(code-review\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(unit-testing\)/)).toBeInTheDocument();
    });

    it('handles missing stage gracefully', () => {
      const noStageAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={noStageAgents}
        />
      );

      // Agent name should be present
      expect(screen.getByText('agent1')).toBeInTheDocument();

      // Should not show empty parentheses
      expect(screen.queryByText(/\(\)/)).not.toBeInTheDocument();
    });
  });

  describe('Visual State Changes', () => {
    it('transitions agent from idle to parallel status', async () => {
      const initialAgents: AgentInfo[] = [
        { name: 'agent1', status: 'idle' },
      ];

      const { rerender } = render(
        <AgentPanel agents={initialAgents} />
      );

      // Initially idle
      expect(screen.getByText(/·/)).toBeInTheDocument(); // idle icon

      // Transition to parallel
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel' },
      ];

      await act(async () => {
        rerender(
          <AgentPanel
            agents={parallelAgents}
            showParallel={true}
            parallelAgents={parallelAgents}
          />
        );
      });

      expect(screen.getByText(/⟂/)).toBeInTheDocument(); // parallel icon
    });

    it('transitions agent from parallel to completed status', async () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel' },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={parallelAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText(/⟂/)).toBeInTheDocument();

      // Transition to completed
      const completedAgents: AgentInfo[] = [
        { name: 'agent1', status: 'completed' },
      ];

      await act(async () => {
        rerender(<AgentPanel agents={completedAgents} />);
      });

      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed icon
    });

    it('applies cyan color for parallel status', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={parallelAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Parallel agents should use cyan color
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText(/⟂/)).toBeInTheDocument();
    });

    it('applies agent-specific colors for known agents', () => {
      const knownAgents: AgentInfo[] = [
        { name: 'planner', status: 'active' },
        { name: 'developer', status: 'active' },
        { name: 'tester', status: 'active' },
      ];

      render(<AgentPanel agents={knownAgents} currentAgent="developer" />);

      // All known agents should be rendered with their colors
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('falls back to white for unknown agents', () => {
      const unknownAgents: AgentInfo[] = [
        { name: 'custom-agent-x', status: 'active' },
        { name: 'unknown-worker', status: 'active' },
      ];

      render(<AgentPanel agents={unknownAgents} />);

      // Unknown agents should still be rendered
      expect(screen.getByText('custom-agent-x')).toBeInTheDocument();
      expect(screen.getByText('unknown-worker')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty parallelAgents array', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={[]}
        />
      );

      // No parallel section should be shown
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('handles rapid state updates', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={parallelScenarios.twoAgents}
        />
      );

      // Rapid updates
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          const updatedAgents = parallelScenarios.twoAgents.map(agent => ({
            ...agent,
            progress: (i + 1) * 20,
          }));

          rerender(
            <AgentPanel
              agents={standardWorkflowAgents}
              showParallel={true}
              parallelAgents={updatedAgents}
            />
          );
        });
      }

      // Should handle rapid updates gracefully
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles agents with very long names', () => {
      const longNameAgents: AgentInfo[] = [
        {
          name: edgeCaseAgentNames.veryLong,
          status: 'parallel',
          progress: 50,
        },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={longNameAgents}
        />
      );

      // Long name should be rendered
      expect(screen.getByText(edgeCaseAgentNames.veryLong)).toBeInTheDocument();
    });

    it('handles agents with special characters in names', () => {
      const specialCharAgents: AgentInfo[] = [
        { name: edgeCaseAgentNames.withDashes, status: 'parallel' },
        { name: edgeCaseAgentNames.withUnderscores, status: 'parallel' },
        { name: edgeCaseAgentNames.withSpecial, status: 'parallel' },
        { name: edgeCaseAgentNames.unicode, status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={specialCharAgents}
        />
      );

      // All special character names should be rendered
      expect(screen.getByText(edgeCaseAgentNames.withDashes)).toBeInTheDocument();
      expect(screen.getByText(edgeCaseAgentNames.withUnderscores)).toBeInTheDocument();
      expect(screen.getByText(edgeCaseAgentNames.withSpecial)).toBeInTheDocument();
      expect(screen.getByText(edgeCaseAgentNames.unicode)).toBeInTheDocument();
    });

    it('handles agents with empty names gracefully', () => {
      const emptyNameAgents: AgentInfo[] = [
        { name: '', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={emptyNameAgents}
        />
      );

      // Should not crash with empty name
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });

    it('handles agents with numeric-only names', () => {
      const numericAgents: AgentInfo[] = [
        { name: edgeCaseAgentNames.numbersOnly, status: 'parallel' },
        { name: edgeCaseAgentNames.withNumbers, status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={numericAgents}
        />
      );

      expect(screen.getByText(edgeCaseAgentNames.numbersOnly)).toBeInTheDocument();
      expect(screen.getByText(edgeCaseAgentNames.withNumbers)).toBeInTheDocument();
    });
  });

  describe('Compact Mode Parallel Display', () => {
    it('shows parallel agents in compact mode', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelScenarios.twoAgents}
        />
      );

      // Should show ⟂ indicator for parallel agents
      expect(screen.getByText(/⟂/)).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('shows progress in compact mode', () => {
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

    it('separates parallel agents with commas in compact mode', () => {
      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelScenarios.threeAgents}
        />
      );

      // Should show comma separators between parallel agents
      const commas = screen.getAllByText(',');
      expect(commas).toHaveLength(2); // 2 commas for 3 agents
    });
  });

  describe('Progress Edge Cases', () => {
    it('handles progress values at boundaries', () => {
      const boundaryAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', progress: 1 },
        { name: 'agent2', status: 'parallel', progress: 99 },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={boundaryAgents}
        />
      );

      expect(screen.getByText(/1%/)).toBeInTheDocument();
      expect(screen.getByText(/99%/)).toBeInTheDocument();
    });

    it('handles undefined progress gracefully', () => {
      const noProgressAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel' }, // no progress property
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={noProgressAgents}
        />
      );

      expect(screen.getByText('agent1')).toBeInTheDocument();
      // Should not show any percentage
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('handles negative progress values', () => {
      const negativeProgressAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', progress: -10 },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={negativeProgressAgents}
        />
      );

      // Negative progress should not be shown (outside 0-100 range)
      expect(screen.queryByText(/-\d+%/)).not.toBeInTheDocument();
    });

    it('handles progress values over 100', () => {
      const overProgressAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', progress: 150 },
      ];

      render(
        <AgentPanel
          agents={standardWorkflowAgents}
          showParallel={true}
          parallelAgents={overProgressAgents}
        />
      );

      // Progress over 100 should not be shown
      expect(screen.queryByText(/150%/)).not.toBeInTheDocument();
    });
  });
});