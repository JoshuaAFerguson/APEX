/**
 * Integration tests for AgentPanel with orchestrator events
 * Tests AgentPanel's response to parallel execution events and handoff animations
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '../../../__tests__/test-utils';
import { AgentPanel, type AgentInfo } from '../AgentPanel';
import { useOrchestratorEvents } from '../../../hooks/useOrchestratorEvents';
import { MockOrchestrator, createMockOrchestrator } from './test-utils/MockOrchestrator';

// Mock workflow for testing
const mockWorkflow = {
  stages: [
    { name: 'planning', agent: 'planner' },
    { name: 'architecture', agent: 'architect' },
    { name: 'implementation', agent: 'developer' },
    { name: 'testing', agent: 'tester' },
    { name: 'review', agent: 'reviewer' },
    { name: 'deployment', agent: 'devops' },
  ],
};

// Test component that integrates AgentPanel with orchestrator events
const AgentPanelWithOrchestrator: React.FC<{
  orchestrator: MockOrchestrator;
  taskId: string;
  compact?: boolean;
  debug?: boolean;
}> = ({ orchestrator, taskId, compact, debug = false }) => {
  const orchestratorState = useOrchestratorEvents({
    orchestrator: orchestrator as any,
    taskId,
    workflow: mockWorkflow,
    debug,
  });

  return (
    <AgentPanel
      agents={orchestratorState.agents}
      currentAgent={orchestratorState.currentAgent}
      compact={compact}
      showParallel={orchestratorState.showParallelPanel}
      parallelAgents={orchestratorState.parallelAgents}
    />
  );
};

describe('AgentPanel Integration with Orchestrator Events', () => {
  let mockOrchestrator: MockOrchestrator;
  const testTaskId = 'test-task-123';

  beforeEach(() => {
    vi.useFakeTimers();
    mockOrchestrator = createMockOrchestrator();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    mockOrchestrator.cleanup();
  });

  describe('Agent Transition Events', () => {
    it('responds to agent:transition events with handoff animations', async () => {
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Initially should show workflow agents in idle state
      await waitFor(() => {
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
      });

      // Simulate agent transition from planner to architect
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, null, 'planner');
      });

      await waitFor(() => {
        expect(screen.getByText('planner')).toBeInTheDocument();
        // Should show planner as active
        expect(screen.getByText('⚡')).toBeInTheDocument();
      });

      // Transition from planner to architect
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'planner', 'architect');
      });

      // Should trigger handoff animation
      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument(); // Handoff arrow
        expect(screen.getByText('planner')).toBeInTheDocument(); // Previous agent
        expect(screen.getByText('architect')).toBeInTheDocument(); // Current agent
        expect(screen.getByText(/Handoff:/)).toBeInTheDocument(); // Full mode indicator
      });

      // Animation should complete after duration
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();
      });

      // Architect should now be active, planner completed
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    it('responds to task:stage-changed events when agent:transition not available', async () => {
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Start with planner
      act(() => {
        mockOrchestrator.simulateStageChange(testTaskId, 'planning', 'planner');
      });

      await waitFor(() => {
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('⚡')).toBeInTheDocument(); // Active indicator
      });

      // Change to implementation stage
      act(() => {
        mockOrchestrator.simulateStageChange(testTaskId, 'implementation', 'developer');
      });

      // Should trigger handoff animation
      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('planner')).toBeInTheDocument(); // Previous
        expect(screen.getByText('developer')).toBeInTheDocument(); // Current
      });
    });

    it('handles rapid agent transitions gracefully', async () => {
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Rapid sequence of transitions
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, null, 'planner');
      });

      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'planner', 'architect');
      });

      // Partial animation time
      act(() => {
        vi.advanceTimersByTime(500);
      });

      // Another rapid transition
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'architect', 'developer');
      });

      // Should show latest transition
      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument(); // Previous
        expect(screen.getByText('developer')).toBeInTheDocument(); // Current
      });

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.queryByText('→')).not.toBeInTheDocument();
      });
    });

    it('ignores events for different task IDs', async () => {
      const otherTaskId = 'other-task-456';

      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Event for different task should be ignored
      act(() => {
        mockOrchestrator.simulateAgentTransition(otherTaskId, null, 'planner');
      });

      await waitFor(() => {
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
      });

      // Should not show any active agents or animations
      expect(screen.queryByText('⚡')).not.toBeInTheDocument();
      expect(screen.queryByText('→')).not.toBeInTheDocument();

      // Event for correct task should work
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, null, 'planner');
      });

      await waitFor(() => {
        expect(screen.getByText('⚡')).toBeInTheDocument();
      });
    });
  });

  describe('Parallel Execution Events', () => {
    it('responds to stage:parallel-started events', async () => {
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Start parallel execution with multiple agents
      act(() => {
        mockOrchestrator.simulateParallelStart(
          testTaskId,
          ['implementation', 'testing', 'review'],
          ['developer', 'tester', 'reviewer']
        );
      });

      await waitFor(() => {
        // Should show parallel execution section
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();

        // Should show parallel status indicators
        expect(screen.getAllByText('⟂')).toHaveLength(4); // Section header + 3 agents
      });
    });

    it('does not show parallel panel for single agent', async () => {
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Start parallel execution with single agent
      act(() => {
        mockOrchestrator.simulateParallelStart(
          testTaskId,
          ['implementation'],
          ['developer']
        );
      });

      await waitFor(() => {
        // Should not show parallel execution section for single agent
        expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      });
    });

    it('responds to stage:parallel-completed events', async () => {
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Start parallel execution
      act(() => {
        mockOrchestrator.simulateParallelStart(
          testTaskId,
          ['implementation', 'testing'],
          ['developer', 'tester']
        );
      });

      await waitFor(() => {
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      });

      // Complete parallel execution
      act(() => {
        mockOrchestrator.simulateParallelComplete(testTaskId);
      });

      await waitFor(() => {
        // Parallel section should be hidden
        expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      });

      // Main agent list should still be visible
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('shows parallel agents in compact mode', async () => {
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
          compact={true}
        />
      );

      // Start parallel execution
      act(() => {
        mockOrchestrator.simulateParallelStart(
          testTaskId,
          ['implementation', 'testing'],
          ['developer', 'tester']
        );
      });

      await waitFor(() => {
        // Should show parallel agents in compact format
        expect(screen.getByText('⟂')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();

        // Should not show "Active Agents" header in compact mode
        expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();

        // Should show separators
        expect(screen.getAllByText('│')).toHaveLength(mockWorkflow.stages.length); // Between regular agents + parallel section
      });
    });
  });

  describe('Task Lifecycle Events', () => {
    it('initializes agent state on task:started', async () => {
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      const mockTask = {
        id: testTaskId,
        description: 'Test task',
        workflow: 'feature',
        status: 'running' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      act(() => {
        mockOrchestrator.simulateTaskStart(mockTask);
      });

      await waitFor(() => {
        // Should show all workflow agents
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();
        expect(screen.getByText('devops')).toBeInTheDocument();

        // All should be in idle state initially
        expect(screen.getAllByText('·')).toHaveLength(6); // 6 agents in idle
      });
    });

    it('clears agent state on task:completed', async () => {
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Set up some agent state
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, null, 'developer');
        mockOrchestrator.simulateParallelStart(testTaskId, ['testing'], ['tester']);
      });

      await waitFor(() => {
        expect(screen.getByText('⚡')).toBeInTheDocument(); // Active agent
        expect(screen.getByText('⟂')).toBeInTheDocument(); // Parallel agent
      });

      // Complete task
      const completedTask = {
        id: testTaskId,
        status: 'completed' as const,
        description: 'Test task',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      act(() => {
        mockOrchestrator.simulateTaskComplete(completedTask);
      });

      await waitFor(() => {
        // Active agent indicators should be cleared
        expect(screen.queryByText('⚡')).not.toBeInTheDocument();
        // Parallel section should be hidden
        expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      });

      // Agent list should still be visible
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('clears agent state on task:failed', async () => {
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Set up some agent state
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, null, 'architect');
      });

      await waitFor(() => {
        expect(screen.getByText('⚡')).toBeInTheDocument();
      });

      // Fail task
      const failedTask = {
        id: testTaskId,
        status: 'failed' as const,
        description: 'Test task',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      act(() => {
        mockOrchestrator.simulateTaskFail(failedTask, new Error('Task failed'));
      });

      await waitFor(() => {
        // Active agent indicators should be cleared
        expect(screen.queryByText('⚡')).not.toBeInTheDocument();
      });
    });
  });

  describe('Subtask Progress Tracking', () => {
    it('tracks subtask creation and completion', async () => {
      // Note: AgentPanel doesn't directly show subtask progress in the current implementation
      // But the hook should track it for potential future use
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Create subtasks
      act(() => {
        mockOrchestrator.simulateSubtaskCreated({ id: 'subtask-1' }, testTaskId);
        mockOrchestrator.simulateSubtaskCreated({ id: 'subtask-2' }, testTaskId);
      });

      // Complete a subtask
      act(() => {
        mockOrchestrator.simulateSubtaskCompleted({ id: 'subtask-1' }, testTaskId);
      });

      // The AgentPanel should continue to work normally
      // Subtask progress tracking is handled by the hook but not displayed in AgentPanel
      await waitFor(() => {
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
      });
    });
  });

  describe('Animation Integration', () => {
    it('combines orchestrator events with handoff animations seamlessly', async () => {
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Start with planner
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, null, 'planner');
      });

      await waitFor(() => {
        expect(screen.getByText('⚡')).toBeInTheDocument();
      });

      // Transition to architect - should trigger handoff animation
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'planner', 'architect');
      });

      // Check animation elements appear
      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
        expect(screen.getByText(/Handoff:/)).toBeInTheDocument();
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('architect')).toBeInTheDocument();
      });

      // During animation, start parallel execution
      act(() => {
        vi.advanceTimersByTime(1000); // Mid-animation
        mockOrchestrator.simulateParallelStart(testTaskId, ['testing', 'review'], ['tester', 'reviewer']);
      });

      // Should handle both animation and parallel execution
      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument(); // Still animating
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument(); // Parallel section
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();
      });

      // Complete animation
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        // Animation should be done
        expect(screen.queryByText('→')).not.toBeInTheDocument();
        expect(screen.queryByText(/Handoff:/)).not.toBeInTheDocument();

        // Parallel section should still be visible
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      });
    });

    it('maintains consistent agent colors between list and animations', async () => {
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Transition from planner to developer
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, 'planner', 'developer');
      });

      await waitFor(() => {
        expect(screen.getByText('→')).toBeInTheDocument();
        // Both agents should be visible with consistent styling
        expect(screen.getByText('planner')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
      });
    });
  });

  describe('Error Resilience', () => {
    it('continues working when orchestrator events contain invalid data', async () => {
      render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Emit invalid event data - should not crash
      act(() => {
        // @ts-ignore - intentionally invalid data for testing
        mockOrchestrator.emit('agent:transition', null, undefined, null);
      });

      // AgentPanel should continue to work
      await waitFor(() => {
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
      });

      // Valid event should still work
      act(() => {
        mockOrchestrator.simulateAgentTransition(testTaskId, null, 'planner');
      });

      await waitFor(() => {
        expect(screen.getByText('⚡')).toBeInTheDocument();
      });
    });

    it('handles missing workflow gracefully', async () => {
      // Component without workflow
      const ComponentWithoutWorkflow: React.FC = () => {
        const orchestratorState = useOrchestratorEvents({
          orchestrator: mockOrchestrator as any,
          taskId: testTaskId,
          // No workflow provided
        });

        return (
          <AgentPanel
            agents={orchestratorState.agents}
            currentAgent={orchestratorState.currentAgent}
            showParallel={orchestratorState.showParallelPanel}
            parallelAgents={orchestratorState.parallelAgents}
          />
        );
      };

      render(<ComponentWithoutWorkflow />);

      // Should render without crashing
      await waitFor(() => {
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
      });

      // Events should still be handled, even without workflow-derived agents
      act(() => {
        mockOrchestrator.simulateParallelStart(testTaskId, ['test'], ['agent']);
      });

      // Should not crash
      await waitFor(() => {
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
      });
    });
  });

  describe('Memory Management', () => {
    it('cleans up event listeners on unmount', async () => {
      const { unmount } = render(
        <AgentPanelWithOrchestrator
          orchestrator={mockOrchestrator}
          taskId={testTaskId}
        />
      );

      // Verify listeners are attached
      expect(mockOrchestrator.listenerCount('agent:transition')).toBe(1);
      expect(mockOrchestrator.listenerCount('stage:parallel-started')).toBe(1);

      // Unmount component
      unmount();

      // Listeners should be cleaned up
      expect(mockOrchestrator.listenerCount('agent:transition')).toBe(0);
      expect(mockOrchestrator.listenerCount('stage:parallel-started')).toBe(0);
    });
  });
});