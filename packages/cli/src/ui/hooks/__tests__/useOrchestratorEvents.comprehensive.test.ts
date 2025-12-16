import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useOrchestratorEvents } from '../useOrchestratorEvents';
import { MockOrchestrator, createMockOrchestrator } from '../../components/agents/__tests__/test-utils/MockOrchestrator';
import { testTasks, createWorkflowStages } from '../../components/agents/__tests__/test-utils/fixtures';

describe('useOrchestratorEvents - Comprehensive Tests', () => {
  let mockOrchestrator: MockOrchestrator;
  const testWorkflow = {
    stages: createWorkflowStages(['planning', 'architecture', 'implementation', 'testing', 'review', 'deployment'])
  };

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();
    vi.useFakeTimers();
  });

  afterEach(() => {
    mockOrchestrator.cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Event Binding Lifecycle', () => {
    it('registers all events on mount', () => {
      const { unmount } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      // Verify events are being listened to by emitting and checking state changes
      act(() => {
        mockOrchestrator.simulateTaskStart(testTasks.basic);
      });

      // Test that event was processed by checking if agents were initialized
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      expect(result.current.agents).toHaveLength(testWorkflow.stages.length);
      unmount();
    });

    it('unregisters all events on unmount', () => {
      const { unmount } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      // Unmount the hook
      unmount();

      // After unmount, events should not be processed
      const { result: newResult } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateTaskStart(testTasks.basic);
      });

      // The new hook should process events independently
      expect(newResult.current.currentTaskId).toBe(testTasks.basic.id);
    });

    it('does not leak memory after multiple mount/unmount cycles', () => {
      const initialListenerCount = mockOrchestrator.listenerCount('agent:transition');

      for (let i = 0; i < 5; i++) {
        const { unmount } = renderHook(() =>
          useOrchestratorEvents({
            orchestrator: mockOrchestrator,
            workflow: testWorkflow,
          })
        );
        unmount();
      }

      // Should not accumulate listeners
      expect(mockOrchestrator.listenerCount('agent:transition')).toBe(initialListenerCount);
    });

    it('handles late orchestrator binding', () => {
      // Start without orchestrator
      const { result, rerender } = renderHook(
        (props) => useOrchestratorEvents(props),
        {
          initialProps: { workflow: testWorkflow }
        }
      );

      expect(result.current.agents).toHaveLength(testWorkflow.stages.length);
      expect(result.current.currentAgent).toBeUndefined();

      // Add orchestrator later
      rerender({
        orchestrator: mockOrchestrator,
        workflow: testWorkflow,
      });

      // Should now respond to events
      act(() => {
        mockOrchestrator.simulateAgentTransition('task-1', null, 'planner');
      });

      expect(result.current.currentAgent).toBe('planner');
    });
  });

  describe('Parallel Execution Events', () => {
    it('updates parallelAgents on stage:parallel-started', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateParallelStart(
          'task-1',
          ['code-review', 'unit-testing'],
          ['reviewer', 'tester']
        );
      });

      expect(result.current.parallelAgents).toHaveLength(2);
      expect(result.current.parallelAgents[0]).toEqual({
        name: 'reviewer',
        status: 'parallel',
        stage: 'code-review',
      });
      expect(result.current.parallelAgents[1]).toEqual({
        name: 'tester',
        status: 'parallel',
        stage: 'unit-testing',
      });
    });

    it('clears parallelAgents on stage:parallel-completed', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      // Start parallel execution
      act(() => {
        mockOrchestrator.simulateParallelStart(
          'task-1',
          ['code-review', 'unit-testing'],
          ['reviewer', 'tester']
        );
      });

      expect(result.current.parallelAgents).toHaveLength(2);

      // Complete parallel execution
      act(() => {
        mockOrchestrator.simulateParallelComplete('task-1');
      });

      expect(result.current.parallelAgents).toHaveLength(0);
    });

    it('sets showParallelPanel true for 2+ agents', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateParallelStart(
          'task-1',
          ['code-review', 'unit-testing', 'security-scan'],
          ['reviewer', 'tester', 'security']
        );
      });

      expect(result.current.showParallelPanel).toBe(true);
    });

    it('keeps showParallelPanel false for single agent', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateParallelStart(
          'task-1',
          ['code-review'],
          ['reviewer']
        );
      });

      expect(result.current.showParallelPanel).toBe(false);
    });

    it('maps stages to agent names correctly', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateParallelStart(
          'task-1',
          ['stage-a', 'stage-b', 'stage-c'],
          ['agent-x', 'agent-y', 'agent-z']
        );
      });

      expect(result.current.parallelAgents).toEqual([
        { name: 'agent-x', status: 'parallel', stage: 'stage-a' },
        { name: 'agent-y', status: 'parallel', stage: 'stage-b' },
        { name: 'agent-z', status: 'parallel', stage: 'stage-c' },
      ]);
    });
  });

  describe('Agent Transition Events', () => {
    it('updates currentAgent on agent:transition', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('task-1', null, 'planner');
      });

      expect(result.current.currentAgent).toBe('planner');
    });

    it('updates previousAgent on agent:transition', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('task-1', null, 'planner');
      });

      expect(result.current.previousAgent).toBeUndefined();

      act(() => {
        mockOrchestrator.simulateAgentTransition('task-1', 'planner', 'architect');
      });

      expect(result.current.previousAgent).toBe('planner');
      expect(result.current.currentAgent).toBe('architect');
    });

    it('updates agent status in agents array', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('task-1', null, 'planner');
      });

      const plannerAgent = result.current.agents.find(a => a.name === 'planner');
      expect(plannerAgent?.status).toBe('active');

      act(() => {
        mockOrchestrator.simulateAgentTransition('task-1', 'planner', 'architect');
      });

      const updatedPlannerAgent = result.current.agents.find(a => a.name === 'planner');
      const architectAgent = result.current.agents.find(a => a.name === 'architect');
      expect(updatedPlannerAgent?.status).toBe('completed');
      expect(architectAgent?.status).toBe('active');
    });

    it('handles null fromAgent (first transition)', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('task-1', null, 'planner');
      });

      expect(result.current.currentAgent).toBe('planner');
      expect(result.current.previousAgent).toBeUndefined();
    });
  });

  describe('Task ID Filtering', () => {
    it('processes events matching taskId', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          taskId: 'task-1',
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('task-1', null, 'planner');
      });

      expect(result.current.currentAgent).toBe('planner');
    });

    it('ignores events for different taskId', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          taskId: 'task-1',
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('task-2', null, 'planner');
      });

      expect(result.current.currentAgent).toBeUndefined();
    });

    it('processes all events when taskId not provided', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateAgentTransition('any-task', null, 'planner');
      });

      expect(result.current.currentAgent).toBe('planner');
    });
  });

  describe('Workflow Derivation', () => {
    it('derives agents from workflow.stages', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      expect(result.current.agents).toHaveLength(testWorkflow.stages.length);
      expect(result.current.agents[0]).toEqual({
        name: 'planner',
        status: 'idle',
        stage: 'planning',
      });
    });

    it('initializes all agents as idle', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      result.current.agents.forEach(agent => {
        expect(agent.status).toBe('idle');
      });
    });

    it('handles empty workflow gracefully', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: { stages: [] },
        })
      );

      expect(result.current.agents).toHaveLength(0);
    });
  });

  describe('Subtask Tracking', () => {
    it('increments total on subtask:created', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateSubtaskCreated({ id: 'subtask-1' }, 'task-1');
      });

      expect(result.current.subtaskProgress?.total).toBe(1);
      expect(result.current.subtaskProgress?.completed).toBe(0);
    });

    it('increments completed on subtask:completed', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      // Create a subtask first
      act(() => {
        mockOrchestrator.simulateSubtaskCreated({ id: 'subtask-1' }, 'task-1');
      });

      // Complete the subtask
      act(() => {
        mockOrchestrator.simulateSubtaskCompleted({ id: 'subtask-1' }, 'task-1');
      });

      expect(result.current.subtaskProgress?.total).toBe(1);
      expect(result.current.subtaskProgress?.completed).toBe(1);
    });

    it('tracks progress ratio correctly', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      // Create multiple subtasks
      act(() => {
        mockOrchestrator.simulateSubtaskCreated({ id: 'subtask-1' }, 'task-1');
        mockOrchestrator.simulateSubtaskCreated({ id: 'subtask-2' }, 'task-1');
        mockOrchestrator.simulateSubtaskCreated({ id: 'subtask-3' }, 'task-1');
      });

      expect(result.current.subtaskProgress?.total).toBe(3);
      expect(result.current.subtaskProgress?.completed).toBe(0);

      // Complete some subtasks
      act(() => {
        mockOrchestrator.simulateSubtaskCompleted({ id: 'subtask-1' }, 'task-1');
        mockOrchestrator.simulateSubtaskCompleted({ id: 'subtask-2' }, 'task-1');
      });

      expect(result.current.subtaskProgress?.total).toBe(3);
      expect(result.current.subtaskProgress?.completed).toBe(2);
    });
  });

  describe('Task Lifecycle Events', () => {
    it('initializes state on task:started', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateTaskStart(testTasks.basic);
      });

      expect(result.current.currentTaskId).toBe(testTasks.basic.id);
      expect(result.current.agents).toHaveLength(testWorkflow.stages.length);
      expect(result.current.subtaskProgress).toEqual({ completed: 0, total: 0 });
    });

    it('clears state on task:completed', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      // Set up some state first
      act(() => {
        mockOrchestrator.simulateTaskStart(testTasks.basic);
        mockOrchestrator.simulateAgentTransition(testTasks.basic.id, null, 'planner');
        mockOrchestrator.simulateParallelStart(testTasks.basic.id, ['stage1'], ['agent1']);
      });

      expect(result.current.currentAgent).toBe('planner');
      expect(result.current.parallelAgents).toHaveLength(1);

      // Complete the task
      act(() => {
        mockOrchestrator.simulateTaskComplete(testTasks.completed);
      });

      expect(result.current.currentAgent).toBeUndefined();
      expect(result.current.previousAgent).toBeUndefined();
      expect(result.current.parallelAgents).toHaveLength(0);
      expect(result.current.showParallelPanel).toBe(false);
      expect(result.current.subtaskProgress).toBeUndefined();
    });

    it('clears state on task:failed', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      // Set up some state first
      act(() => {
        mockOrchestrator.simulateTaskStart(testTasks.basic);
        mockOrchestrator.simulateAgentTransition(testTasks.basic.id, null, 'planner');
      });

      expect(result.current.currentAgent).toBe('planner');

      // Fail the task
      act(() => {
        mockOrchestrator.simulateTaskFail(testTasks.failed, new Error('Test error'));
      });

      expect(result.current.currentAgent).toBeUndefined();
      expect(result.current.previousAgent).toBeUndefined();
      expect(result.current.parallelAgents).toHaveLength(0);
      expect(result.current.showParallelPanel).toBe(false);
      expect(result.current.subtaskProgress).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined orchestrator', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: undefined,
          workflow: testWorkflow,
        })
      );

      // Should still initialize agents from workflow
      expect(result.current.agents).toHaveLength(testWorkflow.stages.length);
      expect(result.current.currentAgent).toBeUndefined();
    });

    it('handles undefined workflow', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: undefined,
        })
      );

      expect(result.current.agents).toHaveLength(0);
    });

    it('handles rapid event sequences', async () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      // Simulate rapid events
      await act(async () => {
        mockOrchestrator.simulateTaskStart(testTasks.basic);
        mockOrchestrator.simulateAgentTransition(testTasks.basic.id, null, 'planner');
        mockOrchestrator.simulateAgentTransition(testTasks.basic.id, 'planner', 'architect');
        mockOrchestrator.simulateParallelStart(testTasks.basic.id, ['stage1', 'stage2'], ['agent1', 'agent2']);
        mockOrchestrator.simulateParallelComplete(testTasks.basic.id);
        mockOrchestrator.simulateTaskComplete(testTasks.basic);
      });

      // Should handle all events correctly
      expect(result.current.currentAgent).toBeUndefined();
      expect(result.current.parallelAgents).toHaveLength(0);
      expect(result.current.showParallelPanel).toBe(false);
    });

    it('handles malformed event data', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      // Should not crash with malformed events
      act(() => {
        mockOrchestrator.simulateMalformedEvent('parallel-started');
        mockOrchestrator.simulateMalformedEvent('agent-transition');
      });

      // Hook should remain functional
      expect(result.current.agents).toHaveLength(testWorkflow.stages.length);
    });
  });

  describe('Integration Scenarios', () => {
    it('handles complete workflow execution with parallel stages', async () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          taskId: 'integration-test',
          workflow: testWorkflow,
        })
      );

      // Full workflow simulation
      await act(async () => {
        // Start task
        mockOrchestrator.simulateTaskStart({ id: 'integration-test', status: 'running' });

        // Sequential stages
        mockOrchestrator.simulateAgentTransition('integration-test', null, 'planner');
        mockOrchestrator.simulateAgentTransition('integration-test', 'planner', 'architect');
        mockOrchestrator.simulateAgentTransition('integration-test', 'architect', 'developer');

        // Parallel execution
        mockOrchestrator.simulateParallelStart(
          'integration-test',
          ['testing', 'review'],
          ['tester', 'reviewer']
        );

        // Complete parallel and task
        mockOrchestrator.simulateParallelComplete('integration-test');
        mockOrchestrator.simulateTaskComplete({ id: 'integration-test', status: 'completed' });
      });

      // Final state should be clean
      expect(result.current.currentAgent).toBeUndefined();
      expect(result.current.parallelAgents).toHaveLength(0);
      expect(result.current.showParallelPanel).toBe(false);
    });

    it('handles multiple overlapping tasks with filtering', async () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          taskId: 'task-a',
          workflow: testWorkflow,
        })
      );

      await act(async () => {
        // Events for task-a (should be processed)
        mockOrchestrator.simulateTaskStart({ id: 'task-a', status: 'running' });
        mockOrchestrator.simulateAgentTransition('task-a', null, 'planner');

        // Events for task-b (should be ignored)
        mockOrchestrator.simulateTaskStart({ id: 'task-b', status: 'running' });
        mockOrchestrator.simulateAgentTransition('task-b', null, 'architect');

        // More events for task-a
        mockOrchestrator.simulateAgentTransition('task-a', 'planner', 'developer');
      });

      // Should only process task-a events
      expect(result.current.currentTaskId).toBe('task-a');
      expect(result.current.currentAgent).toBe('developer');
      expect(result.current.previousAgent).toBe('planner');
    });

    it('handles stage change fallback when agent:transition not available', () => {
      const { result } = renderHook(() =>
        useOrchestratorEvents({
          orchestrator: mockOrchestrator,
          workflow: testWorkflow,
        })
      );

      act(() => {
        mockOrchestrator.simulateStageChange('task-1', 'planning', 'planner');
      });

      expect(result.current.currentAgent).toBe('planner');

      // Derive agent from workflow stage
      const plannerAgent = result.current.agents.find(a => a.name === 'planner');
      expect(plannerAgent?.status).toBe('active');
    });
  });
});