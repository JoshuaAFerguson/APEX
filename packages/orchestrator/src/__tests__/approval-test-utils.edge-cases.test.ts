import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createMockApprovalState,
  createMockApprovalGate,
  createApprovalScenario,
  ApprovalFlowTestEnvironment,
  createApprovalFlowTestEnvironment,
  createWorkflowWithApprovals,
  ApprovalTestAssertions,
  type ApprovalStateConfig,
  type ApprovalGateConfig,
} from '../approval-test-utils.js';

describe('Approval Test Utils Edge Cases', () => {
  describe('Boundary value testing', () => {
    it('should handle minimum and maximum approval requirements', () => {
      // Minimum approvals (0)
      const minApprovalGate = createMockApprovalGate({
        minApprovals: 0,
        autoApprove: true,
      });
      expect(minApprovalGate.minApprovals).toBe(0);
      expect(minApprovalGate.autoApprove).toBe(true);

      // Maximum realistic approvals
      const maxApprovalGate = createMockApprovalGate({
        minApprovals: 100,
        approvers: Array.from({ length: 100 }, (_, i) => `approver${i}@example.com`),
      });
      expect(maxApprovalGate.minApprovals).toBe(100);
      expect(maxApprovalGate.approvers).toHaveLength(100);
    });

    it('should handle extreme timeout values', () => {
      // Very short timeout
      const shortTimeout = createMockApprovalState({
        taskId: 'short-timeout-test',
        timeoutMinutes: 0.001, // 60ms
      });
      expect(shortTimeout.timeoutMinutes).toBe(0.001);

      // Very long timeout
      const longTimeout = createMockApprovalState({
        taskId: 'long-timeout-test',
        timeoutMinutes: 525600, // 1 year in minutes
      });
      expect(longTimeout.timeoutMinutes).toBe(525600);

      // Zero timeout
      const zeroTimeout = createMockApprovalState({
        taskId: 'zero-timeout-test',
        timeoutMinutes: 0,
      });
      expect(zeroTimeout.timeoutMinutes).toBe(0);
    });

    it('should handle edge date values', () => {
      const farPast = new Date('1970-01-01');
      const farFuture = new Date('2099-12-31');

      const approval = createMockApprovalState({
        taskId: 'date-edge-test',
        requestedAt: farPast,
        expiresAt: farFuture,
      });

      expect(approval.requestedAt).toEqual(farPast);
      expect(approval.expiresAt).toEqual(farFuture);
    });
  });

  describe('Invalid input handling', () => {
    it('should handle empty and whitespace strings', () => {
      // Empty strings
      const approval1 = createMockApprovalState({
        taskId: 'empty-string-test',
        gateName: '',
        approver: '',
        comment: '',
        stage: '',
        agent: '',
      });

      expect(approval1.gateName).toBe('');
      expect(approval1.approver).toBe('');
      expect(approval1.comment).toBe('');

      // Whitespace strings
      const approval2 = createMockApprovalState({
        taskId: 'whitespace-test',
        gateName: '   ',
        approver: '\\t\\n',
        comment: '   \\n\\t   ',
      });

      expect(approval2.gateName).toBe('   ');
      expect(approval2.approver).toBe('\\t\\n');
      expect(approval2.comment).toBe('   \\n\\t   ');
    });

    it('should handle special characters in strings', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?`~"\\';
      const unicodeChars = '🚀 Test 测试 🎉';

      const approval = createMockApprovalState({
        taskId: 'special-chars-test',
        gateName: specialChars,
        approver: unicodeChars,
        comment: `${specialChars} ${unicodeChars}`,
      });

      expect(approval.gateName).toBe(specialChars);
      expect(approval.approver).toBe(unicodeChars);
      expect(approval.comment).toBe(`${specialChars} ${unicodeChars}`);
    });

    it('should handle very long strings', () => {
      const veryLongString = 'x'.repeat(10000);

      const approval = createMockApprovalState({
        taskId: 'long-string-test',
        gateName: veryLongString,
        comment: veryLongString,
        approver: veryLongString,
      });

      expect(approval.gateName).toHaveLength(10000);
      expect(approval.comment).toHaveLength(10000);
      expect(approval.approver).toHaveLength(10000);
    });

    it('should handle complex context objects', () => {
      const complexContext = {
        nested: {
          deeply: {
            object: {
              with: ['arrays', 'and', { objects: true }],
              numbers: 42,
              nullValue: null,
              undefinedValue: undefined,
              booleans: [true, false],
              functions: () => 'test', // Functions should be serialized safely
              dates: new Date(),
              regexes: /test/gi,
            },
          },
        },
        circular: null as any,
      };

      // Create circular reference
      complexContext.circular = complexContext;

      const approval = createMockApprovalState({
        taskId: 'complex-context-test',
        context: complexContext,
      });

      // Should not throw and should preserve non-circular parts
      expect(approval.context).toBeDefined();
      expect(approval.context?.nested?.deeply?.object?.numbers).toBe(42);
    });
  });

  describe('State transition edge cases', () => {
    let approvalFlow: ApprovalFlowTestEnvironment;

    beforeEach(async () => {
      approvalFlow = await createApprovalFlowTestEnvironment();
    });

    afterEach(async () => {
      await approvalFlow.cleanup();
    });

    it('should handle rapid state changes', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const approval = await approvalFlow.requestApproval(task.id, 'rapid-change-test');

      // Rapid approval and denial (last one should win)
      await Promise.all([
        approvalFlow.grantApproval(approval.id, 'approver1@example.com'),
        approvalFlow.denyApproval(approval.id, 'denier@example.com'),
        approvalFlow.grantApproval(approval.id, 'approver2@example.com'),
      ]);

      const finalState = await approvalFlow.getStore().getApprovalStateById(approval.id);
      // One of the operations should have succeeded (non-deterministic which one due to concurrency)
      expect(['approved', 'denied']).toContain(finalState?.status);
    });

    it('should handle approval of already approved items', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const approval = await approvalFlow.requestApproval(task.id, 'double-approve-test');

      // First approval
      await approvalFlow.grantApproval(approval.id, 'first@example.com', 'First approval');

      let state = await approvalFlow.getStore().getApprovalStateById(approval.id);
      expect(state?.status).toBe('approved');
      expect(state?.approver).toBe('first@example.com');

      // Second approval (should update the existing approval)
      await approvalFlow.grantApproval(approval.id, 'second@example.com', 'Second approval');

      state = await approvalFlow.getStore().getApprovalStateById(approval.id);
      expect(state?.status).toBe('approved');
      expect(state?.approver).toBe('second@example.com');
      expect(state?.comment).toBe('Second approval');
    });

    it('should handle denial of already denied items', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const approval = await approvalFlow.requestApproval(task.id, 'double-deny-test');

      // First denial
      await approvalFlow.denyApproval(approval.id, 'first@example.com', 'First reason');

      let state = await approvalFlow.getStore().getApprovalStateById(approval.id);
      expect(state?.status).toBe('denied');
      expect(state?.comment).toBe('First reason');

      // Second denial (should update)
      await approvalFlow.denyApproval(approval.id, 'second@example.com', 'Second reason');

      state = await approvalFlow.getStore().getApprovalStateById(approval.id);
      expect(state?.status).toBe('denied');
      expect(state?.approver).toBe('second@example.com');
      expect(state?.comment).toBe('Second reason');
    });

    it('should handle approval after denial', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const approval = await approvalFlow.requestApproval(task.id, 'deny-then-approve-test');

      // Deny first
      await approvalFlow.denyApproval(approval.id, 'denier@example.com', 'Not ready');

      let state = await approvalFlow.getStore().getApprovalStateById(approval.id);
      expect(state?.status).toBe('denied');

      // Then approve (should change state)
      await approvalFlow.grantApproval(approval.id, 'approver@example.com', 'Ready now');

      state = await approvalFlow.getStore().getApprovalStateById(approval.id);
      expect(state?.status).toBe('approved');
      expect(state?.approver).toBe('approver@example.com');
      expect(state?.comment).toBe('Ready now');
    });
  });

  describe('Scenario edge cases', () => {
    it('should handle scenario creation with edge case data', () => {
      const edgeCaseTaskId = ''; // Empty task ID

      // Should not throw, but create approvals with empty task ID
      const approvals = createApprovalScenario(edgeCaseTaskId, 'pending-approval');
      expect(approvals).toHaveLength(1);
      expect(approvals[0].taskId).toBe('');
    });

    it('should create scenarios with extreme time values', () => {
      const approvals = createApprovalScenario('time-edge-test', 'timeout');

      expect(approvals).toHaveLength(1);
      expect(approvals[0].timeoutMinutes).toBe(0.5);
      expect(approvals[0].expiresAt).toBeDefined();

      // Verify expiration is in the future (approximately 30 seconds)
      const now = new Date();
      const expectedExpiration = new Date(now.getTime() + 30000);
      const actualExpiration = approvals[0].expiresAt!;

      // Allow for small timing differences (within 1 second)
      expect(Math.abs(actualExpiration.getTime() - expectedExpiration.getTime())).toBeLessThan(1000);
    });
  });

  describe('Workflow creation edge cases', () => {
    it('should handle workflow with no gates', () => {
      const workflow = createWorkflowWithApprovals({
        name: 'no-gates-workflow',
        gates: [],
      });

      expect(workflow.stages).toHaveLength(1);
      expect(workflow.stages[0].gates).toBeUndefined();
    });

    it('should handle workflow with many gates', () => {
      const manyGates = Array.from({ length: 50 }, (_, i) => ({
        type: 'custom' as const,
        name: `gate-${i}`,
        minApprovals: i + 1,
      }));

      const workflow = createWorkflowWithApprovals({
        name: 'many-gates-workflow',
        gates: manyGates,
      });

      expect(workflow.stages[0].gates).toHaveLength(50);
      expect(workflow.stages[0].gates![0].minApprovals).toBe(1);
      expect(workflow.stages[0].gates![49].minApprovals).toBe(50);
    });

    it('should handle workflow with empty stages array', () => {
      const workflow = createWorkflowWithApprovals({
        name: 'empty-stages-workflow',
        stages: [],
      });

      // Should create default stage when stages array is empty
      expect(workflow.stages).toHaveLength(1);
      expect(workflow.stages[0].name).toBe('implementation');
    });

    it('should handle workflow with partial stage definitions', () => {
      const workflow = createWorkflowWithApprovals({
        stages: [
          { name: 'partial-stage' }, // Missing required fields
          { agent: 'test-agent' }, // Missing name
        ],
      });

      expect(workflow.stages).toHaveLength(2);
      expect(workflow.stages[0].name).toBe('partial-stage');
      expect(workflow.stages[1].agent).toBe('test-agent');
    });
  });

  describe('Assertion edge cases', () => {
    let approvalFlow: ApprovalFlowTestEnvironment;

    beforeEach(async () => {
      approvalFlow = await createApprovalFlowTestEnvironment();
    });

    afterEach(async () => {
      await approvalFlow.cleanup();
    });

    it('should handle assertion with null/undefined values', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const approval = createMockApprovalState({
        taskId: task.id,
        approver: undefined, // Explicitly undefined
      });

      await approvalFlow.getStore().saveApprovalState(approval);

      // Should handle null/undefined approver
      await expect(
        ApprovalTestAssertions.assertApprovalApprover(
          approvalFlow.getStore(),
          approval.id,
          'test@example.com'
        )
      ).rejects.toThrow('Expected approver test@example.com, got undefined');
    });

    it('should handle assertions on tasks with mixed approval states', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();

      // Create approvals in different states
      const approval1 = await approvalFlow.requestApproval(task.id, 'gate1');
      const approval2 = await approvalFlow.requestApproval(task.id, 'gate2');
      const approval3 = await approvalFlow.requestApproval(task.id, 'gate3');

      await approvalFlow.grantApproval(approval1.id, 'approver@example.com');
      await approvalFlow.denyApproval(approval2.id, 'denier@example.com');
      // approval3 remains pending

      // Test various assertions
      await expect(
        ApprovalTestAssertions.assertPendingApprovalsCount(
          approvalFlow.getStore(),
          task.id,
          1
        )
      ).resolves.not.toThrow();

      await expect(
        ApprovalTestAssertions.assertAllApprovalsApproved(
          approvalFlow.getStore(),
          task.id
        )
      ).rejects.toThrow('Not all approvals approved');
    });

    it('should provide detailed error messages for failed assertions', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();

      const approval1 = await approvalFlow.requestApproval(task.id, 'gate1');
      const approval2 = await approvalFlow.requestApproval(task.id, 'gate2');

      await approvalFlow.grantApproval(approval1.id, 'approver1@example.com');
      await approvalFlow.denyApproval(approval2.id, 'denier@example.com');

      try {
        await ApprovalTestAssertions.assertAllApprovalsApproved(
          approvalFlow.getStore(),
          task.id
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        const errorMessage = (error as Error).message;
        expect(errorMessage).toContain('Not all approvals approved');
        expect(errorMessage).toContain('gate1: approved');
        expect(errorMessage).toContain('gate2: denied');
      }
    });
  });

  describe('Memory and resource edge cases', () => {
    let approvalFlow: ApprovalFlowTestEnvironment;

    beforeEach(async () => {
      approvalFlow = await createApprovalFlowTestEnvironment();
    });

    afterEach(async () => {
      await approvalFlow.cleanup();
    });

    it('should handle many event listeners without memory leaks', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const eventEmitter = approvalFlow.getEventEmitter();

      // Add many listeners
      const listeners: Array<() => void> = [];
      for (let i = 0; i < 1000; i++) {
        const listener = () => { /* noop */ };
        listeners.push(listener);
        eventEmitter.on('approval-required', listener);
      }

      // Trigger event
      await approvalFlow.requestApproval(task.id, 'many-listeners-test');

      // Remove all listeners
      listeners.forEach(listener => {
        eventEmitter.off('approval-required', listener);
      });

      // Should not have memory issues
      expect(eventEmitter.listenerCount('approval-required')).toBe(0);
    });

    it('should handle cleanup with active timeouts', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();

      // Create several approvals with timeouts
      await approvalFlow.requestApproval(task.id, 'timeout1', { timeoutMinutes: 1 });
      await approvalFlow.requestApproval(task.id, 'timeout2', { timeoutMinutes: 2 });
      await approvalFlow.requestApproval(task.id, 'timeout3', { timeoutMinutes: 3 });

      // Cleanup should clear all timeouts without throwing
      await expect(approvalFlow.cleanup()).resolves.not.toThrow();
    });
  });
});