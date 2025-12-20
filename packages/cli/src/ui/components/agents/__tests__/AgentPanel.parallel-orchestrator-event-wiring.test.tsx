/**
 * Comprehensive tests for AgentPanel parallel execution wiring to orchestrator events
 * Tests the complete event flow from orchestrator → REPL → App state → AgentPanel UI
 *
 * Test Coverage:
 * - Orchestrator event emission and handling
 * - Real-time parallel execution state updates
 * - UI reflection of parallel agent status
 * - Event edge cases and error scenarios
 * - Performance with multiple concurrent agents
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../../../__tests__/test-utils';
import { EventEmitter } from 'events';
import { AgentPanel, AgentInfo } from '../AgentPanel';
import type { ApexOrchestrator } from '@apex/orchestrator';
import { App, type AppState } from '../../../App';

// Mock orchestrator with parallel execution events
class MockParallelOrchestrator extends EventEmitter {
  initialize = vi.fn().mockResolvedValue(undefined);
  executeTask = vi.fn().mockResolvedValue(undefined);

  // Orchestrator parallel execution events
  emitParallelStarted(taskId: string, stages: string[], agents: string[]) {
    this.emit('stage:parallel-started', taskId, stages, agents);
  }

  emitParallelCompleted(taskId: string) {
    this.emit('stage:parallel-completed', taskId);
  }

  emitStageChanged(taskId: string, stageName: string) {
    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, stageName);
  }

  emitAgentTransition(taskId: string, fromAgent: string | null, toAgent: string) {
    this.emit('agent:transition', taskId, fromAgent, toAgent);
  }

  emitTaskCompleted(task: any) {
    this.emit('task:completed', task);
  }

  emitTaskFailed(task: any, error: Error) {
    this.emit('task:failed', task, error);
  }

  emitUsageUpdate(taskId: string, usage: any) {
    this.emit('usage:updated', taskId, usage);
  }
}

// Mock workflow loader
const mockLoadWorkflow = vi.fn();
vi.mock('@apexcli/core', () => ({
  loadWorkflow: mockLoadWorkflow,
}));

describe('AgentPanel Parallel Orchestrator Event Wiring', () => {
  let mockOrchestrator: MockParallelOrchestrator;
  let initialState: AppState;
  let onCommand: vi.Mock;
  let onTask: vi.Mock;
  let onExit: vi.Mock;

  beforeEach(() => {
    mockOrchestrator = new MockParallelOrchestrator();

    // Mock workflow configuration
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
      gitBranch: 'main',
      currentTask: {
        id: 'task-123',
        description: 'Parallel execution test task',
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
      activeAgent: 'developer',
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

  describe('Orchestrator to REPL Event Flow', () => {
    it('receives parallel-started event and updates App state', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={initialState}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      // Get app instance for state inspection
      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Orchestrator emits parallel execution started
      await act(async () => {
        mockOrchestrator.emitParallelStarted(
          'task-123',
          ['testing', 'review', 'security-scan'],
          ['tester', 'reviewer', 'security-agent']
        );
      });

      // Verify App state is updated with parallel agents
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(3);
        expect(state.parallelAgents).toEqual([
          { name: 'tester', status: 'parallel', stage: 'testing' },
          { name: 'reviewer', status: 'parallel', stage: 'review' },
          { name: 'security-agent', status: 'parallel', stage: 'security-scan' },
        ]);
        expect(state.showParallelPanel).toBe(true);
      });
    });

    it('receives parallel-completed event and clears parallel state', async () => {
      let appInstance: any = null;

      // Start with parallel agents in state
      const stateWithParallel = {
        ...initialState,
        parallelAgents: [
          { name: 'tester', status: 'parallel' as const, stage: 'testing' },
          { name: 'reviewer', status: 'parallel' as const, stage: 'review' },
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

      // Orchestrator emits parallel execution completed
      await act(async () => {
        mockOrchestrator.emitParallelCompleted('task-123');
      });

      // Verify parallel state is cleared
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });

    it('propagates orchestrator events through REPL to AgentPanel UI', async () => {
      render(
        <App
          initialState={initialState}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      // Initial state - no parallel execution visible
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();

      // Orchestrator starts parallel execution
      await act(async () => {
        mockOrchestrator.emitParallelStarted(
          'task-123',
          ['testing', 'review'],
          ['tester', 'reviewer']
        );
      });

      // AgentPanel should now show parallel execution section
      await waitFor(() => {
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();
      });

      // Complete parallel execution
      await act(async () => {
        mockOrchestrator.emitParallelCompleted('task-123');
      });

      // Parallel section should disappear
      await waitFor(() => {
        expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      });
    });
  });

  describe('Real-time Parallel Execution Updates', () => {
    it('shows real-time updates as parallel agents are added/removed', async () => {
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

      // Start with two parallel agents
      await act(async () => {
        mockOrchestrator.emitParallelStarted(
          'task-123',
          ['testing', 'review'],
          ['tester', 'reviewer']
        );
      });

      await waitFor(() => {
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();
      });

      // Add more agents to parallel execution
      await act(async () => {
        mockOrchestrator.emitParallelStarted(
          'task-123',
          ['testing', 'review', 'security-scan', 'performance-test'],
          ['tester', 'reviewer', 'security-agent', 'performance-agent']
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(4);
        expect(screen.getByText('security-agent')).toBeInTheDocument();
        expect(screen.getByText('performance-agent')).toBeInTheDocument();
      });
    });

    it('handles rapid parallel state changes correctly', async () => {
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

      // Rapid parallel state changes
      await act(async () => {
        mockOrchestrator.emitParallelStarted(
          'task-123',
          ['testing'],
          ['tester']
        );
      });

      await act(async () => {
        mockOrchestrator.emitParallelStarted(
          'task-123',
          ['testing', 'review'],
          ['tester', 'reviewer']
        );
      });

      await act(async () => {
        mockOrchestrator.emitParallelCompleted('task-123');
      });

      await act(async () => {
        mockOrchestrator.emitParallelStarted(
          'task-123',
          ['deployment'],
          ['devops']
        );
      });

      // Final state should be single agent
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([
          { name: 'devops', status: 'parallel', stage: 'deployment' }
        ]);
        expect(state.showParallelPanel).toBe(false); // Single agent doesn't show parallel panel
      });
    });

    it('maintains parallel state during agent transitions', async () => {
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
        mockOrchestrator.emitParallelStarted(
          'task-123',
          ['testing', 'review'],
          ['tester', 'reviewer']
        );
      });

      // Simulate agent transition during parallel execution
      await act(async () => {
        mockOrchestrator.emitAgentTransition('task-123', 'developer', 'tester');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        // Parallel agents should remain
        expect(state.parallelAgents).toHaveLength(2);
        expect(state.showParallelPanel).toBe(true);
        // Active agent should be updated
        expect(state.activeAgent).toBe('tester');
        expect(state.previousAgent).toBe('developer');
      });
    });
  });

  describe('Parallel Execution Edge Cases', () => {
    it('handles orchestrator events with invalid taskId gracefully', async () => {
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

      // Send event with wrong taskId - should be ignored
      await act(async () => {
        mockOrchestrator.emitParallelStarted(
          'wrong-task-456',
          ['testing'],
          ['tester']
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });

    it('handles empty agent arrays in parallel events', async () => {
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

      // Send parallel-started with empty agents
      await act(async () => {
        mockOrchestrator.emitParallelStarted(
          'task-123',
          [],
          []
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });

    it('handles mismatched stage and agent arrays', async () => {
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

      // Send mismatched arrays (more stages than agents)
      await act(async () => {
        mockOrchestrator.emitParallelStarted(
          'task-123',
          ['testing', 'review', 'deployment'],
          ['tester', 'reviewer'] // Missing agent for deployment
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        // Should handle gracefully - take min length
        expect(state.parallelAgents).toHaveLength(2);
        expect(state.parallelAgents).toEqual([
          { name: 'tester', status: 'parallel', stage: 'testing' },
          { name: 'reviewer', status: 'parallel', stage: 'review' },
        ]);
      });
    });

    it('handles orchestrator connection loss during parallel execution', async () => {
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
        mockOrchestrator.emitParallelStarted(
          'task-123',
          ['testing', 'review'],
          ['tester', 'reviewer']
        );
      });

      // Verify parallel state is set
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(2);
      });

      // Simulate orchestrator error/disconnection
      await act(async () => {
        mockOrchestrator.emitTaskFailed(
          { id: 'task-123', status: 'failed' },
          new Error('Orchestrator connection lost')
        );
      });

      // Should clear parallel state on task failure
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });
  });

  describe('Performance with Multiple Parallel Agents', () => {
    it('handles high number of concurrent parallel agents efficiently', async () => {
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

      // Create large number of parallel agents
      const manyStages = Array.from({ length: 20 }, (_, i) => `stage-${i}`);
      const manyAgents = Array.from({ length: 20 }, (_, i) => `agent-${i}`);

      const startTime = Date.now();

      await act(async () => {
        mockOrchestrator.emitParallelStarted(
          'task-123',
          manyStages,
          manyAgents
        );
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(20);
        expect(state.showParallelPanel).toBe(true);

        // Performance check - should process within reasonable time
        expect(processingTime).toBeLessThan(100); // 100ms threshold
      });

      // Verify UI can handle many agents
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('agent-0')).toBeInTheDocument();
      expect(screen.getByText('agent-19')).toBeInTheDocument();
    });

    it('handles rapid parallel state updates without performance degradation', async () => {
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

      const startTime = Date.now();

      // Rapidly change parallel execution state 50 times
      for (let i = 0; i < 50; i++) {
        await act(async () => {
          if (i % 2 === 0) {
            mockOrchestrator.emitParallelStarted(
              'task-123',
              [`stage-${i}`],
              [`agent-${i}`]
            );
          } else {
            mockOrchestrator.emitParallelCompleted('task-123');
          }
        });
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should handle rapid updates efficiently
      expect(totalTime).toBeLessThan(1000); // 1 second threshold

      await waitFor(() => {
        const state = appInstance.getState();
        // Final state should be cleared (last operation was completion)
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });
  });

  describe('Integration with Agent Handoffs', () => {
    it('coordinates parallel execution with agent handoff animations', async () => {
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

      // Start with sequential execution
      await act(async () => {
        mockOrchestrator.emitStageChanged('task-123', 'implementation');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('developer');
      });

      // Transition to parallel execution during handoff
      await act(async () => {
        mockOrchestrator.emitAgentTransition('task-123', 'developer', 'tester');
        mockOrchestrator.emitParallelStarted(
          'task-123',
          ['testing', 'review'],
          ['tester', 'reviewer']
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('tester');
        expect(state.previousAgent).toBe('developer');
        expect(state.parallelAgents).toHaveLength(2);
        expect(state.showParallelPanel).toBe(true);
      });

      // Both handoff and parallel indicators should be visible
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('handles completion of parallel execution during agent handoff', async () => {
      let appInstance: any = null;

      // Start with parallel execution active
      const stateWithParallel = {
        ...initialState,
        parallelAgents: [
          { name: 'tester', status: 'parallel' as const, stage: 'testing' },
          { name: 'reviewer', status: 'parallel' as const, stage: 'review' },
        ],
        showParallelPanel: true,
        activeAgent: 'tester',
        previousAgent: 'developer',
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

      // Complete parallel execution and transition to next agent
      await act(async () => {
        mockOrchestrator.emitParallelCompleted('task-123');
        mockOrchestrator.emitAgentTransition('task-123', 'tester', 'devops');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
        expect(state.activeAgent).toBe('devops');
        expect(state.previousAgent).toBe('tester');
      });

      // Parallel section should be gone, handoff should continue
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      expect(screen.getByText('devops')).toBeInTheDocument();
    });
  });
});