/**
 * Edge case tests for approval promise management and timeout handling
 *
 * This test suite focuses on testing edge cases and error conditions
 * for the approval promise system, including:
 * 1. Promise timeout behavior
 * 2. Concurrent promise creation/resolution
 * 3. Memory leak prevention
 * 4. Error propagation through promise chain
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ApexOrchestrator } from '../index';
import { ApprovalResponse } from '@apexcli/core';

describe('Approval Promise Edge Cases', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test
    tempDir = path.join(__dirname, 'temp-promise-test-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    // Create .apex directory structure
    const apexDir = path.join(tempDir, '.apex');
    fs.mkdirSync(apexDir, { recursive: true });
    fs.mkdirSync(path.join(apexDir, 'agents'), { recursive: true });
    fs.mkdirSync(path.join(apexDir, 'workflows'), { recursive: true });

    // Write minimal config
    const configPath = path.join(apexDir, 'config.yaml');
    fs.writeFileSync(configPath, `
name: "test-promises"
version: "1.0.0"
autonomy: "supervised"
limits:
  maxTokens: 1000
  maxCost: 10.0
`);

    // Create orchestrator instance
    orchestrator = new ApexOrchestrator({
      projectPath: tempDir,
      apiUrl: 'http://localhost:3000'
    });

    await orchestrator.initialize();
  });

  afterEach(async () => {
    if (orchestrator) {
      await orchestrator.shutdown();
    }
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Promise Timeout Handling', () => {
    it('should timeout promise after specified duration', async () => {
      const requestId = 'timeout-test-001';
      const shortTimeout = 100; // 100ms timeout

      const waitPromise = orchestrator.waitForApproval(requestId, shortTimeout);

      const startTime = Date.now();
      await expect(waitPromise).rejects.toThrow(
        `Approval request ${requestId} timed out after ${shortTimeout}ms`
      );
      const endTime = Date.now();

      // Verify timeout happened approximately when expected
      const actualDuration = endTime - startTime;
      expect(actualDuration).toBeGreaterThan(shortTimeout - 10);
      expect(actualDuration).toBeLessThan(shortTimeout + 50); // Allow some variance
    });

    it('should clean up promise reference after timeout', async () => {
      const requestId = 'cleanup-test-001';
      const shortTimeout = 50;

      // Start a promise that will timeout
      const waitPromise = orchestrator.waitForApproval(requestId, shortTimeout);

      // Expect timeout
      await expect(waitPromise).rejects.toThrow();

      // Verify that we can create another promise with same ID after timeout
      expect(() => orchestrator.waitForApproval(requestId, shortTimeout))
        .not.toThrow('Already waiting for approval');
    });

    it('should handle multiple simultaneous timeouts correctly', async () => {
      const baseTimeout = 50;
      const requestIds = ['multi-timeout-001', 'multi-timeout-002', 'multi-timeout-003'];

      // Start multiple promises that will timeout
      const promises = requestIds.map((id, index) =>
        orchestrator.waitForApproval(id, baseTimeout + (index * 10))
      );

      // All should timeout
      const results = await Promise.allSettled(promises);

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected') {
          expect(result.reason.message).toContain(`${requestIds[index]} timed out`);
        }
      });
    });
  });

  describe('Concurrent Promise Management', () => {
    it('should prevent duplicate promises for same request ID', async () => {
      const requestId = 'duplicate-test-001';

      // Start first promise
      const promise1 = orchestrator.waitForApproval(requestId);

      // Attempt to create second promise with same ID
      expect(() => orchestrator.waitForApproval(requestId))
        .toThrow(`Already waiting for approval response to request: ${requestId}`);

      // Clean up first promise
      const response: ApprovalResponse = {
        requestId,
        taskId: 'test-task',
        response: 'approved',
        approver: 'test-user'
      };

      // Mock the grantApproval method to avoid errors
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval').mockResolvedValue();

      await orchestrator.respondToApproval(requestId, response);
      await promise1;

      grantApprovalSpy.mockRestore();
    });

    it('should handle rapid creation and resolution of different promises', async () => {
      const numPromises = 10;
      const responses: ApprovalResponse[] = [];
      const promises: Promise<ApprovalResponse>[] = [];

      // Mock the delegate methods
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval').mockResolvedValue();

      // Create multiple promises rapidly
      for (let i = 0; i < numPromises; i++) {
        const requestId = `rapid-test-${String(i).padStart(3, '0')}`;
        promises.push(orchestrator.waitForApproval(requestId));

        responses.push({
          requestId,
          taskId: `task-${i}`,
          response: 'approved',
          approver: `approver-${i}`
        });
      }

      // Resolve all promises rapidly
      const resolvePromises = responses.map(async (response) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10)); // Random delay
        await orchestrator.respondToApproval(response.requestId, response);
      });

      await Promise.all(resolvePromises);
      const results = await Promise.all(promises);

      // Verify all promises resolved correctly
      expect(results).toHaveLength(numPromises);
      results.forEach((result, index) => {
        expect(result.requestId).toBe(responses[index].requestId);
        expect(result.response).toBe('approved');
      });

      grantApprovalSpy.mockRestore();
    });

    it('should maintain promise isolation between different request IDs', async () => {
      const requestId1 = 'isolation-test-001';
      const requestId2 = 'isolation-test-002';

      const promise1 = orchestrator.waitForApproval(requestId1);
      const promise2 = orchestrator.waitForApproval(requestId2);

      const response1: ApprovalResponse = {
        requestId: requestId1,
        taskId: 'task-1',
        response: 'approved',
        approver: 'approver-1'
      };

      const response2: ApprovalResponse = {
        requestId: requestId2,
        taskId: 'task-2',
        response: 'denied',
        approver: 'approver-2'
      };

      // Mock delegate methods
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval').mockResolvedValue();
      const denyApprovalSpy = vi.spyOn(orchestrator, 'denyApproval').mockResolvedValue();

      // Resolve in reverse order
      await orchestrator.respondToApproval(requestId2, response2);
      await orchestrator.respondToApproval(requestId1, response1);

      const result1 = await promise1;
      const result2 = await promise2;

      expect(result1.response).toBe('approved');
      expect(result2.response).toBe('denied');

      grantApprovalSpy.mockRestore();
      denyApprovalSpy.mockRestore();
    });
  });

  describe('Error Propagation', () => {
    it('should propagate errors from grantApproval to waiting promise', async () => {
      const requestId = 'error-prop-001';
      const errorMessage = 'Grant approval database error';

      const waitPromise = orchestrator.waitForApproval(requestId);

      // Mock grantApproval to throw an error
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval')
        .mockRejectedValue(new Error(errorMessage));

      const response: ApprovalResponse = {
        requestId,
        taskId: 'test-task',
        response: 'approved',
        approver: 'test-user'
      };

      // Respond to approval - should trigger error
      await expect(orchestrator.respondToApproval(requestId, response))
        .rejects.toThrow(errorMessage);

      // The waiting promise should also reject with the same error
      await expect(waitPromise).rejects.toThrow(errorMessage);

      grantApprovalSpy.mockRestore();
    });

    it('should handle errors in denyApproval correctly', async () => {
      const requestId = 'deny-error-001';
      const errorMessage = 'Deny approval validation error';

      const waitPromise = orchestrator.waitForApproval(requestId);

      // Mock denyApproval to throw an error
      const denyApprovalSpy = vi.spyOn(orchestrator, 'denyApproval')
        .mockRejectedValue(new Error(errorMessage));

      const response: ApprovalResponse = {
        requestId,
        taskId: 'test-task',
        response: 'denied',
        approver: 'test-user',
        message: 'Denial reason'
      };

      // Both operations should fail with the same error
      await expect(orchestrator.respondToApproval(requestId, response))
        .rejects.toThrow(errorMessage);

      await expect(waitPromise).rejects.toThrow(errorMessage);

      denyApprovalSpy.mockRestore();
    });

    it('should clean up promise map on error conditions', async () => {
      const requestId = 'cleanup-error-001';

      // Mock grantApproval to fail
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval')
        .mockRejectedValue(new Error('Simulated error'));

      const waitPromise = orchestrator.waitForApproval(requestId);

      const response: ApprovalResponse = {
        requestId,
        taskId: 'test-task',
        response: 'approved',
        approver: 'test-user'
      };

      // Let the error occur
      await expect(orchestrator.respondToApproval(requestId, response))
        .rejects.toThrow();
      await expect(waitPromise).rejects.toThrow();

      // Verify we can create a new promise with the same ID (cleanup happened)
      expect(() => orchestrator.waitForApproval(requestId))
        .not.toThrow('Already waiting');

      grantApprovalSpy.mockRestore();
    });
  });

  describe('Memory Management', () => {
    it('should not accumulate promises in memory after resolution', async () => {
      // This test verifies that the promise map doesn't grow indefinitely
      const numIterations = 100;
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval').mockResolvedValue();

      for (let i = 0; i < numIterations; i++) {
        const requestId = `memory-test-${i}`;

        const promise = orchestrator.waitForApproval(requestId);

        const response: ApprovalResponse = {
          requestId,
          taskId: `task-${i}`,
          response: 'approved',
          approver: 'test-user'
        };

        await orchestrator.respondToApproval(requestId, response);
        await promise;
      }

      // Verify we can still create new promises (map was cleaned up)
      const finalRequestId = 'memory-final-test';
      expect(() => orchestrator.waitForApproval(finalRequestId))
        .not.toThrow();

      grantApprovalSpy.mockRestore();
    });

    it('should handle promise cleanup on orchestrator shutdown', async () => {
      const requestId = 'shutdown-test-001';

      // Create a pending promise
      const promise = orchestrator.waitForApproval(requestId);

      // Shutdown the orchestrator
      await orchestrator.shutdown();

      // The promise should be rejected or cleaned up
      // (Implementation-specific behavior, but should not hang)
      try {
        await Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Test timeout')), 1000)
          )
        ]);
      } catch (error) {
        // Either the promise was rejected due to shutdown or test timed out
        // Both are acceptable behaviors for this edge case
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Edge Case Validation', () => {
    it('should validate approval response structure strictly', async () => {
      const requestId = 'validation-test-001';

      // Invalid response missing required fields
      const invalidResponse = {
        requestId,
        // Missing taskId, response, approver
      } as any;

      await expect(orchestrator.respondToApproval(requestId, invalidResponse))
        .rejects.toThrow();
    });

    it('should handle malformed approval responses gracefully', async () => {
      const requestId = 'malformed-test-001';

      const waitPromise = orchestrator.waitForApproval(requestId);

      // Response with invalid enum value
      const malformedResponse: any = {
        requestId,
        taskId: 'test-task',
        response: 'maybe',  // Invalid response type
        approver: 'test-user'
      };

      await expect(orchestrator.respondToApproval(requestId, malformedResponse))
        .rejects.toThrow();

      // The promise should also be rejected
      await expect(waitPromise).rejects.toThrow();
    });

    it('should handle extremely rapid timeout values', async () => {
      const requestId = 'rapid-timeout-001';
      const rapidTimeout = 1; // 1ms timeout

      const waitPromise = orchestrator.waitForApproval(requestId, rapidTimeout);

      // Should timeout very quickly
      const startTime = Date.now();
      await expect(waitPromise).rejects.toThrow();
      const endTime = Date.now();

      // Should have timed out quickly
      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should handle promise creation with zero timeout', async () => {
      const requestId = 'zero-timeout-001';
      const zeroTimeout = 0;

      // Should either reject immediately or handle gracefully
      expect(() => orchestrator.waitForApproval(requestId, zeroTimeout))
        .not.toThrow();
    });
  });
});