/**
 * Complete End-to-end tests for agent handoff flow
 * Tests the entire integration from orchestrator events to UI display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../test-utils';
import React from 'react';
import { EventEmitter } from 'events';
import type { ApexOrchestrator } from '@apexcli/orchestrator';
import { App, type AppState } from '../App';

// Mock orchestrator that can simulate real event flow
class MockOrchestrator extends EventEmitter {
  initialize = vi.fn().mockResolvedValue(undefined);
  executeTask = vi.fn().mockResolvedValue(undefined);

  // Simulate a complete workflow execution with agent handoffs
  async simulateWorkflowExecution(taskId: string) {
    // Start task
    this.emit('task:started', { id: taskId, workflow: 'feature', status: 'running' });
    await new Promise(resolve => setTimeout(resolve, 10));

    // Planning stage
    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, 'planning');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Architecture stage
    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, 'architecture');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Implementation stage
    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, 'implementation');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Parallel testing and review
    this.emit('stage:parallel-started', taskId, ['testing', 'review'], ['tester', 'reviewer']);
    await new Promise(resolve => setTimeout(resolve, 150));
    this.emit('stage:parallel-completed', taskId);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Final deployment stage
    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, 'deployment');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Complete task
    this.emit('task:completed', { id: taskId, status: 'completed' });
  }

  // Simulate parallel execution scenario
  async simulateParallelExecution(taskId: string) {
    this.emit('task:started', { id: taskId, workflow: 'feature', status: 'running' });

    // Single agent phase
    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, 'planning');
    await new Promise(resolve => setTimeout(resolve, 50));

    // Transition to parallel execution
    this.emit('stage:parallel-started', taskId,
      ['implementation', 'testing', 'documentation'],
      ['developer', 'tester', 'tech-writer']);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Complete parallel execution
    this.emit('stage:parallel-completed', taskId);
    await new Promise(resolve => setTimeout(resolve, 50));

    // Back to single agent
    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, 'deployment');
    await new Promise(resolve => setTimeout(resolve, 50));

    this.emit('task:completed', { id: taskId, status: 'completed' });
  }

  // Simulate error and recovery scenario
  async simulateErrorRecovery(taskId: string) {
    this.emit('task:started', { id: taskId, workflow: 'feature', status: 'running' });

    // Normal progression
    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, 'planning');
    await new Promise(resolve => setTimeout(resolve, 50));

    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, 'implementation');
    await new Promise(resolve => setTimeout(resolve, 50));

    // Simulate failure
    this.emit('task:failed', { id: taskId, status: 'failed' }, new Error('Implementation failed'));
    await new Promise(resolve => setTimeout(resolve, 50));

    // Recovery - restart from planning
    this.emit('task:started', { id: `${taskId}-retry`, workflow: 'feature', status: 'running' });
    this.emit('task:stage-changed', { id: `${taskId}-retry`, workflow: 'feature' }, 'planning');
  }
}

// Mock the loadWorkflow function with realistic workflow
const mockLoadWorkflow = vi.fn();
vi.mock('@apexcli/core', () => ({
  loadWorkflow: mockLoadWorkflow,
}));

describe('Agent Handoff Complete End-to-End Tests', () => {
  let mockOrchestrator: MockOrchestrator;
  let initialState: AppState;
  let onCommand: vi.Mock;
  let onTask: vi.Mock;
  let onExit: vi.Mock;

  beforeEach(() => {
    mockOrchestrator = new MockOrchestrator();

    mockLoadWorkflow.mockResolvedValue({
      stages: [
        { name: 'planning', agent: 'planner' },
        { name: 'architecture', agent: 'architect' },
        { name: 'implementation', agent: 'developer' },
        { name: 'testing', agent: 'tester' },
        { name: 'review', agent: 'reviewer' },
        { name: 'deployment', agent: 'devops' },
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
              { name: 'deployment', agent: 'devops' },
            ]
          }
        }
      } as any,
      orchestrator: mockOrchestrator as any,
      gitBranch: 'feature/test-handoff',
      currentTask: {
        id: 'task-e2e-123',
        description: 'Test end-to-end agent handoff',
        workflow: 'feature',
        status: 'running',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      messages: [],
      inputHistory: [],
      isProcessing: false,
      tokens: { input: 100, output: 200 },
      cost: 0.05,
      model: 'claude-3-sonnet',
      sessionStartTime: new Date(),
    };

    onCommand = vi.fn();
    onTask = vi.fn();
    onExit = vi.fn();

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('complete workflow execution', () => {
    it('shows complete agent handoff flow through entire workflow', async () => {
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

      // Start the workflow simulation
      await act(async () => {
        await mockOrchestrator.simulateWorkflowExecution('task-e2e-123');
      });

      // Fast-forward all timers to complete handoff animations
      act(() => {
        vi.advanceTimersByTime(10000);
      });

      // Final state should show clean completion
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.subtaskProgress).toBeUndefined();
        expect(state.previousAgent).toBeUndefined();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });

      // Should display the complete agent workflow
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
    });

    it('displays handoff animations during transitions', async () => {
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

      // Manually trigger individual transitions to observe handoff animations
      await act(async () => {
        mockOrchestrator.emit('task:started', { id: 'task-e2e-123', workflow: 'feature' });
      });

      // Planning to Architecture transition
      await act(async () => {
        mockOrchestrator.emit('task:stage-changed',
          { id: 'task-e2e-123', workflow: 'feature' }, 'planning');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('planner');
      });

      await act(async () => {
        mockOrchestrator.emit('task:stage-changed',
          { id: 'task-e2e-123', workflow: 'feature' }, 'architecture');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.previousAgent).toBe('planner');
        expect(state.activeAgent).toBe('architect');
      });

      // The handoff animation should be active (checked via AgentPanel integration)
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('architect')).toBeInTheDocument();
    });

    it('handles rapid sequential handoffs without state corruption', async () => {
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

      // Rapid succession of stage changes
      const stages = ['planning', 'architecture', 'implementation', 'testing', 'review'];
      const agents = ['planner', 'architect', 'developer', 'tester', 'reviewer'];

      await act(async () => {
        for (let i = 0; i < stages.length; i++) {
          mockOrchestrator.emit('task:stage-changed',
            { id: 'task-e2e-123', workflow: 'feature' }, stages[i]);
          // Small delay to ensure events are processed
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.previousAgent).toBe('tester');
        expect(state.activeAgent).toBe('reviewer');
      });

      // UI should still be stable
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('reviewer')).toBeInTheDocument();
    });
  });

  describe('parallel execution scenarios', () => {
    it('shows parallel execution with proper handoff integration', async () => {
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

      await act(async () => {
        await mockOrchestrator.simulateParallelExecution('task-parallel-123');
      });

      // Fast-forward timers to see all transitions
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should end up in clean state
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });

    it('correctly transitions from single to parallel and back', async () => {
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

      // Start with single agent
      await act(async () => {
        mockOrchestrator.emit('task:started', { id: 'task-123', workflow: 'feature' });
        mockOrchestrator.emit('task:stage-changed',
          { id: 'task-123', workflow: 'feature' }, 'planning');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('planner');
        expect(state.parallelAgents).toEqual([]);
      });

      // Transition to parallel
      await act(async () => {
        mockOrchestrator.emit('stage:parallel-started', 'task-123',
          ['implementation', 'testing'], ['developer', 'tester']);
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(2);
        expect(state.showParallelPanel).toBe(true);
      });

      // Should show parallel section
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Return to single agent
      await act(async () => {
        mockOrchestrator.emit('stage:parallel-completed', 'task-123');
        mockOrchestrator.emit('task:stage-changed',
          { id: 'task-123', workflow: 'feature' }, 'deployment');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
        expect(state.activeAgent).toBe('devops');
      });

      // Parallel section should be hidden
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });
  });

  describe('error and recovery scenarios', () => {
    it('handles task failure and recovery gracefully', async () => {
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

      await act(async () => {
        await mockOrchestrator.simulateErrorRecovery('task-error-123');
      });

      // Should handle the failure and restart gracefully
      await waitFor(() => {
        const state = appInstance.getState();
        // After failure, state should be cleaned up
        // After restart, should show new active agent
        expect(state.activeAgent).toBe('planner');
      });
    });

    it('maintains UI stability during error conditions', async () => {
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

      // Normal operation
      await act(async () => {
        mockOrchestrator.emit('task:started', { id: 'task-123', workflow: 'feature' });
        mockOrchestrator.emit('task:stage-changed',
          { id: 'task-123', workflow: 'feature' }, 'implementation');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('developer');
      });

      // Simulate error
      await act(async () => {
        mockOrchestrator.emit('task:failed',
          { id: 'task-123', status: 'failed' }, new Error('Test error'));
      });

      // UI should remain stable
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.subtaskProgress).toBeUndefined();
        expect(state.previousAgent).toBeUndefined();
      });
    });
  });

  describe('real-time updates and performance', () => {
    it('handles high-frequency events without performance degradation', async () => {
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

      // Simulate high-frequency events (like token usage updates)
      await act(async () => {
        for (let i = 0; i < 100; i++) {
          mockOrchestrator.emit('usage:updated', 'task-123', {
            inputTokens: 100 + i,
            outputTokens: 200 + i * 2,
            estimatedCost: 0.01 * i,
          });

          if (i % 10 === 0) {
            // Occasional subtask events
            mockOrchestrator.emit('subtask:created', { id: `subtask-${i}` }, 'task-123');
          }

          if (i % 20 === 0) {
            // Occasional subtask completions
            mockOrchestrator.emit('subtask:completed', { id: `subtask-${i-10}` }, 'task-123');
          }
        }
      });

      // UI should still be responsive and showing current state
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.tokens.input).toBe(199);
        expect(state.tokens.output).toBe(398);
      });
    });

    it('maintains consistent state across component re-renders', async () => {
      let appInstance: any = null;
      const TestWrapper = ({ shouldRerender }: { shouldRerender: boolean }) => (
        <App
          initialState={initialState}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      const { rerender } = render(<TestWrapper shouldRerender={false} />);

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Start workflow
      await act(async () => {
        mockOrchestrator.emit('task:stage-changed',
          { id: 'task-123', workflow: 'feature' }, 'implementation');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('developer');
      });

      // Force component re-render
      rerender(<TestWrapper shouldRerender={true} />);

      // State should persist across re-renders
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('developer');
      });

      expect(screen.getByText('developer')).toBeInTheDocument();
    });
  });

  describe('integration with status bar and other components', () => {
    it('coordinates handoff display between AgentPanel and StatusBar', async () => {
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

      // Trigger agent handoff
      await act(async () => {
        mockOrchestrator.emit('task:stage-changed',
          { id: 'task-123', workflow: 'feature' }, 'planning');
      });

      await act(async () => {
        mockOrchestrator.emit('task:stage-changed',
          { id: 'task-123', workflow: 'feature' }, 'implementation');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.previousAgent).toBe('planner');
        expect(state.activeAgent).toBe('developer');
      });

      // Both AgentPanel and StatusBar should show consistent agent information
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      expect(screen.getByText('planner')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();

      // StatusBar should also show current agent
      expect(screen.getByText('developer')).toBeInTheDocument(); // In status bar
    });

    it('maintains consistent state during parallel execution across all components', async () => {
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

      // Start parallel execution
      await act(async () => {
        mockOrchestrator.emit('stage:parallel-started', 'task-123',
          ['implementation', 'testing'], ['developer', 'tester']);
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(2);
        expect(state.showParallelPanel).toBe(true);
      });

      // All components should reflect parallel state
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('developer')).toBeInTheDocument();
      expect(screen.getByText('tester')).toBeInTheDocument();
    });
  });
});