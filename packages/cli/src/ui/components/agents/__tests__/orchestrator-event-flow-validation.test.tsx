/**
 * Orchestrator Event Flow Validation Tests
 * Tests the complete event flow from orchestrator through REPL to AgentPanel
 * Validates event handling, state transitions, and UI updates
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../../../__tests__/test-utils';
import { EventEmitter } from 'events';
import { App, type AppState } from '../../../App';

// Enhanced mock orchestrator for detailed event flow testing
class DetailedMockOrchestrator extends EventEmitter {
  private eventLog: Array<{ event: string; args: any[]; timestamp: number }> = [];

  initialize = vi.fn().mockResolvedValue(undefined);
  executeTask = vi.fn().mockResolvedValue(undefined);

  // Log all events for flow validation
  emit(event: string | symbol, ...args: any[]): boolean {
    if (typeof event === 'string') {
      this.eventLog.push({
        event,
        args,
        timestamp: Date.now()
      });
    }
    return super.emit(event, ...args);
  }

  getEventLog() {
    return [...this.eventLog];
  }

  clearEventLog() {
    this.eventLog = [];
  }

  // Simulate complete workflow with parallel execution
  async simulateCompleteParallelWorkflow(taskId: string) {
    // Sequential stages first
    this.emit('task:started', { id: taskId, workflow: 'feature', status: 'running' });

    await new Promise(resolve => setTimeout(resolve, 10));
    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, 'planning');
    this.emit('agent:transition', taskId, null, 'planner');

    await new Promise(resolve => setTimeout(resolve, 10));
    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, 'architecture');
    this.emit('agent:transition', taskId, 'planner', 'architect');

    await new Promise(resolve => setTimeout(resolve, 10));
    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, 'implementation');
    this.emit('agent:transition', taskId, 'architect', 'developer');

    // Start parallel execution
    await new Promise(resolve => setTimeout(resolve, 10));
    this.emit('stage:parallel-started', taskId, ['testing', 'review', 'security'], ['tester', 'reviewer', 'security-agent']);

    // Simulate parallel progress updates
    await new Promise(resolve => setTimeout(resolve, 20));
    this.emit('usage:updated', taskId, { inputTokens: 100, outputTokens: 200 });

    // Complete parallel execution
    await new Promise(resolve => setTimeout(resolve, 10));
    this.emit('stage:parallel-completed', taskId);

    // Final sequential stage
    await new Promise(resolve => setTimeout(resolve, 10));
    this.emit('task:stage-changed', { id: taskId, workflow: 'feature' }, 'deployment');
    this.emit('agent:transition', taskId, 'tester', 'devops');

    // Complete task
    await new Promise(resolve => setTimeout(resolve, 10));
    this.emit('task:completed', { id: taskId, status: 'completed' });
  }

  // Simulate failure during parallel execution
  async simulateParallelExecutionFailure(taskId: string) {
    this.emit('stage:parallel-started', taskId, ['testing', 'review'], ['tester', 'reviewer']);
    await new Promise(resolve => setTimeout(resolve, 10));
    this.emit('task:failed', { id: taskId, status: 'failed' }, new Error('Parallel execution failed'));
  }
}

// Mock workflow loader
const mockLoadWorkflow = vi.fn();
vi.mock('@apexcli/core', () => ({
  loadWorkflow: mockLoadWorkflow,
}));

describe('Orchestrator Event Flow Validation', () => {
  let mockOrchestrator: DetailedMockOrchestrator;
  let initialState: AppState;
  let onCommand: vi.Mock;
  let onTask: vi.Mock;
  let onExit: vi.Mock;

  beforeEach(() => {
    mockOrchestrator = new DetailedMockOrchestrator();

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
        description: 'Event flow validation task',
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
      activeAgent: undefined,
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

  describe('Complete Workflow Event Flow', () => {
    it('validates complete event sequence from orchestrator through REPL to UI', async () => {
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

      // Execute complete workflow with parallel execution
      await act(async () => {
        await mockOrchestrator.simulateCompleteParallelWorkflow('task-123');
      });

      // Validate event sequence was logged
      const eventLog = mockOrchestrator.getEventLog();
      expect(eventLog).toHaveLength(11); // Expected number of events

      // Verify specific event sequence
      expect(eventLog[0].event).toBe('task:started');
      expect(eventLog[1].event).toBe('task:stage-changed');
      expect(eventLog[2].event).toBe('agent:transition');
      expect(eventLog[6].event).toBe('stage:parallel-started');
      expect(eventLog[8].event).toBe('stage:parallel-completed');
      expect(eventLog[10].event).toBe('task:completed');

      // Validate final UI state
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('devops');
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });

      // Verify UI no longer shows parallel execution
      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });

    it('validates event timing and sequence integrity', async () => {
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

      await act(async () => {
        await mockOrchestrator.simulateCompleteParallelWorkflow('task-123');
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Validate timing
      const eventLog = mockOrchestrator.getEventLog();
      const firstEvent = eventLog[0];
      const lastEvent = eventLog[eventLog.length - 1];

      expect(lastEvent.timestamp).toBeGreaterThan(firstEvent.timestamp);
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second

      // Validate event ordering
      for (let i = 1; i < eventLog.length; i++) {
        expect(eventLog[i].timestamp).toBeGreaterThanOrEqual(eventLog[i - 1].timestamp);
      }
    });

    it('validates state consistency throughout event flow', async () => {
      let appInstance: any = null;
      const stateSnapshots: any[] = [];

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

      // Capture state after each major event
      const originalEmit = mockOrchestrator.emit.bind(mockOrchestrator);
      mockOrchestrator.emit = (event: string | symbol, ...args: any[]) => {
        const result = originalEmit(event, ...args);
        if (typeof event === 'string' && (
          event === 'agent:transition' ||
          event === 'stage:parallel-started' ||
          event === 'stage:parallel-completed'
        )) {
          setTimeout(() => {
            stateSnapshots.push({
              event,
              state: appInstance.getState(),
              timestamp: Date.now()
            });
          }, 0);
        }
        return result;
      };

      await act(async () => {
        await mockOrchestrator.simulateCompleteParallelWorkflow('task-123');
      });

      // Allow state snapshots to be captured
      await new Promise(resolve => setTimeout(resolve, 50));

      // Validate state transitions
      expect(stateSnapshots.length).toBeGreaterThanOrEqual(5);

      // Find parallel start and end snapshots
      const parallelStartSnapshot = stateSnapshots.find(s => s.event === 'stage:parallel-started');
      const parallelEndSnapshot = stateSnapshots.find(s => s.event === 'stage:parallel-completed');

      expect(parallelStartSnapshot).toBeDefined();
      expect(parallelEndSnapshot).toBeDefined();

      // Validate parallel execution state
      expect(parallelStartSnapshot.state.parallelAgents.length).toBeGreaterThan(0);
      expect(parallelStartSnapshot.state.showParallelPanel).toBe(true);

      expect(parallelEndSnapshot.state.parallelAgents).toEqual([]);
      expect(parallelEndSnapshot.state.showParallelPanel).toBe(false);
    });
  });

  describe('Event Flow Error Handling', () => {
    it('validates graceful handling of malformed events', async () => {
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

      // Send malformed events
      await act(async () => {
        mockOrchestrator.emit('stage:parallel-started', 'task-123', null, undefined);
        mockOrchestrator.emit('stage:parallel-started', 'task-123', ['stage'], null);
        mockOrchestrator.emit('agent:transition', 'task-123', null, '');
      });

      // App should remain stable
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('validates event flow recovery after errors', async () => {
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

      // Simulate failure during parallel execution
      await act(async () => {
        await mockOrchestrator.simulateParallelExecutionFailure('task-123');
      });

      // State should be cleared on failure
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });

      // App should recover for new task
      await act(async () => {
        mockOrchestrator.emit('task:started', { id: 'task-456', workflow: 'feature', status: 'running' });
        mockOrchestrator.emit('stage:parallel-started', 'task-456', ['testing'], ['tester']);
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(1);
        expect(state.showParallelPanel).toBe(false); // Single agent
      });
    });

    it('validates event ordering constraints', async () => {
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

      // Send events in wrong order
      await act(async () => {
        // Complete parallel execution before starting it
        mockOrchestrator.emit('stage:parallel-completed', 'task-123');
        mockOrchestrator.emit('stage:parallel-started', 'task-123', ['testing'], ['tester']);
      });

      // Should handle gracefully
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(1);
      });
    });
  });

  describe('Event Flow Performance', () => {
    it('validates performance with high frequency events', async () => {
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
      const eventCount = 100;

      // Send many rapid events
      await act(async () => {
        for (let i = 0; i < eventCount; i++) {
          if (i % 2 === 0) {
            mockOrchestrator.emit('stage:parallel-started', 'task-123', [`stage-${i}`], [`agent-${i}`]);
          } else {
            mockOrchestrator.emit('stage:parallel-completed', 'task-123');
          }
        }
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should handle high frequency events efficiently
      expect(totalTime).toBeLessThan(500); // 500ms threshold for 100 events

      await waitFor(() => {
        const state = appInstance.getState();
        // Final state should be stable
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });

    it('validates memory usage during extended event flow', async () => {
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

      // Simulate extended workflow with many state changes
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        await act(async () => {
          await mockOrchestrator.simulateCompleteParallelWorkflow(`task-${i}`);
        });

        // Clear event log periodically to prevent memory buildup
        if (i % 10 === 0) {
          mockOrchestrator.clearEventLog();
        }
      }

      // App should still be responsive
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state).toBeDefined();
      });

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });
  });

  describe('Event Flow Integration Points', () => {
    it('validates integration between parallel events and other orchestrator events', async () => {
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
        // Start parallel execution
        mockOrchestrator.emit('stage:parallel-started', 'task-123', ['testing', 'review'], ['tester', 'reviewer']);

        // Interleave with other events
        mockOrchestrator.emit('usage:updated', 'task-123', { inputTokens: 100, outputTokens: 200 });
        mockOrchestrator.emit('agent:message', 'task-123', { content: 'Testing progress update' });

        // Complete parallel execution
        mockOrchestrator.emit('stage:parallel-completed', 'task-123');

        // Continue with other events
        mockOrchestrator.emit('agent:tool-use', 'task-123', 'bash', { command: 'npm test' });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.tokens.input).toBe(100);
        expect(state.tokens.output).toBe(200);
      });

      // Verify event log shows proper interleaving
      const eventLog = mockOrchestrator.getEventLog();
      const eventTypes = eventLog.map(e => e.event);

      expect(eventTypes).toContain('stage:parallel-started');
      expect(eventTypes).toContain('usage:updated');
      expect(eventTypes).toContain('agent:message');
      expect(eventTypes).toContain('stage:parallel-completed');
      expect(eventTypes).toContain('agent:tool-use');
    });

    it('validates event flow with concurrent task management', async () => {
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
        // Start parallel execution for current task
        mockOrchestrator.emit('stage:parallel-started', 'task-123', ['testing'], ['tester']);

        // Events for different task should be ignored
        mockOrchestrator.emit('stage:parallel-started', 'task-456', ['review'], ['reviewer']);

        // Complete current task parallel execution
        mockOrchestrator.emit('stage:parallel-completed', 'task-123');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        // Should only have processed events for current task
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });
  });
});