import { describe, it, expect, beforeEach } from 'vitest';
import { DaemonScheduler, UsageManagerProvider } from './daemon-scheduler';
import { UsageManager } from './usage-manager';
import { DaemonConfig, LimitsConfig, TaskUsage } from '@apexcli/core';

// ============================================================================
// Integration Test Setup
// ============================================================================

const createTestConfig = (overrides: Partial<DaemonConfig> = {}): DaemonConfig => ({
  pollInterval: 5000,
  autoStart: false,
  logLevel: 'info',
  installAsService: false,
  serviceName: 'apex-daemon-test',
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 5000,
    retries: 3,
  },
  watchdog: {
    enabled: true,
    restartDelay: 5000,
    maxRestarts: 5,
    restartWindow: 300000,
  },
  timeBasedUsage: {
    enabled: true,
    dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
    nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
    dayModeCapacityThreshold: 0.75,
    nightModeCapacityThreshold: 0.90,
  },
  sessionRecovery: {
    enabled: true,
    autoResume: true,
  },
  idleManagement: {
    enabled: true,
    idleThresholdMs: 60000,
    maxIdleTasks: 3,
  },
  ...overrides,
});

const createTestLimits = (overrides: Partial<LimitsConfig> = {}): LimitsConfig => ({
  maxTokensPerTask: 500000,
  maxCostPerTask: 10.0,
  dailyBudget: 50.0,
  maxTurns: 100,
  maxConcurrentTasks: 3,
  maxRetries: 3,
  retryDelayMs: 1000,
  retryBackoffFactor: 2,
  ...overrides,
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('DaemonScheduler Integration Tests', () => {
  let usageManager: UsageManager;
  let scheduler: DaemonScheduler;
  let usageProvider: UsageManagerProvider;

  beforeEach(() => {
    const testConfig = createTestConfig();
    const testLimits = createTestLimits();

    usageManager = new UsageManager(testConfig, testLimits);
    usageProvider = new UsageManagerProvider(usageManager);
    scheduler = new DaemonScheduler(testConfig, testLimits, usageProvider);
  });

  describe('Real UsageManager Integration', () => {
    it('should integrate with UsageManager correctly', () => {
      // Start a task to create active tasks
      const taskId = 'integration-test-task';
      usageManager.trackTaskStart(taskId);

      // Get stats through scheduler
      const stats = scheduler.getUsageStats();

      expect(stats.dailyUsage.totalTokens).toBe(0); // No completed tasks yet
      expect(stats.dailyUsage.totalCost).toBe(0); // No completed tasks yet
      expect(stats.activeTasks).toBe(1); // One active task
    });

    it('should make correct scheduling decisions with completed tasks', () => {
      // Complete tasks to build up daily usage
      const tasks = ['task1', 'task2', 'task3'];
      tasks.forEach((taskId, index) => {
        const usage: TaskUsage = {
          inputTokens: 10000,
          outputTokens: 5000,
          totalTokens: 15000,
          estimatedCost: 12.0, // 36 total, 72% of 50 budget
        };

        usageManager.trackTaskStart(taskId);
        usageManager.updateTaskUsage(taskId, usage);
        usageManager.trackTaskCompletion(taskId, usage, true);
      });

      const dayTime = new Date('2024-01-01T14:00:00');
      const decision = scheduler.shouldPauseTasks(dayTime);

      // Should not pause because 72% < 75% threshold
      expect(decision.shouldPause).toBe(false);
    });

    it('should pause when daily usage exceeds threshold', () => {
      // Complete a high-cost task
      const taskId = 'expensive-task';
      const usage: TaskUsage = {
        inputTokens: 50000,
        outputTokens: 25000,
        totalTokens: 75000,
        estimatedCost: 40.0, // 80% of 50 budget
      };

      usageManager.trackTaskStart(taskId);
      usageManager.updateTaskUsage(taskId, usage);
      usageManager.trackTaskCompletion(taskId, usage, true);

      const dayTime = new Date('2024-01-01T14:00:00');
      const decision = scheduler.shouldPauseTasks(dayTime);

      // Should pause because 80% > 75% day threshold
      expect(decision.shouldPause).toBe(true);
      expect(decision.capacity.currentPercentage).toBe(0.8);
      expect(decision.reason).toContain('Capacity threshold exceeded');
    });

    it('should respect different thresholds for day vs night mode', () => {
      // Complete a task that puts us between day and night thresholds
      const taskId = 'threshold-test-task';
      const usage: TaskUsage = {
        inputTokens: 40000,
        outputTokens: 20000,
        totalTokens: 60000,
        estimatedCost: 42.0, // 84% of 50 budget
      };

      usageManager.trackTaskStart(taskId);
      usageManager.updateTaskUsage(taskId, usage);
      usageManager.trackTaskCompletion(taskId, usage, true);

      // Day mode - should pause (84% > 75%)
      const dayDecision = scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
      expect(dayDecision.shouldPause).toBe(true);

      // Night mode - should not pause (84% < 90%)
      const nightDecision = scheduler.shouldPauseTasks(new Date('2024-01-01T23:00:00'));
      expect(nightDecision.shouldPause).toBe(false);
    });

    it('should track active tasks correctly', () => {
      // Start multiple tasks but don't complete them
      const taskIds = ['active1', 'active2', 'active3'];
      taskIds.forEach(taskId => {
        usageManager.trackTaskStart(taskId);
      });

      const stats = scheduler.getUsageStats();
      expect(stats.activeTasks).toBe(3);

      // Complete one task
      const usage: TaskUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 1.0,
      };
      usageManager.trackTaskCompletion('active1', usage, true);

      const updatedStats = scheduler.getUsageStats();
      expect(updatedStats.activeTasks).toBe(2); // One completed, two still active
    });
  });

  describe('UsageManagerProvider Adapter', () => {
    it('should correctly provide daily usage stats', () => {
      // Complete some tasks to generate daily stats
      const taskId = 'stats-test-task';
      const usage: TaskUsage = {
        inputTokens: 5000,
        outputTokens: 2500,
        totalTokens: 7500,
        estimatedCost: 5.0,
      };

      usageManager.trackTaskStart(taskId);
      usageManager.updateTaskUsage(taskId, usage);
      usageManager.trackTaskCompletion(taskId, usage, true);

      const dailyUsage = usageProvider.getCurrentDailyUsage();
      expect(dailyUsage.totalTokens).toBe(7500);
      expect(dailyUsage.totalCost).toBe(5.0);
      expect(dailyUsage.tasksCompleted).toBe(1);
      expect(dailyUsage.tasksFailed).toBe(0);
    });

    it('should correctly provide active task count', () => {
      // Start some tasks
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskStart('task2');

      expect(usageProvider.getActiveTasks()).toBe(2);

      // Complete one
      const usage: TaskUsage = {
        inputTokens: 1000,
        outputTokens: 500,
        totalTokens: 1500,
        estimatedCost: 1.0,
      };
      usageManager.trackTaskCompletion('task1', usage, true);

      expect(usageProvider.getActiveTasks()).toBe(1);
    });

    it('should correctly provide daily budget', () => {
      expect(usageProvider.getDailyBudget()).toBe(50.0); // From test config
    });

    it('should handle failed tasks correctly', () => {
      const taskId = 'failed-task';
      const usage: TaskUsage = {
        inputTokens: 2000,
        outputTokens: 1000,
        totalTokens: 3000,
        estimatedCost: 2.0,
      };

      usageManager.trackTaskStart(taskId);
      usageManager.updateTaskUsage(taskId, usage);
      usageManager.trackTaskCompletion(taskId, usage, false); // Failed

      const dailyUsage = usageProvider.getCurrentDailyUsage();
      expect(dailyUsage.tasksCompleted).toBe(0);
      expect(dailyUsage.tasksFailed).toBe(1);
      expect(dailyUsage.totalCost).toBe(2.0); // Cost still counted
    });
  });

  describe('Performance with Real Components', () => {
    it('should perform well with realistic data volumes', () => {
      // Create realistic usage scenario
      for (let i = 0; i < 50; i++) {
        const taskId = `perf-task-${i}`;
        const usage: TaskUsage = {
          inputTokens: Math.floor(Math.random() * 10000),
          outputTokens: Math.floor(Math.random() * 5000),
          totalTokens: Math.floor(Math.random() * 15000),
          estimatedCost: Math.random() * 2.0
        };

        usageManager.trackTaskStart(taskId);
        usageManager.updateTaskUsage(taskId, usage);
        usageManager.trackTaskCompletion(taskId, usage, Math.random() > 0.1);
      }

      const start = Date.now();

      // Make multiple scheduling decisions
      for (let i = 0; i < 25; i++) {
        scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
        scheduler.getUsageStats();
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(500); // Should complete in reasonable time
    });

    it('should maintain consistency across multiple calls', () => {
      const taskId = 'consistency-task';
      const usage: TaskUsage = {
        inputTokens: 5000,
        outputTokens: 2500,
        totalTokens: 7500,
        estimatedCost: 10.0,
      };

      usageManager.trackTaskStart(taskId);
      usageManager.updateTaskUsage(taskId, usage);
      usageManager.trackTaskCompletion(taskId, usage, true);

      const fixedTime = new Date('2024-01-01T14:00:00');

      // Multiple calls should return consistent results
      const decisions = [];
      for (let i = 0; i < 10; i++) {
        decisions.push(scheduler.shouldPauseTasks(fixedTime));
      }

      // All decisions should be identical
      const firstDecision = decisions[0];
      decisions.forEach(decision => {
        expect(decision.shouldPause).toBe(firstDecision.shouldPause);
        expect(decision.capacity.currentPercentage).toBe(firstDecision.capacity.currentPercentage);
        expect(decision.timeWindow.mode).toBe(firstDecision.timeWindow.mode);
      });
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle disabled time-based usage', () => {
      const disabledConfig = createTestConfig({
        timeBasedUsage: { enabled: false }
      });

      const disabledUsageManager = new UsageManager(disabledConfig, createTestLimits());
      const disabledProvider = new UsageManagerProvider(disabledUsageManager);
      const disabledScheduler = new DaemonScheduler(disabledConfig, createTestLimits(), disabledProvider);

      const decision = disabledScheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));

      expect(decision.timeWindow.isActive).toBe(false);
      expect(decision.shouldPause).toBe(true);
      expect(decision.reason).toContain('Outside active time window');
    });

    it('should handle missing daily budget gracefully', () => {
      const noBudgetLimits = createTestLimits({ dailyBudget: undefined });

      const noBudgetUsageManager = new UsageManager(createTestConfig(), noBudgetLimits);
      const noBudgetProvider = new UsageManagerProvider(noBudgetUsageManager);

      expect(noBudgetProvider.getDailyBudget()).toBe(100.0); // Default fallback
    });
  });
});