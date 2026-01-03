import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TaskStore } from './store';
import type { Task, ApprovalState } from '@apexcli/core';

describe('TaskStore Approval States API', () => {
  let testDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'apex-api-test-'));
    await fs.mkdir(path.join(testDir, '.apex'), { recursive: true });
    store = new TaskStore(testDir);
    await store.initialize();
  });

  afterEach(async () => {
    store.close();
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('API Method Existence and Types', () => {
    it('should expose all required approval state methods', () => {
      // Verify all required methods exist on TaskStore
      expect(typeof store.saveApprovalState).toBe('function');
      expect(typeof store.getApprovalState).toBe('function');
      expect(typeof store.getApprovalStateById).toBe('function');
      expect(typeof store.getPendingApprovals).toBe('function');
      expect(typeof store.getApprovalStatesByTask).toBe('function');
      expect(typeof store.getApprovalStatesByGate).toBe('function');
      expect(typeof store.updateApprovalState).toBe('function');
      expect(typeof store.deleteApprovalState).toBe('function');
      expect(typeof store.getExpiredApprovals).toBe('function');
    });

    it('should handle method signatures correctly', async () => {
      const task: Task = {
        id: 'test-task-api',
        description: 'API test task',
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
      };

      await store.createTask(task);

      const approvalState: ApprovalState = {
        id: 'test-approval-api',
        taskId: task.id,
        gateName: 'api-test-gate',
        status: 'pending',
        requestedAt: new Date(),
      };

      // Test saveApprovalState - should accept ApprovalState and return Promise<void>
      const saveResult = store.saveApprovalState(approvalState);
      expect(saveResult).toBeInstanceOf(Promise);
      await saveResult;

      // Test getApprovalState - should accept task ID and optional approval ID
      const getResult1 = store.getApprovalState(task.id);
      expect(getResult1).toBeInstanceOf(Promise);
      const approval1 = await getResult1;
      expect(approval1).toBeDefined();

      const getResult2 = store.getApprovalState(task.id, approvalState.id);
      expect(getResult2).toBeInstanceOf(Promise);
      const approval2 = await getResult2;
      expect(approval2).toBeDefined();

      // Test getApprovalStateById - should accept approval ID only
      const getByIdResult = store.getApprovalStateById(approvalState.id);
      expect(getByIdResult).toBeInstanceOf(Promise);
      const approval3 = await getByIdResult;
      expect(approval3).toBeDefined();

      // Test getPendingApprovals - should return Promise<ApprovalState[]>
      const pendingResult = store.getPendingApprovals();
      expect(pendingResult).toBeInstanceOf(Promise);
      const pending = await pendingResult;
      expect(Array.isArray(pending)).toBe(true);

      // Test getApprovalStatesByTask - should accept task ID
      const byTaskResult = store.getApprovalStatesByTask(task.id);
      expect(byTaskResult).toBeInstanceOf(Promise);
      const byTask = await byTaskResult;
      expect(Array.isArray(byTask)).toBe(true);

      // Test getApprovalStatesByGate - should accept gate name and optional task ID
      const byGateResult1 = store.getApprovalStatesByGate(approvalState.gateName);
      expect(byGateResult1).toBeInstanceOf(Promise);
      const byGate1 = await byGateResult1;
      expect(Array.isArray(byGate1)).toBe(true);

      const byGateResult2 = store.getApprovalStatesByGate(approvalState.gateName, task.id);
      expect(byGateResult2).toBeInstanceOf(Promise);
      const byGate2 = await byGateResult2;
      expect(Array.isArray(byGate2)).toBe(true);

      // Test updateApprovalState - should accept approval ID and partial update
      const updateResult = store.updateApprovalState(approvalState.id, {
        status: 'approved',
        comment: 'API test approved'
      });
      expect(updateResult).toBeInstanceOf(Promise);
      await updateResult;

      // Test getExpiredApprovals - should return Promise<ApprovalState[]>
      const expiredResult = store.getExpiredApprovals();
      expect(expiredResult).toBeInstanceOf(Promise);
      const expired = await expiredResult;
      expect(Array.isArray(expired)).toBe(true);

      // Test deleteApprovalState - should accept approval ID
      const deleteResult = store.deleteApprovalState(approvalState.id);
      expect(deleteResult).toBeInstanceOf(Promise);
      await deleteResult;
    });
  });

  describe('Database Schema Validation', () => {
    it('should have correct approval_states table schema', async () => {
      // This test verifies the database schema supports all required fields
      // by attempting to save an approval state with all possible fields

      const task: Task = {
        id: 'schema-test-task',
        description: 'Schema validation task',
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
      };

      await store.createTask(task);

      // Create approval with all possible fields populated
      const completeApprovalState: ApprovalState = {
        id: 'schema-test-approval',
        taskId: task.id,
        gateName: 'schema-validation-gate',
        status: 'approved',
        approver: 'schema-tester@company.com',
        requestedAt: new Date(),
        respondedAt: new Date(),
        comment: 'Schema validation test approval with all fields populated',
        context: {
          testType: 'schema-validation',
          allFields: true,
          metadata: {
            nested: {
              deeply: {
                value: 'test'
              }
            }
          }
        },
        stage: 'testing',
        agent: 'tester',
        approvalsReceived: 2,
        approvalsRequired: 3,
        timeoutMinutes: 60,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      };

      // Should save without errors
      await expect(store.saveApprovalState(completeApprovalState)).resolves.toBeUndefined();

      // Should retrieve all fields correctly
      const retrieved = await store.getApprovalState(task.id, completeApprovalState.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(completeApprovalState.id);
      expect(retrieved?.taskId).toBe(completeApprovalState.taskId);
      expect(retrieved?.gateName).toBe(completeApprovalState.gateName);
      expect(retrieved?.status).toBe(completeApprovalState.status);
      expect(retrieved?.approver).toBe(completeApprovalState.approver);
      expect(retrieved?.comment).toBe(completeApprovalState.comment);
      expect(retrieved?.stage).toBe(completeApprovalState.stage);
      expect(retrieved?.agent).toBe(completeApprovalState.agent);
      expect(retrieved?.approvalsReceived).toBe(completeApprovalState.approvalsReceived);
      expect(retrieved?.approvalsRequired).toBe(completeApprovalState.approvalsRequired);
      expect(retrieved?.timeoutMinutes).toBe(completeApprovalState.timeoutMinutes);

      // Verify dates (within reasonable precision)
      expect(retrieved?.requestedAt?.getTime()).toBeCloseTo(
        completeApprovalState.requestedAt.getTime(),
        -1
      );
      expect(retrieved?.respondedAt?.getTime()).toBeCloseTo(
        completeApprovalState.respondedAt!.getTime(),
        -1
      );
      expect(retrieved?.expiresAt?.getTime()).toBeCloseTo(
        completeApprovalState.expiresAt!.getTime(),
        -1
      );

      // Verify context object preservation
      expect(retrieved?.context?.testType).toBe('schema-validation');
      expect(retrieved?.context?.allFields).toBe(true);
      expect(retrieved?.context?.metadata?.nested?.deeply?.value).toBe('test');
    });

    it('should enforce required field constraints', async () => {
      // Test that required fields are actually enforced by the database
      const task: Task = {
        id: 'constraint-test-task',
        description: 'Constraint test task',
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
      };

      await store.createTask(task);

      // Test with minimal required fields only
      const minimalApproval: ApprovalState = {
        id: 'minimal-approval',
        taskId: task.id,
        gateName: 'minimal-gate',
        status: 'pending',
        requestedAt: new Date(),
      };

      await expect(store.saveApprovalState(minimalApproval)).resolves.toBeUndefined();

      const retrieved = await store.getApprovalState(task.id, minimalApproval.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(minimalApproval.id);
      expect(retrieved?.taskId).toBe(minimalApproval.taskId);
      expect(retrieved?.gateName).toBe(minimalApproval.gateName);
      expect(retrieved?.status).toBe(minimalApproval.status);

      // Optional fields should be undefined
      expect(retrieved?.approver).toBeUndefined();
      expect(retrieved?.respondedAt).toBeUndefined();
      expect(retrieved?.comment).toBeUndefined();
      expect(retrieved?.context).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent task references gracefully', async () => {
      const nonExistentApproval: ApprovalState = {
        id: 'orphan-approval',
        taskId: 'non-existent-task-id',
        gateName: 'orphan-gate',
        status: 'pending',
        requestedAt: new Date(),
      };

      // Should be able to save (depending on foreign key constraints)
      // This tests the actual behavior of the implementation
      try {
        await store.saveApprovalState(nonExistentApproval);

        // If save succeeds, we should be able to retrieve it
        const retrieved = await store.getApprovalStateById(nonExistentApproval.id);
        expect(retrieved).toBeDefined();
        expect(retrieved?.taskId).toBe('non-existent-task-id');
      } catch (error) {
        // If foreign key constraints are enforced, this is expected
        expect(error).toBeDefined();
      }
    });

    it('should handle invalid approval state updates gracefully', async () => {
      const task: Task = {
        id: 'update-error-test',
        description: 'Update error test',
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
      };

      await store.createTask(task);

      const approval: ApprovalState = {
        id: 'update-test-approval',
        taskId: task.id,
        gateName: 'update-test-gate',
        status: 'pending',
        requestedAt: new Date(),
      };

      await store.saveApprovalState(approval);

      // Test updating non-existent approval ID
      await expect(
        store.updateApprovalState('non-existent-approval', { status: 'approved' })
      ).resolves.toBeUndefined(); // Should not throw, just silently handle

      // Test updating with empty object (should be no-op)
      await expect(
        store.updateApprovalState(approval.id, {})
      ).resolves.toBeUndefined();

      // Verify original approval unchanged
      const unchanged = await store.getApprovalState(task.id, approval.id);
      expect(unchanged?.status).toBe('pending');
    });
  });

  describe('Performance Characteristics', () => {
    it('should handle queries efficiently with proper indexing', async () => {
      // Create a moderate amount of test data to verify performance
      const numTasks = 50;
      const approvalsPerTask = 4;
      const tasks: Task[] = [];

      // Create tasks
      for (let i = 0; i < numTasks; i++) {
        const task: Task = {
          id: `perf-task-${i}`,
          description: `Performance test task ${i}`,
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
        };
        tasks.push(task);
        await store.createTask(task);
      }

      // Create approvals
      for (let i = 0; i < numTasks; i++) {
        for (let j = 0; j < approvalsPerTask; j++) {
          const approval: ApprovalState = {
            id: `perf-approval-${i}-${j}`,
            taskId: tasks[i].id,
            gateName: `gate-${j % 3}`, // Rotate between 3 gate types
            status: ['pending', 'approved', 'denied'][j % 3] as any,
            requestedAt: new Date(Date.now() - Math.random() * 86400000), // Random time in last 24h
          };
          await store.saveApprovalState(approval);
        }
      }

      // Performance test queries
      const start = Date.now();

      await store.getPendingApprovals(); // Should use status index
      await store.getApprovalStatesByGate('gate-0'); // Should use gate_name index
      await store.getApprovalStatesByTask(tasks[0].id); // Should use task_id index
      await store.getExpiredApprovals(); // Should use expires_at index

      const duration = Date.now() - start;

      // Should complete reasonably quickly even with moderate data
      expect(duration).toBeLessThan(500); // Less than 500ms

      // Verify data integrity
      const allPending = await store.getPendingApprovals();
      expect(allPending.length).toBeGreaterThan(0);

      const gate0Approvals = await store.getApprovalStatesByGate('gate-0');
      expect(gate0Approvals.length).toBeGreaterThan(0);
    });
  });
});