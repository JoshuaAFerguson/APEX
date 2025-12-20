import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

/**
 * Test the integration between AgentPanel and useElapsedTime hook
 * Validates timing display for both main and parallel agents
 */
describe('AgentPanel - Elapsed Time Integration', () => {
  const mockUseElapsedTime = vi.fn();
  const mockUseAgentHandoff = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();

    vi.doMock('../../hooks/useElapsedTime.js', () => ({
      useElapsedTime: mockUseElapsedTime,
    }));

    vi.doMock('../../hooks/useAgentHandoff.js', () => ({
      useAgentHandoff: mockUseAgentHandoff,
    }));

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
    vi.useRealTimers();
    vi.doUnmock('../../hooks/useElapsedTime.js');
    vi.doUnmock('../../hooks/useAgentHandoff.js');
  });

  describe('Elapsed Time Display Logic', () => {
    it('shows elapsed time for active agents with startedAt', () => {
      const startTime = new Date('2024-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active', startedAt: startTime },
        { name: 'tester', status: 'active' }, // no startedAt
        { name: 'reviewer', status: 'waiting', startedAt: startTime }, // not active
      ];

      mockUseElapsedTime
        .mockReturnValueOnce('3m 45s') // developer
        .mockReturnValueOnce('0s') // tester (no startedAt)
        .mockReturnValueOnce('0s'); // reviewer (not called, but covered)

      render(<AgentPanel agents={agents} />);

      // Should show elapsed time for active agent with startedAt
      expect(screen.getByText(/3m 45s/)).toBeInTheDocument();

      // Should call useElapsedTime correctly
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null); // for tester without startedAt
    });

    it('shows elapsed time for parallel agents with startedAt', () => {
      const startTime1 = new Date('2024-01-01T10:00:00Z');
      const startTime2 = new Date('2024-01-01T10:05:00Z');

      const parallelAgents: AgentInfo[] = [
        { name: 'parallel1', status: 'parallel', startedAt: startTime1 },
        { name: 'parallel2', status: 'parallel', startedAt: startTime2 },
        { name: 'parallel3', status: 'parallel' }, // no startedAt
      ];

      mockUseElapsedTime
        .mockReturnValueOnce('8m 30s') // parallel1
        .mockReturnValueOnce('3m 30s') // parallel2
        .mockReturnValueOnce('0s'); // parallel3 (no startedAt)

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText(/8m 30s/)).toBeInTheDocument();
      expect(screen.getByText(/3m 30s/)).toBeInTheDocument();

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime1);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime2);
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
    });
  });

  describe('Elapsed Time in Different Modes', () => {
    it('displays elapsed time correctly in full mode', () => {
      const startTime = new Date();
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('2m 15s');

      render(<AgentPanel agents={agents} />);

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
      expect(screen.getByText(/2m 15s/)).toBeInTheDocument();
    });

    it('displays elapsed time correctly in compact mode', () => {
      const startTime = new Date();
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active', startedAt: startTime },
        { name: 'tester', status: 'waiting' },
      ];

      mockUseElapsedTime
        .mockReturnValueOnce('1m 30s')
        .mockReturnValueOnce('0s');

      render(<AgentPanel agents={agents} compact={true} />);

      // Should show inline timing in compact mode
      expect(screen.getByText(/1m 30s/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('shows parallel agent timing in compact mode', () => {
      const startTime1 = new Date();
      const startTime2 = new Date();

      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', startedAt: startTime1 },
        { name: 'reviewer', status: 'parallel', startedAt: startTime2 },
      ];

      mockUseElapsedTime
        .mockReturnValueOnce('0s') // developer (no startedAt)
        .mockReturnValueOnce('45s') // tester
        .mockReturnValueOnce('1m 20s'); // reviewer

      render(
        <AgentPanel
          agents={agents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText(/45s/)).toBeInTheDocument();
      expect(screen.getByText(/1m 20s/)).toBeInTheDocument();
    });
  });

  describe('Elapsed Time Formatting', () => {
    it('handles various time formats correctly', () => {
      const timeFormats = [
        '0s',
        '30s',
        '1m 15s',
        '5m',
        '1h 30m',
        '2h 5m',
        '24h 0m',
      ];

      timeFormats.forEach((timeFormat, index) => {
        const agents: AgentInfo[] = [
          {
            name: `agent-${index}`,
            status: 'active',
            startedAt: new Date(),
          },
        ];

        mockUseElapsedTime.mockReturnValue(timeFormat);

        const { unmount } = render(<AgentPanel agents={agents} />);

        expect(screen.getByText(new RegExp(timeFormat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();

        unmount();
      });
    });

    it('handles edge case time formats', () => {
      const edgeCases = [
        '', // empty string
        '0s', // zero time
        '999h 59m', // very long time
      ];

      edgeCases.forEach((timeFormat, index) => {
        const agents: AgentInfo[] = [
          {
            name: `edge-agent-${index}`,
            status: 'active',
            startedAt: new Date(),
          },
        ];

        mockUseElapsedTime.mockReturnValue(timeFormat);

        const { unmount } = render(<AgentPanel agents={agents} />);

        expect(screen.getByText(`edge-agent-${index}`)).toBeInTheDocument();

        if (timeFormat) {
          expect(screen.getByText(new RegExp(timeFormat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
        }

        unmount();
      });
    });
  });

  describe('Elapsed Time Hook Interactions', () => {
    it('calls useElapsedTime with correct parameters', () => {
      const startTime1 = new Date('2024-01-01T10:00:00Z');
      const startTime2 = new Date('2024-01-01T10:05:00Z');

      const agents: AgentInfo[] = [
        { name: 'active-with-time', status: 'active', startedAt: startTime1 },
        { name: 'active-no-time', status: 'active' },
        { name: 'waiting-with-time', status: 'waiting', startedAt: startTime2 },
      ];

      mockUseElapsedTime.mockReturnValue('1m');

      render(<AgentPanel agents={agents} />);

      // Should call for active agent with startedAt
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime1);
      // Should call with null for active agent without startedAt
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
      // Should not call for waiting agents
      expect(mockUseElapsedTime).not.toHaveBeenCalledWith(startTime2);
    });

    it('handles hook re-renders correctly', () => {
      const startTime = new Date();
      const { rerender } = render(
        <AgentPanel
          agents={[
            { name: 'agent1', status: 'active', startedAt: startTime },
          ]}
        />
      );

      mockUseElapsedTime.mockReturnValue('1m');

      // Change agent
      rerender(
        <AgentPanel
          agents={[
            { name: 'agent2', status: 'active', startedAt: startTime },
          ]}
        />
      );

      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
    });

    it('updates when startedAt changes', () => {
      const startTime1 = new Date('2024-01-01T10:00:00Z');
      const startTime2 = new Date('2024-01-01T10:05:00Z');

      const { rerender } = render(
        <AgentPanel
          agents={[
            { name: 'agent', status: 'active', startedAt: startTime1 },
          ]}
        />
      );

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime1);

      rerender(
        <AgentPanel
          agents={[
            { name: 'agent', status: 'active', startedAt: startTime2 },
          ]}
        />
      );

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime2);
    });
  });

  describe('Performance with Timing', () => {
    it('efficiently handles multiple agents with timing', () => {
      const agents: AgentInfo[] = Array.from({ length: 10 }, (_, i) => ({
        name: `agent-${i}`,
        status: 'active' as const,
        startedAt: new Date(),
      }));

      mockUseElapsedTime.mockReturnValue('30s');

      render(<AgentPanel agents={agents} />);

      // Should call useElapsedTime for each agent
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(10);

      // Should display all agents
      agents.forEach(agent => {
        expect(screen.getByText(agent.name)).toBeInTheDocument();
      });
    });

    it('handles mixed agents efficiently', () => {
      const agents: AgentInfo[] = [
        { name: 'active-timed', status: 'active', startedAt: new Date() },
        { name: 'active-no-time', status: 'active' },
        { name: 'waiting-timed', status: 'waiting', startedAt: new Date() },
        { name: 'completed', status: 'completed' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'parallel-timed', status: 'parallel', startedAt: new Date() },
        { name: 'parallel-no-time', status: 'parallel' },
      ];

      mockUseElapsedTime.mockReturnValue('45s');

      render(
        <AgentPanel
          agents={agents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should call for active agent with startedAt, active without startedAt, and parallel agents
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(4);
    });
  });

  describe('Elapsed Time Error Handling', () => {
    it('handles timing hook errors gracefully', () => {
      const agents: AgentInfo[] = [
        { name: 'agent', status: 'active', startedAt: new Date() },
      ];

      mockUseElapsedTime.mockImplementation(() => {
        throw new Error('Timing error');
      });

      // Should not crash the component
      expect(() => {
        render(<AgentPanel agents={agents} />);
      }).not.toThrow();

      expect(screen.getByText('agent')).toBeInTheDocument();
    });

    it('handles invalid startedAt dates', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active', startedAt: new Date('invalid') },
        { name: 'agent2', status: 'active', startedAt: null as any },
        { name: 'agent3', status: 'active', startedAt: undefined as any },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} />);

      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
    });
  });
});