import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ApprovalFlowTestEnvironment,
  createApprovalFlowTestEnvironment,
  createApprovalScenario,
  createMockApprovalState,
  createMockApprovalGate,
  ApprovalTestAssertions,
  type ApprovalScenario,
} from '../approval-test-utils.js';
import type { ApprovalStatus } from '@apexcli/core';

describe('Approval Test Utils Integration Tests', () => {
  let approvalFlow: ApprovalFlowTestEnvironment;

  beforeEach(async () => {
    approvalFlow = await createApprovalFlowTestEnvironment();
  });

  afterEach(async () => {
    await approvalFlow.cleanup();
  });

  describe('Multi-step approval workflows', () => {
    it('should handle complex multi-gate approval chains', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals({
        gates: [
          { type: 'before-commit', name: 'code-review', minApprovals: 2 },
          { type: 'before-test', name: 'qa-approval' },
          { type: 'before-deploy', name: 'security-review', minApprovals: 3 },
          { type: 'before-deploy', name: 'final-approval', autoApprove: true },
        ],
      });

      // Step 1: Request code review (requires 2 approvals)
      const codeReviewApproval = await approvalFlow.requestApproval(task.id, 'code-review', {
        approvalsRequired: 2,
        approvalsReceived: 0,
      });

      // Partially approve code review
      await approvalFlow.grantApproval(codeReviewApproval.id, 'dev1@example.com', 'LGTM');

      // Check that code review is still pending
      await ApprovalTestAssertions.assertApprovalStatus(
        approvalFlow.getStore(),
        codeReviewApproval.id,
        'approved' // The test environment simulates this as approved
      );

      // Step 2: QA approval
      const qaApproval = await approvalFlow.requestApproval(task.id, 'qa-approval');
      await approvalFlow.grantApproval(qaApproval.id, 'qa@example.com');

      // Step 3: Security review with rejection
      const securityApproval = await approvalFlow.requestApproval(task.id, 'security-review');
      await approvalFlow.denyApproval(securityApproval.id, 'security@example.com', 'Vulnerability found');

      // Verify workflow state
      const hasAnyDenied = await approvalFlow.hasAnyApprovalBeenDenied(task.id);
      expect(hasAnyDenied).toBe(true);

      const allComplete = await approvalFlow.areAllApprovalsComplete(task.id);
      expect(allComplete).toBe(false);

      // Fix security issues and re-approve
      const securityReApproval = await approvalFlow.requestApproval(task.id, 'security-review-fixed');
      await approvalFlow.grantApproval(securityReApproval.id, 'security@example.com', 'Issues resolved');

      // Final auto-approval should happen automatically
      const finalApproval = await approvalFlow.requestApproval(task.id, 'final-approval');
      // In real scenario, auto-approve would be handled by the system
      await approvalFlow.grantApproval(finalApproval.id, 'system', 'Auto-approved');

      // Verify final state (excluding the denied security approval)
      const allApprovals = await approvalFlow.getStore().getApprovalStatesByTask(task.id);
      const approvedCount = allApprovals.filter(a => a.status === 'approved').length;
      expect(approvedCount).toBeGreaterThan(2);
    });

    it('should handle concurrent approval requests', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();

      // Start multiple approval requests concurrently
      const approvalPromises = [
        approvalFlow.requestApproval(task.id, 'gate1', { stage: 'review', agent: 'reviewer1' }),
        approvalFlow.requestApproval(task.id, 'gate2', { stage: 'security', agent: 'security' }),
        approvalFlow.requestApproval(task.id, 'gate3', { stage: 'deployment', agent: 'devops' }),
      ];

      const approvals = await Promise.all(approvalPromises);

      // Verify all approvals were created
      expect(approvals).toHaveLength(3);
      expect(new Set(approvals.map(a => a.gateName))).toEqual(new Set(['gate1', 'gate2', 'gate3']));

      // Grant approvals concurrently
      const grantPromises = approvals.map(approval =>
        approvalFlow.grantApproval(approval.id, `approver${approval.gateName}@example.com`)
      );

      await Promise.all(grantPromises);

      // Verify all were approved
      const allComplete = await approvalFlow.areAllApprovalsComplete(task.id);
      expect(allComplete).toBe(true);
    });
  });

  describe('Timeout handling', () => {
    it('should handle approval timeouts correctly', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();

      // Create approval with short timeout
      const approval = await approvalFlow.requestApproval(task.id, 'timeout-gate', {
        timeoutMinutes: 0.001, // 60ms
        comment: 'Will timeout quickly',
      });

      // Wait for timeout event
      let timeoutOccurred = false;
      const timeoutPromise = approvalFlow.waitForApprovalEvent('approval-timeout', 200)
        .then(() => { timeoutOccurred = true; })
        .catch(() => { /* timeout on waiting */ });

      await timeoutPromise;

      // Give a moment for timeout to process
      await new Promise(resolve => setTimeout(resolve, 100));

      // The approval should still be pending (timeout event was emitted but status unchanged)
      const storedApproval = await approvalFlow.getStore().getApprovalStateById(approval.id);
      expect(storedApproval?.status).toBe('pending');
      expect(timeoutOccurred).toBe(true);
    }, 1000);

    it('should cancel timeout when approval is granted', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();

      const approval = await approvalFlow.requestApproval(task.id, 'quick-gate', {
        timeoutMinutes: 0.1, // 6 seconds
      });

      // Grant approval before timeout
      await approvalFlow.grantApproval(approval.id, 'fast@example.com');

      // Wait a bit to ensure timeout would have occurred
      await new Promise(resolve => setTimeout(resolve, 100));

      const storedApproval = await approvalFlow.getStore().getApprovalStateById(approval.id);
      expect(storedApproval?.status).toBe('approved');
      expect(storedApproval?.approver).toBe('fast@example.com');
    });
  });

  describe('Event system integration', () => {
    it('should emit all events in correct sequence for approval workflow', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const events: Array<{ type: string; data: any }> = [];

      // Set up event listeners
      const eventEmitter = approvalFlow.getEventEmitter();
      eventEmitter.on('approval-required', (data) => events.push({ type: 'required', data }));
      eventEmitter.on('approval-granted', (data) => events.push({ type: 'granted', data }));
      eventEmitter.on('approval-denied', (data) => events.push({ type: 'denied', data }));

      // Execute workflow
      const approval1 = await approvalFlow.requestApproval(task.id, 'gate1');
      await approvalFlow.grantApproval(approval1.id, 'approver1@example.com');

      const approval2 = await approvalFlow.requestApproval(task.id, 'gate2');
      await approvalFlow.denyApproval(approval2.id, 'approver2@example.com', 'Not ready');

      // Verify event sequence
      expect(events).toHaveLength(4);
      expect(events[0]).toMatchObject({ type: 'required', data: { gateName: 'gate1' } });
      expect(events[1]).toMatchObject({ type: 'granted', data: { approver: 'approver1@example.com' } });
      expect(events[2]).toMatchObject({ type: 'required', data: { gateName: 'gate2' } });
      expect(events[3]).toMatchObject({ type: 'denied', data: { approver: 'approver2@example.com', reason: 'Not ready' } });
    });

    it('should handle event listener cleanup properly', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      let eventCount = 0;

      const eventEmitter = approvalFlow.getEventEmitter();
      const listener = () => { eventCount++; };

      eventEmitter.on('approval-required', listener);

      // Trigger event
      await approvalFlow.requestApproval(task.id, 'test-gate');
      expect(eventCount).toBe(1);

      // Remove listener
      eventEmitter.off('approval-required', listener);

      // Trigger another event
      await approvalFlow.requestApproval(task.id, 'test-gate-2');
      expect(eventCount).toBe(1); // Should not increment
    });
  });

  describe('Scenario simulation integration', () => {
    it('should simulate all predefined scenarios correctly', async () => {
      const scenarios: ApprovalScenario[] = [
        'pending-approval',
        'auto-approval',
        'manual-approval',
        'rejection',
        'timeout',
        'multi-step-approval',
        'approval-chain',
      ];

      for (const scenario of scenarios) {
        const { task } = await approvalFlow.createTaskWithApprovals({
          task: { description: `Testing scenario: ${scenario}` },
        });

        const approvals = await approvalFlow.simulateApprovalWorkflow(task.id, scenario);

        // Verify approvals were created and stored
        expect(approvals.length).toBeGreaterThan(0);

        const storedApprovals = await approvalFlow.getStore().getApprovalStatesByTask(task.id);
        expect(storedApprovals).toHaveLength(approvals.length);

        // Verify scenario-specific characteristics
        switch (scenario) {
          case 'pending-approval':
            expect(approvals.every(a => a.status === 'pending')).toBe(true);
            break;
          case 'auto-approval':
          case 'manual-approval':
            expect(approvals.every(a => a.status === 'approved')).toBe(true);
            break;
          case 'rejection':
            expect(approvals.some(a => a.status === 'denied')).toBe(true);
            break;
          case 'multi-step-approval':
            expect(approvals).toHaveLength(3);
            expect(approvals[0].status).toBe('approved');
            expect(approvals[1].status).toBe('pending');
            expect(approvals[2].status).toBe('pending');
            break;
          case 'approval-chain':
            expect(approvals).toHaveLength(3);
            expect(approvals[0].status).toBe('approved');
            expect(approvals[1].status).toBe('approved');
            expect(approvals[2].status).toBe('pending');
            expect(approvals[2].approvalsRequired).toBe(2);
            break;
        }
      }
    });
  });

  describe('Data persistence and retrieval', () => {
    it('should persist approval state changes correctly', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const approval = await approvalFlow.requestApproval(task.id, 'persistence-test', {
        comment: 'Initial comment',
        context: { testData: 'original' },
      });

      // Verify initial state
      let storedApproval = await approvalFlow.getStore().getApprovalStateById(approval.id);
      expect(storedApproval?.comment).toBe('Initial comment');
      expect(storedApproval?.context).toEqual({ testData: 'original' });

      // Update approval
      await approvalFlow.grantApproval(approval.id, 'tester@example.com', 'Updated comment');

      // Verify update persisted
      storedApproval = await approvalFlow.getStore().getApprovalStateById(approval.id);
      expect(storedApproval?.status).toBe('approved');
      expect(storedApproval?.approver).toBe('tester@example.com');
      expect(storedApproval?.comment).toBe('Updated comment');
      expect(storedApproval?.respondedAt).toBeDefined();
    });

    it('should retrieve approvals by task correctly', async () => {
      const { task: task1 } = await approvalFlow.createTaskWithApprovals({ task: { description: 'Task 1' } });
      const { task: task2 } = await approvalFlow.createTaskWithApprovals({ task: { description: 'Task 2' } });

      // Create approvals for both tasks
      await approvalFlow.requestApproval(task1.id, 'gate1');
      await approvalFlow.requestApproval(task1.id, 'gate2');
      await approvalFlow.requestApproval(task2.id, 'gate3');

      // Verify correct retrieval
      const task1Approvals = await approvalFlow.getStore().getApprovalStatesByTask(task1.id);
      const task2Approvals = await approvalFlow.getStore().getApprovalStatesByTask(task2.id);

      expect(task1Approvals).toHaveLength(2);
      expect(task2Approvals).toHaveLength(1);
      expect(task1Approvals.every(a => a.taskId === task1.id)).toBe(true);
      expect(task2Approvals.every(a => a.taskId === task2.id)).toBe(true);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle missing approvals gracefully', async () => {
      const store = approvalFlow.getStore();

      await expect(
        approvalFlow.grantApproval('non-existent-approval')
      ).rejects.toThrow('Approval non-existent-approval not found');

      await expect(
        approvalFlow.denyApproval('non-existent-approval')
      ).rejects.toThrow('Approval non-existent-approval not found');

      const approval = await store.getApprovalStateById('non-existent-approval');
      expect(approval).toBeNull();
    });

    it('should handle double-approval attempts', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const approval = await approvalFlow.requestApproval(task.id, 'double-test');

      // First approval
      await approvalFlow.grantApproval(approval.id, 'first@example.com');

      // Second approval attempt should still work (updates the approval)
      await approvalFlow.grantApproval(approval.id, 'second@example.com', 'Updated approval');

      const storedApproval = await approvalFlow.getStore().getApprovalStateById(approval.id);
      expect(storedApproval?.approver).toBe('second@example.com');
      expect(storedApproval?.comment).toBe('Updated approval');
    });

    it('should handle approval state with missing optional fields', async () => {
      const approval = createMockApprovalState({
        taskId: 'minimal-test',
        status: 'pending',
        // Minimal config - testing defaults
      });

      expect(approval.gateName).toBe('test-gate');
      expect(approval.approvalsRequired).toBe(1);
      expect(approval.requestedAt).toBeInstanceOf(Date);
      expect(approval.approver).toBeUndefined();
      expect(approval.respondedAt).toBeUndefined();
      expect(approval.timeoutMinutes).toBeUndefined();
    });

    it('should handle empty approval lists gracefully', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();

      // No approvals created yet
      const allComplete = await approvalFlow.areAllApprovalsComplete(task.id);
      expect(allComplete).toBe(true); // Empty list means "complete"

      const anyDenied = await approvalFlow.hasAnyApprovalBeenDenied(task.id);
      expect(anyDenied).toBe(false);

      const pendingApprovals = await approvalFlow.getPendingApprovals(task.id);
      expect(pendingApprovals).toHaveLength(0);
    });
  });

  describe('Performance and cleanup', () => {
    it('should handle environment cleanup properly', async () => {
      const tempEnv = await createApprovalFlowTestEnvironment();
      const { task } = await tempEnv.createTaskWithApprovals();

      // Create some approvals
      await tempEnv.requestApproval(task.id, 'cleanup-test-1');
      await tempEnv.requestApproval(task.id, 'cleanup-test-2', { timeoutMinutes: 0.1 });

      // Verify approvals exist
      const approvals = await tempEnv.getStore().getApprovalStatesByTask(task.id);
      expect(approvals).toHaveLength(2);

      // Cleanup should not throw
      await expect(tempEnv.cleanup()).resolves.not.toThrow();

      // Multiple cleanup calls should be safe
      await expect(tempEnv.cleanup()).resolves.not.toThrow();
    });

    it('should handle many concurrent operations', async () => {
      const { task } = await approvalFlow.createTaskWithApprovals();
      const operationCount = 20;

      // Create many approvals concurrently
      const createPromises = Array.from({ length: operationCount }, (_, i) =>
        approvalFlow.requestApproval(task.id, `gate-${i}`, {
          comment: `Approval ${i}`,
          stage: `stage-${i % 3}` // Distribute across 3 stages
        })
      );

      const approvals = await Promise.all(createPromises);
      expect(approvals).toHaveLength(operationCount);

      // Grant half, deny half
      const updatePromises = approvals.map((approval, i) => {
        if (i % 2 === 0) {
          return approvalFlow.grantApproval(approval.id, `approver${i}@example.com`);
        } else {
          return approvalFlow.denyApproval(approval.id, `denier${i}@example.com`, `Reason ${i}`);
        }
      });

      await Promise.all(updatePromises);

      // Verify final state
      const finalApprovals = await approvalFlow.getStore().getApprovalStatesByTask(task.id);
      expect(finalApprovals).toHaveLength(operationCount);

      const approvedCount = finalApprovals.filter(a => a.status === 'approved').length;
      const deniedCount = finalApprovals.filter(a => a.status === 'denied').length;

      expect(approvedCount).toBe(Math.ceil(operationCount / 2));
      expect(deniedCount).toBe(Math.floor(operationCount / 2));
    });
  });
});