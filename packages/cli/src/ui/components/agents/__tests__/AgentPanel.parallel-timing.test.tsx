/**
 * Parallel Agent Timing Tests for AgentPanel
 *
 * Tests elapsed time functionality specifically for parallel agents
 * to ensure timing displays correctly in both compact and full modes.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock useElapsedTime hook
const mockUseElapsedTime = vi.fn();

vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

describe('AgentPanel - Parallel Agent Timing', () => {
  const baseAgents: AgentInfo[] = [
    { name: 'planner', status: 'completed' },
    { name: 'architect', status: 'completed' },
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    mockUseElapsedTime.mockClear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('elapsed time display for parallel agents', () => {
    it('shows elapsed time for parallel agents with startedAt in full mode', () => {
      const startTime = new Date(Date.now() - 120000); // 2 minutes ago
      mockUseElapsedTime.mockReturnValue('2m 0s');

      const parallelAgents: AgentInfo[] = [
        {
          name: 'timed-agent1',
          status: 'parallel',
          stage: 'long-task',
          startedAt: startTime,
        },
        {
          name: 'timed-agent2',
          status: 'parallel',
          stage: 'another-task',
          startedAt: new Date(Date.now() - 45000), // 45 seconds ago
        },
      ];

      mockUseElapsedTime
        .mockReturnValueOnce('2m 0s') // First agent
        .mockReturnValueOnce('45s'); // Second agent

      render(
        <AgentPanel
          agents={baseAgents}
          parallelAgents={parallelAgents}
          showParallel={true}
        />
      );

      // Should call useElapsedTime for each parallel agent with startedAt
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(2);

      // Should display the elapsed times
      expect(screen.getByText('timed-agent1')).toBeInTheDocument();
      expect(screen.getByText('timed-agent2')).toBeInTheDocument();
    });

    it('shows elapsed time for parallel agents in compact mode', () => {
      const startTime = new Date(Date.now() - 75000); // 75 seconds ago
      mockUseElapsedTime.mockReturnValue('1m 15s');

      const parallelAgents: AgentInfo[] = [
        {
          name: 'compact-agent1',
          status: 'parallel',
          startedAt: startTime,
        },
        {
          name: 'compact-agent2',
          status: 'parallel',
          startedAt: new Date(Date.now() - 30000), // 30 seconds ago
        },
      ];

      mockUseElapsedTime
        .mockReturnValueOnce('1m 15s')
        .mockReturnValueOnce('30s');

      render(
        <AgentPanel
          agents={baseAgents}
          parallelAgents={parallelAgents}
          showParallel={true}
          compact={true}
        />
      );

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(2);

      expect(screen.getByText('compact-agent1')).toBeInTheDocument();
      expect(screen.getByText('compact-agent2')).toBeInTheDocument();
    });

    it('does not show elapsed time for parallel agents without startedAt', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'no-time-agent1',
          status: 'parallel',
          stage: 'task1',
          // No startedAt property
        },
        {
          name: 'no-time-agent2',
          status: 'parallel',
          stage: 'task2',
          startedAt: undefined, // Explicit undefined
        },
      ];

      render(
        <AgentPanel
          agents={baseAgents}
          parallelAgents={parallelAgents}
          showParallel={true}
        />
      );

      // Should call useElapsedTime with null for agents without startedAt
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(undefined);

      expect(screen.getByText('no-time-agent1')).toBeInTheDocument();
      expect(screen.getByText('no-time-agent2')).toBeInTheDocument();
    });

    it('updates elapsed time dynamically for parallel agents', () => {
      const startTime = new Date(Date.now() - 60000); // 1 minute ago

      const parallelAgents: AgentInfo[] = [
        {
          name: 'dynamic-agent',
          status: 'parallel',
          stage: 'ongoing-task',
          startedAt: startTime,
        },
      ];

      // Initial render
      mockUseElapsedTime.mockReturnValue('1m 0s');

      const { rerender } = render(
        <AgentPanel
          agents={baseAgents}
          parallelAgents={parallelAgents}
          showParallel={true}
        />
      );

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);

      // Simulate time passing
      mockUseElapsedTime.mockReturnValue('1m 30s');

      rerender(
        <AgentPanel
          agents={baseAgents}
          parallelAgents={parallelAgents}
          showParallel={true}
        />
      );

      expect(screen.getByText('dynamic-agent')).toBeInTheDocument();
    });
  });

  describe('timing with parallel status in main agent list', () => {
    it('shows elapsed time for parallel status agents in main list', () => {
      const startTime = new Date(Date.now() - 90000); // 1.5 minutes ago
      mockUseElapsedTime.mockReturnValue('1m 30s');

      const agentsWithParallel: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        {
          name: 'parallel-main-agent',
          status: 'parallel',
          stage: 'main-parallel-task',
          startedAt: startTime,
        },
        { name: 'tester', status: 'waiting' },
      ];

      render(
        <AgentPanel
          agents={agentsWithParallel}
          currentAgent="parallel-main-agent"
        />
      );

      // Should show elapsed time for parallel agent in main list
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(screen.getByText('parallel-main-agent')).toBeInTheDocument();
      expect(screen.getByText('(main-parallel-task)')).toBeInTheDocument();
    });

    it('handles mix of parallel agents with and without timing', () => {
      const timedStartTime = new Date(Date.now() - 45000);
      mockUseElapsedTime
        .mockReturnValueOnce('45s') // For timed agent
        .mockReturnValueOnce('0s'); // For untimed agent

      const mixedAgents: AgentInfo[] = [
        {
          name: 'timed-parallel',
          status: 'parallel',
          startedAt: timedStartTime,
        },
        {
          name: 'untimed-parallel',
          status: 'parallel',
          // No startedAt
        },
      ];

      render(<AgentPanel agents={mixedAgents} />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(timedStartTime);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);

      expect(screen.getByText('timed-parallel')).toBeInTheDocument();
      expect(screen.getByText('untimed-parallel')).toBeInTheDocument();
    });
  });

  describe('timing edge cases and performance', () => {
    it('handles rapid timing updates efficiently', () => {
      const startTime = new Date(Date.now() - 30000);

      const parallelAgents: AgentInfo[] = [
        {
          name: 'rapid-update-agent',
          status: 'parallel',
          startedAt: startTime,
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={baseAgents}
          parallelAgents={parallelAgents}
          showParallel={true}
        />
      );

      // Simulate rapid timing updates
      const timings = ['30s', '31s', '32s', '33s', '34s'];
      timings.forEach((timing, index) => {
        mockUseElapsedTime.mockReturnValue(timing);

        rerender(
          <AgentPanel
            agents={baseAgents}
            parallelAgents={parallelAgents}
            showParallel={true}
          />
        );

        expect(screen.getByText('rapid-update-agent')).toBeInTheDocument();
      });

      // Should have been called multiple times
      expect(mockUseElapsedTime.mock.calls.length).toBeGreaterThan(timings.length);
    });

    it('handles timing for many parallel agents without performance issues', () => {
      const baseTime = Date.now() - 120000; // 2 minutes ago

      const manyParallelAgents: AgentInfo[] = Array.from({ length: 15 }, (_, i) => ({
        name: `perf-agent-${i}`,
        status: 'parallel' as const,
        startedAt: new Date(baseTime + (i * 1000)), // Stagger start times
      }));

      mockUseElapsedTime.mockReturnValue('2m 0s');

      const startRender = Date.now();

      render(
        <AgentPanel
          agents={baseAgents}
          parallelAgents={manyParallelAgents}
          showParallel={true}
        />
      );

      const renderDuration = Date.now() - startRender;

      // Should complete rendering quickly
      expect(renderDuration).toBeLessThan(50);

      // Should call useElapsedTime for each agent
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(15);

      // Should display all agents
      expect(screen.getByText('perf-agent-0')).toBeInTheDocument();
      expect(screen.getByText('perf-agent-14')).toBeInTheDocument();
    });

    it('handles timing when parallel agents change dynamically', () => {
      const time1 = new Date(Date.now() - 60000);
      const time2 = new Date(Date.now() - 30000);

      mockUseElapsedTime.mockReturnValue('1m 0s');

      // Initial state with one agent
      const initialAgents: AgentInfo[] = [
        {
          name: 'initial-agent',
          status: 'parallel',
          startedAt: time1,
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={baseAgents}
          parallelAgents={initialAgents}
          showParallel={true}
        />
      );

      expect(mockUseElapsedTime).toHaveBeenCalledWith(time1);

      // Add another agent
      const expandedAgents: AgentInfo[] = [
        ...initialAgents,
        {
          name: 'added-agent',
          status: 'parallel',
          startedAt: time2,
        },
      ];

      mockUseElapsedTime.mockClear();
      mockUseElapsedTime.mockReturnValue('30s');

      rerender(
        <AgentPanel
          agents={baseAgents}
          parallelAgents={expandedAgents}
          showParallel={true}
        />
      );

      // Should call useElapsedTime for both agents
      expect(mockUseElapsedTime).toHaveBeenCalledWith(time1);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(time2);
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(2);

      expect(screen.getByText('initial-agent')).toBeInTheDocument();
      expect(screen.getByText('added-agent')).toBeInTheDocument();
    });

    it('maintains timing consistency between compact and full modes', () => {
      const startTime = new Date(Date.now() - 105000); // 1m 45s ago
      mockUseElapsedTime.mockReturnValue('1m 45s');

      const parallelAgents: AgentInfo[] = [
        {
          name: 'consistent-agent',
          status: 'parallel',
          stage: 'consistency-test',
          startedAt: startTime,
        },
      ];

      // Test full mode
      const { rerender } = render(
        <AgentPanel
          agents={baseAgents}
          parallelAgents={parallelAgents}
          showParallel={true}
          compact={false}
        />
      );

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(screen.getByText('consistent-agent')).toBeInTheDocument();

      // Switch to compact mode
      mockUseElapsedTime.mockClear();
      mockUseElapsedTime.mockReturnValue('1m 45s');

      rerender(
        <AgentPanel
          agents={baseAgents}
          parallelAgents={parallelAgents}
          showParallel={true}
          compact={true}
        />
      );

      // Should maintain same timing behavior
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(screen.getByText('consistent-agent')).toBeInTheDocument();
    });
  });

  describe('timing integration with other features', () => {
    it('maintains timing display with progress and stage information', () => {
      const startTime = new Date(Date.now() - 180000); // 3 minutes ago
      mockUseElapsedTime.mockReturnValue('3m 0s');

      const complexParallelAgents: AgentInfo[] = [
        {
          name: 'complex-agent',
          status: 'parallel',
          stage: 'complex-implementation',
          progress: 67,
          startedAt: startTime,
        },
      ];

      render(
        <AgentPanel
          agents={baseAgents}
          parallelAgents={complexParallelAgents}
          showParallel={true}
        />
      );

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);

      // Should show all information together
      expect(screen.getByText('complex-agent')).toBeInTheDocument();
      expect(screen.getByText('(complex-implementation)')).toBeInTheDocument();
      expect(screen.getByText('67%')).toBeInTheDocument();
    });

    it('handles timing with handoff animations', () => {
      const mockUseAgentHandoff = vi.fn();

      vi.doMock('../../hooks/useAgentHandoff.js', () => ({
        useAgentHandoff: mockUseAgentHandoff,
      }));

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'architect',
        progress: 0.5,
        isFading: false,
      });

      const startTime = new Date(Date.now() - 90000);
      mockUseElapsedTime.mockReturnValue('1m 30s');

      const parallelAgents: AgentInfo[] = [
        {
          name: 'handoff-timing-agent',
          status: 'parallel',
          startedAt: startTime,
        },
      ];

      render(
        <AgentPanel
          agents={baseAgents}
          currentAgent="architect"
          parallelAgents={parallelAgents}
          showParallel={true}
        />
      );

      // Should handle both handoff animation and parallel timing
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('architect');
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(screen.getByText('handoff-timing-agent')).toBeInTheDocument();

      vi.doUnmock('../../hooks/useAgentHandoff.js');
    });
  });
});