import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from './index.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmSync } from 'fs';

describe('Approval Handlers - Comprehensive Test Suite', () => {
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

  describe('Acceptance Criteria Verification', () => {
    describe('AC1: Orchestrator has grantApproval(approvalId, approver, comment) method', () => {
      it('should have grantApproval method with correct signature', () => {
        expect(orchestrator.grantApproval).toBeDefined();
        expect(typeof orchestrator.grantApproval).toBe('function');

        // Verify the method accepts the expected parameters
        const method = orchestrator.grantApproval;
        expect(method.length).toBe(3); // approvalId, approver, comment (optional)
      });

      it('should accept all required parameters and optional comment', async () => {
        const taskId = await orchestrator.createTask('AC1 Test Task', 'feature');
        const approvalId = `approval-${taskId}-gate-${Date.now()}`;

        await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
          stageName: 'planning',
          status: 'awaiting_approval',
          stageOutputs: { plan: 'test plan' },
          conversationState: [{ type: 'text', text: 'Planning complete' }],
          metadata: { test: true }
        });

        // Test with comment
        await expect(orchestrator.grantApproval(approvalId, 'test-approver', 'Looks good'))
          .resolves.not.toThrow();

        // Test without comment
        const secondTaskId = await orchestrator.createTask('AC1 Test Task 2', 'feature');
        const secondApprovalId = `approval-${secondTaskId}-gate-${Date.now() + 1}`;

        await orchestrator.createCheckpoint(secondTaskId, 'test-checkpoint', {
          stageName: 'planning',
          status: 'awaiting_approval',
          stageOutputs: { plan: 'test plan' },
          conversationState: [{ type: 'text', text: 'Planning complete' }],
          metadata: { test: true }
        });

        await expect(orchestrator.grantApproval(secondApprovalId, 'test-approver'))
          .resolves.not.toThrow();
      });
    });

    describe('AC2: Orchestrator has denyApproval(approvalId, approver, reason) method', () => {
      it('should have denyApproval method with correct signature', () => {
        expect(orchestrator.denyApproval).toBeDefined();
        expect(typeof orchestrator.denyApproval).toBe('function');

        // Verify the method accepts the expected parameters
        const method = orchestrator.denyApproval;
        expect(method.length).toBe(3); // approvalId, approver, reason (required)
      });

      it('should require all parameters including reason', async () => {
        const taskId = await orchestrator.createTask('AC2 Test Task', 'feature');
        const approvalId = `approval-${taskId}-gate-${Date.now()}`;

        await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
          stageName: 'planning',
          status: 'awaiting_approval',
          stageOutputs: { plan: 'test plan' },
          conversationState: [{ type: 'text', text: 'Planning complete' }],
          metadata: { test: true }
        });

        // Test with valid reason
        await expect(orchestrator.denyApproval(approvalId, 'test-approver', 'Not ready yet'))
          .resolves.not.toThrow();

        // Test without reason should fail
        const secondTaskId = await orchestrator.createTask('AC2 Test Task 2', 'feature');
        const secondApprovalId = `approval-${secondTaskId}-gate-${Date.now() + 1}`;

        await expect(orchestrator.denyApproval(secondApprovalId, 'test-approver', ''))
          .rejects.toThrow('Reason is required when denying an approval');
      });
    });

    describe('AC3: On granted - task resumes from checkpoint, status restored to running', () => {
      it('should resume task from checkpoint and restore status to in-progress', async () => {
        const taskId = await orchestrator.createTask('AC3 Test Task', 'feature');
        const approvalId = `approval-${taskId}-gate-${Date.now()}`;

        // Set initial task status to paused (simulating awaiting approval)
        await orchestrator.updateTask(taskId, { status: 'paused' });

        // Create checkpoint
        await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
          stageName: 'planning',
          status: 'awaiting_approval',
          stageOutputs: { plan: 'test plan' },
          conversationState: [{ type: 'text', text: 'Planning complete' }],
          metadata: { test: true }
        });

        // Grant approval
        await orchestrator.grantApproval(approvalId, 'test-approver', 'Approved for AC3');

        // Verify task status was restored to in-progress
        const task = await orchestrator.getTask(taskId);
        expect(task?.status).toBe('in-progress');

        // Verify logs indicate successful resume
        const logs = await orchestrator.getTaskLogs(taskId);
        const resumeLog = logs.find(log =>
          log.message.includes('Task resumed successfully after approval grant')
        );
        expect(resumeLog).toBeDefined();
        expect(resumeLog?.metadata).toMatchObject({
          approvalId,
          approver: 'test-approver',
          comment: 'Approved for AC3'
        });
      });

      it('should handle resuming when no checkpoint is available', async () => {
        const taskId = await orchestrator.createTask('AC3 No Checkpoint Task', 'feature');
        const approvalId = `approval-${taskId}-gate-${Date.now()}`;

        // Don't create a checkpoint, just grant approval
        await orchestrator.grantApproval(approvalId, 'test-approver', 'No checkpoint test');

        // Verify warning log was created
        const logs = await orchestrator.getTaskLogs(taskId);
        const warningLog = logs.find(log =>
          log.message.includes('Failed to resume task after approval grant: no checkpoint available')
        );
        expect(warningLog).toBeDefined();
      });
    });

    describe('AC4: On denied - task status set to failed, denial reason stored', () => {
      it('should set task status to failed and store denial reason', async () => {
        const taskId = await orchestrator.createTask('AC4 Test Task', 'feature');
        const approvalId = `approval-${taskId}-gate-${Date.now()}`;

        await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
          stageName: 'planning',
          status: 'awaiting_approval',
          stageOutputs: { plan: 'test plan' },
          conversationState: [{ type: 'text', text: 'Planning complete' }],
          metadata: { test: true }
        });

        const denialReason = 'Plan needs significant revision';

        // Deny approval
        await orchestrator.denyApproval(approvalId, 'test-approver', denialReason);

        // Verify task status set to failed
        const task = await orchestrator.getTask(taskId);
        expect(task?.status).toBe('failed');

        // Verify denial reason is stored in task result
        expect(task?.result).toBe(`Approval denied by test-approver: ${denialReason}`);

        // Verify logs contain denial information
        const logs = await orchestrator.getTaskLogs(taskId);
        const denialLog = logs.find(log =>
          log.message.includes('Task failed due to approval denial')
        );
        expect(denialLog).toBeDefined();
        expect(denialLog?.metadata).toMatchObject({
          approvalId,
          approver: 'test-approver',
          reason: denialReason
        });
      });
    });

    describe('AC5: Events approval:approved and approval:denied emitted', () => {
      it('should emit approval:approved event with correct structure', async () => {
        const taskId = await orchestrator.createTask('AC5 Grant Event Task', 'feature');
        const approvalId = `approval-${taskId}-gate-${Date.now()}`;

        await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
          stageName: 'planning',
          status: 'awaiting_approval',
          stageOutputs: { plan: 'test plan' },
          conversationState: [{ type: 'text', text: 'Planning complete' }],
          metadata: { test: true }
        });

        const eventSpy = vi.fn();
        orchestrator.on('approval:approved', eventSpy);

        const approver = 'test-approver';
        const comment = 'Event test approval';

        await orchestrator.grantApproval(approvalId, approver, comment);

        // Verify event was emitted with correct structure
        expect(eventSpy).toHaveBeenCalledTimes(1);
        const emittedEvent = eventSpy.mock.calls[0][0];

        expect(emittedEvent).toMatchObject({
          approvalId,
          taskId,
          approver,
          comment,
          timestamp: expect.any(Date)
        });
      });

      it('should emit approval:denied event with correct structure', async () => {
        const taskId = await orchestrator.createTask('AC5 Deny Event Task', 'feature');
        const approvalId = `approval-${taskId}-gate-${Date.now()}`;

        await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
          stageName: 'planning',
          status: 'awaiting_approval',
          stageOutputs: { plan: 'test plan' },
          conversationState: [{ type: 'text', text: 'Planning complete' }],
          metadata: { test: true }
        });

        const eventSpy = vi.fn();
        orchestrator.on('approval:denied', eventSpy);

        const approver = 'test-approver';
        const reason = 'Event test denial';

        await orchestrator.denyApproval(approvalId, approver, reason);

        // Verify event was emitted with correct structure
        expect(eventSpy).toHaveBeenCalledTimes(1);
        const emittedEvent = eventSpy.mock.calls[0][0];

        expect(emittedEvent).toMatchObject({
          approvalId,
          taskId,
          approver,
          reason,
          timestamp: expect.any(Date)
        });
      });
    });

    describe('AC6: Unit tests verify resume and abort behavior', () => {
      it('should verify resume behavior with comprehensive assertions', async () => {
        const taskId = await orchestrator.createTask('AC6 Resume Test Task', 'feature');
        const approvalId = `approval-${taskId}-gate-${Date.now()}`;

        // Set up comprehensive checkpoint with various data types
        const checkpointData = {
          stageName: 'implementation',
          status: 'awaiting_approval' as const,
          stageOutputs: {
            code: 'function test() {}',
            tests: ['test1', 'test2'],
            metadata: { lines: 42, complexity: 'low' }
          },
          conversationState: [
            { type: 'text' as const, text: 'Implementation phase complete' },
            { type: 'system' as const, text: 'Awaiting review approval' }
          ],
          metadata: {
            resumeTest: true,
            previousAttempts: 0,
            reviewers: ['alice', 'bob']
          }
        };

        await orchestrator.createCheckpoint(taskId, 'implementation-checkpoint', checkpointData);

        // Grant approval and verify resume
        await orchestrator.grantApproval(approvalId, 'alice', 'Implementation looks good');

        // Verify all aspects of resume behavior
        const task = await orchestrator.getTask(taskId);
        expect(task?.status).toBe('in-progress');

        const logs = await orchestrator.getTaskLogs(taskId);
        const resumeLog = logs.find(log =>
          log.message.includes('Task resumed successfully after approval grant')
        );
        expect(resumeLog).toBeDefined();
        expect(resumeLog?.metadata?.approvalId).toBe(approvalId);
        expect(resumeLog?.metadata?.approver).toBe('alice');
        expect(resumeLog?.metadata?.comment).toBe('Implementation looks good');
      });

      it('should verify abort behavior with comprehensive assertions', async () => {
        const taskId = await orchestrator.createTask('AC6 Abort Test Task', 'feature');
        const approvalId = `approval-${taskId}-gate-${Date.now()}`;

        // Set initial task to active state
        await orchestrator.updateTask(taskId, {
          status: 'in-progress',
          result: 'Task in progress...'
        });

        await orchestrator.createCheckpoint(taskId, 'review-checkpoint', {
          stageName: 'review',
          status: 'awaiting_approval',
          stageOutputs: { review: 'Code review pending' },
          conversationState: [{ type: 'text', text: 'Review phase awaiting approval' }],
          metadata: { abortTest: true }
        });

        const denialReason = 'Code quality standards not met';

        // Deny approval and verify abort
        await orchestrator.denyApproval(approvalId, 'bob', denialReason);

        // Verify all aspects of abort behavior
        const task = await orchestrator.getTask(taskId);
        expect(task?.status).toBe('failed');
        expect(task?.result).toBe(`Approval denied by bob: ${denialReason}`);

        const logs = await orchestrator.getTaskLogs(taskId);
        const abortLog = logs.find(log =>
          log.message.includes('Task failed due to approval denial')
        );
        expect(abortLog).toBeDefined();
        expect(abortLog?.metadata?.approvalId).toBe(approvalId);
        expect(abortLog?.metadata?.approver).toBe('bob');
        expect(abortLog?.metadata?.reason).toBe(denialReason);
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed approval IDs gracefully', async () => {
      const invalidFormats = [
        '', // empty string
        'not-approval-format',
        'approval', // missing parts
        'approval-', // incomplete
        'approval-taskid', // missing gate part
        'wrong-prefix-taskid-gate-123',
      ];

      for (const invalidId of invalidFormats) {
        await expect(orchestrator.grantApproval(invalidId, 'tester', 'test'))
          .rejects.toThrow(/Invalid approval ID format/);

        await expect(orchestrator.denyApproval(invalidId, 'tester', 'test reason'))
          .rejects.toThrow(/Invalid approval ID format/);
      }
    });

    it('should handle extreme input values', async () => {
      const taskId = await orchestrator.createTask('Extreme Input Test', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      // Very long approver name
      const longApprover = 'a'.repeat(1000);
      await expect(orchestrator.grantApproval(approvalId, longApprover, 'test'))
        .resolves.not.toThrow();

      // Very long comment
      const secondTaskId = await orchestrator.createTask('Long Comment Test', 'feature');
      const secondApprovalId = `approval-${secondTaskId}-gate-${Date.now() + 1}`;

      await orchestrator.createCheckpoint(secondTaskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      const longComment = 'x'.repeat(10000);
      await expect(orchestrator.grantApproval(secondApprovalId, 'tester', longComment))
        .resolves.not.toThrow();

      // Very long denial reason
      const thirdTaskId = await orchestrator.createTask('Long Reason Test', 'feature');
      const thirdApprovalId = `approval-${thirdTaskId}-gate-${Date.now() + 2}`;

      await orchestrator.createCheckpoint(thirdTaskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      const longReason = 'y'.repeat(10000);
      await expect(orchestrator.denyApproval(thirdApprovalId, 'tester', longReason))
        .resolves.not.toThrow();
    });

    it('should handle unicode and special characters correctly', async () => {
      const taskId = await orchestrator.createTask('Unicode Test 🎯', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test plan' },
        conversationState: [{ type: 'text', text: 'Planning complete' }],
        metadata: { test: true }
      });

      // Test with various unicode characters
      const unicodeApprover = 'üser.nämé@çompañy.com';
      const unicodeComment = '✅ Approved! 🚀 Ready to deploy 中文测试';

      await expect(orchestrator.grantApproval(approvalId, unicodeApprover, unicodeComment))
        .resolves.not.toThrow();

      // Verify data integrity with unicode
      const logs = await orchestrator.getTaskLogs(taskId);
      const approvalLog = logs.find(log =>
        log.message.includes('Task resumed successfully after approval grant')
      );
      expect(approvalLog?.metadata?.approver).toBe(unicodeApprover);
      expect(approvalLog?.metadata?.comment).toBe(unicodeComment);
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle rapid sequential approvals without race conditions', async () => {
      const taskCount = 10;
      const tasks = [];

      // Create multiple tasks
      for (let i = 0; i < taskCount; i++) {
        const taskId = await orchestrator.createTask(`Sequential Test ${i}`, 'feature');
        await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
          stageName: 'planning',
          status: 'awaiting_approval',
          stageOutputs: { plan: `test plan ${i}` },
          conversationState: [{ type: 'text', text: 'Planning complete' }],
          metadata: { sequentialTest: true, index: i }
        });
        tasks.push(taskId);
      }

      const startTime = Date.now();

      // Rapidly grant approvals
      const approvalPromises = tasks.map((taskId, index) => {
        const approvalId = `approval-${taskId}-gate-${Date.now() + index}`;
        return orchestrator.grantApproval(approvalId, `approver-${index}`, `Sequential approval ${index}`);
      });

      await Promise.all(approvalPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all tasks were processed correctly
      const finalTasks = await Promise.all(tasks.map(id => orchestrator.getTask(id)));
      finalTasks.forEach(task => {
        expect(task?.status).toBe('in-progress');
      });

      // Performance assertion (should complete within reasonable time)
      expect(duration).toBeLessThan(5000); // 5 seconds for 10 approvals
    });

    it('should handle mixed approval outcomes under load', async () => {
      const taskCount = 20;
      const tasks = [];

      // Create tasks
      for (let i = 0; i < taskCount; i++) {
        const taskId = await orchestrator.createTask(`Load Test ${i}`, 'feature');
        await orchestrator.createCheckpoint(taskId, 'test-checkpoint', {
          stageName: 'planning',
          status: 'awaiting_approval',
          stageOutputs: { plan: `test plan ${i}` },
          conversationState: [{ type: 'text', text: 'Planning complete' }],
          metadata: { loadTest: true, index: i }
        });
        tasks.push(taskId);
      }

      // Mix of approvals and denials
      const approvalPromises = tasks.map((taskId, index) => {
        const approvalId = `approval-${taskId}-gate-${Date.now() + index}`;

        if (index % 2 === 0) {
          // Grant even-indexed tasks
          return orchestrator.grantApproval(approvalId, `approver-${index}`, `Load approval ${index}`);
        } else {
          // Deny odd-indexed tasks
          return orchestrator.denyApproval(approvalId, `denier-${index}`, `Load denial ${index}`);
        }
      });

      await Promise.all(approvalPromises);

      // Verify correct outcomes
      const finalTasks = await Promise.all(tasks.map(id => orchestrator.getTask(id)));
      finalTasks.forEach((task, index) => {
        if (index % 2 === 0) {
          expect(task?.status).toBe('in-progress'); // granted
        } else {
          expect(task?.status).toBe('failed'); // denied
        }
      });
    });
  });
});