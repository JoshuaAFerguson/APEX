import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock only the useAgentHandoff hook, let useElapsedTime work normally
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

// Mock the formatElapsed function to return predictable results
const mockFormatElapsed = vi.fn();
vi.mock('@apexcli/core', () => ({
  formatElapsed: mockFormatElapsed,
}));

describe('AgentRow Elapsed Time Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFormatElapsed.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Real useElapsedTime hook integration', () => {
    it('shows elapsed time that updates automatically', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      // Set up the mock to return different values over time
      let callCount = 0;
      mockFormatElapsed.mockImplementation(() => {
        callCount++;
        switch (callCount) {
          case 1: return '30s';
          case 2: return '31s';
          case 3: return '32s';
          default: return '30s';
        }
      });

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Initial render should show elapsed time
      expect(screen.getByText(/\[30s\]/)).toBeInTheDocument();
      expect(mockFormatElapsed).toHaveBeenCalledWith(startTime, expect.any(Date));

      // Advance time by 1 second to trigger update
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText(/\[31s\]/)).toBeInTheDocument();

      // Advance time again
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText(/\[32s\]/)).toBeInTheDocument();
    });

    it('stops updating when component unmounts', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockFormatElapsed.mockReturnValue('30s');

      const { unmount } = render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(mockFormatElapsed).toHaveBeenCalled();

      const initialCallCount = mockFormatElapsed.mock.calls.length;

      // Unmount the component
      unmount();

      // Advance time after unmount
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should not have been called again after unmount
      expect(mockFormatElapsed.mock.calls.length).toBe(initialCallCount);
    });

    it('updates when startTime changes', () => {
      const startTime1 = new Date('2023-01-01T10:00:00Z');
      const startTime2 = new Date('2023-01-01T10:02:00Z');

      let agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime1,
        },
      ];

      mockFormatElapsed.mockImplementation((start) => {
        if (start === startTime1) return '30s';
        if (start === startTime2) return '15s';
        return '0s';
      });

      const { rerender } = render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[30s\]/)).toBeInTheDocument();

      // Change the startTime
      agents = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime2,
        },
      ];

      rerender(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[15s\]/)).toBeInTheDocument();
    });

    it('handles agent status change from active to inactive', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');

      let agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockFormatElapsed.mockReturnValue('45s');

      const { rerender } = render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[45s\]/)).toBeInTheDocument();

      // Change agent status to completed
      agents = [
        {
          name: 'developer',
          status: 'completed',
          startedAt: startTime,
        },
      ];

      rerender(<AgentPanel agents={agents} />);

      // Should no longer show elapsed time
      expect(screen.queryByText(/\[45s\]/)).not.toBeInTheDocument();
    });

    it('handles agent status change from inactive to active', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');

      let agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'waiting',
          startedAt: startTime,
        },
      ];

      mockFormatElapsed.mockReturnValue('45s');

      const { rerender } = render(<AgentPanel agents={agents} />);

      // Should not show elapsed time when waiting
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();

      // Change agent status to active
      agents = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      rerender(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should now show elapsed time
      expect(screen.getByText(/\[45s\]/)).toBeInTheDocument();
    });
  });

  describe('Multiple agents with different elapsed times', () => {
    it('shows different elapsed times for multiple active agents', () => {
      const startTime1 = new Date('2023-01-01T10:00:00Z');
      const startTime2 = new Date('2023-01-01T10:01:00Z');

      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime1,
        },
        {
          name: 'tester',
          status: 'active',
          startedAt: startTime2,
        },
      ];

      mockFormatElapsed.mockImplementation((start) => {
        if (start === startTime1) return '2m 30s';
        if (start === startTime2) return '1m 30s';
        return '0s';
      });

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[2m 30s\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[1m 30s\]/)).toBeInTheDocument();
    });

    it('handles mixed agent states with some showing elapsed time', () => {
      const activeStartTime = new Date('2023-01-01T10:00:00Z');
      const completedStartTime = new Date('2023-01-01T09:30:00Z');

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
        },
      ];

      mockFormatElapsed.mockImplementation((start) => {
        if (start === activeStartTime) return '1m 45s';
        return '0s';
      });

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Only active agent should show elapsed time
      expect(screen.getByText(/\[1m 45s\]/)).toBeInTheDocument();

      // Verify that formatElapsed was called only for the active agent
      expect(mockFormatElapsed).toHaveBeenCalledWith(activeStartTime, expect.any(Date));

      // Should not have been called for non-active agents
      expect(mockFormatElapsed).not.toHaveBeenCalledWith(completedStartTime, expect.any(Date));
    });
  });

  describe('Parallel execution elapsed time integration', () => {
    it('shows elapsed times for parallel agents', () => {
      const startTime1 = new Date('2023-01-01T10:00:00Z');
      const startTime2 = new Date('2023-01-01T10:01:30Z');

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

      mockFormatElapsed.mockImplementation((start) => {
        if (start === startTime1) return '3m 20s';
        if (start === startTime2) return '1m 50s';
        return '0s';
      });

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText(/\[3m 20s\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[1m 50s\]/)).toBeInTheDocument();
    });

    it('updates parallel agent elapsed times in real-time', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');

      const parallelAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          startedAt: startTime,
        },
      ];

      let callCount = 0;
      mockFormatElapsed.mockImplementation(() => {
        callCount++;
        return `${29 + callCount}s`;
      });

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText(/\[30s\]/)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText(/\[31s\]/)).toBeInTheDocument();
    });
  });

  describe('Compact mode elapsed time integration', () => {
    it('shows elapsed times in compact format', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', startedAt: startTime },
        { name: 'tester', status: 'waiting' },
      ];

      mockFormatElapsed.mockReturnValue('2m 15s');

      render(<AgentPanel agents={agents} currentAgent="developer" compact={true} />);

      // Should show developer with elapsed time in compact format
      expect(screen.getByText(/developer\[2m 15s\]/)).toBeInTheDocument();
      // Other agents should not show elapsed time
      expect(screen.queryByText(/planner\[.*\]/)).not.toBeInTheDocument();
      expect(screen.queryByText(/tester\[.*\]/)).not.toBeInTheDocument();
    });

    it('updates elapsed time in compact mode', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active', startedAt: startTime },
      ];

      let seconds = 45;
      mockFormatElapsed.mockImplementation(() => `${seconds++}s`);

      render(<AgentPanel agents={agents} currentAgent="developer" compact={true} />);

      expect(screen.getByText(/developer\[45s\]/)).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText(/developer\[46s\]/)).toBeInTheDocument();
    });

    it('handles parallel agents in compact mode with elapsed times', () => {
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

      mockFormatElapsed.mockReturnValue('1m 30s');

      render(
        <AgentPanel
          agents={[]}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText(/developer\[1m 30s\]/)).toBeInTheDocument();
      expect(screen.getByText(/tester\[1m 30s\]/)).toBeInTheDocument();
    });
  });

  describe('Error handling and edge cases', () => {
    it('handles formatElapsed throwing an error gracefully', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockFormatElapsed.mockImplementation(() => {
        throw new Error('Format error');
      });

      // Should not throw an error, might show default '0s' or handle gracefully
      expect(() => {
        render(<AgentPanel agents={agents} currentAgent="developer" />);
      }).not.toThrow();
    });

    it('handles very frequent updates correctly', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      let callCount = 0;
      mockFormatElapsed.mockImplementation(() => `${callCount++}s`);

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Rapidly advance time multiple times
      for (let i = 0; i < 10; i++) {
        act(() => {
          vi.advanceTimersByTime(100);
        });
      }

      // Should handle frequent updates without issues
      expect(screen.getByText(/\[\d+s\]/)).toBeInTheDocument();
    });

    it('cleans up intervals when agent becomes inactive', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');

      let agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockFormatElapsed.mockReturnValue('30s');

      const { rerender } = render(<AgentPanel agents={agents} currentAgent="developer" />);

      const initialCallCount = mockFormatElapsed.mock.calls.length;

      // Change agent to inactive
      agents = [
        {
          name: 'developer',
          status: 'completed',
          startedAt: startTime,
        },
      ];

      rerender(<AgentPanel agents={agents} />);

      // Advance time - should not trigger more calls since agent is inactive
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Call count should not have increased significantly
      expect(mockFormatElapsed.mock.calls.length).toBeLessThanOrEqual(initialCallCount + 1);
    });
  });

  describe('Custom update intervals', () => {
    it('respects different update intervals', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      let callCount = 0;
      mockFormatElapsed.mockImplementation(() => `${++callCount}s`);

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      const initialCallCount = mockFormatElapsed.mock.calls.length;

      // Advance by less than default interval (1000ms)
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should not have triggered update yet
      expect(mockFormatElapsed.mock.calls.length).toBe(initialCallCount);

      // Advance past the default interval
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Should have triggered update
      expect(mockFormatElapsed.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });
});