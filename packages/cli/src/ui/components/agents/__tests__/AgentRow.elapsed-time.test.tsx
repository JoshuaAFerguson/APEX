import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock the useElapsedTime hook
const mockUseElapsedTime = vi.fn();

vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

// Mock the useAgentHandoff hook to focus on elapsed time tests
vi.mock('../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: vi.fn(() => ({
    isAnimating: false,
    previousAgent: null,
    currentAgent: null,
    progress: 0,
    isFading: false,
  })),
}));

// Mock HandoffIndicator to focus on elapsed time functionality
vi.mock('../HandoffIndicator.js', () => ({
  HandoffIndicator: () => null,
}));

describe('AgentRow Elapsed Time Display', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseElapsedTime.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Active agents with startedAt date', () => {
    it('shows elapsed time for active agent with startedAt date', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('42s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(screen.getByText(/\[42s\]/)).toBeInTheDocument();
    });

    it('updates elapsed time display in real-time', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'tester',
          status: 'active',
          startedAt: startTime,
        },
      ];

      // Initial render with 30s
      mockUseElapsedTime.mockReturnValue('30s');
      const { rerender } = render(<AgentPanel agents={agents} currentAgent="tester" />);

      expect(screen.getByText(/\[30s\]/)).toBeInTheDocument();

      // Simulate time passing and hook updating
      mockUseElapsedTime.mockReturnValue('45s');
      rerender(<AgentPanel agents={agents} currentAgent="tester" />);

      expect(screen.getByText(/\[45s\]/)).toBeInTheDocument();
    });

    it('displays formatted time with minutes and seconds', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'reviewer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('2m 30s');

      render(<AgentPanel agents={agents} currentAgent="reviewer" />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(screen.getByText(/\[2m 30s\]/)).toBeInTheDocument();
    });

    it('displays formatted time with hours and minutes', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'architect',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('1h 15m');

      render(<AgentPanel agents={agents} currentAgent="architect" />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(screen.getByText(/\[1h 15m\]/)).toBeInTheDocument();
    });
  });

  describe('Agents without elapsed time display', () => {
    it('does not show elapsed time for active agent without startedAt', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          // No startedAt property
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();
    });

    it('does not show elapsed time for non-active agents even with startedAt', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          startedAt: startTime,
        },
        {
          name: 'architect',
          status: 'waiting',
          startedAt: startTime,
        },
        {
          name: 'devops',
          status: 'idle',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} />);

      // Should be called with null for all non-active agents
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(3);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(1, null);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(2, null);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(3, null);
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();
    });

    it('does not show elapsed time for parallel agents in main agent list', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();
    });
  });

  describe('Compact mode elapsed time display', () => {
    it('shows elapsed time for active agent in compact mode', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', startedAt: startTime },
        { name: 'tester', status: 'waiting' },
      ];

      mockUseElapsedTime.mockReturnValue('1m 23s');

      render(<AgentPanel agents={agents} currentAgent="developer" compact={true} />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(screen.getByText(/developer\[1m 23s\]/)).toBeInTheDocument();
    });

    it('handles multiple agents in compact mode with only one showing elapsed time', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', startedAt: startTime },
        { name: 'tester', status: 'waiting' },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        return time ? '45s' : '0s';
      });

      render(<AgentPanel agents={agents} currentAgent="developer" compact={true} />);

      // Should call useElapsedTime for each agent
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(3);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(1, null); // planner
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(2, startTime); // developer
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(3, null); // tester

      // Only developer should show elapsed time
      expect(screen.getByText(/developer\[45s\]/)).toBeInTheDocument();
      expect(screen.queryByText(/planner\[.*\]/)).not.toBeInTheDocument();
      expect(screen.queryByText(/tester\[.*\]/)).not.toBeInTheDocument();
    });
  });

  describe('Parallel execution elapsed time display', () => {
    it('shows elapsed time for parallel agents in parallel section', () => {
      const startTime1 = new Date('2023-01-01T10:00:00Z');
      const startTime2 = new Date('2023-01-01T10:02:00Z');

      const parallelAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          startedAt: startTime1,
        },
        {
          name: 'tester',
          status: 'parallel',
          startedAt: startTime2,
        },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        if (time === startTime1) return '5m 30s';
        if (time === startTime2) return '3m 30s';
        return '0s';
      });

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText(/\[5m 30s\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[3m 30s\]/)).toBeInTheDocument();
    });

    it('shows elapsed time for parallel agents in compact mode', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const parallelAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          startedAt: startTime,
        },
        {
          name: 'tester',
          status: 'parallel',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('2m 15s');

      render(
        <AgentPanel
          agents={[]}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Both parallel agents should show elapsed time
      expect(screen.getByText(/developer\[2m 15s\]/)).toBeInTheDocument();
      expect(screen.getByText(/tester\[2m 15s\]/)).toBeInTheDocument();
    });

    it('does not show elapsed time for parallel agents without startedAt', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          // No startedAt
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();
    });
  });

  describe('Mixed agent scenarios', () => {
    it('handles mixed agent states with only some showing elapsed time', () => {
      const activeStartTime = new Date('2023-01-01T10:00:00Z');
      const completedStartTime = new Date('2023-01-01T09:00:00Z');

      const agents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          startedAt: completedStartTime,
        },
        {
          name: 'developer',
          status: 'active',
          startedAt: activeStartTime,
        },
        {
          name: 'tester',
          status: 'waiting',
          // No startedAt
        },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        if (time === activeStartTime) return '30s';
        return '0s';
      });

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Only the active agent should show elapsed time
      expect(screen.getByText(/\[30s\]/)).toBeInTheDocument();

      // Verify correct calls to useElapsedTime
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(3);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(1, null); // completed planner
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(2, activeStartTime); // active developer
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(3, null); // waiting tester
    });

    it('displays elapsed time alongside other agent information', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: 75,
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('2m 45s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should show all information including elapsed time
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/\[2m 45s\]/)).toBeInTheDocument();
    });
  });

  describe('useElapsedTime hook integration', () => {
    it('calls useElapsedTime with correct parameters', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('1s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(1);
    });

    it('calls useElapsedTime with null for inactive agents', () => {
      const agents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
    });

    it('handles useElapsedTime returning different time formats', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      const timeFormats = ['5s', '1m 30s', '2h 45m', '3h'];

      timeFormats.forEach(timeFormat => {
        mockUseElapsedTime.mockReturnValue(timeFormat);
        const { rerender } = render(<AgentPanel agents={agents} currentAgent="developer" />);

        expect(screen.getByText(new RegExp(`\\[${timeFormat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`))).toBeInTheDocument();

        rerender(<div />); // Clear between tests
      });
    });
  });

  describe('Edge cases and error scenarios', () => {
    it('handles undefined/null startedAt gracefully', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: undefined as any,
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();
    });

    it('handles invalid Date objects gracefully', () => {
      const invalidDate = new Date('invalid-date-string');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: invalidDate,
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should pass the invalid date to useElapsedTime
      expect(mockUseElapsedTime).toHaveBeenCalledWith(invalidDate);
      expect(screen.getByText(/\[0s\]/)).toBeInTheDocument();
    });

    it('handles empty elapsed time string', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[\]/)).toBeInTheDocument();
    });

    it('handles very long elapsed time strings', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('99h 59m');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[99h 59m\]/)).toBeInTheDocument();
    });
  });

  describe('Performance and re-rendering', () => {
    it('only calls useElapsedTime once per agent per render', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
        {
          name: 'tester',
          status: 'waiting',
        },
      ];

      mockUseElapsedTime.mockReturnValue('30s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(mockUseElapsedTime).toHaveBeenCalledTimes(2);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(1, startTime);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(2, null);
    });

    it('re-calls useElapsedTime when agent startedAt changes', () => {
      const startTime1 = new Date('2023-01-01T10:00:00Z');
      const startTime2 = new Date('2023-01-01T10:05:00Z');

      let agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime1,
        },
      ];

      mockUseElapsedTime.mockReturnValue('30s');

      const { rerender } = render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime1);

      // Update the agent's startedAt time
      agents = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime2,
        },
      ];

      rerender(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime2);
    });
  });
});