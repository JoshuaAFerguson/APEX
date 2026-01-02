import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { ApexOrchestrator } from './index.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmSync } from 'fs';

describe('Approval Handlers - Edge Cases', () => {
  let orchestrator: ApexOrchestrator;
  let testDir: string;

  beforeEach(async () => {
    // Create a unique test directory for each test
    testDir = join(tmpdir(), `apex-test-${Date.now()}-${Math.random()}`);
    mkdirSync(testDir, { recursive: true });

    // Initialize orchestrator with test directory
    orchestrator = new ApexOrchestrator({
      dataDir: testDir,
      claudeApiKey: 'test-key',
    });

    await orchestrator.ensureInitialized();
  });

  afterEach(() => {
    // Cleanup test directory
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle database errors during approval gracefully', async () => {
      const taskId = await orchestrator.createTask('DB Error Test', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      // Mock database error temporarily
      const originalGetTask = orchestrator.store.getTask;
      orchestrator.store.getTask = vi.fn().mockRejectedValueOnce(new Error('Database connection failed'));

      try {
        await expect(orchestrator.grantApproval(approvalId, 'tester', 'test'))
          .rejects.toThrow('Database connection failed');
      } finally {
        // Restore original method
        orchestrator.store.getTask = originalGetTask;
      }

      // Verify system can recover and process subsequent approvals
      await expect(orchestrator.grantApproval(approvalId, 'tester', 'recovery test'))
        .resolves.not.toThrow();
    });

    it('should handle event emission failures without breaking the approval process', async () => {
      const taskId = await orchestrator.createTask('Event Error Test', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      // Add a listener that throws an error
      const errorListener = vi.fn().mockImplementation(() => {
        throw new Error('Event handler failed');
      });
      orchestrator.on('approval-granted', errorListener);

      // The approval should still complete despite listener error
      await expect(orchestrator.grantApproval(approvalId, 'tester', 'event error test'))
        .resolves.not.toThrow();

      // Verify the task status was still updated
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('in-progress');
    });
  });

  describe('Boundary Value Testing', () => {
    it('should handle approval IDs at maximum reasonable length', async () => {
      const longTaskId = 'a'.repeat(200); // Very long task ID
      const approvalId = `approval-${longTaskId}-gate-${Date.now()}`;

      // This should fail gracefully for non-existent task
      await expect(orchestrator.grantApproval(approvalId, 'tester', 'long id test'))
        .rejects.toThrow(/Task not found for approval/);
    });

    it('should handle minimum length approval ID components', async () => {
      const taskId = await orchestrator.createTask('Min Length Test', 'feature');

      // Test with minimal but valid approval ID format
      const minimalApprovalId = `approval-${taskId}-g-1`;

      await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      await expect(orchestrator.grantApproval(minimalApprovalId, 'tester', 'minimal test'))
        .resolves.not.toThrow();
    });

    it('should handle zero-length and whitespace-only inputs appropriately', async () => {
      const taskId = await orchestrator.createTask('Whitespace Test', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      // Test empty approver
      await expect(orchestrator.grantApproval(approvalId, '', 'test'))
        .resolves.not.toThrow(); // Should accept empty approver

      // Test whitespace-only approver
      const secondTaskId = await orchestrator.createTask('Whitespace Test 2', 'feature');
      const secondApprovalId = `approval-${secondTaskId}-gate-${Date.now() + 1}`;

      await orchestrator.createCheckpoint(secondTaskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      await expect(orchestrator.grantApproval(secondApprovalId, '   ', 'test'))
        .resolves.not.toThrow();

      // Test whitespace-only denial reason (should fail)
      const thirdTaskId = await orchestrator.createTask('Whitespace Test 3', 'feature');
      const thirdApprovalId = `approval-${thirdTaskId}-gate-${Date.now() + 2}`;

      await expect(orchestrator.denyApproval(thirdApprovalId, 'tester', '   '))
        .rejects.toThrow('Reason is required when denying an approval');
    });
  });

  describe('State Consistency Under Exceptional Conditions', () => {
    it('should maintain consistency when approving already completed tasks', async () => {
      const taskId = await orchestrator.createTask('Completed Task Test', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      // Mark task as completed first
      await orchestrator.updateTask(taskId, { status: 'completed', result: 'Task completed successfully' });

      // Now try to grant approval
      await expect(orchestrator.grantApproval(approvalId, 'late-approver', 'Late approval'))
        .resolves.not.toThrow();

      // Verify final state - should still be approved since task exists
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('in-progress'); // Should be overridden by approval
    });

    it('should handle denial of already failed tasks appropriately', async () => {
      const taskId = await orchestrator.createTask('Failed Task Test', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      // Mark task as failed first
      await orchestrator.updateTask(taskId, { status: 'failed', result: 'Task failed for other reasons' });

      // Now try to deny approval
      await expect(orchestrator.denyApproval(approvalId, 'late-denier', 'Late denial'))
        .resolves.not.toThrow();

      // Verify the denial reason overwrites the previous failure reason
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.result).toBe('Approval denied by late-denier: Late denial');
    });
  });

  describe('Event Emission Edge Cases', () => {
    it('should emit events with correct timestamps across different timezones', async () => {
      const taskId = await orchestrator.createTask('Timezone Test', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      const eventSpy = vi.fn();
      orchestrator.on('approval-granted', eventSpy);

      const beforeApproval = new Date();
      await orchestrator.grantApproval(approvalId, 'timezone-tester', 'Timezone test');
      const afterApproval = new Date();

      expect(eventSpy).toHaveBeenCalled();
      const emittedEvent = eventSpy.mock.calls[0][0];

      // Verify timestamp is within reasonable bounds
      expect(emittedEvent.timestamp).toBeInstanceOf(Date);
      expect(emittedEvent.timestamp.getTime()).toBeGreaterThanOrEqual(beforeApproval.getTime());
      expect(emittedEvent.timestamp.getTime()).toBeLessThanOrEqual(afterApproval.getTime());
    });

    it('should handle multiple concurrent event listeners without interference', async () => {
      const taskId = await orchestrator.createTask('Multi-listener Test', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      // Add multiple listeners
      const listeners = Array.from({ length: 5 }, () => vi.fn());
      listeners.forEach((listener, index) => {
        orchestrator.on('approval-granted', (data) => {
          listener(data, index);
        });
      });

      await orchestrator.grantApproval(approvalId, 'multi-listener-test', 'Multi listener test');

      // Verify all listeners received the event
      listeners.forEach((listener, index) => {
        expect(listener).toHaveBeenCalledWith(
          expect.objectContaining({
            approvalId,
            taskId,
            approver: 'multi-listener-test',
            comment: 'Multi listener test'
          }),
          index
        );
      });
    });
  });

  describe('Data Integrity and Persistence', () => {
    it('should persist approval decisions across orchestrator restarts', async () => {
      let taskId: string;
      let approvalId: string;

      {
        // Create task and approval with first orchestrator instance
        const firstOrchestrator = new ApexOrchestrator({
          dataDir: testDir,
          claudeApiKey: 'test-key',
        });
        await firstOrchestrator.ensureInitialized();

        taskId = await firstOrchestrator.createTask('Persistence Test', 'feature');
        approvalId = `approval-${taskId}-gate-${Date.now()}`;

        await firstOrchestrator.createCheckpoint(taskId, 'test-checkpoint', {
          stageName: 'planning',
          status: 'awaiting_approval',
          stageOutputs: { plan: 'test plan' },
          conversationState: [{ type: 'text', text: 'Planning complete' }],
          metadata: { test: true }
        });

        await firstOrchestrator.grantApproval(approvalId, 'persistent-tester', 'Persistence test');

        // Verify initial state
        const task = await firstOrchestrator.getTask(taskId);
        expect(task?.status).toBe('in-progress');
      }

      {
        // Create new orchestrator instance and verify state persisted
        const secondOrchestrator = new ApexOrchestrator({
          dataDir: testDir,
          claudeApiKey: 'test-key',
        });
        await secondOrchestrator.ensureInitialized();

        const task = await secondOrchestrator.getTask(taskId);
        expect(task?.status).toBe('in-progress');

        // Verify logs persisted too
        const logs = await secondOrchestrator.getTaskLogs(taskId);
        const approvalLog = logs.find(log =>
          log.message.includes('Task resumed successfully after approval grant')
        );
        expect(approvalLog).toBeDefined();
        expect(approvalLog?.metadata?.approver).toBe('persistent-tester');
      }
    });

    it('should handle corrupted approval ID formats gracefully', async () => {
      const corruptedIds = [
        'approval-\u0000-gate-123', // null byte
        'approval-\uFEFF-gate-123', // BOM character
        'approval-task\nid-gate-123', // newline
        'approval-task\tid-gate-123', // tab
        'approval-task id-gate-123', // space (might be valid depending on implementation)
        'approval-𝕥𝕒𝕤𝕜-gate-123', // mathematical alphanumeric symbols
      ];

      for (const corruptedId of corruptedIds) {
        // Most should fail gracefully with format error
        try {
          await orchestrator.grantApproval(corruptedId, 'tester', 'corruption test');

          // If it doesn't throw, it should at least fail on task not found
          // (since these are not real task IDs)
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toMatch(/Invalid approval ID format|Task not found/);
        }
      }
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during repeated approval operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many approval operations
      const operations = 100;
      for (let i = 0; i < operations; i++) {
        const taskId = await orchestrator.createTask(`Memory Test ${i}`, 'feature');
        const approvalId = `approval-${taskId}-gate-${Date.now() + i}`;

        await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
          stageName: 'planning',
          status: 'awaiting_approval',
          stageOutputs: { plan: `test plan ${i}` },
          conversationState: [{ type: 'text', text: 'Planning complete' }],
          metadata: { memoryTest: true, iteration: i }
        });

        if (i % 2 === 0) {
          await orchestrator.grantApproval(approvalId, `approver-${i}`, `approval ${i}`);
        } else {
          await orchestrator.denyApproval(approvalId, `denier-${i}`, `denial ${i}`);
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const finalMemory = process.memoryUsage();

      // Memory usage should not increase dramatically (allowing for some variance)
      const heapIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const heapIncreasePerOperation = heapIncrease / operations;

      // Each operation should use less than 1MB on average (very generous bound)
      expect(heapIncreasePerOperation).toBeLessThan(1024 * 1024);
    }, 30000); // Increase timeout for this test

    it('should clean up event listeners properly', async () => {
      const taskId = await orchestrator.createTask('Cleanup Test', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      // Add and remove many listeners
      const listeners = Array.from({ length: 50 }, () => vi.fn());

      listeners.forEach(listener => {
        orchestrator.on('approval-granted', listener);
      });

      // Check listener count (if accessible)
      const initialListenerCount = orchestrator.listenerCount('approval-granted');
      expect(initialListenerCount).toBe(listeners.length);

      // Remove all listeners
      listeners.forEach(listener => {
        orchestrator.off('approval-granted', listener);
      });

      const finalListenerCount = orchestrator.listenerCount('approval-granted');
      expect(finalListenerCount).toBe(0);

      // Verify no listeners are called after removal
      await orchestrator.grantApproval(approvalId, 'cleanup-tester', 'cleanup test');

      listeners.forEach(listener => {
        expect(listener).not.toHaveBeenCalled();
      });
    });
  });
});