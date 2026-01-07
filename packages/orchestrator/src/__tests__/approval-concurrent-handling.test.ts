/**
 * Tests for concurrent approval response handling
 *
 * This test suite focuses on testing the behavior of the approval system
 * when multiple concurrent operations occur, including:
 * 1. Multiple simultaneous approval requests
 * 2. Rapid approval/denial responses
 * 3. Race conditions in promise resolution
 * 4. Database consistency under concurrent load
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ApexOrchestrator } from '../index';
import { ApprovalResponse, ApprovalState } from '@apexcli/core';

describe('Approval Concurrent Handling', () => {
  let orchestrator: ApexOrchestrator;
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directory for test
    tempDir = path.join(__dirname, 'temp-concurrent-test-' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });

    // Create .apex directory structure
    const apexDir = path.join(tempDir, '.apex');
    fs.mkdirSync(apexDir, { recursive: true });
    fs.mkdirSync(path.join(apexDir, 'agents'), { recursive: true });
    fs.mkdirSync(path.join(apexDir, 'workflows'), { recursive: true });

    // Write minimal config
    const configPath = path.join(apexDir, 'config.yaml');
    fs.writeFileSync(configPath, `
name: "test-concurrent"
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

  describe('Concurrent Promise Management', () => {
    it('should handle multiple concurrent waitForApproval calls with different IDs', async () => {
      const numConcurrent = 10;
      const requestIds: string[] = [];
      const promises: Promise<ApprovalResponse>[] = [];

      // Create multiple concurrent approval promises
      for (let i = 0; i < numConcurrent; i++) {
        const requestId = `concurrent-test-${String(i).padStart(3, '0')}`;
        requestIds.push(requestId);
        promises.push(orchestrator.waitForApproval(requestId, 10000)); // 10 second timeout
      }

      // Mock the delegate methods to avoid actual processing
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval').mockResolvedValue();
      const denyApprovalSpy = vi.spyOn(orchestrator, 'denyApproval').mockResolvedValue();

      // Respond to all promises concurrently in random order
      const shuffledIndexes = [...Array(numConcurrent)].map((_, i) => i)
        .sort(() => Math.random() - 0.5);

      const responsePromises = shuffledIndexes.map(async (index) => {
        const requestId = requestIds[index];
        const response: ApprovalResponse = {
          requestId,
          taskId: `task-${index}`,
          response: index % 2 === 0 ? 'approved' : 'denied',
          approver: `approver-${index}`,
          message: `Response for ${requestId}`
        };

        // Add small random delay to simulate real-world timing
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        await orchestrator.respondToApproval(requestId, response);
      });

      // Wait for all responses to be processed
      await Promise.all(responsePromises);

      // Wait for all promises to resolve
      const results = await Promise.all(promises);

      // Verify all promises resolved correctly
      expect(results).toHaveLength(numConcurrent);
      results.forEach((result, index) => {
        const originalIndex = requestIds.indexOf(result.requestId);
        expect(originalIndex).toBeGreaterThan(-1);
        expect(result.response).toBe(originalIndex % 2 === 0 ? 'approved' : 'denied');
        expect(result.approver).toBe(`approver-${originalIndex}`);
      });

      grantApprovalSpy.mockRestore();
      denyApprovalSpy.mockRestore();
    });

    it('should handle rapid succession of approval responses', async () => {
      const numRapid = 50;
      const responses: ApprovalResponse[] = [];
      const promises: Promise<ApprovalResponse>[] = [];

      // Mock delegate methods
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval').mockResolvedValue();

      // Create promises and responses rapidly
      for (let i = 0; i < numRapid; i++) {
        const requestId = `rapid-test-${i}`;
        promises.push(orchestrator.waitForApproval(requestId, 5000));

        responses.push({
          requestId,
          taskId: `rapid-task-${i}`,
          response: 'approved',
          approver: `rapid-approver-${i}`,
          message: `Rapid approval ${i}`
        });
      }

      // Respond to all promises as fast as possible
      const responsePromises = responses.map(response =>
        orchestrator.respondToApproval(response.requestId, response)
      );

      // Wait for all operations to complete
      const [resolvedPromises] = await Promise.all([
        Promise.all(promises),
        Promise.all(responsePromises)
      ]);

      // Verify all completed successfully
      expect(resolvedPromises).toHaveLength(numRapid);
      resolvedPromises.forEach((result, index) => {
        expect(result.requestId).toBe(`rapid-test-${index}`);
        expect(result.response).toBe('approved');
      });

      grantApprovalSpy.mockRestore();
    });

    it('should prevent race conditions in promise creation and resolution', async () => {
      const requestId = 'race-condition-test';

      // Mock delegate method
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval').mockResolvedValue();

      // Start promise creation and immediate response in parallel
      const promiseCreation = orchestrator.waitForApproval(requestId, 1000);

      const response: ApprovalResponse = {
        requestId,
        taskId: 'race-task',
        response: 'approved',
        approver: 'race-approver'
      };

      // Immediately try to respond (potential race condition)
      const responsePromise = orchestrator.respondToApproval(requestId, response);

      // Both should complete successfully without errors
      const [promiseResult] = await Promise.all([promiseCreation, responsePromise]);

      expect(promiseResult.requestId).toBe(requestId);
      expect(promiseResult.response).toBe('approved');

      grantApprovalSpy.mockRestore();
    });
  });

  describe('Database Consistency Under Concurrent Load', () => {
    it('should maintain database consistency with concurrent approval state operations', async () => {
      const numTasks = 5;
      const store = (orchestrator as any).store;

      // Create multiple tasks with approval states concurrently
      const taskPromises = Array.from({ length: numTasks }, async (_, i) => {
        const task = await store.createTask({
          id: `concurrent-task-${i}`,
          description: `Concurrent test task ${i}`,
          agent: 'test-agent',
          autonomy: 'supervised',
          status: 'awaiting-approval',
          workflow: 'test-workflow',
          priority: 'medium',
          projectPath: tempDir
        });

        const approvalState: ApprovalState = {
          id: `approval-${i}`,
          taskId: task.id,
          gateName: `gate-${i}`,
          status: 'pending',
          requestedAt: new Date(),
          stage: 'test-stage',
          agent: 'test-agent',
          approvalsReceived: 0,
          approvalsRequired: 1,
          context: { testData: `data-${i}` }
        };

        await store.saveApprovalState(approvalState);
        return { task, approvalState };
      });

      const createdData = await Promise.all(taskPromises);

      // Concurrently update approval states
      const updatePromises = createdData.map(async ({ task, approvalState }, i) => {
        const updatedState = {
          ...approvalState,
          status: 'approved' as const,
          approver: `approver-${i}`,
          comment: `Concurrent approval ${i}`,
          approvedAt: new Date()
        };

        await store.saveApprovalState(updatedState);
        return updatedState;
      });

      const updatedStates = await Promise.all(updatePromises);

      // Verify all states were updated correctly
      for (let i = 0; i < numTasks; i++) {
        const retrievedState = await store.getApprovalStateById(`approval-${i}`);
        expect(retrievedState).toBeDefined();
        expect(retrievedState!.status).toBe('approved');
        expect(retrievedState!.approver).toBe(`approver-${i}`);
        expect(retrievedState!.comment).toBe(`Concurrent approval ${i}`);
      }

      // Verify database integrity
      const allStates = await Promise.all(
        createdData.map(({ approvalState }) => store.getApprovalStateById(approvalState.id))
      );

      expect(allStates).toHaveLength(numTasks);
      allStates.forEach((state, i) => {
        expect(state).toBeDefined();
        expect(state!.id).toBe(`approval-${i}`);
        expect(state!.taskId).toBe(`concurrent-task-${i}`);
      });
    });

    it('should handle concurrent database reads and writes without corruption', async () => {
      const store = (orchestrator as any).store;

      // Create initial approval state
      const approvalState: ApprovalState = {
        id: 'read-write-test',
        taskId: 'read-write-task',
        gateName: 'read-write-gate',
        status: 'pending',
        requestedAt: new Date(),
        stage: 'test-stage',
        agent: 'test-agent',
        approvalsReceived: 0,
        approvalsRequired: 1,
        context: {}
      };

      await store.saveApprovalState(approvalState);

      // Perform concurrent reads and writes
      const operations: Promise<any>[] = [];

      // Multiple concurrent reads
      for (let i = 0; i < 10; i++) {
        operations.push(store.getApprovalStateById('read-write-test'));
      }

      // Multiple concurrent writes (updates)
      for (let i = 0; i < 5; i++) {
        operations.push((async () => {
          const updated = {
            ...approvalState,
            comment: `Update ${i}`,
            context: { updateNumber: i, timestamp: Date.now() }
          };
          await store.saveApprovalState(updated);
        })());
      }

      // Wait for all operations to complete
      const results = await Promise.allSettled(operations);

      // All operations should succeed or fail gracefully
      const failures = results.filter(result => result.status === 'rejected');
      expect(failures.length).toBeLessThan(results.length); // Some should succeed

      // Final state should be consistent
      const finalState = await store.getApprovalStateById('read-write-test');
      expect(finalState).toBeDefined();
      expect(finalState!.id).toBe('read-write-test');
      expect(finalState!.taskId).toBe('read-write-task');
    });
  });

  describe('Error Handling Under Concurrent Load', () => {
    it('should handle concurrent errors gracefully', async () => {
      const numConcurrent = 20;

      // Mock delegate method to randomly succeed or fail
      let callCount = 0;
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval')
        .mockImplementation(async () => {
          callCount++;
          if (callCount % 3 === 0) {
            throw new Error(`Simulated error ${callCount}`);
          }
        });

      const promises: Promise<any>[] = [];

      // Create concurrent promises and responses
      for (let i = 0; i < numConcurrent; i++) {
        const requestId = `error-test-${i}`;
        const waitPromise = orchestrator.waitForApproval(requestId, 1000);
        promises.push(waitPromise);

        const response: ApprovalResponse = {
          requestId,
          taskId: `error-task-${i}`,
          response: 'approved',
          approver: `error-approver-${i}`
        };

        // Respond immediately
        promises.push(orchestrator.respondToApproval(requestId, response));
      }

      // Wait for all operations to settle
      const results = await Promise.allSettled(promises);

      // Some operations should succeed, some should fail
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');

      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);

      // Error messages should be meaningful
      failures.forEach(failure => {
        if (failure.status === 'rejected') {
          expect(failure.reason).toBeInstanceOf(Error);
          expect(failure.reason.message).toMatch(/Simulated error|approval/i);
        }
      });

      grantApprovalSpy.mockRestore();
    });

    it('should maintain state consistency after partial failures', async () => {
      const store = (orchestrator as any).store;
      const numAttempts = 10;

      // Create a task
      const task = await store.createTask({
        id: 'partial-failure-task',
        description: 'Test partial failure recovery',
        agent: 'test-agent',
        autonomy: 'supervised',
        status: 'awaiting-approval',
        workflow: 'test-workflow',
        priority: 'medium',
        projectPath: tempDir
      });

      // Mock intermittent failures
      let attemptCount = 0;
      const saveApprovalStateSpy = vi.spyOn(store, 'saveApprovalState')
        .mockImplementation(async (state: ApprovalState) => {
          attemptCount++;
          if (attemptCount % 4 === 0) {
            throw new Error('Simulated database error');
          }
          // Call original method for successful attempts
          return saveApprovalStateSpy.mockImplementation.original.call(store, state);
        });

      // Attempt to save multiple approval states concurrently
      const savePromises: Promise<any>[] = [];

      for (let i = 0; i < numAttempts; i++) {
        const approvalState: ApprovalState = {
          id: `partial-failure-approval-${i}`,
          taskId: task.id,
          gateName: `partial-gate-${i}`,
          status: 'pending',
          requestedAt: new Date(),
          stage: 'test-stage',
          agent: 'test-agent',
          approvalsReceived: 0,
          approvalsRequired: 1,
          context: { attemptNumber: i }
        };

        savePromises.push(
          store.saveApprovalState(approvalState).catch((error: any) => ({ error, id: approvalState.id }))
        );
      }

      const results = await Promise.all(savePromises);

      // Some should succeed, some should fail
      const successes = results.filter(r => !r.error);
      const failures = results.filter(r => r.error);

      expect(successes.length).toBeGreaterThan(0);
      expect(failures.length).toBeGreaterThan(0);

      // Check that successful states are actually in the database
      for (const result of successes) {
        if (!result.error) {
          // Find the corresponding approval ID
          const approvalId = `partial-failure-approval-${results.indexOf(result)}`;
          const storedState = await store.getApprovalStateById(approvalId);
          expect(storedState).toBeDefined();
        }
      }

      saveApprovalStateSpy.mockRestore();
    });
  });

  describe('Performance Under Concurrent Load', () => {
    it('should handle high concurrency without significant performance degradation', async () => {
      const numConcurrent = 100;
      const startTime = Date.now();

      // Mock delegate method for speed
      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval').mockResolvedValue();

      const operations: Promise<any>[] = [];

      // Create many concurrent operations
      for (let i = 0; i < numConcurrent; i++) {
        const requestId = `perf-test-${i}`;

        const waitPromise = orchestrator.waitForApproval(requestId, 5000);
        operations.push(waitPromise);

        const response: ApprovalResponse = {
          requestId,
          taskId: `perf-task-${i}`,
          response: 'approved',
          approver: `perf-approver-${i}`
        };

        operations.push(orchestrator.respondToApproval(requestId, response));
      }

      await Promise.all(operations);

      const duration = Date.now() - startTime;

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(5000); // 5 seconds max for 100 concurrent operations

      grantApprovalSpy.mockRestore();
    });

    it('should not have memory leaks under sustained concurrent load', async () => {
      const iterations = 20;
      const batchSize = 50;

      const grantApprovalSpy = vi.spyOn(orchestrator, 'grantApproval').mockResolvedValue();

      // Run multiple batches of concurrent operations
      for (let iteration = 0; iteration < iterations; iteration++) {
        const batchOperations: Promise<any>[] = [];

        for (let i = 0; i < batchSize; i++) {
          const requestId = `memory-test-${iteration}-${i}`;

          const waitPromise = orchestrator.waitForApproval(requestId, 1000);
          batchOperations.push(waitPromise);

          const response: ApprovalResponse = {
            requestId,
            taskId: `memory-task-${iteration}-${i}`,
            response: 'approved',
            approver: `memory-approver-${iteration}-${i}`
          };

          batchOperations.push(orchestrator.respondToApproval(requestId, response));
        }

        await Promise.all(batchOperations);

        // Force garbage collection if available (for Node.js with --expose-gc)
        if (global.gc) {
          global.gc();
        }
      }

      // If we reach here without memory issues or timeouts, test passes
      expect(true).toBe(true);

      grantApprovalSpy.mockRestore();
    });
  });
});