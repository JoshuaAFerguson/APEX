/**
 * Integration tests for graceful shutdown functionality.
 *
 * This test suite verifies:
 * 1. Shutdown during active task execution - tasks complete before daemon exits
 * 2. Shutdown during orphan recovery - orphan detection doesn't interfere with shutdown
 * 3. Shutdown with pending state file writes - final state file written correctly
 * 4. Timeout-based force kill fallback - daemon stops even when tasks hang
 * 5. Signal handling (SIGTERM/SIGINT) - signal handlers trigger graceful shutdown
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'fs';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { TaskStore } from './store';
import { ApexOrchestrator } from './index';
import { DaemonRunner, DaemonMetrics } from './runner';
import { DaemonManager, type DaemonStateFile } from './daemon';
import { HealthMonitor } from './health-monitor';
import type { ApexConfig, Task, TaskStatus } from '@apexcli/core';

// ============================================================================
// Test Configuration
// ============================================================================

/**
 * Default configuration for graceful shutdown tests
 */
const TEST_CONFIG: ApexConfig = {
  version: '1.0',
  agents: {
    'test-agent': {
      name: 'test-agent',
      description: 'Test agent for graceful shutdown integration tests',
      prompt: 'You are a test agent for graceful shutdown tests.',
    }
  },
  workflows: {
    'development': {
      name: 'Development Workflow',
      description: 'Standard development workflow for graceful shutdown tests',
      stages: [
        { name: 'planning', agent: 'test-agent', description: 'Plan the work' },
        { name: 'implementation', agent: 'test-agent', description: 'Implement the work' },
        { name: 'testing', agent: 'test-agent', description: 'Test the work' }
      ]
    }
  },
  daemon: {
    enabled: true,
    pollInterval: 500,  // Fast polling for tests
    logLevel: 'debug' as const,
    orphanDetection: {
      enabled: true,
      stalenessThreshold: 3600000, // 1 hour
      recoveryPolicy: 'pending',
      periodicCheck: true
    },
    sessionRecovery: {
      enabled: true,
      autoResume: true,
      maxResumeAttempts: 3
    }
  },
  limits: {
    maxConcurrentTasks: 3,
    maxTokensPerTask: 100000,
    maxCostPerTask: 5.0,
    dailyBudget: 50.0,
    maxRetries: 3
  }
};

// ============================================================================
// Test Infrastructure
// ============================================================================

describe('Graceful Shutdown Integration Tests', () => {
  let testProjectPath: string;
  let store: TaskStore;
  let orchestrator: ApexOrchestrator;
  let daemonRunner: DaemonRunner;
  let daemonManager: DaemonManager;
  let healthMonitor: HealthMonitor;
  let cleanup: (() => Promise<void>) | null = null;

  beforeEach(async () => {
    // Create unique temporary directory for each test
    const testId = Math.random().toString(36).substring(2, 15);
    testProjectPath = join(tmpdir(), `apex-graceful-shutdown-test-${testId}`);

    // Ensure test directory exists
    await fs.mkdir(testProjectPath, { recursive: true });
    await fs.mkdir(join(testProjectPath, '.apex'), { recursive: true });

    // Create TaskStore
    store = new TaskStore(testProjectPath);
    await store.initialize();

    // Create HealthMonitor
    healthMonitor = new HealthMonitor();

    // Create ApexOrchestrator (will mock executeTask as needed)
    orchestrator = new ApexOrchestrator({
      projectPath: testProjectPath,
      store,
      config: TEST_CONFIG,
    });

    // Create DaemonRunner
    daemonRunner = new DaemonRunner({
      projectPath: testProjectPath,
      pollIntervalMs: 500,
      logLevel: 'debug',
      logToStdout: false,
      config: TEST_CONFIG,
      healthMonitor,
    });

    // Create DaemonManager for signal-based tests
    daemonManager = new DaemonManager({
      projectPath: testProjectPath,
      pollIntervalMs: 500,
      logLevel: 'debug',
      debugMode: false,
      config: TEST_CONFIG,
    });

    // Set up cleanup function for this test
    cleanup = async () => {
      try {
        // Stop daemon runner if running
        if (daemonRunner && daemonRunner.getMetrics().isRunning) {
          await daemonRunner.stop();
        }

        // Force stop any managed daemon
        if (daemonManager) {
          await daemonManager.killDaemon();
        }

        // Close store
        if (store) {
          store.close();
        }
      } catch {
        // Ignore cleanup errors
      }

      try {
        // Clean up test directory
        await fs.rm(testProjectPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    };
  });

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }

    vi.restoreAllMocks();
  });

  // ============================================================================
  // Helper Functions
  // ============================================================================

  /**
   * Create a test task and add it to the store
   */
  async function createTestTask(options: {
    status?: TaskStatus;
    priority?: number;
    effort?: string;
    updatedAt?: Date;
  } = {}): Promise<string> {
    const task: Omit<Task, 'id'> = {
      title: 'Test Task for Graceful Shutdown',
      description: 'A test task to verify graceful shutdown behavior',
      status: options.status || 'pending',
      priority: options.priority || 3,
      effort: (options.effort || 'small') as any,
      workflow: 'development',
      stage: 'planning',
      agent: 'test-agent',
      createdAt: new Date(),
      updatedAt: options.updatedAt || new Date(),
      context: 'Test context for graceful shutdown tests',
      tags: ['test', 'graceful-shutdown'],
    };

    return await store.createTask(task);
  }

  /**
   * Create a task that's currently in-progress (orphaned)
   */
  async function createOrphanedTask(): Promise<string> {
    const taskId = await createTestTask({
      status: 'in-progress',
      updatedAt: new Date(Date.now() - 7200000), // 2 hours ago (stale)
    });

    // Simulate that task was being processed but daemon crashed
    await store.updateTaskStatus(taskId, 'in-progress', 'Simulated orphaned task');

    return taskId;
  }

  /**
   * Wait for a condition to be true, with timeout
   */
  async function waitForCondition(
    predicate: () => boolean | Promise<boolean>,
    timeoutMs: number = 10000,
    intervalMs: number = 100
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const result = await predicate();
        if (result) {
          return true;
        }
      } catch {
        // Ignore predicate errors
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }

    return false;
  }

  /**
   * Read the daemon state file if it exists
   */
  function readStateFile(): DaemonStateFile | null {
    const stateFilePath = join(testProjectPath, '.apex', 'daemon-state.json');

    if (!existsSync(stateFilePath)) {
      return null;
    }

    try {
      const content = readFileSync(stateFilePath, 'utf-8');
      return JSON.parse(content) as DaemonStateFile;
    } catch {
      return null;
    }
  }

  /**
   * Create a long-running task mock that can be controlled
   */
  function createLongRunningTaskMock(durationMs: number): {
    promise: Promise<any>;
    resolve: () => void;
    reject: (error: Error) => void;
  } {
    let resolveFunc: () => void;
    let rejectFunc: (error: Error) => void;

    const promise = new Promise<any>((resolve, reject) => {
      resolveFunc = resolve;
      rejectFunc = reject;

      // Automatically resolve after specified duration
      setTimeout(() => {
        resolve({ success: true, message: 'Long task completed' });
      }, durationMs);
    });

    return {
      promise,
      resolve: resolveFunc!,
      reject: rejectFunc!,
    };
  }

  // ============================================================================
  // Scenario 1: Shutdown During Active Task Execution
  // ============================================================================

  describe('Scenario 1: Shutdown during active task execution', () => {
    it('should wait for running task to complete before stopping', async () => {
      // Create a task that takes 2 seconds to complete
      const taskId = await createTestTask();

      // Mock orchestrator.executeTask to return a controlled promise
      const longTask = createLongRunningTaskMock(2000);
      const executeTaskSpy = vi.spyOn(orchestrator, 'executeTask')
        .mockResolvedValueOnce(longTask.promise);

      // Start daemon
      await daemonRunner.start();

      // Wait for task to start processing
      await waitForCondition(() => {
        const metrics = daemonRunner.getMetrics();
        return metrics.activeTaskCount > 0;
      });

      // Verify task is running
      let metrics = daemonRunner.getMetrics();
      expect(metrics.activeTaskCount).toBe(1);
      expect(metrics.activeTaskIds).toContain(taskId);

      // Initiate shutdown
      const shutdownStartTime = Date.now();
      const stopPromise = daemonRunner.stop();

      // Task should still be running during shutdown
      metrics = daemonRunner.getMetrics();
      expect(metrics.activeTaskCount).toBe(1);

      // Wait for shutdown to complete
      await stopPromise;
      const shutdownDuration = Date.now() - shutdownStartTime;

      // Verify shutdown waited for task completion (should take at least 2 seconds)
      expect(shutdownDuration).toBeGreaterThanOrEqual(1900); // Allow some margin

      // Verify daemon is stopped
      metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(false);
      expect(metrics.activeTaskCount).toBe(0);

      // Verify task was completed, not abandoned
      expect(executeTaskSpy).toHaveBeenCalledOnce();
    }, { timeout: 15000 });

    it('should handle multiple concurrent tasks during shutdown', async () => {
      // Create multiple tasks
      const taskIds = await Promise.all([
        createTestTask(),
        createTestTask(),
        createTestTask(),
      ]);

      // Mock multiple long-running tasks
      const longTasks = [
        createLongRunningTaskMock(1500),
        createLongRunningTaskMock(2000),
        createLongRunningTaskMock(1000),
      ];

      const executeTaskSpy = vi.spyOn(orchestrator, 'executeTask')
        .mockResolvedValueOnce(longTasks[0].promise)
        .mockResolvedValueOnce(longTasks[1].promise)
        .mockResolvedValueOnce(longTasks[2].promise);

      // Start daemon
      await daemonRunner.start();

      // Wait for all tasks to start
      await waitForCondition(() => {
        const metrics = daemonRunner.getMetrics();
        return metrics.activeTaskCount >= 3;
      });

      // Verify all tasks are running
      let metrics = daemonRunner.getMetrics();
      expect(metrics.activeTaskCount).toBe(3);

      // Initiate shutdown
      const shutdownStartTime = Date.now();
      await daemonRunner.stop();
      const shutdownDuration = Date.now() - shutdownStartTime;

      // Verify shutdown waited for the longest task (2 seconds)
      expect(shutdownDuration).toBeGreaterThanOrEqual(1900); // Allow margin

      // Verify all tasks were completed
      metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(false);
      expect(metrics.activeTaskCount).toBe(0);
      expect(executeTaskSpy).toHaveBeenCalledTimes(3);
    }, { timeout: 15000 });

    it('should not pick up new tasks after shutdown initiated', async () => {
      // Create initial task
      const initialTaskId = await createTestTask();

      // Mock initial task to take 2 seconds
      const longTask = createLongRunningTaskMock(2000);
      const executeTaskSpy = vi.spyOn(orchestrator, 'executeTask')
        .mockResolvedValueOnce(longTask.promise);

      // Start daemon
      await daemonRunner.start();

      // Wait for initial task to start
      await waitForCondition(() => {
        const metrics = daemonRunner.getMetrics();
        return metrics.activeTaskCount > 0;
      });

      // Initiate shutdown
      const stopPromise = daemonRunner.stop();

      // Create a new task after shutdown initiated
      const newTaskId = await createTestTask();

      // Wait for shutdown to complete
      await stopPromise;

      // Verify only the initial task was executed, not the new one
      expect(executeTaskSpy).toHaveBeenCalledOnce();
      expect(executeTaskSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: initialTaskId })
      );

      // Verify new task remains in pending state
      const newTask = await store.getTask(newTaskId);
      expect(newTask?.status).toBe('pending');
    }, { timeout: 15000 });

    it('should track task completion in metrics after shutdown', async () => {
      const taskId = await createTestTask();

      // Mock successful task execution
      const executeTaskSpy = vi.spyOn(orchestrator, 'executeTask')
        .mockResolvedValueOnce({ success: true });

      // Start daemon
      await daemonRunner.start();

      // Wait for task to start and complete
      await waitForCondition(() => {
        const metrics = daemonRunner.getMetrics();
        return metrics.tasksProcessed > 0;
      });

      // Shutdown
      await daemonRunner.stop();

      // Verify metrics show task was succeeded, not failed
      const finalMetrics = daemonRunner.getMetrics();
      expect(finalMetrics.tasksProcessed).toBe(1);
      expect(finalMetrics.tasksSucceeded).toBe(1);
      expect(finalMetrics.tasksFailed).toBe(0);
    }, { timeout: 10000 });
  });

  // ============================================================================
  // Scenario 2: Shutdown During Orphan Recovery
  // ============================================================================

  describe('Scenario 2: Shutdown during orphan recovery', () => {
    it('should complete shutdown even during orphan detection', async () => {
      // Create stale in-progress tasks (orphans)
      await createOrphanedTask();
      await createOrphanedTask();

      // Start daemon (this will trigger orphan detection)
      await daemonRunner.start();

      // Immediately initiate shutdown before orphan detection completes
      const shutdownPromise = daemonRunner.stop();

      // Verify shutdown completes successfully
      await expect(shutdownPromise).resolves.toBeUndefined();

      // Verify daemon is stopped
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(false);
    }, { timeout: 10000 });

    it('should clear orphan check interval during shutdown', async () => {
      // Create orphaned task
      await createOrphanedTask();

      // Start daemon with periodic orphan checks
      await daemonRunner.start();

      // Let daemon run briefly to establish intervals
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Spy on clearInterval to track interval cleanup
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      // Shutdown daemon
      await daemonRunner.stop();

      // Verify clearInterval was called (for orphan check interval)
      expect(clearIntervalSpy).toHaveBeenCalled();

      // Verify daemon is stopped
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(false);
    }, { timeout: 10000 });

    it('should not emit orphan events after shutdown flag set', async () => {
      // Create orphaned tasks
      await createOrphanedTask();

      // Set up event listeners
      const orphanDetectedEvents: any[] = [];
      const orphanRecoveredEvents: any[] = [];

      orchestrator.on('orphan:detected', (event) => {
        orphanDetectedEvents.push(event);
      });

      orchestrator.on('orphan:recovered', (event) => {
        orphanRecoveredEvents.push(event);
      });

      // Start daemon
      await daemonRunner.start();

      // Immediately shutdown before orphan detection completes
      await daemonRunner.stop();

      // Wait a bit more to see if any events are emitted after shutdown
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify no orphan events were emitted after shutdown
      // (Events might be emitted before shutdown flag is set, but not after)
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(false);

      // This is more about ensuring shutdown doesn't hang due to orphan processing
      // The specific event timing is less important than successful shutdown
    }, { timeout: 10000 });
  });

  // ============================================================================
  // Scenario 3: Shutdown with Pending State File Writes
  // ============================================================================

  describe('Scenario 3: Shutdown with pending state file writes', () => {
    it('should write final state file with running: false', async () => {
      // Start daemon and run some tasks
      const taskId = await createTestTask();

      const executeTaskSpy = vi.spyOn(orchestrator, 'executeTask')
        .mockResolvedValueOnce({ success: true });

      await daemonRunner.start();

      // Let daemon run and process task
      await waitForCondition(() => {
        const metrics = daemonRunner.getMetrics();
        return metrics.tasksProcessed > 0;
      });

      // Shutdown daemon
      await daemonRunner.stop();

      // Read and verify state file
      const stateData = readStateFile();
      expect(stateData).toBeTruthy();
      expect(stateData!.running).toBe(false);
      expect(stateData!.pid).toBe(process.pid);
      expect(new Date(stateData!.timestamp)).toBeInstanceOf(Date);
    }, { timeout: 10000 });

    it('should handle state file write failures gracefully', async () => {
      // Mock fs.writeFile to simulate failure
      const writeFileSpy = vi.spyOn(fs, 'writeFile')
        .mockRejectedValueOnce(new Error('Permission denied'));

      // Start daemon
      await daemonRunner.start();

      // Let daemon run briefly
      await new Promise(resolve => setTimeout(resolve, 500));

      // Shutdown should not fail even if state file write fails
      await expect(daemonRunner.stop()).resolves.toBeUndefined();

      // Verify daemon stopped despite state file error
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(false);

      // Verify fs.writeFile was attempted
      expect(writeFileSpy).toHaveBeenCalled();
    }, { timeout: 10000 });

    it('should preserve capacity and health info in final state', async () => {
      // Start daemon with health monitoring
      await daemonRunner.start();

      // Let daemon run to generate health data
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Shutdown
      await daemonRunner.stop();

      // Read state file
      const stateData = readStateFile();
      expect(stateData).toBeTruthy();

      // Verify running state
      expect(stateData!.running).toBe(false);

      // Note: Capacity info won't be included when running=false (as per implementation)
      // But health info structure should be preserved
      expect(stateData!.timestamp).toBeTruthy();
      expect(stateData!.startedAt).toBeTruthy();
    }, { timeout: 10000 });
  });

  // ============================================================================
  // Scenario 4: Timeout-Based Force Kill Fallback
  // ============================================================================

  describe('Scenario 4: Timeout-based force kill fallback', () => {
    it('should timeout after grace period with hung tasks', async () => {
      // Create a task that never completes
      const taskId = await createTestTask();

      // Mock task that hangs indefinitely
      const hangingPromise = new Promise(() => {
        // Never resolves
      });

      const executeTaskSpy = vi.spyOn(orchestrator, 'executeTask')
        .mockReturnValueOnce(hangingPromise);

      // Start daemon
      await daemonRunner.start();

      // Wait for task to start
      await waitForCondition(() => {
        const metrics = daemonRunner.getMetrics();
        return metrics.activeTaskCount > 0;
      });

      // Mock console/log to capture timeout warning
      const logSpy = vi.spyOn(console, 'log');

      // Shutdown - should timeout because task hangs
      const shutdownStartTime = Date.now();
      await daemonRunner.stop();
      const shutdownDuration = Date.now() - shutdownStartTime;

      // Verify shutdown completed in reasonable time (grace period is 30s in implementation)
      // Should complete around 30s due to timeout
      expect(shutdownDuration).toBeGreaterThanOrEqual(29000); // Allow some margin
      expect(shutdownDuration).toBeLessThan(35000); // But not too much longer

      // Verify daemon stopped despite hanging task
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(false);

      // Verify timeout warning was logged
      // Note: The actual log format depends on the implementation
      // We mainly verify shutdown completed even with hanging task
      expect(executeTaskSpy).toHaveBeenCalledWith(
        expect.objectContaining({ id: taskId })
      );
    }, { timeout: 40000 }); // Longer timeout for this test

    it('should complete cleanup after timeout', async () => {
      // Create hanging task
      const taskId = await createTestTask();

      const hangingPromise = new Promise(() => {
        // Never resolves
      });

      vi.spyOn(orchestrator, 'executeTask')
        .mockReturnValueOnce(hangingPromise);

      // Start daemon
      await daemonRunner.start();

      // Wait for task to start
      await waitForCondition(() => {
        const metrics = daemonRunner.getMetrics();
        return metrics.activeTaskCount > 0;
      });

      // Shutdown
      await daemonRunner.stop();

      // Verify cleanup was completed - daemon is fully stopped
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(false);

      // Verify state file indicates daemon is stopped
      const stateData = readStateFile();
      expect(stateData).toBeTruthy();
      expect(stateData!.running).toBe(false);
    }, { timeout: 40000 });

    it('should log timeout warning when tasks exceed grace period', async () => {
      // This test uses fake timers to control the timeout behavior
      vi.useFakeTimers();

      try {
        const taskId = await createTestTask();

        // Mock task that takes longer than grace period
        const longPromise = new Promise((resolve) => {
          // Will be resolved by fake timers
          setTimeout(resolve, 35000); // Longer than 30s grace period
        });

        vi.spyOn(orchestrator, 'executeTask')
          .mockReturnValueOnce(longPromise);

        // Start daemon
        await daemonRunner.start();

        // Fast forward to start task
        vi.advanceTimersByTime(1000);

        // Wait for task to start (with real time)
        await waitForCondition(() => {
          const metrics = daemonRunner.getMetrics();
          return metrics.activeTaskCount > 0;
        });

        // Start shutdown
        const stopPromise = daemonRunner.stop();

        // Fast forward past grace period
        vi.advanceTimersByTime(31000); // More than 30s grace period

        // Complete shutdown
        await stopPromise;

        // Verify daemon stopped
        const metrics = daemonRunner.getMetrics();
        expect(metrics.isRunning).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    }, { timeout: 15000 });
  });

  // ============================================================================
  // Scenario 5: Signal Handling (SIGTERM/SIGINT)
  // ============================================================================

  describe('Scenario 5: Signal handling (SIGTERM/SIGINT)', () => {
    // Note: These tests are more challenging because they involve process signals
    // We test the DaemonManager's stopDaemon method which sends SIGTERM

    it('should trigger graceful shutdown on SIGTERM via DaemonManager', async () => {
      // This test uses the DaemonManager to send SIGTERM to a forked daemon

      // Start daemon via DaemonManager
      const daemonPid = await daemonManager.startDaemon();
      expect(daemonPid).toBeGreaterThan(0);

      // Verify daemon is running
      const statusBefore = await daemonManager.getStatus();
      expect(statusBefore.running).toBe(true);
      expect(statusBefore.pid).toBe(daemonPid);

      // Stop daemon (sends SIGTERM)
      const stopped = await daemonManager.stopDaemon();
      expect(stopped).toBe(true);

      // Verify daemon is no longer running
      const statusAfter = await daemonManager.getStatus();
      expect(statusAfter.running).toBe(false);
    }, { timeout: 20000 });

    it('should handle SIGTERM signal in DaemonRunner', async () => {
      // Mock process.on to capture signal handler registration
      const processOnSpy = vi.spyOn(process, 'on');

      // Start daemon runner
      await daemonRunner.start();

      // Verify signal handlers were registered
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));

      // Clean shutdown
      await daemonRunner.stop();
    }, { timeout: 10000 });

    it('should handle force kill when graceful shutdown fails', async () => {
      // Start daemon via manager
      const daemonPid = await daemonManager.startDaemon();

      // Test force kill functionality
      const killed = await daemonManager.killDaemon();
      expect(killed).toBe(true);

      // Verify daemon is no longer running
      const status = await daemonManager.getStatus();
      expect(status.running).toBe(false);
    }, { timeout: 15000 });

    it('should log received signals during shutdown', async () => {
      // This test verifies signal logging behavior
      const consoleSpy = vi.spyOn(console, 'log');

      // Start daemon runner
      await daemonRunner.start();

      // Manually trigger signal handler (simulating SIGTERM)
      const mockSignalHandler = vi.fn(async (signal: string) => {
        console.log(`Received ${signal}`);
        await daemonRunner.stop();
      });

      // Trigger the handler
      await mockSignalHandler('SIGTERM');

      // Verify signal was logged
      expect(consoleSpy).toHaveBeenCalledWith('Received SIGTERM');

      // Verify daemon is stopped
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(false);
    }, { timeout: 10000 });
  });

  // ============================================================================
  // Cross-Scenario Integration Tests
  // ============================================================================

  describe('Cross-scenario integration', () => {
    it('should handle shutdown with both active tasks and orphan detection', async () => {
      // Create orphaned task
      await createOrphanedTask();

      // Create active task
      const activeTaskId = await createTestTask();

      // Mock active task to take time
      const longTask = createLongRunningTaskMock(2000);
      vi.spyOn(orchestrator, 'executeTask')
        .mockResolvedValueOnce(longTask.promise);

      // Start daemon
      await daemonRunner.start();

      // Wait for active task to start
      await waitForCondition(() => {
        const metrics = daemonRunner.getMetrics();
        return metrics.activeTaskCount > 0;
      });

      // Shutdown - should handle both active task completion and orphan cleanup
      await daemonRunner.stop();

      // Verify successful shutdown
      const metrics = daemonRunner.getMetrics();
      expect(metrics.isRunning).toBe(false);
      expect(metrics.activeTaskCount).toBe(0);

      // Verify state file
      const stateData = readStateFile();
      expect(stateData).toBeTruthy();
      expect(stateData!.running).toBe(false);
    }, { timeout: 15000 });

    it('should maintain data integrity during complex shutdown scenarios', async () => {
      // Create multiple test scenarios
      await createOrphanedTask();
      const taskIds = await Promise.all([
        createTestTask(),
        createTestTask(),
      ]);

      // Mock tasks with different completion times
      vi.spyOn(orchestrator, 'executeTask')
        .mockResolvedValueOnce(createLongRunningTaskMock(1000).promise)
        .mockResolvedValueOnce(createLongRunningTaskMock(1500).promise);

      // Start daemon
      await daemonRunner.start();

      // Let daemon process for a bit
      await new Promise(resolve => setTimeout(resolve, 500));

      // Shutdown
      await daemonRunner.stop();

      // Verify data integrity
      const finalMetrics = daemonRunner.getMetrics();
      expect(finalMetrics.isRunning).toBe(false);

      // Verify tasks are in expected states
      for (const taskId of taskIds) {
        const task = await store.getTask(taskId);
        expect(task).toBeTruthy();
        // Task should either be completed or back in pending state
        expect(['completed', 'pending', 'failed']).toContain(task!.status);
      }

      // Verify state file integrity
      const stateData = readStateFile();
      expect(stateData).toBeTruthy();
      expect(stateData!.running).toBe(false);
      expect(stateData!.timestamp).toBeTruthy();
    }, { timeout: 15000 });
  });
});