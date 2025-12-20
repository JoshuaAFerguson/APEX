/**
 * Comprehensive edge case tests for parallel execution functionality
 * Covers boundary conditions, error scenarios, and complex state transitions
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../../../../__tests__/test-utils';
import { EventEmitter } from 'events';
import { AgentPanel, AgentInfo } from '../AgentPanel';
import { App, type AppState } from '../../../App';
import { createMockOrchestrator } from './test-utils/MockOrchestrator';

describe('Parallel Execution Edge Cases - Comprehensive Testing', () => {
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;
  let initialState: AppState;
  let onCommand: vi.Mock;
  let onTask: vi.Mock;
  let onExit: vi.Mock;

  beforeEach(() => {
    mockOrchestrator = createMockOrchestrator();

    initialState = {
      initialized: true,
      projectPath: '/test/project',
      config: {
        workflows: {
          'edge-case-workflow': {
            stages: Array.from({ length: 20 }, (_, i) => ({
              name: `stage-${i}`,
              agent: `agent-${i}`
            }))
          }
        }
      } as any,
      orchestrator: mockOrchestrator as any,
      gitBranch: 'main',
      currentTask: {
        id: 'edge-case-test-task',
        description: 'Edge case testing task',
        workflow: 'edge-case-workflow',
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
      activeAgent: 'agent-0',
      sessionStartTime: new Date(),
      displayMode: 'normal',
    };

    onCommand = vi.fn();
    onTask = vi.fn();
    onExit = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockOrchestrator.cleanup();
  });

  describe('Boundary Conditions', () => {
    it('should handle maximum number of parallel agents', async () => {
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

      // Create maximum parallel scenario (100 agents)
      const maxStages = Array.from({ length: 100 }, (_, i) => `max-stage-${i}`);
      const maxAgents = Array.from({ length: 100 }, (_, i) => `max-agent-${i}`);

      const startTime = performance.now();

      await act(async () => {
        mockOrchestrator.simulateParallelStart('edge-case-test-task', maxStages, maxAgents);
      });

      const processingTime = performance.now() - startTime;

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(100);
        expect(state.showParallelPanel).toBe(true);

        // Should handle large dataset within performance bounds
        expect(processingTime).toBeLessThan(200); // 200ms for 100 agents
      });

      // UI should still be responsive
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Cleanup should also be fast
      const cleanupStartTime = performance.now();

      await act(async () => {
        mockOrchestrator.simulateParallelComplete('edge-case-test-task');
      });

      const cleanupTime = performance.now() - cleanupStartTime;

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
        expect(cleanupTime).toBeLessThan(100); // Cleanup should be fast
      });
    });

    it('should handle minimum parallel scenario (exactly 2 agents)', async () => {
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

      // Minimum parallel case - exactly 2 agents (should show panel)
      await act(async () => {
        mockOrchestrator.simulateParallelStart(
          'edge-case-test-task',
          ['stage-a', 'stage-b'],
          ['agent-a', 'agent-b']
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(2);
        expect(state.showParallelPanel).toBe(true); // 2 agents should show panel
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      });
    });

    it('should handle single agent scenario (should not show parallel panel)', async () => {
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

      // Single agent - should not trigger parallel panel
      await act(async () => {
        mockOrchestrator.simulateParallelStart(
          'edge-case-test-task',
          ['single-stage'],
          ['single-agent']
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(1);
        expect(state.showParallelPanel).toBe(false); // Single agent should not show panel
        expect(screen.queryByText('⟂ Parallel Execution')).not.toBeInTheDocument();
      });
    });
  });

  describe('Data Integrity and Validation', () => {
    it('should handle agents with special characters and unicode', async () => {
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

      // Test special characters and unicode in agent names
      await act(async () => {
        mockOrchestrator.simulateParallelStart(
          'edge-case-test-task',
          ['test-stage', 'deployment-stage', 'validation-stage'],
          ['🤖 AI-Agent', 'agent@domain.com', 'ägent-ünicode']
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(3);
        expect(state.parallelAgents[0].name).toBe('🤖 AI-Agent');
        expect(state.parallelAgents[1].name).toBe('agent@domain.com');
        expect(state.parallelAgents[2].name).toBe('ägent-ünicode');

        // UI should render special characters correctly
        expect(screen.getByText('🤖 AI-Agent')).toBeInTheDocument();
        expect(screen.getByText('agent@domain.com')).toBeInTheDocument();
        expect(screen.getByText('ägent-ünicode')).toBeInTheDocument();
      });
    });

    it('should handle very long agent and stage names', async () => {
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

      const longStageName = 'a'.repeat(1000); // 1000 character stage name
      const longAgentName = 'b'.repeat(1000); // 1000 character agent name

      await act(async () => {
        mockOrchestrator.simulateParallelStart(
          'edge-case-test-task',
          [longStageName, 'normal-stage'],
          [longAgentName, 'normal-agent']
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(2);
        expect(state.parallelAgents[0].name).toBe(longAgentName);
        expect(state.parallelAgents[0].stage).toBe(longStageName);

        // UI should handle long names (may be truncated but should not crash)
        expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      });
    });

    it('should preserve stage-agent mapping order', async () => {
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

      const stages = ['alpha-stage', 'beta-stage', 'gamma-stage', 'delta-stage'];
      const agents = ['alpha-agent', 'beta-agent', 'gamma-agent', 'delta-agent'];

      await act(async () => {
        mockOrchestrator.simulateParallelStart('edge-case-test-task', stages, agents);
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(4);

        // Verify each agent is mapped to correct stage
        stages.forEach((stage, index) => {
          const parallelAgent = state.parallelAgents[index];
          expect(parallelAgent.name).toBe(agents[index]);
          expect(parallelAgent.stage).toBe(stage);
          expect(parallelAgent.status).toBe('parallel');
        });
      });
    });
  });

  describe('Concurrent Access and Race Conditions', () => {
    it('should handle simultaneous parallel start and complete events', async () => {
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

      // Fire multiple events simultaneously
      await act(async () => {
        // Start parallel execution
        mockOrchestrator.simulateParallelStart(
          'edge-case-test-task',
          ['race-stage-1', 'race-stage-2'],
          ['race-agent-1', 'race-agent-2']
        );

        // Immediately complete (race condition)
        mockOrchestrator.simulateParallelComplete('edge-case-test-task');

        // Start another parallel execution
        mockOrchestrator.simulateParallelStart(
          'edge-case-test-task',
          ['new-stage-1', 'new-stage-2', 'new-stage-3'],
          ['new-agent-1', 'new-agent-2', 'new-agent-3']
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        // Should end up with the last parallel start state
        expect(state.parallelAgents).toHaveLength(3);
        expect(state.showParallelPanel).toBe(true);
        expect(state.parallelAgents[0].name).toBe('new-agent-1');
      });
    });

    it('should handle overlapping events from different task IDs', async () => {
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
        // Events from different task (should be ignored)
        mockOrchestrator.simulateParallelStart(
          'different-task-id',
          ['ignored-stage'],
          ['ignored-agent']
        );

        // Events from current task (should be processed)
        mockOrchestrator.simulateParallelStart(
          'edge-case-test-task',
          ['valid-stage-1', 'valid-stage-2'],
          ['valid-agent-1', 'valid-agent-2']
        );

        // More events from different task (should be ignored)
        mockOrchestrator.simulateParallelComplete('different-task-id');
      });

      await waitFor(() => {
        const state = appInstance.getState();
        // Should only process events for current task
        expect(state.parallelAgents).toHaveLength(2);
        expect(state.parallelAgents[0].name).toBe('valid-agent-1');
        expect(state.parallelAgents[1].name).toBe('valid-agent-2');
        expect(state.showParallelPanel).toBe(true);
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle rapid creation and destruction of parallel agents without memory leaks', async () => {
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

      // Rapid cycling to test for memory leaks
      for (let cycle = 0; cycle < 50; cycle++) {
        await act(async () => {
          // Create varying numbers of agents
          const agentCount = 3 + (cycle % 5); // 3-7 agents
          const stages = Array.from({ length: agentCount }, (_, i) => `cycle-${cycle}-stage-${i}`);
          const agents = Array.from({ length: agentCount }, (_, i) => `cycle-${cycle}-agent-${i}`);

          mockOrchestrator.simulateParallelStart('edge-case-test-task', stages, agents);

          // Very brief existence
          await new Promise(resolve => setTimeout(resolve, 1));

          mockOrchestrator.simulateParallelComplete('edge-case-test-task');
        });
      }

      // Final state should be clean
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });

      // Should still be responsive to new events
      await act(async () => {
        mockOrchestrator.simulateParallelStart(
          'edge-case-test-task',
          ['final-test'],
          ['final-agent']
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toHaveLength(1);
        expect(state.parallelAgents[0].name).toBe('final-agent');
      });
    });

    it('should handle extremely rapid event emission', async () => {
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

      const startTime = performance.now();

      // Fire 1000 events as fast as possible
      await act(async () => {
        for (let i = 0; i < 1000; i++) {
          mockOrchestrator.simulateParallelStart(
            'edge-case-test-task',
            [`rapid-stage-${i}`],
            [`rapid-agent-${i}`]
          );

          if (i % 10 === 9) { // Complete every 10th cycle
            mockOrchestrator.simulateParallelComplete('edge-case-test-task');
          }
        }
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle rapid events efficiently (under 1 second for 1000 events)
      expect(totalTime).toBeLessThan(1000);

      await waitFor(() => {
        const state = appInstance.getState();
        // Should be in a valid state (last incomplete cycle)
        expect(Array.isArray(state.parallelAgents)).toBe(true);
      });
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from corrupted state gracefully', async () => {
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

      // Manually corrupt state to test recovery
      await act(async () => {
        appInstance.updateState({
          parallelAgents: 'corrupted', // Invalid type
          showParallelPanel: 'true' // Invalid type
        });
      });

      // Send valid event - should recover gracefully
      await act(async () => {
        mockOrchestrator.simulateParallelStart(
          'edge-case-test-task',
          ['recovery-stage'],
          ['recovery-agent']
        );
      });

      await waitFor(() => {
        const state = appInstance.getState();
        // Should have recovered to valid state
        expect(Array.isArray(state.parallelAgents)).toBe(true);
        expect(state.parallelAgents).toHaveLength(1);
        expect(typeof state.showParallelPanel).toBe('boolean');
      });
    });

    it('should handle null and undefined values in events', async () => {
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

      const consoleErrors: string[] = [];
      const originalError = console.error;
      console.error = (...args) => consoleErrors.push(args.join(' '));

      try {
        await act(async () => {
          // Send events with null/undefined values
          mockOrchestrator.emit('stage:parallel-started', 'edge-case-test-task', null, null);
          mockOrchestrator.emit('stage:parallel-started', 'edge-case-test-task', undefined, undefined);
          mockOrchestrator.emit('stage:parallel-started', 'edge-case-test-task', ['valid-stage'], null);
          mockOrchestrator.emit('stage:parallel-started', 'edge-case-test-task', null, ['valid-agent']);
        });

        // Should handle invalid inputs gracefully without crashing
        await waitFor(() => {
          const state = appInstance.getState();
          expect(Array.isArray(state.parallelAgents)).toBe(true);
          // State might be empty or contain partial data, but should be valid
        });

      } finally {
        console.error = originalError;
      }
    });

    it('should maintain UI responsiveness during heavy parallel activity', async () => {
      let appInstance: any = null;
      let uiUpdateCount = 0;

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

      // Override updateState to count UI updates
      const originalUpdateState = appInstance.updateState;
      appInstance.updateState = (...args: any[]) => {
        uiUpdateCount++;
        return originalUpdateState.apply(appInstance, args);
      };

      // Generate heavy parallel activity
      const startTime = performance.now();

      await act(async () => {
        // Multiple parallel groups cycling rapidly
        for (let group = 0; group < 20; group++) {
          const stages = Array.from({ length: 10 }, (_, i) => `group-${group}-stage-${i}`);
          const agents = Array.from({ length: 10 }, (_, i) => `group-${group}-agent-${i}`);

          mockOrchestrator.simulateParallelStart('edge-case-test-task', stages, agents);

          await new Promise(resolve => setTimeout(resolve, 5)); // Brief delay

          mockOrchestrator.simulateParallelComplete('edge-case-test-task');
        }
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should maintain performance even with heavy activity
      expect(totalTime).toBeLessThan(2000); // Under 2 seconds for 20 groups

      // UI should still be responsive
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });

      // Should have processed UI updates efficiently
      expect(uiUpdateCount).toBeGreaterThan(0);
      expect(uiUpdateCount).toBeLessThan(100); // Should not be excessive
    });
  });
});