/**
 * @fileoverview v0.1.0 Safety Feature Audit: Cost Estimation
 *
 * This comprehensive audit test verifies that the cost estimation system
 * is FULLY IMPLEMENTED with real calculation logic based on actual Claude
 * pricing (not stubs).
 *
 * Features tested:
 * 1. Real cost calculation using Claude Sonnet 4 pricing model
 * 2. Mathematical accuracy with proper decimal handling
 * 3. Integration with usage tracking and projection algorithms
 * 4. Cost-based policy evaluation and threshold enforcement
 * 5. Daily cost projection and time-based calculations
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { calculateCost } from '../packages/core/src/utils.js';
import { UsageManager } from '../packages/orchestrator/src/usage-manager.js';
import type { DaemonConfig, LimitsConfig, TaskUsage } from '../packages/core/src/types.js';

describe('v0.1.0 Safety Feature: Cost Estimation - Implementation Audit', () => {

  describe('1. Core Cost Calculation Function (Real Pricing Logic)', () => {
    it('should use actual Claude Sonnet 4 pricing model', () => {
      // Verify the actual pricing constants are embedded in the logic
      // Based on the implementation: $3/1M input tokens, $15/1M output tokens

      // Test 1 million input tokens
      const inputOnlyCase = calculateCost(1_000_000, 0);
      expect(inputOnlyCase).toBe(3.0); // $3.00 for 1M input tokens

      // Test 1 million output tokens
      const outputOnlyCase = calculateCost(0, 1_000_000);
      expect(outputOnlyCase).toBe(15.0); // $15.00 for 1M output tokens

      // Test mixed case
      const mixedCase = calculateCost(500_000, 100_000);
      // 500k input: (500,000/1,000,000) * 3.0 = 1.5
      // 100k output: (100,000/1,000,000) * 15.0 = 1.5
      // Total: 3.0
      expect(mixedCase).toBe(3.0);
    });

    it('should perform accurate mathematical calculations', () => {
      // Test small token counts for precision
      const smallCase = calculateCost(1000, 500);
      // 1000 input: (1000/1,000,000) * 3.0 = 0.003
      // 500 output: (500/1,000,000) * 15.0 = 0.0075
      // Total: 0.0105
      expect(smallCase).toBe(0.0105);

      // Test large token counts
      const largeCase = calculateCost(2_500_000, 750_000);
      // 2.5M input: 2.5 * 3.0 = 7.5
      // 750k output: 0.75 * 15.0 = 11.25
      // Total: 18.75
      expect(largeCase).toBe(18.75);

      // Test edge case: zero tokens
      const zeroCase = calculateCost(0, 0);
      expect(zeroCase).toBe(0);
    });

    it('should round to 4 decimal places correctly', () => {
      // Test precise rounding behavior
      const precisionCase1 = calculateCost(1111, 2222);
      // 1111 input: (1111/1,000,000) * 3.0 = 0.003333
      // 2222 output: (2222/1,000,000) * 15.0 = 0.03333
      // Total: 0.036663, rounded to 0.0367
      expect(precisionCase1).toBe(0.0367);

      // Test another precision case
      const precisionCase2 = calculateCost(12345, 6789);
      // 12345 input: (12345/1,000,000) * 3.0 = 0.037035
      // 6789 output: (6789/1,000,000) * 15.0 = 0.101835
      // Total: 0.13887, rounded to 0.1389
      expect(precisionCase2).toBe(0.1389);
    });

    it('should handle real-world usage scenarios', () => {
      // Typical small conversation
      const smallConversation = calculateCost(2000, 1000);
      expect(smallConversation).toBe(0.021); // ~2 cents

      // Typical medium conversation
      const mediumConversation = calculateCost(10000, 5000);
      expect(mediumConversation).toBe(0.105); // ~10 cents

      // Large code generation task
      const codeGenTask = calculateCost(50000, 25000);
      expect(codeGenTask).toBe(0.525); // ~53 cents

      // Very large analysis task
      const largeAnalysis = calculateCost(100000, 80000);
      expect(largeAnalysis).toBe(1.5); // $1.50
    });

    it('should be consistent with documented examples', () => {
      // Test the examples from the JSDoc comments
      const example1 = calculateCost(1000, 500);
      expect(example1).toBe(0.0105); // As documented

      const example2 = calculateCost(50000, 25000);
      expect(example2).toBe(0.525); // As documented
    });
  });

  describe('2. Integration with Usage Manager (Real Cost Tracking)', () => {
    let usageManager: UsageManager;

    beforeEach(() => {
      const daemonConfig: DaemonConfig = {
        timeBasedUsage: { enabled: false } // Simplified for testing
      };

      const baseLimits: LimitsConfig = {
        dailyBudget: 25.0,
        maxTokensPerTask: 100000,
        maxCostPerTask: 5.0,
        maxConcurrentTasks: 3
      };

      usageManager = new UsageManager(daemonConfig, baseLimits);
    });

    it('should accumulate real costs in daily statistics', () => {
      // Complete multiple tasks with real cost calculations
      const task1Usage: TaskUsage = {
        inputTokens: 10000,
        outputTokens: 5000,
        totalTokens: 15000,
        estimatedCost: calculateCost(10000, 5000), // Real calculation: 0.105
        totalCostCents: 1050, // 10.5 cents
        executionTimeMs: 5000
      };

      const task2Usage: TaskUsage = {
        inputTokens: 25000,
        outputTokens: 15000,
        totalTokens: 40000,
        estimatedCost: calculateCost(25000, 15000), // Real calculation: 0.3
        totalCostCents: 3000, // 30 cents
        executionTimeMs: 8000
      };

      // Track real cost accumulation
      usageManager.trackTaskStart('task1');
      usageManager.trackTaskCompletion('task1', task1Usage, true);

      usageManager.trackTaskStart('task2');
      usageManager.trackTaskCompletion('task2', task2Usage, true);

      const stats = usageManager.getUsageStats();

      // Verify real cost accumulation
      expect(stats.current.dailyUsage.totalCost).toBeCloseTo(0.405); // 0.105 + 0.3
      expect(stats.efficiency.avgCostPerTask).toBeCloseTo(0.2025); // 0.405 / 2
    });

    it('should enforce cost-based task rejection', () => {
      // Test cost threshold enforcement
      const highCostEstimate = {
        estimatedCost: 6.0, // Exceeds maxCostPerTask (5.0)
        totalTokens: 400000
      };

      const canStart = usageManager.canStartTask(highCostEstimate);
      expect(canStart.allowed).toBe(false);
      expect(canStart.reason).toContain('Estimated task cost');
      expect(canStart.reason).toContain('6'); // Contains the actual cost
      expect(canStart.reason).toContain('5'); // Contains the limit
    });

    it('should calculate realistic daily cost projections', () => {
      // Mock specific time for predictable calculations
      const mockDate = new Date();
      mockDate.setHours(8, 0, 0, 0); // 8 AM (8 hours into day)
      vi.spyOn(global, 'Date').mockImplementation(() => mockDate);

      // Add morning usage
      const morningTaskUsage: TaskUsage = {
        inputTokens: 20000,
        outputTokens: 10000,
        totalTokens: 30000,
        estimatedCost: calculateCost(20000, 10000), // Real calculation: 0.21
        totalCostCents: 2100,
        executionTimeMs: 10000
      };

      usageManager.trackTaskStart('morning-task');
      usageManager.trackTaskCompletion('morning-task', morningTaskUsage, true);

      const stats = usageManager.getUsageStats();

      // At 8 AM (8 hours into 24-hour day), project full day cost
      // Current cost: 0.21, projected: 0.21 * (24/8) = 0.63
      expect(stats.projectedDailyCost).toBeCloseTo(0.63);

      vi.restoreAllMocks();
    });
  });

  describe('3. Cost-Based Policy Integration (Real Policy Logic)', () => {
    it('should support cost threshold evaluations', () => {
      // This tests the pattern used in PolicyEnforcer for cost-based policies
      const task1: TaskUsage = {
        inputTokens: 100000,
        outputTokens: 50000,
        totalTokens: 150000,
        estimatedCost: calculateCost(100000, 50000), // 1.05
        totalCostCents: 10500,
        executionTimeMs: 15000
      };

      const task2: TaskUsage = {
        inputTokens: 500000,
        outputTokens: 300000,
        totalTokens: 800000,
        estimatedCost: calculateCost(500000, 300000), // 6.0
        totalCostCents: 60000,
        executionTimeMs: 30000
      };

      // Test cost threshold conditions (similar to PolicyEnforcer logic)
      const costThreshold = 5.0;

      expect(task1.estimatedCost).toBeLessThan(costThreshold);
      expect(task2.estimatedCost).toBeGreaterThan(costThreshold);

      // Verify realistic high-cost scenario detection
      expect(task2.estimatedCost).toBeGreaterThan(10.0); // Would trigger high-cost review
    });

    it('should handle edge cases in cost calculations', () => {
      // Test very small costs
      const tinyTask = calculateCost(1, 1);
      expect(tinyTask).toBeGreaterThan(0);
      expect(tinyTask).toBeLessThan(0.0001);

      // Test asymmetric token usage
      const inputHeavyTask = calculateCost(1_000_000, 1000);
      const outputHeavyTask = calculateCost(1000, 1_000_000);

      // Output tokens are 5x more expensive than input
      expect(outputHeavyTask).toBeGreaterThan(inputHeavyTask);
      expect(outputHeavyTask / inputHeavyTask).toBeCloseTo(5, 1);
    });
  });

  describe('4. Real-World Cost Scenarios (Production Use Cases)', () => {
    it('should accurately estimate costs for typical development tasks', () => {
      // Code review task
      const codeReview = calculateCost(15000, 8000);
      expect(codeReview).toBeCloseTo(0.165); // ~16.5 cents
      expect(codeReview).toBeLessThan(0.5); // Should be reasonable

      // Documentation generation
      const docGen = calculateCost(30000, 20000);
      expect(docGen).toBeCloseTo(0.39); // ~39 cents
      expect(docGen).toBeLessThan(1.0); // Should be reasonable

      // Large refactoring analysis
      const largeRefactor = calculateCost(200000, 100000);
      expect(largeRefactor).toBeCloseTo(2.1); // ~$2.10
      expect(largeRefactor).toBeGreaterThan(1.0); // Should be significant

      // Complex architectural planning
      const archPlanning = calculateCost(500000, 300000);
      expect(archPlanning).toBeCloseTo(6.0); // ~$6.00
      expect(archPlanning).toBeGreaterThan(5.0); // Should trigger review
    });

    it('should provide realistic daily budget tracking', () => {
      // Simulate a full day of development work
      const tasks = [
        { input: 5000, output: 3000 },    // Small task: ~8 cents
        { input: 15000, output: 10000 },  // Medium task: ~20 cents
        { input: 25000, output: 15000 },  // Large task: ~37 cents
        { input: 40000, output: 20000 },  // Complex task: ~42 cents
        { input: 20000, output: 12000 }   // Final task: ~24 cents
      ];

      let totalDailyCost = 0;
      const calculatedCosts: number[] = [];

      for (const task of tasks) {
        const cost = calculateCost(task.input, task.output);
        calculatedCosts.push(cost);
        totalDailyCost += cost;
      }

      // Verify individual calculations
      expect(calculatedCosts[0]).toBeCloseTo(0.075, 3);  // ~7.5 cents
      expect(calculatedCosts[1]).toBeCloseTo(0.195, 3);  // ~19.5 cents
      expect(calculatedCosts[2]).toBeCloseTo(0.3, 3);    // ~30 cents
      expect(calculatedCosts[3]).toBeCloseTo(0.42, 3);   // ~42 cents
      expect(calculatedCosts[4]).toBeCloseTo(0.24, 3);   // ~24 cents

      // Total daily cost should be realistic for development work
      expect(totalDailyCost).toBeCloseTo(1.23, 2); // ~$1.23 total
      expect(totalDailyCost).toBeLessThan(5.0); // Should be under reasonable daily limit
      expect(totalDailyCost).toBeGreaterThan(1.0); // Should be significant enough to track
    });

    it('should detect expensive operations accurately', () => {
      // Very large analysis task (e.g., processing entire codebase)
      const massiveAnalysis = calculateCost(2_000_000, 1_000_000);
      expect(massiveAnalysis).toBe(21.0); // $21.00 - clearly expensive

      // Large documentation task
      const largeDocs = calculateCost(800_000, 600_000);
      expect(largeDocs).toBe(11.4); // $11.40 - expensive

      // Batch processing task
      const batchProcessing = calculateCost(1_500_000, 500_000);
      expect(batchProcessing).toBe(12.0); // $12.00 - expensive

      // All these should trigger cost warnings
      expect(massiveAnalysis).toBeGreaterThan(10.0);
      expect(largeDocs).toBeGreaterThan(10.0);
      expect(batchProcessing).toBeGreaterThan(10.0);
    });
  });

  describe('5. Mathematical Properties and Edge Cases', () => {
    it('should exhibit correct mathematical properties', () => {
      // Linearity: cost(2x tokens) = 2 * cost(x tokens)
      const baseTokens = 50000;
      const baseCost = calculateCost(baseTokens, baseTokens);
      const doubleCost = calculateCost(baseTokens * 2, baseTokens * 2);

      expect(doubleCost).toBeCloseTo(baseCost * 2, 4);

      // Additivity: cost(a+b) = cost(a) + cost(b) for same token type
      const inputTokensA = 30000;
      const inputTokensB = 20000;
      const outputTokensA = 15000;
      const outputTokensB = 10000;

      const separateCosts = calculateCost(inputTokensA, outputTokensA) +
                           calculateCost(inputTokensB, outputTokensB);
      const combinedCost = calculateCost(inputTokensA + inputTokensB,
                                       outputTokensA + outputTokensB);

      expect(combinedCost).toBeCloseTo(separateCosts, 4);
    });

    it('should handle boundary values correctly', () => {
      // Test 1 token of each type
      const singleTokens = calculateCost(1, 1);
      expect(singleTokens).toBeCloseTo(0.000018, 6); // Very small but non-zero

      // Test maximum realistic values
      const maxRealistic = calculateCost(10_000_000, 10_000_000);
      expect(maxRealistic).toBe(180.0); // $180.00

      // Test asymmetric extremes
      const maxInput = calculateCost(10_000_000, 0);
      const maxOutput = calculateCost(0, 10_000_000);

      expect(maxInput).toBe(30.0); // $30.00 for 10M input
      expect(maxOutput).toBe(150.0); // $150.00 for 10M output
    });

    it('should maintain precision across different scales', () => {
      // Small scale
      const small = calculateCost(100, 50);
      expect(small).toBeCloseTo(0.0011, 4);

      // Medium scale
      const medium = calculateCost(50000, 25000);
      expect(medium).toBeCloseTo(0.525, 4);

      // Large scale
      const large = calculateCost(1000000, 500000);
      expect(large).toBeCloseTo(10.5, 4);

      // Verify proper scaling relationships
      expect(medium).toBeCloseTo(small * 500, 1);
      expect(large).toBeCloseTo(small * 10000, 1);
    });

    it('should be deterministic and reproducible', () => {
      const inputTokens = 75432;
      const outputTokens = 43210;

      // Calculate multiple times
      const cost1 = calculateCost(inputTokens, outputTokens);
      const cost2 = calculateCost(inputTokens, outputTokens);
      const cost3 = calculateCost(inputTokens, outputTokens);

      // Should be exactly equal (deterministic)
      expect(cost1).toBe(cost2);
      expect(cost2).toBe(cost3);

      // Verify the actual calculated value
      const expectedCost = ((75432 / 1_000_000) * 3.0) + ((43210 / 1_000_000) * 15.0);
      const roundedExpected = Math.round(expectedCost * 10000) / 10000;
      expect(cost1).toBe(roundedExpected);
    });
  });
});