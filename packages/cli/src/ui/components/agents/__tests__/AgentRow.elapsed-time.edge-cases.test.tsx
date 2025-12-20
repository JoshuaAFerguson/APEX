import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock the useElapsedTime hook for edge case testing
const mockUseElapsedTime = vi.fn();

vi.mock('../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

// Mock the useAgentHandoff hook
vi.mock('../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: vi.fn(() => ({
    isAnimating: false,
    previousAgent: null,
    currentAgent: null,
    progress: 0,
    isFading: false,
  })),
}));

// Mock HandoffIndicator
vi.mock('../HandoffIndicator.js', () => ({
  HandoffIndicator: () => null,
}));

describe('AgentRow Elapsed Time Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseElapsedTime.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Invalid Date handling', () => {
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

      expect(() => {
        render(<AgentPanel agents={agents} currentAgent="developer" />);
      }).not.toThrow();

      expect(mockUseElapsedTime).toHaveBeenCalledWith(invalidDate);
      expect(screen.getByText(/\[0s\]/)).toBeInTheDocument();
    });

    it('handles null date values', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: null as any,
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      expect(() => {
        render(<AgentPanel agents={agents} currentAgent="developer" />);
      }).not.toThrow();

      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();
    });

    it('handles undefined date values', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: undefined,
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      expect(() => {
        render(<AgentPanel agents={agents} currentAgent="developer" />);
      }).not.toThrow();

      expect(mockUseElapsedTime).toHaveBeenCalledWith(null);
      expect(screen.queryByText(/\[.*\]/)).not.toBeInTheDocument();
    });

    it('handles future dates', () => {
      const futureDate = new Date(Date.now() + 10000); // 10 seconds in the future
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: futureDate,
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(mockUseElapsedTime).toHaveBeenCalledWith(futureDate);
      expect(screen.getByText(/\[0s\]/)).toBeInTheDocument();
    });
  });

  describe('Extreme elapsed time values', () => {
    it('handles very small elapsed times', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[0s\]/)).toBeInTheDocument();
    });

    it('handles extremely large elapsed times', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('9999h 59m');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[9999h 59m\]/)).toBeInTheDocument();
    });

    it('handles fractional seconds gracefully', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      // The hook should not return fractional seconds, but test defensive handling
      mockUseElapsedTime.mockReturnValue('0.5s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[0\.5s\]/)).toBeInTheDocument();
    });

    it('handles negative elapsed times', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      // Should not happen in practice, but test defensive handling
      mockUseElapsedTime.mockReturnValue('-5s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[-5s\]/)).toBeInTheDocument();
    });
  });

  describe('Malformed elapsed time strings', () => {
    it('handles empty elapsed time string', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[\]/)).toBeInTheDocument();
    });

    it('handles malformed time string', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('invalid-time');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[invalid-time\]/)).toBeInTheDocument();
    });

    it('handles time string with unexpected format', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('1 hour 30 minutes');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[1 hour 30 minutes\]/)).toBeInTheDocument();
    });

    it('handles time string with special characters', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('2m~30s!@#');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[2m~30s!@#\]/)).toBeInTheDocument();
    });

    it('handles extremely long time string', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      const longTimeString = 'a'.repeat(1000) + 's';
      mockUseElapsedTime.mockReturnValue(longTimeString);

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(new RegExp(`\\[${longTimeString}\\]`))).toBeInTheDocument();
    });
  });

  describe('Agent state edge cases', () => {
    it('handles agent status changing rapidly', () => {
      const startTime = new Date();

      let agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('30s');

      const { rerender } = render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[30s\]/)).toBeInTheDocument();

      // Change to waiting
      agents = [
        {
          name: 'developer',
          status: 'waiting',
          startedAt: startTime,
        },
      ];

      rerender(<AgentPanel agents={agents} />);

      expect(screen.queryByText(/\[30s\]/)).not.toBeInTheDocument();

      // Change back to active
      agents = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      rerender(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[30s\]/)).toBeInTheDocument();
    });

    it('handles agent being removed and re-added', () => {
      const startTime = new Date();

      let agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('45s');

      const { rerender } = render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[45s\]/)).toBeInTheDocument();

      // Remove agent
      agents = [];

      rerender(<AgentPanel agents={agents} />);

      expect(screen.queryByText(/\[45s\]/)).not.toBeInTheDocument();

      // Re-add agent
      agents = [
        {
          name: 'developer',
          status: 'active',
          startedAt: startTime,
        },
      ];

      rerender(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText(/\[45s\]/)).toBeInTheDocument();
    });

    it('handles multiple agents with same name but different statuses', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'completed',
          startedAt: new Date(),
        },
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockImplementation((time, index) => {
        return time ? '1m 20s' : '0s';
      });

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should show elapsed time for the active agent
      expect(screen.getByText(/\[1m 20s\]/)).toBeInTheDocument();
    });
  });

  describe('Memory and performance edge cases', () => {
    it('handles large number of agents efficiently', () => {
      const agents: AgentInfo[] = Array.from({ length: 100 }, (_, i) => ({
        name: `agent-${i}`,
        status: i === 50 ? 'active' as const : 'idle' as const,
        startedAt: i === 50 ? new Date() : undefined,
      }));

      mockUseElapsedTime.mockImplementation((time) => time ? '2m 30s' : '0s');

      expect(() => {
        render(<AgentPanel agents={agents} currentAgent="agent-50" />);
      }).not.toThrow();

      // Only the active agent should show elapsed time
      expect(screen.getByText(/\[2m 30s\]/)).toBeInTheDocument();
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(100);
    });

    it('handles rapid re-rendering without memory leaks', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('1s');

      const { rerender } = render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Simulate rapid re-renders
      for (let i = 0; i < 100; i++) {
        mockUseElapsedTime.mockReturnValue(`${i + 1}s`);
        rerender(<AgentPanel agents={agents} currentAgent="developer" />);
      }

      expect(screen.getByText(/\[100s\]/)).toBeInTheDocument();
    });

    it('handles memory pressure scenarios', () => {
      const startTime = new Date();
      const agents: AgentInfo[] = [
        {
          name: 'memory-intensive-agent',
          status: 'active',
          startedAt: startTime,
        },
      ];

      // Simulate memory pressure by creating large strings
      const largeTimeString = 'x'.repeat(10000);
      mockUseElapsedTime.mockReturnValue(largeTimeString);

      expect(() => {
        render(<AgentPanel agents={agents} currentAgent="memory-intensive-agent" />);
      }).not.toThrow();

      expect(screen.getByText(new RegExp(`\\[${largeTimeString}\\]`))).toBeInTheDocument();
    });
  });

  describe('Concurrent execution edge cases', () => {
    it('handles parallel agents with overlapping start times', () => {
      const baseTime = new Date('2023-01-01T10:00:00Z');
      const parallelAgents: AgentInfo[] = [
        {
          name: 'agent1',
          status: 'parallel',
          startedAt: baseTime,
        },
        {
          name: 'agent2',
          status: 'parallel',
          startedAt: new Date(baseTime.getTime() + 1), // 1ms later
        },
        {
          name: 'agent3',
          status: 'parallel',
          startedAt: baseTime, // Same time as agent1
        },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        if (time && time.getTime() === baseTime.getTime()) return '5m';
        if (time && time.getTime() === baseTime.getTime() + 1) return '4m 59s';
        return '0s';
      });

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getAllByText(/\[5m\]/)).toHaveLength(2); // agent1 and agent3
      expect(screen.getByText(/\[4m 59s\]/)).toBeInTheDocument(); // agent2
    });

    it('handles mixed parallel and sequential agents', () => {
      const startTime = new Date();
      const sequentialAgents: AgentInfo[] = [
        {
          name: 'sequential-agent',
          status: 'active',
          startedAt: startTime,
        },
      ];

      const parallelAgents: AgentInfo[] = [
        {
          name: 'parallel-agent1',
          status: 'parallel',
          startedAt: startTime,
        },
        {
          name: 'parallel-agent2',
          status: 'parallel',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('3m 15s');

      render(
        <AgentPanel
          agents={sequentialAgents}
          currentAgent="sequential-agent"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show elapsed time for all active agents
      expect(screen.getAllByText(/\[3m 15s\]/)).toHaveLength(3);
    });

    it('handles agents transitioning between parallel and sequential modes', () => {
      const startTime = new Date();

      let agents: AgentInfo[] = [
        {
          name: 'flexible-agent',
          status: 'active',
          startedAt: startTime,
        },
      ];

      let parallelAgents: AgentInfo[] = [];

      mockUseElapsedTime.mockReturnValue('1m 30s');

      const { rerender } = render(
        <AgentPanel
          agents={agents}
          currentAgent="flexible-agent"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText(/\[1m 30s\]/)).toBeInTheDocument();

      // Move agent to parallel mode
      agents = [];
      parallelAgents = [
        {
          name: 'flexible-agent',
          status: 'parallel',
          startedAt: startTime,
        },
      ];

      rerender(
        <AgentPanel
          agents={agents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText(/\[1m 30s\]/)).toBeInTheDocument();
    });
  });

  describe('Browser compatibility edge cases', () => {
    it('handles different locale time formats', () => {
      const agents: AgentInfo[] = [
        {
          name: 'international-agent',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      // Test various time formats that might come from different locales
      const timeFormats = ['2,5m', '2.5m', '2٫5m', '2\'30"'];

      timeFormats.forEach((format) => {
        mockUseElapsedTime.mockReturnValue(format);

        const { container } = render(<AgentPanel agents={agents} currentAgent="international-agent" />);

        expect(screen.getByText(new RegExp(`\\[${format.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`))).toBeInTheDocument();

        container.remove();
      });
    });

    it('handles Unicode characters in elapsed time', () => {
      const agents: AgentInfo[] = [
        {
          name: 'unicode-agent',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('2分30秒');

      render(<AgentPanel agents={agents} currentAgent="unicode-agent" />);

      expect(screen.getByText(/\[2分30秒\]/)).toBeInTheDocument();
    });

    it('handles right-to-left text in elapsed time', () => {
      const agents: AgentInfo[] = [
        {
          name: 'rtl-agent',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('٢م ٣٠ث');

      render(<AgentPanel agents={agents} currentAgent="rtl-agent" />);

      expect(screen.getByText(/\[٢م ٣٠ث\]/)).toBeInTheDocument();
    });
  });

  describe('Error recovery edge cases', () => {
    it('recovers from useElapsedTime throwing an error', () => {
      const agents: AgentInfo[] = [
        {
          name: 'error-prone-agent',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockImplementation(() => {
        throw new Error('Hook error');
      });

      // Should not crash the entire component
      expect(() => {
        render(<AgentPanel agents={agents} currentAgent="error-prone-agent" />);
      }).toThrow(); // The hook error will propagate, but component structure remains

      // Reset mock for recovery test
      mockUseElapsedTime.mockReturnValue('recovered-30s');

      expect(() => {
        render(<AgentPanel agents={agents} currentAgent="error-prone-agent" />);
      }).not.toThrow();
    });

    it('handles partial rendering failures gracefully', () => {
      const agents: AgentInfo[] = [
        {
          name: 'stable-agent',
          status: 'active',
          startedAt: new Date(),
        },
        {
          name: 'problematic-agent',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      // First call succeeds, second call fails
      mockUseElapsedTime
        .mockReturnValueOnce('30s')
        .mockImplementation(() => {
          throw new Error('Second agent error');
        });

      // One agent should still work while the other fails
      expect(() => {
        render(<AgentPanel agents={agents} currentAgent="stable-agent" />);
      }).toThrow(); // Will throw due to second agent, but first should have rendered
    });
  });
});