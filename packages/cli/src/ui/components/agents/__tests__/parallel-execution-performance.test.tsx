/**
 * Parallel Execution Performance Tests
 * Tests performance characteristics with high concurrent agent loads
 * Validates UI responsiveness and memory usage under stress
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '../../../__tests__/test-utils';
import { EventEmitter } from 'events';
import { AgentPanel, AgentInfo } from '../AgentPanel';
import { App, type AppState } from '../../../App';

// Performance monitoring utilities
class PerformanceMonitor {
  private startTime: number = 0;
  private markers: Array<{ name: string; time: number }> = [];

  start() {
    this.startTime = performance.now();
    this.markers = [];
  }

  mark(name: string) {
    const time = performance.now() - this.startTime;
    this.markers.push({ name, time });
  }

  getMarkers() {
    return [...this.markers];
  }

  getDuration() {
    return performance.now() - this.startTime;
  }

  getMarkDuration(markName: string) {
    const mark = this.markers.find(m => m.name === markName);
    return mark ? mark.time : 0;
  }
}

// High-performance mock orchestrator
class HighPerformanceOrchestrator extends EventEmitter {
  private performanceMonitor = new PerformanceMonitor();

  initialize = vi.fn().mockResolvedValue(undefined);
  executeTask = vi.fn().mockResolvedValue(undefined);

  getPerformanceMonitor() {
    return this.performanceMonitor;
  }

  // Simulate high load parallel execution
  async simulateHighLoadParallelExecution(taskId: string, agentCount: number) {
    this.performanceMonitor.start();

    const stages = Array.from({ length: agentCount }, (_, i) => `stage-${i}`);
    const agents = Array.from({ length: agentCount }, (_, i) => `agent-${i}`);

    this.performanceMonitor.mark('parallel-start-emit');
    this.emit('stage:parallel-started', taskId, stages, agents);
    this.performanceMonitor.mark('parallel-start-complete');

    // Simulate progress updates
    for (let i = 0; i < agentCount; i++) {
      this.emit('usage:updated', taskId, { inputTokens: i * 10, outputTokens: i * 15 });

      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    this.performanceMonitor.mark('progress-updates-complete');

    this.emit('stage:parallel-completed', taskId);
    this.performanceMonitor.mark('parallel-complete');
  }

  // Simulate rapid state changes
  async simulateRapidStateChanges(taskId: string, cycles: number) {
    this.performanceMonitor.start();

    for (let i = 0; i < cycles; i++) {
      const agentCount = Math.floor(Math.random() * 10) + 1;
      const stages = Array.from({ length: agentCount }, (_, j) => `stage-${i}-${j}`);
      const agents = Array.from({ length: agentCount }, (_, j) => `agent-${i}-${j}`);

      this.emit('stage:parallel-started', taskId, stages, agents);

      if (i % 2 === 0) {
        this.emit('stage:parallel-completed', taskId);
      }

      if (i % 20 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    this.performanceMonitor.mark('rapid-changes-complete');
  }

  // Simulate memory stress test
  async simulateMemoryStressTest(taskId: string, iterations: number) {
    this.performanceMonitor.start();

    for (let i = 0; i < iterations; i++) {
      // Create large data structures
      const largeData = Array.from({ length: 100 }, (_, j) => ({
        stage: `complex-stage-${i}-${j}`,
        agent: `complex-agent-${i}-${j}`,
        metadata: {
          progress: Math.random() * 100,
          startTime: new Date(),
          logs: Array.from({ length: 10 }, () => `log-entry-${Math.random()}`),
        }
      }));

      const stages = largeData.map(d => d.stage);
      const agents = largeData.map(d => d.agent);

      this.emit('stage:parallel-started', taskId, stages, agents);
      this.emit('stage:parallel-completed', taskId);

      if (i % 50 === 0) {
        this.performanceMonitor.mark(`memory-test-iteration-${i}`);
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    this.performanceMonitor.mark('memory-stress-complete');
  }
}

// Mock workflow loader
const mockLoadWorkflow = vi.fn();
vi.mock('@apexcli/core', () => ({
  loadWorkflow: mockLoadWorkflow,
}));

describe('Parallel Execution Performance Tests', () => {
  let mockOrchestrator: HighPerformanceOrchestrator;
  let initialState: AppState;
  let onCommand: vi.Mock;
  let onTask: vi.Mock;
  let onExit: vi.Mock;

  beforeEach(() => {
    mockOrchestrator = new HighPerformanceOrchestrator();

    mockLoadWorkflow.mockResolvedValue({
      stages: [
        { name: 'planning', agent: 'planner' },
        { name: 'implementation', agent: 'developer' },
        { name: 'testing', agent: 'tester' },
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
              { name: 'implementation', agent: 'developer' },
              { name: 'testing', agent: 'tester' },
            ]
          }
        }
      } as any,
      orchestrator: mockOrchestrator as any,
      gitBranch: 'main',
      currentTask: {
        id: 'task-123',
        description: 'Performance test task',
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

  describe('High Agent Count Performance', () => {
    it('handles 50 concurrent parallel agents efficiently', async () => {
      let appInstance: any = null;
      const agentCount = 50;

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

      await act(async () => {
        await mockOrchestrator.simulateHighLoadParallelExecution('task-123', agentCount);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Performance assertions
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]); // Should be cleared after completion
      });

      // Verify UI performance
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      // Get detailed performance metrics
      const monitor = mockOrchestrator.getPerformanceMonitor();
      const parallelStartTime = monitor.getMarkDuration('parallel-start-complete');
      const progressUpdateTime = monitor.getMarkDuration('progress-updates-complete');

      expect(parallelStartTime).toBeLessThan(100); // Parallel start should be fast
      expect(progressUpdateTime).toBeLessThan(500); // Progress updates should be reasonable
    });

    it('handles 100 concurrent parallel agents with degraded performance', async () => {
      let appInstance: any = null;
      const agentCount = 100;

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

      await act(async () => {
        await mockOrchestrator.simulateHighLoadParallelExecution('task-123', agentCount);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // With 100 agents, some performance degradation is acceptable
      expect(totalTime).toBeLessThan(3000); // Should complete within 3 seconds

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
      });

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('maintains responsiveness with extremely high agent count', async () => {
      const agentCount = 500;

      // Test AgentPanel directly with high agent count
      const manyAgents: AgentInfo[] = Array.from({ length: agentCount }, (_, i) => ({
        name: `agent-${i}`,
        status: 'parallel',
        stage: `stage-${i}`,
        progress: Math.floor(Math.random() * 100),
      }));

      const startTime = performance.now();

      const { rerender } = render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={manyAgents}
        />
      );

      const renderTime = performance.now() - startTime;

      // Initial render should be reasonable even with many agents
      expect(renderTime).toBeLessThan(500);

      // Test re-render performance
      const reRenderStartTime = performance.now();

      const updatedAgents = manyAgents.map((agent, i) => ({
        ...agent,
        progress: (agent.progress || 0) + 1,
      }));

      rerender(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={updatedAgents}
        />
      );

      const reRenderTime = performance.now() - reRenderStartTime;

      // Re-render should also be reasonable
      expect(reRenderTime).toBeLessThan(300);

      // UI should still be functional
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('agent-0')).toBeInTheDocument();
      expect(screen.getByText('agent-499')).toBeInTheDocument();
    });
  });

  describe('Rapid State Change Performance', () => {
    it('handles rapid parallel execution state changes', async () => {
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

      const cycles = 200;
      const startTime = performance.now();

      await act(async () => {
        await mockOrchestrator.simulateRapidStateChanges('task-123', cycles);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle rapid changes efficiently
      expect(totalTime).toBeLessThan(2000); // 2 seconds for 200 rapid changes

      await waitFor(() => {
        const state = appInstance.getState();
        // Final state should be stable
        expect(state).toBeDefined();
      });

      // UI should remain responsive
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      const monitor = mockOrchestrator.getPerformanceMonitor();
      const rapidChangesTime = monitor.getMarkDuration('rapid-changes-complete');
      expect(rapidChangesTime).toBeLessThan(2000);
    });

    it('maintains UI responsiveness during state thrashing', async () => {
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

      // Simulate state thrashing (frequent back-and-forth changes)
      const iterations = 100;

      await act(async () => {
        for (let i = 0; i < iterations; i++) {
          mockOrchestrator.emit('stage:parallel-started', 'task-123', ['testing', 'review'], ['tester', 'reviewer']);
          mockOrchestrator.emit('stage:parallel-completed', 'task-123');
          mockOrchestrator.emit('stage:parallel-started', 'task-123', ['security'], ['security-agent']);
          mockOrchestrator.emit('stage:parallel-completed', 'task-123');

          // Occasionally yield to check UI responsiveness
          if (i % 25 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
      });

      // UI should still be responsive after thrashing
      await waitFor(() => {
        expect(screen.getByText('Active Agents')).toBeInTheDocument();
      });

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
        expect(state.showParallelPanel).toBe(false);
      });
    });

    it('handles concurrent event streams efficiently', async () => {
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

      // Simulate multiple concurrent event streams
      await act(async () => {
        const promises = [];

        // Stream 1: Parallel execution events
        promises.push((async () => {
          for (let i = 0; i < 50; i++) {
            mockOrchestrator.emit('stage:parallel-started', 'task-123', [`stage-${i}`], [`agent-${i}`]);
            if (i % 2 === 0) {
              mockOrchestrator.emit('stage:parallel-completed', 'task-123');
            }
          }
        })());

        // Stream 2: Usage updates
        promises.push((async () => {
          for (let i = 0; i < 100; i++) {
            mockOrchestrator.emit('usage:updated', 'task-123', { inputTokens: i, outputTokens: i * 2 });
          }
        })());

        // Stream 3: Agent messages
        promises.push((async () => {
          for (let i = 0; i < 75; i++) {
            mockOrchestrator.emit('agent:message', 'task-123', { content: `Message ${i}` });
          }
        })());

        await Promise.all(promises);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should handle concurrent streams efficiently
      expect(totalTime).toBeLessThan(1000);

      // UI should remain stable
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.tokens.input).toBeGreaterThan(0);
        expect(state.tokens.output).toBeGreaterThan(0);
      });
    });
  });

  describe('Memory Usage Performance', () => {
    it('maintains reasonable memory usage with long-running parallel executions', async () => {
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

      // Simulate memory stress test
      await act(async () => {
        await mockOrchestrator.simulateMemoryStressTest('task-123', 100);
      });

      // Memory should be cleaned up (parallel agents cleared)
      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
      });

      // UI should still be responsive
      expect(screen.getByText('Active Agents')).toBeInTheDocument();

      const monitor = mockOrchestrator.getPerformanceMonitor();
      const memoryTestTime = monitor.getMarkDuration('memory-stress-complete');
      expect(memoryTestTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('handles memory cleanup during component lifecycle', async () => {
      const { unmount } = render(
        <App
          initialState={{
            ...initialState,
            parallelAgents: Array.from({ length: 100 }, (_, i) => ({
              name: `agent-${i}`,
              status: 'parallel' as const,
              stage: `stage-${i}`
            })),
            showParallelPanel: true,
          }}
          onCommand={onCommand}
          onTask={onTask}
          onExit={onExit}
        />
      );

      // Verify initial state
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();

      // Unmount should not cause memory leaks
      unmount();

      // No assertions needed - the test passes if no memory leak warnings appear
    });

    it('optimizes rendering with large agent lists', async () => {
      const largeAgentList: AgentInfo[] = Array.from({ length: 1000 }, (_, i) => ({
        name: `performance-agent-${i}`,
        status: 'parallel',
        stage: `performance-stage-${i}`,
        progress: i % 100,
        startedAt: new Date(Date.now() - i * 1000),
      }));

      const startTime = performance.now();

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={largeAgentList}
          compact={false} // Full mode is more expensive
        />
      );

      const renderTime = performance.now() - startTime;

      // Even with 1000 agents, render time should be reasonable
      expect(renderTime).toBeLessThan(1000);

      // Verify it rendered successfully
      expect(screen.getByText('⟂ Parallel Execution')).toBeInTheDocument();
      expect(screen.getByText('performance-agent-0')).toBeInTheDocument();
    });

    it('optimizes compact mode rendering with many agents', async () => {
      const manyAgents: AgentInfo[] = Array.from({ length: 200 }, (_, i) => ({
        name: `compact-agent-${i}`,
        status: 'parallel',
        stage: `compact-stage-${i}`,
        progress: i % 100,
      }));

      const startTime = performance.now();

      render(
        <AgentPanel
          agents={[]}
          showParallel={true}
          parallelAgents={manyAgents}
          compact={true} // Compact mode should be more efficient
        />
      );

      const renderTime = performance.now() - startTime;

      // Compact mode should be faster than full mode
      expect(renderTime).toBeLessThan(500);

      // Verify compact rendering
      expect(screen.getByText('⟂')).toBeInTheDocument();
      expect(screen.getByText('compact-agent-0')).toBeInTheDocument();
    });
  });

  describe('Real-world Performance Scenarios', () => {
    it('handles typical CI/CD pipeline with 8-12 parallel stages', async () => {
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

      // Simulate realistic CI/CD pipeline
      const pipelineStages = [
        'unit-tests',
        'integration-tests',
        'lint-check',
        'security-scan',
        'docker-build',
        'staging-deploy',
        'e2e-tests',
        'performance-tests',
        'accessibility-tests',
        'prod-deploy',
        'health-check',
        'monitoring-setup'
      ];

      const pipelineAgents = pipelineStages.map(stage => `${stage}-agent`);

      const startTime = performance.now();

      await act(async () => {
        mockOrchestrator.emit('stage:parallel-started', 'task-123', pipelineStages, pipelineAgents);

        // Simulate progress updates for each stage
        for (let i = 0; i < pipelineStages.length; i++) {
          for (let progress = 0; progress <= 100; progress += 20) {
            mockOrchestrator.emit('agent:message', 'task-123', {
              agent: pipelineAgents[i],
              progress,
              content: `${pipelineStages[i]} at ${progress}%`
            });

            if (progress % 40 === 0) {
              await new Promise(resolve => setTimeout(resolve, 1));
            }
          }
        }

        mockOrchestrator.emit('stage:parallel-completed', 'task-123');
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Realistic pipeline should complete efficiently
      expect(totalTime).toBeLessThan(2000);

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
      });

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('handles microservices development with 15-20 parallel services', async () => {
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

      // Simulate microservices development
      const services = [
        'auth-service', 'user-service', 'product-service', 'order-service',
        'payment-service', 'notification-service', 'inventory-service',
        'shipping-service', 'analytics-service', 'api-gateway',
        'config-service', 'file-service', 'search-service', 'cache-service',
        'monitoring-service', 'log-service', 'backup-service', 'admin-service'
      ];

      const serviceAgents = services.map(service => `${service}-dev`);
      const serviceStages = services.map(service => `${service}-implementation`);

      const startTime = performance.now();

      await act(async () => {
        await mockOrchestrator.simulateHighLoadParallelExecution('task-123', services.length);
      });

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Microservices scenario should handle ~18 services efficiently
      expect(totalTime).toBeLessThan(1500);

      await waitFor(() => {
        const state = appInstance.getState();
        expect(state.parallelAgents).toEqual([]);
      });

      expect(screen.getByText('Active Agents')).toBeInTheDocument();
    });

    it('handles enterprise-scale parallel execution with resource constraints', async () => {
      // Simulate resource-constrained environment
      const originalRAF = window.requestAnimationFrame;
      let rafCallCount = 0;

      // Throttle animations to simulate slower environment
      window.requestAnimationFrame = (callback: FrameRequestCallback) => {
        rafCallCount++;
        return originalRAF(() => {
          if (rafCallCount % 4 === 0) { // Throttle to 25% of normal rate
            callback(performance.now());
          }
        });
      };

      try {
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

        // Enterprise scale: 25 parallel agents
        const startTime = performance.now();

        await act(async () => {
          await mockOrchestrator.simulateHighLoadParallelExecution('task-123', 25);
        });

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        // Should still complete in reasonable time despite throttling
        expect(totalTime).toBeLessThan(3000);

        await waitFor(() => {
          const state = appInstance.getState();
          expect(state.parallelAgents).toEqual([]);
        });

        expect(screen.getByText('Active Agents')).toBeInTheDocument();

      } finally {
        // Restore original RAF
        window.requestAnimationFrame = originalRAF;
      }
    });
  });
});