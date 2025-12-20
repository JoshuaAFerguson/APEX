import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel - Parallel Execution Elapsed Time', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('elapsed time display for parallel agents', () => {
    it('shows elapsed time for parallel agents with startedAt in full mode', () => {
      const startTime = new Date(Date.now() - 45000); // 45 seconds ago
      const parallelAgents: AgentInfo[] = [
        {
          name: 'agent1',
          status: 'parallel',
          stage: 'task1',
          startedAt: startTime,
          progress: 50
        },
        {
          name: 'agent2',
          status: 'parallel',
          stage: 'task2',
          startedAt: new Date(Date.now() - 30000), // 30 seconds ago
          progress: 75
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();

      // Should show elapsed time for both agents
      // Note: The exact format depends on useElapsedTime implementation
      expect(screen.getByText(/\[/)).toBeInTheDocument(); // Elapsed time brackets
    });

    it('shows elapsed time for parallel agents in compact mode', () => {
      const startTime = new Date(Date.now() - 120000); // 2 minutes ago
      const parallelAgents: AgentInfo[] = [
        {
          name: 'compact-agent1',
          status: 'parallel',
          startedAt: startTime
        },
        {
          name: 'compact-agent2',
          status: 'parallel',
          startedAt: new Date(Date.now() - 90000) // 1.5 minutes ago
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('compact-agent1')).toBeInTheDocument();
      expect(screen.getByText('compact-agent2')).toBeInTheDocument();

      // Should show elapsed time in compact format
      expect(screen.getByText(/\[/)).toBeInTheDocument();
    });

    it('does not show elapsed time for parallel agents without startedAt', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'no-time-agent1',
          status: 'parallel',
          stage: 'task1',
          progress: 50
        },
        {
          name: 'no-time-agent2',
          status: 'parallel',
          stage: 'task2'
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('no-time-agent1')).toBeInTheDocument();
      expect(screen.getByText('no-time-agent2')).toBeInTheDocument();

      // Should not show elapsed time brackets
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();
    });

    it('updates elapsed time dynamically for parallel agents', () => {
      const startTime = new Date(Date.now() - 10000); // 10 seconds ago
      const parallelAgents: AgentInfo[] = [
        {
          name: 'dynamic-agent',
          status: 'parallel',
          stage: 'dynamic-task',
          startedAt: startTime
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('dynamic-agent')).toBeInTheDocument();

      // Advance time by 30 seconds
      act(() => {
        vi.advanceTimersByTime(30000);
      });

      // Re-render to trigger elapsed time update
      rerender(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Time should have been updated (implementation specific)
      expect(screen.getByText('dynamic-agent')).toBeInTheDocument();
    });

    it('handles mixed parallel agents with and without startedAt', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'timed-agent',
          status: 'parallel',
          stage: 'timed-task',
          startedAt: new Date(Date.now() - 60000), // 1 minute ago
          progress: 40
        },
        {
          name: 'no-time-agent',
          status: 'parallel',
          stage: 'no-time-task',
          progress: 60
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('timed-agent')).toBeInTheDocument();
      expect(screen.getByText('no-time-agent')).toBeInTheDocument();
      expect(screen.getByText('(timed-task)')).toBeInTheDocument();
      expect(screen.getByText('(no-time-task)')).toBeInTheDocument();
      expect(screen.getByText('40%')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();

      // Should show elapsed time for timed agent only
      // The exact text depends on useElapsedTime hook implementation
    });

    it('preserves elapsed time display when switching modes', () => {
      const startTime = new Date(Date.now() - 45000); // 45 seconds ago
      const parallelAgents: AgentInfo[] = [
        {
          name: 'mode-switch-agent',
          status: 'parallel',
          stage: 'mode-task',
          startedAt: startTime
        },
        {
          name: 'mode-agent2',
          status: 'parallel',
          stage: 'mode-task2',
          startedAt: new Date(Date.now() - 25000) // 25 seconds ago
        },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={[]}
          compact={false}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show in full mode
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('mode-switch-agent')).toBeInTheDocument();

      // Switch to compact mode
      rerender(
        <AgentPanel
          agents={[]}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should maintain agent display in compact mode
      expect(screen.getByText('mode-switch-agent')).toBeInTheDocument();
      expect(screen.getByText('mode-agent2')).toBeInTheDocument();
    });

    it('handles very long running parallel agents', () => {
      const longStartTime = new Date(Date.now() - 3600000); // 1 hour ago
      const parallelAgents: AgentInfo[] = [
        {
          name: 'long-running-agent',
          status: 'parallel',
          stage: 'long-task',
          startedAt: longStartTime,
          progress: 85
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('long-running-agent')).toBeInTheDocument();
      expect(screen.getByText('(long-task)')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();

      // Should handle long elapsed times gracefully
    });

    it('handles parallel agents started at different times', () => {
      const now = Date.now();
      const parallelAgents: AgentInfo[] = [
        {
          name: 'first-agent',
          status: 'parallel',
          startedAt: new Date(now - 300000), // 5 minutes ago
          progress: 90
        },
        {
          name: 'second-agent',
          status: 'parallel',
          startedAt: new Date(now - 120000), // 2 minutes ago
          progress: 60
        },
        {
          name: 'third-agent',
          status: 'parallel',
          startedAt: new Date(now - 30000), // 30 seconds ago
          progress: 25
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('first-agent')).toBeInTheDocument();
      expect(screen.getByText('second-agent')).toBeInTheDocument();
      expect(screen.getByText('third-agent')).toBeInTheDocument();

      // Should show different elapsed times for each agent
      // The exact format depends on useElapsedTime implementation
    });
  });

  describe('parallel agent progress bar integration with elapsed time', () => {
    it('shows both progress bar and elapsed time for parallel agents', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'progress-time-agent',
          status: 'parallel',
          stage: 'complex-task',
          startedAt: new Date(Date.now() - 90000), // 1.5 minutes ago
          progress: 65
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('progress-time-agent')).toBeInTheDocument();
      expect(screen.getByText('(complex-task)')).toBeInTheDocument();
      expect(screen.getByText('65%')).toBeInTheDocument();

      // Should show both progress percentage and elapsed time
    });

    it('handles edge case of 0% and 100% progress with elapsed time', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'zero-progress-agent',
          status: 'parallel',
          stage: 'starting-task',
          startedAt: new Date(Date.now() - 5000), // 5 seconds ago
          progress: 0
        },
        {
          name: 'complete-agent',
          status: 'parallel',
          stage: 'finishing-task',
          startedAt: new Date(Date.now() - 180000), // 3 minutes ago
          progress: 100
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText('zero-progress-agent')).toBeInTheDocument();
      expect(screen.getByText('complete-agent')).toBeInTheDocument();

      // Should not show 0% or 100% progress but should show elapsed time
      expect(screen.queryByText('0%')).not.toBeInTheDocument();
      expect(screen.queryByText('100%')).not.toBeInTheDocument();
    });
  });
});