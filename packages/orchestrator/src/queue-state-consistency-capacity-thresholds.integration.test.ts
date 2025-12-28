import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import { UsageManager } from './usage-manager';
import { CapacityMonitor } from './capacity-monitor';
import { CapacityMonitorUsageAdapter } from './capacity-monitor-usage-adapter';
import { DaemonScheduler } from './daemon-scheduler';
import { DaemonRunner } from './runner';
import type { Task, TaskPriority, DaemonConfig, LimitsConfig, TaskStatus } from '@apexcli/core';
import { EventEmitter } from 'eventemitter3';

/**
 * Integration Tests: Queue State Consistency During Capacity Threshold Changes
 *
 * These tests verify that the task queue maintains consistency and preserves task order
 * when capacity thresholds are crossed and during auto-pause/resume operations.
 *
 * Test Coverage:
 * 1. Queue state remains consistent when capacity thresholds are crossed
 * 2. Auto-pause/resume behavior preserves queue order
 * 3. Tasks are not lost during capacity transitions
 * 4. Mode switch (day/night) impact on queue processing
 */
describe('Queue State Consistency During Capacity Threshold Changes', () => {
  let testDir: string;
  let store: TaskStore;
  let usageManager: UsageManager;
  let capacityMonitor: CapacityMonitor;
  let usageAdapter: CapacityMonitorUsageAdapter;
  let scheduler: DaemonScheduler;
  let runner: DaemonRunner;
  let eventEmitter: EventEmitter;

  let config: DaemonConfig;
  let limits: LimitsConfig;

  // Track queue state throughout tests
  let queueStateSnapshots: Array<{
    timestamp: Date;
    queueSize: number;
    activeTasks: number;
    pausedTasks: number;
    pendingTasks: number;
    taskOrder: string[];
    capacityInfo: any;
  }> = [];

  // Track events for verification
  let capacityEvents: Array<{ event: string; data: any; timestamp: Date }> = [];
  let pauseResumeEvents: Array<{ event: string; taskId: string; timestamp: Date }> = [];

  const createTestTask = (overrides: Partial<Task> = {}): Task => ({
    id: `task_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    description: 'Test task for capacity threshold testing',
    workflow: 'feature',
    autonomy: 'medium',
    status: 'pending',
    priority: 'normal',
    effort: 'small',
    projectPath: testDir,
    branchName: `apex/test-${Math.random().toString(36).substring(7)}`,
    retryCount: 0,
    maxRetries: 3,
    resumeAttempts: 0,
    dependsOn: [],
    blockedBy: [],
    subtaskIds: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
    ...overrides,
  });

  const captureQueueStateSnapshot = async (label: string = '') => {
    try {
      const queueTasks = await store.getNextQueuedTask();
      const activeTasks = await store.getTasksByStatus('in-progress');
      const pausedTasks = await store.getPausedTasksForResume();
      const allTasks = await store.getAllTasks();

      const pendingTasks = allTasks.filter(t => t.status === 'pending');
      const taskOrder = allTasks
        .filter(t => ['pending', 'paused', 'in-progress'].includes(t.status))
        .sort((a, b) => {
          const priorityOrder = { urgent: 1, high: 2, normal: 3, low: 4 };
          const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 99;
          const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 99;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return a.createdAt.getTime() - b.createdAt.getTime();
        })
        .map(t => t.id);

      const capacityInfo = {
        currentUsage: usageAdapter.getCurrentUsage(),
        thresholds: usageAdapter.getThresholds(),
        modeInfo: usageAdapter.getModeInfo(),
      };

      const snapshot = {
        timestamp: new Date(),
        queueSize: pendingTasks.length,
        activeTasks: activeTasks.length,
        pausedTasks: pausedTasks.length,
        pendingTasks: pendingTasks.length,
        taskOrder,
        capacityInfo,
        label,
      };

      queueStateSnapshots.push(snapshot);
      console.log(`Queue snapshot [${label}]:`, {
        queueSize: snapshot.queueSize,
        activeTasks: snapshot.activeTasks,
        pausedTasks: snapshot.pausedTasks,
        pendingTasks: snapshot.pendingTasks,
        taskOrderCount: snapshot.taskOrder.length,
      });
    } catch (error) {
      console.warn('Failed to capture queue state snapshot:', error);
    }
  };

  beforeEach(async () => {
    // Reset tracking arrays
    queueStateSnapshots = [];
    capacityEvents = [];
    pauseResumeEvents = [];

    // Create test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-queue-consistency-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });

    // Set up test configuration with realistic capacity thresholds
    config = {
      project: {
        name: 'queue-consistency-test',
        version: '1.0.0',
      },
      timeBasedUsage: {
        enabled: true,
        dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
        dayModeCapacityThreshold: 0.70, // 70% of daily budget
        nightModeCapacityThreshold: 0.90, // 90% of daily budget
        dayModeThresholds: {
          maxTokensPerTask: 100000,
          maxCostPerTask: 5.0,
          maxConcurrentTasks: 2,
        },
        nightModeThresholds: {
          maxTokensPerTask: 1000000,
          maxCostPerTask: 20.0,
          maxConcurrentTasks: 5,
        },
      },
      limits: {
        maxConcurrentTasks: 3,
        maxUsagePerUser: 10000,
        maxUsagePerTask: 1000,
      },
      autonomy: {
        default: 'medium' as const,
        allowed: ['low', 'medium', 'high'] as const,
      },
      daemon: {
        pollInterval: 100,
      },
    };

    limits = {
      dailyBudget: 100.0,
      maxTokensPerTask: 500000,
      maxCostPerTask: 10.0,
      maxConcurrentTasks: 3,
    };

    // Set initial time to day mode for testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-02T14:00:00')); // 2 PM, day mode

    // Initialize components
    store = new TaskStore(testDir);
    await store.initialize();

    usageManager = new UsageManager(config, limits);
    usageAdapter = new CapacityMonitorUsageAdapter(usageManager, config, limits);
    capacityMonitor = new CapacityMonitor(config, limits, usageAdapter);

    // Create mock usage stats provider for scheduler
    const mockUsageProvider = {
      getCurrentDailyUsage: () => usageManager.getUsageStats().current.dailyUsage,
      getActiveTasks: () => usageManager.getActiveTasks(),
      getDailyBudget: () => limits.dailyBudget || 100,
    };

    scheduler = new DaemonScheduler(config, limits, mockUsageProvider);
    eventEmitter = new EventEmitter();

    // Set up event tracking
    capacityMonitor.on('capacity:restored', (event) => {
      capacityEvents.push({ event: 'capacity:restored', data: event, timestamp: new Date() });
    });

    capacityMonitor.on('capacity:exceeded', (event) => {
      capacityEvents.push({ event: 'capacity:exceeded', data: event, timestamp: new Date() });
    });

    // Start capacity monitoring
    capacityMonitor.start();

    // Capture initial state
    await captureQueueStateSnapshot('initial');
  });

  afterEach(async () => {
    // Stop monitoring
    capacityMonitor?.stop();
    runner?.stop?.();

    // Clean up
    store?.close();
    await fs.rm(testDir, { recursive: true, force: true });

    vi.useRealTimers();
  });

  describe('Queue State Consistency When Capacity Thresholds Are Crossed', () => {
    it('should maintain queue order when crossing day mode capacity threshold', async () => {
      // Create a queue of tasks with different priorities
      const tasks = [
        createTestTask({ id: 'urgent-1', priority: 'urgent', description: 'Urgent task 1' }),
        createTestTask({ id: 'high-1', priority: 'high', description: 'High priority task 1' }),
        createTestTask({ id: 'normal-1', priority: 'normal', description: 'Normal priority task 1' }),
        createTestTask({ id: 'normal-2', priority: 'normal', description: 'Normal priority task 2' }),
        createTestTask({ id: 'low-1', priority: 'low', description: 'Low priority task 1' }),
      ];

      // Add tasks to store
      for (const task of tasks) {
        await store.createTask(task);
      }

      await captureQueueStateSnapshot('tasks-created');

      // Verify initial queue order
      const initialSnapshot = queueStateSnapshots[queueStateSnapshots.length - 1];
      expect(initialSnapshot.queueSize).toBe(5);
      expect(initialSnapshot.taskOrder[0]).toBe('urgent-1');
      expect(initialSnapshot.taskOrder[1]).toBe('high-1');

      // Start processing tasks until we approach the capacity threshold
      usageManager.trackTaskStart('urgent-1');
      usageManager.trackTaskCompletion('urgent-1', {
        inputTokens: 25000,
        outputTokens: 25000,
        totalTokens: 50000,
        estimatedCost: 40.0, // 40% of budget
      }, true);

      await captureQueueStateSnapshot('after-first-task');

      // Add more usage to approach threshold (70% = $70)
      usageManager.trackTaskStart('high-1');
      usageManager.trackTaskCompletion('high-1', {
        inputTokens: 20000,
        outputTokens: 20000,
        totalTokens: 40000,
        estimatedCost: 25.0, // Total now 65% of budget
      }, true);

      await captureQueueStateSnapshot('approaching-threshold');

      // Cross the threshold with next task
      usageManager.trackTaskStart('normal-1');
      usageManager.trackTaskCompletion('normal-1', {
        inputTokens: 10000,
        outputTokens: 10000,
        totalTokens: 20000,
        estimatedCost: 10.0, // Total now 75% - exceeds 70% threshold
      }, true);

      await captureQueueStateSnapshot('threshold-exceeded');

      // Check if system should pause tasks
      const shouldPause = scheduler.shouldPauseTasks();
      expect(shouldPause.shouldPause).toBe(true);
      expect(shouldPause.reason).toContain('Daily budget usage (75%) exceeds day mode threshold (70%)');

      // Verify queue state consistency - remaining tasks should maintain order
      const currentSnapshot = queueStateSnapshots[queueStateSnapshots.length - 1];
      const remainingTasks = await store.getAllTasks();
      const pendingTasks = remainingTasks.filter(t => t.status === 'pending');

      expect(pendingTasks).toHaveLength(2); // normal-2 and low-1 should remain
      expect(pendingTasks.map(t => t.id)).toEqual(['normal-2', 'low-1']);

      // Verify no tasks were lost
      const allTasksAfter = await store.getAllTasks();
      expect(allTasksAfter).toHaveLength(5);
      expect(allTasksAfter.map(t => t.id).sort()).toEqual(tasks.map(t => t.id).sort());
    });

    it('should handle queue consistency during rapid threshold crossings', async () => {
      // Create multiple tasks
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createTestTask({
          id: `task-${i}`,
          priority: i % 2 === 0 ? 'high' : 'normal',
          description: `Test task ${i}`
        })
      );

      for (const task of tasks) {
        await store.createTask(task);
      }

      await captureQueueStateSnapshot('rapid-test-initial');

      // Simulate rapid usage increases crossing threshold multiple times
      let currentCost = 0;
      const costIncrement = 15; // Each task costs $15

      for (let i = 0; i < 6; i++) {
        const taskId = `task-${i}`;
        usageManager.trackTaskStart(taskId);

        currentCost += costIncrement;
        usageManager.trackTaskCompletion(taskId, {
          inputTokens: 5000,
          outputTokens: 5000,
          totalTokens: 10000,
          estimatedCost: costIncrement,
        }, true);

        await captureQueueStateSnapshot(`task-${i}-completed`);

        // Check threshold status
        const shouldPause = scheduler.shouldPauseTasks();
        const usagePercentage = currentCost / limits.dailyBudget!;

        console.log(`After task ${i}: $${currentCost} (${(usagePercentage * 100).toFixed(1)}%) - Should pause: ${shouldPause.shouldPause}`);

        // If we've exceeded threshold, verify queue state
        if (usagePercentage > 0.70) {
          expect(shouldPause.shouldPause).toBe(true);

          // Verify remaining tasks maintain proper order
          const remainingTasks = await store.getAllTasks();
          const pendingTasks = remainingTasks.filter(t => t.status === 'pending');

          // Verify high priority tasks come before normal priority tasks
          const highPriorityTasks = pendingTasks.filter(t => t.priority === 'high');
          const normalPriorityTasks = pendingTasks.filter(t => t.priority === 'normal');

          if (highPriorityTasks.length > 0 && normalPriorityTasks.length > 0) {
            const firstHighIndex = pendingTasks.findIndex(t => t.priority === 'high');
            const firstNormalIndex = pendingTasks.findIndex(t => t.priority === 'normal');
            expect(firstHighIndex).toBeLessThan(firstNormalIndex);
          }
        }
      }

      // Verify no tasks were lost during rapid crossings
      const finalTasks = await store.getAllTasks();
      expect(finalTasks).toHaveLength(10);
      expect(finalTasks.map(t => t.id).sort()).toEqual(tasks.map(t => t.id).sort());
    });
  });

  describe('Auto-Pause/Resume Behavior Preserves Queue Order', () => {
    it('should preserve task order when auto-pausing due to capacity threshold', async () => {
      // Create tasks with mixed priorities
      const tasks = [
        createTestTask({ id: 'urgent-task', priority: 'urgent' }),
        createTestTask({ id: 'high-task-1', priority: 'high' }),
        createTestTask({ id: 'high-task-2', priority: 'high' }),
        createTestTask({ id: 'normal-task-1', priority: 'normal' }),
        createTestTask({ id: 'normal-task-2', priority: 'normal' }),
        createTestTask({ id: 'low-task', priority: 'low' }),
      ];

      for (const task of tasks) {
        await store.createTask(task);
      }

      await captureQueueStateSnapshot('before-auto-pause');

      // Start processing the urgent task
      await store.updateTask('urgent-task', { status: 'in-progress' });
      usageManager.trackTaskStart('urgent-task');

      // Complete it with high cost to trigger threshold
      usageManager.trackTaskCompletion('urgent-task', {
        inputTokens: 40000,
        outputTokens: 40000,
        totalTokens: 80000,
        estimatedCost: 75.0, // Exceeds 70% threshold
      }, true);

      await store.updateTask('urgent-task', { status: 'completed' });
      await captureQueueStateSnapshot('threshold-exceeded-urgent-completed');

      // Verify system should auto-pause new tasks
      const shouldPause = scheduler.shouldPauseTasks();
      expect(shouldPause.shouldPause).toBe(true);

      // Simulate auto-pause behavior by pausing remaining tasks
      const remainingTasks = await store.getAllTasks();
      const pendingTasks = remainingTasks.filter(t => t.status === 'pending');

      for (const task of pendingTasks) {
        await store.updateTask(task.id, {
          status: 'paused',
          pauseReason: 'capacity',
          pausedAt: new Date(),
        });
        pauseResumeEvents.push({ event: 'paused', taskId: task.id, timestamp: new Date() });
      }

      await captureQueueStateSnapshot('after-auto-pause');

      // Verify all pending tasks were paused
      const pausedTasks = await store.getPausedTasksForResume();
      expect(pausedTasks).toHaveLength(5); // All except the completed urgent task

      // Verify pause order matches expected priority order
      const pausedTaskOrder = pausedTasks.map(t => t.id);
      expect(pausedTaskOrder).toEqual([
        'high-task-1', 'high-task-2', 'normal-task-1', 'normal-task-2', 'low-task'
      ]);

      // Simulate capacity restoration (e.g., daily reset or usage drop)
      usageManager.resetDailyStats(); // Reset usage to simulate capacity restoration

      // Resume tasks and verify order is preserved
      const resumableTasks = await store.getPausedTasksForResume();

      for (const task of resumableTasks) {
        await store.updateTask(task.id, {
          status: 'pending',
          pauseReason: null,
          resumeAfter: null,
        });
        pauseResumeEvents.push({ event: 'resumed', taskId: task.id, timestamp: new Date() });
      }

      await captureQueueStateSnapshot('after-auto-resume');

      // Verify resumed tasks maintain correct order
      const resumedTasks = await store.getAllTasks();
      const pendingAfterResume = resumedTasks.filter(t => t.status === 'pending');
      const pendingTaskOrder = pendingAfterResume.map(t => t.id);

      expect(pendingTaskOrder).toEqual([
        'high-task-1', 'high-task-2', 'normal-task-1', 'normal-task-2', 'low-task'
      ]);

      // Verify pause/resume events occurred
      const pauseEvents = pauseResumeEvents.filter(e => e.event === 'paused');
      const resumeEvents = pauseResumeEvents.filter(e => e.event === 'resumed');

      expect(pauseEvents).toHaveLength(5);
      expect(resumeEvents).toHaveLength(5);
    });

    it('should handle partial queue processing during auto-pause scenarios', async () => {
      // Create a larger queue to test partial processing
      const tasks = Array.from({ length: 8 }, (_, i) =>
        createTestTask({
          id: `batch-task-${i}`,
          priority: ['urgent', 'high', 'normal', 'low'][i % 4] as TaskPriority,
          description: `Batch task ${i}`
        })
      );

      for (const task of tasks) {
        await store.createTask(task);
      }

      await captureQueueStateSnapshot('batch-initial');

      // Process some tasks before hitting threshold
      let processedTasks = 0;
      let totalCost = 0;

      // Process tasks one by one until threshold
      for (const task of tasks) {
        if (totalCost > 70) break; // Stop before exceeding threshold

        await store.updateTask(task.id, { status: 'in-progress' });
        usageManager.trackTaskStart(task.id);

        const taskCost = 20; // Each task costs $20
        totalCost += taskCost;

        usageManager.trackTaskCompletion(task.id, {
          inputTokens: 10000,
          outputTokens: 10000,
          totalTokens: 20000,
          estimatedCost: taskCost,
        }, true);

        await store.updateTask(task.id, { status: 'completed' });
        processedTasks++;

        await captureQueueStateSnapshot(`batch-task-${processedTasks}-completed`);
      }

      // Should have processed some tasks before hitting threshold
      expect(processedTasks).toBeGreaterThan(0);
      expect(processedTasks).toBeLessThan(8);

      // Verify remaining tasks maintain order
      const allTasks = await store.getAllTasks();
      const completedTasks = allTasks.filter(t => t.status === 'completed');
      const pendingTasks = allTasks.filter(t => t.status === 'pending');

      expect(completedTasks).toHaveLength(processedTasks);
      expect(pendingTasks).toHaveLength(8 - processedTasks);

      // Verify pending tasks are still in correct priority order
      const pendingTasksByPriority = pendingTasks.reduce((acc, task) => {
        acc[task.priority] = acc[task.priority] || [];
        acc[task.priority].push(task);
        return acc;
      }, {} as Record<string, Task[]>);

      // All urgent tasks should come before high, high before normal, normal before low
      let expectedOrder: string[] = [];
      for (const priority of ['urgent', 'high', 'normal', 'low']) {
        if (pendingTasksByPriority[priority]) {
          expectedOrder.push(...pendingTasksByPriority[priority].map(t => t.id));
        }
      }

      const actualOrder = pendingTasks.map(t => t.id);
      expect(actualOrder).toEqual(expectedOrder);
    });
  });

  describe('Tasks Are Not Lost During Capacity Transitions', () => {
    it('should maintain task integrity across multiple capacity transitions', async () => {
      const initialTaskCount = 12;
      const tasks = Array.from({ length: initialTaskCount }, (_, i) =>
        createTestTask({
          id: `integrity-task-${i}`,
          priority: ['urgent', 'high', 'normal', 'low'][i % 4] as TaskPriority,
        })
      );

      // Create all tasks
      for (const task of tasks) {
        await store.createTask(task);
      }

      const initialTaskIds = new Set(tasks.map(t => t.id));
      await captureQueueStateSnapshot('integrity-initial');

      // Simulate multiple capacity transitions
      const transitions = [
        { usage: 30, action: 'below-threshold' },
        { usage: 75, action: 'exceed-day-threshold' },
        { usage: 60, action: 'back-below-threshold' },
        { usage: 85, action: 'exceed-again' },
        { usage: 95, action: 'near-budget-limit' },
        { usage: 50, action: 'drop-significantly' },
      ];

      for (let i = 0; i < transitions.length; i++) {
        const transition = transitions[i];

        // Reset and set new usage level
        usageManager.resetDailyStats();
        usageManager.trackTaskCompletion(`transition-task-${i}`, {
          inputTokens: 10000,
          outputTokens: 10000,
          totalTokens: 20000,
          estimatedCost: transition.usage,
        }, true);

        await captureQueueStateSnapshot(`transition-${i}-${transition.action}`);

        // Verify all original tasks still exist
        const currentTasks = await store.getAllTasks();
        const currentTaskIds = new Set(currentTasks.map(t => t.id));

        // Check that all original task IDs are still present
        for (const originalId of initialTaskIds) {
          expect(currentTaskIds.has(originalId)).toBe(true);
        }

        expect(currentTasks.length).toBeGreaterThanOrEqual(initialTaskCount);

        // Simulate pause/resume based on threshold
        const shouldPause = scheduler.shouldPauseTasks();
        if (shouldPause.shouldPause) {
          // Pause pending tasks
          const pendingTasks = currentTasks.filter(t => t.status === 'pending');
          for (const task of pendingTasks) {
            await store.updateTask(task.id, {
              status: 'paused',
              pauseReason: 'capacity',
            });
          }
        } else {
          // Resume paused tasks
          const pausedTasks = await store.getPausedTasksForResume();
          for (const task of pausedTasks) {
            if (task.pauseReason === 'capacity') {
              await store.updateTask(task.id, {
                status: 'pending',
                pauseReason: null,
              });
            }
          }
        }

        await captureQueueStateSnapshot(`transition-${i}-after-pause-resume`);
      }

      // Final verification - all original tasks should still exist
      const finalTasks = await store.getAllTasks();
      const finalTaskIds = new Set(finalTasks.map(t => t.id));

      for (const originalId of initialTaskIds) {
        expect(finalTaskIds.has(originalId)).toBe(true);
      }

      expect(finalTasks.length).toBeGreaterThanOrEqual(initialTaskCount);

      // Verify task status integrity
      const validStatuses = ['pending', 'paused', 'in-progress', 'completed', 'failed'];
      for (const task of finalTasks.filter(t => initialTaskIds.has(t.id))) {
        expect(validStatuses).toContain(task.status);
      }
    });

    it('should handle concurrent task operations during capacity changes', async () => {
      const concurrentTaskCount = 6;
      const tasks = Array.from({ length: concurrentTaskCount }, (_, i) =>
        createTestTask({
          id: `concurrent-task-${i}`,
          priority: i < 2 ? 'urgent' : i < 4 ? 'high' : 'normal',
        })
      );

      for (const task of tasks) {
        await store.createTask(task);
      }

      await captureQueueStateSnapshot('concurrent-initial');

      // Start multiple tasks concurrently
      const startedTasks = tasks.slice(0, 3);
      for (const task of startedTasks) {
        await store.updateTask(task.id, { status: 'in-progress' });
        usageManager.trackTaskStart(task.id);
      }

      await captureQueueStateSnapshot('concurrent-tasks-started');

      // Complete first task with moderate cost
      usageManager.trackTaskCompletion('concurrent-task-0', {
        inputTokens: 15000,
        outputTokens: 15000,
        totalTokens: 30000,
        estimatedCost: 30.0,
      }, true);
      await store.updateTask('concurrent-task-0', { status: 'completed' });

      // Complete second task pushing over threshold
      usageManager.trackTaskCompletion('concurrent-task-1', {
        inputTokens: 25000,
        outputTokens: 25000,
        totalTokens: 50000,
        estimatedCost: 50.0, // Total now 80%, exceeding 70% threshold
      }, true);
      await store.updateTask('concurrent-task-1', { status: 'completed' });

      await captureQueueStateSnapshot('threshold-exceeded-concurrent');

      // Third task is still in progress - should handle gracefully
      const shouldPause = scheduler.shouldPauseTasks();
      expect(shouldPause.shouldPause).toBe(true);

      // Complete the in-progress task
      usageManager.trackTaskCompletion('concurrent-task-2', {
        inputTokens: 5000,
        outputTokens: 5000,
        totalTokens: 10000,
        estimatedCost: 5.0,
      }, true);
      await store.updateTask('concurrent-task-2', { status: 'completed' });

      await captureQueueStateSnapshot('all-concurrent-completed');

      // Verify all tasks are accounted for
      const allTasks = await store.getAllTasks();
      expect(allTasks).toHaveLength(concurrentTaskCount);

      const completedTasks = allTasks.filter(t => t.status === 'completed');
      const pendingTasks = allTasks.filter(t => t.status === 'pending');

      expect(completedTasks).toHaveLength(3);
      expect(pendingTasks).toHaveLength(3);

      // Verify no tasks were lost or corrupted
      for (const originalTask of tasks) {
        const foundTask = allTasks.find(t => t.id === originalTask.id);
        expect(foundTask).toBeDefined();
        expect(['completed', 'pending']).toContain(foundTask!.status);
      }
    });
  });

  describe('Mode Switch (Day/Night) Impact on Queue Processing', () => {
    it('should handle queue state during day to night mode transition', async () => {
      // Create tasks that would be blocked in day mode but allowed in night mode
      const tasks = [
        createTestTask({
          id: 'day-blocked-1',
          priority: 'high',
          usage: { ...createTestTask().usage, estimatedCost: 15.0 } // Would exceed day mode limit with current usage
        }),
        createTestTask({
          id: 'day-blocked-2',
          priority: 'normal',
          usage: { ...createTestTask().usage, estimatedCost: 12.0 }
        }),
        createTestTask({
          id: 'always-allowed',
          priority: 'urgent',
          usage: { ...createTestTask().usage, estimatedCost: 3.0 }
        }),
      ];

      for (const task of tasks) {
        await store.createTask(task);
      }

      // Set day mode usage near threshold (65% of $100 budget)
      usageManager.trackTaskCompletion('setup-task', {
        inputTokens: 30000,
        outputTokens: 30000,
        totalTokens: 60000,
        estimatedCost: 65.0,
      }, true);

      await captureQueueStateSnapshot('day-mode-near-threshold');

      // In day mode (70% threshold), additional tasks should be restricted
      let shouldPause = scheduler.shouldPauseTasks();
      expect(shouldPause.shouldPause).toBe(false); // 65% < 70%

      // But check if individual tasks would be allowed
      const canStartExpensive = usageManager.canStartTask({ estimatedCost: 15.0 });
      expect(canStartExpensive.allowed).toBe(false); // 65% + 15% = 80% > 70%

      // Switch to night mode
      vi.setSystemTime(new Date('2024-01-02T23:00:00')); // 11 PM, night mode

      // Create new managers for night mode
      usageManager = new UsageManager(config, limits);
      usageAdapter = new CapacityMonitorUsageAdapter(usageManager, config, limits);

      // Restore previous usage
      usageManager.trackTaskCompletion('previous-day-usage', {
        inputTokens: 30000,
        outputTokens: 30000,
        totalTokens: 60000,
        estimatedCost: 65.0,
      }, true);

      // Update scheduler with new usage provider
      const nightModeUsageProvider = {
        getCurrentDailyUsage: () => usageManager.getUsageStats().current.dailyUsage,
        getActiveTasks: () => usageManager.getUsageStats().active.length,
        getDailyBudget: () => limits.dailyBudget || 100,
      };
      scheduler = new DaemonScheduler(config, limits, nightModeUsageProvider);

      await captureQueueStateSnapshot('night-mode-same-usage');

      // In night mode (90% threshold), same tasks should now be allowed
      shouldPause = scheduler.shouldPauseTasks();
      expect(shouldPause.shouldPause).toBe(false); // 65% < 90%

      const canStartExpensiveNight = usageManager.canStartTask({ estimatedCost: 15.0 });
      expect(canStartExpensiveNight.allowed).toBe(true); // 65% + 15% = 80% < 90%

      // Verify queue order is maintained during mode switch
      const beforeSwitch = queueStateSnapshots.find(s => s.label === 'day-mode-near-threshold');
      const afterSwitch = queueStateSnapshots.find(s => s.label === 'night-mode-same-usage');

      expect(beforeSwitch?.taskOrder).toEqual(afterSwitch?.taskOrder);

      // Process tasks that were blocked in day mode
      const queuedTasks = await store.getAllTasks();
      const pendingTasks = queuedTasks.filter(t => t.status === 'pending');

      // Should be able to process the expensive task in night mode
      const expensiveTask = pendingTasks.find(t => t.id === 'day-blocked-1');
      expect(expensiveTask).toBeDefined();

      // Simulate processing the expensive task
      await store.updateTask('day-blocked-1', { status: 'in-progress' });
      usageManager.trackTaskStart('day-blocked-1');
      usageManager.trackTaskCompletion('day-blocked-1', {
        inputTokens: 15000,
        outputTokens: 15000,
        totalTokens: 30000,
        estimatedCost: 15.0,
      }, true);
      await store.updateTask('day-blocked-1', { status: 'completed' });

      await captureQueueStateSnapshot('expensive-task-completed-night-mode');

      // Total usage now 80% - still under night mode threshold
      const finalPauseCheck = scheduler.shouldPauseTasks();
      expect(finalPauseCheck.shouldPause).toBe(false);

      // Verify queue integrity after mode switch and processing
      const finalTasks = await store.getAllTasks();
      expect(finalTasks).toHaveLength(3);
      expect(finalTasks.find(t => t.id === 'day-blocked-1')?.status).toBe('completed');
    });

    it('should handle queue processing during multiple mode switches in one day', async () => {
      // Create a comprehensive queue for full day simulation
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createTestTask({
          id: `fullday-task-${i}`,
          priority: ['urgent', 'high', 'normal', 'low'][i % 4] as TaskPriority,
          usage: { ...createTestTask().usage, estimatedCost: 8.0 } // Each task costs $8
        })
      );

      for (const task of tasks) {
        await store.createTask(task);
      }

      await captureQueueStateSnapshot('fullday-initial');

      // Simulate a full day with multiple mode transitions
      const modeTransitions = [
        { time: '2024-01-02T09:00:00', mode: 'day', description: 'Start of day mode' },
        { time: '2024-01-02T12:00:00', mode: 'day', description: 'Midday' },
        { time: '2024-01-02T18:00:00', mode: 'off-hours', description: 'End of day mode' },
        { time: '2024-01-02T22:00:00', mode: 'night', description: 'Start of night mode' },
        { time: '2024-01-03T02:00:00', mode: 'night', description: 'Middle of night' },
        { time: '2024-01-03T07:00:00', mode: 'off-hours', description: 'End of night mode' },
      ];

      let processedTaskCount = 0;
      let totalUsage = 0;

      for (const transition of modeTransitions) {
        vi.setSystemTime(new Date(transition.time));

        // Recreate managers for new time mode
        usageManager = new UsageManager(config, limits);
        usageAdapter = new CapacityMonitorUsageAdapter(usageManager, config, limits);

        // Restore accumulated usage
        if (totalUsage > 0) {
          usageManager.trackTaskCompletion('accumulated-usage', {
            inputTokens: totalUsage * 1000,
            outputTokens: totalUsage * 1000,
            totalTokens: totalUsage * 2000,
            estimatedCost: totalUsage,
          }, true);
        }

        const modeUsageProvider = {
          getCurrentDailyUsage: () => usageManager.getUsageStats().current.dailyUsage,
          getActiveTasks: () => usageManager.getUsageStats().active.length,
          getDailyBudget: () => limits.dailyBudget || 100,
        };
        scheduler = new DaemonScheduler(config, limits, modeUsageProvider);

        await captureQueueStateSnapshot(`mode-${transition.mode}-${transition.time}`);

        // Check what's allowed in this mode
        const shouldPause = scheduler.shouldPauseTasks();
        const timeWindow = scheduler.getCurrentTimeWindow();

        console.log(`Mode ${transition.mode} at ${transition.time}: shouldPause=${shouldPause.shouldPause}, usage=${totalUsage}%`);

        // Process tasks if allowed
        if (!shouldPause.shouldPause && timeWindow.isActive) {
          const remainingTasks = await store.getAllTasks();
          const pendingTasks = remainingTasks.filter(t => t.status === 'pending');

          // Process up to 2 tasks in this time window (if allowed)
          const tasksToProcess = pendingTasks.slice(0, 2);

          for (const task of tasksToProcess) {
            const canStart = usageManager.canStartTask({ estimatedCost: 8.0 });
            if (canStart.allowed) {
              await store.updateTask(task.id, { status: 'in-progress' });
              usageManager.trackTaskStart(task.id);
              usageManager.trackTaskCompletion(task.id, {
                inputTokens: 5000,
                outputTokens: 5000,
                totalTokens: 10000,
                estimatedCost: 8.0,
              }, true);
              await store.updateTask(task.id, { status: 'completed' });

              totalUsage += 8.0;
              processedTaskCount++;

              console.log(`Processed ${task.id} in ${transition.mode} mode. Total usage: $${totalUsage}`);
            }
          }
        }
      }

      await captureQueueStateSnapshot('fullday-final');

      // Verify queue integrity after full day simulation
      const finalTasks = await store.getAllTasks();
      expect(finalTasks).toHaveLength(10);

      const completedTasks = finalTasks.filter(t => t.status === 'completed');
      const pendingTasks = finalTasks.filter(t => t.status === 'pending');

      expect(completedTasks.length + pendingTasks.length).toBe(10);
      expect(processedTaskCount).toBe(completedTasks.length);

      // Verify no tasks were lost or corrupted during mode switches
      const originalTaskIds = tasks.map(t => t.id).sort();
      const finalTaskIds = finalTasks.map(t => t.id).sort();
      expect(finalTaskIds).toEqual(originalTaskIds);

      // Verify remaining tasks maintain priority order
      if (pendingTasks.length > 0) {
        const priorityOrder = { urgent: 1, high: 2, normal: 3, low: 4 };
        for (let i = 1; i < pendingTasks.length; i++) {
          const prevPriority = priorityOrder[pendingTasks[i-1].priority as keyof typeof priorityOrder] || 99;
          const currPriority = priorityOrder[pendingTasks[i].priority as keyof typeof priorityOrder] || 99;
          expect(currPriority).toBeGreaterThanOrEqual(prevPriority);
        }
      }

      console.log(`Full day simulation completed: ${processedTaskCount} tasks processed, ${pendingTasks.length} tasks remaining`);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle queue state during database connection issues', async () => {
      // Create initial tasks
      const tasks = Array.from({ length: 5 }, (_, i) =>
        createTestTask({ id: `db-test-${i}`, priority: 'normal' })
      );

      for (const task of tasks) {
        await store.createTask(task);
      }

      await captureQueueStateSnapshot('before-db-issue');

      // Close the store to simulate database issues
      store.close();

      // Attempt operations that might fail
      try {
        await store.getAllTasks();
        // If this succeeds, the store auto-reconnected
      } catch (error) {
        console.log('Expected database error during connection issue simulation');
      }

      // Reinitialize store
      store = new TaskStore(testDir);
      await store.initialize();

      await captureQueueStateSnapshot('after-db-recovery');

      // Verify tasks were not lost
      const recoveredTasks = await store.getAllTasks();
      expect(recoveredTasks).toHaveLength(5);

      const recoveredIds = recoveredTasks.map(t => t.id).sort();
      const originalIds = tasks.map(t => t.id).sort();
      expect(recoveredIds).toEqual(originalIds);
    });

    it('should handle capacity calculations during edge cases', async () => {
      // Test with zero budget
      const zeroBudgetLimits = { ...limits, dailyBudget: 0 };
      usageManager = new UsageManager(config, zeroBudgetLimits);

      const zeroUsageProvider = {
        getCurrentDailyUsage: () => usageManager.getUsageStats().current.dailyUsage,
        getActiveTasks: () => usageManager.getUsageStats().active.length,
        getDailyBudget: () => 0,
      };
      scheduler = new DaemonScheduler(config, zeroBudgetLimits, zeroUsageProvider);

      // Should handle gracefully
      const shouldPause = scheduler.shouldPauseTasks();
      expect(shouldPause).toBeDefined();

      // Test with negative usage (edge case)
      usageManager.resetDailyStats();

      // Test with very high usage
      const highUsageLimits = { ...limits, dailyBudget: 10000 };
      usageManager = new UsageManager(config, highUsageLimits);
      usageManager.trackTaskCompletion('expensive-task', {
        inputTokens: 100000,
        outputTokens: 100000,
        totalTokens: 200000,
        estimatedCost: 5000, // 50% of high budget
      }, true);

      const highUsageProvider = {
        getCurrentDailyUsage: () => usageManager.getUsageStats().current.dailyUsage,
        getActiveTasks: () => usageManager.getUsageStats().active.length,
        getDailyBudget: () => 10000,
      };
      scheduler = new DaemonScheduler(config, highUsageLimits, highUsageProvider);

      const highUsageDecision = scheduler.shouldPauseTasks();
      expect(highUsageDecision.shouldPause).toBe(false); // 50% < 70% threshold
    });
  });
});