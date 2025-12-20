import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock the useElapsedTime hook for visual formatting tests
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

// Mock HandoffIndicator to focus on elapsed time display
vi.mock('../HandoffIndicator.js', () => ({
  HandoffIndicator: () => null,
}));

describe('AgentRow Elapsed Time Visual Display Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseElapsedTime.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Elapsed time formatting in full panel mode', () => {
    it('displays seconds format correctly', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('42s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Check that elapsed time is displayed with brackets and gray dimmed color
      const elapsedElement = screen.getByText(/\[42s\]/);
      expect(elapsedElement).toBeInTheDocument();
    });

    it('displays minutes and seconds format correctly', () => {
      const agents: AgentInfo[] = [
        {
          name: 'architect',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('2m 30s');

      render(<AgentPanel agents={agents} currentAgent="architect" />);

      const elapsedElement = screen.getByText(/\[2m 30s\]/);
      expect(elapsedElement).toBeInTheDocument();
    });

    it('displays hours and minutes format correctly', () => {
      const agents: AgentInfo[] = [
        {
          name: 'reviewer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('1h 15m');

      render(<AgentPanel agents={agents} currentAgent="reviewer" />);

      const elapsedElement = screen.getByText(/\[1h 15m\]/);
      expect(elapsedElement).toBeInTheDocument();
    });

    it('displays hours only format correctly', () => {
      const agents: AgentInfo[] = [
        {
          name: 'tester',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('3h');

      render(<AgentPanel agents={agents} currentAgent="tester" />);

      const elapsedElement = screen.getByText(/\[3h\]/);
      expect(elapsedElement).toBeInTheDocument();
    });

    it('displays minutes only format correctly', () => {
      const agents: AgentInfo[] = [
        {
          name: 'devops',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('5m');

      render(<AgentPanel agents={agents} currentAgent="devops" />);

      const elapsedElement = screen.getByText(/\[5m\]/);
      expect(elapsedElement).toBeInTheDocument();
    });
  });

  describe('Elapsed time positioning in full panel mode', () => {
    it('displays elapsed time after agent name and stage', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('45s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Agent name should come first
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Stage should be in parentheses
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();

      // Elapsed time should be in brackets
      expect(screen.getByText(/\[45s\]/)).toBeInTheDocument();
    });

    it('displays elapsed time after agent name, stage, and progress', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: 75,
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('2m 15s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/\[2m 15s\]/)).toBeInTheDocument();
    });

    it('displays elapsed time with only agent name when no stage or progress', () => {
      const agents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('1m 30s');

      render(<AgentPanel agents={agents} currentAgent="planner" />);

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText(/\[1m 30s\]/)).toBeInTheDocument();
      // Should not show stage or progress
      expect(screen.queryByText(/\(/)).toBeInTheDocument(); // Only the elapsed time brackets
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });
  });

  describe('Elapsed time formatting in compact mode', () => {
    it('displays elapsed time inline with agent name in compact mode', () => {
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', startedAt: new Date() },
        { name: 'tester', status: 'waiting' },
      ];

      mockUseElapsedTime.mockImplementation((time) => time ? '1m 45s' : '0s');

      render(<AgentPanel agents={agents} currentAgent="developer" compact={true} />);

      // Should show developer with elapsed time attached
      expect(screen.getByText(/developer\[1m 45s\]/)).toBeInTheDocument();

      // Other agents should not show elapsed time
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.queryByText(/planner\[.*\]/)).not.toBeInTheDocument();
      expect(screen.queryByText(/tester\[.*\]/)).not.toBeInTheDocument();
    });

    it('shows separators between agents in compact mode', () => {
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', startedAt: new Date() },
        { name: 'tester', status: 'waiting' },
      ];

      mockUseElapsedTime.mockImplementation((time) => time ? '30s' : '0s');

      render(<AgentPanel agents={agents} currentAgent="developer" compact={true} />);

      // Should show pipe separators between agents
      expect(screen.getAllByText('│')).toHaveLength(2); // Between 3 agents = 2 separators

      // Elapsed time should be part of the agent display
      expect(screen.getByText(/developer\[30s\]/)).toBeInTheDocument();
    });

    it('handles multiple active agents with different elapsed times in compact mode', () => {
      const startTime1 = new Date('2023-01-01T10:00:00Z');
      const startTime2 = new Date('2023-01-01T10:01:00Z');

      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active', startedAt: startTime1 },
        { name: 'tester', status: 'active', startedAt: startTime2 },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        if (time === startTime1) return '2m 30s';
        if (time === startTime2) return '1m 30s';
        return '0s';
      });

      render(<AgentPanel agents={agents} currentAgent="developer" compact={true} />);

      expect(screen.getByText(/developer\[2m 30s\]/)).toBeInTheDocument();
      expect(screen.getByText(/tester\[1m 30s\]/)).toBeInTheDocument();
    });
  });

  describe('Parallel execution elapsed time visual display', () => {
    it('displays elapsed times for parallel agents in dedicated section', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          stage: 'coding',
          startedAt: new Date(),
        },
        {
          name: 'tester',
          status: 'parallel',
          stage: 'testing',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('3m 45s');

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show parallel execution header
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Should show both agents with elapsed times
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText(/\(coding\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(testing\)/)).toBeInTheDocument();
      expect(screen.getAllByText(/\[3m 45s\]/)).toHaveLength(2);
    });

    it('displays parallel agents with different elapsed times', () => {
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
        if (time === startTime1) return '4m 20s';
        if (time === startTime2) return '2m 20s';
        return '0s';
      });

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      expect(screen.getByText(/\[4m 20s\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[2m 20s\]/)).toBeInTheDocument();
    });

    it('displays parallel agents in compact mode with elapsed times', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          startedAt: new Date(),
        },
        {
          name: 'tester',
          status: 'parallel',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('1m 15s');

      render(
        <AgentPanel
          agents={[]}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show parallel indicator and agents with elapsed times
      expect(screen.getByText(/⟂/)).toBeInTheDocument();
      expect(screen.getByText(/developer\[1m 15s\]/)).toBeInTheDocument();
      expect(screen.getByText(/tester\[1m 15s\]/)).toBeInTheDocument();
    });
  });

  describe('Visual hierarchy and readability', () => {
    it('shows status icon, agent name, stage, progress, and elapsed time in correct order', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: 85,
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('5m 42s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // All elements should be present
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // status icon
      expect(screen.getByText('developer')).toBeInTheDocument(); // agent name
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument(); // stage
      expect(screen.getByText(/85%/)).toBeInTheDocument(); // progress
      expect(screen.getByText(/\[5m 42s\]/)).toBeInTheDocument(); // elapsed time
    });

    it('maintains visual consistency across different elapsed time formats', () => {
      const timeFormats = ['5s', '1m 30s', '2h 15m', '24h'];

      timeFormats.forEach((timeFormat, index) => {
        const agents: AgentInfo[] = [
          {
            name: `agent${index}`,
            status: 'active',
            startedAt: new Date(),
          },
        ];

        mockUseElapsedTime.mockReturnValue(timeFormat);

        const { container } = render(<AgentPanel agents={agents} currentAgent={`agent${index}`} />);

        // Each format should be displayed in brackets
        expect(screen.getByText(new RegExp(`\\[${timeFormat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]`))).toBeInTheDocument();

        // Clean up for next iteration
        container.remove();
      });
    });

    it('handles very long elapsed times gracefully', () => {
      const agents: AgentInfo[] = [
        {
          name: 'long-running-agent',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('999h 59m');

      render(<AgentPanel agents={agents} currentAgent="long-running-agent" />);

      expect(screen.getByText(/\[999h 59m\]/)).toBeInTheDocument();
      expect(screen.getByText('long-running-agent')).toBeInTheDocument();
    });

    it('handles zero-second elapsed time display', () => {
      const agents: AgentInfo[] = [
        {
          name: 'just-started-agent',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('0s');

      render(<AgentPanel agents={agents} currentAgent="just-started-agent" />);

      expect(screen.getByText(/\[0s\]/)).toBeInTheDocument();
    });
  });

  describe('Color and styling consistency', () => {
    it('applies correct color to elapsed time display for active agent', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('1m 30s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // The elapsed time should be displayed with gray dimmed color
      const elapsedElement = screen.getByText(/\[1m 30s\]/);
      expect(elapsedElement).toBeInTheDocument();
    });

    it('applies consistent styling for parallel agents elapsed time', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('45s');

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Parallel agents should also display elapsed time with consistent styling
      const elapsedElement = screen.getByText(/\[45s\]/);
      expect(elapsedElement).toBeInTheDocument();
    });

    it('maintains color consistency in compact mode', () => {
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active', startedAt: new Date() },
      ];

      mockUseElapsedTime.mockReturnValue('2m');

      render(<AgentPanel agents={agents} currentAgent="developer" compact={true} />);

      // Elapsed time should be part of the agent display with consistent formatting
      expect(screen.getByText(/developer\[2m\]/)).toBeInTheDocument();
    });
  });

  describe('Accessibility and screen reader support', () => {
    it('provides accessible text for elapsed time information', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('3m 20s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // The elapsed time should be part of accessible text content
      expect(screen.getByText(/\[3m 20s\]/)).toBeInTheDocument();
    });

    it('maintains accessible structure with all agent information', () => {
      const agents: AgentInfo[] = [
        {
          name: 'comprehensive-agent',
          status: 'active',
          stage: 'working',
          progress: 60,
          startedAt: new Date(),
        },
      ];

      mockUseElapsedTime.mockReturnValue('4m 15s');

      render(<AgentPanel agents={agents} currentAgent="comprehensive-agent" />);

      // All information should be accessible
      expect(screen.getByText('comprehensive-agent')).toBeInTheDocument();
      expect(screen.getByText(/\(working\)/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getByText(/\[4m 15s\]/)).toBeInTheDocument();
    });
  });
});