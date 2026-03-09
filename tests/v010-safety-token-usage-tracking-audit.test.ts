/**
 * @fileoverview v0.1.0 Safety Feature Audit: Token Usage Tracking
 *
 * This comprehensive audit test verifies that the token usage tracking
 * system is FULLY IMPLEMENTED with real token extraction and tracking
 * logic (not stubs).
 *
 * Features tested:
 * 1. Real-time token extraction from Claude SDK responses
 * 2. Per-task usage tracking with completion aggregation
 * 3. Daily usage statistics with time-based breakdown
 * 4. Concurrent task monitoring and peak tracking
 * 5. Time-based usage modes (day/night) with different thresholds
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  UsageManager,
  type UsageThresholds,
  type TimeBasedUsage,
  type DailyUsageStats
} from '../packages/orchestrator/src/usage-manager.js';

import { AnthropicDriver } from '../packages/orchestrator/src/drivers/anthropic-driver.js';
import type { DaemonConfig, LimitsConfig, TaskUsage } from '../packages/core/src/types.js';

// Mock the Claude SDK since we're testing implementation logic, not external API
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn()
}));

describe('v0.1.0 Safety Feature: Token Usage Tracking - Implementation Audit', () => {

  describe('1. Usage Manager Core Implementation (Real Tracking Logic)', () => {
    let usageManager: UsageManager;
    let daemonConfig: DaemonConfig;
    let baseLimits: LimitsConfig;

    beforeEach(() => {
      // Real configuration objects
      daemonConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
          dayModeThresholds: {
            maxTokensPerTask: 100000,
            maxCostPerTask: 5.0,
            maxConcurrentTasks: 2
          },
          nightModeThresholds: {
            maxTokensPerTask: 1000000,
            maxCostPerTask: 20.0,
            maxConcurrentTasks: 5
          }
        }
      };

      baseLimits = {
        dailyBudget: 100,
        maxTokensPerTask: 500000,
        maxCostPerTask: 10.0,
        maxConcurrentTasks: 3
      };

      usageManager = new UsageManager(daemonConfig, baseLimits);
    });

    it('should initialize with real usage tracking data structures', () => {
      expect(usageManager).toBeDefined();

      // Verify the usage manager has proper configuration
      const baseLimitsRetrieved = usageManager.getBaseLimits();
      expect(baseLimitsRetrieved.dailyBudget).toBe(100);
      expect(baseLimitsRetrieved.maxTokensPerTask).toBe(500000);

      // Verify initial stats structure
      const stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage).toBeDefined();
      expect(stats.current.dailyUsage.totalTokens).toBe(0);
      expect(stats.current.dailyUsage.totalCost).toBe(0);
      expect(stats.active).toHaveLength(0);
    });

    it('should track task lifecycle with real usage data', () => {
      const taskId = 'test-task-123';

      // Track task start
      usageManager.trackTaskStart(taskId);

      let stats = usageManager.getUsageStats();
      expect(stats.active).toHaveLength(1);
      expect(stats.active[0].taskId).toBe(taskId);
      expect(stats.active[0].usage.totalTokens).toBe(0);

      // Simulate real usage update during task execution
      const realUsage: TaskUsage = {
        inputTokens: 1500,
        outputTokens: 2500,
        totalTokens: 4000,
        estimatedCost: 0.0525, // Real cost calculation
        totalCostCents: 525, // Real cents conversion
        executionTimeMs: 15000
      };

      usageManager.updateTaskUsage(taskId, realUsage);

      stats = usageManager.getUsageStats();
      expect(stats.active[0].usage.totalTokens).toBe(4000);
      expect(stats.active[0].usage.estimatedCost).toBe(0.0525);

      // Track task completion with success
      usageManager.trackTaskCompletion(taskId, realUsage, true);

      stats = usageManager.getUsageStats();
      expect(stats.active).toHaveLength(0); // No longer active
      expect(stats.current.dailyUsage.totalTokens).toBe(4000);
      expect(stats.current.dailyUsage.totalCost).toBe(0.0525);
      expect(stats.current.dailyUsage.tasksCompleted).toBe(1);
      expect(stats.current.dailyUsage.tasksFailed).toBe(0);
    });

    it('should enforce real budget limits with proper reasoning', () => {
      // Test concurrent task limit enforcement
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskStart('task2');

      // Should allow up to the limit (2 in day mode)
      let canStart = usageManager.canStartTask();
      expect(canStart.allowed).toBe(true);

      // Mock to be day mode for consistent testing
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14); // 2 PM = day mode

      usageManager.trackTaskStart('task3');
      canStart = usageManager.canStartTask();
      expect(canStart.allowed).toBe(false);
      expect(canStart.reason).toContain('Maximum concurrent tasks reached');
      expect(canStart.thresholds.maxConcurrentTasks).toBe(2); // Day mode limit

      // Reset the mock
      vi.restoreAllMocks();
    });

    it('should enforce real budget limits based on cost', () => {
      // Mock high daily usage
      const highUsageTask: TaskUsage = {
        inputTokens: 100000,
        outputTokens: 200000,
        totalTokens: 300000,
        estimatedCost: 95.0, // Near daily budget limit
        totalCostCents: 9500,
        executionTimeMs: 60000
      };

      usageManager.trackTaskStart('expensive-task');
      usageManager.trackTaskCompletion('expensive-task', highUsageTask, true);

      // Should reject new high-cost tasks due to daily budget
      const estimatedHighCostUsage = {
        estimatedCost: 10.0,
        totalTokens: 50000
      };

      const canStart = usageManager.canStartTask(estimatedHighCostUsage);
      expect(canStart.allowed).toBe(false);
      expect(canStart.reason).toContain('Daily budget limit reached');
    });

    it('should track concurrent task peaks accurately', () => {
      const stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.peakConcurrentTasks).toBe(0);

      // Start multiple tasks simultaneously
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskStart('task2');
      usageManager.trackTaskStart('task3');

      let updatedStats = usageManager.getUsageStats();
      expect(updatedStats.current.dailyUsage.peakConcurrentTasks).toBe(3);

      // Complete one task
      usageManager.trackTaskCompletion('task1', {
        inputTokens: 100, outputTokens: 200, totalTokens: 300,
        estimatedCost: 0.05, totalCostCents: 5, executionTimeMs: 1000
      }, true);

      // Start another task - peak should remain 3
      usageManager.trackTaskStart('task4');
      updatedStats = usageManager.getUsageStats();
      expect(updatedStats.current.dailyUsage.peakConcurrentTasks).toBe(3);
    });
  });

  describe('2. Time-Based Usage Modes (Real Mode Switching Logic)', () => {
    let usageManager: UsageManager;
    let daemonConfig: DaemonConfig;

    beforeEach(() => {
      daemonConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
          dayModeThresholds: {
            maxTokensPerTask: 100000,
            maxCostPerTask: 5.0,
            maxConcurrentTasks: 2
          },
          nightModeThresholds: {
            maxTokensPerTask: 1000000,
            maxCostPerTask: 20.0,
            maxConcurrentTasks: 5
          }
        }
      };

      const baseLimits: LimitsConfig = {
        dailyBudget: 100,
        maxTokensPerTask: 500000,
        maxCostPerTask: 10.0,
        maxConcurrentTasks: 3
      };

      usageManager = new UsageManager(daemonConfig, baseLimits);
    });

    it('should properly detect day mode with restrictive thresholds', () => {
      // Mock 2 PM (14:00) - should be day mode
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14);

      const usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('day');
      expect(usage.thresholds.maxTokensPerTask).toBe(100000); // Day limit
      expect(usage.thresholds.maxCostPerTask).toBe(5.0); // Day limit
      expect(usage.thresholds.maxConcurrentTasks).toBe(2); // Day limit

      vi.restoreAllMocks();
    });

    it('should properly detect night mode with permissive thresholds', () => {
      // Mock 2 AM (02:00) - should be night mode
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(2);

      const usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('night');
      expect(usage.thresholds.maxTokensPerTask).toBe(1000000); // Night limit
      expect(usage.thresholds.maxCostPerTask).toBe(20.0); // Night limit
      expect(usage.thresholds.maxConcurrentTasks).toBe(5); // Night limit

      vi.restoreAllMocks();
    });

    it('should handle off-hours mode correctly', () => {
      // Mock 6 PM (18:00) - not in day or night hours
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(18);

      const usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('off-hours');
      expect(usage.thresholds.maxTokensPerTask).toBe(500000); // Base limit
      expect(usage.thresholds.maxCostPerTask).toBe(10.0); // Base limit
      expect(usage.thresholds.maxConcurrentTasks).toBe(3); // Base limit

      vi.restoreAllMocks();
    });

    it('should calculate next mode switch times accurately', () => {
      // Mock 2 PM (14:00) - in day mode
      const mockDate = new Date();
      mockDate.setHours(14, 30, 0, 0); // 2:30 PM
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

      const usage = usageManager.getCurrentUsage();
      expect(usage.currentMode).toBe('day');

      // Next switch should be to night mode at 22:00 (10 PM)
      expect(usage.nextModeSwitch.getHours()).toBe(22);
      expect(usage.nextModeSwitch.getMinutes()).toBe(0);

      vi.restoreAllMocks();
    });

    it('should track mode-specific usage breakdown', () => {
      // Start in day mode
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14);

      // Complete a task in day mode
      usageManager.trackTaskStart('day-task');
      const dayUsage: TaskUsage = {
        inputTokens: 1000, outputTokens: 2000, totalTokens: 3000,
        estimatedCost: 0.03, totalCostCents: 3, executionTimeMs: 5000
      };
      usageManager.trackTaskCompletion('day-task', dayUsage, true);

      // Switch to night mode
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(23);

      // Complete a task in night mode
      usageManager.trackTaskStart('night-task');
      const nightUsage: TaskUsage = {
        inputTokens: 2000, outputTokens: 4000, totalTokens: 6000,
        estimatedCost: 0.06, totalCostCents: 6, executionTimeMs: 10000
      };
      usageManager.trackTaskCompletion('night-task', nightUsage, true);

      const stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.modeBreakdown.day.tokens).toBe(3000);
      expect(stats.current.dailyUsage.modeBreakdown.day.cost).toBe(0.03);
      expect(stats.current.dailyUsage.modeBreakdown.day.tasks).toBe(1);

      expect(stats.current.dailyUsage.modeBreakdown.night.tokens).toBe(6000);
      expect(stats.current.dailyUsage.modeBreakdown.night.cost).toBe(0.06);
      expect(stats.current.dailyUsage.modeBreakdown.night.tasks).toBe(1);

      vi.restoreAllMocks();
    });

    it('should emit mode-changed events when switching modes', () => {
      const modeChanges: Array<'day' | 'night' | 'off-hours'> = [];
      usageManager.on('mode-changed', (mode) => {
        modeChanges.push(mode);
      });

      // Start in day mode
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14);
      usageManager.getCurrentUsage();

      // Switch to night mode
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(23);
      usageManager.getCurrentUsage();

      // Switch to off-hours
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(18);
      usageManager.getCurrentUsage();

      expect(modeChanges).toEqual(['night', 'off-hours']);

      vi.restoreAllMocks();
    });
  });

  describe('3. AnthropicDriver Token Extraction (Real SDK Integration)', () => {
    let driver: AnthropicDriver;

    beforeEach(async () => {
      driver = new AnthropicDriver();
    });

    it('should have proper model resolution for token tracking', () => {
      expect(driver.resolveModel('sonnet')).toBe('claude-sonnet-4-5-20241022');
      expect(driver.resolveModel('opus')).toBe('claude-opus-4-5-20251101');
      expect(driver.resolveModel('haiku')).toBe('claude-haiku-4-5-20251001');
    });

    it('should extract usage from SDKAssistantMessage responses', async () => {
      const mockAssistantMessage = {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Hello world' }
          ],
          usage: {
            input_tokens: 150,
            output_tokens: 75
          }
        }
      };

      const events: any[] = [];
      for await (const event of driver.mapMessage(mockAssistantMessage)) {
        events.push(event);
      }

      // Should extract both text and usage
      const textEvent = events.find(e => e.type === 'text');
      const usageEvent = events.find(e => e.type === 'usage');

      expect(textEvent).toBeDefined();
      expect(textEvent.content).toBe('Hello world');

      expect(usageEvent).toBeDefined();
      expect(usageEvent.inputTokens).toBe(150);
      expect(usageEvent.outputTokens).toBe(75);
    });

    it('should extract final aggregated usage from SDKResultMessage', async () => {
      const mockResultMessage = {
        type: 'result',
        subtype: 'success',
        usage: {
          input_tokens: 2500,
          output_tokens: 1200
        },
        result: 'Task completed successfully'
      };

      const events: any[] = [];
      for await (const event of driver.mapMessage(mockResultMessage)) {
        events.push(event);
      }

      const usageEvent = events.find(e => e.type === 'usage');
      const completeEvent = events.find(e => e.type === 'complete');

      expect(usageEvent).toBeDefined();
      expect(usageEvent.inputTokens).toBe(2500);
      expect(usageEvent.outputTokens).toBe(1200);

      expect(completeEvent).toBeDefined();
      expect(completeEvent.summary).toContain('Task completed');
    });

    it('should handle missing usage gracefully', async () => {
      const mockMessageWithoutUsage = {
        type: 'assistant',
        message: {
          content: [
            { type: 'text', text: 'Response without usage' }
          ]
          // No usage field
        }
      };

      const events: any[] = [];
      for await (const event of driver.mapMessage(mockMessageWithoutUsage)) {
        events.push(event);
      }

      const textEvent = events.find(e => e.type === 'text');
      const usageEvent = events.find(e => e.type === 'usage');

      expect(textEvent).toBeDefined();
      expect(usageEvent).toBeUndefined(); // Should not emit usage event
    });
  });

  describe('4. Usage Statistics and Analytics (Real Calculations)', () => {
    let usageManager: UsageManager;

    beforeEach(() => {
      const daemonConfig: DaemonConfig = {
        timeBasedUsage: { enabled: false } // Simplified for testing
      };

      const baseLimits: LimitsConfig = {
        dailyBudget: 50,
        maxTokensPerTask: 100000,
        maxCostPerTask: 5.0,
        maxConcurrentTasks: 2
      };

      usageManager = new UsageManager(daemonConfig, baseLimits);
    });

    it('should calculate real efficiency metrics', () => {
      // Complete several tasks with different outcomes
      const task1Usage: TaskUsage = {
        inputTokens: 1000, outputTokens: 1500, totalTokens: 2500,
        estimatedCost: 0.0375, totalCostCents: 375, executionTimeMs: 5000
      };

      const task2Usage: TaskUsage = {
        inputTokens: 2000, outputTokens: 3000, totalTokens: 5000,
        estimatedCost: 0.075, totalCostCents: 750, executionTimeMs: 8000
      };

      const task3Usage: TaskUsage = {
        inputTokens: 1500, outputTokens: 2000, totalTokens: 3500,
        estimatedCost: 0.0525, totalCostCents: 525, executionTimeMs: 6000
      };

      // Complete 2 successful tasks and 1 failed task
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', task1Usage, true);

      usageManager.trackTaskStart('task2');
      usageManager.trackTaskCompletion('task2', task2Usage, true);

      usageManager.trackTaskStart('task3');
      usageManager.trackTaskCompletion('task3', task3Usage, false); // Failed

      const stats = usageManager.getUsageStats();

      // Verify real calculations
      expect(stats.efficiency.successRate).toBeCloseTo(2/3); // 2 success out of 3 total
      expect(stats.efficiency.avgCostPerTask).toBeCloseTo((0.0375 + 0.075 + 0.0525) / 3);
      expect(stats.efficiency.avgTokensPerTask).toBeCloseTo((2500 + 5000 + 3500) / 3);
    });

    it('should calculate projected daily costs based on current usage', () => {
      // Mock specific time for consistent calculations
      const mockDate = new Date();
      mockDate.setHours(12, 0, 0, 0); // Noon
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

      // Complete tasks representing morning usage
      const morningUsage: TaskUsage = {
        inputTokens: 5000, outputTokens: 7500, totalTokens: 12500,
        estimatedCost: 0.1875, totalCostCents: 1875, executionTimeMs: 15000
      };

      usageManager.trackTaskStart('morning-task');
      usageManager.trackTaskCompletion('morning-task', morningUsage, true);

      const stats = usageManager.getUsageStats();

      // At noon (12 hours into day), project full 24-hour usage
      // Current cost: 0.1875, projected: 0.1875 * (24/12) = 0.375
      expect(stats.projectedDailyCost).toBeCloseTo(0.375);

      vi.restoreAllMocks();
    });

    it('should track real daily usage statistics structure', () => {
      const stats = usageManager.getUsageStats();
      const dailyUsage = stats.current.dailyUsage;

      // Verify complete data structure
      expect(dailyUsage.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
      expect(dailyUsage.totalTokens).toBeDefined();
      expect(dailyUsage.totalCost).toBeDefined();
      expect(dailyUsage.tasksCompleted).toBeDefined();
      expect(dailyUsage.tasksFailed).toBeDefined();
      expect(dailyUsage.peakConcurrentTasks).toBeDefined();

      // Verify mode breakdown structure
      expect(dailyUsage.modeBreakdown.day).toBeDefined();
      expect(dailyUsage.modeBreakdown.night).toBeDefined();
      expect(dailyUsage.modeBreakdown.day.tokens).toBe(0);
      expect(dailyUsage.modeBreakdown.day.cost).toBe(0);
      expect(dailyUsage.modeBreakdown.day.tasks).toBe(0);
    });
  });

  describe('5. Integration and Edge Cases', () => {
    it('should handle daily stats reset properly', () => {
      const daemonConfig: DaemonConfig = { timeBasedUsage: { enabled: false } };
      const baseLimits: LimitsConfig = {
        dailyBudget: 100, maxTokensPerTask: 100000,
        maxCostPerTask: 10.0, maxConcurrentTasks: 3
      };

      const usageManager = new UsageManager(daemonConfig, baseLimits);

      // Add some usage
      const usage: TaskUsage = {
        inputTokens: 1000, outputTokens: 2000, totalTokens: 3000,
        estimatedCost: 0.045, totalCostCents: 45, executionTimeMs: 5000
      };

      usageManager.trackTaskStart('test-task');
      usageManager.trackTaskCompletion('test-task', usage, true);

      let stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.totalTokens).toBe(3000);

      // Reset daily stats
      usageManager.resetDailyStats();

      stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.totalTokens).toBe(0);
      expect(stats.current.dailyUsage.totalCost).toBe(0);
      expect(stats.current.dailyUsage.tasksCompleted).toBe(0);
    });

    it('should handle disabled time-based usage correctly', () => {
      const daemonConfig: DaemonConfig = {
        timeBasedUsage: { enabled: false }
      };

      const baseLimits: LimitsConfig = {
        dailyBudget: 100, maxTokensPerTask: 100000,
        maxCostPerTask: 10.0, maxConcurrentTasks: 3
      };

      const usageManager = new UsageManager(daemonConfig, baseLimits);
      const usage = usageManager.getCurrentUsage();

      expect(usage.currentMode).toBe('off-hours');
      expect(usage.thresholds.maxTokensPerTask).toBe(100000); // Base limit
      expect(usage.thresholds.maxCostPerTask).toBe(10.0); // Base limit
    });
  });
});