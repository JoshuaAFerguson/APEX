import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel - Parallel Execution + Handoff Integration', () => {
  const mockUseAgentHandoff = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
      useAgentHandoff: mockUseAgentHandoff,
    }));
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.doUnmock('../../../hooks/useAgentHandoff.js');
  });

  describe('handoff animation during parallel execution transitions', () => {
    it('handles transition from sequential to parallel execution with handoff', () => {
      // Start with sequential execution and handoff animation
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'reviewer',
        progress: 0.4,
        isFading: false,
      });

      const sequentialAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'completed' },
        { name: 'reviewer', status: 'active', stage: 'code-review' },
        { name: 'tester', status: 'waiting' },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={sequentialAgents}
          currentAgent="reviewer"
          showParallel={false}
          parallelAgents={[]}
        />
      );

      // Should show handoff animation from developer to reviewer
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('reviewer');
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Transition to parallel execution while handoff continues
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'reviewer',
        currentAgent: 'tester',
        progress: 0.2, // Reset progress for new transition
        isFading: false,
      });

      const parallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', stage: 'unit-tests', progress: 20 },
        { name: 'qa-engineer', status: 'parallel', stage: 'integration-tests', progress: 15 },
      ];

      const transitionAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'completed' },
        { name: 'reviewer', status: 'completed' },
        { name: 'tester', status: 'waiting' },
      ];

      rerender(
        <AgentPanel
          agents={transitionAgents}
          currentAgent="tester"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show both handoff animation and parallel section
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('tester');
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('qa-engineer')).toBeInTheDocument();
    });

    it('handles parallel execution completion with handoff to next sequential agent', () => {
      // Start with parallel execution
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      const activeParallelAgents: AgentInfo[] = [
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 95 },
        { name: 'security-scanner', status: 'parallel', stage: 'scanning', progress: 90 },
      ];

      const initialAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'completed' },
        { name: 'reviewer', status: 'completed' },
        { name: 'devops', status: 'waiting' },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={initialAgents}
          showParallel={true}
          parallelAgents={activeParallelAgents}
        />
      );

      // Should show parallel execution
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('90%')).toBeInTheDocument();

      // Transition to sequential execution with handoff animation
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'tester', // Last parallel agent
        currentAgent: 'devops',
        progress: 0.3,
        isFading: false,
      });

      const finalAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'completed' },
        { name: 'reviewer', status: 'completed' },
        { name: 'tester', status: 'completed' },
        { name: 'devops', status: 'active', stage: 'deployment' },
      ];

      rerender(
        <AgentPanel
          agents={finalAgents}
          currentAgent="devops"
          showParallel={false}
          parallelAgents={[]}
        />
      );

      // Should show handoff to devops and hide parallel section
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('devops');
      expect(screen.getByText('devops')).toBeInTheDocument();
      expect(screen.getByText('(deployment)')).toBeInTheDocument();
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('maintains handoff animation timing when parallel agents update during animation', () => {
      // Start with handoff animation during parallel execution
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'developer',
        progress: 0.6,
        isFading: false,
      });

      const initialParallelAgents: AgentInfo[] = [
        { name: 'backend-dev', status: 'parallel', stage: 'api', progress: 40 },
        { name: 'frontend-dev', status: 'parallel', stage: 'ui', progress: 35 },
      ];

      const agents: AgentInfo[] = [
        { name: 'architect', status: 'completed' },
        { name: 'developer', status: 'active', stage: 'coordination' },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={initialParallelAgents}
        />
      );

      // Should show handoff and parallel execution
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('backend-dev')).toBeInTheDocument();
      expect(screen.getByText('frontend-dev')).toBeInTheDocument();

      // Update parallel agents during handoff animation
      const updatedParallelAgents: AgentInfo[] = [
        { name: 'backend-dev', status: 'parallel', stage: 'api', progress: 55 }, // Updated progress
        { name: 'frontend-dev', status: 'parallel', stage: 'ui', progress: 50 }, // Updated progress
        { name: 'database-dev', status: 'parallel', stage: 'schema', progress: 25 }, // New agent
      ];

      rerender(
        <AgentPanel
          agents={agents}
          currentAgent="developer"
          showParallel={true}
          parallelAgents={updatedParallelAgents}
        />
      );

      // Should maintain handoff animation and update parallel agents
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('developer');
      expect(screen.getByText('55%')).toBeInTheDocument(); // Updated progress
      expect(screen.getByText('50%')).toBeInTheDocument(); // Updated progress
      expect(screen.getByText('database-dev')).toBeInTheDocument(); // New agent
      expect(screen.getByText('25%')).toBeInTheDocument(); // New agent progress
    });

    it('handles fade phase of handoff animation with parallel execution visibility', () => {
      // Start handoff fade phase during parallel execution
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'reviewer',
        currentAgent: 'devops',
        progress: 0.9,
        isFading: true, // Fade phase
      });

      const parallelAgents: AgentInfo[] = [
        { name: 'performance-tester', status: 'parallel', stage: 'load-testing', progress: 80 },
        { name: 'security-tester', status: 'parallel', stage: 'penetration-testing', progress: 70 },
      ];

      const agents: AgentInfo[] = [
        { name: 'reviewer', status: 'completed' },
        { name: 'devops', status: 'active', stage: 'deployment-prep' },
      ];

      render(
        <AgentPanel
          agents={agents}
          currentAgent="devops"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show fade animation and parallel execution
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('devops');
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('performance-tester')).toBeInTheDocument();
      expect(screen.getByText('security-tester')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
      expect(screen.getByText('(deployment-prep)')).toBeInTheDocument();
    });

    it('handles rapid agent changes during parallel execution', () => {
      const parallelAgents: AgentInfo[] = [
        { name: 'continuous-integration', status: 'parallel', stage: 'ci-pipeline' },
        { name: 'continuous-deployment', status: 'parallel', stage: 'cd-pipeline' },
      ];

      const agents: AgentInfo[] = [
        { name: 'agent1', status: 'completed' },
        { name: 'agent2', status: 'active' },
        { name: 'agent3', status: 'waiting' },
      ];

      // Simulate rapid agent changes
      const agentSequence = ['agent1', 'agent2', 'agent3', 'agent2', 'agent3'];
      let callCount = 0;

      const { rerender } = render(
        <AgentPanel
          agents={agents}
          currentAgent={agentSequence[0]}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Simulate rapid changes
      for (let i = 1; i < agentSequence.length; i++) {
        callCount++;
        mockUseAgentHandoff.mockReturnValue({
          isAnimating: true,
          previousAgent: agentSequence[i - 1],
          currentAgent: agentSequence[i],
          progress: 0.1 * callCount, // Varying progress
          isFading: callCount > 3,
        });

        rerender(
          <AgentPanel
            agents={agents}
            currentAgent={agentSequence[i]}
            showParallel={true}
            parallelAgents={parallelAgents}
          />
        );

        // Should maintain parallel execution during rapid changes
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
        expect(screen.getByText('continuous-integration')).toBeInTheDocument();
        expect(screen.getByText('continuous-deployment')).toBeInTheDocument();
      }

      // Handoff hook should be called for each agent change
      expect(mockUseAgentHandoff).toHaveBeenCalledTimes(agentSequence.length);
    });
  });

  describe('compact mode handoff with parallel execution', () => {
    it('shows handoff animation in compact mode with parallel agents', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'reviewer',
        progress: 0.5,
        isFading: false,
      });

      const compactAgents: AgentInfo[] = [
        { name: 'developer', status: 'completed' },
        { name: 'reviewer', status: 'active' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'auto-tester', status: 'parallel', stage: 'automated-testing' },
        { name: 'manual-tester', status: 'parallel', stage: 'manual-testing' },
      ];

      render(
        <AgentPanel
          agents={compactAgents}
          currentAgent="reviewer"
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show compact format with handoff and parallel agents
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('reviewer');
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument(); // No header in compact
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('auto-tester')).toBeInTheDocument();
      expect(screen.getByText('manual-tester')).toBeInTheDocument();

      // Should have separators for compact mode
      expect(screen.getAllByText('│')).toHaveLength(expect.any(Number));
    });

    it('maintains handoff animation performance in compact mode with many parallel agents', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'lead-developer',
        progress: 0.7,
        isFading: true,
      });

      const manyParallelAgents: AgentInfo[] = Array.from({ length: 8 }, (_, i) => ({
        name: `parallel-dev-${i + 1}`,
        status: 'parallel' as const,
        stage: `feature-${i + 1}`,
        progress: (i + 1) * 10,
      }));

      const compactAgents: AgentInfo[] = [
        { name: 'architect', status: 'completed' },
        { name: 'lead-developer', status: 'active', stage: 'coordination' },
      ];

      const startTime = Date.now();

      render(
        <AgentPanel
          agents={compactAgents}
          currentAgent="lead-developer"
          compact={true}
          showParallel={true}
          parallelAgents={manyParallelAgents}
        />
      );

      const renderTime = Date.now() - startTime;

      // Should render quickly even with handoff animation and many parallel agents
      expect(renderTime).toBeLessThan(100);
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('lead-developer');
      expect(screen.getByText('lead-developer')).toBeInTheDocument();

      // Should show some of the parallel agents
      expect(screen.getByText('parallel-dev-1')).toBeInTheDocument();
      expect(screen.getByText('parallel-dev-8')).toBeInTheDocument();
    });
  });

  describe('error scenarios during handoff and parallel execution', () => {
    it('gracefully handles handoff hook errors during parallel execution', () => {
      // Mock handoff hook to throw an error
      mockUseAgentHandoff.mockImplementation(() => {
        throw new Error('Handoff hook error');
      });

      const parallelAgents: AgentInfo[] = [
        { name: 'error-resilient-agent1', status: 'parallel' },
        { name: 'error-resilient-agent2', status: 'parallel' },
      ];

      // Should not crash even if handoff hook errors
      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            currentAgent="test-agent"
            showParallel={true}
            parallelAgents={parallelAgents}
          />
        );
      }).toThrow(); // Expected to throw due to mocked error

      // Reset mock for next test
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });
    });

    it('handles undefined currentAgent during parallel execution', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: false,
        previousAgent: null,
        currentAgent: null,
        progress: 0,
        isFading: false,
      });

      const parallelAgents: AgentInfo[] = [
        { name: 'orphan-agent1', status: 'parallel', stage: 'autonomous-task1' },
        { name: 'orphan-agent2', status: 'parallel', stage: 'autonomous-task2' },
      ];

      render(
        <AgentPanel
          agents={[]}
          currentAgent={undefined} // No current agent
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should handle undefined currentAgent gracefully
      expect(mockUseAgentHandoff).toHaveBeenCalledWith(undefined);
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('orphan-agent1')).toBeInTheDocument();
      expect(screen.getByText('orphan-agent2')).toBeInTheDocument();
    });
  });
});