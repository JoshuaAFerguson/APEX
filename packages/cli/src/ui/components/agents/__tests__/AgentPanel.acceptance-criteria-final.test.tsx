import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock the useElapsedTime hook
const mockUseElapsedTime = vi.fn();

vi.mock('../../../hooks/useElapsedTime.js', () => ({
  useElapsedTime: mockUseElapsedTime,
}));

// Mock the useAgentHandoff hook to focus on acceptance criteria
vi.mock('../../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: vi.fn(() => ({
    isAnimating: false,
    previousAgent: null,
    currentAgent: null,
    progress: 0,
    isFading: false,
  })),
}));

// Mock HandoffIndicator to focus on core functionality
vi.mock('../HandoffIndicator.js', () => ({
  HandoffIndicator: () => null,
}));

describe('AgentPanel - Final Acceptance Criteria Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseElapsedTime.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('AC1: Active agents show progress bar when progress is defined', () => {
    it('shows progress bar for active agents with progress defined', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: 75,
        },
        {
          name: 'tester',
          status: 'active',
          stage: 'testing',
          progress: 50,
        },
      ];

      render(<AgentPanel agents={agents} />);

      // ✅ AC1: Progress bars are shown for active agents
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/50%/)).toBeInTheDocument();

      // Verify agents are shown
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('shows progress bar for parallel agents when enabled', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'parallel-dev',
          status: 'parallel',
          stage: 'parallel-implementation',
          progress: 70,
        },
        {
          name: 'parallel-test',
          status: 'parallel',
          stage: 'parallel-testing',
          progress: 45,
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // ✅ AC1: Progress bars work for parallel agents
      expect(screen.getByText(/70%/)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('parallel-dev')).toBeInTheDocument();
      expect(screen.getByText('parallel-test')).toBeInTheDocument();
    });
  });

  describe('AC2: Elapsed time shown for active agents with startedAt timestamp', () => {
    it('shows elapsed time for active agent with startedAt', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('3m 45s');

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // ✅ AC2: Elapsed time is shown for active agents with startedAt
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
      expect(screen.getByText(/\[3m 45s\]/)).toBeInTheDocument();

      // Agent information is also shown
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
    });

    it('shows elapsed time for parallel agents with startedAt', () => {
      const startTime1 = new Date('2023-01-01T10:00:00Z');
      const startTime2 = new Date('2023-01-01T10:01:00Z');

      const parallelAgents: AgentInfo[] = [
        {
          name: 'parallel-dev',
          status: 'parallel',
          startedAt: startTime1,
        },
        {
          name: 'parallel-test',
          status: 'parallel',
          startedAt: startTime2,
        },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        if (time === startTime1) return '6m 30s';
        if (time === startTime2) return '5m 30s';
        return '0s';
      });

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // ✅ AC2: Elapsed time works for parallel agents
      expect(screen.getByText(/\[6m 30s\]/)).toBeInTheDocument();
      expect(screen.getByText(/\[5m 30s\]/)).toBeInTheDocument();
      expect(screen.getByText('parallel-dev')).toBeInTheDocument();
      expect(screen.getByText('parallel-test')).toBeInTheDocument();
    });
  });

  describe('AC3: AgentInfo interface extended with startedAt optional field', () => {
    it('accepts AgentInfo objects with startedAt field', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');

      // ✅ AC3: TypeScript should accept startedAt field
      const agentWithStartedAt: AgentInfo = {
        name: 'test-agent',
        status: 'active',
        stage: 'testing',
        progress: 50,
        startedAt: startTime, // This should not cause TypeScript errors
      };

      const agents: AgentInfo[] = [agentWithStartedAt];

      render(<AgentPanel agents={agents} />);

      expect(screen.getByText('test-agent')).toBeInTheDocument();
    });

    it('accepts AgentInfo objects without startedAt field', () => {
      // ✅ AC3: startedAt should be optional
      const agentWithoutStartedAt: AgentInfo = {
        name: 'no-timestamp-agent',
        status: 'active',
        stage: 'working',
        progress: 75,
        // No startedAt field - should be optional
      };

      const agents: AgentInfo[] = [agentWithoutStartedAt];

      render(<AgentPanel agents={agents} />);

      expect(screen.getByText('no-timestamp-agent')).toBeInTheDocument();
    });
  });

  describe('AC4: Tests cover progress bar and elapsed time display', () => {
    it('validates complete integration of progress bars and elapsed time', () => {
      const startTime = new Date('2023-01-01T10:00:00Z');
      const agents: AgentInfo[] = [
        {
          name: 'full-featured-agent',
          status: 'active',
          stage: 'implementation',
          progress: 65,
          startedAt: startTime,
        },
      ];

      mockUseElapsedTime.mockReturnValue('4m 20s');

      render(<AgentPanel agents={agents} currentAgent="full-featured-agent" />);

      // ✅ AC4: Both progress bar and elapsed time are tested together
      expect(screen.getByText('full-featured-agent')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
      expect(screen.getByText(/65%/)).toBeInTheDocument(); // Progress bar
      expect(screen.getByText(/\[4m 20s\]/)).toBeInTheDocument(); // Elapsed time

      // Verify hook was called correctly
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime);
    });

    it('validates comprehensive scenario with all acceptance criteria', () => {
      const startTime1 = new Date('2023-01-01T10:00:00Z');
      const startTime2 = new Date('2023-01-01T10:05:00Z');
      const startTime3 = new Date('2023-01-01T10:10:00Z');

      // Main workflow agents
      const mainAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed', stage: 'planning' },
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: 65, // ✅ AC1: Progress bar shown
          startedAt: startTime1, // ✅ AC2: Elapsed time shown
        },
        { name: 'reviewer', status: 'waiting', stage: 'review' },
      ];

      // Parallel execution agents
      const parallelAgents: AgentInfo[] = [
        {
          name: 'tester',
          status: 'parallel',
          stage: 'testing',
          progress: 40, // ✅ AC1: Progress for parallel agents
          startedAt: startTime2, // ✅ AC2: Elapsed time for parallel agents
        },
        {
          name: 'deployer',
          status: 'parallel',
          stage: 'deployment',
          progress: 80, // ✅ AC1
          startedAt: startTime3, // ✅ AC2
        },
      ];

      mockUseElapsedTime.mockImplementation((time) => {
        if (time === startTime1) return '10m 30s';
        if (time === startTime2) return '5m 15s';
        if (time === startTime3) return '2m 45s';
        return '0s';
      });

      render(
        <AgentPanel
          agents={mainAgents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // ✅ Validate all acceptance criteria together

      // AC1: Progress bars for active agents
      expect(screen.getByText(/65%/)).toBeInTheDocument(); // Main active agent
      expect(screen.getByText(/40%/)).toBeInTheDocument(); // Parallel agent 1
      expect(screen.getByText(/80%/)).toBeInTheDocument(); // Parallel agent 2

      // No progress for non-active agents
      expect(screen.queryByText(/planner.*%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/reviewer.*%/)).not.toBeInTheDocument();

      // AC2: Elapsed time for active agents with startedAt
      expect(screen.getByText(/\[10m 30s\]/)).toBeInTheDocument(); // Main active agent
      expect(screen.getByText(/\[5m 15s\]/)).toBeInTheDocument(); // Parallel agent 1
      expect(screen.getByText(/\[2m 45s\]/)).toBeInTheDocument(); // Parallel agent 2

      // Verify useElapsedTime calls
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime1); // developer
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null); // planner (completed)
      expect(mockUseElapsedTime).toHaveBeenCalledWith(null); // reviewer (waiting)
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime2); // tester (parallel)
      expect(mockUseElapsedTime).toHaveBeenCalledWith(startTime3); // deployer (parallel)

      // AC3: AgentInfo interface supports startedAt
      // (Validated by TypeScript compilation and runtime behavior)

      // AC4: Test coverage for both features
      // (Validated by this comprehensive test)

      // Additional validation: All agents and sections are displayed
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('deployer')).toBeInTheDocument();

      // Stage information is displayed
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(deployment\)/)).toBeInTheDocument();
    });
  });
});