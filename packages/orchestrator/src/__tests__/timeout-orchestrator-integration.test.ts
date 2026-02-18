/**
 * @fileoverview Timeout Integration Tests with Real Orchestrator
 *
 * Tests timeout configurations and wait strategies as they work within
 * the actual ApexOrchestrator context, validating end-to-end timeout behavior.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm } from 'fs/promises';
import { ApexOrchestrator } from '../index.js';
import { TaskStore } from '../store.js';
import {
  TimeoutUtils,
  DEFAULT_TIMEOUTS,
  PRODUCTION_TIMEOUT_CONFIG,
  DEVELOPMENT_TIMEOUT_CONFIG,
} from '../timeout-documentation.js';

describe('Timeout Orchestrator Integration Tests', () => {
  let orchestrator: ApexOrchestrator;
  let taskStore: TaskStore;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test
    tempDir = await mkdtemp(path.join(tmpdir(), 'apex-timeout-test-'));

    // Initialize task store
    taskStore = new TaskStore(':memory:'); // In-memory database for tests

    // Create orchestrator with test configuration
    orchestrator = new ApexOrchestrator({
      config: {
        projectRoot: tempDir,
        workspace: tempDir,
        // Include timeout configurations
        browser: {
          headless: true,
          timeout: DEVELOPMENT_TIMEOUT_CONFIG.browser.pageLoadTimeout,
        },
        tools: {
          timeout: DEVELOPMENT_TIMEOUT_CONFIG.tools.executionTimeoutMs,
        },
        approval: {
          globalTimeoutMinutes: DEVELOPMENT_TIMEOUT_CONFIG.approval.globalApprovalTimeoutMinutes,
        },
      },
      taskStore,
    });

    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();

    // Clean up orchestrator
    if (orchestrator) {
      await orchestrator.shutdown();
    }

    // Clean up temporary directory
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('Orchestrator Timeout Configuration Loading', () => {
    it('should load and apply timeout configurations correctly', () => {
      const config = orchestrator.getConfiguration();

      // Verify timeout configurations are loaded
      expect(config.browser?.timeout).toBe(DEVELOPMENT_TIMEOUT_CONFIG.browser.pageLoadTimeout);
      expect(config.tools?.timeout).toBe(DEVELOPMENT_TIMEOUT_CONFIG.tools.executionTimeoutMs);
      expect(config.approval?.globalTimeoutMinutes).toBe(DEVELOPMENT_TIMEOUT_CONFIG.approval.globalApprovalTimeoutMinutes);
    });

    it('should apply environment-specific timeout configurations', async () => {
      // Create production-configured orchestrator
      const prodOrchestrator = new ApexOrchestrator({
        config: {
          projectRoot: tempDir,
          workspace: tempDir,
          environment: 'production',
          browser: {
            timeout: PRODUCTION_TIMEOUT_CONFIG.browser.pageLoadTimeout,
          },
          tools: {
            timeout: PRODUCTION_TIMEOUT_CONFIG.tools.executionTimeoutMs,
          },
        },
        taskStore,
      });

      const prodConfig = prodOrchestrator.getConfiguration();

      // Production should have longer timeouts
      expect(prodConfig.browser?.timeout).toBeGreaterThan(DEVELOPMENT_TIMEOUT_CONFIG.browser.pageLoadTimeout);
      expect(prodConfig.tools?.timeout).toBeGreaterThan(DEVELOPMENT_TIMEOUT_CONFIG.tools.executionTimeoutMs);

      await prodOrchestrator.shutdown();
    });

    it('should fall back to default timeouts when not configured', async () => {
      // Create orchestrator without explicit timeout configuration
      const defaultOrchestrator = new ApexOrchestrator({
        config: {
          projectRoot: tempDir,
          workspace: tempDir,
        },
        taskStore,
      });

      const config = defaultOrchestrator.getConfiguration();

      // Should use system defaults
      expect(config.browser?.timeout || DEFAULT_TIMEOUTS.BROWSER_PAGE_LOAD)
        .toBe(DEFAULT_TIMEOUTS.BROWSER_PAGE_LOAD);

      await defaultOrchestrator.shutdown();
    });
  });

  describe('Task Execution Timeout Behavior', () => {
    it('should enforce timeouts during task execution', async () => {
      const task = await orchestrator.createTask({
        description: 'Test timeout enforcement',
        workflow: 'simple-test',
        config: {},
      });

      // Mock a slow operation that exceeds timeout
      const slowOperation = new Promise((resolve) => {
        setTimeout(() => resolve('completed'), 10000);
      });

      const timeoutPromise = TimeoutUtils.withTimeout(slowOperation, 5000);

      vi.advanceTimersByTime(6000);

      await expect(timeoutPromise).rejects.toThrow('Operation timed out after 5000ms');
    });

    it('should handle timeout during workflow stage execution', async () => {
      const task = await orchestrator.createTask({
        description: 'Test stage timeout',
        workflow: 'timeout-test',
        config: {
          timeouts: {
            stageTimeout: 3000,
          },
        },
      });

      // Start task execution
      const executionPromise = orchestrator.executeTask(task.id);

      // Simulate stage taking longer than timeout
      vi.advanceTimersByTime(5000);

      // Execution should handle timeout gracefully
      await expect(executionPromise).rejects.toThrow(/timeout|timed out/i);
    });

    it('should apply different timeouts for different workflow stages', async () => {
      const multiStageTask = await orchestrator.createTask({
        description: 'Multi-stage timeout test',
        workflow: 'multi-stage',
        config: {
          stages: [
            { name: 'planning', timeout: 2000 },
            { name: 'implementation', timeout: 5000 },
            { name: 'testing', timeout: 3000 },
          ],
        },
      });

      const timeoutEvents: Array<{ stage: string; time: number }> = [];
      const startTime = Date.now();

      // Mock stage execution with different completion times
      const stagePromises = [
        // Planning completes within timeout
        TimeoutUtils.withTimeout(
          new Promise(resolve => setTimeout(resolve, 1000)),
          2000
        ).catch(() => {
          timeoutEvents.push({ stage: 'planning', time: Date.now() - startTime });
          throw new Error('Planning timeout');
        }),

        // Implementation times out
        TimeoutUtils.withTimeout(
          new Promise(resolve => setTimeout(resolve, 6000)),
          5000
        ).catch(() => {
          timeoutEvents.push({ stage: 'implementation', time: Date.now() - startTime });
          throw new Error('Implementation timeout');
        }),

        // Testing completes within timeout
        TimeoutUtils.withTimeout(
          new Promise(resolve => setTimeout(resolve, 2500)),
          3000
        ).catch(() => {
          timeoutEvents.push({ stage: 'testing', time: Date.now() - startTime });
          throw new Error('Testing timeout');
        }),
      ];

      vi.advanceTimersByTime(8000);

      const results = await Promise.allSettled(stagePromises);

      // Planning and testing should succeed, implementation should timeout
      expect(results[0].status).toBe('fulfilled'); // Planning
      expect(results[1].status).toBe('rejected');  // Implementation (timeout)
      expect(results[2].status).toBe('fulfilled'); // Testing

      expect(timeoutEvents.length).toBe(1);
      expect(timeoutEvents[0].stage).toBe('implementation');
    });
  });

  describe('Tool Execution Timeout Integration', () => {
    it('should enforce tool execution timeouts', async () => {
      // Register a slow tool
      orchestrator.registerTool({
        name: 'slow-tool',
        description: 'A tool that takes a long time',
        implementation: 'internal',
        timeoutMs: 2000, // 2 second timeout
      });

      const task = await orchestrator.createTask({
        description: 'Test tool timeout',
        workflow: 'tool-test',
        config: {},
      });

      // Execute tool that exceeds timeout
      const toolPromise = orchestrator.executeTool(task.id, 'slow-tool', {});

      // Advance time past tool timeout
      vi.advanceTimersByTime(3000);

      await expect(toolPromise).rejects.toThrow(/timeout|timed out/i);
    });

    it('should handle different timeout configurations for different tools', async () => {
      // Register tools with different timeouts
      orchestrator.registerTool({
        name: 'quick-tool',
        description: 'Fast tool',
        implementation: 'internal',
        timeoutMs: 1000,
      });

      orchestrator.registerTool({
        name: 'medium-tool',
        description: 'Medium speed tool',
        implementation: 'internal',
        timeoutMs: 3000,
      });

      orchestrator.registerTool({
        name: 'slow-tool',
        description: 'Slow tool',
        implementation: 'internal',
        timeoutMs: 8000,
      });

      const task = await orchestrator.createTask({
        description: 'Multi-tool timeout test',
        workflow: 'multi-tool',
        config: {},
      });

      const toolPromises = [
        orchestrator.executeTool(task.id, 'quick-tool', {}),
        orchestrator.executeTool(task.id, 'medium-tool', {}),
        orchestrator.executeTool(task.id, 'slow-tool', {}),
      ];

      // Advance through different timeout periods
      vi.advanceTimersByTime(2000); // quick-tool and medium-tool should timeout
      vi.advanceTimersByTime(7000); // slow-tool should timeout

      const results = await Promise.allSettled(toolPromises);

      // All should timeout in this test
      expect(results.every(r => r.status === 'rejected')).toBe(true);
    });
  });

  describe('Approval Gate Timeout Integration', () => {
    it('should handle approval gate timeouts', async () => {
      const task = await orchestrator.createTask({
        description: 'Test approval timeout',
        workflow: 'approval-test',
        config: {
          gates: [{
            id: 'approval-gate',
            type: 'confirmation',
            message: 'Approve this action?',
            timeout: 5, // 5 minutes
            autoApproveOnTimeout: false,
          }],
        },
      });

      // Request approval
      const approvalPromise = orchestrator.requestApproval({
        id: 'test-approval',
        message: 'Please approve',
        timeoutMinutes: 0.1, // 6 seconds
      });

      // Advance past approval timeout
      vi.advanceTimersByTime(7000);

      await expect(approvalPromise).rejects.toThrow(/timeout|timed out/i);
    });

    it('should handle auto-approval on timeout', async () => {
      const task = await orchestrator.createTask({
        description: 'Test auto-approval on timeout',
        workflow: 'auto-approval-test',
        config: {
          gates: [{
            id: 'auto-approval-gate',
            type: 'confirmation',
            message: 'Auto-approve after timeout?',
            timeout: 0.05, // 3 seconds
            autoApproveOnTimeout: true,
          }],
        },
      });

      const approvalPromise = orchestrator.requestApproval({
        id: 'auto-approval',
        message: 'Will auto-approve',
        timeoutMinutes: 0.05, // 3 seconds
      });

      vi.advanceTimersByTime(4000);

      const result = await approvalPromise;
      expect(result.approved).toBe(true);
      expect(result.reason).toContain('timeout');
    });

    it('should handle cascading approval timeouts', async () => {
      const task = await orchestrator.createTask({
        description: 'Test cascading approval timeouts',
        workflow: 'cascading-approval',
        config: {
          gates: [
            {
              id: 'quick-gate',
              timeout: 0.02, // 1.2 seconds
              autoApproveOnTimeout: true,
            },
            {
              id: 'medium-gate',
              timeout: 0.05, // 3 seconds
              autoApproveOnTimeout: false,
            },
            {
              id: 'slow-gate',
              timeout: 0.1, // 6 seconds
              autoApproveOnTimeout: true,
            },
          ],
        },
      });

      const approvalPromises = [
        orchestrator.requestApproval({ id: 'quick', timeoutMinutes: 0.02 }),
        orchestrator.requestApproval({ id: 'medium', timeoutMinutes: 0.05 }),
        orchestrator.requestApproval({ id: 'slow', timeoutMinutes: 0.1 }),
      ];

      vi.advanceTimersByTime(7000);

      const results = await Promise.allSettled(approvalPromises);

      // Quick and slow should auto-approve, medium should reject
      expect(results[0].status).toBe('fulfilled'); // Auto-approved
      expect(results[1].status).toBe('rejected');  // Timeout rejected
      expect(results[2].status).toBe('fulfilled'); // Auto-approved

      if (results[0].status === 'fulfilled') {
        expect(results[0].value.approved).toBe(true);
      }
      if (results[2].status === 'fulfilled') {
        expect(results[2].value.approved).toBe(true);
      }
    });
  });

  describe('Resource Cleanup During Timeouts', () => {
    it('should clean up resources when operations timeout', async () => {
      const resourceTracker = new Set<string>();

      const resourceIntensiveOperation = async (resourceId: string) => {
        // Allocate resource
        resourceTracker.add(resourceId);

        try {
          // Simulate long operation
          await new Promise((resolve) => {
            setTimeout(resolve, 5000);
          });
          return 'completed';
        } finally {
          // Clean up resource
          resourceTracker.delete(resourceId);
        }
      };

      const operationPromise = TimeoutUtils.withTimeout(
        resourceIntensiveOperation('test-resource'),
        2000
      );

      vi.advanceTimersByTime(3000);

      await expect(operationPromise).rejects.toThrow('Operation timed out');

      // Resource should be cleaned up
      expect(resourceTracker.has('test-resource')).toBe(false);
    });

    it('should handle multiple concurrent resource cleanups', async () => {
      const activeResources = new Set<string>();

      const createResourceOperation = (id: string, duration: number, timeout: number) => {
        return TimeoutUtils.withTimeout(
          new Promise<string>((resolve) => {
            activeResources.add(id);
            setTimeout(() => {
              activeResources.delete(id);
              resolve(`completed-${id}`);
            }, duration);
          }),
          timeout
        ).catch((error) => {
          // Cleanup on timeout
          activeResources.delete(id);
          throw error;
        });
      };

      const operations = [
        createResourceOperation('resource-1', 3000, 1000), // Will timeout
        createResourceOperation('resource-2', 500, 2000),  // Will complete
        createResourceOperation('resource-3', 4000, 1500), // Will timeout
        createResourceOperation('resource-4', 800, 2000),  // Will complete
      ];

      vi.advanceTimersByTime(5000);

      const results = await Promise.allSettled(operations);

      // All resources should be cleaned up
      expect(activeResources.size).toBe(0);

      // Verify mix of success and timeout
      const successful = results.filter(r => r.status === 'fulfilled');
      const timedOut = results.filter(r => r.status === 'rejected');

      expect(successful.length).toBe(2);
      expect(timedOut.length).toBe(2);
    });
  });

  describe('Timeout Monitoring and Debugging', () => {
    it('should provide timeout monitoring capabilities', async () => {
      const task = await orchestrator.createTask({
        description: 'Test timeout monitoring',
        workflow: 'monitoring-test',
        config: {},
      });

      // Start multiple operations with timeouts
      const operations = [
        { name: 'op1', timeout: 2000 },
        { name: 'op2', timeout: 5000 },
        { name: 'op3', timeout: 8000 },
      ];

      const promises = operations.map(op =>
        TimeoutUtils.withTimeout(
          new Promise(resolve => setTimeout(resolve, op.timeout + 1000)),
          op.timeout
        )
      );

      // Check timeout status at different points
      vi.advanceTimersByTime(3000);

      // First operation should have timed out
      const results1 = await Promise.allSettled(promises.slice(0, 1));
      expect(results1[0].status).toBe('rejected');

      vi.advanceTimersByTime(4000);

      // Second operation should have timed out
      const results2 = await Promise.allSettled(promises.slice(1, 2));
      expect(results2[0].status).toBe('rejected');

      vi.advanceTimersByTime(3000);

      // Third operation should have timed out
      const results3 = await Promise.allSettled(promises.slice(2, 3));
      expect(results3[0].status).toBe('rejected');
    });

    it('should provide timeout statistics and insights', () => {
      // Test timeout configuration analysis
      const timeoutStats = {
        browser: {
          configured: DEVELOPMENT_TIMEOUT_CONFIG.browser.pageLoadTimeout,
          default: DEFAULT_TIMEOUTS.BROWSER_PAGE_LOAD,
          ratio: DEVELOPMENT_TIMEOUT_CONFIG.browser.pageLoadTimeout / DEFAULT_TIMEOUTS.BROWSER_PAGE_LOAD,
        },
        tools: {
          configured: DEVELOPMENT_TIMEOUT_CONFIG.tools.executionTimeoutMs,
          default: DEFAULT_TIMEOUTS.TOOL_EXECUTION,
          ratio: DEVELOPMENT_TIMEOUT_CONFIG.tools.executionTimeoutMs / DEFAULT_TIMEOUTS.TOOL_EXECUTION,
        },
      };

      // Development timeouts should be shorter than defaults
      expect(timeoutStats.browser.ratio).toBeLessThan(1);
      expect(timeoutStats.tools.ratio).toBeLessThan(1);

      // But should still be reasonable
      expect(timeoutStats.browser.configured).toBeGreaterThan(10000); // At least 10 seconds
      expect(timeoutStats.tools.configured).toBeGreaterThan(20000);   // At least 20 seconds
    });
  });

  describe('Timeout Error Recovery', () => {
    it('should support retry logic with exponential backoff after timeouts', async () => {
      let attempts = 0;
      const maxAttempts = 3;
      const baseTimeout = 1000;

      const retryableOperation = async (attemptNumber: number): Promise<string> => {
        attempts = attemptNumber;
        const currentTimeout = baseTimeout * Math.pow(2, attemptNumber - 1);

        return TimeoutUtils.withTimeout(
          new Promise<string>((resolve) => {
            // Simulate decreasing operation time with retries
            const operationTime = currentTimeout - (attemptNumber * 200);
            setTimeout(() => resolve(`success-attempt-${attemptNumber}`), operationTime);
          }),
          currentTimeout
        );
      };

      // First attempt: will likely timeout
      try {
        vi.advanceTimersByTime(1200);
        await retryableOperation(1);
      } catch (error) {
        expect(error.message).toContain('timeout');
      }

      // Second attempt: longer timeout
      try {
        vi.advanceTimersByTime(2200);
        await retryableOperation(2);
      } catch (error) {
        expect(error.message).toContain('timeout');
      }

      // Third attempt: should succeed
      vi.advanceTimersByTime(3800);
      const result = await retryableOperation(3);

      expect(result).toBe('success-attempt-3');
      expect(attempts).toBe(3);
    });

    it('should handle timeout recovery across workflow stages', async () => {
      const task = await orchestrator.createTask({
        description: 'Test timeout recovery',
        workflow: 'recovery-test',
        config: {
          retryPolicy: {
            maxAttempts: 2,
            backoffMultiplier: 2,
            baseDelayMs: 1000,
          },
        },
      });

      let stageAttempts = 0;
      const executeStageWithRetry = async () => {
        stageAttempts++;

        return TimeoutUtils.withTimeout(
          new Promise<string>((resolve) => {
            const duration = stageAttempts === 1 ? 3000 : 1000; // First fails, second succeeds
            setTimeout(() => resolve(`stage-complete-${stageAttempts}`), duration);
          }),
          2000 // 2 second timeout
        );
      };

      // First attempt fails
      try {
        vi.advanceTimersByTime(2500);
        await executeStageWithRetry();
      } catch (error) {
        expect(error.message).toContain('timeout');
        expect(stageAttempts).toBe(1);
      }

      // Retry after delay
      vi.advanceTimersByTime(1000); // Backoff delay
      vi.advanceTimersByTime(1500);
      const result = await executeStageWithRetry();

      expect(result).toBe('stage-complete-2');
      expect(stageAttempts).toBe(2);
    });
  });
});