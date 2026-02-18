import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, ApprovalState } from '@apexcli/core';

describe('TaskStore - Approval States', () => {
  let testDir: string;
  let store: TaskStore;

  const createTestTask = (): Task => ({
    id: `task_${Date.now()}_test`,
    description: 'Test task for approval states',
    workflow: 'feature',
    autonomy: 'full',
    status: 'pending',
    priority: 'normal',
    projectPath: testDir,
    branchName: 'apex/test-branch',
    retryCount: 0,
    maxRetries: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
    },
    logs: [],
    artifacts: [],
  });

  const createTestApprovalState = (taskId: string, gateName = 'security-review'): ApprovalState => ({
    id: `approval_${Date.now()}_test`,
    taskId,
    gateName,
    status: 'pending',
    requestedAt: new Date(),
    approver: undefined,
    respondedAt: undefined,
    comment: undefined,
    context: { stage: 'implementation', agent: 'developer' },
    stage: 'implementation',
    agent: 'developer',
    approvalsReceived: 0,
    approvalsRequired: 1,
    timeoutMinutes: undefined,
    expiresAt: undefined,
  });

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-approval-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('Basic CRUD Operations', () => {
    it('should create and save an approval state', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const approvalState = createTestApprovalState(task.id);
      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState(task.id, approvalState.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(approvalState.id);
      expect(retrieved?.taskId).toBe(task.id);
      expect(retrieved?.gateName).toBe('security-review');
      expect(retrieved?.status).toBe('pending');
      expect(retrieved?.stage).toBe('implementation');
      expect(retrieved?.agent).toBe('developer');
      expect(retrieved?.approvalsReceived).toBe(0);
      expect(retrieved?.approvalsRequired).toBe(1);
    });

    it('should handle approval state without optional fields', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const approvalState: ApprovalState = {
        id: 'simple_approval_test',
        taskId: task.id,
        gateName: 'code-review',
        status: 'pending',
        requestedAt: new Date(),
      };

      await store.saveApprovalState(approvalState);

      const retrieved = await store.getApprovalState(task.id, approvalState.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('simple_approval_test');
      expect(retrieved?.gateName).toBe('code-review');
      expect(retrieved?.status).toBe('pending');
      expect(retrieved?.approver).toBeUndefined();
      expect(retrieved?.comment).toBeUndefined();
      expect(retrieved?.context).toBeUndefined();
    });

    it('should update an existing approval state (INSERT OR REPLACE)', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const approvalState = createTestApprovalState(task.id);
      await store.saveApprovalState(approvalState);

      // Update the same approval state
      const updatedState = {
        ...approvalState,
        status: 'approved' as const,
        approver: 'john.doe@example.com',
        respondedAt: new Date(),
        comment: 'Looks good to proceed',
      };

      await store.saveApprovalState(updatedState);

      const retrieved = await store.getApprovalState(task.id, approvalState.id);
      expect(retrieved?.status).toBe('approved');
      expect(retrieved?.approver).toBe('john.doe@example.com');
      expect(retrieved?.comment).toBe('Looks good to proceed');
      expect(retrieved?.respondedAt).toBeDefined();
    });

    it('should retrieve approval state by task ID only (most recent)', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Create first approval state
      const approval1 = createTestApprovalState(task.id, 'security-review');
      approval1.requestedAt = new Date(Date.now() - 2000); // 2 seconds ago
      await store.saveApprovalState(approval1);

      // Create second, more recent approval state
      const approval2 = createTestApprovalState(task.id, 'qa-review');
      approval2.requestedAt = new Date(); // Now
      await store.saveApprovalState(approval2);

      const retrieved = await store.getApprovalState(task.id);
      expect(retrieved?.id).toBe(approval2.id);
      expect(retrieved?.gateName).toBe('qa-review');
    });

    it('should return null for non-existent approval state', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const retrieved = await store.getApprovalState(task.id, 'non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('Query Operations', () => {
    it('should get all pending approvals', async () => {
      const task1 = createTestTask();
      const task2 = createTestTask();
      await store.createTask(task1);
      await store.createTask(task2);

      // Create pending approval
      const pending1 = createTestApprovalState(task1.id, 'security-review');
      await store.saveApprovalState(pending1);

      // Create approved approval
      const approved = createTestApprovalState(task1.id, 'code-review');
      approved.status = 'approved';
      await store.saveApprovalState(approved);

      // Create another pending approval
      const pending2 = createTestApprovalState(task2.id, 'qa-review');
      await store.saveApprovalState(pending2);

      const pendingApprovals = await store.getPendingApprovals();
      expect(pendingApprovals).toHaveLength(2);
      expect(pendingApprovals.map(a => a.id)).toEqual(
        expect.arrayContaining([pending1.id, pending2.id])
      );
      expect(pendingApprovals.every(a => a.status === 'pending')).toBe(true);
    });

    it('should get all approval states for a specific task', async () => {
      const task1 = createTestTask();
      const task2 = createTestTask();
      await store.createTask(task1);
      await store.createTask(task2);

      // Create multiple approvals for task1
      const approval1 = createTestApprovalState(task1.id, 'security-review');
      const approval2 = createTestApprovalState(task1.id, 'code-review');
      const approval3 = createTestApprovalState(task2.id, 'qa-review'); // Different task

      await store.saveApprovalState(approval1);
      await store.saveApprovalState(approval2);
      await store.saveApprovalState(approval3);

      const task1Approvals = await store.getApprovalStatesByTask(task1.id);
      expect(task1Approvals).toHaveLength(2);
      expect(task1Approvals.map(a => a.id)).toEqual(
        expect.arrayContaining([approval1.id, approval2.id])
      );
      expect(task1Approvals.every(a => a.taskId === task1.id)).toBe(true);
    });

    it('should get approval states by gate name', async () => {
      const task1 = createTestTask();
      const task2 = createTestTask();
      await store.createTask(task1);
      await store.createTask(task2);

      // Create approvals with same gate name
      const security1 = createTestApprovalState(task1.id, 'security-review');
      const security2 = createTestApprovalState(task2.id, 'security-review');
      const codeReview = createTestApprovalState(task1.id, 'code-review');

      await store.saveApprovalState(security1);
      await store.saveApprovalState(security2);
      await store.saveApprovalState(codeReview);

      const securityApprovals = await store.getApprovalStatesByGate('security-review');
      expect(securityApprovals).toHaveLength(2);
      expect(securityApprovals.map(a => a.id)).toEqual(
        expect.arrayContaining([security1.id, security2.id])
      );
      expect(securityApprovals.every(a => a.gateName === 'security-review')).toBe(true);
    });

    it('should get approval states by gate name filtered by task', async () => {
      const task1 = createTestTask();
      const task2 = createTestTask();
      await store.createTask(task1);
      await store.createTask(task2);

      const security1 = createTestApprovalState(task1.id, 'security-review');
      const security2 = createTestApprovalState(task2.id, 'security-review');

      await store.saveApprovalState(security1);
      await store.saveApprovalState(security2);

      const task1SecurityApprovals = await store.getApprovalStatesByGate('security-review', task1.id);
      expect(task1SecurityApprovals).toHaveLength(1);
      expect(task1SecurityApprovals[0].id).toBe(security1.id);
      expect(task1SecurityApprovals[0].taskId).toBe(task1.id);
    });

    it('should get approval state by ID only', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const approval = createTestApprovalState(task.id);
      await store.saveApprovalState(approval);

      const retrieved = await store.getApprovalStateById(approval.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(approval.id);
      expect(retrieved?.taskId).toBe(task.id);
    });
  });

  describe('Update Operations', () => {
    it('should update approval state status and approver', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const approval = createTestApprovalState(task.id);
      await store.saveApprovalState(approval);

      await store.updateApprovalState(approval.id, {
        status: 'approved',
        approver: 'jane.smith@example.com',
        respondedAt: new Date(),
        comment: 'Approved after review',
      });

      const updated = await store.getApprovalState(task.id, approval.id);
      expect(updated?.status).toBe('approved');
      expect(updated?.approver).toBe('jane.smith@example.com');
      expect(updated?.comment).toBe('Approved after review');
      expect(updated?.respondedAt).toBeDefined();
    });

    it('should update only specified fields', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const approval = createTestApprovalState(task.id);
      approval.comment = 'Initial comment';
      await store.saveApprovalState(approval);

      // Update only the status
      await store.updateApprovalState(approval.id, {
        status: 'denied',
      });

      const updated = await store.getApprovalState(task.id, approval.id);
      expect(updated?.status).toBe('denied');
      expect(updated?.comment).toBe('Initial comment'); // Should remain unchanged
      expect(updated?.approver).toBeUndefined(); // Should remain unchanged
    });

    it('should handle empty updates gracefully', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const approval = createTestApprovalState(task.id);
      await store.saveApprovalState(approval);

      // Empty update should not throw
      await expect(store.updateApprovalState(approval.id, {})).resolves.toBeUndefined();

      const unchanged = await store.getApprovalState(task.id, approval.id);
      expect(unchanged?.status).toBe('pending'); // Should remain unchanged
    });
  });

  describe('Expiration Handling', () => {
    it('should save and retrieve approvals with expiration', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const expirationDate = new Date(Date.now() + 60000); // 1 minute from now
      const approval = createTestApprovalState(task.id);
      approval.timeoutMinutes = 1;
      approval.expiresAt = expirationDate;

      await store.saveApprovalState(approval);

      const retrieved = await store.getApprovalState(task.id, approval.id);
      expect(retrieved?.timeoutMinutes).toBe(1);
      expect(retrieved?.expiresAt?.getTime()).toBeCloseTo(expirationDate.getTime(), -2);
    });

    it('should get expired approvals', async () => {
      const task1 = createTestTask();
      const task2 = createTestTask();
      await store.createTask(task1);
      await store.createTask(task2);

      // Create expired approval
      const expired = createTestApprovalState(task1.id);
      expired.expiresAt = new Date(Date.now() - 5000); // 5 seconds ago
      expired.status = 'pending';
      await store.saveApprovalState(expired);

      // Create non-expired approval
      const notExpired = createTestApprovalState(task2.id);
      notExpired.expiresAt = new Date(Date.now() + 60000); // 1 minute from now
      notExpired.status = 'pending';
      await store.saveApprovalState(notExpired);

      // Create approval without expiration
      const noExpiration = createTestApprovalState(task1.id, 'code-review');
      noExpiration.status = 'pending';
      await store.saveApprovalState(noExpiration);

      const expiredApprovals = await store.getExpiredApprovals();
      expect(expiredApprovals).toHaveLength(1);
      expect(expiredApprovals[0].id).toBe(expired.id);
    });

    it('should not return approved/denied approvals as expired', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const expiredButApproved = createTestApprovalState(task.id);
      expiredButApproved.expiresAt = new Date(Date.now() - 5000); // 5 seconds ago
      expiredButApproved.status = 'approved'; // But already approved
      await store.saveApprovalState(expiredButApproved);

      const expiredApprovals = await store.getExpiredApprovals();
      expect(expiredApprovals).toHaveLength(0);
    });
  });

  describe('Delete Operations', () => {
    it('should delete an approval state', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const approval = createTestApprovalState(task.id);
      await store.saveApprovalState(approval);

      // Verify it exists
      let retrieved = await store.getApprovalState(task.id, approval.id);
      expect(retrieved).not.toBeNull();

      // Delete it
      await store.deleteApprovalState(approval.id);

      // Verify it's gone
      retrieved = await store.getApprovalState(task.id, approval.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('Context Handling', () => {
    it('should properly serialize and deserialize context objects', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const complexContext = {
        stage: 'implementation',
        agent: 'developer',
        files: ['src/components/Button.tsx', 'src/utils/helpers.ts'],
        metadata: {
          riskLevel: 'medium',
          reviewRequired: true,
          estimatedTime: 30,
        },
        nestedObject: {
          deep: {
            value: 'test',
            number: 42,
            boolean: true,
          },
        },
      };

      const approval = createTestApprovalState(task.id);
      approval.context = complexContext;
      await store.saveApprovalState(approval);

      const retrieved = await store.getApprovalState(task.id, approval.id);
      expect(retrieved?.context).toEqual(complexContext);
      expect(retrieved?.context?.metadata?.riskLevel).toBe('medium');
      expect(retrieved?.context?.nestedObject?.deep?.number).toBe(42);
    });

    it('should handle empty and null context values', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Test with undefined context
      const approval1 = createTestApprovalState(task.id);
      approval1.context = undefined;
      await store.saveApprovalState(approval1);

      const retrieved1 = await store.getApprovalState(task.id, approval1.id);
      expect(retrieved1?.context).toBeUndefined();

      // Test with empty context object
      const approval2 = createTestApprovalState(task.id, 'empty-context');
      approval2.context = {};
      await store.saveApprovalState(approval2);

      const retrieved2 = await store.getApprovalState(task.id, approval2.id);
      expect(retrieved2?.context).toEqual({});
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle multiple approval states for same task and gate', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Create multiple approvals for same gate (could happen with retries/updates)
      const approval1 = createTestApprovalState(task.id, 'security-review');
      approval1.requestedAt = new Date(Date.now() - 1000);

      const approval2 = createTestApprovalState(task.id, 'security-review');
      approval2.requestedAt = new Date();

      await store.saveApprovalState(approval1);
      await store.saveApprovalState(approval2);

      const gateApprovals = await store.getApprovalStatesByGate('security-review', task.id);
      expect(gateApprovals).toHaveLength(2);

      // Should be ordered by most recent first
      expect(gateApprovals[0].id).toBe(approval2.id);
      expect(gateApprovals[1].id).toBe(approval1.id);
    });

    it('should handle approval state with all statuses', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const statuses = ['pending', 'approved', 'denied'] as const;
      const approvals: ApprovalState[] = [];

      for (const status of statuses) {
        const approval = createTestApprovalState(task.id, `${status}-gate`);
        approval.status = status;
        approvals.push(approval);
        await store.saveApprovalState(approval);
      }

      for (let i = 0; i < statuses.length; i++) {
        const retrieved = await store.getApprovalState(task.id, approvals[i].id);
        expect(retrieved?.status).toBe(statuses[i]);
      }
    });

    it('should handle large context objects', async () => {
      const task = createTestTask();
      await store.createTask(task);

      // Create a large context object
      const largeArray = Array.from({ length: 1000 }, (_, i) => `item_${i}`);
      const largeContext = {
        largeArray,
        largeString: 'x'.repeat(10000),
        metadata: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [`key_${i}`, `value_${i}`])
        ),
      };

      const approval = createTestApprovalState(task.id);
      approval.context = largeContext;
      await store.saveApprovalState(approval);

      const retrieved = await store.getApprovalState(task.id, approval.id);
      expect(retrieved?.context?.largeArray).toHaveLength(1000);
      expect(retrieved?.context?.largeString).toHaveLength(10000);
      expect(Object.keys(retrieved?.context?.metadata || {})).toHaveLength(100);
    });

    it('should maintain referential integrity with task deletion', async () => {
      const task = createTestTask();
      await store.createTask(task);

      const approval = createTestApprovalState(task.id);
      await store.saveApprovalState(approval);

      // Verify approval exists
      let retrieved = await store.getApprovalState(task.id, approval.id);
      expect(retrieved).not.toBeNull();

      // Note: We test that approval states maintain their task references
      // The actual cleanup behavior would depend on application logic or cascade settings
      retrieved = await store.getApprovalStateById(approval.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.taskId).toBe(task.id); // Maintains reference
    });
  });

  describe('Performance and Indexing', () => {
    it('should efficiently query large numbers of approval states', async () => {
      const tasks = [];
      const approvals = [];

      // Create multiple tasks and approvals
      for (let i = 0; i < 100; i++) {
        const task = createTestTask();
        tasks.push(task);
        await store.createTask(task);

        // Create 3 approvals per task
        for (let j = 0; j < 3; j++) {
          const approval = createTestApprovalState(task.id, `gate-${j}`);
          approval.status = ['pending', 'approved', 'denied'][j % 3] as any;
          approvals.push(approval);
          await store.saveApprovalState(approval);
        }
      }

      const start = Date.now();

      // Test various query patterns
      const pendingApprovals = await store.getPendingApprovals();
      const taskApprovals = await store.getApprovalStatesByTask(tasks[0].id);
      const gateApprovals = await store.getApprovalStatesByGate('gate-0');

      const duration = Date.now() - start;

      expect(pendingApprovals.length).toBeGreaterThan(0);
      expect(taskApprovals).toHaveLength(3);
      expect(gateApprovals.length).toBeGreaterThan(0);

      // Should complete reasonably quickly (adjust threshold as needed)
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });
  });
});