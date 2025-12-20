/**
 * Integration tests for REPL and orchestrator event handling
 * Tests the wiring between orchestrator events and AgentPanel updates
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../test-utils';
import React from 'react';
import { EventEmitter } from 'events';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import type { AgentInfo } from '../components/agents/AgentPanel';
import { App, type AppState } from '../App';

// Mock the orchestrator
class MockOrchestrator extends EventEmitter {
  initialize = vi.fn().mockResolvedValue(undefined);
  executeTask = vi.fn().mockResolvedValue(undefined);

  // Simulate orchestrator events
  simulateStageChange(taskId: string, stageName: string, agent: string) {
    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, stageName);
  }

  simulateParallelStart(taskId: string, stages: string[], agents: string[]) {
    this.emit('stage:parallel-started', taskId, stages, agents);
  }

  simulateParallelComplete(taskId: string) {
    this.emit('stage:parallel-completed', taskId);
  }

  simulateTaskComplete(task: any) {
    this.emit('task:completed', task);
  }

  simulateTaskFail(task: any, error: Error) {
    this.emit('task:failed', task, error);
  }

  simulateSubtaskCreated(subtask: any, parentTaskId: string) {
    this.emit('subtask:created', subtask, parentTaskId);
  }

  simulateSubtaskCompleted(subtask: any, parentTaskId: string) {
    this.emit('subtask:completed', subtask, parentTaskId);
  }
}

// Mock the loadWorkflow function
const mockLoadWorkflow = vi.fn();
vi.mock('@apexcli/core', () => ({
  loadWorkflow: mockLoadWorkflow,
}));

describe('REPL Orchestrator Integration', () => {
  let mockOrchestrator: MockOrchestrator;
  let initialState: AppState;
  let onCommand: vi.Mock;
  let onTask: vi.Mock;
  let onExit: vi.Mock;

  beforeEach(() => {
    mockOrchestrator = new MockOrchestrator();

    // Mock the workflow loading
    mockLoadWorkflow.mockResolvedValue({
      stages: [
        { name: 'planning', agent: 'planner' },
        { name: 'architecture', agent: 'architect' },
        { name: 'implementation', agent: 'developer' },
        { name: 'testing', agent: 'tester' },
        { name: 'review', agent: 'reviewer' },
      ]
    });

    initialState = {
      initialized: true,
      projectPath: '/test/project',
      config: {
        workflows: {
          feature: {
            stages: [
              { name: 'planning', agent: 'planner' },
              { name: 'architecture', agent: 'architect' },
              { name: 'implementation', agent: 'developer' },
              { name: 'testing', agent: 'tester' },
              { name: 'review', agent: 'reviewer' },
            ]
          }
        }
      } as any,
      orchestrator: mockOrchestrator as any,
      gitBranch: 'main',
      currentTask: {
        id: 'task-123',
        description: 'Test task',
        workflow: 'feature',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      messages: [],
      inputHistory: [],
      isProcessing: false,
      tokens: { input: 0, output: 0 },
      cost: 0,
      model: 'claude-3-sonnet',
      activeAgent: 'planner',
      sessionStartTime: new Date(),
      displayMode: 'normal',
    };

    onCommand = vi.fn();
    onTask = vi.fn();
    onExit = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Agent Handoff Events', () => {
    it('updates previousAgent and currentAgent on stage change', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={initialState}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      // Get app instance from global context
      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate stage change from planner to architect
      await act(async () => {
        mockOrchestrator.simulateStageChange('task-123', 'architecture', 'architect');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.previousAgent).toBe('planner');
        expect(state.activeAgent).toBe('architect');
      });
    });

    it('handles multiple rapid stage changes', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={initialState}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate rapid stage changes
      await act(async () => {
        mockOrchestrator.simulateStageChange('task-123', 'architecture', 'architect');
      });

      await act(async () => {
        mockOrchestrator.simulateStageChange('task-123', 'implementation', 'developer');
      });

      await act(async () => {
        mockOrchestrator.simulateStageChange('task-123', 'testing', 'tester');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.previousAgent).toBe('developer');
        expect(state.activeAgent).toBe('tester');
      });
    });

    it('gracefully handles workflow lookup failures', async () => {
      mockLoadWorkflow.mockRejectedValue(new Error('Workflow not found'));

      let appInstance: any = null;

      render(
        <App
          initialState={initialState}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Should not crash when workflow lookup fails
      await act(async () => {
        mockOrchestrator.simulateStageChange('task-123', 'unknown', 'unknown');
      });

      // State should remain unchanged
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('planner'); // Initial agent
        expect(state.previousAgent).toBeUndefined();
      });
    });
  });

  describe('Parallel Execution Events', () => {
    it('updates parallelAgents on parallel execution start', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={initialState}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate parallel execution start
      await act(async () => {
        mockOrchestrator.simulateParallelStart(
          'task-123',
          ['implementation', 'testing', 'review'],
          ['developer', 'tester', 'reviewer']
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([
          { name: 'developer', status: 'parallel', stage: 'implementation' },
          { name: 'tester', status: 'parallel', stage: 'testing' },
          { name: 'reviewer', status: 'parallel', stage: 'review' },
        ]);
        expect(state.showParallelPanel).toBe(true);
      });
    });

    it('clears parallelAgents on parallel execution completion', async () => {
      let appInstance: any = null;

      // Start with parallel agents in state
      const stateWithParallel = {
        ...initialState,
        parallelAgents: [
          { name: 'developer', status: 'parallel' as const },
          { name: 'tester', status: 'parallel' as const },
        ],
        showParallelPanel: true,
      };

      render(
        <App
          initialState={stateWithParallel}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate parallel execution completion
      await act(async () => {
        mockOrchestrator.simulateParallelComplete('task-123');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });

    it('only shows parallel panel for multiple agents', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={initialState}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate parallel execution with single agent
      await act(async () => {
        mockOrchestrator.simulateParallelStart(
          'task-123',
          ['implementation'],
          ['developer']
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([
          { name: 'developer', status: 'parallel', stage: 'implementation' },
        ]);
        expect(state.showParallelPanel).toBe(false); // Should not show for single agent
      });
    });
  });

  describe('Task Lifecycle Events', () => {
    it('clears agent state on task completion', async () => {
      let appInstance: any = null;

      // Start with agents in state
      const stateWithAgents = {
        ...initialState,
        previousAgent: 'planner',
        activeAgent: 'developer',
        parallelAgents: [
          { name: 'tester', status: 'parallel' as const },
        ],
        showParallelPanel: true,
        subtaskProgress: { completed: 5, total: 10 },
      };

      render(
        <App
          initialState={stateWithAgents}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate task completion
      await act(async () => {
        mockOrchestrator.simulateTaskComplete({
          id: 'task-123',
          status: 'completed',
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.subtaskProgress).toBeUndefined();
        expect(state.previousAgent).toBeUndefined();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });

    it('clears agent state on task failure', async () => {
      let appInstance: any = null;

      // Start with agents in state
      const stateWithAgents = {
        ...initialState,
        previousAgent: 'planner',
        activeAgent: 'developer',
        parallelAgents: [
          { name: 'tester', status: 'parallel' as const },
        ],
        showParallelPanel: true,
        subtaskProgress: { completed: 3, total: 8 },
      };

      render(
        <App
          initialState={stateWithAgents}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate task failure
      await act(async () => {
        mockOrchestrator.simulateTaskFail(
          { id: 'task-123', status: 'failed' },
          new Error('Task failed')
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.subtaskProgress).toBeUndefined();
        expect(state.previousAgent).toBeUndefined();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });

    it('resets subtask progress on task start', async () => {
      let appInstance: any = null;

      // Start with existing subtask progress
      const stateWithProgress = {
        ...initialState,
        subtaskProgress: { completed: 5, total: 10 },
      };

      render(
        <App
          initialState={stateWithProgress}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate new task start
      await act(async () => {
        mockOrchestrator.emit('task:started', {
          id: 'new-task-456',
          status: 'running',
        });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.subtaskProgress).toEqual({ completed: 0, total: 0 });
      });
    });
  });

  describe('Subtask Progress Tracking', () => {
    it('increments total on subtask creation', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={initialState}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate subtask creation
      await act(async () => {
        mockOrchestrator.simulateSubtaskCreated(
          { id: 'subtask-1' },
          'task-123'
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.subtaskProgress).toEqual({ completed: 0, total: 1 });
      });

      // Create another subtask
      await act(async () => {
        mockOrchestrator.simulateSubtaskCreated(
          { id: 'subtask-2' },
          'task-123'
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.subtaskProgress).toEqual({ completed: 0, total: 2 });
      });
    });

    it('increments completed on subtask completion', async () => {
      let appInstance: any = null;

      // Start with some subtasks
      const stateWithSubtasks = {
        ...initialState,
        subtaskProgress: { completed: 0, total: 3 },
      };

      render(
        <App
          initialState={stateWithSubtasks}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate subtask completion
      await act(async () => {
        mockOrchestrator.simulateSubtaskCompleted(
          { id: 'subtask-1' },
          'task-123'
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.subtaskProgress).toEqual({ completed: 1, total: 3 });
      });

      // Complete another subtask
      await act(async () => {
        mockOrchestrator.simulateSubtaskCompleted(
          { id: 'subtask-2' },
          'task-123'
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.subtaskProgress).toEqual({ completed: 2, total: 3 });
      });
    });
  });

  describe('App State Prop Passing', () => {
    it('passes correct props to AgentPanel', async () => {
      const { container } = render(
        <App
          initialState={{
            ...initialState,
            previousAgent: 'planner',
            activeAgent: 'developer',
            parallelAgents: [
              { name: 'tester', status: 'parallel', stage: 'testing' },
              { name: 'reviewer', status: 'parallel', stage: 'reviewing' },
            ],
            showParallelPanel: true,
          }}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      // AgentPanel should be rendered with current task
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Should show parallel execution section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });

    it('does not render AgentPanel without current task', () => {
      render(
        <App
          initialState={{
            ...initialState,
            currentTask: undefined,
          }}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      // AgentPanel should not be rendered without a current task
      expect(screen.queryByText('Active Agents')).not.toBeInTheDocument();
    });

    it('passes workflow agents correctly to AgentPanel', () => {
      render(
        <App
          initialState={initialState}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      // Should display agents from workflow configuration
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });
  });

  describe('Event Handler Error Resilience', () => {
    it('continues working after orchestrator event handler errors', async () => {
      // Mock console.warn to avoid test noise
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      let appInstance: any = null;

      render(
        <App
          initialState={initialState}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Force workflow lookup to fail
      mockLoadWorkflow.mockRejectedValueOnce(new Error('Network error'));

      // Should not crash the app
      await act(async () => {
        mockOrchestrator.simulateStageChange('task-123', 'architecture', 'architect');
      });

      // App should still be functional
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});