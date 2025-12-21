/**
 * End-to-end integration tests for orchestrator parallel execution events → UI updates
 * Tests the complete flow: Orchestrator → REPL → App State → AgentPanel rendering
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../../../../__tests__/test-utils';
import { EventEmitter } from 'events';
import { AgentPanel, AgentInfo } from '../AgentPanel';
import type { ApexOrchestrator } from '@apex/orchestrator';
import { App, type AppState } from '../../../App';

/**
 * Enhanced MockOrchestrator that simulates real parallel execution scenarios
 * with realistic timing and event sequences
 */
class RealisticMockOrchestrator extends EventEmitter {
  private isExecuting = false;

  initialize = vi.fn().mockResolvedValue(undefined);
  executeTask = vi.fn().mockResolvedValue(undefined);

  constructor() {
    super();
    this.setMaxListeners(50); // Support complex test scenarios
  }

  /**
   * Simulates a realistic workflow execution with parallel stages
   * Emits events in the same sequence as real orchestrator
   */
  async simulateRealisticWorkflowExecution(taskId: string) {
    if (this.isExecuting) {
      throw new Error('Already executing a workflow');
    }

    this.isExecuting = true;

    try {
      // Start task
      this.emit('task:started', { id: taskId, status: 'running' });

      // Sequential planning stage
      await this.simulateStageExecution('planning', 'planner', taskId, 100);

      // Sequential architecture stage
      await this.simulateStageExecution('architecture', 'architect', taskId, 150);

      // Parallel execution of implementation, testing, and security
      await this.simulateParallelStageExecution(taskId, [
        { name: 'implementation', agent: 'developer' },
        { name: 'testing', agent: 'tester' },
        { name: 'security-scan', agent: 'security-agent' }
      ], 200);

      // Sequential final stage
      await this.simulateStageExecution('deployment', 'devops', taskId, 100);

      // Complete task
      this.emit('task:completed', { id: taskId, status: 'completed' });

    } finally {
      this.isExecuting = false;
    }
  }

  /**
   * Simulates execution of a single sequential stage
   */
  private async simulateStageExecution(stageName: string, agentName: string, taskId: string, durationMs: number) {
    // Agent transition
    this.emit('agent:transition', taskId, null, agentName);

    // Stage change
    this.emit('task:stage-changed', { id: taskId }, stageName);

    // Simulate stage execution time
    await new Promise(resolve => setTimeout(resolve, durationMs));

    // Usage update
    this.emit('usage:updated', taskId, {
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      estimatedCost: 0.01
    });
  }

  /**
   * Simulates parallel execution of multiple stages
   */
  private async simulateParallelStageExecution(
    taskId: string,
    stages: Array<{ name: string, agent: string }>,
    baseDurationMs: number
  ) {
    const stageNames = stages.map(s => s.name);
    const agentNames = stages.map(s => s.agent);

    // Start parallel execution
    this.emit('stage:parallel-started', taskId, stageNames, agentNames);

    // Simulate different execution times for parallel stages (realistic)
    const stagePromises = stages.map(async (stage, index) => {
      const stageMs = baseDurationMs + (index * 50); // Staggered completion

      // Agent transition for this parallel stage
      this.emit('agent:transition', taskId, null, stage.agent);

      await new Promise(resolve => setTimeout(resolve, stageMs));

      // Usage update for this stage
      this.emit('usage:updated', taskId, {
        inputTokens: 100 + (index * 20),
        outputTokens: 50 + (index * 10),
        totalTokens: 150 + (index * 30),
        estimatedCost: 0.01 + (index * 0.005)
      });
    });

    // Wait for all parallel stages to complete
    await Promise.all(stagePromises);

    // End parallel execution
    this.emit('stage:parallel-completed', taskId);
  }

  /**
   * Simulates workflow execution failure during parallel stages
   */
  async simulateFailureDuringParallelExecution(taskId: string) {
    this.emit('task:started', { id: taskId, status: 'running' });

    // Start sequential stages
    await this.simulateStageExecution('planning', 'planner', taskId, 50);

    // Start parallel execution
    this.emit('stage:parallel-started', taskId, ['implementation', 'testing'], ['developer', 'tester']);

    // Simulate one stage succeeding, another failing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Emit failure
    this.emit('task:failed', { id: taskId, status: 'failed' }, new Error('Parallel stage failed'));
  }

  /**
   * Simulates high-frequency parallel execution changes (stress test)
   */
  async simulateRapidParallelChanges(taskId: string, iterations: number) {
    for (let i = 0; i < iterations; i++) {
      // Start parallel execution with different agent sets
      const agentCount = 2 + (i % 3); // 2-4 agents
      const stages = Array.from({ length: agentCount }, (_, j) => `stage-${i}-${j}`);
      const agents = Array.from({ length: agentCount }, (_, j) => `agent-${i}-${j}`);

      this.emit('stage:parallel-started', taskId, stages, agents);

      // Very short execution time
      await new Promise(resolve => setTimeout(resolve, 10));

      this.emit('stage:parallel-completed', taskId);

      // Brief gap between iterations
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  }
}

describe('Orchestrator to UI Integration Tests', () => {
  let mockOrchestrator: RealisticMockOrchestrator;
  let initialState: AppState;
  let onCommand: vi.Mock;
  let onTask: vi.Mock;
  let onExit: vi.Mock;

  beforeEach(() => {
    mockOrchestrator = new RealisticMockOrchestrator();

    initialState = {
      initialized: true,
      projectPath: '/test/project',
      config: {
        workflows: {
          'parallel-feature': {
            stages: [
              { name: 'planning', agent: 'planner' },
              { name: 'architecture', agent: 'architect' },
              { name: 'implementation', agent: 'developer' },
              { name: 'testing', agent: 'tester' },
              { name: 'security-scan', agent: 'security-agent' },
              { name: 'deployment', agent: 'devops' },
            ]
          }
        }
      } as any,
      orchestrator: mockOrchestrator as any,
      gitBranch: 'main',
      currentTask: {
        id: 'integration-test-task',
        description: 'End-to-end integration test',
        workflow: 'parallel-feature',
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
    mockOrchestrator.removeAllListeners();
  });

  describe('Complete Workflow Integration', () => {
    it('should handle complete workflow execution with parallel stages', async () => {
      let appInstance: any = null;
      const stateChanges: string[] = [];

      // Track all state changes
      const originalUpdateState = vi.fn();

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

      // Override updateState to track changes
      const originalUpdate = appInstance.updateState;
      appInstance.updateState = vi.fn((updates) => {
        if (updates.parallelAgents !== undefined) {
          stateChanges.push(`parallelAgents: ${updates.parallelAgents.length} agents`);
        }
        if (updates.showParallelPanel !== undefined) {
          stateChanges.push(`showParallelPanel: ${updates.showParallelPanel}`);
        }
        if (updates.activeAgent !== undefined) {
          stateChanges.push(`activeAgent: ${updates.activeAgent}`);
        }
        return originalUpdate.call(appInstance, updates);
      });

      // Execute realistic workflow
      const executionPromise = mockOrchestrator.simulateRealisticWorkflowExecution('integration-test-task');

      // Monitor state changes throughout execution
      await act(async () => {
        await executionPromise;
      });

      // Verify complete state progression
      await waitFor(() => {
        expect(stateChanges).toContain('parallelAgents: 3 agents'); // Parallel stage started
        expect(stateChanges).toContain('showParallelPanel: true'); // Panel shown
        expect(stateChanges).toContain('parallelAgents: 0 agents'); // Parallel stage completed
        expect(stateChanges).toContain('showParallelPanel: false'); // Panel hidden
      });

      // Verify UI reflects final state
      const finalState = appInstance.getState();
      expect(finalState.parallelAgents).toEqual([]);
      expect(finalState.showParallelPanel).toBe(false);
    }, 10000); // Longer timeout for realistic execution timing

    it('should maintain UI consistency during agent handoffs in parallel execution', async () => {
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
        mockOrchestrator.emit('stage:parallel-started',
          'integration-test-task',
          ['implementation', 'testing'],
          ['developer', 'tester']
        );
      });

      // Verify parallel state is set
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(2);
        expect(state.showParallelPanel).toBe(true);
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      });

      // Simulate agent transition during parallel execution
      await act(async () => {
        mockOrchestrator.emit('agent:transition', 'integration-test-task', 'planner', 'developer');
      });

      // Verify both parallel panel and active agent are updated
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.activeAgent).toBe('developer');
        expect(state.previousAgent).toBe('planner');
        expect(state.parallelAgents).toHaveLength(2); // Parallel state maintained
        expect(state.showParallelPanel).toBe(true);

        // Both UI sections should be visible
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
        expect(screen.getByText('developer')).toBeInTheDocument();
      });

      // Complete parallel execution
      await act(async () => {
        mockOrchestrator.emit('stage:parallel-completed', 'integration-test-task');
      });

      // Verify cleanup
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
        expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      });
    });

    it('should handle task failure during parallel execution gracefully', async () => {
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

      // Execute workflow that fails during parallel execution
      await act(async () => {
        await mockOrchestrator.simulateFailureDuringParallelExecution('integration-test-task');
      });

      // Verify state is cleaned up on failure
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
        expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance and Stress Testing', () => {
    it('should handle rapid parallel execution state changes without UI lag', async () => {
      let appInstance: any = null;
      const performanceMarks: number[] = [];

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

      // Monitor performance during rapid changes
      const startTime = performance.now();

      await act(async () => {
        await mockOrchestrator.simulateRapidParallelChanges('integration-test-task', 20);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete within reasonable time (under 1 second for 20 iterations)
      expect(totalTime).toBeLessThan(1000);

      // Final state should be consistent
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    }, 5000);

    it('should handle large number of parallel agents efficiently', async () => {
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

      // Create large parallel execution scenario
      const manyStages = Array.from({ length: 50 }, (_, i) => `stage-${i}`);
      const manyAgents = Array.from({ length: 50 }, (_, i) => `agent-${i}`);

      const startTime = performance.now();

      await act(async () => {
        mockOrchestrator.emit('stage:parallel-started',
          'integration-test-task',
          manyStages,
          manyAgents
        );
      });

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(50);
        expect(state.showParallelPanel).toBe(true);

        // UI should handle large numbers efficiently
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      });

      // Should process large dataset quickly
      expect(processingTime).toBeLessThan(100); // 100ms threshold

      // Cleanup
      await act(async () => {
        mockOrchestrator.emit('stage:parallel-completed', 'integration-test-task');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle typical development workflow with parallel testing and deployment preparation', async () => {
      let appInstance: any = null;
      const workflowEvents: string[] = [];

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

      // Track workflow progression
      mockOrchestrator.on('stage:parallel-started', () => workflowEvents.push('parallel-started'));
      mockOrchestrator.on('stage:parallel-completed', () => workflowEvents.push('parallel-completed'));
      mockOrchestrator.on('task:completed', () => workflowEvents.push('task-completed'));

      // Simulate realistic development workflow
      await act(async () => {
        // Planning
        mockOrchestrator.emit('task:started', { id: 'integration-test-task' });
        mockOrchestrator.emit('agent:transition', 'integration-test-task', null, 'planner');

        // Implementation complete, now parallel testing and docs
        mockOrchestrator.emit('stage:parallel-started',
          'integration-test-task',
          ['unit-tests', 'integration-tests', 'documentation', 'security-scan'],
          ['test-engineer', 'qa-engineer', 'tech-writer', 'security-analyst']
        );
      });

      // Verify parallel execution state
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(4);
        expect(state.showParallelPanel).toBe(true);

        // Check specific agents are shown
        expect(screen.getByText('test-engineer')).toBeInTheDocument();
        expect(screen.getByText('qa-engineer')).toBeInTheDocument();
        expect(screen.getByText('tech-writer')).toBeInTheDocument();
        expect(screen.getByText('security-analyst')).toBeInTheDocument();
      });

      // Complete parallel work
      await act(async () => {
        mockOrchestrator.emit('stage:parallel-completed', 'integration-test-task');
        mockOrchestrator.emit('agent:transition', 'integration-test-task', 'test-engineer', 'devops');
        mockOrchestrator.emit('task:completed', { id: 'integration-test-task' });
      });

      // Verify final cleanup
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
        expect(state.activeAgent).toBe('devops');
      });

      // Verify event sequence
      expect(workflowEvents).toContain('parallel-started');
      expect(workflowEvents).toContain('parallel-completed');
      expect(workflowEvents).toContain('task-completed');
    });

    it('should maintain correct state when switching between tasks with different parallel execution states', async () => {
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

      // Start parallel execution for first task
      await act(async () => {
        mockOrchestrator.emit('stage:parallel-started',
          'task-1',
          ['frontend', 'backend'],
          ['frontend-dev', 'backend-dev']
        );
      });

      // Verify first task parallel state (won't be shown because taskId doesn't match)
      await waitFor(() => {
        const state = appInstance.getState();
        // Since taskId is 'task-1' but current task is 'integration-test-task',
        // parallel state should not be updated
        expect(state.parallelAgents).toEqual([]);
      });

      // Start parallel execution for current task
      await act(async () => {
        mockOrchestrator.emit('stage:parallel-started',
          'integration-test-task', // Matches current task
          ['testing', 'documentation'],
          ['tester', 'tech-writer']
        );
      });

      // Verify current task parallel state is shown
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(2);
        expect(state.showParallelPanel).toBe(true);
      });

      // Complete current task parallel execution
      await act(async () => {
        mockOrchestrator.emit('stage:parallel-completed', 'integration-test-task');
      });

      // Verify cleanup
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    it('should recover gracefully from malformed parallel execution events', async () => {
      let appInstance: any = null;
      const consoleErrors: string[] = [];
      const originalError = console.error;
      console.error = (...args) => {
        consoleErrors.push(args.join(' '));
      };

      try {
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
          // Event with mismatched arrays
          mockOrchestrator.emit('stage:parallel-started',
            'integration-test-task',
            ['stage-a', 'stage-b', 'stage-c'], // 3 stages
            ['agent-a', 'agent-b'] // 2 agents
          );
        });

        // Should handle gracefully - take minimum length
        await waitFor(() => {
          const state = appInstance.getState();
          expect(state.parallelAgents).toHaveLength(2); // Min of 3 and 2
        });

        // Send event with empty arrays
        await act(async () => {
          mockOrchestrator.emit('stage:parallel-started',
            'integration-test-task',
            [],
            []
          );
        });

        // Should handle empty arrays
        await waitFor(() => {
          const state = appInstance.getState();
          expect(state.parallelAgents).toEqual([]);
          expect(state.showParallelPanel).toBe(false);
        });

      } finally {
        console.error = originalError;
      }
    });

    it('should handle rapid event emission without memory leaks', async () => {
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

      // Emit many events rapidly to test memory usage
      await act(async () => {
        for (let i = 0; i < 100; i++) {
          mockOrchestrator.emit('stage:parallel-started',
            'integration-test-task',
            [`stage-${i}`],
            [`agent-${i}`]
          );
          mockOrchestrator.emit('stage:parallel-completed', 'integration-test-task');
        }
      });

      // Final state should be clean
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });

      // Event listeners should still be working
      await act(async () => {
        mockOrchestrator.emit('stage:parallel-started',
          'integration-test-task',
          ['final-test'],
          ['final-agent']
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(1);
        expect(state.showParallelPanel).toBe(false); // Single agent doesn't show panel
      });
    });
  });
});