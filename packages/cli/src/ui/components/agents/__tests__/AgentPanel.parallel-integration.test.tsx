import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';

describe('AgentPanel - Parallel Execution Integration Tests', () => {
  describe('real-world parallel execution scenarios', () => {
    it('handles development workflow with parallel code review and testing', () => {
      // Simulate a common scenario: development is complete, review and testing happen in parallel
      const workflowAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed', stage: 'planning' },
        { name: 'architect', status: 'completed', stage: 'designing' },
        { name: 'developer', status: 'completed', stage: 'implementation' },
        { name: 'reviewer', status: 'waiting' }, // Will become parallel
        { name: 'tester', status: 'waiting' }, // Will become parallel
        { name: 'devops', status: 'idle' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'reviewer', status: 'parallel', stage: 'code-review', progress: 30 },
        { name: 'tester', status: 'parallel', stage: 'unit-testing', progress: 45 },
        { name: 'security-scanner', status: 'parallel', stage: 'security-scan', progress: 70 },
      ];

      render(
        <AgentPanel
          agents={workflowAgents}
          currentAgent="reviewer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Should show main workflow
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // Should show parallel execution section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('security-scanner')).toBeInTheDocument();

      // Should show parallel work details
      expect(screen.getByText(/\(code-review\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(unit-testing\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(security-scan\)/)).toBeInTheDocument();
      expect(screen.getByText(/30%/)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();
      expect(screen.getByText(/70%/)).toBeInTheDocument();
    });

    it('handles CI/CD pipeline with parallel deployment stages', () => {
      // Simulate deployment scenario with parallel environment deployments
      const pipelineAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'completed' },
        { name: 'reviewer', status: 'completed' },
        { name: 'tester', status: 'completed' },
        { name: 'devops', status: 'active', stage: 'orchestrating-deployment' },
      ];

      const parallelDeployments: AgentInfo[] = [
        { name: 'staging-deployer', status: 'parallel', stage: 'staging-deployment', progress: 80 },
        { name: 'test-deployer', status: 'parallel', stage: 'test-environment', progress: 60 },
        { name: 'integration-deployer', status: 'parallel', stage: 'integration-tests', progress: 40 },
        { name: 'performance-tester', status: 'parallel', stage: 'performance-testing', progress: 20 },
      ];

      render(
        <AgentPanel
          agents={pipelineAgents}
          currentAgent="devops"
          showParallel={true}
          parallelAgents={parallelDeployments}
        />
      );

      // Main pipeline should be shown
      expect(screen.getByText('devops')).toBeInTheDocument();
      expect(screen.getByText(/\(orchestrating-deployment\)/)).toBeInTheDocument();

      // Parallel deployments should be shown
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('staging-deployer')).toBeInTheDocument();
      expect(screen.getByText('test-deployer')).toBeInTheDocument();
      expect(screen.getByText('integration-deployer')).toBeInTheDocument();
      expect(screen.getByText('performance-tester')).toBeInTheDocument();

      // All progress indicators should be shown
      expect(screen.getByText(/80%/)).toBeInTheDocument();
      expect(screen.getByText(/60%/)).toBeInTheDocument();
      expect(screen.getByText(/40%/)).toBeInTheDocument();
      expect(screen.getByText(/20%/)).toBeInTheDocument();
    });

    it('handles microservices development with parallel service implementations', () => {
      // Simulate microservices scenario where multiple services are being developed in parallel
      const mainAgents: AgentInfo[] = [
        { name: 'architect', status: 'completed', stage: 'service-design' },
        { name: 'planner', status: 'active', stage: 'coordination' },
      ];

      const parallelServices: AgentInfo[] = [
        { name: 'auth-service-dev', status: 'parallel', stage: 'auth-implementation', progress: 90 },
        { name: 'user-service-dev', status: 'parallel', stage: 'user-crud-api', progress: 75 },
        { name: 'payment-service-dev', status: 'parallel', stage: 'payment-integration', progress: 55 },
        { name: 'notification-service-dev', status: 'parallel', stage: 'message-queue', progress: 35 },
        { name: 'api-gateway-dev', status: 'parallel', stage: 'routing-config', progress: 25 },
      ];

      render(
        <AgentPanel
          agents={mainAgents}
          currentAgent="planner"
          showParallel={true}
          parallelAgents={parallelServices}
        />
      );

      // Main coordination should be shown
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText(/\(coordination\)/)).toBeInTheDocument();

      // All parallel services should be shown
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('auth-service-dev')).toBeInTheDocument();
      expect(screen.getByText('user-service-dev')).toBeInTheDocument();
      expect(screen.getByText('payment-service-dev')).toBeInTheDocument();
      expect(screen.getByText('notification-service-dev')).toBeInTheDocument();
      expect(screen.getByText('api-gateway-dev')).toBeInTheDocument();

      // Specific implementation stages should be shown
      expect(screen.getByText(/\(auth-implementation\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(user-crud-api\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(payment-integration\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(message-queue\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(routing-config\)/)).toBeInTheDocument();
    });
  });

  describe('parallel execution state transitions', () => {
    it('handles transition from sequential to parallel execution', () => {
      // Start with sequential execution
      const initialAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'active', stage: 'implementation', progress: 95 },
        { name: 'reviewer', status: 'waiting' },
        { name: 'tester', status: 'waiting' },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={initialAgents}
          currentAgent="developer"
          showParallel={false}
          parallelAgents={[]}
        />
      );

      // Initial state - no parallel execution
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText(/95%/)).toBeInTheDocument();

      // Transition to parallel execution
      const transitionAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'completed', stage: 'implementation' },
        { name: 'reviewer', status: 'waiting' },
        { name: 'tester', status: 'waiting' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'reviewer', status: 'parallel', stage: 'code-review', progress: 10 },
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 5 },
      ];

      rerender(
        <AgentPanel
          agents={transitionAgents}
          currentAgent="reviewer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // After transition - parallel execution should be shown
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText(/10%/)).toBeInTheDocument();
      expect(screen.getByText(/5%/)).toBeInTheDocument();
    });

    it('handles parallel execution completion and return to sequential', () => {
      // Start with parallel execution
      const initialAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'completed' },
        { name: 'reviewer', status: 'waiting' },
        { name: 'tester', status: 'waiting' },
        { name: 'devops', status: 'waiting' },
      ];

      const initialParallelAgents: AgentInfo[] = [
        { name: 'reviewer', status: 'parallel', stage: 'review', progress: 80 },
        { name: 'tester', status: 'parallel', stage: 'testing', progress: 85 },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={initialAgents}
          currentAgent="reviewer"
          showParallel={true}
          parallelAgents={initialParallelAgents}
        />
      );

      // Initial state with parallel execution
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText(/80%/)).toBeInTheDocument();
      expect(screen.getByText(/85%/)).toBeInTheDocument();

      // Complete parallel execution, move to next sequential step
      const finalAgents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'completed' },
        { name: 'reviewer', status: 'completed', stage: 'review' },
        { name: 'tester', status: 'completed', stage: 'testing' },
        { name: 'devops', status: 'active', stage: 'deployment', progress: 15 },
      ];

      rerender(
        <AgentPanel
          agents={finalAgents}
          currentAgent="devops"
          showParallel={false}
          parallelAgents={[]}
        />
      );

      // After completion - back to sequential execution
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
      expect(screen.getByText(/\(deployment\)/)).toBeInTheDocument();
      expect(screen.getByText(/15%/)).toBeInTheDocument();

      // Previous agents should show as completed
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });

  describe('parallel execution with handoff animations', () => {
    const mockUseAgentHandoff = vi.fn();

    beforeEach(() => {
      vi.doMock('../../../hooks/useAgentHandoff.js', () => ({
        useAgentHandoff: mockUseAgentHandoff,
      }));
    });

    afterEach(() => {
      vi.clearAllMocks();
      vi.doUnmock('../../../hooks/useAgentHandoff.js');
    });

    it('handles smooth transitions during parallel execution workflow', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'developer',
        currentAgent: 'reviewer',
        progress: 0.3,
        isFading: false,
      });

      const agents: AgentInfo[] = [
        { name: 'developer', status: 'completed' },
        { name: 'reviewer', status: 'active' },
        { name: 'tester', status: 'waiting' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'reviewer', status: 'parallel', stage: 'reviewing', progress: 20 },
        { name: 'security-audit', status: 'parallel', stage: 'security-check', progress: 15 },
      ];

      render(
        <AgentPanel
          agents={agents}
          currentAgent="reviewer"
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Animation should be active
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('reviewer');

      // Both main and parallel sections should be visible during animation
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Agent transition should be handled smoothly
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('security-audit')).toBeInTheDocument();
    });

    it('handles compact mode animations during parallel execution', () => {
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'tester',
        currentAgent: 'devops',
        progress: 0.7,
        isFading: true,
      });

      const agents: AgentInfo[] = [
        { name: 'tester', status: 'completed' },
        { name: 'devops', status: 'active' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'staging-deploy', status: 'parallel', stage: 'staging' },
        { name: 'prod-deploy', status: 'parallel', stage: 'production' },
      ];

      render(
        <AgentPanel
          agents={agents}
          currentAgent="devops"
          compact={true}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // Compact mode should work with animation
      expect(mockUseAgentHandoff).toHaveBeenCalledWith('devops');
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument(); // No header in compact

      // All agents should be visible in compact format
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
      expect(screen.getByText('staging-deploy')).toBeInTheDocument();
      expect(screen.getByText('prod-deploy')).toBeInTheDocument();
    });
  });

  describe('parallel execution error and recovery scenarios', () => {
    it('handles partial parallel execution failure gracefully', () => {
      // Simulate scenario where some parallel agents fail or get stuck
      const agents: AgentInfo[] = [
        { name: 'planner', status: 'completed' },
        { name: 'developer', status: 'completed' },
        { name: 'reviewer', status: 'waiting' },
      ];

      const parallelAgents: AgentInfo[] = [
        { name: 'test-runner', status: 'parallel', stage: 'unit-tests', progress: 100 }, // completed
        { name: 'integration-tester', status: 'parallel', stage: 'integration', progress: 45 }, // in progress
        { name: 'e2e-tester', status: 'parallel', stage: 'e2e-tests', progress: 0 }, // stuck
      ];

      render(
        <AgentPanel
          agents={agents}
          showParallel={true}
          parallelAgents={parallelAgents}
        />
      );

      // All agents should be displayed regardless of their state
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('test-runner')).toBeInTheDocument();
      expect(screen.getByText('integration-tester')).toBeInTheDocument();
      expect(screen.getByText('e2e-tester')).toBeInTheDocument();

      // Progress should be shown appropriately (100% and 0% hidden, 45% shown)
      expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
      expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();

      // Stages should be shown for all
      expect(screen.getByText(/\(unit-tests\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(integration\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(e2e-tests\)/)).toBeInTheDocument();
    });

    it('handles dynamic addition and removal of parallel agents', () => {
      // Start with some parallel agents
      const initialParallelAgents: AgentInfo[] = [
        { name: 'agent1', status: 'parallel', stage: 'task1', progress: 30 },
        { name: 'agent2', status: 'parallel', stage: 'task2', progress: 40 },
      ];

      const { rerender } = render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={initialParallelAgents}
        />
      );

      // Initial state
      expect(screen.getByText('agent1')).toBeInTheDocument();
      expect(screen.getByText('agent2')).toBeInTheDocument();
      expect(screen.getByText(/30%/)).toBeInTheDocument();
      expect(screen.getByText(/40%/)).toBeInTheDocument();

      // Add more agents and remove one
      const updatedParallelAgents: AgentInfo[] = [
        { name: 'agent2', status: 'parallel', stage: 'task2', progress: 70 }, // continued
        { name: 'agent3', status: 'parallel', stage: 'task3', progress: 20 }, // new
        { name: 'agent4', status: 'parallel', stage: 'task4', progress: 10 }, // new
        // agent1 removed
      ];

      rerender(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={updatedParallelAgents}
        />
      );

      // Updated state
      expect(screen.queryByText('agent1')).not.toBeInTheDocument(); // removed
      expect(screen.getByText('agent2')).toBeInTheDocument(); // continued
      expect(screen.getByText('agent3')).toBeInTheDocument(); // new
      expect(screen.getByText('agent4')).toBeInTheDocument(); // new

      // Progress should be updated
      expect(screen.queryByText(/30%/)).not.toBeInTheDocument(); // old progress
      expect(screen.getByText(/70%/)).toBeInTheDocument(); // updated progress
      expect(screen.getByText(/20%/)).toBeInTheDocument(); // new progress
      expect(screen.queryByText(/10%/)).not.toBeInTheDocument(); // hidden (below threshold)
    });
  });

  describe('parallel execution performance and limits', () => {
    it('handles maximum realistic number of parallel agents', () => {
      // Test with a realistic but large number of parallel agents (10)
      const manyParallelAgents: AgentInfo[] = [
        { name: 'frontend-dev', status: 'parallel', stage: 'react-components', progress: 85 },
        { name: 'backend-dev', status: 'parallel', stage: 'api-endpoints', progress: 70 },
        { name: 'database-dev', status: 'parallel', stage: 'schema-migration', progress: 60 },
        { name: 'mobile-dev', status: 'parallel', stage: 'native-app', progress: 45 },
        { name: 'devops-engineer', status: 'parallel', stage: 'infrastructure', progress: 55 },
        { name: 'qa-tester', status: 'parallel', stage: 'automated-tests', progress: 75 },
        { name: 'security-engineer', status: 'parallel', stage: 'penetration-testing', progress: 30 },
        { name: 'performance-engineer', status: 'parallel', stage: 'load-testing', progress: 40 },
        { name: 'ui-ux-designer', status: 'parallel', stage: 'design-review', progress: 90 },
        { name: 'technical-writer', status: 'parallel', stage: 'documentation', progress: 65 },
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={manyParallelAgents}
        />
      );

      // Should handle many agents without issues
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Spot check several agents
      expect(screen.getByText('frontend-dev')).toBeInTheDocument();
      expect(screen.getByText('backend-dev')).toBeInTheDocument();
      expect(screen.getByText('mobile-dev')).toBeInTheDocument();
      expect(screen.getByText('security-engineer')).toBeInTheDocument();
      expect(screen.getByText('technical-writer')).toBeInTheDocument();

      // Check progress indicators
      expect(screen.getByText(/85%/)).toBeInTheDocument();
      expect(screen.getByText(/70%/)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();

      // Check stage information
      expect(screen.getByText(/\(react-components\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(api-endpoints\)/)).toBeInTheDocument();
      expect(screen.getByText(/\(penetration-testing\)/)).toBeInTheDocument();
    });
  });
});