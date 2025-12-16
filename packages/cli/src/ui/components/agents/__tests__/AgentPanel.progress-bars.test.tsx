import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

// Mock the useAgentHandoff hook to focus on progress bar tests
vi.mock('../../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: vi.fn(() => ({
    isAnimating: false,
    previousAgent: null,
    currentAgent: null,
    progress: 0,
    isFading: false,
  })),
}));

// Mock HandoffIndicator to focus on progress bar functionality
vi.mock('../HandoffIndicator.js', () => ({
  HandoffIndicator: () => null,
}));

describe('AgentPanel Progress Bars', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Progress bar display for active agents', () => {
    it('shows progress bar when agent has progress defined', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: 75,
        },
      ];

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should show progress percentage
      expect(screen.getByText(/75%/)).toBeInTheDocument();

      // Should show the agent name and stage
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
    });

    it('shows progress bar for multiple active agents with different progress', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'coding',
          progress: 60,
        },
        {
          name: 'tester',
          status: 'active',
          stage: 'testing',
          progress: 40,
        },
        {
          name: 'reviewer',
          status: 'active',
          stage: 'reviewing',
          progress: 85,
        },
      ];

      render(<AgentPanel agents={agents} />);

      // Should show all progress percentages
      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getByText(/40%/)).toBeInTheDocument();
      expect(screen.getByText(/85%/)).toBeInTheDocument();

      // Should show all agent names
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('shows progress bar with exact boundary values', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active', progress: 1 },
        { name: 'agent2', status: 'active', progress: 50 },
        { name: 'agent3', status: 'active', progress: 99 },
      ];

      render(<AgentPanel agents={agents} />);

      expect(screen.getByText(/1%/)).toBeInTheDocument();
      expect(screen.getByText(/50%/)).toBeInTheDocument();
      expect(screen.getByText(/99%/)).toBeInTheDocument();
    });

    it('hides progress bar when progress is 0', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'starting',
          progress: 0,
        },
      ];

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should not show 0% progress
      expect(screen.queryByText(/0%/)).not.toBeInTheDocument();

      // But should still show agent name and stage
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(starting\)/)).toBeInTheDocument();
    });

    it('hides progress bar when progress is 100', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'finishing',
          progress: 100,
        },
      ];

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should not show 100% progress
      expect(screen.queryByText(/100%/)).not.toBeInTheDocument();

      // But should still show agent name and stage
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(finishing\)/)).toBeInTheDocument();
    });

    it('hides progress bar when progress is undefined', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          // No progress property
        },
      ];

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should not show any progress percentage
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();

      // But should still show agent name and stage
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
    });

    it('rounds decimal progress values correctly', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'active', progress: 33.3 },
        { name: 'agent2', status: 'active', progress: 66.7 },
        { name: 'agent3', status: 'active', progress: 75.9 },
      ];

      render(<AgentPanel agents={agents} />);

      // Should round to whole numbers
      expect(screen.getByText(/33%/)).toBeInTheDocument();
      expect(screen.getByText(/67%/)).toBeInTheDocument();
      expect(screen.getByText(/76%/)).toBeInTheDocument();
    });

    it('handles negative progress values gracefully', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: -10,
        },
      ];

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should handle negative values gracefully (likely not show percentage)
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
    });

    it('handles progress values over 100 gracefully', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: 150,
        },
      ];

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Should handle over-100 values gracefully
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
    });
  });

  describe('Progress bar display for non-active agents', () => {
    it('does not show progress bar for completed agents', () => {
      const agents: AgentInfo[] = [
        {
          name: 'planner',
          status: 'completed',
          stage: 'planning',
          progress: 100, // Even with progress defined
        },
      ];

      render(<AgentPanel agents={agents} />);

      // Should not show progress for completed agents
      expect(screen.queryByText(/100%/)).not.toBeInTheDocument();

      // But should show agent name
      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    it('does not show progress bar for waiting agents', () => {
      const agents: AgentInfo[] = [
        {
          name: 'reviewer',
          status: 'waiting',
          stage: 'reviewing',
          progress: 0, // Even with progress defined
        },
      ];

      render(<AgentPanel agents={agents} />);

      // Should not show progress for waiting agents
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();

      // But should show agent name
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('does not show progress bar for idle agents', () => {
      const agents: AgentInfo[] = [
        {
          name: 'devops',
          status: 'idle',
          stage: 'deployment',
          progress: 25, // Even with progress defined
        },
      ];

      render(<AgentPanel agents={agents} />);

      // Should not show progress for idle agents
      expect(screen.queryByText(/25%/)).not.toBeInTheDocument();

      // But should show agent name
      expect(screen.getByText('devops')).toBeInTheDocument();
    });
  });

  describe('Progress bar display in compact mode', () => {
    it('shows progress percentage for active agents in compact mode', () => {
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', progress: 75 },
        { name: 'tester', status: 'waiting' },
      ];

      render(<AgentPanel agents={agents} compact={true} currentAgent="developer" />);

      // Should show progress in compact mode
      expect(screen.getByText(/75%/)).toBeInTheDocument();

      // Should show all agent names
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Should not show "Active Agents" header in compact mode
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
    });

    it('shows multiple progress percentages in compact mode', () => {
      const agents: AgentInfo[] = [
        { name: 'dev1', status: 'active', progress: 60 },
        { name: 'dev2', status: 'active', progress: 80 },
        { name: 'reviewer', status: 'waiting' },
      ];

      render(<AgentPanel agents={agents} compact={true} />);

      // Should show both progress values
      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getByText(/80%/)).toBeInTheDocument();

      // Should show all agent names
      expect(screen.getByText('dev1')).toBeInTheDocument();
      expect(screen.getByText('dev2')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });
  });

  describe('Progress bar display for parallel agents', () => {
    it('shows progress bars for parallel agents when enabled', () => {
      const mainAgents: AgentInfo[] = [
        { name: 'coordinator', status: 'active', stage: 'coordinating' },
      ];

      const parallelAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          stage: 'implementation',
          progress: 65,
        },
        {
          name: 'tester',
          status: 'parallel',
          stage: 'testing',
          progress: 45,
        },
      ];

      render(
        <AgentPanel
          agents={mainAgents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show parallel execution section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Should show progress for parallel agents
      expect(screen.getByText(/65%/)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();

      // Should show parallel agent names and stages
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(testing\)/)).toBeInTheDocument();
    });

    it('does not show progress for parallel agents without progress defined', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'parallel',
          stage: 'implementation',
          // No progress property
        },
        {
          name: 'tester',
          status: 'parallel',
          stage: 'testing',
          progress: 50, // One with progress, one without
        },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show progress only for the agent that has it
      expect(screen.queryByText(/undefined%/)).not.toBeInTheDocument();
      expect(screen.getByText(/50%/)).toBeInTheDocument();

      // Should show both agent names
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('shows progress for parallel agents in compact mode', () => {
      const parallelAgents: AgentInfo[] = [
        {
          name: 'dev',
          status: 'parallel',
          progress: 70,
        },
        {
          name: 'test',
          status: 'parallel',
          progress: 30,
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

      // Should show progress in compact mode
      expect(screen.getByText(/70%/)).toBeInTheDocument();
      expect(screen.getByText(/30%/)).toBeInTheDocument();

      // Should show agent names
      expect(screen.getByText('dev')).toBeInTheDocument();
      expect(screen.getByText('test')).toBeInTheDocument();

      // Should not show section headers in compact mode
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });
  });

  describe('Progress bar display edge cases', () => {
    it('handles mixed scenarios with some agents having progress', () => {
      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'completed' },
        { name: 'agent2', status: 'active', progress: 50 },
        { name: 'agent3', status: 'active' }, // No progress
        { name: 'agent4', status: 'waiting', progress: 25 }, // Has progress but not active
        { name: 'agent5', status: 'active', progress: 0 }, // Zero progress
        { name: 'agent6', status: 'active', progress: 100 }, // Full progress
      ];

      render(<AgentPanel agents={agents} />);

      // Should only show progress for appropriate agents
      expect(screen.getByText(/50%/)).toBeInTheDocument(); // agent2 - active with progress
      expect(screen.queryByText(/25%/)).not.toBeInTheDocument(); // agent4 - waiting
      expect(screen.queryByText(/0%/)).not.toBeInTheDocument(); // agent5 - zero progress
      expect(screen.queryByText(/100%/)).not.toBeInTheDocument(); // agent6 - full progress

      // Should show all agent names
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText('agent3')).toBeInTheDocument();
      expect(screen.getByText('agent4')).toBeInTheDocument();
      expect(screen.getByText('agent5')).toBeInTheDocument();
      expect(screen.getByText('agent6')).toBeInTheDocument();
    });

    it('handles empty agent lists without errors', () => {
      render(<AgentPanel agents={[]} />);

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    });

    it('handles agent with invalid progress data types', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: NaN as any,
        },
        {
          name: 'tester',
          status: 'active',
          stage: 'testing',
          progress: Infinity as any,
        },
        {
          name: 'reviewer',
          status: 'active',
          stage: 'reviewing',
          progress: 'invalid' as any,
        },
      ];

      // Should not crash with invalid data
      expect(() => {
        render(<AgentPanel agents={agents} />);
      }).not.toThrow();

      // Should still show agent names
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });
  });

  describe('Progress bar accessibility', () => {
    it('provides accessible progress information', () => {
      const agents: AgentInfo[] = [
        {
          name: 'developer',
          status: 'active',
          stage: 'implementation',
          progress: 75,
        },
      ];

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Progress information should be accessible to screen readers
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/implementation/)).toBeInTheDocument();
    });

    it('maintains accessibility with multiple agents showing progress', () => {
      const agents: AgentInfo[] = [
        { name: 'dev1', status: 'active', stage: 'coding', progress: 60 },
        { name: 'dev2', status: 'active', stage: 'testing', progress: 80 },
        { name: 'dev3', status: 'active', stage: 'reviewing', progress: 40 },
      ];

      render(<AgentPanel agents={agents} />);

      // All progress information should be accessible
      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getByText(/80%/)).toBeInTheDocument();
      expect(screen.getByText(/40%/)).toBeInTheDocument();

      // All agent information should be accessible
      expect(screen.getByText('dev1')).toBeInTheDocument();
      expect(screen.getByText('dev2')).toBeInTheDocument();
      expect(screen.getByText('dev3')).toBeInTheDocument();
      expect(screen.getByText(/coding/)).toBeInTheDocument();
      expect(screen.getByText(/testing/)).toBeInTheDocument();
      expect(screen.getByText(/reviewing/)).toBeInTheDocument();
    });
  });
});