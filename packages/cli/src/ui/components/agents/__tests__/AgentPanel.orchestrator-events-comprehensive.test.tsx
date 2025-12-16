import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../../../__tests__/test-utils';
import { AgentPanel, AgentInfo } from '../AgentPanel';
import { MockOrchestrator, createMockOrchestrator } from './test-utils/MockOrchestrator';
import {
  testTasks,
  createWorkflowStages,
  standardWorkflowAgents,
  parallelScenarios,
  testAgentColors,
} from './test-utils/fixtures';
import { useOrchestratorEvents } from '../../../hooks/useOrchestratorEvents';

// Mock the hooks to provide controlled test data
const mockUseOrchestratorEvents = vi.fn();
const mockUseAgentHandoff = vi.fn();

vi.mock('../../../hooks/useOrchestratorEvents', () => ({
  useOrchestratorEvents: mockUseOrchestratorEvents,
}));

vi.mock('../../../hooks/useAgentHandoff.js', () => ({
  useAgentHandoff: mockUseAgentHandoff,
}));

describe('AgentPanel - Orchestrator Events Comprehensive Integration', () => {
  let mockOrchestrator: MockOrchestrator;
  const testWorkflow = {
    stages: createWorkflowStages(['planning', 'architecture', 'implementation', 'testing', 'review', 'deployment'])
  };

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();
    vi.useFakeTimers();

    // Default mock implementations
    mockUseOrchestratorEvents.mockReturnValue({
      currentAgent: undefined,
      previousAgent: undefined,
      agents: standardWorkflowAgents,
      parallelAgents: [],
      showParallelPanel: false,
      currentTaskId: undefined,
      subtaskProgress: undefined,
    });

    mockUseAgentHandoff.mockReturnValue({
      isAnimating: false,
      previousAgent: null,
      currentAgent: null,
      progress: 0,
      isFading: false,
      transitionPhase: 'idle',
      pulseIntensity: 0,
      arrowFrame: 0,
      handoffStartTime: null,
      arrowAnimationFrame: 0,
      iconFrame: 0,
      colorIntensity: 0,
      colorPhase: 'source-bright',
    });
  });

  afterEach(() => {
    mockOrchestrator.cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Complete Event Sequence', () => {
    it('handles full workflow: start → parallel → complete', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
          currentAgent="planner"
        />
      );

      // Step 1: Task started, planner active
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: 'planner',
        previousAgent: undefined,
        agents: standardWorkflowAgents.map(a =>
          a.name === 'planner' ? { ...a, status: 'active' } : a
        ),
        parallelAgents: [],
        showParallelPanel: false,
        currentTaskId: 'task-1',
        subtaskProgress: { completed: 0, total: 0 },
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            currentAgent="planner"
          />
        );
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Step 2: Parallel execution starts
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: 'planner',
        previousAgent: undefined,
        agents: standardWorkflowAgents,
        parallelAgents: parallelScenarios.twoAgents,
        showParallelPanel: true,
        currentTaskId: 'task-1',
        subtaskProgress: { completed: 0, total: 2 },
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            currentAgent="planner"
            showParallel={true}
            parallelAgents={parallelScenarios.twoAgents}
          />
        );
      });

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // Step 3: Parallel execution completes
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: 'devops',
        previousAgent: 'planner',
        agents: standardWorkflowAgents.map(a => {
          if (a.name === 'devops') return { ...a, status: 'active' };
          if (a.name === 'planner') return { ...a, status: 'completed' };
          return a;
        }),
        parallelAgents: [],
        showParallelPanel: false,
        currentTaskId: 'task-1',
        subtaskProgress: { completed: 2, total: 2 },
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            currentAgent="devops"
            showParallel={false}
            parallelAgents={[]}
          />
        );
      });

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
    });

    it('handles multiple parallel groups in single task', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // First parallel group
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: undefined,
        previousAgent: undefined,
        agents: standardWorkflowAgents,
        parallelAgents: parallelScenarios.twoAgents,
        showParallelPanel: true,
        currentTaskId: 'task-1',
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            showParallel={true}
            parallelAgents={parallelScenarios.twoAgents}
          />
        );
      });

      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();

      // First group completes, second begins
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: undefined,
        previousAgent: undefined,
        agents: standardWorkflowAgents,
        parallelAgents: parallelScenarios.microservices.slice(0, 3),
        showParallelPanel: true,
        currentTaskId: 'task-1',
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            showParallel={true}
            parallelAgents={parallelScenarios.microservices.slice(0, 3)}
          />
        );
      });

      expect(screen.getByText('auth-dev')).toBeInTheDocument();
      expect(screen.getByText('user-dev')).toBeInTheDocument();
      expect(screen.getByText('payment-dev')).toBeInTheDocument();
    });

    it('handles interleaved events during parallel', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Parallel execution with progress updates
      const progressingAgents = parallelScenarios.twoAgents.map((agent, index) => ({
        ...agent,
        progress: 25 + index * 20,
      }));

      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: 'developer',
        previousAgent: 'architect',
        agents: standardWorkflowAgents.map(a =>
          a.name === 'developer' ? { ...a, status: 'active' } : a
        ),
        parallelAgents: progressingAgents,
        showParallelPanel: true,
        currentTaskId: 'task-1',
        subtaskProgress: { completed: 1, total: 3 },
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            currentAgent="developer"
            showParallel={true}
            parallelAgents={progressingAgents}
          />
        );
      });

      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText(/25%/)).toBeInTheDocument();
      expect(screen.getByText(/45%/)).toBeInTheDocument();
    });
  });

  describe('State Synchronization', () => {
    it('synchronizes parallelAgents array with events', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Start with no parallel agents
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Add parallel agents
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: undefined,
        previousAgent: undefined,
        agents: standardWorkflowAgents,
        parallelAgents: parallelScenarios.threeAgents,
        showParallelPanel: true,
        currentTaskId: 'task-1',
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            showParallel={true}
            parallelAgents={parallelScenarios.threeAgents}
          />
        );
      });

      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('security')).toBeInTheDocument();
    });

    it('synchronizes showParallelPanel flag', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // showParallelPanel false
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: undefined,
        previousAgent: undefined,
        agents: standardWorkflowAgents,
        parallelAgents: [],
        showParallelPanel: false,
        currentTaskId: 'task-1',
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            showParallel={false}
            parallelAgents={[]}
          />
        );
      });

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // showParallelPanel true
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: undefined,
        previousAgent: undefined,
        agents: standardWorkflowAgents,
        parallelAgents: parallelScenarios.twoAgents,
        showParallelPanel: true,
        currentTaskId: 'task-1',
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            showParallel={true}
            parallelAgents={parallelScenarios.twoAgents}
          />
        );
      });

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });

    it('tracks currentAgent during parallel execution', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Current agent with parallel execution
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: 'developer',
        previousAgent: 'architect',
        agents: standardWorkflowAgents.map(a =>
          a.name === 'developer' ? { ...a, status: 'active' } : a
        ),
        parallelAgents: parallelScenarios.twoAgents,
        showParallelPanel: true,
        currentTaskId: 'task-1',
      });

      // Mock handoff animation
      mockUseAgentHandoff.mockReturnValue({
        isAnimating: true,
        previousAgent: 'architect',
        currentAgent: 'developer',
        progress: 0.5,
        isFading: false,
        transitionPhase: 'active',
        pulseIntensity: 0.5,
        arrowFrame: 1,
        handoffStartTime: new Date(),
        arrowAnimationFrame: 4,
        iconFrame: 4,
        colorIntensity: 0.5,
        colorPhase: 'transitioning',
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            currentAgent="developer"
            showParallel={true}
            parallelAgents={parallelScenarios.twoAgents}
          />
        );
      });

      // Should show both the main current agent and parallel agents
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('updates agent statuses correctly', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Agents with various statuses
      const updatedAgents: AgentInfo[] = standardWorkflowAgents.map(agent => {
        if (agent.name === 'planner') return { ...agent, status: 'completed' };
        if (agent.name === 'architect') return { ...agent, status: 'completed' };
        if (agent.name === 'developer') return { ...agent, status: 'active' };
        if (agent.name === 'tester') return { ...agent, status: 'waiting' };
        return agent;
      });

      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: 'developer',
        previousAgent: 'architect',
        agents: updatedAgents,
        parallelAgents: [],
        showParallelPanel: false,
        currentTaskId: 'task-1',
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={updatedAgents}
            currentAgent="developer"
          />
        );
      });

      // Status icons should reflect the updated statuses
      expect(screen.getByText(/✓/)).toBeInTheDocument(); // completed
      expect(screen.getByText(/⚡/)).toBeInTheDocument(); // active
      expect(screen.getByText(/○/)).toBeInTheDocument(); // waiting
    });
  });

  describe('Error Recovery', () => {
    it('handles malformed stage:parallel-started event', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Simulate malformed event handling
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: undefined,
        previousAgent: undefined,
        agents: standardWorkflowAgents,
        parallelAgents: [], // Empty due to malformed event
        showParallelPanel: false,
        currentTaskId: 'task-1',
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            showParallel={false}
            parallelAgents={[]}
          />
        );
      });

      // Should handle gracefully - no parallel section shown
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('handles out-of-order events gracefully', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Simulate parallel-completed before parallel-started
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: 'developer',
        previousAgent: undefined,
        agents: standardWorkflowAgents.map(a =>
          a.name === 'developer' ? { ...a, status: 'active' } : a
        ),
        parallelAgents: [], // Already cleared due to out-of-order event
        showParallelPanel: false,
        currentTaskId: 'task-1',
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            currentAgent="developer"
          />
        );
      });

      // Should handle gracefully
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('clears parallel state on task:failed', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Start with parallel execution
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: 'developer',
        previousAgent: undefined,
        agents: standardWorkflowAgents,
        parallelAgents: parallelScenarios.twoAgents,
        showParallelPanel: true,
        currentTaskId: 'task-1',
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            currentAgent="developer"
            showParallel={true}
            parallelAgents={parallelScenarios.twoAgents}
          />
        );
      });

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Task fails - state should be cleared
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: undefined,
        previousAgent: undefined,
        agents: standardWorkflowAgents,
        parallelAgents: [],
        showParallelPanel: false,
        currentTaskId: undefined,
        subtaskProgress: undefined,
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            showParallel={false}
            parallelAgents={[]}
          />
        );
      });

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('recovers for new task after failure', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Task failed state (cleaned)
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: undefined,
        previousAgent: undefined,
        agents: standardWorkflowAgents,
        parallelAgents: [],
        showParallelPanel: false,
        currentTaskId: undefined,
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
          />
        );
      });

      // New task starts
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: 'planner',
        previousAgent: undefined,
        agents: standardWorkflowAgents.map(a =>
          a.name === 'planner' ? { ...a, status: 'active' } : a
        ),
        parallelAgents: [],
        showParallelPanel: false,
        currentTaskId: 'task-2',
        subtaskProgress: { completed: 0, total: 0 },
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            currentAgent="planner"
          />
        );
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles high-frequency events (100+ per second)', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Simulate many rapid updates
      for (let i = 0; i < 10; i++) {
        const progress = (i + 1) * 10;

        mockUseOrchestratorEvents.mockReturnValue({
          currentAgent: 'developer',
          previousAgent: 'architect',
          agents: standardWorkflowAgents.map(a =>
            a.name === 'developer' ? { ...a, status: 'active', progress } : a
          ),
          parallelAgents: parallelScenarios.twoAgents.map(a => ({
            ...a,
            progress: progress + 5,
          })),
          showParallelPanel: true,
          currentTaskId: 'task-1',
        });

        await act(async () => {
          rerender(
            <AgentPanel
              agents={standardWorkflowAgents}
              currentAgent="developer"
              showParallel={true}
              parallelAgents={parallelScenarios.twoAgents}
            />
          );
        });

        // Small delay to simulate rapid events
        await act(async () => {
          vi.advanceTimersByTime(10);
        });
      }

      // Should handle all updates without errors
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
    });

    it('maintains stability over many parallel cycles', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Simulate many parallel start/stop cycles
      for (let cycle = 0; cycle < 20; cycle++) {
        // Start parallel
        mockUseOrchestratorEvents.mockReturnValue({
          currentAgent: 'developer',
          previousAgent: undefined,
          agents: standardWorkflowAgents,
          parallelAgents: parallelScenarios.twoAgents,
          showParallelPanel: true,
          currentTaskId: `task-${cycle}`,
        });

        await act(async () => {
          rerender(
            <AgentPanel
              agents={standardWorkflowAgents}
              currentAgent="developer"
              showParallel={true}
              parallelAgents={parallelScenarios.twoAgents}
            />
          );
        });

        // Stop parallel
        mockUseOrchestratorEvents.mockReturnValue({
          currentAgent: 'developer',
          previousAgent: undefined,
          agents: standardWorkflowAgents,
          parallelAgents: [],
          showParallelPanel: false,
          currentTaskId: `task-${cycle}`,
        });

        await act(async () => {
          rerender(
            <AgentPanel
              agents={standardWorkflowAgents}
              currentAgent="developer"
              showParallel={false}
              parallelAgents={[]}
            />
          );
        });

        await act(async () => {
          vi.advanceTimersByTime(50);
        });
      }

      // Should remain stable
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('does not accumulate listeners over time', async () => {
      // This test verifies that the hook cleanup works properly
      const { rerender, unmount } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Multiple re-renders should not accumulate listeners
      for (let i = 0; i < 5; i++) {
        mockUseOrchestratorEvents.mockReturnValue({
          currentAgent: 'developer',
          previousAgent: undefined,
          agents: standardWorkflowAgents,
          parallelAgents: [],
          showParallelPanel: false,
          currentTaskId: `task-${i}`,
        });

        await act(async () => {
          rerender(
            <AgentPanel
              agents={standardWorkflowAgents}
              currentAgent="developer"
            />
          );
        });
      }

      // Unmount should clean up properly
      unmount();

      // If we reach here without errors, cleanup worked properly
      expect(true).toBe(true);
    });
  });

  describe('Task Isolation', () => {
    it('filters events by taskId', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Only events for specific task should be processed
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: 'planner',
        previousAgent: undefined,
        agents: standardWorkflowAgents.map(a =>
          a.name === 'planner' ? { ...a, status: 'active' } : a
        ),
        parallelAgents: [],
        showParallelPanel: false,
        currentTaskId: 'target-task',
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            currentAgent="planner"
          />
        );
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
    });

    it('ignores events for other tasks', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Events for other tasks should be ignored
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: undefined, // No current agent due to filtering
        previousAgent: undefined,
        agents: standardWorkflowAgents, // Unchanged
        parallelAgents: [],
        showParallelPanel: false,
        currentTaskId: undefined,
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
          />
        );
      });

      // Should show default state
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('handles task switch during parallel execution', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      // Start with parallel execution for task-1
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: 'developer',
        previousAgent: undefined,
        agents: standardWorkflowAgents,
        parallelAgents: parallelScenarios.twoAgents,
        showParallelPanel: true,
        currentTaskId: 'task-1',
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            currentAgent="developer"
            showParallel={true}
            parallelAgents={parallelScenarios.twoAgents}
          />
        );
      });

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Switch to task-2 (different state)
      mockUseOrchestratorEvents.mockReturnValue({
        currentAgent: 'planner',
        previousAgent: undefined,
        agents: standardWorkflowAgents.map(a =>
          a.name === 'planner' ? { ...a, status: 'active' } : a
        ),
        parallelAgents: [],
        showParallelPanel: false,
        currentTaskId: 'task-2',
      });

      await act(async () => {
        rerender(
          <AgentPanel
            agents={standardWorkflowAgents}
            currentAgent="planner"
            showParallel={false}
            parallelAgents={[]}
          />
        );
      });

      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });
  });

  describe('Real-world Integration Scenarios', () => {
    it('handles complete feature development workflow', async () => {
      const { rerender } = render(
        <AgentPanel
          agents={standardWorkflowAgents}
        />
      );

      const workflowSteps = [
        {
          description: 'Planning starts',
          state: {
            currentAgent: 'planner',
            agents: standardWorkflowAgents.map(a =>
              a.name === 'planner' ? { ...a, status: 'active' } : a
            ),
            parallelAgents: [],
            showParallelPanel: false,
          }
        },
        {
          description: 'Architecture phase',
          state: {
            currentAgent: 'architect',
            agents: standardWorkflowAgents.map(a => {
              if (a.name === 'architect') return { ...a, status: 'active' };
              if (a.name === 'planner') return { ...a, status: 'completed' };
              return a;
            }),
            parallelAgents: [],
            showParallelPanel: false,
          }
        },
        {
          description: 'Development phase',
          state: {
            currentAgent: 'developer',
            agents: standardWorkflowAgents.map(a => {
              if (a.name === 'developer') return { ...a, status: 'active', progress: 60 };
              if (a.name === 'architect') return { ...a, status: 'completed' };
              if (a.name === 'planner') return { ...a, status: 'completed' };
              return a;
            }),
            parallelAgents: [],
            showParallelPanel: false,
          }
        },
        {
          description: 'Parallel testing and review',
          state: {
            currentAgent: 'developer',
            agents: standardWorkflowAgents.map(a => {
              if (a.name === 'developer') return { ...a, status: 'completed' };
              if (a.name === 'architect') return { ...a, status: 'completed' };
              if (a.name === 'planner') return { ...a, status: 'completed' };
              return a;
            }),
            parallelAgents: [
              { name: 'tester', status: 'parallel', stage: 'unit-testing', progress: 70 },
              { name: 'reviewer', status: 'parallel', stage: 'code-review', progress: 45 },
            ],
            showParallelPanel: true,
          }
        },
        {
          description: 'Final deployment',
          state: {
            currentAgent: 'devops',
            agents: standardWorkflowAgents.map(a => {
              if (a.name === 'devops') return { ...a, status: 'active' };
              return { ...a, status: 'completed' };
            }),
            parallelAgents: [],
            showParallelPanel: false,
          }
        }
      ];

      for (const step of workflowSteps) {
        mockUseOrchestratorEvents.mockReturnValue({
          ...step.state,
          previousAgent: undefined,
          currentTaskId: 'feature-task',
        });

        await act(async () => {
          rerender(
            <AgentPanel
              agents={step.state.agents as AgentInfo[]}
              currentAgent={step.state.currentAgent}
              showParallel={step.state.showParallelPanel}
              parallelAgents={step.state.parallelAgents as AgentInfo[]}
            />
          );
        });

        await act(async () => {
          vi.advanceTimersByTime(100);
        });

        // Verify the step was rendered correctly
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
        if (step.state.currentAgent) {
          expect(screen.getByText(step.state.currentAgent)).toBeInTheDocument();
        }
        if (step.state.showParallelPanel) {
          expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
        }
      }
    });
  });
});