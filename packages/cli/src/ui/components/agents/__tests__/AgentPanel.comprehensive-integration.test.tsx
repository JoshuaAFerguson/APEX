import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

/**
 * Comprehensive integration test for AgentPanel with handoff animations and parallel execution
 * This test validates the complete integration of all features working together
 */
describe('AgentPanel - Comprehensive Integration Tests', () => {
  // Mock hooks
  const mockUseElapsedTime = vi.fn();
  const mockUseAgentHandoff = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();

    // Mock useElapsedTime
    vi.doMock('../../hooks/useElapsedTime.js', () => ({
      useElapsedTime: mockUseElapsedTime,
    }));

    // Mock useAgentHandoff
    vi.doMock('../../hooks/useAgentHandoff.js', () => ({
      useAgentHandoff: mockUseAgentHandoff,
    }));

    // Default mock implementations
    mockUseElapsedTime.mockReturnValue('2m 30s');
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

  describe('Handoff Animation Integration', () => {
    it('integrates handoff animations with main agent workflow', () => {
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', stage: 'implementation', startedAt: new Date() },
        { name: 'tester', status: 'waiting' },
      ];

      // Mock active handoff animation
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.65,
        isFading: false,
      });

      render(<AgentPanel agents={agents} currentAgent="developer" />);

      // Verify main agent display
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Verify handoff hook is called
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');

      // Verify elapsed time integration
      expect(mockUseElapsedTime).toHaveBeenCalled();
      expect(screen.getByText(/2m 30s/)).toBeInTheDocument();
    });

    it('handles handoff animation in compact mode', () => {
      const agents: AgentInfo[] = [
        { name: 'architect', status: 'completed' },
        { name: 'developer', status: 'active', startedAt: new Date() },
      ];

      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'developer',
        progress: 0.8,
        isFading: true,
      });

      render(<AgentPanel agents={agents} currentAgent="developer" compact={true} />);

      // In compact mode, should not show "Active Agents" header
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();

      // Should show agents with separators
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('│')).toBeInTheDocument();

      // Handoff hook should still be called
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
    });
  });

  describe('Parallel Execution Integration', () => {
    it('displays parallel execution section with main workflow', () => {
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', stage: 'implementation' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', stage: 'writing-tests', progress: 75, startedAt: new Date() },
        { name: 'reviewer', status: 'parallel', stage: 'code-review', progress: 60, startedAt: new Date() },
      ];

      render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Main workflow
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Parallel execution section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText(/\(writing-tests\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(code-review\)/)).toBeInTheDocument();

      // Progress should be displayed
      expect(screen.getByText(/75%/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();

      // Elapsed time should be called for parallel agents
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(3); // developer + 2 parallel agents
    });

    it('shows parallel agents in compact mode with timing', () => {
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active' },
        { name: 'tester', status: 'waiting' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'reviewer', status: 'parallel', startedAt: new Date() },
        { name: 'devops', status: 'parallel', progress: 45, startedAt: new Date() },
      ];

      mockUseElapsedTime
        .mockReturnValueOnce('0s') // developer (no startedAt)
        .mockReturnValueOnce('1m 15s') // reviewer
        .mockReturnValueOnce('45s'); // devops

      render(
        <AgentPanel
          agents={agents}
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Main agents in compact format
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Parallel section in compact mode
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();

      // Timing displays
      expect(screen.getByText(/1m 15s/)).toBeInTheDocument();
      expect(screen.getByText(/45s/)).toBeInTheDocument();
    });
  });

  describe('Combined Features Integration', () => {
    it('handles handoff animation with parallel execution simultaneously', () => {
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', stage: 'implementation' },
        { name: 'tester', status: 'waiting' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'reviewer', status: 'parallel', stage: 'review' },
        { name: 'devops', status: 'parallel', stage: 'deployment-prep' },
      ];

      // Active handoff animation
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'planner',
        currentAgent: 'developer',
        progress: 0.4,
        isFading: false,
      });

      render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Main workflow should be visible
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Parallel execution should be visible
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();

      // Handoff should be active
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');

      // Both features should coexist without interference
      expect(screen.getByText(/\(implementation\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(review\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(deployment-prep\)/)).toBeInTheDocument();
    });

    it('maintains consistent color scheme across all components', () => {
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active' },
        { name: 'tester', status: 'parallel' }, // parallel status in main list
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'reviewer', status: 'parallel' },
        { name: 'devops', status: 'parallel' },
      ];

      render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Check parallel status icons are present
      const parallelIcons = screen.getAllByText('⟂');
      expect(parallelIcons.length).toBeGreaterThan(0);

      // Verify parallel agents are displayed
      expect(screen.getByText('tester')).toBeInTheDocument(); // in main list with parallel status
      expect(screen.getByText('reviewer')).toBeInTheDocument(); // in parallel section
      expect(screen.getByText('devops')).toBeInTheDocument(); // in parallel section
    });
  });

  describe('Performance and Edge Cases', () => {
    it('handles large number of agents efficiently', () => {
      const agents: AgentInfo[] = Array.from({ length: 10 }, (_, i) => ({
        name: `agent-${i}`,
        status: i === 5 ? 'active' : 'waiting' as const,
        stage: `stage-${i}`,
        progress: i * 10,
      }));

      const parallelAgents: AgentInfo[] = Array.from({ length: 8 }, (_, i) => ({
        name: `parallel-agent-${i}`,
        status: 'parallel' as const,
        stage: `parallel-stage-${i}`,
        progress: i * 12.5,
        startedAt: new Date(),
      }));

      mockUseElapsedTime.mockReturnValue('30s');

      render(
        <AgentPanel
          agents={agents}
          currentAgent="agent-5"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should render all main agents
      agents.forEach(agent => {
        expect(screen.getByText(agent.name)).toBeInTheDocument();
      });

      // Should render parallel section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Should render all parallel agents
      parallelAgents.forEach(agent => {
        expect(screen.getByText(agent.name)).toBeInTheDocument();
      });

      // ElapsedTime should be called for each parallel agent with startedAt
      expect(mockUseElapsedTime).toHaveBeenCalledTimes(8);
    });

    it('gracefully handles rapid state changes', () => {
      const { rerender } = render(<AgentPanel agents={[]} />);

      // Rapid changes
      const states = [
        { agents: [{ name: 'agent1', status: 'active' as const }], currentAgent: 'agent1' },
        { agents: [{ name: 'agent2', status: 'active' as const }], currentAgent: 'agent2' },
        { agents: [{ name: 'agent3', status: 'active' as const }], currentAgent: 'agent3' },
      ];

      states.forEach(state => {
        rerender(<AgentPanel {...state} />);
        expect(screen.getByText(state.agents[0].name)).toBeInTheDocument();
        expect(mockUseAgentHandoff).toHaveBeenCalledWith(state.currentAgent);
      });
    });

    it('handles empty states gracefully', () => {
      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={[]}
        />
      );

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(mockUseAgentHandoff).toHaveBeenCalledWith(undefined);
    });

    it('maintains accessibility with complex state', () => {
      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active', stage: 'coding', progress: 85, startedAt: new Date() },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 60, startedAt: new Date() },
      ];

      mockUseElapsedTime.mockReturnValue('5m 30s');

      render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // All text content should be accessible
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText(/\(coding\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/85%/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getAllByText(/5m 30s/)).toHaveLength(2); // Both agents with timing
    });
  });

  describe('Error Boundary and Resilience', () => {
    it('handles malformed agent data gracefully', () => {
      const malformedAgents: any[] = [
        { name: 'valid-agent', status: 'active' },
        { name: null, status: 'waiting' }, // invalid name
        { status: 'completed' }, // missing name
        { name: 'another-valid', status: 'invalid-status' }, // invalid status
      ];

      // Should not crash with malformed data
      render(<AgentPanel agents={malformedAgents} />);

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('valid-agent')).toBeInTheDocument();
      expect(screen.getByText('another-valid')).toBeInTheDocument();
    });

    it('handles hook failures gracefully', () => {
      // Mock hook to throw error
      mockUseElapsedTime.mockImplementation(() => {
        throw new Error('Hook error');
      });

      const agents: AgentInfo[] = [
        { name: 'developer', status: 'active', startedAt: new Date() },
      ];

      // Should render basic structure even if hooks fail
      expect(() => {
        render(<AgentPanel agents={agents} currentAgent="developer" />);
      }).not.toThrow();
    });
  });
});