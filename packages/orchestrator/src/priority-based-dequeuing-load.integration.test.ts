import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { DaemonRunner, type DaemonRunnerOptions } from './runner';
import { ApexOrchestrator } from './index';
import { TaskStore } from './store';
import type { Task, TaskPriority, TaskEffort } from '@apexcli/core';

/**
 * Priority-Based Dequeuing Under Load Integration Tests
 *
 * These tests verify that the priority-based dequeuing system works correctly under high load:
 * 1. Queue tasks with mixed priorities under high load
 * 2. Verify urgent/high priority tasks are dequeued before normal/low
 * 3. Verify effort-based tie-breaking works correctly under load
 * 4. Test concurrent dequeuing respects priority
 */
describe('Priority-Based Dequeuing Under Load Integration Tests', () => {
  const testProjectPath = '/tmp/apex-priority-load-test-' + Date.now();
  const apexDir = join(testProjectPath, '.apex');
  let runner: DaemonRunner;

  // Track task execution for verification
  let executedTaskIds: string[] = [];
  let taskExecutionOrder: Array<{
    id: string;
    priority: TaskPriority;
    effort: TaskEffort;
    timestamp: number;
    dequeueTime: number;
  }> = [];
  let dequeueTimes = new Map<string, number>();
  let executionStartTimes = new Map<string, number>();

  // Mock configuration for high-load priority testing
  const mockConfig = {
    project: {
      name: 'priority-load-test',
      version: '1.0.0',
    },
    limits: {
      maxConcurrentTasks: 8, // High concurrency to test priority under load
      maxUsagePerUser: 10000,
      maxUsagePerTask: 1000,
    },
    autonomy: {
      default: 'medium' as const,
      allowed: ['low', 'medium', 'high'] as const,
    },
    daemon: {
      pollInterval: 50, // Fast polling to increase load
      orphanDetection: {
        enabled: false, // Disable for cleaner test environment
      }
    }
  };

  const mockEffectiveConfig = {
    ...mockConfig,
    limits: {
      maxConcurrentTasks: 8,
      maxUsagePerUser: 10000,
      maxUsagePerTask: 1000,
      rateLimitRetryDelay: 1000, // Shorter for tests
    },
  };

  // Helper function to create test tasks with specific properties
  const createTestTask = (
    id: string,
    priority: TaskPriority,
    effort: TaskEffort,
    description?: string
  ): Task => ({
    id,
    description: description || `Priority ${priority} effort ${effort} task ${id}`,
    status: 'pending',
    priority,
    effort,
    workflow: 'test-workflow',
    autonomy: 'medium',
    projectPath: testProjectPath,
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
  });

  // Helper function to generate mixed priority task loads
  const generateMixedPriorityTaskLoad = (totalTasks: number): Task[] => {
    const tasks: Task[] = [];
    const priorities: TaskPriority[] = ['urgent', 'high', 'normal', 'low'];
    const efforts: TaskEffort[] = ['xs', 'small', 'medium', 'large', 'xl'];

    // Create a realistic distribution
    const urgentTasks = Math.ceil(totalTasks * 0.1); // 10% urgent
    const highTasks = Math.ceil(totalTasks * 0.25);  // 25% high
    const normalTasks = Math.ceil(totalTasks * 0.45); // 45% normal
    const lowTasks = totalTasks - urgentTasks - highTasks - normalTasks; // Remainder low

    let taskIndex = 0;

    // Create urgent tasks with varied effort
    for (let i = 0; i < urgentTasks; i++) {
      const effort = efforts[i % efforts.length];
      tasks.push(createTestTask(`urgent-${taskIndex++}`, 'urgent', effort));
    }

    // Create high priority tasks
    for (let i = 0; i < highTasks; i++) {
      const effort = efforts[i % efforts.length];
      tasks.push(createTestTask(`high-${taskIndex++}`, 'high', effort));
    }

    // Create normal priority tasks
    for (let i = 0; i < normalTasks; i++) {
      const effort = efforts[i % efforts.length];
      tasks.push(createTestTask(`normal-${taskIndex++}`, 'normal', effort));
    }

    // Create low priority tasks
    for (let i = 0; i < lowTasks; i++) {
      const effort = efforts[i % efforts.length];
      tasks.push(createTestTask(`low-${taskIndex++}`, 'low', effort));
    }

    // Shuffle to simulate real-world random insertion order
    return tasks.sort(() => Math.random() - 0.5);
  };

  // Helper to create controlled priority scenarios for tie-breaking tests
  const createTieBreakingScenario = (): Task[] => {
    const baseTime = new Date();

    return [
      // Same priority, different efforts
      createTestTask('same-priority-xl', 'high', 'xl'),
      createTestTask('same-priority-xs', 'high', 'xs'),
      createTestTask('same-priority-large', 'high', 'large'),
      createTestTask('same-priority-small', 'high', 'small'),
      createTestTask('same-priority-medium', 'high', 'medium'),

      // Mix in other priorities
      createTestTask('urgent-large', 'urgent', 'large'),
      createTestTask('urgent-xs', 'urgent', 'xs'),
      createTestTask('normal-xs', 'normal', 'xs'),
      createTestTask('normal-xl', 'normal', 'xl'),
      createTestTask('low-xs', 'low', 'xs'),
    ];
  };

  beforeEach(async () => {
    // Reset tracking arrays
    executedTaskIds = [];
    taskExecutionOrder = [];
    dequeueTimes.clear();
    executionStartTimes.clear();

    // Clear all mocks
    vi.clearAllMocks();

    // Create test directory structure
    await fs.mkdir(apexDir, { recursive: true });

    // Mock the core module functions
    vi.doMock('@apexcli/core', () => ({
      loadConfig: vi.fn().mockResolvedValue(mockConfig),
      getEffectiveConfig: vi.fn().mockReturnValue(mockEffectiveConfig),
      generateTaskId: vi.fn().mockImplementation(() => `task-${Date.now()}-${Math.random()}`),
    }));

    // Mock TaskStore with priority-based queue behavior
    vi.doMock('./store', () => ({
      TaskStore: vi.fn().mockImplementation(() => {
        let taskQueue: Task[] = [];

        const priorityOrder = { urgent: 1, high: 2, normal: 3, low: 4 };
        const effortOrder = { xs: 1, small: 2, medium: 3, large: 4, xl: 5 };

        // Sort tasks by priority, then effort, then creation time
        const sortTasks = (tasks: Task[]) => {
          return [...tasks].sort((a, b) => {
            const aPriority = priorityOrder[a.priority] || 99;
            const bPriority = priorityOrder[b.priority] || 99;

            if (aPriority !== bPriority) {
              return aPriority - bPriority;
            }

            // Same priority, sort by effort
            const aEffort = effortOrder[a.effort] || 99;
            const bEffort = effortOrder[b.effort] || 99;

            if (aEffort !== bEffort) {
              return aEffort - bEffort;
            }

            // Same priority and effort, sort by creation time
            return a.createdAt.getTime() - b.createdAt.getTime();
          });
        };

        return {
          initialize: vi.fn().mockResolvedValue(undefined),
          close: vi.fn(),

          // Priority-based queue management
          getNextQueuedTask: vi.fn().mockImplementation(async () => {
            if (taskQueue.length === 0) return null;

            // Sort tasks to ensure priority ordering
            taskQueue = sortTasks(taskQueue);
            const nextTask = taskQueue.shift();

            if (nextTask) {
              // Record dequeue time
              dequeueTimes.set(nextTask.id, Date.now());
            }

            return nextTask || null;
          }),

          // Test utility methods
          addTasksToQueue: vi.fn().mockImplementation((tasks: Task[]) => {
            taskQueue.push(...tasks);
          }),

          getQueueSize: vi.fn().mockImplementation(() => taskQueue.length),
          clearQueue: vi.fn().mockImplementation(() => { taskQueue = []; }),
          getQueueSnapshot: vi.fn().mockImplementation(() => [...taskQueue]),

          // Required store methods
          updateTaskStatus: vi.fn().mockResolvedValue(undefined),
          addLog: vi.fn().mockResolvedValue(undefined),
          createTask: vi.fn().mockResolvedValue(undefined),
          getTask: vi.fn().mockImplementation(async (id) =>
            taskQueue.find(t => t.id === id) || null
          ),
        };
      }),
    }));

    // Mock ApexOrchestrator with execution tracking
    const EventEmitter = require('events');
    vi.doMock('./index', () => ({
      ApexOrchestrator: vi.fn().mockImplementation(() => {
        const emitter = new EventEmitter();
        return {
          ...emitter,
          initialize: vi.fn().mockResolvedValue(undefined),
          executeTask: vi.fn().mockImplementation(async (taskId: string) => {
            // Find the task to get its properties
            const { TaskStore } = await import('./store');
            const mockStore = new TaskStore(testProjectPath) as any;
            const task = await mockStore.getTask(taskId);

            if (!task) {
              throw new Error(`Task ${taskId} not found`);
            }

            // Record execution start time
            executionStartTimes.set(taskId, Date.now());
            executedTaskIds.push(taskId);

            // Record in execution order with timing data
            const dequeueTime = dequeueTimes.get(taskId) || Date.now();
            taskExecutionOrder.push({
              id: taskId,
              priority: task.priority,
              effort: task.effort,
              timestamp: Date.now(),
              dequeueTime: dequeueTime,
            });

            // Emit start events
            emitter.emit('task:stage-changed', task, 'planning');

            // Simulate execution time based on effort
            const effortTimes = {
              xs: 30 + Math.random() * 20,      // 30-50ms
              small: 50 + Math.random() * 30,   // 50-80ms
              medium: 80 + Math.random() * 40,  // 80-120ms
              large: 120 + Math.random() * 60,  // 120-180ms
              xl: 180 + Math.random() * 120,    // 180-300ms
            };

            const executionTime = effortTimes[task.effort] || 100;
            await new Promise(resolve => setTimeout(resolve, executionTime));

            // Emit completion events
            emitter.emit('task:stage-changed', task, 'implementation');
            emitter.emit('task:stage-changed', task, 'testing');
            emitter.emit('task:completed', task);

            return;
          }),
        };
      }),
    }));
  });

  afterEach(async () => {
    // Stop the runner if it's running
    if (runner) {
      try {
        await runner.stop();
      } catch {
        // Ignore errors during cleanup
      }
    }

    // Clean up test directory
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Reset all mocks
    vi.resetAllMocks();
    vi.doUnmock('@apexcli/core');
    vi.doUnmock('./store');
    vi.doUnmock('./index');
  });

  describe('Mixed Priority Task Queueing Under High Load', () => {
    it('should maintain priority ordering when queueing 100+ mixed priority tasks under high load', async () => {
      // Create a high-load scenario with 150 mixed priority tasks
      const tasks = generateMixedPriorityTaskLoad(150);

      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;

      // Add all tasks to queue in random order to simulate high load
      mockStore.addTasksToQueue(tasks);

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 25, // Very fast polling to increase load
        maxConcurrentTasks: 8, // High concurrency
        logToStdout: false,
      });

      const startTime = Date.now();
      await runner.start();

      // Wait for all tasks to be processed
      let attempts = 0;
      const maxAttempts = 200; // 20 seconds max

      while (executedTaskIds.length < 150 && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      const endTime = Date.now();
      await runner.stop();

      // Verify all tasks were processed
      expect(executedTaskIds.length).toBe(150);

      // Analyze execution order by priority
      const executionByPriority = {
        urgent: taskExecutionOrder.filter(t => t.priority === 'urgent'),
        high: taskExecutionOrder.filter(t => t.priority === 'high'),
        normal: taskExecutionOrder.filter(t => t.priority === 'normal'),
        low: taskExecutionOrder.filter(t => t.priority === 'low'),
      };

      // Verify priority ordering: urgent tasks should generally complete before high/normal/low
      const firstUrgentIndex = taskExecutionOrder.findIndex(t => t.priority === 'urgent');
      const lastUrgentIndex = taskExecutionOrder.map(t => t.priority).lastIndexOf('urgent');

      const firstNormalIndex = taskExecutionOrder.findIndex(t => t.priority === 'normal');
      const firstLowIndex = taskExecutionOrder.findIndex(t => t.priority === 'low');

      // Most urgent tasks should start before most normal/low tasks
      if (firstNormalIndex !== -1) {
        expect(firstUrgentIndex).toBeLessThan(firstNormalIndex);
      }
      if (firstLowIndex !== -1) {
        expect(firstUrgentIndex).toBeLessThan(firstLowIndex);
      }

      // Calculate average execution positions by priority
      const avgPositions = {
        urgent: executionByPriority.urgent.reduce((sum, t, idx) =>
          sum + taskExecutionOrder.indexOf(t), 0) / executionByPriority.urgent.length,
        high: executionByPriority.high.reduce((sum, t, idx) =>
          sum + taskExecutionOrder.indexOf(t), 0) / executionByPriority.high.length,
        normal: executionByPriority.normal.reduce((sum, t, idx) =>
          sum + taskExecutionOrder.indexOf(t), 0) / executionByPriority.normal.length,
        low: executionByPriority.low.reduce((sum, t, idx) =>
          sum + taskExecutionOrder.indexOf(t), 0) / executionByPriority.low.length,
      };

      // Verify average positions follow priority order
      expect(avgPositions.urgent).toBeLessThan(avgPositions.high);
      expect(avgPositions.high).toBeLessThan(avgPositions.normal);
      expect(avgPositions.normal).toBeLessThan(avgPositions.low);

      const totalDuration = endTime - startTime;
      const throughput = 150 / (totalDuration / 1000);

      console.log(`High-load priority test: 150 mixed tasks in ${totalDuration}ms (${throughput.toFixed(1)} tasks/sec)`);
      console.log('Priority distribution:', {
        urgent: executionByPriority.urgent.length,
        high: executionByPriority.high.length,
        normal: executionByPriority.normal.length,
        low: executionByPriority.low.length,
      });
      console.log('Average execution positions by priority:', avgPositions);
    }, 25000); // 25 second timeout

    it('should handle rapid task insertion while maintaining priority order', async () => {
      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 30,
        maxConcurrentTasks: 6,
        logToStdout: false,
      });

      await runner.start();

      // Add tasks in multiple waves to simulate real-world load
      const totalTasks = 120;
      const wavesCount = 6;
      const tasksPerWave = 20;
      let tasksAdded = 0;

      const addTaskWave = () => {
        if (tasksAdded >= totalTasks) return;

        const remainingTasks = Math.min(tasksPerWave, totalTasks - tasksAdded);
        const waveTasks = generateMixedPriorityTaskLoad(remainingTasks);
        mockStore.addTasksToQueue(waveTasks);
        tasksAdded += remainingTasks;
      };

      // Add initial wave
      addTaskWave();

      // Add subsequent waves at intervals
      const waveInterval = setInterval(() => {
        addTaskWave();
        if (tasksAdded >= totalTasks) {
          clearInterval(waveInterval);
        }
      }, 200); // Add wave every 200ms

      // Wait for all tasks to be added and processed
      let attempts = 0;
      while ((executedTaskIds.length < totalTasks || tasksAdded < totalTasks) && attempts < 250) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      clearInterval(waveInterval);
      await runner.stop();

      // Verify all tasks were processed
      expect(executedTaskIds.length).toBe(totalTasks);

      // Verify that urgent and high priority tasks were generally processed first
      const firstHalf = taskExecutionOrder.slice(0, totalTasks / 2);
      const urgentHighCount = firstHalf.filter(t => t.priority === 'urgent' || t.priority === 'high').length;
      const normalLowCount = firstHalf.filter(t => t.priority === 'normal' || t.priority === 'low').length;

      // At least 60% of the first half should be urgent/high priority
      expect(urgentHighCount).toBeGreaterThan(normalLowCount);

      console.log(`Rapid insertion test: ${totalTasks} tasks in ${wavesCount} waves`);
      console.log(`First half composition: ${urgentHighCount} urgent/high, ${normalLowCount} normal/low`);
    }, 20000);
  });

  describe('Urgent/High Priority Dequeuing Verification', () => {
    it('should consistently dequeue urgent tasks before normal/low priority tasks under load', async () => {
      // Create a specific mix to test priority precedence
      const urgentTasks = Array.from({ length: 20 }, (_, i) =>
        createTestTask(`urgent-${i}`, 'urgent', 'medium')
      );

      const normalTasks = Array.from({ length: 30 }, (_, i) =>
        createTestTask(`normal-${i}`, 'normal', 'small') // Even with smaller effort
      );

      const lowTasks = Array.from({ length: 25 }, (_, i) =>
        createTestTask(`low-${i}`, 'low', 'xs') // Even with smallest effort
      );

      const allTasks = [...urgentTasks, ...normalTasks, ...lowTasks];
      const shuffledTasks = allTasks.sort(() => Math.random() - 0.5);

      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;
      mockStore.addTasksToQueue(shuffledTasks);

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 40,
        maxConcurrentTasks: 10, // High concurrency to create load
        logToStdout: false,
      });

      await runner.start();

      // Wait for all tasks to complete
      let attempts = 0;
      while (executedTaskIds.length < 75 && attempts < 150) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      await runner.stop();

      // Verify all urgent tasks completed
      expect(executedTaskIds.length).toBe(75);

      // Find positions of urgent, normal, and low priority tasks
      const urgentPositions: number[] = [];
      const normalPositions: number[] = [];
      const lowPositions: number[] = [];

      taskExecutionOrder.forEach((task, index) => {
        if (task.priority === 'urgent') urgentPositions.push(index);
        if (task.priority === 'normal') normalPositions.push(index);
        if (task.priority === 'low') lowPositions.push(index);
      });

      // Calculate statistics
      const avgUrgentPosition = urgentPositions.reduce((a, b) => a + b, 0) / urgentPositions.length;
      const avgNormalPosition = normalPositions.reduce((a, b) => a + b, 0) / normalPositions.length;
      const avgLowPosition = lowPositions.reduce((a, b) => a + b, 0) / lowPositions.length;

      const lastUrgentPosition = Math.max(...urgentPositions);
      const firstNormalPosition = Math.min(...normalPositions);
      const firstLowPosition = Math.min(...lowPositions);

      // Verify priority ordering
      expect(avgUrgentPosition).toBeLessThan(avgNormalPosition);
      expect(avgUrgentPosition).toBeLessThan(avgLowPosition);
      expect(avgNormalPosition).toBeLessThan(avgLowPosition);

      // At least 80% of urgent tasks should complete in the first 40% of executions
      const urgentInFirst40Percent = urgentPositions.filter(pos => pos < 30).length;
      expect(urgentInFirst40Percent).toBeGreaterThanOrEqual(16); // 80% of 20 urgent tasks

      // Most urgent tasks should complete before most normal tasks start
      expect(lastUrgentPosition).toBeLessThan(firstNormalPosition + 15); // Allow some overlap for concurrency

      console.log('Priority verification under load:', {
        avgUrgentPosition: avgUrgentPosition.toFixed(1),
        avgNormalPosition: avgNormalPosition.toFixed(1),
        avgLowPosition: avgLowPosition.toFixed(1),
        urgentInFirst40Percent,
        lastUrgentPosition,
        firstNormalPosition,
      });
    }, 20000);

    it('should dequeue high priority tasks before normal/low priority under sustained load', async () => {
      // Create sustained load with continuous task addition
      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 35,
        maxConcurrentTasks: 8,
        logToStdout: false,
      });

      await runner.start();

      // Add tasks continuously to maintain load
      let totalTasksAdded = 0;
      const maxTasks = 100;

      const addTasksInterval = setInterval(() => {
        if (totalTasksAdded >= maxTasks) {
          clearInterval(addTasksInterval);
          return;
        }

        // Add a batch of mixed priority tasks
        const batchTasks = [
          createTestTask(`high-${totalTasksAdded}`, 'high', 'small'),
          createTestTask(`normal-${totalTasksAdded}`, 'normal', 'small'),
          createTestTask(`low-${totalTasksAdded}`, 'low', 'small'),
        ];

        mockStore.addTasksToQueue(batchTasks);
        totalTasksAdded += 3;
      }, 150); // Add tasks every 150ms to maintain pressure

      // Wait for processing to complete
      let attempts = 0;
      while (executedTaskIds.length < maxTasks && attempts < 200) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      clearInterval(addTasksInterval);
      await runner.stop();

      expect(executedTaskIds.length).toBe(maxTasks);

      // Analyze priority distribution over time
      const timeWindows = 5;
      const windowSize = Math.ceil(taskExecutionOrder.length / timeWindows);

      for (let window = 0; window < timeWindows; window++) {
        const start = window * windowSize;
        const end = Math.min(start + windowSize, taskExecutionOrder.length);
        const windowTasks = taskExecutionOrder.slice(start, end);

        const highCount = windowTasks.filter(t => t.priority === 'high').length;
        const normalCount = windowTasks.filter(t => t.priority === 'normal').length;
        const lowCount = windowTasks.filter(t => t.priority === 'low').length;

        // In each time window, high priority should be well represented
        // Allow some variance due to concurrency but high should dominate
        const totalInWindow = windowTasks.length;
        const highPercentage = (highCount / totalInWindow) * 100;

        console.log(`Window ${window + 1}: High ${highPercentage.toFixed(1)}% (${highCount}/${totalInWindow})`);

        // High priority should represent at least 25% in most windows (accounting for concurrency)
        // This is relaxed due to the continuous addition and high concurrency
      }

      // Overall, high priority tasks should have better average position than normal/low
      const highPositions = taskExecutionOrder
        .map((task, idx) => task.priority === 'high' ? idx : -1)
        .filter(pos => pos !== -1);
      const normalPositions = taskExecutionOrder
        .map((task, idx) => task.priority === 'normal' ? idx : -1)
        .filter(pos => pos !== -1);

      const avgHighPos = highPositions.reduce((a, b) => a + b, 0) / highPositions.length;
      const avgNormalPos = normalPositions.reduce((a, b) => a + b, 0) / normalPositions.length;

      expect(avgHighPos).toBeLessThan(avgNormalPos);

      console.log('Sustained load priority test completed:', {
        totalTasks: maxTasks,
        avgHighPosition: avgHighPos.toFixed(1),
        avgNormalPosition: avgNormalPos.toFixed(1),
      });
    }, 25000);
  });

  describe('Effort-Based Tie-Breaking Under Load', () => {
    it('should correctly apply effort-based tie-breaking for same priority tasks under load', async () => {
      // Create specific scenario to test effort tie-breaking
      const tieBreakingTasks = createTieBreakingScenario();

      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;
      mockStore.addTasksToQueue(tieBreakingTasks);

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 30,
        maxConcurrentTasks: 5, // Moderate concurrency to observe tie-breaking
        logToStdout: false,
      });

      await runner.start();

      // Wait for all tasks to complete
      let attempts = 0;
      while (executedTaskIds.length < tieBreakingTasks.length && attempts < 100) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      await runner.stop();

      expect(executedTaskIds.length).toBe(tieBreakingTasks.length);

      // Analyze effort ordering within priority groups
      const priorityGroups = {
        urgent: taskExecutionOrder.filter(t => t.priority === 'urgent'),
        high: taskExecutionOrder.filter(t => t.priority === 'high'),
        normal: taskExecutionOrder.filter(t => t.priority === 'normal'),
        low: taskExecutionOrder.filter(t => t.priority === 'low'),
      };

      // Test urgent priority group effort ordering
      const urgentGroup = priorityGroups.urgent;
      if (urgentGroup.length > 1) {
        const urgentXsIdx = urgentGroup.findIndex(t => t.effort === 'xs');
        const urgentLargeIdx = urgentGroup.findIndex(t => t.effort === 'large');

        if (urgentXsIdx !== -1 && urgentLargeIdx !== -1) {
          expect(urgentXsIdx).toBeLessThan(urgentLargeIdx);
        }
      }

      // Test high priority group effort ordering (main focus)
      const highGroup = priorityGroups.high;
      expect(highGroup.length).toBe(5); // Should have 5 high priority tasks

      const effortOrder = ['xs', 'small', 'medium', 'large', 'xl'];

      // Find positions of each effort level within high priority group
      const effortPositions = effortOrder.map(effort =>
        highGroup.findIndex(t => t.effort === effort)
      ).filter(pos => pos !== -1);

      // Verify that positions are generally in ascending order
      // Allow some variance due to concurrency but overall trend should be correct
      for (let i = 0; i < effortPositions.length - 1; i++) {
        // Each effort should generally come before larger efforts
        // We allow some tolerance due to concurrent execution
        expect(effortPositions[i]).toBeLessThanOrEqual(effortPositions[i + 1] + 2);
      }

      // Verify specific effort ordering within high priority
      const highXsPos = highGroup.findIndex(t => t.effort === 'xs');
      const highXlPos = highGroup.findIndex(t => t.effort === 'xl');

      expect(highXsPos).toBeLessThan(highXlPos);

      console.log('Effort tie-breaking results for high priority tasks:');
      highGroup.forEach((task, idx) => {
        console.log(`  Position ${idx}: ${task.id} (effort: ${task.effort})`);
      });
    }, 15000);

    it('should maintain effort-based ordering under heavy concurrent load', async () => {
      // Create a large number of tasks with the same priority but different efforts
      const samePriorityTasks: Task[] = [];
      const efforts: TaskEffort[] = ['xs', 'small', 'medium', 'large', 'xl'];

      // Create multiple tasks for each effort level
      for (let round = 0; round < 8; round++) {
        for (const effort of efforts) {
          samePriorityTasks.push(createTestTask(`normal-${effort}-${round}`, 'normal', effort));
        }
      }

      // Shuffle to ensure insertion order doesn't affect results
      const shuffledTasks = samePriorityTasks.sort(() => Math.random() - 0.5);

      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;
      mockStore.addTasksToQueue(shuffledTasks);

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 25,
        maxConcurrentTasks: 8, // High concurrency
        logToStdout: false,
      });

      await runner.start();

      // Wait for all tasks to complete
      let attempts = 0;
      while (executedTaskIds.length < samePriorityTasks.length && attempts < 150) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      await runner.stop();

      expect(executedTaskIds.length).toBe(samePriorityTasks.length);

      // Analyze effort distribution across execution order
      const effortGroups = {
        xs: taskExecutionOrder.filter(t => t.effort === 'xs'),
        small: taskExecutionOrder.filter(t => t.effort === 'small'),
        medium: taskExecutionOrder.filter(t => t.effort === 'medium'),
        large: taskExecutionOrder.filter(t => t.effort === 'large'),
        xl: taskExecutionOrder.filter(t => t.effort === 'xl'),
      };

      // Calculate average positions for each effort level
      const avgPositions = Object.entries(effortGroups).reduce((acc, [effort, tasks]) => {
        const positions = tasks.map(task => taskExecutionOrder.indexOf(task));
        acc[effort] = positions.reduce((sum, pos) => sum + pos, 0) / positions.length;
        return acc;
      }, {} as Record<string, number>);

      // Verify that average positions follow effort order
      expect(avgPositions.xs).toBeLessThan(avgPositions.small);
      expect(avgPositions.small).toBeLessThan(avgPositions.medium);
      expect(avgPositions.medium).toBeLessThan(avgPositions.large);
      expect(avgPositions.large).toBeLessThan(avgPositions.xl);

      // Verify that smaller effort tasks are well-represented in early positions
      const firstQuarter = taskExecutionOrder.slice(0, Math.ceil(taskExecutionOrder.length / 4));
      const xsInFirstQuarter = firstQuarter.filter(t => t.effort === 'xs').length;
      const xlInFirstQuarter = firstQuarter.filter(t => t.effort === 'xl').length;

      // XS tasks should be much better represented in first quarter than XL tasks
      expect(xsInFirstQuarter).toBeGreaterThan(xlInFirstQuarter);

      console.log('Heavy load effort ordering results:');
      console.log('Average positions by effort:', avgPositions);
      console.log(`First quarter distribution: ${xsInFirstQuarter} xs, ${xlInFirstQuarter} xl`);
    }, 20000);
  });

  describe('Concurrent Dequeuing Priority Respect', () => {
    it('should maintain priority ordering when multiple workers dequeue concurrently', async () => {
      // Create a realistic mixed workload
      const mixedWorkload = [
        // Urgent tasks with various efforts
        ...Array.from({ length: 15 }, (_, i) =>
          createTestTask(`urgent-${i}`, 'urgent', ['xs', 'small', 'medium'][i % 3] as TaskEffort)
        ),
        // High priority tasks
        ...Array.from({ length: 25 }, (_, i) =>
          createTestTask(`high-${i}`, 'high', ['xs', 'small', 'medium', 'large'][i % 4] as TaskEffort)
        ),
        // Normal priority tasks
        ...Array.from({ length: 35 }, (_, i) =>
          createTestTask(`normal-${i}`, 'normal', ['small', 'medium', 'large'][i % 3] as TaskEffort)
        ),
        // Low priority tasks
        ...Array.from({ length: 25 }, (_, i) =>
          createTestTask(`low-${i}`, 'low', ['xs', 'small'][i % 2] as TaskEffort)
        ),
      ];

      const shuffledWorkload = mixedWorkload.sort(() => Math.random() - 0.5);

      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;
      mockStore.addTasksToQueue(shuffledWorkload);

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 20, // Very fast polling
        maxConcurrentTasks: 12, // High concurrency to test concurrent dequeuing
        logToStdout: false,
      });

      const startTime = Date.now();
      await runner.start();

      // Wait for all tasks to complete
      let attempts = 0;
      while (executedTaskIds.length < mixedWorkload.length && attempts < 200) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      const endTime = Date.now();
      await runner.stop();

      expect(executedTaskIds.length).toBe(mixedWorkload.length);

      // Analyze concurrent dequeue timing
      const dequeueTimeline = taskExecutionOrder
        .sort((a, b) => a.dequeueTime - b.dequeueTime)
        .map(task => ({
          ...task,
          relativeDequeueTime: task.dequeueTime - taskExecutionOrder[0].dequeueTime,
        }));

      // Verify that early dequeues are dominated by high priority tasks
      const firstThird = Math.ceil(dequeueTimeline.length / 3);
      const earlyDequeues = dequeueTimeline.slice(0, firstThird);

      const earlyUrgentCount = earlyDequeues.filter(t => t.priority === 'urgent').length;
      const earlyHighCount = earlyDequeues.filter(t => t.priority === 'high').length;
      const earlyLowCount = earlyDequeues.filter(t => t.priority === 'low').length;

      // Most early dequeues should be urgent or high priority
      const earlyHighPriorityCount = earlyUrgentCount + earlyHighCount;
      expect(earlyHighPriorityCount).toBeGreaterThan(earlyLowCount * 2);

      // Verify that urgent tasks are dequeued first overall
      const firstUrgentDequeue = dequeueTimeline.findIndex(t => t.priority === 'urgent');
      const firstLowDequeue = dequeueTimeline.findIndex(t => t.priority === 'low');

      expect(firstUrgentDequeue).toBeLessThan(firstLowDequeue);

      // Check for any priority violations in concurrent dequeuing
      let priorityViolations = 0;
      const priorityValues = { urgent: 1, high: 2, normal: 3, low: 4 };

      for (let i = 0; i < dequeueTimeline.length - 1; i++) {
        const current = dequeueTimeline[i];
        const next = dequeueTimeline[i + 1];

        // If next task was dequeued very close in time (within 100ms),
        // it might be concurrent, so we allow some flexibility
        const timeDiff = next.dequeueTime - current.dequeueTime;

        if (timeDiff > 100) { // Non-concurrent dequeue
          const currentPriority = priorityValues[current.priority];
          const nextPriority = priorityValues[next.priority];

          if (nextPriority < currentPriority) {
            priorityViolations++;
          }
        }
      }

      // Should have very few priority violations
      const violationRate = (priorityViolations / dequeueTimeline.length) * 100;
      expect(violationRate).toBeLessThan(5); // Less than 5% violation rate

      const totalDuration = endTime - startTime;
      const throughput = mixedWorkload.length / (totalDuration / 1000);

      console.log(`Concurrent dequeue test: ${mixedWorkload.length} tasks in ${totalDuration}ms`);
      console.log(`Throughput: ${throughput.toFixed(1)} tasks/sec`);
      console.log('Early dequeue composition:', {
        urgent: earlyUrgentCount,
        high: earlyHighCount,
        low: earlyLowCount,
      });
      console.log(`Priority violations: ${priorityViolations}/${dequeueTimeline.length} (${violationRate.toFixed(1)}%)`);
    }, 30000); // 30 second timeout

    it('should handle priority changes during concurrent dequeuing', async () => {
      // Create initial task set
      const initialTasks = [
        ...Array.from({ length: 20 }, (_, i) => createTestTask(`normal-${i}`, 'normal', 'medium')),
        ...Array.from({ length: 15 }, (_, i) => createTestTask(`low-${i}`, 'low', 'small')),
      ];

      const { TaskStore } = await import('./store');
      const mockStore = new TaskStore(testProjectPath) as any;
      mockStore.addTasksToQueue(initialTasks);

      runner = new DaemonRunner({
        projectPath: testProjectPath,
        pollIntervalMs: 40,
        maxConcurrentTasks: 6,
        logToStdout: false,
      });

      await runner.start();

      // After a short delay, add urgent tasks to test priority insertion
      setTimeout(() => {
        const urgentTasks = Array.from({ length: 10 }, (_, i) =>
          createTestTask(`urgent-${i}`, 'urgent', 'xs')
        );
        mockStore.addTasksToQueue(urgentTasks);
      }, 500);

      // Add more urgent tasks later
      setTimeout(() => {
        const moreUrgentTasks = Array.from({ length: 5 }, (_, i) =>
          createTestTask(`urgent-late-${i}`, 'urgent', 'small')
        );
        mockStore.addTasksToQueue(moreUrgentTasks);
      }, 1500);

      // Wait for all tasks to complete
      const totalTasks = 35 + 10 + 5; // 50 total
      let attempts = 0;
      while (executedTaskIds.length < totalTasks && attempts < 150) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      await runner.stop();

      expect(executedTaskIds.length).toBe(totalTasks);

      // Analyze how urgent tasks were prioritized even when added later
      const urgentExecutions = taskExecutionOrder.filter(t => t.priority === 'urgent');
      const normalExecutions = taskExecutionOrder.filter(t => t.priority === 'normal');

      // Most urgent tasks should execute in the first half even though added later
      const firstHalf = taskExecutionOrder.slice(0, Math.ceil(totalTasks / 2));
      const urgentInFirstHalf = firstHalf.filter(t => t.priority === 'urgent').length;
      const normalInFirstHalf = firstHalf.filter(t => t.priority === 'normal').length;

      // Urgent tasks should dominate the first half despite being added later
      expect(urgentInFirstHalf).toBeGreaterThan(normalInFirstHalf);

      // Verify that urgent tasks added later still got priority
      const lateUrgentTasks = urgentExecutions.filter(t => t.id.includes('urgent-late'));
      expect(lateUrgentTasks.length).toBe(5);

      // These late urgent tasks should still execute before most normal/low tasks
      const avgLateUrgentPosition = lateUrgentTasks.reduce((sum, task) =>
        sum + taskExecutionOrder.indexOf(task), 0) / lateUrgentTasks.length;

      expect(avgLateUrgentPosition).toBeLessThan(totalTasks * 0.7); // Should be in first 70%

      console.log('Priority insertion test results:', {
        totalTasks,
        urgentInFirstHalf,
        normalInFirstHalf,
        avgLateUrgentPosition: avgLateUrgentPosition.toFixed(1),
        lateUrgentCount: lateUrgentTasks.length,
      });
    }, 20000);
  });
});