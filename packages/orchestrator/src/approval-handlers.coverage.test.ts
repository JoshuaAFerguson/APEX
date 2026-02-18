import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApexOrchestrator } from './index.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdirSync, rmSync } from 'fs';

/**
 * Coverage-focused test suite for approval handlers
 *
 * This test suite ensures complete code coverage of the approval handler
 * implementation by testing all code paths, branches, and conditions.
 */
describe('Approval Handlers - Coverage Tests', () => {
  let orchestrator: ApexOrchestrator;
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `apex-test-${Date.now()}-${Math.random()}`);
    mkdirSync(testDir, { recursive: true });

    orchestrator = new ApexOrchestrator({
      dataDir: testDir,
      claudeApiKey: 'test-key',
    });

    await orchestrator.ensureInitialized();
  });

  afterEach(() => {
    try {
      rmSync(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('grantApproval Method Coverage', () => {
    it('should cover all branches in approval ID validation', async () => {
      // Test path: Invalid approval ID format - empty string
      await expect(orchestrator.grantApproval('', 'approver', 'comment'))
        .rejects.toThrow('Invalid approval ID format: ');

      // Test path: Invalid approval ID format - missing 'approval' prefix
      await expect(orchestrator.grantApproval('invalid-format', 'approver', 'comment'))
        .rejects.toThrow('Invalid approval ID format: invalid-format');

      // Test path: Invalid approval ID format - too few parts
      await expect(orchestrator.grantApproval('approval-only', 'approver', 'comment'))
        .rejects.toThrow('Invalid approval ID format: approval-only');

      // Test path: Invalid approval ID format - only two parts
      await expect(orchestrator.grantApproval('approval-taskid', 'approver', 'comment'))
        .rejects.toThrow('Invalid approval ID format: approval-taskid');
    });

    it('should cover task existence validation path', async () => {
      // Test path: Valid format but non-existent task
      const nonExistentApprovalId = 'approval-nonexistent-task-gate-123456';

      await expect(orchestrator.grantApproval(nonExistentApprovalId, 'approver', 'comment'))
        .rejects.toThrow('Task not found for approval: nonexistent-task');
    });

    it('should cover successful approval with comment path', async () => {
      const taskId = await orchestrator.createTask('Coverage Test 1', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test' },
        conversationState: [{ type: 'text', text: 'Test' }],
        metadata: {}
      });

      const eventSpy = vi.fn();
      orchestrator.on('approval:approved', eventSpy);

      // Test path: Successful grant with comment
      await orchestrator.grantApproval(approvalId, 'test-approver', 'Test comment');

      expect(eventSpy).toHaveBeenCalledWith({
        approvalId,
        taskId,
        approver: 'test-approver',
        comment: 'Test comment',
        timestamp: expect.any(Date)
      });
    });

    it('should cover successful approval without comment path', async () => {
      const taskId = await orchestrator.createTask('Coverage Test 2', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test' },
        conversationState: [{ type: 'text', text: 'Test' }],
        metadata: {}
      });

      const eventSpy = vi.fn();
      orchestrator.on('approval:approved', eventSpy);

      // Test path: Successful grant without comment (undefined comment)
      await orchestrator.grantApproval(approvalId, 'test-approver');

      expect(eventSpy).toHaveBeenCalledWith({
        approvalId,
        taskId,
        approver: 'test-approver',
        comment: undefined,
        timestamp: expect.any(Date)
      });
    });

    it('should cover resume task success and failure paths', async () => {
      // Test path: Resume task success
      const taskId1 = await orchestrator.createTask('Resume Success Test', 'feature');
      const approvalId1 = `approval-${taskId1}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId1, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test' },
        conversationState: [{ type: 'text', text: 'Test' }],
        metadata: {}
      });

      await orchestrator.grantApproval(approvalId1, 'approver', 'resume success');

      const task1 = await orchestrator.getTask(taskId1);
      expect(task1?.status).toBe('in-progress');

      // Test path: Resume task failure (no checkpoint)
      const taskId2 = await orchestrator.createTask('Resume Failure Test', 'feature');
      const approvalId2 = `approval-${taskId2}-gate-${Date.now() + 1}`;

      // Don't create checkpoint - should trigger warning path

      await orchestrator.grantApproval(approvalId2, 'approver', 'resume failure');

      const logs = await orchestrator.getTaskLogs(taskId2);
      const warningLog = logs.find(log =>
        log.message.includes('Failed to resume task after approval grant: no checkpoint available')
      );
      expect(warningLog).toBeDefined();
    });
  });

  describe('denyApproval Method Coverage', () => {
    it('should cover all branches in reason validation', async () => {
      const taskId = await orchestrator.createTask('Reason Validation Test', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      // Test path: Empty reason string
      await expect(orchestrator.denyApproval(approvalId, 'approver', ''))
        .rejects.toThrow('Reason is required when denying an approval');

      // Test path: Whitespace-only reason
      await expect(orchestrator.denyApproval(approvalId, 'approver', '   \t\n  '))
        .rejects.toThrow('Reason is required when denying an approval');

      // Test path: Reason with only newlines
      await expect(orchestrator.denyApproval(approvalId, 'approver', '\n\n\n'))
        .rejects.toThrow('Reason is required when denying an approval');
    });

    it('should cover approval ID validation path (same as grantApproval)', async () => {
      const validReason = 'Valid denial reason';

      // Test all the same validation paths as grantApproval
      await expect(orchestrator.denyApproval('', 'approver', validReason))
        .rejects.toThrow('Invalid approval ID format: ');

      await expect(orchestrator.denyApproval('invalid-format', 'approver', validReason))
        .rejects.toThrow('Invalid approval ID format: invalid-format');

      await expect(orchestrator.denyApproval('approval-only', 'approver', validReason))
        .rejects.toThrow('Invalid approval ID format: approval-only');
    });

    it('should cover task existence validation path', async () => {
      const nonExistentApprovalId = 'approval-does-not-exist-gate-123456';

      await expect(orchestrator.denyApproval(nonExistentApprovalId, 'approver', 'valid reason'))
        .rejects.toThrow('Task not found for approval: does-not-exist');
    });

    it('should cover successful denial path', async () => {
      const taskId = await orchestrator.createTask('Denial Coverage Test', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test' },
        conversationState: [{ type: 'text', text: 'Test' }],
        metadata: {}
      });

      const eventSpy = vi.fn();
      orchestrator.on('approval:denied', eventSpy);

      const denialReason = 'Test denial reason';

      // Test path: Successful denial
      await orchestrator.denyApproval(approvalId, 'test-denier', denialReason);

      // Verify event emission
      expect(eventSpy).toHaveBeenCalledWith({
        approvalId,
        taskId,
        approver: 'test-denier',
        reason: denialReason,
        timestamp: expect.any(Date)
      });

      // Verify task status update
      const task = await orchestrator.getTask(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.result).toBe(`Approval denied by test-denier: ${denialReason}`);

      // Verify log creation
      const logs = await orchestrator.getTaskLogs(taskId);
      const denialLog = logs.find(log =>
        log.message.includes('Task failed due to approval denial')
      );
      expect(denialLog).toBeDefined();
      expect(denialLog?.metadata).toMatchObject({
        approvalId,
        approver: 'test-denier',
        reason: denialReason
      });
    });
  });

  describe('Edge Cases for Complete Coverage', () => {
    it('should handle approval ID with exactly 3 parts', async () => {
      // Test path: Minimal valid approval ID format
      const taskId = await orchestrator.createTask('Minimal ID Test', 'feature');

      // Create approval ID with exactly 3 parts (minimum valid)
      const minimalApprovalId = `approval-${taskId}-gate`;

      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test' },
        conversationState: [{ type: 'text', text: 'Test' }],
        metadata: {}
      });

      // Should succeed with minimal valid format
      await expect(orchestrator.grantApproval(minimalApprovalId, 'approver', 'minimal test'))
        .resolves.not.toThrow();
    });

    it('should handle approval ID with many parts', async () => {
      // Test path: Approval ID with more than 3 parts
      const taskId = await orchestrator.createTask('Multi-part ID Test', 'feature');

      // Create approval ID with many parts (should still work)
      const multiPartApprovalId = `approval-${taskId}-gate-extra-parts-here`;

      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test' },
        conversationState: [{ type: 'text', text: 'Test' }],
        metadata: {}
      });

      // Should succeed even with extra parts
      await expect(orchestrator.grantApproval(multiPartApprovalId, 'approver', 'multi-part test'))
        .resolves.not.toThrow();
    });

    it('should cover all timestamp handling paths', async () => {
      const taskId = await orchestrator.createTask('Timestamp Test', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test' },
        conversationState: [{ type: 'text', text: 'Test' }],
        metadata: {}
      });

      let capturedTimestamp: Date;

      const eventSpy = vi.fn().mockImplementation((data) => {
        capturedTimestamp = data.timestamp;
      });
      orchestrator.on('approval:approved', eventSpy);

      const beforeApproval = new Date();
      await orchestrator.grantApproval(approvalId, 'timestamp-tester', 'timestamp test');
      const afterApproval = new Date();

      expect(capturedTimestamp!).toBeInstanceOf(Date);
      expect(capturedTimestamp!.getTime()).toBeGreaterThanOrEqual(beforeApproval.getTime());
      expect(capturedTimestamp!.getTime()).toBeLessThanOrEqual(afterApproval.getTime());
    });

    it('should ensure all string trimming paths are covered', async () => {
      const taskId = await orchestrator.createTask('Trimming Test', 'feature');
      const approvalId = `approval-${taskId}-gate-${Date.now()}`;

      // Test various whitespace scenarios that need trimming
      const whitespaceVariations = [
        '\t\t  \t',           // tabs and spaces
        '\n\n  \n\n',         // newlines and spaces
        '\r\n\r\n  \r\n',     // carriage returns and newlines
        '   ',                // just spaces
        '\v\f',               // vertical tab and form feed
      ];

      for (const whitespace of whitespaceVariations) {
        await expect(orchestrator.denyApproval(approvalId, 'tester', whitespace))
          .rejects.toThrow('Reason is required when denying an approval');
      }

      // Test non-whitespace string that should pass
      await orchestrator.createCheckpoint(taskId, 'checkpoint', {
        stageName: 'planning',
        status: 'awaiting_approval',
        stageOutputs: { plan: 'test' },
        conversationState: [{ type: 'text', text: 'Test' }],
        metadata: {}
      });

      await expect(orchestrator.denyApproval(approvalId, 'tester', 'actual reason'))
        .resolves.not.toThrow();
    });
  });

  describe('Error Handling Coverage', () => {
    it('should cover all error throwing scenarios', async () => {
      // Test invalid approval ID format errors
      const invalidIds = [
        { id: '', expectedError: 'Invalid approval ID format: ' },
        { id: 'wrong', expectedError: 'Invalid approval ID format: wrong' },
        { id: 'approval', expectedError: 'Invalid approval ID format: approval' },
        { id: 'approval-task', expectedError: 'Invalid approval ID format: approval-task' },
      ];

      for (const { id, expectedError } of invalidIds) {
        await expect(orchestrator.grantApproval(id, 'approver', 'comment'))
          .rejects.toThrow(expectedError);

        await expect(orchestrator.denyApproval(id, 'approver', 'reason'))
          .rejects.toThrow(expectedError);
      }

      // Test task not found errors
      const nonExistentId = 'approval-nonexistent-gate-123';
      await expect(orchestrator.grantApproval(nonExistentId, 'approver', 'comment'))
        .rejects.toThrow('Task not found for approval: nonexistent');

      await expect(orchestrator.denyApproval(nonExistentId, 'approver', 'reason'))
        .rejects.toThrow('Task not found for approval: nonexistent');

      // Test empty reason error for denyApproval
      const taskId = await orchestrator.createTask('Error Test', 'feature');
      const validId = `approval-${taskId}-gate-123`;

      await expect(orchestrator.denyApproval(validId, 'approver', ''))
        .rejects.toThrow('Reason is required when denying an approval');

      await expect(orchestrator.denyApproval(validId, 'approver', '   '))
        .rejects.toThrow('Reason is required when denying an approval');
    });
  });
});

// Export test metadata for coverage analysis
export const CoverageTestMetadata = {
  testSuiteName: 'Approval Handlers Coverage Tests',
  totalTestCases: 15, // Update this as tests are added/removed
  coverageAreas: [
    'grantApproval input validation',
    'grantApproval task lookup',
    'grantApproval event emission',
    'grantApproval task resumption',
    'denyApproval input validation',
    'denyApproval task lookup',
    'denyApproval event emission',
    'denyApproval task failure',
    'Error handling',
    'Edge cases'
  ],
  criticalPaths: [
    'Invalid approval ID format handling',
    'Task not found error handling',
    'Empty reason validation',
    'Event emission with correct data',
    'Task status updates',
    'Log creation'
  ]
};