/**
 * @fileoverview v0.1.0 Safety Feature Audit: Budget Limits Enforcement
 *
 * This comprehensive audit test verifies that the budget limits enforcement
 * system is FULLY IMPLEMENTED with real enforcement logic across multiple
 * layers (not stubs).
 *
 * Features tested:
 * 1. UsageManager budget enforcement with pre-task validation
 * 2. PolicyEnforcer cost threshold evaluation and approval requirements
 * 3. Multi-threshold enforcement (per-task, daily, concurrent)
 * 4. Time-based threshold switching (day/night modes)
 * 5. Integration between cost calculation and policy enforcement
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  UsageManager,
  type UsageThresholds,
  type TimeBasedUsage
} from '../packages/orchestrator/src/usage-manager.js';

import { PolicyEnforcer } from '../packages/orchestrator/src/policy/policy-enforcer.js';
import { calculateCost } from '../packages/core/src/utils.js';

import type {
  DaemonConfig,
  LimitsConfig,
  TaskUsage,
  PolicyConfig,
  Task
} from '../packages/core/src/types.js';

describe('v0.1.0 Safety Feature: Budget Limits Enforcement - Implementation Audit', () => {

  describe('1. UsageManager Budget Enforcement (Real Pre-Task Validation)', () => {
    let usageManager: UsageManager;
    let daemonConfig: DaemonConfig;
    let baseLimits: LimitsConfig;

    beforeEach(() => {
      // Real configuration with strict limits for testing
      daemonConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
          dayModeThresholds: {
            maxTokensPerTask: 50000,    // Strict day limits
            maxCostPerTask: 2.0,
            maxConcurrentTasks: 1
          },
          nightModeThresholds: {
            maxTokensPerTask: 200000,   // Relaxed night limits
            maxCostPerTask: 10.0,
            maxConcurrentTasks: 3
          }
        }
      };

      baseLimits = {
        dailyBudget: 25.0,
        maxTokensPerTask: 100000,
        maxCostPerTask: 5.0,
        maxConcurrentTasks: 2
      };

      usageManager = new UsageManager(daemonConfig, baseLimits);
    });

    it('should enforce daily budget limits with real blocking', () => {
      // Consume most of the daily budget
      const expensiveTask: TaskUsage = {
        inputTokens: 500000,
        outputTokens: 300000,
        totalTokens: 800000,
        estimatedCost: calculateCost(500000, 300000), // Real calculation: ~6.0
        totalCostCents: 60000,
        executionTimeMs: 30000
      };

      usageManager.trackTaskStart('expensive-task-1');
      usageManager.trackTaskCompletion('expensive-task-1', expensiveTask, true);

      // Add another expensive task to approach budget limit
      const anotherExpensiveTask: TaskUsage = {
        inputTokens: 400000,
        outputTokens: 300000,
        totalTokens: 700000,
        estimatedCost: calculateCost(400000, 300000), // Real calculation: ~5.7
        totalCostCents: 57000,
        executionTimeMs: 25000
      };

      usageManager.trackTaskStart('expensive-task-2');
      usageManager.trackTaskCompletion('expensive-task-2', anotherExpensiveTask, true);

      // Now we should have ~11.7 cost, approaching the 25.0 daily budget
      let stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.totalCost).toBeCloseTo(11.7, 1);

      // Try to start another expensive task that would exceed daily budget
      const wouldExceedBudgetTask = {
        estimatedCost: 15.0, // This would put us over the 25.0 limit
        totalTokens: 1000000
      };

      const canStart = usageManager.canStartTask(wouldExceedBudgetTask);
      expect(canStart.allowed).toBe(false);
      expect(canStart.reason).toContain('Daily budget limit reached');
    });

    it('should enforce concurrent task limits with real tracking', () => {
      // Mock day mode for strict concurrent limits
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14); // 2 PM = day mode

      // Start tasks up to the day mode limit (1 concurrent task)
      usageManager.trackTaskStart('task-1');

      // Should allow the first task
      let canStart = usageManager.canStartTask();
      expect(canStart.allowed).toBe(true);

      // Try to start a second task - should be blocked in day mode
      canStart = usageManager.canStartTask();
      expect(canStart.allowed).toBe(false);
      expect(canStart.reason).toContain('Maximum concurrent tasks reached');
      expect(canStart.reason).toContain('1'); // Day mode limit

      vi.restoreAllMocks();
    });

    it('should enforce per-task cost limits with real calculations', () => {
      // Mock day mode for strict per-task limits
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14); // Day mode

      // Try to start a task that exceeds day mode cost limit
      const highCostEstimate = {
        estimatedCost: 3.0, // Exceeds day mode limit of 2.0
        totalTokens: 200000
      };

      const canStart = usageManager.canStartTask(highCostEstimate);
      expect(canStart.allowed).toBe(false);
      expect(canStart.reason).toContain('Estimated task cost');
      expect(canStart.reason).toContain('3'); // The estimated cost
      expect(canStart.reason).toContain('2'); // The day mode limit

      vi.restoreAllMocks();
    });

    it('should enforce per-task token limits with real validation', () => {
      // Mock day mode for strict token limits
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14); // Day mode

      // Try to start a task that exceeds day mode token limit
      const highTokenEstimate = {
        estimatedCost: 1.0, // Within cost limit
        totalTokens: 75000 // Exceeds day mode limit of 50000
      };

      const canStart = usageManager.canStartTask(highTokenEstimate);
      expect(canStart.allowed).toBe(false);
      expect(canStart.reason).toContain('Estimated token usage');
      expect(canStart.reason).toContain('75000'); // The estimated tokens
      expect(canStart.reason).toContain('50000'); // The day mode limit

      vi.restoreAllMocks();
    });

    it('should enforce different limits based on time modes', () => {
      // Test day mode restrictions
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14); // Day mode

      const dayModeTask = {
        estimatedCost: 5.0,
        totalTokens: 150000
      };

      let canStart = usageManager.canStartTask(dayModeTask);
      expect(canStart.allowed).toBe(false); // Should fail day mode limits
      expect(canStart.thresholds.maxCostPerTask).toBe(2.0); // Day limit
      expect(canStart.thresholds.maxTokensPerTask).toBe(50000); // Day limit

      // Switch to night mode - same task should be allowed
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(23); // Night mode

      canStart = usageManager.canStartTask(dayModeTask);
      expect(canStart.allowed).toBe(true); // Should pass night mode limits
      expect(canStart.thresholds.maxCostPerTask).toBe(10.0); // Night limit
      expect(canStart.thresholds.maxTokensPerTask).toBe(200000); // Night limit

      vi.restoreAllMocks();
    });
  });

  describe('2. PolicyEnforcer Cost Threshold Evaluation (Real Policy Logic)', () => {
    let policyEnforcer: PolicyEnforcer;
    let policyConfig: PolicyConfig;

    beforeEach(() => {
      // Minimal policy config focused on cost enforcement
      policyConfig = {
        enabled: true,
        mode: 'enforce',
        allowedPaths: {
          patterns: ['**/*'],
          mode: 'allowlist'
        },
        approvalRules: {
          enabled: true,
          rules: [] // We'll test the built-in high-cost rule
        }
      };

      policyEnforcer = new PolicyEnforcer(policyConfig);
    });

    it('should detect high-cost tasks requiring approval', () => {
      // Create a task with high estimated cost
      const highCostTask: Task = {
        id: 'high-cost-task',
        description: 'Expensive analysis task',
        agentDefinitionId: 'test-agent',
        status: 'pending',
        usage: {
          inputTokens: 1000000,
          outputTokens: 500000,
          totalTokens: 1500000,
          estimatedCost: calculateCost(1000000, 500000), // Real calculation: 12.0
          totalCostCents: 120000,
          executionTimeMs: 0
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        result: null
      };

      const result = policyEnforcer.checkTaskStart(highCostTask);

      // Should fail due to high cost (> $10 threshold)
      expect(result.passed).toBe(false);
      expect(result.requiresApproval).toBe(true);

      // Find the high-cost rule violation
      const highCostViolation = result.results.find(r =>
        r.ruleId === 'high-cost-review'
      );

      expect(highCostViolation).toBeDefined();
      expect(highCostViolation!.passed).toBe(false);
      expect(highCostViolation!.ruleType).toBe('approval');
      expect(highCostViolation!.message).toContain('$10');
      expect(highCostViolation!.message).toContain('$12.00'); // Actual cost
      expect(highCostViolation!.severity).toBe('warning');

      // Verify details
      expect(highCostViolation!.details?.estimatedCost).toBeCloseTo(12.0, 1);
      expect(highCostViolation!.details?.costThreshold).toBe(10.0);
      expect(highCostViolation!.details?.taskId).toBe('high-cost-task');
    });

    it('should allow moderate-cost tasks without approval', () => {
      // Create a task with moderate estimated cost
      const moderateCostTask: Task = {
        id: 'moderate-cost-task',
        description: 'Normal analysis task',
        agentDefinitionId: 'test-agent',
        status: 'pending',
        usage: {
          inputTokens: 100000,
          outputTokens: 50000,
          totalTokens: 150000,
          estimatedCost: calculateCost(100000, 50000), // Real calculation: 1.05
          totalCostCents: 10500,
          executionTimeMs: 0
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        result: null
      };

      const result = policyEnforcer.checkTaskStart(moderateCostTask);

      // Should pass (no high-cost violations)
      expect(result.passed).toBe(true);
      expect(result.requiresApproval).toBe(false);

      // Should not have high-cost rule violations
      const highCostViolation = result.results.find(r =>
        r.ruleId === 'high-cost-review'
      );

      expect(highCostViolation).toBeUndefined();
    });

    it('should handle edge cases at cost threshold boundary', () => {
      // Test exactly at threshold
      const exactThresholdTask: Task = {
        id: 'threshold-task',
        description: 'Task at exact threshold',
        agentDefinitionId: 'test-agent',
        status: 'pending',
        usage: {
          inputTokens: 666667, // Calculated to get exactly $10.00
          outputTokens: 0,
          totalTokens: 666667,
          estimatedCost: 10.0, // Exactly at threshold
          totalCostCents: 100000,
          executionTimeMs: 0
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        result: null
      };

      const exactResult = policyEnforcer.checkTaskStart(exactThresholdTask);

      // At exactly $10.00, should NOT trigger (threshold is > 10.0)
      expect(exactResult.passed).toBe(true);
      expect(exactResult.requiresApproval).toBe(false);

      // Test just over threshold
      const overThresholdTask: Task = {
        ...exactThresholdTask,
        id: 'over-threshold-task',
        usage: {
          ...exactThresholdTask.usage,
          estimatedCost: 10.01, // Just over threshold
          totalCostCents: 100100
        }
      };

      const overResult = policyEnforcer.checkTaskStart(overThresholdTask);

      // Just over $10.00, should trigger
      expect(overResult.passed).toBe(false);
      expect(overResult.requiresApproval).toBe(true);
    });
  });

  describe('3. Integration Between Components (Real Multi-Layer Enforcement)', () => {
    let usageManager: UsageManager;
    let policyEnforcer: PolicyEnforcer;

    beforeEach(() => {
      const daemonConfig: DaemonConfig = {
        timeBasedUsage: { enabled: false }
      };

      const baseLimits: LimitsConfig = {
        dailyBudget: 50.0,
        maxTokensPerTask: 200000,
        maxCostPerTask: 8.0,
        maxConcurrentTasks: 3
      };

      const policyConfig: PolicyConfig = {
        enabled: true,
        mode: 'enforce',
        allowedPaths: {
          patterns: ['**/*'],
          mode: 'allowlist'
        },
        approvalRules: {
          enabled: true,
          rules: []
        }
      };

      usageManager = new UsageManager(daemonConfig, baseLimits);
      policyEnforcer = new PolicyEnforcer(policyConfig);
    });

    it('should demonstrate layered budget enforcement', () => {
      // Test a task that would pass usage manager but trigger policy approval
      const mediumHighCostTask = {
        estimatedCost: 7.0, // Under usage manager limit (8.0) but over policy threshold (10.0)
        totalTokens: 150000
      };

      // Should pass usage manager validation
      const usageManagerCheck = usageManager.canStartTask(mediumHighCostTask);
      expect(usageManagerCheck.allowed).toBe(true);

      // Create corresponding Task object for policy enforcer
      const taskForPolicy: Task = {
        id: 'medium-high-cost-task',
        description: 'Task between limits',
        agentDefinitionId: 'test-agent',
        status: 'pending',
        usage: {
          inputTokens: 100000,
          outputTokens: 100000,
          totalTokens: 200000,
          estimatedCost: 7.0,
          totalCostCents: 70000,
          executionTimeMs: 0
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        result: null
      };

      // Should pass policy enforcer too (7.0 < 10.0 threshold)
      const policyCheck = policyEnforcer.checkTaskStart(taskForPolicy);
      expect(policyCheck.passed).toBe(true);
      expect(policyCheck.requiresApproval).toBe(false);

      // Now test a task that exceeds both limits
      const veryHighCostTask = {
        estimatedCost: 15.0, // Exceeds both usage manager (8.0) and policy (10.0) limits
        totalTokens: 1000000
      };

      // Should fail usage manager first
      const usageManagerCheckHigh = usageManager.canStartTask(veryHighCostTask);
      expect(usageManagerCheckHigh.allowed).toBe(false);
      expect(usageManagerCheckHigh.reason).toContain('Estimated task cost');

      // Should also fail policy enforcer
      const highCostTaskForPolicy: Task = {
        ...taskForPolicy,
        id: 'very-high-cost-task',
        usage: {
          ...taskForPolicy.usage,
          estimatedCost: 15.0,
          totalCostCents: 150000
        }
      };

      const policyCheckHigh = policyEnforcer.checkTaskStart(highCostTaskForPolicy);
      expect(policyCheckHigh.passed).toBe(false);
      expect(policyCheckHigh.requiresApproval).toBe(true);
    });

    it('should demonstrate time-based threshold interaction', () => {
      // Use time-based configuration
      const timeBasedConfig: DaemonConfig = {
        timeBasedUsage: {
          enabled: true,
          dayModeHours: [9, 10, 11, 12, 13, 14, 15, 16, 17],
          nightModeHours: [22, 23, 0, 1, 2, 3, 4, 5, 6],
          dayModeThresholds: {
            maxTokensPerTask: 100000,
            maxCostPerTask: 5.0, // Stricter than policy threshold (10.0)
            maxConcurrentTasks: 2
          },
          nightModeThresholds: {
            maxTokensPerTask: 500000,
            maxCostPerTask: 15.0, // More permissive than policy threshold (10.0)
            maxConcurrentTasks: 5
          }
        }
      };

      const timeBasedUsageManager = new UsageManager(timeBasedConfig, {
        dailyBudget: 100.0,
        maxTokensPerTask: 300000,
        maxCostPerTask: 12.0,
        maxConcurrentTasks: 4
      });

      // Mock day mode
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(14);

      // Task that costs $7.0 - should fail day mode but pass policy
      const dayModeTask = {
        estimatedCost: 7.0,
        totalTokens: 150000
      };

      const dayModeCheck = timeBasedUsageManager.canStartTask(dayModeTask);
      expect(dayModeCheck.allowed).toBe(false); // Fails day mode limit (5.0)
      expect(dayModeCheck.thresholds.maxCostPerTask).toBe(5.0);

      // Switch to night mode - same task should pass usage manager
      vi.spyOn(Date.prototype, 'getHours').mockReturnValue(23);

      const nightModeCheck = timeBasedUsageManager.canStartTask(dayModeTask);
      expect(nightModeCheck.allowed).toBe(true); // Passes night mode limit (15.0)
      expect(nightModeCheck.thresholds.maxCostPerTask).toBe(15.0);

      vi.restoreAllMocks();
    });
  });

  describe('4. Real-World Budget Scenarios (Production Use Cases)', () => {
    let usageManager: UsageManager;
    let policyEnforcer: PolicyEnforcer;

    beforeEach(() => {
      const daemonConfig: DaemonConfig = {
        timeBasedUsage: { enabled: false }
      };

      // Realistic production limits
      const baseLimits: LimitsConfig = {
        dailyBudget: 100.0, // $100/day budget
        maxTokensPerTask: 500000, // 500k tokens per task
        maxCostPerTask: 20.0, // $20 per task
        maxConcurrentTasks: 5 // 5 concurrent tasks
      };

      const policyConfig: PolicyConfig = {
        enabled: true,
        mode: 'enforce',
        allowedPaths: { patterns: ['**/*'], mode: 'allowlist' },
        approvalRules: { enabled: true, rules: [] }
      };

      usageManager = new UsageManager(daemonConfig, baseLimits);
      policyEnforcer = new PolicyEnforcer(policyConfig);
    });

    it('should handle typical development workflow budget constraints', () => {
      // Simulate a day of development tasks
      const developmentTasks = [
        { description: 'Code review', cost: calculateCost(15000, 8000) },      // ~$0.165
        { description: 'Bug analysis', cost: calculateCost(25000, 12000) },    // ~$0.255
        { description: 'Feature planning', cost: calculateCost(40000, 20000) }, // ~$0.42
        { description: 'Documentation', cost: calculateCost(30000, 25000) },   // ~$0.465
        { description: 'Refactoring', cost: calculateCost(80000, 40000) }      // ~$0.84
      ];

      let totalCost = 0;

      // All individual tasks should be allowed
      for (const task of developmentTasks) {
        const canStart = usageManager.canStartTask({
          estimatedCost: task.cost,
          totalTokens: Math.floor((task.cost / 0.000015) * 0.7) // Approximate tokens
        });

        expect(canStart.allowed).toBe(true);
        totalCost += task.cost;

        // Simulate completion
        const usage: TaskUsage = {
          inputTokens: Math.floor((task.cost / 0.000015) * 0.6),
          outputTokens: Math.floor((task.cost / 0.000015) * 0.4),
          totalTokens: Math.floor((task.cost / 0.000015)),
          estimatedCost: task.cost,
          totalCostCents: Math.floor(task.cost * 10000),
          executionTimeMs: 10000
        };

        usageManager.trackTaskStart(`task-${Math.random()}`);
        usageManager.trackTaskCompletion(`task-${Math.random()}`, usage, true);
      }

      expect(totalCost).toBeLessThan(5.0); // Should be reasonable for development
      expect(totalCost).toBeGreaterThan(1.0); // Should be significant enough to track
    });

    it('should block expensive batch operations appropriately', () => {
      // Large codebase analysis task
      const massiveAnalysisTask = {
        estimatedCost: calculateCost(5_000_000, 2_000_000), // ~$45.00
        totalTokens: 7_000_000
      };

      // Should be blocked by daily budget constraints
      const canStart = usageManager.canStartTask(massiveAnalysisTask);
      expect(canStart.allowed).toBe(false);
      expect(canStart.reason).toContain('Estimated task cost');

      // Should also require policy approval (> $10)
      const massiveTask: Task = {
        id: 'massive-analysis',
        description: 'Complete codebase analysis',
        agentDefinitionId: 'analyst-agent',
        status: 'pending',
        usage: {
          inputTokens: 5_000_000,
          outputTokens: 2_000_000,
          totalTokens: 7_000_000,
          estimatedCost: massiveAnalysisTask.estimatedCost,
          totalCostCents: Math.floor(massiveAnalysisTask.estimatedCost * 10000),
          executionTimeMs: 0
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        result: null
      };

      const policyResult = policyEnforcer.checkTaskStart(massiveTask);
      expect(policyResult.passed).toBe(false);
      expect(policyResult.requiresApproval).toBe(true);

      const highCostViolation = policyResult.results.find(r =>
        r.ruleId === 'high-cost-review'
      );
      expect(highCostViolation?.message).toContain('$45.00');
    });

    it('should accumulate costs accurately throughout the day', () => {
      // Simulate gradual cost accumulation
      const incrementalTasks = [
        calculateCost(50000, 25000),   // ~$0.525
        calculateCost(75000, 40000),   // ~$0.825
        calculateCost(100000, 60000),  // ~$1.20
        calculateCost(150000, 80000),  // ~$1.65
        calculateCost(200000, 100000), // ~$2.10
      ];

      let runningTotal = 0;

      for (let i = 0; i < incrementalTasks.length; i++) {
        const taskCost = incrementalTasks[i];
        runningTotal += taskCost;

        // All should be allowed (within individual and daily limits)
        const canStart = usageManager.canStartTask({
          estimatedCost: taskCost,
          totalTokens: 200000
        });

        expect(canStart.allowed).toBe(true);

        // Simulate completion
        const usage: TaskUsage = {
          inputTokens: 100000 + (i * 25000),
          outputTokens: 50000 + (i * 12500),
          totalTokens: 150000 + (i * 37500),
          estimatedCost: taskCost,
          totalCostCents: Math.floor(taskCost * 10000),
          executionTimeMs: 8000 + (i * 2000)
        };

        usageManager.trackTaskStart(`incremental-task-${i}`);
        usageManager.trackTaskCompletion(`incremental-task-${i}`, usage, true);
      }

      const stats = usageManager.getUsageStats();
      expect(stats.current.dailyUsage.totalCost).toBeCloseTo(runningTotal, 2);
      expect(stats.current.dailyUsage.tasksCompleted).toBe(5);
      expect(stats.efficiency.avgCostPerTask).toBeCloseTo(runningTotal / 5, 2);
    });
  });
});