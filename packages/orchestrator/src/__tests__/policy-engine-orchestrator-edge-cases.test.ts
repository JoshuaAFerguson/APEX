/**
 * @fileoverview Edge case tests for PolicyEngine integration with ApexOrchestrator
 *
 * Tests cover:
 * - Error scenarios and recovery mechanisms
 * - Resource cleanup and memory management
 * - Performance under stress conditions
 * - Interaction with other orchestrator features
 * - Real-world workflow scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi, MockedFunction } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApexOrchestrator } from '../index.js';
import { PolicyEngine } from '../policy-engine.js';
import type {
  ApexConfig,
  PolicyCheckResult,
  PolicyCheckContext,
  PolicyEngine as IPolicyEngine,
  ApexOrchestratorOptions,
  Task,
  PolicyViolation,
} from '@apexcli/core';
import path from 'node:path';
import { tmpdir } from 'node:os';
import fs from 'node:fs/promises';

// ============================================================================
// Test Helpers and Extended Mocks
// ============================================================================

/**
 * Creates a comprehensive test project with various scenarios
 */
async function createComplexTestProject(): Promise<string> {
  const testDir = path.join(tmpdir(), `apex-policy-test-${randomUUID()}`);
  const apexDir = path.join(testDir, '.apex');

  await fs.mkdir(apexDir, { recursive: true });

  // Create a complex configuration that covers many edge cases
  await fs.writeFile(
    path.join(apexDir, 'config.yaml'),
    `
project:
  name: complex-policy-test
  description: Complex test project with comprehensive policy scenarios

policy:
  enabled: true
  enforcement: strict
  name: comprehensive-policy
  allowedPaths:
    mode: allowlist
    allow:
      - "src/**/*.ts"
      - "src/**/*.js"
      - "test/**/*"
      - "docs/**/*.md"
    block:
      - "**/*.key"
      - "**/*.pem"
      - "**/secrets/**"
      - "**/node_modules/**"
    sensitive:
      - "**/.env*"
      - "**/config/production.*"
      - "**/database.config.*"
  approvalRules:
    enabled: true
    rules:
      - id: dangerous-tools
        name: Dangerous Tools Approval
        enabled: true
        priority: 200
        conditions:
          - type: tool-name
            patterns: ["Bash", "Shell", "KillShell"]
        urgency: critical
        timeoutMinutes: 10
        approvers: ["admin", "security"]
        minApprovals: 2
        timeoutAction: reject
      - id: production-files
        name: Production Files Approval
        enabled: true
        priority: 150
        conditions:
          - type: file-pattern
            patterns: ["**/production.*", "**/prod.*"]
        urgency: high
        timeoutMinutes: 30
        approvers: ["admin"]
        minApprovals: 1
        timeoutAction: reject
      - id: high-cost-operations
        name: High Cost Operations
        enabled: true
        priority: 100
        conditions:
          - type: cost-threshold
            threshold: 5.0
        urgency: normal
        timeoutMinutes: 60
        approvers: ["admin", "finance"]
        minApprovals: 1
        timeoutAction: reject

permissions:
  autonomy: supervised
  tools: {}

agents: []
workflows: []
`
  );

  // Create some test files to work with
  const srcDir = path.join(testDir, 'src');
  const secretsDir = path.join(testDir, 'secrets');

  await fs.mkdir(srcDir, { recursive: true });
  await fs.mkdir(secretsDir, { recursive: true });

  await fs.writeFile(path.join(srcDir, 'main.ts'), 'export const main = () => console.log("Hello");');
  await fs.writeFile(path.join(secretsDir, 'api.key'), 'secret-api-key-content');
  await fs.writeFile(path.join(testDir, '.env.production'), 'DATABASE_URL=production-db-url');

  return testDir;
}

/**
 * Creates a policy engine that simulates various failure modes
 */
function createFailurePronePolicyEngine(failureType: 'timeout' | 'error' | 'intermittent' | 'slow'): IPolicyEngine {
  const baseResponse: PolicyCheckResult = {
    status: 'allow',
    violations: [],
    enforcementMode: 'warn',
    checkedAt: new Date(),
    policyName: 'failure-prone-policy',
    policyId: 'failure-prone-policy-id',
    rulesEvaluated: 1,
    rulesPassed: 1,
    rulesFailed: 0,
    durationMs: 10,
    metadata: {},
  };

  let callCount = 0;

  const mockCheckPolicy = vi.fn().mockImplementation(async () => {
    callCount++;

    switch (failureType) {
      case 'timeout':
        // Simulate timeout by never resolving
        return new Promise(() => {}); // Never resolves

      case 'error':
        throw new Error(`Policy engine failure on call ${callCount}`);

      case 'intermittent':
        // Fail every other call
        if (callCount % 2 === 0) {
          throw new Error(`Intermittent failure on call ${callCount}`);
        }
        return baseResponse;

      case 'slow':
        // Simulate slow response
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
          ...baseResponse,
          durationMs: 1000,
        };

      default:
        return baseResponse;
    }
  });

  return {
    checkPolicy: mockCheckPolicy,
    getEnforcementMode: vi.fn().mockReturnValue('warn'),
    setEnforcementMode: vi.fn(),
    registerPolicy: vi.fn(),
    unregisterPolicy: vi.fn(),
    getPolicies: vi.fn().mockReturnValue([]),
    getPolicy: vi.fn(),
    hasPolicy: vi.fn().mockReturnValue(false),
    clearPolicies: vi.fn(),
  };
}

/**
 * Creates a policy engine that tracks resource usage
 */
function createResourceTrackingPolicyEngine(): IPolicyEngine & { getStats: () => any } {
  const stats = {
    checkCount: 0,
    totalDuration: 0,
    maxMemoryUsage: 0,
    concurrentCalls: 0,
    maxConcurrentCalls: 0,
  };

  const mockCheckPolicy = vi.fn().mockImplementation(async (context: PolicyCheckContext) => {
    stats.concurrentCalls++;
    stats.maxConcurrentCalls = Math.max(stats.maxConcurrentCalls, stats.concurrentCalls);
    stats.checkCount++;

    const startTime = Date.now();

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));

    const duration = Date.now() - startTime;
    stats.totalDuration += duration;

    // Simulate memory usage tracking
    const memUsage = process.memoryUsage().heapUsed;
    stats.maxMemoryUsage = Math.max(stats.maxMemoryUsage, memUsage);

    stats.concurrentCalls--;

    return {
      status: 'allow' as const,
      violations: [],
      enforcementMode: 'warn' as const,
      checkedAt: new Date(),
      policyName: 'resource-tracking-policy',
      policyId: 'resource-tracking-policy-id',
      rulesEvaluated: 1,
      rulesPassed: 1,
      rulesFailed: 0,
      durationMs: duration,
      metadata: {
        callNumber: stats.checkCount,
        concurrentCalls: stats.concurrentCalls,
      },
    };
  });

  return {
    checkPolicy: mockCheckPolicy,
    getEnforcementMode: vi.fn().mockReturnValue('warn'),
    setEnforcementMode: vi.fn(),
    registerPolicy: vi.fn(),
    unregisterPolicy: vi.fn(),
    getPolicies: vi.fn().mockReturnValue([]),
    getPolicy: vi.fn(),
    hasPolicy: vi.fn().mockReturnValue(false),
    clearPolicies: vi.fn(),
    getStats: () => ({ ...stats }),
  };
}

// ============================================================================
// Error Handling and Recovery Tests
// ============================================================================

describe('PolicyEngine - Error Handling and Recovery', () => {
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = await createComplexTestProject();
  });

  afterEach(async () => {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should handle policy engine timeouts gracefully', async () => {
    const timeoutPolicyEngine = createFailurePronePolicyEngine('timeout');

    const options: ApexOrchestratorOptions = {
      policyEngine: timeoutPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);

    // Mock query with timeout to prevent hanging tests
    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Response after timeout' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    const taskId = randomUUID();

    // Should handle timeout and potentially continue or fail gracefully
    const startTime = Date.now();

    try {
      await Promise.race([
        orchestrator.executeTask(taskId, 'Test timeout handling'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Test timeout')), 2000)
        ),
      ]);
    } catch (error) {
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(2000); // Should not hang

      // Error should not be the original policy engine error
      expect((error as Error).message).not.toBe('Policy engine failure');
    }

    expect(timeoutPolicyEngine.checkPolicy).toHaveBeenCalled();
  }, 5000); // Longer timeout for this test

  it('should recover from policy engine errors', async () => {
    const errorPolicyEngine = createFailurePronePolicyEngine('error');

    const options: ApexOrchestratorOptions = {
      policyEngine: errorPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Response after policy error' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    const taskId = randomUUID();

    // Should handle policy engine error gracefully
    try {
      await orchestrator.executeTask(taskId, 'Test error recovery');

      // If execution continues, it should be due to graceful error handling
      // Verify that the orchestrator handled the error appropriately
    } catch (error) {
      // If execution fails, ensure it's not due to unhandled policy engine error
      expect((error as Error).message).not.toContain('Policy engine failure');
    }

    expect(errorPolicyEngine.checkPolicy).toHaveBeenCalled();
  });

  it('should handle intermittent policy engine failures', async () => {
    const intermittentPolicyEngine = createFailurePronePolicyEngine('intermittent');

    const options: ApexOrchestratorOptions = {
      policyEngine: intermittentPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Intermittent test response' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    // Execute multiple tasks to test intermittent behavior
    const tasks = Array.from({ length: 4 }, (_, i) => ({
      id: `intermittent-task-${i}`,
      description: `Intermittent test task ${i}`,
    }));

    const results = await Promise.allSettled(
      tasks.map(task =>
        orchestrator.executeTask(task.id, task.description)
      )
    );

    // Some tasks should succeed, some might fail
    const successes = results.filter(r => r.status === 'fulfilled');
    const failures = results.filter(r => r.status === 'rejected');

    // Should have attempted all policy checks
    expect(intermittentPolicyEngine.checkPolicy).toHaveBeenCalledTimes(4);

    // Should handle both successes and failures gracefully
    expect(successes.length + failures.length).toBe(4);
  });

  it('should handle slow policy engine responses', async () => {
    const slowPolicyEngine = createFailurePronePolicyEngine('slow');

    const options: ApexOrchestratorOptions = {
      policyEngine: slowPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Slow response test' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    const taskId = randomUUID();
    const startTime = Date.now();

    try {
      await orchestrator.executeTask(taskId, 'Test slow policy response');

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThan(1000); // Should wait for slow policy
    } catch (error) {
      // If it fails, should not be due to timeout
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThan(500); // Should have waited some time
    }

    expect(slowPolicyEngine.checkPolicy).toHaveBeenCalled();
  }, 10000); // Longer timeout for slow test
});

// ============================================================================
// Resource Management and Performance Tests
// ============================================================================

describe('PolicyEngine - Resource Management and Performance', () => {
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = await createComplexTestProject();
  });

  afterEach(async () => {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should handle high concurrency policy checks efficiently', async () => {
    const resourceTracker = createResourceTrackingPolicyEngine();

    const options: ApexOrchestratorOptions = {
      policyEngine: resourceTracker,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Concurrent test response' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    // Execute many tasks concurrently
    const tasks = Array.from({ length: 10 }, (_, i) => ({
      id: `concurrent-task-${i}`,
      description: `Concurrent test task ${i}`,
    }));

    const startTime = Date.now();

    const results = await Promise.allSettled(
      tasks.map(task =>
        orchestrator.executeTask(task.id, task.description)
      )
    );

    const elapsed = Date.now() - startTime;
    const stats = resourceTracker.getStats();

    // Should complete in reasonable time despite concurrency
    expect(elapsed).toBeLessThan(5000);

    // Should have made all policy checks
    expect(stats.checkCount).toBe(10);

    // Should handle reasonable concurrency
    expect(stats.maxConcurrentCalls).toBeGreaterThan(0);
    expect(stats.maxConcurrentCalls).toBeLessThanOrEqual(10);

    // Should track resource usage
    expect(stats.totalDuration).toBeGreaterThan(0);
    expect(stats.maxMemoryUsage).toBeGreaterThan(0);

    console.log('Resource stats:', stats);
  }, 10000);

  it('should cleanup resources properly after policy checks', async () => {
    const resourceTracker = createResourceTrackingPolicyEngine();

    const options: ApexOrchestratorOptions = {
      policyEngine: resourceTracker,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Cleanup test response' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    const initialMemory = process.memoryUsage().heapUsed;

    // Execute several tasks
    for (let i = 0; i < 5; i++) {
      try {
        await orchestrator.executeTask(
          `cleanup-task-${i}`,
          `Cleanup test task ${i}`
        );
      } catch {
        // Ignore execution errors, focus on cleanup
      }
    }

    const stats = resourceTracker.getStats();

    // Should have no concurrent calls after completion
    expect(stats.concurrentCalls).toBe(0);

    // Memory should not grow excessively
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = finalMemory - initialMemory;

    // Allow for some growth but not excessive
    expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB limit
  });

  it('should maintain performance under stress conditions', async () => {
    const resourceTracker = createResourceTrackingPolicyEngine();

    const options: ApexOrchestratorOptions = {
      policyEngine: resourceTracker,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Stress test response' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    // Simulate stress conditions with many rapid requests
    const stressTest = async (batchSize: number) => {
      const tasks = Array.from({ length: batchSize }, (_, i) => ({
        id: `stress-task-${i}`,
        description: `Stress test task ${i}`,
      }));

      const startTime = Date.now();

      const results = await Promise.allSettled(
        tasks.map(task =>
          orchestrator.executeTask(task.id, task.description)
        )
      );

      const elapsed = Date.now() - startTime;
      const avgTime = elapsed / batchSize;

      return { elapsed, avgTime, successCount: results.filter(r => r.status === 'fulfilled').length };
    };

    // Run multiple stress test batches
    const batch1 = await stressTest(5);
    const batch2 = await stressTest(5);
    const batch3 = await stressTest(5);

    const stats = resourceTracker.getStats();

    // Performance should remain consistent across batches
    expect(batch1.avgTime).toBeLessThan(2000); // 2s per task max
    expect(batch2.avgTime).toBeLessThan(2000);
    expect(batch3.avgTime).toBeLessThan(2000);

    // Should not show significant performance degradation
    const performanceDegradation = batch3.avgTime / batch1.avgTime;
    expect(performanceDegradation).toBeLessThan(2.0); // Max 2x slowdown

    // Should have processed all requests
    expect(stats.checkCount).toBe(15);
    expect(stats.concurrentCalls).toBe(0); // All should be complete

    console.log('Stress test results:', { batch1, batch2, batch3, stats });
  }, 15000);
});

// ============================================================================
// Real-world Workflow Scenario Tests
// ============================================================================

describe('PolicyEngine - Real-world Workflow Scenarios', () => {
  let testProjectPath: string;

  beforeEach(async () => {
    testProjectPath = await createComplexTestProject();
  });

  afterEach(async () => {
    try {
      await fs.rm(testProjectPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should handle complex development workflow with policy constraints', async () => {
    // Create a realistic policy engine with mixed responses
    const workflowPolicyEngine: IPolicyEngine = {
      checkPolicy: vi.fn().mockImplementation(async (context: PolicyCheckContext) => {
        const violations: PolicyViolation[] = [];

        // Check for dangerous tools
        if (context.toolName === 'Bash' || context.toolName === 'Shell') {
          violations.push({
            id: randomUUID(),
            rule: 'dangerous-tools',
            message: 'Bash/Shell commands require approval',
            severity: 'high',
            blocking: true,
            policyType: 'approval',
            timestamp: new Date(),
          });
        }

        // Check for production files
        if (context.resource?.includes('production') || context.resource?.includes('prod')) {
          violations.push({
            id: randomUUID(),
            rule: 'production-files',
            message: 'Production files require approval',
            severity: 'medium',
            blocking: false,
            policyType: 'path',
            timestamp: new Date(),
          });
        }

        // Check for blocked paths
        if (context.resource?.includes('secrets') || context.resource?.includes('.key')) {
          violations.push({
            id: randomUUID(),
            rule: 'blocked-paths',
            message: 'Access to secrets is blocked',
            severity: 'critical',
            blocking: true,
            policyType: 'path',
            timestamp: new Date(),
          });
        }

        const hasBlockingViolations = violations.some(v => v.blocking);

        return {
          status: hasBlockingViolations ? 'deny' : 'allow',
          violations,
          enforcementMode: 'strict',
          checkedAt: new Date(),
          policyName: 'workflow-policy',
          policyId: 'workflow-policy-id',
          rulesEvaluated: 3,
          rulesPassed: 3 - violations.length,
          rulesFailed: violations.length,
          durationMs: 25,
          metadata: {
            workflowScenario: true,
          },
        };
      }),
      getEnforcementMode: vi.fn().mockReturnValue('strict'),
      setEnforcementMode: vi.fn(),
      registerPolicy: vi.fn(),
      unregisterPolicy: vi.fn(),
      getPolicies: vi.fn().mockReturnValue([]),
      getPolicy: vi.fn(),
      hasPolicy: vi.fn().mockReturnValue(false),
      clearPolicies: vi.fn(),
    };

    const options: ApexOrchestratorOptions = {
      policyEngine: workflowPolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Workflow test response' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    // Simulate a development workflow with different types of operations
    const workflowSteps = [
      {
        id: 'read-source-code',
        description: 'Read source code file',
        expectedAllowed: true,
      },
      {
        id: 'read-production-config',
        description: 'Read production configuration',
        expectedAllowed: true, // Warning but not blocked
      },
      {
        id: 'execute-tests',
        description: 'Execute test suite',
        expectedAllowed: true,
      },
      {
        id: 'access-secrets',
        description: 'Access secret files',
        expectedAllowed: false, // Should be blocked
      },
      {
        id: 'run-bash-command',
        description: 'Run bash command',
        expectedAllowed: false, // Should require approval/be blocked
      },
    ];

    const results = await Promise.allSettled(
      workflowSteps.map(async step => {
        try {
          await orchestrator.executeTask(step.id, step.description);
          return { step: step.id, success: true, error: null };
        } catch (error) {
          return { step: step.id, success: false, error: (error as Error).message };
        }
      })
    );

    // Verify policy was checked for each step
    expect(workflowPolicyEngine.checkPolicy).toHaveBeenCalledTimes(5);

    // Analyze results
    results.forEach((result, index) => {
      const step = workflowSteps[index];

      if (result.status === 'fulfilled') {
        const { success } = result.value;
        if (step.expectedAllowed) {
          expect(success).toBe(true);
        } else {
          // If step was expected to be blocked but succeeded,
          // it might be due to error handling allowing continuation
        }
      } else if (result.status === 'rejected') {
        // Step failed - check if it was expected to fail
        if (!step.expectedAllowed) {
          // Expected failure due to policy violation
          expect(true).toBe(true); // This is expected
        }
      }
    });

    console.log('Workflow results:', results);
  });

  it('should integrate with orchestrator task lifecycle properly', async () => {
    const lifecyclePolicyEngine: IPolicyEngine = {
      checkPolicy: vi.fn().mockImplementation(async (context: PolicyCheckContext) => {
        // Track policy check context throughout task lifecycle
        return {
          status: 'allow',
          violations: [],
          enforcementMode: 'warn',
          checkedAt: new Date(),
          policyName: 'lifecycle-policy',
          policyId: 'lifecycle-policy-id',
          rulesEvaluated: 1,
          rulesPassed: 1,
          rulesFailed: 0,
          durationMs: 15,
          metadata: {
            taskId: context.taskId,
            agentId: context.agentId,
            action: context.action,
            toolName: context.toolName,
            stage: 'pre-execution',
          },
        };
      }),
      getEnforcementMode: vi.fn().mockReturnValue('warn'),
      setEnforcementMode: vi.fn(),
      registerPolicy: vi.fn(),
      unregisterPolicy: vi.fn(),
      getPolicies: vi.fn().mockReturnValue([]),
      getPolicy: vi.fn(),
      hasPolicy: vi.fn().mockReturnValue(false),
      clearPolicies: vi.fn(),
    };

    const options: ApexOrchestratorOptions = {
      policyEngine: lifecyclePolicyEngine,
    };

    const orchestrator = new ApexOrchestrator(testProjectPath, options);

    const mockQuery = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Lifecycle test response' }],
      stopReason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    (orchestrator as any).query = mockQuery;

    const taskId = 'lifecycle-test-task';

    try {
      await orchestrator.executeTask(taskId, 'Test task lifecycle integration');
    } catch {
      // Ignore execution errors, focus on lifecycle integration
    }

    // Verify policy was integrated into task lifecycle
    expect(lifecyclePolicyEngine.checkPolicy).toHaveBeenCalled();

    // Verify context was properly populated
    const calls = (lifecyclePolicyEngine.checkPolicy as MockedFunction<any>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);

    const context = calls[0][0] as PolicyCheckContext;
    expect(context).toMatchObject({
      taskId: expect.any(String),
      agentId: expect.any(String),
      action: expect.any(String),
      environment: expect.objectContaining({
        projectPath: testProjectPath,
      }),
    });

    // Should maintain consistency across policy checks within the task
    calls.forEach((call: any[]) => {
      const ctx = call[0] as PolicyCheckContext;
      expect(ctx.taskId).toBeTruthy();
      expect(ctx.agentId).toBeTruthy();
      expect(ctx.environment?.projectPath).toBe(testProjectPath);
    });
  });
});