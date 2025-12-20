/**
 * End-to-end workflow integration tests for AgentPanel
 * Tests complete workflow scenarios with orchestrator events
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '../../../__tests__/test-utils';
import { AgentPanel } from '../AgentPanel';
import { useOrchestratorEvents } from '../../../hooks/useOrchestratorEvents';
import { MockOrchestrator, createMockOrchestrator } from './test-utils/MockOrchestrator';

// Workflow definitions for testing
const workflows = {
  simple: {
    stages: [
      { name: 'planning', agent: 'planner' },
      { name: 'implementation', agent: 'developer' },
      { name: 'testing', agent: 'tester' },
    ],
  },
  complex: {
    stages: [
      { name: 'planning', agent: 'planner' },
      { name: 'architecture', agent: 'architect' },
      { name: 'implementation', agent: 'developer' },
      { name: 'testing', agent: 'tester' },
      { name: 'review', agent: 'reviewer' },
      { name: 'deployment', agent: 'devops' },
    ],
  },
};

// Workflow execution test component
const WorkflowTestHarness: React.FC<{
  orchestrator: MockOrchestrator;
  taskId: string;
  workflow: typeof workflows.simple;
  compact?: boolean;
}> = ({ orchestrator, taskId, workflow, compact = false }) => {
  const state = useOrchestratorEvents({
    orchestrator: orchestrator as any,
    taskId,
    workflow,
  });

  return (
    <AgentPanel
      agents={state.agents}
      currentAgent={state.currentAgent}
      compact={compact}
      showParallel={state.showParallelPanel}
      parallelAgents={state.parallelAgents}
    />
  );
};

describe('AgentPanel Workflow Integration Tests', () => {
  let mockOrchestrator: MockOrchestrator;
  const testTaskId = 'workflow-test-task';

  beforeEach(() => {
    vi.useFakeTimers();
    mockOrchestrator = createMockOrchestrator();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    mockOrchestrator.cleanup();
  });

  describe('Complete Workflow Execution', () => {
    it('handles a complete simple workflow from start to finish', async () => {
      render(
        <WorkflowTestHarness
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
          workflow={workflows.simple}
        />
      );

      // Start task - all agents should be visible in idle state
      const startTask = { id: testTaskId, status: 'running' as const };
      act(() => {
        mockOrchestrator.simulateTaskStart(startTask);
      });

      await waitFor(() => {
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getAllByText('·')).toHaveLength(3); // All idle
      });

      // Stage 1: Planning
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, null, 'planner');
      });

      await waitFor(() => {
        expect(screen.getByText('⚡')).toBeInTheDocument(); // Planner active
      });

      // Stage 2: Implementation with handoff animation
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'planner', 'developer');
      });

      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument(); // Handoff animation
        expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
      });

      // Complete handoff animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
      });

      // Stage 3: Testing with handoff animation
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'developer', 'tester');
      });

      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument(); // New handoff animation
        expect(screen.getByText('developer')).toBeInTheDocument(); // Previous
        expect(screen.getByText('tester')).toBeInTheDocument(); // Current
      });

      // Complete animation and task
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      const completedTask = { id: testTaskId, status: 'completed' as const };
      act(() => {
        mockOrchestrator.simulateTaskComplete(completedTask);
      });

      await waitFor(() => {
        // All animations should be complete
        expect(screen.queryByText('→')).not.toBeInTheDocument();
        // No active agents
        expect(screen.queryByText('⚡')).not.toBeInTheDocument();
        // Agent list should still be visible
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
      });
    });

    it('handles complex workflow with parallel execution', async () => {
      render(
        <WorkflowTestHarness
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
          workflow={workflows.complex}
        />
      );

      // Execute through planning and architecture stages
      act(() => {
        mockOrchestrator.simulateTaskStart({ id: testTaskId, status: 'running' as const });
        mockOrchestrator.simulateAgentTransition(testTaskId, null, 'planner');
      });

      await waitFor(() => {
        expect(screen.getByText('⚡')).toBeInTheDocument();
      });

      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'planner', 'architect');
      });

      // Fast-forward through handoff
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Implementation stage
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'architect', 'developer');
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Start parallel execution: testing and review
      act(() => {
        mockOrchestrator.simulateParallelStart(
          testTaskId,
          ['testing', 'review'],
          ['tester', 'reviewer']
        );
      });

      await waitFor(() => {
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();
        expect(screen.getAllByText('⟂')).toHaveLength(3); // Header + 2 agents
      });

      // Complete parallel execution
      act(() => {
        mockOrchestrator.simulateParallelComplete(testTaskId);
      });

      await waitFor(() => {
        expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      });

      // Final deployment stage
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'reviewer', 'devops');
      });

      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();
        expect(screen.getByText('devops')).toBeInTheDocument();
      });

      // Complete workflow
      act(() => {
        vi.advanceTimersByTime(2000);
        mockOrchestrator.simulateTaskComplete({ id: testTaskId, status: 'completed' as const });
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
        expect(screen.queryByText('⚡')).not.toBeInTheDocument();
      });
    });

    it('handles workflow execution in compact mode', async () => {
      render(
        <WorkflowTestHarness
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
          workflow={workflows.simple}
          compact={true}
        />
      );

      // Should not show "Active Agents" header in compact mode
      await waitFor(() => {
        expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
      });

      // Execute workflow stages
      act(() => {
        mockOrchestrator.simulateTaskStart({ id: testTaskId, status: 'running' as const });
        mockOrchestrator.simulateAgentTransition(testTaskId, null, 'planner');
      });

      await waitFor(() => {
        expect(screen.getByText('⚡')).toBeInTheDocument();
        // Should show agent separators
        expect(screen.getAllByText('│')).toHaveLength(2); // Between 3 agents = 2 separators
      });

      // Transition with handoff in compact mode
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'planner', 'developer');
      });

      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
        // Should not show "Handoff:" label in compact mode
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
      });

      // Parallel execution in compact mode
      act(() => {
        vi.advanceTimersByTime(2000);
        mockOrchestrator.simulateParallelStart(
          testTaskId,
          ['testing', 'extra'],
          ['tester', 'extra-agent']
        );
      });

      await waitFor(() => {
        expect(screen.getByText('⟂')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('extra-agent')).toBeInTheDocument();
        // Should show comma separator for parallel agents
        expect(screen.getByText(',')).toBeInTheDocument();
      });
    });
  });

  describe('Workflow Error Scenarios', () => {
    it('handles task failure during workflow execution', async () => {
      render(
        <WorkflowTestHarness
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
          workflow={workflows.simple}
        />
      );

      // Start workflow
      act(() => {
        mockOrchestrator.simulateTaskStart({ id: testTaskId, status: 'running' as const });
        mockOrchestrator.simulateAgentTransition(testTaskId, null, 'planner');
      });

      await waitFor(() => {
        expect(screen.getByText('⚡')).toBeInTheDocument();
      });

      // Start handoff to developer
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'planner', 'developer');
      });

      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // Fail task during animation
      act(() => {
        vi.advanceTimersByTime(1000); // Mid-animation
        mockOrchestrator.simulateTaskFail(
          { id: testTaskId, status: 'failed' as const },
          new Error('Task failed')
        );
      });

      await waitFor(() => {
        // Should clear active state
        expect(screen.queryByText('⚡')).not.toBeInTheDocument();
        // Animation should not interfere with error handling
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
      });
    });

    it('handles interruption of parallel execution', async () => {
      render(
        <WorkflowTestHarness
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
          workflow={workflows.complex}
        />
      );

      // Start parallel execution
      act(() => {
        mockOrchestrator.simulateParallelStart(
          testTaskId,
          ['testing', 'review', 'deployment'],
          ['tester', 'reviewer', 'devops']
        );
      });

      await waitFor(() => {
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();
        expect(screen.getByText('devops')).toBeInTheDocument();
      });

      // Fail task during parallel execution
      act(() => {
        mockOrchestrator.simulateTaskFail(
          { id: testTaskId, status: 'failed' as const },
          new Error('Parallel execution failed')
        );
      });

      await waitFor(() => {
        // Parallel section should be cleared
        expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
        expect(screen.queryByText('⚡')).not.toBeInTheDocument();
      });
    });
  });

  describe('Workflow with Subtasks', () => {
    it('handles subtask progress during workflow execution', async () => {
      render(
        <WorkflowTestHarness
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
          workflow={workflows.simple}
        />
      );

      // Start workflow
      act(() => {
        mockOrchestrator.simulateTaskStart({ id: testTaskId, status: 'running' as const });
        mockOrchestrator.simulateAgentTransition(testTaskId, null, 'planner');
      });

      await waitFor(() => {
        expect(screen.getByText('⚡')).toBeInTheDocument();
      });

      // Create subtasks during planning
      act(() => {
        mockOrchestrator.simulateSubtaskCreated({ id: 'subtask-1' }, testTaskId);
        mockOrchestrator.simulateSubtaskCreated({ id: 'subtask-2' }, testTaskId);
        mockOrchestrator.simulateSubtaskCreated({ id: 'subtask-3' }, testTaskId);
      });

      // Progress through implementation
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'planner', 'developer');
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Complete subtasks during development
      act(() => {
        mockOrchestrator.simulateSubtaskCompleted({ id: 'subtask-1' }, testTaskId);
      });

      act(() => {
        mockOrchestrator.simulateSubtaskCompleted({ id: 'subtask-2' }, testTaskId);
      });

      // Continue to testing
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'developer', 'tester');
      });

      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
      });

      // Complete final subtask and workflow
      act(() => {
        vi.advanceTimersByTime(2000);
        mockOrchestrator.simulateSubtaskCompleted({ id: 'subtask-3' }, testTaskId);
        mockOrchestrator.simulateTaskComplete({ id: testTaskId, status: 'completed' as const });
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
        expect(screen.queryByText('⚡')).not.toBeInTheDocument();
      });
    });
  });

  describe('Multiple Workflow Executions', () => {
    it('handles transition between different task workflows', async () => {
      const { rerender } = render(
        <WorkflowTestHarness
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
          workflow={workflows.simple}
        />
      );

      // Execute simple workflow partially
      act(() => {
        mockOrchestrator.simulateTaskStart({ id: testTaskId, status: 'running' as const });
        mockOrchestrator.simulateAgentTransition(testTaskId, null, 'planner');
      });

      await waitFor(() => {
        expect(screen.getByText('⚡')).toBeInTheDocument();
        expect(screen.getAllByText('·')).toHaveLength(2); // 2 idle agents
      });

      // Complete first task
      act(() => {
        mockOrchestrator.simulateTaskComplete({ id: testTaskId, status: 'completed' as const });
      });

      // Switch to complex workflow
      const newTaskId = 'complex-task-456';
      rerender(
        <WorkflowTestHarness
          orchestrator={mockOrchestrator}
          taskId={newTaskId}
          workflow={workflows.complex}
        />
      );

      await waitFor(() => {
        // Should show all complex workflow agents
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();
        expect(screen.getByText('devops')).toBeInTheDocument();

        // All should be idle
        expect(screen.getAllByText('·')).toHaveLength(6);
        expect(screen.queryByText('⚡')).not.toBeInTheDocument();
      });

      // Start new workflow
      act(() => {
        mockOrchestrator.simulateTaskStart({ id: newTaskId, status: 'running' as const });
        mockOrchestrator.simulateAgentTransition(newTaskId, null, 'architect');
      });

      await waitFor(() => {
        expect(screen.getByText('⚡')).toBeInTheDocument();
        expect(screen.getAllByText('·')).toHaveLength(5); // 5 idle, 1 active
      });
    });
  });

  describe('Performance and Stress Testing', () => {
    it('handles rapid workflow events without performance degradation', async () => {
      render(
        <WorkflowTestHarness
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
          workflow={workflows.complex}
        />
      );

      // Rapidly fire workflow events
      act(() => {
        mockOrchestrator.simulateTaskStart({ id: testTaskId, status: 'running' as const });

        // Rapid transitions
        for (const stage of workflows.complex.stages) {
          mockOrchestrator.simulateAgentTransition(testTaskId, null, stage.agent);
        }

        // Multiple parallel executions
        mockOrchestrator.simulateParallelStart(testTaskId, ['test1'], ['agent1']);
        mockOrchestrator.simulateParallelComplete(testTaskId);
        mockOrchestrator.simulateParallelStart(testTaskId, ['test2', 'test3'], ['agent2', 'agent3']);
        mockOrchestrator.simulateParallelComplete(testTaskId);

        // Subtask events
        for (let i = 0; i < 10; i++) {
          mockOrchestrator.simulateSubtaskCreated({ id: `rapid-subtask-${i}` }, testTaskId);
          mockOrchestrator.simulateSubtaskCompleted({ id: `rapid-subtask-${i}` }, testTaskId);
        }
      });

      // Should handle all events without crashing
      await waitFor(() => {
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
      });

      // Complete task
      act(() => {
        mockOrchestrator.simulateTaskComplete({ id: testTaskId, status: 'completed' as const });
      });

      await waitFor(() => {
        expect(screen.queryByText('⚡')).not.toBeInTheDocument();
        expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      });
    });
  });
});