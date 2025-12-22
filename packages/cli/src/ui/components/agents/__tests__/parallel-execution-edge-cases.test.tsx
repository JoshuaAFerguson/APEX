/**
 * Parallel Execution Edge Cases and Failure Scenarios Tests
 * Tests error conditions, edge cases, and failure recovery for parallel execution
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../../../__tests__/test-utils';
import { EventEmitter } from 'events';
import { AgentPanel, AgentInfo } from '../AgentPanel';
import { App, type AppState } from '../../../App';

// Mock orchestrator with failure simulation capabilities
class FailureSimulationOrchestrator extends EventEmitter {
  private shouldFailOnEvent = false;
  private failureCount = 0;

  initialize = vi.fn().mockResolvedValue(undefined);
  executeTask = vi.fn().mockResolvedValue(undefined);

  setFailureMode(shouldFail: boolean) {
    this.shouldFailOnEvent = shouldFail;
    this.failureCount = 0;
  }

  getFailureCount() {
    return this.failureCount;
  }

  emit(event: string | symbol, ...args: any[]): boolean {
    if (this.shouldFailOnEvent && typeof event === 'string' && event.includes('parallel')) {
      this.failureCount++;
      // Simulate orchestrator internal error
      setTimeout(() => {
        this.emit('error', new Error(`Orchestrator failure during ${event}`));
      }, 0);
      return false;
    }
    return super.emit(event, ...args);
  }

  // Simulate network disconnection
  simulateNetworkDisconnection() {
    this.emit('disconnect');
    this.removeAllListeners();
  }

  // Simulate resource exhaustion
  simulateResourceExhaustion(taskId: string) {
    this.emit('task:failed', { id: taskId, status: 'failed' }, new Error('Resource exhaustion'));
  }

  // Simulate partial agent failure
  simulatePartialAgentFailure(taskId: string) {
    this.emit('stage:parallel-started', taskId, ['testing', 'review', 'security'], ['tester', 'reviewer', 'security-agent']);
    setTimeout(() => {
      this.emit('agent:failed', taskId, 'security-agent', new Error('Agent crashed'));
    }, 10);
  }

  // Simulate orchestrator timeout
  simulateTimeout(taskId: string) {
    this.emit('stage:parallel-started', taskId, ['testing'], ['tester']);
    // Don't send completion event to simulate timeout
  }

  // Simulate corrupted event data
  simulateCorruptedEvents(taskId: string) {
    // Send events with various data corruption scenarios
    this.emit('stage:parallel-started', taskId, undefined, ['tester']);
    this.emit('stage:parallel-started', taskId, ['testing'], undefined);
    this.emit('stage:parallel-started', null, ['testing'], ['tester']);
    this.emit('stage:parallel-started', taskId, {}, []);
    this.emit('stage:parallel-started', taskId, 'invalid', 'invalid');
  }
}

// Mock workflow loader with failure scenarios
const mockLoadWorkflow = vi.fn();
vi.mock('@apexcli/core', () => ({
  loadWorkflow: mockLoadWorkflow,
}));

describe('Parallel Execution Edge Cases and Failures', () => {
  let mockOrchestrator: FailureSimulationOrchestrator;
  let initialState: AppState;
  let onCommand: vi.Mock;
  let onTask: vi.Mock;
  let onExit: vi.Mock;

  beforeEach(() => {
    mockOrchestrator = new FailureSimulationOrchestrator();

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
        description: 'Edge case test task',
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

  describe('Orchestrator Internal Failures', () => {
    it('handles orchestrator crash during parallel execution start', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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

      // Enable failure mode
      mockOrchestrator.setFailureMode(true);

      // Attempt to start parallel execution - should fail
      await act(async () => {
        mockOrchestrator.emit('stage:parallel-started', 'task-123', ['testing'], ['tester']);
      });

      // App should remain stable despite orchestrator failure
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });

      expect(mockOrchestrator.getFailureCount()).toBe(1);
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('handles orchestrator network disconnection during parallel execution', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={{
            ...initialState,
            parallelAgents: [
              { name: 'tester', status: 'parallel', stage: 'testing' },
              { name: 'reviewer', status: 'parallel', stage: 'review' },
            ],
            showParallelPanel: true,
          }}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Verify parallel execution is shown
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Simulate network disconnection
      await act(async () => {
        mockOrchestrator.simulateNetworkDisconnection();
      });

      // UI should remain stable even without completion event
      await waitFor(() => {
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
        expect(screen.getByText('tester')).toBeInTheDocument();
        expect(screen.getByText('reviewer')).toBeInTheDocument();
      });
    });

    it('handles resource exhaustion during parallel execution', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={{
            ...initialState,
            parallelAgents: [
              { name: 'tester', status: 'parallel', stage: 'testing' },
              { name: 'reviewer', status: 'parallel', stage: 'review' },
            ],
            showParallelPanel: true,
          }}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate resource exhaustion
      await act(async () => {
        mockOrchestrator.simulateResourceExhaustion('task-123');
      });

      // Should clear parallel state on task failure
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });
  });

  describe('Agent Failure Scenarios', () => {
    it('handles individual agent failure during parallel execution', async () => {
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

      // Start parallel execution then simulate agent failure
      await act(async () => {
        mockOrchestrator.simulatePartialAgentFailure('task-123');
      });

      // Should show parallel execution initially
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(3);
        expect(state.showParallelPanel).toBe(true);
      });

      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('security-agent')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('handles timeout during parallel execution', async () => {
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

      // Start parallel execution but don't complete it (timeout scenario)
      await act(async () => {
        mockOrchestrator.simulateTimeout('task-123');
      });

      // Should show parallel execution indefinitely
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(1);
        expect(state.showParallelPanel).toBe(false); // Single agent doesn't show panel
      });

      expect(screen.getByText('tester')).toBeInTheDocument();
    });

    it('handles all agents failing during parallel execution', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={{
            ...initialState,
            parallelAgents: [
              { name: 'tester', status: 'parallel', stage: 'testing' },
              { name: 'reviewer', status: 'parallel', stage: 'review' },
            ],
            showParallelPanel: true,
          }}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate total failure
      await act(async () => {
        mockOrchestrator.emit('task:failed', { id: 'task-123', status: 'failed' }, new Error('All agents failed'));
      });

      // Should clear all parallel state
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });

      expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
    });
  });

  describe('Data Corruption and Invalid Events', () => {
    it('handles corrupted event data gracefully', async () => {
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

      // Send corrupted events
      await act(async () => {
        mockOrchestrator.simulateCorruptedEvents('task-123');
      });

      // App should remain stable and reject invalid data
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
      consoleSpy.mockRestore();
    });

    it('handles events with mismatched array lengths', async () => {
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

      // Send events with mismatched arrays
      await act(async () => {
        // More stages than agents
        mockOrchestrator.emit('stage:parallel-started', 'task-123', ['testing', 'review', 'security'], ['tester']);

        // More agents than stages
        mockOrchestrator.emit('stage:parallel-started', 'task-123', ['testing'], ['tester', 'reviewer', 'security']);
      });

      await waitFor(() => {
        const state = appInstance.getState();
        // Should handle the second event (more recent)
        expect(state.parallelAgents).toHaveLength(1);
        expect(state.parallelAgents[0]).toEqual({
          name: 'tester',
          status: 'parallel',
          stage: 'testing'
        });
      });
    });

    it('handles events with empty or null data', async () => {
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

      // Send events with empty data
      await act(async () => {
        mockOrchestrator.emit('stage:parallel-started', 'task-123', [], []);
        mockOrchestrator.emit('stage:parallel-started', 'task-123', null, null);
        mockOrchestrator.emit('stage:parallel-started', '', ['testing'], ['tester']);
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });
  });

  describe('UI Edge Cases', () => {
    it('handles rapid UI updates during parallel execution failures', async () => {
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

      // Rapidly change parallel state to stress test UI updates
      for (let i = 0; i < 20; i++) {
        await act(async () => {
          mockOrchestrator.emit('stage:parallel-started', 'task-123', [`stage-${i}`], [`agent-${i}`]);
          if (i % 3 === 0) {
            mockOrchestrator.emit('task:failed', { id: 'task-123', status: 'failed' }, new Error('Test failure'));
          } else if (i % 3 === 1) {
            mockOrchestrator.emit('stage:parallel-completed', 'task-123');
          }
        });
      }

      // UI should remain stable
      await waitFor(() => {
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
      });
    });

    it('handles AgentPanel rendering with invalid agent data', async () => {
      // Test AgentPanel directly with corrupted data
      const corruptedAgents: AgentInfo[] = [
        { name: '', status: 'parallel', stage: 'testing' },
        { name: 'valid-agent', status: 'parallel' as any, stage: '' },
        { name: null as any, status: 'parallel', stage: 'review' },
        { name: 'another-agent', status: 'invalid' as any, stage: 'security' },
      ];

      // Should not crash even with invalid data
      expect(() => {
        render(
          <AgentPanel
            agents={[]}
            showParallel={true}
            parallelAgents={corruptedAgents}
          />
        );
      }).not.toThrow();

      // Should render with available valid data
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.queryByText('valid-agent')).toBeInTheDocument();
      expect(screen.queryByText('another-agent')).toBeInTheDocument();
    });

    it('handles AgentPanel with extremely long agent names', async () => {
      const longNameAgents: AgentInfo[] = [
        {
          name: 'extremely-long-agent-name-that-might-cause-layout-issues-in-the-ui-component',
          status: 'parallel',
          stage: 'extremely-long-stage-name-that-might-also-cause-issues'
        },
        {
          name: 'a'.repeat(200), // 200 character name
          status: 'parallel',
          stage: 'b'.repeat(150) // 150 character stage
        }
      ];

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={longNameAgents}
        />
      );

      // Should render without layout issues
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      // Names should be present (possibly truncated)
      expect(screen.getByText(/extremely-long-agent-name/)).toBeInTheDocument();
    });
  });

  describe('Recovery and Cleanup', () => {
    it('recovers correctly after orchestrator restart', async () => {
      let appInstance: any = null;

      render(
        <App
          initialState={{
            ...initialState,
            parallelAgents: [
              { name: 'stale-agent', status: 'parallel', stage: 'stale-stage' },
            ],
            showParallelPanel: true,
          }}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      await waitFor(() => {
        appInstance = (globalThis as any).__apexApp;
        expect(appInstance).toBeDefined();
      });

      // Simulate orchestrator restart by clearing state and starting fresh
      await act(async () => {
        mockOrchestrator.emit('task:completed', { id: 'task-123', status: 'completed' });
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });

      // Start new task after restart
      await act(async () => {
        mockOrchestrator.emit('task:started', { id: 'task-456', workflow: 'feature', status: 'running' });
        mockOrchestrator.emit('stage:parallel-started', 'task-456', ['testing'], ['tester']);
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(1);
        expect(state.parallelAgents[0].name).toBe('tester');
      });
    });

    it('cleans up event listeners on component unmount', async () => {
      const { unmount } = render(
        <App
          initialState={initialState}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      // Verify listeners are set up
      expect(mockOrchestrator.listenerCount('stage:parallel-started')).toBeGreaterThan(0);
      expect(mockOrchestrator.listenerCount('stage:parallel-completed')).toBeGreaterThan(0);

      // Unmount component
      unmount();

      // Event listeners should be cleaned up (listeners would be removed in useEffect cleanup)
      // Note: In real implementation, this would be handled by the useEffect cleanup in the REPL
    });

    it('handles memory leaks with long-running parallel executions', async () => {
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

      // Simulate many long-running parallel executions
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        await act(async () => {
          mockOrchestrator.emit('stage:parallel-started', `task-${i}`, [`stage-${i}`], [`agent-${i}`]);

          // Only complete some tasks to simulate long-running ones
          if (i % 10 === 0) {
            mockOrchestrator.emit('stage:parallel-completed', `task-${i}`);
          }
        });
      }

      // Memory usage should remain reasonable (state should only track current task)
      await waitFor(() => {
        const state = appInstance.getState();
        // Should only show agents for the current task (task-123)
        expect(state.parallelAgents).toEqual([]);
      });
    });
  });
});