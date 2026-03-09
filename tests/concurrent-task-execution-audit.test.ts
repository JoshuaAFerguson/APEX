import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Comprehensive test suite for concurrent task execution implementation.
 * Validates the four acceptance criteria:
 * 1. runner.ts has maxConcurrentTasks config
 * 2. runningTasks Map tracks active tasks
 * 3. poll() respects concurrency limits
 * 4. daemon can run multiple tasks simultaneously
 */

// Mock fs early to avoid import issues
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: actual,
    createWriteStream: vi.fn(),
    promises: {
      ...actual.promises,
      writeFile: vi.fn()
    },
  };
});

// Import modules
let DaemonRunner: any;
let mockOrchestrator: any;
let mockStore: any;
let mockUsageManager: any;
let mockDaemonScheduler: any;
let mockCapacityMonitor: any;

describe('Concurrent Task Execution - Comprehensive Audit', () => {
  const testProjectPath = '/test/project';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock orchestrator
    mockOrchestrator = {
      initialize: vi.fn(),
      executeTask: vi.fn(),
      resumePausedTask: vi.fn(),
      on: vi.fn(),
      emit: vi.fn(),
      shutdown: vi.fn(),
      getGlobalActiveTaskCount: vi.fn().mockReturnValue(0),
      getGlobalWaiterCount: vi.fn().mockReturnValue(0),
    };

    // Mock store
    mockStore = {
      initialize: vi.fn(),
      close: vi.fn(),
      getTask: vi.fn(),
      updateTask: vi.fn(),
      updateTaskStatus: vi.fn(),
      addLog: vi.fn(),
      listTasks: vi.fn(),
      getReadyTasks: vi.fn().mockResolvedValue([]),
      countInProgressTasks: vi.fn().mockReturnValue(0),
      getSubtaskStatuses: vi.fn().mockReturnValue([]),
      getOrphanedTasks: vi.fn().mockReturnValue([]),
      getPausedTasksForResume: vi.fn().mockReturnValue([]),
      findHighestPriorityParentTask: vi.fn().mockReturnValue([]),
    };

    // Mock usage manager
    mockUsageManager = {
      trackTaskStart: vi.fn(),
      trackTaskCompletion: vi.fn(),
    };

    // Mock daemon scheduler
    mockDaemonScheduler = {
      shouldPauseTasks: vi.fn().mockReturnValue({
        shouldPause: false,
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.5, threshold: 0.90, shouldPause: false },
      }),
      getUsageStats: vi.fn().mockReturnValue({
        timeWindow: { mode: 'day', isActive: true, nextTransition: new Date() },
        capacity: { threshold: 0.9, currentPercentage: 0.5, shouldPause: false },
      }),
    };

    // Mock capacity monitor
    mockCapacityMonitor = {
      start: vi.fn(),
      stop: vi.fn(),
      on: vi.fn(),
      emit: vi.fn(),
    };

    // Set up mocks before importing
    vi.doMock('../packages/orchestrator/src/index', () => ({
      ApexOrchestrator: vi.fn().mockImplementation(() => mockOrchestrator),
    }));

    vi.doMock('../packages/orchestrator/src/store', () => ({
      TaskStore: vi.fn().mockImplementation(() => mockStore),
    }));

    vi.doMock('@apexcli/core', () => ({
      loadConfig: vi.fn().mockResolvedValue({}),
      getEffectiveConfig: vi.fn().mockReturnValue({
        limits: { maxConcurrentTasks: 3 },
        daemon: {},
      }),
    }));

    vi.doMock('../packages/orchestrator/src/usage-manager', () => ({
      UsageManager: vi.fn().mockImplementation(() => mockUsageManager),
    }));

    vi.doMock('../packages/orchestrator/src/daemon-scheduler', () => ({
      DaemonScheduler: vi.fn().mockImplementation(() => mockDaemonScheduler),
      UsageManagerProvider: vi.fn().mockImplementation(() => ({})),
    }));

    vi.doMock('../packages/orchestrator/src/capacity-monitor', () => ({
      CapacityMonitor: vi.fn().mockImplementation(() => mockCapacityMonitor),
    }));

    vi.doMock('../packages/orchestrator/src/capacity-monitor-usage-adapter', () => ({
      CapacityMonitorUsageAdapter: vi.fn().mockImplementation(() => ({})),
    }));

    // Mock the stream - set up the mock function
    const mockStreamObject = {
      write: vi.fn(),
      end: vi.fn((callback?: () => void) => callback?.()),
      destroyed: false,
    };

    // Import fs module to get access to mock
    const fs = await import('fs');
    (fs.createWriteStream as any) = vi.fn().mockReturnValue(mockStreamObject);

    // Mock process.on
    const originalOn = process.on;
    process.on = vi.fn() as any;

    // Now import DaemonRunner after mocks are set up
    const runnerModule = await import('../packages/orchestrator/src/runner');
    DaemonRunner = runnerModule.DaemonRunner;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * ACCEPTANCE CRITERIA 1: Verify runner.ts has maxConcurrentTasks config
   */
  describe('Acceptance Criteria 1: maxConcurrentTasks Configuration', () => {
    it('should accept maxConcurrentTasks in constructor options', () => {
      const testCases = [
        { maxConcurrentTasks: 1, expected: 1 },
        { maxConcurrentTasks: 3, expected: 3 },
        { maxConcurrentTasks: 10, expected: 10 },
        { maxConcurrentTasks: 0, expected: 0 }, // Use config value
      ];

      testCases.forEach(({ maxConcurrentTasks, expected }) => {
        const runner = new DaemonRunner({
          projectPath: testProjectPath,
          maxConcurrentTasks,
        });

        // Access private options through reflection
        const privateRunner = runner as any;
        expect(privateRunner.options.maxConcurrentTasks).toBe(expected);
      });
    });

    it('should use config maxConcurrentTasks when option is 0 or undefined', async () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 0, // Use config
      });

      await runner.start();

      // Access private options after initialization
      const privateRunner = runner as any;
      expect(privateRunner.options.maxConcurrentTasks).toBe(3); // From mocked config

      await runner.stop();
    });

    it('should handle edge cases for maxConcurrentTasks values', () => {
      const edgeCases = [
        Number.MAX_SAFE_INTEGER,
        -1, // Should be handled gracefully
        1.5, // Should work (JavaScript numbers)
      ];

      edgeCases.forEach(value => {
        expect(() => {
          new DaemonRunner({
            projectPath: testProjectPath,
            maxConcurrentTasks: value,
          });
        }).not.toThrow();
      });
    });

    it('should have maxConcurrentTasks accessible in options', () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 7,
      });

      const privateRunner = runner as any;
      expect(privateRunner.options.maxConcurrentTasks).toBe(7);
    });
  });

  /**
   * ACCEPTANCE CRITERIA 2: Verify runningTasks Map tracks active tasks
   */
  describe('Acceptance Criteria 2: runningTasks Map Tracking', () => {
    let runner: any;

    beforeEach(async () => {
      vi.useFakeTimers();
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });
      await runner.start();
    });

    afterEach(async () => {
      vi.useRealTimers();
      if (runner && (runner as any).isRunning) {
        await runner.stop();
      }
    });

    it('should have runningTasks as a Map instance', () => {
      const privateRunner = runner as any;
      expect(privateRunner.runningTasks).toBeDefined();
      expect(privateRunner.runningTasks instanceof Map).toBe(true);
      expect(privateRunner.runningTasks.size).toBe(0);
    });

    it('should track tasks when they start execution', async () => {
      const taskId = 'test-task-123';

      // Mock orchestrator to return a promise that doesn't resolve immediately
      const taskPromise = new Promise(resolve => setTimeout(resolve, 5000));
      mockOrchestrator.executeTask.mockReturnValue(taskPromise);

      // Start task by calling startTask directly
      const privateRunner = runner as any;
      privateRunner.startTask(taskId);

      const runningTasks = privateRunner.runningTasks;

      // Verify task is tracked
      expect(runningTasks.size).toBe(1);
      expect(runningTasks.has(taskId)).toBe(true);
      expect(runningTasks.get(taskId)).toBeInstanceOf(Promise);
    });

    it('should remove tasks from runningTasks when they complete', async () => {
      const taskId = 'test-task-complete';

      // Mock orchestrator to resolve immediately
      mockOrchestrator.executeTask.mockResolvedValue(undefined);

      // Start task
      const privateRunner = runner as any;
      privateRunner.startTask(taskId);

      // Wait for task to complete
      await vi.runAllTimersAsync();

      const runningTasks = privateRunner.runningTasks;

      // Verify task is removed after completion
      expect(runningTasks.size).toBe(0);
      expect(runningTasks.has(taskId)).toBe(false);
    });

    it('should remove tasks from runningTasks when they fail', async () => {
      const taskId = 'test-task-failed';

      // Mock orchestrator to reject
      mockOrchestrator.executeTask.mockRejectedValue(new Error('Task failed'));

      // Start task
      const privateRunner = runner as any;
      privateRunner.startTask(taskId);

      // Wait for task to fail
      await vi.runAllTimersAsync();

      const runningTasks = privateRunner.runningTasks;

      // Verify task is removed after failure
      expect(runningTasks.size).toBe(0);
      expect(runningTasks.has(taskId)).toBe(false);
    });

    it('should reflect runningTasks count in metrics', () => {
      // Mock long-running tasks
      mockOrchestrator.executeTask.mockReturnValue(
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      // Start tasks
      const privateRunner = runner as any;
      privateRunner.startTask('task-1');
      privateRunner.startTask('task-2');
      privateRunner.startTask('task-3');

      const metrics = runner.getMetrics();

      // Verify metrics reflect running tasks
      expect(metrics.activeTaskCount).toBe(3);
      expect(metrics.activeTaskIds).toEqual(['task-1', 'task-2', 'task-3']);
    });
  });

  /**
   * ACCEPTANCE CRITERIA 3: Verify poll() respects concurrency limits
   */
  describe('Acceptance Criteria 3: poll() Method Concurrency Limits', () => {
    let runner: any;

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(async () => {
      vi.useRealTimers();
      if (runner && (runner as any).isRunning) {
        await runner.stop();
      }
    });

    it('should not start more tasks than maxConcurrentTasks limit', async () => {
      const maxConcurrent = 2;
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: maxConcurrent,
      });

      await runner.start();

      // Mock long-running tasks
      mockOrchestrator.executeTask.mockReturnValue(
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      // Create many tasks
      const tasks = Array.from({ length: 5 }, (_, i) => ({
        id: `task-${i}`,
        description: `Test task ${i}`,
        status: 'pending',
      }));
      mockStore.getReadyTasks.mockResolvedValue(tasks);

      // Mock the store to simulate capacity limits
      mockStore.countInProgressTasks.mockReturnValue(maxConcurrent);

      // First poll should respect the limit
      await (runner as any).poll();

      // Since countInProgressTasks returns maxConcurrent, no tasks should start
      expect(mockOrchestrator.executeTask).not.toHaveBeenCalled();
    });

    it('should handle paused state and skip task starting', async () => {
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      await runner.start();

      // Mock scheduler to indicate capacity exceeded
      mockDaemonScheduler.shouldPauseTasks.mockReturnValue({
        shouldPause: true,
        reason: 'Capacity threshold exceeded',
        timeWindow: { mode: 'day', isActive: true },
        capacity: { currentPercentage: 0.95, threshold: 0.90, shouldPause: true },
      });

      // Try to start task while paused
      await (runner as any).poll();

      // Should not start tasks when paused
      expect(mockOrchestrator.executeTask).not.toHaveBeenCalled();
      expect(mockStore.getReadyTasks).not.toHaveBeenCalled();
    });

    it('should handle poll() when shutting down gracefully', async () => {
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      await runner.start();

      // Set shutdown state
      (runner as any).isShuttingDown = true;

      // Try to poll while shutting down
      await (runner as any).poll();

      // Should not start tasks when shutting down
      expect(mockOrchestrator.executeTask).not.toHaveBeenCalled();
      expect(mockStore.getReadyTasks).not.toHaveBeenCalled();
    });

    it('should start only one parent task per poll cycle', async () => {
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 5,
      });

      await runner.start();

      mockOrchestrator.executeTask.mockResolvedValue(undefined);

      // Create multiple tasks available
      const tasks = [
        { id: 'parent-1', description: 'Parent task 1' },
        { id: 'parent-2', description: 'Parent task 2' },
        { id: 'parent-3', description: 'Parent task 3' },
      ];
      mockStore.getReadyTasks.mockResolvedValue(tasks);
      mockStore.countInProgressTasks.mockReturnValue(0); // No capacity limit

      // Single poll should only start one task
      await (runner as any).poll();

      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(1);
      expect(mockOrchestrator.executeTask).toHaveBeenCalledWith('parent-1');
    });
  });

  /**
   * ACCEPTANCE CRITERIA 4: Verify daemon can run multiple tasks simultaneously
   */
  describe('Acceptance Criteria 4: Multiple Simultaneous Task Execution', () => {
    let runner: any;

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(async () => {
      vi.useRealTimers();
      if (runner && (runner as any).isRunning) {
        await runner.stop();
      }
    });

    it('should execute multiple tasks concurrently via startTask', async () => {
      const maxConcurrent = 3;
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: maxConcurrent,
      });

      await runner.start();

      // Track task execution
      const executingTasks = new Set<string>();
      const completedTasks = new Set<string>();

      mockOrchestrator.executeTask.mockImplementation(async (taskId: string) => {
        executingTasks.add(taskId);
        // Simulate task work with variable duration
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
        executingTasks.delete(taskId);
        completedTasks.add(taskId);
      });

      // Start multiple tasks using startTask directly
      const privateRunner = runner as any;
      privateRunner.startTask('concurrent-1');
      privateRunner.startTask('concurrent-2');
      privateRunner.startTask('concurrent-3');

      // Allow small delay for async execution to start
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify multiple tasks are executing simultaneously
      expect(executingTasks.size).toBeGreaterThan(1);
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(3);

      // Wait for all tasks to complete
      await vi.runAllTimersAsync();

      // Verify all tasks completed
      expect(completedTasks.size).toBe(3);
      expect(completedTasks.has('concurrent-1')).toBe(true);
      expect(completedTasks.has('concurrent-2')).toBe(true);
      expect(completedTasks.has('concurrent-3')).toBe(true);
    });

    it('should handle mixed success and failure in concurrent execution', async () => {
      const maxConcurrent = 3;
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: maxConcurrent,
      });

      await runner.start();

      // Mock mixed results
      mockOrchestrator.executeTask.mockImplementation(async (taskId: string) => {
        if (taskId === 'fail-task') {
          throw new Error('Simulated task failure');
        }
        return Promise.resolve();
      });

      // Start tasks with different outcomes
      const privateRunner = runner as any;
      privateRunner.startTask('success-task-1');
      privateRunner.startTask('fail-task');
      privateRunner.startTask('success-task-2');

      // Wait for execution
      await vi.runAllTimersAsync();

      const metrics = runner.getMetrics();
      expect(metrics.tasksProcessed).toBe(3);
      expect(metrics.tasksSucceeded).toBe(2); // 2 success
      expect(metrics.tasksFailed).toBe(1);    // 1 failure
    });

    it('should coordinate between local runningTasks and global task tracking', () => {
      const maxConcurrent = 3;
      runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: maxConcurrent,
      });

      // Mock long-running tasks
      mockOrchestrator.executeTask.mockReturnValue(
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      let globalActiveCount = 0;
      mockOrchestrator.getGlobalActiveTaskCount.mockImplementation(() => globalActiveCount);

      mockOrchestrator.executeTask.mockImplementation(async (taskId: string) => {
        globalActiveCount++;
        await new Promise(resolve => setTimeout(resolve, 1000));
        globalActiveCount--;
      });

      const privateRunner = runner as any;
      privateRunner.startTask('global-1');
      privateRunner.startTask('global-2');

      // Verify coordination
      const localRunningCount = privateRunner.runningTasks.size;
      const reportedGlobalCount = mockOrchestrator.getGlobalActiveTaskCount();

      expect(localRunningCount).toBe(reportedGlobalCount);
    });
  });

  /**
   * Integration Tests - All acceptance criteria working together
   */
  describe('Integration Tests - All Acceptance Criteria', () => {
    it('should demonstrate all acceptance criteria working together', async () => {
      // This test verifies all 4 acceptance criteria in a single scenario

      const maxConcurrent = 3; // Criteria 1: maxConcurrentTasks config
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: maxConcurrent,
      });

      await runner.start();

      // Mock controlled task execution
      const taskCompletions = new Map<string, () => void>();
      mockOrchestrator.executeTask.mockImplementation((taskId: string) => {
        return new Promise(resolve => {
          taskCompletions.set(taskId, resolve);
        });
      });

      // Start tasks up to limit using startTask directly
      const privateRunner = runner as any;
      privateRunner.startTask('integrated-0');
      privateRunner.startTask('integrated-1');
      privateRunner.startTask('integrated-2');

      // Criteria 2: Verify runningTasks Map tracks active tasks
      expect(privateRunner.runningTasks.size).toBe(maxConcurrent);
      expect(privateRunner.runningTasks.has('integrated-0')).toBe(true);
      expect(privateRunner.runningTasks.has('integrated-1')).toBe(true);
      expect(privateRunner.runningTasks.has('integrated-2')).toBe(true);

      // Criteria 3: Verify capacity is respected (simulated)
      expect(mockOrchestrator.executeTask).toHaveBeenCalledTimes(maxConcurrent);

      // Criteria 4: Verify multiple tasks running simultaneously
      const metrics = runner.getMetrics();
      expect(metrics.activeTaskCount).toBe(maxConcurrent);
      expect(metrics.activeTaskIds.length).toBe(maxConcurrent);

      // Complete one task and verify cleanup
      taskCompletions.get('integrated-0')!();
      await vi.runAllTimersAsync();

      expect(privateRunner.runningTasks.size).toBe(2);
      expect(privateRunner.runningTasks.has('integrated-0')).toBe(false);
      expect(privateRunner.runningTasks.has('integrated-1')).toBe(true);

      // Complete all tasks
      for (const [taskId, resolver] of taskCompletions) {
        if (taskId !== 'integrated-0') {
          resolver();
        }
      }
      await vi.runAllTimersAsync();

      expect(privateRunner.runningTasks.size).toBe(0);

      await runner.stop();
    });
  });

  /**
   * Verification of Implementation Structure
   */
  describe('Implementation Structure Verification', () => {
    it('should have the required concurrent execution infrastructure', () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      // Access internal structure through reflection
      const privateRunner = runner as any;

      // Verify key properties exist for concurrent execution
      expect('runningTasks' in privateRunner).toBe(true);
      expect('options' in privateRunner).toBe(true);
      expect('poll' in privateRunner).toBe(true);
      expect('startTask' in privateRunner).toBe(true);

      // Verify runningTasks is a Map
      expect(privateRunner.runningTasks instanceof Map).toBe(true);
      expect(privateRunner.runningTasks.size).toBe(0);

      // Verify options contain maxConcurrentTasks
      expect(privateRunner.options.maxConcurrentTasks).toBeDefined();
    });

    it('should have methods accessible for concurrent execution', () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      // Check that necessary methods exist
      expect(typeof runner.start).toBe('function');
      expect(typeof runner.stop).toBe('function');
      expect(typeof runner.getMetrics).toBe('function');

      // Check private methods exist (through reflection)
      const privateRunner = runner as any;
      expect(typeof privateRunner.poll).toBe('function');
      expect(typeof privateRunner.startTask).toBe('function');
    });

    it('should maintain consistent state structure for concurrent execution', () => {
      const runner = new DaemonRunner({
        projectPath: testProjectPath,
        maxConcurrentTasks: 3,
      });

      // Access internal state structure through reflection
      const privateRunner = runner as any;

      // Verify task tracking state
      expect('tasksProcessed' in privateRunner).toBe(true);
      expect('tasksSucceeded' in privateRunner).toBe(true);
      expect('tasksFailed' in privateRunner).toBe(true);
      expect('isRunning' in privateRunner).toBe(true);
      expect('isShuttingDown' in privateRunner).toBe(true);
      expect('isPaused' in privateRunner).toBe(true);

      // Verify initial values are correct
      expect(privateRunner.tasksProcessed).toBe(0);
      expect(privateRunner.tasksSucceeded).toBe(0);
      expect(privateRunner.tasksFailed).toBe(0);
      expect(privateRunner.isRunning).toBe(false);
      expect(privateRunner.isShuttingDown).toBe(false);
      expect(privateRunner.isPaused).toBe(false);
    });
  });
});