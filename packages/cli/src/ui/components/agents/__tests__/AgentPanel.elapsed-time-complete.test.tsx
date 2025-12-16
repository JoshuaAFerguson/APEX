import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock the useElapsedTime hook
const mockUseElapsedTime = vi.fn();

vi.mock('../../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

// Mock the useAgentHandoff hook to focus on elapsed time tests
vi.mock('../../../hooks/useAgentHandoff.js', () => ({
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

describe('AgentPanel Elapsed Time Complete Coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseElapsedTime.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Elapsed time display for active agents with startedAt', () => {
    it('shows elapsed time for single active agent with startedAt', () => {
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

      mockUseElapsedTime.mockReturnValue('2m 30s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should call useElapsedTime with the startedAt time
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);

      // Should display elapsed time
      expect(screen.getByText(/\[2m 30s\]/)).toBeInTheDocument();

      // Should also display other agent info
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
    });

    it('shows elapsed time for multiple active agents with different start times', () => {
      const startTime1 = new Date('2023-01-01T10:00:00Z');
      const startTime2 = new Date('2023-01-01T10:05:00Z');
      const startTime3 = new Date('2023-01-01T10:10:00Z');

      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'coding',
          startedAt: startTime1,
        },
        {
          name: 'tester',
          status: 'active',
          stage: 'testing',
          startedAt: startTime2,
        },
        {
          name: 'reviewer',
          status: 'active',
          stage: 'reviewing',
          startedAt: startTime3,
        },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        if (time === startTime1) return '5m 30s';
        if (time === startTime2) return '30s';
        if (time === startTime3) return '15s';
        return '0s';
      });

      render(<AgentPanel agents={agents} />);

      // Should call useElapsedTime for each agent
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(3);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(1, startTime1);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(2, startTime2);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(3, startTime3);

      // Should display elapsed time for all agents
      expect(screen.getByText(/\[5m 30s\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[30s\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[15s\]/)).toBeInTheDocument();
    });

    it('shows elapsed time with various time formats', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const testFormats = [
        '5s',
        '45s',
        '1m 30s',
        '5m 45s',
        '1h 15m',
        '2h 30m',
        '12h',
        '1d 5h',
      ];

      testFormats.forEach((timeFormat) => {
        const agents: AgentInfo[] = [
          {
            name: 'test-agent',
            status: 'active',
            startedAt: startTime,
          },
        ];

        mockUseElapsedTime.mockReturnValue(timeFormat);

        const { unmount } = render(<AgentPanel agents={agents} />);

        expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
        expect(screen.getByText(new RegExp(`\\[${timeFormat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`))).toBeInTheDocument();

        unmount();
        mockUseElapsedTime.mockClear();
      });
    });

    it('updates elapsed time display when hook returns new values', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      // Initial render with 30s
      mockUseElapsedTime.mockReturnValue('30s');
      const { rerender } = render(<AgentPanel agents={agents} />);

      expect(screen.getByText(/\[30s\]/)).toBeInTheDocument();

      // Update to 45s
      mockUseElapsedTime.mockReturnValue('45s');
      rerender(<AgentPanel agents={agents} />);

      expect(screen.getByText(/\[45s\]/)).toBeInTheDocument();
      expect(screen.queryByText(/\[30s\]/)).not.toBeInTheDocument();

      // Update to 1m 15s
      mockUseElapsedTime.mockReturnValue('1m 15s');
      rerender(<AgentPanel agents={agents} />);

      expect(screen.getByText(/\[1m 15s\]/)).toBeInTheDocument();
      expect(screen.queryByText(/\[45s\]/)).not.toBeInTheDocument();
    });

    it('shows elapsed time alongside progress and stage information', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: 65,
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('3m 45s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should show all information together
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
      expect(screen.getByText(/65%/)).toBeInTheDocument();
      expect(screen.getByText(/\[3m 45s\]/)).toBeInTheDocument();
    });
  });

  describe('Elapsed time display for non-active agents', () => {
    it('does not show elapsed time for completed agents even with startedAt', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          stage: 'planning',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} />);

      // Should be called with null for completed agents
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);

      // Should not show elapsed time
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();

      // Should show agent name
      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    it('does not show elapsed time for waiting agents even with startedAt', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'reviewer',
          status: 'waiting',
          stage: 'reviewing',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} />);

      // Should be called with null for waiting agents
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);

      // Should not show elapsed time
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();

      // Should show agent name
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('does not show elapsed time for idle agents even with startedAt', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'devops',
          status: 'idle',
          stage: 'deployment',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} />);

      // Should be called with null for idle agents
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);

      // Should not show elapsed time
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();

      // Should show agent name
      expect(screen.getByText('devops')).toBeInTheDocument();
    });

    it('does not show elapsed time for parallel agents in main list', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'parallel-worker',
          status: 'parallel',
          stage: 'processing',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} />);

      // Should be called with null for parallel agents in main list
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);

      // Should not show elapsed time
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();

      // Should show agent name
      expect(screen.getByText('parallel-worker')).toBeInTheDocument();
    });
  });

  describe('Elapsed time for active agents without startedAt', () => {
    it('does not show elapsed time for active agent without startedAt', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: 50,
          // No startedAt property
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should be called with null when no startedAt
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);

      // Should not show elapsed time
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();

      // Should show other agent info
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/50%/)).toBeInTheDocument();
    });

    it('handles mixed scenario with some active agents having startedAt', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'agent1',
          status: 'active',
          startedAt: startTime,
        },
        {
          name: 'agent2',
          status: 'active',
          // No startedAt
        },
        {
          name: 'agent3',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        return time ? '2m 15s' : '0s';
      });

      render(<AgentPanel agents={agents} />);

      // Should call useElapsedTime for all agents
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(3);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(1, startTime);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(2, null);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(3, startTime);

      // Should show elapsed time only for agents with startedAt
      const elapsedTimeElements = screen.getAllByText(/\[2m 15s\]/);
      expect(elapsedTimeElements).toHaveLength(2); // agent1 and agent3

      // Should show all agent names
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
    });
  });

  describe('Elapsed time in compact mode', () => {
    it('shows elapsed time for active agent in compact mode', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', startedAt: startTime },
        { name: 'tester', status: 'waiting' },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        return time ? '1m 23s' : '0s';
      });

      render(<AgentPanel agents={agents} currentAgent="developer" compact={true} />);

      // Should call useElapsedTime for each agent
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(3);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(1, null); // planner
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(2, startTime); // developer
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(3, null); // tester

      // Should show elapsed time for developer in compact format
      expect(screen.getByText(/developer.*\[1m 23s\]/)).toBeInTheDocument();

      // Should not show elapsed time for other agents
      expect(screen.queryByText(/planner.*\[/)).not.toBeInTheDocument();
      expect(screen.queryByText(/tester.*\[/)).not.toBeInTheDocument();

      // Should not show "Active Agents" header in compact mode
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
    });

    it('shows elapsed time for multiple agents in compact mode', () => {
      const startTime1 = new Date('2023-01-01T10:00:00Z');
      const startTime2 = new Date('2023-01-01T10:05:00Z');

      const agents: AgentInfo[] = [
        { name: 'dev1', status: 'active', startedAt: startTime1 },
        { name: 'dev2', status: 'active', startedAt: startTime2 },
        { name: 'reviewer', status: 'waiting' },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        if (time === startTime1) return '5m 15s';
        if (time === startTime2) return '45s';
        return '0s';
      });

      render(<AgentPanel agents={agents} compact={true} />);

      // Should show elapsed time for both active agents
      expect(screen.getByText(/dev1.*\[5m 15s\]/)).toBeInTheDocument();
      expect(screen.getByText(/dev2.*\[45s\]/)).toBeInTheDocument();

      // Should not show elapsed time for waiting agent
      expect(screen.queryByText(/reviewer.*\[/)).not.toBeInTheDocument();

      // Should show all agent names
      expect(screen.getByText('dev1')).toBeInTheDocument();
      expect(screen.getByText('dev2')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('handles compact mode with agents having no elapsed time', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active' }, // No startedAt
        { name: 'agent2', status: 'completed' },
        { name: 'agent3', status: 'waiting' },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} compact={true} />);

      // Should call useElapsedTime with null for all agents
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(3);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(1, null);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(2, null);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(3, null);

      // Should not show any elapsed time brackets
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();

      // Should show all agent names
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
    });
  });

  describe('Elapsed time for parallel agents', () => {
    it('shows elapsed time for parallel agents in parallel section', () => {
      const startTime1 = new Date('2023-01-01T10:00:00Z');
      const startTime2 = new Date('2023-01-01T10:02:00Z');

      const parallelAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          stage: 'implementation',
          startedAt: startTime1,
        },
        {
          name: 'tester',
          status: 'parallel',
          stage: 'testing',
          startedAt: startTime2,
        },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        if (time === startTime1) return '8m 30s';
        if (time === startTime2) return '6m 30s';
        return '0s';
      });

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show elapsed time for parallel agents
      expect(screen.getByText(/\[8m 30s\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[6m 30s\]/)).toBeInTheDocument();

      // Should show parallel execution section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Should show agent names and stages
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/testing/)).toBeInTheDocument();
    });

    it('does not show elapsed time for parallel agents without startedAt', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          stage: 'implementation',
          // No startedAt
        },
        {
          name: 'tester',
          status: 'parallel',
          stage: 'testing',
          startedAt: new Date('2023-01-01T10:00:00Z'),
        },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        return time ? '3m 15s' : '0s';
      });

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show elapsed time only for the agent with startedAt
      expect(screen.getByText(/\[3m 15s\]/)).toBeInTheDocument();

      // Should not show elapsed time for agent without startedAt
      const elapsedTimeElements = screen.getAllByText(/\[.*\]/);
      expect(elapsedTimeElements).toHaveLength(1);

      // Should show both agent names
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('shows elapsed time for parallel agents in compact mode', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const parallelAgents: AgentInfo[] = [
        {
          name: 'dev',
          status: 'parallel',
          startedAt: startTime,
        },
        {
          name: 'test',
          status: 'parallel',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('4m 20s');

      render(
        <AgentPanel
          agents={[]}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show elapsed time for both parallel agents in compact format
      expect(screen.getByText(/dev.*\[4m 20s\]/)).toBeInTheDocument();
      expect(screen.getByText(/test.*\[4m 20s\]/)).toBeInTheDocument();

      // Should not show section headers in compact mode
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });
  });

  describe('Elapsed time edge cases', () => {
    it('handles invalid startedAt dates gracefully', () => {
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

      // Should handle gracefully and show the returned value
      expect(screen.getByText(/\[0s\]/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles null/undefined startedAt gracefully', () => {
      const agents: AgentInfo[] = [
        {
          name: 'agent1',
          status: 'active',
          startedAt: null as any,
        },
        {
          name: 'agent2',
          status: 'active',
          startedAt: undefined as any,
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} />);

      // Should call useElapsedTime with null for both agents
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(2);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(1, null);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(2, null);

      // Should not show elapsed time
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();

      // Should show agent names
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
    });

    it('handles empty elapsed time string from hook', () => {
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

      // Should show empty brackets
      expect(screen.getByText(/\[\]/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
    });

    it('handles very long elapsed time strings', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'long-runner',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('999h 59m 59s');

      render(<AgentPanel agents={agents} currentAgent="long-runner" />);

      // Should handle very long time strings
      expect(screen.getByText(/\[999h 59m 59s\]/)).toBeInTheDocument();
      expect(screen.getByText('long-runner')).toBeInTheDocument();
    });
  });

  describe('Performance and hook interaction', () => {
    it('calls useElapsedTime once per agent per render', () => {
      const startTime1 = new Date('2023-01-01T10:00:00Z');
      const startTime2 = new Date('2023-01-01T10:05:00Z');

      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active', startedAt: startTime1 },
        { name: 'agent2', status: 'completed', startedAt: startTime2 },
        { name: 'agent3', status: 'waiting' },
      ];

      mockUseElapsedTime.mockReturnValue('1m');

      render(<AgentPanel agents={agents} />);

      // Should call useElapsedTime exactly once per agent
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(3);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(1, startTime1);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(2, null);
      expect(mockUseElapsedTime).toHaveBeenNthCalledWith(3, null);
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

      mockUseElapsedTime.mockReturnValue('2m');

      const { rerender } = render(<AgentPanel agents={agents} />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime1);

      // Update the agent's startedAt time
      agents = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime2,
        },
      ];

      rerender(<AgentPanel agents={agents} />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime2);
    });

    it('handles rapid re-renders without performance issues', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      const timeValues = ['10s', '15s', '20s', '25s', '30s'];

      timeValues.forEach((timeValue, index) => {
        mockUseElapsedTime.mockReturnValue(timeValue);

        const { rerender, unmount } = render(<AgentPanel agents={agents} />);

        expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
        expect(screen.getByText(new RegExp(`\\[${timeValue}\\]`))).toBeInTheDocument();

        unmount();
        mockUseElapsedTime.mockClear();
      });
    });
  });

  describe('Accessibility for elapsed time', () => {
    it('provides accessible elapsed time information', () => {
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

      mockUseElapsedTime.mockReturnValue('4m 15s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // All information should be accessible to screen readers
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/\[4m 15s\]/)).toBeInTheDocument();
    });

    it('maintains accessibility with multiple agents showing elapsed time', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        { name: 'dev1', status: 'active', startedAt: startTime },
        { name: 'dev2', status: 'active', startedAt: startTime },
        { name: 'reviewer', status: 'waiting' },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        return time ? '3m 30s' : '0s';
      });

      render(<AgentPanel agents={agents} />);

      // All agents should be accessible
      expect(screen.getByText('dev1')).toBeInTheDocument();
      expect(screen.getByText('dev2')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();

      // Elapsed time should be accessible for active agents
      const elapsedTimeElements = screen.getAllByText(/\[3m 30s\]/);
      expect(elapsedTimeElements).toHaveLength(2);
    });
  });
});