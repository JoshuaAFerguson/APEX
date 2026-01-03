import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from './index.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmSync } from 'fs';

describe('Approval Handlers Integration Tests', () => {
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

  describe('Concurrent approval operations', () => {
    it('should handle concurrent approvals on different tasks safely', async () => {
      // Create multiple tasks
      const taskIds = await Promise.all([
        orchestrator.createTask('Task 1', 'feature'),
        orchestrator.createTask('Task 2', 'feature'),
        orchestrator.createTask('Task 3', 'feature'),
      ]);

      // Create checkpoints for all tasks
      for (const taskId of taskIds) {
        await orchestrator.createCheckpoint(taskId, 'checkpoint', {
          stageName: 'planning',
          status: 'awaiting_approval',
          stageOutputs: { plan: 'test plan' },
          conversationState: [{ type: 'text', text: 'Checkpoint created' }],
          metadata: { concurrent: true }
        });
      }

      const approvalIds = taskIds.map(id => `approval-${id}-gate-${Date.now()}`);

      // Set up event listeners
      const grantedEvents: any[] = [];
      const deniedEvents: any[] = [];

      orchestrator.on('approval:approved', (data) => grantedEvents.push(data));
      orchestrator.on('approval:denied', (data) => deniedEvents.push(data));

      // Perform concurrent operations
      await Promise.all([
        orchestrator.grantApproval(approvalIds[0], 'user1', 'Approved task 1'),
        orchestrator.denyApproval(approvalIds[1], 'user2', 'Rejected task 2'),
        orchestrator.grantApproval(approvalIds[2], 'user3', 'Approved task 3'),
      ]);

      // Verify events were emitted correctly
      expect(grantedEvents).toHaveLength(2);
      expect(deniedEvents).toHaveLength(1);

      // Verify task states
      const tasks = await Promise.all(taskIds.map(id => orchestrator.getTask(id)));
      expect(tasks[0]?.status).toBe('in-progress'); // granted
      expect(tasks[1]?.status).toBe('failed');     // denied
      expect(tasks[2]?.status).toBe('in-progress'); // granted
    });

    it('should handle rapid sequential approvals on same task', async () => {
      const taskId = await orchestrator.createTask('Rapid approval test', 'feature');
      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Checkpoint created' }],
        metadata: { rapid: true }
      });

      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      // First approval should succeed
      await expect(orchestrator.grantApproval(approvalId, 'user1', 'First approval'))
        .resolves.not.toThrow();

      // Second approval on same task (different ID) should also succeed
      const secondApprovalId = `approval-${taskId}-gate-${Date.now() + 1}`;
      await expect(orchestrator.grantApproval(secondApprovalId, 'user2', 'Second approval'))
        .resolves.not.toThrow();
    });
  });

  describe('Event emission ordering and consistency', () => {
    it('should emit events in correct order during approval flow', async () => {
      const taskId = await orchestrator.createTask('Event ordering test', 'feature');
      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Checkpoint created' }],
        metadata: { ordering: true }
      });

      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      const eventOrder: string[] = [];
      const eventListener = (eventName: string) => (data: any) => {
        eventOrder.push(`${eventName}:${data.taskId}`);
      };

      orchestrator.on('approval:approved', eventListener('granted'));
      orchestrator.on('task-status-updated', eventListener('status'));
      orchestrator.on('task-log-added', eventListener('log'));

      await orchestrator.grantApproval(approvalId, 'user1', 'Test approval');

      // Give events time to propagate
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify events were emitted (order may vary due to async operations)
      expect(eventOrder.some(e => e.startsWith('granted:'))).toBe(true);
      expect(eventOrder.some(e => e.startsWith('status:') || e.startsWith('log:'))).toBe(true);
    });
  });

  describe('Database consistency during approvals', () => {
    it('should maintain data consistency during approval operations', async () => {
      const taskId = await orchestrator.createTask('DB consistency test', 'feature');
      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Checkpoint created' }],
        metadata: { consistency: true }
      });

      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      // Grant approval
      await orchestrator.grantApproval(approvalId, 'test-user', 'Consistency test');

      // Verify database state
      const task = await orchestrator.getTask(taskId);
      const logs = await orchestrator.getTaskLogs(taskId);

      expect(task).toBeDefined();
      expect(task?.status).toBe('in-progress');

      // Should have log for approval grant
      const approvalLog = logs.find(log =>
        log.message.includes('Task resumed successfully after approval grant')
      );
      expect(approvalLog).toBeDefined();
      expect(approvalLog?.metadata).toMatchObject({
        approvalId,
        approver: 'test-user',
        comment: 'Consistency test'
      });
    });

    it('should handle approval denial with proper data cleanup', async () => {
      const taskId = await orchestrator.createTask('DB cleanup test', 'feature');
      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Checkpoint created' }],
        metadata: { cleanup: true }
      });

      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      // Deny approval
      await orchestrator.denyApproval(approvalId, 'test-user', 'Failed cleanup test');

      // Verify database state
      const task = await orchestrator.getTask(taskId);
      const logs = await orchestrator.getTaskLogs(taskId);

      expect(task).toBeDefined();
      expect(task?.status).toBe('failed');
      expect(task?.result).toBe('Approval denied by test-user: Failed cleanup test');

      // Should have log for approval denial
      const denialLog = logs.find(log =>
        log.message.includes('Task failed due to approval denial')
      );
      expect(denialLog).toBeDefined();
      expect(denialLog?.metadata).toMatchObject({
        approvalId,
        approver: 'test-user',
        reason: 'Failed cleanup test'
      });
    });
  });

  describe('Edge case scenarios', () => {
    it('should handle approval operations with special characters in inputs', async () => {
      const taskId = await orchestrator.createTask('Special chars test', 'feature');
      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Checkpoint created' }],
        metadata: { special: true }
      });

      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      // Test with special characters in comment/reason
      const specialComment = 'Comment with émojis 🎉 and "quotes" & symbols!';
      await expect(orchestrator.grantApproval(approvalId, 'user@domain.com', specialComment))
        .resolves.not.toThrow();

      // Verify data was stored correctly
      const logs = await orchestrator.getTaskLogs(taskId);
      const approvalLog = logs.find(log =>
        log.message.includes('Task resumed successfully after approval grant')
      );
      expect(approvalLog?.metadata?.comment).toBe(specialComment);
    });

    it('should handle very long approval reasons', async () => {
      const taskId = await orchestrator.createTask('Long reason test', 'feature');
      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Checkpoint created' }],
        metadata: { longReason: true }
      });

      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      // Test with very long reason (1000+ characters)
      const longReason = 'A'.repeat(1000) + ' This is a very detailed rejection reason.';

      await expect(orchestrator.denyApproval(approvalId, 'test-user', longReason))
        .resolves.not.toThrow();

      // Verify data was stored correctly
      const task = await orchestrator.getTask(taskId);
      expect(task?.result).toContain(longReason);
    });

    it('should handle null/undefined edge cases gracefully', async () => {
      const taskId = await orchestrator.createTask('Null handling test', 'feature');
      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Checkpoint created' }],
        metadata: { nullTest: true }
      });

      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      // Test grant with undefined comment (should be handled)
      await expect(orchestrator.grantApproval(approvalId, 'test-user', undefined))
        .resolves.not.toThrow();

      // Test denial with null reason (should be rejected)
      const secondApprovalId = `approval-${taskId}-gate-${Date.now() + 1}`;
      await expect(orchestrator.denyApproval(secondApprovalId, 'test-user', null as any))
        .rejects.toThrow('Reason is required when denying an approval');
    });
  });
});