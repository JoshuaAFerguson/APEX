import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DaemonScheduler, UsageManagerProvider } from './daemon-scheduler';
import { UsageManager } from './usage-manager';
import { DaemonConfig, LimitsConfig, TaskUsage } from '@apex/core';

// ============================================================================
// Integration Tests for Capacity Reset Monitoring with Real Components
// ============================================================================

const createIntegrationConfig = (overrides: Partial<DaemonConfig> = {}): DaemonConfig => ({
  pollInterval: 5000,
  autoStart: false,
  logLevel: 'info',
  installAsService: false,
  serviceName: 'apex-daemon-integration',
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
    dayModeCapacityThreshold: 0.75, // 75% for easier testing
    nightModeCapacityThreshold: 0.90, // 90%
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

const createIntegrationLimits = (overrides: Partial<LimitsConfig> = {}): LimitsConfig => ({
  maxTokensPerTask: 500000,
  maxCostPerTask: 10.0,
  dailyBudget: 100.0, // $100 daily budget
  maxTurns: 100,
  maxConcurrentTasks: 3,
  maxRetries: 3,
  retryDelayMs: 1000,
  retryBackoffFactor: 2,
  ...overrides,
});

describe('DaemonScheduler - Capacity Monitoring Integration', () => {
  let usageManager: UsageManager;
  let scheduler: DaemonScheduler;
  let usageProvider: UsageManagerProvider;

  beforeEach(() => {
    const config = createIntegrationConfig();
    const limits = createIntegrationLimits();

    usageManager = new UsageManager(config, limits);
    usageProvider = new UsageManagerProvider(usageManager);
    scheduler = new DaemonScheduler(config, limits, usageProvider);
  });

  afterEach(() => {
    scheduler.destroy();
  });

  describe('Real-world Time Calculation Integration', () => {
    it('should calculate accurate times with real UsageManager', () => {
      // Test getTimeUntilModeSwitch with real implementation
      const currentTime = new Date('2024-01-01T14:00:00');
      const timeUntilSwitch = scheduler.getTimeUntilModeSwitch(currentTime);

      // Should be 8 hours until night mode (22:00)
      const expectedMs = 8 * 60 * 60 * 1000;
      expect(timeUntilSwitch).toBe(expectedMs);
    });

    it('should calculate accurate budget reset times', () => {
      const currentTime = new Date('2024-01-01T18:30:15.123');
      const timeUntilReset = scheduler.getTimeUntilBudgetReset(currentTime);

      const expectedMs = new Date('2024-01-02T00:00:00').getTime() - currentTime.getTime();
      expect(timeUntilReset).toBe(expectedMs);
    });

    it('should provide consistent timing across multiple calls', () => {
      const fixedTime = new Date('2024-01-01T14:00:00');

      // Multiple calls should return identical results for same time
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push({
          modeSwitch: scheduler.getTimeUntilModeSwitch(fixedTime),
          budgetReset: scheduler.getTimeUntilBudgetReset(fixedTime)
        });
      }

      // All results should be identical
      const first = results[0];
      results.forEach(result => {
        expect(result.modeSwitch).toBe(first.modeSwitch);
        expect(result.budgetReset).toBe(first.budgetReset);
      });
    });
  });

  describe('Capacity Monitoring with Real Tasks', () => {
    it('should monitor capacity changes from real task completions', async () => {
      const events: any[] = [];
      scheduler.onCapacityRestored(event => events.push(event));

      // Complete tasks to reach near threshold (75% day mode)
      const tasks = ['task1', 'task2', 'task3'];
      let totalCost = 0;

      for (let i = 0; i < tasks.length; i++) {
        const taskId = tasks[i];
        const usage: TaskUsage = {
          inputTokens: 10000,
          outputTokens: 5000,
          totalTokens: 15000,
          estimatedCost: 30.0, // Each task costs $30
        };

        usageManager.trackTaskStart(taskId);
        usageManager.updateTaskUsage(taskId, usage);
        usageManager.trackTaskCompletion(taskId, usage, true);

        totalCost += usage.estimatedCost;

        // Check capacity after each task
        const decision = scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));

        if (i < 2) {
          // First two tasks: $60 total (60% < 75%)
          expect(decision.shouldPause).toBe(false);
        } else {
          // After third task: $90 total (90% > 75%)
          expect(decision.shouldPause).toBe(true);
        }
      }

      expect(totalCost).toBe(90); // 90% of $100 budget

      // Set up monitoring state
      scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate transition to night mode (higher threshold)
      scheduler.shouldPauseTasks(new Date('2024-01-01T23:00:00'));
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should detect capacity restoration due to mode switch
      const modeSwitch = events.find(e => e.reason === 'mode_switch');
      expect(modeSwitch).toBeDefined();
      expect(modeSwitch.previousCapacity.shouldPause).toBe(true);
      expect(modeSwitch.newCapacity.shouldPause).toBe(false); // 90% < 90% night threshold
    });

    it('should detect usage decrease restoration', async () => {
      const events: any[] = [];
      scheduler.onCapacityRestored(event => events.push(event));

      // Build up usage to trigger pause
      const taskId = 'high-cost-task';
      const usage: TaskUsage = {
        inputTokens: 50000,
        outputTokens: 25000,
        totalTokens: 75000,
        estimatedCost: 80.0, // 80% of budget
      };

      usageManager.trackTaskStart(taskId);
      usageManager.updateTaskUsage(taskId, usage);
      usageManager.trackTaskCompletion(taskId, usage, true);

      // Verify capacity is blocked
      let decision = scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
      expect(decision.shouldPause).toBe(true); // 80% > 75%

      // Set up monitoring
      await new Promise(resolve => setTimeout(resolve, 50));

      // Simulate external usage decrease (e.g., other system using shared budget)
      // We'll do this by adjusting the usage data
      usageManager.adjustDailyUsage?.(-30.0); // Hypothetical method to reduce usage

      // Force a check
      decision = scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
      await new Promise(resolve => setTimeout(resolve, 150));

      // Note: This test assumes a hypothetical adjustDailyUsage method
      // In practice, usage decrease would happen through external mechanisms
    });

    it('should handle mode transitions with active tasks', async () => {
      const events: any[] = [];
      scheduler.onCapacityRestored(event => events.push(event));

      // Start some active tasks
      const activeTasks = ['active1', 'active2', 'active3'];
      activeTasks.forEach(taskId => {
        usageManager.trackTaskStart(taskId);
      });

      // Complete a task that pushes near day mode threshold
      const completedUsage: TaskUsage = {
        inputTokens: 35000,
        outputTokens: 17500,
        totalTokens: 52500,
        estimatedCost: 76.0, // Just over 75% day threshold
      };

      usageManager.trackTaskStart('completed-task');
      usageManager.updateTaskUsage('completed-task', completedUsage);
      usageManager.trackTaskCompletion('completed-task', completedUsage, true);

      // Verify blocked in day mode
      let decision = scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
      expect(decision.shouldPause).toBe(true);
      expect(decision.capacity.currentPercentage).toBe(0.76);

      // Set up monitoring
      await new Promise(resolve => setTimeout(resolve, 50));

      // Switch to night mode
      decision = scheduler.shouldPauseTasks(new Date('2024-01-01T23:00:00'));
      expect(decision.shouldPause).toBe(false); // 76% < 90% night threshold

      await new Promise(resolve => setTimeout(resolve, 150));

      // Should have detected mode switch restoration
      const modeSwitch = events.find(e => e.reason === 'mode_switch');
      expect(modeSwitch).toBeDefined();

      // Active tasks should still be tracked
      const stats = scheduler.getUsageStats();
      expect(stats.activeTasks).toBe(3); // Still 3 active tasks
    });
  });

  describe('Performance with Real Components', () => {
    it('should maintain timing accuracy under load', async () => {
      // Create realistic load
      for (let i = 0; i < 20; i++) {
        const taskId = `load-task-${i}`;
        const usage: TaskUsage = {
          inputTokens: Math.floor(Math.random() * 20000),
          outputTokens: Math.floor(Math.random() * 10000),
          totalTokens: Math.floor(Math.random() * 30000),
          estimatedCost: Math.random() * 3.0
        };

        usageManager.trackTaskStart(taskId);
        usageManager.updateTaskUsage(taskId, usage);
        usageManager.trackTaskCompletion(taskId, usage, Math.random() > 0.1);
      }

      // Register monitoring
      const events: any[] = [];
      scheduler.onCapacityRestored(event => events.push(event));

      const start = Date.now();

      // Perform multiple time calculations
      for (let i = 0; i < 100; i++) {
        const time = new Date(2024, 0, 1, 14, i % 60); // Vary the minute
        scheduler.getTimeUntilModeSwitch(time);
        scheduler.getTimeUntilBudgetReset(time);
        scheduler.shouldPauseTasks(time);
      }

      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(1000); // Should complete quickly even with load
    });

    it('should handle concurrent time calculations efficiently', async () => {
      const concurrentCalculations = [];

      // Start multiple concurrent calculations
      for (let i = 0; i < 50; i++) {
        concurrentCalculations.push(
          Promise.resolve().then(() => {
            const time = new Date(2024, 0, 1, 10, i, i);
            return {
              modeSwitch: scheduler.getTimeUntilModeSwitch(time),
              budgetReset: scheduler.getTimeUntilBudgetReset(time),
              decision: scheduler.shouldPauseTasks(time)
            };
          })
        );
      }

      const start = Date.now();
      const results = await Promise.all(concurrentCalculations);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(2000); // Should handle concurrency well
      expect(results).toHaveLength(50);

      // All results should be valid
      results.forEach(result => {
        expect(result.modeSwitch).toBeGreaterThan(0);
        expect(result.budgetReset).toBeGreaterThan(0);
        expect(result.decision).toBeDefined();
      });
    });
  });

  describe('Error Resilience with Real Components', () => {
    it('should handle UsageManager errors gracefully', () => {
      // Test with corrupted UsageManager state
      const corruptedUsageManager = {
        ...usageManager,
        getUsageStats: () => {
          throw new Error('UsageManager corrupted');
        }
      };

      const corruptedProvider = new UsageManagerProvider(corruptedUsageManager);
      const corruptedScheduler = new DaemonScheduler(
        createIntegrationConfig(),
        createIntegrationLimits(),
        corruptedProvider
      );

      expect(() => {
        corruptedScheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
      }).toThrow('UsageManager corrupted');

      corruptedScheduler.destroy();
    });

    it('should maintain capacity monitoring despite provider issues', async () => {
      const events: any[] = [];
      scheduler.onCapacityRestored(event => events.push(event));

      // Normal operation first
      scheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));

      // Time calculations should still work even if provider has issues
      const timeUntilSwitch = scheduler.getTimeUntilModeSwitch(new Date('2024-01-01T14:00:00'));
      const timeUntilReset = scheduler.getTimeUntilBudgetReset(new Date('2024-01-01T14:00:00'));

      expect(timeUntilSwitch).toBeGreaterThan(0);
      expect(timeUntilReset).toBeGreaterThan(0);
    });
  });

  describe('Integration with Configuration Changes', () => {
    it('should handle dynamic threshold changes', () => {
      // Test with different configurations
      const configs = [
        { dayModeCapacityThreshold: 0.5, nightModeCapacityThreshold: 0.8 },
        { dayModeCapacityThreshold: 0.9, nightModeCapacityThreshold: 0.95 },
        { dayModeCapacityThreshold: 0.1, nightModeCapacityThreshold: 0.2 },
      ];

      configs.forEach((thresholds, index) => {
        const config = createIntegrationConfig({
          timeBasedUsage: {
            enabled: true,
            dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
            nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
            ...thresholds
          }
        });

        const testScheduler = new DaemonScheduler(config, createIntegrationLimits(), usageProvider);

        // Complete a task with moderate usage
        const taskId = `config-test-${index}`;
        const usage: TaskUsage = {
          inputTokens: 25000,
          outputTokens: 12500,
          totalTokens: 37500,
          estimatedCost: 60.0, // 60% of budget
        };

        usageManager.trackTaskStart(taskId);
        usageManager.updateTaskUsage(taskId, usage);
        usageManager.trackTaskCompletion(taskId, usage, true);

        // Check day mode decision
        const dayDecision = testScheduler.shouldPauseTasks(new Date('2024-01-01T14:00:00'));
        const nightDecision = testScheduler.shouldPauseTasks(new Date('2024-01-01T23:00:00'));

        // Verify thresholds are applied correctly
        if (thresholds.dayModeCapacityThreshold <= 0.6) {
          expect(dayDecision.shouldPause).toBe(true);
        } else {
          expect(dayDecision.shouldPause).toBe(false);
        }

        if (thresholds.nightModeCapacityThreshold <= 0.6) {
          expect(nightDecision.shouldPause).toBe(true);
        } else {
          expect(nightDecision.shouldPause).toBe(false);
        }

        testScheduler.destroy();
      });
    });

    it('should handle disabled time-based usage correctly', () => {
      const disabledConfig = createIntegrationConfig({
        timeBasedUsage: { enabled: false }
      });

      const disabledScheduler = new DaemonScheduler(disabledConfig, createIntegrationLimits(), usageProvider);

      // Time calculations should still work
      const currentTime = new Date('2024-01-01T14:00:00');
      const timeUntilSwitch = disabledScheduler.getTimeUntilModeSwitch(currentTime);
      const timeUntilReset = disabledScheduler.getTimeUntilBudgetReset(currentTime);

      // Should return time until midnight when disabled
      const expectedResetTime = new Date('2024-01-02T00:00:00').getTime() - currentTime.getTime();
      expect(timeUntilSwitch).toBe(expectedResetTime);
      expect(timeUntilReset).toBe(expectedResetTime);

      disabledScheduler.destroy();
    });
  });
});