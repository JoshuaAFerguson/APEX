import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApexOrchestrator } from './index.js';
import { TaskStore } from './store.js';
import { WorkspaceManager } from './workspace-manager.js';
import { Task } from '@apex/core';

// Mock dependencies
vi.mock('./store.js');
vi.mock('./workspace-manager.js');
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn()
}));

const createMockTask = (options: {
  id?: string;
  preserveOnFailure?: boolean;
  strategy?: string;
} = {}): Task => ({
  id: options.id || `perf-task-${Math.random().toString(36).substring(7)}`,
  description: 'Performance test task',
  status: 'in-progress',
  agent: 'perf-agent',
  workflow: 'perf-workflow',
  createdAt: new Date(),
  updatedAt: new Date(),
  progress: {
    stage: 'testing',
    stageProgress: 1.0,
    overallProgress: 1.0
  },
  workspace: {
    strategy: options.strategy as any || 'container',
    path: `/perf/workspace/${options.id}`,
    cleanup: true,
    preserveOnFailure: options.preserveOnFailure
  },
  usage: { tokens: 50, cost: 0.002 },
  metadata: {}
});

describe('Container Cleanup Performance Tests', () => {
  let orchestrator: ApexOrchestrator;
  let mockStore: TaskStore;
  let mockWorkspaceManager: WorkspaceManager;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock console to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Create performance-optimized mock store
    mockStore = {
      addLog: vi.fn().mockResolvedValue(undefined),
      getTask: vi.fn(),
      updateTask: vi.fn()
    } as unknown as TaskStore;

    // Create performance-optimized mock workspace manager
    mockWorkspaceManager = {
      cleanupWorkspace: vi.fn().mockImplementation(async (taskId: string) => {
        // Simulate realistic cleanup time (50ms average)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        return undefined;
      })
    } as unknown as WorkspaceManager;

    // Create orchestrator
    orchestrator = new ApexOrchestrator({
      projectPath: '/perf/test/project'
    });

    // Inject mocked dependencies
    (orchestrator as any).store = mockStore;
    (orchestrator as any).workspaceManager = mockWorkspaceManager;

    // Mock effective config
    (orchestrator as any).effectiveConfig = {
      workspace: {
        cleanupOnComplete: true
      },
      git: {
        worktree: {
          preserveOnFailure: false
        }
      }
    };

    // Initialize to set up event listeners
    await orchestrator.initialize();
  });

  describe('concurrent task failure handling', () => {
    it('should handle 10 concurrent task failures efficiently', async () => {
      const startTime = Date.now();
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createMockTask({
          id: `concurrent-${i}`,
          preserveOnFailure: false
        })
      );

      // Emit all failures concurrently
      const failures = tasks.map(task =>
        new Promise<void>(resolve => {
          orchestrator.emit('task:failed', task, new Error(`Concurrent failure ${task.id}`));
          resolve();
        })
      );

      await Promise.all(failures);

      // Wait for all cleanup operations to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      const totalTime = Date.now() - startTime;

      // Verify all cleanups were called
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(10);

      // Should complete within reasonable time (allowing for concurrent execution)
      expect(totalTime).toBeLessThan(500); // Should be much faster than 10 * 100ms = 1000ms

      console.log(`10 concurrent failures handled in ${totalTime}ms`);
    });

    it('should handle 50 concurrent task failures without performance degradation', async () => {
      const startTime = Date.now();
      const tasks = Array.from({ length: 50 }, (_, i) =>
        createMockTask({
          id: `stress-${i}`,
          preserveOnFailure: i % 3 === 0 // Preserve every 3rd task
        })
      );

      // Emit all failures concurrently
      tasks.forEach(task => {
        orchestrator.emit('task:failed', task, new Error(`Stress test failure ${task.id}`));
      });

      // Wait for all operations to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      const totalTime = Date.now() - startTime;
      const expectedCleanupCount = tasks.filter(task => !task.workspace!.preserveOnFailure).length;

      // Verify correct number of cleanups
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(expectedCleanupCount);

      // Verify preservations
      const preservedCount = tasks.filter(task => task.workspace!.preserveOnFailure).length;
      expect(mockStore.addLog).toHaveBeenCalledTimes(preservedCount);

      // Should handle high load efficiently
      expect(totalTime).toBeLessThan(1000);

      console.log(`50 concurrent failures handled in ${totalTime}ms (${expectedCleanupCount} cleanups, ${preservedCount} preserved)`);
    });
  });

  describe('memory usage optimization', () => {
    it('should not leak memory with rapid task failures', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and fail many tasks rapidly
      for (let i = 0; i < 100; i++) {
        const task = createMockTask({
          id: `memory-test-${i}`,
          preserveOnFailure: false
        });

        orchestrator.emit('task:failed', task, new Error(`Memory test ${i}`));

        // Occasionally yield to event loop
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      // Wait for all operations to complete
      await new Promise(resolve => setTimeout(resolve, 150));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Verify all cleanups were called
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(100);

      // Memory increase should be reasonable (less than 50MB for 100 operations)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);

      console.log(`Memory increase for 100 rapid failures: ${Math.round(memoryIncrease / 1024 / 1024 * 100) / 100}MB`);
    });
  });

  describe('cleanup error handling performance', () => {
    it('should handle cleanup failures without blocking subsequent operations', async () => {
      let cleanupCallCount = 0;
      const startTime = Date.now();

      // Mock cleanup to fail for first few calls, then succeed
      vi.mocked(mockWorkspaceManager.cleanupWorkspace).mockImplementation(async (taskId: string) => {
        cleanupCallCount++;
        await new Promise(resolve => setTimeout(resolve, 50));

        if (cleanupCallCount <= 3) {
          throw new Error(`Simulated cleanup failure ${cleanupCallCount}`);
        }
        return undefined;
      });

      // Create tasks that will experience cleanup failures
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createMockTask({
          id: `cleanup-error-${i}`,
          preserveOnFailure: false
        })
      );

      // Emit all failures
      tasks.forEach(task => {
        orchestrator.emit('task:failed', task, new Error(`Test failure ${task.id}`));
      });

      // Wait for all operations
      await new Promise(resolve => setTimeout(resolve, 200));

      const totalTime = Date.now() - startTime;

      // All cleanup attempts should have been made
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(10);

      // Error handling should not significantly delay processing
      expect(totalTime).toBeLessThan(400);

      // Error logs should have been created for failed cleanups
      const errorLogCalls = vi.mocked(mockStore.addLog).mock.calls.filter(call =>
        call[1].level === 'warn' && call[1].message.includes('cleanup failed')
      );
      expect(errorLogCalls).toHaveLength(3); // First 3 should have failed

      console.log(`Handled 10 failures with 3 cleanup errors in ${totalTime}ms`);
    });
  });

  describe('preservation logging performance', () => {
    it('should handle preservation logging efficiently for many tasks', async () => {
      const startTime = Date.now();

      // Create tasks that will all be preserved
      const tasks = Array.from({ length: 25 }, (_, i) =>
        createMockTask({
          id: `preserve-perf-${i}`,
          preserveOnFailure: true,
          strategy: i % 3 === 0 ? 'worktree' : 'container' // Mix strategies
        })
      );

      // Emit all failures
      tasks.forEach(task => {
        orchestrator.emit('task:failed', task, new Error(`Preserve test ${task.id}`));
      });

      // Wait for all preservation logging
      await new Promise(resolve => setTimeout(resolve, 100));

      const totalTime = Date.now() - startTime;

      // No cleanups should have occurred
      expect(mockWorkspaceManager.cleanupWorkspace).not.toHaveBeenCalled();

      // All preservation logs should have been created
      expect(mockStore.addLog).toHaveBeenCalledTimes(25);

      // Preservation logging should be fast
      expect(totalTime).toBeLessThan(200);

      console.log(`Preserved 25 workspaces in ${totalTime}ms`);
    });

    it('should handle mixed preservation/cleanup scenarios efficiently', async () => {
      const startTime = Date.now();

      // Create mixed scenario: some preserve, some cleanup
      const tasks = Array.from({ length: 40 }, (_, i) => {
        const shouldPreserve = i % 4 === 0; // Preserve every 4th task
        return createMockTask({
          id: `mixed-perf-${i}`,
          preserveOnFailure: shouldPreserve,
          strategy: i % 2 === 0 ? 'container' : 'worktree'
        });
      });

      // Emit all failures
      tasks.forEach(task => {
        orchestrator.emit('task:failed', task, new Error(`Mixed test ${task.id}`));
      });

      // Wait for all operations
      await new Promise(resolve => setTimeout(resolve, 200));

      const totalTime = Date.now() - startTime;

      const preservedCount = tasks.filter(task => task.workspace!.preserveOnFailure).length;
      const cleanupCount = tasks.length - preservedCount;

      // Verify correct counts
      expect(mockWorkspaceManager.cleanupWorkspace).toHaveBeenCalledTimes(cleanupCount);
      expect(mockStore.addLog).toHaveBeenCalledTimes(preservedCount);

      // Mixed operations should be efficient
      expect(totalTime).toBeLessThan(400);

      console.log(`Mixed scenario: ${cleanupCount} cleanups + ${preservedCount} preservations in ${totalTime}ms`);
    });
  });

  describe('shouldPreserveOnFailure performance', () => {
    it('should make preservation decisions efficiently for many tasks', async () => {
      const startTime = Date.now();
      const decisions: boolean[] = [];

      // Test the decision logic performance
      for (let i = 0; i < 1000; i++) {
        const task = createMockTask({
          id: `decision-${i}`,
          strategy: i % 3 === 0 ? 'worktree' : 'container',
          preserveOnFailure: i % 5 === 0 ? true : undefined
        });

        const decision = (orchestrator as any).shouldPreserveOnFailure(task);
        decisions.push(decision);
      }

      const totalTime = Date.now() - startTime;

      // Decision making should be very fast
      expect(totalTime).toBeLessThan(50);

      // Verify decisions were made
      expect(decisions).toHaveLength(1000);

      console.log(`Made 1000 preservation decisions in ${totalTime}ms`);
    });
  });

  describe('event listener performance', () => {
    it('should handle rapid event emission without blocking', async () => {
      const startTime = Date.now();
      const eventCounts = { failures: 0, completions: 0 };

      // Create a mix of completion and failure events
      for (let i = 0; i < 100; i++) {
        const task = createMockTask({
          id: `rapid-${i}`,
          preserveOnFailure: i % 4 === 0
        });

        if (i % 2 === 0) {
          orchestrator.emit('task:failed', task, new Error(`Rapid failure ${i}`));
          eventCounts.failures++;
        } else {
          orchestrator.emit('task:completed', task);
          eventCounts.completions++;
        }

        // Yield occasionally to prevent blocking
        if (i % 20 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      }

      const emissionTime = Date.now() - startTime;

      // Event emission should be very fast
      expect(emissionTime).toBeLessThan(100);

      // Wait for all handlers to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      const totalTime = Date.now() - startTime;

      console.log(`Emitted ${eventCounts.failures + eventCounts.completions} events in ${emissionTime}ms, total processing ${totalTime}ms`);

      // Events should process efficiently
      expect(totalTime).toBeLessThan(600);
    });
  });
});